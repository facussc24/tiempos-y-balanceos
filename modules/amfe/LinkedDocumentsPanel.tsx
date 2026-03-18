/**
 * LinkedDocumentsPanel — Displays a collapsible panel showing linked APQP documents
 * (CP, PFD, HO) for the currently loaded AMFE document.
 *
 * Shows existence status, item counts, and provides quick navigation to each tab.
 */

import React, { useState, useEffect } from 'react';
import {
    GitBranch,
    ClipboardCheck,
    FileText,
    ChevronDown,
    ChevronRight,
    ExternalLink,
    RefreshCw,
    Link2,
    Link2Off,
} from 'lucide-react';
import type { LinkedDocInfo, UseLinkedDocumentsReturn } from './useLinkedDocuments';
import type { ActiveTab } from './useAmfeTabNavigation';

interface LinkedDocumentsPanelProps {
    linkedDocs: UseLinkedDocumentsReturn;
    onNavigateToTab: (tab: ActiveTab) => void;
}

const DOC_CONFIG: Record<LinkedDocInfo['type'], {
    icon: React.FC<{ size?: number; className?: string }>;
    tab: ActiveTab;
    label: string;
    color: {
        active: string;
        badge: string;
        hover: string;
        icon: string;
    };
}> = {
    pfd: {
        icon: GitBranch,
        tab: 'pfd',
        label: 'Diagrama de Flujo',
        color: {
            active: 'text-cyan-700',
            badge: 'bg-cyan-100 text-cyan-700',
            hover: 'hover:bg-cyan-50',
            icon: 'text-cyan-500',
        },
    },
    cp: {
        icon: ClipboardCheck,
        tab: 'controlPlan',
        label: 'Plan de Control',
        color: {
            active: 'text-green-700',
            badge: 'bg-green-100 text-green-700',
            hover: 'hover:bg-green-50',
            icon: 'text-green-500',
        },
    },
    ho: {
        icon: FileText,
        tab: 'hojaOperaciones',
        label: 'Hojas de Operaciones',
        color: {
            active: 'text-amber-700',
            badge: 'bg-amber-100 text-amber-700',
            hover: 'hover:bg-amber-50',
            icon: 'text-amber-500',
        },
    },
};

const LS_KEY_COLLAPSED = 'linked-docs-panel-collapsed';

const DocRow: React.FC<{
    doc: LinkedDocInfo;
    onNavigate: (tab: ActiveTab) => void;
}> = ({ doc, onNavigate }) => {
    const config = DOC_CONFIG[doc.type];
    const Icon = config.icon;

    return (
        <div
            className={`flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors ${
                doc.exists ? config.color.hover + ' cursor-pointer' : 'opacity-60'
            }`}
            onClick={doc.exists ? () => onNavigate(config.tab) : undefined}
            role={doc.exists ? 'button' : undefined}
            tabIndex={doc.exists ? 0 : undefined}
            onKeyDown={doc.exists ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate(config.tab); } } : undefined}
        >
            <Icon size={14} className={doc.exists ? config.color.icon : 'text-gray-300'} />

            <span className={`text-xs font-medium flex-1 ${doc.exists ? 'text-gray-700' : 'text-gray-400'}`}>
                {config.label}
            </span>

            {doc.exists ? (
                <>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${config.color.badge}`}>
                        {doc.itemCount} {doc.type === 'pfd' ? 'pasos' : doc.type === 'cp' ? 'items' : 'hojas'}
                    </span>
                    <Link2 size={10} className="text-gray-300" />
                </>
            ) : (
                <>
                    <span className="text-[10px] text-gray-300 italic">No vinculado</span>
                    <Link2Off size={10} className="text-gray-200" />
                </>
            )}

            {doc.exists && (
                <ExternalLink size={10} className="text-gray-300 group-hover:text-gray-500" />
            )}
        </div>
    );
};

const LinkedDocumentsPanel: React.FC<LinkedDocumentsPanelProps> = ({
    linkedDocs,
    onNavigateToTab,
}) => {
    const [collapsed, setCollapsed] = useState(() => {
        try { return localStorage.getItem(LS_KEY_COLLAPSED) === 'true'; } catch { return false; }
    });

    useEffect(() => {
        try { localStorage.setItem(LS_KEY_COLLAPSED, String(collapsed)); } catch { /* ignore */ }
    }, [collapsed]);

    const { linkedCp, linkedPfd, linkedHo, isLoading, refresh } = linkedDocs;
    const linkedCount = [linkedCp, linkedPfd, linkedHo].filter(d => d.exists).length;

    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            {/* Header — always visible */}
            <div
                onClick={() => setCollapsed(prev => !prev)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCollapsed(prev => !prev); } }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 rounded-t-lg transition-colors cursor-pointer"
            >
                {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                <span>Documentos del Proyecto</span>
                {linkedCount > 0 && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">
                        {linkedCount}/3
                    </span>
                )}
                {isLoading && (
                    <RefreshCw size={10} className="text-gray-300 animate-spin ml-auto" />
                )}
                {!isLoading && !collapsed && (
                    <button
                        onClick={(e) => { e.stopPropagation(); refresh(); }}
                        className="ml-auto text-gray-300 hover:text-gray-500 transition p-0.5 rounded"
                        title="Actualizar"
                    >
                        <RefreshCw size={10} />
                    </button>
                )}
            </div>

            {/* Body — collapsible */}
            {!collapsed && (
                <div className="px-1 pb-2 space-y-0.5">
                    <DocRow doc={linkedPfd} onNavigate={onNavigateToTab} />
                    <DocRow doc={linkedCp} onNavigate={onNavigateToTab} />
                    <DocRow doc={linkedHo} onNavigate={onNavigateToTab} />
                </div>
            )}
        </div>
    );
};

export default React.memo(LinkedDocumentsPanel);
