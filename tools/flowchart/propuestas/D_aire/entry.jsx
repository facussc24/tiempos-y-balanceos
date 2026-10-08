/**
 * Punto de entrada del render headless de la propuesta D. Monta una <Flowchart> (una hoja A3) por cada
 * elemento de `window.__FC__.pages` y avisa cuando el layout ya se estabilizo.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import Flowchart from './Flowchart.jsx';

const datos = window.__FC__ || {};

function App() {
    React.useEffect(() => {
        // Dos frames + un tick: el primero pinta, el segundo deja que flexbox reacomode.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            setTimeout(() => { window.__FC_LISTO__ = true; }, 150);
        }));
    }, []);
    return (
        <>
            {(datos.pages || []).map((pg) => (
                <Flowchart
                    key={pg.no}
                    header={datos.header || {}}
                    products={datos.products || []}
                    flow={pg.flow}
                    revisions={datos.revisions || []}
                    showLegend={datos.showLegend !== false}
                    logoUrl={datos.logoUrl || null}
                    pg={{ no: pg.no, total: pg.total, first: pg.first, last: pg.last, startNid: pg.startNid, w: pg.w, h: pg.h, c: pg.c }}
                />
            ))}
        </>
    );
}

createRoot(document.getElementById('root')).render(<App />);
