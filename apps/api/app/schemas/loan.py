from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class LoanBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: str = Field(default="personal", max_length=40)
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


class LoanCreate(LoanBase):
    pass


class LoanUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    category: str | None = Field(default=None, max_length=40)
    description: str | None = None
    original_amount: Decimal | None = Field(default=None, gt=0)
    current_balance: Decimal | None = Field(default=None, ge=0)
    payment_amount: Decimal | None = Field(default=None, gt=0)
    total_number_of_payments: int | None = Field(default=None, gt=0)
    payments_made: int | None = Field(default=None, ge=0)
    interest_rate: Decimal | None = Field(default=None, ge=0)
    start_date: date | None = None
    due_day: int | None = Field(default=None, ge=1, le=31)
    next_due_date: date | None = None
    autopay: bool | None = None
    status: str | None = None


class LoanResponse(LoanBase):
    id: str
    payments_remaining: int
    progress_percentage: float = 0.0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
