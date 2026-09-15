from datetime import date, timedelta
from decimal import Decimal

from app.models.loan import Loan
from app.models.notification_preferences import NotificationPreferences
from app.schemas.notifications import NotificationItem


MILESTONES = {10: "10 payments left", 5: "5 payments left", 1: "Final payment coming up"}


def milestone_for(payments_remaining: int) -> str | None:
	if payments_remaining == 0:
		return "Paid off"
	return MILESTONES.get(payments_remaining)


def build_notification_items(loans: list[Loan], preferences: NotificationPreferences, today: date | None = None) -> list[NotificationItem]:
	today = today or date.today()
	items: list[NotificationItem] = []

	for loan in loans:
		if loan.status != "active" or loan.next_due_date is None:
			continue

		payments_after = max(loan.payments_remaining - 1, 0)
		amount = loan.payment_amount if loan.current_balance > loan.payment_amount else loan.current_balance
		reminder_date = loan.next_due_date - timedelta(days=preferences.days_before_due)

		if preferences.payment_reminders and reminder_date >= today:
			items.append(
				NotificationItem(
					id=f"{loan.id}:payment-reminder:{loan.next_due_date.isoformat()}",
					loan_id=loan.id,
					loan_name=loan.name,
					category=loan.category,
					type="payment_reminder",
					title=f"{loan.name} payment coming up",
					body=f"{amount} due on {loan.next_due_date.isoformat()}. {payments_after} payments will remain after this payment.",
					scheduled_for=reminder_date,
					amount=amount,
					payments_remaining_after=payments_after,
				)
			)

		if preferences.payment_reminders and loan.next_due_date >= today:
			items.append(
				NotificationItem(
					id=f"{loan.id}:due:{loan.next_due_date.isoformat()}",
					loan_id=loan.id,
					loan_name=loan.name,
					category=loan.category,
					type="payment_due",
					title=f"{loan.name} payment today" if loan.next_due_date == today else f"{loan.name} payment due",
					body=f"{amount} due. {payments_after} payments will remain after this payment.",
					scheduled_for=loan.next_due_date,
					amount=amount,
					payments_remaining_after=payments_after,
				)
			)

		if loan.autopay and preferences.autopay_reminders and loan.next_due_date >= today:
			items.append(
				NotificationItem(
					id=f"{loan.id}:autopay:{loan.next_due_date.isoformat()}",
					loan_id=loan.id,
					loan_name=loan.name,
					category=loan.category,
					type="autopay_scheduled",
					title=f"{loan.name} autopay scheduled",
					body=f"{amount} is scheduled for autopay. Confirm after it processes before PayGauge records it.",
					scheduled_for=loan.next_due_date,
					amount=amount,
					payments_remaining_after=payments_after,
				)
			)

		if loan.autopay and preferences.payment_confirmations and loan.next_due_date <= today:
			items.append(
				NotificationItem(
					id=f"{loan.id}:confirm:{loan.next_due_date.isoformat()}",
					loan_id=loan.id,
					loan_name=loan.name,
					category=loan.category,
					type="autopay_confirmation",
					title=f"Confirm {loan.name} payment",
					body=f"Did the {amount} autopay process? Only mark it paid after confirming.",
					scheduled_for=today,
					amount=amount,
					payments_remaining_after=payments_after,
					action_required=True,
				)
			)

		milestone = milestone_for(loan.payments_remaining)
		if milestone and preferences.milestone_alerts:
			items.append(
				NotificationItem(
					id=f"{loan.id}:milestone:{loan.payments_remaining}",
					loan_id=loan.id,
					loan_name=loan.name,
					category=loan.category,
					type="milestone",
					title=f"{milestone}: {loan.name}",
					body=f"PayGauge shows {loan.payments_remaining} payments left on this loan.",
					scheduled_for=today,
					amount=loan.payment_amount,
					payments_remaining_after=loan.payments_remaining,
				)
			)

	return sorted(items, key=lambda item: (item.scheduled_for, item.action_required is False, item.type))


def first_preview(items: list[NotificationItem], notification_type: str, allow_fallback: bool = False) -> NotificationItem | None:
	for item in items:
		if item.type == notification_type:
			return item
	return items[0] if allow_fallback and items else None
