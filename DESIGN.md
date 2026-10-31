# DESIGN.md — Camber Claims UI & 3D Forensic Viewport Specification

## 1. Visual Direction & Domain Exemplars
- **Aesthetic Persona:** Institutional Forensic Engineering & UK Legal Cockpit (**Palantir Foundry × Blender 3D Viewport**).
- **Theme Polarity:** Intentional Dark Mode (`#070B12` Carbon Obsidian canvas; `#0F1623` elevated slate panels with `1px solid rgba(56, 189, 248, 0.16)` subtle telemetry borders).

## 2. Color & Atmospheric Tokens
- **Surface Palette:**
  - `--bg-canvas`: `#070B12`
  - `--bg-panel`: `#0F1623`
  - `--bg-elevated`: `#162032`
  - `--border-subtle`: `rgba(56, 189, 248, 0.16)`
- **Semantic & Telemetry Accents:**
  - `--accent-cyan`: `#38BDF8` (Primary Telemetry, Vehicle 1 / Blue Peugeot `#2563EB`, active camera mode, playhead)
  - `--accent-amber`: `#F97316` (Counterparty vector highlights)
  - `--accent-crimson`: `#EF4444` (Speeding breach, Give Way violation, Expired MOT warning, blind-spot cones)
  - `--accent-emerald`: `#10B981` (Antigravity Linux Sandbox `pytest` PASS badge, live DVSA verified status, fault decision approval)
- **Typography:**
  - `--font-sans`: `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`
  - `--font-mono`: `'JetBrains Mono', 'SFMono-Regular', monospace` with `font-variant-numeric: tabular-nums` so numbers never jitter during 60 FPS scrubbing.

## 3. Two-View Application Layout

### View 1: Claims & Projects Workspace Homescreen
- Clean dark-mode forensic workspace displaying:
  1. **`[+ New Forensic Crash Reconstruction]` Action Card**: Opens a native `<dialog closedby="any">` modal (with light-dismiss fallback) to upload `.mp4` crash footage and enter UK registration plates (e.g., `VL19 OKP` and `GD64 LKU`), plus an automatic **Causal Scene Filter** badge indicating irrelevant background traffic is stripped out.
  2. **Live Processing Project Card** (appears dynamically when a new reconstruction job starts, showing live steps: `gemini-3.5-flash-lite` Guardrail $\rightarrow$ `gemini-4-argon` (`processing="agentic"`) Video & 3D Trajectory Synthesis $\rightarrow$ Live 5-Part UK DVSA MOT History API + `antigravity-preview-09-2026` Sandbox Kinematics $\rightarrow$ 3x Parallel `gemini-3.8-flash` Legal Subagents).
  3. **Pre-Loaded & Completed UK Crash Project Cards**:
     - **Project #1 (Primary Stage Demo): `Claim #UK-2026-0819 — Cheadle A521 / Draycott Cross Rd Junction`** (`VL19 OKP` 2019 Blue Peugeot 2008 Allure vs. `GD64 LKU` 2015 Silver/Grey VW Golf)
     - **Project #2: `Claim #UK-2026-1017 — Delphouse Rd / A521 Give Way Rollover`** (Black Nissan X-Trail SUV vs. Silver VW Transporter Van)
     - **Project #3: `Claim #UK-2026-0904 — A521 Heavy Goods Vehicle Corridor Collision`** (Black Isuzu D-Max Pickup vs. Scania HGV Lorry)

### View 2: 4-Quadrant Single-Viewport 3D Forensic Cockpit (`100vh`)
- **Top Header Bar (`56px`)**:
  - `[← All Crash Projects]` button, active claim title, `[+ New Crash]` button, and Auto-Detected UK Location Pill (`📍 A521 / Draycott Cross Rd, Cheadle, Staffs • 19/08/2024 12:05:16 BST • 🇬🇧 30 mph Give Way Junction`).
- **Top-Left Quadrant (Source Video + Speed & Kinematics Comparison Strip)**:
  - Synchronized HTML5 video player (`/videos/clip3_10.93s_to_15.50s_golf_vs_blue_suv.mp4`) with Agentic Video Scrubbing Trace (`processing: "agentic"`, `88% Token Savings`).
  - Live Speed & Stopping Distance Comparison cards (`VL19 OKP` emerging across Give Way line at `18.6 mph` without stopping vs. `GD64 LKU` approaching at `41.2 mph` in a `30 mph` zone, `26.4m` actual stopping distance vs `14.0m` ideal at 30 mph, `5.4 G` impact).
- **Top-Right Quadrant (Blender-Style High-Detail 3D Reconstruction Viewport)**:
  - High-craft procedural PBR road textures (wet UK tarmac, crisp white Give Way triangles, double dashed junction lines, kerbs, pavements), causally relevant environment props (UK `30` speed limit roundel sign on post, UK red-bordered `GIVE WAY` triangle sign, corner buildings & sightline hedge, 3D CCTV camera frustum), and detailed multi-part 3D vehicles (wheels, cabin glass, headlights, glowing brake lights, velocity vector arrows, stopping distance ground strips, and realistic post-impact rollover physics for the Blue Peugeot at `t >= 1.15s`).
  - **Causal Relevance Filter Toggle & Badge**: Shows how many non-causal background objects were automatically stripped from the scene while preserving causally relevant vehicles, signs, hedges, and buildings.
  - **Right-Side Blender Viewport Control Dock**:
    - `[🌐 3D Orbit (Persp)]`
    - `[📐 Top View (Z - Ortho)]`
    - `[📏 Side View (X - Ortho)]`
    - `[🎯 Front View (Y - Ortho)]`
    - `[🚙 Peugeot POV (VL19 OKP)]`
    - `[🚗 VW Golf POV (GD64 LKU)]`
    - `[📹 Ring CCTV POV]`
  - **Bottom Timeline Scrubber Bar**: Play/Pause, `0.25x` / `0.5x` / `1.0x` speed buttons, frame-accurate scrubber (`0.00s` to `4.57s`) with clickable forensic event markers.
- **Bottom-Left Quadrant (Forensic Evidence, Live UK DVSA MOT & Legal Tabs)**:
  - Tab 1: **📝 Executive Liability Summary & Case Law** (Highway Code Rules 170/172 & 124/126, *Powell v Moody*, Law Reform (Contributory Negligence) Act 1945).
  - Tab 2: **🚗 Live UK DVSA MOT History & Antigravity Sandbox Kinematics (`antigravity-preview-09-2026`)** (Side-by-side live GOV.UK DVSA cards for `VL19 OKP` and `GD64 LKU` + deterministic `pytest` kinematics verification output).
  - Tab 3: **📋 3x Parallel `gemini-3.8-flash` Subagent Reports** (Policy Coverage Audit, Itemized ABI Thatcham Repair & Salvage Schedule, UK CPR Pre-Action Protocol Letter of Claim).
- **Bottom-Right Quadrant (Contributory Negligence Fault Split & Solicitor Sign-Off Gate)**:
  - Interactive Contributory Negligence Slider (`75% Defendant [VL19 OKP] / 25% Claimant [GD64 LKU]`) dynamically updating Net Subrogation Recovery (`£10,150.00` on `£14,200` gross claim less `£500` excess).
  - Human-in-the-Loop Solicitor Approval button (`[✅ Approve 75/25 Liability Split & Issue Subrogation Demand]`) that records a verified SHA-256 forensic & legal sign-off receipt.
