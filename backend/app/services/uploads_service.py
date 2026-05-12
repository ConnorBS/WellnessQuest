from __future__ import annotations

import hashlib
import io
import uuid
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.upload_file import UploadFile
from app.models.user import User

ALLOWED_INPUT_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}
TARGET_MAX_DIMENSION = 512
OUTPUT_CONTENT_TYPE = "image/webp"
OUTPUT_EXT = ".webp"


class UploadError(ValueError):
    pass


def _uploads_dir() -> Path:
    p = Path(settings.uploads_dir)
    p.mkdir(parents=True, exist_ok=True)
    return p


def _user_dir(user_id: uuid.UUID) -> Path:
    p = _uploads_dir() / str(user_id)
    p.mkdir(parents=True, exist_ok=True)
    return p


def storage_path_for(user_id: uuid.UUID, upload_id: uuid.UUID) -> Path:
    return _user_dir(user_id) / f"{upload_id}{OUTPUT_EXT}"


def _process_image(raw: bytes) -> bytes:
    try:
        probe = Image.open(io.BytesIO(raw))
        probe.verify()
    except (UnidentifiedImageError, OSError) as exc:
        raise UploadError("invalid_image") from exc

    img = Image.open(io.BytesIO(raw))
    img = ImageOps.exif_transpose(img) or img
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
    img.thumbnail((TARGET_MAX_DIMENSION, TARGET_MAX_DIMENSION), Image.Resampling.LANCZOS)

    out = io.BytesIO()
    img.save(out, format="WEBP", quality=85, method=6)
    return out.getvalue()


async def create_icon_upload(
    db: AsyncSession,
    *,
    user: User,
    filename: str,
    content_type: str,
    raw: bytes,
) -> UploadFile:
    if content_type not in ALLOWED_INPUT_TYPES:
        raise UploadError("unsupported_content_type")
    if len(raw) > settings.upload_max_bytes:
        raise UploadError("file_too_large")
    if len(raw) == 0:
        raise UploadError("empty_file")

    processed = _process_image(raw)
    sha = hashlib.sha256(processed).hexdigest()

    upload_id = uuid.uuid4()
    path = storage_path_for(user.id, upload_id)
    path.write_bytes(processed)

    row = UploadFile(
        id=upload_id,
        user_id=user.id,
        filename=filename[:255],
        content_type=OUTPUT_CONTENT_TYPE,
        size_bytes=len(processed),
        sha256=sha,
        storage_path=str(path),
    )
    db.add(row)
    await db.flush()
    return row


async def get_upload(db: AsyncSession, upload_id: uuid.UUID) -> UploadFile | None:
    return (
        await db.execute(select(UploadFile).where(UploadFile.id == upload_id))
    ).scalar_one_or_none()
