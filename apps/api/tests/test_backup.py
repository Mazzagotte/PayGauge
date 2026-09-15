from fastapi.testclient import TestClient


def test_backup_export_and_import_round_trip(client: TestClient) -> None:
	client.post("/dev/seed-demo?reset=true")
	export_response = client.get("/backup/export")

	assert export_response.status_code == 200
	backup = export_response.json()
	assert backup["app"] == "PayGauge"
	assert len(backup["loans"]) == 3
	assert len(backup["payments"]) > 0

	client.post("/dev/seed-demo?reset=true")
	import_response = client.post("/backup/import?reset=true", json=backup)

	assert import_response.status_code == 200
	assert import_response.json()["imported_loans"] == 3
	assert import_response.json()["imported_payments"] == len(backup["payments"])

	loans_response = client.get("/loans")
	assert loans_response.status_code == 200
	assert len(loans_response.json()) == 3


def test_backup_import_rejects_wrong_app(client: TestClient) -> None:
	response = client.post("/backup/import", json={"app": "Other", "loans": [], "payments": []})

	assert response.status_code == 400
