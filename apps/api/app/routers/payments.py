from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.loan import Loan
from app.models.payment import Payment
from app.schemas.payment import PaymentResponse, PaymentUpdate
from app.services.loan_calculations import (
	calculate_payments_remaining,
	estimate_payoff_date,
	subtract_months_due_date,
	to_money,
)

router = APIRouter()


def _apply_loan_metrics(loan: Loan) -> None:
	loan.current_balance = to_money(max(Decimal("0"), loan.current_balance))
	loan.payments_made = max(loan.payments_made, 0)
	loan.payments_remaining = calculate_payments_remaining(
		total_number_of_payments=loan.total_number_of_payments,
		payments_made=loan.payments_made,
		current_balance=loan.current_balance,
		payment_amount=loan.payment_amount,
	)
	loan.estimated_payoff_date = estimate_payoff_date(
		loan.next_due_date,
		loan.due_day,
		loan.payments_remaining,
	)

	if loan.current_balance <= Decimal("0") or loan.payments_remaining == 0:
		if loan.status != "archived":
			loan.status = "completed"
	elif loan.status == "completed":
		loan.status = "active"


@router.get("", response_model=list[PaymentResponse])
def list_payments(db: Session = Depends(get_db)) -> list[PaymentResponse]:
	payments = db.scalars(select(Payment).order_by(Payment.payment_date.desc(), Payment.created_at.desc())).all()
	return [PaymentResponse.model_validate(payment) for payment in payments]


@router.patch("/{payment_id}", response_model=PaymentResponse)
def update_payment(payment_id: str, payload: PaymentUpdate, db: Session = Depends(get_db)) -> PaymentResponse:
	payment = db.get(Payment, payment_id)
	if not payment:
		raise HTTPException(status_code=404, detail="Payment not found")

	loan = db.get(Loan, payment.loan_id)
	if not loan:
		raise HTTPException(status_code=404, detail="Loan not found")

	old_amount = payment.amount
	updates = payload.model_dump(exclude_unset=True)

	if "amount" in updates and updates["amount"] is not None:
		new_amount = to_money(updates["amount"])
		delta = new_amount - old_amount
		loan.current_balance = to_money(max(Decimal("0"), loan.current_balance - delta))
		payment.amount = new_amount

	if "payment_date" in updates:
		payment.payment_date = updates["payment_date"]
	if "notes" in updates:
		payment.notes = updates["notes"]
	if "source" in updates and updates["source"]:
		payment.source = updates["source"]

	_apply_loan_metrics(loan)
	db.commit()
	db.refresh(payment)
	return PaymentResponse.model_validate(payment)


@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment(payment_id: str, db: Session = Depends(get_db)) -> None:
	payment = db.get(Payment, payment_id)
	if not payment:
		raise HTTPException(status_code=404, detail="Payment not found")

	loan = db.get(Loan, payment.loan_id)
	if not loan:
		raise HTTPException(status_code=404, detail="Loan not found")

	loan.current_balance = to_money(loan.current_balance + payment.amount)
	loan.payments_made = max(loan.payments_made - 1, 0)
	if loan.due_day and loan.next_due_date:
		loan.next_due_date = subtract_months_due_date(loan.next_due_date, loan.due_day)

	db.delete(payment)

	payments = db.scalars(
		select(Payment)
		.where(Payment.loan_id == loan.id, Payment.id != payment_id)
		.order_by(Payment.payment_date.asc(), Payment.created_at.asc())
	).all()
	for idx, existing in enumerate(payments, start=1):
		existing.payment_number = idx

	_apply_loan_metrics(loan)
	db.commit()
