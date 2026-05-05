/**
 * buildZipFlowHtml — Renders a PfdDocument to a standalone HTML string using
 * the zip-style flow renderer. This is what pfdHtmlExport / pfdSvgExport /
 * pfdPdfExport all use under the hood once we switched the editor to the
 * zip motor (the user explicitly asked the export to match the editor).
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PfdDocument } from '../pfdTypes';
import { pfdStepsToZipFlow } from './pfdStepsToZipFlow';
import { FlowSequence, getRightPadding, getBottomPadding } from './ZipFlowRenderer';
import { FLOW_CSS } from '../flowStyles';
import { ZIP_FLOW_EXPORT_CSS } from './zipFlowExportCss';

interface ZipFlowExportProps {
    doc: PfdDocument;
    logoBase64?: string;
}

/**
 * Header tipo zip — grid 4-col: logo | título | datos del documento.
 * Reusa la estructura del App.tsx del zip pero adaptada al PfdHeader de Barack.
 */
const ZipExportHeader = ({ doc, logoBase64 }: ZipFlowExportProps) => {
    const h = doc.header;
    return createElement(
        'div',
        { className: 'w-full mx-auto bg-white border-[1.5px] border-[#60A5FA] mb-8 shadow-sm', style: { maxWidth: 1400 } },
        createElement('div', { className: 'grid grid-cols-4' },
            // Logo cell
            createElement(
                'div',
                { className: 'col-span-1 border-r-[1.5px] border-[#60A5FA] p-3 flex flex-col items-center justify-center bg-[#f9fafb]' },
                logoBase64
                    ? createElement('img', { src: logoBase64, alt: 'Logo', style: { maxHeight: 64, objectFit: 'contain' } })
                    : [
                        createElement('div', { key: 'b', className: 'text-[#1E3A8A] font-serif font-black text-2xl tracking-tighter' }, 'BARACK'),
                        createElement('div', { key: 'm', className: 'text-[#9ca3af] text-[10px] tracking-widest font-light' }, 'MERCOSUL'),
                    ],
            ),
            // Title cell
            createElement(
                'div',
                { className: 'col-span-2 border-r-[1.5px] border-[#60A5FA] flex items-center justify-center p-4 text-center' },
                createElement('h1', { className: 'text-xl font-black text-[#1E3A8A] uppercase italic leading-tight' }, h.partName || 'Sin título'),
            ),
            // Data cell
            createElement(
                'div',
                { className: 'col-span-1 grid' },
                createElement(HeaderRowCell, { label: 'Código del Documento', value: h.documentNumber }),
                createElement('div', { className: 'grid grid-cols-2' },
                    createElement(HeaderRowCell, { label: 'Revisión', value: h.revisionLevel }),
                    createElement(HeaderRowCell, { label: 'Fecha', value: h.revisionDate }),
                ),
                createElement('div', { className: 'grid grid-cols-2' },
                    createElement(HeaderRowCell, { label: 'Elaborado', value: h.preparedBy }),
                    createElement(HeaderRowCell, { label: 'Aprobado', value: h.approvedBy }),
                ),
                createElement('div', { className: 'grid grid-cols-2' },
                    createElement(HeaderRowCell, { label: 'Cliente', value: h.customerName }),
                    createElement(HeaderRowCell, { label: 'Pieza', value: h.partNumber }),
                ),
            ),
        ),
    );
};

const HeaderRowCell = ({ label, value }: { label: string; value: string }) =>
    createElement(
        'div',
        { className: 'border-b-[1.5px] border-[#60A5FA] p-2 text-center' },
        createElement('div', { className: 'text-[8px] uppercase text-[#9ca3af] font-bold' }, label),
        createElement('div', { className: 'text-[10px] font-bold text-[#1f2937]' }, value || '-'),
    );

const ZipExportRoot = ({ doc, logoBase64 }: ZipFlowExportProps) => {
    const zipFlow = pfdStepsToZipFlow(doc.steps);
    const rightPad = getRightPadding(zipFlow);
    const bottomPad = getBottomPadding(zipFlow);

    return createElement(
        'div',
        { className: 'min-h-screen bg-[#F3F4F6] font-sans relative p-4', style: { fontFamily: 'Inter, Arial, Helvetica, sans-serif' } },
        createElement(
            'div',
            { className: 'mx-auto', style: { maxWidth: 1400 } },
            createElement(ZipExportHeader, { doc, logoBase64 }),
            createElement(
                'main',
                { className: 'w-full bg-white border-[1.5px] border-[#60A5FA] shadow-sm pt-10 pb-16 rounded-lg overflow-visible' },
                createElement(
                    'div',
                    {
                        className: 'min-w-fit pl-12 mx-auto',
                        style: { paddingRight: `${rightPad}px`, paddingBottom: `${bottomPad}px` },
                    },
                    createElement(FlowSequence, {
                        sequence: zipFlow,
                        ctx: {
                            selectedSrcId: null,
                            onSelect: () => {/* export: noop */},
                            readOnly: true,
                        },
                    }),
                ),
            ),
        ),
    );
};

export function buildZipFlowHtml(doc: PfdDocument, logoBase64 = ''): string {
    if (doc.steps.length === 0) {
        return `<!DOCTYPE html><html><body style="font-family: Inter, sans-serif; padding: 2rem; color: #9ca3af; text-align: center;">Sin pasos definidos en este flujograma.</body></html>`;
    }

    const markup = renderToStaticMarkup(createElement(ZipExportRoot, { doc, logoBase64 }));

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Diagrama de Flujo de Proceso — ${doc.header.partName || 'PFD'}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;900&display=swap" rel="stylesheet">
<style>${FLOW_CSS}\n${ZIP_FLOW_EXPORT_CSS}</style>
</head>
<body>
${markup}
</body>
</html>`;
}
