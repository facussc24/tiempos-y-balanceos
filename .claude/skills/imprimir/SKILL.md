---
name: imprimir
description: Imprimir un PDF en las impresoras de Barack desde Claude, sin pasar por la cola de Windows — "impresora para ingenieria" (A4, blanco y negro) e "impresora de arriba" (A3 color, la RICOH MP C2004, donde van los FLUJOGRAMAS). Cargarlo cuando piden imprimir algo ("imprimilo", "mandalo a la impresora", "imprimí los flujogramas", "sacalo en A3", "en la de arriba"), al armar un paquete de hojas de proceso para planta (qué entra, qué se revisa antes de imprimir), y para saber si una impresión salió de verdad (contador de hojas).
---

# Imprimir

Dos impresoras, con el nombre que les puso Fak el 07/10/2026 (así figuran también en Windows). Este skill
lo va a usar toda la empresa (Fak, 09:49: *«guardalo en la skill, eso porque después subo esa skill y memorias
a todos en la empresa»*): se escribe para alguien que no conoce el proyecto.

| Nombre | Qué es | Dirección | Para qué |
|---|---|---|---|
| **impresora para ingenieria** | Ricoh SP 3710SF, blanco y negro, A4 | `192.168.1.105` | Todo lo que no es A3: BOMs, hojas de proceso A4, listados |
| **impresora de arriba** | Ricoh MP C2004, color, A4 y A3 | `192.168.1.104` | **Los flujogramas** (A3) y lo que va en A3 o en color |

Hay otra SP 3710SF idéntica en RRHH (`192.168.1.193`): no es la de Ingeniería. La dirección
`192.168.1.70` contesta como "MP C2004" pero es otra entrada de la **misma** impresora de arriba
(07/10/2026: una hoja a cada dirección y salieron las dos arriba).

## Cómo se imprime

```bash
python scripts/_imprimir.py <archivo.pdf>                 # A4 en la impresora para ingenieria
python scripts/_imprimir.py <archivo.pdf> --a3            # A3 color en la impresora de arriba
python scripts/_imprimir.py <archivo.pdf> --paginas 3-5   # solo esas hojas
python scripts/_imprimir.py <archivo.pdf> --a3 --seco     # no manda nada: vista previa de la 1.a hoja
```

Qué hace: Ghostscript (viene con PDFCreator, `C:\Program Files\PDFCreator\Ghostscript\Bin\gswin32c.exe`)
convierte el PDF al lenguaje de la impresora (PCL XL), **ajusta cada hoja al papel y la gira si
hace falta**, y manda los bytes directo a la impresora (puerto 9100). No usa la cola de Windows:
la impresora de arriba está instalada con un driver que traba la cola.

Antes de mandar, el script revisa el PDF y lo dice con renglones `OJO (imprimir)`: firma de IA (eso
sí frena), logo no oficial, frases que delatan y **los TBD que quedaron escritos, con su página**
(`scripts/_lib/tbdImpresion.py`; el TBD del cajetín de una hoja de proceso no cuenta). Los `OJO` no
frenan: se leen, y si un TBD no tenía que salir se corrige antes de imprimir. Para verlos sin
imprimir: `--seco`.

Si el script no está (otra PC), el mismo camino a mano:

```bash
gswin32c.exe -q -dBATCH -dNOPAUSE -dSAFER -sDEVICE=pxlcolor -sPAPERSIZE=a3 -dFIXEDMEDIA -dPDFFitPage -r300 -sOutputFile=trabajo.pxl archivo.pdf
# y mandar trabajo.pxl a 192.168.1.104 puerto 9100 (en Python: socket.create_connection((ip, 9100)).sendall(datos))
```

Para la A4 en blanco y negro: `-sDEVICE=pxlmono -sPAPERSIZE=a4 -r600` y la dirección `192.168.1.105`.

## Antes de imprimir

- **Se imprime la última versión emitida**, no un borrador: el documento sale del servidor
  (`Y:`) o del lugar donde está emitido, nunca de una copia de trabajo, salvo que la persona diga
  que es esa.
- Muchas hojas (más de 20) o A3 en color: decir cuántas hojas van a salir antes de mandarlas.
- Un flujograma va en UNA hoja A3 con letra de **8 pt o más** (Fak, 07/10/2026, pidió que se lean
  impresos): la salida de la propuesta B (`tools/flowchart/propuestas/B_final/`) mide 8,2 a 10,7 pt.
  El render de siempre (`_flujograma.mjs`, PNG a 150 DPI) escalado a A3 deja la letra en unos 4 pt:
  ese no se imprime. Skill `flujogramas` §5 bis.

## Después de imprimir: se mira el contador

Que el trabajo salga de la PC no dice que la impresora lo imprimió. El script lee el **contador de
hojas** de la impresora antes y después (por la red, SNMP) y dice cuántas salieron. El contador
tarda unos segundos en moverse. Si no se puede leer, se pide mirar la bandeja.

```bash
python scripts/_impresoraEstado.py 192.168.1.104     # contador, texto del panel, errores
```

## Qué entra al paquete de hojas de proceso para planta (Fak, 07/10/2026)

Fak, 08:50: la tarea es *«colocar las hojas de proceso, deberían estar todas»*, cada cosa en *«la última
versión»*, más las BOMs y los flujogramas. Cada regla de abajo sale de una frase de Fak (horas de Buenos
Aires, tipeo corregido). Reemplaza la sección anterior, escrita ese mismo día antes de que Fak revisara el
paquete: lo que Fak corrigió quedó en esta tabla. El detalle de cada error dentro de una hoja, con su cita, está en el skill
`hojas-de-proceso` §7 bis (E1 a E6).

| Qué | Fak (hora) | Cómo queda |
|---|---|---|
| **Sin portada ni índice** | 12:43: *«esa imagen que te pasé no debe estar… esas imágenes así no deben estar, no hacen falta»* (era la portada de la prensa de embossing) | Un PDF por pieza, ordenado por operación, sin portada (`hojas-de-proceso` §3 bis, 02/10) |
| **Lo que no es una HO no entra**: el esquema de palletizado | 14:37: *«"ESQUEMA DE PALLETIZADO" metelo en el formato nuestro, no es una HO… dejémoslo en el server… ese, mandalo a obsoleto»* | Fuera del paquete de hojas. Se pasó al formato de las fichas de embalaje como **GE-283 INSERT PALLET** (ficha nueva, no revisión B de la GE-282), en `Y:\Ingenieria\Documentacion Gestion Ingenieria\17. Fichas de embalaje\2- CLIENTES\NOVAX\INSERT\CAJA CARTÓN\`. Fak, 16:11: *«anotalo en el listado y [ponelo] en el APQP, sí sí, eso sí, hacelo, no pasa nada»*: fila 46 del listado de fichas y casillero 19 del legajo. Qué pasó con la versión vieja del esquema: no verificado |
| **Un embalaje intermedio (WIP) no es la hoja de embalaje**: la OP 70 del inserto (HO-990, de Carlos Baptista) no va | 15:34: *«no es la hoja de embalaje, es un embalaje intermedio, un WIP… pensalo aparte, porque esa hoja no la quiero»*. La captura de WhatsApp que adjuntó dice: *«el material iba de conversión de cintas a adhesivado antes… ahora va de inyección plástica donde ponen la espuma a adhesivado… luego a troquelado. Lo de etiqueta de producto terminado no va»* | La hoja sale del paquete. Si hace falta una hoja para ese paso, es otra y aparte: en el flujograma 154 es la OP 92, *ALMACENAMIENTO EN MEDIOS WIP*. No existe hoy. En el inserto siguen las de Pablo Gamboa |
| **Una hoja que es la misma para todos los productos se imprime UNA vez** | 14:37: *«las hojas de recepción de materia prima debemos corregirlas, cambiarles el formato un poco, hacerlas más específicas, o bueno, si continuamos con estas genéricas, con imprimir una sola ya es suficiente, porque son todas las mismas, al pedo… lo mismo con el control de Mylar»* | Una sola copia en todo el paquete: **recepción de materia prima** y **control con plantilla Mylar** (la versión anterior de esta sección dejaba el Mylar en cada producto). Fak dijo que hay que corregirles el formato y hacerlas más específicas; mientras sean genéricas alcanza una |
| **Termoformado (582D) y planas (581D) no se tocan** | 10:11: *«termoformado y planas no toques, porque eso lo está siguiendo Pablo Gamboa; le armamos un mail después con lo que encontramos»*. Después, 14:47, sobre una de planas (la 173 era la HO-983 OP 40, costura): *«veo cortada la parte de abajo de la hoja… hay que corregir eso también»* | Van como están en el servidor y lo que se encuentre va a un mail a Pablo, corto y con una sola pregunta (LECCIONES 07/10). Lo más nuevo (14:47) pide corregir la hoja cortada; Fak no dijo cómo se concilia con *«no toques»* (sin decidir, abajo) |
| **Sin TBD, PENDIENTE ni PRELIMINAR; sin hojas sin número** | 10:39, 13:24, 14:46 | `hojas-de-proceso` §7 bis, E4 y E5. Los ejemplos de la versión anterior (HO-994 y los números 60.1 a 60.6 del Upper Trim) **no son decisión de Fak**: el 994 es solo el próximo libre de `_hoNumeros.py`, sin fila en el listado, y los decimales los cuestionó (abajo) |
| **Una hoja de otro autor se revisa como las propias** | 14:39 | `hojas-de-proceso` §7 bis, E6 |

**Sin decidir todavía** (07/10/2026: Fak no contestó; si ya se resolvió, sacar el renglón):
- **Hojas de la prensa de embossing (60.1 a 60.6):** cinco son de la máquina, no de la pieza. Se le preguntó si llevan una HO de máquina propia (numerada 10, 20, 30, como la 993 del hot melt) y la HO del Upper Trim queda solo con la OP 60. Fak: *«¿por qué están en 60.1?… no me lo explicaste»* (14:37).
- **Hojas de planas cortadas abajo:** *«no toques»* (10:11) contra *«hay que corregir eso también»* (14:47). Se ve en el PDF (la HO-983 sale sin el final del plan de reacción y del ciclo de control); cómo se arregla sin cambiar lo que dice la hoja de Pablo, no está dicho.
- **Mesa de corte e inyección** (hojas de la máquina, iguales para todos los productos): la versión anterior las dejó una sola vez; Fak no las nombró (sí nombró recepción y Mylar), y su cajetín dice HO-971 o HO-985, la del producto. Si se dejan una vez, el número de sector sigue sin definir.

## Antes de mandar a imprimir hojas de proceso

Fak, 15:58, con el paquete a medio revisar: *«así las próximas ya los conocés y me decís: ojo, acá hay aún un
error»*. En orden:

1. **Armar** con la última versión de cada hoja y dejar el PDF del paquete. A4 en la impresora para
   ingeniería; flujogramas y lo que sea A3, en la de arriba (tabla del principio; Fak, 08:50: *«ojo que los
   flujogramas se imprimen en la C2004, o sea arriba, en A3, pero lo demás podemos usar la [otra impresora]»*).
2. **Correr el script** sobre el PDF: `python scripts/_revisarPaqueteHO.py <pdf>` (solo lee; sale 1 si hay un
   defecto ROJO). Lo escribió otra sesión el 07/10/2026 y mira portada, N° de HO y de operación, palabras
   prohibidas (TBD, PENDIENTE, PRELIMINAR), logo, hoja chica, hoja cortada, plan de reacción (texto y columna
   de acciones al costado), hojas de otro tamaño y recuadro de seguridad vacío; la lista vigente está en su
   encabezado. Cada ROJO se corrige; cada AVISO se mira.
3. **Mirar a ojo lo que el script no ve**, en el PDF y con una HO de Excel del servidor al lado para comparar:
   - **El armado del plan de reacción** (E1): el plan debajo de las fotos y el ciclo de control a su derecha,
     sin media hoja en blanco. El script revisa el texto y la columna de acciones, no el armado.
   - **El logo** (E2): el script lo compara por imagen; igual se mira la esquina de la primera hoja de cada autor.
   - **Restos de Excel y texto cortado en medio de la hoja** (E3): la marca «Página 1», una frase que termina a
     la mitad. El script mide hoja chica y borde cortado, no esto.
   - **Una hoja esqueleto** (sin fotos ni pasos) que no dice TBD ni PENDIENTE (E5): el script lee palabras.
   - **Lo que entra es una HO, y es de este producto**: no un esquema, no un WIP con etiqueta de pieza
     terminada, no la misma hoja genérica por segunda vez (tabla de arriba).
   - **La hoja describe lo que se hace HOY**: la HO-70 del inserto estaba hecha con el recorrido viejo
     (conversión de cintas, etiqueta de pieza terminada) y Fak la sacó.
   - **La foto muestra lo que el paso nombra** y la nota es para el operario: `hojas-de-proceso` §1 bis y §2 quinquies.
4. **Si aparece algo de la tabla, avisarle a Fak en una línea** («ojo, la hoja X tiene tal error») y corregirlo.
5. **Auditoría independiente después de corregir**: agentes específicos, cada uno con SOLO el PDF y UN tema
   (logo, plan de reacción, numeración, hojas repetidas…), en Sonnet y sin pasarles mis supuestos
   (`techo-agentes.md`). Fak, 15:58: *«agentes específicos, independientes, Sonnets… así ya le pasás una
   auditoría luego de hacer esos…»*.
6. **Abrirle el PDF a Fak y esperar a que lo mire.** No se imprime ni se sube al servidor sin que lo haya
   visto: 10:35 *«antes de imprimir quiero ver todo… abrime las hojas de operaciones que vamos a imprimir»*;
   15:58 *«las hojas A3 no las revisé, así que esas no las subas todavía; dejame echarles un vistazo,
   abrilas»*. Cada versión corregida se le vuelve a abrir: lo pidió así (15:20 *«¿terminaste con las hojas de
   proceso para que las vea?»*; 15:51 *«¿querés abrirlas de nuevo así las miro?»*). El juego A3 se mira aparte
   del A4.
7. **BOMs:** salen del arb (13:27: *«las BOMs ya las podemos imprimir desde arb»*) y antes de mandarlas se
   mira cómo van a salir y se cuentan las hojas (13:29: *«asegurate de que vayan a salir bien, antes de
   mandarlas a imprimir»*).
8. **Imprimir** con `scripts/_imprimir.py` y mirar el contador (sección de arriba).

## Lo que no se hace

- No se cambia la impresora predeterminada ni los drivers de Windows. Renombrar o crear un puerto
  pide permiso de administrador: lo aprueba la persona en el cartel de Windows.
- No se imprime en la de RRHH.

