/**
 * FamilyDocumentBanner — Horizontal banner showing the document's family role.
 *
 * - Master: teal background, shield icon, variant count
 * - Variant: amber background, branch icon, master name
 * - Unlinked: renders nothing
 *
 * @module FamilyDocumentBanner
 */

import React from 'react';
import { ShieldCheck, GitBranch } from 'lucide-react';
import { useFamilyDocumentInfo } from '../../hooks/useFamilyDocumentInfo';

interface FamilyDocumentBannerProps {
    documentId: string | null | undefined;
}

const FamilyDocumentBanner: React.FC<FamilyDocumentBannerProps> = ({ documentId }) => {
    const { info, loading } = useFamilyDocumentInfo(documentId);

    if (loading || !info) return null;

    if (info.isMaster) {
        return (
            <div className="bg-teal-50 border-b border-teal-200 px-4 py-2 no-print animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2 text-xs text-teal-800">
                    <ShieldCheck size={14} className="text-teal-600 flex-shrink-0" />
                    <span className="font-semibold">DOCUMENTO MAESTRO</span>
                    <span className="text-teal-600">—</span>
                    <span>Familia: {info.familyName}</span>
                    <span className="text-teal-600">—</span>
                    <span>
                        {info.variantCount === 0
                            ? 'Sin variantes vinculadas'
                            : `${info.variantCount} variante${info.variantCount !== 1 ? 's' : ''} vinculada${info.variantCount !== 1 ? 's' : ''}`
                        }
                    </span>
                </div>
            </div>
        );
    }

    if (info.isVariant) {
        return (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 no-print animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2 text-xs text-amber-800">
                    <GitBranch size={14} className="text-amber-600 flex-shrink-0" />
                    <span className="font-semibold">VARIANTE</span>
                    <span className="text-amber-600">—</span>
                    <span>Familia: {info.familyName}</span>
                    {info.masterDocName && (
                        <>
                            <span className="text-amber-600">—</span>
                            <span>Maestro: {info.masterDocName}</span>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return null;
};

export default FamilyDocumentBanner;
