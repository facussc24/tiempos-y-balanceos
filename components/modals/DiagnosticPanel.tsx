/**
 * Diagnostic Panel Component
 * 
 * Displays logs, allows export of diagnostic reports.
 * Accessible from developer/debug menu or error toasts.
 */

import { useState, useEffect } from 'react';
import { FileText, Download, Trash2, X, AlertCircle, Info, AlertTriangle, Bug } from 'lucide-react';
import {
    logger,
    LogEntry,
    LogLevel,
    exportDiagnosticJSON,
} from '../../utils/logger';
import { toast } from '../ui/Toast';

interface DiagnosticPanelProps {
    isOpen: boolean;
    onClose: () => void;
    projectPath?: string | null;
}

const levelIcons: Record<LogLevel, React.ReactNode> = {
    debug: <Bug size={14} className="text-slate-400" />,
    info: <Info size={14} className="text-blue-400" />,
    warn: <AlertTriangle size={14} className="text-amber-400" />,
    error: <AlertCircle size={14} className="text-red-400" />
};

const levelColors: Record<LogLevel, string> = {
    debug: 'text-slate-500',
    info: 'text-blue-600',
    warn: 'text-amber-600',
    error: 'text-red-600'
};

export function DiagnosticPanel({ isOpen, onClose, projectPath }: DiagnosticPanelProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [filter, setFilter] = useState<LogLevel | 'all'>('all');

    // Subscribe to new logs
    useEffect(() => {
        setLogs(logger.getAll());
        return logger.subscribe((entry) => {
            setLogs(prev => [...prev.slice(-499), entry]);
        });
    }, []);

    // Filter logs by level
    const filteredLogs = filter === 'all'
        ? logs
        : logs.filter(l => l.level === filter);

    const handleExport = () => {
        try {
            const json = exportDiagnosticJSON(projectPath);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `diagnostic_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1500);

            toast.success('Diagnóstico Exportado', 'Archivo guardado en Descargas');
        } catch (err) {
            toast.error('Error al Exportar', String(err));
        }
    };

    const handleClear = () => {
        logger.clear();
        setLogs([]);
        toast.info('Logs Limpiados', 'Se eliminaron todos los registros');
    };

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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <FileText className="text-blue-400" size={20} />
                        <h2 className="text-lg font-bold text-white">Panel de Diagnóstico</h2>
                        <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-full">
                            {logs.length} registros
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Download size={14} /> Exportar
                        </button>
                        <button
                            onClick={handleClear}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                        >
                            <Trash2 size={14} /> Limpiar
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="px-6 py-3 border-b border-slate-700 flex gap-2">
                    {(['all', 'debug', 'info', 'warn', 'error'] as const).map((level) => (
                        <button
                            key={level}
                            onClick={() => setFilter(level)}
                            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${filter === level
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                        >
                            {level === 'all' ? 'Todos' : level.toUpperCase()}
                        </button>
                    ))}
                </div>

                {/* Log List */}
                <div className="flex-1 overflow-auto p-4 font-mono text-xs">
                    {filteredLogs.length === 0 ? (
                        <div className="text-center text-slate-500 py-8">
                            No hay registros {filter !== 'all' ? `de nivel ${filter}` : ''}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredLogs.map((entry, i) => (
                                <div
                                    key={i}
                                    className="flex items-start gap-2 py-1 px-2 rounded hover:bg-slate-800 transition-colors"
                                >
                                    {levelIcons[entry.level]}
                                    <span className="text-slate-500 w-44 flex-shrink-0">
                                        {entry.timestamp.substring(11, 23)}
                                    </span>
                                    <span className="text-slate-400 w-24 flex-shrink-0">
                                        [{entry.category}]
                                    </span>
                                    <span className={`${levelColors[entry.level]} flex-1`}>
                                        {entry.message}
                                    </span>
                                    {entry.details && (
                                        <span className="text-slate-500 text-[10px] max-w-xs truncate">
                                            {JSON.stringify(entry.details)}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-slate-700 text-xs text-slate-500">
                    <span>El diagnóstico NO incluye datos sensibles (clientes, ingenieros, contraseñas).</span>
                </div>
            </div>
        </div>
    );
}

export default DiagnosticPanel;
