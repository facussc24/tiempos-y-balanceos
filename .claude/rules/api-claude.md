---
description: La API de Anthropic con los creditos mensuales del plan Max — que los gasta y que no, que modelo hace que, los 5 candados de la noche de Claude, donde vive la clave y para quien es el reporte de la noche
paths:
  - "scripts/_lib/claudeApi.mjs"
  - "scripts/_lib/preauditoriaAmfe.mjs"
  - "scripts/_lib/nocturno.mjs"
  - "scripts/_lib/supabaseSoloLectura.mjs"
  - "scripts/_preauditarAmfe.mjs"
  - "scripts/_nocturno.*"
  - "scripts/_claude.mjs"
---

# Regla: la API de Claude (creditos del plan Max)

Verificado contra la documentacion oficial el 08/10/2026 (`platform.claude.com/docs/en/about-claude/api-credits-for-subscribers`
y `.../pricing`). Traspaso completo: `docs/drafts/HANDOFF_API_CLAUDE_2026-10-08.md`.

## 1. Que gasta los creditos y que no

- El plan Max trae creditos de API por mes ($100 el Max 5x, $200 el Max 20x). **Vencen cada mes y no se
  acumulan.**
- **NO cubren Claude Code** ni el uso extra de las apps. El modelo que se elija en Claude Code (Opus,
  Fable) sale del plan, no de los creditos: cambiar el default **no gasta ni ahorra un centavo** de aca.
- Los gasta solo codigo que llama a la API con `ANTHROPIC_API_KEY` de la organizacion vinculada al plan.
  En este repo, **la unica puerta es `scripts/_lib/claudeApi.mjs`**: ningun script llama al SDK por su
  cuenta (asi el gasto queda en el ledger y el semaforo del mes es real).
- Los precios salen de la tabla oficial y viven en `PRECIOS` de `claudeApi.mjs`. Un informe o un post
  no es fuente de precios (el del 07/10 tenia mal Sonnet y los cache reads).

## 2. Que modelo hace que

| Rol | Modelo | Ejemplo |
|---|---|---|
| Orquesta, sintetiza y **refuta** | Opus 5.5 | refutador de la pre-auditoria (`effort: high`) |
| Revisa y escribe documentos | Sonnet 5.5 | revisor de AMFE, resumen de novedades |
| Volumen barato | Haiku 5.5 | una linea por mail sin respuesta (`effort: low`) |
| Deliberar | Fable 5.1 | **solo si Fak lo pide** (cuesta 2,5x Opus) |

El esfuerzo va siempre explicito (Opus y Haiku 5.5 arrancan en `medium`). Opus y Sonnet llevan el
fallback del servidor (`fallbacks: 'default'`); Haiku no lo tiene. Una respuesta rechazada, cortada por
`max_tokens` o con JSON roto es un **error** (`ErrorApi`), nunca un resultado a medias.

## 3. Los 5 candados de la noche (`scripts/_nocturno.mjs`, tarea de Windows 06:30)

La auto-mejora nocturna anterior se apago el 04/08/2026 (47.522 timeouts, fork bomb de `claude -p`).
La nueva es un `node` suelto que habla con la API por el SDK. Los hooks de Claude Code **no corren** para
el `node` del Programador de tareas: por eso los candados son codigo y test, no hooks.

1. **La noche no toca el repo ni escribe en Supabase, el arb u Outlook.** Lee y deja archivos solo en
   carpetas ignoradas (`.claude/state/`, `.sgc-cache/`, `reports/staging/`).
2. **A Supabase se entra solo por `supabaseSoloLectura.mjs`**: expone `from().select()` y nada mas; un
   `update`/`insert`/`upsert`/`delete`/`rpc` tira (el usuario de `.env.local` SI puede escribir).
3. **`__tests__/scripts/candadosNocturno.test.mjs`** lee el texto de los archivos de la noche y falla si
   aparece algo que guarda APQP, escribe en una tabla, mata procesos, toca el arb, manda mails o lanza
   `claude`. Cada patron tiene su gemelo rojo. **Es el enforcement de esta regla** (RULE-GATE).
4. **Tope mensual pasivo**: `BARACK_API_PRESUPUESTO_USD` (default 100). Con el mes en rojo la noche no
   arranca (salvo `--sin-tope`). No hay freno por llamada.
5. **Un paso que falla no deja nada a medias ni tumba a los demas**: cada paso con su try/catch, todo se
   escribe a `.tmp` y se renombra, y el envoltorio `_nocturno.ps1` marca ERROR si `node` sale bien pero
   no escribio `.claude/state/nocturno.json` (resultado vacio es error).

## 4. Lo que la maquina NO hace (decisiones del proyecto, al pie de la letra)

- Ningun modelo propone S/O/D, controles, acciones ni texto de reemplazo: **senala**. "La maquina puede
  MATAR un hallazgo, nunca APROBAR un dato" (`coordinador.md`): por eso el segundo paso es un refutador.
- Un AP=H con la accion vacia es estado VALIDO (`amfe.md` §4): lo filtra el codigo aunque el modelo lo
  diga. Un hallazgo sin cita textual no es hallazgo.
- Los mails se **etiquetan** por area, no se filtran (la respuesta de Calidad que espera el seguimiento
  de la reunion de AMFE no se puede tapar).

## 5. La clave

- Vive en `.env.local` como `ANTHROPIC_API_KEY=...` (o en el entorno). **Nunca se imprime, nunca pasa
  por el chat.** La lee `leerClave()` por dentro.
- La pone Fak con `node scripts/_claude.mjs --pegar-clave`: un cuadro de Windows con el texto tapado; la
  escribe PowerShell (copia previa `.env.local.bak-<fecha>.local`, ignorada por git). Claude no edita
  `.env*` (file-guard).
- `node scripts/_claude.mjs --check` dice que falta (clave, acceso, presupuesto, tarea agendada, edad de
  la ultima noche). **La tarea nocturna se agenda recien con la clave** (`--pegar-clave` lo hace solo si
  la API responde; si no, `node scripts/_nocturno.mjs --agendar`).

## 6. Para quien es lo que deja la noche

- `.claude/state/nocturno.json` y `reports/staging/PREAUDITORIA_AMFE_AAAAMMDD.md` son **archivos de
  trabajo para la sesion de la manana, no para Fak**. Cada hallazgo es una candidata: se abre el AMFE en
  Supabase, se verifica la cita contra la fuente, se descarta lo que sea convencion de la casa, y a Fak
  se le lleva solo lo confirmado, en pocas lineas, sin informe.
- El repo es publico: nada con texto de AMFE ni cuerpos de mails va a un archivo versionado.
