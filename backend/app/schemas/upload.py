from __future__ import annotations

import uuid

from pydantic import BaseModel


class UploadOut(BaseModel):
    id: uuid.UUID
    filename: str
    content_type: str
    size_bytes: int
    url: str
