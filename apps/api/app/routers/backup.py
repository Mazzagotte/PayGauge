from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.loan import Loan
from app.models.payment import Payment
from app.schemas.backup import BackupImportResult, BackupLoan, BackupPayload, BackupPayment
from app.services.loan_calculations import calculate_payments_remaining, estimate_payoff_date, to_money

router = APIRouter()


def _refresh_metrics(loan: Loan) -> None:
	loan.current_balance = to_money(loan.current_balance)
	loan.original_amount = to_money(loan.original_amount)
	loan.payment_amount = to_money(loan.payment_amount)
	loan.payments_remaining = calculate_payments_remaining(
		total_number_of_payments=loan.total_number_of_payments,
		payments_made=loan.payments_made,
		current_balance=loan.current_balance,
		payment_amount=loan.payment_amount,
	)
	loan.estimated_payoff_date = estimate_payoff_date(loan.next_due_date, loan.due_day, loan.payments_remaining)
	if loan.status != "archived" and (loan.current_balance <= 0 or loan.payments_remaining == 0):
		loan.status = "completed"


def _loan_to_backup(loan: Loan) -> BackupLoan:
	return BackupLoan.model_validate(loan, from_attributes=True)


def _payment_to_backup(payment: Payment) -> BackupPayment:
	return BackupPayment.model_validate(payment, from_attributes=True)


@router.get("/export", response_model=BackupPayload)
def export_backup(db: Session = Depends(get_db)) -> BackupPayload:
	loans = db.scalars(select(Loan).order_by(Loan.created_at)).all()
	payments = db.scalars(select(Payment).order_by(Payment.payment_date, Payment.created_at)).all()
	return BackupPayload(
		exported_at=datetime.utcnow(),
		loans=[_loan_to_backup(loan) for loan in loans],
		payments=[_payment_to_backup(payment) for payment in payments],
	)


@router.post("/import", response_model=BackupImportResult)
def import_backup(payload: BackupPayload, reset: bool = True, db: Session = Depends(get_db)) -> BackupImportResult:
	if payload.app != "PayGauge":
		raise HTTPException(status_code=400, detail="Backup file is not a PayGauge backup")

	if reset:
		db.execute(delete(Payment))
		db.execute(delete(Loan))

	imported_loans = 0
	loan_ids: set[str] = set()
	for backup_loan in payload.loans:
		loan = db.get(Loan, backup_loan.id)
		if loan is None:
			loan = Loan(id=backup_loan.id)
			db.add(loan)
			imported_loans += 1
		for field, value in backup_loan.model_dump(exclude={"created_at", "updated_at"}).items():
			setattr(loan, field, value)
		if backup_loan.created_at:
			loan.created_at = backup_loan.created_at
		if backup_loan.updated_at:
			loan.updated_at = backup_loan.updated_at
		_refresh_metrics(loan)
		loan_ids.add(loan.id)

	db.flush()

	imported_payments = 0
	skipped_payments = 0
	for backup_payment in payload.payments:
		if backup_payment.loan_id not in loan_ids and db.get(Loan, backup_payment.loan_id) is None:
			skipped_payments += 1
			continue
		payment = db.get(Payment, backup_payment.id)
		if payment is None:
			payment = Payment(id=backup_payment.id)
			db.add(payment)
			imported_payments += 1
		for field, value in backup_payment.model_dump(exclude={"created_at"}).items():
			setattr(payment, field, value)
		if backup_payment.created_at:
			payment.created_at = backup_payment.created_at

	db.commit()
	return BackupImportResult(imported_loans=imported_loans, imported_payments=imported_payments, skipped_payments=skipped_payments)
