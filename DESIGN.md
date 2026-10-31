# Camber Claims — Design System & UI Specification

**Target User & Domain:** UK motor claims solicitors, subrogation fee earners, and legal claims handlers determining civil liability and negotiating contributory negligence under the Law Reform (Contributory Negligence) Act 1945.

---

## 1. Core Principles

1. **One Primary Task:**
   - The solicitor's sole job in this tool is to **review the forensic evidence, then approve or adjust the liability split**.
   - Every layout decision, typographic weight, and action priority serves this workflow. Any secondary detail or raw diagnostic data is placed behind progressive disclosure (tabs, expandable accordions, or modal views).

2. **Clean Separation of Legal UX vs. Developer Telemetry:**
   - Developer, AI agent, and LLM telemetry (`gemini-4-argon`, `Antigravity`, `1M cache`, `95% off`, `88% token savings`, `processing: agentic`, `gemini-3.8-flash`) are **strictly removed** from the primary claims workspace and cockpit.
   - All AI pipeline metrics, sandbox test traces, and agent routing graphs live exclusively in the dedicated **Architecture View** (`#architecture-view`), accessible via a discrete top-bar link.

3. **Visual Restraint & Generous Whitespace:**
   - Minimise elements on screen. Replace clutter with deliberate negative space and structured visual hierarchy.
   - One unified surface and border system: no nested cards inside cards, no garish colored borders, and no competing visual anchors.

---

## 2. Typography

1. **Typeface Selection:**
   - **Interface Font (All UI elements):** `Inter` (`-apple-system, BlinkMacSystemFont, 'Inter', sans-serif`). Used for all labels, navigation, headings, body copy, tables, forms, and buttons.
   - **Monospace Font (Dynamic numeric values only):** `JetBrains Mono` (`'JetBrains Mono', monospace`).
     - Restricted strictly to values that change dynamically or require vertical tabular alignment:
       - Speeds (e.g. `18.6 mph`, `41.2 mph`)
       - Timestamps and elapsed timecodes (e.g. `01.15s / 04.57s`)
       - Monetary figures (e.g. `£10,150.00`, `£14,200.00`)
       - Percentages (e.g. `75%`, `25%`)
     - Must always use `font-variant-numeric: tabular-nums` to prevent layout jitter during 60 FPS video scrubbing.
     - **Strict Prohibition:** Never use monospace for static labels, table headers, descriptions, or general body paragraphs.

2. **Type Scale (Strict 5-Step Scale):**
   - `28px` / Line height `36px` / Weight `700` — Display titles, primary case headings, hero headlines.
   - `20px` / Line height `28px` / Weight `600` — Section headings, modal titles, liability ratio displays.
   - `16px` / Line height `24px` / Weight `500`–`600` — Card headers, primary tab labels, metric highlights.
   - `14px` / Line height `20px` / Weight `400`–`500` — Standard body text, form inputs, button labels, table cells.
   - `12px` / Line height `16px` / Weight `500` — Secondary metadata, timestamps, captions, section eyebrows. (Absolute minimum font size; nothing below 12px).

3. **Casing Rules:**
   - Sentence case across all UI components, buttons, and headings (e.g. `"Review & approve"`, `"Vehicles & MOT"`, `"Give way breach"`).
   - All-caps is restricted exclusively to one specific component: Section Eyebrow labels (`12px`, uppercase, `letter-spacing: 0.05em`, `color: #64748b`).

---

## 3. Spacing, Radius, Borders & Surfaces

1. **Spacing System (8px Grid):**
   - `--space-1` (`8px`): Compact gaps between icons and labels, inline badge padding.
   - `--space-2` (`16px`): Standard gap between form fields, list items, and metric rows.
   - `--space-3` (`24px`): Default card padding (`20px–24px`) and panel content margins.
   - `--space-4` (`32px`): Major section vertical rhythm and container padding.

2. **Corner Radii:**
   - Cards, floating HUD panels, and modal dialogs: `12px` (`border-radius: 12px`).
   - Interactive controls (buttons, form inputs, segmented pills, dropdown selectors): `8px` (`border-radius: 8px`).

3. **Surfaces & Borders:**
   - **Canvas Background:** `#0b0e14` (neutral deep carbon obsidian).
   - **Card & Panel Background:** `#14171f` (one single uniform card background throughout).
   - **Floating HUD Background:** `rgba(20, 23, 31, 0.85)` with `backdrop-filter: blur(12px)`.
   - **Universal Border Token:** `1px solid rgba(255, 255, 255, 0.08)`.
   - **No Cards Inside Cards:** Never place a bordered card container inside another card. Subsections within cards use subtle dividing lines (`border-top: 1px solid rgba(255, 255, 255, 0.06)`) or vertical whitespace (`--space-2`).

---

## 4. Colour Meaning & Visual Restraint

1. **Semantic Palette:**
   - **Red (`#ef4444`):** Causal negligence or statutory breaches (e.g. Give Way line violation, speeding breach, MOT advisory failure).
   - **Amber (`#f59e0b`):** Warning or secondary contribution (e.g. reaction delay, non-causal vehicle defect).
   - **Green (`#10b981`):** Verified evidence, statutory compliance, valid MOT, or approved liability sign-off.
   - **Neutral Grey (`#94a3b8`):** Non-causal facts, procedural metadata, and secondary telemetry.

2. **Vehicle Identity Palette:**
   - Used strictly and exclusively to identify the two collision vehicles:
     - **Vehicle A (Defendant):** Cyan-Blue (`#0ea5e9` / `#38bdf8`) — Blue Peugeot 2008 (`VL19 OKP`).
     - **Vehicle B (Claimant):** Silver-Grey (`#94a3b8` / `#cbd5e1`) — Silver VW Golf (`GD64 LKU`).
   - Vehicle colours are never reused for unrelated UI buttons, alerts, or decorative borders.

3. **UK Registration Plates:**
   - Displayed as clean, plain monospace/sans text (e.g. `VL19 OKP`, `GD64 LKU`).
   - Do not render novelty yellow vehicle registration badges or 3D licence-plate graphics.

4. **Visual Budget & Icons:**
   - Maximum ~3 status badges visible on screen simultaneously to eliminate badge fatigue.
   - **No Emoji Icons:** Never use emoji characters (e.g. 🚫, ⚠️, 🚙, 🚗, ⚖️).
   - Standardise on Lucide SVG icons (`lucide:alert-circle`, `lucide:check-circle-2`, `lucide:camera`, `lucide:scale`, `lucide:file-text`, `lucide:chevron-down`, `lucide:play`, `lucide:pause`), sized consistently at `16px` or `20px`.

5. **Button Hierarchy (Strictly 3 Styles):**
   - **Primary Button:** Solid accent (`#0ea5e9` with white text). Used **only once per view** for the definitive next action (e.g. `"Review & approve"` in the Cockpit Top Bar, or `"Approve 75/25 & issue demand"` in Sign-off).
   - **Secondary Button:** Outline (`border: 1px solid rgba(255, 255, 255, 0.16)`, transparent background, hover: `rgba(255, 255, 255, 0.05)`). Used for auxiliary actions such as `"New reconstruction"` or `"Export protocol bundle"`.
   - **Ghost / Text Button:** No border or background (`color: #94a3b8`, hover: `#ffffff`). Used for navigation items, camera presets, and modal dismissals.

6. **Interactive Component Conventions:**
   - **Accordions:** Full-width clickable row, rotating right chevron icon (`lucide:chevron-down`), and subtle hover background (`rgba(255, 255, 255, 0.03)`).
   - **Underline Tabs:** Single horizontal row with active indicator `border-bottom: 2px solid #0ea5e9` and white text. Inactive tabs have transparent bottom borders and `#94a3b8` text. Tabs never wrap onto multiple lines (`overflow-x: auto` with scrollbar hidden).

---

## 5. Layout Specifications

### 5.1 Landing Page (`#workspace-view`)
- **Default View:** Camber Claims launches directly into this claims workspace.
- **Hero Section:**
  - Clear, plain-English headline: `"Reconstruct a crash and agree liability in minutes"`.
  - Subhead oriented to solicitors: `"Forensic video reconstruction, automated DVSA verification, and case-law backed liability assessment."`
- **Actions:**
  - Primary Stage Case: Prominent, high-priority clickable card for `Claim #UK-2026-0819 — Cheadle A521 / Draycott Cross Rd Junction`. Clicking opens the Cockpit View.
  - Secondary Action: `"New reconstruction"` secondary outline button, opening a lightweight dialog to upload `.mp4` dashcam/CCTV footage and enter vehicle VRNs.

---

### 5.2 Cockpit Top Bar (`64px`)
- Fixed at the top of the screen (`height: 64px`, `border-bottom: 1px solid rgba(255, 255, 255, 0.08)`).
- **Left Group:**
  - `"← All cases"` ghost button returning to the workspace.
  - Case title in plain text: `"Claim #UK-2026-0819: Cheadle A521 / Draycott Cross Rd"`.
  - Incident timestamp: `"19 Aug 2024, 12:05 BST"`.
- **Right Group:**
  - `"Architecture"` ghost link (opens the Architecture & AI Pipeline telemetry view).
  - Single primary action button: `"Review & approve"`.

---

### 5.3 Cockpit Main Area (`100vh - 64px`)
Divided into two clean, asymmetric panels:
- **Left 65%:** Interactive 3D Forensic Viewport & Synchronised Timeline.
- **Right 35% (Minimum 400px):** Single-scroll legal evidence and liability decision panel.

```
+---------------------------------------------------------------------------------------------------+
| Cockpit Top Bar (64px)                                                 [Architecture] [Review & approve] |
+------------------------------------------------------+--------------------------------------------+
| 3D FORENSIC VIEWPORT (65%)                           | LEGAL DECISION PANEL (35%, min 400px)      |
|                                                      | +----------------------------------------+ |
| [HUD: Time | Veh A Speed | Veh B Speed] [Cam Pcs]    | | Liability Summary Card                 | |
|                                                      | |  75% Def (Veh A)  /  25% Clm (Veh B)   | |
|                                                      | |  Net Recovery: £10,150.00              | |
|                                                      | +----------------------------------------+ |
|                                                      | [Summary] [Vehicles & MOT] [Law] [Costs] [Sign-off] |
|                                                      |                                            |
|                                                      | Tab Content (Single unified scroll area)   |
|                                                      | - Evidential findings                      |
|                                                      | - Statutory duties & Highway Code          |
|                                                      | - Case law precedent                       |
|                                                      | - Contributory negligence adjustments      |
| +--------------------------------------------------+ |                                            |
| | Timeline Bar: [Play/Pause] [Scrubber] [Speed Sel]| |                                            |
| +--------------------------------------------------+ +--------------------------------------------+
+---------------------------------------------------------------------------------------------------+
```

#### Right Decision Panel Structure:
1. **Liability Summary Card (Pinned Top):**
   - Visual fault split bar: `75% Defendant (Vehicle A) / 25% Claimant (Vehicle B)`.
   - Consistent party naming:
     - `"Vehicle A: Blue Peugeot 2008 (VL19 OKP), Defendant"`
     - `"Vehicle B: Silver VW Golf (GD64 LKU), Claimant"`
   - Net Subrogation Recovery in prominent tabular monospace: `£10,150.00` (calculated from gross claim `£14,200.00` less excess and counterparty deduction).
2. **5 Underline Navigation Tabs:**
   - **`Summary`:** Chronological reconstruction of causal events, primary impact point, and liability split rationale.
   - **`Vehicles & MOT`:** Live DVSA MOT history, advisories, tire/brake test reports, and vehicle kinematics (approach speeds vs. stopping distances).
   - **`Law`:** Applicable UK road traffic law and precedents:
     - Highway Code Rules 170 & 172 (Give Way breach at junction — primary liability).
     - Highway Code Rules 124 & 126 (Excess speed — 41.2 mph in a 30 mph zone — contributory negligence).
     - Precedent: *Powell v Moody (1966)*, *Fallows v Randle (1997)*, Law Reform (Contributory Negligence) Act 1945.
   - **`Costs`:** Itemised subrogation loss schedule, ABI Thatcham repair band, engineering fees, and hire charges.
   - **`Sign-off`:** Fee earner confirmation, signature input, SHA-256 evidence integrity stamp, and `"Approve 75/25 & issue demand"` primary button.

---

### 5.4 3D Scene Overlays
All viewport overlays are lightweight, non-intrusive, and positioned over the 3D canvas:

1. **Top-Left HUD Card:**
   - Compact semi-transparent card (`background: rgba(20, 23, 31, 0.85)`, `backdrop-filter: blur(12px)`).
   - Displays 3 live metrics:
     - `Time`: Elapsed timecode `01.15s / 04.57s` (`font-variant-numeric: tabular-nums`).
     - `Vehicle A Speed`: `18.6 mph` (Cyan-blue text).
     - `Vehicle B Speed`: `41.2 mph` (Silver-grey text).

2. **Top-Right Camera Segmented Control:**
   - Compact single-row segmented control with 6 viewpoints:
     `Orbit` | `Top` | `Side` | `Vehicle A` | `Vehicle B` | `CCTV`.
   - Clicking smoothly repositions the Three.js camera.

3. **Bottom Timeline Bar:**
   - Pinned cleanly along the bottom edge of the 3D viewport.
   - **Play / Pause Button:** Clean icon toggle (`lucide:play` / `lucide:pause`).
   - **Frame Scrubber:** Continuous timeline scrubber with discrete dot markers indicating key collision milestones:
     - `t = 0.50s`: Vehicle A breaches Give Way dashed line.
     - `t = 0.85s`: Vehicle B late reaction & heavy braking.
     - `t = 1.15s`: Primary t-bone impact.
     - `t = 2.10s`: Vehicle A rollover rest position.
     - Hovering over a dot displays an evidential tooltip.
   - **Speed Selector:** Clean native `<select>` dropdown (`0.25x`, `0.5x`, `1.0x`).
