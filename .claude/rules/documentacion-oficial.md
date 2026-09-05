---
paths:
  - "**/4- MANUALES/**"
  - "**/0-Documentacion cliente/**"
  - "**/1. Imput/**"
  - "**/normas-vw/**"
  - "**/.sgc-cache/**"
---

# Documentacion oficial: el original manda y tiene que verse CUAL es

Regla de Fak, 05/09/2026, textual: *"primero debe estar claro cuales son los manuales originales,
que me importa si esta en aleman o en ingles"*, *"no crees algo vos asi de la nada"*,
*"no pueden haber archivos interpretados por vos ahi, sino esa interpretacion luego le vas a hacer
otra y los datos no van a ser reales al final del dia"*, *"cuando me pidan manuales, como carajo
pasarlos: los oficiales o la documentacion oficial no debe haber dudas dentro de Barack"*.

Aplica a TODO lo que se guarda en la nube de Barack como manual, norma, instructivo, especificacion
o requisito de un cliente, proveedor u organismo (VW, Toyota/Boshoku, SMRC, Woodbridge, AIAG, VDA,
IATF, IRAM, fabricantes de maquinas).

## Las 6 reglas

1. **El original entra TAL CUAL.** Mismo archivo y **mismo nombre que le puso el emisor**. No se
   renombra "para que se entienda", no se le agrega fecha, sigla, revision ni cliente. Si el nombre
   es un desastre, se deja igual: es el nombre por el que el emisor lo va a nombrar.
2. **En la carpeta del original NO va nada producido aca.** Ni resumen, ni guia, ni version
   "ordenada", ni indice. Nada mio comparte carpeta con el original.
3. **Traducciones: carpeta hermana `TRADUCIDOS`.** Y una traduccion es una traduccion: el mismo
   texto en otro idioma, tema por tema, sin reordenar, sin resumir y sin agregar criterio. En cuanto
   reordeno o interpreto deja de ser traduccion y pasa a ser material propio (regla 5). El nombre del
   archivo traducido lleva el nombre del original + el idioma.
4. **Lo que no es un archivo** (una ayuda online, la pantalla de un portal, lo que dijo el cliente
   por mail) se guarda como **transcripcion en .txt**, con URL o fuente, fecha de consulta y como se
   obtuvo, en la cabecera. Transcripcion es **lo que dice**, no lo que entendi. Va en la carpeta del
   original porque ES el original disponible.
5. **El material propio** (guias, checklists, resumenes, tablas de ayuda) va a la carpeta de trabajo
   del tema o a la de la tarea, **nunca** junto a la documentacion oficial, y arranca diciendo de
   donde salio y quien lo armo.
6. **Idioma:** que el original este en aleman o en ingles NO es un problema y NO habilita a
   reemplazarlo. El original se guarda igual; la traduccion se suma aparte (regla 3).

## Por que — la cadena que se envenena

Un archivo interpretado guardado entre los originales deja de distinguirse a la semana siguiente. La
proxima consulta se hace sobre MI version, la siguiente interpretacion se hace sobre esa, y a los dos
pasos lo que Barack tiene escrito ya no es lo que dijo el cliente. Es el mismo mecanismo de
[[feedback_verificar_contra_la_fuente_no_el_codigo]] y del artefacto propio que "describe la fuente
pero no la es" (LECCIONES, seccion "Identidad de un dato"): un archivo mio en la carpeta del cliente
se convierte en fuente falsa por el solo hecho de estar ahi.

Incidente que la origino: el 05/09/2026 extraje la ayuda online de BeOn (portal VW, no descargable),
arme con eso una guia en espaniol **reordenada por mi** y la guarde junto al Formel Q y a la lista de
documentos que mando VW. Fak lo freno: *"para que carajo"*. La guia salio de ahi el mismo dia.

## Estructura que queda

```
<TEMA>\
    <archivos originales, con su nombre original>      <- lo que mando el emisor
    TRADUCIDOS\                                        <- solo si hizo falta traducir
        <nombre original> - ES.<ext>
```
Y si el original no es un archivo: `<TEMA>\<nombre> - transcripcion <fecha>.txt`, con la fuente en
la cabecera.

**Las carpetas donde esto aplica, con el nombre real** (verificado en disco, no supuesto):
`4- MANUALES\` de la biblioteca de la nube · `0-Documentacion cliente\` de la estructura estandar
de proyecto (QTR) · `1. Imput\` del legajo APQP · `docs-local\normas-vw\`. El cache `.sgc-cache\`
es otra cosa: ahi van MIS extractos, con fuente y fecha, y por eso no lo cubre el candado.

## Enforcement

Hook `documentacion-oficial-guard.sh` — guardian `documentacion-oficial-guard` en
`scripts/_lib/guardianes.mjs`, PreToolUse sobre Bash/PowerShell/Write/Edit. **BLOQUEA** (exit 2):

| Que | Por que |
|---|---|
| `Write`/`Edit` de un archivo mio adentro de la carpeta oficial | regla 2 |
| Renombrar o reordenar adentro de la carpeta oficial | regla 1 |
| Copiar o mover ahi algo generado en esta PC (scratchpad, repo, `.build`, Escritorio) | regla 5 |
| Generar el archivo directo adentro (`--out`, redireccion) | regla 5 |

**Deja pasar**: la transcripcion `.txt` que trae `Fuente:` y `Fecha de consulta:` en la cabecera
(regla 4), lo que va a `TRADUCIDOS\` (regla 3), el original que entra desde donde llego (un
adjunto, Descargas) y **sacar de ahi** un archivo mio — que es la unica correccion posible cuando
ya se colo uno. Todo lo demas que toca esas carpetas recibe el recordatorio 1x/h con las 6 reglas.
Tests (rojo y verde): `__tests__/scripts/guardianes.test.mjs`.
