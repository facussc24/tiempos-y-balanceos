/**
 * SolicitudProcedureViewer — Modal overlay to display SGC procedure document
 *
 * Renders the P-ING-001 procedure in a readable, card-based layout.
 * Amber/yellow accent theme matching the Solicitud module.
 */

import React, { useEffect, useCallback } from 'react';
import { X, FileText, BookOpen, Link2 } from 'lucide-react';
import {
    PROCEDURE_METADATA,
    PROCEDURE_SECTIONS,
    RELATED_DOCUMENTS,
} from './solicitudProcedureContent';
import type { ProcedureSection } from './solicitudProcedureContent';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SolicitudProcedureViewerProps {
    isOpen: boolean;
    onClose: () => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Header block with form number, title, revision info */
const ProcedureHeader: React.FC = () => (
    <div className="border-b-2 border-amber-400 pb-4 mb-6">
        <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <BookOpen size={20} className="text-amber-600" />
                </div>
                <div>
                    <p className="text-xs font-semibold text-amber-600 tracking-wider uppercase">
                        {PROCEDURE_METADATA.formNumber} &mdash; Rev. {PROCEDURE_METADATA.revision}
                    </p>
                    <h2 className="text-lg font-bold text-gray-800 leading-tight">
                        {PROCEDURE_METADATA.title}
                    </h2>
                </div>
            </div>
            <FileText size={28} className="text-amber-400 opacity-60 flex-shrink-0" />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
            <span>
                <strong className="text-gray-600">Fecha:</strong> {PROCEDURE_METADATA.date}
            </span>
            <span>
                <strong className="text-gray-600">Aprobado por:</strong> {PROCEDURE_METADATA.approvedBy}
            </span>
            <span>
                <strong className="text-gray-600">Alcance:</strong> {PROCEDURE_METADATA.scope}
            </span>
        </div>
    </div>
);

/** A single procedure section rendered as a card */
const SectionCard: React.FC<{ section: ProcedureSection }> = ({ section }) => (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
        {/* Section title */}
        <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-white text-xs font-bold flex-shrink-0">
                {section.number}
            </span>
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                {section.title}
            </h3>
        </div>

        {/* Main content */}
        {section.content && (
            <p className="text-sm text-gray-700 leading-relaxed ml-9">
                {section.content}
            </p>
        )}

        {/* Subsections */}
        {section.subsections && section.subsections.length > 0 && (
            <div className="ml-9 mt-3 space-y-3">
                {section.subsections.map((sub, idx) => (
                    <div key={idx} className="border-l-2 border-amber-300 pl-3">
                        <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">
                            {sub.title}
                        </h4>
                        <p className="text-sm text-gray-700 leading-relaxed">
                            {sub.content}
                        </p>
                    </div>
                ))}
            </div>
        )}
    </div>
);

/** Related documents list */
const RelatedDocumentsList: React.FC = () => (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-2">
        <div className="flex items-center gap-2 mb-3">
            <Link2 size={16} className="text-amber-600" />
            <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                Documentos del SGC relacionados
            </h4>
        </div>
        <ul className="space-y-1.5">
            {RELATED_DOCUMENTS.map((doc) => (
                <li
                    key={doc.code}
                    className="flex items-start gap-2 text-sm text-gray-700"
                >
                    <span className="inline-block bg-white border border-amber-300 rounded px-1.5 py-0.5 text-xs font-mono font-semibold text-amber-700 flex-shrink-0">
                        {doc.code}
                    </span>
                    <span>{doc.title}</span>
                </li>
            ))}
        </ul>
    </div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const SolicitudProcedureViewer: React.FC<SolicitudProcedureViewerProps> = ({
    isOpen,
    onClose,
}) => {
    // Escape key handler
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        },
        [onClose],
    );

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, handleKeyDown]);

    if (!isOpen) return null;

    // Find the "DOCUMENTOS RELACIONADOS" section to render its content + list together
    const regularSections = PROCEDURE_SECTIONS.filter((s) => s.number !== '7');
    const docSection = PROCEDURE_SECTIONS.find((s) => s.number === '7');

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center animate-fadeIn"
            role="dialog"
            aria-modal="true"
            aria-label="Procedimiento SGC"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Card */}
            <div className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col animate-slideUp">
                {/* Top bar with close */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 flex-shrink-0">
                    <span className="text-xs text-gray-400 font-medium uppercase tracking-widest">
                        Procedimiento SGC
                    </span>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                        aria-label="Cerrar"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Scrollable content */}
                <div className="overflow-y-auto px-6 py-5 flex-1">
                    <ProcedureHeader />

                    {/* Regular sections */}
                    {regularSections.map((section) => (
                        <SectionCard key={section.number} section={section} />
                    ))}

                    {/* Section 7: Documents + list */}
                    {docSection && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-white text-xs font-bold flex-shrink-0">
                                    {docSection.number}
                                </span>
                                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                                    {docSection.title}
                                </h3>
                            </div>
                            {docSection.content && (
                                <p className="text-sm text-gray-700 leading-relaxed ml-9 mb-3">
                                    {docSection.content}
                                </p>
                            )}
                            <div className="ml-9">
                                <RelatedDocumentsList />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-gray-100 text-center flex-shrink-0">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest">
                        Documento Interno &mdash; Barack Mercosul &mdash; {PROCEDURE_METADATA.formNumber} Rev. {PROCEDURE_METADATA.revision}
                    </p>
                </div>
            </div>

            {/* Inline keyframe animations */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(24px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.2s ease-out;
                }
                .animate-slideUp {
                    animation: slideUp 0.25s ease-out;
                }
            `}</style>
        </div>
    );
};

export default SolicitudProcedureViewer;
