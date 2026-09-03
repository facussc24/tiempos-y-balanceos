# PENDIENTE — Mapear los 3D de PRODUCTO (los que manda el cliente)

**Origen:** Fak, 03/09/2026, despues de que Pablo Gamboa encontrara antes que yo el 3D de
una piecita que encastra en el Top Roll de P703: *"osea que la proxima capaz podes buscar
mas rapido o dejarte anotado las rutas de los 3D"*, *"tener mapeados los 3D por ejemplo"*,
*"seria una buena idea supongo"*.

**Estado:** analizado, NO implementado. Fak pidio dejarlo en modo plan para la proxima.

## El hueco exacto

Ya existe un indice y funciona: `.claude/skills/cad-design/scripts/indice_dispositivos.py`
→ `data/INDICE_DISPOSITIVOS.md` (55 dispositivos, 3 raices, generado 02/09). **Pero solo
cataloga lo que Barack FABRICA** — utillajes, calibres, mascaras, dispositivos impresos.

Lo que no cataloga, y es lo que se busco el 03/09: **el 3D de PRODUCTO que entrega el
CLIENTE** (STEP / CATPart / IGS oficiales de SMRC, NOVAX, PWA...), que vive en el arbol del
PPAP:

```
Y:\BARACK\CALIDAD\DOCUMENTACION SGC\PPAP CLIENTES\<CLIENTE>\<FAMILIA>\6-Planos de la pieza\3D\
```

Clientes reales verificados el 03/09 en ese arbol (27 carpetas): `REYDEL-SMRC` (es el de
Ford P703), `NOVAX` (Patagonia VW427), `PWA`, `COZZUOL`, `TOYOTA BOSHOKU`, `MIRGOR`, `SAS`,
`FAURECIA`, `IRAUTO`, `TBA`, `NISSAN-RENAULT`, `PSA`, `PILKINGTON`, `VAER`, `UNE`, `TASA`,
`TESTORI`, `MASTROPOR`, `FAMAR`, `L'EQUIPE MONTEUR`, `PO`, `PLANOS BARACK`, `PROYECTOS`,
`PROYECTOS 2022 - 2023`, `Proyectos Actuales`, `REGISTROS PRODUCCION`, `Varios`.

## Que resolveria (los dos errores reales del 03/09)

1. **Confusion de proyecto.** "Top roll" existe en Patagonia (NOVAX) y en P703 (REYDEL-SMRC).
   Un indice con columna CLIENTE + PROGRAMA hace imposible reportar uno por el otro.
2. **Velocidad.** Tres agentes barriendo el servidor vs. una consulta a un indice ya armado.

## Tres decisiones de diseno que NO se pueden copiar del indice de dispositivos

1. **`OBSOLETO` NO se poda.** El indice actual lo tiene en `ignorar.podar`, y con razon para
   dispositivos. Pero aca el pedido tipico es justo **"la version ANTERIOR"** (fue el pedido
   textual del 03/09). Para productos, `OBSOLETO` / `Anterior` / `0_Obsoletos` se INDEXAN y se
   marcan con un flag `vigente: false`, no se descartan.
2. **La piecita chica no tiene archivo propio.** Confirmado dos veces: el bracket del Top Roll
   Patagonia solo vive embebido en los `.CATPart` del sub-conjunto (memoria
   `top_roll_bracket_es_el_refuerzo`), y lo del 03/09 estaba adentro del 3D del Top Roll.
   **Un indice por nombre de archivo NO la encuentra nunca.** Entonces el indice tiene que
   registrar el CONJUNTO y, donde se sepa, que piezas trae adentro — campo `contiene: []`,
   que nace vacio y lo completa quien abre el archivo (mismo criterio que el campo `resuelve`
   del indice de dispositivos: no se infiere del nombre, eso seria inventar).
3. **Volumen.** El PPAP entero es mucho mas grande que las 3 raices actuales. Acotar a
   `6-Planos de la pieza` y equivalentes por cliente, y medir la primera corrida (el script
   actual ya imprime minutos por raiz — GATE 3.9 del skill `cad-design`).

## Como se implementaria

Extender el script que ya existe, **no crear uno nuevo** (`core-prohibiciones` §6):
agregar las raices de PPAP a `dispositivosRaices.data.json` con un campo `clase`
(`dispositivo` | `producto`) y sacar dos tablas en el MD, o bien un
`indice_3d_producto.py` hermano que comparta el escaneo. Decidir al implementar, mirando
el codigo — no desde aca.

## Hallazgo lateral, anotado y sin tocar

`dispositivosRaices.data.json` dice de la raiz `servidor-utillajes`: *"Solo responde con la
notebook por CABLE"*. **Eso ya no es cierto:** el 03/09 monte `Y:` y `Z:` por WiFi sin
problema (SSID `barack_Sala_reunion_IT`, IP 192.168.1.124, SMB 445 OK). La memoria vigente
`reference_discos_red_y_z_como_montarlos` ya lo dice bien; el comentario del JSON quedo
viejo. Corregirlo cuando se toque el archivo.
