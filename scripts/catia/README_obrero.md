# Obrero de CATIA (notebook que trabaja sola)

Pedido de Fak, 23/10/2026 14:25-14:30: «puedo dejar una notebook gamer y vos en paralelo vas resolviendo otras cosas...
me gusta la idea». Una notebook con CATIA V5 corre `obrero.py` sin nadie adelante; la PC principal le deja trabajo en la
nube y lee lo que vuelve.

## Carpetas (todo adentro de `...\viernes-23-plan-sistema\COLA 3D\`)

| Carpeta | Quién escribe | Qué hay |
|---|---|---|
| `asignados\` | SOLO la principal | `<item>-<NOMBRE-PC>.txt`, JSON `{"item", "ejercicio", "instrucciones", "asignado"}` |
| `<NOMBRE-PC>\` | SOLO la notebook | `resultado-<item>.txt`, `<item>\` (STEP, BMP, PNG, `salida.json`), `latido.json`, `obrero.log` |
| `obrero\` | la principal (con `armar_obrero.py`) | este paquete: `obrero.py`, `catia_base.py`, `ejercicios\`, `Arrancar-obrero.cmd`, `LEEME.txt`, `requisitos.txt` |

- `<NOMBRE-PC>` = `socket.gethostname()` en mayúsculas (el que figura en `latido.json` → `hostname`). Puede tener guiones:
  el ítem es lo que queda al sacar el final `-<NOMBRE-PC>.txt`. El ítem solo lleva letras, números, `_`, `.` y `-`.
- El obrero nunca renombra ni borra nada en `asignados\`: un ítem está hecho cuando existe su `resultado-<item>.txt`.
  Para volver a correr un ítem, la principal le asigna un ítem nuevo (otro nombre).
- No toma un asignado modificado hace menos de 90 s (puede estar a medio sincronizar) y reintenta la lectura 3 veces.
  Si el JSON sigue roto, deja `resultado-<item>.txt` con `"estado": "error"` y sigue.
- Si el asignado trae `"hostname"` y no es el de esta PC, no lo toma.

## Ciclo

1. Cada 60 s lista `asignados\`, ordena por nombre y toma el primero pendiente de esta PC (de a uno).
2. RAM libre (psutil si está; si no, `GlobalMemoryStatusEx`): con menos de 3 GB, o si no se pudo medir, espera.
3. Si el ejercicio usa CATIA (`ejercicios\<id>\ejercicio.json` → `usa_catia`, si falta se toma que sí) y hay cualquier
   CATIA abierta (`CNEXT.exe`), no corre: espera a que se cierre. Nunca toca una CATIA que no arrancó la corrida.
4. Corre `python -u -B ejercicios\<id>\catia.py <trabajo>` con `<trabajo>` = `%LOCALAPPDATA%\obrero_catia\trabajo\<item>__<fecha>__<intento>`
   (local, fuera de la nube) y `CATIA_TRABAJO=<trabajo>`; 20 min como mucho (lo corta). Salida y errores a archivos.
5. Después de cada corrida con CATIA: si quedó abierta la de esa corrida (pid + hora de arranque de
   `<trabajo>\mi_catia.json`, y es la única), la cierra; cualquier otra, no.
6. Código 3 (CATIA no arrancó o no conectó): reintenta hasta 3 veces, 30 s entre intentos; después, resultado con error.
   Código 4 (CATIA ajena): queda pendiente. Otro código: resultado con error y las últimas 40 líneas de stderr.
7. Copia a `<NOMBRE-PC>\<item>\` lo que el ejercicio declaró en `salida.json → archivos` (solo de adentro de su carpeta de
   trabajo; .stp .step .stl .bmp .png .jpg .pdf .json .txt .csv; hasta 50 MB) y escribe `resultado-<item>.txt` al final.
8. `latido.json` al arrancar, al empezar y terminar cada ítem y cada 15 min (también durante una corrida y mientras
   espera RAM): hora, ítem en curso, estado, RAM libre, CATIA abierta sí/no, versión del obrero.

Un solo obrero por PC (candado en `%LOCALAPPDATA%\obrero_catia\obrero.lock`). Todo lo que pasa va a `obrero.log`
(en la nube y una copia local). Ninguna falla de la nube lo tumba: reintenta y sigue.

## Contrato de un ejercicio (`ejercicios\<id>\catia.py <trabajo>`)

- Lee `<trabajo>\asignado.json` (el asignado tal cual).
- Escribe `<trabajo>\salida.json`: `{"ok": true|false, "error": "...", "medidas"/"volumen_catia": {...}, "archivos": [rutas relativas a <trabajo>]}`.
- Si usa CATIA: `os.environ["CATIA_TRABAJO"] = <trabajo>` ANTES de `import catia_base`, `catia_base.conectar()`, y
  `catia_base.apagar(c)` en el `finally`. Sale con 0 (terminó), 3 (CATIA no arrancó), 4 (CATIA ajena) u otro (error).
- `ejercicio.json`: `{"usa_catia": true|false, "descripcion": "..."}`.

| Ejercicio | Qué hace | Probado |
|---|---|---|
| `00_prueba_sin_catia` | Cuenta trivial (caja 60×40×20 = 48 000 mm³), PNG de 100×100 sin bibliotecas y diagnóstico: ¿pywin32 importa? ¿la clase COM `CATIA.Application` está registrada? No abre CATIA. | Sí, en seco (23/10) |
| `04_nido_holgura` | Pieza 60×40×20 y nido 100×80×25 con bolsillo 60,4×40,4×15 (0,2 de luz por lado) de `evals/banco3d/ejercicios/04_nido_holgura/_conjunto.py`, en CATIA Part Design (pad desde XY, plano desplazado + vaciado, sentido controlado con el centro de gravedad). Todo 10 mm más arriba que en build123d. Volumen y centro de gravedad de cada uno, STEP y BMP. Esperado por cuenta: pieza 48 000, nido 163 397,6 mm³. | **NO VERIFICADO en CATIA**; sin pywin32 sale con 3 y su salida.json, probado |

`de_build123d.py` (convierte el contorno de una cara de build123d a tramos de croquis) no entra en el paquete: necesita
build123d y la notebook no lo tiene; para rectángulos alcanza `catia_base.poligono`.

## Armar, probar

```
python scripts/catia/armar_obrero.py --destino "<...>\viernes-23-plan-sistema\COLA 3D\obrero"
C:/Dev/BarackMercosul/.venv-cad/Scripts/python.exe -I -m unittest discover -s scripts/catia/tests
python scripts/catia/obrero.py --cola <carpeta temporal> --hostname PRUEBA --una-vuelta --edad-min-seg 0
```

`armar_obrero.py` nunca borra en el destino y no reescribe un archivo que ya está igual (no toca el `.cmd` que corre).
`catia_base.py` es copia de `C:\Dev\_catia_practica\catia_base.py` (base del 19/10) con los cambios anotados arriba de todo.
