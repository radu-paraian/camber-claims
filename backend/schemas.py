from pydantic import BaseModel, Field
from typing import List, Literal, Optional


class Keyframe3D(BaseModel):
    timestamp_sec: float = Field(description="Video timestamp in seconds (e.g., 0.0, 0.5, 1.0)")
    x_meters: float = Field(description="East-West position in meters relative to junction center (0,0)")
    z_meters: float = Field(description="North-South position in meters relative to junction center (0,0)")
    heading_deg: float = Field(description="Vehicle yaw heading in degrees (0 = North, 90 = East)")
    speed_mph: float = Field(description="Instantaneous speed in UK miles per hour (mph)")
    braking_active: bool = Field(description="True if brake lights or deceleration pitch observed")
    roll_deg: Optional[float] = Field(default=0.0, description="Roll angle in degrees (e.g. 85.0 if rolled onto side post-impact)")


class DVSADefectAnalysis(BaseModel):
    defect_text: str = Field(description="Exact MOT failure, defect, advisory, or statutory expiry item from the UK DVSA MOT History API")
    test_date: str = Field(default="2025-08-28", description="Date of the relevant DVSA MOT test or expiry event")
    defect_category: str = Field(default="Advisory", description="e.g., 'Statutory Expiry', 'Advisory', 'Historical Failure (Rectified)'")
    causal_status: Literal["CAUSAL", "NOT CAUSAL"] = Field(
        description="Whether this DVSA MOT item had a proximate causal / contributory impact on the collision kinematics"
    )
    forensic_explanation: str = Field(
        description="Forensic engineering & legal explanation of why this DVSA item was CAUSAL or NOT CAUSAL to the crash"
    )


class VehicleTrajectory(BaseModel):
    vehicle_id: Literal["vehicle_a", "vehicle_b"]
    label: str = Field(description="e.g., '2019 Blue Peugeot 2008 SUV (VL19 OKP — Emerging from Minor Road)'")
    color_hex: str = Field(description="Hex color for 3D rendering, e.g., '#2563EB' or '#94A3B8'")
    registration_plate: str = Field(description="UK VRM plate if visible or matched, e.g., 'VL19 OKP'")
    dvsa_make: str = Field(description="DVSA registered make, e.g., 'PEUGEOT'")
    dvsa_model: str = Field(description="DVSA registered model, e.g., '2008 ALLURE PREM PURETECH SS A'")
    dvsa_mot_status: str = Field(description="Official UK DVSA MOT status, e.g., 'Valid' or 'EXPIRED'")
    dvsa_mot_expiry: str = Field(description="MOT expiry date, e.g., '2027-08-27' or '2026-05-02 (EXPIRED)'")
    dvsa_mileage_last_mot: str = Field(description="Last recorded odometer reading, e.g., '39,953 miles'")
    dvsa_advisories: List[str] = Field(description="Relevant mechanical advisories from UK DVSA MOT history")
    dvsa_defect_classifications: List[DVSADefectAnalysis] = Field(
        default_factory=list,
        description="Explicit classification of every DVSA MOT failure/advisory/expiry as CAUSAL or NOT CAUSAL with forensic reasoning"
    )
    causally_relevant: bool = Field(
        default=True,
        description="True if vehicle collided OR caused evasive action/encroachment/sightline obstruction"
    )
    causal_role_reason: str = Field(
        default="Direct collision participant or causal proximate factor",
        description="Forensic explanation of why this vehicle was retained by the causal relevance filter"
    )
    keyframes: List[Keyframe3D]


class SceneEnvironmentElement(BaseModel):
    element_id: str = Field(description="Unique identifier, e.g. 'sign_give_way_draycott'")
    element_type: Literal[
        "road_sign",
        "vegetation_sightline_blocker",
        "building",
        "road_marking",
        "give_way_sign",
        "speed_limit_sign",
        "warning_sign",
        "stop_line",
        "hazard_line",
        "sightline_blocker",
    ]
    label: str = Field(description="Human-readable label, e.g. 'UK Give Way Sign & Double Dashed Line'")
    x_meters: float = Field(description="East-West coordinate in meters relative to junction center")
    z_meters: float = Field(description="North-South coordinate in meters relative to junction center")
    causal_relevance_note: str = Field(description="Why this static object is causally relevant to the collision")
    tsrgd_diagram: Optional[str] = Field(
        default=None,
        description="UK TSRGD 2016 Diagram number, e.g., 'Diagram 602 (Give Way Sign)' or 'Diagram 1003 (Give Way Markings)' or 'Diagram 670 (30 mph Speed Limit)'",
    )
    statutory_duty: Optional[str] = Field(
        default=None,
        description="Applicable UK statutory duty & Highway Code rule, e.g., 'RTA 1988 s.36 / TSRGD 2016 Schedule 9 / Highway Code Rule 172: Driver emerging from minor road must yield priority.'",
    )
    driver_compliance: Optional[str] = Field(
        default=None,
        description="Observed compliance or breach by Vehicle A and/or Vehicle B from video telemetry, e.g., 'BREACHED by VL19 OKP (crossed Give Way line at 18.6 mph without halting)'",
    )
    legal_liability_impact: Optional[str] = Field(
        default=None,
        description="Direct impact on contributory negligence / primary liability split under English case law",
    )


class DetectedCameraSource(BaseModel):
    camera_id: str = Field(description="e.g., 'cam_1'")
    camera_label: str = Field(description="e.g., 'Cam 1: Ring Doorbell / Elevated House CCTV (Static)'")
    camera_type: Literal["dashcam_ego", "cctv_static", "third_party_witness"]
    fov_deg: float = Field(description="Estimated camera horizontal field of view in degrees (e.g., 110.0)")
    mount_position_x: float = Field(description="Estimated X position of static camera or initial vehicle camera")
    mount_position_y: float = Field(description="Estimated height in meters (e.g., 1.4m dashcam, 3.8m CCTV)")
    mount_position_z: float = Field(description="Estimated Z position in meters")
    look_at_x: float = Field(description="Target X coordinate camera is pointing toward")
    look_at_z: float = Field(description="Target Z coordinate camera is pointing toward")
    timestamp_offset_sec: float = Field(description="Temporal alignment offset relative to master timeline t=0.0s")


class UKLocationAndTimeContext(BaseModel):
    inferred_uk_location: str = Field(description="e.g., 'Cheadle, Staffordshire Moorlands (A521 / Draycott Cross Rd)'")
    road_name_and_classification: str = Field(description="e.g., 'A521 Urban Single Carriageway / Unclassified Side Road'")
    junction_geometry: str = Field(description="e.g., 'Uncontrolled T-junction with Give Way markings (Diagram 1003)'")
    speed_limit_mph: int = Field(description="Inferred UK speed limit (e.g., 30 mph built-up area with street lighting)")
    inferred_time_of_day: str = Field(description="e.g., '14:22 BST (Daylight / Overcast afternoon)'")
    lighting_and_weather: str = Field(description="e.g., 'Diffuse overcast daylight, light rain / damp visibility'")
    road_surface_condition: str = Field(description="e.g., 'Damp tarmacadam (estimated friction coefficient mu = 0.55)'")
    environmental_cues_observed: List[str] = Field(
        description="Visual cues used to deduce location/time (e.g. UK Give Way triangle, brick terrace, shadow angle)"
    )


class ForensicEvent3D(BaseModel):
    timestamp_sec: float
    event_type: Literal[
        "Perception_Hazard_Entry",
        "Line_Of_Sight_Obstruction",
        "Give_Way_Line_Encroachment",
        "Braking_Onset",
        "Evasive_Steering",
        "Point_Of_Impact",
        "Post_Impact_Rollover_Rest",
    ]
    description: str
    severity: Literal["info", "warning", "critical"]


class CaseLawCitation(BaseModel):
    case_name: str = Field(description="e.g., 'Powell v Moody [1966] 110 SJ 215'")
    citation_year: int
    legal_principle: str
    application_to_crash: str
    policy_section_ref: str = Field(description="Exact clause from the cached UK Motor Insurance Policy Wording")


class ForensicLegalReport(BaseModel):
    claim_id: str
    incident_summary: str
    location_and_time_context: UKLocationAndTimeContext
    impact_timestamp_sec: float
    impact_x_meters: float
    impact_z_meters: float
    claimant_PreImpact_Speed_mph: float
    defendant_PreImpact_Speed_mph: float
    stopping_distance_analysis: str = Field(
        description="UK Highway Code stopping distance comparison on wet/dry tarmac at estimated speeds"
    )
    causal_filtering_summary: str = Field(
        description="Summary of causal relevance filtering: why active/proximate vehicles and sightline/regulatory features were kept while unrelated background traffic/clutter was stripped"
    )
    filtered_irrelevant_objects_count: int = Field(
        default=3,
        description="Count of non-causal background objects/parked vehicles stripped to keep the 3D scene forensically clean"
    )
    scene_environment_elements: List[SceneEnvironmentElement]
    vehicles: List[VehicleTrajectory]
    detected_cameras: List[DetectedCameraSource]
    forensic_events: List[ForensicEvent3D]
    recommended_claimant_liability_pct: int = Field(ge=0, le=100)
    recommended_defendant_liability_pct: int = Field(ge=0, le=100)
    primary_highway_code_rules_breached: List[str]
    case_law_citations: List[CaseLawCitation]
    quantum_damage_estimate_gbp: int
    legal_reasoning_chain: str


class DetectedVehiclePreview(BaseModel):
    slot: Literal["plate_1", "plate_2"]
    detected_description: str = Field(
        description="Visual profile and trajectory of the causally involved vehicle, e.g., 'Blue Compact SUV (Peugeot 2008 profile) emerging Southbound from minor junction (Draycott Cross Rd)'"
    )
    ocr_status: str = Field(
        description="Why plate OCR succeeded or requires confirmation, e.g., 'Blurry / Acute Angle (18% OCR confidence)'"
    )
    detected_plate_text: Optional[str] = Field(
        default=None,
        description="Detected UK VRM text if legible with >=85% confidence, else null"
    )
    prompt_label: str = Field(
        description="Human-readable label for the clarification input field, e.g., 'UK Registration Plate for Blue Peugeot 2008 SUV'"
    )
    suggested_demo_plate: str = Field(
        description="Suggested verified UK VRM for demo/testing, e.g., 'VL19 OKP' or 'GD64 LKU'"
    )


class VideoPreScanResponse(BaseModel):
    status: Literal["clarification_required", "ready_for_analysis"] = Field(default="clarification_required")
    agent_message: str = Field(
        description="Message from the Gemini 4 Argon forensic agent summarizing tracked vehicles, causal filtering, and any missing/blurry VRM plates"
    )
    filtered_irrelevant_objects_count: int = Field(
        default=3,
        description="Number of non-causal background objects or parked cars stripped during pre-scan"
    )
    detected_vehicles_preview: List[DetectedVehiclePreview]
    missing_fields: List[str] = Field(
        default_factory=lambda: ["plate_1", "plate_2"],
        description="List of field keys requiring solicitor confirmation"
    )
    environmental_detection: str = Field(
        description="Detected road surface, friction coefficient, speed limit, and junction markings"
    )
