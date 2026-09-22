/**
 * flujogramaCanon.mjs — las convenciones de la casa, ejecutables.
 *
 * POR QUE EXISTE. El 22/09/2026 Fak reviso el flujograma 159 y marco ocho cosas. Siete de
 * ellas ya estaban escritas en la skill `flujogramas`, algunas con su frase textual del
 * 08/09/2026 ("dentro del mismo sector intentemos mantenernos en el mismo decimal"). O sea
 * que el canon existia y yo no lo abri. Fak: *"no solo quiero que lo corrijas, quiero que no
 * vuelvan a suceder la proxima vez que haga flujogramas"*.
 *
 * Un canon en prosa depende de que yo me acuerde de leerlo. Este archivo lo vuelve un
 * chequeo que corre solo desde `_flujograma.mjs`, antes de renderizar.
 *
 * Las reglas salen de RELEVAR EL CORPUS, no de mi criterio: 56 flujogramas vigentes del
 * servidor + los 8 datos del generador, contados el 22/09/2026. Donde el corpus esta partido,
 * el chequeo avisa en vez de bloquear, y dice el conteo.
 */

/** Sube al numero de sector: '21' -> 20, '90.2' -> 90. */
export const decena = (stepId) => Math.floor(parseFloat(stepId) / 10) * 10;

/** Recorre el arbol de nodos en orden de lectura, entrando a ramas y a secuencias. */
export function* recorrer(nodos, dentroDeRama = false) {
    for (const n of nodos ?? []) {
        yield { nodo: n, dentroDeRama };
        const bs = n.branchSide;
        if (bs && Array.isArray(bs.sequence)) yield* recorrer(bs.sequence, true);
        for (const b of n.branches ?? []) yield* recorrer(b, true);
    }
}

/** Los nodos de una sola columna, en orden, sin entrar a las ramas laterales. */
const columna = (nodos) => [...recorrer(nodos)].filter((x) => !x.dentroDeRama).map((x) => x.nodo);

const TERMINALES_CANONICOS = ['SCRAP', 'RECLAMO DE CALIDAD AL PROVEEDOR', 'PLAN DE REACCION / SCRAP'];
/**
 * Un nodo es de control si lo dice su nombre, en cualquier posicion: en el corpus hay
 * "CONTROL CON MYLAR" pero tambien "RECEPCION Y CONTROL DE MATERIA PRIMA" y "CONTROL FINAL DE
 * CALIDAD Y PRUEBAS FUNCIONALES". Exigir que empiece con la palabra marcaba en rojo a los
 * hermanos que estan bien.
 * El MURO DE CALIDAD tambien es un control aunque no lleve ninguna de las dos palabras: el
 * 22/09/2026 el 159 dibujo el que exige la carta de nominacion de SMRC y el gate lo marco como
 * "operacion + inspeccion sobre una transformacion". Falso rojo del gate, no del flujograma.
 */
const esControl = (t) => /\b(CONTROL|INSPECCI[OÓ]N|MURO DE CALIDAD)\b/i.test(String(t ?? ''));
/**
 * Un traslado o un almacenado NUNCA es un control, aunque su texto nombre el sector al que
 * lleva: "TRASLADO AL SECTOR DE INSPECCION FINAL" tiene la palabra y no es un puesto.
 */
const NO_SON_PUESTOS = new Set(['transfer', 'storage', 'condition', 'terminal', 'connector']);
const esNodoDeControl = (n) => !NO_SON_PUESTOS.has(n.type) && esControl(n.description);

/**
 * Revisa un flujograma contra el canon. Devuelve una lista de hallazgos; cada uno dice
 * QUE renglon lo motiva, porque un control que frena sin decir cual nodo no sirve.
 */
export function revisarFlujograma(doc) {
    const hallazgos = [];
    const rojo = (regla, detalle) => hallazgos.push({ gravedad: 'ROJO', regla, detalle });
    const aviso = (regla, detalle) => hallazgos.push({ gravedad: 'AVISO', regla, detalle });

    const todos = [...recorrer(doc.flow)].map((x) => x.nodo);
    const conNumero = todos.filter((n) => n.stepId);

    // 1. Ningun numero repetido, ni entre ramas paralelas.
    const cuenta = new Map();
    for (const n of conNumero) cuenta.set(n.stepId, (cuenta.get(n.stepId) ?? 0) + 1);
    for (const [id, c] of cuenta) {
        if (c > 1) rojo('numero-repetido', `la OP ${id} aparece ${c} veces`);
    }

    // 2. Un decimal exige su operacion madre. Los 3 precedentes del corpus la tienen; el 159
    //    Rev.A tenia 90.1 y 90.2 sin que existiera una 90.
    for (const n of conNumero) {
        if (!n.stepId.includes('.')) continue;
        const madre = n.stepId.split('.')[0];
        if (!cuenta.has(madre)) {
            rojo('decimal-sin-madre', `${n.stepId} "${n.description}" no tiene la operacion ${madre}`);
        }
    }

    // 3. Una decena por SECTOR. Fak, 08/09/2026: "dentro del mismo sector intentemos
    //    mantenernos en el mismo decimal", y 22/09/2026: "si esta dentro del mismo sector pone
    //    limpieza y luego aplicacion" (60 y 61).
    //
    //    La mitad VERIFICABLE es esta: si hay un TRASLADO, se cruzo de sector, asi que la
    //    decena TIENE que cambiar. Al reves no vale — el corpus cambia de decena sin traslado
    //    cuando dos puestos del mismo sector son cosas distintas (en el 153, que es el modelo
    //    de esta familia, 30 REFILADO y 40 COSTURA UNION van seguidos sin traslado). La
    //    primera version de este chequeo exigia lo contrario y marcaba en rojo a los 8
    //    hermanos, incluido el que se uso de modelo: un gate que marca todo no lo mira nadie.
    for (const rama of [columna(doc.flow), ...(doc.flow ?? []).flatMap((n) => (n.branches ?? []).map(columna))]) {
        let previa = null;
        let huboTraslado = false;
        for (const n of rama) {
            if (n.type === 'transfer') { huboTraslado = true; continue; }
            if (!n.stepId) continue;
            if (previa && huboTraslado && decena(n.stepId) === decena(previa.stepId)) {
                rojo('traslado-sin-cambiar-de-decena',
                    `entre ${previa.stepId} "${previa.description}" y ${n.stepId} "${n.description}" hay un traslado (se cruza de sector) y la decena no cambia`);
            }
            previa = n;
            huboTraslado = false;
        }
    }

    // 4. OP + INSPECCION solo sobre CONTROLES. Medido el 22/09/2026: 18 de 18 op-ins de los
    //    7 hermanos del generador son nodos de control; el 159 Rev.A tenia 11 y ninguno lo era.
    for (const n of todos) {
        if (n.type === 'op-ins' && !esNodoDeControl(n)) {
            rojo('opins-sobre-transformacion',
                `${n.stepId ?? '(sin nº)'} "${n.description}" lleva operacion+inspeccion sin ser un control`);
        }
        // Y el simbolo tiene que USARSE si esta declarado en la leyenda: una referencia que no
        // referencia nada es lo que tenia el 159 Rev.A al reves.
        if (esNodoDeControl(n) && n.type === 'operation') {
            aviso('control-sin-simbolo',
                `${n.stepId ?? '(sin nº)'} "${n.description}" es un control y va con elipse simple`);
        }
    }

    // 5. Todo control lleva numero, y el numero es el de SU sector. La unica excepcion del
    //    corpus (≈50 de 56) es INSPECCION DE MATERIA PRIMA, que va sin numero.
    for (const n of todos) {
        if (!esNodoDeControl(n)) continue;
        if (/MATERIA PRIMA/i.test(n.description)) continue;
        if (!n.stepId) rojo('control-sin-numero', `"${n.description}" es un control y no tiene numero`);
    }

    // 6. El rombo de conformidad cuelga de un CONTROL. Fak, 22/09/2026: "no hay puesto de
    //    control en costura asi que el 'costura conforme' ahi no iria, iria en corte".
    //    Medido: 102 de 154 rombos resueltos del corpus cuelgan de un control.
    for (const rama of [columna(doc.flow), ...(doc.flow ?? []).flatMap((n) => (n.branches ?? []).map(columna))]) {
        rama.forEach((n, i) => {
            if (n.type !== 'condition') return;
            if (!/CONFORME|\bOK\b/i.test(n.labelCondition ?? '')) return;
            const anterior = rama[i - 1];
            if (!anterior) return;
            const cuelgaDeUnControl = anterior.type === 'op-ins' || anterior.type === 'inspection'
                || esNodoDeControl(anterior);
            if (!cuelgaDeUnControl) {
                rojo('rombo-sin-control',
                    `"${n.labelCondition}" cuelga de ${anterior.stepId ?? ''} "${anterior.description}", que no es un puesto de control`);
            }
        });
    }

    // 7. Las cajas terminales se llaman como el corpus las llama, y NUNCA llevan el retrabajo
    //    escrito adentro: un retrabajo escrito en una caja terminal es un retrabajo que no se
    //    dibujo. 51 de los terminales del corpus dicen solo SCRAP.
    for (const n of todos) {
        const bs = n.branchSide;
        if (!bs || bs.type !== 'terminal') continue;
        const t = String(bs.text ?? '').trim().toUpperCase();
        if (/RETRABAJO|REPROCESO/.test(t)) {
            rojo('retrabajo-en-terminal',
                `la caja terminal dice "${bs.text}": el retrabajo se DIBUJA (¿SE PUEDE RETRABAJAR? -> reproceso numerado -> re-entrada), no se escribe adentro de un terminal`);
        } else if (!TERMINALES_CANONICOS.includes(t)) {
            aviso('terminal-fuera-del-canon',
                `la caja terminal dice "${bs.text}"; el corpus usa ${TERMINALES_CANONICOS.join(' / ')}`);
        }
    }

    // 8. Todo conector de salida tiene su par. El 159 Rev.A tenia un "B - AL ADHESIVADO" que
    //    no aterrizaba en ningun lado: un camino dibujado que no llega a ninguna parte.
    const salidas = [];
    const entradas = [];
    for (const n of todos) {
        if (n.type === 'connector') salidas.push(n.text);
        if (n.branchSide?.type === 'connector') salidas.push(n.branchSide.text);
        // La entrada se declara con `incomingConnector` (asi lo hacen el 153, el 154 y el 157)
        // o escribiendo "VIENE DE (X)" en el texto del nodo.
        if (n.incomingConnector) entradas.push(String(n.incomingConnector).toUpperCase());
        const m = /VIENE DE \(?([A-Z])\)?/i.exec(String(n.description ?? ''));
        if (m) entradas.push(m[1].toUpperCase());
    }
    for (const s of salidas) {
        if (s && !entradas.includes(String(s).toUpperCase())) {
            rojo('conector-huerfano', `el conector "${s}" sale y no entra en ningun lado`);
        }
    }

    // 9. Cada traslado nombra su sector destino (231 de 342 etiquetas del corpus lo hacen).
    for (const n of todos) {
        if (n.type !== 'transfer') continue;
        if (n.rework) continue;   // la re-entrada al flujo tiene su propio rotulo
        if (!/\b(SECTOR|ZONA|ESTACI[OÓ]N|ALMAC[EÉ]N|DEP[OÓ]SITO|PROCESO) DE\b|\bA (SECTOR|ALMAC[EÉ]N)\b/i.test(n.description ?? '')) {
            aviso('traslado-sin-destino', `"${n.description}" no nombra el sector destino`);
        }
    }

    // 10. Los nombres van en SUSTANTIVO, no en infinitivo: 267 de 270 etiquetas del corpus.
    //     Ojo, es lo CONTRARIO de la regla de hojas de proceso, que pide infinitivo.
    for (const n of conNumero) {
        const primera = String(n.description ?? '').trim().split(/\s+/)[0] ?? '';
        if (/^[A-ZÁÉÍÓÚÑ]{4,}(AR|ER|IR)$/.test(primera)) {
            aviso('nombre-en-infinitivo',
                `${n.stepId} "${n.description}" arranca con un infinitivo; el corpus usa sustantivo (CORTE DE VINILO, no CORTAR EL VINILO)`);
        }
    }

    // 11. La cabecera y el pie completos.
    const h = doc.header ?? {};
    for (const campo of ['title', 'documentCode', 'revision', 'date', 'preparedBy', 'reviewedBy', 'client']) {
        if (!String(h[campo] ?? '').trim()) rojo('cabecera-incompleta', `falta header.${campo}`);
    }
    if (!Array.isArray(doc.products) || doc.products.length === 0) {
        rojo('sin-codigos', 'falta el bloque de codigos de producto terminado');
    }
    if (!Array.isArray(doc.revisions) || doc.revisions.length === 0) {
        rojo('sin-historial', 'falta el historial de revisiones');
    }

    // 12. Cada sigla que se dibuja esta declarada en la leyenda.
    const declaradas = new Set((h.specialChars ?? []).map((s) => String(s.mark).toLowerCase()));
    for (const n of todos) {
        for (const sigla of String(n.criticalType ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
            if (!declaradas.has(sigla.toLowerCase())) {
                rojo('sigla-sin-leyenda', `${n.stepId ?? ''} lleva "${sigla}" y la leyenda no la declara`);
            }
        }
    }

    return hallazgos;
}

export const hayRojos = (hallazgos) => hallazgos.some((h) => h.gravedad === 'ROJO');
