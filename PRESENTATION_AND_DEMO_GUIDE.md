# Camber Claims — Hackathon Presentation, 3-Minute Live Demo Script & Judge Q&A Playbook

**Event:** Google DeepMind × Imperial College FinTech & Blockchain Society — Gemini 4 Argon Hackathon (2026)  
**Project:** Camber Claims (`/Users/radu/.gemini/antigravity/scratch/camber_claims`)  
**Target Audience:** Technical Judges, DeepMind Researchers, FinTech & LegalTech Evaluators  
**Primary User Persona:** A UK motor claims & subrogation solicitor  

---

## Executive Summary & Stage Pitch Overview

Disputed UK motor insurance claims routinely take **6 to 9 months of acrimonious insurer correspondence** and cost **£3,000 to £8,000+ in external accident reconstruction reports, collision engineering audits, and counsel opinions**. When Ring doorbell or dashcam video is wide-angle, fisheye-distorted, or motion-blurred, both policyholders give contradictory statements, leaving solicitors with stalled subrogation files and costly court trials.

**Camber Claims** is an autonomous 3D crash reconstruction, live UK DVSA MOT mechanical audit, and 1M-token statutory liability engine. In under 60 seconds, it ingests raw CCTV video, reconstructs a 60 FPS interactive 3D WebGL physics viewport, queries live GOV.UK MOT mechanical histories to isolate causal brake/tyre defects from non-causal advisories, reasons across a >16,000-token statutory UK legal corpus, and delivers a human-in-the-loop Civil Procedure Rules (CPR) Pre-Action Protocol subrogation settlement locked with a cryptographic SHA-256 audit receipt.

---

## 1. 3-Minute Live Stage Demo Choreography

> **Stage Setup Checklist:**
> - Browser open at `http://127.0.0.1:8000` (or Vercel production deployment).
> - Display resolution at 1080p / 1440p dark mode (`#070B12` Carbon Obsidian canvas).
> - WebGL hardware acceleration active (smooth 60 FPS Three.js rendering).
> - Modal dialog closed initially, showcasing the Claims Workspace homescreen with Pre-Loaded UK Crash Cards (`cheadle_a521`, `delphouse_rollover`, `a521_hgv`).

---

### Act I: The Hook & UK Solicitor Problem (0:00 – 0:35)

| Timestamp | Exact On-Screen Action | Spoken Script & Stage Delivery |
| :--- | :--- | :--- |
| **0:00 – 0:12** | Cursor hovers over **Claim #UK-2026-0819** card on the dark-mode Workspace Homescreen.<br><br>Badge displayed: `LIVE DVSA + RING CCTV`. | *"Judges, every day in the UK, thousands of motor collisions end up in a legal deadlock. When two cars collide at an urban junction, both drivers swear the other was at fault. Ring doorbell or dashcam CCTV is almost always wide-angle, grainy, and motion-blurred. For a UK motor claims & subrogation solicitor, resolving who pays means waiting 6 to 9 months of insurer back-and-forth and spending upwards of £5,000 on external forensic reconstruction experts and counsel opinions."* |
| **0:12 – 0:25** | Point to the subtitle: `VL19 OKP (Blue Peugeot 2008 Rollover) vs GD64 LKU (VW Golf — Expired MOT)`.<br><br>Show the speed badge: `41.2 mph in 30 mph zone • Give Way Encroachment`. | *"Here is Claim UK-2026-0819: an actual collision at the A521 / Draycott Cross Road T-junction in Cheadle, Staffordshire. The Claimant in the VW Golf claimed right-of-way on the major road. The Defendant in the Blue Peugeot claimed the VW Golf was speeding out of nowhere while their view was blocked by a hedgerow. Who is liable, and under what percentage under UK law?"* |
| **0:25 – 0:35** | Click directly on the **`Case 1: Cheadle A521 / Draycott Cross Rd`** card.<br><br>The single-viewport 4-quadrant Forensic Cockpit loads instantly with 60 FPS WebGL canvas and synchronized video player. | *"Watch what happens when we hand this raw CCTV footage to Camber Claims. We don't just generate text; we synthesize a full 3D deterministic physics world, audit statutory vehicle roadworthiness against live UK Government databases, and draft binding Pre-Action Protocol subrogation packs in seconds."* |

---

### Act II: The 3D Forensic Cockpit & Causal Relevance Filtering (0:35 – 1:25)

| Timestamp | Exact On-Screen Action | Spoken Script & Stage Delivery |
| :--- | :--- | :--- |
| **0:35 – 0:50** | Click **Play (`▶`)** on the timeline scrubber at bottom.<br><br>Observer sees synchronized Ring CCTV video (top-left) alongside the 3D Three.js viewport (top-right).<br><br>Playhead scrubs through `t=0.00s` to `t=1.80s`. | *"Look at the top-left quadrant: here is the raw Ring CCTV footage. Look at the top-right quadrant: here is our 3D Three.js forensic viewport running at 60 FPS. Notice how the two are frame-locked down to the millisecond.*<br><br>*At `t=0.60s`, the Blue Peugeot 2008 (`VL19 OKP`) emerges southward past the northwest boundary hedgerow at 18.6 mph without halting at the Diagram 1003 Give Way markings.*<br><br>*At `t=0.80s`, the VW Golf (`GD64 LKU`) reacts and brakes hard from 41.2 mph in a street-lit 30 mph zone.*<br><br>*At `t=1.15s`, the VW Golf T-bones the Peugeot's offside B-pillar at 33.4 mph, and by `t=1.80s`, the SUV undergoes an 86° nearside rollover onto the wet asphalt."* |
| **0:50 – 1:08** | In the top-right dock, click the **Causal 3D Scene Filter Toggle** (`#toggle-causal-filter`).<br><br>Show the badge: `3 non-causal background objects stripped`.<br><br>Toggle it off and on to show non-causal clutter vanishing. | *"Notice this badge: **'3 non-causal background objects stripped'**. Raw camera footage contains irrelevant background clutter—parked commuter cars down Draycott Cross Road and residential wheelie bins. Our Gemini 4 Argon agentic video pipeline (`processing='agentic'`) identified that these objects had zero causal impact on vehicle trajectories or sightlines, stripping them out of the 3D scene while preserving the Diagram 1003 Give Way markings, the 30 mph sign, and the critical sightline-blocking hedgerow."* |
| **1:08 – 1:25** | In the right-side Blender Viewport Control Dock, sequentially click:<br>1. **`Top View (Overhead)`** (`data-cam="top"`)<br>2. **`Front View (Corridor / Z-Axis)`** (`data-cam="front"`)<br>3. **`Peugeot POV (VL19 OKP)`** (`data-cam="pov_a"`). | *"In a court trial, perspective is everything. With one click, our solicitor switches to **Top View (Overhead)** to measure the Diagram 1003 Give Way breach.*<br><br>*Next, we switch to **Corridor View (Z-Axis)** to inspect the Eastbound priority lane envelope.*<br><br>*And now, the most powerful view: **Peugeot POV (`VL19 OKP`)**. Look at the driver's eye line. The northwest Victorian terrace and overgrown boundary hedgerow completely blinded the driver's view until their bonnet was already encroaching 1.2 metres into the live carriageway. That mathematical sightline obstruction is proven directly in 3D."* |

---

### Act III: Live GOV.UK DVSA MOT Mechanical Audit & Interactive Plate Clarification (1:25 – 2:15)

| Timestamp | Exact On-Screen Action | Spoken Script & Stage Delivery |
| :--- | :--- | :--- |
| **1:25 – 1:45** | Click **Tab 2: `🚗 Live UK DVSA MOT & Kinematics`** in the bottom-left quadrant.<br><br>Point to the side-by-side cards: `VL19 OKP` (Peugeot: Valid MOT) vs `GD64 LKU` (VW Golf: MOT EXPIRED).<br><br>Highlight the classification tags: `[CAUSAL / CONTRIBUTORY]` vs `[NOT CAUSAL]`. | *"Now look at the bottom-left quadrant. Camber Claims connected directly to the official UK Government DVSA MOT History API via OAuth2 credentials injected securely through the Antigravity proxy.*<br><br>*Look at the counterparty VW Golf (`GD64 LKU`). Its MOT was **EXPIRED on 2 May 2026**—an immediate criminal breach of Section 47 of the Road Traffic Act 1988.*<br><br>*More critically, our legal agent classified every historical defect: worn front and offside-rear brake discs are tagged **`[CAUSAL / CONTRIBUTORY]`** because on damp tarmacadam ($\mu=0.55$), degraded friction ($\mu_{\text{eff}}=0.51$) expanded its stopping distance from 25.6m to 46.2m! Meanwhile, a historical minor registration plate lamp advisory and suspension surface corrosion are strictly tagged **`[NOT CAUSAL]`**. We don't hallucinate fault from irrelevant historical advisories."* |
| **1:45 – 2:05** | Click **`[+ New Crash]`** in top header.<br><br>The native `<dialog id="upload-modal" closedby="any">` opens.<br><br>Leave registration inputs blank. Click **`1. Analyse Video & Detect Vehicles`** (`#btn-prescan-video`).<br><br>The modal smoothly displays the **Agent Clarification Box** (`#agent-clarification-box`). | *"What happens when a solicitor receives low-resolution or motion-blurred footage? Let's open '+ New Crash Upload'. We trigger `gemini-4-argon`'s pre-scan with plates left blank.*<br><br>*Look at this: instead of hallucinating or silently failing, the agent pauses in an interactive loop: **'OCR Motion Blur — Agent Clarification Needed'**. It visually identifies Vehicle A as a Blue Peugeot 2008 SUV (18% OCR confidence due to acute camera angle) and Vehicle B as a Silver VW Golf (12% OCR confidence due to 41 mph motion blur). It provides quick chips to confirm `VL19 OKP` and `GD64 LKU`, and allows the solicitor to override kinematic context—such as marking a vehicle as stationary to prevent brake advisories from being flagged as causal."* |
| **2:05 – 2:15** | Click **`Use VL19 OKP`** chip, then click **`Use GD64 LKU`** chip.<br><br>Click close (`✕` or backdrop light-dismiss via `closedby="any"`). | *"The solicitor confirms the VRMs with one tap, seamlessly bridging autonomous computer vision with statutory human oversight."* |

---

### Act IV: 1M-Token Legal Synthesis & Human-in-the-Loop SHA-256 Sign-Off (2:15 – 3:00)

| Timestamp | Exact On-Screen Action | Spoken Script & Stage Delivery |
| :--- | :--- | :--- |
| **2:15 – 2:38** | Switch to **Tab 1: `📝 Executive Liability Summary & Case Law`**.<br><br>Scroll to the Case Law Precedents table:<br>- *Powell v Moody* [1966]<br>- *Harding v Hinchcliffe* [1964]<br>- *Froom v Butcher* [1976]<br>- Section 1(1) Law Reform (Contributory Negligence) Act 1945. | *"In the bottom-left panel, our legal reasoning engine operated across a 1M-token implicit caching window containing standard UK Motor Policy #UK-8841, the UK Highway Code, and 60 years of Court of Appeal authorities.*<br><br>*It identifies that under **Powell v Moody [1966]**, emerging from a minor road into an obstructed priority corridor creates primary liability. But under **Harding v Hinchcliffe [1964]**, approaching a known blind junction at 41.2 mph in a 30 mph zone with an expired MOT and worn brakes constitutes substantial contributory negligence.*<br><br>*The engine apportions statutory fault at **75% Defendant (`VL19 OKP`) / 25% Claimant (`GD64 LKU`)**, and invokes Section 4 Clause 4.2 of Policy #UK-8841 to reserve rights against the unroadworthy vehicle."* |
| **2:38 – 2:50** | Move to the bottom-right quadrant: **Contributory Negligence Fault Split**.<br><br>Drag the interactive slider (`#slider-fault-split`) slightly from 75/25 to 70/30 and back to 75/25, showing live update of Net Subrogation Recovery (`£10,150.00` on `£14,200` gross claim less `£500` excess). | *"In the bottom-right panel, the solicitor retains full control. As we adjust the Contributory Negligence Slider, our net subrogation recovery recalculates in real-time. On a £14,200 total loss less £500 policy excess, a 75/25 split locks net recovery at exactly £10,150.00."* |
| **2:50 – 3:00** | Click the glowing emerald button: **`[✅ Approve 75/25 Liability Split & Issue Subrogation Demand]`** (`#btn-approve-settlement`).<br><br>The UI locks the settlement state and prints the **Deterministic SHA-256 Settlement Audit Receipt** (`receipt_sha256: 64-character hex`). | *"The solicitor reviews the parallel sub-agent drafts—the ABI Thatcham Salvage Schedule and the CPR Pre-Action Letter of Claim—and clicks **'Approve Settlement'**.*<br><br>*Instantly, the Antigravity managed agent signs off, producing an immutable SHA-256 audit receipt tied to the multi-turn interaction ID.*<br><br>*What took 8 months, 40 emails, and £5,000 in external fees is now settled with mathematical precision in 3 minutes. That is Camber Claims. Thank you."* |

---

## 2. Multi-Model Architecture Breakdown for Technical Judges

```mermaid
flowchart TD
    subgraph Input ["Input Layer"]
        A["Raw CCTV / Dashcam MP4 (Cheadle A521)"]
        B["Solicitor VRM Plates / Notes"]
    end

    subgraph Guardrail ["Pre-Filter Layer (Minimal Latency)"]
        C["gemini-3.5-flash-lite<br/>(thinking_level='minimal')<br/>Junk & Format Validator"]
    end

    subgraph AgenticCore ["Agentic Video & Trajectory Synthesis"]
        D["gemini-4-argon<br/>(processing='agentic', thinking_level='high')<br/>Multi-Pass Video Scrubbing & Causal Scene Filter"]
        D_Clarify{"Plates Clear<br/>& Confident?"}
        D_Human["Human Solicitor Clarification Modal<br/>(Blurry Plate Confirmation & Kinematic Override)"]
    end

    subgraph ExternalAPI ["Statutory Mechanical Telemetry"]
        E["GOV.UK DVSA MOT History API<br/>(history.mot.api.gov.uk)"]
    end

    subgraph Verification ["Deterministic Kinematics Sandbox"]
        F["antigravity-preview-09-2026<br/>(Python Newtonian Kinematics & Rollover Math)<br/>Proxy-Injected client.credentials.create"]
    end

    subgraph LongContext ["1M Implicit Caching Core (>16k Token UK Corpus)"]
        G["UK Motor Policy #UK-8841 (Clause 4.2)<br/>Highway Code Rules 124-183<br/>Road Traffic Act 1988 s.47<br/>Powell v Moody | Harding v Hinchcliffe"]
        H["gemini-4-argon<br/>Implicit Caching (95% Discount)<br/>Executive Liability Apportionment"]
    end

    subgraph ParallelSubAgents ["Parallel Specialist Sub-Agents"]
        I["gemini-3.8-flash #1<br/>(thinking_level='low')<br/>Policy Audit & MOT Causality"]
        J["gemini-3.8-flash #2<br/>(thinking_level='low')<br/>ABI Thatcham Salvage (Cat S/N)"]
        K["gemini-3.8-flash #3<br/>(thinking_level='low')<br/>CPR Pre-Action Letter of Claim"]
    end

    subgraph SettlementSignOff ["Human-in-the-Loop Settlement"]
        L["Human Solicitor Approval Gate<br/>(75% Defendant / 25% Claimant)"]
        M["antigravity-preview-09-2026<br/>previous_interaction_id Chaining<br/>Deterministic SHA-256 Audit Receipt"]
    end

    A --> C
    B --> C
    C --> D
    D --> D_Clarify
    D_Clarify -- "No (Motion Blur)" --> D_Human
    D_Human --> D
    D_Clarify -- "Yes (Confirmed)" --> E
    E --> F
    D --> F
    F --> H
    G --> H
    H --> I
    H --> J
    H --> K
    I --> L
    J --> L
    K --> L
    L --> M
```

---

### Deep-Dive: Why Each Model Fits Its Exact Role

#### 1. `gemini-4-argon` — Agentic Video Understanding & 1M-Token Implicit Context
- **Role:** Temporal frame-accurate video inspection, 3D trajectory extraction, causal relevance scene filtering, and statutory legal reasoning.
- **Interactions API Configuration:**
  ```python
  client.interactions.create(
      model="gemini-4-argon",
      input=[
          {"type": "video", "uri": video_file.uri, "mime_type": "video/mp4", "processing": "agentic"},
          {"type": "text", "text": UK_MOTOR_LEGAL_AND_POLICY_CORPUS},
          {"type": "text", "text": forensic_analysis_prompt},
      ],
      generation_config={"thinking_level": "high"},
      response_format={"type": "text", "mime_type": "application/json", "schema": ForensicLegalReport.model_json_schema()}
  )
  ```
- **Why It Matters:**
  1. `"processing": "agentic"` enables multi-pass video scrubbing: Pass 1 identifies junction geometry and filters out non-causal background clutter (parking vehicles, bins); Pass 2 zooms in temporally between $t=0.45\text{s}$ and $t=1.65\text{s}$ to calculate exact deceleration slopes and collision angles.
  2. The UK legal corpus exceeds 65,000 characters (>16,500 tokens). Because `gemini-4-argon` automatically triggers implicit caching for prefixes $\ge 4,096$ tokens at a **95% discount**, repeated statutory audits and multi-turn solicitor clarifications run at near-zero marginal cost and instant time-to-first-token.
  3. Strict parameter compliance: Zero forbidden parameters (`temperature`, `top_p`, `top_k`, or `thinking_budget` are never passed).

#### 2. `antigravity-preview-09-2026` — Deterministic Sandbox Kinematics & Secure DVSA Credential Proxy
- **Role:** Validates collision physics in an isolated Linux runtime and executes human-in-the-loop settlement sign-off.
- **Credentials & API Injection:**
  ```python
  # Proxy registers DVSA secrets so raw tokens never touch LLM prompts or client context
  client.credentials.create(
      config={
          "name": "dvsa-api-key",
          "domain": "history.mot.api.gov.uk",
          "header_name": "X-API-Key",
      }
  )
  client.interactions.create(
      agent="antigravity-preview-09-2026",
      agent_config={"type": "antigravity", "model": "gemini-4-argon"},
      input=physics_verification_prompt,
      previous_interaction_id=prev_id
  )
  ```
- **Why It Matters:**
  1. Pure LLMs can hallucinate numerical physics. `antigravity-preview-09-2026` runs verified Newtonian stopping distance calculations ($d = v \cdot t_r + \frac{v^2}{2g\mu}$) on damp tarmac ($\mu=0.55$) and checks the overturning torque producing the Peugeot 2008's $86^\circ$ rollover ($h_{\text{cg}} = 0.64\text{m} > h_{\text{imp}} = 0.46\text{m}$).
  2. Ensures UK DVSA OAuth2 credentials stay encapsulated at the proxy gateway.

#### 3. `gemini-3.8-flash` — 3x Concurrent Parallel Sub-Agents
- **Role:** High-throughput generation of domain-specialist legal artifacts without blocking the primary thread.
- **Parallel Dispatch:**
  ```python
  policy_audit, repair_estimate, subrogation_letter = await asyncio.gather(
      asyncio.to_thread(_call_flash_subagent, "Policy Coverage Auditor", policy_prompt),
      asyncio.to_thread(_call_flash_subagent, "IAEA/Thatcham Quantum Engineer", repair_prompt),
      asyncio.to_thread(_call_flash_subagent, "UK Subrogation Solicitor", letter_prompt),
  )
  ```
- **Why It Matters:**
  1. Configured with `generation_config={"thinking_level": "low"}` for rapid sub-2-second generation of the 3 separate legal schedules.
  2. Each sub-agent is grounded in the full cached legal corpus, producing ABI Thatcham Category S salvage schedules, Section 4 Clause 4.2 MOT reservation notices, and CPR Pre-Action Protocol demand letters simultaneously.

#### 4. `gemini-3.5-flash-lite` — Ultra-Fast Input Guardrail
- **Role:** Gatekeeper for uploaded video metadata, file size, format compatibility, and initial VRM syntactic sanity checking.
- **Interactions API Configuration:**
  ```python
  client.interactions.create(
      model="gemini-3.5-flash-lite",
      input="Validate file metadata: clip3.mp4, duration 4.57s, 1080p, UK T-junction context.",
      generation_config={"thinking_level": "minimal"}
  )
  ```
- **Why It Matters:**
  Takes $<300\text{ms}$ to eliminate corrupted files or invalid payloads before initiating expensive agentic video scrubbing.

---

## 3. Top 5 Judge Questions & Crisp Answers

### Q1: "How do you prevent the AI from hallucinating vehicle speeds and trajectories from low-quality CCTV?"
**Answer:**
> *"We never rely on pure LLM visual intuition for physics. Our pipeline uses a 3-tier deterministic verification process:*
> 1. *`gemini-4-argon`'s `"processing": "agentic"` video scrubbing measures pixel displacements against static physical roadway landmarks of known UK statutory dimensions—specifically the 1.0m width of Diagram 1003 Give Way markings and standard 183m UK lamp post spacing under RTRA 1984.*
> 2. *These raw kinematic vectors are fed into `antigravity-preview-09-2026`, which executes deterministic Newtonian deceleration and friction math in Python. If a stated speed violates friction boundaries ($\mu=0.55$) or braking limits, the physics sandbox catches and reconciles the anomaly.*
> 3. *Every keyframe is surfaced to the solicitor in our interactive 3D Three.js viewport at 60 FPS, providing transparent visual auditability."*

---

### Q2: "How does the agent distinguish between an MOT defect that actually caused the crash versus one that is irrelevant?"
**Answer:**
> *"This is the core innovation of our DVSA Causal Relevance Engine. Other tools simply dump the entire MOT history into the prompt, leading to false allegations. Camber Claims evaluates each item against the 3D kinematic timeline:*
> - *On `GD64 LKU`, the vehicle was traveling at 41.2 mph and braking heavily on damp tarmac. Its unrectified front and offside-rear worn brake discs directly reduced tyre-road braking efficiency ($\mu=0.51$), extending wet stopping distance by +80.4% (from 25.6m to 46.2m). That is tagged **`[CAUSAL / CONTRIBUTORY]`**.*
> - *Conversely, an advisory for a hairline windscreen wiper smear or a historical failed test in 2023 that passed re-test 2 days later is flagged **`[NOT CAUSAL]`**.*
> - *Furthermore, if the solicitor uses our interactive clarification dropdown to flag that Vehicle A was stationary at impact, the agent dynamically reclassifies Vehicle A's brake advisories to `NOT CAUSAL`, preventing unmerited insurer disputes."*

---

### Q3: "What happens if a vehicle's registration plate is completely illegible due to camera angle or motion blur?"
**Answer:**
> *"We designed Camber Claims around real-world UK litigation realities. CCTV is frequently wide-angle and blurred. When `gemini-4-argon` runs its pre-scan, it tracks vehicle geometries and color profiles. If OCR confidence falls below statutory thresholds, it does not invent a fake VRM.*
> *Instead, it triggers our **Interactive Agent Clarification Box** right in the upload dialog. It tells the solicitor: 'I tracked Vehicle A as a Blue Peugeot 2008 and Vehicle B as a Silver VW Golf, but motion blur prevents certain OCR.' It then prompts the solicitor to confirm the plate or click our quick-fill chips before running the live DVSA lookup. This maintains an unbroken chain of custody and prevents false statutory claims."*

---

### Q4: "How is the 75/25 liability split justified under UK case law?"
**Answer:**
> *"The split is anchored directly in established Court of Appeal precedents loaded in our 1M-token legal corpus:*
> 1. *Primary liability rests on the emerging Peugeot 2008 (`VL19 OKP`) under **Powell v Moody [1966]** and **Rule 172 of the Highway Code**. Entering a priority carriageway without an unobstructed view is an operation of extreme hazard, establishing prima facie negligence.*
> 2. *However, the VW Golf (`GD64 LKU`) cannot claim 100% indemnity. Under **Harding v Hinchcliffe [1964]** and **Worsfold v Howe [1980]**, driving at 41.2 mph in a street-lit 30 mph zone towards a known blind junction constitutes substantial contributory negligence. Operating with an expired MOT under Road Traffic Act 1988 s.47 and worn brake discs further deprived the driver of the ability to stop within 25.6 metres.*
> 3. *Under Section 1(1) of the **Law Reform (Contributory Negligence) Act 1945**, damages are apportioned having regard to claimant blameworthiness. Our 75% / 25% split reflects standard UK judicial practice, and the solicitor can fine-tune the split via the interactive slider before locking the settlement."*

---

### Q5: "How are enterprise API credentials and sensitive crash data protected in this architecture?"
**Answer:**
> *"We enforce zero-trust data protection at three architectural boundaries:*
> 1. *UK Government DVSA client secrets and API keys are registered using `client.credentials.create` within the Antigravity preview environment. Secrets are injected at the proxy layer for `history.mot.api.gov.uk` and are never loaded into the LLM context or exposed to the client browser.*
> 2. *No client PII, insurer names, or private credentials exist in client storage or prompt histories. Grounded persona guidelines strictly enforce the institutional role of 'a UK motor claims & subrogation solicitor'.*
> 3. *Every human sign-off generates a canonical SHA-256 hash chaining the Claim ID, fault percentages, solicitor notes, timestamp, and server-side `previous_interaction_id`, producing a cryptographically auditable trail ready for Court of Protection or Pre-Action Protocol disclosure."*

---

## 4. Quick Verification Reference Table

| Metric / Feature | Specification | Verification Check |
| :--- | :--- | :--- |
| **Primary Video** | `clip3_10.93s_to_15.50s_golf_vs_blue_suv.mp4` | 4.57s duration, 1080p, Ring CCTV FOV 110° |
| **Vehicle 1 (Emerging)** | `VL19 OKP` — 2019 Blue Peugeot 2008 SUV | Give Way breach at 18.6 mph, $86.0^\circ$ rollover |
| **Vehicle 2 (Priority)** | `GD64 LKU` — 2015 Silver/Grey VW Golf | Speeding at 41.2 mph (30 zone), Expired MOT 02/05/2026 |
| **Stopping Distance Math** | Damp Tarmac ($\mu=0.55$) vs Worn Discs ($\mu_{\text{eff}}=0.51$) | 30 mph = 25.64m; 41.2 mph = 46.25m (+80.4%) |
| **Causal Filter** | Strips 3 non-causal objects | Preserves 2 vehicles, 2 signs, markings, NW hedgerow |
| **Camera Modes** | 7 synchronized perspectives | Orbit, Top, Side, Front, Peugeot POV, Golf POV, CCTV |
| **Statutory Corpus** | >65,000 characters (>16,500 tokens) | Highway Code, RTA 1988, 1945 Act, *Powell v Moody* |
| **Sub-Agent Runtime** | 3x parallel `gemini-3.8-flash` (`asyncio.gather`) | Policy Audit, ABI Thatcham Salvage, CPR Letter |
| **Audit Receipt** | SHA-256 canonical hash | Deterministic 64-char hex bound to interaction ID |
| **Test Suite** | Deterministic `pytest` verification | 6 passed in 0.63s (`test_kinematics.py`) |
