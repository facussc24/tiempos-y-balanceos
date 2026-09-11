# Caracteristicas especiales — criterio, siglas y fuentes (always-on)

Pedido de Fak, 11/09/2026: *"no quiero que nunca mas lo olvides... siempre que te preguntes,
recuerdes todo esto"*. Esta regla no lleva `paths:` a proposito: entra en TODAS las sesiones.

## El criterio (I-AC-005 rev.B, tabla del punto 5 · manual AIAG-VDA SETEC pag. 129)

| Nivel | Criterio | Interna Barack | Documento para VW | Manual |
|---|---|---|---|---|
| Critica | **S = 9 o 10**, O indistinto | `CC` | `D/TLD` | `▽` |
| Significativa | **S = 5 a 8 y O >= 4** | `SC` (el instructivo escribe `CS`) | `SC` | `SC` |
| Ninguna | todo lo demas | vacio | vacio | vacio |

## Lo que dicen los documentos (abiertos el 11/09/2026, con la pagina)

- **D y TLD son UNA sola marca**, nombre viejo y nombre nuevo, mismo rango; VW la escribe
  "D/TLD". Formel Q Capacidad de Calidad 8a ed., pag. 28 §7.5 y pag. 35 (abreviaturas:
  *Dokumentationspflichtig / Technische Leitlinie Dokumentation*); CSR VW IATF 2018 §8.3.3.3.
- **D/TLD = documentacion obligatoria**: exigencia LEGAL sobre el vehiculo (inflamabilidad,
  emisiones, sustancias prohibidas, homologacion). Registros 15 anos, auto-auditoria anual.
  **La designa el cliente en el plano** (VW 01058 §5.1.4 pag. 31: cajetin «Doc. de seguridad»
  = TLD + hoja TLD; ejemplo real `TLD_812_046_V1_241129.pdf`). Una costura rota NO es D/TLD.
- **VW no tiene sigla de "significativa"**: pide que el proveedor nombre las suyas por funcion
  o seguridad (Formel Q pag. 26 §7.2 y pag. 37; IATF 16949 §8.3.3.3). La significativa es
  criterio de Barack, y para VW se escribe `SC` (Fak 09/09/2026: *"la W no existe"*).
- **Legal es S = 9** por la tabla P1 del AIAG-VDA (*"noncompliance with regulations"*): la CC
  sale de la S, no es "independiente de S/O".
- Planos SAIC de Novax (C00739615/619/621, hoja 4): ◇ clave, simbolo reglamentaria, tabla
  KCDS **vacia en los tres**; nota 10 = inflamabilidad CVTC 52034.
- La matriz de correlacion que el Formel Q §7.5 exige como documento controlado era la hoja
  "Tipos de caracteristicas" del I-PY-001.7: en `OBSOLETOS\` desde el 09/09/2026. Pendiente
  de Calidad; no se toca desde aca.

## La regla operativa (y el error que la origino)

1. **La sigla de una causa se justifica SOLO con su S y su O contra la tabla**, mas lo que el
   cliente designo en el plano. **Nunca porque otro documento la tenia** (backup, Rev.A de un
   flujograma, plan de control viejo, otro AMFE). El 11/09/2026 llame "error" a que dos causas
   S7 O3 perdieran su D/TLD comparando contra el backup: *"estas tirando como al azar... sin
   entender como funciona un AMFE... es un error gravisimo que debemos corregir para siempre"*.
2. Antes de proponer poner, sacar o restaurar una sigla: **escribir S, O y la regla**. Si el
   efecto dice "riesgo de seguridad" y la S es 7, lo incoherente es el par texto/S, no la
   falta de sigla.
3. La marca de una operacion en el flujograma = union de las siglas de sus causas en el AMFE.
   Una `▽` heredada sin causa S >= 9 detras no se copia: se informa como diferencia.
4. Asignar o cambiar CC/SC sigue siendo de Fak o del cliente (`core-prohibiciones.md` §2):
   yo calculo la lista por criterio, la muestro con S y O, y el OK de Fak la asigna. Lo que un
   documento contesta no se le pregunta.
5. Una sigla que ninguna fuente reconoce (`W`, `Wichtig`, `Clave`, `PV2005`, `YC`/`YS` de
   diseno) no se adivina: se reporta.

## Enforcement — fuente unica `core/amfe/caracteristicasEspeciales.data.json`

- `scripts/_lib/amfeValidator.mjs` (y su espejo `modules/amfe/amfeValidation.ts`):
  `CAUSE_CC_LOW_SEVERITY` (CRITICAL, **sin exencion por palabras**), `CAUSE_SC_FUERA_DE_REGLA`
  (CRITICAL: S fuera de 5-8 u O < 4), `SIGLA_DESCONOCIDA` (CRITICAL), `CAUSE_S9_SIN_CC`
  (WARNING: candidata, la asigna Fak). Frenan `--apply` (`runWithValidation`) y el export oficial.
- Hooks: `caracteristicas-especiales-guard` (PreToolUse, recordatorio 1x/h al tocar siglas o
  flujogramas) y `caracteristicas-especiales-prompt.sh` (UserPromptSubmit: cada vez que Fak
  nombra el tema, sin cooldown); linea 7 del nucleo post-compact.
- Memorias: `feedback_sigla_se_justifica_por_s_y_o`, `caracteristicas_especiales_notacion_barack`.
