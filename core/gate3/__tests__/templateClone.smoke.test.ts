/**
 * Smoke test: el approach de template-cloning con xlsx-populate
 * preserva chart/logo/estilos del template VW oficial e inyecta valores en las
 * celdas correctas.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-ignore — sin types
import XlsxPopulate from 'xlsx-populate';

const TEMPLATE = resolve(process.cwd(), 'src/assets/templates/gate3_template.xlsx');

describe('Gate3 template-clone — smoke', () => {
    it('el template oficial existe y carga', async () => {
        const buf = await readFile(TEMPLATE);
        expect(buf.byteLength).toBeGreaterThan(50_000); // template real pesa ~130 KB
        const wb = await XlsxPopulate.fromDataAsync(buf);
        const sheets = wb.sheets().map((s: any) => s.name());
        expect(sheets).toEqual(
            expect.arrayContaining([
                'OEE CalculatorSFN',
                'CapacitySFN',
                'DiagramSFN',
                'Observaciones',
                'Protocolo_SFN1',
                'Acc. certificate PCA1 pre-check',
                'Acceptance certificate_PCA2_3',
                'Tabelle1',
            ]),
        );
    });

    it('inyectar valores en celdas de input no rompe las formulas existentes', async () => {
        const buf = await readFile(TEMPLATE);
        const wb = await XlsxPopulate.fromDataAsync(buf);
        // Setea inputs Station 1 (Mesa de corte del ejemplo VW)
        const oee = wb.sheet('OEE CalculatorSFN');
        oee.cell('E13').value(480); // observation time
        oee.cell('E14').value(300); // cycle time
        oee.cell('E15').value(12); // cavities
        oee.cell('E17').value(30); // downtime
        oee.cell('E18').value(979); // OK
        oee.cell('E19').value(3); // NOK
        // Las celdas E20 (avail), E21 (perf), E22 (qual), E23 (OEE) son formulas — verificar que sigan siendo formulas
        const e20 = oee.cell('E20').formula();
        const e23 = oee.cell('E23').formula();
        expect(e20).toBeTruthy();
        expect(e23).toBeTruthy();
        // Output del workbook debe ser un buffer valido
        const out: ArrayBuffer = await wb.outputAsync('arraybuffer');
        expect(out.byteLength).toBeGreaterThan(50_000);
    });

    it('el header de CapacitySFN acepta strings', async () => {
        const buf = await readFile(TEMPLATE);
        const wb = await XlsxPopulate.fromDataAsync(buf);
        const cap = wb.sheet('CapacitySFN');
        cap.cell('C5').value('IP_PAD_PL0');
        cap.cell('C6').value('Plate ASM IP CTR Outlet Air');
        expect(cap.cell('C5').value()).toBe('IP_PAD_PL0');
        expect(cap.cell('C6').value()).toBe('Plate ASM IP CTR Outlet Air');
    });
});
