# Componentes normalizados y bibliotecas de piezas: lo que hay afuera
Consultado el 20/10/2026.

## Qué hay

| Qué | Qué dice, en una frase | Fuente (link) | Fecha | abierta/solo búsqueda |
|---|---|---|---|---|
| TraceParts (API Gateway + Product Explorer API) | Hay API con token, búsqueda y pedido de archivo CAD (`cadRequest` → `cadFileUrl`); tiene una sección propia para «entrenar LLM» con el catálogo. Está pensada para que un fabricante la meta en su web; hace falta login y ticket. | https://developers.traceparts.com/reference/developer-hub | 23/10/2025 | abierta |
| TraceParts `cadRequest` | Cada pedido exige un email de usuario y el aviso dice que todo intento queda registrado en producción. | https://developers.traceparts.com/reference/post_v3-product-cadrequest | s/f (~2025) | solo búsqueda |
| TraceParts, toggle clamps (Kipp, Ganter, Destaco) | Descarga gratis en STEP, STL, CATIA y más formatos, por la web. | https://www.traceparts.com/en/search/traceparts-classification-mechanical-components-jig-and-fixture-construction-clamping-toggle-clamps?CatalogPath=TRACEPARTS%3ATP01007002004 | s/f | solo búsqueda |
| TraceParts, ficha Kipp | La ficha trae código de fabricante, EAN, ECLASS, UNSPSC, fuerzas de sujeción y cotas: sirve de molde para catalogar. | https://www.traceparts.com/en/product/kipp-heinrich-kipp-werk?CatalogPath=KIPP%3A21556&Product=27-05514656-657573 | s/f | solo búsqueda |
| McMaster-Carr Product Information API | Existe, con STEP vía `/v1/cad`, pero solo para clientes aprobados, con certificado, suscripción por producto con tope diario y CAD con límite de velocidad. | https://www.mcmaster.com/help/api/ | 29/10/2019 | abierta |
| 3Dfindit / PARTcommunity (CADENAS) | Buscador de 6.000+ catálogos; para toggle clamps lista 21 fabricantes (Ganter 341 modelos, norelem 132); bajar exige login. La API que anuncian es para fabricantes. | https://www.3dfindit.com/en/keywords/toggle-clamp ; https://partsolutions.com/ecatalog/ | s/f | solo búsqueda (la página abierta vino vacía) |
| Misumi | Descarga con login; configurador en pasos de 0,01 mm; formatos nativos, incluido CATIA V5 (`.catpart`) y macro `.catscript`. No vi API pública. | https://us.misumi-ec.com/guide/category/ecatalog/use_cad.html ; https://us.misumi-ec.com/guide/category/ecatalog/file.html | s/f | solo búsqueda |
| Misumi inCAD Library | 300+ ejemplos de aplicación con CAD; los datos solo se pueden usar «for designing your machine». | https://us.misumi-ec.com/us/incadlibrary/ | s/f | solo búsqueda |
| norelem y Kipp (tiendas propias) | «You must log in» para bajar CAD; precios a la vista (clamp norelem 05020-081: 23,25 EUR). | https://www.norelem.de/en/Product-overview/Flexible-standard-component-system/05000/Toggle-clamps/Toggle-clamps-vertical-with-horizontal-foot-and-full-clamping-lever/Toggle-clamp-horizontal-foot-steel-galvanised/p/05020-081 | s/f | solo búsqueda |
| Kipp, página CAD | Biblioteca completa en un solo archivo de 7,2 GB, gratis, hecha con CADENAS. (Intenté abrirla: acceso denegado.) | https://www.kipp.com/gb/en/Download/CAD-data.html | s/f | solo búsqueda |
| Destaco | Pestaña «CAD / Download» y configurador por ficha de producto; también está en TraceParts y 3D ContentCentral (carga 2016). | https://www.destaco.com/resources/cad-help | s/f | solo búsqueda |
| Bosch Rexroth | Plug-in FRAMEpro (1.500 productos), solo para Inventor y SolidWorks; en TraceParts hay perfiles en formato CATIA V5. | https://www.boschrexroth.com/en/my/products/product-groups/assembly-technology/topics/aluminum-profiles-solutions-components/framepro-cad-plug-in/ | s/f | solo búsqueda |
| bd_warehouse (para build123d) | Release v0.4.0: tornillo de hombro ISO 7379, engranajes (helicoidal, cremallera, sinfín), perfiles open-builds, buje excéntrico, y `manufacturing_compensation` en roscas, probado en roscas impresas. | https://github.com/gumyr/bd_warehouse/releases/tag/v0.4.0 | 07/10/2026 (año por el pie de página) | abierta |
| bd_warehouse, documentación | Cubre fastener, bearing, flange, pipe, thread; no vi palancas ni sargentos de traba. | https://bd-warehouse.readthedocs.io/_/downloads/en/latest/pdf/ | 07/10/2026 | solo búsqueda |
| MetaForge PR 1149 | Un tercero copió las tablas de bd_warehouse y no la usa como dependencia por choque OCCT 8 / 7.7. Su ficha: la pieza comprada lleva STEP del proveedor, licencia y número de parte. | https://github.com/FidelOdok/MetaForge/pull/1149 | s/f | solo búsqueda |
| BOSL2 (OpenSCAD) | Tornillos, bisagras, «living hinge», snap locks, snap pins, colas de milano; tolerancia por `$slop`. Es OpenSCAD: no entra directo a build123d. | https://github.com/BelfrySCAD/BOSL2/wiki/TOC | s/f | solo búsqueda |
| Printables, Términos | Cada autor elige licencia (CC, GNU, Apache, CERN OHL, Standard Digital File…); el sitio no prueba ni inspecciona los modelos. | https://www.prusa3d.com/page/terms-of-service-of-printables-com_231249/ | vigente 15/10/2026 | abierta |
| MakerWorld, Términos | Prohíbe «page-scrape», «robot» y «artificial intelligence service» para acceder al contenido. | https://makerworld.com/en/user-agreement | 11/06/2024 | abierta |
| MakerWorld sin API | Tercero (11/10/2026): sin API oficial; la mayoría de modelos con licencia que impide el remix. No leyó los términos vivos. | https://github.com/everything3d/e3d-openscad-studio/issues/28 | 11/10/2026 | solo búsqueda |
| Thingiverse API | Hay API oficial: hay que registrar una app y aceptar sus términos. | https://www.thingiverse.com/legal/api | s/f | solo búsqueda |
| Printables, «Sturdy print-in-place draw latch» | El autor dice «I have not tested this latch much» y que no es robusto frente a uno metálico. | https://www.printables.com/model/130254-sturdy-print-in-place-draw-latch | 06/02/2022 | abierta |
| Printables, pipe clamp print-in-place | Bisagra impresa, pero la fuerza de cierre la da un tornillo M4 de 45 mm con tuerca. PETG + obleas de PLA. | https://www.printables.com/model/927924-super-pipe-clamp-with-print-in-place-hinge-strong | s/f | solo búsqueda |
| AgentsCAD (arXiv 2607.02448) | Agente que corrige STEP para FDM; guarda decisiones pasadas en un índice y las recupera. Prueba de punta a punta: un solo modelo (casa de pájaros). | https://arxiv.org/abs/2607.02448 | 02/07/2026 | solo búsqueda |

## Fuentes

- Developer Hub TraceParts — https://developers.traceparts.com/reference/developer-hub — 23/10/2025 — abierta
- McMaster-Carr Product Information API — https://www.mcmaster.com/help/api/ — 29/10/2019 — abierta
- bd_warehouse release v0.4.0 — https://github.com/gumyr/bd_warehouse/releases/tag/v0.4.0 — 07/10/2026 — abierta
- Terms of Service of Printables.com — https://www.prusa3d.com/page/terms-of-service-of-printables-com_231249/ — 15/10/2026 — abierta
- Terms of Use MakerWorld — https://makerworld.com/en/user-agreement — 11/06/2024 — abierta
- Sturdy print-in-place draw latch — https://www.printables.com/model/130254-sturdy-print-in-place-draw-latch — 06/02/2022 — abierta
- 3Dfindit toggle clamp — https://www.3dfindit.com/en/keywords/toggle-clamp — s/f — abierta pero vacía; datos de la búsqueda
- Kipp CAD data — https://www.kipp.com/gb/en/Download/CAD-data.html — s/f — acceso denegado; solo búsqueda
- Todo lo demás de la tabla: solo búsqueda, con el link de la tabla.

## Lo que CONFIRMA lo que hace el sistema

- **Existe lo que la IA dibujó de cero.** Los clamps de palanca son un producto de catálogo: Kipp, Ganter, norelem y Destaco los publican con CAD (TraceParts, 3Dfindit, sus webs). Dibujar uno de cero era trabajo repetido. Fuentes: TraceParts (toggle clamps) y 3Dfindit, tabla de informe_1.
- **El catálogo trae lo que el sistema necesita para ubicar la pieza.** Cotas, fuerza de sujeción y retención (ej. clamp norelem de 2.600 N de retención, «Hand force 150 N»), ángulo de apertura de palanca y de brazo. Fuente: ficha norelem 05725-01-02600 (solo búsqueda, s/f).
- **Hay CAD nativo para CATIA V5.** Misumi baja `.catpart` y TraceParts lista CATIA V5; el sistema ya maneja CATIA por COM. (Opinión: es lo más directo para armar un ensamble con el clamp real.)
- **build123d tiene biblioteca propia y está viva.** bd_warehouse v0.4.0 salió el 07/10/2026 (abierta). Sirve para tornillos, rodamientos, roscas, engranajes: lo que el sistema no debería dibujar.
- **Armar una ficha de pieza con fuente es práctica de otros.** MetaForge guarda cada pieza comprada con su STEP, licencia y número de parte, y las normalizadas con la fila de la tabla (PR 1149, solo búsqueda).

## Lo que lo CONTRADICE o le pone en duda

1. **«Buscar primero en catálogo» por programa es más difícil de lo que suena.** Las APIs reales piden alta: TraceParts, login, ticket y email por pedido, y apunta a fabricantes que quieren mostrar su catálogo (abierta, 23/10/2025). McMaster, solo clientes aprobados, con certificado (abierta, doc del 29/10/2019, puede estar desactualizada). Misumi, norelem y Kipp piden login para bajar. Para 3Dfindit no encontré API pública para usuarios, solo la de fabricantes. (Opinión: lo realista es que Fak baje el STEP una vez con su cuenta y el sistema lo guarde en la biblioteca propia; el «buscador por API» queda para después de probar con TraceParts.)
2. **El STEP de catálogo es un modelo «de ventas», no el mecanismo.** CADENAS dice que comparte un modelo simplificado sin datos de diseño sensibles (partsolutions.com/ecatalog, solo búsqueda). Sirve para ubicar, pasar espacio y chequear choques; no para saber cómo trabajan las articulaciones por dentro. Para la simulación con manifold3d, la cinemática hay que modelarla igual. 3Dfindit dice que agrega cinemática a algunos modelos (cadenas.de, ~2023, solo búsqueda): sin verificar para clamps.
3. **Un clamp de catálogo es de acero y se compra; uno impreso es otra cosa.** El mismo repo que lo muestra como alternativa lo desmiente: el autor del latch impreso dice que lo probó poco y que no es robusto frente a uno metálico (abierta, 2022). El pipe clamp «print-in-place» sigue necesitando un tornillo M4 de 45 mm para apretar. Con clamps desde ~23 EUR (norelem) o ~USD 59 (Kipp push-pull) (solo búsqueda), (opinión) lo más barato puede ser comprar la palanca y diseñar solo la base, el posicionador y el apoyo que sí es de Fak. Sin fuente de costo local: no vi precios ni envío a Argentina.
4. **Los repositorios de piezas imprimibles no están hechos para que una IA los consulte.** MakerWorld prohíbe expresamente el acceso con «artificial intelligence service» (abierta, 2024), y un tercero dice que no hay API ni remix para la mayoría (11/10/2026). Printables deja cada licencia al autor y avisa que no prueba los modelos (abierta, vigente 15/10/2026). No leí los términos generales de Prusa sobre acceso automático: sin verificar. Thingiverse sí tiene API oficial con registro.
5. **«Probada» en esos sitios casi nunca quiere decir probada.** No encontré un campo de carga, ciclos o material verificado. (Opinión: un modelo con 1.000 descargas es popular, no ensayado.)
6. **Dos fuentes comerciales discrepan en el material.** Una dice que PLA es lo correcto para un utillaje que no debe flexar (ugee, blog de tienda, hace ~40 días); otras que PETG es el default para clamps (craftgineer, ~220 días; makermyths, ~313 días). Son blogs sin ensayo propio: no resuelven nada para un utillaje que sujeta tapizado. Hay un estudio de compresión (MDPI, ~433 días) con cubos: PLA resiste más, PETG envejece mejor; no es de piezas con articulación.
7. **bd_warehouse no cubre lo mecánico propio de utillajes** (palancas, sargentos, pasadores de traba): lo que vi solo llega a tornillería, rodamientos, roscas y engranajes (documentación PDF, 07/10/2026, solo búsqueda). Y el choque de versiones de OCCT que reportó MetaForge obliga a probar la instalación con el OCP que usan, antes de adoptarla.

## Lo que no se les había ocurrido

- **TraceParts anuncia un acceso de «sindicación» pensado para LLM.** Sería la vía legítima y por contrato en vez de scrapear (abierta, 23/10/2025). Costo y condiciones: sin fuente; hay que abrir ticket.
- **La ficha de catálogo ya es un molde para la biblioteca propia** (Kipp/TraceParts: código de fabricante, EAN, ECLASS, UNSPSC, fuerzas, cotas). Propuesta de campos (opinión, armada con eso y con MetaForge): `origen` (comprada | normalizada | propia), código y fabricante, archivo STEP con licencia y fecha de descarga, cotas y fuerzas de catálogo, **qué mecanismo cierra y con qué fuerza** y, aparte, **ensayada en planta: sí/no, material, carga, ciclos, fecha, quién**. Ese último bloque es lo que ningún sitio público ofrece.
- **Orden de búsqueda sugerido** (opinión): 1) mi biblioteca; 2) tornillería y rodamientos por bd_warehouse; 3) catálogo de fabricante para lo que se compra (clamps, pasadores, perfiles); 4) repositorio imprimible solo como idea, mirando la licencia y sin copiar la geometría; 5) modelar de cero, y anotar por qué los pasos 1-4 no alcanzaban.
- **Buscar por forma.** 3Dfindit permite subir una geometría o un dibujo para encontrar piezas parecidas (cadenas.de, ~2023, solo búsqueda): sirve cuando no se sabe el nombre.
- **Otra memoria útil: decisiones pasadas.** AgentsCAD guarda decisiones previas en un índice y las recupera al analizar una pieza nueva (arXiv, 02/07/2026). Es una sola prueba, pero es la misma idea que «biblioteca de piezas probadas» aplicada a criterios de diseño. Opinión: sirve para los avisos de «esto ya lo corregimos» (cantos, estética antes que mecanismo).
- **BOSL2 es útil como fuente de números, no de código.** Tiene pasadores de presión, bisagras vivas y juego (`$slop`) pensados para FDM; se pueden leer los valores y rehacerlos en build123d. Opinión; no probé la equivalencia.
- **Misumi inCAD (300+ ejemplos de aplicación, login)** puede dar ideas de utillaje ya resueltas; ojo con su cláusula de uso.

## Qué se buscó y no se encontró

- Una biblioteca (build123d, CadQuery o similar) con **palancas, sargentos de traba o utillajes**: no apareció.
- **API pública y gratuita** de Misumi, norelem, Kipp, Ganter o Destaco: no la vi. Ganter y Bosch Rexroth no los abrí; solo aparecen dentro de TraceParts y 3Dfindit.
- **Condiciones de uso de los STEP de catálogo** (copiar la geometría, imprimir una réplica, guardarlos en una biblioteca propia): no las leí en ningún fabricante. Lo único sobre McMaster es el comentario de un usuario en Instructables, sin valor legal (~1.548 días, blog/foro). Sin fuente.
- **Papers sobre «catálogo primero» en agentes de CAD**: no encontré ninguno. Lo que salió es generación, edición o memoria; no es evidencia directa.
- **Ensayos de fuerza de clamps impresos**: ninguno confiable. Solo lo que dice un autor de sí mismo.
- **Disponibilidad y costo de envío a Argentina** de clamps y tornillería: sin fuente.
- **La página de 3Dfindit abierta con web_fetch vino vacía** y la de Kipp dio acceso denegado: sus datos son del texto de la búsqueda.

## Veredicto para este frente

Lo primero que hay que cambiar es el orden: antes de modelar, la IA consulta una **biblioteca propia** (con ficha: origen, STEP con licencia, cotas, y si fue ensayada en planta) y los **catálogos de fabricante** para lo que existe comprado, y solo modela de cero lo que ninguno resuelve; esto es respaldado por lo abierto (catálogos con CATIA/STEP gratis, bd_warehouse viva) pero la búsqueda **por programa** en catálogos no está probada: las APIs piden alta o contrato, así que arrancar con descarga manual de Fak. Los repositorios imprimibles son para ideas, no para consulta automática: MakerWorld lo prohíbe y nadie prueba esas piezas. Seguridad **media**: los hechos sobre acceso y términos están abiertos y fechados, pero faltan las condiciones de uso de los STEP, que pueden limitar guardar o reimprimir geometría de un fabricante.