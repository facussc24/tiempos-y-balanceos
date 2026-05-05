/**
 * pfdStepsToZipFlow — Inverse converter for the zip renderer.
 *
 * Takes the flat PfdStep[] (Barack model) and produces the nested zip-style
 * structure that ZipFlowSequence expects. We carry every step's `id` through
 * as `srcId` so the renderer can route clicks back to the original PfdStep.
 *
 * Patterns recovered:
 *  - Consecutive steps with the same branchId → grouped into a `branches` block
 *  - Decision step with rejectDisposition='scrap' → branchSide: terminal SCRAP
 *  - Decision step with rejectDisposition='rework' → branchSide: terminal RETRABAJO
 *  - Decision step with rejectDisposition='rework_or_scrap' followed by
 *    consecutive isRework steps → branchSide.sequence with the rework chain
 *  - Step with isRework + reworkReturnStep → node.rework: { targetId, label }
 *
 * Edge cases that cannot be perfectly recovered (the flat model loses some
 * of the zip's nesting): we try to be reasonable and the editor stays usable.
 */
import type { PfdStep } from '../pfdTypes';

export interface ZipNodeRendered {
    /** Original PfdStep.id — used for click → select routing */
    srcId: string;
    type: 'operation' | 'op-ins' | 'transfer' | 'storage' | 'inspection' | 'condition' | 'terminal' | 'connector';
    stepId?: string;
    description?: string;
    /** Decision text (for type=condition) */
    labelCondition?: string;
    labelDown?: string;
    /** Lateral branch (rejection / connector / nested rework sequence) */
    branchSide?: {
        type?: 'terminal' | 'operation' | 'connector' | 'inspection';
        text?: string;
        stepId?: string;
        description?: string;
        labelNode?: string;
        direction?: 'left' | 'right';
        sequence?: ZipNodeRendered[];
    };
    /** Parallel branches (each entry is a vertical lane) */
    branches?: ZipNodeRendered[][];
    /** Rework loop (arrow returning to a previous OP) */
    rework?: { targetId: string; label?: string };
    /** Connector A/B coming IN to this node */
    incomingConnector?: string;
    /** Critical / classification badge — currently unused, reserved */
    critical?: boolean;
    criticalType?: string;
    /** Terminal-only label */
    text?: string;
}

function mapType(stepType: PfdStep['stepType']): ZipNodeRendered['type'] {
    switch (stepType) {
        case 'operation': return 'operation';
        case 'combined': return 'op-ins';
        case 'transport': return 'transfer';
        case 'storage': return 'storage';
        case 'inspection': return 'inspection';
        case 'decision': return 'condition';
        case 'delay': return 'inspection'; // closest visual proxy
        default: return 'operation';
    }
}

/** Strip the "OP " prefix for stepId (the zip shapes show just the number inside). */
function stripOpPrefix(stepNumber: string): string {
    if (!stepNumber) return '';
    return stepNumber.replace(/^OP\s+/i, '').trim();
}

function buildNodeFromStep(step: PfdStep): ZipNodeRendered {
    const type = mapType(step.stepType);
    const node: ZipNodeRendered = {
        srcId: step.id,
        type,
        stepId: stripOpPrefix(step.stepNumber),
        description: step.description,
    };

    // Decision text lives in description; expose as labelCondition for the renderer.
    if (type === 'condition') {
        node.labelCondition = step.description;
        node.description = undefined;
        node.labelDown = 'SI';
    }

    // Rework loop annotation
    if (step.isRework && step.reworkReturnStep) {
        node.rework = {
            targetId: stripOpPrefix(step.reworkReturnStep),
            label: `RETRABAJO (A ${step.reworkReturnStep})`,
        };
    }

    return node;
}

/**
 * Build the lateral branchSide for a decision based on its rejectDisposition.
 * For 'rework_or_scrap' we ALSO consume any immediately-following isRework
 * steps as the nested sequence (they are "the rework arm").
 */
function buildBranchSideForDecision(
    decision: PfdStep,
    flat: PfdStep[],
    decisionIndex: number,
): { branchSide?: ZipNodeRendered['branchSide']; consumedReworkSteps: number } {
    const disp = decision.rejectDisposition;
    if (!disp || disp === 'none') return { consumedReworkSteps: 0 };

    if (disp === 'scrap') {
        return {
            branchSide: { type: 'terminal', text: 'SCRAP', labelNode: 'NO' },
            consumedReworkSteps: 0,
        };
    }

    if (disp === 'sort') {
        return {
            branchSide: { type: 'terminal', text: 'SELECCION', labelNode: 'NO' },
            consumedReworkSteps: 0,
        };
    }

    if (disp === 'rework') {
        return {
            branchSide: { type: 'terminal', text: 'RETRABAJO', labelNode: 'NO' },
            consumedReworkSteps: 0,
        };
    }

    if (disp === 'rework_or_scrap') {
        // Look ahead for consecutive isRework steps belonging to this decision.
        // They form the lateral "rework chain" (with a final transfer that has
        // a `rework` annotation pointing back to the decision-target).
        const reworkSeq: ZipNodeRendered[] = [];
        let i = decisionIndex + 1;
        // First, an inner SCRAP/RETRABAJO-or-not decision is fictional — we just
        // build a single nested decision-or-scrap pattern visually.
        reworkSeq.push({
            srcId: `${decision.id}__virt_subdecision`,
            type: 'condition',
            labelCondition: '¿SE PUEDE RETRABAJAR?',
            labelDown: 'SI',
            branchSide: { type: 'terminal', text: 'SCRAP', labelNode: 'NO' },
        });
        let consumed = 0;
        while (i < flat.length && flat[i].isRework) {
            const rwStep = flat[i];
            reworkSeq.push(buildNodeFromStep(rwStep));
            consumed++;
            i++;
        }
        // If the rework chain ended with a transfer that has `rework` metadata,
        // the buildNodeFromStep already set it. Otherwise add a synthetic one.
        const last = reworkSeq[reworkSeq.length - 1];
        if (!last.rework) {
            reworkSeq.push({
                srcId: `${decision.id}__virt_return`,
                type: 'transfer',
                description: 'TRASLADO',
                rework: {
                    targetId: stripOpPrefix(decision.stepNumber),
                    label: `RETRABAJO (A ${decision.stepNumber})`,
                },
            });
        }
        return {
            branchSide: { labelNode: 'NO', sequence: reworkSeq },
            consumedReworkSteps: consumed,
        };
    }

    return { consumedReworkSteps: 0 };
}

/**
 * Group consecutive steps by branchId. Returns the segments in order:
 *  [
 *    { kind: 'main', steps: [...] },
 *    { kind: 'parallel', branches: [{branchId: 'A', steps: [...]}, {branchId: 'B', ...}] },
 *    { kind: 'main', steps: [...] },
 *  ]
 */
interface MainSegment { kind: 'main'; steps: PfdStep[]; }
interface ParallelSegment { kind: 'parallel'; branches: { branchId: string; steps: PfdStep[] }[]; }
type Segment = MainSegment | ParallelSegment;

function segmentByBranch(steps: PfdStep[]): Segment[] {
    const out: Segment[] = [];
    let i = 0;
    while (i < steps.length) {
        const s = steps[i];
        if (!s.branchId) {
            const main: PfdStep[] = [];
            while (i < steps.length && !steps[i].branchId) {
                main.push(steps[i]);
                i++;
            }
            out.push({ kind: 'main', steps: main });
        } else {
            const branchMap: Record<string, PfdStep[]> = {};
            const branchOrder: string[] = [];
            while (i < steps.length && steps[i].branchId) {
                const bid = steps[i].branchId;
                if (!branchMap[bid]) { branchMap[bid] = []; branchOrder.push(bid); }
                branchMap[bid].push(steps[i]);
                i++;
            }
            out.push({
                kind: 'parallel',
                branches: branchOrder.map(bid => ({ branchId: bid, steps: branchMap[bid] })),
            });
        }
    }
    return out;
}

/**
 * Build a sequence of zip nodes from a list of main-flow steps.
 * Decisions consume their disposition + (for rework_or_scrap) following isRework steps.
 */
function buildSequenceFromMainSteps(steps: PfdStep[]): ZipNodeRendered[] {
    const out: ZipNodeRendered[] = [];
    let i = 0;
    while (i < steps.length) {
        const step = steps[i];
        const node = buildNodeFromStep(step);

        // Decision: attach branchSide based on rejectDisposition; possibly consume rework chain.
        if (step.stepType === 'decision') {
            const { branchSide, consumedReworkSteps } = buildBranchSideForDecision(step, steps, i);
            if (branchSide) node.branchSide = branchSide;
            out.push(node);
            i += 1 + consumedReworkSteps;
            continue;
        }

        // Inspection / combined with disposition (NOT a full decision) → treat similarly
        if ((step.stepType === 'inspection' || step.stepType === 'combined') && step.rejectDisposition && step.rejectDisposition !== 'none') {
            const { branchSide, consumedReworkSteps } = buildBranchSideForDecision(step, steps, i);
            if (branchSide) node.branchSide = branchSide;
            out.push(node);
            i += 1 + consumedReworkSteps;
            continue;
        }

        out.push(node);
        i++;
    }
    return out;
}

/**
 * Top-level converter: transforms PfdStep[] into the nested zip flow used by
 * ZipFlowSequence. Each parallel-branch segment becomes a node with `branches`.
 */
export function pfdStepsToZipFlow(steps: PfdStep[]): ZipNodeRendered[] {
    const segments = segmentByBranch(steps);
    const result: ZipNodeRendered[] = [];

    for (const seg of segments) {
        if (seg.kind === 'main') {
            result.push(...buildSequenceFromMainSteps(seg.steps));
            continue;
        }
        // parallel segment: synthesize a virtual "fork" node carrying the branches
        const virtForkId = `__fork_${result.length}`;
        const branchSequences: ZipNodeRendered[][] = seg.branches.map(b =>
            buildSequenceFromMainSteps(b.steps),
        );
        result.push({
            srcId: virtForkId,
            type: 'transfer', // invisible-ish: tiny circle as a join point
            description: 'FLUJO PARALELO',
            branches: branchSequences,
            labelDown: '',
        });
    }

    return result;
}
