/**
 * BomApp — Modulo de Lista de Materiales (BOM)
 *
 * Replica el formato visual estandar Barack observado en PPAP CLIENTES:
 * - Tabla agrupada por categoria de material (PLASTICO, FUNDA, SUSTRATO...)
 * - Headers azul oscuro (navy) + filas blancas con bordes celestes
 * - Numero en circulo azul a la izquierda de cada item
 * - Panel derecho con imagen del producto y leaders numerados
 *
 * Estado actual: scaffold con registry view + ficha basica.
 * Filtros avanzados, importador Excel y export PDF en proxima iteracion.
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeft, Plus, Save, Trash2, Image as ImageIcon, Search } from 'lucide-react';
import {
    BomDocument, BomCategory, BomItem,
    BOM_CATEGORY_LABEL, BOM_UNITS,
    createEmptyBomItem,
} from './bomTypes';
import { createEmptyBomDoc } from './bomInitialData';
import {
    listBomDocuments, loadBomDocument, saveBomDocument, deleteBomDocument,
} from '../../utils/repositories/bomRepository';
import type { BomRegistryEntry } from './bomTypes';
import { logger } from '../../utils/logger';

interface BomAppProps {
    onBackToLanding: () => void;
}

const BomApp: React.FC<BomAppProps> = ({ onBackToLanding }) => {
    const [view, setView] = useState<'registry' | 'editor'>('registry');
    const [docs, setDocs] = useState<BomRegistryEntry[]>([]);
    const [currentId, setCurrentId] = useState<string | null>(null);
    const [doc, setDoc] = useState<BomDocument>(createEmptyBomDoc());
    const [bomNumber, setBomNumber] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [filterCliente, setFilterCliente] = useState<string>('');

    const reloadList = useCallback(async () => {
        setLoading(true);
        const list = await listBomDocuments();
        setDocs(list);
        setLoading(false);
    }, []);

    // Carga inicial — patron mounted-flag para evitar setState en effect cleanup tardio.
    useEffect(() => {
        let mounted = true;
        (async () => {
            const list = await listBomDocuments();
            if (mounted) {
                setDocs(list);
                setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, []);

    // ----- Filtros del registry -----
    const filteredDocs = useMemo(() => {
        const q = search.trim().toLowerCase();
        return docs.filter(d => {
            if (filterCliente && d.cliente !== filterCliente) return false;
            if (q) {
                const hay = `${d.bomNumber} ${d.partNumber} ${d.descripcion} ${d.proyecto} ${d.familia}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    }, [docs, search, filterCliente]);

    const clientesUnicos = useMemo(() => {
        const s = new Set<string>();
        docs.forEach(d => { if (d.cliente) s.add(d.cliente); });
        return Array.from(s).sort();
    }, [docs]);

    // ----- Acciones -----
    const handleNew = useCallback(() => {
        const empty = createEmptyBomDoc();
        const id = uuidv4();
        const num = `BOM-${String(docs.length + 1).padStart(3, '0')}`;
        empty.header.bomNumber = num;
        setCurrentId(id);
        setBomNumber(num);
        setDoc(empty);
        setView('editor');
    }, [docs.length]);

    const handleOpen = useCallback(async (id: string) => {
        const loaded = await loadBomDocument(id);
        if (!loaded) {
            logger.warn('BomApp', `Could not load document ${id}`);
            return;
        }
        setCurrentId(id);
        setBomNumber(loaded.meta.bomNumber);
        setDoc(loaded.doc);
        setView('editor');
    }, []);

    const handleSave = useCallback(async () => {
        if (!currentId) return;
        const ok = await saveBomDocument(currentId, bomNumber || doc.header.bomNumber, doc);
        if (ok) await reloadList();
    }, [currentId, bomNumber, doc, reloadList]);

    const handleDelete = useCallback(async (id: string) => {
        const ok = await deleteBomDocument(id);
        if (ok) await reloadList();
    }, [reloadList]);

    const handleBackToList = useCallback(() => {
        setView('registry');
        setCurrentId(null);
    }, []);

    // ----- Edicion del documento (helpers) -----
    const updateHeader = useCallback(<K extends keyof BomDocument['header']>(key: K, value: BomDocument['header'][K]) => {
        setDoc(prev => ({ ...prev, header: { ...prev.header, [key]: value } }));
    }, []);

    const addItem = useCallback((cat: BomCategory) => {
        setDoc(prev => {
            const groups = prev.groups.map(g => {
                if (g.categoria !== cat) return g;
                const numero = String(prev.groups.reduce((n, gg) => n + gg.items.length, 0) + 1);
                return { ...g, items: [...g.items, createEmptyBomItem(numero)] };
            });
            return { ...prev, groups };
        });
    }, []);

    const updateItem = useCallback((cat: BomCategory, itemId: string, field: keyof BomItem, value: string | number) => {
        setDoc(prev => ({
            ...prev,
            groups: prev.groups.map(g => g.categoria !== cat ? g : {
                ...g,
                items: g.items.map(it => it.id !== itemId ? it : { ...it, [field]: value }),
            }),
        }));
    }, []);

    const removeItem = useCallback((cat: BomCategory, itemId: string) => {
        setDoc(prev => ({
            ...prev,
            groups: prev.groups.map(g => g.categoria !== cat ? g : {
                ...g,
                items: g.items.filter(it => it.id !== itemId),
            }),
        }));
    }, []);

    // ============================================================
    // VIEW: Registry (lista de BOMs)
    // ============================================================
    if (view === 'registry') {
        return (
            <div className="min-h-full bg-slate-50">
                {/* Barra superior */}
                <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onBackToLanding}
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
                            aria-label="Volver"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <h1 className="text-lg font-semibold text-slate-900">Lista de Materiales (BOM)</h1>
                            <p className="text-xs text-slate-500">Fichas de materiales por part number — formato Barack</p>
                        </div>
                    </div>
                    <button
                        onClick={handleNew}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] hover:bg-[#172e4a] text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <Plus size={16} /> Nuevo BOM
                    </button>
                </div>

                {/* Filtros */}
                <div className="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[260px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar por numero, PN, descripcion, proyecto..."
                            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]"
                        />
                    </div>
                    <select
                        value={filterCliente}
                        onChange={e => setFilterCliente(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                    >
                        <option value="">Todos los clientes</option>
                        {clientesUnicos.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <span className="text-xs text-slate-500">{filteredDocs.length} de {docs.length} BOM</span>
                </div>

                {/* Tabla / vacio */}
                <div className="px-6 py-6">
                    {loading ? (
                        <div className="text-center py-12 text-slate-400 text-sm">Cargando...</div>
                    ) : filteredDocs.length === 0 ? (
                        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
                            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#1e3a5f]/5 flex items-center justify-center">
                                <ImageIcon size={26} className="text-[#1e3a5f]" />
                            </div>
                            <h3 className="text-base font-semibold text-slate-900 mb-1">Sin BOMs cargados</h3>
                            <p className="text-sm text-slate-500 mb-5 max-w-md mx-auto">
                                Crea una ficha BOM nueva o importa desde los Excel del servidor (proximamente).
                            </p>
                            <button
                                onClick={handleNew}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] hover:bg-[#172e4a] text-white rounded-lg text-sm font-medium"
                            >
                                <Plus size={16} /> Crear primer BOM
                            </button>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            <table className="w-full text-sm">
                                <thead className="bg-[#1e3a5f] text-white">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold">N° BOM</th>
                                        <th className="px-4 py-3 text-left font-semibold">Part Number</th>
                                        <th className="px-4 py-3 text-left font-semibold">Descripcion</th>
                                        <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                                        <th className="px-4 py-3 text-left font-semibold">Familia</th>
                                        <th className="px-4 py-3 text-center font-semibold">Items</th>
                                        <th className="px-4 py-3 text-left font-semibold">Rev</th>
                                        <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredDocs.map(d => (
                                        <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50">
                                            <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{d.bomNumber}</td>
                                            <td className="px-4 py-2.5 font-mono text-xs text-slate-900">{d.partNumber || '—'}</td>
                                            <td className="px-4 py-2.5 text-slate-700">{d.descripcion || '—'}</td>
                                            <td className="px-4 py-2.5">
                                                <span className="inline-block px-2 py-0.5 rounded text-xs bg-[#1e3a5f]/10 text-[#1e3a5f] font-medium">
                                                    {d.cliente || '—'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-600">{d.familia || '—'}</td>
                                            <td className="px-4 py-2.5 text-center text-slate-600">{d.itemCount}</td>
                                            <td className="px-4 py-2.5 text-slate-600">{d.revision}</td>
                                            <td className="px-4 py-2.5 text-right">
                                                <button
                                                    onClick={() => handleOpen(d.id)}
                                                    className="text-[#1e3a5f] hover:underline text-xs font-medium mr-3"
                                                >
                                                    Abrir
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(d.id)}
                                                    className="text-red-500 hover:text-red-700"
                                                    aria-label="Eliminar"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ============================================================
    // VIEW: Editor (ficha BOM con tabla agrupada + imagen producto)
    // ============================================================
    return (
        <div className="min-h-full bg-slate-100">
            {/* Toolbar */}
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleBackToList}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
                        aria-label="Volver"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <p className="text-xs text-slate-500">Editando</p>
                        <p className="text-sm font-semibold text-slate-900">{doc.header.bomNumber} {doc.header.partNumber && `— ${doc.header.partNumber}`}</p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] hover:bg-[#172e4a] text-white rounded-lg text-sm font-medium"
                >
                    <Save size={16} /> Guardar
                </button>
            </div>

            <div className="p-6 max-w-[1600px] mx-auto">
                {/* Header de la ficha — replica el formato Barack */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4">
                    <div className="grid grid-cols-12 bg-[#1e3a5f] text-white text-sm font-semibold">
                        <div className="col-span-3 px-4 py-3 border-r border-white/20">PART NUMBER</div>
                        <div className="col-span-6 px-4 py-3 text-center border-r border-white/20">DESCRIPCION DEL PRODUCTO</div>
                        <div className="col-span-3 px-4 py-3 text-center">IMAGEN</div>
                    </div>
                    <div className="grid grid-cols-12 text-sm">
                        <input
                            value={doc.header.partNumber}
                            onChange={e => updateHeader('partNumber', e.target.value)}
                            placeholder="2HT.857.115 YZM"
                            className="col-span-3 px-4 py-3 font-mono text-slate-900 border-r border-slate-200 focus:outline-none focus:bg-blue-50/40"
                        />
                        <input
                            value={doc.header.descripcion}
                            onChange={e => updateHeader('descripcion', e.target.value)}
                            placeholder="IP Decorative Trim (Titan Black Narbe) COMFORT"
                            className="col-span-6 px-4 py-3 text-slate-900 border-r border-slate-200 focus:outline-none focus:bg-blue-50/40 text-center"
                        />
                        <div className="col-span-3 px-4 py-2 text-xs text-slate-400 text-center flex items-center justify-center">
                            (Subir imagen — proximamente)
                        </div>
                    </div>
                </div>

                {/* Metadata secundaria */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Cliente</label>
                        <input
                            value={doc.header.cliente}
                            onChange={e => updateHeader('cliente', e.target.value)}
                            placeholder="VW / PWA / NOVAX"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Proyecto</label>
                        <input
                            value={doc.header.proyecto}
                            onChange={e => updateHeader('proyecto', e.target.value)}
                            placeholder="VW427-1LA_K-PATAGONIA"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Familia</label>
                        <input
                            value={doc.header.familia}
                            onChange={e => updateHeader('familia', e.target.value)}
                            placeholder="IP PAD / Insert / Armrest..."
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Revision</label>
                        <input
                            value={doc.header.revision}
                            onChange={e => updateHeader('revision', e.target.value)}
                            placeholder="A"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30"
                        />
                    </div>
                </div>

                {/* Layout principal: tabla a la izquierda, imagen producto a la derecha */}
                <div className="grid grid-cols-12 gap-4">
                    {/* Tabla agrupada por categoria */}
                    <div className="col-span-12 lg:col-span-8">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            {doc.groups.map((g) => (
                                <div key={g.id} className="border-b border-slate-200 last:border-b-0">
                                    {/* Header de categoria */}
                                    <div className="grid grid-cols-[60px_110px_110px_1fr_90px_70px_140px_70px_40px] bg-[#1e3a5f] text-white text-[11px] font-semibold uppercase tracking-wide">
                                        <div className="px-3 py-2 border-r border-white/15 col-span-1">{BOM_CATEGORY_LABEL[g.categoria]}</div>
                                        <div className="px-3 py-2 border-r border-white/15">Cod. Int.</div>
                                        <div className="px-3 py-2 border-r border-white/15">Cod. Prov</div>
                                        <div className="px-3 py-2 border-r border-white/15">Desc. / Plano</div>
                                        <div className="px-3 py-2 border-r border-white/15 text-center">Consumo</div>
                                        <div className="px-3 py-2 border-r border-white/15 text-center">Unidad</div>
                                        <div className="px-3 py-2 border-r border-white/15">Proveedor</div>
                                        <div className="px-3 py-2 text-center border-r border-white/15">Img</div>
                                        <div className="px-2 py-2 text-center">·</div>
                                    </div>
                                    {/* Items */}
                                    {g.items.length === 0 ? (
                                        <div className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => addItem(g.categoria)}
                                                className="text-xs text-[#1e3a5f] hover:underline font-medium"
                                            >
                                                + Agregar item de {BOM_CATEGORY_LABEL[g.categoria]}
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            {g.items.map(it => (
                                                <div key={it.id} className="grid grid-cols-[60px_110px_110px_1fr_90px_70px_140px_70px_40px] items-stretch border-t border-slate-100 hover:bg-blue-50/20 text-xs">
                                                    {/* Numero en circulo */}
                                                    <div className="flex items-center justify-center border-r border-slate-100 py-2">
                                                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#1e3a5f] text-white font-semibold text-[11px]">
                                                            {it.numero || '—'}
                                                        </span>
                                                    </div>
                                                    <input
                                                        value={it.codigoInterno}
                                                        onChange={e => updateItem(g.categoria, it.id, 'codigoInterno', e.target.value)}
                                                        className="px-2 py-2 border-r border-slate-100 font-mono focus:outline-none focus:bg-blue-50/40"
                                                    />
                                                    <input
                                                        value={it.codigoProveedor}
                                                        onChange={e => updateItem(g.categoria, it.id, 'codigoProveedor', e.target.value)}
                                                        className="px-2 py-2 border-r border-slate-100 font-mono focus:outline-none focus:bg-blue-50/40"
                                                    />
                                                    <input
                                                        value={it.descripcion}
                                                        onChange={e => updateItem(g.categoria, it.id, 'descripcion', e.target.value)}
                                                        className="px-2 py-2 border-r border-slate-100 focus:outline-none focus:bg-blue-50/40"
                                                    />
                                                    <input
                                                        value={it.consumo}
                                                        onChange={e => updateItem(g.categoria, it.id, 'consumo', e.target.value)}
                                                        className="px-2 py-2 border-r border-slate-100 text-center font-mono focus:outline-none focus:bg-blue-50/40"
                                                    />
                                                    <select
                                                        value={it.unidad}
                                                        onChange={e => updateItem(g.categoria, it.id, 'unidad', e.target.value)}
                                                        className="px-2 py-2 border-r border-slate-100 bg-white focus:outline-none focus:bg-blue-50/40 text-center"
                                                    >
                                                        <option value=""></option>
                                                        {BOM_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                                    </select>
                                                    <input
                                                        value={it.proveedor}
                                                        onChange={e => updateItem(g.categoria, it.id, 'proveedor', e.target.value)}
                                                        className="px-2 py-2 border-r border-slate-100 font-medium focus:outline-none focus:bg-blue-50/40"
                                                    />
                                                    <div className="flex items-center justify-center border-r border-slate-100">
                                                        {it.imagen ? (
                                                            <img src={it.imagen} alt="" className="w-10 h-10 object-contain" />
                                                        ) : (
                                                            <ImageIcon size={14} className="text-slate-300" />
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => removeItem(g.categoria, it.id)}
                                                        className="flex items-center justify-center text-slate-400 hover:text-red-500"
                                                        aria-label="Eliminar item"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            ))}
                                            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50">
                                                <button
                                                    onClick={() => addItem(g.categoria)}
                                                    className="text-[11px] text-[#1e3a5f] hover:underline font-medium"
                                                >
                                                    + Agregar otro {BOM_CATEGORY_LABEL[g.categoria]}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Panel imagen producto con leaders */}
                    <div className="col-span-12 lg:col-span-4">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden sticky top-20">
                            <div className="bg-[#1e3a5f] text-white px-4 py-2 text-sm font-semibold uppercase tracking-wide text-center">
                                Imagen del producto
                            </div>
                            <div className="relative bg-slate-50 aspect-[3/4] flex items-center justify-center">
                                {doc.imagenProducto ? (
                                    <img src={doc.imagenProducto} alt="Producto" className="w-full h-full object-contain" />
                                ) : (
                                    <div className="text-center px-6 text-slate-400">
                                        <ImageIcon size={42} className="mx-auto mb-2" />
                                        <p className="text-xs">Subi una foto del producto.</p>
                                        <p className="text-[10px] mt-1">Despues vas a poder marcar la posicion de cada componente.</p>
                                    </div>
                                )}
                                {/* Leaders sobre la imagen */}
                                {doc.imagenProducto && doc.groups.flatMap(g => g.items).map(it => (
                                    it.leaderX > 0 || it.leaderY > 0 ? (
                                        <span
                                            key={it.id}
                                            className="absolute -translate-x-1/2 -translate-y-1/2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#1e3a5f] text-white text-[10px] font-bold shadow-md ring-2 ring-white"
                                            style={{ left: `${it.leaderX}%`, top: `${it.leaderY}%` }}
                                        >
                                            {it.numero}
                                        </span>
                                    ) : null
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BomApp;
