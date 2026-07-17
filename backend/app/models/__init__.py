"""SQLAlchemy models. Importing this package registers every model on Base.metadata."""

from app.models.activity_entry import ActivityEntry
from app.models.activity_preset import ActivityPreset
from app.models.api_token import ApiToken
from app.models.audit_log import AuditLog
from app.models.blood_pressure_entry import BloodPressureEntry
from app.models.blood_pressure_target import BloodPressureTarget
from app.models.error_log import ErrorLog
from app.models.food_entry import FoodEntry
from app.models.food_preset import FoodPreset
from app.models.food_recipe import FoodRecipe
from app.models.food_recipe_ingredient import FoodRecipeIngredient
from app.models.goal import Goal
from app.models.habit import Habit
from app.models.habit_checkin import HabitCheckin
from app.models.integration import Integration
from app.models.session import Session
from app.models.sleep_entry import SleepEntry
from app.models.steps_entry import StepsEntry
from app.models.streak import Streak
from app.models.title import Title
from app.models.upload_file import UploadFile
from app.models.user import User
from app.models.user_feature_pref import UserFeaturePref
from app.models.user_title import UserTitle
from app.models.water_entry import WaterEntry
from app.models.water_preset import WaterPreset
from app.models.webhook import WebhookDelivery, WebhookSubscription
from app.models.weight_entry import WeightEntry
from app.models.weight_target import WeightTarget
from app.models.xp_event import XpEvent

__all__ = [
    "ActivityEntry",
    "ActivityPreset",
    "ApiToken",
    "AuditLog",
    "BloodPressureEntry",
    "BloodPressureTarget",
    "ErrorLog",
    "FoodEntry",
    "FoodPreset",
    "FoodRecipe",
    "FoodRecipeIngredient",
    "Goal",
    "Habit",
    "HabitCheckin",
    "Integration",
    "Session",
    "SleepEntry",
    "StepsEntry",
    "Streak",
    "Title",
    "UploadFile",
    "User",
    "UserFeaturePref",
    "UserTitle",
    "WaterEntry",
    "WaterPreset",
    "WebhookDelivery",
    "WebhookSubscription",
    "WeightEntry",
    "WeightTarget",
    "XpEvent",
]
