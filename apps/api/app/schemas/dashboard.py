from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class DashboardLoanSummary(BaseModel):
    id: str
    name: str
    category: str
    current_balance: Decimal
    payment_amount: Decimal
    payments_remaining: int
    progress_percentage: float
    next_due_date: date | None
    due_day: int | None
    autopay: bool
    status: str


class DashboardSummary(BaseModel):
    total_remaining_balance: Decimal
    total_monthly_payments: Decimal
    total_payments_remaining: int
    loans_completed: int
    next_payment: DashboardLoanSummary | None
    upcoming_payments: list[DashboardLoanSummary]
    active_loans: list[DashboardLoanSummary]
