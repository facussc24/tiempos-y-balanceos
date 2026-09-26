---
name: apqp-legajo
description: Que va en cada casillero de un legajo APQP de Barack, quien lo produce y donde vive el original. Usar al armar o completar un legajo de PPAP CLIENTES, al recibir material de un cliente, al archivar un flujograma / AMFE / plan de control / HO, o cuando haya que decidir en que carpeta va un documento del proyecto. Marca lo que esta SIN DEFINIR, que se pregunta. Para SMRC / Motherson el legajo es el paquete del cliente (skill ppap-motherson).
---

# El legajo APQP: donde va cada cosa

> **SMRC / Motherson (Reydel): desde el 23/09/2026 el legajo tiene el formato del paquete PPAP del
> cliente** (las 29 carpetas del `PPAP Standard Folder` + `1. Imput`), no los 34 casilleros. Fak:
> *"elimina las carpetas del APQP para dejar el formato de Capuana... el nuestro estaba mal"*.
> Como se arma: skill **`ppap-motherson`**. Lo de abajo sigue valiendo para los demas clientes.

> **Esta guia sale de mirar los legajos que YA estan hechos, no de la teoria APQP.** Se relevaron
> 7 legajos reales el 21/09/2026 (P21 azul, cuero, naranja 2023, hilo verde, NOVAX tapizadas
> puerta, COZZUOL insonos/ductos, PWA telas termoformadas 582D). Los conteos que dicen "x de 6"
> son sobre los 6 que tienen estructura de 34 casilleros: el **hilo verde no la tiene** (ver §5).
>
> **Fak corrige el criterio de este archivo.** Donde dice "SIN DEFINIR" es porque ningun
> procedimiento lo dice y nadie lo decidio todavia: eso se pregunta, no se completa.

## 0. Las cuatro reglas que ya estan decididas

Vienen de `.claude/rules/autonomy-contract.md` §F, que Fak escribio el 21/09/2026 despues de
que yo emitiera un flujograma Rev.A en tres carpetas del servidor sin que el lo viera.

1. **La PRIMERA VEZ se pregunta.** Un casillero que no complete antes, se pregunta: *"esto va
   aca, ¿esta bien?"*, con la ruta y el archivo concretos. La prueba: si no puedo nombrar el
   caso anterior, es la primera vez.
2. **Todo lo que manda el cliente queda junto, en `1. Imput`, con la estructura que el le dio.**
   Fak: *"podes dejar todo eso dentro de input en la carpeta original del cliente"*. El paquete
   de PPAP del cliente entero (`PPAP_<part number>_<n>\`) va ahi, con su zip al lado.
3. **Lo unico que se saca de ahi es el plano**, que va a `6-Planos de la pieza`. Y eso tiene su
   propio procedimiento, que hoy no se cumple (§4).
4. **Un documento vivo tiene UN solo lugar.** El maestro vive en `Gestion Ingenieria` —salvo la
   HO, que vive en `DOCUMENTACION SGC\HOJAS DE OPERACIONES\` (skill `hojas-de-proceso` §3 bis)—;
   lo que se copia al legajo es una COPIA que envejece sola. No se reparte "por las dudas".

## 1. Donde vive un legajo

```
Y:\BARACK\CALIDAD\DOCUMENTACION SGC\PPAP CLIENTES\<CLIENTE>\<PIEZA o PROYECTO>\APQP\
```

La plantilla vacia de los 34 casilleros:
`Y:\Ingenieria\Documentacion Gestion Ingenieria\Proyecto\Documentos Standard de Uso\2_APQP Vacio\`

**Una pieza NUEVA lleva legajo propio, hermano de las otras variantes** — no se mete adentro
del de una variante anterior, y sus documentos nacen en Rev. A (memoria
`pieza_nueva_no_es_revision`).

## 2. Que va en cada casillero

`lleno` = en cuantos de los 6 legajos relevados tenia contenido real.

| # | Casillero | lleno | Que va | Quien lo produce |
|---|---|---|---|---|
| 1 | Imput | 1/6 | **Todo lo que manda el cliente, tal cual**: 3D nativo, LSC, y el paquete de PPAP entero con su zip | CLIENTE |
| 2 | Factibilidad | 3/6 | Formulario `P-03.3 Analisis de factibilidad` | INGENIERIA |
| 3 | Cotizacion | 0/6 | Apertura de costos de herramental, QTR | Barack + proveedores |
| 4 | Conformacion de equipo | 4/6 | El organigrama vigente | Direccion / RRHH |
| 5 | Carta de nominacion | 1/6 | La SNL del cliente y la orden de compra | CLIENTE |
| 6 | Planos de la pieza | 5/6 | El plano 2D del cliente (PDF/TIF) y su 3D | CLIENTE |
| 7 | Lista de materiales | **6/6** | La BOM de Barack en PDF. **Cada vez que cambia una BOM, la BOM ultimo nivel del arb de la familia entera va a su subcarpeta de BOM y la anterior a Obsoleto** (Fak, 22/09/2026 — `scripts/_bomLegajo.py`, skill `carga-arb` §4b) | INGENIERIA |
| 8 | Ficha tecnica | 4/6 | Fichas del **proveedor de materia prima**, con su membrete | TERCERO |
| 9 | Flujograma preliminar | 2/6 | El flujograma antes de liberarse | INGENIERIA |
| 10 | AMFE de **DISEÑO** | 1/6 | N/A en Barack: no hacemos AMFE de diseño. **Ojo: hay AMFE de PROCESO mal archivados aca** | — |
| 11 | Lay out del area | 3/6 | DWG/PDF del layout del sector | INGENIERIA |
| 12 | Plan de Control | 4/6 | El PC en xls y su PDF | CALIDAD |
| 13 | Especificaciones de Ingenieria | 3/6 | El SOR del cliente **y/o** tizadas y mylares de Barack | mezclado |
| 14 | Especificaciones de Materiales | 2/6 | BOM de material y la del cliente | mezclado |
| 15 | Alteraciones de diseño | 0/6 | **El ECR/ECO del cliente.** Hoy no se archiva en ningun lado | CLIENTE |
| 16 | Nuevos equipos y herramientas | 5/6 | Cotizaciones y diseños de utillaje, remito de entrega | TERCERO + Barack |
| 17 | Caracteristicas especiales | 1/6 | El listado de caracteristicas y los defectos del cliente | CALIDAD + CLIENTE |
| 18 | Equipos de ensayo y calibres | 2/6 | CAD de calibres y dispositivos | INGENIERIA |
| 19 | Embalaje | 3/6 | Gama de embalaje de Barack y el SLT del cliente | Barack sobre plantilla del cliente |
| 20 | Flujograma de proceso | 4/6 | El flujograma **liberado**, en PDF | INGENIERIA |
| 21 | Lay out de la planta | 0/6 | En la practica va todo al 11 | — |
| 22 | FMEA de proceso | 5/6 | El AMFE en xlsx y PDF | INGENIERIA / CALIDAD |
| 23 | IMDS | 1/6 | La declaracion y su captura. Skill `imds` | CALIDAD (Fak, 08/09/2026: *"el imds es de calidad"*). Ingenieria lo carga solo cuando Fak lo pide para una pieza puntual (26/09/2026: *"podria llegar a hacerlo algun dia"*); no se le lista como pendiente suyo |
| 24 | PC de Pre lanzamiento | 0/6 | — | CALIDAD |
| 25 | MSA | 0/6 | R&R, calibraciones. **Hoy los R&R se archivan en el 10 del cliente** | CALIDAD |
| 26 | **Instrucciones de Proceso** | 5/6 | **Copia** de las hojas de operacion (HO). El original y su numero viven en `HOJAS DE OPERACIONES` del SGC: skill `hojas-de-proceso` §3 bis | INGENIERIA |
| 27 | Capacitacion | 0/6 | Matriz de polivalencia | RRHH |
| 28 | Corrida de produccion | 4/6 | TryOut, PVS, dimensional | mezclado |
| 29 | Capacidad preliminar | 1/6 | Ppk. **Hoy tiene metodos y tiempos, que es otra cosa** | CALIDAD |
| 30 | Ensayos de validacion | 1/6 | El plan de validacion y sus formularios | CLIENTE + laboratorio |
| 31 | Aprobacion de piezas (PPAP) | 1/6 | Los PSW. **El paquete del cliente NO va aca: va a `1. Imput`** | Barack firma, cliente aprueba |
| 32 | PC de Produccion | 0/6 | En la practica va todo al 12 | CALIDAD |
| 33 | SIGN-OFF | 0/6 | Cierre del programa, auditoria de proceso | CALIDAD |
| 34 | Lecciones aprendidas | 0/6 | — | todos |

**9 casilleros estan vacios en los 6 legajos** (3, 15, 21, 24, 25, 27, 32, 33, 34). Que esten
vacios no significa que no correspondan: significa que hoy nadie los llena.

## 3. Lo que NO es nuestro

El PPAP lo coordina **CALIDAD**. Ingenieria deja la base en el legajo: flujograma, AMFE y el
alta de codigos en el arb; una base de plan de control, solo si Fak la pide (`autonomy-contract.md` §F). El IMDS es de
Calidad (fila 23). **No arma el paquete que va al
cliente, no lo presenta y no persigue lo que falta.** Lo que queda pendiente se escribe con
dueño y se le pasa a Calidad.

## 4. El plano del cliente — el procedimiento existe y no se cumple

`I-IN-001` Rev. A (septiembre 2018), en
`...\DOCUMENTACION SGC\SISTEMA\SISTEMA SGC\Instructivos\INGENIERIA\`. Ojo: "Maestro de Planos
de Productos" es el nombre del **Anexo I** (el formulario), no del instructivo.

Dice tres cosas: lo registra Ingenieria de Producto por numero de plano · el plano se **sella**
("Documento Original" y "Recibido" con fecha; el viejo, "Documento Obsoleto") · y el cambio
**abre una SCP por el I-IN-003**.

Lo que se midio el 21/09/2026:

- **Hay DOS listados maestros distintos**, y 15 copias del formulario en el servidor. El de la
  carpeta oficial del I-IN-001I tiene **4 filas** (todas Woodbridge); el de 2020, en
  `PPAP CLIENTES\PLANOS BARACK\`, tiene **13 hojas por cliente y ~330 filas**. Ninguna paso al nuevo.
- Las 4 filas del nuevo **apuntan a carpetas que no existen** (les falta el nivel `CLIENTES`).
- El formulario esta **sin firmar** (ELABORO, APROBO, EMISION, REVISION vacios) siendo un
  documento que el propio instructivo declara controlado.
- Un mismo plano llega a existir en **cinco lugares** con copias byte a byte identicas, y
  **ninguna marcada como el original** — que es justo lo que el sello existe para resolver.

**SIN DEFINIR, lo decide Fak o Calidad:** en cual de los dos listados se carga · donde va el
archivo en el disco y como se nombra (el instructivo no lo dice: es de 2018 y habla de papel) ·
que se hace con el CAD nativo · si un plano que llega adentro del paquete del cliente se
registra igual.

**Hasta que eso se defina: el plano se copia a `6-Planos de la pieza` y nada mas.** No se
registra en ningun listado por cuenta propia.

## 5. El caso que muestra por que esto importa

**El Hilo Verde del P21 no tiene legajo de 34 casilleros**: su carpeta es directamente el
paquete del cliente (`PPAP Standard Folder\Element 01a...`). Resultado medido: el AMFE y el
Plan de Control que **se le entregaron al cliente** (AMFE REV2 de ago-2024, PC rev M de
feb-2024) nunca volvieron al circuito interno. Los tres legajos de P21 que si tienen los 34
casilleros siguen con el **AMFE unificado REV 15 de julio de 2022** y el **PC rev L**.

Dos años de diferencia entre lo que tiene el cliente y lo que tenemos nosotros, en una pieza
que se produce hoy. **El original quedo viejo y la copia buena se fue con el cliente.**

## 6. Trampas verificadas (no son sospechas)

1. **El mismo nombre, archivos distintos.** `BOM 127 Rev6.pdf` existe 4 veces con 4 tamaños
   distintos, y en CUERO el vigente es una revision atras que en los otros tres.
2. **El numero baila entre 127 y 927** para la misma familia (`FLUJOGRAMA 127`, `HO 127`,
   `BOM 127` vs `HO 927`, `BOM 927`). Antes de reusar cualquiera de los dos, cotejar contra el
   Listado Maestro: el 127 es el numero del **AMFE**.
3. **Un flujograma archivado en el casillero del AMFE**, en los tres legajos de P21, mientras el
   casillero 20 tiene otro flujograma distinto.
4. **AMFE de proceso en el casillero 10**, que es de AMFE de diseño. Y en el 22 del mismo
   legajo, **accesos directos** con el mismo nombre: copiado a un pendrive, viajan rotos.
5. **Rutas que pasan los 259 caracteres y no abren en Windows**: 40 archivos en NOVAX, una de
   283 en PWA. Medir la ruta antes de crear una carpeta con nombre largo.
6. **Cinco nombres para la misma idea**: `OBSOLETO`, `Obsoleto`, `00 - Obsoleto`, `SUPERADO`,
   `0_Obsoleto` — y en un caso, OBSOLETO anidado adentro de OBSOLETO.
7. **Formularios en blanco archivados como si fueran el registro** (plantillas de 2018 dentro
   de un PPAP de 2024): el casillero parece lleno y esta vacio.
8. **Un `.txt` de puntero cuando algo se mueve** — esto si esta bien hecho y conviene repetirlo:
   `_LEEME - el legajo 2026 esta en P21 SSRT-MY2026 HILO NARANJA.txt`.

## 7. Enforcement

| Que | Donde |
|---|---|
| Bloquea escribir en el paquete del cliente y en los listados maestros | `.claude/hooks/apqp-cliente-guard.sh` → guardian `apqp-cliente-guard` en `scripts/_lib/guardianes.mjs` |
| Sus casos, en las dos direcciones | `__tests__/scripts/apqpClienteGuard.test.mjs` |
| La regla de la primera vez | `.claude/rules/autonomy-contract.md` §F |

Ver tambien: `no-pfd-no-ho.md` (flujogramas y HO) · `amfe.md` · skills `hojas-de-proceso`,
`flujogramas`, `imds`, `product-map`.
