import React, { useEffect, useMemo, useState, useCallback, lazy, Suspense } from 'react';
import {
    Clock, ShieldAlert, ClipboardCheck, GitBranch, ArrowRight,
    FolderOpen, FileText, Sparkles, AlertTriangle, GitMerge,
    ExternalLink, FilePlus2, Wrench,
    BookOpen, Shield, LogOut, Users, Package, Loader2,
} from 'lucide-react';
import barackLogo from '../src/assets/barack_logo.png';
import type { DocumentType, DocumentRegistryEntry } from './registry/documentRegistryTypes';
import { useAuth } from '../components/auth/AuthProvider';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { useProjectHub } from '../hooks/useProjectHub';
import type { PendingItem } from '../hooks/useProjectHub';
import { ProjectTable } from '../components/landing/ProjectTable';

const ApqpExportDialog = lazy(() => import('./family/ApqpExportDialog'));

interface LandingPageProps {
    onSelectModule: (module: 'pfd' | 'pfdTest' | 'tiempos' | 'amfe' | 'controlPlan' | 'hojaOperaciones' | 'registry' | 'solicitud' | 'manuales' | 'formatos' | 'dataManager' | 'admin') => void;
    /** Navigate to AMFE module and auto-load the project for this family */
    onOpenProjectFamily?: (familyId: number) => void;
    /** Document counts per type from the registry */
    documentCounts?: Partial<Record<DocumentType, number>>;
    /** Most recently updated documents (up to 5) */
    recentDocuments?: DocumentRegistryEntry[];
}

const TYPE_ICONS: Record<DocumentType, React.ReactNode> = {
    pfd: <GitBranch size={14} className="text-cyan-600" />,
    amfe: <ShieldAlert size={14} className="text-orange-500" />,
    controlPlan: <ClipboardCheck size={14} className="text-green-600" />,
    hojaOperaciones: <FileText size={14} className="text-indigo-500" />,
};

const TYPE_LABELS: Record<DocumentType, string> = {
    pfd: 'PFD',
    amfe: 'AMFE',
    controlPlan: 'CP',
    hojaOperaciones: 'HO',
};

const LandingPage: React.FC<LandingPageProps> = ({ onSelectModule, onOpenProjectFamily, documentCounts = {}, recentDocuments = [] }) => {
    const { user, signOut, userDisplayName } = useAuth();
    const { isAdmin } = useIsAdmin();
    const { projects, pendingItems, loading: projectsLoading } = useProjectHub();

    // APQP export dialog state
    const [exportFamilyId, setExportFamilyId] = useState<number | null>(null);
    const exportFamily = useMemo(
        () => exportFamilyId !== null ? projects.find(p => p.family.id === exportFamilyId)?.family ?? null : null,
        [exportFamilyId, projects],
    );
    const handleCloseExport = useCallback(() => setExportFamilyId(null), []);

    const totalDocs = useMemo(() =>
        Object.values(documentCounts).reduce((sum, n) => sum + (n || 0), 0),
        [documentCounts]
    );

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.key === '1') onSelectModule('pfd');
            if (e.key === '2') onSelectModule('amfe');
            if (e.key === '3') onSelectModule('controlPlan');
            if (e.key === '4') onSelectModule('hojaOperaciones');
            if (e.key === '5') onSelectModule('tiempos');
            if (e.key === '6') onSelectModule('registry');
            if (e.key === '7') onSelectModule('solicitud');
            if (e.key === '8') onSelectModule('manuales');
            if (e.key === '9') onSelectModule('formatos');
            if (e.key === '0') onSelectModule('dataManager');
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onSelectModule]);

    const formatDate = (iso: string) => {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            // FIX: Invalid Date produces "Invalid Date" string from toLocaleDateString()
            if (isNaN(d.getTime())) return '';
            return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
        } catch {
            return '';
        }
    };

    /** Normalize document names to Title Case.
     *  - Strips hierarchy path (e.g. "VWA/PATAGONIA/TOP_ROLL" -> "Top Roll")
     *  - Converts ALL_CAPS or ALL CAPS names to Title Case
     */
    const cleanDocumentName = (name: string): string => {
        if (!name) return name;
        // For hierarchical paths, take the last segment
        const segment = name.includes('/') ? (name.split('/').pop() || name) : name;
        // Replace underscores with spaces and normalize to Title Case
        const words = segment.replace(/_/g, ' ').trim().split(/\s+/);
        // Only transform if the name looks ALL CAPS (every word is uppercase)
        const isAllCaps = words.every(w => w === w.toUpperCase() && /[A-Z]/.test(w));
        if (!isAllCaps) return segment;
        return words
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');
    };

    return (
        <div className="min-h-full bg-slate-50 font-sans">

            <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-6 py-10">

                {/* ===== HEADER ===== */}
                <header className="flex flex-wrap items-center gap-4 mb-10 opacity-0 animate-fade-in-up">
                    <img
                        src={barackLogo}
                        alt="Barack Mercosul"
                        className="h-12"
                        style={{ filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.1))' }}
                    />
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight leading-tight">
                            Barack Mercosul
                        </h1>
                        <p className="text-sm text-blue-600 font-medium">
                            Ingeniería de Calidad Automotriz
                        </p>
                    </div>
                    <div className="flex-grow" />
                    {totalDocs > 0 && (
                        <button
                            onClick={() => onSelectModule('registry')}
                            className="text-xs text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1.5 bg-white shadow-sm border border-slate-200/60 rounded-lg px-3 py-1.5 hover:border-blue-300"
                        >
                            <FolderOpen size={13} />
                            <span>{totalDocs} documentos</span>
                        </button>
                    )}
                    {user && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 hidden sm:inline truncate max-w-[140px]" title={user.email ?? ''}>
                                {userDisplayName}
                            </span>
                            <button
                                onClick={() => signOut()}
                                title={`Cerrar sesión (${user.email ?? user.id})`}
                                className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1.5 bg-white shadow-sm border border-slate-200/60 rounded-lg px-3 py-1.5 hover:border-slate-300"
                            >
                                <LogOut size={13} />
                                <span>Salir</span>
                            </button>
                        </div>
                    )}
                </header>

                {/* ===== LOADING INDICATOR ===== */}
                {projectsLoading && (
                    <div className="flex items-center justify-center py-16 opacity-0 animate-fade-in-up">
                        <div className="text-center">
                            <Loader2 size={32} className="text-blue-500 animate-spin mx-auto mb-3" />
                            <p className="text-sm text-slate-400">Cargando proyectos...</p>
                        </div>
                    </div>
                )}

                {/* ===== PENDIENTES (only if items exist) ===== */}
                {!projectsLoading && pendingItems.length > 0 && (
                    <section className="mb-8 opacity-0 animate-fade-in-up stagger-1" aria-label="Pendientes">
                        <h2 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-2 mb-3">
                            <AlertTriangle size={14} />
                            Requiere atención
                        </h2>
                        <div className="bg-red-50 border border-red-200 rounded-xl divide-y divide-red-100 overflow-hidden">
                            {pendingItems.map((item: PendingItem) => (
                                <div key={`${item.type}-${item.familyId}`} className="flex items-center gap-3 px-4 py-3">
                                    <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                                        item.type === 'ap_h_unmitigated' ? 'bg-red-100' : 'bg-amber-100'
                                    }`}>
                                        {item.type === 'ap_h_unmitigated'
                                            ? <AlertTriangle size={14} className="text-red-400" />
                                            : <GitMerge size={14} className="text-amber-400" />
                                        }
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <span className="text-sm text-slate-800 font-medium">{item.familyName}</span>
                                        <span className="text-xs text-slate-500 ml-2">
                                            {item.type === 'ap_h_unmitigated'
                                                ? `${item.count} causa${item.count !== 1 ? 's' : ''} AP=H sin acciones`
                                                : `${item.count} propuesta${item.count !== 1 ? 's' : ''} de cambio pendiente${item.count !== 1 ? 's' : ''}`
                                            }
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* ===== MIS PROYECTOS ===== */}
                {!projectsLoading && projects.length > 0 && (
                    <section className="mb-10 opacity-0 animate-fade-in-up stagger-1" aria-label="Mis Proyectos">
                        <div className="flex items-center gap-3 mb-5">
                            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <Package size={14} />
                                Mis Proyectos
                            </h2>
                            <p className="text-xs text-slate-400">
                                Familias de producto con documentación APQP vinculada
                            </p>
                        </div>
                        <ProjectTable
                            projects={projects}
                            onSelectProject={(familyId) => {
                                if (onOpenProjectFamily) {
                                    onOpenProjectFamily(familyId);
                                } else {
                                    onSelectModule('amfe');
                                }
                            }}
                            onExportApqp={setExportFamilyId}
                        />
                    </section>
                )}

                {/* ===== TWO-COLUMN: Gestion de Ingenieria + Recientes ===== */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10 opacity-0 animate-fade-in-up stagger-2">

                    {/* Gestión de Ingeniería - standalone tools */}
                    <div>
                        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-4">
                            <Wrench size={14} />
                            Herramientas
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                                onClick={() => onSelectModule('tiempos')}
                                aria-label="Abrir Tiempos y Balanceos"
                                className="group w-full text-left bg-white shadow-sm border border-blue-200 rounded-xl p-4
                                           hover:bg-blue-50 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5
                                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:ring-blue-500/50
                                           transition-all duration-200 cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-blue-50 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <Clock size={20} className="text-blue-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-bold text-slate-800">Tiempos y Balanceos</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">Cronometraje y balanceo de línea</p>
                                    </div>
                                    <ArrowRight size={14} className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity ml-auto flex-shrink-0" />
                                </div>
                            </button>
                            <button
                                onClick={() => onSelectModule('solicitud')}
                                aria-label="Abrir Solicitudes de Código"
                                className="group w-full text-left bg-white shadow-sm border border-amber-200 rounded-xl p-4
                                           hover:bg-amber-50 hover:border-amber-300 hover:shadow-md hover:-translate-y-0.5
                                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:ring-blue-500/50
                                           transition-all duration-200 cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-amber-50 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <FilePlus2 size={20} className="text-amber-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-bold text-slate-800">Solicitudes de Código</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">Solicitar generación de códigos ARB</p>
                                    </div>
                                    <ArrowRight size={14} className="text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity ml-auto flex-shrink-0" />
                                </div>
                            </button>
                            <button
                                onClick={() => onSelectModule('manuales')}
                                aria-label="Abrir Manuales de Ingeniería"
                                className="group w-full text-left bg-white shadow-sm border border-teal-200 rounded-xl p-4
                                           hover:bg-teal-50 hover:border-teal-300 hover:shadow-md hover:-translate-y-0.5
                                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:ring-blue-500/50
                                           transition-all duration-200 cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-teal-50 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <BookOpen size={20} className="text-teal-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-bold text-slate-800">Manuales</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">Procedimientos y documentos HTML</p>
                                    </div>
                                    <ArrowRight size={14} className="text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity ml-auto flex-shrink-0" />
                                </div>
                            </button>
                            <button
                                onClick={() => onSelectModule('formatos')}
                                aria-label="Abrir Formatos Estándar"
                                className="group w-full text-left bg-white shadow-sm border border-purple-200 rounded-xl p-4
                                           hover:bg-purple-50 hover:border-purple-300 hover:shadow-md hover:-translate-y-0.5
                                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:ring-blue-500/50
                                           transition-all duration-200 cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-purple-50 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <FolderOpen size={20} className="text-purple-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-bold text-slate-800">Formatos Estándar</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">Plantillas Excel, PDF y Word</p>
                                    </div>
                                    <ArrowRight size={14} className="text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity ml-auto flex-shrink-0" />
                                </div>
                            </button>
                            <button
                                onClick={() => onSelectModule('dataManager')}
                                aria-label="Abrir Datos y Seguridad"
                                className="group w-full text-left bg-white shadow-sm border border-rose-200 rounded-xl p-4
                                           hover:bg-rose-50 hover:border-rose-300 hover:shadow-md hover:-translate-y-0.5
                                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:ring-blue-500/50
                                           transition-all duration-200 cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-rose-50 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <Shield size={20} className="text-rose-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-bold text-slate-800">Datos y Seguridad</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">Backups, exportar, importar y sincronizar datos</p>
                                    </div>
                                    <ArrowRight size={14} className="text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity ml-auto flex-shrink-0" />
                                </div>
                            </button>
                            {isAdmin && (
                                <button
                                    onClick={() => onSelectModule('admin')}
                                    aria-label="Abrir Administración de Usuarios"
                                    className="group w-full text-left bg-white shadow-sm border border-violet-200 rounded-xl p-4
                                               hover:bg-violet-50 hover:border-violet-300 hover:shadow-md hover:-translate-y-0.5
                                               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:ring-blue-500/50
                                               transition-all duration-200 cursor-pointer"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="bg-violet-50 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <Users size={20} className="text-violet-600" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-bold text-slate-800">Administración</h3>
                                            <p className="text-xs text-slate-500 mt-0.5">Gestionar usuarios y permisos</p>
                                        </div>
                                        <ArrowRight size={14} className="text-violet-600 opacity-0 group-hover:opacity-100 transition-opacity ml-auto flex-shrink-0" />
                                    </div>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Recent documents */}
                    <div>
                        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-4">
                            <Sparkles size={14} />
                            Documentos Recientes
                        </h2>

                        {recentDocuments.length > 0 ? (
                            <div className="bg-white shadow-sm border border-slate-200/60 rounded-xl overflow-hidden divide-y divide-slate-100">
                                {recentDocuments.slice(0, 5).map(doc => (
                                    <button
                                        key={`${doc.type}-${doc.id}`}
                                        onClick={() => onSelectModule(doc.type === 'controlPlan' ? 'controlPlan' : doc.type === 'hojaOperaciones' ? 'hojaOperaciones' : doc.type === 'pfd' ? 'pfd' : doc.type === 'amfe' ? 'amfe' : 'registry')}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left group"
                                    >
                                        <div className="flex-shrink-0 w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center">
                                            {TYPE_ICONS[doc.type]}
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <div className="text-sm text-slate-800 font-medium truncate" title={doc.name}>{cleanDocumentName(doc.name)}</div>
                                            <div className="text-xs text-slate-500 flex items-center gap-2">
                                                <span className="font-bold">{TYPE_LABELS[doc.type]}</span>
                                                {doc.client && <span>{doc.client}</span>}
                                                {doc.partNumber && <span className="text-slate-600">{doc.partNumber}</span>}
                                            </div>
                                        </div>
                                        <span className="text-xs text-slate-500 flex-shrink-0">
                                            {formatDate(doc.updatedAt)}
                                        </span>
                                        <ExternalLink size={12} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                    </button>
                                ))}
                                {/* Ver todos link */}
                                <button
                                    onClick={() => onSelectModule('registry')}
                                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-slate-50 transition-colors font-medium"
                                >
                                    <FolderOpen size={12} />
                                    Ver todos los documentos
                                    <ArrowRight size={12} />
                                </button>
                            </div>
                        ) : (
                            <div className="bg-white shadow-sm border border-slate-200/60 rounded-xl p-6 text-center">
                                <FolderOpen size={28} className="mx-auto mb-2 text-slate-400" />
                                <p className="text-sm text-slate-500">No hay documentos aún</p>
                                <p className="text-xs text-slate-400 mt-1">
                                    Empezá creando un Diagrama de Flujo para iniciar tu proyecto APQP
                                </p>
                                <button
                                    onClick={() => onSelectModule('pfd')}
                                    className="mt-3 text-xs text-cyan-600 hover:text-cyan-700 font-medium transition-colors"
                                >
                                    Crear Diagrama de Flujo →
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ===== FOOTER ===== */}
                <footer className="text-center text-xs opacity-0 animate-fade-in-up stagger-3 pb-4" role="contentinfo">
                    <p className="text-slate-400">
                        Atajos: <kbd className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-600 border border-slate-300">1</kbd>-<kbd className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-600 border border-slate-300">4</kbd> APQP
                        <span className="mx-1.5 text-slate-400">·</span>
                        <kbd className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-600 border border-slate-300">5</kbd> Tiempos
                        <span className="mx-1.5 text-slate-400">·</span>
                        <kbd className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-600 border border-slate-300">6</kbd> Hub
                        <span className="mx-1.5 text-slate-400">·</span>
                        <kbd className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-600 border border-slate-300">7</kbd>-<kbd className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-600 border border-slate-300">9</kbd> Herramientas
                    </p>
                </footer>
            </div>

            {/* APQP Export Dialog */}
            {exportFamily && (
                <Suspense fallback={null}>
                    <ApqpExportDialog
                        isOpen={exportFamilyId !== null}
                        onClose={handleCloseExport}
                        family={exportFamily}
                    />
                </Suspense>
            )}
        </div>
    );
};

export default LandingPage;
