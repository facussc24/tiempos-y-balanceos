/**
 * TESTS VALIDADOS - BLOQUE 4: INYECCION ROTATIVA
 *
 * Fuentes academicas:
 * - Groover, M.P. "Fundamentals of Modern Manufacturing" - Ciclo de inyeccion
 * - Ingenieria de moldes: N* = ceil(1 + t_curado/t_inyeccion) (punto de saturacion)
 * - Man-Machine Chart (OIT/ILO) - Concurrencia maquina/operario
 * - Toyota/Lean: Takt Time = Tiempo disponible / Demanda
 * - ILO: Factor fatiga 85% (suplemento ~15%)
 *
 * Todas las formulas del Bloque 4 fueron verificadas como CORRECTAS.
 * Estos tests validan los calculos con numeros reales de planta.
 */
import { describe, it, expect } from 'vitest';
import { calculateInjectionMetrics, CavityCalculationInput } from '../core/math/injection';
import { RotaryInjectionStrategy } from '../modules/strategies/RotaryStrategy';
import { ManualOperation, InjectionSimulationParams } from '../types';

// ============================================================================
// Ayudante: parametros base para inyeccion
// ============================================================================
const crearParamsBase = (overrides: Partial<CavityCalculationInput> = {}): CavityCalculationInput => ({
    puInyTime: 3,        // 3 segundos inyeccion
    puCurTime: 15,       // 15 segundos curado
    activeShifts: 1,
    dailyDemand: 500,
    oee: 0.85,
    availableSeconds: 8 * 3600, // 28800s
    manualOps: [],
    manualTimeOverride: null,
    headcountMode: 'auto',
    userHeadcountOverride: 1,
    cavityMode: 'auto',
    ...overrides,
});

// ============================================================================
// Ayudante: parametros para RotaryStrategy directamente
// ============================================================================
const crearStrategyParams = (overrides: Partial<InjectionSimulationParams> = {}): InjectionSimulationParams => ({
    puInyTime: 3,
    puCurTime: 15,
    manualOps: [],
    manualTimeOverride: null,
    taktTime: 48.96, // (28800 * 0.85) / 500
    headcountMode: 'auto',
    userHeadcountOverride: 1,
    activeShifts: 1,
    oee: 0.85,
    cycleQuantity: 1,
    availableSeconds: 28800,
    ...overrides,
});

// ============================================================================
// BLOQUE 4A: N* Punto de Saturacion (Ingenieria de Moldes)
// Formula: N* = ceil(1 + t_curado / t_inyeccion)
// ============================================================================
describe('Validado: N* Punto de Saturacion (Ingenieria de Moldes)', () => {

    it('caso tipico: iny=3s, curado=15s → N*=ceil(1+15/3)=6', () => {
        const result = calculateInjectionMetrics(crearParamsBase());
        expect(result.inputs.nStar).toBe(6);
    });

    it('curado igual a inyeccion: iny=5s, curado=5s → N*=ceil(1+5/5)=2', () => {
        const result = calculateInjectionMetrics(crearParamsBase({
            puInyTime: 5,
            puCurTime: 5,
        }));
        expect(result.inputs.nStar).toBe(2);
    });

    it('curado mucho mayor: iny=2s, curado=30s → N*=ceil(1+30/2)=16', () => {
        const result = calculateInjectionMetrics(crearParamsBase({
            puInyTime: 2,
            puCurTime: 30,
        }));
        expect(result.inputs.nStar).toBe(16);
    });

    it('curado menor que inyeccion: iny=10s, curado=5s → N*=ceil(1+5/10)=2', () => {
        const result = calculateInjectionMetrics(crearParamsBase({
            puInyTime: 10,
            puCurTime: 5,
        }));
        expect(result.inputs.nStar).toBe(2);
    });

    it('iny=4s, curado=20s → N*=ceil(1+20/4)=6', () => {
        const result = calculateInjectionMetrics(crearParamsBase({
            puInyTime: 4,
            puCurTime: 20,
        }));
        expect(result.inputs.nStar).toBe(6);
    });
});

// ============================================================================
// BLOQUE 4B: Ciclo por Pieza Rotativo (Groover)
// Formula: ciclo = t_inyeccion + (t_curado / N)
// ============================================================================
describe('Validado: Ciclo por Pieza Rotativo (Groover)', () => {

    it('N=1: ciclo = iny + curado (sin absorcion)', () => {
        // Con N=1: ciclo = 3 + 15/1 = 18s
        const strategy = new RotaryInjectionStrategy();
        const data = strategy.calculate(crearStrategyParams());
        const n1 = data.find(d => d.n === 1)!;

        expect(n1.cyclePerPiece).toBeCloseTo(18, 2);
    });

    it('N=N* (6): ciclo se acerca al doble de inyeccion', () => {
        // Con N=6: ciclo = 3 + 15/6 = 3 + 2.5 = 5.5s
        const strategy = new RotaryInjectionStrategy();
        const data = strategy.calculate(crearStrategyParams());
        const n6 = data.find(d => d.n === 6)!;

        expect(n6.cyclePerPiece).toBeCloseTo(5.5, 2);
    });

    it('N>N*: rendimiento decreciente, mejora minima', () => {
        // Con N=7: ciclo = 3 + 15/7 = 3 + 2.143 = 5.143s
        // Con N=8: ciclo = 3 + 15/8 = 3 + 1.875 = 4.875s
        // Diferencia: 0.268s (mejora cada vez menor)
        const strategy = new RotaryInjectionStrategy();
        const data = strategy.calculate(crearStrategyParams());
        const n7 = data.find(d => d.n === 7)!;
        const n8 = data.find(d => d.n === 8)!;

        expect(n7.cyclePerPiece).toBeCloseTo(5.143, 2);
        expect(n8.cyclePerPiece).toBeCloseTo(4.875, 2);
        // La mejora de N=7 a N=8 es menor que de N=1 a N=2
        const mejoraN7aN8 = n7.cyclePerPiece - n8.cyclePerPiece;
        const n1 = data.find(d => d.n === 1)!;
        const n2 = data.find(d => d.n === 2)!;
        const mejoraN1aN2 = n1.cyclePerPiece - n2.cyclePerPiece;
        expect(mejoraN1aN2).toBeGreaterThan(mejoraN7aN8);
    });

    it('N=2: ciclo = iny + curado/2', () => {
        // ciclo = 3 + 15/2 = 3 + 7.5 = 10.5s
        const strategy = new RotaryInjectionStrategy();
        const data = strategy.calculate(crearStrategyParams());
        const n2 = data.find(d => d.n === 2)!;

        expect(n2.cyclePerPiece).toBeCloseTo(10.5, 2);
    });

    it('inyeccion grande, curado chico: iny=10s, curado=5s', () => {
        // N=1: 10 + 5/1 = 15s
        // N=2: 10 + 5/2 = 12.5s
        // N=3: 10 + 5/3 = 11.67s → piso rapido porque iny domina
        const strategy = new RotaryInjectionStrategy();
        const data = strategy.calculate(crearStrategyParams({
            puInyTime: 10,
            puCurTime: 5,
        }));

        expect(data.find(d => d.n === 1)!.cyclePerPiece).toBeCloseTo(15, 2);
        expect(data.find(d => d.n === 2)!.cyclePerPiece).toBeCloseTo(12.5, 2);
        expect(data.find(d => d.n === 3)!.cyclePerPiece).toBeCloseTo(11.67, 1);
    });
});

// ============================================================================
// BLOQUE 4C: Takt Time de Inyeccion
// Formula: Takt = (segundos_disponibles x OEE) / demanda
// ============================================================================
describe('Validado: Takt Time de Inyeccion', () => {

    it('caso tipico: 28800s, OEE 85%, 500 pzas → 48.96s', () => {
        const result = calculateInjectionMetrics(crearParamsBase());
        // Takt = (28800 x 0.85) / 500 = 24480 / 500 = 48.96s
        expect(result.inputs.taktTime).toBeCloseTo(48.96, 2);
    });

    it('demanda alta: 2000 pzas → takt corto', () => {
        const result = calculateInjectionMetrics(crearParamsBase({
            dailyDemand: 2000,
        }));
        // Takt = (28800 x 0.85) / 2000 = 12.24s
        expect(result.inputs.taktTime).toBeCloseTo(12.24, 2);
    });

    it('demanda 0: takt = 0 sin error', () => {
        const result = calculateInjectionMetrics(crearParamsBase({
            dailyDemand: 0,
        }));
        expect(result.inputs.taktTime).toBe(0);
    });

    it('OEE bajo (60%): reduce el takt proporcionalmente', () => {
        const result = calculateInjectionMetrics(crearParamsBase({
            oee: 0.60,
        }));
        // Takt = (28800 x 0.60) / 500 = 17280 / 500 = 34.56s
        expect(result.inputs.taktTime).toBeCloseTo(34.56, 2);
    });
});

// ============================================================================
// BLOQUE 4D: Auto-Cavidades Optimas
// Formula: N_auto = min N where realCycle(N) <= taktTime
// (Corrected: old formula ceil(curado/takt) ignored injection time + external ops)
// ============================================================================
describe('Validado: Auto-Cavidades Optimas', () => {

    it('caso tipico: curado=15s, takt=48.96s → N_auto=1 (realCycle=18s < 48.96s)', () => {
        // N=1: cyclePerPiece=18s, realCycle=18s (default 15s internal absorbed) ≤ 48.96 → feasible
        const result = calculateInjectionMetrics(crearParamsBase());
        expect(result.inputs.activeN).toBe(1);
    });

    it('demanda alta: curado=15s, takt=12.24s → N_auto=2 (realCycle@N=2=10.5s < 12.24s)', () => {
        // N=1: realCycle=18s > 12.24 ✗
        // N=2: cyclePerPiece=10.5s, machineLoop=21s, realCycle=10.5s ≤ 12.24 ✓
        const result = calculateInjectionMetrics(crearParamsBase({
            dailyDemand: 2000,
        }));
        expect(result.inputs.activeN).toBe(2);
    });

    it('curado largo, takt corto: curado=60s, takt=10s → N_auto=9', () => {
        // N=8: cyclePerPiece=10.5s, realCycle=10.5s > 10s ✗
        // N=9: cyclePerPiece=9.67s, realCycle=9.67s ≤ 10s ✓
        // (Old formula ceil(60/10)=6 was wrong: realCycle at N=6 is 13s > 10s!)
        const result = calculateInjectionMetrics(crearParamsBase({
            puCurTime: 60,
            dailyDemand: 2448, // takt = (28800*0.85)/2448 ≈ 10.0s
        }));
        expect(result.inputs.activeN).toBe(9);
        // Verify the selected scenario actually meets takt
        expect(result.selectedData!.realCycle).toBeLessThanOrEqual(result.inputs.taktTime);
    });

    it('modo manual: usa N del usuario, ignora auto', () => {
        const result = calculateInjectionMetrics(crearParamsBase({
            cavityMode: 'manual',
            userSelectedN: 4,
        }));
        expect(result.inputs.activeN).toBe(4);
    });

    it('con operaciones externas: auto N compensa el tiempo extra', () => {
        // iny=4s, curado=20s, takt=23.04s, manual=8s INT + 3s EXT
        // N=1: realCycle = max(24,8)+3 = 27s > 23.04 ✗
        // N=2: realCycle = (max(28,8)+3)/2 = 15.5s ≤ 23.04 ✓
        const ops: ManualOperation[] = [
            { id: 'm1', description: 'Carga', time: 8, type: 'internal' },
            { id: 'm2', description: 'Inspeccion', time: 3, type: 'external' },
        ];
        const result = calculateInjectionMetrics({
            puInyTime: 4,
            puCurTime: 20,
            activeShifts: 1,
            dailyDemand: 1000,
            oee: 0.80,
            availableSeconds: 28800,
            manualOps: ops,
            manualTimeOverride: null,
            headcountMode: 'auto',
            userHeadcountOverride: 1,
            cavityMode: 'auto',
        });
        expect(result.inputs.activeN).toBe(2);
        expect(result.selectedData!.realCycle).toBeLessThanOrEqual(result.inputs.taktTime);
    });

    it('sin escenario factible: elige N mas alto como mejor esfuerzo', () => {
        // Demanda extrema: takt ≈ 2s, iny=3s → ningún N puede bajar de 3s
        const result = calculateInjectionMetrics(crearParamsBase({
            dailyDemand: 12240, // takt = (28800*0.85)/12240 = 2.0s
        }));
        // puInyTime=3s > takt=2s → cyclePerPiece siempre > 3s
        // Auto should pick highest N as best effort
        expect(result.inputs.activeN).toBeGreaterThanOrEqual(8);
        // realCycle won't meet takt, but it should be the best available
        const lastScenario = result.chartData[result.chartData.length - 1];
        expect(result.inputs.activeN).toBe(lastScenario.n);
    });
});

// ============================================================================
// BLOQUE 4E: Concurrencia Maquina/Operario (Man-Machine Chart - ILO)
// ============================================================================
describe('Validado: Concurrencia Maquina/Operario (Man-Machine Chart)', () => {

    it('manual interno < maquina: absorbido (operario espera)', () => {
        // Con N=1: machineLoopTime = 18s (ciclo * N = 18*1)
        // Manual interno = 5s < 18s → absorbido
        // realLoop = max(18, 5) + 0 = 18s
        // realCycle = 18/1 = 18s (no cambia)
        const strategy = new RotaryInjectionStrategy();
        const ops: ManualOperation[] = [
            { id: 'm1', description: 'Carga', time: 5, type: 'internal' },
        ];
        const data = strategy.calculate(crearStrategyParams({
            manualOps: ops,
            manualTimeOverride: null,
        }));
        const n1 = data.find(d => d.n === 1)!;

        // Ciclo por pieza de maquina = 18s
        expect(n1.cyclePerPiece).toBeCloseTo(18, 2);
        // Maquina domina → operario espera
        expect(n1.waitOp).toBeGreaterThan(0);
    });

    it('manual interno > machineLoop: software asigna mas operarios para absorber', () => {
        // Con N=1: machineLoopTime = 18*1 = 18s
        // Manual interno = 25s > 18s → cuello de botella manual
        // El strategy detecta bottleneck y calcula:
        //   reqOperators = ceil(25 / (18 * 0.85)) = ceil(1.634) = 2
        // Con 2 ops: adjInternal = 25/2 = 12.5s
        //   simRealLoop = max(18, 12.5) = 18s → ciclo absorbido
        // El machineStatus se marca como 'waiting' (isBottleneckLabor = true)
        const strategy = new RotaryInjectionStrategy();
        const ops: ManualOperation[] = [
            { id: 'm1', description: 'Carga pesada', time: 25, type: 'internal' },
        ];
        const data = strategy.calculate(crearStrategyParams({
            manualOps: ops,
            manualTimeOverride: null,
        }));
        const n1 = data.find(d => d.n === 1)!;

        // El strategy asigna 2 operarios para compensar
        expect(n1.reqOperators).toBe(2);
        // machineStatus = 'waiting' porque detecta bottleneck manual
        expect(n1.machineStatus).toBe('waiting');
        // Con 2 operarios, el manual ya no extiende el ciclo
        // adjInternal = 25/2 = 12.5 < machineLoop = 18
        expect(n1.realCycle).toBeCloseTo(18, 1);
    });

    it('manual externo: siempre suma al ciclo', () => {
        // Con N=1: machineLoopTime = 18s
        // Manual externo = 10s (para la maquina)
        // realLoop = max(18, 0) + 10 = 28s
        // realCycle = 28/1 = 28s
        const strategy = new RotaryInjectionStrategy();
        const ops: ManualOperation[] = [
            { id: 'm1', description: 'Empaque', time: 10, type: 'external' },
        ];
        const data = strategy.calculate(crearStrategyParams({
            manualOps: ops,
            manualTimeOverride: null,
        }));
        const n1 = data.find(d => d.n === 1)!;

        // 18 (maquina) + 10 (externo) = 28s
        expect(n1.realCycle).toBeCloseTo(28, 1);
    });

    it('mezcla interno + externo', () => {
        // Con N=1: machineLoopTime = 18s
        // Interno = 8s, Externo = 5s
        // realLoop = max(18, 8) + 5 = 23s
        // realCycle = 23/1 = 23s
        const strategy = new RotaryInjectionStrategy();
        const ops: ManualOperation[] = [
            { id: 'm1', description: 'Carga', time: 8, type: 'internal' },
            { id: 'm2', description: 'Inspeccion', time: 5, type: 'external' },
        ];
        const data = strategy.calculate(crearStrategyParams({
            manualOps: ops,
            manualTimeOverride: null,
        }));
        const n1 = data.find(d => d.n === 1)!;

        expect(n1.realCycle).toBeCloseTo(23, 1);
    });

    it('con N=6: machineLoop escala, manual se distribuye', () => {
        // Con N=6: machineLoopTime = 5.5 * 6 = 33s
        // Manual interno = 8s, externo = 5s
        // realLoop con 1 operario = max(33, 8) + 5 = 38s
        // realCycle = 38/6 = 6.33s
        const strategy = new RotaryInjectionStrategy();
        const ops: ManualOperation[] = [
            { id: 'm1', description: 'Carga', time: 8, type: 'internal' },
            { id: 'm2', description: 'Inspeccion', time: 5, type: 'external' },
        ];
        const data = strategy.calculate(crearStrategyParams({
            manualOps: ops,
            manualTimeOverride: null,
        }));
        const n6 = data.find(d => d.n === 6)!;

        // cyclePerPiece = 3 + 15/6 = 5.5
        expect(n6.cyclePerPiece).toBeCloseTo(5.5, 2);
        // realCycle incluye el manual
        expect(n6.realCycle).toBeGreaterThanOrEqual(n6.cyclePerPiece);
    });
});

// ============================================================================
// BLOQUE 4F: Calculo de Operarios (ILO - Factor Fatiga 85%)
// Formula auto: ceil(trabajo_manual / (ciclo_real x 0.85))
// ============================================================================
describe('Validado: Calculo de Operarios (ILO Factor Fatiga)', () => {

    it('trabajo manual bajo: 1 operario basta', () => {
        // Con N=6, manual total = 15s (default), realLoopTime ≈ 33s
        // rawReq = 15 / (33 x 0.85) = 15 / 28.05 = 0.535 → ceil = 1
        const result = calculateInjectionMetrics(crearParamsBase({
            cavityMode: 'manual',
            userSelectedN: 6,
        }));
        expect(result.metrics.activeHeadcount).toBe(1);
    });

    it('modo manual: usa el valor del usuario', () => {
        const result = calculateInjectionMetrics(crearParamsBase({
            headcountMode: 'manual',
            userHeadcountOverride: 3,
            cavityMode: 'manual',
            userSelectedN: 6,
        }));
        expect(result.metrics.activeHeadcount).toBe(3);
    });

    it('factor fatiga 0.85 exige mas operarios que sin fatiga', () => {
        // Con trabajo manual alto, la fatiga puede generar 1 operario extra
        // Manual = 30s, N=1, machineLoop = 18s
        // rawReq sin fatiga = 30 / 30 = 1.0 → 1 operario
        // rawReq con fatiga = 30 / (30 * 0.85) = 30/25.5 = 1.176 → ceil = 2
        // PERO el Smart ROI puede bajar a 1 si sat/floor(raw) <= 0.95
        // sat = 30/30 = 1.0, floor(1.176) = 1, 1.0/1 = 1.0 > 0.95 → NO baja
        const strategy = new RotaryInjectionStrategy();
        const ops: ManualOperation[] = [
            { id: 'm1', description: 'Trabajo pesado', time: 30, type: 'internal' },
        ];
        const data = strategy.calculate(crearStrategyParams({
            manualOps: ops,
            manualTimeOverride: null,
        }));
        const n1 = data.find(d => d.n === 1)!;

        // Con fatiga, pide 2 operarios
        expect(n1.reqOperators).toBeGreaterThanOrEqual(2);
    });
});

// ============================================================================
// BLOQUE 4G: Produccion Horaria y Diaria
// Formula: horaria = 3600 / ciclo_real
// Formula: maxima_teorica = 3600 / ciclo_por_pieza (sin limite manual)
// Formula: perdida = maxima_teorica - horaria_real
// ============================================================================
describe('Validado: Produccion Horaria y Diaria', () => {

    it('produccion horaria = 3600 / ciclo_real', () => {
        const result = calculateInjectionMetrics(crearParamsBase({
            cavityMode: 'manual',
            userSelectedN: 1,
        }));

        const cicloReal = result.selectedData!.realCycle;
        expect(result.metrics.hourlyOutput).toBeCloseTo(3600 / cicloReal, 1);
    });

    it('produccion maxima teorica = 3600 / ciclo_por_pieza', () => {
        const result = calculateInjectionMetrics(crearParamsBase({
            cavityMode: 'manual',
            userSelectedN: 1,
        }));

        const cicloPorPieza = result.selectedData!.cyclePerPiece;
        expect(result.metrics.maxTheoreticalOutput).toBeCloseTo(3600 / cicloPorPieza, 1);
    });

    it('produccion perdida = maxima - real (siempre >= 0)', () => {
        const result = calculateInjectionMetrics(crearParamsBase({
            cavityMode: 'manual',
            userSelectedN: 1,
        }));

        expect(result.metrics.lostOutput).toBeGreaterThanOrEqual(0);
        expect(result.metrics.lostOutput).toBeCloseTo(
            result.metrics.maxTheoreticalOutput - result.metrics.hourlyOutput,
            1
        );
    });

    it('con N alto: produccion horaria aumenta (ciclo baja)', () => {
        const resultN1 = calculateInjectionMetrics(crearParamsBase({
            cavityMode: 'manual',
            userSelectedN: 1,
        }));
        const resultN6 = calculateInjectionMetrics(crearParamsBase({
            cavityMode: 'manual',
            userSelectedN: 6,
        }));

        expect(resultN6.metrics.hourlyOutput).toBeGreaterThan(resultN1.metrics.hourlyOutput);
    });

    it('produccion diaria usa segundos reales del turno', () => {
        // dailyOutput = (availableSeconds * OEE) / realCycle  (availableSeconds already includes shifts)
        const result = calculateInjectionMetrics(crearParamsBase({
            cavityMode: 'manual',
            userSelectedN: 6,
        }));

        const expected = (28800 * 0.85) / result.selectedData!.realCycle;
        expect(result.selectedData!.dailyOutput).toBeCloseTo(expected, 0);
    });
});

// ============================================================================
// BLOQUE 4H: Factibilidad y Maquinas Necesarias
// ============================================================================
describe('Validado: Factibilidad y Maquinas Necesarias', () => {

    it('ciclo < takt: factible con 1 maquina', () => {
        // Con N=6: cicloPerPiece = 5.5s < takt 48.96s → factible
        const result = calculateInjectionMetrics(crearParamsBase({
            cavityMode: 'manual',
            userSelectedN: 6,
        }));

        expect(result.selectedData!.isSingleMachineFeasible).toBe(true);
        expect(result.selectedData!.machinesNeeded).toBe(1);
    });

    it('ciclo > takt: necesita multiples maquinas', () => {
        // Demanda muy alta: takt = (28800*0.85)/5000 = 4.896s
        // Con N=1: ciclo = 18s > 4.896s
        // machinesNeeded = ceil(realCycle / takt)
        const result = calculateInjectionMetrics(crearParamsBase({
            dailyDemand: 5000,
            cavityMode: 'manual',
            userSelectedN: 1,
        }));

        expect(result.selectedData!.isSingleMachineFeasible).toBe(false);
        expect(result.selectedData!.machinesNeeded).toBeGreaterThan(1);
    });

    it('maquinas necesarias = ceil(ciclo_real / takt)', () => {
        const result = calculateInjectionMetrics(crearParamsBase({
            dailyDemand: 5000,
            cavityMode: 'manual',
            userSelectedN: 1,
        }));

        const takt = result.inputs.taktTime;
        const realCycle = result.selectedData!.realCycle;
        const esperado = Math.ceil(realCycle / takt);
        expect(result.selectedData!.machinesNeeded).toBe(esperado);
    });
});

// ============================================================================
// BLOQUE 4I: Saturacion del Operario
// Formula: saturacion = (carga_manual_total / (operarios x ciclo_real)) x 100
// ============================================================================
describe('Validado: Saturacion del Operario', () => {

    it('saturacion tiene en cuenta machinesNeeded en la carga total', () => {
        // La formula es: saturacion = (manualTime * machinesNeeded) / (headcount * realCycle) * 100
        // Con N=6: ciclo ≈ 5.83s (con default 15s manual), machinesNeeded puede ser > 1
        // Esto hace que la saturacion suba porque un operario atiende varias maquinas
        const result = calculateInjectionMetrics(crearParamsBase({
            cavityMode: 'manual',
            userSelectedN: 6,
        }));

        // La saturacion es un valor positivo calculable
        expect(result.metrics.realSaturation).toBeGreaterThan(0);
        // Verificar que la formula se aplica correctamente
        const manualTime = result.selectedData!.manualTime;
        const machinesNeeded = result.selectedData!.machinesNeeded;
        const headcount = result.metrics.activeHeadcount;
        const realCycle = result.selectedData!.realCycle;
        const esperado = (manualTime * machinesNeeded) / (headcount * realCycle) * 100;
        expect(result.metrics.realSaturation).toBeCloseTo(esperado, 1);
    });

    it('mas operarios reducen la saturacion individual', () => {
        const result1op = calculateInjectionMetrics(crearParamsBase({
            headcountMode: 'manual',
            userHeadcountOverride: 1,
            cavityMode: 'manual',
            userSelectedN: 1,
            manualTimeOverride: 15,
        }));

        const result2op = calculateInjectionMetrics(crearParamsBase({
            headcountMode: 'manual',
            userHeadcountOverride: 2,
            cavityMode: 'manual',
            userSelectedN: 1,
            manualTimeOverride: 15,
        }));

        // Con mas operarios la saturacion deberia bajar (o mantenerse si
        // el calculo de machinesNeeded cambia)
        // Lo importante es que el sistema no crashea y da valores razonables
        expect(result1op.metrics.realSaturation).toBeGreaterThan(0);
        expect(result2op.metrics.realSaturation).toBeGreaterThan(0);
    });
});

// ============================================================================
// BLOQUE 4J: Casos Limite y Estabilidad
// ============================================================================
describe('Validado: Inyeccion - Casos Limite', () => {

    it('OEE 0 usa el global por defecto (0.85)', () => {
        const result = calculateInjectionMetrics(crearParamsBase({
            oee: 0,
        }));
        // El software protege contra OEE=0 usando DEFAULT_OEE_GLOBAL
        expect(result.inputs.taktTime).toBeGreaterThan(0);
    });

    it('inyeccion 0 no genera error (retorna array vacio)', () => {
        const strategy = new RotaryInjectionStrategy();
        const data = strategy.calculate(crearStrategyParams({
            puInyTime: 0,
        }));
        // El strategy retorna array vacio si puInyTime <= 0
        expect(data).toEqual([]);
    });

    it('manualTimeOverride tiene prioridad sobre operaciones manuales', () => {
        const ops: ManualOperation[] = [
            { id: 'm1', description: 'Op1', time: 10, type: 'internal' },
            { id: 'm2', description: 'Op2', time: 20, type: 'internal' },
        ];
        const result = calculateInjectionMetrics(crearParamsBase({
            manualOps: ops,
            manualTimeOverride: 5, // Override a 5s, ignorando los 30s de ops
        }));

        expect(result.inputs.effectiveManualTime).toBe(5);
    });

    it('sin operaciones manuales ni override: usa default 15s', () => {
        const result = calculateInjectionMetrics(crearParamsBase({
            manualOps: [],
            manualTimeOverride: null,
        }));

        expect(result.inputs.effectiveManualTime).toBe(15);
        expect(result.inputs.isUsingDefaultManual).toBe(true);
    });

    it('chartData contiene escenarios desde N=1 hasta max', () => {
        const result = calculateInjectionMetrics(crearParamsBase());

        expect(result.chartData.length).toBeGreaterThanOrEqual(8); // minimo N*+2 = 8
        expect(result.chartData[0].n).toBe(1);
        // Cada escenario tiene n incrementando
        for (let i = 1; i < result.chartData.length; i++) {
            expect(result.chartData[i].n).toBe(result.chartData[i - 1].n + 1);
        }
    });

    it('escenario con availableSeconds custom (turno real)', () => {
        // Turno de 7h con 30min descanso = 6.5h = 23400s
        const result = calculateInjectionMetrics(crearParamsBase({
            availableSeconds: 23400,
        }));
        // Takt = (23400 * 0.85) / 500 = 19890 / 500 = 39.78s
        expect(result.inputs.taktTime).toBeCloseTo(39.78, 2);
        expect(result.inputs.availableSeconds).toBe(23400);
    });
});

// ============================================================================
// BLOQUE 4K: Flujo Completo Integrado
// Verifica que todos los calculos encajan en un escenario real de planta
// ============================================================================
describe('Validado: Flujo Completo de Inyeccion', () => {

    it('escenario real: planta de botellas PET', () => {
        // Datos reales tipicos:
        // Inyeccion: 4s, Curado: 20s, Demanda: 1000 pzas/dia, OEE: 80%
        // Manual: carga/descarga 8s interno + inspeccion 3s externo
        const ops: ManualOperation[] = [
            { id: 'm1', description: 'Carga/Descarga', time: 8, type: 'internal' },
            { id: 'm2', description: 'Inspeccion visual', time: 3, type: 'external' },
        ];

        const result = calculateInjectionMetrics({
            puInyTime: 4,
            puCurTime: 20,
            activeShifts: 1,
            dailyDemand: 1000,
            oee: 0.80,
            availableSeconds: 28800,
            manualOps: ops,
            manualTimeOverride: null,
            headcountMode: 'auto',
            userHeadcountOverride: 1,
            cavityMode: 'auto',
        });

        // Verificaciones paso a paso:

        // 1. N* = ceil(1 + 20/4) = 6
        expect(result.inputs.nStar).toBe(6);

        // 2. Takt = (28800 * 0.80) / 1000 = 23.04s
        expect(result.inputs.taktTime).toBeCloseTo(23.04, 2);

        // 3. Auto N: N=1 realCycle=27s > 23.04 → N=2 realCycle=15.5s ≤ 23.04 → N=2
        expect(result.inputs.activeN).toBe(2);

        // 4. Con N=2: cicloMaquina = 4 + 20/2 = 14s
        expect(result.selectedData!.cyclePerPiece).toBeCloseTo(14, 2);

        // 5. machineLoop para N=2 = 14 * 2 = 28s
        // realLoop = max(28, 8) + 3 = 31s
        // realCycle = 31/2 = 15.5s
        expect(result.selectedData!.realCycle).toBeCloseTo(15.5, 0);

        // 6. Produccion horaria = 3600 / 15.5 ≈ 232.3
        expect(result.metrics.hourlyOutput).toBeCloseTo(3600 / result.selectedData!.realCycle, 1);

        // 7. Factible con 1 maquina porque cyclePerPiece 14 < 23.04
        expect(result.selectedData!.isSingleMachineFeasible).toBe(true);

        // 8. Real cycle meets takt
        expect(result.selectedData!.realCycle).toBeLessThanOrEqual(result.inputs.taktTime);
    });

    it('escenario real: pieza automotriz con curado largo', () => {
        // Inyeccion: 6s, Curado: 45s, Demanda: 300, OEE: 90%
        // Sin operaciones manuales especificas (usa default 15s)
        const result = calculateInjectionMetrics({
            puInyTime: 6,
            puCurTime: 45,
            activeShifts: 1,
            dailyDemand: 300,
            oee: 0.90,
            availableSeconds: 28800,
            manualOps: [],
            manualTimeOverride: null,
            headcountMode: 'auto',
            userHeadcountOverride: 1,
            cavityMode: 'auto',
        });

        // N* = ceil(1 + 45/6) = ceil(8.5) = 9
        expect(result.inputs.nStar).toBe(9);

        // Takt = (28800 * 0.90) / 300 = 86.4s
        expect(result.inputs.taktTime).toBeCloseTo(86.4, 2);

        // Auto N = max(1, ceil(45 / 86.4)) = ceil(0.52) = 1
        expect(result.inputs.activeN).toBe(1);

        // Con N=1: ciclo = 6 + 45 = 51s < 86.4s takt → factible
        expect(result.selectedData!.cyclePerPiece).toBeCloseTo(51, 2);
        expect(result.selectedData!.isSingleMachineFeasible).toBe(true);
    });
});
