/**
 * SequenceAlert - V4.4 Simplified UX
 * 
 * Alert showing recommended production sequence pattern
 * when there's high variability between products
 */
import React, { useState } from 'react';
import { AlertTriangle, Copy, Check } from 'lucide-react';

interface SequenceAlertProps {
    pattern: string;  // e.g., "APB → APB → APB → IP_PAD"
    explanation: string;
}

export const SequenceAlert: React.FC<SequenceAlertProps> = ({
    pattern,
    explanation
}) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(pattern.replace(/→/g, '>')).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(() => { /* clipboard unavailable */ });
    };

    return (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 animate-in fade-in slide-in-from-bottom duration-500">
            <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                    <AlertTriangle size={20} className="text-amber-600" />
                </div>
                <div className="flex-1">
                    <h4 className="font-semibold text-amber-800 mb-1">
                        Orden de Producción Sugerido
                    </h4>
                    <p className="text-sm text-amber-700 mb-3">
                        {explanation}
                    </p>

                    {/* Pattern display */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 bg-white border border-amber-200 rounded-lg px-4 py-3 font-mono text-sm text-slate-700 overflow-x-auto">
                            {pattern}
                        </div>
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors text-sm font-medium"
                        >
                            {copied ? (
                                <>
                                    <Check size={16} />
                                    Copiado
                                </>
                            ) : (
                                <>
                                    <Copy size={16} />
                                    Copiar
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
