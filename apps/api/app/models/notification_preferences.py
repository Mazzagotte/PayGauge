from datetime import datetime, time

from sqlalchemy import Boolean, DateTime, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class NotificationPreferences(Base):
	__tablename__ = "notification_preferences"

	id: Mapped[str] = mapped_column(String(20), primary_key=True, default="default")
	payment_reminders: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
	autopay_reminders: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
	payment_confirmations: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
	milestone_alerts: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
	days_before_due: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
	autopay_confirmation_delay_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=6)
	quiet_hours_start: Mapped[time] = mapped_column(Time, nullable=False, default=time(22, 0))
	quiet_hours_end: Mapped[time] = mapped_column(Time, nullable=False, default=time(7, 0))
	timezone: Mapped[str] = mapped_column(String(60), nullable=False, default="local")
	updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
