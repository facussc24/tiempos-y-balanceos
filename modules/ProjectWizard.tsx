/**
 * ProjectWizard - V4.1 New Study Creation Wizard
 * 
 * Step-by-step wizard for creating new studies with:
 * - Step 1: Select/Create Client
 * - Step 2: Select/Create Project
 * - Step 3: Select/Create Part
 * - Step 4: Confirm and Create Folder Structure
 * 
 * @module ProjectWizard
 * @version 4.1.0
 */
import React, { useState, useEffect, useRef } from 'react';
import {
    Users, FolderOpen, Box, CheckCircle, ArrowRight, ArrowLeft,
    Plus, Loader2, FolderTree, Sparkles, XCircle
} from 'lucide-react';
import { useModalTransition } from '../hooks/useModalTransition';

interface ProjectWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (selection: { client: string; project: string; part: string }) => void;
    existingClients?: string[];
    getProjectsForClient?: (client: string) => Promise<string[]>;
    getPartsForProject?: (client: string, project: string) => Promise<string[]>;
}

type Step = 1 | 2 | 3 | 4;

export const ProjectWizard: React.FC<ProjectWizardProps> = ({
    isOpen,
    onClose,
    onComplete,
    existingClients = [],
    getProjectsForClient,
    getPartsForProject
}) => {
    // Animation state
    const { shouldRender, isClosing } = useModalTransition(isOpen, 200);

    const [step, setStep] = useState<Step>(1);
    const [client, setClient] = useState('');
    const [project, setProject] = useState('');
    const [part, setPart] = useState('');
    const [isNewClient, setIsNewClient] = useState(false);
    const [isNewProject, setIsNewProject] = useState(false);
    const [_isNewPart, setIsNewPart] = useState(false);
    const [projects, setProjects] = useState<string[]>([]);
    const [_parts, setParts] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // Request version tracking for race condition prevention
    const projectsRequestRef = useRef(0);
    const partsRequestRef = useRef(0);

    // A11y: Ref for modal container to manage focus
    const modalRef = useRef<HTMLDivElement>(null);
    // A11y: Ref for first input to set initial focus
    const firstInputRef = useRef<HTMLSelectElement>(null);

    // Reset when wizard opens
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setClient('');
            setProject('');
            setPart('');
            setIsNewClient(false);
            setIsNewProject(false);
            setIsNewPart(false);
            projectsRequestRef.current = 0;
            partsRequestRef.current = 0;
            // A11y: Focus first input when opened (better than container)
            setTimeout(() => firstInputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // A11y: Handle Escape key and focus trap
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
            return;
        }

        // Focus trap: keep Tab navigation within modal
        if (e.key === 'Tab' && modalRef.current) {
            const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
                'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement?.focus();
            } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement?.focus();
            }
        }
    };

    // Load projects when client changes (with race condition protection)
    useEffect(() => {
        if (client && !isNewClient && getProjectsForClient) {
            const requestVersion = ++projectsRequestRef.current;
            setIsLoading(true);
            getProjectsForClient(client)
                .then(data => {
                    // Only update if this is still the latest request
                    if (requestVersion === projectsRequestRef.current) {
                        setProjects(data);
                    }
                })
                .finally(() => {
                    if (requestVersion === projectsRequestRef.current) {
                        setIsLoading(false);
                    }
                });
        }
    }, [client, isNewClient, getProjectsForClient]);

    // Load parts when project changes (with race condition protection)
    useEffect(() => {
        if (client && project && !isNewProject && getPartsForProject) {
            const requestVersion = ++partsRequestRef.current;
            setIsLoading(true);
            getPartsForProject(client, project)
                .then(data => {
                    if (requestVersion === partsRequestRef.current) {
                        setParts(data);
                    }
                })
                .finally(() => {
                    if (requestVersion === partsRequestRef.current) {
                        setIsLoading(false);
                    }
                });
        }
    }, [client, project, isNewProject, getPartsForProject]);

    const handleNext = () => {
        if (step < 4) setStep((step + 1) as Step);
    };

    const handleBack = () => {
        if (step > 1) setStep((step - 1) as Step);
    };

    const handleCreate = async () => {
        setIsCreating(true);
        // Simulate folder creation delay
        await new Promise(r => setTimeout(r, 1500));
        onComplete({ client, project, part });
        setIsCreating(false);
    };

    const canProceed = () => {
        switch (step) {
            case 1: return client.trim().length > 0;
            case 2: return project.trim().length > 0;
            case 3: return part.trim().length > 0;
            case 4: return true;
            default: return false;
        }
    };

    if (!shouldRender) return null;

    return (
        <div className={`fixed inset-0 z-modal-backdrop flex items-center justify-center ${isClosing ? 'pointer-events-none' : ''}`}>
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'opacity-100 animate-in fade-in duration-200'}`}
                onClick={onClose}
            />

            {/* Modal */}
            <div
                ref={modalRef}
                tabIndex={-1}
                onKeyDown={handleKeyDown}
                role="dialog"
                aria-modal="true"
                aria-labelledby="wizard-title"
                className={`relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden outline-none transition-all duration-200 ${isClosing ? 'scale-95 opacity-0' : 'animate-scale-in'}`}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white relative">
                    <button
                        onClick={onClose}
                        aria-label="Cerrar"
                        className="absolute top-4 right-4 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <XCircle size={22} />
                    </button>
                    <h2 id="wizard-title" className="text-xl font-bold flex items-center gap-2 pr-8">
                        <Sparkles size={24} />
                        Nuevo Estudio
                    </h2>
                    <p className="text-blue-100 text-sm mt-1">
                        Configura la ubicación de tu nuevo estudio de tiempos
                    </p>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center justify-between px-6 py-4 bg-[var(--gray-50)] border-b border-[var(--gray-200)]">
                    {[
                        { num: 1, label: 'Cliente', icon: Users },
                        { num: 2, label: 'Proyecto', icon: FolderOpen },
                        { num: 3, label: 'Pieza', icon: Box },
                        { num: 4, label: 'Confirmar', icon: CheckCircle },
                    ].map((s, idx) => (
                        <div key={s.num} className="flex items-center">
                            <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors
                ${step >= s.num
                                    ? 'bg-[var(--primary-500)] text-white'
                                    : 'bg-[var(--gray-200)] text-[var(--gray-500)]'
                                }
              `}>
                                {step > s.num ? <CheckCircle size={16} /> : s.num}
                            </div>
                            {idx < 3 && (
                                <div className={`w-12 h-0.5 mx-1 ${step > s.num ? 'bg-[var(--primary-500)]' : 'bg-[var(--gray-200)]'}`} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Step Content */}
                <div className="p-6 min-h-[280px]">
                    {step === 1 && (
                        <StepContent
                            title="Selecciona el Cliente"
                            description="Elige un cliente existente o crea uno nuevo"
                            icon={Users}
                        >
                            {!isNewClient ? (
                                <div className="space-y-3">
                                    <select
                                        ref={firstInputRef}
                                        value={client}
                                        onChange={(e) => setClient(e.target.value)}
                                        className="w-full px-4 py-3 border border-[var(--gray-200)] rounded-lg focus:ring-2 focus:ring-[var(--primary-500)] focus:border-[var(--primary-500)]"
                                    >
                                        <option value="">-- Seleccionar cliente --</option>
                                        {existingClients.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => { setIsNewClient(true); setClient(''); }}
                                        className="flex items-center gap-2 text-sm text-[var(--primary-600)] hover:text-[var(--primary-700)]"
                                    >
                                        <Plus size={16} /> Crear nuevo cliente
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={client}
                                        onChange={(e) => setClient(e.target.value.toUpperCase())}
                                        placeholder="Nombre del cliente (ej: TOYOTA)"
                                        className="w-full px-4 py-3 border border-[var(--gray-200)] rounded-lg focus:ring-2 focus:ring-[var(--primary-500)] focus:border-[var(--primary-500)] uppercase"
                                        autoFocus
                                    />
                                    <button
                                        onClick={() => { setIsNewClient(false); setClient(''); }}
                                        className="text-sm text-[var(--gray-500)] hover:text-[var(--gray-700)]"
                                    >
                                        ← Volver a lista existente
                                    </button>
                                </div>
                            )}
                        </StepContent>
                    )}

                    {step === 2 && (
                        <StepContent
                            title="Selecciona el Proyecto"
                            description={`Proyectos de ${client}`}
                            icon={FolderOpen}
                        >
                            {isLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 size={24} className="animate-spin text-[var(--primary-500)]" />
                                </div>
                            ) : !isNewProject ? (
                                <div className="space-y-3">
                                    <select
                                        value={project}
                                        onChange={(e) => setProject(e.target.value)}
                                        className="w-full px-4 py-3 border border-[var(--gray-200)] rounded-lg focus:ring-2 focus:ring-[var(--primary-500)] focus:border-[var(--primary-500)]"
                                    >
                                        <option value="">-- Seleccionar proyecto --</option>
                                        {projects.map(p => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => { setIsNewProject(true); setProject(''); }}
                                        className="flex items-center gap-2 text-sm text-[var(--primary-600)] hover:text-[var(--primary-700)]"
                                    >
                                        <Plus size={16} /> Crear nuevo proyecto
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={project}
                                        onChange={(e) => setProject(e.target.value.toUpperCase())}
                                        placeholder="Nombre del proyecto (ej: HILUX_2024)"
                                        className="w-full px-4 py-3 border border-[var(--gray-200)] rounded-lg focus:ring-2 focus:ring-[var(--primary-500)] focus:border-[var(--primary-500)] uppercase"
                                        autoFocus
                                    />
                                    <button
                                        onClick={() => { setIsNewProject(false); setProject(''); }}
                                        className="text-sm text-[var(--gray-500)] hover:text-[var(--gray-700)]"
                                    >
                                        ← Volver a lista existente
                                    </button>
                                </div>
                            )}
                        </StepContent>
                    )}

                    {step === 3 && (
                        <StepContent
                            title="Nombre de la Pieza"
                            description={`${client} / ${project}`}
                            icon={Box}
                        >
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    value={part}
                                    onChange={(e) => setPart(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                                    placeholder="Nombre de la pieza (ej: ASIENTO_CONDUCTOR)"
                                    className="w-full px-4 py-3 border border-[var(--gray-200)] rounded-lg focus:ring-2 focus:ring-[var(--primary-500)] focus:border-[var(--primary-500)] uppercase"
                                    autoFocus
                                />
                                <p className="text-xs text-[var(--gray-400)]">
                                    Los espacios se reemplazarán por guiones bajos automáticamente
                                </p>
                            </div>
                        </StepContent>
                    )}

                    {step === 4 && (
                        <StepContent
                            title="Confirmar Estructura"
                            description="Se crearán las siguientes carpetas"
                            icon={FolderTree}
                        >
                            <div className="bg-[var(--gray-50)] rounded-lg p-4 font-mono text-sm space-y-1">
                                <div className="text-[var(--gray-500)]">📂 01_DATA</div>
                                <div className="pl-4 text-[var(--gray-500)]">└── 📁 {client}</div>
                                <div className="pl-8 text-[var(--gray-500)]">└── 📁 {project}</div>
                                <div className="pl-12 text-[var(--primary-600)] font-semibold">└── 📄 {part}/master.json</div>
                                <div className="mt-3 pt-3 border-t border-[var(--gray-200)]">
                                    <div className="text-[var(--gray-500)]">📂 02_MEDIA/{client}/{project}/{part}/</div>
                                    <div className="text-[var(--gray-500)]">📂 04_REPORTES/{client}/{project}/{part}/</div>
                                </div>
                            </div>
                        </StepContent>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between p-6 bg-[var(--gray-50)] border-t border-[var(--gray-200)]">
                    <button
                        onClick={step === 1 ? onClose : handleBack}
                        className="px-4 py-2 text-[var(--gray-600)] hover:text-[var(--gray-800)] font-medium flex items-center gap-2"
                    >
                        <ArrowLeft size={16} />
                        {step === 1 ? 'Cancelar' : 'Atrás'}
                    </button>

                    {step < 4 ? (
                        <button
                            onClick={handleNext}
                            disabled={!canProceed()}
                            className="px-6 py-2.5 bg-[var(--primary-500)] text-white rounded-lg font-medium flex items-center gap-2 hover:bg-[var(--primary-600)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Siguiente
                            <ArrowRight size={16} />
                        </button>
                    ) : (
                        <button
                            onClick={handleCreate}
                            disabled={isCreating}
                            className="px-6 py-2.5 bg-emerald-500 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                        >
                            {isCreating ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Creando...
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={16} />
                                    Crear Estudio
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// Step Content Wrapper
interface StepContentProps {
    title: string;
    description: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    children: React.ReactNode;
}

const StepContent: React.FC<StepContentProps> = ({ title, description, icon: Icon, children }) => (
    <div className="animate-fade-in-up">
        <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-[var(--primary-50)] text-[var(--primary-600)]">
                <Icon size={20} />
            </div>
            <div>
                <h3 className="font-semibold text-[var(--gray-800)]">{title}</h3>
                <p className="text-sm text-[var(--gray-500)]">{description}</p>
            </div>
        </div>
        {children}
    </div>
);
