## Definición de hecho

**1. Ruta, fuentes con link y opinión marcada: cumple a medias.**
- La ruta coincide: `docs/INVESTIGACION_SISTEMA_3D_2026-10-23.md`.
- La opinión está marcada en casi todo, por ejemplo «(opinión) El error de base…» y «(fuente sin abrir)».
- Los links no están al lado de cada afirmación: «En el cuerpo las fuentes se citan por nombre; los links están en «Fuentes», al final».
- El propio informe admite que «cinco no tienen link»: Rong et al., Manifold issue 1430, APAR HD64346, text-to-cad issue 371 y CAAKiiMechanismSolve.
- Hay afirmaciones sin ninguna fuente en la lista:
  - Onshape AI Advisor e Inventor (§4, «Huecos»);
  - la caché `gen_py` (§8);
  - «Nunca el MCP con certificado extraído» (§8, fase 4);
  - Kipp/Ganter/norelem/Destaco (§2.5).
- Hay veredictos sin marcar como opinión. En la tabla del §5 solo los cursos dicen «(opinión)», y las 5 del §10 tampoco lo dicen.

**2. Separar confirma / contradice / no se les había ocurrido: cumple.**
- La separación está en §2, §3 y §4.
- Detalles menores: §3.10 contradice a los propios frentes de la investigación («CATIA hace más de lo que supusieron dos frentes»), no a lo que hace Facundo. Y §4.13, «build123d sí está medido», es más confirmación que novedad.

**3. Crítica de lo real y causas de raíz: cumple.**
- La tabla del §1 da causa y clase para cada uno de los seis problemas, con citas de archivo.
- Nombra patrones: «La skill es un verificador de piezas, no un método para diseñar mecanismos».
- No le da la razón: «Cursos oficiales de CATIA — Mala para estos problemas».
- El error de base está dicho en forma explícita.
- Reparo: parte de «lo real» es de segunda mano. Propuestas reconoce que «`catia.md`, `DONDE_QUEDO.md`, `AUDITORIA_auditor.md` y los scripts no vinieron adjuntos: los cito a través de la crítica interna», y esa crítica no está guardada en ninguna ruta citada.

**4. Las 5 con porqué, las preguntas y la implementación con repos: cumple.**
- El §10 trae las 5, cada una con Qué / Por qué / Causas que ataca / Cómo sabríamos que funcionó.
- El §11 trae 13 preguntas, y el §8, repos y arquitectura.
- Reparos:
  - Las 5 son paraguas: la #5 tiene siete ítems, y eso diluye el «primero».
  - «En una página» lista cuatro cambios, no los mismos cinco: falta «herramientas rápidas y edición incremental».

**5. Propuestas documentadas, no aplicadas, con evidencia, riesgo y prueba: cumple.**
- Lo dice textual: «No se aplicó nada: la skill, la memoria y los pendientes quedan como estaban».
- De P1 a P14 todas tienen evidencia, «Riesgo» y «Cómo se prueba».
- Reparo: parte de la evidencia se cita como «crítica §3/§6/§7.2» o «conteo aproximado de la refutación», documentos que Facundo no tiene. Un auditor no puede seguir esa cadena.

## Quiz

**1. Error de base** («En una página», repetido en §1)
- Respuesta del entregable: «(opinión) El error de base no es de herramienta ni de falta de conocimiento: es de cuándo se aplica ese conocimiento.»
- La sostiene con tres datos:
  - controles solo al principio y al final;
  - 80 % de las reglas son solo texto;
  - una skill que nació para verificar piezas, no para diseñar mecanismos.
- **Claridad: sí.** «Los controles están en los dos extremos; en el medio no se dispara nada» lo entiende cualquier ingeniero de procesos.

**2. Las 5 cosas** (§10)
1. Fases con contrato y criterio de salida verificable, con la seguridad dentro del mecanismo.
2. Biblioteca de constructores de la casa, más catálogo con procedencia.
3. Las marcas que más importan, convertidas en código: cantos convexos, atrapamiento, largo de agarre, página leída del JSON.
4. Herramientas rápidas y edición incremental.
5. Dieta de la skill y lazo de aprendizaje medido.

**Claridad: a medias.** Los títulos se entienden. El «Qué» no: «det +1», «`fresca=True`», «las guardas de Manifold», «GATE 1 con procedencia», «par BIEN/MAL».

**3. Repos y arquitectura** (§8)
- Respuesta del entregable: «Ninguno implementa el sistema entero».
- Repos que menciona:
  - la cadena build123d-mcp → augura → estampo → bambox, inmadura y con AGPL;
  - text-to-cad, con telemetría por defecto;
  - jarvis-onshape-mcp (diff), catia-v5-mcp (defensas de COM) y AssemCAD (especificación), para copiar patrones sin instalarlos.
- Arquitectura, por pasos:
  - **0, base:** banco de evals con el virolador;
  - **fase 0:** contrato YAML firmado;
  - **fase 1:** concepto y búsqueda en orden (`indice_dispositivos.py` → bd_warehouse → 3Dfindit/TraceParts → repos imprimibles → de cero), con PartCAD como candidato a formato;
  - **fase 2:** mecanismo con geometría cruda y barrido con manifold3d/trimesh, con SPAWorkbench vía pycatia como segundo juez y cronómetro de 2 min;
  - **fase 3:** constructores de la casa en build123d y en `scripts/catia/`, control de cantos, corrección por `params.json` con diff;
  - **fase 4:** augura, laminado, Bambu Connect;
  - **cierre de fase:** revisor calibrado;
  - **retorno:** primera pieza y marcas al registro.

**Claridad: la más baja.**
- Hay términos que un ingeniero no programador no tiene por qué conocer: `status()`, `MinGap`, `connect_to` «does not bind them», OCP, `gen_py`, «lazo cerrado».
- Además, el §8 no coincide con «Lo que NO propongo» de Propuestas. augura, PartCAD, OrcaSlicer por línea de comandos, `design_audit`, el chequeo propio de voladizo y `verify_spec` aparecen en la arquitectura, y las propuestas los descartan o los posponen. El informe no tiene ninguna nota que lo cruce.

## Lo que falta

- **«diseño generativo … copilotos de CATIA/SolidWorks/Fusion/Onshape»** → no se cubrió. El informe lo dice, pero al final del §4: «El diseño generativo y el DFM/DFA no se investigaron» y «SolidWorks, Onshape y Creo quedaron casi sin cubrir». No aparece en «En una página».
- **«cómo trabajan los equipos de ingeniería de utillajes con experiencia … revisiones de diseño, DFM/DFA, checklists»** → la evidencia sale de vendedores (Roche, Formlabs que es SLA, Omni3D) o de fuentes sin abrir (Cross, Stage-Gate, APQP, DFMEA). No hay un solo método de equipo real documentado y abierto.
- **«cada afirmación con su fuente (link)»** → faltan referencias junto a cada afirmación, los 5 links que no vinieron y fuente para las afirmaciones listadas arriba.
- **«que pasen procesos de auditorías si deja todo documentado»** → falta la ruta de la crítica interna y de la verificación. Sin eso, la evidencia de la tabla del §1 y de las propuestas no se puede auditar.

## Lo que sobra

- **La tabla del §7** (unas 20 herramientas) se pisa con el §8 y con «Lo que NO propongo»; buena parte de esas herramientas termina descartada.
- **Decimales de benchmarks** que un ingeniero no puede usar para decidir: 0,55 → 0,48, 3,37 contra 3,41, 5,20 → 4,92, 32,7 → 31,4. Alcanza con la conclusión y la advertencia.
- **En Propuestas:**
  - la reconstrucción de la regla de tamaño de `codigo-madre.md`, que «tampoco vino», y la columna «Tamaño» que depende de ella;
  - las menciones a artefactos internos: «la refutación», «crítica §N».
- **El volumen:** un informe muy largo y 14 propuestas para un viernes. Facundo pidió «Prefiero una crítica fundada a una lista prolija». La crítica está fundada, pero llega con formato de lista larga.

## Veredicto

**Entregable con estos arreglos:**
1. Poner referencias numeradas en cada afirmación, y completar o marcar como «sin link» las cinco fuentes faltantes y las afirmaciones sin fuente.
2. Guardar en `docs/` la crítica interna y la verificación, y que Propuestas cite rutas en vez de «crítica §N». Aclarar qué archivos del virolador se leyeron de segunda mano.
3. Agregar en el §8 una nota con lo que Propuestas descarta o pospone: augura, PartCAD, OrcaSlicer, `design_audit`, `verify_spec`, chequeo propio de fabricación.
4. Alinear «En una página» con las 5 del §10 y subir ahí los huecos: diseño generativo, DFM/DFA, copilotos.
5. Abrir el §8 con un resumen de cinco líneas en castellano llano, sin nombres de funciones.
