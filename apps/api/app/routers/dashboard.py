from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.loan import Loan
from app.schemas.dashboard import DashboardLoanSummary, DashboardSummary
from app.services.loan_calculations import calculate_progress_percentage, to_money

router = APIRouter()


def _loan_summary(loan: Loan) -> DashboardLoanSummary:
    return DashboardLoanSummary(
        id=loan.id,
        name=loan.name,
        category=loan.category,
        current_balance=loan.current_balance,
        payment_amount=loan.payment_amount,
        payments_remaining=loan.payments_remaining,
        progress_percentage=calculate_progress_percentage(
            total_number_of_payments=loan.total_number_of_payments,
            payments_made=loan.payments_made,
            original_amount=loan.original_amount,
            current_balance=loan.current_balance,
        ),
        next_due_date=loan.next_due_date,
        due_day=loan.due_day,
        autopay=loan.autopay,
        status=loan.status,
    )


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(db: Session = Depends(get_db)) -> DashboardSummary:
    loans = db.scalars(select(Loan).order_by(Loan.next_due_date.is_(None), Loan.next_due_date, Loan.created_at)).all()
    active_loans = [loan for loan in loans if loan.status == "active"]
    completed_loans = [loan for loan in loans if loan.status == "completed"]
    upcoming = [loan for loan in active_loans if loan.next_due_date is not None]

    return DashboardSummary(
        total_remaining_balance=to_money(sum((loan.current_balance for loan in active_loans), Decimal("0"))),
        total_monthly_payments=to_money(sum((loan.payment_amount for loan in active_loans), Decimal("0"))),
        total_payments_remaining=sum(loan.payments_remaining for loan in active_loans),
        loans_completed=len(completed_loans),
        next_payment=_loan_summary(upcoming[0]) if upcoming else None,
        upcoming_payments=[_loan_summary(loan) for loan in upcoming[:5]],
        active_loans=[_loan_summary(loan) for loan in active_loans],
    )
