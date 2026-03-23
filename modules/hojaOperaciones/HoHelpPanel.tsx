/**
 * HO Help Panel — In-app user manual for the Hoja de Operaciones module
 *
 * Comprehensive guide for plant operators and quality engineers.
 * Covers: what is an HO, structure, PPE, quality checks, visual aids,
 * keyboard shortcuts, and PDF export.
 *
 * Theme: Navy (consistent with HO module)
 * Pattern: Modal with expandable sections (same as PfdHelpPanel)
 */

import React, { useState, useEffect } from 'react';
import {
    X, BookOpen, ChevronDown, ChevronRight,
    HelpCircle, Shield, CheckSquare, Image,
    Keyboard, FileText, Printer, Users,
} from 'lucide-react';

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
            <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-50/50 transition" title="Alternar ayuda">
                {open ? <ChevronDown size={14} className="text-slate-600" /> : <ChevronRight size={14} className="text-slate-600" />}
                <span className="text-slate-600">{icon}</span>
                <span className="text-sm font-semibold text-gray-700">{title}</span>
            </button>
            {open && <div className="px-4 pb-3 text-xs text-gray-600 leading-relaxed space-y-2">{children}</div>}
        </div>
    );
};

const HoHelpPanel: React.FC<Props> = ({ isOpen, onClose }) => {
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
                {/* Header — Navy theme */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gradient-to-r from-slate-700 to-slate-800 rounded-t-xl">
                    <div className="flex items-center gap-2">
                        <BookOpen size={20} className="text-blue-300" />
                        <div>
                            <h2 className="text-base font-bold text-white">Manual de Hoja de Operaciones</h2>
                            <p className="text-[10px] text-slate-300">SGC Barack Mercosul — I-IN-002.4-R01</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition" title="Cerrar (Esc)">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    <Section title="¿Qué es la Hoja de Operaciones?" icon={<HelpCircle size={14} />} defaultOpen>
                        <p>
                            La <strong>Hoja de Operaciones (HO)</strong> es el documento de planta que describe
                            paso a paso cómo realizar una operación de manufactura. Es el documento que
                            el operador consulta en su puesto de trabajo.
                        </p>
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 my-2">
                            <p className="font-semibold text-slate-800 text-[11px] mb-1">Contenido de cada hoja:</p>
                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                                <div className="space-y-0.5">
                                    <p>📋 <strong>Encabezado:</strong> Pieza, cliente, operación</p>
                                    <p>👣 <strong>Pasos:</strong> Secuencia de trabajo detallada</p>
                                    <p>🛡️ <strong>EPP:</strong> Equipos de protección personal</p>
                                </div>
                                <div className="space-y-0.5">
                                    <p>✅ <strong>Controles:</strong> Verificaciones de calidad</p>
                                    <p>📷 <strong>Ayudas visuales:</strong> Fotos y diagramas</p>
                                    <p>⚠️ <strong>Plan de reacción:</strong> Qué hacer ante NOK</p>
                                </div>
                            </div>
                        </div>
                        <p className="text-slate-700 font-medium text-[10px]">
                            Norma de referencia: IATF 16949 §8.5.1.2 — Instrucciones de trabajo estandarizadas.
                        </p>
                    </Section>

                    <Section title="Estructura del documento" icon={<FileText size={14} />}>
                        <p>Un documento HO puede contener <strong>múltiples hojas</strong> (una por operación).</p>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 my-2">
                            <p className="font-semibold text-blue-800 text-[11px] mb-1">Encabezado (3 filas en PDF)</p>
                            <table className="w-full text-[10px] mt-1">
                                <tbody>
                                    <tr className="border-b border-blue-100">
                                        <td className="py-0.5 font-medium text-blue-700 w-24">Fila 1:</td>
                                        <td>Logo Barack + título "HOJA DE OPERACIONES" + formulario HO 952 REV.06</td>
                                    </tr>
                                    <tr className="border-b border-blue-100">
                                        <td className="py-0.5 font-medium text-blue-700">Fila 2:</td>
                                        <td>Operacion, Sector, Pieza, Codigo, Cliente</td>
                                    </tr>
                                    <tr>
                                        <td className="py-0.5 font-medium text-blue-700">Fila 3:</td>
                                        <td>Realizo, Aprobo, Fecha, Revision</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                            <div className="bg-emerald-50 border border-emerald-200 rounded p-1.5 text-center">
                                <p className="font-bold text-emerald-800">Pasos</p>
                                <p className="text-emerald-600">Nro + Descripcion</p>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 rounded p-1.5 text-center">
                                <p className="font-bold text-amber-800">Controles</p>
                                <p className="text-amber-600">CC/SC + Freq.</p>
                            </div>
                            <div className="bg-purple-50 border border-purple-200 rounded p-1.5 text-center">
                                <p className="font-bold text-purple-800">Ayudas</p>
                                <p className="text-purple-600">Fotos + texto</p>
                            </div>
                        </div>
                    </Section>

                    <Section title="Equipos de Protección Personal (EPP)" icon={<Shield size={14} />}>
                        <p>
                            Según <strong>IATF 16949 §8.5.1.2</strong>, las instrucciones de trabajo deben
                            indicar <strong>visualmente</strong> los EPP requeridos. Usamos pictogramas ISO
                            de señalización obligatoria (círculos azules).
                        </p>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 my-2">
                            <p className="font-semibold text-blue-800 text-[11px] mb-1.5">6 EPP disponibles:</p>
                            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-[8px] font-bold">👓</span>
                                    <span><strong>Anteojos</strong> de seguridad</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-[8px] font-bold">🧤</span>
                                    <span><strong>Guantes</strong></span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-[8px] font-bold">👞</span>
                                    <span><strong>Zapatos</strong> de seguridad</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-[8px] font-bold">🎧</span>
                                    <span><strong>Protección auditiva</strong></span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-[8px] font-bold">🥼</span>
                                    <span><strong>Ropa</strong> de protección (delantal)</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-[8px] font-bold">😷</span>
                                    <span><strong>Respirador</strong> / máscara</span>
                                </div>
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-500 italic">
                            Click en cada pictograma para seleccionar/deseleccionar. Los seleccionados se imprimen en el PDF.
                        </p>
                    </Section>

                    <Section title="Controles de Calidad" icon={<CheckSquare size={14} />}>
                        <p>
                            Cada hoja puede tener <strong>múltiples controles de calidad</strong>, organizados
                            en tabla:
                        </p>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden my-2">
                            <table className="w-full text-[10px]">
                                <thead>
                                    <tr className="bg-gray-100 text-gray-700 font-semibold">
                                        <th className="px-2 py-1 text-left">Campo</th>
                                        <th className="px-2 py-1 text-left">Que poner</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-t border-gray-100">
                                        <td className="px-2 py-1 font-medium">Característica</td>
                                        <td className="px-2 py-1">Qué se mide o verifica (ej: diámetro, torque)</td>
                                    </tr>
                                    <tr className="border-t border-gray-100">
                                        <td className="px-2 py-1 font-medium">Especificación</td>
                                        <td className="px-2 py-1">Rango aceptable (ej: 10.0 ± 0.1 mm)</td>
                                    </tr>
                                    <tr className="border-t border-gray-100">
                                        <td className="px-2 py-1 font-medium">Instrumento</td>
                                        <td className="px-2 py-1">Herramienta de medición (ej: calibre, CMM)</td>
                                    </tr>
                                    <tr className="border-t border-gray-100">
                                        <td className="px-2 py-1 font-medium">Frecuencia</td>
                                        <td className="px-2 py-1">Cada cuanto se mide (ej: 1/turno, 100%)</td>
                                    </tr>
                                    <tr className="border-t border-gray-100">
                                        <td className="px-2 py-1 font-medium">CC/SC</td>
                                        <td className="px-2 py-1">
                                            <span className="bg-red-100 text-red-700 text-[9px] font-bold px-1 rounded mr-1">CC</span>Critica
                                            <span className="bg-amber-100 text-amber-700 text-[9px] font-bold px-1 rounded mx-1">SC</span>Significativa
                                        </td>
                                    </tr>
                                    <tr className="border-t border-gray-100">
                                        <td className="px-2 py-1 font-medium">Plan de reacción</td>
                                        <td className="px-2 py-1">Qué hacer si la pieza está fuera de tolerancia</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded p-2">
                            <p className="text-[10px] text-red-800">
                                <strong>Importante:</strong> Los controles CC/SC de la HO deben coincidir con
                                los del Plan de Control y el AMFE. Es un requisito de auditoría IATF.
                            </p>
                        </div>
                    </Section>

                    <Section title="Ayudas Visuales" icon={<Image size={14} />}>
                        <p>
                            Las <strong>ayudas visuales</strong> son fotos, diagramas o esquemas que acompañan
                            a los pasos de la operación. Son obligatorias per IATF 16949 §8.5.1.2.
                        </p>
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-2.5 my-2">
                            <p className="font-semibold text-purple-800 text-[11px] mb-1">Cómo agregar una ayuda visual:</p>
                            <ol className="list-decimal list-inside text-[10px] text-purple-700 space-y-0.5">
                                <li>Click en <strong>"+ Ayuda Visual"</strong> dentro de un paso</li>
                                <li>Escribir un <strong>título descriptivo</strong> (ej: "Posición correcta de la pieza")</li>
                                <li><strong>Pegar o cargar una imagen</strong> (fotos de celular, capturas, diagramas)</li>
                                <li>Opcionalmente agregar <strong>descripción</strong> con detalles</li>
                            </ol>
                        </div>
                        <p className="text-[10px] text-gray-500 italic">
                            Las imágenes se almacenan dentro del documento (base64). No necesitan archivos externos.
                            En el PDF se imprimen con tamaño optimizado.
                        </p>
                    </Section>

                    <Section title="Familias de productos" icon={<Users size={14} />}>
                        <p>
                            Una <strong>Hoja de Operaciones por familia</strong> cubre múltiples piezas similares
                            que comparten el mismo proceso. El campo <strong>"Piezas Aplicables"</strong> en el
                            encabezado lista las piezas cubiertas.
                        </p>
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 my-2">
                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                                <div className="bg-green-50 border border-green-200 rounded p-1.5">
                                    <p className="font-bold text-green-800 text-[10px]">✓ Una sola HO cuando:</p>
                                    <ul className="list-disc list-inside text-green-700 space-y-0.5">
                                        <li>Mismo proceso de manufactura</li>
                                        <li>Mismos EPP requeridos</li>
                                        <li>Mismos controles de calidad</li>
                                    </ul>
                                </div>
                                <div className="bg-red-50 border border-red-200 rounded p-1.5">
                                    <p className="font-bold text-red-800 text-[10px]">✗ HO separadas cuando:</p>
                                    <ul className="list-disc list-inside text-red-700 space-y-0.5">
                                        <li>Pasos de operación diferentes</li>
                                        <li>Controles de calidad diferentes</li>
                                        <li>Herramental diferente</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-500 italic">
                            Si el documento se hereda del AMFE, las piezas aplicables se copian automáticamente.
                        </p>
                    </Section>

                    <Section title="Exportar PDF" icon={<Printer size={14} />}>
                        <p>
                            El PDF exportado replica el formato oficial <strong>HO 952 REV.06</strong> del SGC Barack:
                        </p>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px] my-1">
                            <li><strong>Logo Barack</strong> en el encabezado (esquina izquierda)</li>
                            <li><strong>Pictogramas EPP</strong> reales (imágenes ISO circulares)</li>
                            <li><strong>Controles de calidad</strong> en tabla con badges CC/SC</li>
                            <li><strong>Ayudas visuales</strong> con imágenes embebidas</li>
                            <li><strong>Plan de reacción</strong> con saltos de línea correctos</li>
                            <li><strong>Familias:</strong> piezas aplicables en el encabezado</li>
                        </ul>
                        <div className="bg-amber-50 border border-amber-200 rounded p-2 mt-1">
                            <p className="text-[10px] text-amber-800">
                                <strong>Tip:</strong> Para imprimir, use Ctrl+P o el botón "PDF" en la barra superior.
                                Se genera una hoja por cada operación del documento.
                            </p>
                        </div>
                    </Section>

                    <Section title="Atajos de teclado" icon={<Keyboard size={14} />}>
                        <div className="grid grid-cols-2 gap-1">
                            {[
                                ['Ctrl+S', 'Guardar'],
                                ['Ctrl+Z', 'Deshacer'],
                                ['Ctrl+Y', 'Rehacer'],
                                ['Ctrl+D', 'Vista / Edicion'],
                                ['Ctrl+P', 'Exportar PDF'],
                                ['Escape', 'Cerrar panel'],
                                ['F1', 'Abrir/cerrar este manual'],
                            ].map(([key, desc]) => (
                                <div key={key} className="flex items-center gap-2 py-0.5">
                                    <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-[10px] font-mono font-medium">{key}</kbd>
                                    <span className="text-[11px]">{desc}</span>
                                </div>
                            ))}
                        </div>
                    </Section>
                </div>

                {/* Footer */}
                <div className="px-5 py-2 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                    <p className="text-[10px] text-gray-400 text-center">
                        Referencia: IATF 16949 §8.5.1.2 · SGC Barack Mercosul · Formulario I-IN-002.4-R01
                    </p>
                </div>
            </div>
        </div>
    );
};

export default HoHelpPanel;
