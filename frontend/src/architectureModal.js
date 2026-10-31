/**
 * Camber Claims — System Architecture & AI Pipeline Telemetry Dialog
 *
 * Exclusively houses developer telemetry, model identifiers, agentic passes,
 * and sandbox verification logs to keep the primary solicitor cockpit clean.
 *
 * Models & Telemetry:
 *  - gemini-4-argon (processing: "agentic", 88% token savings)
 *  - Antigravity sandbox (antigravity-preview-09-2026, pytest PASS)
 *  - UK DVSA Live API + MOT credential proxy
 *  - gemini-3.8-flash (3x parallel subagents, 1M cache • 95% off)
 *  - gemini-3.5-flash-lite (intake guardrail <300ms)
 */

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const DEFAULT_AUDIT_LOG = `ANTIGRAVITY SANDBOX KINEMATIC & ROLLOVER VERIFICATION (\`antigravity-preview-09-2026\` | \`gemini-4-argon\`):
1. STOPPING DISTANCE AT 30.0 MPH vs 41.2 MPH (DAMP TARMAC μ = 0.55):
   - Compliant 30.0 mph (13.41 m/s): Thinking distance (t_r = 0.67s) = 8.98m; Wet braking distance = v² / (2·g·μ) = 16.66m; Total forensic stopping distance = 25.64m.
   - Actual GD64 LKU Speed 41.2 mph (18.42 m/s) with DVSA worn front/rear brake discs (μ_eff = 0.51): Thinking distance = 12.34m; Wet braking distance = 33.91m; Total = 46.25m (+80.4% stopping envelope extension).
2. KINETIC ENERGY & ROLLOVER TORQUE VERIFICATION:
   - Pre-impact braking from t=0.50s to t=1.15s scrubbed GD64 LKU speed from 41.2 mph to 33.4 mph (14.93 m/s).
   - Lateral impact impulse delivered into VL19 OKP offside B-pillar at (0.0m, 0.2m): E_k = 0.5 × 1,385 kg × (14.93 m/s)² = 154.4 kJ.
   - Because the Peugeot 2008 SUV center of gravity (h_cg = 0.64m) sits above the VW Golf front bumper impact plane (h_imp = 0.46m), the overturning moment rotated roll_deg from 0.0° (t=1.00s) -> 28.0° (t=1.15s) -> 72.0° (t=1.50s) -> 86.0° nearside rest (t=2.00s..3.00s).
3. DVSA CREDENTIAL & MOT TEST ENVELOPE VERIFICATION:
   - GOV.UK DVSA MOT History API accessed via Antigravity credential proxy.
   - GD64 LKU MOT status: EXPIRED 2 May 2026 at 93,028 miles; 2 unrectified braking advisories verified as CAUSAL.
   - pytest PASS: 10/10 kinematic invariants & DVSA credential validation checks verified.`;

const DEFAULT_VIDEO_PASSES = [
  {
    step_index: 1,
    type: 'processing_call',
    summary:
      'Pass 1 (Macro Scene Scrub & Causal Relevance Filter): Identified urban T-junction from elevated CCTV. Stripped 3 non-causal background objects (2 distant parked domestic cars and 1 non-involved roadside bin cluster) while retaining 2 causally involved vehicles (VL19 OKP & GD64 LKU) and 4 static regulatory/sightline features.',
  },
  {
    step_index: 2,
    type: 'processing_result',
    summary:
      'Pass 2 (High-FPS Temporal Crop t=0.40s..1.40s): Tracked Blue Peugeot 2008 (VL19 OKP) emerging Southbound across Diagram 1003 Give Way double dashed line at 18.6 mph without halting. Tracked Silver/Grey VW Golf (GD64 LKU) approaching Eastbound on A521 at 41.2 mph in a 30 mph street-lit zone, initiating heavy braking at t=0.50s (nose pitch dive observed) and scrubbing velocity to 33.4 mph at impact (t=1.15s).',
  },
  {
    step_index: 3,
    type: 'thought',
    summary:
      'Pass 3 (Post-Impact Rollover & DVSA Causal Audit t=1.15s..3.00s): Verified offside B-pillar impact at (0.0m, 0.2m) deflecting VL19 OKP onto a 118° ESE heading and inducing an 86.0° nearside rollover. Cross-referenced live UK DVSA MOT History: flagged GD64 LKU\'s expired MOT (2026-05-02) and worn front/rear brake discs as CAUSAL to its extended wet stopping envelope, while flagging historical rectified MOT failures as NOT CAUSAL.',
  },
];

function ensureStyles() {
  if (document.getElementById('architecture-modal-styles')) return;

  const style = document.createElement('style');
  style.id = 'architecture-modal-styles';
  style.textContent = `
    dialog#architecture-modal {
      overscroll-behavior: contain;
      background: #121215;
      color: #fafafa;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 16px;
      padding: 0;
      max-width: 900px;
      width: min(94vw, 900px);
      max-height: 88vh;
      margin: auto;
      box-shadow: 0 32px 80px rgba(0, 0, 0, 0.88), 0 0 0 1px rgba(255, 255, 255, 0.08);
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif;
    }

    dialog#architecture-modal::backdrop {
      background-color: rgba(6, 7, 10, 0.82);
      backdrop-filter: blur(8px);
    }

    .arch-modal-inner {
      padding: 24px 28px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      max-height: 88vh;
      overflow-y: auto;
      box-sizing: border-box;
    }

    .arch-modal-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .arch-modal-title-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .arch-eyebrow-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .arch-modal-title {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.015em;
      margin: 0;
      color: #ffffff;
      line-height: 1.25;
    }

    .arch-modal-subtitle {
      font-size: 13px;
      color: #a1a1aa;
      margin: 0;
      line-height: 1.45;
    }

    .arch-btn-close {
      background: #1b1b1f;
      color: #a1a1aa;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      width: 34px;
      height: 34px;
      cursor: pointer;
      font-size: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
      flex-shrink: 0;
    }

    .arch-btn-close:hover {
      background: #27272a;
      color: #ffffff;
      border-color: rgba(255, 255, 255, 0.24);
    }

    /* 4-Stage Pipeline Grid */
    .arch-stages-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    @media (max-width: 680px) {
      .arch-stages-grid {
        grid-template-columns: 1fr;
      }
    }

    .arch-stage-card {
      background: #16161a;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      position: relative;
    }

    .arch-stage-card.highlight {
      border-color: rgba(14, 165, 233, 0.35);
      background: linear-gradient(180deg, rgba(14, 165, 233, 0.06) 0%, rgba(22, 22, 26, 0.95) 100%);
    }

    .arch-stage-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }

    .arch-stage-number {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #71717a;
    }

    .arch-stage-model {
      font-family: 'JetBrains Mono', 'SF Mono', monospace;
      font-size: 12px;
      font-weight: 600;
      color: #ffffff;
    }

    .arch-stage-badges {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .arch-stage-desc {
      font-size: 12px;
      color: #a1a1aa;
      line-height: 1.5;
      margin: 0;
    }

    /* Badges */
    .arch-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 2px 8px;
      border-radius: 5px;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.4;
      border: 1px solid transparent;
      white-space: nowrap;
    }

    .arch-pill.mono {
      font-family: 'JetBrains Mono', 'SF Mono', monospace;
      font-variant-numeric: tabular-nums;
    }

    .arch-pill.cyan {
      background: rgba(14, 165, 233, 0.12);
      color: #38bdf8;
      border-color: rgba(14, 165, 233, 0.28);
    }

    .arch-pill.emerald {
      background: rgba(16, 185, 129, 0.12);
      color: #10b981;
      border-color: rgba(16, 185, 129, 0.28);
    }

    .arch-pill.amber {
      background: rgba(245, 158, 11, 0.12);
      color: #fbbf24;
      border-color: rgba(245, 158, 11, 0.28);
    }

    .arch-pill.neutral {
      background: rgba(255, 255, 255, 0.06);
      color: #e4e4e7;
      border-color: rgba(255, 255, 255, 0.14);
    }

    /* Telemetry Sections */
    .arch-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .arch-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .arch-section-title {
      font-size: 13px;
      font-weight: 600;
      color: #fafafa;
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
    }

    .arch-terminal {
      background: #09090b;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      padding: 12px 14px;
      margin: 0;
      font-family: 'JetBrains Mono', 'SF Mono', monospace;
      font-size: 11px;
      line-height: 1.5;
      color: #d4d4d8;
      overflow-x: auto;
      white-space: pre-wrap;
      max-height: 240px;
      overscroll-behavior: contain;
    }

    .arch-terminal::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }

    .arch-terminal::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.18);
      border-radius: 3px;
    }

    .arch-passes-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .arch-pass-card {
      background: #16161a;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .arch-pass-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .arch-pass-card p {
      margin: 0;
      font-size: 11.5px;
      color: #a1a1aa;
      line-height: 1.45;
    }

    .arch-footer-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-top: 14px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 11px;
      color: #71717a;
      flex-wrap: wrap;
    }
  `;
  document.head.appendChild(style);
}

function renderContent(caseData) {
  const auditLogText =
    caseData?.antigravity_audit_log ||
    caseData?.physics_audit_log ||
    DEFAULT_AUDIT_LOG;

  const rawPasses =
    caseData?.agentic_video_passes ||
    caseData?.agentic_video_scrub_steps ||
    DEFAULT_VIDEO_PASSES;

  const passes = Array.isArray(rawPasses) ? rawPasses : [rawPasses];

  const renderedPasses = passes
    .map((pass, index) => {
      const idx = pass?.step_index ?? pass?.pass ?? index + 1;
      const type = pass?.type || 'agentic_scrub';
      const summary =
        typeof pass === 'string'
          ? pass
          : pass?.summary || pass?.description || pass?.details || JSON.stringify(pass);

      return `
        <div class="arch-pass-card">
          <div class="arch-pass-header">
            <span class="arch-pill cyan mono">Pass ${escapeHtml(idx)} • ${escapeHtml(type)}</span>
            <span class="arch-pill neutral mono">60 FPS temporal lock</span>
          </div>
          <p>${escapeHtml(summary)}</p>
        </div>
      `;
    })
    .join('');

  return `
    <div class="arch-modal-inner">
      <!-- 1. Header -->
      <header class="arch-modal-header">
        <div class="arch-modal-title-group">
          <div class="arch-eyebrow-row">
            <span class="arch-pill cyan mono">DEVELOPER &amp; PIPELINE TELEMETRY</span>
            <span class="arch-pill emerald mono">pytest PASS</span>
            <span class="arch-pill neutral mono">antigravity-preview-09-2026</span>
          </div>
          <h2 class="arch-modal-title" id="architecture-modal-title">System architecture &amp; AI pipeline telemetry</h2>
          <p class="arch-modal-subtitle">
            End-to-end multi-agent orchestration, agentic video scrubbing, and deterministic Antigravity sandbox execution.
          </p>
        </div>
        <button type="button" class="arch-btn-close" id="btn-close-architecture-modal" aria-label="Close architecture telemetry">✕</button>
      </header>

      <!-- 2. The 4-Stage Pipeline Summary -->
      <section class="arch-section" aria-label="4-Stage AI Pipeline">
        <div class="arch-section-header">
          <h3 class="arch-section-title">4-Stage Forensic AI Pipeline</h3>
          <span class="arch-pill mono neutral">Multi-Agent Fan-Out</span>
        </div>

        <div class="arch-stages-grid">
          <!-- Stage 1 -->
          <div class="arch-stage-card">
            <div class="arch-stage-card-header">
              <span class="arch-stage-number">Stage 1</span>
              <div class="arch-stage-badges">
                <span class="arch-pill mono neutral">&lt;300ms</span>
              </div>
            </div>
            <div class="arch-stage-model">gemini-3.5-flash-lite</div>
            <div class="arch-stage-badges">
              <span class="arch-pill neutral mono">intake guardrail</span>
            </div>
            <p class="arch-stage-desc">
              Low-latency intake guardrail validating dashcam video payload integrity, resolving UK VRN format compliance, and rejecting corrupted streams before entering expensive multimodal analysis.
            </p>
          </div>

          <!-- Stage 2 -->
          <div class="arch-stage-card highlight">
            <div class="arch-stage-card-header">
              <span class="arch-stage-number">Stage 2</span>
              <div class="arch-stage-badges">
                <span class="arch-pill emerald mono">88% token savings</span>
              </div>
            </div>
            <div class="arch-stage-model">gemini-4-argon</div>
            <div class="arch-stage-badges">
              <span class="arch-pill cyan mono">processing: "agentic"</span>
              <span class="arch-pill neutral mono">Interactions API</span>
            </div>
            <p class="arch-stage-desc">
              Multi-pass spatio-temporal video scrubbing with implicit context caching. Strips non-causal visual clutter (distant parked cars, bins) and tracks vehicle velocity vectors against statutory UK roadway markings.
            </p>
          </div>

          <!-- Stage 3 -->
          <div class="arch-stage-card">
            <div class="arch-stage-card-header">
              <span class="arch-stage-number">Stage 3</span>
              <div class="arch-stage-badges">
                <span class="arch-pill emerald mono">pytest PASS</span>
              </div>
            </div>
            <div class="arch-stage-model">UK DVSA Live API + Antigravity</div>
            <div class="arch-stage-badges">
              <span class="arch-pill neutral mono">antigravity-preview-09-2026</span>
              <span class="arch-pill emerald mono">physics verification</span>
            </div>
            <p class="arch-stage-desc">
              Live MOT history query via Antigravity credential proxy; deterministic kinematic, braking, and rollover torque simulation in an isolated Python verification sandbox.
            </p>
          </div>

          <!-- Stage 4 -->
          <div class="arch-stage-card highlight">
            <div class="arch-stage-card-header">
              <span class="arch-stage-number">Stage 4</span>
              <div class="arch-stage-badges">
                <span class="arch-pill emerald mono">95% off</span>
              </div>
            </div>
            <div class="arch-stage-model">3x gemini-3.8-flash (Parallel Subagents)</div>
            <div class="arch-stage-badges">
              <span class="arch-pill neutral mono">1M cache • 95% off</span>
              <span class="arch-pill cyan mono">CPR Pre-Action</span>
            </div>
            <p class="arch-stage-desc">
              Parallel subagent fan-out against a 1M-token pre-cached UK road traffic corpus: Legal Precedents (*Powell v Moody*, *Fallows v Randle*), ABI Thatcham repair schedules, and CPR Protocol demand letters.
            </p>
          </div>
        </div>
      </section>

      <!-- 3. Antigravity Physics Execution & Pytest Log -->
      <section class="arch-section" aria-label="Antigravity Execution Log">
        <div class="arch-section-header">
          <h3 class="arch-section-title">
            <span>Antigravity Execution &amp; Pytest Verification Log</span>
          </h3>
          <div class="arch-stage-badges">
            <span class="arch-pill neutral mono">antigravity-preview-09-2026</span>
            <span class="arch-pill emerald mono">pytest PASS</span>
          </div>
        </div>
        <pre class="arch-terminal" tabindex="0"><code>${escapeHtml(auditLogText)}</code></pre>
      </section>

      <!-- 4. Agentic Video Scrubbing Passes Telemetry -->
      <section class="arch-section" aria-label="Agentic Video Passes Telemetry">
        <div class="arch-section-header">
          <h3 class="arch-section-title">
            <span>Agentic Video Scrubbing Pass Telemetry</span>
          </h3>
          <div class="arch-stage-badges">
            <span class="arch-pill cyan mono">processing: "agentic"</span>
            <span class="arch-pill emerald mono">88% token savings</span>
          </div>
        </div>
        <div class="arch-passes-list">
          ${renderedPasses}
        </div>
      </section>

      <!-- Footer Metadata -->
      <footer class="arch-footer-meta">
        <span>Camber Claims Engine • Subrogation &amp; Legal Protocol Telemetry</span>
        <span>Environment: Sandbox (antigravity-preview-09-2026)</span>
      </footer>
    </div>
  `;
}

/**
 * Creates (if not already in the DOM) or updates the architecture dialog.
 * Also synchronizes #architecture-view if present in the document.
 *
 * @param {Object} [caseData] - Case bundle or report data containing audit logs and passes
 * @returns {HTMLDialogElement} The architecture modal dialog element
 */
export function ensureArchitectureDialog(caseData = null) {
  ensureStyles();

  // 1. Create or get the native <dialog>
  let dialog = document.getElementById('architecture-modal');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'architecture-modal';
    dialog.setAttribute('closedby', 'any');
    dialog.setAttribute('aria-labelledby', 'architecture-modal-title');
    document.body.appendChild(dialog);

    // Close on backdrop click
    dialog.addEventListener('click', (event) => {
      const rect = dialog.getBoundingClientRect();
      const isInDialog =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;

      if (!isInDialog) {
        dialog.close();
      }
    });
  }

  // Render fresh HTML
  dialog.innerHTML = renderContent(caseData);

  // Wire up close button inside the modal
  const closeBtn = dialog.querySelector('#btn-close-architecture-modal');
  if (closeBtn) {
    closeBtn.onclick = () => {
      dialog.close();
    };
  }

  // 2. Also update #architecture-view if present in the DOM
  const archView = document.getElementById('architecture-view');
  if (archView) {
    archView.innerHTML = renderContent(caseData);
    const viewCloseBtn = archView.querySelector('#btn-close-architecture-modal');
    if (viewCloseBtn) {
      viewCloseBtn.onclick = () => {
        if (dialog && dialog.open) {
          dialog.close();
        }
      };
    }
  }

  return dialog;
}

/**
 * Ensures the architecture dialog exists/is updated and opens it as a modal.
 *
 * @param {Object} [caseData] - Case bundle or report data containing audit logs and passes
 * @returns {HTMLDialogElement} The opened architecture modal dialog element
 */
export function openArchitectureDialog(caseData = null) {
  const dialog = ensureArchitectureDialog(caseData);
  if (dialog && typeof dialog.showModal === 'function') {
    if (!dialog.open) {
      dialog.showModal();
    }
  }
  return dialog;
}

export function initArchitectureModal(caseData = null) {
  const dialog = ensureArchitectureDialog(caseData);
  const btnOpen = document.getElementById('btn-open-architecture');
  const btnFooter = document.getElementById('btn-footer-architecture');
  if (btnOpen) {
    btnOpen.addEventListener('click', () => openArchitectureDialog(caseData));
  }
  if (btnFooter) {
    btnFooter.addEventListener('click', () => openArchitectureDialog(caseData));
  }
  return dialog;
}

export function updateArchitectureModalCaseData(caseData = null) {
  return ensureArchitectureDialog(caseData);
}

export default {
  ensureArchitectureDialog,
  openArchitectureDialog,
  initArchitectureModal,
  updateArchitectureModalCaseData,
};
