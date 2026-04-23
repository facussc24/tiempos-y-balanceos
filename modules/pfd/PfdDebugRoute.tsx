/**
 * PfdDebugRoute — ruta standalone para debug visual del PFD export.
 *
 * URL: /?module=pfdDebug&id=<docId>
 *
 * Renderiza el PFD en el mismo path que el export PDF (convertPfdToFlowData ->
 * PfdFlowChart -> flowStyles CSS pre-compilado), sin UI de app alrededor.
 * Permite que Fak o Claude via preview_screenshot valide el layout sin tener
 * que exportar a PDF cada vez.
 *
 * Query params:
 *   - id: UUID del pfd_document (obligatorio)
 *   - no-header: oculta el header del PFD (solo el flow)
 *
 * Atajo al PFD IP PAD: /?module=pfdDebug&id=pfd-ippads-trim-asm-upr-wrapping
 */

import React, { useEffect, useState } from 'react';
import type { PfdDocument } from './pfdTypes';
import { loadPfdDocument } from '../../utils/repositories/pfdRepository';
import { convertPfdToFlowData } from './pfdToFlowData';
import { PfdFlowChart } from './flow/PfdFlowChart';
import { FLOW_CSS } from './flowStyles';
import { getLogoBase64 } from '../../src/assets/ppe/ppeBase64';

const PfdDebugRoute: React.FC = () => {
  const [doc, setDoc] = useState<PfdDocument | null>(null);
  const [logoBase64, setLogoBase64] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const params = new URLSearchParams(window.location.search);
  const docId = params.get('id') || 'pfd-ippads-trim-asm-upr-wrapping';
  const skipHeader = params.get('no-header') === '1';

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const [pfd, logo] = await Promise.all([
          loadPfdDocument(docId),
          getLogoBase64(),
        ]);
        if (cancel) return;
        if (!pfd) {
          setError(`PFD con id="${docId}" no encontrado`);
          setLoading(false);
          return;
        }
        setDoc(pfd);
        setLogoBase64(logo);
        setLoading(false);
      } catch (e: any) {
        if (cancel) return;
        setError(e?.message || String(e));
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [docId]);

  // Inyectar el CSS pre-compilado del export en la pagina (igual que el HTML
  // export standalone). Asi el preview luce identico al PDF.
  useEffect(() => {
    const styleId = 'pfd-debug-styles';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = FLOW_CSS;
    document.head.appendChild(style);
    return () => {
      const existing = document.getElementById(styleId);
      if (existing) existing.remove();
    };
  }, []);

  if (loading) {
    return <div style={{ padding: 20, fontFamily: 'sans-serif' }}>Cargando PFD {docId}...</div>;
  }
  if (error) {
    return (
      <div style={{ padding: 20, fontFamily: 'sans-serif', color: 'red' }}>
        <strong>Error:</strong> {error}
        <br />
        <small>URL: ?module=pfdDebug&amp;id=&lt;pfd_document_id&gt;</small>
      </div>
    );
  }
  if (!doc) return null;

  const flowData = convertPfdToFlowData(doc, logoBase64);
  if (skipHeader) flowData.skipNotes = true;

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: 'white', overflow: 'visible' }}>
      <div style={{ padding: '8px 16px', background: '#F3F4F6', borderBottom: '1px solid #E5E7EB', fontFamily: 'sans-serif', fontSize: 12, color: '#4B5563' }}>
        <strong>PFD Debug</strong> — id: <code>{docId}</code> — steps: {doc.steps.length} — {' '}
        <a href="#" onClick={(e) => { e.preventDefault(); window.history.back(); }}>Volver</a>
      </div>
      <div style={{ padding: 16 }}>
        <PfdFlowChart data={flowData} />
      </div>
    </div>
  );
};

export default PfdDebugRoute;
