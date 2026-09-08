# CRITERIOS, DIRECTIVAS Y REGLAS OPERATIVAS PARA HOJAS DE PROCESO SGC
## Formulario Oficial I-IN-002.4-R01 — Barack Argentina SRL
### Documento Maestro de Ingeniería de Procesos y Manufactura

---

> **Autor / Dirección Técnica:** Facundo Santoro ("Fak") — Ingeniería de Procesos y Manufactura  
> **Sistema de Gestión:** Sistema de Gestión de la Calidad (SGC) Barack Argentina / IATF 16949  
> **Formulario Base:** `I-IN-002.4-R01` (Hoja de Operaciones de Planta)  
> **Formato de Salida:** Presentación PowerPoint (`.pptx`) A4 apaisado para impresión en puesto / Especificaciones en Markdown  
> **Destino Técnico:** Documentación central del repositorio y base de actualización del skill `.claude/skills/hojas-de-proceso/`  
> **Fecha de Consolidación:** Septiembre de 2026  

---

## INTRODUCCIÓN Y PROPÓSITO DEL DOCUMENTO

Una **Hoja de Proceso / Hoja de Operaciones (HO)** de Barack Argentina no es un folleto ilustrativo ni una diapositiva comercial: **es una instrucción de trabajo operativa que se lee de pie, al lado de la máquina, impresa en papel A4**. Si un operario que está operando en la línea de montaje o en una celda de termoformado no comprende en tres segundos qué tiene que hacer, qué botón apretar, cómo posicionar el material o cómo actuar ante una no conformidad, la hoja está mal confeccionada.

Durante las tandas de desarrollo de las celdas **HOTMELT** y **MOLDEADORA IMG KINGPOWER (Molde Hembra)** para el proyecto **VW Patagonia / Top Roll**, Fak (Facundo Santoro) estableció un conjunto estricto de criterios operativos, correcciones de diseño, delimitaciones de rol y purgas de lenguaje que deben regir toda la documentación técnica de manufactura.

Este documento compila, categoriza y formaliza de manera exhaustiva todas esas directivas, acompañadas de sus ejemplos reales, citas textuales y código de aplicación, sirviendo como guía canónica inmutable para la generación humana y automatizada de Hojas de Proceso.

---

## 1. DELIMITACIÓN DE ROLES: PROCESOS VS CALIDAD

### 1.1 El Principio Rector: Delimitación Funcional Estricta
En el esquema industrial de Barack Argentina, **Ingeniería de Procesos y Manufactura diseña y describe cómo se fabrica el producto, cómo opera la celda y cómo se resguarda la integridad física del puesto**. Aseguramiento y Control de Calidad, por su parte, define los planes de muestreo, las frecuencias de control, las tolerancias de liberación y los registros legales del Sistema de Gestión de Calidad.

Históricamente, los redactores o agentes de IA intentaban "rellenar" las hojas creando fichas de inspección ficticias o asumiendo el rol de auditores de calidad. Esto provocó una directiva terminante de Fak:

> **Cita Textual de Fak (08/09/2026):**  
> *"la hoja d elcaida sacala no soy caldiad como apr ahacerla sincermaent que ha haga calida deaja tbd todo nombre todo no se o ni la pognas"*  
> *(La hoja de calidad sacala; no soy calidad como para hacerla sinceramente, que la haga calidad, deja TBD todo o ni la pongas).*

#### Reglas Operativas Inquebrantables:
1. **Prohibición de emitir Hojas de Calidad desde Procesos:**  
   Bajo ninguna circunstancia Ingeniería de Procesos debe confeccionar láminas o instructivos rotulados como "Inspección de Calidad", "Liberación de Calidad" o "Pautas de Calidad" dentro del pliego operativo. Esas hojas pertenecen pura y exclusivamente al departamento de Calidad.
2. **Cero Suposición de Criterios de Aceptación Complejos:**  
   Procesos no define criterios dimensionales micrométricos, ensayos destructivos, pruebas de desgarro de laboratorio ni auditorías de aseguramiento de producto. Si el cliente automotriz (ej. Volkswagen) exige una validación de laboratorio, esa directiva viaja en el Plan de Control (PCP) y en las instrucciones de laboratorio, no en la HO de celda.

---

### 1.2 Vaciado Sistemático del Bloque "Ciclo de Control"
El formulario SGC `I-IN-002.4-R01` posee un bloque inferior denominado **CICLO DE CONTROL**, compuesto por una tabla fija de 5 columnas:

| Características a controlar | Método de control | Resp. | Frec. | Registro |
| :--- | :--- | :---: | :---: | :---: |
| *(Vacío - Esperando Calidad)* | *(Vacío - Esperando Calidad)* | *(Vacío)* | *(Vacío)* | *(Vacío)* |
| *(Vacío - Esperando Calidad)* | *(Vacío - Esperando Calidad)* | *(Vacío)* | *(Vacío)* | *(Vacío)* |

#### El Antecedente Real de la Celda Hotmelt (07/09/2026):
En la primera versión de la celda Hotmelt, se habían completado artificialmente 85 campos de control con valores inventados (*"Inspeccionar con calibre digital"*, *"1 pieza cada 30 minutos"*, *"Registro RC"*).  
Fak ordenó el **vaciado inmediato y total** de los campos en las 17 láminas:
- No se carga absolutamente nada hasta que Aseguramiento de la Calidad emita formalmente su Plan de Control aprobado para ese Part Number.
- Las celdas de la tabla deben conservarse con sus bordes negros (`1 pt`), sus cabeceras azul oscuro (`#44546A`) y texto blanco, pero **el cuerpo de las filas debe entregarse completamente limpio / vacío (o con "TBD" si un campo requiere indicación explícita)**.
- **Prohibición de siglas no autorizadas:** En caso de completarse a futuro por Calidad, la columna *Resp.* solo admite `OP` (Operador de Producción), `OC` (Operador de Calidad) o `Insp.` (Inspector). La columna *Registro* solo admite `Set up` o `-`. Queda estrictamente prohibido usar siglas inventadas como `"RC"` (Registro de Calidad).

---

### 1.3 Puntos Críticos de Seguridad Pasiva Vehicular vs Control de Calidad
En la industria automotriz existen características críticas que afectan la seguridad de los pasajeros (ej. puntos de debilitamiento láser o costuras para el despliegue del Airbag del acompañante en el tablero / Top Roll Patagonia).

* **Qué SÍ hace Procesos en la Hoja de Operaciones:**  
  Ubicar una **alerta visual preventiva** en el puesto para que el operador no dañe la zona sensible durante la manipulación y verifique la orientación correcta del componente.  
  *Estándar visual exigido por Volkswagen:*  
  - Un **triángulo amarillo normalizado** (`#FFD700`) con borde rojo (`#C00000`) apuntando en la foto al área del punto crítico.  
  - Un símbolo idéntico (`▲ CRÍTICO VW`) en el texto del paso correspondiente de la descripción, resaltado en negrita y color bordó/rojo (`#B22222`).
* **Qué NO hace Procesos:**  
  No redacta protocolos de validación de estallido dinámico de Airbag, curvas de rotura por tracción, cálculos de Severidad (S=10) del AMFE ni tolerancias de espesor de pared remanente. Esos parámetros se derivan al Plan de Control oficial y a los ensayos de laboratorio de BeOn / PPAP.

---

## 2. DIDÁCTICA Y FOTOGRAFÍA OPERATIVA: PASO A PASO SECUENCIAL

### 2.1 Principio de Didáctica Industrial en Planta
Una hoja de proceso debe servir para capacitar a un operario ingresante sin que requiera asistencia verbal permanente del supervisor.

> **Cita Textual de Fak (08/09/2026):**  
> *"osea no se teninde solo con 1 foto tnendes? necnietsmaos mas fotodo ssino no vana netnede rpaos pro paso idelamente osea... asi se eitneidne las hojas de proceos que estas haciendo coemrpedeS?"*

Y previamente en la celda Hotmelt:
> **Cita Textual de Fak (03/09/2026):**  
> *"en la filmina 3 un celular se ve mucho mas grande que una hoja con parametros, ¿que clase de criterio estas aplicando a las hojas de proceso?"*

#### Directivas de Didáctica Visual:
1. **Prohibición de la "Foto Única Resumida":**  
   Para operaciones que involucran secuencias cinemáticas o mecánicas de varios movimientos (por ejemplo: regular el freno del desbobinador -> expandir el eje con pistola neumática -> enhebrar la punta del film entre los rodillos tensores), **está terminantemente prohibido colocar una única foto panorámica general**. Se deben descomponer los momentos clave en una secuencia de fotos.
2. **Layouts Multi-Foto Secuenciales:**  
   - Se deben emplear distribuciones de **2, 3 o hasta 4 imágenes por lámina** dispuestas en grillas simétricas, limpias y nítidas.
   - Cada imagen debe vincularse directamente al paso del texto mediante **badges numéricos** o rotulación clara (`Paso 1` -> `Foto 1`; `Paso 2` -> `Foto 2`).
   - El espacio útil del bloque de imágenes (`16.20 cm` de ancho x `9.30 cm` de alto) debe aprovecharse ordenadamente, sin márgenes desproporcionados ni amontonamientos caóticos.

---

### 2.2 Prohibición Absoluta de Imágenes Sintéticas / IA (Cero Tolerancia)
Durante el proceso de diseño de las hojas, se evaluó utilizar generadores de imágenes por inteligencia artificial (Gemini Imagen, DALL-E, Midjourney) para recrear fotos de planta o "embellecer" tomas oscuras.

#### El Veredicto Final de Fak:
> **Registro Oficial (`OBSERVACIONES DE FAK.md` — 07/09/2026):**  
> *"Las pruebas de imágenes generadas con IA (fotos hiperrealistas) se descartaron por completo ('son una basura, no sirven'). No usar generadores de imágenes. Trabajar exclusivamente con las fotos y capturas de video reales de la planta, y usar edición vectorial/código para reparar pantallas HMI cuando sea necesario."*

#### Justificación Técnica y Riesgos de Planta:
1. **Reinvención Crítica de Dígitos:** Una IA generativa altera los números de set-point en las pantallas de HMI. Un valor de temperatura que pase de `165.0 °C` a `185.0 °C` o una presión de `-0.50 MPa` a `-0.05 MPa` por una "alucinación" visual puede provocar piezas defectuosas en masa o la rotura de la matriz.
2. **Deformación Mecánica:** La IA suele inventar tornillos, roscas, conectores hidráulicos o protecciones físicas que no existen en la máquina real, desorientando al operario y destruyendo la credibilidad del documento ante auditorías IATF 16949.
3. **Marca de Procedencia:** Las imágenes generadas traen metadatos y marcas de agua digitales que violan los protocolos de confidencialidad de la industria automotriz.

> **REGLA DE ORO:** **100% fotogramas reales de video de planta o fotografías reales de cámara/celular.**

---

### 2.3 Criterio de Legibilidad de Pantallas HMI (Gates 1 y 2)
Las fotos tomadas con celular a las pantallas táctiles (HMI) de las máquinas suelen sufrir de reflejos, baja resolución, inclinación angular o idioma original (chino/inglés).

* **La pantalla es la FOTO REAL enderezada, con el rótulo en castellano encima:**  
  🔴 **Criterio corregido por Fak el 08/09/2026** — hasta esa fecha este documento decía que las pantallas *"se redibujan mediante código o diseño vectorial"*, y es lo contrario. Textual: *"poner la foto de la pantalla real y metele un edit y ponele encima el dato que vos queres"*.
  Se toma el fotograma donde la pantalla se lee, se le **corrige la perspectiva** (`Image.PERSPECTIVE` sobre los cuatro vértices del LCD) y se le ponen los rótulos encima. **Ningún valor de la pantalla se tapa ni se retoca**; lo que hay que mirar se marca con banda semitransparente y un número, y el texto en castellano va en una banda **al costado**, fuera del LCD. Motivo: el operario tiene adelante la pantalla en su idioma original, y un dibujo que no se le parece no le sirve para encontrarla entre menús. Ejemplo: `scripts/hotmelt/pantalla_seguridad.py`; regla `.claude/rules/hojas-proceso.md` §3.
* **Gate de Legibilidad Impresa (>= 7 pt):**  
  Toda tipografía, rótulo o parámetro en una pantalla HMI que el operario deba leer **debe medir como mínimo 7 puntos tipográficos (`Pt(7)`) una vez impresa en la hoja A4**. Si al acomodar la pantalla en el bloque el texto queda por debajo de 7 pt, **no se achica la tipografía: se eliminan los campos secundarios que la operación no manda mirar** y se aclara al pie: *"La pantalla real incluye además parámetros de diagnóstico de mantenimiento"*.

---

### 2.4 Encuadre, Recorte y Purga de Elementos Ajenos
En las fotos reales de taller es habitual que aparezcan elementos que ensucian la comunicación técnica. Se debe aplicar un recorte riguroso:
- ❌ **Prohibido:** Celulares mostrando pantallas de traductores automáticos (Google Translate).
- ❌ **Prohibido:** Caras de operarios en primer plano o espaldas de visitantes/técnicos externos.
- ❌ **Prohibido:** Grandes extensiones de piso industrial vacío, techos o cajas de cartón de embalaje al fondo.
- ✔️ **Obligatorio:** Encuadre centrado en la zona de contacto, las manos con el EPP adecuado realizando la acción, los manómetros de presión, las llaves de accionamiento y las herramientas de taller.

---

### 2.5 Control Estricto de Orientación de Fotogramas (Cero Fotos Invertidas)
Al procesar fotogramas de videos grabados con teléfonos móviles en planta, es común que la orientación varíe o que metadatos EXIF generen rotaciones incorrectas:
- **Prohibición absoluta de fotos de cabeza o invertidas:**
  > **Cita Textual de Fak (08/09/2026):**  
  > *"ojo que muchas fotos las tneens invertidas boludo..."*
- **Regla técnica de transformación:**  
  Los fotogramas extraídos de tomas verticales donde el operario filmó de costado requieren rotación de **90° en sentido horario (`ROTATE_90`)**, nunca rotaciones ciegas de 270° que dejen a los operarios "colgados del techo".
- **Verificación visual obligatoria:**  
  Antes de dar por aprobada una hoja, se debe inspeccionar visualmente cada una de las imágenes verificando que el piso esté abajo, las personas de pie y las estructuras orientadas naturalmente.

---

### 2.6 Traducción y Rotulado de Botoneras y Paneles en Chino
Las máquinas importadas (como la Kingpower de In-Mold Graining) frecuentemente conservan rótulos de botones, selectores y luces testigo en idioma chino o inglés técnico:
- **Directiva de traducción in situ:**
  > **Cita Textual de Fak (08/09/2026):**  
  > *"intinemos traducir loque dice arriba de los botones en chino y poner un cartel en esapñol prof avor tmaiben...."*
- **Estándar de cartelón superpuesto (Overlay SGC):**  
  Se debe incorporar un cartel o badge instructivo de alta nitidez en español ubicado directamente sobre el selector o botón, con flecha indicadora:
  - Header azul SGC (`#44546A`) con el nombre operativo en español argentino (ej. `DESBOBINADOR`, `TRANSPORTE DE LÁMINA`).
  - Subtítulo con la referencia bilingüe del panel original (ej. `Panel: UNCOILER | 开卷机`).
  - Viñetas de función explicativa para cada posición del selector:
    * `FWD (正转): Avance / Giro hacia la mesa`
    * `REV (反转): Retroceso / Desbobinado`
- **Impacto pedagógico:** El operario sabe exactamente qué posición activar sin necesidad de adivinar ideogramas chinos ni traducir mentalmente siglas en inglés.

---

## 3. VOCABULARIO Y LOCALIZACIÓN: ESPAÑOL ARGENTINO DE PLANTA

### 3.1 Principio de Identidad Lingüística en Taller
Las plantas automotrices de Argentina poseen una jerga técnica propia, forjada a lo largo de décadas en la interacción entre ingeniería, supervisores y delegados de línea. El lenguaje neutral "de manual escolar" o el español de España desentona, resulta artificial y genera rechazo o confusión en los puestos de trabajo.

> **Cita Textual de Fak (08/09/2026):**  
> *"estyo viendo lo que esta shceinod leendno las notas que dice el camibod e molde debe ser ejecutado por.... sugiendo estrictas normas de segurida dde izaje ni se que es izaje agrega al plan revisar mi fomra de escribi rporque sino tambien vams a poenr mcuhas palabras ne español neutro oe spañañay eso no pedue suceder analiza nuestor lenguaje en esapñoak rengiuetno etnendes"*  
> *(Estoy viendo lo que estás haciendo leyendo las notas que dice 'el cambio de molde debe ser ejecutado por... siguiendo estrictas normas de seguridad de izaje', ¡ni sé qué es izaje! Agregá al plan revisar mi forma de escribir porque si no también vamos a poner muchas palabras en español neutro o de España y eso no puede suceder. Analizá nuestro lenguaje en español argentino, ¿entendés?).*

---

### 3.2 Tabla Canónica de Términos Prohibidos y Reemplazos Obligatorios

| Término Prohibido (Español Neutro / España) | Término Obligatorio (Español Argentino de Planta) | Justificación Operativa y Contexto de Uso |
| :--- | :--- | :--- |
| ❌ **Izaje** / **Operaciones de izaje** | ✔️ **Maniobras con el puente grúa** / **Movimiento con puente grúa** / **Amarre con cadenas** | "Izaje" es un término teórico de manual portuario/minero. En la fábrica automotriz argentina se habla siempre del **puente grúa** y del amarre del molde. |
| ❌ **Eslingas de elevación** / **Ramales de izaje** | ✔️ **Cadenas de puente grúa con grilletes de seguridad** / **Cadenas del puente grúa** | Para el cambio de moldes pesados de inyección o termoconformado (3 a 10 toneladas) se utilizan aparejos de 4 ramales de **cadenas de acero de alta resistencia con grilletes**. Jamás eslingas textiles livianas. |
| ❌ **Chumaceras** / **Chumasquereas** | ✔️ **Soportes del desbobinador** / **Apoyos del desbobinador** | "Chumacera" es un término de manual mecánico que no se usa coloquialmente en la planta de Barack. Fak: *"chumasquereas que carajo es eso jajaj dios mio esas palabras te dije que no salame"*. Se denominan siempre soportes o apoyos del desbobinador. |
| ❌ **Contenedor de rechazo** / **Cubo de desecho** / **Tacho de desperdicios** | ✔️ **Cajón de scrap** / **Contenedor rojo** | Término estandarizado en las hojas maestras de Barack (`HO-968`, `HO-985`). El scrap se segrega en el cajón metálico pintado de rojo normalizado. |
| ❌ **Mandril** / **Eje hinchable** | ✔️ **Eje neumático expansible** / **Eje neumático** | "Mandril" remite al español ibérico. En Argentina el accesorio que se introduce en las bobinas plásticas y se infla con aire es el **eje expansible**. |
| ❌ **Núcleo** / **Canuto** | ✔️ **Buje de cartón** / **Tubo de cartón** | El cilindro hueco interior sobre el que viene enrollada la lámina de TPO, cuerina o film se denomina siempre **buje de cartón**. |
| ❌ **Mordazas** (aislado / mecánico) | ✔️ **Clamps neumáticos** / **Mordazas neumáticas** | Se refiere a las prensas neumáticas perimetrales que fijan la lámina al marco tensor antes del ciclo de vacío. |
| ❌ **Albarán** | ✔️ **Remito de entrega** / **Remito** | Documento mercantil de ingreso y egreso de materiales en planta. |
| ❌ **Carretilla elevadora** / **Toro** | ✔️ **Autoelevador** / **Clark** | Maquinaria rodante de movimiento de materiales y racks en pasillos. |
| ❌ **Par de apriete** / **Apriete con llave** | ✔️ **Torque** / **Torquear** (con torquímetro) | "Aplicar un torque de 470 Nm a los cáncamos giratorios". En planta no se dice "par de apriete", se usa "torque". |
| ❌ **Pulsador de seta** / **Paro de emergencia** | ✔️ **Golpe de puño** / **Parada de emergencia** | El botón rojo de seguridad industrial del pupitre de comando. |
| ❌ **Comprobación** | ✔️ **Verificación** / **Inspección** | Lenguaje estandarizado por los manuales de procedimientos SGC. |

---

### 3.3 Regla sobre Accesorios de Flete y Transporte Externo
En la primera versión de la máquina IMG, se había creado una lámina completa (30.12) instruyendo a los operarios sobre la colocación de unos **topes rojos de transporte (Kip) asegurados con bulones de 20 mm**.

Fak ordenó su **eliminación definitiva del pliego operativo** debido a que:
1. Dichos topes son herrajes pesados diseñados por el fabricante de la matriz exclusivamente para inmovilizar los semi-moldes durante el flete marítimo internacional o traslados entre plantas sobre camión.
2. Un operario de producción en su rutina de fabricación normal o durante un cambio de molde interno en planta **jamás debe manipular ni colocar topes de transporte**. Incluirlos en una Hoja de Operaciones induce al gravísimo error de pretender cerrar o mover la máquina con los topes fijados, destruyendo el sistema hidráulico.

> **Directiva:** Los elementos exclusivos de logística externa no forman parte del proceso de manufactura y no deben figurar como pasos operativos en las HO.

---

## 4. ESTRUCTURA, GEOMETRÍA Y FORMATO OFICIAL SGC: FORMULARIO I-IN-002.4-R01

### 4.1 Geometría del Pliego (A4 Apaisado)
El formulario de Barack Argentina está diseñado para reproducirse en escala 1:1 tanto en archivos digitales como en hojas plastificadas A4 colocadas en los portahoja colgantes de cada estación.

* **Dimensiones totales:** Ancho $W = 29.70 cm$, Alto $H = 21.00 cm$.
* **Margen perimetral fijo:** $M = 0.70 cm$.
* **Ancho útil de trabajo:** $28.30 cm$.
* **Alto útil de trabajo:** $19.60 cm$.

```
┌────────────────────────────────────────────────────────────────────────────┐  Y = 0.00
│ MARGEN SUPERIOR (0.70 cm)                                                  │
│ ┌────────────────────────────────────────────────────────────────────────┐ │  Y = 0.70
│ │ 1. CAJETÍN OFICIAL SGC: Logo, Título, Formulario, Metadatos (Alto: 4.0cm)│
│ ├─────────────────────────────────────────┬──────────────────────────────┤ │  Y = 4.70 / 4.90
│ │                                         │                              │ │
│ │                                         │ 3. DESCRIPCIÓN DE LA         │ │
│ │ 2. BLOQUE DE IMÁGENES                   │    OPERACIÓN                 │ │
│ │    Fotos reales / Multi-foto            │    (Lista numerada con       │ │
│ │    Ancho: 16.20 cm                      │     verbos en infinitivo)    │ │
│ │    Alto: 9.90 cm                        │    Ancho: 11.85 cm           │ │
│ │                                         │    Alto: 9.90 cm             │ │
│ │                                         │                              │ │
│ ├─────────────────────────────────────────┴──────────────┬───────────────┤ │  Y = 14.80 / 15.00
│ │ 4. CICLO DE CONTROL (Vaciado a la espera de Calidad)   │ 5. EPP        │ │
│ │    Ancho: 21.65 cm, Alto: 3.10 cm                      │    6.40 cm    │ │
│ ├────────────────────────────────────────────────────────┴───────────────┤ │  Y = 18.10 / 18.30
│ │ 6. PLAN DE REACCIÓN ANTE NO CONFORME (Alto: 2.00 cm)                   │ │
│ │    3 Fases fijas (Arial Bold) a la izq. / Acciones específicas a der.  │ │
│ └────────────────────────────────────────────────────────────────────────┘ │  Y = 20.30
│ MARGEN INFERIOR (0.70 cm)                                                  │
└────────────────────────────────────────────────────────────────────────────┘  Y = 21.00
```

---

### 4.2 Paleta Corporativa Oficial SGC (Códigos Hex y RGB)

* **Azul SGC Oscuro (Cabeceras y Bandas):**  
  `#44546A` -> `RGB(68, 84, 106)`.  
  Utilizado para todas las bandas principales de título de bloque, casilleros de metadatos de cabecera y encabezado del Ciclo de Control. Texto en color Blanco puro en negrita.
* **Azul Acento SGC (Banda de Elementos de Seguridad):**  
  `#4472C4` -> `RGB(68, 114, 196)`.  
  Color reservado exclusivamente para la banda de título "ELEMENTOS DE SEGURIDAD".
* **Azul Énfasis Institucional (Notas y Destacados):**  
  `#1F497D` -> `RGB(31, 73, 125)`.  
  Utilizado en notas al pie de la descripción (`NOTA: ...`) y subtítulos técnicos.
* **Amarillo Normalizado VW (Punto Crítico):**  
  `#FFD700` -> `RGB(255, 215, 0)`.  
  Relleno del triángulo isósceles de alerta visual para requerimientos de cliente automotriz.
* **Rojo Alerta / Borde Crítico:**  
  `#C00000` -> `RGB(192, 0, 0)`.  
  Borde exterior del triángulo crítico (`Pt(1.5)`) y texto de la etiqueta adyacente.
* **Rojo Texto Crítico:**  
  `#B22222` -> `RGB(178, 34, 34)`.  
  Color de fuente para las frases del paso que describen la operación crítica.
* **Gris Tenue (Celdas Secundarias):**  
  `#F2F2F2` -> `RGB(242, 242, 242)`.  
  Relleno para el casillero del disparador en el Plan de Reacción.
* **Tratamiento del Logotipo de Barack Argentina:**  
  El logo oficial (`barack_logo.png`) posee fondo blanco. **Está terminantemente prohibido colocarlo sobre una celda azul o con relleno de color**, ya que produce un parche visual discordante. Debe ubicarse siempre sobre una celda blanca pura con borde negro fino.

---

### 4.3 Tipografías Oficiales y Regla de Legibilidad

1. **Calibri (Fuente Estándar de Operación):**  
   - Se utiliza en el 90% del documento: Cajetín de cabecera, pasos de descripción de la operación, tablas de ciclo de control y referencias de EPP.
   - Tamaños habituales:  
     - Título "HOJA DE OPERACIONES": `Pt(24)` Bold.  
     - Código HO: `Pt(20)` Bold.  
     - Bandas de bloque: `Pt(11)` a `Pt(12)` Bold.  
     - Pasos de descripción: Se calcula con un algoritmo dinámico que arranca en `Pt(12)` y desciende según volumen de texto con un piso absoluto de `Pt(7.5)`.  
     - Metadatos de cabecera: `Pt(8)` etiquetas, `Pt(9.5)` valores en negrita.
2. **Arial (Fuente Obligatoria de Seguridad y Plan de Reacción):**  
   - El SGC de Barack estipula que el bloque inferior de **PLAN DE REACCIÓN ANTE NO CONFORME** debe redactarse obligatoriamente en tipografía **Arial**, para brindar máxima visibilidad ante incidentes.  
   - Las 3 frases fijas van en `Arial Pt(8.5)` Bold, y las acciones de contingencia a la derecha en `Arial Pt(8.5)` Regular.

---

### 4.4 Estilo de Redacción Instruccional (Infinitivo de Planta)
La redacción de los pasos debe seguir un patrón gramatical riguroso:

* **Modo Infinitivo Obligatorio:**  
  Cada renglón o paso debe comenzar obligatoriamente con un verbo en infinitivo:  
  *✔️ "Verificar la presión de red en el manómetro (+0.59 MPa)."*  
  *✔️ "Colocar el rollo de material centrando el buje sobre el eje."*  
  *✔️ "Accionar la pistola neumática para expandir el eje."*  
  *✔️ "Posicionar la lámina entre las mordazas del marco tensor."*  
  *✔️ "Presionar los dos pulsadores bimanuales de ciclo automático simultáneamente."*  
  *(❌ Prohibido redactar en imperativo personal como "Colocá", "Apretá", "Verifique usted", o en lenguaje narrativo como "El operario procede a colocar...").*
* **Tono Técnico Sobrio (Cero Dramatizaciones):**  
  En la celda Hotmelt se había escrito: *"Nunca dejar una pieza metálica entre los rodillos: se rompen al instante"*.  
  Fak corrigió el enfoque:
  1. "Se rompen al instante" es una exageración melodramática no profesional.
  2. La HO debe indicar una **acción positiva concreta de verificación**, no un lamento:  
     *Forma correcta:* **"Verificar que no haya piezas metálicas ni impurezas sobre la lámina antes de iniciar el ciclo de conformado."**
* **Tratamiento de Datos No Confirmados:**  
  Queda prohibido imprimir leyendas como "BORRADOR", "SUJETO A REVISIÓN" o "PENDIENTE DE VALIDACIÓN" cruzando la lámina. Si un dato técnico exacto no está disponible en la documentación fuente, se rotula como **`TBD`** (*To Be Defined*) y se notifica formalmente a Ingeniería.

---

### 4.5 El Plan de Reacción Ante No Conforme (Estructura SGC Inmutable)
El bloque inferior de la hoja (`PLN_Y = 18.30 cm`, `Alto: 2.00 cm`) está regulado por el procedimiento de calidad de Barack.

#### Estructura Fija de Dos Columnas:
1. **Columna Izquierda (Ancho: 15.20 cm):**
   - **Disparador del problema:** En recuadro gris tenue (`#F2F2F2`) con tipografía Arial negrita en mayúsculas:  
     *Ejemplos:*  
     `"SI DETECTA FALTA DE PRESIÓN, TEMPERATURA FUERA DE RANGO O FALLA DE HMI"`  
     `"SI DETECTA ANOMALÍA EN CADENAS, PUENTE GRÚA O INTERFERENCIA"`  
     `"SI DETECTA ROTURA DE LÁMINA, ARRUGAS O DEFECTO DE PUNTO CRÍTICO"`
   - **Las Tres Fases Fijas Inmutables del SGC (3 renglones en Arial Bold con fondo blanco):**  
     1. **`DETENGA LA OPERACIÓN`**  
     2. **`NOTIFIQUE DE INMEDIATO A SU LIDER O SUPERVISOR`**  
     3. **`ESPERE LA DEFINICION DEL LIDER O SUPERVISOR`**  
2. **Columna Derecha (Ancho: 13.10 cm restante):**
   - **Acciones Específicas de Contingencia del Puesto (Arial Pt 8.5):**  
     Instrucciones concretas y directas para el operador mientras aguarda la llegada del supervisor.  
     *Ejemplo estándar:*  
     `1. Segregar de inmediato al cajón de scrap / contenedor rojo cualquier pieza no conforme.`  
     `2. Identificar el material con tarjeta de bloqueo de proceso.`  
     `3. Dar aviso según procedimiento de no conformidades P-09/I.`  
     `4. No reiniciar la máquina hasta recibir autorización expresa del Líder o Calidad.`

---

## 5. REGLAS PARA LA CONFECCIÓN DE LA PORTADA E ÍNDICE

Cuando el pliego operativo comprende una celda o máquina completa con múltiples operaciones (ej. 10 a 17 hojas), se debe anteponer una **Lámina 1 de Portada e Índice General**.

### Criterios Aprobados por Fak para la Portada:
1. **Cabecera Corporativa Limpia:**  
   Recuadro superior con doble borde azul SGC (`#44546A`), logo de Barack Argentina a la izquierda sobre fondo blanco impoluto (sin manchas azules de relleno) y título en tamaño grande (`Pt(30)` Bold).
2. **Fotografía Panorámica de Celda Real:**  
   En el lateral izquierdo de la portada se coloca una foto panorámica real de alta calidad que muestre la celda completa con sus protecciones perimetrales, tableros y una pieza terminada en primer plano para identificación inmediata.
3. **Ficha Técnica SGC:**  
   Tabla a la derecha resumiendo: Cliente automotriz (Volkswagen), Proyecto (Patagonia / Top Roll), Part Number / Denominación de la pieza, Puesto/Celda, Responsable de confección (Facundo Santoro / Ingeniería de Procesos) y Revisión vigente.
4. **Índice Secuencial de Operaciones:**  
   Listado ordenado de todas las láminas con su código numérico exacto derivado del Flujograma de Proceso (ej. `30.1 Puesta en marcha general`, `30.2 Acceso al HMI y recetas`, etc.).

---

## 6. CHECKLIST DE AUDITORÍA PRE-ENTREGA (GATE ENFORCEMENT)

Antes de entregar cualquier presentación PowerPoint (`.pptx`), exportación en PDF o ficha operativa a Fak, se debe auditar rigurosamente la siguiente lista de control. Si falla un solo ítem, el documento **NO SE PUBLICA**:

```markdown
[ ] 1. ROL: ¿El documento describe exclusivamente manufactura y proceso físico?
       - No contiene hojas de inspección que correspondan a Calidad.
       - No intenta redactar protocolos de aseguramiento ni ensayos de laboratorio.

[ ] 2. CICLO DE CONTROL: ¿La tabla del Ciclo de Control está vaciada?
       - Las 5 columnas conservan su formato visual oficial (#44546A).
       - Las celdas de datos están vacías / limpias a la espera del Plan de Control oficial.

[ ] 3. FOTOGRAFÍAS: ¿Cumple el estándar de fotografía real y didáctica?
       - 0% imágenes sintéticas / IA (sin excepciones).
       - Secuencias complejas resueltas con layouts multi-foto paso a paso (2 a 4 imágenes).
       - Fotos nítidas, con grillas limpias y sin amontonamientos.
       - Las pantallas HMI son la FOTO REAL enderezada, con el rótulo encima y sin tapar
         ningún valor (NO redibujadas — Fak 08/09/2026), y ese rótulo mide >= 7 pt impreso.
       - Purgados todos los celulares de traducción, caras de espaldas y pisos vacíos.

[ ] 4. LENGUAJE: ¿Vocabulario 100% español argentino de planta automotriz?
       - Cero "izaje" -> Reemplazado por "puente grúa", "amarre con cadenas".
       - Cero "eslingas de elevación" -> "cadenas de puente grúa con grilletes".
       - Cero "cubo de desecho" / "contenedor de rechazo" -> "cajón de scrap / contenedor rojo".
       - Cero "mandril" -> "eje neumático expansible".
       - Cero "núcleo" -> "buje de cartón".
       - Cero "mordazas" aisladas -> "clamps neumáticos / mordazas neumáticas".
       - No contiene elementos exclusivos de transporte/flete marítimo (ej. topes rojos Kip).

[ ] 5. FORMATO SGC (I-IN-002.4-R01): ¿Geometría y diseño corporativo intactos?
       - Tamaño A4 apaisado exacto (29.7 x 21.0 cm, márgenes 0.70 cm).
       - Paleta corporativa SGC (#44546A cabeceras, #4472C4 seguridad, #1F497D notas).
       - Logo de Barack sobre fondo blanco (sin relleno azul).
       - Redacción en infinitivo instruccional puro ("Verificar", "Montar", "Accionar").
       - Puntos críticos VW señalizados con triángulo amarillo (#FFD700) en foto y ▲ en texto.
       - Plan de Reacción en Arial Bold con las 3 fases fijas del SGC a la izquierda y acciones del puesto a la derecha.

[ ] 6. ARCHIVO CERRADO Y VERIFICADO:
       - PowerPoint cerrado antes de la generación para evitar bloqueos de archivo.
       - Verificación del archivo .pptx físico generado, no del script de prueba.
```

---

## 7. ESPECIFICACIÓN TÉCNICA PARA SCRIPTS GENERADORES (PYTHON / PPTX)

Para los desarrolladores y agentes encargados de programar herramientas automatizadas de Hojas de Proceso en Python (`python-pptx`), los siguientes snippets representan las funciones canónicas de construcción:

```python
# Coordenadas y geometrías canónicas para python-pptx
W, H = 29.70, 21.00
M = 0.70
X0, X1 = M, W - M

# Encabezados y bloques principales (en centímetros)
HDR_Y, HDR_H = M, 4.00
BODY_Y, BODY_H = 4.90, 9.90
IMG_X, IMG_W = X0, 16.20
DSC_X, DSC_W = X0 + IMG_W + 0.25, X1 - (X0 + IMG_W + 0.25)

CIC_Y, CIC_H = 15.00, 3.10
EPP_W = 6.40
CIC_W = X1 - X0 - EPP_W - 0.25
EPP_X = X0 + CIC_W + 0.25

PLN_Y, PLN_H = 18.30, H - M - 18.30

# Colores institucionales SGC
AZUL_SGC       = RGBColor(0x44, 0x54, 0x6A)  # Bandas de cabecera
AZUL_SEGURIDAD = RGBColor(0x44, 0x72, 0xC4)  # Banda EPP
AZUL_TEXTO     = RGBColor(0x1F, 0x49, 0x7D)  # Notas al pie
BLANCO         = RGBColor(0xFF, 0xFF, 0xFF)
NEGRO          = RGBColor(0x00, 0x00, 0x00)
GRIS_CLARO     = RGBColor(0xF2, 0xF2, 0xF2)  # Fondo disparador
AMARILLO_VW    = RGBColor(0xFF, 0xD7, 0x00)  # Triángulo crítico VW
ROJO_BORDE     = RGBColor(0xC0, 0x00, 0x00)  # Borde triángulo
```

Cualquier actualización futura del skill `hojas-de-proceso` debe incorporar íntegramente estas directivas como sus reglas de validación primaria.
