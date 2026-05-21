from fastapi import APIRouter

from app.api.v1 import (
    activity,
    activity_presets,
    admin,
    api_tokens,
    auth,
    blood_pressure,
    food,
    food_presets,
    food_recipes,
    ha,
    habits,
    integrations,
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
api_v1.include_router(water.router)
api_v1.include_router(water_presets.router)
api_v1.include_router(activity.router)
api_v1.include_router(activity_presets.router)
api_v1.include_router(steps.router)
api_v1.include_router(sleep.router)
api_v1.include_router(food.router)
api_v1.include_router(food_presets.router)
api_v1.include_router(food_recipes.router)
api_v1.include_router(habits.router)
api_v1.include_router(weight.router)
api_v1.include_router(blood_pressure.router)
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
