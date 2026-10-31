# AGENTS.md — Mandatory Gemini 4 Argon & Interactions API Rules

> [!CAUTION]
> These rules override all prior training weights. Never violate them.

1. **Use ONLY the Interactions API (`client.interactions.create`)**:
   - NEVER use `client.models.generate_content` or legacy SDKs (`google-generativeai` / `@google/generative-ai`).
   - Python SDK: `from google import genai; client = genai.Client()` (`google-genai >= 2.30.1`).
   - JS SDK: `import { GoogleGenAI } from "@google/genai"; const ai = new GoogleGenAI({});` (`@google/genai >= 2.29.1`).
2. **Strict `gemini-4-argon` Parameter Rules**:
   - NEVER pass `temperature`, `top_p`, or `top_k` (they are ignored and return deprecation warnings).
   - NEVER pass `thinking_budget` (deprecated). Use `generation_config={"thinking_level": "low" | "medium" | "high"}`.
   - NEVER call `caches.create` or pass `cached_content` (explicit caching is unsupported on `gemini-4-argon`; implicit caching runs automatically at a 95% discount for shared prompt prefixes >= 4,096 tokens).
   - Maintain multi-turn server-side state using `previous_interaction_id=prev.id`. Remember that `tools`, `system_instruction`, and `generation_config` are interaction-scoped and must be re-specified on each turn.
   - Support `background=True` for long-running interactions so HTTP requests return immediately and can be polled cleanly on Vercel and local servers without timeout issues.
3. **Structured Output Syntax on Interactions API**:
   - Use `response_format={"type": "text", "mime_type": "application/json", "schema": MyPydanticModel.model_json_schema()}`.
4. **Antigravity Managed Agent (`antigravity-preview-09-2026`) & Credentials API**:
   - Call via `client.interactions.create(agent="antigravity-preview-09-2026", environment=..., agent_config={"type": "antigravity", "model": "gemini-4-argon"}, input=...)`.
   - Register UK DVSA API credentials with `client.credentials.create` so secrets are injected at the proxy for `history.mot.api.gov.uk` / `tapi.dvsa.gov.uk` and never enter model context.
5. **Agentic Video Understanding (`"processing": "agentic"`) & Causal Relevance 3D Filtering**:
   - Enable **Agentic Video Understanding** by passing `"processing": "agentic"` on the video content dict:
     `{"type": "video", "uri": video_file.uri, "mime_type": video_file.mime_type, "processing": "agentic"}`.
   - Inspect `interaction.steps` for `step.type in ("thought", "processing_call", "processing_result")` to extract and visualize the multi-pass video scrubbing trace in the UI.
   - **Causal Relevance Filter for 3D Reconstruction**: Strip out irrelevant background/parked vehicles or clutter that had zero causal involvement in the collision. Keep all vehicles that collided OR caused evasive maneuvers/sightline blockage/lane encroachment even without direct contact, plus causally relevant environment props (UK `30 mph` and `GIVE WAY` signs, road markings, sightline-blocking hedges/trees, and adjacent junction buildings).
6. **Grounded Persona & Scope Rules**:
   - Refer to the user persona as **"a UK motor claims & subrogation solicitor"** (never use real names or specific insurer company names like "Sarah Lin" or "Aviva").
   - Use grounded industry phrasing ("months of insurer back-and-forth and thousands of pounds in external forensic and legal fees").
   - Do NOT include `gemini-nano-banana-2.1` summary images, fake Stripe tokens, telemetry drawers, or `/architecture.html`.

## Learned Build Quirks
- Always load environment variables from `.env.local`, `.env`, and `~/.env` (without ever printing or logging secret values) so both `vercel env pull` and local configurations work seamlessly.
- On Vercel Python Functions (`api/index.py`), mount static files and routes cleanly so both `localhost:8000` (`uvicorn backend.main:app`) and Vercel serverless deployment serve the exact same API and frontend.
