from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.loan import Loan
from app.models.notification_preferences import NotificationPreferences
from app.schemas.notifications import (
	NotificationPreferencesResponse,
	NotificationPreferencesUpdate,
	NotificationPreviewResponse,
	NotificationTestRequest,
	NotificationTestResponse,
)
from app.services.notification_rules import build_notification_items, first_preview

router = APIRouter()


def _preferences(db: Session) -> NotificationPreferences:
	preferences = db.get(NotificationPreferences, "default")
	if preferences is None:
		preferences = NotificationPreferences(id="default")
		db.add(preferences)
		db.commit()
		db.refresh(preferences)
	return preferences


def _active_loans(db: Session) -> list[Loan]:
	return list(db.scalars(select(Loan).where(Loan.status == "active").order_by(Loan.next_due_date.is_(None), Loan.next_due_date, Loan.created_at)).all())


@router.get("/preferences", response_model=NotificationPreferencesResponse)
def get_preferences(db: Session = Depends(get_db)) -> NotificationPreferencesResponse:
	return NotificationPreferencesResponse.model_validate(_preferences(db))


@router.put("/preferences", response_model=NotificationPreferencesResponse)
def update_preferences(payload: NotificationPreferencesUpdate, db: Session = Depends(get_db)) -> NotificationPreferencesResponse:
	preferences = _preferences(db)
	for field, value in payload.model_dump(exclude_unset=True).items():
		setattr(preferences, field, value)
	db.commit()
	db.refresh(preferences)
	return NotificationPreferencesResponse.model_validate(preferences)


@router.get("/queue", response_model=NotificationPreviewResponse)
def get_queue(db: Session = Depends(get_db)) -> NotificationPreviewResponse:
	return NotificationPreviewResponse(items=build_notification_items(_active_loans(db), _preferences(db)))


@router.get("/previews", response_model=NotificationPreviewResponse)
def get_previews(db: Session = Depends(get_db)) -> NotificationPreviewResponse:
	items = build_notification_items(_active_loans(db), _preferences(db))
	preview_types = ["payment_due", "autopay_confirmation", "milestone"]
	previews = [preview for notification_type in preview_types if (preview := first_preview(items, notification_type))]
	return NotificationPreviewResponse(items=previews)


@router.post("/test", response_model=NotificationTestResponse)
def create_test_notification(payload: NotificationTestRequest, db: Session = Depends(get_db)) -> NotificationTestResponse:
	items = build_notification_items(_active_loans(db), _preferences(db))
	return NotificationTestResponse(item=first_preview(items, payload.type, allow_fallback=True))
