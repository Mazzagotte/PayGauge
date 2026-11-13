from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class BackupLoan(BaseModel):
	id: str
	name: str
	category: str = "personal"
	description: str | None = None
	original_amount: Decimal = Field(gt=0)
	current_balance: Decimal = Field(ge=0)
	payment_amount: Decimal = Field(gt=0)
	total_number_of_payments: int | None = Field(default=None, gt=0)
	payments_made: int = Field(default=0, ge=0)
	interest_rate: Decimal | None = Field(default=None, ge=0)
	start_date: date | None = None
	due_day: int | None = Field(default=None, ge=1, le=31)
	next_due_date: date | None = None
	estimated_payoff_date: date | None = None
	autopay: bool = False
	status: str = "active"
	created_at: datetime | None = None
	updated_at: datetime | None = None


class BackupPayment(BaseModel):
	id: str
	loan_id: str
	amount: Decimal = Field(gt=0)
	payment_date: date
	payment_number: int = Field(ge=1)
	notes: str | None = None
	source: str = "manual"
	created_at: datetime | None = None


class BackupPayload(BaseModel):
	app: str = "PayGauge"
	exported_at: datetime | None = None
	loans: list[BackupLoan] = []
	payments: list[BackupPayment] = []


class BackupImportResult(BaseModel):
	imported_loans: int
	imported_payments: int
	skipped_payments: int = 0
