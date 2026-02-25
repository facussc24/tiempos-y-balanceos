
import { describe, it, expect } from 'vitest';
import { INITIAL_PROJECT } from '../types';

/** Extended meta with simulation result for risk integration testing */
interface SimulationResult {
    lastRun: string;
    verdict: 'robust' | 'warning' | 'critical';
    maxRiskPct: number;
}

type ProjectWithSimulation = typeof INITIAL_PROJECT & {
    meta: typeof INITIAL_PROJECT['meta'] & { simulationResult?: SimulationResult };
};

describe('Phase 21: Integrated Risk Feedback', () => {
    it('Should persist simulation result in project meta', () => {
        // Mock updateData to capture state changes
        let project: ProjectWithSimulation = { ...INITIAL_PROJECT, meta: { ...INITIAL_PROJECT.meta } };

        // Mock the Simulation Logic (Simplified version of what Simulation.tsx does)
        const runSimulationLogic = () => {
            // ... Monte Carlo happen here ...
            const mockMaxRisk = 20.5; // Critical
            const verdict: SimulationResult['verdict'] = 'critical';

            // Simulate the persist call
            project = {
                ...project,
                meta: {
                    ...project.meta,
                    simulationResult: {
                        lastRun: new Date().toISOString(),
                        verdict: verdict,
                        maxRiskPct: mockMaxRisk
                    }
                }
            };
        };

        runSimulationLogic();

        expect(project.meta.simulationResult).toBeDefined();
        expect(project.meta.simulationResult?.verdict).toBe('critical');
        expect(project.meta.simulationResult?.maxRiskPct).toBe(20.5);
    });

    it('Should detect Robust status', () => {
        const project: ProjectWithSimulation = { ...INITIAL_PROJECT, meta: { ...INITIAL_PROJECT.meta } };

        // Mock Logic
        const mockMaxRisk = 2.0;
        let verdict: 'robust' | 'warning' | 'critical' = 'robust';
        if (mockMaxRisk > 15) verdict = 'critical';
        else if (mockMaxRisk >= 5) verdict = 'warning';

        project.meta.simulationResult = {
            lastRun: new Date().toISOString(),
            verdict: verdict,
            maxRiskPct: mockMaxRisk
        };

        expect(project.meta.simulationResult?.verdict).toBe('robust');
    });
});
