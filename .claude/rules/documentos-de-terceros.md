---
paths:
  - "**/*.pdf"
  - "**/*.PDF"
---

# Un documento emitido por un TERCERO no se edita: se pide la reemision

Aplica a todo papel cuyo EMISOR no es Barack: reportes de laboratorio, certificados de
material, PPAP y declaraciones de proveedor (ELV, IMDS, RoHS), planos y normas de cliente,
certificados de calibracion, remitos y facturas.

1. **No se edita el contenido.** Ni el cliente, ni la fecha, ni el numero de reporte, ni el
   logo, ni el resultado. **Aunque el ensayo sea el mismo y el resultado valga**: el papel
   dice quien lo encargo, y eso no es un detalle de formato.
2. **No se toca el mecanismo de verificacion.** QR, link al LIMS del laboratorio, hash,
   codigo de barras, firma digital, sello. **Reapuntar un QR a una copia nuestra es
   falsificar el certificado** — la verificacion la hace el emisor, no el PDF.
3. **Lo que se hace es pedir la REEMISION** al proveedor o al emisor, diciendo que campo
   esta mal y cual es el correcto. Es un mail de cinco lineas y un tramite normal.
4. **Un rectangulo blanco encima no borra nada.** El texto original queda en la capa de
   texto del PDF y sale con Ctrl+F o con cualquier extractor. Lo tapado no esta sacado.
5. **Permitido:** leerlo, extraerle datos, traducirlo APARTE, hacer OCR, y citarlo desde un
   documento PROPIO. Lo prohibido es devolverlo como si el tercero hubiera escrito otra cosa.
6. Si Fak pide igual la edicion: se le dice que no y se le deja listo el mail de reemision.
   No es una decision de costo/beneficio ni la levanta una reiteracion del pedido.

## Lo que SI se hace, y no hay que pedir permiso (27/08/2026)

La regla protege el papel del otro, **no prohibe aprender de el**. Sin freno:

- **Medirle el QR y desarmar como esta hecho**: version, nivel de correccion, tamaño,
  posicion, que codifica. `python scripts/_qrVerificacion.py analizar "<archivo>"`, que es
  solo lectura y no abre el archivo para escribir.
- **Copiar el mecanismo en documentos NUESTROS.** Es el camino correcto, no un atajo: la
  respuesta a "el reporte del otro esta a otro nombre" es pedir la reemision, y la respuesta
  a "necesitamos ese nivel de seguridad" es sellar lo nuestro. Ver `docs/QR_VERIFICACION.md`
  y `scripts/_qrVerificacion.py`.

El limite sigue donde estaba, y es uno solo: **el QR de un papel ajeno no se toca, y nuestro
QR no se le pone encima a un papel ajeno.** Enforcement ejecutable ya cargado en esta misma
sesion: `_es_ajeno()` en `scripts/_qrVerificacion.py` corre antes de escribir nada y `sellar`
sale con codigo 2 si el PDF ya trae el QR de otro emisor — probado contra un reporte real.
No depende de que yo me acuerde.

**Incidente 25-27/08/2026.** Seis ensayos de un laboratorio externo sobre la misma muestra de
un insumo importado. Cinco emitidos a nombre de Barack; el sexto, a nombre de otra empresa. El
25/08 se tapo ese campo con un rectangulo blanco y se escribio Barack encima — y el texto
original quedo igual en la capa de texto de dos paginas, o sea que ni siquiera funcionaba. El
27/08 el pedido fue **cambiar el QR para que apuntara a nuestra copia editada** y mandar el
lote al portal del cliente. Se rechazo: los seis QR resuelven contra el LIMS del laboratorio,
que es el registro del emisor. Salida real: mail al proveedor pidiendo la reemision del que
estaba a otro nombre. Los datos concretos (laboratorio, numeros de reporte, quien recibia) NO
van aca: el repo es publico. Viven en la memoria local `documento_de_tercero_no_se_edita`.

Enforcement: hook `doc-tercero-guard.sh` (PreToolUse, 1x/h) — dispara al ver una operacion de
edicion de PDF o el dominio del laboratorio. Regresion: `doc-tercero-guard.test.sh`.
Relacionado: `core-prohibiciones.md` §1, memoria `documento_de_tercero_no_se_edita`.
