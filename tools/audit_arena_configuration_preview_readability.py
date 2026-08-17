#!/usr/bin/env python3
"""Fail closed unless Arena configuration previews remain readable after compression."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ROOT = REPO_ROOT / "apps/client/public"
MANIFEST_PATH = REPO_ROOT / "apps/client/src/game/assets/arenaSkillRuntimeManifest.json"
CSS_PATH = REPO_ROOT / "apps/client/src/styles/arenaSkillLoadout.css"
OUTPUT_ROOT = REPO_ROOT / (
    "docs/design/arena-dynamic-gameplay-review/"
    "configuration-gameplay-previews-cdn-20260817"
)
OUTPUT_PATH = OUTPUT_ROOT / "readability-audit.json"
SOURCE_SIZE = (1920, 1080)
PREVIEW_SIZE = (896, 504)
MIN_DISPLAY_WIDTH = 608
MIN_ZOOM_FACTOR = 2.0
MIN_VIDEO_FRAME_RATE = 29.0
VIDEO_ENCODING = "vp9-webm-crf34-30fps-physical-crop"


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def public_path(url: str) -> Path:
    return PUBLIC_ROOT / url.removeprefix("/")


def css_number(css: str, selector: str, property_name: str) -> int | None:
    matches = re.findall(
        rf"{re.escape(selector)}\s*\{{([^}}]+)\}}",
        css,
        flags=re.MULTILINE,
    )
    if not matches:
        return None
    declaration = matches[0]
    value = re.search(rf"{re.escape(property_name)}:\s*(\d+)px", declaration)
    return int(value.group(1)) if value else None


def contains(outer: list[int], inner: list[int]) -> bool:
    ox, oy, ow, oh = outer
    ix0, iy0, ix1, iy1 = inner
    return ox <= ix0 and oy <= iy0 and ox + ow >= ix1 and oy + oh >= iy1


def main() -> None:
    manifest = read_json(MANIFEST_PATH)
    css = CSS_PATH.read_text(encoding="utf-8")
    displayed_width = css_number(
        css, ".arena-skill-animation-preview > .arena-skill-preview-media", "width"
    )
    figure_width = css_number(css, ".arena-skill-animation-preview", "width")
    checks: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []

    for entry in manifest.get("entries", []):
        skill_id = entry["skillId"]
        preview_file = public_path(entry["previewFile"])
        vfx_file = public_path(f"{entry['packageUrl']}/vfx.json")
        preview = (read_json(vfx_file).get("preview") or {}) if vfx_file.is_file() else {}
        media_type = preview.get("mediaType")
        skill_failures: list[str] = []

        if not preview_file.is_file():
            skill_failures.append("preview-file-missing")
        elif sha256_file(preview_file) != entry.get("previewFileSha256"):
            skill_failures.append("preview-hash-drift")

        if media_type == "video/webm":
            crop = preview.get("crop")
            content_bounds = preview.get("visibleContentBounds")
            zoom_factor = (
                SOURCE_SIZE[0] / crop[2]
                if isinstance(crop, list) and len(crop) == 4 and crop[2]
                else 1.0
            )
            if preview.get("sourceSize") != list(SOURCE_SIZE):
                skill_failures.append("source-not-1920x1080")
            if not isinstance(crop, list) or crop[2:] != list(PREVIEW_SIZE):
                skill_failures.append("approved-source-crop-size")
            if preview.get("outputSize") != list(PREVIEW_SIZE):
                skill_failures.append("physical-output-size")
            if preview.get("physicalCropApplied") is not True:
                skill_failures.append("physical-crop-missing")
            if preview.get("runtimeViewportCrop") is not False:
                skill_failures.append("runtime-crop-not-removed")
            if preview.get("resampling") != "ffmpeg-approved-crop-no-spatial-scale":
                skill_failures.append("spatial-resampling-contract")
            if preview.get("encoding") != VIDEO_ENCODING:
                skill_failures.append("video-encoding")
            if float(preview.get("frameRate") or 0) < MIN_VIDEO_FRAME_RATE:
                skill_failures.append("frame-rate-below-29")
            if zoom_factor < MIN_ZOOM_FACTOR:
                skill_failures.append("insufficient-zoom")
            if not isinstance(content_bounds, list) or len(content_bounds) != 4:
                skill_failures.append("visible-content-bounds-missing")
            elif isinstance(crop, list) and not contains(crop, content_bounds):
                skill_failures.append("visible-skill-content-clipped")
        elif media_type == "image/webp":
            evidence = preview.get("sourceCaptureEvidence") or {}
            crop = evidence.get("crop")
            source_size = evidence.get("sourceSize")
            content_bounds = None
            zoom_factor = (
                source_size[0] / crop[2]
                if isinstance(source_size, list)
                and len(source_size) == 2
                and isinstance(crop, list)
                and len(crop) == 4
                and crop[2]
                else 1.0
            )
            if skill_id != "archer_10":
                skill_failures.append("unexpected-image-preview")
            if evidence.get("previewSize") != [448, 252]:
                skill_failures.append("image-preview-size")
            if not isinstance(crop, list) or crop[2:] != list(PREVIEW_SIZE):
                skill_failures.append("image-source-crop-size")
            if int(evidence.get("frameCount") or 0) < 2:
                skill_failures.append("image-not-animated")
        else:
            crop = None
            content_bounds = None
            zoom_factor = 1.0
            skill_failures.append("unsupported-preview-media-type")

        if preview.get("fallbackUsed") is not False:
            skill_failures.append("fallback-contract")

        result = {
            "skillId": skill_id,
            "classId": entry["classId"],
            "name": entry["name"],
            "mediaType": media_type,
            "sourceSize": preview.get("sourceSize"),
            "previewSize": preview.get("previewSize"),
            "crop": crop,
            "visibleContentBounds": content_bounds,
            "zoomFactor": round(zoom_factor, 4),
            "frameRate": preview.get("frameRate"),
            "passed": not skill_failures,
            "failures": skill_failures,
        }
        checks.append(result)
        if skill_failures:
            failures.append(result)

    ui_failures: list[str] = []
    if displayed_width is None or displayed_width < MIN_DISPLAY_WIDTH:
        ui_failures.append("display-width-too-small")
    if figure_width is None or figure_width < MIN_DISPLAY_WIDTH + 16:
        ui_failures.append("figure-width-too-small")

    status = (
        "GREEN"
        if len(checks) == 60 and not failures and not ui_failures
        else "RED"
    )
    report = {
        "schemaVersion": 2,
        "status": status,
        "scope": "60 Arena loadout previews after CDN optimization",
        "expectedVideoSize": list(PREVIEW_SIZE),
        "minimumZoomFactor": MIN_ZOOM_FACTOR,
        "minimumVideoFrameRate": MIN_VIDEO_FRAME_RATE,
        "minimumDisplayWidth": MIN_DISPLAY_WIDTH,
        "ui": {
            "displayedWidth": displayed_width,
            "figureWidth": figure_width,
            "failures": ui_failures,
        },
        "skillCount": len(checks),
        "checks": checks,
        "failures": failures,
        "fallbackUsed": False,
    }
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"{status}: {len(checks) - len(failures)}/{len(checks)} skills; "
        f"UI failures={len(ui_failures)}"
    )
    print(OUTPUT_PATH)
    if status != "GREEN":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
