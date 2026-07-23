#!/usr/bin/env python3
"""
Delete notebooks from NotebookLM using innerText + coordinate clicking.
"""

import sys
import time
import json
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from patchright.sync_api import sync_playwright

MCP_DATA_DIR = Path.home() / "AppData" / "Local" / "notebooklm-mcp" / "Data"
MCP_STATE_FILE = MCP_DATA_DIR / "browser_state" / "state.json"

BROWSER_ARGS = [
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check'
]
USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

KEEP_NAMES = ["Auditorias e Historial", "Protocolo de Asignaci", "APQP Guias"]


def run_delete(headless=True):
    playwright = sync_playwright().start()
    browser = playwright.chromium.launch(channel="chrome", headless=headless, args=BROWSER_ARGS)
    storage_state = str(MCP_STATE_FILE) if MCP_STATE_FILE.exists() else None
    context = browser.new_context(storage_state=storage_state, user_agent=USER_AGENT, viewport={"width": 1920, "height": 1080})
    page = context.new_page()

    page.goto("https://notebooklm.google.com/", wait_until="networkidle", timeout=30000)
    time.sleep(5)

    if "accounts.google.com" in page.url:
        print("ERROR: Not authenticated")
        browser.close(); playwright.stop()
        return 0

    # Use JavaScript to find ALL notebook cards with their names and menu button positions
    notebooks = page.evaluate("""() => {
        const results = [];

        // Strategy: find all elements that are notebook cards
        // NotebookLM wraps each notebook in a clickable card with a link and a menu button
        // Dump the entire body innerText first for debugging
        const bodyText = document.body.innerText;

        // Find all elements that look like notebook titles by checking rendered text
        const allElements = document.querySelectorAll('*');
        const seen = new Set();

        for (const el of allElements) {
            // Only check leaf-ish elements with short text (notebook names)
            const text = el.innerText || el.textContent || '';
            const directText = Array.from(el.childNodes)
                .filter(n => n.nodeType === 3)
                .map(n => n.textContent.trim())
                .join('');

            // We want elements that have direct text content (not just inherited)
            const cleanText = (directText || text).trim();
            if (!cleanText || cleanText.length < 3 || cleanText.length > 100) continue;
            if (seen.has(cleanText)) continue;

            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) continue;
            if (rect.top < 0 || rect.top > 2000) continue;

            // Check if this looks like a notebook name (not "Crear cuaderno nuevo", not dates, etc.)
            const isDate = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Ene|Abr|Ago|Dic)/i.test(cleanText);
            const isFuentes = /fuentes?$/i.test(cleanText);
            const isNav = ['Todos', 'Mis cuadernos', 'Cuadernos destacados', 'Crear cuaderno nuevo',
                           'Configuración', 'Crear nuevo', 'Más recientes', 'Ver todo',
                           'Cuadernos recientes', 'NotebookLM'].includes(cleanText);

            if (isDate || isFuentes || isNav) continue;

            seen.add(cleanText);
            results.push({
                text: cleanText,
                x: rect.x + rect.width / 2,
                y: rect.y + rect.height / 2,
                width: rect.width,
                height: rect.height,
                tag: el.tagName
            });
        }

        return { notebooks: results, bodyTextLength: bodyText.length, bodySnippet: bodyText.substring(0, 500) };
    }""")

    print(f"  Body text length: {notebooks['bodyTextLength']}")
    print(f"  Body snippet: {notebooks['bodySnippet'][:200]}...")
    print(f"\n  Found {len(notebooks['notebooks'])} potential notebook elements:")

    for nb in notebooks['notebooks']:
        print(f"    [{nb['tag']}] '{nb['text'][:60]}' at ({nb['x']:.0f},{nb['y']:.0f})")

    # Now find the ones to delete
    deleted = 0

    for nb in notebooks['notebooks']:
        text = nb['text']
        should_keep = any(k.lower() in text.lower() for k in KEEP_NAMES)
        if should_keep:
            print(f"\n  KEEP: '{text[:60]}'")
            continue

        # Check if this looks like a real notebook name (has reasonable position on page)
        # Notebooks in "Cuadernos recientes" section are below ~200px
        if nb['y'] < 150:
            continue  # Skip header area

        print(f"\n  DELETE TARGET: '{text[:60]}' at ({nb['x']:.0f},{nb['y']:.0f})")

        # Hover over the card to reveal the 3-dot menu
        page.mouse.move(nb['x'], nb['y'])
        time.sleep(0.5)

        # The 3-dot menu appears on hover. Find it near the element.
        menu_pos = page.evaluate("""(targetY) => {
            // Find all small icon buttons that are near the target Y position
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
                const rect = btn.getBoundingClientRect();
                // Menu buttons are small (icon-only) and near the target
                if (rect.width > 10 && rect.width < 60 && rect.height > 10 && rect.height < 60) {
                    if (Math.abs(rect.y - targetY + 40) < 80) {
                        // Could be the menu button for this card
                        const icon = btn.querySelector('mat-icon, svg, [class*="icon"]');
                        const label = btn.getAttribute('aria-label') || btn.innerText || '';
                        if (icon || label.includes('menú') || label.includes('menu') || label.includes('Más') || label.includes('More') || label.includes('opciones')) {
                            return {
                                x: rect.x + rect.width / 2,
                                y: rect.y + rect.height / 2,
                                label: label
                            };
                        }
                    }
                }
            }
            return null;
        }""", nb['y'])

        if menu_pos:
            print(f"    Menu button at ({menu_pos['x']:.0f},{menu_pos['y']:.0f}) label='{menu_pos['label']}'")
            page.mouse.click(menu_pos['x'], menu_pos['y'])
            time.sleep(1)

            # Screenshot to see menu
            page.screenshot(path=str(Path(__file__).parent.parent / "data" / f"debug_menu_{deleted}.png"))

            # Find and click "Eliminar" in the dropdown
            del_pos = page.evaluate("""() => {
                const items = document.querySelectorAll('[role="menuitem"], button, [mat-menu-item]');
                for (const item of items) {
                    const text = item.innerText || item.textContent || '';
                    if (text.toLowerCase().includes('eliminar') || text.toLowerCase().includes('delete') || text.toLowerCase().includes('borrar')) {
                        const rect = item.getBoundingClientRect();
                        if (rect.width > 0) {
                            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, text: text.trim() };
                        }
                    }
                }
                return null;
            }""")

            if del_pos:
                print(f"    Found '{del_pos['text']}' at ({del_pos['x']:.0f},{del_pos['y']:.0f})")
                page.mouse.click(del_pos['x'], del_pos['y'])
                time.sleep(1)

                # Confirm dialog
                confirm_pos = page.evaluate("""() => {
                    const btns = document.querySelectorAll('button');
                    let lastMatch = null;
                    for (const btn of btns) {
                        const text = btn.innerText || '';
                        if (text.toLowerCase().includes('eliminar') || text.toLowerCase().includes('delete')) {
                            const rect = btn.getBoundingClientRect();
                            if (rect.width > 0 && rect.height > 0) {
                                lastMatch = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, text: text.trim() };
                            }
                        }
                    }
                    return lastMatch;
                }""")

                if confirm_pos:
                    page.mouse.click(confirm_pos['x'], confirm_pos['y'])
                    print(f"    DELETED!")
                    deleted += 1
                    time.sleep(3)
                    # Reload page for next deletion
                    page.goto("https://notebooklm.google.com/", wait_until="networkidle", timeout=30000)
                    time.sleep(4)
                else:
                    print(f"    No confirm button found")
                    page.keyboard.press("Escape")
                    time.sleep(0.5)
            else:
                print(f"    No 'Eliminar' option in menu")
                page.keyboard.press("Escape")
                time.sleep(0.5)
        else:
            print(f"    No menu button found near element")

    page.screenshot(path=str(Path(__file__).parent.parent / "data" / "debug_after_delete.png"))
    print(f"\nTotal deleted: {deleted}")

    browser.close()
    playwright.stop()
    return deleted


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--visible', action='store_true')
    args = parser.parse_args()
    run_delete(headless=not args.visible)
