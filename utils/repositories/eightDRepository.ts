/**
 * 8D Report Repository
 *
 * CRUD for G8D (Global 8D) problem-solving reports.
 * Follows the same TEXT-column pattern as projects / solicitud.
 */

import type { EightDReport, EightDDocumentRow } from '../../modules/eightD/eightDTypes';
import { createEmptyReport } from '../../modules/eightD/eightDTypes';
import { getDatabase } from '../database';
import { logger } from '../logger';
import { getCurrentUserEmail } from '../currentUser';
import { generateChecksum } from '../crypto';

// ---------------------------------------------------------------------------
// Data normalization — prevents .trim() crashes on undefined fields
// ---------------------------------------------------------------------------

/** Ensure all string fields exist after JSON.parse to prevent runtime crashes. */
function normalizeReport(report: EightDReport): void {
    const defaults = createEmptyReport();

    report.id = report.id ?? defaults.id;
    report.reportNumber = report.reportNumber ?? '';
    report.title = report.title ?? '';
    report.status = report.status ?? 'abierto';
    report.createdAt = report.createdAt ?? defaults.createdAt;
    report.updatedAt = report.updatedAt ?? defaults.updatedAt;
    report.createdBy = report.createdBy ?? '';
    report.updatedBy = report.updatedBy ?? '';
    report.currentStep = report.currentStep ?? 0;

    // D0
    if (!report.d0) report.d0 = { ...defaults.d0 };
    report.d0.symptom = report.d0.symptom ?? '';
    report.d0.urgency = report.d0.urgency ?? 'media';
    report.d0.client = report.d0.client ?? '';
    report.d0.era = report.d0.era ?? '';
    report.d0.eraResponsible = report.d0.eraResponsible ?? '';
    report.d0.eraDate = report.d0.eraDate ?? '';
    report.d0.eraVerification = report.d0.eraVerification ?? '';
    report.d0.needsFull8D = report.d0.needsFull8D ?? '';

    // D1
    if (!report.d1) report.d1 = { ...defaults.d1 };
    report.d1.leader = report.d1.leader ?? '';
    report.d1.champion = report.d1.champion ?? '';
    report.d1.members = report.d1.members ?? '';

    // D2
    if (!report.d2) report.d2 = { ...defaults.d2 };
    report.d2.what = report.d2.what ?? '';
    report.d2.where = report.d2.where ?? '';
    report.d2.when = report.d2.when ?? '';
    report.d2.who = report.d2.who ?? '';
    report.d2.howMany = report.d2.howMany ?? '';
    report.d2.howDetected = report.d2.howDetected ?? '';
    report.d2.partNumber = report.d2.partNumber ?? '';
    report.d2.isNotWhat = report.d2.isNotWhat ?? '';
    report.d2.isNotWhere = report.d2.isNotWhere ?? '';
    report.d2.isNotWhen = report.d2.isNotWhen ?? '';
    report.d2.isNotHowMany = report.d2.isNotHowMany ?? '';

    // D3
    if (!report.d3) report.d3 = { ...defaults.d3 };
    report.d3.actions = report.d3.actions ?? '';
    report.d3.responsible = report.d3.responsible ?? '';
    report.d3.date = report.d3.date ?? '';
    report.d3.status = report.d3.status ?? 'pendiente';
    report.d3.verification = report.d3.verification ?? '';

    // D4
    if (!report.d4) report.d4 = { ...defaults.d4 };
    report.d4.rootCause = report.d4.rootCause ?? '';
    report.d4.rootCauseVerification = report.d4.rootCauseVerification ?? '';
    report.d4.escapePoint = report.d4.escapePoint ?? '';
    report.d4.escapeWhy = report.d4.escapeWhy ?? '';
    if (!Array.isArray(report.d4.fiveWhy)) report.d4.fiveWhy = ['', '', '', '', ''];
    if (!report.d4.fishbone) report.d4.fishbone = { ...defaults.d4.fishbone };

    // D5
    if (!report.d5) report.d5 = { ...defaults.d5 };
    if (!Array.isArray(report.d5.actions)) report.d5.actions = [];
    report.d5.escapeAction = report.d5.escapeAction ?? '';
    report.d5.escapeResponsible = report.d5.escapeResponsible ?? '';
    report.d5.riskAssessment = report.d5.riskAssessment ?? '';
    report.d5.verificationMethod = report.d5.verificationMethod ?? '';

    // D6
    if (!report.d6) report.d6 = { ...defaults.d6 };
    report.d6.validation = report.d6.validation ?? '';
    report.d6.evidence = report.d6.evidence ?? '';
    report.d6.validationPeriod = report.d6.validationPeriod ?? '';
    report.d6.icaRemoved = report.d6.icaRemoved ?? '';
    report.d6.effective = report.d6.effective ?? '';

    // D7
    if (!report.d7) report.d7 = { ...defaults.d7 };
    report.d7.prevention = report.d7.prevention ?? '';
    report.d7.fmeaUpdated = report.d7.fmeaUpdated ?? '';
    report.d7.controlPlanUpdated = report.d7.controlPlanUpdated ?? '';
    report.d7.workInstructions = report.d7.workInstructions ?? '';
    report.d7.otherDocs = report.d7.otherDocs ?? '';
    report.d7.horizontalDeployment = report.d7.horizontalDeployment ?? '';

    // D8
    if (!report.d8) report.d8 = { ...defaults.d8 };
    report.d8.lessons = report.d8.lessons ?? '';
    report.d8.recognition = report.d8.recognition ?? '';
    report.d8.closedDate = report.d8.closedDate ?? '';
    report.d8.customerApproval = report.d8.customerApproval ?? '';
    report.d8.effectivenessCheckDate = report.d8.effectivenessCheckDate ?? '';
}

// ---------------------------------------------------------------------------
// 8D Report CRUD
// ---------------------------------------------------------------------------

/**
 * List all 8D reports (no full data — lightweight listing).
 */
export async function getAll(): Promise<EightDDocumentRow[]> {
    try {
        const db = await getDatabase();
        const rows = await db.select<EightDDocumentRow>(
            `SELECT id, report_number, title, status, urgency, client, part_number,
                    leader, root_cause, created_at, updated_at, created_by, updated_by
             FROM eight_d_documents ORDER BY updated_at DESC`
        );
        return rows;
    } catch (err) {
        logger.error('EightDRepo', 'Failed to list reports', {}, err instanceof Error ? err : undefined);
        return [];
    }
}

/**
 * Load a full 8D report by ID.
 */
export async function getById(id: string): Promise<EightDReport | null> {
    try {
        const db = await getDatabase();
        const rows = await db.select<EightDDocumentRow>(
            'SELECT * FROM eight_d_documents WHERE id = ?',
            [id]
        );
        if (rows.length === 0) return null;

        const r = rows[0];
        const report = JSON.parse(r.data) as EightDReport;
        normalizeReport(report);
        return report;
    } catch (err) {
        logger.error('EightDRepo', `Failed to load report ${id}`, {}, err instanceof Error ? err : undefined);
        return null;
    }
}

/**
 * Save an 8D report (insert or update via upsert).
 */
export async function save(report: EightDReport): Promise<boolean> {
    try {
        const db = await getDatabase();
        const data = JSON.stringify(report);
        const checksum = await generateChecksum(data);
        const byEmail = getCurrentUserEmail();

        await db.execute(
            `INSERT INTO eight_d_documents
             (id, report_number, title, status, urgency, client, part_number,
              leader, root_cause,
              created_at, updated_at, created_by, updated_by,
              data, checksum)
             VALUES (?, ?, ?, ?, ?, ?, ?,
                     ?, ?,
                     COALESCE((SELECT created_at FROM eight_d_documents WHERE id = ?), datetime('now')),
                     datetime('now'),
                     COALESCE((SELECT created_by FROM eight_d_documents WHERE id = ?), ?),
                     ?,
                     ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                 report_number = excluded.report_number,
                 title         = excluded.title,
                 status        = excluded.status,
                 urgency       = excluded.urgency,
                 client        = excluded.client,
                 part_number   = excluded.part_number,
                 leader        = excluded.leader,
                 root_cause    = excluded.root_cause,
                 updated_at    = excluded.updated_at,
                 updated_by    = excluded.updated_by,
                 data          = excluded.data,
                 checksum      = excluded.checksum`,
            [
                report.id,
                report.reportNumber,
                report.title || '',
                report.status || 'abierto',
                report.d0?.urgency || 'media',
                report.d0?.client || '',
                report.d2?.partNumber || '',
                report.d1?.leader || '',
                report.d4?.rootCause || '',
                // COALESCE params
                report.id,
                report.id, byEmail,
                byEmail,
                data, checksum,
            ]
        );

        logger.info('EightDRepo', `Saved report ${report.reportNumber} (${report.id})`);
        return true;
    } catch (err) {
        logger.error('EightDRepo', `Failed to save report ${report.id}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}

/**
 * Delete an 8D report by ID.
 */
export async function deleteReport(id: string): Promise<boolean> {
    try {
        const db = await getDatabase();
        await db.execute('DELETE FROM eight_d_documents WHERE id = ?', [id]);
        logger.info('EightDRepo', `Deleted report ${id}`);
        return true;
    } catch (err) {
        logger.error('EightDRepo', `Failed to delete report ${id}`, {}, err instanceof Error ? err : undefined);
        return false;
    }
}

/**
 * Get the next report number in format "8D-001", "8D-002", etc.
 */
export async function getNextReportNumber(): Promise<string> {
    try {
        const db = await getDatabase();
        const rows = await db.select<{ max_num: number | null }>(
            `SELECT MAX(CAST(SUBSTR(report_number, 4) AS INTEGER)) as max_num FROM eight_d_documents`
        );
        const next = (rows[0]?.max_num ?? 0) + 1;
        return `8D-${String(next).padStart(3, '0')}`;
    } catch {
        return '8D-001';
    }
}
