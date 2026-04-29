/**
 * BomApp — Modulo de Lista de Materiales (BOM)
 *
 * Soporta variantes (ej: Top Roll Front / Rear). Si hay 1 sola variante con
 * name="" no se muestran tabs. Si hay >1, aparecen tabs arriba de la tabla.
 *
 * Layout:
 * - Header tipo "ficha Barack" (franja navy con PART NUMBER / DESCRIPCION / IMAGEN)
 * - Tabs de variante (si aplica)
 * - Tabla unificada de la variante activa con headers de columna una sola vez
 * - Badge sutil de categoria a la izquierda de cada fila
 * - Boton "+ Agregar material" con popup de categoria
 * - Panel imagen producto a la derecha con leaders numerados
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
    ArrowLeft, Plus, Save, Trash2, Image as ImageIcon, Search,
    Package, ChevronDown, X,
} from 'lucide-react';
import {
    BomDocument, BomCategory, BomItem,
    BOM_CATEGORIES, BOM_CATEGORY_LABEL, BOM_UNITS,
    createEmptyBomItem, createEmptyBomGroup, createEmptyBomVariant,
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

const CATEGORY_TAG_COLOR: Record<BomCategory, string> = {
    PLASTICO: 'bg-amber-100 text-amber-800',
    FUNDA: 'bg-violet-100 text-violet-800',
    SUSTRATO: 'bg-stone-100 text-stone-700',
    ADHESIVO_RETICULANTE: 'bg-rose-100 text-rose-800',
    ETIQUETA: 'bg-blue-100 text-blue-800',
    CARTON: 'bg-orange-100 text-orange-800',
    PRIMER: 'bg-emerald-100 text-emerald-800',
    FILM: 'bg-sky-100 text-sky-800',
    OTROS: 'bg-slate-100 text-slate-600',
};

const BomApp: React.FC<BomAppProps> = ({ onBackToLanding }) => {
    const [view, setView] = useState<'registry' | 'editor'>('registry');
    const [docs, setDocs] = useState<BomRegistryEntry[]>([]);
    const [currentId, setCurrentId] = useState<string | null>(null);
    const [doc, setDoc] = useState<BomDocument>(createEmptyBomDoc());
    const [bomNumber, setBomNumber] = useState<string>('');
    const [activeVariantId, setActiveVariantId] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [filterCliente, setFilterCliente] = useState<string>('');
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    const reloadList = useCallback(async () => {
        setLoading(true);
        const list = await listBomDocuments();
        setDocs(list);
        setLoading(false);
    }, []);

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

    useEffect(() => {
        if (!showCategoryPicker) return;
        const handler = (e: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                setShowCategoryPicker(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showCategoryPicker]);

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

    // ----- Acciones del registry -----
    const handleNew = useCallback(() => {
        const empty = createEmptyBomDoc();
        const id = uuidv4();
        const num = `BOM-${String(docs.length + 1).padStart(3, '0')}`;
        empty.header.bomNumber = num;
        setCurrentId(id);
        setBomNumber(num);
        setDoc(empty);
        setActiveVariantId(empty.variants[0]?.id || '');
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
        setActiveVariantId(loaded.doc.variants[0]?.id || '');
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

    // ----- Edicion del documento -----
    const updateHeader = useCallback(<K extends keyof BomDocument['header']>(key: K, value: BomDocument['header'][K]) => {
        setDoc(prev => ({ ...prev, header: { ...prev.header, [key]: value } }));
    }, []);

    const activeVariant = useMemo(() => doc.variants.find(v => v.id === activeVariantId) || doc.variants[0], [doc.variants, activeVariantId]);

    const addVariant = useCallback(() => {
        const nv = createEmptyBomVariant(`Variante ${doc.variants.length + 1}`);
        setDoc(prev => ({ ...prev, variants: [...prev.variants, nv] }));
        setActiveVariantId(nv.id);
    }, [doc.variants.length]);

    const renameVariant = useCallback((variantId: string, name: string) => {
        setDoc(prev => ({
            ...prev,
            variants: prev.variants.map(v => v.id !== variantId ? v : { ...v, name }),
        }));
    }, []);

    const removeVariant = useCallback((variantId: string) => {
        setDoc(prev => {
            if (prev.variants.length <= 1) return prev; // siempre mantener al menos 1
            const variants = prev.variants.filter(v => v.id !== variantId);
            return { ...prev, variants };
        });
    }, []);

    const addMaterial = useCallback((cat: BomCategory) => {
        if (!activeVariant) return;
        setDoc(prev => ({
            ...prev,
            variants: prev.variants.map(v => {
                if (v.id !== activeVariant.id) return v;
                const total = v.groups.reduce((n, g) => n + g.items.length, 0);
                const numero = String(total + 1);
                const newItem = createEmptyBomItem(numero);
                const existing = v.groups.find(g => g.categoria === cat);
                let groups;
                if (existing) {
                    groups = v.groups.map(g => g.categoria !== cat ? g : { ...g, items: [...g.items, newItem] });
                } else {
                    groups = [...v.groups, { ...createEmptyBomGroup(cat), items: [newItem] }];
                    groups.sort((a, b) => BOM_CATEGORIES.indexOf(a.categoria) - BOM_CATEGORIES.indexOf(b.categoria));
                }
                return { ...v, groups };
            }),
        }));
        setShowCategoryPicker(false);
    }, [activeVariant]);

    const updateItem = useCallback((cat: BomCategory, itemId: string, field: keyof BomItem, value: string | number) => {
        if (!activeVariant) return;
        setDoc(prev => ({
            ...prev,
            variants: prev.variants.map(v => v.id !== activeVariant.id ? v : {
                ...v,
                groups: v.groups.map(g => g.categoria !== cat ? g : {
                    ...g,
                    items: g.items.map(it => it.id !== itemId ? it : { ...it, [field]: value }),
                }),
            }),
        }));
    }, [activeVariant]);

    const removeItem = useCallback((cat: BomCategory, itemId: string) => {
        if (!activeVariant) return;
        setDoc(prev => ({
            ...prev,
            variants: prev.variants.map(v => v.id !== activeVariant.id ? v : {
                ...v,
                groups: v.groups
                    .map(g => g.categoria !== cat ? g : { ...g, items: g.items.filter(it => it.id !== itemId) })
                    .filter(g => g.items.length > 0),
            }),
        }));
    }, [activeVariant]);

    const flatRows = useMemo(() => {
        if (!activeVariant) return [];
        const rows: { item: BomItem; categoria: BomCategory; isFirstOfCategory: boolean }[] = [];
        for (const g of activeVariant.groups) {
            g.items.forEach((it, i) => rows.push({ item: it, categoria: g.categoria, isFirstOfCategory: i === 0 }));
        }
        return rows;
    }, [activeVariant]);

    const hasMultipleVariants = doc.variants.length > 1 || (doc.variants[0]?.name || '') !== '';

    // ============================================================
    // VIEW: Registry
    // ============================================================
    if (view === 'registry') {
        return (
            <div className="min-h-full bg-slate-50">
                <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onBackToLanding}
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                            aria-label="Volver"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <h1 className="text-lg font-semibold text-slate-900">Lista de Materiales</h1>
                            <p className="text-xs text-slate-500">Fichas BOM por part number</p>
                        </div>
                    </div>
                    <button
                        onClick={handleNew}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] hover:bg-[#172e4a] text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                    >
                        <Plus size={16} /> Nuevo BOM
                    </button>
                </div>

                <div className="px-6 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[260px] max-w-md">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar por part number, descripcion, proyecto..."
                            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] transition-colors"
                        />
                    </div>
                    {clientesUnicos.length > 0 && (
                        <select
                            value={filterCliente}
                            onChange={e => setFilterCliente(e.target.value)}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                        >
                            <option value="">Todos los clientes</option>
                            {clientesUnicos.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    )}
                    <span className="text-xs text-slate-400 ml-auto">{filteredDocs.length} {filteredDocs.length === 1 ? 'ficha' : 'fichas'}</span>
                </div>

                <div className="px-6 py-6">
                    {loading ? (
                        <div className="text-center py-16 text-slate-400 text-sm">Cargando...</div>
                    ) : filteredDocs.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-2xl mx-auto">
                            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#3a5a8f] flex items-center justify-center shadow-md">
                                <Package size={28} className="text-white" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">Sin BOMs cargados todavia</h3>
                            <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto leading-relaxed">
                                Crea una ficha nueva o importa los Excel del servidor (proximamente).
                            </p>
                            <button
                                onClick={handleNew}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1e3a5f] hover:bg-[#172e4a] text-white rounded-lg text-sm font-medium shadow-sm"
                            >
                                <Plus size={16} /> Crear primer BOM
                            </button>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-600">
                                    <tr>
                                        <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wide">N° BOM</th>
                                        <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wide">Part Number</th>
                                        <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wide">Descripcion</th>
                                        <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wide">Cliente</th>
                                        <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wide">Familia</th>
                                        <th className="px-4 py-2.5 text-center font-medium text-xs uppercase tracking-wide">Items</th>
                                        <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wide">Rev</th>
                                        <th className="px-4 py-2.5 text-right font-medium text-xs uppercase tracking-wide">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredDocs.map(d => (
                                        <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs text-slate-700">{d.bomNumber}</td>
                                            <td className="px-4 py-3 font-mono text-xs text-slate-900">{d.partNumber || '—'}</td>
                                            <td className="px-4 py-3 text-slate-700">{d.descripcion || '—'}</td>
                                            <td className="px-4 py-3">
                                                {d.cliente ? (
                                                    <span className="inline-block px-2 py-0.5 rounded text-xs bg-[#1e3a5f]/10 text-[#1e3a5f] font-medium">
                                                        {d.cliente}
                                                    </span>
                                                ) : <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">{d.familia || '—'}</td>
                                            <td className="px-4 py-3 text-center text-slate-500 tabular-nums">{d.itemCount}</td>
                                            <td className="px-4 py-3 text-slate-500">{d.revision}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => handleOpen(d.id)}
                                                    className="text-[#1e3a5f] hover:underline text-xs font-medium mr-4"
                                                >
                                                    Abrir
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(d.id)}
                                                    className="text-slate-400 hover:text-red-500 transition-colors"
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
    // VIEW: Editor
    // ============================================================
    return (
        <div className="min-h-full bg-slate-50">
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleBackToList}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                        aria-label="Volver"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <p className="text-[11px] text-slate-400 uppercase tracking-wide">Editando</p>
                        <p className="text-sm font-semibold text-slate-900 -mt-0.5">
                            {doc.header.bomNumber}
                            {doc.header.partNumber && <span className="text-slate-400 font-normal"> · {doc.header.partNumber}</span>}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] hover:bg-[#172e4a] text-white rounded-lg text-sm font-medium shadow-sm"
                >
                    <Save size={16} /> Guardar
                </button>
            </div>

            <div className="p-6 max-w-[1600px] mx-auto">
                {/* Header ficha Barack */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-4 shadow-sm">
                    <div className="grid grid-cols-12 bg-[#1e3a5f] text-white text-[11px] font-semibold uppercase tracking-wider">
                        <div className="col-span-3 px-4 py-2.5 border-r border-white/10">Part Number</div>
                        <div className="col-span-6 px-4 py-2.5 text-center border-r border-white/10">Descripcion del producto</div>
                        <div className="col-span-3 px-4 py-2.5 text-center">Imagen</div>
                    </div>
                    <div className="grid grid-cols-12 text-sm">
                        <input
                            value={doc.header.partNumber}
                            onChange={e => updateHeader('partNumber', e.target.value)}
                            placeholder="2HT.857.115 YZM"
                            className="col-span-3 px-4 py-3 font-mono text-slate-900 border-r border-slate-100 focus:outline-none focus:bg-blue-50/30"
                        />
                        <input
                            value={doc.header.descripcion}
                            onChange={e => updateHeader('descripcion', e.target.value)}
                            placeholder="IP Decorative Trim (Titan Black Narbe) COMFORT"
                            className="col-span-6 px-4 py-3 text-slate-900 border-r border-slate-100 focus:outline-none focus:bg-blue-50/30 text-center"
                        />
                        <div className="col-span-3 flex items-center justify-center px-4 py-2 text-[11px] text-slate-400">
                            (Subir imagen — proximamente)
                        </div>
                    </div>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    {([
                        ['cliente', 'Cliente', 'VW / PWA / NOVAX'],
                        ['proyecto', 'Proyecto', 'VW427-1LA_K-PATAGONIA'],
                        ['familia', 'Familia', 'IP PAD / Insert / Top Roll'],
                        ['revision', 'Revision', 'A'],
                    ] as const).map(([key, label, ph]) => (
                        <div key={key}>
                            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
                            <input
                                value={doc.header[key]}
                                onChange={e => updateHeader(key, e.target.value)}
                                placeholder={ph}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] transition-colors"
                            />
                        </div>
                    ))}
                </div>

                {/* Tabs de variantes (si aplica) */}
                {(hasMultipleVariants || doc.variants.length > 1) && (
                    <div className="flex items-center gap-1 mb-3 border-b border-slate-200">
                        {doc.variants.map(v => (
                            <button
                                key={v.id}
                                onClick={() => setActiveVariantId(v.id)}
                                className={`group inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                                    v.id === activeVariantId
                                        ? 'border-[#1e3a5f] text-[#1e3a5f]'
                                        : 'border-transparent text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <input
                                    value={v.name}
                                    onChange={e => renameVariant(v.id, e.target.value)}
                                    placeholder="Sin nombre"
                                    className="bg-transparent border-none outline-none w-auto min-w-[80px]"
                                    style={{ width: `${Math.max(8, (v.name?.length || 10) + 2)}ch` }}
                                />
                                {doc.variants.length > 1 && (
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={(e) => { e.stopPropagation(); removeVariant(v.id); }}
                                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 cursor-pointer"
                                        aria-label="Eliminar variante"
                                    >
                                        <X size={12} />
                                    </span>
                                )}
                            </button>
                        ))}
                        <button
                            onClick={addVariant}
                            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-500 hover:text-[#1e3a5f] hover:bg-slate-50 rounded-t-lg transition-colors"
                        >
                            <Plus size={13} /> Variante
                        </button>
                    </div>
                )}

                {/* Si hay 1 variante con name vacio, ofrecer convertirla en multi-variante */}
                {!hasMultipleVariants && doc.variants.length === 1 && (
                    <div className="mb-3 flex items-center gap-2">
                        <button
                            onClick={() => {
                                renameVariant(doc.variants[0].id, 'Variante 1');
                                addVariant();
                            }}
                            className="text-xs text-slate-400 hover:text-[#1e3a5f] hover:underline"
                        >
                            + Agregar variante (ej: Front / Rear)
                        </button>
                    </div>
                )}

                {/* Layout: tabla + imagen */}
                <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-12 lg:col-span-8">
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            {flatRows.length === 0 ? (
                                <div className="px-6 py-16 text-center">
                                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
                                        <Package size={24} className="text-slate-400" />
                                    </div>
                                    <h3 className="text-base font-semibold text-slate-800 mb-1">Sin materiales todavia</h3>
                                    <p className="text-xs text-slate-500 mb-5 max-w-sm mx-auto">
                                        Agrega solo las categorias que lleva tu producto — cada pieza tiene materiales distintos.
                                    </p>
                                    <CategoryPicker
                                        show={showCategoryPicker}
                                        onShow={() => setShowCategoryPicker(true)}
                                        onPick={addMaterial}
                                        pickerRef={pickerRef}
                                    />
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-[120px_55px_110px_110px_1fr_90px_70px_140px_60px_36px] bg-slate-50 text-slate-500 text-[10px] font-semibold uppercase tracking-wider border-b border-slate-200">
                                        <div className="px-3 py-2.5">Categoria</div>
                                        <div className="px-2 py-2.5 text-center">N°</div>
                                        <div className="px-3 py-2.5">Cod. Int.</div>
                                        <div className="px-3 py-2.5">Cod. Prov</div>
                                        <div className="px-3 py-2.5">Descripcion / Plano</div>
                                        <div className="px-3 py-2.5 text-center">Consumo</div>
                                        <div className="px-3 py-2.5 text-center">Unidad</div>
                                        <div className="px-3 py-2.5">Proveedor</div>
                                        <div className="px-3 py-2.5 text-center">Img</div>
                                        <div></div>
                                    </div>
                                    {flatRows.map(({ item, categoria, isFirstOfCategory }) => (
                                        <div
                                            key={item.id}
                                            className={`grid grid-cols-[120px_55px_110px_110px_1fr_90px_70px_140px_60px_36px] items-stretch border-b border-slate-100 hover:bg-blue-50/20 text-sm group ${isFirstOfCategory ? 'border-t border-t-slate-200' : ''}`}
                                        >
                                            <div className="px-3 py-2 flex items-center">
                                                {isFirstOfCategory && (
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide ${CATEGORY_TAG_COLOR[categoria]}`}>
                                                        {BOM_CATEGORY_LABEL[categoria]}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-center py-2">
                                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#1e3a5f] text-white font-semibold text-[11px] tabular-nums">
                                                    {item.numero || '—'}
                                                </span>
                                            </div>
                                            <input value={item.codigoInterno} onChange={e => updateItem(categoria, item.id, 'codigoInterno', e.target.value)} className="px-2 py-2 font-mono text-xs focus:outline-none focus:bg-blue-50/40 bg-transparent" placeholder="—" />
                                            <input value={item.codigoProveedor} onChange={e => updateItem(categoria, item.id, 'codigoProveedor', e.target.value)} className="px-2 py-2 font-mono text-xs focus:outline-none focus:bg-blue-50/40 bg-transparent" placeholder="—" />
                                            <input value={item.descripcion} onChange={e => updateItem(categoria, item.id, 'descripcion', e.target.value)} className="px-2 py-2 focus:outline-none focus:bg-blue-50/40 bg-transparent" placeholder="Descripcion del componente" />
                                            <input value={item.consumo} onChange={e => updateItem(categoria, item.id, 'consumo', e.target.value)} className="px-2 py-2 text-center font-mono text-xs focus:outline-none focus:bg-blue-50/40 bg-transparent tabular-nums" placeholder="0,000" />
                                            <select value={item.unidad} onChange={e => updateItem(categoria, item.id, 'unidad', e.target.value)} className="px-2 py-2 bg-transparent focus:outline-none focus:bg-blue-50/40 text-center text-xs">
                                                <option value=""></option>
                                                {BOM_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                            <input value={item.proveedor} onChange={e => updateItem(categoria, item.id, 'proveedor', e.target.value)} className="px-2 py-2 font-medium text-xs focus:outline-none focus:bg-blue-50/40 bg-transparent" placeholder="—" />
                                            <div className="flex items-center justify-center">
                                                {item.imagen ? <img src={item.imagen} alt="" className="w-9 h-9 object-contain rounded" /> : <ImageIcon size={13} className="text-slate-300" />}
                                            </div>
                                            <button onClick={() => removeItem(categoria, item.id)} className="flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" aria-label="Eliminar item">
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    ))}
                                    <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                                        <span className="text-xs text-slate-400">{flatRows.length} {flatRows.length === 1 ? 'material' : 'materiales'}</span>
                                        <CategoryPicker
                                            show={showCategoryPicker}
                                            onShow={() => setShowCategoryPicker(true)}
                                            onPick={addMaterial}
                                            pickerRef={pickerRef}
                                            compact
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="col-span-12 lg:col-span-4">
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden sticky top-20 shadow-sm">
                            <div className="bg-[#1e3a5f] text-white px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-center">
                                Imagen del producto
                            </div>
                            <div className="relative bg-slate-50 aspect-[3/4] flex items-center justify-center">
                                {doc.imagenProducto ? (
                                    <img src={doc.imagenProducto} alt="Producto" className="w-full h-full object-contain" />
                                ) : (
                                    <div className="text-center px-6 text-slate-400">
                                        <ImageIcon size={36} className="mx-auto mb-2 text-slate-300" />
                                        <p className="text-xs">Subi una foto del producto</p>
                                        <p className="text-[10px] mt-1 text-slate-400">Despues vas a poder marcar la posicion de cada componente</p>
                                    </div>
                                )}
                                {doc.imagenProducto && activeVariant?.groups.flatMap(g => g.items).map(it => (
                                    (it.leaderX > 0 || it.leaderY > 0) ? (
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

interface CategoryPickerProps {
    show: boolean;
    onShow: () => void;
    onPick: (cat: BomCategory) => void;
    pickerRef: React.RefObject<HTMLDivElement | null>;
    compact?: boolean;
}

const CategoryPicker: React.FC<CategoryPickerProps> = ({ show, onShow, onPick, pickerRef, compact }) => (
    <div ref={pickerRef} className="relative inline-block">
        <button
            onClick={onShow}
            className={`inline-flex items-center gap-2 ${compact
                ? 'px-3 py-1.5 text-xs bg-white border border-slate-200 hover:border-[#1e3a5f] hover:text-[#1e3a5f] text-slate-600 rounded-lg shadow-sm'
                : 'px-5 py-2.5 text-sm bg-[#1e3a5f] hover:bg-[#172e4a] text-white rounded-lg shadow-sm'
            } font-medium transition-colors`}
        >
            <Plus size={compact ? 13 : 16} /> Agregar material <ChevronDown size={compact ? 12 : 14} className="opacity-70" />
        </button>
        {show && (
            <div className={`absolute z-30 ${compact ? 'right-0 bottom-full mb-2' : 'left-1/2 -translate-x-1/2 top-full mt-2'} w-64 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 max-h-80 overflow-y-auto`}>
                <div className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    Elegi categoria
                </div>
                {BOM_CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        onClick={() => onPick(cat)}
                        className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                    >
                        <span className={`inline-block w-2 h-2 rounded-full ${CATEGORY_TAG_COLOR[cat].replace('text-', 'bg-').split(' ')[0].replace('bg-', 'bg-')}`} />
                        {BOM_CATEGORY_LABEL[cat]}
                    </button>
                ))}
            </div>
        )}
    </div>
);

export default BomApp;
