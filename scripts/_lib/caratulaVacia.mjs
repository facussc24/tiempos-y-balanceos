/**
 * caratulaVacia.mjs — la caratula de un AMFE exportado, mirada en el ARCHIVO que quedo escrito (tanda 12, 17/10/2026).
 *
 * POR QUE EXISTE: la skill `amfe-export-oficial` nacio del 25/06/2026 (AMFE 128/129 Amarok): se entrego un Excel con
 * la caratula VACIA y Fak: "asi no me podes entregar un AMFE". Desde entonces la lista de la skill dice "abrir el
 * .xlsx y mirar el bloque de identificacion", y ningun control lo hacia; y LECCIONES 03-08/09: "verificar el script
 * no es verificar el entregable: se abre el archivo que quedo en la carpeta". Esto mira el libro RELEIDO.
 *
 * Lee una hoja de SheetJS ({ 'A1': { v }, ... }): busca cada rotulo del bloque de identificacion (los de
 * `pairRow()` de modules/amfe/amfeCaratulaSheet.ts) y mira la celda de valor, dos columnas a la derecha.
 * Un rotulo que no esta en la hoja tambien cuenta: la caratula no es la del formulario I-AC-005.3.
 */

/** Los rotulos del bloque de identificacion. NIVEL DE CONFIDENCIALIDAD sale con '-' por defecto: no se mira. */
export const ROTULOS_CARATULA = [
    'NOMBRE DE LA ORGANIZACION', 'TEMA', 'N° DE AMFE',
    'LOCACION DE LA PLANTA', 'FECHA DE INICIO', 'RESPONSABLE DEL PROCESO',
    'NOMBRE DEL CLIENTE', 'FECHA DE REVISION', 'MODELO-AÑO PLATAFORMA', 'NIVEL DE REVISION',
];

const col = (n) => { let s = ''; for (let x = n + 1; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s; return s; };
const decodificar = (ref) => {
    const m = /^([A-Z]+)(\d+)$/.exec(ref);
    if (!m) return null;
    let c = 0;
    for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
    return { c: c - 1, r: Number(m[2]) };
};

/** [{ rotulo, celda, motivo }] de los rotulos sin valor o que no estan. Vacio = la caratula esta completa. */
export function rotulosVacios(hoja) {
    if (!hoja) return [{ rotulo: '(hoja Caratula)', celda: '-', motivo: 'el libro no tiene la hoja Caratula' }];
    const donde = new Map();
    for (const [ref, celda] of Object.entries(hoja)) {
        if (ref.startsWith('!')) continue;
        const texto = String(celda?.v ?? '').trim().toUpperCase();
        if (ROTULOS_CARATULA.includes(texto) && !donde.has(texto)) donde.set(texto, decodificar(ref));
    }
    const faltan = [];
    for (const rotulo of ROTULOS_CARATULA) {
        const p = donde.get(rotulo);
        if (!p) { faltan.push({ rotulo, celda: '-', motivo: 'el rotulo no esta en la caratula' }); continue; }
        const ref = `${col(p.c + 2)}${p.r}`;
        if (!String(hoja[ref]?.v ?? '').trim()) faltan.push({ rotulo, celda: ref, motivo: 'vacio' });
    }
    return faltan;
}
