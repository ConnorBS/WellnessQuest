from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class BloodPressureEntryIn(BaseModel):
    systolic: int = Field(..., ge=1, le=299)
    diastolic: int = Field(..., ge=1, le=199)
    pulse: int | None = Field(default=None, ge=1, le=299)
    occurred_at: datetime | None = None
    note: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def _systolic_above_diastolic(self) -> BloodPressureEntryIn:
        if self.systolic <= self.diastolic:
            raise ValueError("systolic_must_exceed_diastolic")
        return self


class BloodPressureEntryOut(BaseModel):
    id: int
    systolic: int
    diastolic: int
    pulse: int | None = None
    occurred_at: datetime
    note: str | None = None


class BloodPressureEntryPatch(BaseModel):
    """All fields optional; only provided ones are updated. The
    systolic > diastolic invariant is re-checked against the merged result
    in the service, not here, since either side may be unset."""

    systolic: int | None = Field(default=None, ge=1, le=299)
    diastolic: int | None = Field(default=None, ge=1, le=199)
    pulse: int | None = Field(default=None, ge=1, le=299)
    occurred_at: datetime | None = None
    note: str | None = Field(default=None, max_length=500)


class BloodPressureTargetIn(BaseModel):
    # Both None = explicit "no target as of effective_at" (clears the goal).
    # Otherwise both must be present and range-checked.
    target_systolic: int | None = None
    target_diastolic: int | None = None
    effective_at: datetime | None = None

    @model_validator(mode="after")
    def _validate_pair(self) -> BloodPressureTargetIn:
        sys_set = self.target_systolic is not None
        dia_set = self.target_diastolic is not None
        if sys_set != dia_set:
            raise ValueError("target_systolic_and_diastolic_must_both_be_set_or_null")
        if sys_set:
            assert self.target_systolic is not None
            assert self.target_diastolic is not None
            if not (1 <= self.target_systolic <= 299):
                raise ValueError("target_systolic_out_of_range")
            if not (1 <= self.target_diastolic <= 199):
                raise ValueError("target_diastolic_out_of_range")
            if self.target_systolic <= self.target_diastolic:
                raise ValueError("target_systolic_must_exceed_diastolic")
        return self


class BloodPressureTargetOut(BaseModel):
    id: int
    target_systolic: int | None
    target_diastolic: int | None
    effective_at: datetime


class BloodPressureSummaryOut(BaseModel):
    latest: BloodPressureEntryOut | None
    current_target: BloodPressureTargetOut | None = None
