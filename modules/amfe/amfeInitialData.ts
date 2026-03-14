/**
 * AMFE Initial Data
 *
 * Factory function for creating blank AMFE documents.
 * Each call generates a fresh document to avoid shared UUID references.
 */

import { AmfeDocument } from './amfeTypes';

/**
 * Create a new blank AMFE document with default header values.
 * Does not include any pre-populated operations - starts clean.
 */
export function createEmptyAmfeDoc(): AmfeDocument {
    return {
        header: {
            organization: 'BARACK MERCOSUL',
            location: 'PLANTA HURLINGHAM',
            client: '',
            modelYear: '',
            subject: '',
            startDate: '',
            revDate: '',
            team: '',
            amfeNumber: '',
            responsible: '',
            confidentiality: '',
            partNumber: '',
            processResponsible: '',
            revision: '',
            approvedBy: '',
            scope: '',
            applicableParts: '',
        },
        operations: [],
    };
}

/**
 * @deprecated Use createEmptyAmfeDoc() instead. Kept for backward compatibility.
 */
export const EMPTY_AMFE_DOC: AmfeDocument = createEmptyAmfeDoc();
