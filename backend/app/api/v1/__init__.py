from fastapi import APIRouter

from app.api.v1 import (
    activity,
    activity_presets,
    admin,
    api_tokens,
    auth,
    blood_pressure,
    features,
    food,
    food_presets,
    food_recipes,
    ha,
    habits,
    integrations,
    mood,
    period,
    setup,
    sleep,
    steps,
    telemetry,
    titles,
    uploads,
    users,
    version,
    water,
    water_presets,
    webhooks,
    weight,
)

api_v1 = APIRouter(prefix="/api/v1")
api_v1.include_router(setup.router)
api_v1.include_router(auth.router)
api_v1.include_router(users.router)
api_v1.include_router(features.router)
api_v1.include_router(water.router)
api_v1.include_router(water_presets.router)
# Activity endpoints are mounted under two prefixes. /activity is the original
# path kept for API-token / external consumers; /move is an alias the PWA uses
# because ad/privacy blockers match the word "activity" in a URL and silently
# kill POST /api/v1/activity (ERR_BLOCKED_BY_CLIENT). Both serve the same
# handlers.
api_v1.include_router(activity.router, prefix="/activity")
api_v1.include_router(activity.router, prefix="/move")
api_v1.include_router(activity_presets.router, prefix="/activity/presets")
api_v1.include_router(activity_presets.router, prefix="/move/presets")
api_v1.include_router(steps.router)
api_v1.include_router(sleep.router)
api_v1.include_router(food.router)
api_v1.include_router(food_presets.router)
api_v1.include_router(food_recipes.router)
api_v1.include_router(habits.router)
api_v1.include_router(weight.router)
api_v1.include_router(blood_pressure.router)
api_v1.include_router(mood.router)
api_v1.include_router(period.router)
api_v1.include_router(titles.router)
api_v1.include_router(uploads.router)
api_v1.include_router(api_tokens.router)
api_v1.include_router(integrations.router)
api_v1.include_router(webhooks.router)
api_v1.include_router(ha.router)
api_v1.include_router(telemetry.router)
api_v1.include_router(admin.router)
api_v1.include_router(version.router)


@api_v1.get("/healthz", tags=["meta"])
async def healthz() -> dict[str, str]:
    return {"status": "ok"}
