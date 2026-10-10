/**
 * _datosSincronizar.mjs — ETAPA 1 de P55: mantiene al dia la copia de Supabase en la biblioteca de Ingenieria
 * (`...\INGENIERIA BARACK (NUNCA BORRAR)\1- GENERAL\AMFE\DATOS`), en la direccion Supabase -> archivos.
 *
 * Uso:
 *   node scripts/_datosSincronizar.mjs                  dry-run (por defecto, igual que --simular): que haria, sin escribir nada
 *   node scripts/_datosSincronizar.mjs --aplicar        escribe los archivos que cambiaron en Supabase
 *   node scripts/_datosSincronizar.mjs --verificar      relee Supabase y compara contra los archivos (y lista pendientes)
 *   node scripts/_datosSincronizar.mjs --pendientes     lo que quedo sin resolver en esta PC (no va a la red)
 *   ... --aceptar-supabase <tabla/id.json>              para ESE archivo vale lo de Supabase (lo decide una persona; se puede repetir)
 *   ... --out <carpeta>   otra carpeta        --estado <archivo>   otra base local        --json   una linea JSON al final
 *
 * Que NO hace: no escribe en Supabase (solo `select` y el RPC de lectura), no borra nada, no pisa un archivo
 * que cambio en la nube (lo deja anotado como pendiente) y no sube nada de la nube a Supabase (eso esta
 * apagado en `_lib/datosNubeSubir.mjs` y espera el si de Fak). La logica y los candados: `_lib/datosNube.mjs`.
 *
 * Lo corren: la noche (`_nocturno.mjs`, paso `datos`, como proceso aparte) y quien cierra una sesion que
 * escribio en Supabase (`_cierreSesion.mjs` lo pide).
 *
 * Sale con 0 limpio · 1 abortado, con pendientes o con diferencias · 2 argumento que no conoce.
 */
import { existsSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectSupabase } from './_lib/amfeIo.mjs';
import { carpetaNube, verificar } from './_datosExportar.mjs';
import { sincronizar, corridaLimpia, leerEstado, rutaEstadoPorDefecto, textoPendiente } from './_lib/datosNube.mjs';

const SIN_VALOR = ['--simular', '--aplicar', '--verificar', '--pendientes', '--json'];
const CON_VALOR = ['--out', '--estado', '--aceptar-supabase'];
const USO = 'uso: node scripts/_datosSincronizar.mjs [--simular | --aplicar | --verificar | --pendientes] [--aceptar-supabase <tabla/id.json>]... [--out <carpeta>] [--estado <archivo>] [--json]';

/** Un argumento que no conozco frena: esto escribe en la carpeta de Ingenieria. */
export function leerArgumentos(argv) {
    const op = { aceptar: [] };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (SIN_VALOR.includes(a)) { op[a.slice(2)] = true; continue; }
        if (CON_VALOR.includes(a) && i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
            const v = argv[++i];
            if (a === '--aceptar-supabase') op.aceptar.push(v); else op[a.slice(2)] = v;
            continue;
        }
        return { error: `no conozco el argumento ${a} (o le falta el valor). No hago nada.` };
    }
    const modos = ['simular', 'aplicar', 'verificar', 'pendientes'].filter((m) => op[m]);
    if (modos.length > 1) return { error: `--${modos.join(' y --')} no van juntos. No hago nada.` };
    if (op.aceptar.length && !op.aplicar) return { error: '--aceptar-supabase solo vale con --aplicar. No hago nada.' };
    return { op };
}

/** De los problemas de `verificar` (etapa 0), aparta los que solo dicen "N sobrantes". */
export function separarSobrantes(problemas) {
    const esSobrante = (p) => /^[a-z_0-9]+: \d+ sobrantes$/.test(p);
    return { problemas: problemas.filter((p) => !esSobrante(p)), sobrantes: problemas.filter(esSobrante) };
}

function listar(titulo, filas, a) {
    if (!filas.length) return;
    console.log(`\n${titulo} (${filas.length}):`);
    filas.slice(0, 40).forEach((f) => console.log(`    ${a(f)}`));
    if (filas.length > 40) console.log(`    ... y ${filas.length - 40} mas`);
}

function imprimir(r) {
    const verbo = r.aplicar ? ['creados', 'actualizados'] : ['se crearian', 'se actualizarian'];
    listar(`Archivos ${verbo[0]}`, r.creados, (x) => x);
    listar(`Archivos ${verbo[1]} (cambio Supabase)`, r.actualizados, (x) => x);
    listar('PENDIENTES — no se escribieron', r.pendientes, (p) => `${p.ruta}: ${p.detalle}`);
    listar('FALLARON', r.fallidos, (p) => `${p.ruta}: ${p.detalle}`);
    listar('Sobrantes — archivo sin fila en Supabase (no se borra nada)', r.sobrantes, (x) => x);
}

export function lineaResumen(r) {
    if (r.abortado) return `ABORTADO: ${r.abortado}`;
    const n = r.creados.length + r.actualizados.length;
    const partes = [`${r.totalFilas} filas en ${r.tablas} tablas`, `${n} archivo(s) ${r.aplicar ? 'escritos' : 'por escribir'}`, `${r.iguales} sin cambios`];
    if (r.pendientes.length) partes.push(`${r.pendientes.length} PENDIENTE(S) sin pisar`);
    if (r.fallidos.length) partes.push(`${r.fallidos.length} FALLARON`);
    if (r.sobrantes.length) partes.push(`${r.sobrantes.length} sobrante(s)`);
    return partes.join(' · ');
}

async function main(argv) {
    const { op, error } = leerArgumentos(argv);
    if (error) { console.error(`${error}\n${USO}`); return 2; }
    const destino = op.out ?? carpetaNube();
    const dir = destino ? resolve(destino) : null;
    const rutaEstado = op.estado ? resolve(op.estado) : (dir ? rutaEstadoPorDefecto(dir) : null);
    const salir = (codigo, json) => { if (op.json) console.log(JSON.stringify(json)); return codigo; };

    if (!dir) {
        const motivo = 'no encuentro la biblioteca de Ingenieria en esta PC (BARACK ARGENTINA SRL\\Ingenieria y Proyecto - General). Los datos van a la nube, no a una carpeta local: abrir OneDrive y esperar que sincronice, o pasar la carpeta con --out';
        console.error(`\n✗ ABORTADO — ${motivo}\n`);
        return salir(1, { ok: false, abortado: motivo });
    }
    const raizRepo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    // en minusculas: en Windows `c:\dev\barackmercosul` y `C:\Dev\BarackMercosul` son la misma carpeta
    if (dir.toLowerCase() === raizRepo.toLowerCase() || dir.toLowerCase().startsWith((raizRepo + sep).toLowerCase())) {
        console.error(`\n✗ ABORTADO — la carpeta destino (${dir}) esta adentro del repo de la app.\n`);
        return salir(1, { ok: false, abortado: 'destino adentro del repo' });
    }

    if (op.pendientes) {
        const estado = leerEstado(rutaEstado, dir);
        const filas = Object.entries(estado.pendientes);
        console.log(`  carpeta: ${dir}\n  ultima sincronizacion de esta PC: ${estado.ultimaCorrida ?? 'nunca'}`);
        listar('Pendientes', filas, ([ruta, p]) => `${ruta}: ${textoPendiente(p.tipo)} (desde ${p.desde})`);
        if (!filas.length) console.log('  sin pendientes');
        return salir(filas.length ? 1 : 0, { ok: !filas.length, pendientes: filas.length });
    }

    let sb;
    try { sb = await connectSupabase(); } catch (e) {
        console.error(`\n✗ ABORTADO — ${e.message}\n`);
        return salir(1, { ok: false, abortado: `sin conexion a Supabase: ${String(e.message).split('\n')[0]}` });
    }
    console.log(`  auth OK (solo lectura)\n  carpeta: ${dir}`);
    const t0 = Date.now();

    if (op.verificar) {
        if (!existsSync(dir)) { console.error('\n✗ la carpeta no existe todavia\n'); return salir(1, { ok: false, abortado: 'la carpeta no existe' }); }
        const v = await verificar({ sb, dir });
        // Un archivo sin fila en Supabase (un documento o un borrador que se borro en la app) queda en la
        // carpeta a proposito: nunca se borra. La etapa 0 lo cuenta como diferencia; aca se lista aparte.
        const { problemas, sobrantes } = separarSobrantes(v.problemas);
        if (sobrantes.length) console.log(`\nSobrantes (archivo sin fila en Supabase; no se borra nada): ${sobrantes.join(' · ')}`);
        const pendientes = Object.entries(leerEstado(rutaEstado, dir).pendientes);
        listar('Pendientes de esta PC', pendientes, ([ruta, p]) => `${ruta}: ${textoPendiente(p.tipo)}`);
        const seg = ((Date.now() - t0) / 1000).toFixed(1);
        if (problemas.length || pendientes.length) {
            console.error(`\n✗ VERIFICACION CON DIFERENCIAS (${problemas.length}) Y ${pendientes.length} PENDIENTE(S):`);
            problemas.forEach((p) => console.error(`    - ${p}`));
            console.error(`  (${seg} s)\n`);
            return salir(1, { ok: false, problemas: problemas.length, pendientes: pendientes.length });
        }
        console.log(`\n✓ Verificado: todo lo vivo esta en los archivos, sin diferencias, sobrantes ni pendientes (${seg} s)`);
        return salir(0, { ok: true });
    }

    const r = await sincronizar({ sb, dir, rutaEstado, aplicar: !!op.aplicar, aceptar: op.aceptar, log: console.log });
    const seg = ((Date.now() - t0) / 1000).toFixed(1);
    const linea = lineaResumen(r);
    const json = { ok: corridaLimpia(r), aplicar: r.aplicar, linea, abortado: r.abortado, totalFilas: r.totalFilas, escritos: r.aplicar ? r.creados.length + r.actualizados.length : 0, porEscribir: r.creados.length + r.actualizados.length, iguales: r.iguales, pendientes: r.pendientes.length, fallidos: r.fallidos.length, sobrantes: r.sobrantes.length };
    if (r.abortado) {
        console.error(`\n✗ ABORTADO, no se toco nada — ${r.abortado}\n`);
        return salir(1, json);
    }
    imprimir(r);
    console.log(`\n${r.aplicar ? 'Sincronizado' : 'DRY-RUN (no se escribio nada)'}: ${linea} (${seg} s)`);
    if (!r.aplicar && (r.creados.length || r.actualizados.length)) console.log('Para escribirlo: node scripts/_datosSincronizar.mjs --aplicar');
    if (r.aplicar && corridaLimpia(r)) console.log('✓ Sin pendientes. Para comprobarlo contra Supabase: node scripts/_datosSincronizar.mjs --verificar');
    return salir(corridaLimpia(r) ? 0 : 1, json);
}

// Solo corre como script; importado (por el test) no hace nada.
const comoScript = process.argv[1]
    && resolve(process.argv[1]).toLowerCase() === resolve(fileURLToPath(import.meta.url)).toLowerCase();
if (comoScript) {
    main(process.argv.slice(2)).then((codigo) => { process.exitCode = codigo; }).catch((e) => {
        console.error(`\n✗ ABORTADO — ${e?.message ?? e}\n`);
        process.exitCode = 1;
    });
}
