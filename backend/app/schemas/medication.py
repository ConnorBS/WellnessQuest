from __future__ import annotations

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


class MedicationIn(BaseModel):
    """Create a medication. The dose fields seed its first (`started`) change
    row; leave them out if you only know the name."""

    name: str = Field(..., min_length=1, max_length=120)
    form: str | None = Field(default=None, max_length=20)
    reason: str | None = Field(default=None, max_length=200)
    prescriber: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=2000)
    started_on: date | None = None
    dose_amount: Decimal | None = Field(default=None, gt=Decimal("0"))
    dose_unit: str | None = Field(default=None, max_length=20)
    frequency: str | None = Field(default=None, max_length=80)


class MedicationPatch(BaseModel):
    """Identity fields only — correcting a name or prescriber is not a dose
    change, so it appends nothing to the timeline. Unset fields are untouched;
    explicit null clears the optional ones."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    form: str | None = Field(default=None, max_length=20)
    reason: str | None = Field(default=None, max_length=200)
    prescriber: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=2000)
    started_on: date | None = None


class MedicationChangeIn(BaseModel):
    kind: str = Field(default="dose_change", max_length=20)
    effective_on: date | None = None
    dose_amount: Decimal | None = Field(default=None, gt=Decimal("0"))
    dose_unit: str | None = Field(default=None, max_length=20)
    frequency: str | None = Field(default=None, max_length=80)
    note: str | None = Field(default=None, max_length=2000)


class MedicationStopIn(BaseModel):
    ended_on: date | None = None
    reason: str | None = Field(default=None, max_length=200)


class MedicationResumeIn(BaseModel):
    effective_on: date | None = None
    note: str | None = Field(default=None, max_length=2000)


class MedicationReorderIn(BaseModel):
    ids: list[int]


class MedicationChangeOut(BaseModel):
    id: int
    medication_id: int
    kind: str
    effective_on: date
    dose_amount: Decimal | None
    dose_unit: str | None
    frequency: str | None
    note: str | None


class MedicationChangeFeedOut(MedicationChangeOut):
    """A change row with its medication's name folded in, for the combined
    across-medications history feed."""

    medication_name: str


class MedicationOut(BaseModel):
    id: int
    name: str
    form: str | None
    reason: str | None
    prescriber: str | None
    notes: str | None
    started_on: date
    ended_on: date | None
    stopped_reason: str | None
    sort_order: int
    # True while `ended_on` is NULL — the "currently taking" list.
    active: bool
    # Folded from the change timeline, not stored. Null when no row has ever
    # carried that field.
    dose_amount: Decimal | None
    dose_unit: str | None
    frequency: str | None
    change_count: int


class MedicationDetailOut(MedicationOut):
    # Newest first.
    changes: list[MedicationChangeOut]


class MedicationOptionsOut(BaseModel):
    """Vocabularies the pickers render, served from the backend so the CHECK
    constraints and the UI can't drift apart."""

    forms: list[str]
    dose_units: list[str]
    change_kinds: list[str]
