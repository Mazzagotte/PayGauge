from datetime import date
from decimal import Decimal, ROUND_CEILING, ROUND_HALF_UP


TWOPLACES = Decimal("0.01")


def to_money(value: Decimal | str | float | int) -> Decimal:
    return Decimal(value).quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def clamp_due_date(year: int, month: int, due_day: int) -> date:
    day = max(1, min(due_day, days_in_month(year, month)))
    return date(year, month, day)


def days_in_month(year: int, month: int) -> int:
    if month == 12:
        return (date(year + 1, 1, 1) - date(year, month, 1)).days
    return (date(year, month + 1, 1) - date(year, month, 1)).days


def add_months_due_date(base_date: date, due_day: int) -> date:
    year = base_date.year
    month = base_date.month + 1
    if month == 13:
        month = 1
        year += 1
    return clamp_due_date(year, month, due_day)


def subtract_months_due_date(base_date: date, due_day: int) -> date:
    year = base_date.year
    month = base_date.month - 1
    if month == 0:
        month = 12
        year -= 1
    return clamp_due_date(year, month, due_day)


def initial_next_due_date(start_date: date | None, due_day: int | None) -> date | None:
    if not start_date or not due_day:
        return None
    candidate = clamp_due_date(start_date.year, start_date.month, due_day)
    if candidate <= start_date:
        return add_months_due_date(candidate, due_day)
    return candidate


def calculate_payments_remaining(
    *,
    total_number_of_payments: int | None,
    payments_made: int,
    current_balance: Decimal,
    payment_amount: Decimal,
) -> int:
    if total_number_of_payments is not None:
        return max(total_number_of_payments - payments_made, 0)
    if payment_amount <= Decimal("0"):
        return 0
    quotient = (current_balance / payment_amount).to_integral_value(rounding=ROUND_CEILING)
    return max(int(quotient), 0)


def calculate_progress_percentage(
    *,
    total_number_of_payments: int | None,
    payments_made: int,
    original_amount: Decimal,
    current_balance: Decimal,
) -> float:
    if total_number_of_payments and total_number_of_payments > 0:
        return round(min((payments_made / total_number_of_payments) * 100, 100), 2)
    if original_amount <= Decimal("0"):
        return 0.0
    paid = max(original_amount - current_balance, Decimal("0"))
    return round(min(float((paid / original_amount) * 100), 100), 2)


def estimate_payoff_date(next_due_date: date | None, due_day: int | None, payments_remaining: int) -> date | None:
    if payments_remaining <= 0:
        return next_due_date
    if not next_due_date or not due_day:
        return None

    estimate = next_due_date
    for _ in range(payments_remaining - 1):
        estimate = add_months_due_date(estimate, due_day)
    return estimate
