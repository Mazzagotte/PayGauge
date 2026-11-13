# Initial Data Model

## loans

Tracks financed items and fixed/estimated payoff progress.

Suggested fields: id, name, lender, original_amount, current_balance, payment_amount, total_payments, payments_made, interest_rate, start_date, due_day, autopay, status, notes, created_at, updated_at.

## payments

Immutable payment history. Suggested fields: id, loan_id, bill_id, amount, payment_date, payment_number, source (manual/autopay-confirmed), note, created_at.

## bills

Suggested fields: id, name, category, amount, recurrence, due_day, autopay, active, reminder_days_before, confirmation_required, notes.

## notification_preferences

Global defaults plus per-loan/per-bill overrides for due reminders, autopay-day notifications, confirmation reminders, and milestones.
