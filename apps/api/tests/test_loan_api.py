from fastapi.testclient import TestClient


def create_sample_loan(client: TestClient) -> dict:
    response = client.post(
        "/loans",
        json={
            "name": "Engagement Ring",
            "category": "jewelry",
            "description": None,
            "original_amount": "6000.00",
            "current_balance": "2400.00",
            "payment_amount": "200.00",
            "total_number_of_payments": 30,
            "payments_made": 18,
            "interest_rate": "0",
            "start_date": "2026-09-15",
            "due_day": 5,
            "autopay": True,
            "status": "active",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_create_loan_and_record_payment_updates_metrics(client: TestClient) -> None:
    loan = create_sample_loan(client)

    payment_response = client.post(
        f"/loans/{loan['id']}/payments",
        json={"amount": "200.00", "payment_date": "2026-10-05", "source": "manual"},
    )

    assert payment_response.status_code == 201
    updated = client.get(f"/loans/{loan['id']}").json()
    assert updated["current_balance"] == "2200.00"
    assert updated["payments_made"] == 19
    assert updated["payments_remaining"] == 11
    assert updated["next_due_date"] == "2026-11-05"


def test_delete_payment_reverses_loan_metrics(client: TestClient) -> None:
    loan = create_sample_loan(client)
    payment = client.post(
        f"/loans/{loan['id']}/payments",
        json={"amount": "200.00", "payment_date": "2026-10-05", "source": "manual"},
    ).json()

    delete_response = client.delete(f"/payments/{payment['id']}")

    assert delete_response.status_code == 204
    updated = client.get(f"/loans/{loan['id']}").json()
    assert updated["current_balance"] == "2400.00"
    assert updated["payments_made"] == 18
    assert updated["payments_remaining"] == 12
    assert updated["next_due_date"] == "2026-10-05"


def test_archived_loan_rejects_new_payments(client: TestClient) -> None:
    loan = create_sample_loan(client)
    archive_response = client.patch(f"/loans/{loan['id']}", json={"status": "archived"})
    assert archive_response.status_code == 200

    payment_response = client.post(
        f"/loans/{loan['id']}/payments",
        json={"amount": "200.00", "payment_date": "2026-10-05", "source": "manual"},
    )

    assert payment_response.status_code == 400


def test_update_loan_recalculates_next_due_date_and_category(client: TestClient) -> None:
    loan = create_sample_loan(client)

    response = client.patch(
        f"/loans/{loan['id']}",
        json={"category": "vehicle", "start_date": "2026-01-31", "due_day": 31},
    )

    assert response.status_code == 200
    updated = response.json()
    assert updated["category"] == "vehicle"
    assert updated["next_due_date"] == "2026-02-28"


def test_dashboard_summary_and_seed_endpoint(client: TestClient) -> None:
    seed_response = client.post("/dev/seed-demo?reset=true")

    assert seed_response.status_code == 200
    assert seed_response.json()["created_loans"] == 3

    summary = client.get("/dashboard/summary").json()
    assert summary["total_payments_remaining"] > 0
    assert summary["next_payment"]["category"] in {"jewelry", "vehicle", "furniture"}
