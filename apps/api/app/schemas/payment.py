from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class PaymentCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    payment_date: date
    notes: str | None = None
    source: str = "manual"


class PaymentUpdate(BaseModel):
    amount: Decimal | None = Field(default=None, gt=0)
    payment_date: date | None = None
    notes: str | None = None
    source: str | None = None


class PaymentResponse(BaseModel):
    id: str
    loan_id: str
    amount: Decimal
    payment_date: date
    payment_number: int
    notes: str | None
    source: str
    created_at: datetime
    milestone: str | None = None
    notification_title: str | None = None
    notification_body: str | None = None

    model_config = ConfigDict(from_attributes=True)
