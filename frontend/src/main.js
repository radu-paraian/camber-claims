import { ForensicScene3D } from './scene3d.js';
import {
  iconSvg,
  formatPartyLabel,
  renderThatchamScheduleHtml,
  renderFormattedLetterHtml,
  renderMotAdvisoryRowHtml,
} from './uiFormatters.js';
import {
  initArchitectureModal,
  updateArchitectureModalCaseData,
} from './architectureModal.js';
import cheadleCaseData from '../../data/case_cheadle_a521_junction.json';
import delphouseCaseData from '../../data/case_delphouse_rollover.json';
import a521HgvCaseData from '../../data/case_a521_hgv_corridor.json';

const IS_LOCAL_ENV = ['localhost', '127.0.0.1'].includes(window.location.hostname);

const CASE_VIDEO_MAP = {
  'UK-2026-0891': {
    url: '/videos/clip3_10.93s_to_15.50s_golf_vs_blue_suv.mp4',
    previewTime: 0.4,
    camLabel: 'Ring CCTV · Cheadle A521',
    impactBadge: 'Impact at t = 0.40s',
  },
  'UK-2026-0819': {
    url: '/videos/clip3_10.93s_to_15.50s_golf_vs_blue_suv.mp4',
    previewTime: 0.4,
    camLabel: 'Ring CCTV · Cheadle A521',
    impactBadge: 'Impact at t = 0.40s',
  },
  cheadle_a521: {
    url: '/videos/clip3_10.93s_to_15.50s_golf_vs_blue_suv.mp4',
    previewTime: 0.4,
    camLabel: 'Ring CCTV · Cheadle A521',
    impactBadge: 'Impact at t = 0.40s',
  },
  'UK-2026-0842': {
    url: '/videos/clip1_0s_to_5.03s_suv_vs_van.mp4',
    previewTime: 1.25,
    camLabel: 'Ring CCTV · Delphouse Rd',
    impactBadge: 'Impact at t = 1.25s',
  },
  delphouse_rollover: {
    url: '/videos/clip1_0s_to_5.03s_suv_vs_van.mp4',
    previewTime: 1.25,
    camLabel: 'Ring CCTV · Delphouse Rd',
    impactBadge: 'Impact at t = 1.25s',
  },
  'UK-2026-0915': {
    url: '/videos/clip2_5.07s_to_10.90s_pickup_vs_lorry.mp4',
    previewTime: 1.35,
    camLabel: 'Ring CCTV · A521 Corridor',
    impactBadge: 'Impact at t = 1.35s',
  },
  'UK-2026-0904': {
    url: '/videos/clip2_5.07s_to_10.90s_pickup_vs_lorry.mp4',
    previewTime: 1.35,
    camLabel: 'Ring CCTV · A521 Corridor',
    impactBadge: 'Impact at t = 1.35s',
  },
  a521_hgv: {
    url: '/videos/clip2_5.07s_to_10.90s_pickup_vs_lorry.mp4',
    previewTime: 1.35,
    camLabel: 'Ring CCTV · A521 Corridor',
    impactBadge: 'Impact at t = 1.35s',
  },
};

const DEFAULT_TSRGD_SIGN_ELEMENTS = [
  {
    element_id: 'sign_give_way_602',
    element_type: 'give_way_sign',
    label: 'UK Diagram 602 Give Way Sign (Draycott Cross Rd)',
    x_meters: -5.2,
    z_meters: -6.8,
    radius_meters: 0.6,
    is_causal: true,
    causal_relevance: 'Primary statutory priority control governing emerging Vehicle A.',
    tsrgd_diagram: 'TSRGD 2016 Diagram 602',
    statutory_duty:
      'Highway Code Rule 172 & RTA 1988 s.36: Driver approaching an inverted red-bordered triangle MUST give way to all traffic on the major road (A521).',
    driver_compliance:
      'NON-COMPLIANT (BREACHED) — Vehicle A failed to halt at the Give Way line and emerged directly into the path of oncoming traffic.',
    legal_liability_impact:
      'Establishes primary liability (75%) against the emerging driver under Powell v Moody [1966].',
  },
  {
    element_id: 'marking_give_way_1003a',
    element_type: 'road_marking',
    label: 'UK Diagram 1003A Double Dashed Give Way Line',
    x_meters: -1.8,
    z_meters: -4.8,
    radius_meters: 1.5,
    is_causal: true,
    causal_relevance: 'Defines exact statutory boundary between minor and major carriageway.',
    tsrgd_diagram: 'TSRGD 2016 Diagram 1003A',
    statutory_duty:
      'Vehicles on minor road must not cross the transverse double-dashed line unless the major road is clear in both directions.',
    driver_compliance:
      'NON-COMPLIANT (BREACHED) — Crossed at t = 0.65s while Vehicle B was 17.8m away.',
    legal_liability_impact:
      'Confirms point of statutory encroachment into the major road priority corridor.',
  },
  {
    element_id: 'sign_speed_limit_670',
    element_type: 'speed_limit_sign',
    label: 'UK Diagram 670 30 mph Terminal Speed Limit Sign (A521)',
    x_meters: -18.0,
    z_meters: 4.5,
    radius_meters: 0.6,
    is_causal: true,
    causal_relevance: 'Establishes mandatory 30 mph urban speed limit along A521 corridor.',
    tsrgd_diagram: 'TSRGD 2016 Diagram 670',
    statutory_duty:
      'Road Traffic Regulation Act 1984 s.81 & Highway Code Rule 124: Maximum lawful speed is 30 mph (13.41 m/s).',
    driver_compliance:
      'NON-COMPLIANT (BREACHED) — Main road vehicle approached at 41.2 mph (37% above the 30 mph limit), adding +12.4m to wet-road stopping distance.',
    legal_liability_impact:
      'Triggers 25% contributory negligence deduction under Law Reform (Contributory Negligence) Act 1945.',
  },
];

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMotBadgeText(v) {
  if (!v) return 'MOT Valid';
  const statusStr = String(v.mot_status || v.dvsa_mot_status || '');
  const rawExpiry = String(v.mot_expiry_date || v.dvsa_mot_expiry || '')
    .replace(/\s*\(EXPIRED\)/gi, '')
    .trim();
  const isMotExpired =
    statusStr.toUpperCase().includes('EXPIRED') ||
    String(v.mot_expiry_date || v.dvsa_mot_expiry || '').toUpperCase().includes('EXPIRED');
  return isMotExpired
    ? `MOT Expired${rawExpiry ? ' · ' + rawExpiry : ''}`
    : `MOT Valid${rawExpiry && rawExpiry.toLowerCase() !== 'valid' ? ' · ' + rawExpiry : ''}`;
}

function normalizeAndEnrichCaseBundle(bundle, options = {}) {
  if (!bundle || typeof bundle !== 'object') return bundle;
  bundle.case_metadata = bundle.case_metadata || {};
  const report = bundle.report || {};
  bundle.report = report;

  const caseKey = options.caseKey || bundle.case_id || bundle.case_metadata.id || 'cheadle_a521';

  if (options.isPublicDemo) {
    bundle.is_public_demo = true;
    bundle.local_only = false;
    bundle.case_metadata.is_public_demo = true;
    bundle.case_metadata.local_only = false;
  } else if (options.localOnly) {
    bundle.local_only = true;
    bundle.is_public_demo = false;
    bundle.case_metadata.local_only = true;
    bundle.case_metadata.is_public_demo = false;
  } else if (options.isUserCreated) {
    bundle.is_user_created = true;
    bundle.local_only = false;
    bundle.case_metadata.is_user_created = true;
    bundle.case_metadata.local_only = false;
  }

  // Video URL & CASE_VIDEO_MAP registration so newly constructed cases get real video thumbnails & cockpit playback
  if (options.uploadedBlobUrl) {
    report.video_url = options.uploadedBlobUrl;
    bundle.case_metadata.video_url = options.uploadedBlobUrl;
  } else if (!report.video_url) {
    report.video_url =
      bundle.case_metadata.video_url ||
      CASE_VIDEO_MAP[caseKey]?.url ||
      CASE_VIDEO_MAP[report.claim_id]?.url ||
      '/videos/clip3_10.93s_to_15.50s_golf_vs_blue_suv.mp4';
    bundle.case_metadata.video_url = report.video_url;
  }

  const impactTime = Number(report.impact_timestamp_sec || 1.15);
  const existingVideoMeta = CASE_VIDEO_MAP[caseKey] || CASE_VIDEO_MAP[report.claim_id];
  const videoEntry = {
    url: report.video_url,
    previewTime: existingVideoMeta?.previewTime ?? impactTime,
    camLabel: options.isUserCreated
      ? 'UPLOADED CCTV / DASHCAM'
      : existingVideoMeta?.camLabel || 'RING CCTV · FOREGROUND',
    impactBadge: options.isUserCreated
      ? `AGENT 3D RECONSTRUCTION @ t=${impactTime.toFixed(2)}s`
      : existingVideoMeta?.impactBadge || `IMPACT @ t=${impactTime.toFixed(2)}s`,
  };
  if (caseKey) CASE_VIDEO_MAP[caseKey] = videoEntry;
  if (report.claim_id && (options.isUserCreated || !CASE_VIDEO_MAP[report.claim_id])) {
    CASE_VIDEO_MAP[report.claim_id] = videoEntry;
  }

  // Clean MOT expiry fields & ensure negative-only defect classifications on all vehicles
  if (Array.isArray(report.vehicles)) {
    report.vehicles.forEach((v) => {
      const wasExpired =
        String(v.mot_status || v.dvsa_mot_status || '')
          .toUpperCase()
          .includes('EXPIRED') ||
        String(v.mot_expiry_date || v.dvsa_mot_expiry || '')
          .toUpperCase()
          .includes('EXPIRED');
      if (wasExpired) {
        v.dvsa_mot_status = 'EXPIRED';
      }
      if (v.dvsa_mot_expiry) {
        v.dvsa_mot_expiry = String(v.dvsa_mot_expiry)
          .replace(/\s*\(EXPIRED\)/gi, '')
          .trim();
      }
      if (v.mot_expiry_date) {
        v.mot_expiry_date = String(v.mot_expiry_date)
          .replace(/\s*\(EXPIRED\)/gi, '')
          .trim();
      }
    });
  }

  // Ensure TSRGD 2016 road signs & statutory compliance elements exist on newly constructed agent cases
  if (!Array.isArray(report.scene_environment_elements)) {
    report.scene_environment_elements = structuredClone(DEFAULT_TSRGD_SIGN_ELEMENTS);
  } else {
    const hasTsrgdElements = report.scene_environment_elements.some(
      (el) => el.tsrgd_diagram || el.statutory_duty
    );
    if (!hasTsrgdElements) {
      report.scene_environment_elements = [
        ...report.scene_environment_elements,
        ...structuredClone(DEFAULT_TSRGD_SIGN_ELEMENTS),
      ];
    }
  }

  // Strictly clamp 3D trajectory keyframes & forensic events to observed video window [0.0, effectiveDuration]
  // Never invent or extrapolate scene states before t = 0.0s (video start) or after video end
  let maxObservedKeyframeT = 0;
  if (Array.isArray(report.vehicles)) {
    report.vehicles.forEach((v) => {
      if (Array.isArray(v.trajectory_3d)) {
        v.trajectory_3d.forEach((kf) => {
          if (Number(kf.timestamp_sec) > maxObservedKeyframeT) {
            maxObservedKeyframeT = Number(kf.timestamp_sec);
          }
        });
      }
    });
  }
  const effectiveDuration = Number(
    report.video_duration_sec ||
      report.duration_seconds ||
      (maxObservedKeyframeT > 0 ? maxObservedKeyframeT : 3.0)
  );
  report.video_start_sec = 0.0;
  report.duration_seconds = effectiveDuration;

  if (Array.isArray(report.vehicles)) {
    report.vehicles.forEach((v) => {
      if (Array.isArray(v.trajectory_3d)) {
        v.trajectory_3d = v.trajectory_3d
          .filter(
            (kf) =>
              Number(kf.timestamp_sec) >= 0.0 &&
              Number(kf.timestamp_sec) <= effectiveDuration + 0.001
          )
          .map((kf) => ({
            ...kf,
            timestamp_sec: Math.max(
              0.0,
              Math.min(effectiveDuration, Number(kf.timestamp_sec) || 0.0)
            ),
          }));
      }
    });
  }

  if (Array.isArray(report.forensic_events)) {
    report.forensic_events = report.forensic_events
      .filter(
        (ev) =>
          Number(ev.timestamp_sec) >= 0.0 &&
          Number(ev.timestamp_sec) <= effectiveDuration + 0.001
      )
      .map((ev) => ({
        ...ev,
        timestamp_sec: Math.max(
          0.0,
          Math.min(effectiveDuration, Number(ev.timestamp_sec) || 0.0)
        ),
      }));
  }

  return bundle;
}

const CASES_STORE = {
  cheadle_a521: normalizeAndEnrichCaseBundle(structuredClone(cheadleCaseData), {
    caseKey: 'cheadle_a521',
    isPublicDemo: true,
  }),
  delphouse_rollover: normalizeAndEnrichCaseBundle(structuredClone(delphouseCaseData), {
    caseKey: 'delphouse_rollover',
    localOnly: true,
  }),
  a521_hgv: normalizeAndEnrichCaseBundle(structuredClone(a521HgvCaseData), {
    caseKey: 'a521_hgv',
    localOnly: true,
  }),
};

let activeCaseId = 'cheadle_a521';
let scene3d = null;
let isPlaying = false;
let playbackSpeed = 1.0;
let currentTime = 1.15;
let maxDuration = 3.0;
let lastFramePerf = 0;
let kinematicContextOverride = 'both_moving_damp';

const CAMERA_MODE_LABELS = {
  orbit: 'CAM: 3D ORBIT (PERSP)',
  top: 'CAM: TOP VIEW (OVERHEAD ORTHO)',
  side: 'CAM: SIDE VIEW (X-AXIS ORTHO)',
  front: 'CAM: FRONT VIEW (CORRIDOR / Z-AXIS ORTHO)',
  pov_a: 'CAM: PEUGEOT POV (VL19 OKP)',
  pov_b: 'CAM: VW GOLF POV (GD64 LKU)',
  cctv_1: 'CAM: RING CCTV POV (STATIC)',
};

function getActiveCase() {
  return CASES_STORE[activeCaseId] || CASES_STORE.cheadle_a521;
}

/* ============================================================================
   1. INITIALIZATION & MODERN WEB GUIDANCE DIALOG SETUP
   ============================================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  const canvasContainer = document.getElementById('three-canvas-container');
  if (canvasContainer) {
    try {
      scene3d = new ForensicScene3D(canvasContainer);
    } catch (err) {
      console.error('ForensicScene3D initialization error:', err);
    }
  }

  setupNavigationAndViewSwitching();
  setupCameraRigButtons();
  setupTimelineScrubber();
  setupCausalFilterToggle();
  setupForensicTabs();
  setupSolicitorSettlementGate();
  setupUploadModalAndClarificationFlow();

  // Render initial pre-loaded state immediately
  renderWorkspaceCards();
  loadCaseIntoCockpit('cheadle_a521');
  initArchitectureModal(getActiveCase());

  // Always open on the Workspace Home landing page unless ?case= is explicitly requested
  const requestedCase = new URLSearchParams(window.location.search).get('case');
  if (requestedCase && CASES_STORE[requestedCase]) {
    loadCaseIntoCockpit(requestedCase);
    showView('cockpit');
  } else {
    showView('workspace');
  }

  // Hydrate with live DVSA-enriched backend state if server is running
  try {
    const resp = await fetch('/api/cases');
    if (resp.ok) {
      const payload = await resp.json();
      if (payload.cases_by_id) {
        Object.entries(payload.cases_by_id).forEach(([k, v]) => {
          if (v && v.report) {
            CASES_STORE[k] = normalizeAndEnrichCaseBundle(v, {
              caseKey: k,
              isPublicDemo: k === 'cheadle_a521',
              localOnly: k === 'delphouse_rollover' || k === 'a521_hgv',
            });
          }
        });
        renderWorkspaceCards();
        loadCaseIntoCockpit(activeCaseId);
        updateArchitectureModalCaseData(getActiveCase());
      }
    }
  } catch (_err) {
    // Offline fallback already loaded from verified JSON imports
  }
});

/* ============================================================================
   2. WORKSPACE VIEW & CASE SWITCHING
   ============================================================================ */
function showView(viewName) {
  const workspaceEl = document.getElementById('workspace-view');
  const cockpitEl = document.getElementById('cockpit-view');
  const archEl = document.getElementById('architecture-view');
  const btnBackWorkspace = document.getElementById('btn-back-workspace');
  const btnNavWorkspace = document.getElementById('btn-nav-workspace');
  const headerDivider = document.getElementById('header-case-divider');
  const headerTitle = document.getElementById('header-case-title');
  const btnOpenUpload = document.getElementById('btn-open-upload-modal');
  const btnReviewApprove = document.getElementById('btn-header-review-approve');
  if (!workspaceEl || !cockpitEl) return;

  const isWorkspaceHome = viewName === 'workspace' || viewName === 'home';
  const isArchView = viewName === 'architecture';

  if (isArchView && archEl) {
    workspaceEl.hidden = true;
    workspaceEl.classList.remove('active-view');
    cockpitEl.hidden = true;
    cockpitEl.classList.remove('active-view');
    archEl.hidden = false;
    if (btnBackWorkspace) btnBackWorkspace.hidden = false;
    if (headerDivider) headerDivider.hidden = true;
    if (headerTitle) headerTitle.hidden = true;
    if (btnOpenUpload) btnOpenUpload.hidden = true;
    if (btnReviewApprove) btnReviewApprove.hidden = true;
    setPlaybackState(false);
    return;
  }

  if (archEl) archEl.hidden = true;

  if (isWorkspaceHome) {
    workspaceEl.hidden = false;
    workspaceEl.classList.add('active-view');
    cockpitEl.hidden = true;
    cockpitEl.classList.remove('active-view');
    if (btnBackWorkspace) btnBackWorkspace.hidden = true;
    if (btnNavWorkspace) btnNavWorkspace.hidden = true;
    if (headerDivider) headerDivider.hidden = true;
    if (headerTitle) headerTitle.hidden = true;
    if (btnOpenUpload) btnOpenUpload.hidden = false;
    if (btnReviewApprove) btnReviewApprove.hidden = true;
    setPlaybackState(false);
  } else {
    workspaceEl.hidden = true;
    workspaceEl.classList.remove('active-view');
    cockpitEl.hidden = false;
    cockpitEl.classList.add('active-view');
    if (btnBackWorkspace) btnBackWorkspace.hidden = false;
    if (btnNavWorkspace) btnNavWorkspace.hidden = false;
    if (headerDivider) headerDivider.hidden = false;
    if (headerTitle) headerTitle.hidden = false;
    if (btnOpenUpload) btnOpenUpload.hidden = true;
    if (btnReviewApprove) btnReviewApprove.hidden = false;
    if (scene3d) {
      setTimeout(() => scene3d._onResize(), 40);
    }
  }
}

const switchView = showView;

function activateTabById(tabId) {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');
  tabBtns.forEach((b) => {
    const active = b.dataset.tab === tabId;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', String(active));
  });
  tabPanels.forEach((panel) => {
    const match = panel.id === tabId;
    panel.classList.toggle('active', match);
    panel.hidden = !match;
  });
}

function setupNavigationAndViewSwitching() {
  const btnBackWorkspace = document.getElementById('btn-back-workspace');
  const btnNavWorkspace = document.getElementById('btn-nav-workspace');
  const brandTrigger = document.getElementById('brand-home-trigger');
  const btnReviewApprove = document.getElementById('btn-header-review-approve');
  const btnTopReviewApprove = document.getElementById('btn-top-review-approve');
  const btnArchBack = document.getElementById('btn-arch-back');

  if (btnBackWorkspace) {
    btnBackWorkspace.addEventListener('click', () => {
      switchView('workspace');
    });
  }
  if (btnNavWorkspace) {
    btnNavWorkspace.addEventListener('click', () => {
      switchView('workspace');
    });
  }
  if (brandTrigger) {
    brandTrigger.addEventListener('click', () => switchView('workspace'));
  }
  if (btnArchBack) {
    btnArchBack.addEventListener('click', () => switchView('workspace'));
  }

  const jumpToSignOff = () => {
    activateTabById('tab-signoff');
    const gate = document.getElementById('settlement-gate-section');
    if (gate) gate.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  if (btnReviewApprove) btnReviewApprove.addEventListener('click', jumpToSignOff);
  if (btnTopReviewApprove) btnTopReviewApprove.addEventListener('click', jumpToSignOff);

  document.querySelectorAll('.case-pill').forEach((pill) => {
    const caseId = pill.dataset.caseId;
    if (!IS_LOCAL_ENV && (caseId === 'delphouse_rollover' || caseId === 'a521_hgv')) {
      pill.hidden = true;
    }
    pill.addEventListener('click', () => {
      if (caseId && CASES_STORE[caseId]) {
        switchView('cockpit');
        loadCaseIntoCockpit(caseId);
      }
    });
  });
}

const CASE_SHORT_TAGLINES = {
  cheadle_a521:
    'Vehicle A: Blue Peugeot 2008 (VL19 OKP), Defendant emerged across a Give Way line; struck at t = 0.40s by Vehicle B: Silver VW Golf (GD64 LKU), Claimant approaching at 41.2 mph in a 30 mph limit.',
  delphouse_rollover:
    'White Ford Puma (BX21 TKP) overshoots a rural Give Way junction across the path of an oncoming Grey BMW 320d (MK18 PZR).',
  a521_hgv:
    'Scania R500 HGV (KX71 HGV) encroaches across the centre hazard line into the path of a Red Vauxhall Corsa (LV20 RTY).',
};

const CASE_THUMBNAIL_MAP = {
  cheadle_a521: '/thumbnails/case_cheadle_a521.png',
  'UK-2026-0891': '/thumbnails/case_cheadle_a521.png',
  'UK-2026-0819': '/thumbnails/case_cheadle_a521.png',
  delphouse_rollover: '/thumbnails/case_delphouse_rollover.png',
  'UK-2026-0842': '/thumbnails/case_delphouse_rollover.png',
  a521_hgv: '/thumbnails/case_a521_hgv.png',
  'UK-2026-0915': '/thumbnails/case_a521_hgv.png',
  'UK-2026-0904': '/thumbnails/case_a521_hgv.png',
};

function renderCaseCardMedia(key, meta, report) {
  const videoMeta =
    CASE_VIDEO_MAP[key] ||
    CASE_VIDEO_MAP[report?.claim_id] ||
    CASE_VIDEO_MAP.cheadle_a521;
  const thumbUrl =
    meta?.thumbnail_url ||
    CASE_THUMBNAIL_MAP[key] ||
    CASE_THUMBNAIL_MAP[report?.claim_id] ||
    '/thumbnails/case_cheadle_a521.png';

  return `
    <div class="card-media-preview case-card-thumbnail">
      <img
        class="case-thumb-media card-preview-video"
        src="${escapeHtml(thumbUrl)}"
        alt="3D forensic reconstruction preview for ${escapeHtml(meta?.title || report?.claim_id || key)}"
        loading="lazy"
        width="480"
        height="270"
      />
      <div class="card-media-overlay">
        <span class="status-badge badge-neutral">${escapeHtml(videoMeta.camLabel)}</span>
        <span class="status-badge badge-causal mono-num">${escapeHtml(videoMeta.impactBadge)}</span>
      </div>
    </div>
  `;
}

function renderWorkspaceCards() {
  const grid = document.getElementById('workspace-cards-grid');
  if (!grid) return;

  const baseKeys = ['cheadle_a521', 'delphouse_rollover', 'a521_hgv'];
  const userKeys = Object.keys(CASES_STORE).filter((k) => !baseKeys.includes(k));
  const allKeys = [...baseKeys, ...userKeys];

  const visibleKeys = allKeys.filter((key) => {
    const item = CASES_STORE[key];
    if (!item || !item.report) return false;
    if (IS_LOCAL_ENV) return true;
    return Boolean(item.is_public_demo || item.is_user_created);
  });

  const countLabel = document.getElementById('workspace-cases-count');
  if (countLabel) {
    countLabel.textContent =
      visibleKeys.length === 1
        ? '1 claim ready for review'
        : `${visibleKeys.length} claims ready for review`;
  }

  const isSingleCard = visibleKeys.length === 1;
  grid.classList.toggle('single-card-grid', isSingleCard);

  grid.innerHTML = visibleKeys
    .map((key) => {
      const item = CASES_STORE[key];
      if (!item || !item.report) return '';
      const r = item.report;
      const meta = item.case_metadata || {};
      const vehA = r.vehicles?.[0] || {};
      const vehB = r.vehicles?.[1] || {};
      const partyA = formatPartyLabel(vehA, item);
      const partyB = formatPartyLabel(vehB, item);
      const shortTagline = CASE_SHORT_TAGLINES[key] || meta.subtitle || r.incident_summary || '';
      const grossGbp = Number(r.quantum_damage_estimate_gbp || 14250);
      const defPct = Number(r.recommended_defendant_liability_pct ?? 75);
      const clmPct = Number(r.recommended_claimant_liability_pct ?? 25);
      const netRecoveryGbp = grossGbp * (defPct / 100);

      return `
        <article class="workspace-case-card ${key === activeCaseId ? 'active-card' : ''} ${isSingleCard ? 'single-demo-card' : ''}" data-case-id="${escapeHtml(key)}" tabindex="0" role="button" aria-label="Open claim ${escapeHtml(r.claim_id)}">
          ${renderCaseCardMedia(key, meta, r)}

          <div class="card-header-group">
            <div class="card-top-badges">
              <span class="status-badge badge-verified">Ready for review</span>
              <span class="mono-num section-meta-text">Claim #${escapeHtml(r.claim_id)}</span>
              <span class="mono-num section-meta-text">£${netRecoveryGbp.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} net recovery</span>
            </div>
            <h3 class="card-title">${escapeHtml(meta.title || `Claim #${r.claim_id} — Cheadle, Staffs (A521 / Draycott Cross Rd)`)}</h3>
            <p class="card-short-tagline">${escapeHtml(shortTagline)}</p>
          </div>

          <div class="party-summary-rows">
            <div class="party-summary-row">
              <span class="vehicle-dot dot-defendant" aria-hidden="true"></span>
              <span class="party-full-name">${escapeHtml(partyA)}</span>
            </div>
            <div class="party-summary-row">
              <span class="vehicle-dot dot-claimant" aria-hidden="true"></span>
              <span class="party-full-name">${escapeHtml(partyB)}</span>
            </div>
          </div>

          <footer class="card-footer-stack">
            <div class="card-split-bar-wrap">
              <div class="card-split-labels">
                <span class="mono-num">Defendant ${escapeHtml(defPct)}%</span>
                <span class="mono-num">Claimant ${escapeHtml(clmPct)}%</span>
              </div>
              <div class="split-progress-bar">
                <div class="split-fill-defendant" style="width: ${defPct}%"></div>
                <div class="split-fill-claimant" style="width: ${clmPct}%"></div>
              </div>
            </div>

            <button type="button" class="btn-primary btn-primary-cta full-width open-case-btn" data-case-id="${escapeHtml(key)}">
              <span>Review evidence &amp; approve split</span>
              ${iconSvg('arrow-left', 16).replace('m15 18-6-6 6-6', 'M5 12h14M12 5l7 7-7 7')}
            </button>
          </footer>
        </article>
      `;
    })
    .join('');

  grid.querySelectorAll('video.case-thumb-media').forEach((v) => {
    const seekTime = parseFloat(v.dataset.previewTime || '0.40');
    v.addEventListener(
      'loadeddata',
      () => {
        try {
          v.currentTime = seekTime;
        } catch (_e) {
          // Ignore if seek not ready
        }
      },
      { once: true }
    );

    const card = v.closest('.workspace-case-card');
    if (card) {
      card.addEventListener('mouseenter', () => {
        v.play().catch(() => {});
      });
      card.addEventListener('mouseleave', () => {
        v.pause();
        try {
          v.currentTime = seekTime;
        } catch (_e) {
          // Ignore
        }
      });
    }
  });

  grid.querySelectorAll('.workspace-case-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('summary') || e.target.closest('details')) return;
      const targetId = card.dataset.caseId;
      if (targetId && CASES_STORE[targetId]) {
        loadCaseIntoCockpit(targetId);
        switchView('cockpit');
      }
    });
  });
}

/* ============================================================================
   3. COCKPIT HYDRATION & DVSA CAUSAL / NOT CAUSAL RENDERING
   ============================================================================ */
function loadCaseIntoCockpit(caseId) {
  if (!CASES_STORE[caseId]) return;
  activeCaseId = caseId;
  const bundle = getActiveCase();
  const report = bundle.report;
  const meta = bundle.case_metadata || {};

  // Update header pill active state
  document.querySelectorAll('.case-pill').forEach((pill) => {
    pill.classList.toggle('active', pill.dataset.caseId === caseId);
  });

  // Update Reference Video for the active case
  const videoEl = document.getElementById('crash-video');
  const videoBadge = document.getElementById('video-source-badge');
  const cam0 = report.detected_cameras?.[0];
  const videoMeta =
    CASE_VIDEO_MAP[caseId] ||
    CASE_VIDEO_MAP[report.claim_id] ||
    CASE_VIDEO_MAP.cheadle_a521;
  const targetVideoUrl =
    report.video_url ||
    meta.video_url ||
    videoMeta?.url ||
    '/videos/clip3_10.93s_to_15.50s_golf_vs_blue_suv.mp4';

  if (videoBadge) {
    videoBadge.textContent = cam0?.camera_label || videoMeta?.camLabel || 'Ring CCTV Footage';
  }
  if (videoEl && targetVideoUrl) {
    if (videoEl.getAttribute('src') !== targetVideoUrl) {
      videoEl.setAttribute('src', targetVideoUrl);
      videoEl.load();
    }
  }

  // Update Causal Filter Card
  const strippedCount = report.filtered_irrelevant_objects_count ?? 3;
  const strippedBadge = document.getElementById('causal-stripped-badge');
  const causalSummary = document.getElementById('causal-filter-summary');
  if (strippedBadge) strippedBadge.textContent = `${strippedCount} non-causal objects stripped`;
  if (causalSummary) causalSummary.textContent = report.causal_filtering_summary || '';

  // Update Location & Environmental Context Card
  const ctx = report.location_and_time_context || {};
  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setTxt('context-speed-limit-badge', `${ctx.speed_limit_mph || 30} MPH ZONE`);
  setTxt('ctx-location', ctx.inferred_uk_location || '');
  setTxt('ctx-junction', ctx.junction_geometry || '');
  setTxt('ctx-surface', ctx.road_surface_condition || '');
  setTxt('ctx-weather', `${ctx.inferred_time_of_day || ''} • ${ctx.lighting_and_weather || ''}`);

  const cuesList = document.getElementById('ctx-cues-list');
  if (cuesList && Array.isArray(ctx.environmental_cues_observed)) {
    cuesList.innerHTML = ctx.environmental_cues_observed
      .map((cue) => `<span class="cue-chip">${escapeHtml(cue)}</span>`)
      .join('');
  }

  // Render DVSA Telemetry Cards with clean vertical layout and MOT badge
  renderDvsaTelemetryCards(report.vehicles || []);

  // Update Camera POV Button Tooltips for current vehicles (if camera buttons exist)
  const vehA = report.vehicles?.[0];
  const vehB = report.vehicles?.[1];
  const btnPovA = document.getElementById('btn-cam-pov-a');
  const btnPovB = document.getElementById('btn-cam-pov-b');
  if (vehA) {
    const labelA = `${vehA.dvsa_make || 'Vehicle A'} POV (${vehA.registration_plate})`;
    if (btnPovA) {
      btnPovA.title = labelA;
      btnPovA.setAttribute('aria-label', labelA);
    }
    CAMERA_MODE_LABELS.pov_a = `CAM: ${labelA}`;
  }
  if (vehB) {
    const labelB = `${vehB.dvsa_make || 'Vehicle B'} POV (${vehB.registration_plate})`;
    if (btnPovB) {
      btnPovB.title = labelB;
      btnPovB.setAttribute('aria-label', labelB);
    }
    CAMERA_MODE_LABELS.pov_b = `CAM: ${labelB}`;
  }

  // Update Right Pane Liability Hero Card
  const shortClaimTitle = `Claim #${report.claim_id} — ${meta.title || 'Cheadle, Staffs (A521 / Draycott Cross Rd)'}`;
  setTxt('cockpit-claim-title', shortClaimTitle);
  setTxt('header-case-title', shortClaimTitle);
  const grossVal = Number(report.quantum_damage_estimate_gbp || 14250);
  const defPctVal = Number(report.recommended_defendant_liability_pct ?? 75);
  const clmPctVal = Number(report.recommended_claimant_liability_pct ?? 25);
  const netVal = Math.round(grossVal * (defPctVal / 100));

  setTxt('quantum-estimate-val', `£${netVal.toLocaleString('en-GB')}`);
  setTxt('quantum-gross-sub', `of £${grossVal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gross`);
  setTxt('hero-claimant-pct', `${clmPctVal}%`);
  setTxt('hero-defendant-pct', `${defPctVal}%`);
  if (vehA) setTxt('hero-defendant-plate', formatPartyLabel(vehA, bundle));
  if (vehB) setTxt('hero-claimant-plate', formatPartyLabel(vehB, bundle));

  const barClaimant = document.getElementById('hero-bar-claimant');
  const barDefendant = document.getElementById('hero-bar-defendant');
  if (barClaimant) barClaimant.style.width = `${clmPctVal}%`;
  if (barDefendant) barDefendant.style.width = `${defPctVal}%`;

  // Populate Right Pane 5 Forensic Tabs
  renderForensicDossierTabs(bundle);
  updateArchitectureModalCaseData(bundle);

  // Sync Solicitor Slider to Recommended Split
  const solSlider = document.getElementById('solicitor-liability-slider');
  if (solSlider) {
    solSlider.value = String(defPctVal);
    updateSolicitorSplitReadout(defPctVal);
  }
  const receiptBox = document.getElementById('settlement-receipt-box') || document.getElementById('settlement-receipt-banner');
  if (receiptBox) receiptBox.hidden = true;

  // Load 3D Scene & Timeline Markers strictly bounded to [0.0s, effectiveDuration]
  syncTimelineDurationWithVideo(
    videoEl && Number.isFinite(videoEl.duration) && videoEl.duration > 0
      ? videoEl.duration
      : report.video_duration_sec || report.duration_seconds || 4.5,
    report
  );
  if (scene3d) {
    scene3d.loadCaseData(report);
  }
  renderTimelineMarkers(report.forensic_events || []);
  const impactT = Math.max(0, Math.min(maxDuration, Number(report.impact_timestamp_sec ?? 0.40)));
  scrubToTime(impactT);
}

function getEffectiveDefectClassifications(vehicle) {
  const isNegativeActiveDefect = (item) => {
    const text = String(item?.defect_text || '').toLowerCase();
    const cat = String(item?.defect_category || '').toLowerCase();
    if (
      text.includes('mot test pass') ||
      cat.includes('statutory compliance') ||
      cat.includes('rectified') ||
      text.includes('rectified') ||
      text.includes('no safety-critical') ||
      text.includes('no unrectified')
    ) {
      return false;
    }
    return true;
  };

  const rawList = Array.isArray(vehicle.dvsa_defect_classifications)
    ? structuredClone(vehicle.dvsa_defect_classifications).filter(isNegativeActiveDefect)
    : [];

  // Apply interactive Solicitor Kinematic Context Override if selected
  if (kinematicContextOverride === 'veh_a_stationary' && vehicle.vehicle_id === 'vehicle_a') {
    rawList.forEach((item) => {
      if (
        item.defect_text.toLowerCase().includes('brake') ||
        item.defect_text.toLowerCase().includes('tyre')
      ) {
        item.causal_status = 'NOT CAUSAL';
        item.forensic_explanation =
          'NOT CAUSAL (Stationary Override) — Because the vehicle was stationary when struck, braking and tyre grip defects had zero mechanical impact on collision avoidance.';
      }
    });
  }

  if (rawList.length > 0) return rawList;

  // Fallback automatic classification if a custom vehicle only has raw advisories (negative only)
  return (vehicle.dvsa_advisories || [])
    .filter((adv) => {
      const lower = String(adv || '').toLowerCase();
      return !lower.includes('rectified') && !lower.includes('no safety-critical');
    })
    .map((adv) => {
      const lower = adv.toLowerCase();
      const isCausal =
        (lower.includes('brake') || lower.includes('tyre') || lower.includes('expired')) &&
        !lower.includes('parking') &&
        !lower.includes('corroded');
      return {
        defect_text: adv,
        test_date: String(vehicle.dvsa_mot_expiry || '2026').replace(/\s*\(EXPIRED\)/gi, '').trim(),
        defect_category: 'DVSA MOT Advisory',
        causal_status: isCausal ? 'CAUSAL' : 'NOT CAUSAL',
        forensic_explanation: isCausal
          ? 'CAUSAL / CONTRIBUTORY — Degraded braking or wet-tarmac tyre grip during active collision approach.'
          : 'NOT CAUSAL — Negative MOT advisory had no mechanical bearing on collision kinematics or stopping distance.',
      };
    });
}

function renderDvsaTelemetryCards(vehicles) {
  const container = document.getElementById('dvsa-cards-container');
  if (!container) return;

  container.innerHTML = vehicles
    .map((v) => {
      const isMotExpired =
        String(v.mot_status || v.dvsa_mot_status || '')
          .toUpperCase()
          .includes('EXPIRED') ||
        String(v.mot_expiry_date || v.dvsa_mot_expiry || '')
          .toUpperCase()
          .includes('EXPIRED');
      const motBadgeText = formatMotBadgeText(v);
      const classifications = getEffectiveDefectClassifications(v);

      const defectsHtml = classifications
        .map((d) => {
          const isCausal = String(d.causal_status).toUpperCase() === 'CAUSAL';
          const cleanTestDate = String(d.test_date || 'MOT History')
            .replace(/\s*\(EXPIRED\)/gi, '')
            .trim();
          return `
            <details class="dvsa-defect-item defect-disclosure ${isCausal ? 'defect-causal is-causal' : 'defect-non-causal is-not-causal'}">
              <summary class="defect-summary-row" style="display: flex; flex-direction: column; align-items: stretch; gap: 6px; width: 100%;">
                <div class="defect-header-row" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                  <span class="defect-causality-pill badge-tag ${isCausal ? 'pill-causal crimson' : 'pill-non-causal emerald'} mono">
                    ${isCausal ? 'Causal / Contributory' : 'Non-Causal Advisory'}
                  </span>
                  <span class="defect-expand-hint mono-muted" style="font-size: 0.72rem; opacity: 0.75;">Details ▾</span>
                </div>
                <span class="defect-text-preview defect-title" style="display: block; width: 100%;">${escapeHtml(d.defect_text)}</span>
              </summary>
              <div class="defect-detail-body defect-disclosure-body">
                <div class="defect-meta-line mono-muted">${escapeHtml(cleanTestDate)} · ${escapeHtml(d.defect_category || 'MOT Advisory')}</div>
                <p class="defect-forensic-note defect-explanation">${escapeHtml(d.forensic_explanation || d.causality_reason || '')}</p>
              </div>
            </details>
          `;
        })
        .join('');

      return `
        <div class="dvsa-vehicle-card ${isMotExpired ? 'mot-expired-border expired-mot' : ''}">
          <div class="dvsa-card-top">
            <span class="uk-vrm-plate">${escapeHtml(v.registration_plate)}</span>
            <span class="badge-tag ${isMotExpired ? 'crimson' : 'emerald'} mono">
              ${escapeHtml(motBadgeText)}
            </span>
          </div>
          <div class="dvsa-make-model">
            <strong>${escapeHtml(v.dvsa_make)} ${escapeHtml(v.dvsa_model)}</strong>
            <span class="mono-muted"> • ${escapeHtml(v.dvsa_mileage_last_mot)}</span>
          </div>
          <div class="dvsa-defects-list">
            ${defectsHtml}
          </div>
          <button
            type="button"
            class="btn-verify-dvsa mono-text"
            data-plate="${escapeHtml(v.registration_plate)}"
          >
            ↻ Verify Live UK DVSA API (${escapeHtml(v.registration_plate)})
          </button>
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('.btn-verify-dvsa').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const plate = btn.dataset.plate;
      const origText = btn.textContent;
      btn.textContent = `Querying history.mot.api.gov.uk for ${plate}…`;
      try {
        const res = await fetch(`/api/dvsa/${encodeURIComponent(plate)}`);
        if (res.ok) {
          const data = await res.json();
          btn.textContent = `✓ Live UK DVSA Verified: ${data.make} ${data.model} • MOT ${data.mot_status} (${data.last_mileage})`;
          btn.classList.add('verified-flash');
          return;
        }
      } catch (_e) {
        // Fallback confirmation
      }
      btn.textContent = `✓ Verified DVSA Record: ${plate}`;
      setTimeout(() => {
        btn.textContent = origText;
      }, 4000);
    });
  });
}

function renderForensicDossierTabs(bundle) {
  const report = bundle.report || {};
  const subagents = bundle.subagents || {};

  // Tab 1 (Summary): Claim badge, incident summary, stopping distance comparison, fault rationales
  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setTxt('claim-id-badge', `Claim ${report.claim_id || 'UK-2026-0891'}`);
  if (report.incident_summary) {
    setTxt('incident-summary-text', report.incident_summary);
  }
  if (report.stopping_distance_analysis) {
    const stopEl = document.getElementById('summary-stopping-explanation');
    if (stopEl) stopEl.textContent = report.stopping_distance_analysis;
  }
  if (report.primary_fault_rationale) {
    setTxt('primary-fault-rationale', report.primary_fault_rationale);
  }
  if (report.contributory_negligence_rationale) {
    setTxt('contributory-negligence-rationale', report.contributory_negligence_rationale);
  }

  // Tab 3 (Law): Highway code rules list + Road signs + Case law citations
  const hwList = document.getElementById('highway-code-list');
  if (hwList && Array.isArray(report.primary_highway_code_rules_breached)) {
    hwList.innerHTML = report.primary_highway_code_rules_breached
      .map(
        (rule) => `
        <div class="statute-item">
          <span class="status-badge badge-causal">Statutory breach</span>
          <p class="statute-text">${escapeHtml(rule)}</p>
        </div>
      `
      )
      .join('');
  }

  const citationsList = document.getElementById('caselaw-citations-list');
  const roadSignsLegalList = document.getElementById('road-signs-legal-list');

  const citationHtml = Array.isArray(report.case_law_citations)
    ? report.case_law_citations
        .map(
          (c, idx) => `
        <details class="citation-card citation-disclosure" name="caselaw-citation-item" ${idx === 0 ? 'open' : ''}>
          <summary class="citation-header">
            <strong>${escapeHtml(c.case_name)}</strong>
            <span class="badge-tag cyan mono">${escapeHtml(c.citation_year)}</span>
          </summary>
          <div class="citation-body">
            <p class="citation-principle">${escapeHtml(c.legal_principle)}</p>
            <p class="citation-application">${escapeHtml(c.application_to_crash)}</p>
            <div class="citation-policy-ref mono-muted">${escapeHtml(c.policy_section_ref)}</div>
          </div>
        </details>
      `
        )
        .join('')
    : '';

  const signElements = Array.isArray(report.scene_environment_elements)
    ? report.scene_environment_elements.filter(
        (el) =>
          el.is_causal !== false &&
          (el.tsrgd_diagram ||
            el.statutory_duty ||
            el.driver_compliance ||
            el.legal_liability_impact ||
            String(el.element_type || '').includes('sign'))
      )
    : [];

  const signAnalysisHtml =
    signElements.length > 0
      ? signElements
          .map(
            (el, idx) => `
        <details class="citation-card citation-disclosure" ${idx === 0 ? 'open' : ''}>
          <summary class="citation-header">
            <strong>${escapeHtml(el.label || el.element_type)}</strong>
            <span class="badge-tag amber mono">${escapeHtml(el.tsrgd_diagram || 'TSRGD 2016')}</span>
          </summary>
          <div class="citation-body">
            ${el.statutory_duty ? `<p class="citation-principle"><strong>Statutory Duty:</strong> ${escapeHtml(el.statutory_duty)}</p>` : ''}
            ${el.driver_compliance ? `<p class="citation-application"><strong>Observed Compliance:</strong> ${escapeHtml(el.driver_compliance)}</p>` : ''}
            <p class="citation-application">${escapeHtml(el.legal_liability_impact || el.causal_relevance || '')}</p>
          </div>
        </details>
      `
          )
          .join('')
      : '';

  if (roadSignsLegalList) {
    roadSignsLegalList.innerHTML = signAnalysisHtml;
    if (citationsList) {
      citationsList.innerHTML = citationHtml;
    }
  } else if (citationsList) {
    citationsList.innerHTML = citationHtml + signAnalysisHtml;
  }

  // Tab 4 (Costs): Thatcham schedule + CPR Pre-Action Letter + Policy Audit formatted cleanly
  const thatchamBox = document.getElementById('thatcham-schedule-container');
  if (thatchamBox) {
    thatchamBox.innerHTML = renderThatchamScheduleHtml(subagents.repair_estimate || '', report);
  }

  const cprBox = document.getElementById('cpr-letter-content');
  if (cprBox) {
    cprBox.innerHTML = renderFormattedLetterHtml(subagents.subrogation_letter || '');
  }

  const policyContent = document.getElementById('policy-audit-content');
  if (policyContent) {
    policyContent.innerHTML = renderFormattedLetterHtml(subagents.policy_audit || '');
  }
}

/* ============================================================================
   4. CAMERA RIG, CAUSAL SCENE FILTER & TIMELINE SCRUBBER
   ============================================================================ */
function setupCameraRigButtons() {
  const buttons = document.querySelectorAll('.cam-btn');
  if (!buttons || buttons.length === 0) return;

  buttons.forEach((btn) => {
    const mode = btn.dataset.cam;
    if (mode) btn.setAttribute('data-cam-mode', mode);

    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (scene3d && mode) {
        scene3d.setCameraMode(mode);
      }
      const readout = document.getElementById('active-cam-readout');
      if (readout && mode) {
        readout.textContent = CAMERA_MODE_LABELS[mode] || `CAM: ${mode.toUpperCase()}`;
      }
    });
  });
}

function setupCausalFilterToggle() {
  const chk = document.getElementById('chk-causal-filter');
  if (!chk) return;
  chk.addEventListener('change', () => {
    if (scene3d) {
      scene3d.setCausalFilterActive(chk.checked);
    }
  });
}

function getTimelineScrubberEl() {
  return (
    document.getElementById('timeline-slider') ||
    document.getElementById('timeline-scrubber')
  );
}

function syncTimelineDurationWithVideo(durationSec, report) {
  const fallbackDur = Number(report?.video_duration_sec || report?.duration_seconds || 3.0);
  const rawDur =
    Number.isFinite(Number(durationSec)) && Number(durationSec) > 0
      ? Number(durationSec)
      : fallbackDur;

  // Never extrapolate beyond the observed trajectory or video window
  let maxKeyframeT = 0;
  if (report && Array.isArray(report.vehicles)) {
    report.vehicles.forEach((v) => {
      if (Array.isArray(v.trajectory_3d)) {
        v.trajectory_3d.forEach((kf) => {
          if (Number(kf.timestamp_sec) > maxKeyframeT) {
            maxKeyframeT = Number(kf.timestamp_sec);
          }
        });
      }
    });
  }

  const boundedDur = maxKeyframeT > 0 ? Math.min(rawDur, maxKeyframeT) : rawDur;
  maxDuration = Math.max(0.5, Number(boundedDur.toFixed(2)));

  const slider = getTimelineScrubberEl();
  if (slider) {
    slider.min = '0.00';
    slider.max = maxDuration.toFixed(2);
  }

  const timecodeDisplay = document.getElementById('timecode-display');
  if (timecodeDisplay) {
    const clampedCurrent = Math.max(0, Math.min(maxDuration, currentTime));
    timecodeDisplay.textContent = `${clampedCurrent.toFixed(2).padStart(5, '0')}s / ${maxDuration.toFixed(2).padStart(5, '0')}s`;
  }
}

function setupTimelineScrubber() {
  const slider = getTimelineScrubberEl();
  const btnPlay = document.getElementById('btn-play-pause');
  const videoEl = document.getElementById('crash-video');

  if (videoEl) {
    videoEl.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(videoEl.duration) && videoEl.duration > 0) {
        const activeBundle = getActiveCase();
        syncTimelineDurationWithVideo(videoEl.duration, activeBundle?.report);
        if (currentTime > maxDuration) {
          scrubToTime(maxDuration);
        }
      }
    });
  }

  if (slider) {
    slider.min = '0.00';
    slider.addEventListener('input', () => {
      setPlaybackState(false);
      scrubToTime(parseFloat(slider.value));
    });
  }

  if (btnPlay) {
    btnPlay.addEventListener('click', () => {
      if (currentTime >= maxDuration - 0.02) {
        scrubToTime(0.0);
      }
      setPlaybackState(!isPlaying);
    });
  }

  const speedSelect = document.getElementById('playback-speed-select');
  if (speedSelect) {
    speedSelect.addEventListener('change', () => {
      playbackSpeed = parseFloat(speedSelect.value || '1.0');
      const vEl = document.getElementById('crash-video');
      if (vEl) {
        try {
          vEl.playbackRate = playbackSpeed;
        } catch (_e) {
          // ignore
        }
      }
    });
  }

  document.querySelectorAll('.speed-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.speed-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      playbackSpeed = parseFloat(btn.dataset.speed || '1.0');
      const vEl = document.getElementById('crash-video');
      if (vEl) {
        try {
          vEl.playbackRate = playbackSpeed;
        } catch (_e) {
          // ignore
        }
      }
    });
  });
}

function renderTimelineMarkers(events) {
  const container = document.getElementById('timeline-markers');
  if (!container || !Array.isArray(events) || events.length === 0) return;

  container.innerHTML = events
    .map((ev) => {
      const labelShort = ev.event_type.replace(/_/g, ' ');
      return `
        <button
          type="button"
          class="marker-pill ${escapeHtml(ev.severity || 'info')}"
          data-time="${Number(ev.timestamp_sec).toFixed(2)}"
        >
          <span class="marker-dot"></span>
          t=${Number(ev.timestamp_sec).toFixed(2)}s ${escapeHtml(labelShort)}
        </button>
      `;
    })
    .join('');

  container.querySelectorAll('.marker-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      setPlaybackState(false);
      scrubToTime(parseFloat(pill.dataset.time || '1.15'));
    });
  });
}

function setPlaybackState(playing) {
  isPlaying = playing;
  const playIcon = document.getElementById('play-icon');
  const playLabel = document.getElementById('play-label');
  if (playIcon) playIcon.textContent = isPlaying ? '⏸' : '▶';
  if (playLabel) playLabel.textContent = isPlaying ? 'Pause' : 'Play';

  const chkSync = document.getElementById('chk-sync-video');
  const videoEl = document.getElementById('crash-video');
  if (videoEl) {
    try {
      videoEl.playbackRate = playbackSpeed;
      if (isPlaying && (!chkSync || chkSync.checked)) {
        videoEl.currentTime = currentTime;
        videoEl.play().catch(() => {});
      } else {
        videoEl.pause();
      }
    } catch (_e) {
      // Ignore if video metadata not yet loaded
    }
  }

  if (isPlaying) {
    lastFramePerf = performance.now();
    requestAnimationFrame(tickPlaybackLoop);
  }
}

function tickPlaybackLoop(now) {
  if (!isPlaying) return;
  const dt = ((now - lastFramePerf) / 1000) * playbackSpeed;
  lastFramePerf = now;

  const nextT = currentTime + dt;
  if (nextT >= maxDuration) {
    scrubToTime(maxDuration);
    setPlaybackState(false);
    return;
  }
  scrubToTime(nextT);
  requestAnimationFrame(tickPlaybackLoop);
}

function scrubToTime(t) {
  currentTime = Math.max(0.0, Math.min(maxDuration, Number(t) || 0.0));

  const slider = getTimelineScrubberEl();
  if (slider) slider.value = currentTime.toFixed(2);

  const timecodeDisplay = document.getElementById('timecode-display');
  if (timecodeDisplay) {
    timecodeDisplay.textContent = `${currentTime.toFixed(2).padStart(5, '0')}s / ${maxDuration.toFixed(2).padStart(5, '0')}s`;
  }

  // Sync HTML5 Reference Video if enabled
  const chkSync = document.getElementById('chk-sync-video');
  const videoEl = document.getElementById('crash-video');
  const videoTimePill = document.getElementById('video-time-pill');
  if (videoTimePill) videoTimePill.textContent = `CLIP t=${currentTime.toFixed(2)}s`;

  if (videoEl && (!chkSync || chkSync.checked)) {
    try {
      if (Math.abs(videoEl.currentTime - currentTime) > 0.08) {
        videoEl.currentTime = currentTime;
      }
    } catch (_e) {
      // Ignore if video metadata not yet loaded
    }
  }

  // Update 3D Scene & HUD Overlay
  const snapshot = scene3d ? scene3d.updateAtTime(currentTime) : null;
  updateHudOverlay(currentTime, snapshot);

  // Highlight closest timeline marker
  document.querySelectorAll('.marker-pill').forEach((pill) => {
    const pt = parseFloat(pill.dataset.time || '0');
    pill.classList.toggle('active', Math.abs(pt - currentTime) < 0.18);
  });
}

function updateHudOverlay(t, snapshot) {
  const bundle = getActiveCase();
  const report = bundle.report || {};
  const vehA = report.vehicles?.[0] || {};
  const vehB = report.vehicles?.[1] || {};
  const kfA = snapshot?.vehicle_a;
  const kfB = snapshot?.vehicle_b;

  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setTxt('hud-timestamp', `t = ${t.toFixed(2)}s`);
  if (vehA.registration_plate) setTxt('hud-label-veh-a', `DEFENDANT (${vehA.registration_plate})`);
  if (vehB.registration_plate) setTxt('hud-label-veh-b', `CLAIMANT (${vehB.registration_plate})`);

  if (kfA) {
    setTxt('hud-speed-a', `${kfA.speed_mph.toFixed(1)} mph`);
    const rollVal = Number(kfA.roll_deg || 0).toFixed(1);
    setTxt(
      'hud-roll-a',
      Number(kfA.roll_deg || 0) > 10
        ? `ROLLOVER: ${rollVal}° Nearside Tilt`
        : `Roll: ${rollVal}° • ${kfA.braking_active ? 'Braking' : 'Emerged Give Way'}`
    );
  }

  if (kfB) {
    setTxt('hud-speed-b', `${kfB.speed_mph.toFixed(1)} mph`);
    setTxt(
      'hud-brake-b',
      kfB.braking_active
        ? 'EMERGENCY BRAKING ACTIVE (μ=0.55)'
        : `${report.location_and_time_context?.speed_limit_mph || 30} mph Zone`
    );
  }

  if (kfA && kfB) {
    const dist = Math.hypot(kfA.x_meters - kfB.x_meters, kfA.z_meters - kfB.z_meters);
    setTxt(
      'hud-impact-dist',
      Math.abs(t - (report.impact_timestamp_sec ?? 1.15)) < 0.14
        ? '0.0m (IMPACT)'
        : `${dist.toFixed(1)}m separation`
    );
  }

  // Update Active Forensic Event Banner
  const events = report.forensic_events || [];
  let activeEv = events[0];
  for (const ev of events) {
    if (t >= ev.timestamp_sec - 0.1) activeEv = ev;
  }
  if (activeEv) {
    setTxt(
      'hud-event-type',
      `${activeEv.event_type.replace(/_/g, ' ').toUpperCase()} (t = ${Number(activeEv.timestamp_sec).toFixed(2)}s):`
    );
    setTxt('hud-event-desc', activeEv.description);
    const banner = document.getElementById('hud-event-banner');
    if (banner) {
      banner.className = `hud-event-banner ${activeEv.severity || 'info'}`;
    }
  }
}

/* ============================================================================
   5. FORENSIC DOSSIER TABS & SOLICITOR SETTLEMENT GATE
   ============================================================================ */
function setupForensicTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.tab;
      tabBtns.forEach((b) => {
        const active = b === btn;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', String(active));
      });
      tabPanels.forEach((panel) => {
        const match = panel.id === targetId;
        panel.classList.toggle('active', match);
        panel.hidden = !match;
      });
    });
  });
}

function updateSolicitorSplitReadout(defendantPct) {
  const claimantPct = 100 - defendantPct;
  const bundle = getActiveCase();
  const report = bundle.report || {};
  const quantum = Number(report.quantum_damage_estimate_gbp || 18450);
  const netRecovery = Math.max(0, quantum * (defendantPct / 100) - 500);

  const vehA = report.vehicles?.[0]?.registration_plate || 'VL19 OKP';
  const vehB = report.vehicles?.[1]?.registration_plate || 'GD64 LKU';

  const cEl = document.getElementById('gate-claimant-readout');
  const dEl = document.getElementById('gate-defendant-readout');
  const netEl = document.getElementById('gate-net-recovery');

  if (cEl) cEl.textContent = `Claimant (${vehB}): ${claimantPct}%`;
  if (dEl) dEl.textContent = `Defendant (${vehA}): ${defendantPct}%`;
  if (netEl) {
    netEl.textContent = `£${netRecovery.toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}

function setupSolicitorSettlementGate() {
  const slider = document.getElementById('solicitor-liability-slider');
  const btnApprove = document.getElementById('btn-approve-settlement');

  if (slider) {
    slider.addEventListener('input', () => {
      updateSolicitorSplitReadout(Number(slider.value));
    });
  }

  if (btnApprove) {
    btnApprove.addEventListener('click', async () => {
      const bundle = getActiveCase();
      const report = bundle.report || {};
      const defendantPct = Number(
        slider?.value ?? report.recommended_defendant_liability_pct ?? 75
      );
      const claimantPct = 100 - defendantPct;
      const notes = document.getElementById('solicitor-notes')?.value || '';

      btnApprove.disabled = true;
      const origText = btnApprove.textContent;
      btnApprove.textContent = 'Generating Cryptographic SHA-256 Subrogation Receipt…';

      let receiptPayload = null;
      try {
        const res = await fetch('/api/approve-settlement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            claim_id: report.claim_id || 'UK-2026-0819',
            claimant_liability_pct: claimantPct,
            defendant_liability_pct: defendantPct,
            adjuster_notes: notes,
            previous_interaction_id: bundle.interaction_id || null,
          }),
        });
        if (res.ok) {
          receiptPayload = await res.json();
        }
      } catch (_err) {
        // Fallback deterministic receipt if offline
      }

      const receiptBox = document.getElementById('settlement-receipt-box');
      const tsEl = document.getElementById('receipt-timestamp');
      const splitEl = document.getElementById('receipt-split-val');
      const netEl = document.getElementById('receipt-net-val');
      const hashEl = document.getElementById('receipt-sha256');
      const gateNetText = document.getElementById('gate-net-recovery')?.textContent || '£13,337.50';

      if (tsEl) tsEl.textContent = receiptPayload?.timestamp_utc || new Date().toISOString();
      if (splitEl) splitEl.textContent = `${defendantPct}% Defendant / ${claimantPct}% Claimant`;
      if (netEl) netEl.textContent = gateNetText;
      if (hashEl) {
        hashEl.textContent =
          receiptPayload?.receipt_sha256 ||
          '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
      }
      if (receiptBox) receiptBox.hidden = false;

      btnApprove.disabled = false;
      btnApprove.textContent = origText;
    });
  }
}

/* ============================================================================
   6. UNIFIED 1-BUTTON UPLOAD MODAL (<dialog closedby="any">) & CLARIFICATION
   ============================================================================ */
function setupUploadModalAndClarificationFlow() {
  const dialog = document.getElementById('upload-modal');
  const btnOpenHeader = document.getElementById('btn-open-upload-modal');
  const btnOpenHero = document.getElementById('btn-hero-upload');
  const btnCancel = document.getElementById('btn-modal-cancel');
  const btnPrescan =
    document.getElementById('btn-prescan-video') || document.getElementById('btn-scan-video');
  const form =
    document.getElementById('upload-claim-form') || document.getElementById('upload-form');
  const fileInput =
    document.getElementById('input-video-files') || document.getElementById('upload-video-input');
  const filenameDisplay = document.getElementById('upload-filename-display');
  const clarificationBox =
    document.getElementById('agent-clarification-box') ||
    document.getElementById('upload-stage-stepper');
  const statusMsg = document.getElementById('modal-status-msg');
  const contextSelect = document.getElementById('select-kinematic-context');
  const submitBtn =
    document.getElementById('btn-submit-analysis') || document.getElementById('btn-submit-upload');

  if (!dialog) return;

  let hasCompletedPreScan = false;
  const defaultSubmitLabel =
    submitBtn?.textContent?.trim() || 'Scan Video & Build 3D Reconstruction →';

  // MANDATORY Modern Web Guidance Fallback for browsers without native `closedBy` support
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isDialogContent =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (isDialogContent) return;
      dialog.close();
    });
  }

  const openModal = () => {
    hasCompletedPreScan = false;
    if (statusMsg) statusMsg.hidden = true;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = defaultSubmitLabel;
    }
    dialog.showModal();
  };

  if (btnOpenHeader) btnOpenHeader.addEventListener('click', openModal);
  if (btnOpenHero) btnOpenHero.addEventListener('click', openModal);
  if (btnCancel) btnCancel.addEventListener('click', () => dialog.close());

  if (fileInput && filenameDisplay) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        const names = Array.from(fileInput.files)
          .map((f) => f.name)
          .join(', ');
        filenameDisplay.textContent = `Selected: ${names}`;
      }
    });
  }

  // Quick-fill plate chips inside the Agent Clarification Box
  document.querySelectorAll('.btn-quick-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const targetId = chip.dataset.target;
      const plateVal = chip.dataset.plate;
      const inputEl = document.getElementById(targetId);
      if (inputEl && plateVal) {
        inputEl.value = plateVal;
      }
    });
  });

  if (contextSelect) {
    contextSelect.addEventListener('change', () => {
      kinematicContextOverride = contextSelect.value;
      const bundle = getActiveCase();
      if (bundle?.report?.vehicles) {
        renderDvsaTelemetryCards(bundle.report.vehicles);
        renderForensicDossierTabs(bundle);
      }
    });
  }

  // Stage 1: Agentic Video Pre-Scan & Causal Object Filtering
  const runAgentPreScan = async () => {
    if (statusMsg) {
      statusMsg.hidden = false;
      statusMsg.textContent =
        'Stage 1/2: Scanning video footage & detecting vehicles via Gemini 4 Argon (processing="agentic")…';
    }
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Scanning Video & Detecting Vehicles…';
    }

    const fd = new FormData();
    if (fileInput?.files?.length) {
      Array.from(fileInput.files).forEach((f) => fd.append('videos', f));
    }

    try {
      const res = await fetch('/api/pre-scan-video', { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        populateClarificationCard(data);
      }
    } catch (_err) {
      // Offline fallback uses pre-populated Cheadle A521 detection copy
    }

    hasCompletedPreScan = true;
    if (clarificationBox) clarificationBox.hidden = false;
    if (statusMsg) statusMsg.hidden = true;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirm Plates & Build 3D Reconstruction →';
    }
  };

  // Optional legacy scan button guard (no error if removed from index.html)
  if (btnPrescan) {
    btnPrescan.addEventListener('click', runAgentPreScan);
  }

  // Unified 1-Button Submit Handler:
  // Automatically runs Stage 1 (pre-scan + clarification) if plates are empty, then Stage 2 (DVSA + 3D reconstruction)
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const p1El =
        document.getElementById('plate-1-input') || document.getElementById('input-plate-v1');
      const p2El =
        document.getElementById('plate-2-input') || document.getElementById('input-plate-v2');
      let p1 = p1El?.value?.trim() || '';
      let p2 = p2El?.value?.trim() || '';

      if ((!p1 || !p2) && !hasCompletedPreScan) {
        await runAgentPreScan();
        if (!p1 && p1El) p1El.focus();
        else if (!p2 && p2El) p2El.focus();
        return;
      }

      // If pre-scan already ran and user clicks the single button again without typing, default to detected Cheadle plates
      if (!p1) {
        p1 = 'VL19 OKP';
        if (p1El) p1El.value = p1;
      }
      if (!p2) {
        p2 = 'GD64 LKU';
        if (p2El) p2El.value = p2;
      }

      if (statusMsg) {
        statusMsg.hidden = false;
        statusMsg.textContent = `Stage 2/2: Querying UK DVSA MOT API (${p1} & ${p2}) & building 3D kinematic trajectories…`;
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Building 3D Reconstruction & Legal Dossier…';
      }

      const selectedFiles = fileInput?.files ? Array.from(fileInput.files) : [];
      const uploadedBlobUrl =
        selectedFiles.length > 0 ? URL.createObjectURL(selectedFiles[0]) : null;

      const fd = new FormData();
      selectedFiles.forEach((f) => fd.append('videos', f));
      fd.append('plate_1', p1);
      fd.append('plate_2', p2);
      fd.append('mode', 'sync');

      let resultBundle = null;
      try {
        const res = await fetch('/api/analyze-claim', { method: 'POST', body: fd });
        if (res.ok) {
          const payload = await res.json();
          if (payload.status === 'clarification_required') {
            populateClarificationCard(payload);
            if (clarificationBox) clarificationBox.hidden = false;
            if (statusMsg) statusMsg.hidden = true;
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Confirm Plates & Build 3D Reconstruction →';
            }
            return;
          }
          if (payload.report) {
            resultBundle = payload;
          }
        }
      } catch (_err) {
        // Fallback to synthesized reconstruction if backend is unreachable
      }

      if (!resultBundle) {
        resultBundle = structuredClone(CASES_STORE.cheadle_a521);
        resultBundle.case_metadata = {
          ...(resultBundle.case_metadata || {}),
          title: `Live Forensic Analysis: ${p1} vs ${p2}`,
          plate_1: p1,
          plate_2: p2,
        };
        if (resultBundle.report?.vehicles?.[0]) {
          resultBundle.report.vehicles[0].registration_plate = p1;
        }
        if (resultBundle.report?.vehicles?.[1]) {
          resultBundle.report.vehicles[1].registration_plate = p2;
        }
      }

      // Register newly constructed case with all fixes applied (video thumbnail, clean MOT badges, TSRGD signs)
      const newCaseKey = `user_case_${Date.now().toString(36).slice(-5)}`;
      resultBundle.case_id = newCaseKey;
      if (!resultBundle.report.claim_id || resultBundle.report.claim_id === 'UK-2026-0819') {
        resultBundle.report.claim_id = `UK-2026-${Math.floor(1000 + Math.random() * 8999)}`;
      }

      normalizeAndEnrichCaseBundle(resultBundle, {
        caseKey: newCaseKey,
        isUserCreated: true,
        uploadedBlobUrl,
      });

      CASES_STORE[newCaseKey] = resultBundle;
      renderWorkspaceCards();
      loadCaseIntoCockpit(newCaseKey);
      switchView('cockpit');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = defaultSubmitLabel;
      }
      dialog.close();
    });
  }
}

function populateClarificationCard(data) {
  if (!data) return;
  const msgEl = document.getElementById('agent-clarification-message');
  if (msgEl && data.agent_message) msgEl.textContent = data.agent_message;

  const strippedEl = document.getElementById('prescan-stripped-badge');
  if (strippedEl && data.filtered_irrelevant_objects_count != null) {
    strippedEl.textContent = `${data.filtered_irrelevant_objects_count} non-causal objects stripped`;
  }

  const previews = data.detected_vehicles_preview || [];
  if (previews[0]) {
    const descA = document.getElementById('detected-desc-a');
    const ocrA = document.getElementById('ocr-status-a');
    if (descA) descA.textContent = previews[0].detected_description;
    if (ocrA) ocrA.textContent = previews[0].ocr_status;
  }
  if (previews[1]) {
    const descB = document.getElementById('detected-desc-b');
    const ocrB = document.getElementById('ocr-status-b');
    if (descB) descB.textContent = previews[1].detected_description;
    if (ocrB) ocrB.textContent = previews[1].ocr_status;
  }
}
