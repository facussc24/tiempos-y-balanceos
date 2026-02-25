/**
 * Mix Checksum Validation Tests
 * 
 * Tests for V8.3 integrity validation:
 * - generateProductChecksum
 * - verifyMixIntegrity
 */
import { describe, it, expect } from 'vitest';
import {
    generateProductChecksum,
    verifyMixIntegrity,
    ProductIntegrityStatus
} from '../utils/mixHelpers';
import { ProjectData, MixScenario, MixEnrichedProduct, INITIAL_PROJECT } from '../types';

// Helper to create mock project
function createMockProject(overrides?: Partial<ProjectData>): ProjectData {
    return {
        ...INITIAL_PROJECT,
        tasks: [
            {
                id: 'T1',
                description: 'Test Task 1',
                times: [30],
                averageTime: 30,
                standardTime: 30,
                ratingFactor: 100,
                fatigueCategory: 'standard',
                predecessors: [],
                successors: [],
                positionalWeight: 0,
                calculatedSuccessorSum: 0,
                executionMode: 'manual'
            }
        ],
        meta: {
            ...INITIAL_PROJECT.meta,
            dailyDemand: 1000,
            activeShifts: 1
        },
        ...overrides
    };
}

describe('Mix Checksum Validation (V8.3)', () => {

    describe('generateProductChecksum', () => {
        it('should generate consistent checksum for same product data', async () => {
            const project = createMockProject();
            const checksum1 = await generateProductChecksum(project);
            const checksum2 = await generateProductChecksum(project);

            expect(checksum1).toBe(checksum2);
            expect(checksum1).toHaveLength(64); // SHA-256 = 64 hex chars
        });

        it('should generate different checksum when task times change', async () => {
            const project1 = createMockProject({
                tasks: [{
                    id: 'T1',
                    description: 'Test',
                    times: [30],
                    averageTime: 30,
                    standardTime: 30,
                    ratingFactor: 100,
                    fatigueCategory: 'standard',
                    predecessors: [],
                    successors: [],
                    positionalWeight: 0,
                    calculatedSuccessorSum: 0,
                    executionMode: 'manual'
                }]
            });

            const project2 = createMockProject({
                tasks: [{
                    id: 'T1',
                    description: 'Test',
                    times: [45], // Different time
                    averageTime: 45,
                    standardTime: 45, // Different standard time
                    ratingFactor: 100,
                    fatigueCategory: 'standard',
                    predecessors: [],
                    successors: [],
                    positionalWeight: 0,
                    calculatedSuccessorSum: 0,
                    executionMode: 'manual'
                }]
            });

            const checksum1 = await generateProductChecksum(project1);
            const checksum2 = await generateProductChecksum(project2);

            expect(checksum1).not.toBe(checksum2);
        });

        it('should generate different checksum when demand changes', async () => {
            const project1 = createMockProject({ meta: { ...INITIAL_PROJECT.meta, dailyDemand: 1000 } });
            const project2 = createMockProject({ meta: { ...INITIAL_PROJECT.meta, dailyDemand: 2000 } });

            const checksum1 = await generateProductChecksum(project1);
            const checksum2 = await generateProductChecksum(project2);

            expect(checksum1).not.toBe(checksum2);
        });

        it('should NOT change checksum for non-critical changes like name', async () => {
            const project1 = createMockProject({
                meta: { ...INITIAL_PROJECT.meta, name: 'Project A', dailyDemand: 1000 }
            });
            const project2 = createMockProject({
                meta: { ...INITIAL_PROJECT.meta, name: 'Project B', dailyDemand: 1000 }
            });

            const checksum1 = await generateProductChecksum(project1);
            const checksum2 = await generateProductChecksum(project2);

            // Name shouldn't affect checksum since it doesn't affect balancing
            expect(checksum1).toBe(checksum2);
        });
    });

    describe('verifyMixIntegrity', () => {
        it('should return ok status when checksums match', async () => {
            const project = createMockProject();
            const checksum = await generateProductChecksum(project);

            const scenario: MixScenario = {
                type: 'mix_scenario',
                version: 1,
                name: 'Test',
                createdAt: new Date().toISOString(),
                createdBy: 'Test',
                products: [{
                    path: 'test/path.json',
                    demand: 1000,
                    sourceChecksum: checksum,
                    lastVerifiedAt: new Date().toISOString()
                }],
                totalDemand: 1000,
                integrityVersion: 1
            };

            const enrichedProject = project as MixEnrichedProduct;
            enrichedProject._mixPath = 'test/path.json';

            const result = await verifyMixIntegrity(scenario, [enrichedProject]);

            expect(result.isValid).toBe(true);
            expect(result.hasWarnings).toBe(false);
            expect(result.changes[0].status).toBe('ok');
        });

        it('should return modified status when checksums differ', async () => {
            const project = createMockProject();

            const scenario: MixScenario = {
                type: 'mix_scenario',
                version: 1,
                name: 'Test',
                createdAt: new Date().toISOString(),
                createdBy: 'Test',
                products: [{
                    path: 'test/path.json',
                    demand: 1000,
                    sourceChecksum: 'old-checksum-that-differs',
                    lastVerifiedAt: new Date().toISOString()
                }],
                totalDemand: 1000,
                integrityVersion: 1
            };

            const enrichedProject = project as MixEnrichedProduct;
            enrichedProject._mixPath = 'test/path.json';

            const result = await verifyMixIntegrity(scenario, [enrichedProject]);

            expect(result.isValid).toBe(true); // isValid = no missing files
            expect(result.hasWarnings).toBe(true); // hasWarnings = has modifications
            expect(result.changes[0].status).toBe('modified');
        });

        it('should return legacy status for scenarios without checksums', async () => {
            const project = createMockProject();

            const scenario: MixScenario = {
                type: 'mix_scenario',
                version: 1,
                name: 'Legacy Test',
                createdAt: new Date().toISOString(),
                createdBy: 'Test',
                products: [{
                    path: 'test/path.json',
                    demand: 1000
                    // No sourceChecksum - legacy scenario
                }],
                totalDemand: 1000
            };

            const enrichedProject = project as MixEnrichedProduct;
            enrichedProject._mixPath = 'test/path.json';

            const result = await verifyMixIntegrity(scenario, [enrichedProject]);

            expect(result.isValid).toBe(true);
            expect(result.hasWarnings).toBe(false);
            expect(result.changes[0].status).toBe('legacy');
        });

        it('should return missing status when product file is not loaded', async () => {
            const scenario: MixScenario = {
                type: 'mix_scenario',
                version: 1,
                name: 'Test',
                createdAt: new Date().toISOString(),
                createdBy: 'Test',
                products: [{
                    path: 'missing/path.json',
                    demand: 1000,
                    sourceChecksum: 'some-checksum'
                }],
                totalDemand: 1000,
                integrityVersion: 1
            };

            const result = await verifyMixIntegrity(scenario, []); // Empty products array

            expect(result.isValid).toBe(false); // Missing files = invalid
            expect(result.changes[0].status).toBe('missing');
        });
    });
});
