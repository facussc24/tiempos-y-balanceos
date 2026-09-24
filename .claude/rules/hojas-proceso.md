---
paths:
  - ".claude/skills/hojas-de-proceso/**"
  - "**/hoja*proceso*"
  - "**/hoja*operaciones*"
  - "**/*.pptx"
---

# Una hoja de proceso se juzga IMPRESA, no en el monitor

Regla corta. El detalle, los umbrales y los errores caros: skill `hojas-de-proceso`.

1. **Cada hoja declara su imagen PRINCIPAL** — la que el paso manda mirar o leer — antes de
   acomodar nada. Sin declararla, el reparto optimiza superficie total y puede dejar la tabla
   de parametros mas chica que una mano con un celular (paso el 03/09/2026, lo vio Fak).
2. **Lo que hay que leer se lee a 7 pt impresos como minimo.** Lo decide el cuerpo en
   centimetros sobre el papel, nunca la imagen ampliada en pantalla.
3. **Una pantalla de HMI es la FOTO REAL enderezada, con el rotulo en castellano encima**
   (Fak, 08/09/2026: *"poner la foto de la pantalla real y metele un edit y ponele encima el
   dato que vos queres"*). No se redibuja —el operario tiene adelante la pantalla en chino—,
   no se deja de costado —se rectifica la perspectiva—, **ningun valor se tapa ni se
   retoca**, el texto va al costado del LCD, y **no se pasa por un generador de imagenes**:
   reinventa digitos, y una marca de procedencia no se saca.
4. **Un umbral se prueba contra el conjunto entero antes de declararlo.** El primero que
   escribi ("45 % del bloque") reprobaba 13 de 17 hojas sanas: era imposible de cumplir para
   una foto vertical.
5. **El aire y los margenes son parte del formato que se calca — y no se ven en el HTML.** Un
   screenshot del navegador ignora `@page margin`, asi que la hoja se juzga RASTERIZADA (PDF) y
   al zoom en que se va a usar; yo di una por buena mirando el screenshot y Fak contesto *"no
   tiene bordes blancos a los alrededores y los mismos espaciados"*. El mismo error en Excel se
   ve al reves: un texto recortado que la celda no muestra. Vale igual para `_xlsxAPdf.py`.

6. **Una foto por paso, de 2 a 4 pasos por hoja, y la operacion que no entra se PARTE**
   (`SET UP INICIAL (HOJA 1 DE 2)`) sin cambiar el N° de operacion. Un paso es una accion
   que se ve en una foto; lo que no se puede fotografiar es una nota o un parametro, no un
   paso. Criterio afinado con Fak el 21/09/2026, despues de hojas de 2 pasos y hojas de 12.
7. **La foto de la hoja sale del VIDEO a resolucion completa, recortada, y dice adentro del
   archivo de donde salio** (`fotodevideo.py`). El fotograma de la biblioteca sirve para
   encontrar el momento, no para ilustrar. Sin procedencia es un huerfano: en el set
   anterior 7 de 36 fotos eran el mismo archivo con otro nombre.

8. **La NOTA y los pasos son para el OPERARIO.** Nada de numero de video, pendientes con
   el proveedor, "filmado el", "lectura del" ni como se hizo la hoja: eso va a la bitacora
   (Fak, 21/09/2026: *"esas notas no le aportan nada util al operario"*). Lo frena
   `_gate_texto_para_el_operario()`.
9. **La posicion de una marca se MIDE, no se estima** — y se vuelve a mirar despues de
   cualquier cambio de recorte. `medir_marca.py` la ubica, `--marca "color:verde|..."` la
   coloca sola, y `rotular.chequear_marcas()` rechaza la que cae sobre chapa lisa.

10. **La transcripcion del video se lee ENTERA antes de escribir un paso** (Fak,
    21/09/2026: *"siempre leer las transcripciones si o si"*). Los fotogramas dicen QUE HAY;
    la transcripcion dice QUE PASA. Escribi "prender los servicios" mirando cuadros del
    IMG_0596 y el audio de ese mismo video decia *"todo eso se maneja de alla, de la
    pantalla"*.
11. **Cada paso declara su fuente** — video con minuto, documento, o quien lo dijo y cuando.
    Sin fuente el paso no va. En la misma hoja escribi "mirar la presion de aire antes de
    pedir cualquier movimiento": eso no lo dijo nadie, vi un manometro en una foto.
    Lo frenan `_gate_cada_paso_con_fuente()` y `_gate_transcripcion_leida()`.
12. **El sector de esta maquina es `IMG`**, no "MOLDEO IMG": ese sector no existe.

13. **El canon de estas hojas es `docs/CRITERIOS_HOJAS_DE_PROCESO.md`** y se abre ANTES de
    escribir el primer paso. Existe desde el 08/09/2026 y el skill no lo nombraba: por eso
    el 21/09 entregue 26 de 27 pasos escritos como narracion y una hoja que decia "SETA",
    las dos cosas que el canon ya prohibia (3.2 y 4.4). Un canon huerfano no gobierna nada.
14. **Un paso arranca con el verbo de lo que hace EL OPERARIO.** Poner, Verificar, Apretar,
    Esperar. No con articulo ni narrando a la maquina (Fak, 21/09/2026: *"no me explicas
    que debo hacer yo... entendes la diferencia?"*). Un rotulo no es un paso: el nombre del
    comando va en la FOTO, y en la descripcion va que hacer con el. La prueba: si el que
    lee hace exactamente lo que dice cada renglon, el trabajo queda hecho.
15. **El castellano es el de planta, y esta en `vocabulario.data.json` con su fuente.**
    `seta` -> boton de parada de emergencia. Termino nuevo se agrega mirando un documento
    real, nunca de memoria. Lo frena `redaccion.py`.
16. **Lo que el operario no toca, no lleva hoja** (Fak sobre los manometros: *"¿para que
    hace falta eso? al pedo esta"*), y conocer una pantalla no es un paso: la pantalla
    entra cuando un paso manda mirarla o tocarla. El **EPP sale del riesgo real del
    puesto**, no de un set generico (*"¿para que necesito gafas? nadie usa gafas en esta
    maquina"*).

17. **La lista de hojas se deriva de la JORNADA del operario, no del material filmado.**
    Se escribe primero que hace de punta a punta y despues se busca con que fotos contarlo.
    Al reves, lo que no esta filmado deja de existir: el 21/09 entregue seis hojas con los
    seis gates en verde y **faltaba el vinilo entero** (colocar el rollo, pasar el material,
    sacar el recorte). Chequeo de deck: **todo lo que entra y sale de la operacion —del
    flujograma y del AMFE, no de los videos— tiene que estar nombrado en alguna hoja**
    (`gate_materiales_del_deck()`).
18. **Una NOTA no le cuenta al operario lo que yo no averigue.** *"No esta documentado...
    preguntar antes de usarlo"* le pasa mi problema a el (Fak: *"esta nota esta al pedo,
    eliminala"*). El hueco va a la lista de lo que falta preguntar, no a la hoja.
    **Y desde el 24/09/2026 tampoco va `TBD` en la descripcion**: Fak, *"no puede haber ni 1
    TBD... que sea una hoja de proceso sin TBD en las descripciones"*. Lo que no se sabe se
    escribe generico con la informacion disponible, sin inventar valores; el TBD queda solo
    en el cajetin (N° de operacion, HO, sector). Lo frena `redaccion.revisar_tbd()`.
19. **Si una frase hay que explicarla, esta mal escrita.** *"Mirar el canto envuelto"* —Fak:
    *"¿que carajo significa eso? no se entiende"*. La prueba es leerla en voz alta como si
    la leyera alguien que recien entra.



20. **La operacion se llama `SUSTANTIVO DE ACCION + DE/EN/CON + objeto`**, mayusculas,
    tope 64 caracteres: asi son las 113 denominaciones reales de Barack, y **ninguna**
    arranca con articulo ni lleva dos puntos. El objeto de la pieza va en COD. DE PIEZA, no
    en el titulo. **Antes de inventar una forma se abre la maquina hermana**: el deck de la
    HOTMELT ya tenia sus 17 sub-operaciones bien nombradas y no lo mire (Fak: *"eso es
    cualquier cosa"*). Lo frena `redaccion.revisar_denominacion()`.

## Enforcement

- **Duro:** `py -3 .claude/skills/hojas-de-proceso/scripts/hoja_proceso_check.py "<deck.pptx>"`
  sale con codigo 1 y la hoja no se entrega.
- **Una sola fuente:** los umbrales viven solo en `.claude/skills/hojas-de-proceso/scripts/hojalib.py`; el generador dibuja
  con los mismos numeros con los que el gate rechaza.
- **Regresion:** `py -3 .claude/skills/hojas-de-proceso/scripts/hojalib_selftest.py` — 25
  casos, cada criterio en ROJO y en VERDE.
- **Regresion:** `py -3 .claude/skills/hojas-de-proceso/scripts/redaccion_selftest.py` — 71
  casos de idioma, vocabulario, voz, cocina y TBD, en ROJO y en VERDE.

**Las contraseñas de HMI no van al repo** (`_gateRepoPublico.mjs` CHECK-3 las busca por contenido).
El resto del spec de la maquina vive donde se lo busca —la carpeta de la maquina—, no en el repo.
