/**
 * PFD HTML Export — Generates standalone HTML flowchart.
 * Replaces the old SVG export engine with React component rendering.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PfdDocument } from './pfdTypes';
import { sanitizeFilename } from '../../utils/filenameSanitization';
import { getLogoBase64 } from '../../src/assets/ppe/ppeBase64';
import { convertPfdToFlowData } from './pfdToFlowData';
import { PfdFlowChart } from './flow/PfdFlowChart';
import { wrapInStandaloneHtml } from './flowStyles';

export interface BuildPfdSvgOptions {
  skipNotes?: boolean;
}

const FONT = 'Inter,Arial,Helvetica,sans-serif';

export function buildPfdSvg(doc: PfdDocument, logoBase64 = '', options?: BuildPfdSvgOptions): string {
  if (doc.steps.length === 0) {
    // Return minimal SVG for empty document (backward compat with consumers that expect SVG)
    return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">
      <rect width="400" height="200" fill="white"/>
      <text x="200" y="100" font-size="12" fill="#9CA3AF" text-anchor="middle" font-family="${FONT}">Sin pasos definidos</text>
    </svg>`;
  }

  const flowData = convertPfdToFlowData(doc, logoBase64);
  if (options?.skipNotes) flowData.skipNotes = true;

  const markup = renderToStaticMarkup(createElement(PfdFlowChart, { data: flowData }));
  return wrapInStandaloneHtml(markup);
}

export async function exportPfdSvg(doc: PfdDocument): Promise<void> {
  const logoBase64 = await getLogoBase64();
  const htmlContent = buildPfdSvg(doc, logoBase64);

  const nameSource = doc.header.partName || doc.header.partNumber || doc.header.documentNumber || 'Documento';
  const safeName = sanitizeFilename(nameSource, { allowSpaces: true });
  const date = new Date().toISOString().split('T')[0];
  const filename = `PFD_${safeName}_${date}.html`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function generatePfdSvgBuffer(doc: PfdDocument): Promise<Uint8Array> {
  const logoBase64 = await getLogoBase64();
  const htmlContent = buildPfdSvg(doc, logoBase64);
  return new TextEncoder().encode(htmlContent);
}
