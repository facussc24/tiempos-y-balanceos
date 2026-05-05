/**
 * Zip Flow Converter
 *
 * Converts the nested zip-template flow model (from the standalone Google AI
 * Studio app) into the flat PfdStep[] structure used by the modules/pfd module.
 *
 * The PfdStep contract is sacred — this converter MUST NOT add fields. It maps
 * what it can and drops the rest into `notes` when relevant.
 */

import {
    PfdStep,
    PfdHeader,
    PfdStepType,
    createEmptyStep,
} from '../pfdTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Types describing the zip model. Loose because the source data is JSON-shaped.
// ─────────────────────────────────────────────────────────────────────────────

export interface ZipNode {
    type?: string;
    stepId?: string;
    description?: string;
    text?: string;
    labelCondition?: string;
    labelDown?: string;
    branchSide?: ZipBranchSide;
    branches?: ZipNode[][];
    rework?: { targetId?: string; label?: string };
    incomingConnector?: string;
    [key: string]: unknown;
}

export interface ZipBranchSide {
    type?: string;
    stepId?: string;
    text?: string;
    description?: string;
    labelNode?: string;
    direction?: string;
    sequence?: ZipNode[];
}

export interface ZipHeader {
    title?: string;
    documentCode?: string;
    revision?: string;
    date?: string;
    preparedBy?: string;
    reviewedBy?: string;
    project?: string;
    client?: string;
    [key: string]: unknown;
}

export interface ZipProduct {
    code?: string;
    level?: string;
    description?: string;
    version?: string;
    [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function withOpPrefix(stepId: string | undefined): string {
    if (!stepId) return '';
    const trimmed = String(stepId).trim();
    if (!trimmed) return '';
    if (trimmed.toUpperCase().startsWith('OP ')) return trimmed;
    return `OP ${trimmed}`;
}

function mapZipTypeToStepType(zipType: string | undefined): PfdStepType {
    switch (zipType) {
        case 'operation':
            return 'operation';
        case 'op-ins':
            return 'combined';
        case 'transfer':
            return 'transport';
        case 'storage':
            return 'storage';
        case 'inspection':
            return 'inspection';
        case 'condition':
            return 'decision';
        case 'connector':
            return 'transport';
        default:
            return 'operation';
    }
}

function appendNote(existing: string, addition: string): string {
    if (!addition) return existing;
    if (!existing) return addition;
    return `${existing} | ${addition}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Header converter
// ─────────────────────────────────────────────────────────────────────────────

function parseDate(date: string | undefined): string {
    if (!date) return '';
    // DD/MM/YYYY → YYYY-MM-DD
    const match = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
        const [, dd, mm, yyyy] = match;
        return `${yyyy}-${mm}-${dd}`;
    }
    return date;
}

export function zipHeaderToPfdHeader(
    zipHeader: ZipHeader | undefined,
    zipProducts: ZipProduct[] | undefined,
): Partial<PfdHeader> {
    const h = zipHeader || {};
    const products = Array.isArray(zipProducts) ? zipProducts : [];

    const codes = products.map((p) => (p?.code ? String(p.code) : '')).filter(Boolean);
    const firstCode = codes[0] || '';

    const revision = h.revision ? String(h.revision) : '';
    const isPrelaunch = revision.toUpperCase().includes('PRELIMINAR');

    const result: Partial<PfdHeader> = {
        partName: h.title ? String(h.title) : '',
        documentNumber: h.documentCode ? String(h.documentCode) : '',
        revisionLevel: revision || 'A',
        revisionDate: parseDate(h.date ? String(h.date) : ''),
        preparedBy: h.preparedBy ? String(h.preparedBy) : '',
        approvedBy: h.reviewedBy ? String(h.reviewedBy) : '',
        applicableParts: codes.join(' / '),
        customerName: h.client ? String(h.client) : '',
        companyName: 'Barack Mercosul',
        processPhase: isPrelaunch ? 'pre-launch' : '',
        partNumber: firstCode,
    };

    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Flow converter
// ─────────────────────────────────────────────────────────────────────────────

interface FlattenContext {
    branchId: string;
    branchLabel: string;
}

function flattenNode(node: ZipNode, ctx: FlattenContext, out: PfdStep[]): void {
    const zipType = node.type;

    // 1. Connector incoming on a "main" node (e.g. operation receiving connector A)
    //    handled below per type.

    if (zipType === 'condition') {
        // Build a decision step using labelCondition as the description.
        const step: PfdStep = {
            ...createEmptyStep(''),
            stepType: 'decision',
            description: node.labelCondition ? String(node.labelCondition) : '',
            branchId: ctx.branchId,
            branchLabel: ctx.branchLabel,
        };

        // Determine NO-side disposition from branchSide
        const bs = node.branchSide;
        const noteAdditions: string[] = [];

        if (bs) {
            const bsType = bs.type;
            if (bsType === 'terminal') {
                const text = bs.text ? String(bs.text).toUpperCase() : '';
                if (text === 'SCRAP') {
                    step.rejectDisposition = 'scrap';
                    step.scrapDescription = 'SCRAP';
                } else if (text === 'RECLAMO A PROVEEDOR') {
                    step.rejectDisposition = 'scrap';
                    step.scrapDescription = 'RECLAMO A PROVEEDOR';
                } else if (text) {
                    step.rejectDisposition = 'scrap';
                    step.scrapDescription = text;
                }
            } else if (Array.isArray(bs.sequence) && bs.sequence.length > 0) {
                // Nested rework-or-scrap pattern: condition → multiple ops → transfer back
                step.rejectDisposition = 'rework_or_scrap';
                // Push the decision step BEFORE flattening the nested sequence,
                // so order of pasos is correct.
                out.push(step);
                for (const child of bs.sequence) {
                    flattenNode(child, ctx, out);
                }
                return;
            }
        }

        out.push(step);

        if (noteAdditions.length) {
            step.notes = appendNote(step.notes, noteAdditions.join(' | '));
        }
        return;
    }

    if (zipType === 'terminal') {
        // Terminal as a top-level node is rare. Treat as a note-only marker:
        // skip emitting a step (terminals are tied to conditions).
        return;
    }

    if (zipType === 'connector') {
        // Standalone connector node — emit a transport step with a note.
        const step: PfdStep = {
            ...createEmptyStep(''),
            stepType: 'transport',
            description: node.description ? String(node.description) : '',
            notes: `Conector ${node.text ? String(node.text) : ''}`.trim(),
            branchId: ctx.branchId,
            branchLabel: ctx.branchLabel,
        };
        out.push(step);
        return;
    }

    // Parallel branches
    if (Array.isArray(node.branches) && node.branches.length > 0) {
        const branchLabels = ['A', 'B', 'C', 'D'];
        node.branches.forEach((branchSeq, idx) => {
            const id = branchLabels[idx] || `B${idx}`;
            const label = `Línea ${id}`;
            const branchCtx: FlattenContext = { branchId: id, branchLabel: label };
            for (const child of branchSeq) {
                flattenNode(child, branchCtx, out);
            }
        });
        return;
    }

    // Default path: operation, op-ins (combined), transfer, storage, inspection
    const stepType = mapZipTypeToStepType(zipType);
    const step: PfdStep = {
        ...createEmptyStep(''),
        stepType,
        stepNumber: withOpPrefix(node.stepId),
        description: node.description ? String(node.description) : '',
        branchId: ctx.branchId,
        branchLabel: ctx.branchLabel,
    };

    // Rework metadata on a transfer step
    if (node.rework && typeof node.rework === 'object') {
        step.isRework = true;
        if (node.rework.targetId) {
            step.reworkReturnStep = withOpPrefix(String(node.rework.targetId));
        }
        step.rejectDisposition = 'rework';
        if (node.rework.label) {
            step.notes = appendNote(step.notes, String(node.rework.label));
        }
    }

    // Incoming connector annotation
    if (node.incomingConnector) {
        step.notes = appendNote(step.notes, `Recibe conector ${String(node.incomingConnector)}`);
    }

    // branchSide as a connector on a transfer/op (sidecar metadata)
    if (node.branchSide && (node.branchSide.type === 'connector')) {
        const bs = node.branchSide;
        const tag = bs.text ? String(bs.text) : '';
        const desc = bs.description ? String(bs.description) : '';
        const note = `Conector ${tag}${desc ? `: ${desc}` : ''}`.trim();
        step.notes = appendNote(step.notes, note);
    }

    out.push(step);
}

export function zipFlowToPfdSteps(zipFlow: ZipNode[] | undefined): PfdStep[] {
    if (!Array.isArray(zipFlow)) return [];
    const out: PfdStep[] = [];
    const rootCtx: FlattenContext = { branchId: '', branchLabel: '' };
    for (const node of zipFlow) {
        flattenNode(node, rootCtx, out);
    }
    return out;
}
