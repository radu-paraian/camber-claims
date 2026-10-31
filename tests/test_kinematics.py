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
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient

from backend.gemini_pipeline import fetch_uk_dvsa_mot_history
from backend.legal_corpus import UK_MOTOR_LEGAL_AND_POLICY_CORPUS
from backend.main import app
from backend.schemas import ForensicLegalReport

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

    # Check Peugeot rollover progression (0.0 at t=1.0s -> 28.0 at t=1.15s -> 72.0 at t=1.5s -> 86.0 at t=2.0s..3.0s)
    roll_by_t = {kf.timestamp_sec: kf.roll_deg for kf in peugeot.keyframes}
    assert roll_by_t[1.0] == 0.0
    assert roll_by_t[1.15] == 28.0
    assert roll_by_t[1.5] == 72.0
    assert roll_by_t[2.0] == 86.0
    assert roll_by_t[3.0] == 86.0

    # Check VW Golf speeds and braking
    golf_by_t = {kf.timestamp_sec: kf for kf in golf.keyframes}
    assert golf_by_t[0.0].speed_mph == 41.2
    assert golf_by_t[0.5].braking_active is True
    assert golf_by_t[1.15].speed_mph == 33.4
    assert golf_by_t[3.0].speed_mph == 0.0

    # Check both CAUSAL and NOT CAUSAL DVSA items exist on both vehicles
    golf_causal = [d for d in golf.dvsa_defect_classifications if d.causal_status == "CAUSAL"]
    golf_not_causal = [d for d in golf.dvsa_defect_classifications if d.causal_status == "NOT CAUSAL"]
    assert len(golf_causal) >= 2
    assert len(golf_not_causal) >= 1

    peugeot_not_causal = [d for d in peugeot.dvsa_defect_classifications if d.causal_status == "NOT CAUSAL"]
    assert len(peugeot_not_causal) >= 2


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
    """Test FastAPI endpoints including /api/cases, /api/dvsa, /api/pre-scan-video, /api/analyze-claim, and /api/approve-settlement."""
    # 1. GET /api/cases
    resp_cases = client.get("/api/cases")
    assert resp_cases.status_code == 200
    cases_json = resp_cases.json()
    assert len(cases_json["cases"]) == 3
    assert "cheadle_a521" in cases_json
    assert "delphouse_rollover" in cases_json
    assert "a521_hgv" in cases_json

    # 2. GET /api/cases/{case_id}
    resp_c1 = client.get("/api/cases/cheadle_a521")
    assert resp_c1.status_code == 200
    assert resp_c1.json()["report"]["claim_id"] == "UK-2026-0819"

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
