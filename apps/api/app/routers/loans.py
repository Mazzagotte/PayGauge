from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.loan import Loan
from app.models.payment import Payment
from app.schemas.loan import LoanCreate, LoanResponse, LoanUpdate
from app.schemas.payment import PaymentCreate, PaymentResponse
from app.services.loan_calculations import (
	add_months_due_date,
	calculate_payments_remaining,
	calculate_progress_percentage,
	estimate_payoff_date,
	initial_next_due_date,
	to_money,
)
from app.services.notification_rules import milestone_for

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


def _to_response(loan: Loan) -> LoanResponse:
	payload = LoanResponse.model_validate(loan)
	payload.progress_percentage = calculate_progress_percentage(
		total_number_of_payments=loan.total_number_of_payments,
		payments_made=loan.payments_made,
		original_amount=loan.original_amount,
		current_balance=loan.current_balance,
	)
	return payload


@router.get("", response_model=list[LoanResponse])
def list_loans(db: Session = Depends(get_db)) -> list[LoanResponse]:
	loans = db.scalars(select(Loan).order_by(Loan.next_due_date.is_(None), Loan.next_due_date, Loan.created_at)).all()
	return [_to_response(loan) for loan in loans]


@router.post("", response_model=LoanResponse, status_code=status.HTTP_201_CREATED)
def create_loan(payload: LoanCreate, db: Session = Depends(get_db)) -> LoanResponse:
	loan = Loan(
		name=payload.name,
		category=payload.category,
		description=payload.description,
		original_amount=to_money(payload.original_amount),
		current_balance=to_money(payload.current_balance),
		payment_amount=to_money(payload.payment_amount),
		total_number_of_payments=payload.total_number_of_payments,
		payments_made=payload.payments_made,
		interest_rate=payload.interest_rate,
		start_date=payload.start_date,
		due_day=payload.due_day,
		next_due_date=payload.next_due_date,
		estimated_payoff_date=payload.estimated_payoff_date,
		autopay=payload.autopay,
		status=payload.status,
	)
	if loan.next_due_date is None:
		loan.next_due_date = initial_next_due_date(loan.start_date, loan.due_day)
	_apply_loan_metrics(loan)

	db.add(loan)
	db.commit()
	db.refresh(loan)
	return _to_response(loan)


@router.get("/{loan_id}", response_model=LoanResponse)
def get_loan(loan_id: str, db: Session = Depends(get_db)) -> LoanResponse:
	loan = db.get(Loan, loan_id)
	if not loan:
		raise HTTPException(status_code=404, detail="Loan not found")
	return _to_response(loan)


@router.patch("/{loan_id}", response_model=LoanResponse)
def update_loan(loan_id: str, payload: LoanUpdate, db: Session = Depends(get_db)) -> LoanResponse:
	loan = db.get(Loan, loan_id)
	if not loan:
		raise HTTPException(status_code=404, detail="Loan not found")

	updates = payload.model_dump(exclude_unset=True)
	for field, value in updates.items():
		if field in {"original_amount", "current_balance", "payment_amount"} and value is not None:
			setattr(loan, field, to_money(value))
		else:
			setattr(loan, field, value)
	if {"start_date", "due_day"}.intersection(updates) and "next_due_date" not in updates:
		loan.next_due_date = initial_next_due_date(loan.start_date, loan.due_day)

	_apply_loan_metrics(loan)
	db.commit()
	db.refresh(loan)
	return _to_response(loan)


@router.delete("/{loan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_loan(loan_id: str, db: Session = Depends(get_db)) -> None:
	loan = db.get(Loan, loan_id)
	if not loan:
		raise HTTPException(status_code=404, detail="Loan not found")

	db.delete(loan)
	db.commit()


@router.get("/{loan_id}/payments", response_model=list[PaymentResponse])
def list_loan_payments(loan_id: str, db: Session = Depends(get_db)) -> list[PaymentResponse]:
	loan = db.get(Loan, loan_id)
	if not loan:
		raise HTTPException(status_code=404, detail="Loan not found")

	payments = db.scalars(
		select(Payment)
		.where(Payment.loan_id == loan_id)
		.order_by(Payment.payment_date.desc(), Payment.created_at.desc())
	).all()
	return [PaymentResponse.model_validate(payment) for payment in payments]


@router.post("/{loan_id}/payments", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def create_loan_payment(loan_id: str, payload: PaymentCreate, db: Session = Depends(get_db)) -> PaymentResponse:
	loan = db.get(Loan, loan_id)
	if not loan:
		raise HTTPException(status_code=404, detail="Loan not found")
	if loan.status == "archived":
		raise HTTPException(status_code=400, detail="Cannot record payments for an archived loan")

	amount = to_money(payload.amount)
	payment = Payment(
		loan_id=loan.id,
		amount=amount,
		payment_date=payload.payment_date,
		payment_number=loan.payments_made + 1,
		notes=payload.notes,
		source=payload.source,
	)

	loan.current_balance = to_money(max(Decimal("0"), loan.current_balance - amount))
	loan.payments_made += 1
	if loan.due_day and loan.next_due_date:
		loan.next_due_date = add_months_due_date(loan.next_due_date, loan.due_day)
	elif loan.due_day and loan.next_due_date is None:
		loan.next_due_date = add_months_due_date(payload.payment_date, loan.due_day)

	_apply_loan_metrics(loan)

	db.add(payment)
	db.commit()
	db.refresh(payment)
	response = PaymentResponse.model_validate(payment)
	milestone = milestone_for(loan.payments_remaining)
	if milestone:
		response.milestone = milestone
		response.notification_title = f"{milestone}: {loan.name}"
		response.notification_body = f"PayGauge shows {loan.payments_remaining} payments left after this payment."
	return response
