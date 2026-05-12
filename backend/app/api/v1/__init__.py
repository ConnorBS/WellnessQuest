from fastapi import APIRouter

from app.api.v1 import (
    activity,
    activity_presets,
    admin,
    api_tokens,
    auth,
    ha,
    habits,
    integrations,
    telemetry,
    uploads,
    users,
    water,
    water_presets,
    webhooks,
)

api_v1 = APIRouter(prefix="/api/v1")
api_v1.include_router(auth.router)
api_v1.include_router(users.router)
api_v1.include_router(water.router)
api_v1.include_router(water_presets.router)
api_v1.include_router(activity.router)
api_v1.include_router(activity_presets.router)
api_v1.include_router(habits.router)
api_v1.include_router(uploads.router)
api_v1.include_router(api_tokens.router)
api_v1.include_router(integrations.router)
api_v1.include_router(webhooks.router)
api_v1.include_router(ha.router)
api_v1.include_router(telemetry.router)
api_v1.include_router(admin.router)


@api_v1.get("/healthz", tags=["meta"])
async def healthz() -> dict[str, str]:
    return {"status": "ok"}
