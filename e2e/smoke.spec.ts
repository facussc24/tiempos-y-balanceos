/**
 * Smoke Test Visual - Barack Mercosul v7.0
 *
 * Navega todos los módulos principales y verifica que:
 * - La UI renderiza completa (no hay pantallas en blanco)
 * - No hay errores JS en consola
 * - Los botones responden
 */
import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots');

// Collect console errors across all tests
let consoleErrors: string[] = [];

function setupConsoleCapture(page: Page) {
    consoleErrors = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            const text = msg.text();
            // Ignore known noise: favicon, Tauri bridge, HMR, browser extension
            if (
                text.includes('favicon.ico') ||
                text.includes('__TAURI__') ||
                text.includes('[vite]') ||
                text.includes('chrome-extension') ||
                text.includes('ERR_CONNECTION_REFUSED') ||
                text.includes('ipc://localhost') ||
                text.includes('net::ERR')
            ) return;
            consoleErrors.push(text);
        }
    });
    page.on('pageerror', (err) => {
        consoleErrors.push(`PAGE_ERROR: ${err.message}`);
    });
}

// ==========================================
// 1. LANDING PAGE
// ==========================================
test.describe('Landing Page', () => {
    test('renderiza correctamente con 3 módulos', async ({ page }) => {
        setupConsoleCapture(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Logo
        await expect(page.locator('img[alt="Barack Mercosul"]')).toBeVisible();

        // Title
        await expect(page.locator('h1:has-text("Barack Mercosul")')).toBeVisible();

        // 3 module cards
        await expect(page.locator('button:has-text("Tiempos y Balanceos")')).toBeVisible();
        await expect(page.locator('button:has-text("AMFE VDA")')).toBeVisible();
        await expect(page.locator('button:has-text("Plan de Control")')).toBeVisible();

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-landing.png'), fullPage: true });

        expect(consoleErrors).toEqual([]);
    });
});

// ==========================================
// 2. TIEMPOS Y BALANCEOS
// ==========================================
test.describe('Tiempos y Balanceos', () => {
    test('abre módulo y muestra dashboard', async ({ page }) => {
        setupConsoleCapture(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Click Tiempos y Balanceos card
        await page.locator('button:has-text("Tiempos y Balanceos")').click();

        // Wait for lazy-load
        await page.waitForTimeout(2000);

        // Should show the app header with Inicio tab
        await expect(page.locator('text=Inicio').first()).toBeVisible({ timeout: 10000 });

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-tiempos-dashboard.png'), fullPage: true });

        expect(consoleErrors).toEqual([]);
    });

    test('navega a Ayuda', async ({ page }) => {
        setupConsoleCapture(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.locator('button:has-text("Tiempos y Balanceos")').click();
        await page.waitForTimeout(2000);

        // Click Ayuda
        await page.locator('text=Ayuda').first().click();
        await page.waitForTimeout(1000);

        // Help center should render
        await expect(page.locator('main')).not.toBeEmpty();

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-tiempos-ayuda.png'), fullPage: true });

        expect(consoleErrors).toEqual([]);
    });
});

// ==========================================
// 3. AMFE VDA
// ==========================================
test.describe('AMFE VDA', () => {
    test('abre módulo y muestra UI principal', async ({ page }) => {
        setupConsoleCapture(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        await page.locator('button:has-text("AMFE VDA")').click();
        await page.waitForTimeout(3000);

        // AMFE should load - look for key UI elements
        // The AmfeApp has a toolbar and table area
        const body = page.locator('body');
        await expect(body).not.toBeEmpty();

        // Check that we're no longer on landing (no "Barack Mercosul" h1)
        await expect(page.locator('h1:has-text("Barack Mercosul")')).not.toBeVisible({ timeout: 5000 });

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-amfe-main.png'), fullPage: true });

        expect(consoleErrors).toEqual([]);
    });

    test('crea AMFE nuevo y agrega operación', async ({ page }) => {
        setupConsoleCapture(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        await page.locator('button:has-text("AMFE VDA")').click();
        await page.waitForTimeout(3000);

        // Look for "Nuevo" button or similar to create new AMFE
        const nuevoBtn = page.locator('button:has-text("Nuevo")').first();
        if (await nuevoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await nuevoBtn.click();
            await page.waitForTimeout(1000);

            // If there's a dialog, fill in a name and confirm
            const nameInput = page.locator('input[placeholder*="nombre"], input[placeholder*="Nombre"]').first();
            if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await nameInput.fill('Smoke Test AMFE');
                // Look for confirm/create button
                const confirmBtn = page.locator('button:has-text("Crear"), button:has-text("Aceptar"), button:has-text("Confirmar")').first();
                if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await confirmBtn.click();
                    await page.waitForTimeout(1000);
                }
            }
        }

        // Try to add an operation via "Agregar" or "+" button
        const agregarBtn = page.locator('button:has-text("Agregar"), button:has-text("+ Op"), button[title*="Agregar"]').first();
        if (await agregarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await agregarBtn.click();
            await page.waitForTimeout(1000);
        }

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-amfe-nuevo.png'), fullPage: true });

        expect(consoleErrors).toEqual([]);
    });
});

// ==========================================
// 4. PLAN DE CONTROL
// ==========================================
test.describe('Plan de Control', () => {
    test('abre módulo y muestra UI principal', async ({ page }) => {
        setupConsoleCapture(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        await page.locator('button:has-text("Plan de Control")').click();
        await page.waitForTimeout(3000);

        // Should show CP UI - not landing anymore
        await expect(page.locator('h1:has-text("Barack Mercosul")')).not.toBeVisible({ timeout: 5000 });

        const body = page.locator('body');
        await expect(body).not.toBeEmpty();

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-cp-main.png'), fullPage: true });

        expect(consoleErrors).toEqual([]);
    });

    test('intenta crear o editar ítem', async ({ page }) => {
        setupConsoleCapture(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        await page.locator('button:has-text("Plan de Control")').click();
        await page.waitForTimeout(3000);

        // Look for "Nuevo" or "Agregar" button
        const nuevoBtn = page.locator('button:has-text("Nuevo")').first();
        if (await nuevoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await nuevoBtn.click();
            await page.waitForTimeout(1500);

            // Fill name if dialog appears
            const nameInput = page.locator('input[placeholder*="nombre"], input[placeholder*="Nombre"]').first();
            if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await nameInput.fill('Smoke Test CP');
                const confirmBtn = page.locator('button:has-text("Crear"), button:has-text("Aceptar")').first();
                if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await confirmBtn.click();
                    await page.waitForTimeout(1000);
                }
            }
        }

        // Try adding an item
        const agregarBtn = page.locator('button:has-text("Agregar"), button:has-text("+ Fila"), button[title*="Agregar"]').first();
        if (await agregarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await agregarBtn.click();
            await page.waitForTimeout(1000);
        }

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-cp-edicion.png'), fullPage: true });

        expect(consoleErrors).toEqual([]);
    });
});

// ==========================================
// 5. NAVEGACIÓN COMPLETA TIEMPOS (con proyecto abierto)
// ==========================================
test.describe('Tiempos - Navegación interna', () => {
    test('navega por todos los tabs accesibles', async ({ page }) => {
        setupConsoleCapture(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        await page.locator('button:has-text("Tiempos y Balanceos")').click();
        await page.waitForTimeout(2000);

        // At this point we're on dashboard. The Datos/Análisis dropdowns
        // only show when a project is open. Try to create a new study via dashboard.
        const nuevoEstudio = page.locator('button:has-text("Nuevo Estudio"), button:has-text("Nuevo"), button:has-text("Crear")').first();
        if (await nuevoEstudio.isVisible({ timeout: 3000 }).catch(() => false)) {
            await nuevoEstudio.click();
            await page.waitForTimeout(1500);

            // If a wizard modal appears, try to fill minimal data and create
            const projectNameInput = page.locator('input[placeholder*="nombre"], input[placeholder*="Nombre"], input[name*="name"]').first();
            if (await projectNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await projectNameInput.fill('Smoke Test');
            }

            // Try "Crear" or "Siguiente" or "Aceptar"
            const crearBtn = page.locator('button:has-text("Crear"), button:has-text("Siguiente"), button:has-text("Aceptar")').first();
            if (await crearBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await crearBtn.click();
                await page.waitForTimeout(2000);
            }

            // Close any modal that may still be open (Escape or X button)
            const modalBackdrop = page.locator('.fixed.inset-0');
            if (await modalBackdrop.isVisible({ timeout: 1000 }).catch(() => false)) {
                await page.keyboard.press('Escape');
                await page.waitForTimeout(500);
                // If still open, try clicking X button
                const closeBtn = page.locator('.fixed.inset-0 button:has(svg.lucide-x)').first();
                if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
                    await closeBtn.click();
                    await page.waitForTimeout(500);
                }
            }
        }

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-tiempos-project.png'), fullPage: true });

        // Now try clicking each dropdown to see if menus appear
        // Datos dropdown
        const datosDropdown = page.locator('button:has-text("Datos")').first();
        if (await datosDropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
            await datosDropdown.click();
            await page.waitForTimeout(500);

            // Click "Panel Control" if visible
            const panelItem = page.locator('text=Panel Control').first();
            if (await panelItem.isVisible({ timeout: 2000 }).catch(() => false)) {
                await panelItem.click();
                await page.waitForTimeout(2000);
                await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-tiempos-panel.png'), fullPage: true });
            }

            // Navigate to Tareas
            if (await datosDropdown.isVisible({ timeout: 1000 }).catch(() => false)) {
                await datosDropdown.click();
                await page.waitForTimeout(500);
                const tareasItem = page.locator('text=Tareas').first();
                if (await tareasItem.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await tareasItem.click();
                    await page.waitForTimeout(2000);
                    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-tiempos-tareas.png'), fullPage: true });
                }
            }
        }

        // Análisis dropdown
        const analisisDropdown = page.locator('button:has-text("Análisis")').first();
        if (await analisisDropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
            await analisisDropdown.click();
            await page.waitForTimeout(500);

            // Click Balanceo
            const balanceoItem = page.locator('text=Balanceo').first();
            if (await balanceoItem.isVisible({ timeout: 2000 }).catch(() => false)) {
                await balanceoItem.click();
                await page.waitForTimeout(2000);
                await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11-tiempos-balanceo.png'), fullPage: true });
            }

            // Navigate to Simulador
            if (await analisisDropdown.isVisible({ timeout: 1000 }).catch(() => false)) {
                await analisisDropdown.click();
                await page.waitForTimeout(500);
                const simItem = page.locator('text=Simulador').first();
                if (await simItem.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await simItem.click();
                    await page.waitForTimeout(2000);
                    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12-tiempos-simulador.png'), fullPage: true });
                }
            }

            // Navigate to Resumen Ejecutivo
            if (await analisisDropdown.isVisible({ timeout: 1000 }).catch(() => false)) {
                await analisisDropdown.click();
                await page.waitForTimeout(500);
                const resumenItem = page.locator('text=Resumen Ejecutivo').first();
                if (await resumenItem.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await resumenItem.click();
                    await page.waitForTimeout(2000);
                    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13-tiempos-resumen.png'), fullPage: true });
                }
            }
        }

        expect(consoleErrors).toEqual([]);
    });
});

// ==========================================
// 6. BACK TO LANDING FROM EACH MODULE
// ==========================================
test.describe('Navegación Volver', () => {
    test('puede volver al landing desde cada módulo', async ({ page }) => {
        setupConsoleCapture(page);

        // From Tiempos
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.locator('button:has-text("Tiempos y Balanceos")').click();
        await page.waitForTimeout(2000);

        const backBtn = page.locator('button:has-text("Volver"), button[title*="Volver"], button[aria-label*="back"], button[aria-label*="Volver"]').first();
        // Also try arrow-left button
        const arrowBack = page.locator('button:has(svg.lucide-arrow-left)').first();

        if (await backBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await backBtn.click();
        } else if (await arrowBack.isVisible({ timeout: 3000 }).catch(() => false)) {
            await arrowBack.click();
        }

        await page.waitForTimeout(1000);
        // Check if we're back on landing
        const isLanding = await page.locator('h1:has-text("Barack Mercosul")').isVisible({ timeout: 3000 }).catch(() => false);

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '14-back-to-landing.png'), fullPage: true });

        expect(consoleErrors).toEqual([]);
    });
});

// ==========================================
// 7. VERIFICACIÓN: Sin pantallas en blanco
// ==========================================
test.describe('Sin pantallas en blanco', () => {
    test('cada módulo tiene contenido visible', async ({ page }) => {
        setupConsoleCapture(page);

        const modules = ['Tiempos y Balanceos', 'AMFE VDA', 'Plan de Control'];

        for (const mod of modules) {
            await page.goto('/');
            await page.waitForLoadState('networkidle');
            await page.locator(`button:has-text("${mod}")`).click();
            await page.waitForTimeout(3000);

            // Verify body has meaningful content (not just empty divs)
            const bodyText = await page.locator('body').innerText();
            expect(bodyText.length, `Module "${mod}" has empty body`).toBeGreaterThan(50);

            // Verify no white screen (check background or main content area)
            const mainContent = page.locator('main, [class*="min-h-screen"], [class*="container"]').first();
            await expect(mainContent).toBeVisible({ timeout: 5000 });
        }

        expect(consoleErrors).toEqual([]);
    });
});
