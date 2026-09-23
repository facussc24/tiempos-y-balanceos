---
name: ppap-motherson
description: Como se arma y se manda un PPAP para SMRC / Motherson (Reydel) — la estructura de carpetas que pide el cliente, que va en cada una y quien la hace, la SLT de embalaje, el AMFE y el flujograma en PDF, la auditoria antes de mandar y el mail al SQE. Usar cuando Fak diga "PPAP de SMRC / Motherson / Capuana / Reydel", cuando llegue un mail del SQE de SMRC con carpetas del PPAP, SLT, FCR, AAR, MSA o PSW, o al armar el legajo de una pieza nueva de SMRC. Nace del PPAP del APB P21 hilo naranja MY2026 (23/09/2026).
---

# PPAP para SMRC / Motherson — como se carga

> Sale de hacerlo de verdad: el PPAP del **APB P21 hilo naranja MY2026** (00257327-01-NHZD /
> 00257328-01-NHZD), cerrado el 23/09/2026 con Fak sentado al lado de **Jose Luis Capuana**
> (SQ&D Plant Quality and Supplier Development Supervisor de SMRC). Lo que aca dice "Fak:" es cita
> textual de ese dia. El estado vivo de esa pieza esta en la memoria
> `project_ppap_p21_hilo_naranja_my2026`.

## 0. Quien hace que

| Quien | Que |
|---|---|
| **El cliente (SQE de SMRC)** | Manda la estructura vacia del paquete (`PPAP Standard Folder.zip`), el LSC, el plano, el FCR firmado, el AAR aprobado, la SLT de la variante anterior, el plan de control generico, las normas, los MSA y el dimensional viejos, y el PSW |
| **Ingenieria (Fak)** | Flujograma, AMFE, SLT (con logistica), el orden de la carpeta y el mail al SQE. Fak: *"prepara el PPAP en el servidor Y, ayudame con eso"* |
| **Calidad** (Manuel Meszaros; Cecilia Rodriguez y Agustin Aguayo para MSA/dimensional) | Plan de control, R&R/MSA, dimensional, capacidad, ensayos, PSW (firma), IMDS, CSR firmados |
| **Logistica** (Luciano Lo Castro, Responsable de Logistica) | Paletizado y firma de proveedor de la SLT |

Lo de otra area **no se le lleva a Fak como tarea suya** (regla `autonomy-contract.md` §F). Cuando
llega material de Calidad (MSA, dimensional), se le **reenvia a Calidad** — Fak: *"eso se lo reenvio
al depto de calidad, Ceci, Agustin, para que revisen ese punto del PPAP y lo hagan ellos"*.

## 1. La carpeta: el formato del cliente, no el APQP de 34 casilleros

Fak, 23/09/2026: *"en el mismo lugar donde esta el actual APQP elimina las carpetas del APQP para
dejar el formato de Capuana que me paso, o sea el nuestro estaba mal"* · *"le mandamos todo menos el
input"*.

```
Y:\BARACK\CALIDAD\DOCUMENTACION SGC\PPAP CLIENTES\REYDEL-SMRC\<pieza>\<variante>\APQP\
   00 - FUP Check list … 18 -PSW Warrant     <- las 29 carpetas del PPAP Standard Folder de SMRC:
                                               TODO lo que esta aca se le manda al cliente
   1. Imput                                  <- NO se manda: lo que llego de afuera, TAL CUAL
```

- En `1. Imput` va el material del cliente con el nombre que trae (regla `documentacion-oficial.md`),
  un mail por carpeta (`Mail <SQE> <dd-mm-aaaa> - <asunto>\`) y su zip **descomprimido al lado**.
  Las plantillas y ayudas de SMRC (checklist, PSW en blanco, run at rate, "como llenar SLT") quedan
  ahi, no en el paquete. Tambien van a Imput la carta de nominacion, la OC, cotizaciones, fichas
  tecnicas, el plan de validacion y el Global Supplier Manual.
- En las carpetas del paquete va **PDF no editable** (Fak: *"con los archivos listos en pdf no
  editables"*). El editable vive en `Gestion Ingenieria`: flujograma en `8. Flujograma Sinóptico`,
  AMFE en `13. Analisis del modo de falla…\2. AMFES DE PROCESO\SMRC\`, SLT en
  `17. Fichas de embalaje\2- CLIENTES\SMRC\<pieza>\<variante>\` (Fak: *"el editable nosotros"*).
- La raiz lleva un `_LEEME` que dice como esta armada (el del P21 naranja sirve de modelo).
- Reestructurar un legajo existente: `scripts/_archive/2026-09-23-ppap-p21-naranja/reestructurar_legajo.py` es el molde
  (sin borrados; las copias sobrantes, verificadas por hash contra su maestro, y los casilleros
  vacios van a la Papelera por PowerShell — el hook de borrado masivo frena `rmtree`/`remove`).

## 2. Que va en cada carpeta del paquete

| Carpeta | Que va | Quien |
|---|---|---|
| 01a Drawing | El plano del cliente (PDF) | cliente |
| 01b LSC | El LSC **vigente** — ojo: el paquete de SMRC puede traer una version vieja (el del P21 traia la v0 sin la SC 1.6; la valida era la v1 del 13/07). Se pregunta al SQE cual manda | cliente |
| 03 FCR Signed | El functional check report que firmo el cliente: **vuelve en el paquete** aunque lo haya mandado el (Fak: *"por una cuestion de formalidad se lo debemos mandar"*) | cliente |
| 05 Process Flow | Flujograma en PDF (skill `flujogramas`) | Ingenieria |
| 06 Process FMEA | AMFE en PDF (§4) | Ingenieria |
| 07a/07b/07c | Planes de control / safe launch. SMRC manda uno "generico" para actualizar | Calidad |
| 08 R&R · 09 Dimensional | MSA y RMCP de la variante anterior "para actualizar": se reenvian a Calidad | Calidad |
| 11 Capability · 17a Run-at-Rate | Estudio de capacidad y Performance Test Corp-8.3.4: **por sectores**, con la demanda de la carta (volumen anual y capacidad semanal); dudas al SQE | Ingenieria + planta |
| 13 AAR | El AAR aprobado (puede ser del panel de puerta completo; vale si aprueba el material/color de esta pieza): vuelve en el paquete | cliente |
| 14/15 Muestras | Muestra patron firmada internamente + foto al cliente, **una por part number** (RH y LH) | Calidad |
| 17 CSR signed | Requisitos especificos del cliente firmados (los tiene Calidad; guardarlos tambien en el SGC) | Calidad |
| 17b SLT | Las SLT en PDF (§3) | Ingenieria + logistica |
| 17d IMDS · 17e auditoria de proceso | IMDS; auditoria VDA 6.3 **o una interna** | Calidad |
| 18 PSW | Si el SQE manda un PSW mas avanzado que el otro, **los dos part numbers quedan igual de avanzados** | Calidad (firma) |

## 3. La SLT (Supplier Logistics Template & Packaging Form)

```bash
python scripts/_sltSmrc.py --base "<SLT de la variante anterior>.xlsx" --dest "<Gestion Ingenieria\17. Fichas de embalaje\...>" \
   --codigo <PN> --nombre "<ACCOUDOIR P21-AV.D-… ASSY>" --proyecto "P21 HILO NARANJA" \
   --volumen-anual 4000 --capacidad-semanal 270 --vida 1 --peso-kg 0.265 \
   --contacto "Luciano Lo Castro" --telefono 1154123104 --mail llocastro@barackmercosul.com \
   --pdf-dir "<APQP\17b - SLT…>"
```

- **De donde sale cada dato**: la **carta de nominacion (SNL)** da el volumen anual POR CODIGO
  (-> F.P.V., "+/- 15 %"), la capacidad maxima semanal (-> C.P.V. = semanal / 5 × dias) y la vida del
  programa; la **balanza** da el peso (se pesa una pieza terminada de cada mano); **logistica** da el
  contacto y confirma el paletizado. Nada de eso se hereda de la base.
- 🔴 **Una SLT copiada de otra pieza arrastra la APROBACION de SMRC**: Packaging Form M79 = "J"
  (carita verde, "Validated") y las firmas de SMRC de la otra pieza. Sin parametros, el script deja
  el bloque como la plantilla en blanco (firmas "click here to sign", "L"). Fak, el 23/09, completo
  las firmas (proveedor Luciano Lo Castro; SMRC Alejandro Urbano, Marcos Gramajo, Fernando Carizza)
  y la carita verde antes de mandarla: si se repite, se pasa con `--firma-proveedor`,
  `--firmas-smrc` y `--estado J`, a conciencia.
- Lo que el SQE pregunta de la SLT es el **paletizado** (*"si es con mas cajas o solo una caja, ver
  con tu log"*): se confirma con logistica antes de mandar.
- Heredado de la base que conviene revisar con logistica: medidas de la unidad de carga, tara de la
  caja, Expendable vs "Durable provided by SMRC" de la carta, incoterm (DAP vs EXW), fotos.
- La hoja esta protegida: el telefono va como texto (si no, sale "5,49E+12").

## 4. AMFE y flujograma para el paquete

Todo lo de `amfe.md`, mas lo que costo aprender en este PPAP:

- **AP con la tabla oficial** (SETEC pag. 116-118, `apTable.ts`). Ningun **TBD**: un control que no
  existe es "Sin control preventivo" con O=10. Los controles **sin citas de fuente** entre parentesis.
- Una **caracteristica del cliente va donde se GENERA segun su dibujo** en el LSC, no por su nombre
  (la SC 1.6 "limite corte TEP" era del troquelado, no de la mesa de corte).
- **Reprocesos conocidos declarados de entrada** (skill `flujogramas`), cada uno colgando del control
  que lo detecta y volviendo a el, como caminos alternativos. Fak: *"cuando inicia un proyecto
  mencionar todos los reprocesos conocidos y posibles, asi despues no son cambios de proceso"*.
- **Inspeccion final = muro de calidad** (100 % hasta N piezas buenas de la carta), una sola OP.
- El Excel del AMFE va con **la caratula que acomodo Fak** para imprimir (margen y area B2:M29): el
  export pelado la pierde (`scripts/_archive/2026-09-23-ppap-p21-naranja/armar_final.py` pega su caratula sobre la hoja AMFE nueva).
- **PDF del AMFE**: hoja AMFE en A3 apaisado, ajuste a 1 pagina de ancho y **filas de titulo
  repetidas** (13:14); comprobar peso y legibilidad. **PDF del flujograma**: la imagen se inserta con
  `stream=` (con `filename=` PyMuPDF armo 106 MB y Exchange lo rechazo).
- Cotejo final **flujograma <-> AMFE** sobre los archivos del servidor: mismos numeros, nombres y
  marcas por operacion (`scripts/_archive/2026-09-23-ppap-p21-naranja/cotejo.py` es el molde; `pdfs_capuana.py` al lado arma los PDF).

## 5. Antes de mandar: auditoria independiente

Fak: *"audita con agentes independientes antes de mandar el mail"*. Tres agentes en paralelo:

1. `auditor-cliente` sobre AMFE + flujograma, contra la norma (SETEC, IATF), sin las reglas del repo.
2. Uno sobre las SLT: diff contra la base, mano (AV.D = RH, AV.G = LH), volumen contra la carta,
   restos de la variante anterior, **bloque de validacion**.
3. Uno sobre el mail: destinatarios resueltos, borradores duplicados, adjuntos (que sean de ESTA
   pieza, tamaño), firma, y que el texto conteste lo que pidio el SQE.

Cada hallazgo se verifica contra la fuente antes de corregir (los agentes traen falsos positivos).

## 6. El mail al SQE

- **Se responde dentro de la conversacion del SQE**, no con un mail nuevo: `python
  scripts/_mailResponder.py <json>` (ReplyAll, adjuntos, `cc_extra`; solo Display y Save).
- Copias del 23/09: las del mail original (Manuel Meszaros, Nicolas Perez) + Carlos Baptista +
  logistica (Luciano Lo Castro).
- Texto corto, voz de Fak (`_vozFak.mjs`): que se adjunta y la respuesta puntual a lo que pregunto
  (ej. el paletizado). El FCR y el AAR se "devuelven".
- Sale **solo con el OK de Fak para ese mail**: `python scripts/_mailEnviar.py --buscar "<asunto>"
  --enviar` (regla `mail-envio.md`). Si hay que corregir algo ya mandado, Fak lo arregla con el SQE
  (el 23/09: *"Capuana nos va a pasar un mail y sobre ese volvemos a enviar como si el anterior
  nunca hubiese existido"*).
