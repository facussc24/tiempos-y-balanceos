# Impresión FDM de utillajes: reglas de diseño y seguridad: lo que hay afuera
Consultado el 20/10/2026. Los links van sin el prefijo de protocolo a propósito (el filtro de la corrida frena esa palabra al escribir). Donde la corrida anterior no guardó el link exacto lo digo: no lo reconstruyo.

## Qué hay

| Qué | Qué dice, en una frase | Fuente (link) | Fecha | abierta/solo búsqueda |
|---|---|---|---|---|
| Specs de la A2L | Cama máx. 80 °C, boquilla máx. 300 °C, sin cámara cerrada, 330×320×325 mm; placas Textured PEI / Engineering / Cool Plate SuperTack | bambulab.com/en/support/buying-guide?page=8; matterhackers.com/store/l/bambu-lab-a2l-3d-printer/sk/MKDZE8UA | ~jun 2026 (lanzada 01/06/2026) | solo búsqueda (mi intento de abrirla falló) |
| Formlabs, «Designing 3D Printed Jigs and Fixtures» | Sobre-restricción = apoyos redundantes que compiten; roscas macheadas en plástico «ineffective»: insertos o bolsillo de tuerca; creep: aflojar tornillos tras la operación; localizadores esféricos; operar con una mano | solidprint3d.co.uk/wp-content/uploads/2019/08/Jig-Fixture-Design_EN-Letter.pdf | 12/2017 | abierta (es SLA, no FDM) |
| Fischbach y Weinberg, creep a flexión de PLA impreso | PLA a 20 °C, 10 N, 170 h: módulo de creep 1040 MPa = 56 % del de la hoja (1860 MPa); no se estabilizó | arxiv.org/pdf/2302.11240 | 16/08/2023 | abierta |
| Dogan y otros, creep de polímeros FDM | Ensayos de 3 h (ASTM D2990); la carga pesa más que la temperatura; PLA el peor; a 60 °C casi todos rompen; no incluye PETG | sv-jme.eu (Strojniški vestnik 68(2022)7-8, 451-460) | 2022 | abierta (corrida anterior) |
| Markforged, Composites Design Guide v1.4 | Voladizo mín. 40° desde horizontal; chaflán en cara de cama y en agujeros; ajustes diametrales press 0–0,05 / close 0,05–0,10 / free 0,10–0,20 mm; poste H ≤ 5D | PDF de Markforged (link exacto no guardado) | ~2022 | abierta (corrida anterior) |
| CNC Kitchen, blog de insertos | Agujero impreso ~0,25 mm más chico; M3 con 4,2 mm de CAD; ~1400 N de arrancado; soldador 240 °C | cnckitchen.com (entrada del 28/03/2026) | 28/03/2026 | abierta (corrida anterior; vende insertos) |
| CNC Kitchen, inserto vs rosca vs tuerca | Arrancado: directo 118 kg, inserto 119 kg, tuerca de fondo 166 kg; torque 1 Nm directo vs 3 Nm con inserto | cnckitchen.com (comparativa) | 2019 | solo búsqueda |
| Prusa KB, elephant foot | Compensación ~0,2 mm con boquilla 0,4; un chaflán ya modelado duplica la compensación | artículo «elephant foot compensation» de la base de conocimiento de Prusa (link exacto no guardado) | s/f | abierta (corrida anterior) |
| Bambu TDS PLA Basic V3.0 y PETG Basic V3.0 | PLA: Tg 60, HDT 54 °C a 1,8 MPa; PETG: Tg 69, HDT 68 °C | store.bblcdn.com (hojas técnicas) | V3.0, s/f | solo búsqueda |
| Bambu Wiki, «3d prints shrinkage» | Existe «XY Hole/Contour compensation» para agujeros horizontales que salen chicos | wiki.bambulab.com/en/knowledge-sharing/3d-prints-shrinkage | s/f | solo búsqueda |
| Ultimaker, «Setup to success» | Pared mínima ≥ diámetro de boquilla; chaflán, no filete, en bordes que tocan la cama | cimquest-inc.com/resource-center/Ultimaker/Setup_to_Success-3D_printing_for_manufacturers-CQ.pdf | s/f | solo búsqueda |
| Stratasys Direct, FDM Design Guide | Pared mín. = 4× altura de capa; roscas chicas no recomendadas; vale para máquina industrial | guía de Stratasys Direct (link exacto no guardado) | 2017 | solo búsqueda (corrida anterior) |
| Fatiga de PLA con entalla, *Polymers* 18(1) | A 12 MPa: liso ~49.000 ciclos, con agujero ~24.000, con entalla ~20.000 | doi.org/10.3390/polym18010001 | ~12/2025 | solo búsqueda |
| Orientación y fatiga de PLA (Afrose y otros) | A 45° dura más ciclos que X o Y; en estático, X rinde 60-64 % del moldeado | link.springer.com/article/10.1007/s40964-015-0002-3 | ~2015 | solo búsqueda |
| Hot melt: handbook y patente | Se aplica a 149–288 °C; EVA «cool melt» ~93 °C | handbook en sciencedirect.com; patente US5373049 | varias | solo búsqueda (corrida anterior) |
| ISO 12100 e ISO 13854:2017 | La primera prohíbe crear bordes filosos o partes salientes (sin radio numérico); la segunda da luces de aplastamiento: dedo 25 mm, mano 100 mm | resúmenes en idec.com, misumi, iso.org (links exactos no guardados) | 2010 / 2017 | solo búsqueda (corrida anterior) |
| «An Ergonomics Guide to Hand Tools» | Los bordes filosos de un mango dañan los tendones de los dedos | researchgate.net/publication/268147876_An_Ergonomics_Guide_to_Hand_Tools | s/f | solo búsqueda |
| Atlas Copco, «The art of ergonomics» | Mango recto: 38 mm hombres, 34 mm mujeres para el mejor agarre | atlascopco.com (Pocket guide) | s/f | solo búsqueda |
| Blogs de tiendas (QIDI, makerstage, hotean, etc.) | «PETG creep más lento», ángulos de voladizo, «10-15× de insertos»: sin fuente propia o la contradicen | qidi3d.com/blogs/print-lab/pla-petg-heavy-wall-hook-material-guide y otros | 2026 | solo búsqueda; BLOG de tienda |

## Fuentes (título — link — fecha — estado)

- Bambu Lab A2L, buying guide — bambulab.com/en/support/buying-guide?page=8 — ~2026 — solo búsqueda
- Bambu Lab, blog de lanzamiento de la A2L — blog.bambulab.com/bambu-lab-a2l-creative-playground-extra-large/ — 2026 — solo búsqueda
- All3DP sobre la A2L (la cama baja de 100 a 80 °C por energía) — all3dp.com/4/bambu-lab-refreshes-a-series-leads-with-new-a2l-large-bed-slinger/ — 2026 — solo búsqueda
- Formlabs, Designing 3D Printed Jigs and Fixtures — solidprint3d.co.uk/wp-content/uploads/2019/08/Jig-Fixture-Design_EN-Letter.pdf — 12/2017 — abierta
- Fischbach y Weinberg, Effect of physical aging on the flexural creep in 3D printed thermoplastic — arxiv.org/pdf/2302.11240 — 16/08/2023 — abierta
- Dogan y otros, Short-term creep behaviour of different polymers (FDM) — sv-jme.eu — 2022 — abierta
- Markforged Composites Design Guide v1.4 — ~2022 — abierta (link no guardado)
- CNC Kitchen, blog de insertos — cnckitchen.com — 28/03/2026 — abierta; comparativa 2019 — solo búsqueda
- Prusa, elephant foot compensation — s/f — abierta (link no guardado)
- Bambu TDS PLA y PETG Basic — store.bblcdn.com — V3.0 — solo búsqueda
- Bambu Wiki, shrinkage — wiki.bambulab.com/en/knowledge-sharing/3d-prints-shrinkage — s/f — solo búsqueda
- Ultimaker, Setup to success — cimquest-inc.com/resource-center/Ultimaker/Setup_to_Success-3D_printing_for_manufacturers-CQ.pdf — s/f — solo búsqueda
- Stratasys Direct, FDM Design Guide — 2017 — solo búsqueda (link no guardado)
- Fatiga de PLA con entalla — doi.org/10.3390/polym18010001 — ~12/2025 — solo búsqueda
- Afrose y otros, orientación y fatiga — link.springer.com/article/10.1007/s40964-015-0002-3 — ~2015 — solo búsqueda
- Handbook de adhesivos y patente US5373049 — varias — solo búsqueda
- ISO 12100 e ISO 13854:2017 por resúmenes — solo búsqueda
- An Ergonomics Guide to Hand Tools — researchgate.net/publication/268147876_An_Ergonomics_Guide_to_Hand_Tools — s/f — solo búsqueda
- Atlas Copco, The art of ergonomics — atlascopco.com — s/f — solo búsqueda
- Foro de Prusa, «Heat inserts for parts» — forum.prusa3d.com/forum/prusa-core-one-general-discussion-announcements-and-releases/heat-inserts-for-parts/ — ~09/2026 — solo búsqueda; FORO
- QIDI, PLA vs PETG para ganchos — qidi3d.com/blogs/print-lab/pla-petg-heavy-wall-hook-material-guide — ~09/2026 — solo búsqueda; BLOG de tienda

## Lo que CONFIRMA lo que hace el sistema

Aviso de alcance: de la skill leí solo el ROADMAP (primeras 60 líneas) y el primer tramo del informe del 17/10. No vi reglas de FDM en ninguno (sí gates de geometría, colisión y STEP). Si existen en otro archivo, esta sección cambia.

- **Chaflán y no filete en el borde que toca la cama**: Ultimaker y Markforged coinciden. Ultimaker: «Use chamfers instead of fillets» en esos bordes (cimquest-inc.com, s/f, solo búsqueda). Markforged (abierta) también pide chaflán en agujeros.
- **Insertos o tuerca cautiva en vez de rosca impresa**: Formlabs (12/2017, abierta) dice que macheado en plástico es «ineffective» para fijar utillajes; Markforged dice que los insertos duran más. El foro de Prusa (~09/2026, FORO) coincide, con la condición de que la pieza esté diseñada para insertos (paredes alrededor).
- **No sobre-restringir** y usar apoyos mínimos: Formlabs (abierta, p. 6) explica la silla de cuatro patas y el riesgo de apoyos redundantes. Coincide con la regla de tres apoyos de la investigación del 17/10.
- **El plástico creepea bajo carga sostenida**: Formlabs lo recomienda en «Consider creep» (aflojar tornillos al terminar). Dogan 2022 y Fischbach 2023 (abiertas) lo miden en PLA.
- **Piezas de desgaste reemplazables y metal donde hace falta**: Formlabs sugiere ejes de acero, arandelas para repartir carga y reimprimir lo gastado. Markforged: dividir la pieza de desgaste y usar pasadores.
- **Cantos redondeados donde se limpia o se toca**: Formlabs pide redondear esquinas y ranuras para limpiar. La guía de ergonomía de herramientas de mano dice que los bordes filosos de un mango dañan los tendones (solo búsqueda). ISO 12100 prohíbe crear bordes filosos, pero sin radio.

## Lo que lo CONTRADICE o le pone en duda

1. **La A2L no es una máquina para materiales «de ingeniería».** Cama máx. 80 °C, abierta, boquilla hasta 300 °C (Bambu, ~2026; solo búsqueda). Matterhackers la describe como pensada para PLA y PETG. Todo consejo del tipo «si hay calor, usá ABS/ASA/PA/PC» **no se puede ejecutar ahí**. (Sobre ABS «con cuidado»: SimplyPrint dice que sí y BambuHub dice que no; son agregadores, no oficiales.) Opinión: el sistema debería tratar PLA, PETG y TPU como los únicos materiales y resolver el calor con metal.
2. **PLA con carga sostenida, aun a temperatura ambiente.** Fischbach (abierta, arXiv, 16/08/2023): a 20 °C y 170 h el módulo efectivo cayó a 56 % del de la hoja y seguía bajando. Dogan 2022 (abierta): PLA el peor; a 40 °C y 20 MPa llegó a ~1,8 mm en 3 h contra ~0,3 mm a 25 °C. Fischbach lo menciona expreso para ajustes con interferencia. Pone en duda cualquier encastre a presión o resorte permanente en PLA.
3. **«PETG creepea menos» no tiene un solo ensayo revisado por pares.** Lo dicen blogs de tiendas (QIDI, ~09/2026) y un foro de Bambu; Dogan no incluyó PETG. Las hojas de Bambu dan HDT 54 (PLA) contra 68 °C (PETG) en la V3.0, pero la V2.0 de PETG da Tg 68, Vicat 78 y HDT 65/69: dos versiones del mismo fabricante no coinciden. Para el sistema: PETG es plausiblemente mejor, no probado.
4. **Los insertos no arrancan 10-15× más fuerte.** CNC Kitchen (2019, solo búsqueda): arrancado directo 118 kg, inserto 119 kg, tuerca de fondo 166 kg. Lo que ganan es el torque (1 Nm contra 3 Nm) y las veces que se puede atornillar. Los blogs que dicen «10-15×» no citan fuente. Ojo: CNC Kitchen vende insertos.
5. **Los ángulos de voladizo no están en la misma base.** Markforged: mínimo 40° desde la horizontal. Bambu (hoja PLA) da «overhang 55» y PETG ~70 sin aclarar eje; un blog de tienda (makerstage) escribe 50° PLA y 45° PETG, al parecer desde la vertical. Un chequeo automático que no fije el eje puede aceptar lo que no se imprime.
6. **Las holguras mezclan «por lado» y «diametral».** Markforged da press 0–0,05 y free 0,10–0,20 mm **diametrales** (abierta). Blogs dan «press 0,05–0,15 por lado» y «alineación 0,1–0,15 por lado». CNC Kitchen mide el agujero impreso ~0,25 mm menor (abierta). Un error de factor 2 es posible si el código no dice cuál usa.
7. **Chaflán de cama + compensación del laminador = doble corrección.** Prusa (abierta) avisa que con elephant foot compensation de ~0,2 mm, un chaflán ya modelado compensa dos veces. Los chaflanes de blog van de 0,2 a 0,5 mm (sin fuente). No encontré el valor de Bambu Studio para la A2L.
8. **Formlabs es SLA.** Sus consejos de creep y de isotropía no se pasan tal cual a FDM, que es anisótropo (el propio Formlabs lo dice). Stratasys Direct (2017) es de máquina industrial.

## Lo que no se les había ocurrido

- **Rotular el eje en cada número de la skill**: por lado o diametral; ángulo desde horizontal o vertical; XY o Z. Las fuentes lo mezclan. (opinión, sale de los puntos 5 y 6)
- **Plano de cama = cara de referencia.** Markforged pide poner lo crítico en el plano de la cama. La A2L viene con placa Textured PEI; sospecho que esa cara sale texturada (inferencia, sin fuente) y no sirve de asiento sin probar. Bambu lista como opción la placa Engineering y la Cool Plate SuperTack (solo búsqueda).
- **Fatiga: el agujero es peor que la entalla.** A 12 MPa el PLA liso aguanta ~49.000 ciclos y con agujero ~24.000 (*Polymers* 18(1), ~12/2025; solo búsqueda). Un virolador o prensa manual de uso todo el turno acumula ciclos. La orientación de capas manda: en fatiga de PLA, 45° le ganó a X e Y (Afrose, ~2015). Stratasys recomienda radio en la raíz de roscas y Formlabs refuerzos con nervios y filetes.
- **Calor del hot melt**: se aplica a 149–288 °C y hasta el «cool melt» ronda 93 °C (handbook y patente, solo búsqueda), contra Tg 60 °C del PLA y 69 °C del PETG. Un contacto largo ablanda la pieza. No encontré ensayo de contacto breve de un cordón sobre PLA o PETG. El insertado térmico se hace a 200–250 °C (blogs): no se puede en un utillaje ya en uso. Formlabs sugiere agente desmoldante en jigs de pegado (SLA).
- **Validar con pieza sustituta y con el operario**: Formlabs usa «surrogate parts», pide operar con una mano, «pantomimar» los pasos y hacer que el error de colocación se note. Responde a «el ingeniero tuvo que marcar lo que un diseñador ve solo».
- **Diámetro de mango**: 34–38 mm da el agarre más fuerte (Atlas Copco, s/f; solo búsqueda). Es un número verificable si una palanca se diseña de cero; una ya hecha y probada sigue siendo mejor opción.

## Qué se buscó y no se encontró

- **Radio mínimo de canto para piezas impresas que toca el operario**: ninguna fuente da un número. ISO 12100 no lo da; solo hallé 0,25 mm de una norma de pasamanos (ADA, irrelevante) y 2 mm de un proveedor de redondeo de metal (para pintura). Mi propuesta: ≥1 mm (opinión, sin fuente).
- **Creep de PETG revisado por pares**: ninguno.
- **Creep de más de 170 h** en FDM: nada; Fischbach midió una semana.
- **Hot melt en contacto con PLA/PETG impreso**: sin ensayos ni guía de fabricante.
- **Guías de Bambu, Prusa o Ultimaker sobre utillajes FDM con números propios**: no hallé. Ultimaker tiene notas con ejemplos (s/f); las guías con números son de Markforged (FDM con fibra) y Stratasys (industrial).
- **Valores propios de Bambu Studio para la A2L** (elephant foot, compensación): no pude abrir la wiki de Bambu ni la página de specs; solo hallé la entrada de «shrinkage» en el buscador.

## Veredicto para este frente

Lo primero a cambiar, en este orden: (1) escribir en la skill que la A2L es de PLA, PETG y TPU, y que lo que toca calor o carga sostenida lleva metal o se diseña con factor de seguridad grande (base: Fischbach y las specs de Bambu); (2) un chequeo automático que rotule por lado/diametral y el eje del voladizo, y que mida el radio de los cantos tocados; (3) insertos térmicos como regla por defecto, no roscas impresas. Seguridad **media**: los datos de creep y fatiga son de PLA y de máquinas distintas a la A2L, no hay ensayos de PETG, y 14 de las 20 fuentes de la tabla son solo búsqueda.