# Crítica de base (¿diseñar de cero o configurar plantillas?): lo que hay afuera
Consultado el 20/10/2026.

## Qué hay

| Qué | Qué dice, en una frase | Fuente (link) | Fecha | abierta / solo búsqueda |
|---|---|---|---|---|
| Configurador CAD+PLM por API (Radkovsky y Becvar) | 20 configuraciones de ensambles: de 11,84 h a 2,47 h (-79%); funciona «siempre que los modelos paramétricos estén estandarizados» | https://www.mdpi.com/2673-4052/7/5/146 | 17/09/2026 | abierta (resumen y metadatos; el texto completo no cargó) |
| AssemCAD (Shanghai AI Lab) | El LLM escribe una especificación (partes, puertos, mates); un código determinista construye y verifica con una biblioteca de componentes. Claude pelado: 0,8% de ensambles que conservan la estructura; con la biblioteca: 82,5% | https://arxiv.org/pdf/2607.05123 | 06/07/2026 | abierta (PDF completo) |
| ArtiCAD (ensambles articulados, impresos en Bambu P1S) | Los puntos de unión se definen en la etapa de diseño, no al ensamblar; si no, el LLM «falla a menudo» | https://arxiv.org/html/2604.10992v1 | abr 2026 (id arXiv 2604) | solo búsqueda |
| Embodied CAD | El agente elige acciones de una biblioteca de habilidades L0–L4 en vez de escribir el script entero de una vez | https://arxiv.org/html/2606.31252v1 | jun 2026 (id arXiv) | solo búsqueda |
| Intelligent CAD 2.0 (Zou) | El KBE de los 80-90 servía en diseño rutinario/variantes, fallaba en lo creativo y su conocimiento era caro de mantener | https://arxiv.org/abs/2410.03759 | oct 2024 | abierta (corrida anterior) |
| Revisión KBE 2012-2021 (Kügler) | Los problemas de 2012 siguen sin resolver; KBE ad hoc da beneficio corto y costo de mantenimiento largo | https://www.sciencedirect.com/science/article/pii/S1474034623000204 | 2023 | abierta (solo resumen e intro) |
| Tan, Otto, Wood, ICED17 (aeroespacial) | 58 defectos en 275 persona-año; causa raíz mayor = requisitos; decisiones previas a congelar el concepto: 59% con defecto vs 28% y 22% | https://www.designsociety.org/publication/39558 | 2017 | abierta (corrida anterior) |
| Knowledge Technologies (arXiv 0802.3789) | Casos KBE de proveedores: Jaguar 8 semanas → 20 min; Textron tooling -73%. Lo exitoso es automatizar diseño rutinario | https://arxiv.org/pdf/0802.3789 | s/f (~2008) | solo búsqueda |
| Tesis Aalto, configurador ETO con NX | El configurador genera BOM, 3D y planos; «los planos requieren acabado manual» | https://aaltodoc.aalto.fi/items/f2c297c4-e73f-4dfd-af2b-65f96d473d92 | s/f | solo búsqueda |
| Patente US 5856924 (fixturing) | Los componentes modulares cuestan más que el utillaje dedicado; en producción masiva conviene el dedicado | https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/5856924 | s/f | solo búsqueda |
| TCT Magazine sobre jigs impresos | El cuello de botella es el diseño; un software del proveedor baja el diseño a menos de 20 min y a gente sin CAD (afirmación de proveedor) | https://www.tctmagazine.com/the-jig-is-up-jigs-fixtures-how-to-3d-printing-success/ | ~nov 2025 (s/f exacta) | solo búsqueda |
| METR, actualización | 2025: con IA 19% más lento; 2026: -18% y -4% de tiempo, ambos con intervalo que cruza cero; METR los llama poco confiables | https://metr.org/blog/2026-02-24-uplift-update/ | 24/02/2026 | solo búsqueda |
| Errores de diseño en construcción civil (243 profesionales) | Principal factor: error en la información de entrada al diseño, intervención irrazonable, incumplir normas | https://ascelibrary.org/doi/abs/10.1061/JPCFEV.CFENG-4862 | ~dic 2024 (s/f exacta) | solo búsqueda |
| Análisis de errores en dispositivos médicos (MDDI) | 40% de errores por cambios de requisitos, 0% «por diseño» en esa muestra | https://www.mddionline.com/business/engineering-process-improvement-through-error-analysis | s/f | solo búsqueda |
| Otros ya anotados (corrida anterior) | Verhagen 2012 (81% de apps KBE ad hoc), Haug 2012/2019 (configuradores), Camba 2016 (CAD paramétrico con método), Sele y Chugunova 2024 (humano en el lazo baja precisión), EngDesign arXiv 2509.16204 | ver notas.md | varias | solo búsqueda |

## Fuentes (título — link — fecha — estado)

- Radkovsky y Becvar, framework de automatización CAD-PLM — https://www.mdpi.com/2673-4052/7/5/146 — 17/09/2026 — abierta
- AssemCAD — https://arxiv.org/pdf/2607.05123 — 06/07/2026 — abierta
- ArtiCAD — https://arxiv.org/html/2604.10992v1 — abr 2026 — solo búsqueda
- Embodied CAD — https://arxiv.org/html/2606.31252v1 — jun 2026 — solo búsqueda
- Intelligent CAD 2.0 — https://arxiv.org/abs/2410.03759 — oct 2024 — abierta
- Kügler, revisión KBE — https://www.sciencedirect.com/science/article/pii/S1474034623000204 — 2023 — abierta (parcial)
- Tan/Otto/Wood ICED17 — https://www.designsociety.org/publication/39558 — 2017 — abierta
- Knowledge Technologies — https://arxiv.org/pdf/0802.3789 — s/f — solo búsqueda
- Tesis Aalto — https://aaltodoc.aalto.fi/items/f2c297c4-e73f-4dfd-af2b-65f96d473d92 — s/f — solo búsqueda
- Patente US 5856924 — https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/5856924 — s/f — solo búsqueda
- TCT Magazine — https://www.tctmagazine.com/the-jig-is-up-jigs-fixtures-how-to-3d-printing-success/ — s/f — solo búsqueda
- METR — https://metr.org/blog/2026-02-24-uplift-update/ — 24/02/2026 — solo búsqueda
- Causas de error de diseño (ASCE) — https://ascelibrary.org/doi/abs/10.1061/JPCFEV.CFENG-4862 — s/f — solo búsqueda
- MDDI análisis de errores — https://www.mddionline.com/business/engineering-process-improvement-through-error-analysis — s/f — solo búsqueda
- Artículo de configuradores ETO (-70% tiempo de especificación) — https://www.sciencedirect.com/science/article/pii/S0166361522001142 — 2022 — solo búsqueda

## Lo que CONFIRMA lo que hace el sistema

- **La IA sola, escribiendo código CAD, falla sobre todo al armar mecanismos, no al dibujar piezas.** En AssemCAD los modelos de punta ejecutan el código en 65–85% de los casos, pero conservan la estructura del ensamble en 0,8% (Claude) a 67% (GPT): código que corre y mecanismo equivocado. https://arxiv.org/pdf/2607.05123 (06/07/2026, abierta). Es lo que le pasó al virolador (mecanismo sin funcionar). Cautela: benchmark armado por los mismos autores y evaluación en parte con un modelo como juez.
- **Los controles automáticos de geometría están bien encaminados.** El catálogo de fallas de AssemCAD (agujero que no corta, unión que deja piezas sueltas, piezas superpuestas, factoría equivocada) se parece a lo que la skill ya vigila, y su remedio es el mismo: una compuerta determinista por falla. Misma fuente.
- **Medir rápido es correcto.** Pasar de minutos a segundos por posición (manifold3d) encaja con el patrón «el LLM propone, un verificador rápido juzga y devuelve el error». AssemCAD y ArtiCAD usan ese ciclo. https://arxiv.org/html/2604.10992v1 (solo búsqueda).
- **Un humano que decide en puntos fijos tiene respaldo** de la práctica del campo: el propio Intelligent CAD 2.0 deja al humano lo que es preferencia y valor (abierta, 2024). Eso sí, ver abajo: el respaldo es débil en cuanto a que el humano «controle» bien.
- **Imprimir utillajes en casa vale la pena.** Los reportes de plantas automotrices (ahorros de 89% en tiempo, con un proveedor de impresoras de por medio) coinciden en que el cuello de botella pasa a ser el diseño. https://www.tctmagazine.com/the-jig-is-up-jigs-fixtures-how-to-3d-printing-success/ (solo búsqueda, fuente con interés comercial).

## Lo que lo CONTRADICE o le pone en duda

1. **Error de base, dicho sin vueltas: el sistema trata cada dispositivo como un problema nuevo y la evidencia dice que la mayor parte del diseño es reuso.** La IA «dibujó desde cero una palanca que ya existía» no es un accidente, es el modo por defecto. Los sistemas que andan mejor (AssemCAD, Embodied CAD) hacen lo contrario: la IA *elige y parametriza* de un registro de componentes (13 fábricas paramétricas, tornillería y rodamientos de una biblioteca) y solo sintetiza lo que no existe, con caché por contenido para no rehacerlo. https://arxiv.org/pdf/2607.05123 (abierta); https://arxiv.org/html/2606.31252v1 (solo búsqueda). La cifra «más de 75% del diseño es reuso» está en mis notas de la corrida anterior (solo búsqueda, ScienceDirect S1474034608000293, sin fecha).
2. **El orden de trabajo es la causa raíz típica, no la IA.** En el estudio aeroespacial abierto, la causa raíz mayor de defectos son los requisitos, y las decisiones tomadas antes de congelar el concepto tuvieron defecto 59% de las veces contra 28% y 22% en las etapas siguientes (Tan, Otto, Wood, 2017, abierta). «Estética antes de que el mecanismo funcione» es exactamente decidir sin concepto congelado. Dato flojo: el resumen del paper dice retrabajo 5x y el cuerpo 13x; no uso ninguno de los dos como número.
3. **Los números espectaculares de plantillas/KBE vienen de variantes repetidas y de proveedores.** Los casos de Jaguar, Textron, DriveWorks o «80 h → 1 h» son anécdotas de proveedor o revisiones de segunda mano. El caso académico más reciente y medido (MDPI, 2026) da -79% pero en *20 configuraciones* de una misma familia y con modelos ya estandarizados; su punto de equilibrio se calcula para 10–150 configuraciones por año. Un taller que hace un dispositivo distinto cada vez está en el extremo bajo: la plantilla solo rinde para lo que se repite (palancas, cajas, bases, topes), no para todo el dispositivo.
4. **KBE tiene mala fama de mantenimiento, y este sistema es KBE de hecho** (una skill con reglas escritas es base de conocimiento). La revisión de 2023 dice que los problemas de 2012 siguen y que lo ad hoc cuesta caro de mantener; Intelligent CAD 2.0 dice lo mismo del KBE viejo. Riesgo concreto: la skill crece como prosa y nadie sabe qué regla ya no se cumple. (abiertas, ver tabla)
5. **Modular no siempre gana.** Una patente de fixturing dice que lo modular cuesta más que lo dedicado y en producción masiva conviene lo dedicado; otra nota de industria dice que en uso rinde igual que uno dedicado. Para utillaje impreso en FDM el argumento de costo de «grilla estándar» pesa menos, porque la pieza dedicada impresa ya es barata. (solo búsqueda, patente s/f)
6. **«Humano en el lazo» no es gratis ni automáticamente seguro.** Sele y Chugunova (PLOS ONE 2024, solo búsqueda): tener un humano que revisa sube la adopción pero baja la precisión (sesgo de automatización). Y METR (2025) midió que programadores con IA tardaban 19% más aunque creían ir 20% más rápido; en 2026 el signo se dio vuelta pero METR dijo que los datos no son confiables (https://metr.org/blog/2026-02-24-uplift-update/, solo búsqueda). Es software, no CAD, pero avisa: la sensación de ir rápido no sirve de prueba.
7. **Los benchmarks de IA-CAD miden lo fácil.** Según mis notas (solo búsqueda), IterCAD y otros están dominados por extruir-sobre-boceto, sin filetes, chaflanes ni vaciados: justo lo que le faltó a las «cajas peladas». No hay evidencia externa de que la IA haga bien el acabado; hay que medirlo adentro.
8. **Los configuradores tampoco son magia:** en la tesis de Aalto el configurador dejaba los planos para terminar a mano (solo búsqueda), y el mantenimiento se complica al crecer la base (Haug, solo búsqueda).

## Lo que no se les había ocurrido

- **Que la IA escriba una especificación y no geometría.** AssemCAD y ArtiCAD separan «qué construir» (partes tipadas, puntos de unión con sistema de coordenadas y tipo de junta) de «cómo dibujarlo»; la geometría la hace código fijo y probado. Para el virolador: primero un archivo corto con las piezas, los pivotes y los topes, revisado por el ingeniero *antes* de dibujar nada. Convierte «el mecanismo antes que la estética» en una puerta física, no en un consejo. (opinión mía sobre cómo aplicarlo; la técnica es de los papers)
- **Poscondiciones que gritan.** Una unión que nunca devuelve en silencio piezas sueltas (falla con error si el resultado no es un sólido) y una verificación de que cada agujero declarado existe de verdad en la geometría. Barato de agregar a cadlib. https://arxiv.org/pdf/2607.05123 (abierta).
- **Biblioteca de componentes aprobados como primera opción obligatoria:** consultar antes de dibujar, y si se crea una pieza nueva queda registrada con sus parámetros e interfaces. Resuelve la palanca repetida y el «rehacer todo en cada corrección» (cambiar un parámetro, no regenerar el modelo). (opinión)
- **CATIA Knowledgeware ya está en la casa.** PowerCopy, UDF, plantillas de pieza y tablas de diseño existen en CATIA V5 y no necesitan otro programa (solo búsqueda: cursos de terceros, no documentación oficial abierta). DriveWorks, en cambio, es solo SolidWorks y no aplica. No encontré evidencia independiente de cuánto rinden; y un dato de un foro (no verificado) dice que un PowerCopy instanciado por script no deja interactuar. Hay que probarlo en una tarde, no adoptarlo por fe.
- **Medir el propio proceso.** Dado lo de METR: anotar por diseño horas, vueltas de corrección y errores que marcó el ingeniero. Sin esa línea de base no se sabe si el sistema mejora.

## Qué se buscó y no se encontró

- Ningún estudio controlado que compare «IA diseña desde cero» contra «IA configura plantilla» en CAD mecánico, ni en utillajes.
- Nada independiente sobre productividad de DriveWorks, iLogic o Knowledgeware (solo casos de proveedores).
- Estudios de causas de error específicos de *utillajes y dispositivos de planta*: lo que hay viene de aeroespacial, construcción civil y software; la transferencia es una suposición.
- Evidencia de IA que logre acabado «profesional» (cantos, filetes, ergonomía) en piezas impresas.
- Texto completo del artículo MDPI (cargó solo el resumen) y de Kügler 2023 (muro de pago): sus cifras salen de los resúmenes.

## Veredicto para este frente

El enfoque de base tiene un error real: tratar cada dispositivo como diseño nuevo en vez de elegir y parametrizar piezas ya probadas, con la IA escribiendo una especificación corta que el ingeniero aprueba antes de dibujar. Lo primero a cambiar es eso (biblioteca de componentes + especificación primero + poscondiciones), no más reglas de estética; plantillas completas por dispositivo no se justifican porque casi nada se repite entero. Seguridad **media**: la dirección la apoyan AssemCAD, la causa raíz de requisitos y la teoría de reuso, pero los números de ganancia vienen de proveedores o de un benchmark propio, y no hay un estudio directo sobre utillajes.

# Recuerdos que propongo (no escribo memoria)
1. Regla de diseño: antes de dibujar una pieza, buscar en la biblioteca de componentes aprobados (palancas, bases, topes, cajas) y parametrizar; solo crear si no existe, y registrar lo nuevo. Fuente: AssemCAD, arXiv 2607.05123, 06/07/2026.
2. Regla de proceso: especificación corta (piezas, pivotes, topes, recorrido) aprobada por el ingeniero ANTES de la geometría y antes de la estética. Fuentes: AssemCAD; Tan, Otto, Wood ICED17 (decisiones tempranas con más defectos).
3. Control: toda unión booleana falla con error si el resultado no es un solo sólido, y cada agujero declarado se verifica en la geometría (patrón de «poscondiciones»).
4. Medir: por cada dispositivo anotar horas, vueltas de corrección y cosas que marcó el ingeniero (METR 24/02/2026: la sensación de ir rápido no prueba nada).
5. Probar en una tarde PowerCopy/UDF de CATIA V5 con una palanca, antes de decidir si hace falta otra herramienta (sin evidencia independiente de rendimiento).