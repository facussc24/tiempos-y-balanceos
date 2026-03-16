/**
 * Document Lock Warning Banner
 *
 * Non-blocking advisory banner shown when another user is editing
 * the same document. Does not prevent editing — just warns.
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
    /** Email of the other user editing, or null if no conflict */
    otherEditor: string | null;
}

const DocumentLockBanner: React.FC<Props> = ({ otherEditor }) => {
    if (!otherEditor) return null;

    const displayName = otherEditor.split('@')[0];

    return (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 flex items-center gap-2 text-xs text-amber-700">
            <AlertTriangle size={14} className="text-amber-500 shrink-0" />
            <span>
                <strong>{displayName}</strong> puede estar editando este documento.
                Los cambios de ambos usuarios podrian sobreescribirse.
            </span>
        </div>
    );
};

export default DocumentLockBanner;
