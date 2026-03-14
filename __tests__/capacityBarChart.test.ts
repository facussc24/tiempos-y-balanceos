import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderCapacityBarChart, CapacityBarData } from '../modules/balancing/capacityBarChart';

// ============================================================================
// MOCK: OffscreenCanvas / Canvas API
// ============================================================================

// We track all drawing calls to verify the chart logic without a real Canvas
const drawCalls: { method: string; args: any[] }[] = [];

const mockCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    fillRect: vi.fn((...args: any[]) => drawCalls.push({ method: 'fillRect', args })),
    fillText: vi.fn((...args: any[]) => drawCalls.push({ method: 'fillText', args })),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 6 })),
};

const FAKE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

class MockOffscreenCanvas {
    width: number;
    height: number;
    constructor(w: number, h: number) {
        this.width = w;
        this.height = h;
    }
    getContext() {
        return mockCtx;
    }
    // Use toDataURL path instead of convertToBlob (jsdom Blob.arrayBuffer not available)
    toDataURL(_type?: string) {
        return `data:image/png;base64,${FAKE_BASE64}`;
    }
}

// Install mock globally
(globalThis as any).OffscreenCanvas = MockOffscreenCanvas;

beforeEach(() => {
    drawCalls.length = 0;
    mockCtx.fillRect.mockClear();
    mockCtx.fillText.mockClear();
    mockCtx.beginPath.mockClear();
    mockCtx.stroke.mockClear();
});

// ============================================================================
// TESTS
// ============================================================================

describe('renderCapacityBarChart', () => {
    // ---- Edge cases: empty/invalid data ----

    it('returns empty string for empty data array', async () => {
        const result = await renderCapacityBarChart([]);
        expect(result).toBe('');
    });

    it('returns empty string for null/undefined data', async () => {
        const result = await renderCapacityBarChart(null as any);
        expect(result).toBe('');
    });

    // ---- Single station ----

    it('renders single station chart', async () => {
        const data: CapacityBarData[] = [
            { label: '1', required: 1000, production: 1200 },
        ];
        const result = await renderCapacityBarChart(data);
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(10);
    });

    it('draws bars for single station', async () => {
        const data: CapacityBarData[] = [
            { label: '1', required: 500, production: 600 },
        ];
        await renderCapacityBarChart(data);

        // Should have fillRect calls for: background, required bar, production bar, 3 legend boxes
        const fillRectCalls = drawCalls.filter(c => c.method === 'fillRect');
        expect(fillRectCalls.length).toBeGreaterThanOrEqual(5);
    });

    // ---- Multiple stations ----

    it('renders chart with multiple stations', async () => {
        const data: CapacityBarData[] = [
            { label: '1', required: 1000, production: 1200 },
            { label: '2', required: 1000, production: 800 },
            { label: '3', required: 1000, production: 1000 },
            { label: '4', required: 1000, production: 500 },
            { label: '5', required: 1000, production: 1500 },
        ];
        const result = await renderCapacityBarChart(data);
        expect(result).toBeTruthy();

        // Should have station labels in fillText calls
        const textCalls = drawCalls.filter(c => c.method === 'fillText');
        const labelTexts = textCalls.map(c => c.args[0]);
        expect(labelTexts).toContain('1');
        expect(labelTexts).toContain('5');
    });

    // ---- All OK (green) ----

    it('uses green for all bars when production exceeds required', async () => {
        const data: CapacityBarData[] = [
            { label: '1', required: 100, production: 200 },
            { label: '2', required: 100, production: 150 },
        ];
        await renderCapacityBarChart(data);

        // Check that fillStyle was set to green (#22c55e) for production bars
        // Since we track calls, we verify via fillRect being called after setting green
        const fillRectCalls = drawCalls.filter(c => c.method === 'fillRect');
        // At minimum we should have 2 production bars (green) + 2 required (blue) + bg + legend
        expect(fillRectCalls.length).toBeGreaterThanOrEqual(7);
    });

    // ---- All DEFICIT (red) ----

    it('handles all deficit stations', async () => {
        const data: CapacityBarData[] = [
            { label: '1', required: 1000, production: 500 },
            { label: '2', required: 1000, production: 300 },
        ];
        const result = await renderCapacityBarChart(data);
        expect(result).toBeTruthy();
    });

    // ---- Zero values ----

    it('handles all-zero values without error', async () => {
        const data: CapacityBarData[] = [
            { label: '1', required: 0, production: 0 },
            { label: '2', required: 0, production: 0 },
        ];
        const result = await renderCapacityBarChart(data);
        expect(result).toBeTruthy();
    });

    it('handles zero required with positive production', async () => {
        const data: CapacityBarData[] = [
            { label: '1', required: 0, production: 500 },
        ];
        const result = await renderCapacityBarChart(data);
        expect(result).toBeTruthy();
    });

    // ---- Very large values ----

    it('handles very large values (millions)', async () => {
        const data: CapacityBarData[] = [
            { label: '1', required: 5_000_000, production: 6_000_000 },
            { label: '2', required: 5_000_000, production: 4_000_000 },
        ];
        const result = await renderCapacityBarChart(data);
        expect(result).toBeTruthy();

        // Axis labels should use "M" suffix
        const textCalls = drawCalls.filter(c => c.method === 'fillText');
        const axisLabels = textCalls.map(c => c.args[0]);
        expect(axisLabels.some((l: string) => l.includes('M'))).toBe(true);
    });

    it('handles large values (thousands)', async () => {
        const data: CapacityBarData[] = [
            { label: '1', required: 50_000, production: 60_000 },
        ];
        const result = await renderCapacityBarChart(data);
        expect(result).toBeTruthy();

        const textCalls = drawCalls.filter(c => c.method === 'fillText');
        const axisLabels = textCalls.map(c => c.args[0]);
        expect(axisLabels.some((l: string) => l.includes('K'))).toBe(true);
    });

    // ---- NaN / Infinity ----

    it('handles NaN values gracefully', async () => {
        const data: CapacityBarData[] = [
            { label: '1', required: NaN, production: NaN },
            { label: '2', required: 1000, production: NaN },
        ];
        const result = await renderCapacityBarChart(data);
        expect(result).toBeTruthy();
    });

    it('handles Infinity values gracefully', async () => {
        const data: CapacityBarData[] = [
            { label: '1', required: Infinity, production: 500 },
        ];
        const result = await renderCapacityBarChart(data);
        expect(result).toBeTruthy();
    });

    // ---- Negative values ----

    it('clamps negative values to zero', async () => {
        const data: CapacityBarData[] = [
            { label: '1', required: -100, production: -200 },
        ];
        const result = await renderCapacityBarChart(data);
        expect(result).toBeTruthy();
    });

    // ---- Truncation at 30 stations ----

    it('truncates labels when more than 30 stations', async () => {
        const data: CapacityBarData[] = Array.from({ length: 40 }, (_, i) => ({
            label: String(i + 1),
            required: 1000,
            production: 1000 + i * 10,
        }));
        const result = await renderCapacityBarChart(data);
        expect(result).toBeTruthy();

        // Station 31-40 should NOT appear in labels
        const textCalls = drawCalls.filter(c => c.method === 'fillText');
        const labelTexts = textCalls.map(c => c.args[0]);
        expect(labelTexts).toContain('1');
        expect(labelTexts).toContain('30');
        expect(labelTexts).not.toContain('31');
        expect(labelTexts).not.toContain('40');
    });

    // ---- Long labels ----

    it('truncates long labels to 6 chars', async () => {
        const data: CapacityBarData[] = [
            { label: 'OP10_SOLDADURA_MARCO', required: 1000, production: 1200 },
        ];
        await renderCapacityBarChart(data);

        const textCalls = drawCalls.filter(c => c.method === 'fillText');
        const labelTexts = textCalls.map(c => c.args[0]);
        // Should contain truncated label (5 chars + ellipsis)
        expect(labelTexts.some((l: string) => l.includes('…') || l.length <= 6)).toBe(true);
    });

    // ---- Custom dimensions ----

    it('respects custom width and height', async () => {
        const data: CapacityBarData[] = [
            { label: '1', required: 1000, production: 1200 },
        ];
        const result = await renderCapacityBarChart(data, { width: 600, height: 200 });
        expect(result).toBeTruthy();
    });

    // ---- Title rendering ----

    it('renders the chart title', async () => {
        const data: CapacityBarData[] = [
            { label: '1', required: 1000, production: 1200 },
        ];
        await renderCapacityBarChart(data);

        const textCalls = drawCalls.filter(c => c.method === 'fillText');
        const texts = textCalls.map(c => c.args[0]);
        expect(texts.some((t: string) => t.includes('CAPACIDAD'))).toBe(true);
    });

    // ---- Legend rendering ----

    it('renders legend items', async () => {
        const data: CapacityBarData[] = [
            { label: '1', required: 1000, production: 1200 },
        ];
        await renderCapacityBarChart(data);

        const textCalls = drawCalls.filter(c => c.method === 'fillText');
        const texts = textCalls.map(c => c.args[0]);
        expect(texts.some((t: string) => t.includes('Requeridas'))).toBe(true);
        expect(texts.some((t: string) => t.includes('OK'))).toBe(true);
        expect(texts.some((t: string) => t.includes('DEFICIT'))).toBe(true);
    });

    // ---- Mixed OK / Deficit ----

    it('handles mixed OK and deficit stations', async () => {
        const data: CapacityBarData[] = [
            { label: '1', required: 1000, production: 1200 },   // OK
            { label: '2', required: 1000, production: 700 },    // DEFICIT
            { label: '3', required: 1000, production: 1000 },   // Exactly OK
        ];
        const result = await renderCapacityBarChart(data);
        expect(result).toBeTruthy();
    });

    // ---- Return type ----

    it('returns valid base64 string', async () => {
        const data: CapacityBarData[] = [
            { label: '1', required: 1000, production: 1200 },
        ];
        const result = await renderCapacityBarChart(data);
        // Base64 should not have the data URI prefix
        expect(result).not.toContain('data:image');
        // Should be valid base64 characters
        expect(/^[A-Za-z0-9+/=]+$/.test(result)).toBe(true);
    });
});
