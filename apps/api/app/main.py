from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.routers import backup, bills, dashboard, dev, health, loans, notifications, payments
from app.db.session import Base, engine
from app.models import loan, notification_preferences, payment  # noqa: F401

app = FastAPI(title="PayGauge API", version="0.1.0")

app.add_middleware(
	CORSMiddleware,
	allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
	Base.metadata.create_all(bind=engine)
	inspector = inspect(engine)
	if "loans" in inspector.get_table_names():
		columns = {column["name"] for column in inspector.get_columns("loans")}
		if "category" not in columns:
			with engine.begin() as connection:
				connection.execute(text("ALTER TABLE loans ADD COLUMN category VARCHAR(40) NOT NULL DEFAULT 'personal'"))

app.include_router(health.router)
app.include_router(backup.router, prefix="/backup", tags=["backup"])
app.include_router(dev.router, prefix="/dev", tags=["dev"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
app.include_router(loans.router, prefix="/loans", tags=["loans"])
app.include_router(payments.router, prefix="/payments", tags=["payments"])
app.include_router(bills.router, prefix="/bills", tags=["bills"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
