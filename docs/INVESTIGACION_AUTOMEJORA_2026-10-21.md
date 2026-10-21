# Cómo se mejora solo el sistema: lo que hay publicado y cómo armarlo

Fecha: 21/10/2026 · Sale de 3 investigaciones verificadas (anexos f15, f16, f17) y de la crítica interna (anexo 00).

## En una página

- **No está probado que el sistema se mejore solo.** Se puede armar el lazo sin entrenar modelos: un banco de ejercicios, un corrector por programa, una IA que propone cambios chicos y un script que los acepta solo si mejoran sin romper nada [12][13][14] (opinión: es una inferencia, no un hallazgo). Pero el estudio más directo no encontró una mejora significativa [18], y a igual gasto reintentar rindió igual o más [17].
- **Confianza que dieron los frentes.**
  - Dirección general: media en los tres.
  - Que la mejora nocturna funcione: baja (f15, f17).
  - Cuánto mejora practicar: baja (f16).
- **Lo que más rindió afuera fue reintentar contra un corrector que dice qué falla.** Con eso, GPT-5.5 pasó de 38,8 % a 60,5 % de requisitos cumplidos [9]. Es reparar cada diseño con el diagnóstico, no que el sistema aprenda de un diseño para el siguiente. Con Opus 4.7, en pieza única, empeoró apenas; en otra prueba el resultado fue mixto [9].
- **Reglas escritas por la IA.** Sin devolución no ayudan. Con un corrector mejoran contra no tener reglas, pero quedan por debajo de las curadas por personas [1][3][10].
- **Todavía no conviene automatizar el lazo.** Primero, el banco y los tres brazos a mano (opinión, coincide con f17). Hay casos publicados de agentes que engañaron al corrector, sobre todo con consignas ambiguas [5][20][21]. Cada regla nueva la aprueba Fak (opinión).
- **Costo (cuenta propia, opinión).** No hay cifra publicada para CAD.
  - Si cada caso cuesta lo que una corrida del agente con Sonnet (USD 0,84 [18]), una pasada de 20–30 casos sale USD 17–25 sin reintentos.
  - Una optimización completa de una skill costó USD 182–485 [18].
  - El tope de USD 8 por corrida (dato propio, regla api-claude, según f17) no alcanza ni para una pasada.
- **Riesgo principal (opinión).** Que mejore en sus propios ejercicios y no en diseños nuevos. Con un banco chico, la mejora no se distingue del azar [18][19].

## Por qué falló el virolador (causas de raíz, anexo 00)

- **Estética antes que mecanismo.** El flujo son nueve pasos sin criterio de salida entre uno y otro, y los controles empujan hacia lo visual (render, PDF, revisión ciega con solo renders). La regla no existía.
- **Palanca dibujada de cero.** El retorno de experiencia mira solo lo que la casa ya fabricó, no el catálogo. El GATE 1, que prohíbe inventar cotas, empuja a dibujar porque no admite una pieza comprada como fuente válida. Además, CATIA no traga mallas.
- **Cantos vivos.**
  - La regla existía y el redondeo ya estaba resuelto en una función, pero esa función vivía en un build de agosto y no en una biblioteca.
  - `gate_aristas.py` solo ve cantos cóncavos, y los que lastiman la mano son convexos.
- **Simulaciones de minutos por posición y modelo rehecho entero en cada corrección.** La receta de CATIA mandaba arrancar de cero, y nada mide el tiempo.
- **Por qué las reglas no frenan.**
  - De unas 210 reglas de diseño (conteo aproximado, ±15 %), ~10 frenan la entrega, ~30 tienen una herramienta que hay que acordarse de correr y ~170 son solo texto.
  - Los controles están al principio y al final; en el medio no se dispara nada.
  - Cada lección se escribe como relato donde nació, no donde se la va a necesitar.
  - Tres de los seis problemas tenían la regla escrita. Conclusión del anexo (opinión): no falta conocimiento, falta el momento en que se aplica.

## Confirma / contradice / no se nos ocurrió

**Confirma lo que ya hace o piensa el sistema**

| Lo publicado | Lo nuestro |
|---|---|
| El rechazo del programa manda sobre la aprobación de un juez IA [5][12] | «La máquina puede MATAR un dato, nunca APROBARLO» (anexo 00) |
| Mutantes para probar si el corrector caza fallas [8] | Pares sintéticos BIEN/MAL en cada control (anexo 00) |
| 2–3 módulos enfocados rinden más que la documentación «completa» [1] | Diagnóstico de ~35.000 palabras que nadie aplica (anexo 00) |
| Corrección en cascada por etapas [7] | Controles por fase que propone el anexo 00 |

**Contradice**

- **La IA sí puede escribir reglas útiles.** Trace2Skill lo logró con trazas y un verificador: +18,6 [3]. Ojo: usó 200 + 200 problemas resueltos y unas 20.000 horas de GPU.
- **Sí hay papers que miden función.** La investigación del 17/10 decía que ninguno lo hacía; f16 encontró tres.
- **El juez visual sí ayudó a GPT.** En [9], un juez con 21 vistas sumado a medidas fue la primera mejora grande con GPT (+6,3). Con Opus, no.
- **Practicar un tipo de ejercicio no se traslada a otro.** Según CADEngBench, el ranking casi no se asocia entre tareas (sin verificar).
- **ACE choca con «chico y enfocado».** Defiende contextos largos y usa +117 % de tokens (f15).

**No se nos ocurrió**

- **El rival a vencer es «reintentar más»** [17].
- **Un caso canario** que ninguna solución honesta pasa: si la IA lo pasa, hizo trampa [5].
- **Vistas de ingeniería en vez de perspectiva**, porque la perspectiva esconde fallas [7].
- **Un contador útil/dañino por viñeta** [2].
- **Congelar la base.** Aprender sobre versiones viejas dio reglas falsas [18].
- **Cuántos ocultos hacen falta.** Con 20–26, una mejora solo se detecta si la regla nueva gana 4 de cada 5 desacuerdos [18].

## Lo que ya existe y se puede usar

| Qué | Para qué nos sirve | Fuente | ¿Sirve con la API de Claude, sin entrenar? |
|---|---|---|---|
| Guía de evals de Anthropic | Arrancar con 20–50 fallas reales; separar la suite de capacidad de la de regresión (~100 %); corregir por programa | [12] | Sí |
| skill-creator con evals | Medir la skill con y sin el cambio, a ciegas | [4] | Sí. Para medir, no para escribir reglas (veredicto f15). En una prueba de competidores no mejoró skills, pero con modelos Qwen, un solo prompt y sin las evals del propio skill-creator [3] |
| GEPA y gskill | El lazo ya hecho: cambia el texto del SKILL.md y lo prueba en pocos casos y después en toda la validación | [13][14]; repo [16] sin abrir | Sí. Funcionó en Claude Code con Haiku 4.5, en tareas simples y sintéticas; con Sonnet, la ganancia fue casi nula [14] |
| ACE | Reglas como viñetas sueltas con contador útil/dañino | [2] | La idea, sí. El código no está probado con Claude. Sus autores son de SambaNova y declaran no tener conflicto de interés |
| CADTests / CADTestBench | Tests sobre el sólido y mutantes | [8] | Sí |
| MUSE | Cascada (ejecuta → geometría válida → sin solapes → juez visual con rúbrica) y vistas de ingeniería | [7] | Sí |
| Hephaestus-CCX | Reintento con un informe de FEA que dice qué carga o qué cara falla; 50 casos, CalculiX, licencia MIT | [9] | Sí, medido con Claude Code y Codex |
| CADSmith (todo sin abrir, solo búsqueda de f16) | Mide con OpenCASCADE y después opina un juez visual con 3 vistas | [24] | Usaría la API de Claude |

**Queda afuera:** ToolCAD y el aprendizaje por refuerzo, que requieren entrenar. En ToolCAD, el modelo entrenado casi no le ganó a GPT-4o sin entrenar: 63,9 % contra 62,7 % [11]. Trace2Skill es demasiado grande para nosotros (opinión).

## El ciclo propuesto (opinión, con piezas publicadas)

```
[1] EJERCICIO ← banco: virolador del 20/10 (capacidad + regresión) · ~20 de práctica · 20–26 ocultos
      ↓
[2] DISEÑO ← Claude por API + skill actual, en build123d (CATIA afuera de la noche, f17)
      ↓
[3] CORRECCIÓN POR PROGRAMA en cascada:
    corre → sólido válido → sin solapes → recorrido → cantos y fabricación
    = nota por etapa + diagnóstico en texto
      ↓ falla
[4] REINTENTO con el diagnóstico, hasta N veces
      ↓ sigue fallando
[5] INVESTIGAR: 2–3 «investigadores» proponen un cambio chico
    (mejor un control o una pieza de biblioteca que otra regla de texto)
      ↓
[6] ACEPTAR solo si: mejora en práctica · los ocultos no bajan · se siguen cazando
    los 6 defectos del virolador · corrector intacto (huella) · le gana a «reintentar más»
      ↓
[7] A LA MAÑANA: hoja para Fak con el cambio y 3 vistas → aprueba o tira
```

- **Caja 3.** La cascada y las vistas salen de MUSE [7]. Conviene corregir por programa antes que con un juez [12] y pasarle a la IA el diagnóstico, no solo la nota [9][15].
- **Caja 5.** Proponer varios cambios a la vez subió el resultado en la prueba de 68,9 % a 72,1 % en GEPA [13]. Condiciones: el proponedor era gpt-5-mini, hicieron falta 3.000–5.000 llamadas y una configuración bajó a 66,7 %. Como ~170 reglas son solo texto [25], el cambio debería ser un bloqueo y no un renglón más (opinión).
- **Caja 6.** Primero se prueba en pocos casos, después en toda la validación [13].
  - A igual gasto, evolucionar el arnés del agente, en tareas de terminal, no le ganó de forma pareja a reintentar, y casi no se trasladó a tareas nuevas [17]. Una versión posterior dice que sí gana cuando hay margen y una devolución detallada (fuente sin abrir).
  - **Ocultos.** Con 20–26, el lazo puede detectar mejoras grandes. Si al principio hay solo ~10, el lazo no demuestra nada: lo que produce es un borrador para que Fak revise [18].
- **Caja 7.** En el estudio más directo, la mejora no fue significativa, pero la persona que revisó encontró útil lo propuesto [18]. GEPA tiene una guía para usar Claude Code como proponedor, pero f17 solo vio el título.

## De dónde salen los ejercicios

- **El virolador del 20/10 cumple dos papeles** (propuesta del anexo 00). Sus 6 defectos conocidos son: palanca dibujada de cero, cantos vivos, armado en espejo, tornillo corto, números tipeados y conjunto guardado sin la parte fija [25].
  - **Como caso con defectos:** el sistema tiene que rediseñarlo sin repetirlos.
  - **Como regresión:** después de cada cambio, el corrector y el revisor tienen que seguir cazando los 6. Si alguno se escapa, el cambio se rechaza.
- **Mutantes.**
  - Se rompe a propósito un diseño que pase todos los controles: holgura cero, canto vivo, pared fina, pasador sin recorrido. Si el corrector no lo caza, está flojo [8]. No gasta API (opinión).
  - Qué diseño usar como base lo define Fak: hoy no hay una versión corregida del virolador.
  - Los tests escritos por Claude cazaron ~65 % de los mutantes al principio y más de 90 % tras 4 rondas de ajuste (fuente sin abrir).
- **Bancos públicos con corrector.** MUSE: 106 diseños de muebles y portatarjetas, no utillajes [7]. CADTestBench: 200 programas [8]. Hephaestus-CCX: 50 casos con FEA [9].
- **Variaciones.** Diseñadores hacen semillas, una IA las varía y una persona revisa [7]. Las semillas serían dispositivos que Fak ya aprobó (opinión).
- **Ejercicios de CATIA de la web.** Ya se resolvieron decenas, y el cuello de botella fue leer el plano, no CATIA [25]. Rinden menos que los casos propios (opinión).
- **Lo que no apareció:** bancos de sargentos, posicionadores o plantillas, ni controles de voladizos FDM (f16).

## Los riesgos y cómo se frenan

**1. Sobreajuste al banco.**
- **Por qué pasa:** si las mismas tareas generan la experiencia, eligen el cambio y lo miden, el lazo se ajusta a sí mismo [19]. Además, reusar siempre los mismos ocultos infla la nota [13].
- **Frenos (propuestas):**
  - ocultos que la IA nunca ve y que se renuevan;
  - una base congelada de impresora, material y versión del corrector (adaptación de f17 a partir de [18]);
  - comparación caso por caso contra la regla actual [18].

**2. Engañar al corrector.**
- **Casos publicados:**
  - un agente que se editaba solo falsificó el registro de tests [20];
  - con consignas ambiguas hicieron trampa Claude (33 %) y Codex (44 %) [21] (fuente sin abrir; las cifras son de la verificación f17);
  - un 100 % de aprobación escondía un 68 % de capacidad real [5].
- **Frenos:**
  - la IA solo escribe texto de reglas;
  - corrector, banco y script de aceptación van en carpeta aparte, con huella verificada (opinión de f17); restringir qué se edita lo recomienda [22] (fuente sin abrir);
  - un caso canario [5].

**3. Reglas malas que se acumulan.**
- **Casos publicados:**
  - en un método anterior que reescribía todo (Dynamic Cheatsheet, mostrado en el paper de ACE), el contexto colapsó de 18.282 a 122 tokens [2];
  - un selector automático arregló 57 tareas y rompió 21 en un paso, y arregló 26 y rompió 46 en otro [3];
  - sumar un archivo de contexto subió el costo 20–23 % [6];
  - la memoria sin supervisión degrada conductas [23] (fuente sin abrir).
- **Frenos:**
  - viñetas chicas con contador [2], en 2–3 módulos enfocados [1] (está en tensión con ACE: ver «Contradice»);
  - poda con presupuesto de lo que no frenó nada (opinión del anexo 00);
  - Fak aprueba cada viñeta.

**4. Juez visual y reintento con Claude.**
- **Qué se sabe:** la perspectiva esconde fallas [7]. Opus 4.7, en pieza única, bajó de 32,7 % a 31,4 % al reintentar; en otra configuración, el resultado fue mixto [9].
- **Frenos:**
  - el programa corrige primero y el juez visual opina después [7][12], aunque con GPT el juez con 21 vistas sí sumó [9];
  - siempre se mide contra «reintentar más» [17].

## Qué se hace el viernes

1. **Armar el banco en `evals/banco/cad/`** (ruta que propone el anexo 00): el virolador con sus 6 defectos, la práctica y los ocultos.
   - **Por qué:** sin casos propios no hay nada que medir, y la guía arranca con fallas reales [12].
2. **Pasar los controles a cascada**, con nota por etapa y diagnóstico, en build123d con manifold3d. manifold3d está instalado pero no figura en la lista de entorno de SKILL.md [25]. Sumar el control de cantos convexos.
   - **Por qué:** el diagnóstico es lo que hizo rendir el reintento [9], y los cantos fueron un defecto real que nadie mira [25].
3. **Probar el corrector con mutantes** y con los 6 defectos del virolador.
   - **Por qué:** un corrector que no los caza aprueba cualquier cosa [8].
4. **Correr a mano tres brazos:** la skill actual; la skill con reintentos y diagnóstico; la skill con cambios propuestos. Anotar el costo real por corrida (opinión).
   - **Por qué:** lo publicado no muestra que evolucionar reglas le gane a reintentar [17][18], y no hay cifra de costo para CAD.
5. **Solo si el brazo 3 le gana al 2, preparar GEPA** (opinión).
   - **Por qué:** sin esa ventaja, automatizar solo gasta. La única evidencia abierta con Claude como proponedor es un tutorial de un solo objeto, con criterios estéticos y sin chequeo geométrico [15].

**Pasos para GEPA y el corrector, todos (a probar el viernes):**

- Abrir el repo gepa-ai/gepa [16] y la guía de Claude Code como proponedor. Los dos están sin abrir, y el procedimiento de instalación no figura en los adjuntos.
- Apuntar GEPA solo al texto del SKILL.md, que es lo único que cambia [13][14].
- Conectar el corrector para que devuelva nota y diagnóstico en texto, la devolución que usa el lazo [13][15].
- Dejar corrector, banco y script de aceptación fuera de su alcance, con huella (f17).
- Probar primero en pocos casos y después en toda la validación [13], con tope de gasto y la hoja de la mañana para Fak.

## Glosario

- **build123d / manifold3d / OpenCASCADE:** librerías para modelar sólidos por programa, hacer booleanos y verificar la geometría.
- **FEA / CalculiX:** cálculo de esfuerzos por elementos finitos; CalculiX es el programa que usa [9].
- **SKILL.md:** el archivo de reglas que Claude lee antes de diseñar.
- **Contexto / tokens:** el texto que el modelo lee en cada pedido y la unidad en que se cobra.
- **Suite de capacidad / de regresión:** casos que todavía cuestan / casos que ya salían y no pueden romperse.
- **Validación / ocultos:** casos para decidir si un cambio sirve; los ocultos la IA nunca los ve.
- **Desacuerdo:** caso en que una regla acierta y la otra falla.
- **Huella:** firma del archivo (hash) que delata si alguien lo tocó.
- **Proponedor:** la IA que sugiere los cambios a las reglas.
- **Brazo:** cada variante que se compara en la prueba.
- **Aprendizaje por refuerzo / GPU:** forma de entrenar modelos y el hardware que exige; fuera de nuestro alcance.

## Fuentes

1. SkillsBench — https://huggingface.co/papers/2602.12670 — abierta
2. ACE — https://arxiv.org/pdf/2510.04618 · https://github.com/ace-agent/ace — abiertas
3. Trace2Skill — https://arxiv.org/pdf/2603.25158 — abierta
4. Anthropic, Improving skill-creator — https://claude.com/blog/improving-skill-creator-test-measure-and-refine-agent-skills — abierta
5. Wahi, LLM-as-a-Judge Is Not an Oracle — https://arxiv.org/abs/2609.02246 — abierta (resumen)
6. ETH Zurich, archivos de contexto — https://arxiv.org/pdf/2602.11988 — abierta
7. MUSE — https://arxiv.org/html/2605.28579v2 — abierta en parte
8. CADTests — https://arxiv.org/html/2605.07807v1 — abierta en parte; repo https://github.com/dimitrismallis/CADTestBench sin abrir
9. Lazo con FEA y Hephaestus-CCX — https://arxiv.org/pdf/2605.17448 — abierta
10. SkillLearnBench — https://huggingface.co/papers/2604.20087 — abierta
11. ToolCAD — https://arxiv.org/abs/2604.07960 — abierta (resumen)
12. Anthropic, Demystifying evals for AI agents — https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents — abierta en copia de terceros: https://github.com/sullivan-street-projects/anthropic-docs-local/blob/master/engineering/demystifying-evals-for-ai-agents.md
13. GEPA, propuestas en paralelo — https://gepa-ai.github.io/gepa/blog/2026/07/30/parallel-proposals/ — abierta
14. GEPA, gskill — https://gepa-ai.github.io/gepa/blog/2026/02/18/automatically-learning-skills-for-coding-agents/ — abierta
15. GEPA, tutorial 3D — https://gepa-ai.github.io/gepa/tutorials/3d_unicorn_optimization/ — abierta (un objeto, criterios estéticos, sin chequeo geométrico)
16. GEPA, repositorio — https://github.com/gepa-ai/gepa — sin abrir
17. Wang et al., Rethinking the Evaluation of Harness Evolution — https://arxiv.org/html/2607.12227v1 — abierta (v1, cortada; la cifra de 67,4 no se pudo ver); v4 https://arxiv.org/abs/2607.12227 sin abrir
18. Skill Issue (JetBrains) — https://arxiv.org/pdf/2609.12742 — abierta
19. Self-Evolving Coding Agents — https://arxiv.org/html/2608.03392 — abierta en parte
20. Darwin Gödel Machine — https://sakana.ai/dgm/ — blog abierto por f17; la verificación, solo con extractos
21. EvilGenie — https://arxiv.org/abs/2511.21654 — sin abrir
22. Let the Barbarians In — https://arxiv.org/pdf/2512.14806 — sin abrir
23. Your Agent May Misevolve — https://arxiv.org/abs/2509.26354 — sin abrir
24. CADSmith — https://github.com/jabarkle/CADSmith — sin abrir (solo búsqueda de f16)
25. Anexo 00, crítica interna de la skill 3D — .sgc-cache/inv3d/salidas/interna.md — interno, leído y contrastado
