import React, { useEffect, useMemo, useState, useCallback, lazy, Suspense } from 'react';
import {
    Clock, ShieldAlert, ClipboardCheck, GitBranch, ArrowRight,
    FolderOpen, FileText, AlertTriangle, GitMerge,
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
    onSelectModule: (module: 'pfd' | 'pfdTest' | 'tiempos' | 'amfe' | 'controlPlan' | 'hojaOperaciones' | 'registry' | 'solicitud' | 'manuales' | 'formatos' | 'dataManager' | 'admin' | '8dReports') => void;
    /** Navigate to AMFE module and auto-load the project for this family */
    onOpenProjectFamily?: (familyId: number) => void;
    /** Document counts per type from the registry */
    documentCounts?: Partial<Record<DocumentType, number>>;
    /** Most recently updated documents (up to 5) */
    recentDocuments?: DocumentRegistryEntry[];
}

const TYPE_ICONS: Record<DocumentType, React.ReactNode> = {
    pfd: <GitBranch size={14} className="text-slate-500" />,
    amfe: <ShieldAlert size={14} className="text-slate-500" />,
    controlPlan: <ClipboardCheck size={14} className="text-slate-500" />,
    hojaOperaciones: <FileText size={14} className="text-slate-500" />,
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

    // "Now" frozen at first render — useState initializer es React-pure. La diferencia
    // de pocos minutos entre renders no impacta el formato "hace X min".
    const [renderNow] = useState(() => Date.now());

    // AMFE alert: AP=H sin acción mitigada (pendingItems.type === 'ap_h_unmitigated')
    const hasAmfeAlerts = useMemo(
        () => pendingItems.some(p => p.type === 'ap_h_unmitigated'),
        [pendingItems]
    );
    const amfeAlertCount = useMemo(
        () => pendingItems.filter(p => p.type === 'ap_h_unmitigated').reduce((s, p) => s + p.count, 0),
        [pendingItems]
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

    const formatRelative = (iso: string) => {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return '';
            const diffMs = renderNow - d.getTime();
            const min = Math.round(diffMs / 60000);
            if (min < 1) return 'hace un momento';
            if (min < 60) return `hace ${min} min`;
            const h = Math.round(min / 60);
            if (h < 24) return `hace ${h} h`;
            const days = Math.round(h / 24);
            if (days < 7) return `hace ${days} d`;
            return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
        } catch {
            return '';
        }
    };

    const formatDate = (iso: string) => {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return '';
            return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
        } catch {
            return '';
        }
    };

    /** Normalize document names to Title Case. */
    const cleanDocumentName = (name: string): string => {
        if (!name) return name;
        const segment = name.includes('/') ? (name.split('/').pop() || name) : name;
        const words = segment.replace(/_/g, ' ').trim().split(/\s+/);
        const isAllCaps = words.every(w => w === w.toUpperCase() && /[A-Z]/.test(w));
        if (!isAllCaps) return segment;
        return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    };

    const heroDoc = recentDocuments[0];
    const moduleForType = (t: DocumentType) =>
        t === 'controlPlan' ? 'controlPlan'
        : t === 'hojaOperaciones' ? 'hojaOperaciones'
        : t === 'pfd' ? 'pfd'
        : 'amfe';

    return (
        <div className="min-h-full bg-slate-50 font-sans">
            <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-6 py-10">

                {/* ===== HEADER (sutil) ===== */}
                <header className="flex flex-wrap items-center gap-4 mb-10 opacity-0 animate-fade-in-up">
                    <img
                        src={barackLogo}
                        alt="Barack Mercosul"
                        className="h-10"
                        style={{ filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.08))' }}
                    />
                    <div>
                        <h1 className="text-base font-semibold text-slate-900 tracking-tight leading-tight">
                            Barack Mercosul
                        </h1>
                        <p className="text-xs text-slate-500">
                            Ingeniería de Calidad Automotriz
                        </p>
                    </div>
                    <div className="flex-grow" />
                    {totalDocs > 0 && (
                        <button
                            onClick={() => onSelectModule('registry')}
                            title="Abrir Hub de Documentos"
                            className="text-xs text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-3 py-1.5 hover:border-slate-300"
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
                                className="text-xs text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-3 py-1.5 hover:border-slate-300"
                            >
                                <LogOut size={13} />
                                <span>Salir</span>
                            </button>
                        </div>
                    )}
                </header>

                {/* ===== LOADING ===== */}
                {projectsLoading && (
                    <div className="flex items-center justify-center py-16 opacity-0 animate-fade-in-up">
                        <div className="text-center">
                            <Loader2 size={32} className="text-slate-400 animate-spin mx-auto mb-3" />
                            <p className="text-sm text-slate-400">Cargando proyectos...</p>
                        </div>
                    </div>
                )}

                {/* ===== PENDIENTES (si hay) ===== */}
                {!projectsLoading && pendingItems.length > 0 && (
                    <section className="mb-8 opacity-0 animate-fade-in-up stagger-1" aria-label="Pendientes">
                        <h2 className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider flex items-center gap-2 mb-3">
                            <AlertTriangle size={14} />
                            Requiere atención
                        </h2>
                        <div className="bg-rose-50 border border-rose-200 rounded-xl divide-y divide-rose-100 overflow-hidden">
                            {pendingItems.map((item: PendingItem) => (
                                <div key={`${item.type}-${item.familyId}`} className="flex items-center gap-3 px-4 py-3">
                                    <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                                        item.type === 'ap_h_unmitigated' ? 'bg-rose-100' : 'bg-amber-100'
                                    }`}>
                                        {item.type === 'ap_h_unmitigated'
                                            ? <AlertTriangle size={14} className="text-rose-600" />
                                            : <GitMerge size={14} className="text-amber-600" />
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

                {/* ===== HERO: Continuar trabajo ===== */}
                {!projectsLoading && heroDoc && (
                    <section className="mb-12 opacity-0 animate-fade-in-up stagger-1" aria-label="Continuar trabajo">
                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
                            Continuar trabajo
                        </div>
                        <button
                            onClick={() => onSelectModule(moduleForType(heroDoc.type))}
                            className="w-full text-left bg-white rounded-2xl border border-slate-200 p-6 flex flex-wrap items-center gap-6 shadow-sm hover:border-slate-400 hover:shadow-md transition-all cursor-pointer group"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                                    {heroDoc.client && (
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">{heroDoc.client}</span>
                                    )}
                                    {heroDoc.client && <span className="text-slate-300">·</span>}
                                    <span className="text-[10px] text-amber-600 font-medium">
                                        Editado {formatRelative(heroDoc.updatedAt)}
                                    </span>
                                </div>
                                <h3 className="text-2xl font-semibold text-slate-900 tracking-tight">
                                    {cleanDocumentName(heroDoc.name)}
                                </h3>
                                <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-slate-500">
                                    <span className="font-semibold text-slate-700">{TYPE_LABELS[heroDoc.type]}</span>
                                    {heroDoc.partNumber && (<><span className="text-slate-300">·</span><span className="font-mono text-slate-600">{heroDoc.partNumber}</span></>)}
                                    {hasAmfeAlerts && (
                                        <>
                                            <span className="text-slate-300">·</span>
                                            <span className="inline-flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                                <span className="text-rose-700 font-medium">{amfeAlertCount} AP=H sin acción</span>
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 ml-auto">
                                <span className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md group-hover:bg-slate-800 inline-flex items-center gap-2">
                                    Continuar
                                    <ArrowRight size={14} />
                                </span>
                            </div>
                        </button>
                    </section>
                )}

                {/* ===== DOCUMENTOS APQP (4 cards) ===== */}
                <section className="mb-12 opacity-0 animate-fade-in-up stagger-2" aria-label="Documentos APQP">
                    <div className="flex items-baseline justify-between mb-4">
                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            Documentos APQP
                        </div>
                        <button
                            onClick={() => onSelectModule('registry')}
                            className="text-xs text-slate-500 hover:text-slate-900 transition-colors"
                        >
                            Ver Hub completo →
                        </button>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <ApqpDocCard
                            initial="P"
                            label="Diagrama de Flujo"
                            shortLabel="PFD"
                            count={documentCounts.pfd ?? 0}
                            onClick={() => onSelectModule('pfd')}
                        />
                        <ApqpDocCard
                            initial="A"
                            label="AMFE VDA"
                            shortLabel="AMFE"
                            count={documentCounts.amfe ?? 0}
                            alert={hasAmfeAlerts}
                            alertText={hasAmfeAlerts ? `${amfeAlertCount} AP=H` : undefined}
                            onClick={() => onSelectModule('amfe')}
                        />
                        <ApqpDocCard
                            initial="C"
                            label="Plan de Control"
                            shortLabel="CP"
                            count={documentCounts.controlPlan ?? 0}
                            onClick={() => onSelectModule('controlPlan')}
                        />
                        <ApqpDocCard
                            initial="H"
                            label="Hojas de Operaciones"
                            shortLabel="HO"
                            count={documentCounts.hojaOperaciones ?? 0}
                            onClick={() => onSelectModule('hojaOperaciones')}
                        />
                    </div>
                </section>

                {/* ===== MIS PROYECTOS (compacto, link al hub) ===== */}
                {!projectsLoading && projects.length > 0 && (
                    <section className="mb-12 opacity-0 animate-fade-in-up stagger-2" aria-label="Mis Proyectos">
                        <div className="flex items-center gap-3 mb-4">
                            <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <Package size={13} />
                                Mis Proyectos
                            </h2>
                            <p className="text-xs text-slate-400">
                                {projects.length} familias con APQP vinculado
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

                {/* ===== TWO-COLUMN: Herramientas (lista compacta) + Recientes ===== */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10 opacity-0 animate-fade-in-up stagger-3">

                    {/* Herramientas (lista vertical, sin colores únicos) */}
                    <div>
                        <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-3">
                            <Wrench size={13} />
                            Herramientas
                        </h2>
                        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                            <ToolRow
                                label="Tiempos y Balanceos"
                                desc="Cronometraje y balanceo de línea"
                                icon={<Clock size={16} className="text-slate-500" />}
                                onClick={() => onSelectModule('tiempos')}
                                ariaLabel="Abrir Tiempos y Balanceos"
                            />
                            <ToolRow
                                label="Reportes 8D"
                                desc="Análisis 8D con Ishikawa, 5 Por Qué y Punto de Escape"
                                icon={<ClipboardCheck size={16} className="text-slate-500" />}
                                onClick={() => onSelectModule('8dReports')}
                                ariaLabel="Abrir Reportes 8D"
                            />
                            <ToolRow
                                label="Solicitudes de Código"
                                desc="Solicitar generación de códigos ARB"
                                icon={<FilePlus2 size={16} className="text-slate-500" />}
                                onClick={() => onSelectModule('solicitud')}
                                ariaLabel="Abrir Solicitudes de Código"
                            />
                            <ToolRow
                                label="Manuales"
                                desc="Procedimientos y documentos HTML"
                                icon={<BookOpen size={16} className="text-slate-500" />}
                                onClick={() => onSelectModule('manuales')}
                                ariaLabel="Abrir Manuales de Ingeniería"
                            />
                            <ToolRow
                                label="Formatos Estándar"
                                desc="Plantillas Excel, PDF y Word"
                                icon={<FolderOpen size={16} className="text-slate-500" />}
                                onClick={() => onSelectModule('formatos')}
                                ariaLabel="Abrir Formatos Estándar"
                            />
                            <ToolRow
                                label="Datos y Seguridad"
                                desc="Backups, exportar, importar y sincronizar datos"
                                icon={<Shield size={16} className="text-slate-500" />}
                                onClick={() => onSelectModule('dataManager')}
                                ariaLabel="Abrir Datos y Seguridad"
                            />
                            {isAdmin && (
                                <ToolRow
                                    label="Administración"
                                    desc="Gestionar usuarios y permisos"
                                    icon={<Users size={16} className="text-slate-500" />}
                                    onClick={() => onSelectModule('admin')}
                                    ariaLabel="Abrir Administración de Usuarios"
                                />
                            )}
                        </div>
                    </div>

                    {/* Documentos Recientes */}
                    <div>
                        <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-3">
                            <FileText size={13} />
                            Documentos Recientes
                        </h2>

                        {recentDocuments.length > 0 ? (
                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                                {recentDocuments.slice(0, 5).map(doc => (
                                    <button
                                        key={`${doc.type}-${doc.id}`}
                                        onClick={() => onSelectModule(moduleForType(doc.type))}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left group"
                                    >
                                        <div className="flex-shrink-0 w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center">
                                            {TYPE_ICONS[doc.type]}
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <div className="text-sm text-slate-800 font-medium truncate" title={doc.name}>{cleanDocumentName(doc.name)}</div>
                                            <div className="text-xs text-slate-500 flex items-center gap-2">
                                                <span className="font-semibold">{TYPE_LABELS[doc.type]}</span>
                                                {doc.client && <span>{doc.client}</span>}
                                                {doc.partNumber && <span className="text-slate-600 font-mono">{doc.partNumber}</span>}
                                            </div>
                                        </div>
                                        <span className="text-xs text-slate-500 flex-shrink-0">
                                            {formatDate(doc.updatedAt)}
                                        </span>
                                        <ExternalLink size={12} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                    </button>
                                ))}
                                <button
                                    onClick={() => onSelectModule('registry')}
                                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors font-medium"
                                    title="Abrir Hub de Documentos APQP"
                                >
                                    <FolderOpen size={12} />
                                    Ver todos los documentos
                                    <ArrowRight size={12} />
                                </button>
                            </div>
                        ) : (
                            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
                                <FolderOpen size={28} className="mx-auto mb-2 text-slate-400" />
                                <p className="text-sm text-slate-500">No hay documentos aún</p>
                                <p className="text-xs text-slate-400 mt-1">
                                    Empezá creando un Diagrama de Flujo para iniciar tu proyecto APQP
                                </p>
                                <button
                                    onClick={() => onSelectModule('pfd')}
                                    className="mt-3 text-xs text-slate-700 hover:text-slate-900 font-medium transition-colors"
                                >
                                    Crear Diagrama de Flujo →
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ===== FOOTER (sin atajos visibles, atajos activos en handler) ===== */}
                <footer className="text-center text-xs opacity-0 animate-fade-in-up stagger-3 pb-4" role="contentinfo">
                    <p className="text-slate-400">
                        Barack Mercosul · Ingeniería de Calidad Automotriz
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

// ===== Sub-componentes locales =====

interface ApqpDocCardProps {
    initial: string;
    label: string;
    shortLabel: string;
    count: number;
    alert?: boolean;
    alertText?: string;
    onClick: () => void;
}

const ApqpDocCard: React.FC<ApqpDocCardProps> = ({ initial, label, count, alert, alertText, onClick }) => (
    <button
        onClick={onClick}
        className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-slate-400 hover:shadow-sm transition-all group"
    >
        <div className="flex items-start justify-between mb-3">
            <div className="w-9 h-9 rounded-md font-mono text-sm font-semibold flex items-center justify-center bg-slate-100 text-slate-700">
                {initial}
            </div>
            {alert && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    {alertText}
                </span>
            )}
        </div>
        <div className="text-sm font-medium text-slate-900">{label}</div>
        <div className="text-[11px] text-slate-500 mt-0.5">
            {count} doc{count !== 1 ? 's' : ''}
        </div>
    </button>
);

interface ToolRowProps {
    label: string;
    desc: string;
    icon: React.ReactNode;
    onClick: () => void;
    ariaLabel: string;
}

const ToolRow: React.FC<ToolRowProps> = ({ label, desc, icon, onClick, ariaLabel }) => (
    <button
        onClick={onClick}
        aria-label={ariaLabel}
        className="group w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 transition-colors"
    >
        <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0">
            {icon}
        </div>
        <div className="flex-1 min-w-0">
            <div className="text-sm text-slate-900 font-medium">{label}</div>
            <div className="text-xs text-slate-500 mt-0.5 truncate">{desc}</div>
        </div>
        <ArrowRight size={14} className="text-slate-300 group-hover:text-slate-600 transition-colors flex-shrink-0" />
    </button>
);

export default LandingPage;
