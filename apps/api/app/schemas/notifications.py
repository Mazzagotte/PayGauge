from datetime import date, datetime, time
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class NotificationPreferencesResponse(BaseModel):
	id: str = "default"
	payment_reminders: bool = True
	autopay_reminders: bool = True
	payment_confirmations: bool = True
	milestone_alerts: bool = True
	days_before_due: int = 2
	autopay_confirmation_delay_hours: int = 6
	quiet_hours_start: time = time(22, 0)
	quiet_hours_end: time = time(7, 0)
	timezone: str = "local"
	updated_at: datetime | None = None

	model_config = ConfigDict(from_attributes=True)


class NotificationPreferencesUpdate(BaseModel):
	payment_reminders: bool | None = None
	autopay_reminders: bool | None = None
	payment_confirmations: bool | None = None
	milestone_alerts: bool | None = None
	days_before_due: int | None = Field(default=None, ge=0, le=30)
	autopay_confirmation_delay_hours: int | None = Field(default=None, ge=1, le=24)
	quiet_hours_start: time | None = None
	quiet_hours_end: time | None = None
	timezone: str | None = Field(default=None, max_length=60)


class NotificationItem(BaseModel):
	id: str
	loan_id: str
	loan_name: str
	category: str
	type: str
	title: str
	body: str
	scheduled_for: date
	amount: Decimal
	payments_remaining_after: int
	action_required: bool = False


class NotificationPreviewResponse(BaseModel):
	items: list[NotificationItem]


class NotificationTestRequest(BaseModel):
	type: str = "payment_due"


class NotificationTestResponse(BaseModel):
	item: NotificationItem | None
