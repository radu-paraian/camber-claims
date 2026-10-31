"""
Camber Claims — FastAPI Production Backend (`backend/main.py`)
Serves UK Motor Claims & Subrogation Solicitor API endpoints, Live UK DVSA MOT History telemetry
(with explicit `CAUSAL` vs `NOT CAUSAL` defect classification), Agentic Video Pre-Scan & Clarification
(`gemini-4-argon` with `processing="agentic"`), 3D Kinematic Reconstruction, Parallel Flash Sub-Agents,
and Human-in-the-Loop Solicitor Settlement Sign-Off.
"""

from __future__ import annotations

import asyncio
import copy
import json
import os
import tempfile
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncIterator, Dict, List, Optional

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.gemini_pipeline import (
    analyze_crash_video_and_legal_corpus,
    execute_human_approved_settlement,
    fetch_uk_dvsa_mot_history,
    load_env_safely,
    pre_scan_crash_video,
    register_dvsa_credentials_and_verify_physics,
    run_fast_guardrail_check,
    run_parallel_flash_subagents,
)

load_env_safely()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
VIDEOS_DIR = PROJECT_ROOT / "frontend" / "public" / "videos"
FRONTEND_DIST_DIR = PROJECT_ROOT / "frontend" / "dist"
FRONTEND_SRC_DIR = PROJECT_ROOT / "frontend"

@asynccontextmanager
async def _lifespan(_app: FastAPI) -> AsyncIterator[None]:
    _load_cases_from_disk(enrich_live_dvsa=True)
    yield


app = FastAPI(
    title="Camber Claims — UK Motor Claims & Subrogation Forensic Platform",
    description=(
        "Autonomous 3D Crash Reconstruction, Live UK DVSA MOT History Telemetry, and UK Liability "
        "Apportionment Engine powered by Gemini 4 Argon (`gemini-4-argon`) on the Interactions API."
    ),
    version="2.0.0",
    lifespan=_lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for loaded cases and async background jobs
_CASES_CACHE: Dict[str, Dict[str, Any]] = {}
_JOBS_STORE: Dict[str, Dict[str, Any]] = {}
_DVSA_ENRICHED: bool = False

CASE_FILE_MAP: Dict[str, str] = {
    "cheadle_a521": "case_cheadle_a521_junction.json",
    "delphouse_rollover": "case_delphouse_rollover.json",
    "a521_hgv": "case_a521_hgv_corridor.json",
}


def _load_cases_from_disk(enrich_live_dvsa: bool = False) -> Dict[str, Dict[str, Any]]:
    """Load the 3 pre-computed UK crash reconstruction datasets and optionally enrich Case 1 with live DVSA telemetry."""
    global _CASES_CACHE, _DVSA_ENRICHED
    if not _CASES_CACHE:
        for case_key, filename in CASE_FILE_MAP.items():
            fpath = DATA_DIR / filename
            if fpath.exists():
                with open(fpath, "r", encoding="utf-8") as f:
                    _CASES_CACHE[case_key] = json.load(f)

    if enrich_live_dvsa and not _DVSA_ENRICHED and "cheadle_a521" in _CASES_CACHE:
        try:
            dvsa_vl19 = fetch_uk_dvsa_mot_history("VL19 OKP")
            dvsa_gd64 = fetch_uk_dvsa_mot_history("GD64 LKU")
            case_1 = _CASES_CACHE["cheadle_a521"]
            vehicles = case_1.get("report", {}).get("vehicles", [])
            if len(vehicles) >= 2:
                vehicles[0]["dvsa_make"] = dvsa_vl19.get("make", vehicles[0]["dvsa_make"])
                vehicles[0]["dvsa_model"] = dvsa_vl19.get("model", vehicles[0]["dvsa_model"])
                vehicles[0]["dvsa_mot_status"] = dvsa_vl19.get("mot_status", vehicles[0]["dvsa_mot_status"])
                vehicles[0]["dvsa_mot_expiry"] = dvsa_vl19.get("mot_expiry", vehicles[0]["dvsa_mot_expiry"])
                vehicles[0]["dvsa_mileage_last_mot"] = dvsa_vl19.get(
                    "last_mileage", vehicles[0]["dvsa_mileage_last_mot"]
                )
                if dvsa_vl19.get("advisories"):
                    vehicles[0]["dvsa_advisories"] = dvsa_vl19["advisories"]
                if dvsa_vl19.get("dvsa_defect_classifications"):
                    vehicles[0]["dvsa_defect_classifications"] = dvsa_vl19["dvsa_defect_classifications"]

                vehicles[1]["dvsa_make"] = dvsa_gd64.get("make", vehicles[1]["dvsa_make"])
                vehicles[1]["dvsa_model"] = dvsa_gd64.get("model", vehicles[1]["dvsa_model"])
                vehicles[1]["dvsa_mot_status"] = dvsa_gd64.get("mot_status", vehicles[1]["dvsa_mot_status"])
                vehicles[1]["dvsa_mot_expiry"] = dvsa_gd64.get("mot_expiry", vehicles[1]["dvsa_mot_expiry"])
                vehicles[1]["dvsa_mileage_last_mot"] = dvsa_gd64.get(
                    "last_mileage", vehicles[1]["dvsa_mileage_last_mot"]
                )
                if dvsa_gd64.get("advisories"):
                    vehicles[1]["dvsa_advisories"] = dvsa_gd64["advisories"]
                if dvsa_gd64.get("dvsa_defect_classifications"):
                    vehicles[1]["dvsa_defect_classifications"] = dvsa_gd64["dvsa_defect_classifications"]

            case_1["dvsa_live_telemetry"] = {
                "VL19 OKP": dvsa_vl19,
                "GD64 LKU": dvsa_gd64,
            }
            _DVSA_ENRICHED = True
        except Exception:
            pass

    return _CASES_CACHE


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health_check() -> Dict[str, Any]:
    return {
        "status": "ok",
        "service": "camber-claims-uk-backend",
        "persona": "A UK motor claims & subrogation solicitor",
        "models": [
            "gemini-4-argon",
            "antigravity-preview-09-2026",
            "gemini-3.8-flash",
            "gemini-3.5-flash-lite",
        ],
    }


@app.get("/api/cases")
async def list_cases() -> Dict[str, Any]:
    """Return all 3 pre-loaded UK crash reconstruction cases, enriched with live DVSA telemetry."""
    cases_map = _load_cases_from_disk(enrich_live_dvsa=True)
    ordered_keys = ["cheadle_a521", "delphouse_rollover", "a521_hgv"]
    cases_list = [cases_map[k] for k in ordered_keys if k in cases_map]
    return {
        "default_case_id": "cheadle_a521",
        "cases": cases_list,
        "cases_by_id": cases_map,
        "cheadle_a521": cases_map.get("cheadle_a521"),
        "delphouse_rollover": cases_map.get("delphouse_rollover"),
        "a521_hgv": cases_map.get("a521_hgv"),
    }


@app.get("/api/cases/{case_id}")
async def get_case_by_id(case_id: str) -> Dict[str, Any]:
    """Return a specific UK crash reconstruction dataset by `case_id` or `claim_id`."""
    cases_map = _load_cases_from_disk(enrich_live_dvsa=True)
    normalized = case_id.strip().lower()

    alias_map = {
        "cheadle_a521": "cheadle_a521",
        "case_cheadle_a521_junction": "cheadle_a521",
        "uk-2026-0819": "cheadle_a521",
        "case1": "cheadle_a521",
        "delphouse_rollover": "delphouse_rollover",
        "case_delphouse_rollover": "delphouse_rollover",
        "uk-2026-0842": "delphouse_rollover",
        "case2": "delphouse_rollover",
        "a521_hgv": "a521_hgv",
        "case_a521_hgv_corridor": "a521_hgv",
        "uk-2026-0904": "a521_hgv",
        "case3": "a521_hgv",
    }
    target_key = alias_map.get(normalized, normalized)
    if target_key in cases_map:
        return cases_map[target_key]

    raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")


@app.get("/api/dvsa/{registration}")
async def get_dvsa_mot_history(registration: str) -> Dict[str, Any]:
    """Live 5-part UK DVSA MOT History API lookup with explicit `CAUSAL` vs `NOT CAUSAL` defect classification."""
    result = await asyncio.to_thread(fetch_uk_dvsa_mot_history, registration)
    return result


async def _save_uploaded_videos(
    videos: Optional[List[UploadFile]],
    single_video: Optional[UploadFile],
    use_default_if_empty: bool = True,
) -> List[str]:
    """Save uploaded video files to temporary paths or fall back to the Cheadle A521 Ring CCTV clip."""
    upload_list: List[UploadFile] = []
    if videos:
        upload_list.extend([v for v in videos if v is not None and getattr(v, "filename", None)])
    if single_video and getattr(single_video, "filename", None):
        upload_list.append(single_video)

    saved_paths: List[str] = []
    for up in upload_list:
        suffix = Path(up.filename or "video.mp4").suffix or ".mp4"
        fd, tmp_path = tempfile.mkstemp(suffix=suffix, prefix="camber_upload_")
        os.close(fd)
        content = await up.read()
        if content:
            with open(tmp_path, "wb") as f:
                f.write(content)
            saved_paths.append(tmp_path)

    if not saved_paths and use_default_if_empty:
        default_clip = VIDEOS_DIR / "clip3_10.93s_to_15.50s_golf_vs_blue_suv.mp4"
        if default_clip.exists():
            saved_paths.append(str(default_clip))

    return saved_paths


@app.post("/api/pre-scan-video")
async def api_pre_scan_video(
    videos: Optional[List[UploadFile]] = File(default=None),
    video: Optional[UploadFile] = File(default=None),
    plate_1: Optional[str] = Form(default=None),
    plate_2: Optional[str] = Form(default=None),
) -> Dict[str, Any]:
    """
    Interactive Agent Video Pre-Scan endpoint (`POST /api/pre-scan-video`).
    Uses `model="gemini-4-argon"` with `{"type": "video", ..., "processing": "agentic"}` via `client.interactions.create(...)`
    to inspect the crash video, strip non-causal background objects, and request solicitor confirmation
    when UK VRM registration plates are blurry due to CCTV distance or motion blur.
    """
    saved_paths = await _save_uploaded_videos(videos, video, use_default_if_empty=False)
    result = await asyncio.to_thread(pre_scan_crash_video, saved_paths, plate_1, plate_2)
    return result


async def _run_full_pipeline_task(
    job_id: str,
    saved_paths: List[str],
    plate_1: str,
    plate_2: str,
) -> Dict[str, Any]:
    """Execute the full 5-stage Gemini 4 Argon + Live UK DVSA + Antigravity + Flash Sub-Agents pipeline."""
    _JOBS_STORE[job_id] = {
        "job_id": job_id,
        "status": "processing",
        "stage": "guardrail_and_dvsa_lookup",
    }

    guardrail = await asyncio.to_thread(
        run_fast_guardrail_check,
        f"UK Road Traffic Claim | Plate 1: {plate_1} | Plate 2: {plate_2} | Videos: {len(saved_paths)}",
    )
    _JOBS_STORE[job_id]["stage"] = "gemini_4_argon_agentic_video_reconstruction"

    report_obj, interaction_id, dvsa_1, dvsa_2 = await asyncio.to_thread(
        analyze_crash_video_and_legal_corpus,
        saved_paths,
        plate_1,
        plate_2,
    )
    report_dict = report_obj.model_dump()

    _JOBS_STORE[job_id]["stage"] = "antigravity_physics_and_parallel_subagents"
    physics_task = asyncio.to_thread(
        register_dvsa_credentials_and_verify_physics,
        json.dumps(report_dict),
        interaction_id,
    )
    subagents_task = run_parallel_flash_subagents(report_dict)

    (physics_audit_log, final_interaction_id), subagents_out = await asyncio.gather(
        physics_task,
        subagents_task,
    )

    cases_map = _load_cases_from_disk(enrich_live_dvsa=False)
    base_case = copy.deepcopy(cases_map.get("cheadle_a521", {}))

    completed_payload: Dict[str, Any] = {
        "status": "completed",
        "job_id": job_id,
        "case_id": "custom_upload",
        "case_metadata": {
            "id": "custom_upload",
            "claim_id": report_dict.get("claim_id", "UK-2026-0819"),
            "title": f"Live Forensic Analysis: {dvsa_1['registration']} vs {dvsa_2['registration']}",
            "subtitle": f"{dvsa_1['make']} {dvsa_1['model']} vs {dvsa_2['make']} {dvsa_2['model']}",
            "video_url": "/videos/clip3_10.93s_to_15.50s_golf_vs_blue_suv.mp4",
            "badge": "GEMINI 4 ARGON + LIVE DVSA",
            "plate_1": dvsa_1["registration"],
            "plate_2": dvsa_2["registration"],
        },
        "interaction_id": final_interaction_id,
        "guardrail_check": guardrail,
        "dvsa_live_telemetry": {
            dvsa_1["registration"]: dvsa_1,
            dvsa_2["registration"]: dvsa_2,
        },
        "agentic_video_scrub_steps": base_case.get("agentic_video_scrub_steps", []),
        "physics_audit_log": physics_audit_log,
        "report": report_dict,
        "subagents": subagents_out,
    }
    _JOBS_STORE[job_id] = completed_payload
    return completed_payload


@app.post("/api/analyze-claim")
async def analyze_claim_endpoint(
    background_tasks: BackgroundTasks,
    videos: Optional[List[UploadFile]] = File(default=None),
    video: Optional[UploadFile] = File(default=None),
    plate_1: Optional[str] = Form(default=""),
    plate_2: Optional[str] = Form(default=""),
    mode: str = Form(default="sync"),
    require_clarification_check: bool = Form(default=False),
) -> Dict[str, Any]:
    """
    Full Multimodal Claim Analysis Endpoint (`POST /api/analyze-claim`).
    - If `plate_1` or `plate_2` is empty/blank or `require_clarification_check=True` (without both plates supplied),
      runs `pre_scan_crash_video` (`gemini-4-argon` with `processing="agentic"`) and returns the structured
      `clarification_required` response so the solicitor can confirm the blurry CCTV plates (`VL19 OKP` & `GD64 LKU`).
    - Once plates are supplied, executes the full DVSA + Gemini 4 Argon + Antigravity + Flash Sub-Agents pipeline
      either synchronously (`mode="sync"`) or asynchronously (`mode="background"` -> poll `/api/job-status/{job_id}`).
    """
    p1_clean = (plate_1 or "").strip()
    p2_clean = (plate_2 or "").strip()

    if require_clarification_check or not p1_clean or not p2_clean:
        uploaded_only = await _save_uploaded_videos(videos, video, use_default_if_empty=False)
        pre_scan_result = await asyncio.to_thread(pre_scan_crash_video, uploaded_only, p1_clean, p2_clean)
        pre_scan_result["status"] = "clarification_required"
        return pre_scan_result

    saved_paths = await _save_uploaded_videos(videos, video, use_default_if_empty=True)

    job_id = f"job-{uuid.uuid4().hex[:10]}"
    if mode.lower() == "background":
        _JOBS_STORE[job_id] = {
            "job_id": job_id,
            "status": "processing",
            "stage": "queued",
        }
        background_tasks.add_task(_run_full_pipeline_task, job_id, saved_paths, p1_clean, p2_clean)
        return {
            "status": "processing",
            "job_id": job_id,
            "poll_url": f"/api/job-status/{job_id}",
        }

    result = await _run_full_pipeline_task(job_id, saved_paths, p1_clean, p2_clean)
    return result


@app.get("/api/job-status/{job_id}")
async def get_job_status(job_id: str) -> Dict[str, Any]:
    """Poll status of a background `/api/analyze-claim` job."""
    job = _JOBS_STORE.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    return job


class SettlementApprovalRequest(BaseModel):
    claim_id: str = Field(default="UK-2026-0819")
    claimant_pct: int = Field(default=25, ge=0, le=100)
    defendant_pct: int = Field(default=75, ge=0, le=100)
    adjuster_notes: str = Field(
        default="Approved 75% / 25% split liability under Powell v Moody [1966], Harding v Hinchcliffe [1964], and Froom v Butcher [1976] with Policy #UK-8841 Section 4 Clause 4.2 reservation."
    )
    previous_interaction_id: Optional[str] = Field(default=None)


@app.post("/api/approve-settlement")
async def approve_settlement_endpoint(request: Request) -> Dict[str, Any]:
    """
    Human-in-the-loop solicitor sign-off endpoint (`POST /api/approve-settlement`).
    Accepts either JSON body or Form fields and returns a deterministic SHA-256 settlement audit receipt.
    """
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        body_data = await request.json()
    else:
        form_data = await request.form()
        body_data = dict(form_data)

    claim_id = str(body_data.get("claim_id") or "UK-2026-0819")
    claimant_pct = int(
        body_data.get("claimant_pct")
        if body_data.get("claimant_pct") is not None
        else body_data.get("recommended_claimant_liability_pct", 25)
    )
    defendant_pct = int(
        body_data.get("defendant_pct")
        if body_data.get("defendant_pct") is not None
        else body_data.get("recommended_defendant_liability_pct", 100 - claimant_pct)
    )
    adjuster_notes = str(
        body_data.get("adjuster_notes")
        or "Confirmed by a UK motor claims & subrogation solicitor pursuant to CPR Pre-Action Protocol."
    )
    prev_id = body_data.get("previous_interaction_id")

    receipt = await asyncio.to_thread(
        execute_human_approved_settlement,
        claim_id,
        claimant_pct,
        defendant_pct,
        adjuster_notes,
        prev_id,
    )
    return receipt


# ---------------------------------------------------------------------------
# Static File Mounts for `/videos` and Built Frontend
# ---------------------------------------------------------------------------

if VIDEOS_DIR.exists():
    app.mount("/videos", StaticFiles(directory=str(VIDEOS_DIR)), name="videos")

if FRONTEND_DIST_DIR.exists():
    assets_dir = FRONTEND_DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")


@app.get("/")
async def serve_index() -> Any:
    dist_index = FRONTEND_DIST_DIR / "index.html"
    if dist_index.exists():
        return FileResponse(str(dist_index))
    src_index = FRONTEND_SRC_DIR / "index.html"
    if src_index.exists():
        return FileResponse(str(src_index))
    return JSONResponse(
        {
            "service": "Camber Claims UK Motor Claims & Subrogation Backend",
            "status": "running",
            "endpoints": [
                "/api/cases",
                "/api/cases/{case_id}",
                "/api/dvsa/{registration}",
                "/api/pre-scan-video",
                "/api/analyze-claim",
                "/api/approve-settlement",
            ],
        }
    )
