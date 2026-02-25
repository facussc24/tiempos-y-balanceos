/**
 * AMFE Chat Copilot Panel
 *
 * Chat interface where the user gives natural language instructions
 * and Gemini modifies the AMFE document directly.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    X, MessageSquare, Send, Loader2, AlertTriangle, CheckCircle2,
    Plus, Edit3, XCircle, ChevronDown, ChevronUp, Sparkles, RotateCcw,
    AlertCircle, HelpCircle, Settings, Eye, EyeOff, ExternalLink,
} from 'lucide-react';
import { GeminiError, testGeminiConnection, clearGeminiCache, GeminiConnectionStatus } from '../../utils/geminiClient';
import { loadSettings, saveSettings, AppSettings } from '../../utils/settingsStore';
import {
    sendChatMessage, executeChatActions, ChatAction, ChatAIResponse,
    ChatExecutionResult, ChatMessage,
} from './amfeChatEngine';
import { AmfeDocument } from './amfeTypes';

// ============================================================================
// TYPES
// ============================================================================

interface UIMessage {
    id: string;
    role: 'user' | 'assistant' | 'error';
    text: string;
    actions?: ChatAction[];
    executionResult?: ChatExecutionResult;
    questions?: string[];
    timestamp: number;
}

interface AmfeChatPanelProps {
    doc: AmfeDocument;
    onApplyChanges: (newDoc: AmfeDocument) => void;
    onClose: () => void;
    onSettingsChanged?: (enabled: boolean) => void;
}

// ============================================================================
// ACTION CARD
// ============================================================================

const ACTION_ICONS: Record<string, React.ReactNode> = {
    add: <Plus size={11} className="text-emerald-600" />,
    update: <Edit3 size={11} className="text-blue-600" />,
};

function ActionCard({ action }: { action: ChatAction }) {
    const isAdd = action.action.startsWith('add');
    const icon = isAdd ? ACTION_ICONS.add : ACTION_ICONS.update;
    const label = actionLabel(action);
    const pathStr = formatPath(action.path);

    return (
        <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs border ${
            isAdd ? 'bg-emerald-50/80 border-emerald-200' : 'bg-blue-50/80 border-blue-200'
        }`}>
            <span className="mt-0.5 shrink-0">{icon}</span>
            <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-800">{label}</p>
                {pathStr && (
                    <p className="text-[10px] text-gray-400 truncate mt-0.5" title={pathStr}>{pathStr}</p>
                )}
                {Object.keys(action.data).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                        {Object.entries(action.data).slice(0, 6).map(([k, v]) => (
                            <span key={k} className="inline-flex px-1.5 py-0.5 bg-white/80 rounded text-[10px] text-gray-600 max-w-[180px] truncate border border-gray-100">
                                <span className="text-gray-400 mr-0.5">{k}:</span> {String(v)}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function actionLabel(action: ChatAction): string {
    const labels: Record<string, string> = {
        addOperation: 'Agregar Operación',
        addWorkElement: 'Agregar Elemento 6M',
        addFunction: 'Agregar Función',
        addFailure: 'Agregar Modo de Falla',
        addCause: 'Agregar Causa',
        updateOperation: 'Modificar Operación',
        updateWorkElement: 'Modificar Elemento',
        updateFunction: 'Modificar Función',
        updateFailure: 'Modificar Modo de Falla',
        updateCause: 'Modificar Causa',
    };
    return labels[action.action] || action.action;
}

function formatPath(path: ChatAction['path']): string {
    const parts = [path.opName, path.weType || path.weName, path.funcDesc, path.failDesc, path.causeDesc]
        .filter(Boolean);
    return parts.join(' \u203A ');
}

// ============================================================================
// EXECUTION RESULT
// ============================================================================

function ExecutionSummary({ result }: { result: ChatExecutionResult }) {
    const hasErrors = result.errors.length > 0;
    const hasWarnings = (result.warnings?.length ?? 0) > 0;
    const [showDetails, setShowDetails] = useState(true);

    return (
        <div className={`rounded-lg p-3 text-xs border ${
            hasErrors ? 'bg-red-50 border-red-200' : hasWarnings ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
        }`}>
            <div className="flex items-center gap-2">
                {hasErrors
                    ? <AlertTriangle size={13} className="text-red-500" />
                    : hasWarnings
                        ? <AlertTriangle size={13} className="text-amber-500" />
                        : <CheckCircle2 size={13} className="text-emerald-600" />
                }
                <span className="font-semibold text-gray-800">
                    {result.applied} cambio{result.applied !== 1 ? 's' : ''} aplicado{result.applied !== 1 ? 's' : ''}
                    {hasWarnings ? ` \u2022 ${result.warnings.length} aviso${result.warnings.length !== 1 ? 's' : ''}` : ''}
                    {hasErrors ? ` \u2022 ${result.errors.length} error${result.errors.length !== 1 ? 'es' : ''}` : ''}
                </span>
                <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="ml-auto text-gray-400 hover:text-gray-600 transition"
                >
                    {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
            </div>
            {showDetails && (result.created.length > 0 || result.modified.length > 0 || (result.warnings?.length ?? 0) > 0 || result.errors.length > 0) && (
                <div className="mt-2 space-y-0.5 pl-5">
                    {result.created.map((c, i) => (
                        <p key={`c-${i}`} className="text-emerald-700">+ {c}</p>
                    ))}
                    {result.modified.map((m, i) => (
                        <p key={`m-${i}`} className="text-blue-700">~ {m}</p>
                    ))}
                    {result.warnings?.map((w, i) => (
                        <p key={`w-${i}`} className="text-amber-600">{w}</p>
                    ))}
                    {result.errors.map((e, i) => (
                        <p key={`e-${i}`} className="text-red-600">! {e}</p>
                    ))}
                </div>
            )}
        </div>
    );
}

// ============================================================================
// EXAMPLE PROMPTS
// ============================================================================

const EXAMPLE_PROMPTS = [
    'Agrega modo de falla de porosidad en soldadura',
    'Ponele severidad 8 a todas las fallas de pintura',
    'Agrega control preventivo de mantenimiento semanal',
    'Agrega una operacion de ensamble con una falla de torque incorrecto',
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const AmfeChatPanel: React.FC<AmfeChatPanelProps> = ({ doc, onApplyChanges, onClose, onSettingsChanged }) => {
    const [messages, setMessages] = useState<UIMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [pendingMsgId, setPendingMsgId] = useState<string | null>(null);
    const chatHistoryRef = useRef<ChatMessage[]>([]);
    const abortRef = useRef<AbortController | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Inline settings state
    const [showSettings, setShowSettings] = useState(false);
    const [geminiEnabled, setGeminiEnabled] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [testingConnection, setTestingConnection] = useState(false);
    const [testResult, setTestResult] = useState<GeminiConnectionStatus | null>(null);
    const [savingSettings, setSavingSettings] = useState(false);
    const [settingsLoaded, setSettingsLoaded] = useState(false);

    // Load settings on mount
    useEffect(() => {
        loadSettings().then(s => {
            setGeminiEnabled(s.geminiEnabled);
            setApiKey(s.geminiApiKey || '');
            setSettingsLoaded(true);
        });
    }, []);

    const handleSaveSettings = useCallback(async () => {
        setSavingSettings(true);
        try {
            const settings = await loadSettings();
            const updated: AppSettings = {
                ...settings,
                geminiEnabled,
                geminiApiKey: apiKey.trim() || null,
            };
            await saveSettings(updated);
            clearGeminiCache();
            onSettingsChanged?.(geminiEnabled && !!apiKey.trim());
        } finally {
            setSavingSettings(false);
        }
    }, [geminiEnabled, apiKey, onSettingsChanged]);

    const handleTestConnection = useCallback(async () => {
        await handleSaveSettings();
        setTestingConnection(true);
        setTestResult(null);
        try {
            const result = await testGeminiConnection();
            setTestResult(result);
        } catch {
            setTestResult({ ok: false, error: 'Error de conexion' });
        } finally {
            setTestingConnection(false);
        }
    }, [handleSaveSettings]);

    const handleToggleAi = useCallback(async (checked: boolean) => {
        setGeminiEnabled(checked);
        setTestResult(null);
        try {
            const settings = await loadSettings();
            await saveSettings({ ...settings, geminiEnabled: checked });
            onSettingsChanged?.(checked && !!apiKey.trim());
        } catch { /* ignore */ }
    }, [apiKey, onSettingsChanged]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    // Focus textarea on mount
    useEffect(() => {
        textareaRef.current?.focus();
    }, []);

    const handleSend = useCallback(async (overrideText?: string) => {
        const text = (overrideText || input).trim();
        if (!text || isLoading) return;

        setInput('');
        const userMsgId = `user-${Date.now()}`;
        const userMsg: UIMessage = {
            id: userMsgId,
            role: 'user',
            text,
            timestamp: Date.now(),
        };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        abortRef.current = new AbortController();

        try {
            const { response, history } = await sendChatMessage(
                text,
                doc,
                chatHistoryRef.current,
                abortRef.current.signal,
            );
            chatHistoryRef.current = history;

            const assistantMsgId = `assistant-${Date.now()}`;
            const assistantMsg: UIMessage = {
                id: assistantMsgId,
                role: 'assistant',
                text: response.message,
                actions: response.actions.length > 0 ? response.actions : undefined,
                questions: response.questions.length > 0 ? response.questions : undefined,
                timestamp: Date.now(),
            };
            setMessages(prev => [...prev, assistantMsg]);

            if (response.actions.length > 0) {
                setPendingMsgId(assistantMsgId);
            }
        } catch (err) {
            let errorText = 'Error inesperado.';
            if (err instanceof GeminiError) {
                switch (err.code) {
                    case 'NO_KEY':
                        errorText = 'Configurá tu API key con el botón ⚙ de arriba.';
                        break;
                    case 'TIMEOUT':
                        errorText = 'La solicitud tardo demasiado. Intenta de nuevo.';
                        break;
                    case 'RATE_LIMIT':
                        errorText = 'Rate limit excedido. Espera un momento.';
                        break;
                    case 'AUTH_ERROR':
                        errorText = 'API key inválida. Verificala en ⚙ Configuración.';
                        break;
                    case 'PARSE_ERROR':
                        errorText = 'No se pudo entender la respuesta de la IA. Intenta reformular.';
                        break;
                    default:
                        errorText = err.message;
                }
            }

            const errorMsg: UIMessage = {
                id: `error-${Date.now()}`,
                role: 'error',
                text: errorText,
                timestamp: Date.now(),
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
            abortRef.current = null;
        }
    }, [input, isLoading, doc]);

    const handleApply = useCallback((msgId: string) => {
        const msg = messages.find(m => m.id === msgId);
        if (!msg?.actions) return;

        const result = executeChatActions(msg.actions, doc);
        onApplyChanges(result.newDoc);

        setMessages(prev => prev.map(m =>
            m.id === msgId ? { ...m, executionResult: result, actions: undefined } : m,
        ));
        setPendingMsgId(null);
    }, [messages, doc, onApplyChanges]);

    const handleReject = useCallback((msgId: string) => {
        setMessages(prev => prev.map(m =>
            m.id === msgId ? { ...m, actions: undefined } : m,
        ));
        setPendingMsgId(null);
    }, []);

    const handleCancel = useCallback(() => {
        abortRef.current?.abort();
    }, []);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSend();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        }
    }, [handleSend, onClose]);

    // Global Escape key — close panel from anywhere in the modal
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const handleClearChat = useCallback(() => {
        setMessages([]);
        chatHistoryRef.current = [];
        setPendingMsgId(null);
    }, []);

    const hasOps = doc.operations.length > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-[92vw] max-w-2xl h-[88vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-200 bg-gradient-to-r from-violet-50 via-purple-50 to-fuchsia-50">
                    <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-sm">
                        <Sparkles size={16} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-sm font-bold text-gray-800">Copiloto IA</h2>
                        <p className="text-[10px] text-gray-500 truncate">
                            Asistente AMFE {hasOps ? `\u2022 ${doc.operations.length} operacion${doc.operations.length !== 1 ? 'es' : ''}` : '\u2022 AMFE vacio'}
                        </p>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`p-1.5 rounded-lg transition ${showSettings ? 'text-violet-600 bg-violet-100' : 'text-gray-400 hover:text-gray-600 hover:bg-white/60'}`}
                            title="Configuración IA"
                            aria-label="Configuración"
                        >
                            <Settings size={14} />
                        </button>
                        {messages.length > 0 && (
                            <button
                                onClick={handleClearChat}
                                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-white/60 transition"
                                title="Limpiar chat"
                                aria-label="Limpiar chat"
                            >
                                <RotateCcw size={14} />
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-white/60 transition"
                            aria-label="Cerrar copiloto"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Inline Settings Panel */}
                {showSettings && (
                    <div className="border-b border-gray-200 bg-gray-50/80 px-5 py-3 space-y-3">
                        {!settingsLoaded ? (
                            <div className="flex items-center justify-center py-3">
                                <Loader2 size={16} className="animate-spin text-gray-400" />
                            </div>
                        ) : (
                            <>
                                {/* Toggle */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-xs font-medium text-gray-700">Sugerencias con IA</div>
                                        <div className="text-[10px] text-gray-400">Google Gemini (gratis, 1500/dia)</div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={geminiEnabled} onChange={e => handleToggleAi(e.target.checked)} className="sr-only peer" />
                                        <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600"></div>
                                    </label>
                                </div>
                                {/* API Key */}
                                <div className={geminiEnabled ? '' : 'opacity-50 pointer-events-none'}>
                                    <label className="block text-[10px] font-medium text-gray-600 mb-1">API Key</label>
                                    <div className="relative">
                                        <input
                                            type={showKey ? 'text' : 'password'}
                                            value={apiKey}
                                            onChange={e => { setApiKey(e.target.value); setTestResult(null); }}
                                            placeholder="AIzaSy..."
                                            className="w-full px-2.5 py-1.5 pr-8 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-200 focus:border-violet-400 transition font-mono"
                                        />
                                        <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                            {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
                                        </button>
                                    </div>
                                    <p className="mt-1 text-[10px] text-gray-400">
                                        Obtené tu key en{' '}
                                        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-violet-500 hover:text-violet-700 underline inline-flex items-center gap-0.5">
                                            Google AI Studio <ExternalLink size={7} />
                                        </a>
                                    </p>
                                </div>
                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleSaveSettings}
                                        disabled={savingSettings}
                                        className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition disabled:opacity-50"
                                    >
                                        {savingSettings && <Loader2 size={10} className="animate-spin" />}
                                        Guardar
                                    </button>
                                    <button
                                        onClick={handleTestConnection}
                                        disabled={testingConnection || !geminiEnabled || !apiKey.trim()}
                                        className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 rounded-lg transition disabled:opacity-50"
                                    >
                                        {testingConnection ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                                        Probar
                                    </button>
                                </div>
                                {/* Test Result */}
                                {testResult && (
                                    <div className={`flex items-center gap-1.5 p-2 rounded-lg text-[10px] ${testResult.ok ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                                        {testResult.ok ? <CheckCircle2 size={12} className="text-green-500" /> : <XCircle size={12} className="text-red-500" />}
                                        <span>{testResult.ok ? `Conexión exitosa (${testResult.model})` : (testResult.error || 'Error desconocido')}</span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Chat Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                    {/* Empty State */}
                    {messages.length === 0 && !isLoading && (
                        <div className="flex flex-col items-center justify-center h-full py-8">
                            <div className="w-16 h-16 bg-gradient-to-br from-violet-100 to-purple-100 rounded-2xl flex items-center justify-center mb-4">
                                <Sparkles size={28} className="text-purple-400" />
                            </div>
                            <p className="text-sm font-semibold text-gray-700">Copiloto IA</p>
                            <p className="text-xs text-gray-400 mt-1 max-w-xs text-center">
                                Escribi instrucciones en lenguaje natural para modificar tu AMFE.
                                La IA propone cambios y vos decidis si aplicarlos.
                            </p>
                            <div className="mt-5 flex flex-wrap gap-2 max-w-md justify-center">
                                {EXAMPLE_PROMPTS.map((prompt, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSend(prompt)}
                                        className="text-[11px] text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-full px-3 py-1.5 transition whitespace-nowrap"
                                    >
                                        {prompt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Messages */}
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {/* Error messages */}
                            {msg.role === 'error' && (
                                <div className="max-w-[90%] flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                                    <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                                    <p className="text-xs text-red-700">{msg.text}</p>
                                </div>
                            )}

                            {/* User messages */}
                            {msg.role === 'user' && (
                                <div className="max-w-[80%] bg-gradient-to-br from-violet-600 to-purple-600 text-white rounded-2xl rounded-br-md px-4 py-2.5 shadow-sm">
                                    <p className="text-xs whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                                </div>
                            )}

                            {/* Assistant messages */}
                            {msg.role === 'assistant' && (
                                <div className="max-w-[90%] bg-gray-50 border border-gray-200 text-gray-800 rounded-2xl rounded-bl-md px-4 py-3 space-y-2.5">
                                    <p className="text-xs whitespace-pre-wrap leading-relaxed">{msg.text}</p>

                                    {/* Questions */}
                                    {msg.questions && msg.questions.length > 0 && (
                                        <div className="space-y-1.5">
                                            {msg.questions.map((q, i) => (
                                                <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                                                    <HelpCircle size={12} className="mt-0.5 shrink-0 text-amber-500" />
                                                    <span>{q}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Pending Actions */}
                                    {msg.actions && msg.actions.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                                {msg.actions.length} accion{msg.actions.length !== 1 ? 'es' : ''} propuesta{msg.actions.length !== 1 ? 's' : ''}
                                            </p>
                                            {msg.actions.map((action, i) => (
                                                <ActionCard key={i} action={action} />
                                            ))}
                                            <div className="flex gap-2 pt-1">
                                                <button
                                                    onClick={() => handleApply(msg.id)}
                                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 shadow-sm transition active:scale-95"
                                                >
                                                    <CheckCircle2 size={13} />
                                                    Aplicar {msg.actions.length > 1 ? 'Todos' : ''}
                                                </button>
                                                <button
                                                    onClick={() => handleReject(msg.id)}
                                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-white text-gray-600 border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 transition active:scale-95"
                                                >
                                                    <XCircle size={13} />
                                                    Rechazar
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Execution Result */}
                                    {msg.executionResult && (
                                        <ExecutionSummary result={msg.executionResult} />
                                    )}
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Loading */}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-3">
                                <div className="flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                                <span className="text-xs text-gray-500">Analizando...</span>
                                <button
                                    onClick={handleCancel}
                                    className="text-[10px] text-red-400 hover:text-red-600 font-medium transition"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className="border-t border-gray-200 px-4 py-3 bg-gray-50/80">
                    <div className="flex items-end gap-2">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Escribi una instruccion..."
                            rows={2}
                            className="flex-1 resize-none text-xs border border-gray-300 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition placeholder:text-gray-400"
                            disabled={isLoading}
                        />
                        <button
                            onClick={() => handleSend()}
                            disabled={isLoading || !input.trim()}
                            className="p-2.5 bg-gradient-to-br from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-700 hover:to-purple-700 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm active:scale-95"
                            aria-label="Enviar mensaje"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5 ml-1">Ctrl+Enter para enviar</p>
                </div>
            </div>
        </div>
    );
};

export default AmfeChatPanel;
