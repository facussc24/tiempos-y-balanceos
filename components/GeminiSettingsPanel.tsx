/**
 * Gemini Settings Panel
 *
 * Slide-over panel for configuring Google Gemini AI suggestions.
 * Allows enabling/disabling AI, entering API key, and testing the connection.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Sparkles, Eye, EyeOff, Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { loadSettings, saveSettings, AppSettings } from '../utils/settingsStore';
import { testGeminiConnection, clearGeminiCache, GeminiConnectionStatus } from '../utils/geminiClient';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSettingsChanged: (enabled: boolean) => void;
}

const GeminiSettingsPanel: React.FC<Props> = ({ visible, onClose, onSettingsChanged }) => {
    const [geminiEnabled, setGeminiEnabled] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<GeminiConnectionStatus | null>(null);
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(false);

    // Load settings on mount
    useEffect(() => {
        if (!visible) return;
        loadSettings().then(s => {
            setGeminiEnabled(s.geminiEnabled);
            setApiKey(s.geminiApiKey || '');
            setLoaded(true);
            setTestResult(null);
        });
    }, [visible]);

    const handleSave = useCallback(async () => {
        setSaving(true);
        try {
            const settings = await loadSettings();
            const updated: AppSettings = {
                ...settings,
                geminiEnabled,
                geminiApiKey: apiKey.trim() || null,
            };
            await saveSettings(updated);
            clearGeminiCache();
            onSettingsChanged(geminiEnabled && !!apiKey.trim());
        } finally {
            setSaving(false);
        }
    }, [geminiEnabled, apiKey, onSettingsChanged]);

    const handleTest = useCallback(async () => {
        // Save first so the test uses the current key
        await handleSave();
        setTesting(true);
        setTestResult(null);
        try {
            const result = await testGeminiConnection();
            setTestResult(result);
        } catch {
            setTestResult({ ok: false, error: 'Error de conexion' });
        } finally {
            setTesting(false);
        }
    }, [handleSave]);

    const handleToggle = useCallback(async (checked: boolean) => {
        setGeminiEnabled(checked);
        setTestResult(null);
        // Auto-save toggle state so it takes effect immediately
        try {
            const settings = await loadSettings();
            await saveSettings({ ...settings, geminiEnabled: checked });
            onSettingsChanged(checked && !!apiKey.trim());
        } catch { /* ignore save errors for toggle */ }
    }, [apiKey, onSettingsChanged]);

    const handleKeyChange = useCallback((val: string) => {
        setApiKey(val);
        setTestResult(null);
    }, []);

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/30" onClick={onClose} />

            {/* Panel */}
            <div className="relative w-[380px] max-w-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-violet-50 to-purple-50">
                    <div className="flex items-center gap-2">
                        <Sparkles size={18} className="text-violet-600" />
                        <h2 className="text-sm font-semibold text-gray-800">Sugerencias con IA</h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded transition">
                        <X size={16} className="text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-5">
                    {!loaded ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 size={20} className="animate-spin text-gray-400" />
                        </div>
                    ) : (
                        <>
                            {/* Enable/Disable Toggle */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-xs font-medium text-gray-700">
                                        Activar sugerencias con IA
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-0.5">
                                        Google Gemini (gratis, 1500 consultas/dia)
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={geminiEnabled}
                                        onChange={e => handleToggle(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600"></div>
                                </label>
                            </div>

                            {/* API Key Input */}
                            <div className={geminiEnabled ? '' : 'opacity-50 pointer-events-none'}>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    API Key de Google Gemini
                                </label>
                                <div className="relative">
                                    <input
                                        type={showKey ? 'text' : 'password'}
                                        value={apiKey}
                                        onChange={e => handleKeyChange(e.target.value)}
                                        placeholder="AIzaSy..."
                                        className="w-full px-3 py-2 pr-10 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-200 focus:border-violet-400 transition font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowKey(!showKey)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
                                    >
                                        {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                                <p className="mt-1.5 text-[10px] text-gray-400">
                                    Obtene tu API key gratis en{' '}
                                    <a
                                        href="https://aistudio.google.com/apikey"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-violet-500 hover:text-violet-700 underline inline-flex items-center gap-0.5"
                                    >
                                        Google AI Studio <ExternalLink size={8} />
                                    </a>
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition disabled:opacity-50"
                                >
                                    {saving ? <Loader2 size={12} className="animate-spin" /> : null}
                                    Guardar
                                </button>
                                <button
                                    onClick={handleTest}
                                    disabled={testing || !geminiEnabled || !apiKey.trim()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 rounded-lg transition disabled:opacity-50"
                                >
                                    {testing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                    Probar conexion
                                </button>
                            </div>

                            {/* Test Result */}
                            {testResult && (
                                <div className={`flex items-start gap-2 p-2.5 rounded-lg text-xs ${
                                    testResult.ok
                                        ? 'bg-green-50 border border-green-200 text-green-700'
                                        : 'bg-red-50 border border-red-200 text-red-700'
                                }`}>
                                    {testResult.ok ? (
                                        <CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" />
                                    ) : (
                                        <XCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                                    )}
                                    <div>
                                        {testResult.ok ? (
                                            <span>Conexion exitosa ({testResult.model})</span>
                                        ) : (
                                            <span>{testResult.error || 'Error desconocido'}</span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Info Box */}
                            <div className="bg-violet-50 border border-violet-100 rounded-lg p-3 space-y-1.5">
                                <div className="text-xs font-medium text-violet-700">Como funciona</div>
                                <ul className="text-[10px] text-violet-600 space-y-1 list-disc list-inside">
                                    <li>Al escribir en un campo del AMFE, se muestran sugerencias locales (instantaneas) de la biblioteca</li>
                                    <li>Si la IA esta activa, despues de 0.5s se consulta a Gemini por sugerencias adicionales</li>
                                    <li>Las sugerencias de IA aparecen con icono <span className="inline-flex items-center"><Sparkles size={8} className="text-violet-500" /></span> violeta</li>
                                    <li>Gemini Free Tier: 1500 consultas/dia, sin costo</li>
                                    <li>Tu API key se guarda solo en tu computadora</li>
                                </ul>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GeminiSettingsPanel;
