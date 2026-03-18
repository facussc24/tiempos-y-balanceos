import React, { useEffect, useMemo, useState } from 'react';
import {
    Clock, ShieldAlert, ClipboardCheck, GitBranch, ArrowRight,
    FolderOpen, FileText, Sparkles, AlertTriangle, GitMerge,
    ChevronDown, ChevronUp, ExternalLink, FilePlus2, Wrench,
    BookOpen, Shield, LogOut, Users, Package,
} from 'lucide-react';
import barackLogo from '../src/assets/barack_logo.png';
import type { DocumentType, DocumentRegistryEntry } from './registry/documentRegistryTypes';
import { useAuth } from '../components/auth/AuthProvider';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { useProjectHub } from '../hooks/useProjectHub';
import type { PendingItem } from '../hooks/useProjectHub';
import { ProjectTable } from '../components/landing/ProjectTable';

interface LandingPageProps {
    onSelectModule: (module: 'pfd' | 'pfdTest' | 'tiempos' | 'amfe' | 'controlPlan' | 'hojaOperaciones' | 'registry' | 'solicitud' | 'manuales' | 'formatos' | 'dataManager' | 'admin') => void;
    /** Document counts per type from the registry */
    documentCounts?: Partial<Record<DocumentType, number>>;
    /** Most recently updated documents (up to 5) */
    recentDocuments?: DocumentRegistryEntry[];
}

/** Module definitions with APQP order */
const APQP_MODULES = [
    {
        step: 1,
        key: 'pfd' as const,
        title: 'Diagrama de Flujo',
        shortDesc: 'Dibujá el proceso paso a paso',
        icon: GitBranch,
        colors: {
            bg: 'bg-cyan-500/15',
            bgHover: 'hover:bg-cyan-500/25',
            text: 'text-cyan-400',
            border: 'border-cyan-500/30',
            borderHover: 'hover:border-cyan-400/60',
            badge: 'bg-cyan-500/20 text-cyan-300',
            glow: 'hover:shadow-cyan-500/15',
        },
    },
    {
        step: 2,
        key: 'amfe' as const,
        title: 'AMFE VDA',
        shortDesc: 'Analizá fallas y riesgos',
        icon: ShieldAlert,
        colors: {
            bg: 'bg-orange-500/15',
            bgHover: 'hover:bg-orange-500/25',
            text: 'text-orange-400',
            border: 'border-orange-500/30',
            borderHover: 'hover:border-orange-400/60',
            badge: 'bg-orange-500/20 text-orange-300',
            glow: 'hover:shadow-orange-500/15',
        },
    },
    {
        step: 3,
        key: 'controlPlan' as const,
        title: 'Plan de Control',
        shortDesc: 'Definí los controles de calidad',
        icon: ClipboardCheck,
        colors: {
            bg: 'bg-green-500/15',
            bgHover: 'hover:bg-green-500/25',
            text: 'text-green-400',
            border: 'border-green-500/30',
            borderHover: 'hover:border-green-400/60',
            badge: 'bg-green-500/20 text-green-300',
            glow: 'hover:shadow-green-500/15',
        },
    },
    {
        step: 4,
        key: 'hojaOperaciones' as const,
        title: 'Hoja de Operaciones',
        shortDesc: 'Instrucciones para el operador',
        icon: FileText,
        colors: {
            bg: 'bg-indigo-500/15',
            bgHover: 'hover:bg-indigo-500/25',
            text: 'text-indigo-400',
            border: 'border-indigo-500/30',
            borderHover: 'hover:border-indigo-400/60',
            badge: 'bg-indigo-500/20 text-indigo-300',
            glow: 'hover:shadow-indigo-500/15',
        },
    },
];

const TYPE_ICONS: Record<DocumentType, React.ReactNode> = {
    pfd: <GitBranch size={14} className="text-cyan-400" />,
    amfe: <ShieldAlert size={14} className="text-orange-400" />,
    controlPlan: <ClipboardCheck size={14} className="text-green-400" />,
    hojaOperaciones: <FileText size={14} className="text-indigo-400" />,
};

const TYPE_LABELS: Record<DocumentType, string> = {
    pfd: 'PFD',
    amfe: 'AMFE',
    controlPlan: 'CP',
    hojaOperaciones: 'HO',
};

const LandingPage: React.FC<LandingPageProps> = ({ onSelectModule, documentCounts = {}, recentDocuments = [] }) => {
    const [showWorkflow, setShowWorkflow] = useState(false);
    const [autoOpenedGuide, setAutoOpenedGuide] = useState(false);
    const { user, signOut, userDisplayName } = useAuth();
    const { isAdmin } = useIsAdmin();
    const { projects, pendingItems, loading: projectsLoading } = useProjectHub();

    const totalDocs = useMemo(() =>
        Object.values(documentCounts).reduce((sum, n) => sum + (n || 0), 0),
        [documentCounts]
    );

    // Auto-open APQP guide for new users (no documents yet)
    useEffect(() => {
        if (totalDocs === 0 && !autoOpenedGuide) {
            setShowWorkflow(true);
            setAutoOpenedGuide(true);
        }
    }, [totalDocs, autoOpenedGuide]);

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

    /** Strip hierarchy path (e.g. "VWA/PATAGONIA/TOP_ROLL" -> "Top Roll") */
    const cleanDocumentName = (name: string): string => {
        if (!name || !name.includes('/')) return name;
        const lastSegment = name.split('/').pop() || name;
        return lastSegment
            .replace(/_/g, ' ')
            .split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 font-sans">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
                <div className="absolute inset-0" style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
                    backgroundSize: '40px 40px'
                }} />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-6 py-10">

                {/* ===== HEADER ===== */}
                <header className="flex items-center gap-4 mb-10 opacity-0 animate-fade-in-up">
                    <img
                        src={barackLogo}
                        alt="Barack Mercosul"
                        className="h-12"
                        style={{ filter: 'drop-shadow(0 4px 12px rgba(59, 130, 246, 0.25))' }}
                    />
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight leading-tight">
                            Barack Mercosul
                        </h1>
                        <p className="text-sm text-blue-400 font-medium">
                            Ingeniería de Calidad Automotriz
                        </p>
                    </div>
                    <div className="flex-grow" />
                    {totalDocs > 0 && (
                        <button
                            onClick={() => onSelectModule('registry')}
                            className="text-xs text-slate-400 hover:text-blue-300 transition-colors flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 hover:border-blue-400/40"
                        >
                            <FolderOpen size={13} />
                            <span>{totalDocs} documentos</span>
                        </button>
                    )}
                    {user && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 hidden sm:inline truncate max-w-[140px]" title={user.email ?? ''}>
                                {userDisplayName}
                            </span>
                            <button
                                onClick={() => signOut()}
                                title={`Cerrar sesión (${user.email ?? user.id})`}
                                className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-1.5 hover:border-slate-500/40"
                            >
                                <LogOut size={13} />
                                <span>Salir</span>
                            </button>
                        </div>
                    )}
                </header>

                {/* ===== PENDIENTES (only if items exist) ===== */}
                {!projectsLoading && pendingItems.length > 0 && (
                    <section className="mb-8 opacity-0 animate-fade-in-up stagger-1" aria-label="Pendientes">
                        <h2 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-2 mb-3">
                            <AlertTriangle size={14} />
                            Requiere atención
                        </h2>
                        <div className="bg-red-500/[0.06] border border-red-500/20 rounded-xl divide-y divide-red-500/10 overflow-hidden">
                            {pendingItems.map((item: PendingItem) => (
                                <div key={`${item.type}-${item.familyId}`} className="flex items-center gap-3 px-4 py-3">
                                    <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                                        item.type === 'ap_h_unmitigated' ? 'bg-red-500/20' : 'bg-amber-500/20'
                                    }`}>
                                        {item.type === 'ap_h_unmitigated'
                                            ? <AlertTriangle size={14} className="text-red-400" />
                                            : <GitMerge size={14} className="text-amber-400" />
                                        }
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <span className="text-sm text-white font-medium">{item.familyName}</span>
                                        <span className="text-xs text-slate-400 ml-2">
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
                            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <Package size={14} />
                                Mis Proyectos
                            </h2>
                            <p className="text-xs text-slate-500">
                                Familias de producto con documentación APQP vinculada
                            </p>
                        </div>
                        <ProjectTable
                            projects={projects}
                            onSelectProject={() => onSelectModule('amfe')}
                        />
                    </section>
                )}

                {/* ===== TWO-COLUMN: Gestion de Ingenieria + Recientes ===== */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10 opacity-0 animate-fade-in-up stagger-2">

                    {/* Gestión de Ingeniería - standalone tools */}
                    <div>
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
                            <Wrench size={14} />
                            Herramientas
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                                onClick={() => onSelectModule('tiempos')}
                                aria-label="Abrir Tiempos y Balanceos"
                                className="group w-full text-left bg-white/[0.04] backdrop-blur-sm border border-blue-500/30 rounded-xl p-4
                                           hover:bg-blue-500/10 hover:border-blue-400/60 hover:shadow-lg hover:shadow-blue-500/15 hover:-translate-y-0.5
                                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-white/70
                                           transition-all duration-200 cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-blue-500/15 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <Clock size={20} className="text-blue-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-bold text-white">Tiempos y Balanceos</h3>
                                        <p className="text-xs text-slate-400 mt-0.5">Cronometraje y balanceo de línea</p>
                                    </div>
                                    <ArrowRight size={14} className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity ml-auto flex-shrink-0" />
                                </div>
                            </button>
                            <button
                                onClick={() => onSelectModule('solicitud')}
                                aria-label="Abrir Solicitudes de Código"
                                className="group w-full text-left bg-white/[0.04] backdrop-blur-sm border border-amber-500/30 rounded-xl p-4
                                           hover:bg-amber-500/10 hover:border-amber-400/60 hover:shadow-lg hover:shadow-amber-500/15 hover:-translate-y-0.5
                                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-white/70
                                           transition-all duration-200 cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-amber-500/15 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <FilePlus2 size={20} className="text-amber-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-bold text-white">Solicitudes de Código</h3>
                                        <p className="text-xs text-slate-400 mt-0.5">Solicitar generación de códigos ARB</p>
                                    </div>
                                    <ArrowRight size={14} className="text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity ml-auto flex-shrink-0" />
                                </div>
                            </button>
                            <button
                                onClick={() => onSelectModule('manuales')}
                                aria-label="Abrir Manuales de Ingeniería"
                                className="group w-full text-left bg-white/[0.04] backdrop-blur-sm border border-teal-500/30 rounded-xl p-4
                                           hover:bg-teal-500/10 hover:border-teal-400/60 hover:shadow-lg hover:shadow-teal-500/15 hover:-translate-y-0.5
                                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-white/70
                                           transition-all duration-200 cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-teal-500/15 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <BookOpen size={20} className="text-teal-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-bold text-white">Manuales</h3>
                                        <p className="text-xs text-slate-400 mt-0.5">Procedimientos y documentos HTML</p>
                                    </div>
                                    <ArrowRight size={14} className="text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity ml-auto flex-shrink-0" />
                                </div>
                            </button>
                            <button
                                onClick={() => onSelectModule('formatos')}
                                aria-label="Abrir Formatos Estándar"
                                className="group w-full text-left bg-white/[0.04] backdrop-blur-sm border border-purple-500/30 rounded-xl p-4
                                           hover:bg-purple-500/10 hover:border-purple-400/60 hover:shadow-lg hover:shadow-purple-500/15 hover:-translate-y-0.5
                                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-white/70
                                           transition-all duration-200 cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-purple-500/15 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <FolderOpen size={20} className="text-purple-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-bold text-white">Formatos Estándar</h3>
                                        <p className="text-xs text-slate-400 mt-0.5">Plantillas Excel, PDF y Word</p>
                                    </div>
                                    <ArrowRight size={14} className="text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity ml-auto flex-shrink-0" />
                                </div>
                            </button>
                            <button
                                onClick={() => onSelectModule('dataManager')}
                                aria-label="Abrir Datos y Seguridad"
                                className="group w-full text-left bg-white/[0.04] backdrop-blur-sm border border-rose-500/30 rounded-xl p-4
                                           hover:bg-rose-500/10 hover:border-rose-400/60 hover:shadow-lg hover:shadow-rose-500/15 hover:-translate-y-0.5
                                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-white/70
                                           transition-all duration-200 cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-rose-500/15 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <Shield size={20} className="text-rose-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-bold text-white">Datos y Seguridad</h3>
                                        <p className="text-xs text-slate-400 mt-0.5">Backups, exportar, importar y sincronizar datos</p>
                                    </div>
                                    <ArrowRight size={14} className="text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity ml-auto flex-shrink-0" />
                                </div>
                            </button>
                            {isAdmin && (
                                <button
                                    onClick={() => onSelectModule('admin')}
                                    aria-label="Abrir Administración de Usuarios"
                                    className="group w-full text-left bg-white/[0.04] backdrop-blur-sm border border-violet-500/30 rounded-xl p-4
                                               hover:bg-violet-500/10 hover:border-violet-400/60 hover:shadow-lg hover:shadow-violet-500/15 hover:-translate-y-0.5
                                               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-white/70
                                               transition-all duration-200 cursor-pointer"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="bg-violet-500/15 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <Users size={20} className="text-violet-400" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-bold text-white">Administración</h3>
                                            <p className="text-xs text-slate-400 mt-0.5">Gestionar usuarios y permisos</p>
                                        </div>
                                        <ArrowRight size={14} className="text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity ml-auto flex-shrink-0" />
                                    </div>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Recent documents */}
                    <div>
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
                            <Sparkles size={14} />
                            Documentos Recientes
                        </h2>

                        {recentDocuments.length > 0 ? (
                            <div className="bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden divide-y divide-white/5">
                                {recentDocuments.slice(0, 5).map(doc => (
                                    <button
                                        key={`${doc.type}-${doc.id}`}
                                        onClick={() => onSelectModule(doc.type === 'controlPlan' ? 'controlPlan' : doc.type === 'hojaOperaciones' ? 'hojaOperaciones' : doc.type === 'pfd' ? 'pfd' : doc.type === 'amfe' ? 'amfe' : 'registry')}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors text-left group"
                                    >
                                        <div className="flex-shrink-0 w-7 h-7 rounded-md bg-white/5 flex items-center justify-center">
                                            {TYPE_ICONS[doc.type]}
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <div className="text-sm text-white font-medium truncate" title={doc.name}>{cleanDocumentName(doc.name)}</div>
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
                                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs text-blue-400 hover:text-blue-300 hover:bg-white/[0.03] transition-colors font-medium"
                                >
                                    <FolderOpen size={12} />
                                    Ver todos los documentos
                                    <ArrowRight size={12} />
                                </button>
                            </div>
                        ) : (
                            <div className="bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-xl p-6 text-center">
                                <FolderOpen size={28} className="mx-auto mb-2 text-slate-600" />
                                <p className="text-sm text-slate-400">No hay documentos aún</p>
                                <p className="text-xs text-slate-500 mt-1">
                                    Empezá creando un Diagrama de Flujo para iniciar tu proyecto APQP
                                </p>
                                <button
                                    onClick={() => onSelectModule('pfd')}
                                    className="mt-3 text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                                >
                                    Crear Diagrama de Flujo →
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ===== WORKFLOW GUIDE (collapsible) ===== */}
                <div className="mb-8 opacity-0 animate-fade-in-up stagger-3">
                    <button
                        onClick={() => setShowWorkflow(!showWorkflow)}
                        className="group inline-flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors text-xs font-medium"
                        aria-expanded={showWorkflow}
                        aria-controls="workflow-guide"
                    >
                        <span className="text-blue-400/70 font-bold">
                            {showWorkflow ? 'Ocultar' : '¿Primera vez?'} Guía de flujo APQP
                        </span>
                        {showWorkflow
                            ? <ChevronUp size={14} className="text-blue-400/70" />
                            : <ChevronDown size={14} className="text-blue-400/70" />
                        }
                    </button>

                    {showWorkflow && (
                        <div id="workflow-guide" className="mt-4 bg-white/[0.03] border border-white/10 rounded-xl p-5" role="region" aria-label="Guía APQP">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {APQP_MODULES.map((step) => {
                                    const Icon = step.icon;
                                    return (
                                        <div key={step.key} className="flex gap-3">
                                            <div className={`flex-shrink-0 w-8 h-8 rounded-full ${step.colors.bg} flex items-center justify-center`}>
                                                <span className={`text-xs font-black ${step.colors.text}`}>{step.step}</span>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                                                    <Icon size={12} className={step.colors.text} />
                                                    {step.title}
                                                </h4>
                                                <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
                                                    {step.key === 'pfd' && 'Definí cada operación del proceso productivo usando simbología ASME. Este es el punto de partida.'}
                                                    {step.key === 'amfe' && 'Para cada operación, analizá fallas, causas, severidad (S), ocurrencia (O) y detección (D). La IA te ayuda.'}
                                                    {step.key === 'controlPlan' && 'Se genera desde el AMFE. Qué controlar, cómo medirlo, cada cuánto, y qué hacer si falla.'}
                                                    {step.key === 'hojaOperaciones' && 'El documento para el puesto de trabajo: pasos, EPP, controles CC/SC y plan de reacción.'}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-4 bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-2.5 text-center">
                                <p className="text-blue-300 text-xs">
                                    <span className="font-bold">Consejo:</span> Si ya tenés un AMFE hecho en papel o Excel, podés empezar directamente por el AMFE. El Copiloto IA te ayuda a completarlo.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* ===== FOOTER ===== */}
                <footer className="text-center text-xs opacity-0 animate-fade-in-up stagger-4 pb-4" role="contentinfo">
                    <p className="text-slate-400">
                        Atajos: <kbd className="bg-white/10 px-1.5 py-0.5 rounded font-mono text-slate-300 border border-white/10">1</kbd>-<kbd className="bg-white/10 px-1.5 py-0.5 rounded font-mono text-slate-300 border border-white/10">4</kbd> APQP
                        <span className="mx-1.5 text-slate-500">·</span>
                        <kbd className="bg-white/10 px-1.5 py-0.5 rounded font-mono text-slate-300 border border-white/10">5</kbd> Tiempos
                        <span className="mx-1.5 text-slate-500">·</span>
                        <kbd className="bg-white/10 px-1.5 py-0.5 rounded font-mono text-slate-300 border border-white/10">6</kbd> Hub
                        <span className="mx-1.5 text-slate-500">·</span>
                        <kbd className="bg-white/10 px-1.5 py-0.5 rounded font-mono text-slate-300 border border-white/10">7</kbd>-<kbd className="bg-white/10 px-1.5 py-0.5 rounded font-mono text-slate-300 border border-white/10">9</kbd> Herramientas
                    </p>
                </footer>
            </div>
        </div>
    );
};

export default LandingPage;
