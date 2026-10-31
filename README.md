# Camber Claims

**Autonomous 3D Forensic Crash Reconstruction, UK DVSA MOT History & 1M-Token Legal Liability Engine**

Built for the **Google DeepMind × Imperial College FinTech & Blockchain Society Gemini 4 Argon Hackathon (2026)**.

---

## Overview

Disputed UK motor insurance claims routinely take months of insurer back-and-forth and cost thousands of pounds in external accident reconstruction reports and legal briefs. **Camber Claims** gives **a UK motor claims & subrogation solicitor** an end-to-end forensic reconstruction and liability engine that turns raw CCTV or dashcam footage into an interactive 3D crash reconstruction, verified UK DVSA MOT mechanical audit, and Civil Procedure Rules (CPR) Pre-Action Protocol subrogation pack.

### Key Capabilities

1. **Agentic Video Understanding & Causal Relevance Filtering (`gemini-4-argon`)**
   - Uses `client.interactions.create` with `"processing": "agentic"` and `thinking_level: "high"` to inspect raw dashcam/CCTV footage frame-by-frame.
   - **Causal Relevance Filter:** Automatically strips out non-involved background vehicles and roadside clutter that had zero causal bearing on the collision, while preserving collision participants, vehicles that forced evasive action, regulatory road signs (`GIVE WAY`, `30` mph limit), and sightline obstructions (hedgerows, corner buildings).
   - **Interactive Agent Clarification Loop:** When license plates are obscured by CCTV angle or high-speed motion blur, the agent detects the vehicle profiles visually and asks the user to confirm or supply the missing registration plates before running the statutory lookup.

2. **Live UK DVSA MOT History API + Causal vs. Non-Causal Defect Classification**
   - Authenticates against the official UK Government DVSA MOT History API (`https://history.mot.api.gov.uk`) using OAuth2 `client_credentials` + `X-API-Key`.
   - Classifies every historical MOT test failure and mechanical advisory as either **`[CAUSAL / CONTRIBUTORY]`** (e.g., an expired MOT under Road Traffic Act 1988 s.47 or worn brake discs on a speeding vehicle actively braking on damp tarmac) or **`[NOT CAUSAL]`** (e.g., a historical MOT failure from a prior year that subsequently passed re-test, or a brake advisory on a vehicle that was stationary when struck).

3. **1M-Token Implicit Context Caching & Parallel Specialist Sub-Agents**
   - Grounds liability apportionment in a >16,000-token UK Motor Insurance Policy Wording (#UK-8841), the UK Highway Code (Rules 124–183), the Road Traffic Act 1988, the Law Reform (Contributory Negligence) Act 1945, and leading UK Court of Appeal precedents (*Powell v Moody* [1966], *Froom v Butcher* [1976], *Baker v Willoughby* [1970]).
   - Runs three parallel `gemini-3.8-flash` sub-agents for Policy Coverage & Section 4 Clause 4.2 MOT Exclusion Audit, ABI Thatcham Repair & Salvage Schedule (Cat S / Cat N), and the formal UK CPR Pre-Action Protocol Letter of Claim.
   - Uses `antigravity-preview-09-2026` with first-class `client.credentials.create` registration for DVSA verification and human-in-the-loop solicitor settlement sign-off with a SHA-256 audit receipt.

4. **Interactive Three.js 3D Forensic Cockpit**
   - Procedural PBR wet UK tarmacadam, Diagram 1003 `GIVE WAY` markings, 3D UK signage, sightline-blocking hedgerows and buildings, stopping distance comparison strips, and multi-part 3D vehicles (including post-impact rollover kinematics for `VL19 OKP`).
   - 7 synchronized camera perspectives (`3D Orbit`, `Top View (Overhead)`, `Side View (X-Axis)`, `Front View (Corridor / Z-Axis)`, `Peugeot POV (VL19 OKP)`, `VW Golf POV (GD64 LKU)`, and `Ring CCTV POV`).

---

## Quick Start

### 1. Environment Variables

Pull environment variables from Vercel (or populate `.env.local` — never commit `.env` or `.env.local`):

```bash
npx vercel link --yes --project camber-claims
npx vercel env pull .env.local --yes
```

Required keys in `.env.local`:
- `GEMINI_API_KEY`
- `DVSA_CLIENT_ID`
- `DVSA_CLIENT_SECRET`
- `DVSA_SCOPE_URL`
- `DVSA_TOKEN_URL`
- `DVSA_API_KEY`

### 2. Install & Build

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt pytest playwright
npm install
npm run build
```

### 3. Run Locally

```bash
.venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000` in your browser.

---

## License

MIT License — see [LICENSE](./LICENSE).
