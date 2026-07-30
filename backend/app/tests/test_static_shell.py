"""The frontend ships as a Next static export served straight off StaticFiles.

Every page has a sibling `.txt` RSC payload. When the image is rebuilt under a
still-open tab, the App Router sees a build-id mismatch and gives up on the
client-side transition by doing a *browser* navigation to that `.txt` URL — the
user taps "See all" and lands on a wall of raw flight payload. These cover the
guard that bounces those navigations back to the real page.
"""

from __future__ import annotations

import pytest

from app.main import html_path_for_rsc

DOCUMENT = {"sec-fetch-dest": "document"}
RSC_FETCH = {"sec-fetch-dest": "empty", "rsc": "1"}


@pytest.mark.parametrize(
    ("rsc_path", "expected"),
    [
        ("/period/index.txt", "/period/"),
        ("/settings/integrations/index.txt", "/settings/integrations/"),
        ("/period.txt", "/period"),
        ("/index.txt", "/"),
    ],
)
def test_html_path_for_rsc(rsc_path: str, expected: str) -> None:
    assert html_path_for_rsc(rsc_path) == expected


@pytest.mark.asyncio
async def test_document_navigation_to_rsc_payload_redirects(client):
    r = await client.get("/period/index.txt", headers=DOCUMENT)
    assert r.status_code == 307
    assert r.headers["location"].endswith("/period/")
    assert r.headers["cache-control"] == "no-store"


@pytest.mark.asyncio
async def test_redirect_preserves_the_query_string(client):
    r = await client.get("/medications/index.txt?id=7", headers=DOCUMENT)
    assert r.status_code == 307
    assert r.headers["location"].endswith("/medications/?id=7")


@pytest.mark.asyncio
async def test_router_rsc_fetches_are_left_alone(client):
    """The router's own payload fetch must still reach the file, not a redirect."""
    r = await client.get("/period/index.txt", headers=RSC_FETCH)
    assert r.status_code != 307


@pytest.mark.asyncio
async def test_api_routes_are_untouched(client):
    r = await client.get("/api/v1/version", headers=DOCUMENT)
    assert r.status_code == 200
    assert "cache-control" not in r.headers or r.headers["cache-control"] != "no-cache"
