# hojas-de-proceso / reference — §6 — que control frena que cosa y donde vive

Parte del skill `hojas-de-proceso` (se partio el 16/10/2026, tanda 1.5 del plan del sistema, porque el
SKILL.md tenia 779 renglones). Los gates, la lista de §7 y los errores de §7 bis siguen en `SKILL.md`:
esto se lee cuando el trabajo llega a esta parte, no en vez de aquellos.

---

## 6. Enforcement

Los `_gate_*()` y `gate_materiales_del_deck()` que nombra esta tabla viven en
**`scripts/img/generar_hojas_img.py`**: su `hoja()` corre los de cada hoja y `compilar_deck()`
el de materiales. El generador de la prensa embossing importa ese archivo y usa su `hoja()`,
pero no el de materiales; el de P21 arma su propia hoja y corre solo texto para el operario,
fuente por paso, no afirmar de mas y `gate_redaccion`. Un deck armado con otro generador (el de
la HOTMELT, `scripts/hotmelt/hoja_pptx.py`) no pasa por ninguno, y `hoja_proceso_check.py` sobre
el PPTX mira legibilidad, jerarquia, vocabulario y cocina, no la redaccion: en ese caso se corre
`redaccion.py spec <generador.py> HOJAS_X`. Un generador nuevo usa el `hoja()` de la IMG en vez
de copiar los gates.

| Capa | Que | Donde |
|---|---|---|
| **Dura** | `hoja_proceso_check.py` sale con codigo 1 y la hoja no se entrega | `.claude/skills/hojas-de-proceso/scripts/hoja_proceso_check.py` |
| **Dura** | los umbrales viven **solo** en `hojalib.py`: el generador dibuja con los mismos numeros con los que el gate rechaza | `.claude/skills/hojas-de-proceso/scripts/hojalib.py` |
| **Regresion** | cada criterio en ROJO y en VERDE | `.claude/skills/hojas-de-proceso/scripts/hojalib_selftest.py` |
| **Dato** | la metrica de legibilidad viaja dentro del PNG, sobrevive al pptx | `hojalib.guardar_pantalla()` |
| **Dato** | de que video y que segundo salio cada foto, adentro del archivo | `fotodevideo.py leer` (sale 1 si alguna no lo dice) |
| **Dura** | una foto por paso · 2 a 4 pasos · las marcas de la foto = los pasos de la hoja | `_gate_una_foto_por_paso()` del generador |
| **Aviso** | una foto que llena menos del 80 % de su celda | el generador lo imprime al compilar |
| **Dura** | un rotulo con caracteres que la fuente no dibuja | `rotular.sin_glifo()` |
| **Dura** | una marca que cae sobre una zona lisa (al lado del boton, no encima) | `rotular.chequear_marcas()` |
| **Dura** | cocina interna en el texto de la hoja (Nº de video, pendientes, metodo) | `_gate_texto_para_el_operario()` del generador |
| **Medido** | donde esta cada pulsador, en vez de estimarlo | `medir_marca.py` / `--marca "color:verde|..."` |
| **Dura** | un termino que en planta no se dice asi (`seta`, `izaje`, `chumacera`...) | `redaccion.py` + `vocabulario.data.json` |
| **Dura** | un paso que describe la maquina en vez de mandarle algo al operario | `redaccion.gate_redaccion()` |
| **Regresion** | idioma, vocabulario, voz, cocina y TBD, en ROJO y en VERDE | `redaccion_selftest.py` |
| **Dura (deck)** | un material que entra o sale de la operacion y ninguna hoja nombra | `gate_materiales_del_deck()` del generador |
| **Dura** | una NOTA que le cuenta al operario un hueco mio ("no esta documentado", "preguntar antes") | `COCINA` en `_gate_texto_para_el_operario()` |
| **Paquete** | un PDF armado con errores de los de §7 bis (los de otro autor y los de Excel no pasan por ningun generador) | `python scripts/_revisarPaqueteHO.py <pdf>` (lo escribio otra sesion el 07/10/2026; codigos a esa fecha: E1 `PLAN_NO_ESTANDAR`, E2 `LOGO_VIEJO`, E3 `HOJA_CHICA` y `CORTADA`, E4 `SIN_HO` y `SIN_OP`, E5 `PALABRA_PROHIBIDA`, portada `PORTADA`; la lista vigente esta en su encabezado) |
| **Paquete (desde el 16/10)** | el ARMADO contra la ultima hoja aprobada de ese tamaño (E1, `ARMADO_DISTINTO`), el ciclo de control lleno (`CICLO_LLENO`), la pieza rara sin su parentesis (0.8 b bis, `PIEZA_SIN_ACLARAR`), el EPP que no es del sector, el herramental sin marcar, el texto tachado y la cantidad con "×" | `_revisarPaqueteHO.py` (tanda 1.5; la lista vigente, en su encabezado) |
| **A ojo** | restos de Excel y texto cortado que el control no ve (E3), una hoja esqueleto sin la palabra TBD (E5), y que lo que entra sea una HO de este producto | sin gate: lo mira quien arma, y despues un agente independiente sobre el PDF (skill `imprimir`) |

```bash
py -3 .claude/skills/hojas-de-proceso/scripts/hojalib_selftest.py     # tiene que dar "0 fallan"
py -3 .claude/skills/hojas-de-proceso/scripts/redaccion_selftest.py   # tiene que dar "0 fallan"
py -3 .claude/skills/hojas-de-proceso/scripts/fotodevideo.py leer <assets>/*.jpg  # procedencia
py -3 .claude/skills/hojas-de-proceso/scripts/hoja_proceso_check.py "<deck.pptx>" --spec <spec.py>
```

El spec de cada maquina vive en el repo, junto a su generador (`scripts/hotmelt/hojas_spec.py`,
`HOJAS_IMG` en `scripts/img/generar_hojas_img.py`). Lo unico que no entra es la **contraseña del
HMI**: va en `scripts/hotmelt/datos_privados.py` (gitignoreado) y `_gateRepoPublico.mjs` CHECK-3
la busca por contenido.
