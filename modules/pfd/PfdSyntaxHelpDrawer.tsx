/**
 * PFD Syntax Help Drawer — right-side drawer with PFD tutorial + IA prompt template
 *
 * Two tabs:
 *  - "Tutorial": symbol legend, numbering rules (Barack), decisions, parallel lines.
 *  - "Prompt IA": copyable template parameterised with the current PFD header to
 *    paste into Claude/Gemini and get a JSON draft.
 */

import React, { useState, useMemo } from 'react';
import { X, BookOpen, Sparkles, Copy } from 'lucide-react';
import { PfdSymbol } from './PfdSymbols';
import { PFD_STEP_TYPES, type PfdStepType } from './pfdTypes';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    /** Header del PFD actual para parametrizar el prompt IA */
    header?: { partName?: string; customerName?: string; applicableParts?: string };
}

const STEP_DESCRIPTIONS: Record<PfdStepType, string> = {
    operation: 'Operación productiva. Se le asigna número OP (10, 20, 30...).',
    transport: 'Traslado de material entre sectores. Sin número de OP.',
    inspection: 'Control de calidad o verificación visual.',
    storage: 'Almacenamiento intermedio (WIP) o final. Triángulo invertido.',
    delay: 'Espera o demora del flujo (uso poco común).',
    decision: '¿Pregunta SI/NO. Ej: "¿PRODUCTO CONFORME?"',
    combined: 'Operación + Inspección en el mismo puesto.',
};

function buildPrompt(header?: Props['header']): string {
    const partName = header?.partName?.trim() || '[PRODUCTO]';
    const applicableParts = header?.applicableParts?.trim() || '[PART NUMBERS]';
    const customerName = header?.customerName?.trim() || '[CLIENTE]';

    return `Eres un asistente que genera flujogramas de proceso para Barack Mercosul (autopartes automotrices).

Producto: ${partName}
Part numbers: ${applicableParts}
Cliente: ${customerName}

Genera un flujograma siguiendo estas reglas:
- Numeración: OP 10, OP 20, OP 30 para operaciones principales. Reprocesos en serie 100+.
- Toda decisión: "¿PRODUCTO CONFORME?" con SI hacia abajo y NO hacia el costado.
- Cada falla puede ir a SCRAP directo o a Retrabajo (con paso destino).
- Empezá con "RECEPCIÓN DE MATERIA PRIMA" (storage) y un control de materia prima.
- Terminá con "CONTROL FINAL DE CALIDAD" + "EMBALAJE" + "ALMACÉN PRODUCTO TERMINADO".

Devuelve un JSON con esta estructura:
{
  "header": { "partName": "...", "customerName": "...", "applicableParts": "..." },
  "steps": [
    {
      "stepNumber": "OP 10",
      "stepType": "storage" | "operation" | "transport" | "inspection" | "decision" | "combined",
      "description": "...",
      "rejectDisposition": "none" | "scrap" | "rework" | "rework_or_scrap",
      "branchId": ""  // o "A", "B" para paralelas
    }
  ]
}

Solo el JSON, sin texto adicional ni markdown.`;
}

const PfdSyntaxHelpDrawer: React.FC<Props> = ({ isOpen, onClose, header }) => {
    const [tab, setTab] = useState<'tutorial' | 'prompt'>('tutorial');
    const [copied, setCopied] = useState(false);
    const promptText = useMemo(() => buildPrompt(header), [header]);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const handleCopy = async () => {
        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                await navigator.clipboard.writeText(promptText);
            } else if (textareaRef.current) {
                // Fallback for environments without clipboard API
                textareaRef.current.focus();
                textareaRef.current.select();
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Best-effort: still flash the feedback so user knows something happened
            if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.select();
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const tabBtn = (active: boolean) =>
        `flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition ${
            active ? 'bg-cyan-100 text-cyan-800' : 'text-gray-500 hover:bg-gray-100'
        }`;

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/30 z-40"
                    onClick={onClose}
                    data-testid="pfd-help-drawer-backdrop"
                    aria-hidden="true"
                />
            )}

            {/* Drawer */}
            <aside
                className={`fixed top-0 right-0 h-full w-[480px] max-w-full bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col transition-transform duration-200 ${
                    isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
                aria-hidden={!isOpen}
                role="dialog"
                aria-label="Ayuda — Diagrama de Flujo"
            >
                {/* Header */}
                <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-cyan-50">
                    <div className="flex items-center gap-2">
                        <BookOpen size={18} className="text-cyan-700" />
                        <h2 className="text-sm font-semibold text-cyan-800">Ayuda — Diagrama de Flujo</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:bg-cyan-100 text-cyan-700"
                        aria-label="Cerrar ayuda"
                    >
                        <X size={18} />
                    </button>
                </header>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 bg-white">
                    <button
                        type="button"
                        className={tabBtn(tab === 'tutorial')}
                        onClick={() => setTab('tutorial')}
                    >
                        <BookOpen size={14} />
                        Tutorial
                    </button>
                    <button
                        type="button"
                        className={tabBtn(tab === 'prompt')}
                        onClick={() => setTab('prompt')}
                    >
                        <Sparkles size={14} />
                        Prompt IA
                    </button>
                </div>

                {/* Body (scrollable) */}
                <div className="flex-1 overflow-y-auto p-4">
                    {tab === 'tutorial' && (
                        <div className="space-y-6 text-xs text-gray-700 leading-relaxed">
                            {/* 1. Símbolos del flujograma */}
                            <section>
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                                    1. Símbolos del flujograma
                                </h3>
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-200">
                                            <th className="py-1.5 pr-2 w-12">Símbolo</th>
                                            <th className="py-1.5 pr-2 w-28">Nombre</th>
                                            <th className="py-1.5">Cuándo usar</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {PFD_STEP_TYPES.map(({ value, label }) => (
                                            <tr key={value} className="border-b border-gray-100 align-top">
                                                <td className="py-2 pr-2">
                                                    <PfdSymbol type={value} size={28} />
                                                </td>
                                                <td className="py-2 pr-2 font-medium text-gray-800">{label}</td>
                                                <td className="py-2 text-gray-600">
                                                    {STEP_DESCRIPTIONS[value]}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </section>

                            {/* 2. Reglas de numeración Barack */}
                            <section>
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                                    2. Reglas de numeración Barack
                                </h3>
                                <ul className="list-disc pl-5 space-y-1.5">
                                    <li>Operaciones principales: OP 10, OP 20, OP 30...</li>
                                    <li>Sub-operaciones del mismo sector: OP 50 + OP 51 (relacionadas).</li>
                                    <li>Reprocesos: OP 100, OP 101, OP 102, OP 110, OP 111... (serie 100+).</li>
                                    <li>Preparaciones de sector: OP 15 (prep de OP 20), OP 25 (prep de OP 30).</li>
                                    <li>Transportes y almacenamientos: SIN número de OP (son conectores).</li>
                                </ul>
                            </section>

                            {/* 3. Decisiones y rechazos */}
                            <section>
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                                    3. Decisiones y rechazos
                                </h3>
                                <ul className="list-disc pl-5 space-y-1.5">
                                    <li>Toda decisión usa formato &quot;¿PRODUCTO CONFORME?&quot; o &quot;¿MATERIAL CONFORME?&quot;</li>
                                    <li>Rama SI: continúa el flujo principal.</li>
                                    <li>Rama NO: 3 opciones — descarte directo (SCRAP), retrabajo, o reclamo a proveedor.</li>
                                    <li>Para reproceso recuperable: usar Disposición = &quot;Retrabajo&quot; + paso destino.</li>
                                    <li>La &quot;Clasificación y Segregación&quot; NO va como operación separada (la asume el control final).</li>
                                </ul>
                            </section>

                            {/* 4. Líneas paralelas */}
                            <section>
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                                    4. Líneas paralelas (procesos interdependientes)
                                </h3>
                                <ul className="list-disc pl-5 space-y-1.5">
                                    <li>Cuando dos sub-procesos corren en paralelo (ej: corte + costura vs. inyección): usar campo &quot;Línea&quot; = A, B, C...</li>
                                    <li>Los pasos con misma Línea quedan agrupados en su carril visual.</li>
                                    <li>El flujo principal continúa cuando un paso vuelve a Línea = vacío.</li>
                                </ul>
                            </section>
                        </div>
                    )}

                    {tab === 'prompt' && (
                        <div className="space-y-3 text-xs text-gray-700">
                            <p>
                                Copia este prompt en Claude o Gemini para que genere un borrador del flujograma. Pega después la respuesta JSON en el editor.
                            </p>

                            <textarea
                                ref={textareaRef}
                                readOnly
                                value={promptText}
                                aria-label="Prompt IA"
                                className="w-full h-72 text-[11px] font-mono bg-gray-50 border border-gray-200 rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-cyan-400"
                            />

                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-600 text-white hover:bg-cyan-700 transition"
                                >
                                    <Copy size={14} />
                                    Copiar prompt
                                </button>
                                {copied && (
                                    <span className="text-cyan-600 text-xs font-medium" role="status">
                                        ¡Copiado!
                                    </span>
                                )}
                            </div>

                            <p className="text-[11px] text-gray-500 pt-2 border-t border-gray-100 mt-3">
                                Esta herramienta NO consulta IA directamente — solo genera el prompt para que lo pegues en tu chat de Claude/Gemini. Después pegás la respuesta JSON manualmente.
                            </p>
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
};

export default PfdSyntaxHelpDrawer;
