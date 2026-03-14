import React, { useEffect, useRef, useCallback } from 'react';

interface Props extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    value: string | number;
}

const AutoResizeTextarea: React.FC<Props> = ({ value, className, ...props }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const rafRef = useRef<number>(0);

    const recalcHeight = useCallback(() => {
        // Cancel any pending rAF to batch multiple calls
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
            const el = textareaRef.current;
            if (!el) return;
            el.style.height = 'auto';
            const h = el.scrollHeight;
            // Guard: si scrollHeight es 0, el elemento esta oculto (display:none).
            // NO setear height = 0 — dejar la altura anterior intacta.
            if (h > 0) {
                el.style.height = `${h}px`;
            }
        });
    }, []);

    // Cleanup rAF on unmount
    useEffect(() => {
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, []);

    // Recalcular cuando value cambia
    useEffect(() => {
        recalcHeight();
    }, [value, recalcHeight]);

    // Escuchar evento custom para recalcular cuando el tab AMFE vuelve a ser visible
    useEffect(() => {
        const handler = () => recalcHeight();
        document.addEventListener('amfe-tab-visible', handler);
        return () => document.removeEventListener('amfe-tab-visible', handler);
    }, [recalcHeight]);

    return (
        <textarea
            ref={textareaRef}
            value={value}
            className={`${className} overflow-hidden resize-none box-border block break-words`}
            rows={1}
            {...props}
        />
    );
};

export default React.memo(AutoResizeTextarea);
