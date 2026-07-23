#!/usr/bin/env python3
"""
Create a NotebookLM notebook and upload source files.
Uses the authenticated Patchright browser session.
"""

import sys
import time
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import json
from patchright.sync_api import sync_playwright
from browser_utils import StealthUtils

# MCP stores auth here (the one that actually has the session)
MCP_DATA_DIR = Path.home() / "AppData" / "Local" / "notebooklm-mcp" / "Data"
MCP_CHROME_PROFILE = MCP_DATA_DIR / "chrome_profile"
MCP_STATE_FILE = MCP_DATA_DIR / "browser_state" / "state.json"

BROWSER_ARGS = [
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check'
]
USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
PAGE_LOAD_TIMEOUT = 30000


def create_notebook_and_upload(name: str, file_paths: list, headless: bool = True):
    """
    Create a new NotebookLM notebook and upload source files.
    Uses the MCP's authenticated browser session.
    """
    # Validate files exist
    valid_files = []
    for fp in file_paths:
        p = Path(fp)
        if p.exists():
            valid_files.append(str(p.resolve()))
            print(f"  OK: {p.name}")
        else:
            print(f"  SKIP (not found): {fp}")

    if not valid_files:
        print("ERROR: No valid files to upload")
        return False

    if not MCP_CHROME_PROFILE.exists():
        print(f"ERROR: MCP chrome profile not found at {MCP_CHROME_PROFILE}")
        return False

    print(f"\nCreating notebook '{name}' with {len(valid_files)} sources...")
    print(f"  Using MCP profile: {MCP_CHROME_PROFILE}")

    playwright = None
    context = None

    try:
        playwright = sync_playwright().start()

        # Try persistent context first, fall back to non-persistent with storage_state
        context = None
        browser = None
        try:
            context = playwright.chromium.launch_persistent_context(
                user_data_dir=str(MCP_CHROME_PROFILE),
                channel="chrome",
                headless=headless,
                no_viewport=True,
                ignore_default_args=["--enable-automation"],
                user_agent=USER_AGENT,
                args=BROWSER_ARGS
            )
            if MCP_STATE_FILE.exists():
                with open(MCP_STATE_FILE, 'r') as f:
                    state = json.load(f)
                    cookies = state.get('cookies', [])
                    if cookies:
                        context.add_cookies(cookies)
            print(f"  Using persistent context")
        except Exception:
            print(f"  Profile locked, using non-persistent browser with storage_state")
            browser = playwright.chromium.launch(
                channel="chrome",
                headless=headless,
                args=BROWSER_ARGS
            )
            storage_state = str(MCP_STATE_FILE) if MCP_STATE_FILE.exists() else None
            context = browser.new_context(
                storage_state=storage_state,
                user_agent=USER_AGENT,
                viewport={"width": 1920, "height": 1080}
            )

        page = context.new_page()

        # Navigate to NotebookLM home
        print("  Navigating to NotebookLM...")
        page.goto("https://notebooklm.google.com/", wait_until="domcontentloaded", timeout=PAGE_LOAD_TIMEOUT)
        time.sleep(3)

        # Check auth
        if "accounts.google.com" in page.url:
            print("  ERROR: Not authenticated. Run auth_manager.py setup first.")
            return False

        print(f"  URL: {page.url}")

        # Click "New notebook" button - try multiple selectors
        print("  Looking for 'New notebook' button...")
        new_btn = None
        selectors = [
            'button:has-text("New")',
            'button:has-text("Nuevo")',
            'button:has-text("Create")',
            'button:has-text("Crear")',
            '[aria-label="Create new notebook"]',
            '[aria-label="Crear notebook"]',
            '.create-notebook-button',
            'button.new-notebook',
            # Material Design FAB
            'button[mat-fab]',
            'button.mat-fab',
        ]

        for sel in selectors:
            try:
                el = page.query_selector(sel)
                if el and el.is_visible():
                    new_btn = el
                    print(f"  Found button: {sel}")
                    break
            except:
                continue

        if not new_btn:
            # Try finding any button/link with "new" or "create" text
            print("  Trying text-based search...")
            try:
                new_btn = page.get_by_role("button", name="New").first
                if new_btn:
                    print("  Found via role 'button' name 'New'")
            except:
                pass

        if not new_btn:
            # Screenshot for debugging
            screenshot_path = Path(__file__).parent.parent / "data" / "debug_home.png"
            page.screenshot(path=str(screenshot_path))
            print(f"  DEBUG: Screenshot saved to {screenshot_path}")

            # Dump page content for debugging
            print("  Page title:", page.title())
            # Try to find all buttons
            buttons = page.query_selector_all("button")
            print(f"  Found {len(buttons)} buttons on page:")
            for i, btn in enumerate(buttons[:15]):
                try:
                    txt = btn.inner_text().strip()[:80]
                    visible = btn.is_visible()
                    print(f"    [{i}] '{txt}' visible={visible}")
                except:
                    pass

            print("\n  Could not find 'New notebook' button. Check debug screenshot.")
            return False

        # Click the new notebook button
        StealthUtils.random_delay(300, 600)
        new_btn.click()
        print("  Clicked 'New notebook'")
        time.sleep(3)

        # Now we should be in notebook creation or a new notebook page
        print(f"  URL after click: {page.url}")

        # Look for file upload option / source upload
        # NotebookLM typically shows a dialog to add sources
        print("  Looking for upload/source area...")

        # Try to find file input element
        file_input = page.query_selector('input[type="file"]')

        if not file_input:
            # Try clicking "Upload" or "Add source" first
            upload_selectors = [
                'button:has-text("Upload")',
                'button:has-text("Subir")',
                'button:has-text("Add source")',
                'button:has-text("Agregar fuente")',
                ':text("Upload")',
                ':text("Subir")',
                '[aria-label="Upload"]',
                '[aria-label="Add source"]',
            ]

            for sel in upload_selectors:
                try:
                    el = page.query_selector(sel)
                    if el and el.is_visible():
                        el.click()
                        print(f"  Clicked upload element: {sel}")
                        time.sleep(2)
                        break
                except:
                    continue

            # Check for file input again
            file_input = page.query_selector('input[type="file"]')

        if not file_input:
            # Sometimes file inputs are hidden, check all
            file_inputs = page.query_selector_all('input[type="file"]')
            if file_inputs:
                file_input = file_inputs[0]
                print(f"  Found hidden file input (total: {len(file_inputs)})")

        if file_input:
            # Upload all files at once
            print(f"  Uploading {len(valid_files)} files...")
            file_input.set_input_files(valid_files)
            print("  Files set on input element")
            time.sleep(5)  # Wait for upload processing
        else:
            # Take debug screenshot
            screenshot_path = Path(__file__).parent.parent / "data" / "debug_upload.png"
            page.screenshot(path=str(screenshot_path))
            print(f"  DEBUG: Screenshot saved to {screenshot_path}")

            # List available elements
            buttons = page.query_selector_all("button")
            print(f"  Found {len(buttons)} buttons:")
            for i, btn in enumerate(buttons[:20]):
                try:
                    txt = btn.inner_text().strip()[:80]
                    visible = btn.is_visible()
                    print(f"    [{i}] '{txt}' visible={visible}")
                except:
                    pass

            inputs = page.query_selector_all("input")
            print(f"  Found {len(inputs)} inputs:")
            for i, inp in enumerate(inputs[:10]):
                try:
                    itype = inp.get_attribute("type") or "?"
                    print(f"    [{i}] type={itype}")
                except:
                    pass

            print("\n  Could not find file upload. Check debug screenshot.")
            return False

        # Wait for processing
        print("  Waiting for files to be processed...")
        time.sleep(10)

        # Try to rename the notebook
        print(f"  Attempting to rename notebook to '{name}'...")
        # Look for notebook title/name element
        title_selectors = [
            '[contenteditable="true"]',
            '.notebook-title',
            'input[placeholder*="title"]',
            'input[placeholder*="nombre"]',
            'h1[contenteditable]',
            '.title-input',
        ]

        for sel in title_selectors:
            try:
                el = page.query_selector(sel)
                if el and el.is_visible():
                    el.click()
                    time.sleep(0.5)
                    page.keyboard.press("Control+a")
                    page.keyboard.type(name, delay=50)
                    print(f"  Renamed notebook via: {sel}")
                    break
            except:
                continue

        # Get final URL
        final_url = page.url
        print(f"\n  DONE! Notebook URL: {final_url}")

        # Take final screenshot
        screenshot_path = Path(__file__).parent.parent / "data" / "debug_final.png"
        page.screenshot(path=str(screenshot_path))
        print(f"  Final screenshot: {screenshot_path}")

        return final_url

    except Exception as e:
        print(f"  ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

    finally:
        if context:
            try:
                context.close()
            except:
                pass
        if playwright:
            try:
                playwright.stop()
            except:
                pass


def main():
    parser = argparse.ArgumentParser(description='Create NotebookLM notebook and upload sources')
    parser.add_argument('--name', required=True, help='Notebook name')
    parser.add_argument('--files', nargs='+', required=True, help='Files to upload as sources')
    parser.add_argument('--visible', action='store_true', help='Show browser (default: headless)')
    parser.add_argument('--headless', action='store_true', help='(deprecated, now default)')

    args = parser.parse_args()

    result = create_notebook_and_upload(
        name=args.name,
        file_paths=args.files,
        headless=not args.visible
    )

    if result:
        print(f"\nNotebook created successfully!")
        if isinstance(result, str):
            print(f"URL: {result}")
    else:
        print(f"\nFailed to create notebook.")
        sys.exit(1)


if __name__ == "__main__":
    main()
