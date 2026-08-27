# QR de verificacion en los documentos que emite Barack

Los laboratorios que nos mandan reportes de ensayo ponen un QR en la portada y una
declaracion que dice, en criollo: *un ejemplar de este reporte sin el QR de seguridad en la
portada es un reporte falsificado o alterado*. Eso resuelve un problema real que nosotros
tambien tenemos: cuando mandamos un informe a un cliente, el que lo recibe no tiene forma de
saber si el papel salio de nuestra Ingenieria o si alguien le cambio un numero por el camino.

Este documento tiene dos partes: **como esta hecho el de ellos** (medido, no supuesto) y
**como quedo el nuestro**.

---

## 1. El sistema del laboratorio, medido

Sobre seis reportes reales de un laboratorio externo, con
`python scripts/_qrVerificacion.py analizar "<archivo>"`:

| Que | Cuanto |
|---|---|
| Simbolo | QR **version 8** — 49 x 49 modulos |
| Correccion de error | **Q** (recupera hasta el 25 % del simbolo dañado) |
| Imagen embebida | PNG 208 x 208 px = **200 dpi** efectivos |
| Tamaño impreso | **26,46 x 26,46 mm**; cada modulo mide 0,54 mm |
| Quiet zone | 4,1 modulos (ISO/IEC 18004 exige 4 como minimo) |
| Posicion | portada, **25,83 mm** del borde derecho; entre 24 y 31 mm del pie |
| Contenido | `http://<lims-del-laboratorio>/#/ReportQRQuery/<48 caracteres hex>` = 90 bytes |
| El token | 24 bytes / 192 bits, **distinto en cada reporte**, sin ningun dato adentro |
| Como se produce | el PDF sale del LIMS con el QR ya incrustado, uno por reporte |
| Declaracion | item 7 de la pagina de declaraciones: sin QR en la portada, el ejemplar es falso |

Dos cosas que no son casualidad y que conviene copiar:

- **La version 8 con nivel Q es la minima que aguanta esos 90 bytes.** No agarraron un default:
  eligieron el nivel de correccion alto primero — el papel se fotocopia, se escanea torcido, se
  le pone un sello encima — y despues la version mas chica que entrara. Se cruza con dos
  mediciones independientes: la geometria del simbolo y la capacidad que pide el payload.
- **El QR no contiene los datos del reporte: contiene un puntero opaco.** No se puede leer nada
  del token, ni adivinar el siguiente, ni fabricar uno. La verificacion la hace el servidor del
  emisor, y por eso reapuntar ese QR a una copia propia no "corrige" nada: falsifica el
  certificado. Ver `.claude/rules/documentos-de-terceros.md`.

---

## 2. El nuestro

Mismo mecanismo, mismas medidas, **con un agregado**: ademas del puntero al registro, guardamos
la huella digital (SHA-256) del archivo tal como se emitio. El de ellos responde *"existe este
documento?"*. El nuestro responde tambien *"es este archivo, sin tocar?"*.

| Que | Cuanto |
|---|---|
| Simbolo | QR **version 7** — 45 x 45 modulos (nuestra URL es mas corta) |
| Correccion de error | **Q**, igual que ellos |
| Tamaño y posicion | **26,46 mm**, 25,83 mm del borde derecho, 30,91 mm del pie — identico |
| Contenido | `https://facussc24.github.io/tiempos-y-balanceos/v.html#<24 hex>` = 78 bytes |
| El token | 12 bytes / 96 bits: `HMAC-SHA256(clave, doc_id + hash del PDF)`, truncado |
| Registro | `public/verificacion/registro.json` — uno solo, y es el que sirve la web |
| Pagina de verificacion | `public/v.html` — publica, sin login, sin backend |

### El token

`HMAC-SHA256(clave_secreta, "<tipo>-<numero>-REV<rev>" + "|" + <sha256 del PDF sin sellar>)`,
truncado a 12 bytes y en hexadecimal mayuscula.

- **Opaco**: no dice nada del documento.
- **No fabricable**: sin la clave no se puede generar uno valido, y con 96 bits no se prueban
  todos.
- **Determinista**: el mismo documento da siempre el mismo token, asi que re-sellar no crea un
  codigo nuevo por accidente.

La clave vive en `.qr-secret` (gitignoreado) o en la variable `BARACK_QR_SECRET`. **Si se pierde
no se recuperan los tokens ya emitidos** — el registro los conserva, pero no se pueden volver a
derivar. Va al backup.

### Que ve el que escanea

Abre `v.html`, que lee el registro publicado y muestra en una pantalla:

- **Documento emitido por Barack Mercosul S.R.L.** (verde) — con numero, revision, titulo,
  producto, quien lo emitio, cuando, y el estado (vigente / anulado / reemplazado).
- **Documento no registrado** (rojo) — el codigo no figura. No lo uses.
- Y abajo, **la comprobacion de integridad**: solta el PDF que tenes en la mano y la pagina
  calcula su SHA-256 *en tu propio navegador* (`crypto.subtle`, el archivo no se sube a ningun
  lado) y lo compara con el que quedo registrado al emitir. Si alguien cambio un numero, no
  coincide — aunque el QR sea el original y el documento se vea igual.

La fecha se muestra tal como se emitio, hora de Buenos Aires: un documento emitido el 27/08 dice
27/08 lo abra quien lo abra.

---

## 3. Como se usa

```bash
# medir el QR de cualquier PDF, propio o ajeno (solo lectura)
python scripts/_qrVerificacion.py analizar "<archivo>"

# sellar un documento NUESTRO
python scripts/_qrVerificacion.py sellar "<archivo>" \
       --tipo IT --numero 2026-007 --rev 0 \
       --titulo "Verificacion de espesor" --producto "Insert VW427" --emisor "Ingenieria"

# comprobarlo contra el registro
python scripts/_qrVerificacion.py verificar "<archivo>"

# dar de baja un documento superado (la copia vieja deja de dar verde)
python scripts/_qrVerificacion.py anular <token> --estado anulado

# ver el registro
python scripts/_qrVerificacion.py registro --listar
python scripts/_qrVerificacion.py registro --sql     # tabla, si algun dia va a Supabase

# probar el ciclo entero sin tocar nada real (21 casos)
python scripts/_qrVerificacion.py selftest
```

Despues de sellar o anular hay que **pushear**: la pagina lee el registro de GitHub Pages,
asi que un documento sellado y no pusheado da "no registrado".

### Cuando sale una revision nueva

Sellar la revision nueva **con `--forzar` sobre el documento sellado anterior** marca sola la
version vieja como `reemplazado` y le anota cual la reemplaza: la copia que siga circulando
deja de verificar "vigente" y la pagina avisa que hay una revision posterior. Si un documento
se da de baja sin reemplazo, `anular <token>`.

**Esto importa mas de lo que parece:** sin eso, un PDF superado que ande dando vueltas se
sigue verificando como bueno para siempre — el QR es el mismo y el archivo no cambio.

### La leyenda del documento

Para que el QR sirva, el documento tiene que decir que sin el QR no vale — igual que el item 7
del laboratorio. En la pagina de declaraciones:

> Este documento no es valido sin el codigo QR de verificacion de su portada. Un ejemplar sin
> QR, o cuyo QR no resuelva contra el registro de Barack Mercosul S.R.L., es una copia alterada.

---

## 4. Lo que este sistema no hace

- **No es una firma digital con validez legal.** Prueba que el documento salio de nuestro
  registro y que el archivo no cambio; no reemplaza una firma electronica certificada.
- **No sella papeles ajenos, y eso es a proposito.** `sellar` aborta si el PDF ya trae el QR de
  otro emisor. La verificacion de un certificado la hace quien lo emitio; si un campo esta mal,
  se pide la reemision.
- **No vale sin el push.** Sellar escribe el registro local; hasta que no se publica, la pagina
  no lo encuentra.
- **El registro es publico y por eso solo lleva lo que puede ver un tercero**: identificacion
  del documento, emisor, fecha, estado y hash. Nada mas — `guardar_registro()` aborta si
  aparece un campo fuera de esa lista. Al principio habia dos archivos, uno "interno" con el
  hash previo al sello y otro publicado sin el; los dos vivian en el mismo repo publico, asi
  que el filtro no filtraba nada. **Se saco el campo en vez de esconderlo.**
