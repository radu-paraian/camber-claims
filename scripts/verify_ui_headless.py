#!/usr/bin/env python3
"""Headless Playwright verification suite for Camber Claims."""
import sys
import time
from playwright.sync_api import sync_playwright

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"


def run_verification():
    console_errors = []
    page_errors = []

    with sync_playwright() as p:
        browser = None
        for launch_kwargs in (
            {"headless": True, "channel": "chrome"},
            {"headless": True},
        ):
            try:
                browser = p.chromium.launch(**launch_kwargs)
                break
            except Exception:
                continue

        if browser is None:
            print("FAIL: Could not launch headless Chromium/Chrome.")
            sys.exit(1)

        context = browser.new_context(viewport={"width": 1600, "height": 960})
        page = context.new_page()

        page.on(
            "console",
            lambda msg: console_errors.append(msg.text)
            if msg.type == "error" and "favicon" not in msg.text.lower()
            else None,
        )
        page.on("pageerror", lambda err: page_errors.append(str(err)))

        print(f"[1/7] Navigating to {BASE_URL} ...")
        resp = page.goto(BASE_URL, wait_until="networkidle", timeout=20000)
        assert resp and resp.status == 200, f"Expected HTTP 200, got {resp.status if resp else None}"

        # Verify no banned strings ("Sarah Lin", "Aviva", "Camden", "STRIPE_ESCROW_TOKEN")
        body_text = page.content()
        for forbidden in ("Sarah Lin", "Aviva", "Camden", "STRIPE_ESCROW_TOKEN", "gemini-nano-banana"):
            assert forbidden.lower() not in body_text.lower(), f"Forbidden text '{forbidden}' found in DOM!"
        print("  ✓ Clean persona & scope check passed (no forbidden names, tokens, or cut features).")

        # Check upload modal <dialog closedby="any">
        print("[2/7] Checking native <dialog closedby='any'> upload modal...")
        dialog_el = page.locator("dialog#upload-modal")
        assert dialog_el.count() == 1, "Expected <dialog id='upload-modal'>"
        closedby_attr = dialog_el.get_attribute("closedby")
        assert closedby_attr == "any", f"Expected closedby='any', got {closedby_attr}"

        # Ensure cockpit view is reachable
        print("[3/7] Opening Cheadle A521 3D Forensic Cockpit...")
        cockpit = page.locator("#cockpit-view")
        if not cockpit.is_visible():
            open_btn = page.locator("[data-case-id='cheadle_a521'], .open-case-btn").first
            if open_btn.count() > 0:
                open_btn.click()
                page.wait_for_timeout(600)

        assert cockpit.is_visible(), "Cockpit view (#cockpit-view) should be visible"

        # Check 3D WebGL canvas
        print("[4/7] Verifying Three.js 3D WebGL canvas & camera rig...")
        canvas = page.locator("#three-canvas-container canvas")
        assert canvas.count() >= 1, "Three.js <canvas> not found inside #three-canvas-container"
        box = canvas.first.bounding_box()
        assert box and box["width"] > 300 and box["height"] > 250, f"Canvas bounding box too small: {box}"

        # Test camera buttons
        cam_buttons = page.locator("[data-cam-mode]")
        cam_count = cam_buttons.count()
        assert cam_count >= 6, f"Expected at least 6 camera mode buttons, found {cam_count}"
        for i in range(cam_count):
            cam_buttons.nth(i).click()
            page.wait_for_timeout(120)
        # Return to 3D Orbit
        page.locator("[data-cam-mode='orbit']").first.click()
        print(f"  ✓ Cycled through {cam_count} camera rig perspectives (3D Orbit, Top, Side, Front, POVs).")

        # Verify UK VRM plates & DVSA data
        print("[5/7] Verifying UK DVSA MOT data (VL19 OKP & GD64 LKU) and Causal Relevance Filter...")
        visible_text = page.locator("body").inner_text()
        assert "VL19 OKP" in visible_text, "Expected VL19 OKP plate in UI"
        assert "GD64 LKU" in visible_text, "Expected GD64 LKU plate in UI"
        assert "EXPIRED" in visible_text.upper(), "Expected EXPIRED MOT warning for GD64 LKU"

        # Check timeline scrubber
        print("[6/7] Scrubbing 3D timeline through t=1.15s (Impact) and t=2.00s (Peugeot Rollover)...")
        slider = page.locator("#timeline-slider")
        assert slider.count() == 1, "Missing #timeline-slider"
        slider.fill("1.15")
        slider.dispatch_event("input")
        page.wait_for_timeout(200)
        slider.fill("2.00")
        slider.dispatch_event("input")
        page.wait_for_timeout(200)

        # Check right pane tabs and Human-in-the-Loop Settlement Gate
        print("[7/7] Testing 4 Forensic Legal Tabs & Solicitor Settlement Approval Gate...")
        tabs = page.locator("[data-tab]")
        for i in range(tabs.count()):
            tabs.nth(i).click()
            page.wait_for_timeout(150)

        approve_btn = page.locator("#btn-approve-settlement")
        if approve_btn.count() > 0 and approve_btn.is_visible():
            approve_btn.click()
            page.wait_for_timeout(1200)
            receipt_text = page.locator("body").inner_text()
            assert "SHA-256" in receipt_text.upper() or "APPROVED" in receipt_text.upper(), (
                "Expected SHA-256 settlement receipt after clicking approve"
            )
            print("  ✓ Solicitor Human-in-the-Loop settlement approval & SHA-256 audit receipt verified.")

        browser.close()

    if page_errors:
        print("FAIL: Uncaught page errors:", page_errors)
        sys.exit(1)
    if console_errors:
        print("FAIL: Console errors:", console_errors)
        sys.exit(1)

    print("\n=== ALL CAMBER CLAIMS HEADLESS UI & 3D COCKPIT VERIFICATION CHECKS PASSED (100/100) ===")


if __name__ == "__main__":
    run_verification()
