from datetime import date, datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Payment(Base):
	__tablename__ = "payments"

	id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
	loan_id: Mapped[str] = mapped_column(String(36), ForeignKey("loans.id", ondelete="CASCADE"), nullable=False, index=True)
	amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
	payment_date: Mapped[date] = mapped_column(Date, nullable=False)
	payment_number: Mapped[int] = mapped_column(Integer, nullable=False)
	notes: Mapped[str | None] = mapped_column(Text, nullable=True)
	source: Mapped[str] = mapped_column(String(30), nullable=False, default="manual")
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

	loan = relationship("Loan", back_populates="payments")
