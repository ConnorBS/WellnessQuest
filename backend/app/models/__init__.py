"""SQLAlchemy models. Importing this package registers every model on Base.metadata."""

from app.models.api_token import ApiToken
from app.models.audit_log import AuditLog
from app.models.error_log import ErrorLog
from app.models.goal import Goal
from app.models.integration import Integration
from app.models.invite import Invite
from app.models.session import Session
from app.models.streak import Streak
from app.models.user import User
from app.models.water_entry import WaterEntry
from app.models.webhook import WebhookDelivery, WebhookSubscription
from app.models.xp_event import XpEvent

__all__ = [
    "ApiToken",
    "AuditLog",
    "ErrorLog",
    "Goal",
    "Integration",
    "Invite",
    "Session",
    "Streak",
    "User",
    "WaterEntry",
    "WebhookDelivery",
    "WebhookSubscription",
    "XpEvent",
]
