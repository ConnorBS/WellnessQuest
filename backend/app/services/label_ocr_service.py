"""Run Tesseract OCR on a nutrition-label image and hand off to the parser.

Tesseract is mature, free, on-device, and surprisingly good on the regulated
Canadian Nutrition Facts layout (Schedule L of the FDR). It's not perfect on
angled / glossy photos — the review screen in the UI is the safety net.

The OCR step is deliberately CPU-only (no GPU, no API calls). The container
needs `tesseract-ocr`, `tesseract-ocr-eng`, and `tesseract-ocr-fra` installed
at the OS level — see backend/Dockerfile.
"""
from __future__ import annotations

import asyncio
import io

from PIL import Image, ImageOps, UnidentifiedImageError

from app.parsers import canadian_nutrition_facts as parser
from app.schemas.food import LabelScanOut

ALLOWED_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
}
MAX_BYTES = 8 * 1024 * 1024  # 8 MB — labels photographed close-up rarely exceed this.


class LabelOcrError(ValueError):
    pass


async def scan(*, raw: bytes, content_type: str) -> LabelScanOut:
    """Multipart-image → parsed Canadian Nutrition Facts.

    Wraps the synchronous PIL + Tesseract pipeline in `run_in_executor` so it
    doesn't block the event loop. Errors during decode raise a typed
    LabelOcrError so the endpoint can surface a 400 rather than a 500.
    """
    if content_type.lower() not in ALLOWED_CONTENT_TYPES:
        raise LabelOcrError(f"unsupported_content_type: {content_type}")
    if len(raw) == 0:
        raise LabelOcrError("empty_file")
    if len(raw) > MAX_BYTES:
        raise LabelOcrError("file_too_large")

    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _scan_sync, raw)


def _scan_sync(raw: bytes) -> LabelScanOut:
    text = _ocr(raw)
    parsed = parser.parse(text)
    return LabelScanOut(
        name=parsed.name,
        brand=parsed.brand,
        serving_g=parsed.serving_g,
        serving_label=parsed.serving_label,
        kcal=parsed.kcal,
        nutrients=parsed.nutrients,
        raw_text=text,
        language=parsed.language,
    )


def _ocr(raw: bytes) -> str:
    """Run Tesseract on the image. Returns "" if Tesseract isn't installed
    so the parser still has a chance to find structure in the (empty) text —
    the resulting LabelScanOut will surface blank fields that the user fills."""
    try:
        import pytesseract
    except ImportError:
        return ""

    try:
        img = Image.open(io.BytesIO(raw))
    except (UnidentifiedImageError, OSError) as exc:
        raise LabelOcrError("invalid_image") from exc

    img = ImageOps.exif_transpose(img) or img
    # Tesseract works best on grayscale with high contrast. Stick to the
    # simple, robust pipeline; deskew + adaptive threshold via OpenCV is a
    # second-pass improvement we can layer on later if accuracy is too low
    # on the real-world photos.
    if img.mode != "L":
        img = img.convert("L")

    # Phone photos of packaged labels are commonly rotated 90° or 180° from
    # upright — EXIF orientation handles screen-rotation, but a label
    # photographed across the long axis of a box has no EXIF hint. Ask
    # Tesseract's orientation+script detection (OSD) what to do. OSD is
    # cheap and degrades gracefully when the image has too little text to
    # decide.
    img = _auto_orient(img, pytesseract)

    # Bilingual layout — Tesseract switches between languages per word when
    # both are configured. PSM 6 = "uniform block of text", which matches a
    # Nutrition Facts panel better than the default automatic page seg.
    try:
        return str(
            pytesseract.image_to_string(img, lang="eng+fra", config="--psm 6")
        )
    except pytesseract.TesseractNotFoundError:
        # The pytesseract wrapper imported but the OS binary is missing.
        # Return empty text — the user gets a blank review form to fill in,
        # which is still better than a 500.
        return ""
    except Exception:  # noqa: BLE001 - last-chance to keep the request alive
        return ""


def _auto_orient(img: Image.Image, pytesseract: object) -> Image.Image:
    """Rotate `img` to upright using Tesseract OSD. Returns the original
    when OSD can't decide (low confidence, too little text, missing osd
    traineddata)."""
    try:
        osd = pytesseract.image_to_osd(img, output_type=pytesseract.Output.DICT)  # type: ignore[attr-defined]
    except Exception:  # noqa: BLE001 - OSD often raises on text-sparse images
        return img
    # `rotate` in the OSD result is the angle (in degrees) the image needs
    # to be rotated COUNTER-CLOCKWISE to be upright. Confidence below ~1.0
    # is unreliable; below that, leave the image alone.
    try:
        confidence = float(osd.get("orientation_conf", 0))
        rotate_by = int(osd.get("rotate", 0)) % 360
    except (TypeError, ValueError):
        return img
    if confidence < 1.0 or rotate_by == 0:
        return img
    return img.rotate(-rotate_by, expand=True)
