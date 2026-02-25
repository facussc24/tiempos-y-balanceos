
import React, { useEffect, useState } from 'react';

export const PrintView: React.FC = () => {
    const [htmlContent, setHtmlContent] = useState<string | null>(null);

    useEffect(() => {
        // Retrieve content from storage
        const content = localStorage.getItem('barack_print_content');
        if (content) {
            setHtmlContent(content);

            // Auto-print after a short delay to ensure styles load
            const timer = setTimeout(() => {
                window.print();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, []);

    if (!htmlContent) return <div className="p-10 text-center">Cargando reporte...</div>;

    return (
        <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
    );
};
