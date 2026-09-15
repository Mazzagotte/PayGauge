from datetime import date
from decimal import Decimal

from app.services.loan_calculations import (
    add_months_due_date,
    calculate_payments_remaining,
    calculate_progress_percentage,
    estimate_payoff_date,
    subtract_months_due_date,
)


def test_payments_remaining_uses_total_count_when_present() -> None:
    remaining = calculate_payments_remaining(
        total_number_of_payments=36,
        payments_made=11,
        current_balance=Decimal("5400.00"),
        payment_amount=Decimal("200.00"),
    )
    assert remaining == 25


def test_payments_remaining_uses_balance_when_total_not_present() -> None:
    remaining = calculate_payments_remaining(
        total_number_of_payments=None,
        payments_made=0,
        current_balance=Decimal("505.00"),
        payment_amount=Decimal("100.00"),
    )
    assert remaining == 6


def test_progress_percentage_handles_final_payment() -> None:
    progress = calculate_progress_percentage(
        total_number_of_payments=12,
        payments_made=12,
        original_amount=Decimal("2400.00"),
        current_balance=Decimal("0.00"),
    )
    assert progress == 100.0


def test_due_date_rollover_for_31st_and_february() -> None:
    january_due = date(2026, 1, 31)
    feb_due = add_months_due_date(january_due, 31)
    assert feb_due == date(2026, 2, 28)

    march_due = add_months_due_date(feb_due, 31)
    assert march_due == date(2026, 3, 31)


def test_leap_year_rollover_from_january_30() -> None:
    january_due = date(2028, 1, 30)
    feb_due = add_months_due_date(january_due, 30)
    assert feb_due == date(2028, 2, 29)


def test_estimated_payoff_date_from_remaining_count() -> None:
    payoff = estimate_payoff_date(date(2026, 9, 15), 15, 4)
    assert payoff == date(2026, 12, 15)


def test_due_date_can_move_back_for_payment_deletion() -> None:
    after_advance = date(2026, 5, 31)
    previous = subtract_months_due_date(after_advance, 31)
    assert previous == date(2026, 4, 30)
