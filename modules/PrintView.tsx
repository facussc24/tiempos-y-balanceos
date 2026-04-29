
import React, { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';

export const PrintView: React.FC = () => {
    // Read content lazily during initial state — avoids setState-in-effect.
    const [htmlContent] = useState<string | null>(() => {
        const content = localStorage.getItem('barack_print_content');
        return content ? DOMPurify.sanitize(content) : null;
    });

    useEffect(() => {
        if (!htmlContent) return;
        // Auto-print after a short delay to ensure styles load
        const timer = setTimeout(() => {
            window.print();
        }, 500);
        return () => clearTimeout(timer);
    }, [htmlContent]);

    if (!htmlContent) return <div className="p-10 text-center">Cargando reporte...</div>;

    return (
        <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
    );
};
