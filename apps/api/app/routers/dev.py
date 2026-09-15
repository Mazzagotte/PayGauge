from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.loan import Loan
from app.models.payment import Payment
from app.services.loan_calculations import calculate_payments_remaining, estimate_payoff_date, to_money

router = APIRouter()


def _refresh_metrics(loan: Loan) -> None:
	loan.payments_remaining = calculate_payments_remaining(
		total_number_of_payments=loan.total_number_of_payments,
		payments_made=loan.payments_made,
		current_balance=loan.current_balance,
		payment_amount=loan.payment_amount,
	)
	loan.estimated_payoff_date = estimate_payoff_date(loan.next_due_date, loan.due_day, loan.payments_remaining)
	if loan.payments_remaining == 0 or loan.current_balance <= Decimal("0"):
		loan.status = "completed"


@router.post("/seed-demo")
def seed_demo(reset: bool = False, db: Session = Depends(get_db)) -> dict[str, int]:
	if reset:
		db.execute(delete(Payment))
		db.execute(delete(Loan))
	elif db.scalar(select(Loan.id).limit(1)):
		return {"created_loans": 0, "created_payments": 0}

	demo_loans = [
		Loan(
			name="Engagement Ring",
			category="jewelry",
			description="Zales financing",
			original_amount=to_money("6000"),
			current_balance=to_money("2400"),
			payment_amount=to_money("200"),
			total_number_of_payments=30,
			payments_made=18,
			interest_rate=Decimal("0"),
			start_date=date(2025, 1, 5),
			due_day=5,
			next_due_date=date(2026, 10, 5),
			autopay=True,
			status="active",
		),
		Loan(
			name="Truck",
			category="vehicle",
			description="Vehicle loan",
			original_amount=to_money("24700"),
			current_balance=to_money("12350"),
			payment_amount=to_money("650"),
			total_number_of_payments=38,
			payments_made=19,
			interest_rate=Decimal("0"),
			start_date=date(2025, 3, 12),
			due_day=12,
			next_due_date=date(2026, 10, 12),
			autopay=True,
			status="active",
		),
		Loan(
			name="Furniture",
			category="furniture",
			description="Living room set",
			original_amount=to_money("2040"),
			current_balance=to_money("1020"),
			payment_amount=to_money("170"),
			total_number_of_payments=12,
			payments_made=6,
			interest_rate=Decimal("0"),
			start_date=date(2026, 3, 28),
			due_day=28,
			next_due_date=date(2026, 9, 28),
			autopay=False,
			status="active",
		),
	]

	created_payments = 0
	for loan in demo_loans:
		_refresh_metrics(loan)
		db.add(loan)
		db.flush()
		if loan.name == "Engagement Ring":
			for number in range(1, 7):
				db.add(
					Payment(
						loan_id=loan.id,
						amount=loan.payment_amount,
						payment_date=date(2026, number + 3, 5),
						payment_number=number + 12,
						source="manual",
					)
				)
				created_payments += 1

	db.commit()
	return {"created_loans": len(demo_loans), "created_payments": created_payments}
