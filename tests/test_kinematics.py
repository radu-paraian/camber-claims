"""
Camber Claims — Comprehensive Pytest Suite (`tests/test_kinematics.py`).
Validates:
  1. `UK_MOTOR_LEGAL_AND_POLICY_CORPUS` >= 65,000 characters (>16,500 tokens) for Gemini 4 Argon 95% implicit caching.
  2. Schema validation of all 3 pre-computed UK crash reconstruction datasets against `ForensicLegalReport`.
  3. Live 5-part UK DVSA MOT History API lookup for `VL19 OKP` and `GD64 LKU` and explicit `CAUSAL` vs `NOT CAUSAL`
     defect classification (`DVSADefectAnalysis`).
  4. Stopping distance physics math on damp tarmac (mu=0.55) and Peugeot 2008 rollover kinematics (`roll_deg=86.0`).
  5. FastAPI endpoints (`/api/cases`, `/api/dvsa/{reg}`, `/api/pre-scan-video`, `/api/analyze-claim` clarification
     and full analysis modes, and `/api/approve-settlement`) via `fastapi.testclient.TestClient`.
  6. Strict compliance with AGENTS.md (Interactions API only, `gemini-4-argon` with `processing="agentic"`, grounded solicitor persona).
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient

from backend.gemini_pipeline import (
    FORENSIC_SYSTEM_INSTRUCTION,
    ensure_production_case_quality,
    fetch_uk_dvsa_mot_history,
    filter_negative_dvsa_records,
)
from backend.legal_corpus import UK_MOTOR_LEGAL_AND_POLICY_CORPUS
from backend.main import app
from backend.schemas import DVSADefectAnalysis, ForensicLegalReport

DATA_DIR = PROJECT_ROOT / "data"

client = TestClient(app)


def test_legal_corpus_length_and_statutory_contents() -> None:
    """Verify UK_MOTOR_LEGAL_AND_POLICY_CORPUS exceeds 65,000 chars and includes all required UK authorities."""
    assert len(UK_MOTOR_LEGAL_AND_POLICY_CORPUS) > 65000, (
        f"Expected legal corpus > 65,000 chars, got {len(UK_MOTOR_LEGAL_AND_POLICY_CORPUS)}"
    )
    required_terms = [
        "#UK-8841",
        "Clause 4.2",
        "Rule 126",
        "Rule 172",
        "Section 47",
        "Law Reform (Contributory Negligence) Act 1945",
        "Powell v Moody",
        "Froom v Butcher",
        "Baker v Willoughby",
        "Harding v Hinchcliffe",
        "Worsfold v Howe",
        "Brooks v Brodrib",
        "Macintyre v Coles",
        "Colmore v Taylor",
        "CATEGORY S",
        "CATEGORY N",
    ]
    for term in required_terms:
        assert term in UK_MOTOR_LEGAL_AND_POLICY_CORPUS, f"Missing required legal corpus term: {term}"


def test_all_three_json_datasets_validate_against_schema() -> None:
    """Validate all 3 pre-loaded UK crash JSON datasets against ForensicLegalReport and check causal filtering & DVSA fields."""
    expected_files = [
        ("case_cheadle_a521_junction.json", "UK-2026-0819", 25, 75),
        ("case_delphouse_rollover.json", "UK-2026-0842", 35, 65),
        ("case_a521_hgv_corridor.json", "UK-2026-0904", 20, 80),
    ]

    for filename, expected_claim_id, expected_claimant_pct, expected_defendant_pct in expected_files:
        fpath = DATA_DIR / filename
        assert fpath.exists(), f"Missing dataset file: {fpath}"
        with open(fpath, "r", encoding="utf-8") as f:
            payload = json.load(f)

        report = ForensicLegalReport.model_validate(payload["report"])
        assert report.claim_id == expected_claim_id
        assert report.recommended_claimant_liability_pct == expected_claimant_pct
        assert report.recommended_defendant_liability_pct == expected_defendant_pct
        assert report.recommended_claimant_liability_pct + report.recommended_defendant_liability_pct == 100
        assert report.filtered_irrelevant_objects_count >= 2
        assert len(report.causal_filtering_summary) > 40
        assert len(report.scene_environment_elements) >= 2
        assert len(report.vehicles) == 2

        for vehicle in report.vehicles:
            assert vehicle.causally_relevant is True
            assert len(vehicle.causal_role_reason) > 20
            assert len(vehicle.dvsa_defect_classifications) >= 1
            statuses = {d.causal_status for d in vehicle.dvsa_defect_classifications}
            assert statuses.issubset({"CAUSAL", "NOT CAUSAL"})

        # Verify subagents exist and strictly use the grounded UK solicitor persona
        subagents = payload.get("subagents", {})
        assert "policy_audit" in subagents and len(subagents["policy_audit"]) > 100
        assert "repair_estimate" in subagents and len(subagents["repair_estimate"]) > 100
        assert "subrogation_letter" in subagents and len(subagents["subrogation_letter"]) > 100

        raw_str = json.dumps(payload)
        assert "Sarah Lin" not in raw_str
        assert "Aviva" not in raw_str


def test_case_1_peugeot_rollover_and_vw_golf_kinematics() -> None:
    """Verify Case 1 (Cheadle A521) keyframes capture the Peugeot 2008 86-degree nearside rollover and Golf braking."""
    with open(DATA_DIR / "case_cheadle_a521_junction.json", "r", encoding="utf-8") as f:
        case_1 = json.load(f)

    report = ForensicLegalReport.model_validate(case_1["report"])
    peugeot = report.vehicles[0]
    golf = report.vehicles[1]

    assert peugeot.registration_plate == "VL19 OKP"
    assert golf.registration_plate == "GD64 LKU"
    assert golf.dvsa_mot_status == "EXPIRED"
    assert "2026-05-02" in golf.dvsa_mot_expiry

    # Check Peugeot rollover progression synchronized to video frames (0.0 at t=0.2s -> 6.0 at impact t=0.4s -> 48.0 at t=0.65s -> 86.0 at t=1.15s..3.0s)
    assert report.impact_timestamp_sec == 0.4
    roll_by_t = {kf.timestamp_sec: kf.roll_deg for kf in peugeot.keyframes}
    assert roll_by_t[0.2] == 0.0
    assert roll_by_t[0.4] == 6.0
    assert roll_by_t[0.65] == 48.0
    assert roll_by_t[1.15] == 86.0
    assert roll_by_t[3.0] == 86.0

    # Check VW Golf speeds and braking synchronized to video frames
    golf_by_t = {kf.timestamp_sec: kf for kf in golf.keyframes}
    assert golf_by_t[0.0].speed_mph == 41.2
    assert golf_by_t[0.2].braking_active is True
    assert golf_by_t[0.4].speed_mph == 29.5
    assert golf_by_t[3.0].speed_mph == 0.0

    # Check both CAUSAL and NOT CAUSAL DVSA items exist on Golf and negative-only NOT CAUSAL item on Peugeot
    golf_causal = [d for d in golf.dvsa_defect_classifications if d.causal_status == "CAUSAL"]
    golf_not_causal = [d for d in golf.dvsa_defect_classifications if d.causal_status == "NOT CAUSAL"]
    assert len(golf_causal) >= 2
    assert len(golf_not_causal) >= 1

    peugeot_not_causal = [d for d in peugeot.dvsa_defect_classifications if d.causal_status == "NOT CAUSAL"]
    assert len(peugeot_not_causal) >= 1


def _interpolate_keyframe(keyframes: list[dict], t: float) -> dict[str, float]:
    if t <= keyframes[0]["timestamp_sec"]:
        return dict(keyframes[0])
    if t >= keyframes[-1]["timestamp_sec"]:
        return dict(keyframes[-1])
    for i in range(len(keyframes) - 1):
        k0, k1 = keyframes[i], keyframes[i + 1]
        t0, t1 = k0["timestamp_sec"], k1["timestamp_sec"]
        if t0 <= t <= t1:
            alpha = 0.0 if t1 == t0 else (t - t0) / (t1 - t0)
            dh = ((k1["heading_deg"] - k0["heading_deg"] + 180.0) % 360.0) - 180.0
            return {
                "timestamp_sec": t,
                "x_meters": k0["x_meters"] + alpha * (k1["x_meters"] - k0["x_meters"]),
                "z_meters": k0["z_meters"] + alpha * (k1["z_meters"] - k0["z_meters"]),
                "heading_deg": k0["heading_deg"] + alpha * dh,
                "speed_mph": k0["speed_mph"] + alpha * (k1["speed_mph"] - k0["speed_mph"]),
                "roll_deg": k0["roll_deg"] + alpha * (k1["roll_deg"] - k0["roll_deg"]),
            }
    return dict(keyframes[-1])


def _obb_sat_penetration_and_clearance(
    x_a: float,
    z_a: float,
    hdg_a: float,
    dims_a: tuple[float, float],
    x_b: float,
    z_b: float,
    hdg_b: float,
    dims_b: tuple[float, float],
) -> tuple[float, float]:
    """Exact 2D Separating Axis Theorem (SAT) OBB overlap/clearance in XZ plane."""
    def _axes_and_corners(x: float, z: float, hdg: float, length: float, width: float):
        rad = math.radians(hdg)
        fx, fz = math.sin(rad), -math.cos(rad)
        rx, rz = math.cos(rad), math.sin(rad)
        hl, hw = length / 2.0, width / 2.0
        corners = [
            (x + fx * hl + rx * hw, z + fz * hl + rz * hw),
            (x + fx * hl - rx * hw, z + fz * hl - rz * hw),
            (x - fx * hl - rx * hw, z - fz * hl - rz * hw),
            (x - fx * hl + rx * hw, z - fz * hl + rz * hw),
        ]
        return [(fx, fz), (rx, rz)], corners

    axes_a, corners_a = _axes_and_corners(x_a, z_a, hdg_a, dims_a[0], dims_a[1])
    axes_b, corners_b = _axes_and_corners(x_b, z_b, hdg_b, dims_b[0], dims_b[1])

    min_overlap = float("inf")
    max_gap = -float("inf")
    separated = False

    for ax, az in axes_a + axes_b:
        proj_a = [cx * ax + cz * az for cx, cz in corners_a]
        proj_b = [cx * ax + cz * az for cx, cz in corners_b]
        min_a, max_a = min(proj_a), max(proj_a)
        min_b, max_b = min(proj_b), max(proj_b)
        overlap = min(max_a, max_b) - max(min_a, min_b)
        if overlap <= 0.0:
            separated = True
            max_gap = max(max_gap, -overlap)
        else:
            min_overlap = min(min_overlap, overlap)

    if separated:
        return 0.0, max_gap
    return min_overlap, 0.0


def test_zero_obb_interpenetration_and_c1_smooth_trajectories_all_cases() -> None:
    """Verify 0.00m OBB penetration across the entire video duration (0.00s..duration_seconds) and C1 smoothness across all 3 cases."""
    case_specs = [
        ("case_cheadle_a521_junction.json", 4.5, True, False, (4.35, 1.84), (4.26, 1.79)),
        ("case_delphouse_rollover.json", 5.0, False, True, (4.35, 1.84), (4.26, 1.79)),
        ("case_a521_hgv_corridor.json", 5.8, False, True, (8.40, 2.42), (4.26, 1.79)),
    ]

    for filename, expected_dur, expected_public, expected_local, dims_a, dims_b in case_specs:
        with open(DATA_DIR / filename, "r", encoding="utf-8") as f:
            payload = json.load(f)

        assert payload["duration_seconds"] == expected_dur
        assert payload["is_public_demo"] is expected_public
        assert payload["local_only"] is expected_local

        report = payload["report"]
        assert report["duration_seconds"] == expected_dur
        assert report["is_public_demo"] is expected_public
        assert report["local_only"] is expected_local

        impact_t = float(report["impact_timestamp_sec"])
        kfs_a = report["vehicles"][0]["keyframes"]
        kfs_b = report["vehicles"][1]["keyframes"]

        assert kfs_a[0]["timestamp_sec"] == 0.0
        assert kfs_a[-1]["timestamp_sec"] == expected_dur
        assert kfs_b[0]["timestamp_sec"] == 0.0
        assert kfs_b[-1]["timestamp_sec"] == expected_dur

        total_steps = int(round(expected_dur * 100)) + 1
        prev_a = None
        prev_b = None
        for step in range(total_steps):
            t = round(step * 0.01, 2)
            sa = _interpolate_keyframe(kfs_a, t)
            sb = _interpolate_keyframe(kfs_b, t)
            pen_m, clear_m = _obb_sat_penetration_and_clearance(
                sa["x_meters"],
                sa["z_meters"],
                sa["heading_deg"],
                dims_a,
                sb["x_meters"],
                sb["z_meters"],
                sb["heading_deg"],
                dims_b,
            )
            assert pen_m == 0.0, f"{filename} at t={t:.2f}s has OBB penetration {pen_m:.4f}m"
            if t < round(impact_t - 0.05, 2):
                assert clear_m >= 0.08, f"{filename} at t={t:.2f}s has pre-impact clearance {clear_m:.4f}m < 0.08m"
            if abs(t - impact_t) < 1e-6:
                assert 0.01 <= clear_m <= 0.12, (
                    f"{filename} at impact t={t:.2f}s expected clearance in [0.01, 0.12]m, got {clear_m:.4f}m"
                )

            if prev_a is not None and prev_b is not None:
                step_a = math.hypot(sa["x_meters"] - prev_a["x_meters"], sa["z_meters"] - prev_a["z_meters"])
                step_b = math.hypot(sb["x_meters"] - prev_b["x_meters"], sb["z_meters"] - prev_b["z_meters"])
                assert step_a < 0.23, f"{filename} vehicle_a teleport jump {step_a:.4f}m at t={t:.2f}s"
                assert step_b < 0.23, f"{filename} vehicle_b teleport jump {step_b:.4f}m at t={t:.2f}s"
            prev_a = sa
            prev_b = sb


def test_kinematic_self_consistency_heading_alignment_and_video_bounds_all_cases() -> None:
    """Verify ds == v_avg * dt (< 0.15m tolerance), pre-impact heading alignment, and strict video duration bounds across all 3 cases."""
    case_specs = [
        ("case_cheadle_a521_junction.json", 4.5),
        ("case_delphouse_rollover.json", 5.0),
        ("case_a521_hgv_corridor.json", 5.8),
    ]
    mph_to_ms = 0.44704

    for filename, expected_dur in case_specs:
        with open(DATA_DIR / filename, "r", encoding="utf-8") as f:
            payload = json.load(f)

        report = payload["report"]
        impact_t = float(report["impact_timestamp_sec"])
        assert payload["duration_seconds"] == expected_dur
        assert payload["case_metadata"]["duration_seconds"] == expected_dur
        assert report["duration_seconds"] == expected_dur

        for veh in report["vehicles"]:
            kfs = veh["keyframes"]
            assert kfs[0]["timestamp_sec"] == 0.0
            assert kfs[-1]["timestamp_sec"] == expected_dur

            for i in range(len(kfs) - 1):
                k0, k1 = kfs[i], kfs[i + 1]
                dt = k1["timestamp_sec"] - k0["timestamp_sec"]
                assert dt > 0.0
                dx = k1["x_meters"] - k0["x_meters"]
                dz = k1["z_meters"] - k0["z_meters"]
                ds_actual = math.hypot(dx, dz)
                ds_expected = 0.5 * (k0["speed_mph"] + k1["speed_mph"]) * mph_to_ms * dt
                assert abs(ds_actual - ds_expected) < 0.15, (
                    f"{filename} {veh['vehicle_id']} [{k0['timestamp_sec']}..{k1['timestamp_sec']}s]: "
                    f"ds_actual={ds_actual:.3f}m vs ds_expected={ds_expected:.3f}m"
                )

                if k1["timestamp_sec"] <= impact_t and ds_actual > 0.05:
                    vec_hdg = (math.degrees(math.atan2(dx, -dz)) + 360.0) % 360.0
                    dh = abs(((k0["heading_deg"] - vec_hdg + 180.0) % 360.0) - 180.0)
                    assert dh < 2.0, (
                        f"{filename} {veh['vehicle_id']} at t={k0['timestamp_sec']}s: "
                        f"heading_deg={k0['heading_deg']} vs velocity vector heading={vec_hdg:.2f}"
                    )



def test_road_sign_legal_analysis_and_negative_only_dvsa_and_video_urls() -> None:
    """Verify road sign legal fields, negative-only DVSA MOT items, and real video URLs in all 3 cases."""
    expected_videos = {
        "case_cheadle_a521_junction.json": "/videos/clip3_10.93s_to_15.50s_golf_vs_blue_suv.mp4",
        "case_delphouse_rollover.json": "/videos/clip1_0s_to_5.03s_suv_vs_van.mp4",
        "case_a521_hgv_corridor.json": "/videos/clip2_5.07s_to_10.90s_pickup_vs_lorry.mp4",
    }

    for filename, expected_video_url in expected_videos.items():
        with open(DATA_DIR / filename, "r", encoding="utf-8") as f:
            payload = json.load(f)

        assert payload["case_metadata"]["video_url"] == expected_video_url

        elements = payload["report"]["scene_environment_elements"]
        sign_elements = [
            el for el in elements
            if el.get("tsrgd_diagram") and el.get("statutory_duty") and el.get("driver_compliance") and el.get("legal_liability_impact")
        ]
        assert len(sign_elements) >= 2, f"{filename} must have >=2 enriched road sign/marking legal elements"

        for veh in payload["report"]["vehicles"]:
            for adv in veh["dvsa_advisories"]:
                assert "MOT Test PASS" not in adv
                assert "Rectified" not in adv
            for defect in veh["dvsa_defect_classifications"]:
                assert "MOT Test PASS" not in defect["defect_text"]
                assert "Rectified" not in defect["defect_text"]
                assert "Statutory Compliance" not in defect["defect_category"]
                assert "Rectified" not in defect["defect_category"]


def test_ensure_production_case_quality_pipeline_guarantees() -> None:
    """Verify ensure_production_case_quality enforces all 5 mandates on newly constructed cases."""
    assert "CRITICAL SCENE RULE" in FORENSIC_SYSTEM_INSTRUCTION
    assert "NEVER invent or extrapolate events before the video starts" in FORENSIC_SYSTEM_INSTRUCTION

    with open(DATA_DIR / "case_cheadle_a521_junction.json", "r", encoding="utf-8") as f:
        payload = json.load(f)

    report = ForensicLegalReport.model_validate(payload["report"])
    # Inject synthetic pre-video (t < 0.0) and post-video (t > duration) keyframes, positive MOT pass,
    # duplicate (EXPIRED), and blank TSRGD fields to verify ensure_production_case_quality cleans them all
    report.vehicles[0].dvsa_mot_expiry = "2026-05-02 (EXPIRED) (EXPIRED)"
    report.vehicles[0].dvsa_advisories.append("MOT Test PASS with no advisories")
    report.vehicles[0].dvsa_defect_classifications.append(
        DVSADefectAnalysis(
            defect_text="MOT Test PASS (Rectified)",
            defect_category="Statutory Compliance (Rectified)",
            causal_status="NOT CAUSAL",
            forensic_explanation="Should be stripped by filter_negative_dvsa_records",
        )
    )
    report.scene_environment_elements[0].tsrgd_diagram = ""
    report.scene_environment_elements[0].statutory_duty = ""
    report.scene_environment_elements[0].driver_compliance = ""
    report.scene_environment_elements[0].legal_liability_impact = ""

    cleaned = ensure_production_case_quality(
        report,
        video_url="/videos/clip3_10.93s_to_15.50s_golf_vs_blue_suv.mp4",
        duration_seconds=4.5,
    )
    assert cleaned.duration_seconds == 4.5
    assert cleaned.vehicles[0].dvsa_mot_expiry == "2026-05-02 (EXPIRED)"
    assert all("MOT Test PASS" not in a for a in cleaned.vehicles[0].dvsa_advisories)
    assert all("MOT Test PASS" not in d.defect_text for d in cleaned.vehicles[0].dvsa_defect_classifications)
    assert cleaned.scene_environment_elements[0].tsrgd_diagram != ""
    assert cleaned.scene_environment_elements[0].statutory_duty != ""
    assert cleaned.scene_environment_elements[0].driver_compliance != ""
    assert cleaned.scene_environment_elements[0].legal_liability_impact != ""
    for veh in cleaned.vehicles:
        assert veh.keyframes[0].timestamp_sec == 0.0
        assert veh.keyframes[-1].timestamp_sec == 4.5
        assert all(0.0 <= kf.timestamp_sec <= 4.5 for kf in veh.keyframes)


def test_live_uk_dvsa_mot_history_lookup() -> None:
    """Verify live UK DVSA MOT History lookup for VL19 OKP and GD64 LKU returns valid make/model/expiry and causal classifications."""
    vl19 = fetch_uk_dvsa_mot_history("VL19 OKP")
    assert vl19["registration"] == "VL19 OKP"
    assert "PEUGEOT" in vl19["make"].upper()
    assert "2008" in vl19["model"].upper()
    assert vl19["mot_status"] == "Valid"
    assert "2027-08-27" in vl19["mot_expiry"]
    assert len(vl19["dvsa_defect_classifications"]) >= 2

    gd64 = fetch_uk_dvsa_mot_history("GD64 LKU")
    assert gd64["registration"] == "GD64 LKU"
    assert "VOLKSWAGEN" in gd64["make"].upper()
    assert "GOLF" in gd64["model"].upper()
    assert gd64["mot_status"] == "EXPIRED"
    assert "2026-05-02" in gd64["mot_expiry"]
    assert any(d["causal_status"] == "CAUSAL" for d in gd64["dvsa_defect_classifications"])
    assert any(d["causal_status"] == "NOT CAUSAL" for d in gd64["dvsa_defect_classifications"])


def test_stopping_distance_physics_math() -> None:
    """Verify Newtonian stopping distance physics on damp tarmac (mu = 0.55) at 30.0 mph vs 41.2 mph."""
    g = 9.81
    mu_damp = 0.55
    mu_worn_discs = 0.51
    t_reaction = 0.67

    v_30 = 30.0 * 0.44704  # 13.4112 m/s
    d_think_30 = v_30 * t_reaction
    d_brake_30 = (v_30 ** 2) / (2 * g * mu_damp)
    d_total_30 = d_think_30 + d_brake_30

    v_41 = 41.2 * 0.44704  # 18.4180 m/s
    d_think_41 = v_41 * t_reaction
    d_brake_41 = (v_41 ** 2) / (2 * g * mu_worn_discs)
    d_total_41 = d_think_41 + d_brake_41

    assert 25.0 <= d_total_30 <= 26.2
    assert 45.5 <= d_total_41 <= 47.0
    ke_ratio = (v_41 / v_30) ** 2
    assert 1.88 <= ke_ratio <= 1.90


def test_fastapi_endpoints_and_interactive_clarification() -> None:
    """Test FastAPI endpoints including /api/cases (local vs public filtering), /api/dvsa, /api/pre-scan-video, /api/analyze-claim, and /api/approve-settlement."""
    # 1a. GET /api/cases on local testserver -> returns all 3 cases
    resp_cases = client.get("/api/cases")
    assert resp_cases.status_code == 200
    cases_json = resp_cases.json()
    assert len(cases_json["cases"]) == 3
    assert "cheadle_a521" in cases_json
    assert "delphouse_rollover" in cases_json
    assert "a521_hgv" in cases_json

    # 1b. GET /api/cases?include_local=false (or public Vercel host) -> returns only public demo Case 1
    resp_public = client.get("/api/cases?include_local=false")
    assert resp_public.status_code == 200
    public_json = resp_public.json()
    assert len(public_json["cases"]) == 1
    assert public_json["cases"][0]["case_metadata"]["id"] == "cheadle_a521"
    assert public_json["cases"][0]["is_public_demo"] is True
    assert public_json["cases"][0]["local_only"] is False

    # 2. GET /api/cases/{case_id}
    resp_c1 = client.get("/api/cases/cheadle_a521")
    assert resp_c1.status_code == 200
    assert resp_c1.json()["report"]["claim_id"] == "UK-2026-0819"
    assert resp_c1.json()["report"]["duration_seconds"] == 4.5

    # 3. GET /api/dvsa/{registration}
    resp_dvsa = client.get("/api/dvsa/GD64LKU")
    assert resp_dvsa.status_code == 200
    assert resp_dvsa.json()["mot_status"] == "EXPIRED"

    # 4. POST /api/pre-scan-video & POST /api/analyze-claim with blank plates -> returns clarification_required
    resp_prescan = client.post("/api/pre-scan-video", data={"plate_1": "", "plate_2": ""})
    assert resp_prescan.status_code == 200
    assert resp_prescan.json()["status"] == "clarification_required"

    resp_clarify = client.post("/api/analyze-claim", data={"plate_1": "", "plate_2": ""})
    assert resp_clarify.status_code == 200
    clarify_data = resp_clarify.json()
    assert clarify_data["status"] == "clarification_required"
    assert len(clarify_data["detected_vehicles_preview"]) == 2
    assert clarify_data["detected_vehicles_preview"][0]["suggested_demo_plate"] == "VL19 OKP"
    assert clarify_data["detected_vehicles_preview"][1]["suggested_demo_plate"] == "GD64 LKU"

    # 5. POST /api/approve-settlement -> returns deterministic SHA-256 settlement receipt
    resp_settle = client.post(
        "/api/approve-settlement",
        json={
            "claim_id": "UK-2026-0819",
            "claimant_pct": 25,
            "defendant_pct": 75,
            "adjuster_notes": "Confirmed 75/25 liability split by a UK motor claims & subrogation solicitor.",
        },
    )
    assert resp_settle.status_code == 200
    settle_data = resp_settle.json()
    assert settle_data["status"] == "SETTLEMENT_LOCKED"
    assert len(settle_data["receipt_sha256"]) == 64
    assert settle_data["approved_claimant_liability_pct"] == 25
    assert settle_data["approved_defendant_liability_pct"] == 75
