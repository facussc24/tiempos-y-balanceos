/**
 * PFD Help Panel — In-app user manual for the Process Flow Diagram module
 *
 * C9-U2: Comprehensive guide for quality engineers.
 * Covers: what is a PFD, step types, parallel flows, inspection decisions,
 * keyboard shortcuts, and integration with AMFE/CP.
 */

import React, { useState, useEffect } from 'react';
import {
    X, HelpCircle, ChevronDown, ChevronRight,
    ArrowDown, GitBranch, GitMerge, CheckCircle,
    AlertTriangle, Keyboard, FileText, BookOpen,
} from 'lucide-react';
import { PfdSymbol } from './PfdSymbols';
import type { PfdStepType } from './pfdTypes';
import { SGC_FORM_NUMBER } from './pfdTypes';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

interface SectionProps {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

const Section: React.FC<SectionProps> = ({ title, icon, children, defaultOpen = false }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border-b border-gray-100 last:border-0">
            <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-cyan-50/50 transition">
                {open ? <ChevronDown size={14} className="text-cyan-600" /> : <ChevronRight size={14} className="text-cyan-600" />}
                <span className="text-cyan-600">{icon}</span>
                <span className="text-sm font-semibold text-gray-700">{title}</span>
            </button>
            {open && <div className="px-4 pb-3 text-xs text-gray-600 leading-relaxed space-y-2">{children}</div>}
        </div>
    );
};

const SymbolRow: React.FC<{ type: PfdStepType; name: string; desc: string }> = ({ type, name, desc }) => (
    <div className="flex items-start gap-2 py-1">
        <PfdSymbol type={type} size={20} />
        <div>
            <span className="font-semibold text-gray-700">{name}:</span>{' '}
            <span>{desc}</span>
        </div>
    </div>
);

const PfdHelpPanel: React.FC<Props> = ({ isOpen, onClose }) => {
    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-2xl max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gradient-to-r from-cyan-50 to-teal-50 rounded-t-xl">
                    <div className="flex items-center gap-2">
                        <BookOpen size={20} className="text-cyan-600" />
                        <h2 className="text-base font-bold text-cyan-800">Manual del Flujograma de Proceso</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition" title="Cerrar (Esc)">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    <Section title="¿Qué es el Diagrama de Flujo del Proceso?" icon={<HelpCircle size={14} />} defaultOpen>
                        <p>
                            El <strong>Diagrama de Flujo del Proceso (DFP)</strong> es un documento obligatorio de AIAG APQP
                            (Sección 3.1) que muestra la secuencia completa de operaciones de manufactura, desde la recepción
                            de materia prima hasta el envío al cliente.
                        </p>
                        <p>
                            Es el documento base que alimenta al <strong>AMFE de Proceso</strong> y al <strong>Plan de Control</strong>.
                            Cada operación del DFP se convierte en una línea del AMFE y del Plan de Control.
                        </p>
                        <p className="text-cyan-700 font-medium">
                            Norma de referencia: Formulario {SGC_FORM_NUMBER} del SGC Barack Mercosul.
                        </p>
                    </Section>

                    <Section title="Tipos de paso (Simbología ASME/AIAG)" icon={<FileText size={14} />}>
                        <div className="space-y-1">
                            <SymbolRow type="operation" name="Operación" desc="Transformación del material. Ej: corte, soldadura, ensamble. Debe indicar máquina/equipo." />
                            <SymbolRow type="transport" name="Transporte" desc="Movimiento de material entre áreas. Indicar origen y destino en el campo Área." />
                            <SymbolRow type="inspection" name="Inspección" desc="Verificación o control de calidad. Indicar qué se inspecciona y el criterio de aceptación." />
                            <SymbolRow type="storage" name="Almacenamiento" desc="Material almacenado (MP, WIP o PT). El flujo debe iniciar y terminar con este símbolo." />
                            <SymbolRow type="delay" name="Demora / Espera" desc="Tiempo de espera no productivo. Ej: secado, curado, espera por lote." />
                            <SymbolRow type="decision" name="Decisión" desc="Punto de bifurcación lógica (Sí/No). Ej: '¿Pasó la inspección?' Usar para inspecciones con resultado OK/NOK." />
                            <SymbolRow type="combined" name="Op. + Inspección" desc="Operación con inspección integrada (autocontrol del operador)." />
                        </div>
                    </Section>

                    <Section title="Flujos paralelos (Procesos Interdependientes)" icon={<GitBranch size={14} />}>
                        <p>
                            Cuando desde un punto del proceso el material se divide y va a <strong>2 o más operaciones simultáneas</strong>
                            (ej: de Recepción salen 3 líneas — ZAC, Soldadura, Mecanizado), se debe usar el concepto
                            de <strong>flujo paralelo</strong>.
                        </p>
                        <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-2.5 my-2">
                            <p className="font-semibold text-cyan-800 mb-1">¿Cómo usar flujos paralelos?</p>
                            <ol className="list-decimal list-inside space-y-1 text-[11px]">
                                <li>El paso donde se bifurca el flujo queda en <strong>flujo principal</strong> (sin línea asignada).</li>
                                <li>Los pasos que corren en paralelo se asignan a un <strong>Flujo</strong> (A, B, C, D) usando la columna <strong>Flujo</strong> de la tabla.</li>
                                <li>Debajo del selector aparece un campo para <strong>nombrar el flujo</strong> (ej: "Mecanizado", "Soldadura").</li>
                                <li>El paso donde convergen las líneas vuelve a <strong>flujo principal</strong>.</li>
                            </ol>
                        </div>
                        <p>
                            El sistema mostrará automáticamente indicadores de <strong>BIFURCACIÓN</strong> y
                            {' '}<strong>CONVERGENCIA</strong> entre las flechas de flujo.
                        </p>
                        <p className="text-amber-700 flex items-start gap-1">
                            <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                            <span>
                                Según AIAG, <strong>NO se usa el rombo de Decisión</strong> para bifurcaciones de material.
                                El rombo es solo para preguntas lógicas (Sí/No).
                            </span>
                        </p>
                    </Section>

                    <Section title="Inspección y disposición de no conformes" icon={<CheckCircle size={14} />}>
                        <p>
                            Cuando un paso de inspección detecta piezas no conformes, se debe indicar qué sucede
                            con ellas usando la columna <strong>Disp.</strong> (Disposición):
                        </p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                            <li><strong>Retrabajo:</strong> La pieza vuelve a un paso anterior para ser reparada. Indicar el paso de retorno (ej: "OP 20"). La pieza DEBE reingresar al flujo y pasar todas las inspecciones posteriores.</li>
                            <li><strong>Descarte (Scrap):</strong> La pieza se descarta. Indicar el motivo.</li>
                            <li><strong>Selección (Sort):</strong> Las piezas se separan y clasifican. Indicar el criterio.</li>
                        </ul>
                        <p className="mt-1">
                            El sistema mostrará automáticamente las rutas <strong>OK/NOK</strong> en las flechas
                            de flujo cuando una inspección tiene disposición configurada.
                        </p>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1">
                            <p className="text-[11px] text-amber-800">
                                <strong>Importante (IATF 16949):</strong> Los procesos de retrabajo deben tener
                                su propio análisis de riesgos en el AMFE y su propio Plan de Control.
                            </p>
                        </div>
                    </Section>

                    <Section title="Características especiales (CC/SC)" icon={<AlertTriangle size={14} />}>
                        <p>
                            Las columnas <strong>CC/SC Prod.</strong> y <strong>CC/SC Proc.</strong> identifican
                            características especiales del producto o proceso:
                        </p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                            <li><span className="inline-block bg-red-100 text-red-700 border border-red-300 text-[10px] font-bold px-1 rounded">CC</span> <strong>Característica Crítica:</strong> Afecta la seguridad o cumplimiento normativo.</li>
                            <li><span className="inline-block bg-amber-100 text-amber-700 border border-amber-300 text-[10px] font-bold px-1 rounded">SC</span> <strong>Característica Significativa:</strong> Afecta el ajuste, función o apariencia.</li>
                            <li><span className="inline-block bg-blue-100 text-blue-700 border border-blue-300 text-[10px] font-bold px-1 rounded">PTC</span> <strong>Pass-Through (CP-1 2024):</strong> Característica del proveedor que pasa sin modificación en planta.</li>
                        </ul>
                        <p className="mt-1">
                            Al marcar una CC/SC, se muestra un borde de color en la fila y se genera una
                            advertencia si no se especifica la característica correspondiente.
                        </p>
                    </Section>

                    <Section title="Cómo armar un flujograma paso a paso" icon={<ArrowDown size={14} />}>
                        <ol className="list-decimal list-inside space-y-1.5 text-[11px]">
                            <li><strong>Completar el encabezado:</strong> Nro. de pieza, nombre, cliente, revisión, equipo, fase del proceso.</li>
                            <li><strong>Iniciar con Recepción:</strong> El primer paso debe ser tipo Almacenamiento — "Recepción de materia prima". Usar la plantilla como base.</li>
                            <li><strong>Agregar operaciones:</strong> Cada transformación del material es una Operación. Indicar máquina/equipo.</li>
                            <li><strong>Intercalar transportes:</strong> Entre áreas, agregar pasos de Transporte indicando el destino.</li>
                            <li><strong>Agregar inspecciones:</strong> Puntos de verificación. Indicar qué se inspecciona, referencia al plano, y disposición de no conformes.</li>
                            <li><strong>Marcar CC/SC:</strong> Identificar características especiales en cada paso.</li>
                            <li><strong>Configurar flujos paralelos:</strong> Si el material se divide, asignar flujos paralelos (A/B/C/D).</li>
                            <li><strong>Terminar con Envío:</strong> Último paso tipo Almacenamiento — "Almacenamiento y envío al cliente".</li>
                            <li><strong>Validar:</strong> Usar el botón Validar para verificar completitud y coherencia.</li>
                            <li><strong>Exportar:</strong> PDF para impresión, Excel para análisis. El PDF incluye simbología y resumen.</li>
                        </ol>
                    </Section>

                    <Section title="Atajos de teclado" icon={<Keyboard size={14} />}>
                        <div className="grid grid-cols-2 gap-1">
                            {[
                                ['Ctrl+S', 'Guardar'],
                                ['Ctrl+Z', 'Deshacer'],
                                ['Ctrl+Y', 'Rehacer'],
                                ['Ctrl+Shift+N', 'Agregar paso'],
                                ['Ctrl+P', 'Imprimir'],
                                ['Escape', 'Cerrar panel / desfocalizar'],
                                ['F1', 'Abrir/cerrar este manual'],
                            ].map(([key, desc]) => (
                                <div key={key} className="flex items-center gap-2 py-0.5">
                                    <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-[10px] font-mono font-medium">{key}</kbd>
                                    <span className="text-[11px]">{desc}</span>
                                </div>
                            ))}
                        </div>
                    </Section>

                    <Section title="Familias de productos (AIAG-VDA)" icon={<FileText size={14} />}>
                        <p>
                            Segun AIAG-VDA, una <strong>familia de productos</strong> son piezas multiples
                            similares en aplicacion, diseno, manufactura, requerimientos y especificacion.
                            Ejemplo: espejos izq/der, interiores en distintos colores, variaciones dimensionales.
                        </p>
                        <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-2.5 my-2">
                            <p className="font-semibold text-cyan-800 mb-1">¿Cuando usar un DFP por familia?</p>
                            <div className="text-[11px] space-y-1">
                                <p><span className="text-green-600 font-bold">✓</span> <strong>Un solo DFP</strong> cuando las piezas comparten el mismo flujo de manufactura y difieren solo en dimensiones, colores u orientacion.</p>
                                <p><span className="text-red-600 font-bold">✗</span> <strong>DFP separados</strong> cuando los procesos, modos de falla o controles son diferentes entre piezas.</p>
                            </div>
                        </div>
                        <p className="text-[11px]">
                            <strong>¿Como indicarlo?</strong> En el encabezado del DFP, completar el campo
                            {' '}<strong>"Piezas Aplicables"</strong> con todos los numeros de pieza que cubre este flujo (uno por linea).
                            Dejar vacio si el documento es para pieza unica.
                        </p>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1">
                            <p className="text-[11px] text-amber-800">
                                <strong>IATF 16949</strong> no obliga a usar familia o pieza individual — es decision del equipo multifuncional.
                            </p>
                        </div>
                    </Section>

                    <Section title="Integración con AMFE y Plan de Control" icon={<GitMerge size={14} />}>
                        <p>
                            El Diagrama de Flujo es el <strong>documento base</strong> del "hilo digital" AIAG APQP:
                        </p>
                        <div className="flex items-center gap-2 justify-center py-2 text-[11px] font-medium">
                            <span className="bg-cyan-100 text-cyan-800 px-2 py-1 rounded">DFP</span>
                            <span className="text-gray-400">→</span>
                            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">AMFE</span>
                            <span className="text-gray-400">→</span>
                            <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded">Plan de Control</span>
                        </div>
                        <ul className="list-disc list-inside space-y-1 ml-2 text-[11px]">
                            <li>Cada operación del DFP genera una fila en el AMFE de Proceso.</li>
                            <li>Las CC/SC del DFP deben aparecer en el AMFE y en el Plan de Control.</li>
                            <li>Los procesos de retrabajo del DFP deben analizarse en el AMFE.</li>
                            <li>Los campos Máquina/Dispositivo del DFP alimentan las 4M del AMFE.</li>
                        </ul>
                    </Section>
                </div>

                {/* Footer */}
                <div className="px-5 py-2 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                    <p className="text-[10px] text-gray-400 text-center">
                        Referencia: AIAG APQP §3.1 · IATF 16949:2016 · VDA 6.3 · Formulario {SGC_FORM_NUMBER}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PfdHelpPanel;
