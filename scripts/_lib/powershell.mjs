/**
 * powershell.mjs — correr PowerShell desde Node SIN que se corrompa el comando.
 *
 * POR QUE EXISTE (14/08/2026): de los 20 minutos que tardo pasar dos archivos al pendrive,
 * CUATRO se fueron en comandos de PowerShell que se rompian. Mandados inline desde bash, el
 * `$_` de un `Where-Object` se expande antes de llegar a PowerShell y los backslashes de las
 * rutas de Windows se colapsan. El sintoma es peor que un error: a veces el comando corre y
 * devuelve otra cosa.
 *
 * La solucion ya estaba usada en el repo (`_syncMailsDiario.ps1`, `_extraerSgc.ps1`): se
 * escribe el script a un archivo .ps1 y se ejecuta el ARCHIVO. Aca queda cableado para no
 * volver a improvisarlo.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Corre un bloque de PowerShell y devuelve su stdout.
 * El script va a un .ps1 temporal: nunca inline, por eso no hay nada que escapar.
 */
export function psRun(script, { timeout = 30000 } = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'psrun-'));
    const tmp = path.join(dir, 'run.ps1');
    try {
        // BOM UTF-8: sin el, PowerShell 5.1 lee los acentos de las rutas como mojibake.
        fs.writeFileSync(tmp, `﻿${script}`, 'utf8');
        return execFileSync('powershell.exe',
            ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tmp],
            { encoding: 'utf8', timeout, windowsHide: true });
    } finally {
        // Se borra EXACTAMENTE lo que se creo, nombre por nombre. Nada recursivo sobre una
        // variable: ese es el patron que el 07/08/2026 se llevo puestos 942 archivos.
        try { fs.unlinkSync(tmp); } catch { /* ya no estaba */ }
        try { fs.rmdirSync(dir); } catch { /* si quedo algo adentro, se deja y se ve */ }
    }
}

/** Corre PowerShell y parsea su salida JSON. `[]` si no devolvio nada. */
export function psJson(script, opciones) {
    // ConvertTo-Json colapsa un array de UN elemento a objeto suelto: el @() lo vuelve array.
    const out = psRun(`@(${script}) | ConvertTo-Json -Depth 4 -Compress`, opciones).trim();
    if (!out) return [];
    const v = JSON.parse(out);
    return Array.isArray(v) ? v : [v];
}

/**
 * Las unidades extraibles conectadas. Hasta hoy la unica "deteccion" del repo era la letra
 * `D:` escrita a mano en el header de `_exportAmfeAmarok.ts` — y la letra cambia.
 * Devuelve [{ letra: 'D:', etiqueta: 'MI PENDRIVE', libreGB, totalGB }].
 */
export function unidadesExtraibles() {
    const filas = psJson(
        "Get-Volume | Where-Object { $_.DriveType -eq 'Removable' -and $_.DriveLetter } "
        + '| Select-Object DriveLetter, FileSystemLabel, SizeRemaining, Size');
    return filas.map((v) => ({
        letra: `${v.DriveLetter}:`,
        etiqueta: String(v.FileSystemLabel ?? '').trim() || '(sin etiqueta)',
        libreGB: Number(v.SizeRemaining ?? 0) / 1073741824,
        totalGB: Number(v.Size ?? 0) / 1073741824,
    }));
}
