---
name: beon
description: "Operar BeOn («el BeOn», «cargar en BeOn», el portal de VW del informe PPF, ex ISIR / muestras iniciales) — entrar, buscar los informes de Barack, leer estado, IMDS, anexos y la decision de VW, crear un informe, cargar o cambiar anexos, finalizar el registro y emitir a VW. Usar cuando haya que cargar, revisar o mandar un informe de BeOn, cuando VW devuelva uno («Rueckgabe»), o para cruzar BeOn con IMDS."
---

# BeOn — el informe PPF de VW

**Estado de esta skill** (version 2.1 del 14/10/2026): leer esta probado en el portal; de escribir se hizo una sola
cosa (reemplazar el PDF del IMDS en 2HC 881 901 RL1, sin emitir); finalizar registro y emitir salen de los videos y la
ayuda de VW y todavia no se hicieron.

**Fuentes y como se marcan.** [portal] = visto en vivo (13 y 14/10/2026, usuario D69851N).
[video NN] = video oficial de VW (seccion 11). [ayuda N] = tema N de la ayuda online (82 temas,
transcripcion en `4- MANUALES\Formula Q Piezas Nuevas Integral VW\`; es de antes de 2023).
[RN 13.2] = release letter V-13.2 (25/05/2023). [mail] = buzones.

## 0. Reglas antes de tocar

1. **Leer, buscar, abrir y pasar de pantalla es libre.** Todo lo que guarda, adjunta, borra,
   finaliza o emite se hace **con Fak mirando y con el OK de Calidad (Manuel) para ESE informe**.
   Hasta que se haga la primera vez, es "primera vez" (contrato §F).
2. **"Emision de Informe" manda a VW y vale como firma** [ayuda 4, 16]. Despues Barack ya no
   puede corregir nada: solo pedirselo al BTV de VW por mail [ayuda 17, 51].
3. La clave del portal la escribe la persona (Fak, Manuel o Luca). Nunca Claude.
4. **Traba en el navegador** (cada vez que carga una pagina de BeOn, antes de hacer clic): ver §10.
5. Para leer un informe no hace falta hacer clic en ningun boton de abajo: los menus de la
   izquierda y las pestañas de arriba solo navegan.

## 1. Entrar [portal]

1. Chrome → `https://lso.volkswagen.de/beon/`. Si no hay sesion, redirige al Login de VW
   (ID de perfil + contraseña; lo hace la persona). La sesion es del navegador, no de la
   pestaña. Dura al menos un par de horas con uso; de un dia para otro se vence.
2. Inicio: "QUASI-BeOn 14.5.5", usuario y **roles**. Ahi tambien el link de anexos
   obligatorios y el aviso de 150 MB.
3. Ayuda: `https://lso.volkswagen.de/beon-doc/onlineHelp/en/BeOn.htm` (la de `sso.` ya no anda).
   Videos y release notes: `https://lso.volkswagen.de/beon-doc/releasenotes/inhalt.html`.

## 2. Roles

| En pantalla | Sigla | Que puede |
|---|---|---|
| Registro externo | EE | Cargar en EN REGISTRO y "Finalizar registro" [ayuda 4, 15] |
| Responsable registro externo | VEE | Revisar en EN LIBERACION y **emitir a VW** o devolver al EE [ayuda 4, 16] |

El usuario de Fak tiene los dos [portal]. Con los dos, en EN REGISTRO aparecen juntos
"Finalizar registro" y "Emision de Informe" [portal]. Al emitir, el contacto del informe pasa a
ser el que emitio (el 14/10 los IP PAD pasaron de "Nieve, Marcelo" a "Meszaros, Manuel")
[portal; que sea el que emitio es deduccion].

## 3. Estados [portal + ayuda 15-22]

| Estado | Quien | Botones que aparecen [portal] | Sale con |
|---|---|---|---|
| EN REGISTRO | Barack | Guardar · Finalizar registro · Emision de Informe · Borrar · Copiar · Nuevo Informe | Finalizar registro (pide "¿Seguro?") → EN LIBERACION [video EMPB] |
| EN LIBERACION | Barack | Guardar · Emision de Informe · Devolver al Registrador · Copiar · Nuevo Informe | Emision de Informe → EN ANALISIS |
| EN ANALISIS | VW (preparacion) | Copiar · Nuevo Informe (Barack ya no edita) | VW lo abre o lo devuelve |
| EN TRABAJO / EN ACEPTACION / PARA FIRMAR | VW | — | — |
| CERRADO | — | aparece "Decision cliente" en el menu | nota final |
| SUSPENDIDO | — | — | VW lo cancela |

- Una devolucion de VW llega de `beon@volkswagen.de`, asunto "Rueckgabe PPF Bericht", con el
  comentario del BTV [mail]. Va al contacto del informe.
- El informe vuelve en amarillo a la bandeja si VW lo devuelve [ayuda 23].

## 4. Buscar y leer [portal]

- **Busqueda**: "Nº de Proveedor Local." = `00B0ODKG/00` (Barack), primer casillero de "Nº pieza"
  = `2HC` (Patagonia) → Buscar. 10 por pagina. Clic en la fila = abre el informe.
- **Resumen de proceso** (bandeja): elegir rol abajo (`SUPPLEE` / `SUPPLVEE`) → Actualizar. La
  bandeja de "Responsable" muestra tambien informes EN REGISTRO (la ayuda dice que no) [portal].
- **Columnas utiles**: Estado + fecha del estado · MDB = estado del IMDS (Aceptar / Leido /
  Rechazado) · Decision del cliente.
- **PPF Bericht** (pestaña de arriba) = formulario EN BLANCO para crear un informe nuevo
  (Kunde/Lieferant + "Guardar"). Entrar no crea nada; Guardar si [portal].
- **Datos basicos** = certificados de muestras / lista de autorizacion (no se usa) [portal].

## 5. Pantallas de un informe (menu izquierdo) [portal]

Vista general · Datos del Proveedor · Datos piezas · IMDS / MISS Pieza individual ·
Autoevaluacion · Anexos-VDA · (Decision cliente, solo cerrado) · Conjunto Informes · Vista de
los anexos · Certificados · Sistemas añadidos · Formulario (Portada VDA, Hoja VDA, Abstimmung
zum PPF-Verfahren, Valoracion de riesgo) · Patron (plantillas de importacion).

**Datos piezas — obligatorios (*)** [video EMPB + portal]: N° informe del proveedor, cantidad,
N° y fecha de remito, **peso de muestra (g por pieza)**, N° de pieza, N° de plano, estado /
fecha de plano, nivel de acuerdo / fecha, nivel de generacion / herramienta, QPNI (LION) si/no.
Peso: avisa si difiere >20 % del calculado [ayuda 30].

**Datos del Proveedor**: motivo del PPF — "Art der PPF" (PPF Bericht - Neuteil / Aktualisierte
PPF-Dokumentation) y "Ausloser der PPF" (lista; ej. Werkzeug neu gefertigt, **Nachtrag MDB-Daten**
= agregado de datos de material, Zeichnungsanderung...). Planta 59, descarga "Sonderlager VWA".

## 6. IMDS en BeOn

- Se escribe solo el **N° de IMDS** (sin version) en "IMDS / MISS Pieza individual" [video EMPB].
- **BeOn toma solo la ultima version aceptada** [portal, PROBADO 14/10]: los 3 IP PAD aceptados
  en IMDS el 13/10 pasaron solos a "Aceptar(4)" en la Vista general al dia siguiente, sin cargar
  nada. La pantalla IMDS / MISS ya lo mostraba el mismo dia (version 2, 13/10).
- Estados [ayuda 51]: Leido(2) = VW procesando · Rechazado(3) · **Aceptar(4)** · No leido(5).
  Sin Aceptar(4) el informe no puede cerrar con nota 1: emitir recien con Aceptar(4).
- Aviso de VW en la pantalla: el IMDS debe estar cargado "un dia antes del envio" [portal].
- Si el informe ya salio y cambia el IMDS: el BTV lo corrige, se le avisa por mail [ayuda 17].
- Al 14/10/2026 los 17 informes de Patagonia ya tienen su N° de IMDS cargado.

## 7. Anexos (casilleros VDA 2020) [RN 13.2 + portal]

Desde el 25/05/2023 los anexos siguen VDA Tomo 2 (2020): 43 tipos en 6 bloques (antes 23).
**La lista de tipos 11-29 de la ayuda (tema 36) es vieja.**
1 Desarrollo del producto: 1.1 Especificaciones tecnicas · 1.2 Cambios de diseño aprobados ·
  1.3 Liberaciones de diseño · 1.4 Datos de material por IMDS · 1.5 AMFE de diseño
2 Desarrollo del proceso: 2.1 Flujograma · 2.2 AMFE de proceso · 2.3 Plan de control
3 Verificacion del producto: 3.1 Geometria/medidas · 3.2 Material · 3.3 Funcion · 3.4 Haptica ·
  3.5 Acustica · 3.6 Olor · 3.7 Aspecto · 3.8 Superficie · 3.9 Limpieza tecnica · 3.10
  Confiabilidad · 3.11 ESD · 3.12 Alta tension · 3.13 EMV
4 Validacion del proceso: 4.1 Caracteristicas especiales · 4.2 Laboratorio · 4.3 Muestras con
  etiquetado · 4.4 Muestra patron · 4.5 Capacidad de produccion · 4.6 Herramientas
5 Generales: 5.1 Requisitos legales · 5.2 Estado PPF de la cadena de suministro · 5.3 Lista de
  medios de control · 5.4 MSA · **5.5 Historial de pieza (obligatorio)** · 5.6 Contenedores ·
  5.7 Acuerdos de analisis · 5.8 Acuerdos de recalificacion · 5.9 Otros
6 Software: 6.1-6.11 (no aplica a Barack)
Como estan cargados en Patagonia y que falta: archivo de estado de los 17 informes.

### Cargar un anexo NUEVO [video "Neue Anlagen erzeugen"]
1. "Vista de los anexos" (o Anexos-VDA) → abajo, elegir el casillero en la lista → **Adjuntar nuevo**.
2. Se abre la ventana "Document Upload": **Denominacion resultado prueba (*)**, Version, Fecha,
   comentario → **Add documents** → elegir uno o varios archivos.
3. En la misma ventana se pueden sumar otros casilleros (lista + Adjuntar nuevo).
4. **Upload** sube todo; **Close** cierra sin subir.
Topes que dice la ventana (video 2016): **10 MB por archivo, 50 MB en total, nombre hasta 146
caracteres**. HOY la ventana de carga dice 100 MB por archivo y 100 MB en total (ver abajo).
Formato: PDF o JPG [video]. Planos: solo del proveedor,
sellados, nunca un plano VW [portal, inicio].

### Cambiar o reemplazar un anexo [video "Vorhandene Anlagen aendern"]
- **Retrabajar uno existente** (Edit existing) abre la misma ventana con lo cargado: se cambia
  version / fecha / comentario, **la X roja borra un archivo**, "Add documents" suma otro → Upload.
- Desde la lista de casilleros, el icono de editar de cada fila abre el detalle (valoracion,
  documentos con su X, "Nuevo") → **Guardar**.
- Para reemplazar el PDF del MDS: X roja al viejo + Add documents con el nuevo + Upload.

### Reemplazar un PDF — HECHO EN VIVO el 14/10/2026 (2HC 881 901 RL1, casillero 1.1 IMDS) [portal]
Funciona aunque el informe este EN LIBERACION.
1. Anexos-VDA → lapiz de la fila (ej. 1.1 IMDS) = `formSubmit('openVDAAnlageProduktEntwicklung[2]', true)`
   → ficha del anexo con su lista "Dokumente".
2. **Nuevo** (`newDocumentMultiUpload()`) abre una VENTANA APARTE de Chrome que Claude no maneja.
   Se intercepta `window.open` (guardar la URL `PopUpProzessDokUploadMulti.do?...` en localStorage;
   la funcion tira error en `win.moveTo`, es normal) y se abre esa URL en una pestaña propia del
   mismo sitio.
3. Ahi: `file_upload` sobre el primer "Seleccionar archivo" → **Subir** → Estado "Correcto".
   Topes que muestra esa ventana HOY: **100 MB por archivo, 100 MB en total, nombre hasta 146
   caracteres** (el video de 2016 decia 10/50 MB).
4. Volver a la ficha (Anexos-VDA → lapiz): aparecen el viejo y el nuevo.
5. X roja del viejo = `buttonConfirm('deletePruefDoc[0]')` → BeOn muestra SU cartel "¿Realmente
   quiere realizar esta accion?" (no es el confirm del navegador) → **OK** (`buttonConfirmOk()`).
6. **Guardar** (`formSubmit('save')`). Verificar en "Vista de los anexos" que quede solo el nuevo.
⚠ El filtro del modo automatico de Claude Code frena la subida si el pedido no esta escrito con
palabras exactas en el chat (ej: "En BeOn, en el informe X, reemplaza el PDF del IMDS del casillero
1.1 por el nuevo y guarda, sin emitir"). Con esa frase de Fak paso sin frenos.
⚠ IMDS y BeOn cierran la sesion solos con ~1 h sin uso.

## 8. Crear un informe de cero [video "EMPB erfassen"]

1. Pestaña PPF Bericht → Tipo de informe (E - PPF compra), Planta (59), Lugar de descarga,
   Tipo y Motivo (Ausloser), comentario, N° de proveedor local → **Guardar** (se crea, queda
   EN REGISTRO y aparece el menu izquierdo).
2. Datos piezas → obligatorios (§5) → Guardar.
3. IMDS / MISS → N° de IMDS → Guardar (muestra el estado de MISS).
4. Autoevaluacion → producto y proceso (cumple / no del todo / no / N/A) → Guardar.
5. Anexos → §7 (minimo 5.5 Historial de pieza).
6. Vista general → **Finalizar registro** → "¿Seguro?" → EN LIBERACION.
7. (VEE) revisar → **Emision de Informe** → EN ANALISIS. O "Devolver al Registrador".
8. Formulario → **Portada VDA**: imprimir y mandar con las piezas y el remito [ayuda 16; portal].
Copiar un informe existente (boton Copiar) es la otra forma [ayuda 64]: no probado.

## 9. Como evalua VW [RN 13.2 + portal]

- Desde 2023 la nota es en dos pasos: cada casillero VDA "cumple / no del todo / no" y despues
  el PPF "apto o NO apto para la serie" [RN 13.2].
- Ejemplo real cerrado (2HC 885 900 C SIY, 08/09/2026, pantalla "Decision cliente"): Medicion 3,
  Material 6, Funcion 3, General 6 → "NICHT SERIENTAUGLICH - VORSERIENTAUGLICH" (apto solo
  preserie), "Nueva presentacion de homologacion necesaria". Pendientes que escribio VW: PSW de
  Tier 2, ajustar valores de diseño (espuma), audit TLD, plan de validacion, completar los
  documentos BeOn [portal].
- Checklist "BeOn 01S" de 32 puntos que usa VW Pacheco (mail 22/08, apoyabrazo): OC/carta de
  nominacion · cavidades · aprobacion del herramental · IMDS · % de proceso VW · historial de
  pieza · diseño VW liberado B · dimensional por cavidad (5 scan + 5 calibre) · flujograma con
  poka yoke · AMFE firmado · plan de control · embalaje · plan de validacion en Excel ·
  identificacion · poka yoke · matriz de habilidades · certificados de materia prima · ensayos
  cortos · factibilidad · Cp/Cpk · PPAP de subcomponentes · MSA · validacion · ensayos de diseño
  · liberacion de proceso · color/brillo/textura · **auditoria TLD (de Patagonia, no Amarok)** ·
  aprobacion y dimensional de medios de control · rastreabilidad · simulacion de inyeccion ·
  VW 52000 en su formato.

## 10. Que boton escribe [portal + videos]

| Boton | ¿Escribe? |
|---|---|
| Buscar, Reset, paginas, abrir informe, menu izquierdo, pestañas | NO |
| Actualizar (bandeja), Filter laden / reset | NO |
| Filter speichern | guarda un filtro propio (no probado) |
| **Guardar** | SI |
| **Finalizar registro** | SI → EN LIBERACION (pide confirmar) |
| **Emision de Informe** | **SI → a VW, vinculante** |
| **Devolver al Registrador** | SI |
| **Borrar** | **SI → borra el informe (solo EN REGISTRO)** |
| **Copiar / Nuevo Informe** | SI → crea otro informe |
| Adjuntar nuevo / Retrabajar uno existente / Upload / X roja | SI |
| Nuevo / Borrar todo / Importar Datos (autoevaluacion, conjunto) | SI |
| Exportar / Datos de Export. | descarga un archivo (pedir permiso) |
| Portada VDA / Hoja VDA | genera PDF (no probado) |
| Desconexion | cierra la sesion |

**Traba para leer seguro**: el archivo **`.claude/skills/beon/traba.js`**, pegado tal cual con javascript_tool en
cada pagina nueva de BeOn, antes del primer clic (desde el 17/10/2026; antes se reescribia a mano). Reemplaza
`window.confirm` por una funcion que anota el mensaje y devuelve `false`, envuelve `formSubmit` / `formSubmit2` para
que solo pasen `search`, `nextSearch`, `reset`, `changeCard`, `openEmpb[n]`, y corta tambien `buttonConfirm` /
`buttonConfirmOk`, el cartel propio de BeOn de §7 que no pasa por `window.confirm` (lo demas se corta y se anota en
`window.__trabaBeon.cortados`). Devuelve "traba puesta". Lo prueba `__tests__/scripts/beonTraba.test.mjs` sobre una
ventana simulada; en el portal todavia no se pego desde que es archivo. Recargar la pagina la saca. Para navegar: `cardSubmit('changeCard','selectedMainNavTab',
'nav_query'|'nav_overview'|'nav_empb'|'nav_stammdaten', true)`; abrir fila: `formSubmit2('openEmpb[i]')`.
Las capturas de pantalla del portal se cuelgan (Chrome): leer con el texto de la pagina.

## 11. Videos oficiales (vistos el 14/10 en el navegador, sin descargar)

`https://lso.volkswagen.de/beon-doc/releasenotes/version80/Videos/`:
- `EMPB erfassen_en.mp4` (5:33): crear informe de cero → §8. **Visto.**
- `Neue Anlagen erzeugen_Extern_en.mp4` (1:39): anexos nuevos → §7. **Visto.**
- `Vorhandene Anlagen aendern_Extern_en.mp4` (1:26): cambiar anexos → §7. **Visto.**
- `Sammelbericht erzeugen_en.mp4` (informe agrupado), `Sonderpruefbericht_Extern_de.mp4`,
  `BeOn-Benutzeroberflaeche_de.mp4`: no vistos (no hacen falta para Patagonia).
Los videos son de 2016-2017 (interfaz en ingles, nombres viejos: ISIR, "Send Report" =
Emision de Informe, "Send ISIR to internal authorisor" = Finalizar registro, "Back to creator" =
Devolver al Registrador). Se ven abriendo un `<video>` en una pagina de lso.volkswagen.de y
sacando capturas cuadro a cuadro.

## 12. Para practicar con Fak mirando (en este orden)

1. Formulario → Portada VDA de un informe (ver si abre o descarga).
2. En un informe EN REGISTRO de prueba elegido con Calidad: cambiar el comentario → Guardar.
3. Reemplazar el PDF del MDS en 1.1 por el de la version aceptada (Retrabajar uno existente). **Hecho el 14/10** (2HC 881 901 RL1, §7).
4. Completar un casillero vacio (Adjuntar nuevo).
5. Con Manuel: Finalizar registro → ver que controles salta → (si Manuel dice) Emision de Informe.

## No verificado

- Que hace "Filter speichern", la Portada VDA, Copiar.
- Cuanto dura la sesion sin uso.
