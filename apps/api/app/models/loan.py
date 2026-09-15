from datetime import date, datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import Boolean, Date, DateTime, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Loan(Base):
	__tablename__ = "loans"

	id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
	name: Mapped[str] = mapped_column(String(120), nullable=False)
	category: Mapped[str] = mapped_column(String(40), nullable=False, default="personal")
	description: Mapped[str | None] = mapped_column(Text, nullable=True)
	original_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
	current_balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
	payment_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
	total_number_of_payments: Mapped[int | None] = mapped_column(Integer, nullable=True)
	payments_made: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
	payments_remaining: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
	interest_rate: Mapped[Decimal | None] = mapped_column(Numeric(6, 4), nullable=True)
	start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
	due_day: Mapped[int | None] = mapped_column(Integer, nullable=True)
	next_due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
	estimated_payoff_date: Mapped[date | None] = mapped_column(Date, nullable=True)
	autopay: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
	status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
	updated_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True),
		nullable=False,
		default=datetime.utcnow,
		onupdate=datetime.utcnow,
	)

	payments = relationship("Payment", back_populates="loan", cascade="all, delete-orphan")
