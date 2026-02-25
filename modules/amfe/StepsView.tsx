import React, { useState } from 'react';
import { AmfeOperation, WorkElementType } from './amfeTypes';
import { Plus, Trash2, ChevronRight, ChevronDown, User, Monitor, Box, Settings, Thermometer, PenTool } from 'lucide-react';

interface Props {
    operations: AmfeOperation[];
    amfe: any; // Using any for brevity to pass the hook result
}

const StepsView: React.FC<Props> = ({ operations, amfe }) => {
    const [activeTab, setActiveTab] = useState<'structure' | 'functions' | 'failures'>('structure');

    // STEP 1: STRUCTURE
    const renderStructure = () => (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div>
                    <h2 className="text-lg font-bold text-blue-900">Paso 1: Estructura (4M/6M)</h2>
                    <p className="text-sm text-blue-700">Define las Operaciones y arrastra los Elementos de Trabajo (Máquina, Operador, etc.)</p>
                </div>
                <button onClick={amfe.addOperation} className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 flex items-center gap-2">
                    <Plus size={16} /> Agregar Operación
                </button>
            </div>

            <div className="grid gap-6">
                {operations.map(op => (
                    <div key={op.id} className="bg-white border border-gray-200 rounded-lg shadow-sm">
                        <div className="p-3 bg-gray-50 border-b border-gray-200 flex gap-4 items-center">
                            <input
                                value={op.opNumber}
                                onChange={e => amfe.updateOp(op.id, 'opNumber', e.target.value)}
                                className="font-mono font-bold bg-transparent w-24 border-b border-dashed border-gray-300 focus:border-blue-500 outline-none"
                                placeholder="OP #"
                            />
                            <input
                                value={op.name}
                                onChange={e => amfe.updateOp(op.id, 'name', e.target.value)}
                                className="font-bold bg-transparent flex-1 border-b border-dashed border-gray-300 focus:border-blue-500 outline-none"
                                placeholder="Nombre de la Operacion"
                            />
                            <button onClick={() => amfe.deleteOp(op.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                        </div>

                        <div className="p-4 bg-slate-50/50 min-h-[100px]">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {op.workElements.map(we => (
                                    <div key={we.id} className="bg-white p-3 rounded border border-gray-200 shadow-sm relative group hover:border-blue-300 transition-colors">
                                        <div className="flex justify-between mb-2">
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getTypeColor(we.type)}`}>{we.type}</span>
                                            <button onClick={() => amfe.deleteWorkElement(op.id, we.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity"><Trash2 size={12} /></button>
                                        </div>
                                        <textarea
                                            value={we.name}
                                            onChange={e => amfe.updateWorkElement(op.id, we.id, 'name', e.target.value)}
                                            className="w-full text-sm font-medium resize-none outline-none bg-transparent placeholder-gray-300 h-10"
                                            placeholder="Nombre del elemento (Ej: Robot KUKA)"
                                        />
                                    </div>
                                ))}

                                {/* Add WE Buttons */}
                                <div className="border border-dashed border-gray-300 rounded flex flex-col justify-center items-center gap-2 p-4 text-gray-400">
                                    <span className="text-xs">Agregar Elemento:</span>
                                    <div className="flex flex-wrap justify-center gap-2">
                                        <AddWeBtn icon={<Monitor size={14} />} label="Maquina" onClick={() => amfe.addWorkElement(op.id, 'Machine')} />
                                        <AddWeBtn icon={<User size={14} />} label="Mano de Obra" onClick={() => amfe.addWorkElement(op.id, 'Man')} />
                                        <AddWeBtn icon={<Box size={14} />} label="Material" onClick={() => amfe.addWorkElement(op.id, 'Material')} />
                                        <AddWeBtn icon={<Settings size={14} />} label="Metodo" onClick={() => amfe.addWorkElement(op.id, 'Method')} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    // STEP 2: FUNCTIONS
    const renderFunctions = () => (
        <div className="space-y-6">
            <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                <h2 className="text-lg font-bold text-green-900">Paso 2: Funciones</h2>
                <p className="text-sm text-green-700">Describe que debe hacer (la funcion positiva) cada elemento de trabajo.</p>
            </div>

            {operations.map(op => (
                <div key={op.id} className="space-y-2">
                    <h3 className="font-bold text-gray-500 text-xs uppercase tracking-wider pl-2">{op.opNumber}: {op.name}</h3>
                    {op.workElements.map(we => (
                        <div key={we.id} className="flex gap-4 p-4 bg-white border border-gray-200 rounded-lg shadow-sm ml-4">
                            <div className="w-48 flex-shrink-0 border-r border-gray-100 pr-4">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded mb-1 inline-block ${getTypeColor(we.type)}`}>{we.type}</span>
                                <div className="font-bold text-gray-800 text-sm">{we.name || "Sin nombre"}</div>
                            </div>
                            <div className="flex-1 space-y-3">
                                {we.functions.map(func => (
                                    <div key={func.id} className="flex gap-2 items-start group">
                                        <div className="bg-green-100 text-green-700 p-1.5 rounded mt-0.5"><Settings size={14} /></div>
                                        <div className="flex-1">
                                            <textarea
                                                value={func.description}
                                                onChange={e => amfe.updateFunction(op.id, we.id, func.id, 'description', e.target.value)}
                                                className="w-full border border-gray-200 rounded p-2 text-sm focus:border-green-500 outline-none transition-colors shadow-sm"
                                                placeholder="Cual es la funcion de este elemento? (Ej: Apretar tuerca a 50Nm)"
                                            />
                                        </div>
                                        <button onClick={() => amfe.deleteFunction(op.id, we.id, func.id)} className="text-gray-300 hover:text-red-500 pt-2 opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                                    </div>
                                ))}
                                <button onClick={() => amfe.addFunction(op.id, we.id)} className="text-green-600 text-xs font-bold hover:underline flex items-center gap-1">
                                    <Plus size={12} /> Agregar Funcion
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );

    // STEP 3: FAILURES (with causes list)
    const renderFailures = () => (
        <div className="space-y-6">
            <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                <h2 className="text-lg font-bold text-red-900">Paso 3: Falla y Causa Raiz</h2>
                <p className="text-sm text-red-700">Como puede fallar la funcion? (El negativo de la funcion). Cada falla puede tener multiples causas.</p>
            </div>

            {operations.map(op => (
                <div key={op.id} className="space-y-4">
                    <h3 className="font-bold text-gray-500 text-xs uppercase tracking-wider border-b pb-1">{op.opNumber}: {op.name}</h3>
                    {op.workElements.map(we => (
                        <div key={we.id} className="pl-4 border-l-2 border-gray-200 ml-2">
                            <div className="mb-2 flex items-center gap-2">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${getTypeColor(we.type)}`}>{we.type}</span>
                                <span className="font-bold text-sm text-gray-700">{we.name}</span>
                            </div>

                            <div className="space-y-4">
                                {we.functions.map(func => (
                                    <div key={func.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                        <div className="bg-green-50/50 p-2 border-b border-gray-100 flex items-center gap-2">
                                            <Settings size={14} className="text-green-600" />
                                            <span className="text-sm font-medium text-gray-800">{func.description || "(Sin descripcion de funcion)"}</span>
                                        </div>
                                        <div className="p-3 bg-red-50/10 space-y-3">
                                            {func.failures.map(fail => (
                                                <div key={fail.id} className="flex flex-col gap-2 p-3 bg-white border border-red-100 rounded shadow-sm">
                                                    {/* Failure Mode header */}
                                                    <div className="flex gap-3 items-start">
                                                        <div className="flex-1">
                                                            <label className="text-[10px] uppercase font-bold text-red-400">Modo de Falla (FM)</label>
                                                            <textarea
                                                                value={fail.description}
                                                                onChange={e => amfe.updateFailure(op.id, we.id, func.id, fail.id, 'description', e.target.value)}
                                                                className="w-full text-sm font-bold border-b border-gray-200 outline-none py-1 focus:border-red-400" placeholder="Ej: Ruido excesivo"
                                                            />
                                                        </div>
                                                        <div className="w-24 flex-shrink-0">
                                                            <label className="text-[10px] uppercase font-bold text-red-400">Severidad</label>
                                                            <input type="number" placeholder="S" className="w-full text-center border p-1 rounded text-red-600 font-bold text-sm" value={fail.severity} onChange={e => amfe.updateFailure(op.id, we.id, func.id, fail.id, 'severity', e.target.value)} />
                                                        </div>
                                                        <button onClick={() => amfe.deleteFailure(op.id, we.id, func.id, fail.id)} className="text-gray-300 hover:text-red-500 self-start"><Trash2 size={16} /></button>
                                                    </div>

                                                    {/* Causes list */}
                                                    <div className="ml-4 mt-1 space-y-2">
                                                        <label className="text-[10px] uppercase font-bold text-orange-400">Causas</label>
                                                        {fail.causes.map(cause => (
                                                            <div key={cause.id} className="flex flex-col gap-1 p-2 bg-orange-50/30 border border-orange-100 rounded group/cause">
                                                                <div className="flex gap-3 items-start">
                                                                    <div className="flex-1">
                                                                        <textarea
                                                                            value={cause.cause}
                                                                            onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'cause', e.target.value)}
                                                                            className="w-full text-sm border-b border-gray-200 outline-none py-1 focus:border-orange-400 bg-transparent" placeholder="Causa raiz (Ej: Rodamiento desgastado)"
                                                                        />
                                                                    </div>
                                                                    <button onClick={() => amfe.deleteCause(op.id, we.id, func.id, fail.id, cause.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover/cause:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                                                                </div>

                                                                {/* S/O/D mini-view: S from parent failure, O/D from cause */}
                                                                <div className="grid grid-cols-6 gap-2 mt-1 pt-1 border-t border-dashed border-gray-100">
                                                                    <div className="col-span-1">
                                                                        <span className="text-[9px] text-gray-400 block text-center">S</span>
                                                                        <div className="w-full text-center border p-1 rounded text-red-600 font-bold text-xs bg-gray-50 cursor-default">{fail.severity || '-'}</div>
                                                                    </div>
                                                                    <div className="col-span-1">
                                                                        <span className="text-[9px] text-gray-400 block text-center">O</span>
                                                                        <input type="number" className="w-full text-center border p-1 rounded text-orange-600 text-xs" value={cause.occurrence} onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'occurrence', e.target.value)} />
                                                                    </div>
                                                                    <div className="col-span-1">
                                                                        <span className="text-[9px] text-gray-400 block text-center">D</span>
                                                                        <input type="number" className="w-full text-center border p-1 rounded text-blue-600 text-xs" value={cause.detection} onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'detection', e.target.value)} />
                                                                    </div>
                                                                    <div className="col-span-2 text-[10px] flex items-end text-gray-400 pb-1">Definir controles en vista completa</div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        <button onClick={() => amfe.addCause(op.id, we.id, func.id, fail.id)} className="text-orange-600 text-xs font-bold hover:underline flex items-center gap-1">
                                                            <Plus size={12} /> Agregar Causa
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            <button onClick={() => amfe.addFailure(op.id, we.id, func.id)} className="w-full py-1 text-center text-xs font-bold text-red-600 border border-dashed border-red-200 rounded hover:bg-red-50">+ Agregar Falla</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* TABS */}
            <div className="flex gap-1 mb-6 border-b border-gray-200">
                <TabButton active={activeTab === 'structure'} onClick={() => setActiveTab('structure')} label="1. Estructura" />
                <TabButton active={activeTab === 'functions'} onClick={() => setActiveTab('functions')} label="2. Funciones" />
                <TabButton active={activeTab === 'failures'} onClick={() => setActiveTab('failures')} label="3. Fallas y Riesgos" />
            </div>

            {activeTab === 'structure' && renderStructure()}
            {activeTab === 'functions' && renderFunctions()}
            {activeTab === 'failures' && renderFailures()}
        </div>
    );
};

// Utilities
const getTypeColor = (type: string) => {
    switch (type) {
        case 'Machine': return "bg-blue-100 text-blue-800";
        case 'Man': return "bg-orange-100 text-orange-800";
        case 'Material': return "bg-yellow-100 text-yellow-800";
        case 'Method': return "bg-purple-100 text-purple-800";
        default: return "bg-gray-100 text-gray-800";
    }
}

const AddWeBtn = ({ icon, label, onClick }: any) => (
    <button onClick={onClick} className="flex items-center gap-1.5 px-2 py-1 bg-white border border-gray-200 rounded hover:border-blue-400 hover:text-blue-600 transition text-[10px] font-medium shadow-sm">
        {icon} {label}
    </button>
)

const TabButton = ({ active, onClick, label }: any) => (
    <button
        onClick={onClick}
        className={`px-4 py-3 font-bold text-sm transition-colors border-b-2 ${active ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
    >
        {label}
    </button>
)

export default StepsView;
