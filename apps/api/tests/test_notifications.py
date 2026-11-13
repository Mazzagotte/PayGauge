from datetime import date, time
from decimal import Decimal

from fastapi.testclient import TestClient

from app.models.loan import Loan
from app.models.notification_preferences import NotificationPreferences
from app.services.notification_rules import build_notification_items, milestone_for


def test_notification_rules_include_autopay_confirmation_for_due_autopay() -> None:
	loan = Loan(
		id="loan-1",
		name="Engagement Ring",
		category="jewelry",
		original_amount=Decimal("6000.00"),
		current_balance=Decimal("2400.00"),
		payment_amount=Decimal("200.00"),
		total_number_of_payments=30,
		payments_made=18,
		payments_remaining=12,
		start_date=date(2025, 1, 5),
		due_day=5,
		next_due_date=date(2026, 9, 15),
		autopay=True,
		status="active",
	)
	preferences = NotificationPreferences(
		payment_reminders=True,
		autopay_reminders=True,
		payment_confirmations=True,
		milestone_alerts=True,
		days_before_due=2,
		autopay_confirmation_delay_hours=6,
		quiet_hours_start=time(22, 0),
		quiet_hours_end=time(7, 0),
	)

	items = build_notification_items([loan], preferences, today=date(2026, 9, 15))

	assert any(item.type == "autopay_confirmation" and item.action_required for item in items)


def test_milestone_for_remaining_counts() -> None:
	assert milestone_for(10) == "10 payments left"
	assert milestone_for(5) == "5 payments left"
	assert milestone_for(1) == "Final payment coming up"
	assert milestone_for(0) == "Paid off"


def test_notification_preferences_and_previews(client: TestClient) -> None:
	client.post("/dev/seed-demo?reset=true")

	update = client.put("/notifications/preferences", json={"days_before_due": 3, "quiet_hours_start": "21:00:00"})
	assert update.status_code == 200
	assert update.json()["days_before_due"] == 3

	queue = client.get("/notifications/queue")
	assert queue.status_code == 200
	assert queue.json()["items"]

	previews = client.get("/notifications/previews")
	assert previews.status_code == 200
	assert previews.json()["items"]
	preview_ids = [item["id"] for item in previews.json()["items"]]
	assert len(preview_ids) == len(set(preview_ids))


def test_payment_response_includes_milestone_metadata(client: TestClient) -> None:
	loan = client.post(
		"/loans",
		json={
			"name": "Furniture",
			"category": "furniture",
			"description": None,
			"original_amount": "1000.00",
			"current_balance": "100.00",
			"payment_amount": "100.00",
			"total_number_of_payments": 10,
			"payments_made": 9,
			"interest_rate": "0",
			"start_date": "2026-09-15",
			"due_day": 15,
			"autopay": False,
			"status": "active",
		},
	).json()

	response = client.post(f"/loans/{loan['id']}/payments", json={"amount": "100.00", "payment_date": "2026-09-15"})

	assert response.status_code == 201
	assert response.json()["milestone"] == "Paid off"
	assert "Furniture" in response.json()["notification_title"]
