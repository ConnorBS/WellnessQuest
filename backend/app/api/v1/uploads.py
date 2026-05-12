from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, status
from fastapi import UploadFile as FastAPIUploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.user import User
from app.schemas.upload import UploadOut
from app.services import uploads_service
from app.services.uploads_service import UploadError
from app.telemetry.recorder import audit

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("/icons", response_model=UploadOut, status_code=status.HTTP_201_CREATED)
async def upload_icon(
    file: FastAPIUploadFile = File(...),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> UploadOut:
    raw = await file.read()
    try:
        row = await uploads_service.create_icon_upload(
            db,
            user=user,
            filename=file.filename or "upload",
            content_type=file.content_type or "application/octet-stream",
            raw=raw,
        )
    except UploadError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc

    await audit(
        db,
        actor=f"user:{user.id}",
        action="upload.icon.create",
        user_id=user.id,
        target_type="upload_file",
        target_id=str(row.id),
        meta={"size_bytes": row.size_bytes, "content_type": row.content_type},
    )
    return UploadOut(
        id=row.id,
        filename=row.filename,
        content_type=row.content_type,
        size_bytes=row.size_bytes,
        url=f"/api/v1/uploads/{row.id}",
    )


@router.get("/{upload_id}")
async def get_upload_file(
    upload_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    row = await uploads_service.get_upload(db, upload_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    path = Path(row.storage_path)
    if not path.is_file():  # noqa: ASYNC240 - local fs existence check; static files served from same dir

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="file_missing")
    return FileResponse(
        path,
        media_type=row.content_type,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
