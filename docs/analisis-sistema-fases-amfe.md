# ¿Conviene un sistema de fases con agentes independientes para hacer AMFEs?

**Veredicto: NO conviene construirlo.** De los 11 problemas reales de hoy, ninguno se habría
evitado con más agentes: 5 se evitan con checks automáticos (3 ya existen, 2 hay que ampliar),
2 con abrir una fuente que estaba a mano, 2 los encontró el único agente independiente que ya
existe (`/auditoria-cliente`), y 2 son cosas del mundo real que ningún agente puede fabricar
(el Plan de Control que falta y las firmas). Lo que falló hoy no fue la cantidad de revisores:
fue que dos fuentes no se abrieron antes de escribir, que dos candados miraban campos de menos,
y que la tabla de referencia interna estaba mal — y eso último lo cazó justamente el flujo de
auditoría que ya tenemos, en una sola pasada.

Análisis del 2026-08-24, sobre la evidencia del AMFE 172 (Ductos, Cozzuol): generado hoy,
auditado hoy por un auditor independiente contra el manual (20 hallazgos, 9 confirmados,
veredicto RECHAZADO), y revisado después por Facundo (que encontró 2 problemas más que el
auditor no vio).

---

## 1. La cuenta: qué habría evitado cada hallazgo

Los 9 confirmados de `.audit-cliente/AMFE-DUC-PAT.json`, más los 2 que encontró Facundo.
Categorías:
- **(a)** un check automático que faltaba (o que existía pero miraba de menos)
- **(b)** una fuente de datos que no se consultó antes de escribir
- **(c)** un criterio de redacción que no estaba escrito
- **(d)** de verdad hacía falta una revisión independiente
- **(e)** falta algo en el mundo real — no lo arregla ningún flujo de generación

| # | Hallazgo | Qué lo habría evitado | Cat. |
|---|---|---|---|
| 3 | Detección subdeclarada en las 47 causas (visual humana en D=3-6) | Nada interno: la tabla de la regla de la casa estaba mal, y cualquier redactor o agente que leyera esa regla repetía el error. Lo rompió el auditor SIN las reglas, leyendo el manual. Ya quedó como check (`DETECTION_HUMANA_OPTIMISTA`). | **(d)** |
| 4 | Un mismo efecto con S=5, 7, 8 y 9 | Estructura de datos: la severidad ahora vive EN el efecto y no se puede escribir a mano. Resuelto de raíz en el generador. | **(a)** |
| 5 | Scrap calificado en banda de retrabajo (S=4-6) | Un check simple: efecto que dice "scrap" con S<7 se marca. Existe parcial para corte; generalizarlo es código, no un agente. | **(a)** |
| 14 | Citas de norma mal trazadas (§5.1.1 no existe en la CVTC) | Abrir el PDF de la norma, que estaba en el legajo. Se citó de memoria. | **(b)** |
| 11 | Ocurrencia que invoca historial de serie que no existe (O=3-5 en producto en PPAP) | Criterio ya escrito en amfe.md §13 + check mecanizable (O≤3 con producto sin serie = aviso). Recalificarla EN SERIO exige datos de proceso que todavía no existen. | **(a)** + parte (e) |
| 15 | Work element "Material" usado para material directo; faltan categorías 4M | La convención de la casa (amfe.md §9) es exactamente lo que el auditor cuestiona: ningún check interno lo iba a marcar, porque el check se escribe desde la misma convención. Decisión de criterio pendiente de Fak. | **(d)** |
| 8 | La "D" roja que pidió Cozzuol no aparece | El pedido está en un mail del cliente (09/06). Fuente que existía y no se consultó al generar; falta además que el export la imprima. | **(b)** |
| 10 | No existe el Plan de Control | Es un documento que hay que HACER (casillero de Calidad en la matriz de Cozzuol). Ningún agente lo evita ni lo inventa. | **(e)** |
| 6 | PFMEA sin aprobación (approvedBy = TBD) | La firma es de Fak y de la planta. Punto. | **(e)** |
| F1 | El documento exponía a Barack ("el procedimiento no incorpora todavía...", "conviven 6 y 7 mm") — lo encontró Facundo | La regla YA existía (para las HO) y el candado YA existía — pero mira solo el log de revisiones, y las frases estaban en las causas y los controles. Ampliar el check al cuerpo entero. **Sigue pendiente: hoy `scanRevisionMeta` solo se aplica sobre `revisions[].details`.** | **(a)** |
| F2 | Tolerancias y citas con número de sección adentro del AMFE — lo encontró Facundo | La regla existía (§11, "los valores van al Plan de Control") y el check `CONTROL_CON_VALOR` existía — pero mira solo los controles, no los requisitos ni las causas. Ampliar alcance. | **(a)** |

**La cuenta: (a) = 5 · (b) = 2 · (c) = 0 · (d) = 2 · (e) = 2.**

Y el dato que decide la pregunta: **los 2 hallazgos de categoría (d) los encontró la revisión
independiente que YA existe** — `/auditoria-cliente`, un solo subagente, sin acceso a las
reglas internas, con el manual como única fuente. No hay ningún hallazgo de hoy que pida un
agente que todavía no tengamos.

---

## 2. Por qué más fases con agentes no arregla lo que falló

**Ya tenemos un sistema de fases.** Hoy el flujo real fue: (1) generar con un script que hace
imposibles algunos errores (la S vive en el efecto, el AP solo se calcula); (2) validador con
~45 checks automáticos; (3) un auditor independiente contra el manual; (4) cada hallazgo
confirmado se convierte en check nuevo, así no puede repetirse. Eso ES un sistema de fases, y
la única fase donde un agente independiente paga ya está ocupada.

**Agentes con las mismas reglas se equivocan igual.** La lección más cara de hoy: la tabla de
Detección de la regla interna estaba mal, y 3 días de trabajo con esas reglas no lo vieron.
Cinco agentes leyendo la misma regla habrían coincidido, con toda confianza, en el mismo error.
Por eso `/auditoria-cliente` le PROHÍBE al auditor leer las reglas del repo. Esa separación
—escribir con las reglas de la casa, auditar sin ellas— es la única división de roles que la
evidencia respalda, y ya está hecha.

**Un agente "que agrega información según la pieza" choca con la regla más importante de la
casa.** Lo que le falta al AMFE 172 no son ideas: son datos (el Plan de Control, el historial
de serie, las firmas, la decisión sobre el espesor 6 vs 7 mm). Un agente sin esos datos solo
puede inventar (prohibido) o poner TBD (que el flujo actual ya pone). No hay nada en el medio.

**El costo es conocido y ya dolió.** Multiagente ≈ 15 veces los tokens; el techo de 5 nació de
dos incidentes reales (40 subagentes, 120 millones de tokens, 4 horas sin poder trabajar). Un
pipeline de 4-5 agentes por AMFE gasta eso en cada pieza para prevenir... cero de los
hallazgos de hoy.

**Lo que sí es cierto del diagnóstico de Facundo:** el AMFE 172 se generó en una sesión que
hacía otras cinco cosas a la vez. Eso es real y tiene arreglo — pero el arreglo cuesta cero
agentes (ver punto 3.1).

---

## 3. Lo que sí recomiendo (costo total: 1 a 2 agentes por AMFE, igual que hoy)

1. **Sesión dedicada por AMFE.** Un AMFE nuevo no se hace mientras se hacen otras cinco
   tareas. Es una regla de una línea. Costo: cero.

2. **Fase 0: el dossier de fuentes, ANTES de escribir una sola causa.** Listar y ABRIR (no
   citar de memoria): la BOM del arb, el flujograma, las HOs, las normas del legajo (el PDF,
   no el recuerdo), los mails del cliente con requisitos específicos (ahí estaba la D roja), y
   el SGC de recepción (carpeta `1 - Planes de control`, 390 archivos). Esto habría evitado
   los 2 hallazgos (b). Costo: cero agentes si las fuentes se conocen; 1 agente de búsqueda si
   hay que barrer el servidor. Se agrega como paso al checklist de amfe.md §17.

3. **Cerrar los 2 candados que miran de menos** (los dos hallazgos de Facundo):
   el barrido de frases que exponen a Barack tiene que correr sobre el documento ENTERO
   (hoy solo mira el log de revisiones), y el check de valores numéricos tiene que mirar
   también requisitos y causas (hoy solo mira controles). Costo: cero agentes, es código, y
   la regla de la casa dice que todo criterio confirmado nace con su check.

4. **Mantener `/auditoria-cliente` exactamente como está** — un solo agente, sin reglas
   internas, contra el manual, con el trinquete de convertir cada hallazgo en check. Hoy
   demostró que funciona: encontró en una pasada el error sistémico que afectaba a los 17
   AMFEs. No tocarlo.

5. **Para "ser más buenos" en serio: la tarea es de verificación en planta, no de redacción**
   (ver punto 4). Tres cosas concretas para chequear en el SGC y el arb.

Qué se gana: los 5 (a) quedan bloqueados para siempre, los 2 (b) se previenen con la fase 0,
los 2 (d) ya están cubiertos, y los 2 (e) quedan donde deben estar — como TBD visibles que
señalan trabajo del equipo, no como huecos tapados.

---

## 4. Recepción de materiales: ¿es todo H de verdad?

La OP10 hoy (leída de Supabase live): **11 causas, 10 en H y 1 en M, todas con D=7** —
porque toda su detección es documental (revisar certificados, conciliar remitos, contar) o
ensayo por lote, y la tabla oficial pone todo lo que depende de una persona en D=7.

Hice la cuenta con la tabla AP oficial del sistema, para cada combinación real de la OP10.
El resultado importa porque es contraintuitivo:

**Bajar la D con un instrumento casi no mueve el AP.** Con D=6 (instrumento sin capacidad
probada) o incluso D=5 (instrumento con estudio R&R), 7 de las 10 causas H **siguen en H**:
las de S=6 con O=4, las de S=8 con O=4-5 y las de S=9 con O=4-5 no bajan hasta D=4, y D=4
exige un sistema a prueba de error verificado, no un calibre. O sea: aunque encontremos todos
los controles del SGC y los escribamos perfecto, esas 7 filas quedan H — y está bien que
queden, porque el producto es nuevo, no tiene historial de serie y el Plan de Control no
existe. H no significa "documento malo": significa "el equipo tiene que definir una acción o
justificar por escrito que los controles alcanzan". Eso es trabajo del equipo APQP, no de
redacción.

**Las 3 que SÍ bajan, y qué control real haría falta.** Las tres causas con S=9 y O=3
("lote liberado antes del certificado", "material descargado directo en producción",
"material liberado y pendiente compartiendo sector") pasan de H a M con D=6, y a L con D=4.
Son justamente las documentales puras, donde el "instrumento" sería el sistema:

> **Un bloqueo duro en el arb**: que el lote entre en estado "pendiente de control" y el
> sistema NO permita consumirlo hasta que Calidad cargue la liberación con el certificado.
> Si eso existe y se verifica periódicamente que funciona, es un control a prueba de error:
> esas 3 causas bajan a L, legítimamente. Si el arb no lo soporta (hay que verificarlo — no
> lo sé, y no lo voy a afirmar), el D=7 actual es el honesto.

**Lo que hay que ir a verificar al SGC** (esto responde "fijarnos si no se nos pasó nada"):

- **Carpeta `1 - Planes de control` de Recepción De Materiales** (390 archivos): ¿existe plan
  de recepción para el Thinsulate, la espuma y los braquets? Si prescribe ensayo con
  instrumento, la D de esas filas puede ser 6 en vez de 7 (y 5 si el instrumento tiene
  estudio R&R). El AP casi no cambia, pero el documento pasa a describir controles que
  existen y se pueden defender ante un auditor.
- **El ensayo de densidad superficial se puede hacer en casa**: el laboratorio tiene balanzas
  en el cronograma de calibración (una de 0,0001 g de división). Si el plan de recepción lo
  incluye, es un control real con instrumento, no una promesa.
- **Flamabilidad**: si Barack no ensaya GB 8410 en planta (probablemente no), la detección
  real es el certificado del proveedor = documental = D=7 se queda. Ahí lo único que baja el
  riesgo es exigir el ensayo correcto en la especificación de compra — que es prevención, y
  es una acción para que defina el equipo, no un número para retocar.

**Y el camino natural que va a bajar el resto sin falsear nada:** cuando el producto entre en
serie y haya historial, la O se recalifica con datos (S=8 con O=3 y D=7 da M). Hoy usar O=3
sería inventar — es exactamente el hallazgo 11 del auditor, que sigue abierto.

---

## 5. Lo que NO recomiendo, y por qué

- **Agentes por fase o por dominio (redactor, enriquecedor, verificador por pieza).** Cero de
  los 11 hallazgos de hoy se habría evitado así; los que comparten reglas comparten los
  errores; cuesta ~15 veces los tokens; y el techo de 5 existe por incidentes reales.
- **Un agente que "agregue información según la pieza".** Lo que falta son datos del mundo
  (Plan de Control, serie, firmas, espesor 6 vs 7). Un agente no los tiene; solo puede
  inventarlos, y eso está prohibido con razón.
- **Bajar la D "porque hay más controles" sin verificar que existen.** La cuenta de arriba
  muestra que además de estar mal, casi no serviría: 7 de las 10 H no se mueven con papeles.
- **Cambiar el criterio de las tablas.** Facundo lo dijo y la evidencia lo confirma: las dos
  veces que una calificación salió sistemáticamente optimista, el problema era nuestra tabla,
  no la norma. La norma se transcribe del manual y no se negocia.

---

*Fuentes: `.audit-cliente/AMFE-DUC-PAT.json` (auditoría del 24/08), Supabase live (OP10 del
AMFE-DUC-PAT leída hoy), `scripts/_crearAmfe172Ductos.mjs`, `scripts/_lib/amfeValidator.mjs`
(sensibilidad del AP calculada con el `calculateAP` real del sistema), `.claude/rules/amfe.md`
§13 y §17, `.claude/commands/auditoria-cliente.md`, `docs/LECCIONES_APRENDIDAS.md`, memorias
`reference_sgc_recepcion_materiales` y `reference_metrologia_pesajes_barack`.*
