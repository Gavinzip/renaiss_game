#!/usr/bin/env python3
"""Build and verify CDN-sized Arena skill configuration previews.

The accepted gameplay recordings stay in docs/design as 1920x1080 provenance.
This tool crops the already-approved 896x504 viewport into a 30 FPS VP9 WebM
used only by the browser configuration and draw-preview surfaces.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ROOT = REPO_ROOT / "apps/client/public"
MANIFEST_PATH = REPO_ROOT / "apps/client/src/game/assets/arenaSkillRuntimeManifest.json"
PACKAGE_INDEX_PATH = PUBLIC_ROOT / "assets/arena-skills/manifest.json"
REPORT_PATH = REPO_ROOT / (
    "docs/design/arena-dynamic-gameplay-review/"
    "configuration-gameplay-previews-cdn-20260817/optimization-report.json"
)
DEFAULT_FFMPEG = Path(
    "/Users/gavin/Library/Application Scripts/"
    "com.lowtechguys.Clop/bin/arm64/ffmpeg"
)
OUTPUT_SIZE = (896, 504)
OUTPUT_FRAME_RATE = 30
OUTPUT_FILE_NAME = "gameplay-preview-v1.webm"
MEDIA_TYPE = "video/webm"
OPTIMIZATION_VERSION = "arena-config-cdn-preview-v1"
MIN_REDUCTION_RATIO = 0.60


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--write",
        action="store_true",
        help="transcode previews and update package contracts before checking",
    )
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--crf", type=int, default=34)
    parser.add_argument("--ffmpeg", type=Path)
    parser.add_argument(
        "--skill-id",
        action="append",
        default=[],
        help="limit write/check work to one or more skill ids",
    )
    parser.add_argument(
        "--report",
        type=Path,
        help="write the audit report to this repo-relative or absolute path",
    )
    return parser.parse_args()


def encoding_label(crf: int) -> str:
    return f"vp9-webm-crf{crf}-30fps-physical-crop"


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def resolve_ffmpeg(explicit: Path | None) -> Path:
    candidates = [
        explicit,
        Path(os.environ["FFMPEG"]) if os.environ.get("FFMPEG") else None,
        Path(shutil.which("ffmpeg")) if shutil.which("ffmpeg") else None,
        DEFAULT_FFMPEG,
    ]
    for candidate in candidates:
        if candidate and candidate.is_file() and os.access(candidate, os.X_OK):
            return candidate
    raise ValueError("A working ffmpeg executable is required")


def public_path(url: str) -> Path:
    if not url.startswith("/assets/"):
        raise ValueError(f"Expected public asset URL, got {url!r}")
    return PUBLIC_ROOT / url.removeprefix("/")


def relative_to_repo(path: Path) -> str:
    return path.relative_to(REPO_ROOT).as_posix()


def video_entries(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        entry
        for entry in manifest.get("entries", [])
        if entry.get("previewMediaType") == MEDIA_TYPE
    ]


def selected_video_entries(
    manifest: dict[str, Any], skill_ids: list[str]
) -> list[dict[str, Any]]:
    entries = video_entries(manifest)
    if not skill_ids:
        return entries
    requested = set(skill_ids)
    selected = [entry for entry in entries if entry.get("skillId") in requested]
    found = {entry["skillId"] for entry in selected}
    missing = sorted(requested - found)
    if missing:
        raise ValueError(f"Unknown or non-video skill ids: {', '.join(missing)}")
    return selected


def source_crop(entry: dict[str, Any], vfx: dict[str, Any]) -> list[int]:
    stored = entry.get("configPreviewSourceCrop")
    if isinstance(stored, list) and len(stored) == 4:
        return [int(value) for value in stored]
    preview = vfx.get("preview") or {}
    crop = preview.get("crop") or entry.get("previewCrop")
    if not isinstance(crop, list) or len(crop) != 4:
        raise ValueError(f"{entry['skillId']}: source crop is missing")
    return [int(value) for value in crop]


def source_video(entry: dict[str, Any]) -> Path:
    source = entry.get("configPreviewSourcePath")
    if not isinstance(source, str):
        raise ValueError(f"{entry['skillId']}: source video path is missing")
    result = REPO_ROOT / source
    if not result.is_file():
        raise ValueError(f"{entry['skillId']}: source video is missing: {source}")
    return result


def probe_video(ffmpeg: Path, path: Path) -> dict[str, Any]:
    completed = subprocess.run(
        [
            str(ffmpeg),
            "-hide_banner",
            "-i",
            str(path),
            "-map",
            "0:v:0",
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    output = completed.stderr.replace("\r", "\n")
    if completed.returncode != 0:
        raise ValueError(f"ffmpeg could not decode {path}: {output[-500:]}")
    stream = next((line for line in output.splitlines() if "Video:" in line), "")
    size_match = re.search(r"\b(\d{3,5})x(\d{3,5})\b", stream)
    duration_match = re.search(r"Duration:\s*(\d+):(\d+):([\d.]+)", output)
    progress = re.findall(r"frame=\s*(\d+).*?time=(\d+):(\d+):([\d.]+)", output)
    if not size_match or not progress:
        raise ValueError(f"Could not measure video stream: {path}")
    frame_count = int(progress[-1][0])
    duration_sec = (
        int(progress[-1][1]) * 3600
        + int(progress[-1][2]) * 60
        + float(progress[-1][3])
    )
    if duration_sec <= 0:
        raise ValueError(f"Decoded duration is empty: {path}")
    return {
        "width": int(size_match.group(1)),
        "height": int(size_match.group(2)),
        "frameCount": frame_count,
        "durationSec": round(duration_sec, 3),
        "averageFrameRate": round(frame_count / duration_sec, 3),
        "containerDurationFinite": duration_match is not None,
        "decodedWithoutError": True,
    }


def transcode_one(
    ffmpeg: Path,
    crf: int,
    entry: dict[str, Any],
) -> dict[str, Any]:
    skill_id = entry["skillId"]
    vfx_path = public_path(f"{entry['packageUrl']}/vfx.json")
    vfx = read_json(vfx_path)
    crop = source_crop(entry, vfx)
    crop_x, crop_y, crop_width, crop_height = crop
    if (crop_width, crop_height) != OUTPUT_SIZE:
        raise ValueError(
            f"{skill_id}: approved crop is {crop_width}x{crop_height}, "
            f"expected {OUTPUT_SIZE[0]}x{OUTPUT_SIZE[1]}"
        )
    source = source_video(entry)
    source_hash = sha256_file(source)
    expected_source_hash = entry.get("configPreviewSourceSha256")
    if expected_source_hash and source_hash != expected_source_hash:
        raise ValueError(f"{skill_id}: canonical source hash drift")

    output_url = f"{entry['packageUrl']}/preview/{OUTPUT_FILE_NAME}"
    output = public_path(output_url)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(f"{output.stem}.transcoding.webm")
    completed = subprocess.run(
        [
            str(ffmpeg),
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(source),
            "-map",
            "0:v:0",
            "-vf",
            (
                f"crop={crop_width}:{crop_height}:{crop_x}:{crop_y},"
                f"fps={OUTPUT_FRAME_RATE}"
            ),
            "-an",
            "-sn",
            "-dn",
            "-c:v",
            "libvpx-vp9",
            "-crf",
            str(crf),
            "-b:v",
            "0",
            "-deadline",
            "good",
            "-cpu-used",
            "2",
            "-row-mt",
            "1",
            "-tile-columns",
            "2",
            "-g",
            str(OUTPUT_FRAME_RATE * 2),
            "-pix_fmt",
            "yuv420p",
            str(temporary),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        temporary.unlink(missing_ok=True)
        raise ValueError(f"{skill_id}: transcode failed: {completed.stderr[-500:]}")
    measured = probe_video(ffmpeg, temporary)
    if (measured["width"], measured["height"]) != OUTPUT_SIZE:
        temporary.unlink(missing_ok=True)
        raise ValueError(f"{skill_id}: output dimensions are incorrect")
    if not 29.0 <= measured["averageFrameRate"] <= 30.5:
        temporary.unlink(missing_ok=True)
        raise ValueError(
            f"{skill_id}: output frame rate is {measured['averageFrameRate']}"
        )
    if not measured["containerDurationFinite"]:
        temporary.unlink(missing_ok=True)
        raise ValueError(f"{skill_id}: output duration metadata is missing")
    temporary.replace(output)
    return {
        "skillId": skill_id,
        "source": source,
        "sourceSha256": source_hash,
        "sourceBytes": source.stat().st_size,
        "sourceCrop": crop,
        "output": output,
        "outputUrl": output_url,
        "outputSha256": sha256_file(output),
        "outputBytes": output.stat().st_size,
        "measured": measured,
    }


def preview_contract(
    entry: dict[str, Any],
    previous: dict[str, Any],
    result: dict[str, Any],
    crf: int,
) -> dict[str, Any]:
    measured = result["measured"]
    scenario = entry.get("previewSourceScenario") or previous.get("sourceScenario")
    accepted_id = (
        f"actual-5173-gameplay-cdn-v1:{scenario}:"
        f"source-{result['sourceSha256'][:16]}:output-{result['outputSha256'][:16]}"
    )
    return {
        "file": result["outputUrl"],
        "sha256": result["outputSha256"],
        "kind": "actual-5173-gameplay-video-optimized",
        "mediaType": MEDIA_TYPE,
        "sourceVersion": previous.get("sourceVersion", "configuration-hq-runtime-20260813"),
        "acceptedAnimationId": accepted_id,
        "sourceReport": previous.get("sourceReport"),
        "sourceScenario": scenario,
        "sourceCapture": previous.get("sourceCapture", "canvas-capture-stream"),
        "sourceCaptureEvidence": previous.get("sourceCaptureEvidence"),
        "sourceVideo": relative_to_repo(result["source"]),
        "sourceVideoSha256": result["sourceSha256"],
        "sourceSize": previous.get("sourceSize", [1920, 1080]),
        "sourceFrameRate": previous.get(
            "sourceFrameRate", previous.get("frameRate")
        ),
        "previewSize": list(OUTPUT_SIZE),
        "outputSize": list(OUTPUT_SIZE),
        "crop": result["sourceCrop"],
        "visibleContentBounds": previous.get("visibleContentBounds"),
        "contentMargins": previous.get("contentMargins"),
        "zoomFactor": previous.get("zoomFactor"),
        "frameRate": measured["averageFrameRate"],
        "frameCount": measured["frameCount"],
        "totalDurationMs": round(measured["durationSec"] * 1000),
        "encoding": encoding_label(crf),
        "encodingSettings": {
            "codec": "vp9",
            "crf": crf,
            "frameRate": OUTPUT_FRAME_RATE,
            "pixelFormat": "yuv420p",
            "audioRemoved": True,
        },
        "videoReencoded": True,
        "physicalCropApplied": True,
        "runtimeViewportCrop": False,
        "resampling": "ffmpeg-approved-crop-no-spatial-scale",
        "optimizationVersion": OPTIMIZATION_VERSION,
        "sourceBytes": result["sourceBytes"],
        "outputBytes": result["outputBytes"],
        "reductionRatio": round(1 - result["outputBytes"] / result["sourceBytes"], 6),
        "interpolatedFrames": False,
        "sourceSubstitutionForReview": False,
        "fallbackUsed": False,
    }


def install_contracts(
    manifest: dict[str, Any],
    package_index: dict[str, Any],
    results: list[dict[str, Any]],
    entries: list[dict[str, Any]],
    crf: int,
) -> None:
    result_by_id = {result["skillId"]: result for result in results}
    package_by_id = {
        entry["skillId"]: entry for entry in package_index.get("entries", [])
    }
    for entry in entries:
        result = result_by_id[entry["skillId"]]
        vfx_path = public_path(f"{entry['packageUrl']}/vfx.json")
        vfx = read_json(vfx_path)
        previous_preview = vfx.get("preview") or {}
        contract = preview_contract(entry, previous_preview, result, crf)
        accepted_id = contract["acceptedAnimationId"]

        entry.update(
            {
                "previewFile": result["outputUrl"],
                "previewFileSha256": result["outputSha256"],
                "previewSha256": result["outputSha256"],
                "previewMediaType": MEDIA_TYPE,
                "previewFrameRate": result["measured"]["averageFrameRate"],
                "previewSourceSize": list(OUTPUT_SIZE),
                "previewCrop": [0, 0, *OUTPUT_SIZE],
                "previewAcceptedAnimationId": accepted_id,
                "configPreviewSourceCrop": result["sourceCrop"],
                "configPreviewSourcePath": relative_to_repo(result["source"]),
                "configPreviewSourceSha256": result["sourceSha256"],
                "configPreviewOutputSha256": result["outputSha256"],
                "configPreviewOptimizationVersion": OPTIMIZATION_VERSION,
                "previewFallbackUsed": False,
                "fallbackUsed": False,
            }
        )

        runtime = vfx.setdefault("runtime", {})
        runtime.update(
            {
                "previewFile": result["outputUrl"],
                "previewFileSha256": result["outputSha256"],
                "previewSha256": result["outputSha256"],
                "previewMediaType": MEDIA_TYPE,
                "previewFrameRate": result["measured"]["averageFrameRate"],
                "previewAcceptedAnimationId": accepted_id,
                "previewOptimizationVersion": OPTIMIZATION_VERSION,
                "previewFallbackUsed": False,
            }
        )
        vfx["preview"] = contract
        vfx["fallbackUsed"] = False
        write_json(vfx_path, vfx)

        package_entry = package_by_id[entry["skillId"]]
        package_entry["sourceSelection"] = "actual-5173-canvas-cdn-preview-v1"
        package_entry["preview"] = contract
        package_entry["contractSha256"] = sha256_file(vfx_path)
        package_entry["fallbackUsed"] = False

    manifest["sourcePolicy"] = (
        "single-per-skill-package;runtime-existing;"
        "configuration-preview=actual-5173-canvas-cdn-preview-v1"
    )
    manifest["fallbackUsed"] = False
    package_index["sourcePolicy"] = manifest["sourcePolicy"]
    package_index["fallbackUsed"] = False
    write_json(MANIFEST_PATH, manifest)
    write_json(PACKAGE_INDEX_PATH, package_index)


def check_assets(
    ffmpeg: Path,
    manifest: dict[str, Any],
    package_index: dict[str, Any],
    entries: list[dict[str, Any]],
    crf: int,
    report_path: Path,
) -> dict[str, Any]:
    package_by_id = {
        entry["skillId"]: entry for entry in package_index.get("entries", [])
    }
    checks: list[dict[str, Any]] = []
    total_source_bytes = 0
    total_output_bytes = 0
    for entry in entries:
        failures: list[str] = []
        skill_id = entry["skillId"]
        source = source_video(entry)
        source_bytes = source.stat().st_size
        total_source_bytes += source_bytes
        output_url = entry.get("previewFile")
        output = public_path(output_url) if isinstance(output_url, str) else None
        measured: dict[str, Any] | None = None
        if not isinstance(output_url, str) or not output_url.endswith(OUTPUT_FILE_NAME):
            failures.append("preview-file-version")
        if output is None or not output.is_file():
            failures.append("preview-file-missing")
            output_bytes = 0
        else:
            output_bytes = output.stat().st_size
            total_output_bytes += output_bytes
            if sha256_file(output) != entry.get("previewFileSha256"):
                failures.append("preview-hash-drift")
            try:
                measured = probe_video(ffmpeg, output)
            except ValueError:
                failures.append("preview-decode")
            if output_bytes >= source_bytes * (1 - MIN_REDUCTION_RATIO):
                failures.append("preview-reduction-below-60-percent")
        if entry.get("previewSourceSize") != list(OUTPUT_SIZE):
            failures.append("manifest-output-size")
        if entry.get("previewCrop") != [0, 0, *OUTPUT_SIZE]:
            failures.append("manifest-runtime-crop")
        if entry.get("configPreviewOptimizationVersion") != OPTIMIZATION_VERSION:
            failures.append("manifest-optimization-version")
        if entry.get("previewFallbackUsed") is not False:
            failures.append("manifest-fallback-contract")
        if measured:
            if (measured["width"], measured["height"]) != OUTPUT_SIZE:
                failures.append("decoded-output-size")
            if not 29.0 <= measured["averageFrameRate"] <= 30.5:
                failures.append("decoded-frame-rate")
            if not measured["containerDurationFinite"]:
                failures.append("container-duration")

        vfx_path = public_path(f"{entry['packageUrl']}/vfx.json")
        preview = (read_json(vfx_path).get("preview") or {}) if vfx_path.is_file() else {}
        if preview.get("sha256") != entry.get("previewFileSha256"):
            failures.append("package-preview-hash")
        if preview.get("encoding") != encoding_label(crf):
            failures.append("package-encoding")
        if preview.get("physicalCropApplied") is not True:
            failures.append("package-physical-crop")
        if preview.get("runtimeViewportCrop") is not False:
            failures.append("package-runtime-crop")
        if preview.get("fallbackUsed") is not False:
            failures.append("package-fallback-contract")
        package_preview = (package_by_id.get(skill_id) or {}).get("preview") or {}
        if package_preview.get("sha256") != entry.get("previewFileSha256"):
            failures.append("index-preview-hash")

        checks.append(
            {
                "skillId": skill_id,
                "classId": entry["classId"],
                "name": entry["name"],
                "sourceBytes": source_bytes,
                "outputBytes": output_bytes,
                "reductionRatio": (
                    round(1 - output_bytes / source_bytes, 6)
                    if output_bytes
                    else 0
                ),
                "measured": measured,
                "passed": not failures,
                "failures": failures,
            }
        )

    failures = [check for check in checks if not check["passed"]]
    full_inventory = len(entries) == len(video_entries(manifest))
    image_count = (
        sum(
            1
            for entry in manifest.get("entries", [])
            if entry.get("previewMediaType") == "image/webp"
        )
        if full_inventory
        else 0
    )
    expected_inventory_ok = (
        len(checks) == 59 and image_count == 1
        if full_inventory
        else len(checks) == len(entries) and len(entries) > 0
    )
    status = "GREEN" if expected_inventory_ok and not failures else "RED"
    report = {
        "schemaVersion": 1,
        "status": status,
        "generatedAt": "2026-08-17",
        "scope": (
            "59 Arena WebM configuration previews plus one repaired animated WebP"
            if full_inventory
            else f"{len(entries)} selected Arena WebM configuration preview(s)"
        ),
        "optimizationVersion": OPTIMIZATION_VERSION,
        "encoding": encoding_label(crf),
        "outputSize": list(OUTPUT_SIZE),
        "outputFrameRate": OUTPUT_FRAME_RATE,
        "videoCount": len(checks),
        "imageCount": image_count,
        "totalSourceBytes": total_source_bytes,
        "totalOutputBytes": total_output_bytes,
        "totalReductionBytes": total_source_bytes - total_output_bytes,
        "totalReductionRatio": (
            round(1 - total_output_bytes / total_source_bytes, 6)
            if total_source_bytes
            else 0
        ),
        "checks": checks,
        "failures": failures,
        "fallbackUsed": False,
    }
    write_json(report_path, report)
    return report


def main() -> None:
    args = parse_args()
    if args.workers < 1:
        raise SystemExit("--workers must be at least 1")
    if not 20 <= args.crf <= 50:
        raise SystemExit("--crf must be between 20 and 50")
    ffmpeg = resolve_ffmpeg(args.ffmpeg)
    manifest = read_json(MANIFEST_PATH)
    package_index = read_json(PACKAGE_INDEX_PATH)
    all_entries = video_entries(manifest)
    if len(all_entries) != 59:
        raise ValueError(f"Expected 59 video previews, found {len(all_entries)}")
    entries = selected_video_entries(manifest, args.skill_id)
    report_path = (
        args.report.resolve()
        if args.report and args.report.is_absolute()
        else REPO_ROOT / args.report
        if args.report
        else REPORT_PATH
    )

    if args.write:
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            results = list(
                pool.map(
                    lambda entry: transcode_one(ffmpeg, args.crf, entry),
                    entries,
                )
            )
        install_contracts(manifest, package_index, results, entries, args.crf)
        manifest = read_json(MANIFEST_PATH)
        package_index = read_json(PACKAGE_INDEX_PATH)
        entries = selected_video_entries(manifest, args.skill_id)

    report = check_assets(
        ffmpeg,
        manifest,
        package_index,
        entries,
        args.crf,
        report_path,
    )
    passed = report["videoCount"] - len(report["failures"])
    print(
        f"{report['status']}: {passed}/{report['videoCount']} video previews; "
        f"{report['totalSourceBytes'] / 1048576:.2f} MiB -> "
        f"{report['totalOutputBytes'] / 1048576:.2f} MiB; "
        f"fallbackUsed={str(report['fallbackUsed']).lower()}"
    )
    print(report_path)
    if report["status"] != "GREEN":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
