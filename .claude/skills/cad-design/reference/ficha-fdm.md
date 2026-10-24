# Ficha FDM — diseñar para imprimir en la Bambu A2L (y elegir el material)

Ficha de la casa, armada el 17/10/2026 (tanda 11). Cada regla lleva su fuente y cómo se leyó:
**ABIERTA** (se abrió la página o el PDF), **BUSCADOR** (solo el extracto, no alcanza para firmar), **CASA** (medido o
vivido en Barack, con la memoria que lo cuenta) o **A MEDIR EN LA A2L** (no hay fuente que valga para esta máquina).
Fechas de consulta: 15/10/2026 (`20-informes\afuera_3d.md`) y 17/10/2026. La máquina es la **Bambu A2L, boquilla 0,4,
PLA Lite** (el material de todos los días). Un número medido en otra máquina o con otro material se dice así, no se
traslada en silencio (`afuera_3d.md` K3).

**Regla de lectura:** toda holgura lleva escrita su UNIDAD — **por lado** o **al diámetro** — y el tipo de ajuste. Mezclarlas
es el error que la casa ya tuvo (regla `cad-3d.md` decía 0,3-0,5 «por lado», la memoria de roscas 0,50 «al diámetro»).

## 1. Orientación y resistencia (lo primero que se decide)

| # | Regla | Número | Fuente |
|---|---|---|---|
| O1 | La unión entre capas es lo débil: la carga principal (tracción o flexión) va **paralela a las capas**, nunca tirando de ellas | — | Stratasys Direct 2015 «the lowest strength is in the Z-direction for both tensile and shear» (ABIERTA, PDF, oakland.edu `fdm_design_guidelines_2017-1.pdf`) |
| O2 | Cuánto pierde parado: PLA en Prusa, capa 0,2: acostado ≈ 63 MPa, parado ≈ 31 MPa | ×0,5 | CNC Kitchen «Stop printing flat» (BUSCADOR, 15/10) |
| O3 | La hoja de Bambu PLA Basic da Z/XY = 35/39 en tracción pero **13,8/26,6 kJ/m² en impacto** (la mitad), con probetas recocidas 8 h a 55 °C | ×0,90 tracción, ×0,52 impacto | TDS PLA Basic V2.0 (ABIERTA, PDF, 17/10) |
| O4 | **Caso de la casa:** el tornillo de 7 mm impreso PARADO se partió bajo la cabeza, por la línea de capa, al primer empujón de costado; acostado no | — | CASA, memoria `project_tornillo_cabeza_ancha_impreso` (14/10) |
| O5 | Para diseñar se usa el cociente más bajo (O2) hasta tener una probeta propia de la A2L con PLA Lite | — | A MEDIR EN LA A2L |

## 2. Geometría imprimible

| # | Regla | Número | Fuente |
|---|---|---|---|
| G1 | Voladizo sin soporte: **45°** como regla segura; Bambu publica 55° para PLA | 45° / 55° | Hubs (ABIERTA, web) y TDS PLA Basic V2.0 (ABIERTA, PDF) |
| G2 | Puente: Bambu da 30 mm para PLA; Hubs pide < 5 mm para que no quede marcado. Un techo de cavidad es un puente: la casa limitó la luz a 25 mm | 30 / 5 / 25 mm | TDS PLA Basic V2.0 (ABIERTA); Hubs (ABIERTA); CASA `params_v10.json` («con 50 mm la primera capa descuelga») |
| G3 | Pared mínima: 4 × capa (Stratasys); con boquilla 0,4 un perímetro ≈ 0,45 mm y menos de uno no se imprime (Prusa); con carga 1,5 a 2 mm | mm | Stratasys DG FDM 07/2025 (ABIERTA, PDF); Prusa KB (ABIERTA, web); `afuera_3d.md` C8 |
| G4 | Pared medida real: en una Bambu X1C con PLA Basic, una pared nominal de 0,8 salió 0,75-0,78 | −0,02 a −0,05 mm | euspen ICE26126, jun. 2026 (ABIERTA, PDF) |
| G5 | Pines de menos de 5 mm salen solo de perímetros, sin relleno: agregar acuerdo en la base | Ø < 5 mm | Hubs (ABIERTA, web); CASA: pin del insert con acuerdo R1,2 (`project_pines_costura_cnc_insert`) |
| G6 | Cara de abajo (la que toca la cama): **chaflán**, no filete. Lo pone `cadlib.constructores.placa()`; lo mide `evals/banco3d/correctores/chaflan_cama.py`. Tamaño: A DECIDIR (`data/lenguaje_diseno.json`) | 45° | Prusa KB y Hubs (ABIERTA, web) |
| G7 | Esquina interna donde hay flexión: con radio, nunca viva (Kt 2,2 viva contra 1,2 con R ≥ 0,5·t). Ninguna fuente abierta da un radio mínimo para FDM; el 0,5-0,75·t de los buscadores es de inyección | R ≥ 0,5·t | CASA, `cad-3d.md` GATE 4 (FEM propio, memoria `reference_fem_y_simulacion_3d`); fuente externa: SIN FUENTE |
| G8 | Texto en relieve ≥ 0,5 mm de alto, grabado ≥ 0,5 mm de profundo, letra ≥ 3,5 mm (5 recomendada); con trazo < 0,8 mm la casa no lo grabó (v14) | mm | Xometry (ABIERTA, web); CASA (memoria `project_uppertrim_pisador_utillaje`) |

## 3. Medidas, holguras y compensación

| # | Regla | Número | Fuente |
|---|---|---|---|
| M1 | Lo que alcanza una FDM de escritorio: ±0,1 a ±0,3 mm (≈ IT11 a IT14); IT7 solo con calibración iterativa y medición en CMM | ±0,1-0,3 mm | euspen ICE26126 (ABIERTA, PDF) |
| M2 | En la X1C con PLA Basic, sin compensar: XY sale ≈ 0,12 mm chico, Z ≈ 0,05 mm alto | −0,12 / +0,05 mm | euspen (ABIERTA). **En la A2L: A MEDIR** |
| M3 | Los agujeros verticales salen chicos; si el agujero es crítico se imprime chico y se escaria | — | Stratasys DG 2025 (ABIERTA, PDF) |
| M4 | Compensación de agujeros de Bambu Studio: el valor entra **como radio** (cambia el diámetro el doble) | mm por lado | Foro/wiki de Bambu (BUSCADOR; la wiki da 402). **Lo que trae el perfil de `laminar_bambu.py`** (proceso «0.20mm Standard @BBL A2L», leído el 17/10 en `%APPDATA%\BambuStudio\system\BBL\process`, siguiendo la herencia): `xy_hole_compensation` **0**, `xy_contour_compensation` **0** (los dos de `fdm_process_common`; ningún perfil de la A2L los cambia) y `elefant_foot_compensation` **0,15** (de `fdm_process_single_0.20`). O sea: hoy el laminador NO compensa los agujeros. Cuánto se achica un agujero en la A2L: A MEDIR (M8) |
| M5 | Pieza móvil: arrancar con 0,3 mm (Prusa); «segura» 0,5 mm (Stratasys F370) | mm, **al diámetro** según la fuente no lo aclara: tratar como al diámetro | Prusa KB (ABIERTA, web); guía UConn/Stratasys (BUSCADOR) |
| M6 | Lo que entra en un vano (regla de la casa): **0,3 a 0,5 mm por lado** | por lado | CASA `cad-3d.md` (validado en utillajes de agosto) |
| M7 | Una holgura del orden del error de la impresora no se ajusta rediseñando: se miden 3 testigos del mismo archivo primero (GATE 5) | — | CASA `cad-3d.md` GATE 5 (gancho de mochila, 22-24/08) |
| M8 | La probeta de tolerancias de la A2L con PLA Lite **no está hecha**: es la deuda que más números de esta ficha destraba. Formato publicado: anillo de 5 mm de alto, pared 0,8, en 5 / 10 / 15 / 20 / 25 mm | — | euspen (ABIERTA); A MEDIR EN LA A2L |

## 4. Roscas, tuercas e insertos

| # | Regla | Número | Fuente |
|---|---|---|---|
| R1 | Rosca impresa: no bajar de M5; paso 1,0; chaflán de entrada 45° × 0,8-1,5 mm; holgura **0,50 al diámetro** | mm | CASA, memoria `reference_roscas_impresas_3d` |
| R2 | Tuerca impresa: altura **≥ D** (Leo; y «cuanto más alta, más agarre»). Una ISO 4032 de acero mide 0,83-0,85·D de M6 a M10 (M5 ≈ 0,94·D; M3-M4 ≈ 0,80·D); la de plástico pide más porque el plástico aguanta menos. **Lo frena `make_screw_nut.py`** desde el 17/10: con `--nut-h` menor que `--major` no modela, salvo `--tuerca-baja "<motivo>"` (queda en el `_datos.json`); test `test_fijaciones.py` | ≥ 1,0·D | Leo (`tuerca y tonrillo.txt`, 13/10); fasten.it reproducción de ISO 4032 (ABIERTA, 15/10) |
| R3 | Largo de rosca en plástico: **1,5·D** (memoria) contra **2,5·D** (blog sin norma): no reconciliado | ×D | `afuera_3d.md` K1. **A MEDIR EN LA A2L** con una pieza de prueba |
| R4 | Los primeros milímetros de una rosca impresa no toman (el tornillo de 7 mm validado no enrosca hasta meterlo unos mm): el largo útil se cuenta sin ese tramo | mm (medir en el STEP) | CASA, Fak 16/10 (memoria del tornillo) |
| R5 | Con carga o par: tornillo y tuerca de acero, el plástico fuera del camino de la carga | — | CASA, memoria de roscas |
| R6 | Agujero para roscar en la pieza: no menor a 3,8 mm; pared alrededor de un inserto ≥ 2,03 mm más allá de su diámetro exterior | mm | Stratasys DG 2025 (ABIERTA, PDF) |
| R7 | Inserto a calor M3: agujero 4,0 (Ruthex) / 4,1 en el CAD (sale 0,1 chico); con par o apertura frecuente, inserto con pin anti-giro | mm | CNC Kitchen (ABIERTA, 15/10); CASA `SKILL.md` §4 |

## 5. Materiales: cuándo cada uno

Valores de las hojas técnicas de Bambu (probetas recocidas, 100 % de relleno). Fuente: TDS V2.0 de cada material vía
el distribuidor additive-x y el CDN de Bambu (ABIERTA, PDF, 17/10; la wiki de Bambu da 402). **Hay versiones de hoja
con números distintos** (PLA Basic V3.0: 35/31 MPa): se usa el rango bajo.

| Material | Tracción XY / Z (MPa) | HDT 0,45 MPa (°C) | Vicat (°C) | Cuándo |
|---|---|---|---|---|
| **PLA Lite** (el de todos los días) | 32 ± 5 (tienda) | **SIN DATO** | **SIN DATO** | Utillajes a temperatura ambiente y sin carga sostenida. Sin hoja oficial: no se supone igual al Basic |
| PLA Basic | 39 / 35 | 57 (54 a 1,8 MPa) | 57 | Igual que el Lite; Tg 60 °C |
| PETG Basic | 48 / 39 | 69 | 78 | Más impacto y algo más de calor (+12 °C sobre el PLA); agua |
| ABS | 41 / 32 | 87 | 94 | Calor; se alabea y huele al imprimir; pide cámara 45-60 °C |
| ASA | 52 / 35 | 100 | 106 | El salto real de temperatura de la lista y UV; pide cámara 45-60 °C |
| TPU 95A HF | 27 / 22 | — | — | Almohadilla, tope que no marca, agarre; alargamiento > 650 % |

| # | Regla | Fuente |
|---|---|---|
| T1 | **PLA cerca del calor:** bajo carga se deforma cerca de 54-57 °C (HDT) y la transición vítrea es 60 °C. Un utillaje que toca hot melt recién aplicado o va cerca de la hot press **no se decide sin medir la temperatura en el punto de apoyo** (termocupla o pirómetro en planta): hoy es TBD | TDS PLA Basic V2.0 (ABIERTA) |
| T2 | Si la temperatura medida supera el Vicat de un material, ese material no sirve ni sin carga | ídem, Vicat de cada hoja |
| T3 | Si la A2L imprime bien ASA o ABS **no está verificado** (las hojas piden cámara de 45-60 °C; un tercero los da como «borderline») | SimplyPrint (BUSCADOR); A MEDIR EN LA A2L |
| T4 | **Creep:** PLA impreso a 30 °C con 10 MPa sostenidos rompe a las 723 h, con 20 MPa a las 53 h; con los filamentos a 45° de la carga, 10 veces antes. En 3 h a 25-40 °C no se ve nada: un ensayo corto no prueba un utillaje que queda cargado | Molina y otros 2018, UTN Bahía Blanca, Matéria 23(2) (ABIERTA, PDF); Dogan 2022 (ABIERTA, PDF) |
| T5 | **Fatiga:** límite a 2·10⁶ ciclos ≈ 10 % de la resistencia a tracción, casi sin efecto de la orientación (≈ 3,5 MPa en PLA, cuenta mía). La casa usa ε ≤ 0,35 % para un elástico impreso | Ezeh y Susmel 2019 (ABIERTA, resumen); CASA `cad-3d.md` GATE 4 |
| T6 | Un filo impreso no corta como acero: **ninguna fuente lo avala**; la práctica publicada es portacuchilla impreso + hoja de acero | `afuera_3d.md` C11 (BUSCADOR); SIN FUENTE para el filo de PLA |

## 6. Lo que esta ficha no sabe (y quién lo contesta)

- La probeta de tolerancias de la A2L con PLA Lite (M2, M4, M8, O5, R3): se imprime con el pedido de Fak.
- HDT y Vicat del PLA Lite (T1): no hay hoja oficial; se pide al proveedor o se ensaya.
- La temperatura real del hot melt de Barack y de la superficie cerca de la hot press: se mide en planta.
- Las citas «(web)» del informe del 17/10 vienen de un lector de páginas: antes de firmar algo con ellas, se reabren.
  Las de Carr Lane, CCOHS y la hoja de PLA Basic se reabrieron el 17/10 y coinciden.

## 9. Aportes de agentic-3d-modeling — A MEDIR EN LA A2L antes de usarlos como regla

> Adaptado de evnchn-agentic/agentic-3d-modeling, MIT, commit 12e7c84 (licencia en `LICENCIA_agentic-3d-modeling_MIT.txt`); traído el 23/10/2026 (informe `03_skill_compare_y_dfam.md`). Los números del autor vienen de terceros que no se abrieron (AON3D, Yamawa, EJOT, BASF) o de «un incidente + primeros principios» (SKILL.md:135): entran como **A MEDIR**, no como regla firme. No se trajo lo que ya está con mejor fuente o criterio más estricto (anisotropía O1-O2, deformación admisible T5, holguras M5-M6).

| # | Regla | Número | Fuente |
|---|---|---|---|
| M9 | **Ajuste a presión (FDM):** interferencia radial, **por lado**. PLA en el valor bajo, PETG un poco más. Ranuras de alivio o agujero partido reducen el estiramiento que hace falta. «Alrededor de 1 mm» está 10-20 veces pasado y agrieta | 0,05-0,10 mm por lado (≤ 0,2 mm en total) | evnchn, SKILL.md:93 → cita AON3D / 3DPut (SECUNDARIAS, no abiertas) · **A MEDIR EN LA A2L con PLA Lite** |
| R8 | **Tornillo común que forma su propia rosca en la pieza impresa:** el agujero guía no baja del diámetro de flancos y apunta más cerca del diámetro mayor. La medida de broca de macho (≈ diámetro mayor − paso) es para CORTAR rosca con un macho, no para que la forme un tornillo. Imprimir una escalera de agujeros y quedarse con el que sujeta. Con entrada cónica. Solo aplica si alguna vez se atornilla directo al plástico (la ficha hoy usa roscas impresas o insertos, R1 y R7) | Ejemplo del autor, M14×2: guía ≈ 13-13,5 mm, no 12,0; material desplazado ≤ ~0,3-0,5 mm de radio en PLA | evnchn, SKILL.md:88 y :92 → cita Yamawa / CustomPartNet, EJOT Delta PT / Semblex (SECUNDARIAS, no abiertas) · **A MEDIR EN LA A2L** |
| G9 | **Una base plana grande y continua se despega** (alabeo): las primeras capas se levantan por contracción diferencial, primero por las esquinas vivas. Palancas, de mayor a menor: (1) **calar la base**: riel perimetral + costillas + apoyos macizos solo bajo los puntos de carga y ventanas abiertas en el resto; (2) esquinas del contorno redondeadas y chaflán en el borde de abajo; (3) orejas de ratón (discos finos que se cortan) integradas al modelo, no confiadas al brim del laminador; (4) partir lo muy grande en dos y unirlo. ABS, PETG, fibra de carbono y nylon alabean varias veces más que PLA | R ≥ ~8 mm en las esquinas; una huella maciza de ~200 mm ya es riesgo | evnchn, SKILL.md:125-133. **El autor dice (SKILL.md:135) que son «un incidente + primeros principios»** · A MEDIR EN LA A2L |
| G10 | **Control de alabeo sobre la malla EXPORTADA** (aviso, no freno): tomar las caras que tocan la cama (centroide z < ~0,6 mm y normal z < −0,5), sumar su área y tomar la caja de ese contorno. Avisar si el lado mayor pasa de ~150 mm **y** área ÷ caja pasa de ~0,6 (una placa maciza da ≈ 1,0; una base calada baja mucho). Redondear esquinas arregla el curvado de esquina, no el arco global | 150 mm / 0,6 / R 8 mm: **sin respaldo propio, A MEDIR** | evnchn, SKILL.md:135 |
| G11 | **Membrana de una capa:** una membrana de 0,2 mm que cierra el piso de un avellanado o agujero ciego hace que la impresora haga un **puente** sobre una cara plana en vez de un voladizo en cornisa; después se taladra | 0,2 mm (una capa) | evnchn, SKILL.md:123. Relación con G2 (el techo de una cavidad es un puente: la casa limitó la luz a 25 mm) |
