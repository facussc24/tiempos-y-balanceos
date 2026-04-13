/**
 * simplifyTexts.mjs
 *
 * Simplifica textos rebuscados en TODOS los AMFE y CP de Supabase.
 * Reemplazos exactos: frase larga → frase corta.
 *
 * Uso:
 *   node scripts/simplifyTexts.mjs          # dry-run
 *   node scripts/simplifyTexts.mjs --apply   # aplica
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const APPLY = process.argv.includes('--apply');

// ── REPLACEMENTS: exact old → new ───────────────────────────────────────────
// Ordered longest first to avoid partial matches
const R = [
  // === FUNCIONES de WE (descriptions / functionDescriptions) ===
  ['Retirar el sistema de alimentacion sin dejar rebaba residual ni bebedero visible en el punto de inyeccion de la pieza', 'Cortar la colada sin dejar marca en la pieza'],
  ['Proveer superficie estable y bien iluminada para el control visual y dimensional de la pieza', 'Mesa de control con buena luz'],
  ['Secuencia de verificacion de la pieza: apariencia, dimensiones criticas, muestra maestra, liberacion o rechazo', 'Verificar pieza antes de liberar'],
  ['Proveer referencia visual al operador para identificar defectos tipicos (rebabas, quemaduras, chupados, rayas)', 'Referencia visual de defectos'],
  ['Proveer referencia visual al operador para identificar defectos tipicos', 'Referencia visual de defectos'],
  ['Proteger la pieza conforme inyectada hasta su traslado a la siguiente estacion y mantener trazabilidad de lote', 'Proteger pieza y mantener trazabilidad'],
  ['Proveer iluminacion adecuada para inspeccion visual de defectos superficiales (rebabas, quemaduras, color, rayas)', 'Iluminacion adecuada para inspeccion visual'],
  ['Proveer iluminacion adecuada para inspeccion visual de defectos superficiales', 'Iluminacion adecuada para inspeccion visual'],
  ['Proveer aire comprimido filtrado y seco para aspirador, sopletado de molde y venteo', 'Aire comprimido filtrado y seco'],
  ['Medir parametros del proceso y dimensiones de pieza con precision conforme al plan de control', 'Medir parametros y dimensiones segun plan de control'],
  ['Inspeccionar al 100% las piezas salientes de la inyectora, liberar o rechazar segun criterio del plan de control', 'Inspeccion 100% y liberacion de piezas'],
  ['Validar los parametros al arranque y verificar conformidad de la primera pieza antes de liberar la produccion', 'Verificar parametros y primera pieza al arranque'],
  ['Verificar cumplimiento de tolerancias criticas de la pieza segun plano o plan de control', 'Verificar tolerancias segun plano'],
  ['Formar la pieza con geometria correcta, linea de junta estanca, venteo adecuado y expulsion sin dano', 'Formar pieza con geometria correcta'],
  ['Mantener el pellet en estado solido en la garganta del tornillo hasta alcanzar la zona de plastificacion', 'Mantener pellet solido en la garganta del tornillo'],
  ['Tenir la pieza al color especificado por el cliente cuando se mezcla con el pellet base', 'Dar color a la pieza'],
  ['Proveer los parametros validados (temperatura por zona, presion, velocidad, tiempo, fuerza cierre) para cada producto', 'Parametros validados por producto'],
  ['Inyectar pieza plastica cumpliendo parametros de proceso (temperatura, presion, velocidad, fuerza de cierre, tiempo de ciclo)', 'Inyectar pieza segun parametros'],
  ['Inyectar pieza plastica cumpliendo parametros de proceso', 'Inyectar pieza segun parametros'],

  // === CAUSAS (descriptions / cause) ===
  ['Parametros de proceso desajustados / inestabilidad de la maquina de inyeccion', 'Parametros de proceso desajustados'],
  ['Parametros de proceso desajustados (presion de mantenimiento alta, temperatura alta)', 'Parametros de proceso desajustados'],
  ['Parametros de proceso desajustados (temperatura del fundido excesiva, velocidad alta)', 'Temperatura o velocidad excesiva'],
  ['Parametros de proceso desajustados (temperatura baja de fusion del colorante)', 'Temperatura baja para el colorante'],
  ['Parametros de proceso desajustados afectando contraccion de la pieza', 'Parametros desajustados (contraccion)'],
  ['Parametros de enfriamiento desajustados (tiempo o temperatura de molde)', 'Enfriamiento desajustado'],
  ['Parametros de dosificacion desajustados (volumen o velocidad de dosificacion)', 'Dosificacion desajustada'],
  ['Volumen de inyeccion demasiado bajo (dosificacion corta) respecto al tamano de pieza', 'Dosificacion corta'],
  ['Presion de inyeccion insuficiente durante el llenado', 'Presion de inyeccion insuficiente'],
  ['Fuerza de cierre insuficiente para el area proyectada de la pieza', 'Fuerza de cierre insuficiente'],
  ['Linea de junta del molde danada o desgastada permitiendo fuga de material', 'Linea de junta danada o desgastada'],
  ['Tiempo de compactacion (segunda presion) insuficiente', 'Tiempo de segunda presion insuficiente'],
  ['Presion de compactacion (segunda presion) baja', 'Segunda presion baja'],
  ['Tiempo de compactacion bajo respecto al espesor de la pieza', 'Tiempo de compactacion bajo'],
  ['Punto de inyeccion reducido causando caida de presion', 'Punto de inyeccion reducido'],
  ['Obstruccion o insuficiencia de venteo de aire en el molde (gases atrapados)', 'Venteo del molde obstruido'],
  ['Contraccion anormal por enfriamiento desigual del molde', 'Enfriamiento desigual del molde'],
  ['Equipo de refrigeracion del molde averiado (flujo o temperatura de agua fuera de rango)', 'Refrigeracion del molde averiada'],
  ['Mezcla residual con materia prima de la produccion anterior (purga del husillo incompleta)', 'Purga del husillo incompleta'],
  ['Falla de proveedor en el certificado del colorante (lote mezclado o contaminado)', 'Lote de colorante contaminado'],
  ['Dosificador de colorante desajustado o fuera de calibracion', 'Dosificador de colorante desajustado'],
  ['Desgaste natural por cantidad de golpes acumulados sin mantenimiento preventivo', 'Desgaste por golpes sin mantenimiento'],
  ['Procedimiento de soplado de canales al bajar molde no ejecutado (agua residual causa oxidacion)', 'Soplado de canales no ejecutado al bajar molde'],
  ['Falta de inspeccion periodica de expulsores en el plan de mantenimiento', 'Expulsores sin inspeccion periodica'],
  ['Procedimiento de limpieza de venteos al bajar molde no ejecutado', 'Limpieza de venteos no ejecutada'],
  ['Impacto durante cambio de molde o desgaste acumulado sin revision', 'Golpe o desgaste en cambio de molde'],
  ['Refrigeracion de garganta fallando (bomba de agua, obstruccion en circuito, perdida de caudal)', 'Refrigeracion de garganta fallando'],
  ['Flujo de agua insuficiente por filtro tapado en circuito de refrigeracion de garganta', 'Filtro de refrigeracion tapado'],
  ['Gestion documental del dossier sin control de revision', 'Dossier sin control de revision'],
  ['Checklist de arranque no utilizado o firmado sin verificacion real', 'Checklist de arranque no verificado'],
  ['Instruccion de trabajo de verificacion de primera pieza no disponible o poco clara en el puesto', 'Instruccion de primera pieza no disponible'],
  ['Instruccion de trabajo de autocontrol no visible o incompleta en el puesto', 'Instruccion de autocontrol no visible'],
  ['Instruccion de trabajo del procedimiento de control incompleta o no actualizada', 'Instruccion de control no actualizada'],
  ['Instruccion de trabajo del corte de colada incompleta o sin imagen de referencia', 'Instruccion de corte de colada incompleta'],
  ['Criterio de aceptacion/rechazo no claro por falta de muestras maestras actualizadas en el puesto', 'Muestras maestras no actualizadas'],
  ['Gestion de la muestra patron sin responsable ni periodicidad de revision', 'Muestra patron sin gestion de revision'],
  ['Etiqueta de lote no actualizada al cambio de lote/turno en el puesto de control', 'Etiqueta de lote no actualizada'],
  ['Desgaste o desajuste del robot de desmoldeo raspando la pieza al retirarla del molde', 'Robot de desmoldeo raspando la pieza'],
  ['Linea de junta del molde danada generando marca en la pieza al desmoldear', 'Linea de junta del molde danada'],
  ['Instruccion de trabajo de desmoldeo incompleta o no disponible en el puesto al momento del arranque', 'Instruccion de desmoldeo no disponible'],
  ['Nivel de iluminacion (lux) del puesto por debajo del minimo requerido para inspeccion visual', 'Iluminacion insuficiente en el puesto'],
  ['Luminaria del puesto quemada o desalineada, zonas de sombra en la estacion', 'Luminaria quemada o desalineada'],
  ['Lumina rota o LED degradado sin reemplazo', 'Luminaria rota sin reemplazo'],
  ['Filtro/secador del aire comprimido saturado sin purgar', 'Filtro de aire comprimido saturado'],
  ['Presion de red de aire comprimido baja afectando sopletado y aspiracion', 'Presion de aire comprimido baja'],
  ['Calibre fuera del plan de calibracion periodica', 'Calibre fuera de calibracion'],
  ['Golpe o impacto del calibre sin reporte al metrologo', 'Calibre golpeado sin reporte'],
  ['Instrumento fuera del plan de calibracion periodica', 'Instrumento fuera de calibracion'],
  ['Puesta a punto incorrecta: operador carga parametros de un producto anterior al cambio de molde', 'Operador carga parametros del producto anterior'],

  // === CONTROLES PREVENCION ===
  ['Dossier de parametros validado + panel de la inyectora con alarmas configuradas por zona', 'Dossier de parametros + alarmas en panel'],
  ['Dossier de parametros validado con rangos maximos de presion de segunda presion', 'Dossier con rangos de segunda presion'],
  ['Dossier de parametros con fuerza de cierre minima validada por molde', 'Dossier con fuerza de cierre por molde'],
  ['Dossier de parametros validado con volumen de dosificacion especifico por molde', 'Dossier con dosificacion por molde'],
  ['Dossier de parametros validado con tiempo de enfriamiento por molde', 'Dossier con tiempo de enfriamiento'],
  ['Dossier de parametros validado con tiempo de compactacion por molde', 'Dossier con tiempo de compactacion'],
  ['Dossier de parametros validado con rango de segunda presion', 'Dossier con rango de segunda presion'],
  ['Dossier de parametros validado + panel con alarmas de presion minima', 'Dossier + alarmas de presion en panel'],
  ['Dossier de parametros validado + panel con alarma si ciclo se acorta', 'Dossier + alarma de ciclo en panel'],
  ['Dossier de parametros validado + panel con alarma de dosificacion fuera de rango', 'Dossier + alarma de dosificacion'],
  ['Dossier de parametros con limites maximos de temperatura por zona', 'Dossier con limites de temperatura'],
  ['Dossier con tiempo de enfriamiento validado + plan de mantenimiento de canales de refrigeracion del molde', 'Dossier de enfriamiento + mantenimiento de canales'],
  ['Dossier de parametros validado con temperatura minima para fusion correcta del colorante', 'Dossier con temperatura de colorante'],
  ['Procedimiento de arranque con verificacion explicita del dossier vs producto + firma de liberacion', 'Verificacion de dossier al arranque + firma'],
  ['Procedimiento P-05 de control de documentos con revision periodica del dossier', 'Control de documentos P-05'],
  ['Checklist de arranque con firma del operador Y del lider + aprobacion de primera pieza antes de liberar produccion', 'Checklist de arranque con firma + primera pieza'],
  ['Instruccion de trabajo con foto del check + aprobacion del lider de produccion para liberar', 'Instruccion con foto + aprobacion del lider'],
  ['Instruccion de trabajo de autocontrol visible en el puesto + muestra maestra + muestra patron', 'Instruccion de autocontrol + muestras en el puesto'],
  ['Plan de mantenimiento preventivo de molde por golpes/horas (revision linea de junta)', 'Mantenimiento preventivo del molde'],
  ['Plan de mantenimiento preventivo del molde por golpes/horas (contador de ciclos)', 'Mantenimiento preventivo del molde'],
  ['Plan de mantenimiento preventivo de molde por golpes/horas', 'Mantenimiento preventivo del molde'],
  ['Plan de mantenimiento preventivo del molde (linea de junta) por golpes/horas', 'Mantenimiento preventivo del molde'],
  ['Plan de mantenimiento preventivo de molde', 'Mantenimiento preventivo del molde'],
  ['Plan de mantenimiento preventivo del robot (verificacion de tomas, recorrido, velocidades)', 'Mantenimiento preventivo del robot'],
  ['Plan de mantenimiento preventivo: revision de expulsores por golpes/horas', 'Mantenimiento preventivo (expulsores)'],
  ['Plan de mantenimiento del circuito de refrigeracion (limpieza/reemplazo de filtros)', 'Mantenimiento del circuito de refrigeracion'],
  ['Plan de mantenimiento preventivo del chiller / sistema de refrigeracion de moldes', 'Mantenimiento del sistema de refrigeracion'],
  ['Procedimiento de limpieza del molde al bajarlo + plan de mantenimiento preventivo', 'Limpieza del molde + mantenimiento preventivo'],
  ['Procedimiento de limpieza al bajar molde: soplado de canales con aire comprimido (obligatorio en check list)', 'Soplado de canales al bajar molde'],
  ['Procedimiento de limpieza al bajar molde: soplado de canales con aire comprimido', 'Soplado de canales al bajar molde'],
  ['Procedimiento de limpieza al bajar molde: limpieza de venteos (obligatorio en check list)', 'Limpieza de venteos al bajar molde'],
  ['Procedimiento de limpieza al bajar molde: limpieza de venteos', 'Limpieza de venteos al bajar molde'],
  ['Procedimiento de cambio de molde con inspeccion de insertos + plan de mantto preventivo', 'Inspeccion de insertos al cambio de molde'],
  ['Procedimiento de purga del husillo al cambio de color o material', 'Purga del husillo al cambio de color'],
  ['Inspeccion documental del certificado del proveedor de colorante antes de usar el lote', 'Certificado del proveedor de colorante'],
  ['Plan de calibracion periodica del dosificador de colorante + verificacion de ratio al cambio de lote', 'Calibracion del dosificador + verificacion al cambio'],
  ['Plan de calibracion periodica de todos los instrumentos de medicion (etiqueta con fecha de proxima calibracion)', 'Calibracion periodica de instrumentos'],
  ['Plan de calibracion periodica del calibre con etiqueta de proxima calibracion', 'Calibracion periodica del calibre'],
  ['Procedimiento de gestion de instrumentos: reporte obligatorio de impactos', 'Reporte obligatorio de golpes a instrumentos'],
  ['Procedimiento de gestion de patrones visuales con responsable y revision periodica por Calidad', 'Revision periodica de patrones por Calidad'],
  ['Procedimiento de cambio de lote con actualizacion obligatoria de etiqueta en el puesto de control', 'Actualizacion de etiqueta al cambio de lote'],
  ['Instruccion de trabajo visible en el puesto con muestras maestras y muestra patron', 'Instruccion de trabajo + muestras en el puesto'],
  ['Instruccion de trabajo con imagen de corte correcto vs incorrecto en el puesto', 'Instruccion con imagen de corte correcto/incorrecto'],
  ['Muestras maestras + muestra patron actualizados en el puesto con revision periodica', 'Muestras actualizadas en el puesto'],
  ['Instruccion de trabajo visible en el puesto + procedimiento de arranque con verificacion de documentacion', 'Instruccion de trabajo + procedimiento de arranque'],
  ['Verificacion manual de flujo y temperatura de garganta al arranque de maquina + plan de mantenimiento del circuito', 'Verificacion de flujo al arranque + mantenimiento'],
  ['Plan de purga periodica de filtros/secadores de la red de aire comprimido', 'Purga periodica de filtros de aire'],
  ['Verificacion de presion de red al arranque del turno', 'Verificacion de presion al arranque'],
  ['Estandar de iluminacion del puesto de control visual (nivel lux segun procedimiento de Seguridad e Higiene)', 'Estandar de iluminacion del puesto'],
  ['Plan de mantenimiento de puesto de trabajo (verificacion mensual de iluminacion)', 'Mantenimiento de iluminacion del puesto'],
  ['Mantenimiento preventivo de luminarias del puesto', 'Mantenimiento de luminarias'],

  // === CONTROLES DETECCION ===
  ['Inspeccion visual 100% + comparacion con muestra maestra de pieza OK', 'Inspeccion visual 100% + muestra maestra'],
  ['Inspeccion visual de la primera pieza de cada arranque + autocontrol 100%', 'Primera pieza + autocontrol 100%'],
  ['Verificacion de pieza en primer disparo + autocontrol visual 100%', 'Primera pieza + autocontrol 100%'],
  ['Monitoreo de presion en panel durante produccion + inspeccion visual 100%', 'Panel de presion + inspeccion visual 100%'],
  ['Inspeccion visual 100% + comparacion con muestra maestra en plantilla de control', 'Inspeccion visual 100% + muestra maestra'],
  ['Monitoreo en panel + inspeccion visual 100% de la pieza', 'Panel + inspeccion visual 100%'],
  ['Inspeccion visual 100% + comparacion con muestra maestra', 'Inspeccion visual 100% + muestra maestra'],
  ['Inspeccion visual 100% + calibre de referencia en linea de junta para rebabas criticas', 'Inspeccion visual 100% + calibre'],
  ['Verificacion de parametro en panel al arranque + inspeccion visual 100%', 'Panel al arranque + inspeccion visual 100%'],
  ['Inspeccion visual del molde en cambio + inspeccion visual 100% de pieza', 'Inspeccion visual del molde + pieza 100%'],
  ['Inspeccion visual del molde al cambiarlo + inspeccion visual 100% de la pieza', 'Inspeccion visual del molde + pieza 100%'],
  ['Inspeccion visual del molde al cambio + inspeccion visual 100% de la pieza', 'Inspeccion del molde + pieza 100%'],
  ['Verificacion visual de flujo de refrigeracion al montar molde + inspeccion de pieza', 'Flujo de refrigeracion + inspeccion de pieza'],
  ['Monitoreo en panel de inyectora durante produccion', 'Monitoreo en panel'],
  ['Verificacion manual de caudal al arranque + alarma de temperatura en panel', 'Caudal al arranque + alarma en panel'],
  ['Comparacion con muestra maestra de color bajo luz controlada (cabina D65)', 'Muestra maestra bajo luz controlada'],
  ['Comparacion del primer disparo con muestra maestra de color bajo luz controlada', 'Primera pieza vs muestra maestra bajo luz'],
  ['Comparacion con muestra maestra bajo luz controlada al cambio de lote', 'Muestra maestra bajo luz al cambio de lote'],
  ['Verificacion de color de las primeras piezas del arranque contra muestra maestra', 'Color de primeras piezas vs muestra maestra'],
  ['Inspeccion de primera pieza (First Off Inspection) con aprobacion por lider de produccion', 'Primera pieza aprobada por lider'],
  ['Auditoria periodica de dossier en produccion por Calidad', 'Auditoria de dossier por Calidad'],
  ['Auditoria periodica de arranques por Calidad', 'Auditoria de arranques por Calidad'],
  ['Verificacion del registro de liberacion de primera pieza por el lider', 'Lider verifica registro de primera pieza'],
  ['Auditoria periodica del puesto de control por Calidad + control final independiente', 'Auditoria del puesto + control final'],
  ['Auditoria periodica del puesto de control por Calidad', 'Auditoria del puesto por Calidad'],
  ['Auditoria periodica del puesto por Calidad + control final independiente', 'Auditoria del puesto + control final'],
  ['Auditoria periodica del puesto por Calidad', 'Auditoria del puesto por Calidad'],
  ['Verificacion periodica vs patron + bloqueo de uso si etiqueta vencida', 'Verificacion vs patron + bloqueo si vencido'],
  ['Verificacion diaria contra patron al arranque del turno', 'Verificacion contra patron al arranque'],
  ['Verificacion contra patron antes del uso', 'Verificacion contra patron'],
  ['Balanza de pesaje por muestreo de piezas segun plan de control', 'Pesaje por muestreo'],
  ['Verificacion cruzada de etiqueta con orden de fabricacion por el lider al inicio del turno', 'Lider verifica etiqueta vs orden'],
  ['Verificacion visual del filtro al arranque + inspeccion de la pieza', 'Filtro al arranque + inspeccion de pieza'],
  ['Manometro de referencia en el punto de uso', 'Manometro en punto de uso'],
  ['Verificacion visual del operador al inicio de turno (autocontrol de condiciones del puesto)', 'Autocontrol del puesto al arranque'],
  ['Verificacion periodica del nivel de iluminacion con luxometro por Seguridad e Higiene', 'Luxometro periodico por Seguridad'],
  ['Verificacion visual al arranque del puesto', 'Verificacion visual al arranque'],
  ['Inspeccion visual 100% del area del punto de inyeccion despues del corte', 'Inspeccion visual 100% del corte'],
  ['Inspeccion visual 100% + muestra maestra de referencia', 'Inspeccion visual 100% + muestra maestra'],
  ['Inspeccion visual 100% + muestra maestra', 'Inspeccion visual 100% + muestra maestra'],

  // === EFECTOS ===
  ['Scrap de pieza (no recuperable, pieza sin material en zona de cavidad)', 'Scrap (pieza incompleta)'],
  ['Scrap de pieza (marca oscura no recuperable por retrabajo)', 'Scrap (quemadura)'],
  ['Scrap de pieza (deformacion permanente no recuperable)', 'Scrap (deformacion)'],
  ['Scrap de pieza (no recuperable por tincion)', 'Scrap (color)'],
  ['Scrap de pieza (no recuperable)', 'Scrap'],
  ['Retrabajo in-station (corte de rebaba por el operador en el puesto)', 'Retrabajo (corte de rebaba)'],
  ['Retrabajo de inspeccion; scrap si el chupado es visible en zona estetica', 'Retrabajo o scrap segun gravedad'],
  ['Retrabajo in-station de corte adicional', 'Retrabajo (corte adicional)'],
  ['Retrabajo in-station si es leve; scrap si marca profunda', 'Retrabajo o scrap segun gravedad'],
  ['Rechazo de la pieza, scrap', 'Scrap'],
  ['Color de pieza fuera de rango vs muestra maestra (scrap)', 'Scrap (color fuera de rango)'],
  ['Color fuera de tolerancia o defectos superficiales por contaminante', 'Color NOK o defectos por contaminante'],
  ['Enfriamiento desigual, deformacion o dimensional NOK', 'Deformacion o dimensional NOK'],
  ['Pieza no se desmoldea correctamente (posible marca o dano)', 'Marca o dano al desmoldear'],
  ['Gases atrapados generan quemaduras en la pieza', 'Quemaduras por gases atrapados'],
  ['Geometria interna de la pieza NOK', 'Geometria interna NOK'],
  ['Flujo de pellet interrumpido, ciclo abortado', 'Ciclo abortado por falta de material'],
  ['Contaminacion de pellet o del molde durante sopletado', 'Contaminacion por aire sucio'],
  ['Primera pieza fuera de especificacion (rebabas, chupados, dimensional)', 'Primera pieza NOK'],
  ['Parametros obsoletos aplicados al ciclo', 'Parametros obsoletos en produccion'],
  ['Decision de liberacion basada en medicion falsa', 'Medicion falsa en liberacion'],
  ['Operador sin referencia visual clara para decidir aceptacion/rechazo', 'Sin referencia visual para decidir'],
  ['Piezas OK mezcladas en lote incorrecto, perdida de trazabilidad', 'Perdida de trazabilidad'],
  ['Operador no detecta defectos superficiales sutiles por iluminacion pobre', 'Defectos no detectados por mala luz'],
  ['Defectos visuales leves no detectados por el operador', 'Defectos no detectados por mala luz'],
  ['Defecto no detectado sale de la estacion', 'Defecto pasa a siguiente estacion'],
  ['Defecto no detectado en el control', 'Defecto no detectado'],
  ['Pieza defectuosa liberada al siguiente sector', 'Pieza defectuosa liberada'],
  ['Pieza liberada o rechazada en base a medicion falsa', 'Decision erronea por calibre malo'],
  ['Arranque de produccion con defecto no detectado', 'Arranque con defecto no detectado'],

  // === NOMBRES WE ===
  ['Inyectora (maquina principal)', 'Inyectora'],
  ['Molde (dispositivo critico)', 'Molde'],
  ['Sistema de refrigeracion del tornillo (garganta / zona de alimentacion)', 'Refrigeracion del tornillo'],
  ['Colorante masterbatch (material indirecto de proceso)', 'Colorante masterbatch'],
  ['Dossier de parametros de proceso', 'Dossier de parametros'],
  ['Procedimiento de arranque de fabricacion inyeccion', 'Procedimiento de arranque'],
  ['Operador de inyectora (autocontrol 100% durante produccion)', 'Operador de inyectora (autocontrol)'],
  ['Instrumentos de medicion (calibre, termometros, manometros)', 'Instrumentos de medicion'],
  ['Aire comprimido filtrado (servicio)', 'Aire comprimido'],
  ['Mesa / banco de control post-inyeccion', 'Mesa de control'],
  ['Procedimiento de control visual y dimensional', 'Procedimiento de control'],
  ['Procedimiento de corte de colada', 'Corte de colada'],
  ['Operador de control post-inyeccion', 'Operador de control'],
  ['Muestra patron de defectos tipicos', 'Muestra patron'],
  ['Bolsas, cajas y etiquetas de identificacion de lote (material indirecto de empaque)', 'Material de empaque y etiquetas'],
  ['Iluminacion del puesto de control post-inyeccion', 'Iluminacion del puesto'],

  // === FALLAS ===
  ['Pieza incompleta (llenado insuficiente)', 'Pieza incompleta'],
  ['Rebabas en pieza inyectada', 'Rebabas'],
  ['Pieza deformada (alabeo / distorsion geometrica)', 'Pieza deformada'],
  ['Pieza deformada', 'Pieza deformada'],
  ['Quemaduras en pieza inyectada', 'Quemaduras'],
  ['Chupados en pieza inyectada', 'Chupados'],
  ['Dimensional NOK (fuera de tolerancia en medida critica)', 'Dimensional NOK'],
  ['Color no conforme en pieza inyectada', 'Color no conforme'],
  ['Peso NOK en pieza inyectada (fuera de rango)', 'Peso NOK'],
  ['Rayas / marcas en la superficie de la pieza', 'Rayas o marcas superficiales'],
  ['Rebaba residual o bebedero visible en el punto de inyeccion', 'Marca o rebaba en punto de inyeccion'],
  ['Muestra patron desactualizado o no disponible en el puesto', 'Muestra patron no disponible'],
  ['Pieza OK marcada con etiqueta incorrecta de lote/fecha/turno', 'Etiqueta de lote incorrecta'],
  ['Iluminacion insuficiente o inadecuada en el puesto de control', 'Iluminacion insuficiente'],
  ['Iluminacion insuficiente en el banco de control', 'Iluminacion insuficiente'],
  ['Paso del procedimiento de control omitido o mal ejecutado', 'Paso de control omitido'],
  ['Omision de defecto visible durante la inspeccion 100%', 'Defecto no detectado en inspeccion'],
  ['Omision de inspeccion visual durante produccion', 'Inspeccion visual omitida'],
  ['Calibre danado o desgastado dando lecturas incorrectas', 'Calibre danado'],
  ['Lectura incorrecta por instrumento descalibrado', 'Instrumento descalibrado'],
  ['Primera pieza no verificada contra muestra maestra antes de liberar produccion', 'Primera pieza no verificada'],
  ['Pasos criticos del procedimiento de arranque omitidos', 'Pasos de arranque omitidos'],
  ['Parametros de otro producto cargados por error en la inyectora', 'Parametros del producto anterior cargados'],
  ['Dossier desactualizado respecto a la version validada por el equipo APQP', 'Dossier desactualizado'],
  ['Ratio de mezcla de colorante incorrecto respecto a especificacion', 'Mezcla de colorante incorrecta'],
  ['Lote de colorante contaminado o fuera de especificacion del proveedor', 'Lote de colorante contaminado'],
  ['Linea de junta del molde desgastada o danada permitiendo escape de material', 'Linea de junta desgastada'],
  ['Canales de refrigeracion del molde obstruidos (oxido, sarro)', 'Canales de refrigeracion obstruidos'],
  ['Expulsores rotos o desgastados', 'Expulsores danados'],
  ['Orificios de venteo del molde tapados', 'Venteo del molde tapado'],
  ['Insertos o machos del molde danados', 'Insertos del molde danados'],
  ['Boca de alimentacion del tornillo atascada por pasta de material fundido prematuramente', 'Boca del tornillo atascada'],
  ['Aire comprimido contaminado con agua o aceite', 'Aire comprimido contaminado'],
];

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function applyReplacements(str) {
  let result = str;
  for (const [find, replace] of R) {
    result = result.replace(new RegExp(escapeRegex(find), 'g'), replace);
  }
  return result;
}

function walkAndFix(obj, path, changes) {
  if (typeof obj === 'string') {
    const fixed = applyReplacements(obj);
    if (fixed !== obj) changes.push({ path, old: obj.slice(0, 80), new: fixed.slice(0, 80) });
    return fixed;
  }
  if (Array.isArray(obj)) return obj.map((v, i) => walkAndFix(v, `${path}[${i}]`, changes));
  if (obj && typeof obj === 'object') {
    const r = {};
    for (const [k, v] of Object.entries(obj)) r[k] = walkAndFix(v, `${path}.${k}`, changes);
    return r;
  }
  return obj;
}

// Scan all docs
const TABLES = [
  { table: 'amfe_documents', nameCol: 'amfe_number' },
  { table: 'cp_documents', nameCol: 'control_plan_number' },
];

let totalChanges = 0;
const allAffected = [];

for (const { table, nameCol } of TABLES) {
  const { data: rows, error } = await sb.from(table).select(`id, ${nameCol}, data`);
  if (error) { console.error(`ERROR ${table}:`, error.message); continue; }
  for (const row of rows) {
    const parsed = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    const changes = [];
    const fixed = walkAndFix(parsed, 'data', changes);
    if (changes.length > 0) {
      const name = row[nameCol] || row.id;
      console.log(`${name}: ${changes.length} cambios`);
      totalChanges += changes.length;
      allAffected.push({ table, id: row.id, name, changes, fixed, originalData: row.data });
    }
  }
}

console.log(`\n=== TOTAL: ${totalChanges} cambios en ${allAffected.length} documentos ===`);
if (totalChanges === 0) { console.log('Nada que simplificar.'); process.exit(0); }
if (!APPLY) { console.log('\n*** DRY RUN — usar --apply ***'); process.exit(0); }

// APPLY
console.log('\n=== APLICANDO ===\n');
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = new URL(`../backups/simplify-${ts}/`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
mkdirSync(backupDir, { recursive: true });

for (const doc of allAffected) {
  const toWrite = typeof doc.originalData === 'string' ? JSON.stringify(doc.fixed) : doc.fixed;
  const { error } = await sb.from(doc.table).update({ data: toWrite, updated_at: new Date().toISOString() }).eq('id', doc.id);
  if (error) { console.error(`ERROR ${doc.name}:`, error.message); continue; }
  console.log(`  ${doc.name} OK (${doc.changes.length})`);
}
console.log(`\nBackup: ${backupDir}`);
