/**
 * Punto de entrada del render headless. Monta <Flowchart> con los datos que el script
 * de Playwright deja en `window.__FC__`, y avisa cuando el layout ya se estabilizo.
 *
 * El aviso importa: el motor deja que FLEXBOX resuelva anchos y alturas, asi que la
 * captura tiene que esperar a que el navegador termine de acomodar. Sin eso, el PNG sale
 * con las ramas laterales cortadas.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import Flowchart from './Flowchart.jsx';

const datos = window.__FC__ || {};

function App() {
    React.useEffect(() => {
        // Dos frames + un tick: el primero pinta, el segundo deja que flexbox reacomode.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            setTimeout(() => { window.__FC_LISTO__ = true; }, 120);
        }));
    }, []);
    return (
        <Flowchart
            header={datos.header || {}}
            products={datos.products || []}
            flow={datos.flow || []}
            revisions={datos.revisions || []}
            showLegend={datos.showLegend !== false}
            logoUrl={datos.logoUrl || null}
        />
    );
}

createRoot(document.getElementById('root')).render(<App />);
