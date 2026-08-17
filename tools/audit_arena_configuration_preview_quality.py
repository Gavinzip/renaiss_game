#!/usr/bin/env python3
"""Fail closed unless every Arena configuration preview is CDN-ready media."""

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
OUTPUT_PATH = REPO_ROOT / (
    "docs/design/arena-dynamic-gameplay-review/"
    "configuration-gameplay-previews-cdn-20260817/quality-audit.json"
)
VIDEO_MEDIA_TYPE = "video/webm"
IMAGE_MEDIA_TYPE = "image/webp"
VIDEO_OUTPUT_SIZE = (896, 504)
MIN_VIDEO_FRAME_RATE = 29.0
VIDEO_ENCODING = "vp9-webm-crf34-30fps-physical-crop"
OPTIMIZATION_VERSION = "arena-config-cdn-preview-v1"


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


def selector_body(css: str, selector: str) -> str | None:
    match = re.search(
        rf"{re.escape(selector)}\s*\{{([^}}]+)\}}",
        css,
        flags=re.MULTILINE,
    )
    return match.group(1) if match else None


def main() -> None:
    manifest = read_json(MANIFEST_PATH)
    css = CSS_PATH.read_text(encoding="utf-8")
    checks: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    video_count = 0
    image_count = 0

    for entry in manifest.get("entries", []):
        skill_id = entry["skillId"]
        media_type = entry.get("previewMediaType")
        package_url = entry["packageUrl"]
        vfx_path = public_path(f"{package_url}/vfx.json")
        preview = (read_json(vfx_path).get("preview") or {}) if vfx_path.is_file() else {}
        preview_url = entry.get("previewFile")
        preview_path = public_path(preview_url) if isinstance(preview_url, str) else None
        skill_failures: list[str] = []

        if preview_path is None or not preview_path.is_file():
            skill_failures.append("preview-file-missing")
        elif sha256_file(preview_path) != entry.get("previewFileSha256"):
            skill_failures.append("preview-hash-drift")
        if preview.get("mediaType") != media_type:
            skill_failures.append("manifest-package-media-type-drift")
        if entry.get("previewFallbackUsed") is not False:
            skill_failures.append("manifest-fallback-contract")
        if preview.get("fallbackUsed") is not False:
            skill_failures.append("package-fallback-contract")

        if media_type == VIDEO_MEDIA_TYPE:
            video_count += 1
            frame_rate = float(preview.get("frameRate") or 0)
            if not isinstance(preview_url, str) or not preview_url.endswith(
                "/preview/gameplay-preview-v1.webm"
            ):
                skill_failures.append("video-file-version")
            if preview.get("outputSize") != list(VIDEO_OUTPUT_SIZE):
                skill_failures.append("video-output-size")
            if frame_rate < MIN_VIDEO_FRAME_RATE:
                skill_failures.append("video-frame-rate-below-29")
            if preview.get("sourceCapture") != "canvas-capture-stream":
                skill_failures.append("video-source-is-not-direct-canvas")
            if preview.get("encoding") != VIDEO_ENCODING:
                skill_failures.append("video-encoding")
            if preview.get("optimizationVersion") != OPTIMIZATION_VERSION:
                skill_failures.append("video-optimization-version")
            if preview.get("physicalCropApplied") is not True:
                skill_failures.append("video-physical-crop")
            if preview.get("runtimeViewportCrop") is not False:
                skill_failures.append("video-runtime-crop")
            if preview.get("interpolatedFrames") is not False:
                skill_failures.append("video-interpolation-contract")
            if preview.get("reductionRatio", 0) < 0.60:
                skill_failures.append("video-reduction-below-60-percent")
        elif media_type == IMAGE_MEDIA_TYPE:
            image_count += 1
            if skill_id != "archer_10":
                skill_failures.append("unexpected-image-preview")
            if not isinstance(preview_url, str) or not preview_url.endswith(
                "/preview/gameplay-clean-v3.webp"
            ):
                skill_failures.append("image-file-version")
            if preview.get("sourceCapture") != "browser-screenshot-sequence":
                skill_failures.append("image-source-sequence")
            evidence = preview.get("sourceCaptureEvidence") or {}
            if evidence.get("interpolatedFrames") is not False:
                skill_failures.append("image-interpolation-contract")
            if evidence.get("fallbackUsed") is not False:
                skill_failures.append("image-evidence-fallback-contract")
        else:
            skill_failures.append("unsupported-preview-media-type")

        result = {
            "skillId": skill_id,
            "classId": entry["classId"],
            "name": entry["name"],
            "mediaType": media_type,
            "previewFile": preview_url,
            "frameRate": preview.get("frameRate"),
            "passed": not skill_failures,
            "failures": skill_failures,
        }
        checks.append(result)
        if skill_failures:
            failures.append(result)

    ui_failures: list[str] = []
    media_rule = selector_body(
        css,
        ".arena-skill-preview-media > video,\n.arena-skill-preview-media > img",
    )
    if media_rule is None:
        ui_failures.append("shared-media-render-rule-missing")
    elif "image-rendering: auto" not in media_rule:
        ui_failures.append("media-does-not-override-pixelated-resampling")
    image_rules = re.findall(
        rf"{re.escape('.arena-skill-preview-media > img')}\s*\{{([^}}]+)\}}",
        css,
        flags=re.MULTILINE,
    )
    if not any(
        all(value in rule for value in ("inset: 0", "width: 100%", "height: 100%"))
        for rule in image_rules
    ):
        ui_failures.append("image-fill-rule-missing")

    status = (
        "GREEN"
        if len(checks) == 60
        and video_count == 59
        and image_count == 1
        and not failures
        and not ui_failures
        else "RED"
    )
    report = {
        "schemaVersion": 2,
        "status": status,
        "scope": "59 CDN-sized WebM previews and one repaired animated WebP",
        "videoOutputSize": list(VIDEO_OUTPUT_SIZE),
        "minimumVideoFrameRate": MIN_VIDEO_FRAME_RATE,
        "videoEncoding": VIDEO_ENCODING,
        "skillCount": len(checks),
        "videoCount": video_count,
        "imageCount": image_count,
        "uiFailures": ui_failures,
        "checks": checks,
        "failures": failures,
        "fallbackUsed": False,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"{status}: {len(checks) - len(failures)}/{len(checks)} skills; "
        f"videos={video_count}; images={image_count}; UI failures={len(ui_failures)}"
    )
    print(OUTPUT_PATH)
    if status != "GREEN":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
