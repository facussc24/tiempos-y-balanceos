# Calibración del revisor contra el pedido — 17/10/2026 (tanda 9, pieza 1)

**Casos**: los 4 de `casos.json`, de sesiones reales: 2 entregables que Fak devolvió y 2 que aprobó (se buscaron 3 de
cada lado; no se ubicaron más con el archivo o el texto que Fak vio, y no se inventaron). La definición de hecho y el
quiz de cada caso se escribieron solo desde el pedido. La reacción de Fak no viaja al revisor (test).

**Cómo corrió**: el agente `revisor-pedido` es nuevo y no aparece en una sesión abierta hasta que llega al checkout
principal, así que cada corrida fue un `investigador` (Sonnet) con el cuerpo del revisor pegado tal cual
(`node scripts/_revisorCalibrar.mjs --prompts <carpeta>`). Corrida 1 con el formato original (un veredicto); corridas 2
y 3 con el formato de dos renglones, que salió de lo que mostró la corrida 1.

## Resultado

```
Revisor contra el pedido · 12 corridas · contra el pedido acierta 12 (4 de 4 casos en todas) · veredicto final acierta 6 (2 de 4 casos en todas)
  D1-fotos-hot-press               devuelto  espera NO CUMPLE · contra el pedido: NO CUMPLE / NO CUMPLE / NO CUMPLE · final: NO CUMPLE / NO CUMPLE / NO CUMPLE
  D2-mail-folio-federico           devuelto  espera NO CUMPLE · contra el pedido: NO CUMPLE / NO CUMPLE / NO CUMPLE · final: NO CUMPLE / NO CUMPLE / NO CUMPLE
  A1-planilla-codigos-patagonia    aprobado  espera CUMPLE    · contra el pedido: CUMPLE / CUMPLE / CUMPLE · final: NO CUMPLE / NO CUMPLE / NO CUMPLE
  A2-tryout-dia4                   aprobado  espera CUMPLE    · contra el pedido: CUMPLE / CUMPLE / CUMPLE · final: NO CUMPLE / NO CUMPLE / NO CUMPLE
```

(node scripts/_revisorCalibrar.mjs --evaluar evals/revisor-pedido/corridas · la corrida 1 traía un solo veredicto: su «contra el pedido» se anotó a mano desde lo que el informe puso en «falta» y «sobra», y está dicho en cada archivo.)

## Lo que mostró

1. **Contra el pedido, el revisor separa bien los cuatro casos en todas las corridas.** En los dos devueltos encontró lo
   mismo que Fak: en las fotos de la Hot Press faltaban el proceso y el mail (había un video del ciclo automático en la
   carpeta 28 minutos antes de la entrega); en el mail a Federico, contestaba por otra área (los rollos a comprar y la
   demanda del EDI). En los dos aprobados no le faltó ni le sobró nada.
2. **Los dos aprobados fallan «reglas de la casa»**, por una regla posterior a la aprobación (`core-prohibiciones.md` §9,
   08/10): la planilla de códigos que salió a Luca el 01/09 tiene «claude» escondido en `xl/workbook.xml` (la ruta del
   scratchpad) y en el complemento de Excel (`claude.fileId`), y el informe TryOut del día 4 tiene 18 imágenes con
   `/home/claude/assets/…` en el texto alternativo (`_sinFirmaIA.py` da BLOQUEANTE en los dos). Son hallazgos reales:
   esos archivos ya salieron. Por eso el revisor da dos veredictos separados desde la corrida 2.
3. **El caso D2 está contaminado**: su queja quedó escrita en `docs/review/mail.md`, que el revisor lee. D1, A1 y A2 son
   independientes. En la corrida 1 un revisor encontró `casos.json` buscando el código de la pieza en el repo (dijo que no
   lo usó); desde la corrida 2 el prompt le prohíbe abrir `evals/revisor-pedido/`.
4. **Variación entre corridas** en «reglas de la casa» de D1: la corrida 1 marcó como Importante que las fotos vivan en
   una carpeta `.claude`; la 2 la dio por buena (la eximen `video-maquina.md` y la lista de rutas excluidas del detector).
   Contra el pedido, ninguna variación.
5. **Un posible hueco del detector**, visto en A2: una corrida dice que `_sinFirmaIA.py --arreglar` no limpia el texto
   alternativo (`descr`) de las imágenes de un PowerPoint y otra dice que sí. **No verificado**: se prueba sobre una copia.

**Veredicto de la calibración**: sirve para lo que se pensó (comparar contra el pedido). La primera semana avisa, no
frena; con 2 y 2 casos reales el número es chico y se dice así.
