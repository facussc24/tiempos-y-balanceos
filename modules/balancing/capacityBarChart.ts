/**
 * Canvas-based bar chart renderer for Capacity by Process.
 * Generates a base64-encoded PNG image that can be embedded in ExcelJS workbooks.
 *
 * ExcelJS does not support native Excel charts, so we render the chart as an image
 * and embed it with workbook.addImage() — same pattern used for the Barack logo.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface CapacityBarData {
    label: string;        // Station number or operation name (e.g. "1", "OP10")
    required: number;     // Required pieces per day
    production: number;   // Actual daily production capacity
}

export interface BarChartOptions {
    width?: number;       // Canvas width in pixels (default 900)
    height?: number;      // Canvas height in pixels (default 320)
}

// ============================================================================
// COLORS (match HTML preview)
// ============================================================================

const COLOR_REQUIRED = '#3b82f6';   // Blue — required demand
const COLOR_OK       = '#22c55e';   // Green — production meets demand
const COLOR_DEFICIT  = '#ef4444';   // Red — production below demand
const COLOR_BG       = '#ffffff';   // White background
const COLOR_GRID     = '#e2e8f0';   // Light gray grid lines
const COLOR_AXIS     = '#94a3b8';   // Axis text
const COLOR_TITLE    = '#1e3a5f';   // Title text (Barack navy)
const COLOR_LEGEND   = '#64748b';   // Legend text

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Creates a canvas element, preferring OffscreenCanvas for worker environments.
 */
function createCanvas(width: number, height: number): { canvas: any; ctx: CanvasRenderingContext2D } {
    let canvas: any;

    if (typeof OffscreenCanvas !== 'undefined') {
        canvas = new OffscreenCanvas(width, height);
    } else if (typeof document !== 'undefined') {
        canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
    } else {
        throw new Error('No canvas API available');
    }

    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    if (!ctx) throw new Error('Could not get 2D context');
    return { canvas, ctx };
}

/**
 * Formats a number for axis labels: 1000→"1K", 1000000→"1M", etc.
 */
function formatAxisValue(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
    return String(Math.round(value));
}

/**
 * Calculate nice axis tick values
 */
function calculateTicks(maxValue: number, tickCount: number = 5): number[] {
    if (maxValue <= 0 || tickCount <= 0) return [0];

    const rawStep = maxValue / tickCount;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / magnitude;

    let niceStep: number;
    if (normalized <= 1) niceStep = 1 * magnitude;
    else if (normalized <= 2) niceStep = 2 * magnitude;
    else if (normalized <= 5) niceStep = 5 * magnitude;
    else niceStep = 10 * magnitude;

    const ticks: number[] = [];
    for (let v = 0; v <= maxValue + niceStep * 0.5; v += niceStep) {
        ticks.push(v);
        if (ticks.length > tickCount + 1) break;
    }
    return ticks;
}

/**
 * Convert canvas to base64 PNG string (without data:image/png;base64, prefix)
 */
async function canvasToBase64(canvas: any): Promise<string> {
    // OffscreenCanvas path
    if (typeof canvas.convertToBlob === 'function') {
        const blob = await canvas.convertToBlob({ type: 'image/png' });
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    // Regular HTMLCanvasElement path
    if (typeof canvas.toDataURL === 'function') {
        const dataUrl: string = canvas.toDataURL('image/png');
        // Strip "data:image/png;base64," prefix
        const idx = dataUrl.indexOf(',');
        return idx >= 0 ? dataUrl.substring(idx + 1) : dataUrl;
    }

    throw new Error('Canvas does not support image export');
}

// ============================================================================
// MAIN RENDERER
// ============================================================================

/**
 * Renders a capacity bar chart as a base64-encoded PNG image.
 *
 * @param data Array of station capacity data
 * @param options Optional width/height overrides
 * @returns Base64-encoded PNG string (no data URI prefix), or empty string if data is empty
 */
export async function renderCapacityBarChart(
    data: CapacityBarData[],
    options?: BarChartOptions,
): Promise<string> {
    // Edge case: no data
    if (!data || data.length === 0) return '';

    const W = options?.width ?? 900;
    const H = options?.height ?? 320;

    // Layout constants
    const PADDING_TOP = 40;
    const PADDING_BOTTOM = 60;
    const PADDING_LEFT = 70;
    const PADDING_RIGHT = 20;
    const CHART_W = W - PADDING_LEFT - PADDING_RIGHT;
    const CHART_H = H - PADDING_TOP - PADDING_BOTTOM;

    // Limit stations for readability (>30 gets unreadable)
    const MAX_STATIONS = 30;
    const chartData = data.length > MAX_STATIONS ? data.slice(0, MAX_STATIONS) : data;

    // Calculate max value for Y axis
    let maxValue = 0;
    for (const d of chartData) {
        const r = Number.isFinite(d.required) ? Math.abs(d.required) : 0;
        const p = Number.isFinite(d.production) ? Math.abs(d.production) : 0;
        maxValue = Math.max(maxValue, r, p);
    }
    if (maxValue <= 0) maxValue = 100; // Fallback for all-zero data

    const ticks = calculateTicks(maxValue);
    const yMax = ticks[ticks.length - 1] || maxValue;

    // Create canvas
    const { canvas, ctx } = createCanvas(W, H);

    // ---- Background ----
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, W, H);

    // ---- Title ----
    ctx.fillStyle = COLOR_TITLE;
    ctx.font = 'bold 13px Calibri, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('CAPACIDAD DE PRODUCCIÓN POR PROCESO', PADDING_LEFT, 10);

    // ---- Grid lines and Y-axis labels ----
    ctx.strokeStyle = COLOR_GRID;
    ctx.lineWidth = 1;
    ctx.font = '10px Calibri, Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLOR_AXIS;

    for (const tick of ticks) {
        const y = PADDING_TOP + CHART_H - (tick / yMax) * CHART_H;
        // Grid line
        ctx.beginPath();
        ctx.moveTo(PADDING_LEFT, y);
        ctx.lineTo(PADDING_LEFT + CHART_W, y);
        ctx.stroke();
        // Label
        ctx.fillText(formatAxisValue(tick), PADDING_LEFT - 8, y);
    }

    // ---- X-axis bottom line ----
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PADDING_LEFT, PADDING_TOP + CHART_H);
    ctx.lineTo(PADDING_LEFT + CHART_W, PADDING_TOP + CHART_H);
    ctx.stroke();

    // ---- Bars ----
    const stationCount = chartData.length;
    const groupWidth = CHART_W / stationCount;
    const barPadding = Math.max(2, groupWidth * 0.2);
    const barAreaWidth = groupWidth - barPadding;
    const barWidth = Math.max(3, Math.floor(barAreaWidth / 2 - 1));

    for (let i = 0; i < stationCount; i++) {
        const d = chartData[i];
        const groupX = PADDING_LEFT + i * groupWidth + barPadding / 2;

        const req = Number.isFinite(d.required) ? Math.max(0, d.required) : 0;
        const prod = Number.isFinite(d.production) ? Math.max(0, d.production) : 0;

        // Required bar (blue)
        const reqH = yMax > 0 ? Math.max(1, (req / yMax) * CHART_H) : 1;
        ctx.fillStyle = COLOR_REQUIRED;
        ctx.fillRect(
            groupX,
            PADDING_TOP + CHART_H - reqH,
            barWidth,
            reqH,
        );

        // Production bar (green if OK, red if deficit)
        const prodH = yMax > 0 ? Math.max(1, (prod / yMax) * CHART_H) : 1;
        ctx.fillStyle = prod >= req ? COLOR_OK : COLOR_DEFICIT;
        ctx.fillRect(
            groupX + barWidth + 1,
            PADDING_TOP + CHART_H - prodH,
            barWidth,
            prodH,
        );

        // X-axis label (station number)
        ctx.fillStyle = COLOR_AXIS;
        ctx.font = `${Math.min(10, Math.max(7, Math.floor(groupWidth / 3)))}px Calibri, Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const labelText = d.label.length > 6 ? d.label.substring(0, 5) + '…' : d.label;
        ctx.fillText(labelText, groupX + barAreaWidth / 2, PADDING_TOP + CHART_H + 5);
    }

    // ---- Legend ----
    const LEGEND_Y = H - 22;
    const legendItems = [
        { color: COLOR_REQUIRED, text: 'Pzs Requeridas/Día' },
        { color: COLOR_OK, text: 'Producción Diaria (OK)' },
        { color: COLOR_DEFICIT, text: 'Producción Diaria (DEFICIT)' },
    ];
    let legendX = PADDING_LEFT;

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = '10px Calibri, Arial, sans-serif';

    for (const item of legendItems) {
        // Color box
        ctx.fillStyle = item.color;
        ctx.fillRect(legendX, LEGEND_Y - 5, 10, 10);
        // Text
        ctx.fillStyle = COLOR_LEGEND;
        ctx.fillText(item.text, legendX + 14, LEGEND_Y);
        legendX += ctx.measureText(item.text).width + 30;
    }

    // ---- Convert to base64 ----
    return canvasToBase64(canvas);
}
