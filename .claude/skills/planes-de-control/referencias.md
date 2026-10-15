# Planes de control — fuentes (relevadas el 15/10/2026)

Copias de trabajo de todo lo de abajo: `.sgc-cache/planes-control-2026-10-15/` (gitignoreado; cada carpeta
tiene su `_ORIGEN.txt`). El original manda; la copia es para leer sin tocar el servidor.

## Normas (leidas)

| Fuente | Ruta | Que se tomo |
|---|---|---|
| IATF 16949:2016 en castellano con SIs a mayo 2022 | `4- MANUALES\IATF\IATF16949-IATF-SIs-May-2022-ISO9001-Integrados.pdf` (pag. impresa 54-55: 8.5.1.1 a 8.5.1.4; 60: 8.5.6.1.1; 72: 10.2.4; 74-75: Anexo A) | 8.5.1.1 (contenido a-e, revision f-i, familias), 8.5.1.3 (set up, primera/ultima pieza), 8.5.1.4 (parada), 8.5.6.1.1 (controles alternativos), 10.2.4 (error proofing en el plan), Anexo A.1 (fases) y A.2 (elementos minimos) |
| AIAG APQP 3a edicion (2024) | `4- MANUALES\APQP PPAP\APQP\APQP-Third-Edition_hzeinal.ir-1.pdf` | 0.8 fases; 3.6 prelanzamiento (refuerzos); 4.7 produccion y Safe Launch; **Apendice A-10 Control Plan Checklist** (21 preguntas, pag. 68) |
| AIAG Control Plan Reference Manual 1a ed. (CP-1, 2024) | **no esta en la biblioteca**: desde el 01/03/2024 reemplaza al Anexo del APQP 2a ed. (lo dice el APQP 3a ed., pag. ii) | pendiente conseguirlo; el A-10 lo cita como la metodologia |
| VW Formel Q Piezas Nuevas Integral (es) | `4- MANUALES\Fórmula Q Piezas Nuevas Integral VW\Formel_Q_Neuteile Integral_Espanhol_Freigabeversion.pdf` | pide el plan de control de produccion segun ISO/TS 16949 en la aceptacion (2.4.4.3); D/TLD: ver `caracteristicas-especiales.md` |
| VDA 6.3 (2017) | `4- MANUALES\VDA MANUAL\Manual VDA 6 parte 3 2017.pdf` | **escaneado, sin texto**: no se leyo; lo que importa de VW esta en la auditoria de abajo |

## SGC de Barack (leidos)

| Documento | Ruta / cache | Que se tomo |
|---|---|---|
| I-AC-005 rev B | `.sgc-cache/sgc/I-AC-005 Emision y control del AMFE y plan de control.md` | §5.2 que contiene el plan; prelanzamiento = mas muestreo; revision con letra desde A en rojo; cambios en la primera hoja; aprobacion Calidad + Ingenieria |
| Formulario I-AC-005.1 rev A | `Y:\...\SISTEMA\SISTEMA SGC\Instructivos\CALIDAD\Anexos\I-AC-005.1  Plan de Control de Prelanzamiento y Produccion A.xls` | columnas A-N, revisiones filas 10-37, firmas fila 44, encabezado filas 50-58, cuerpo desde la 60 |
| Formulario I-AC-005.2 rev A | misma carpeta, `I-AC-005.2  Plan de Control de Recepcion A.xls` | el de recepcion |
| P-09 rev B y P-09.1 (= P-09/I) rev B.1 | `.sgc-cache/sgc/P-09 Control de los procesos.md`, `P-09.1 Reaccion ante una NO conformidad (sinoptico).md` | el plan de reaccion de la casa: detener, controlar hacia atras, segregar, 3 consecutivas = parar y escalar |
| P-10 rev B | `.sgc-cache/sgc/P-10 Inspeccion y ensayos.md` | recepcion segun el plan de recepcion; cero defectos por atributos; repetir ensayo por variables |
| I-AC-032 | `.sgc-cache/sgc/I-AC-032 Verificacion Poka Yoke.md` | verificacion de dispositivos a prueba de error |
| Cronograma de calibracion 2026 Rev. 7 | `Y:\...\CALIBRACION\Cronograma calibracion\13-Cronograma de calibracion 2026 REV.7.xls` | codigos MC, sector, ultima calibracion, vencimiento |
| Planes de recepcion por material | `Y:\...\Recepcion De Materiales\1 - Planes de control\<familia>\` | p. ej. 818 ISO-PLUS 1290, 822 POLI-PLUS FF-629, 1043 hilo FX284-E0PTO (Linhanyl, C. Rodriguez rev B 03/09/25), 1063/1064/1065 estructuras APC Patagonia (30/04/2026). `VINILO\Patagonia\` vacia al 15/10/2026 |
| Catalogo de PC | `Y:\...\PPAP CLIENTES\CATALOGO DE PC.xlsx` | planes revisados por Calidad ene-abr 2025 (PWA, TBA, Vuteq, Mirgor); revision anual |
| Auditoria VDA 6.3 de VW 2025 | `Y:\...\DOCUMENTACION SGC\Plan de acción - VW - VDA 6.3 - 2025.xlsx` | mezcla/agitacion de adhesivo y reticulante fuera del plan (6.1.5); registrar valores de costura; FIFO espumas APC; pirometro del horno de apoyacabezas danado (6.4.1) y sin calibrar (6.4.3); letra D en toda la documentacion (6.2.3); layout y ensayos funcionales (CSR VW, 7.1); compresion PV 3410 de APC (7.2) |

## Planes modelo (leidos)

| Plan | Ruta | Por que sirve |
|---|---|---|
| PWA 21-6034 Rev Z (Calidad, 05/2026) y la serie `PWA NUEVOS PC\Punz 60/100/140` | `Y:\...\PPAP CLIENTES\PWA\PPAP - 2024 - REV LAYOUT\...` | **el modelo de Cecilia**: equipo C.RODRIGUEZ / A.AGUAYO / R.MALDONADO; set up con las 4 situaciones; maquina BMA y regla MC 334 / Mylar MC345 con codigo; reclamo SAS escrito en el parametro; recepcion con D en flamabilidad y auditor de recepcion; test de lay out anual con cotas. Confirmado como patron en 3 planes |
| APC delantero Amarok PA2, `PdC 2HT.881.901.D_YZM-E.OHE rev.4.pdf` | `Y:\...\PPAP CLIENTES\VW\AMAROK PA2\AMAROK PA2 - APC DELANTEROS\APQP\12-Plan de Control\` | el apoyacabezas VW que llego a rev 4 en serie: costura por operacion con maquina BM, hilo con codigo, largo de puntada 4 en 16 ±1 mm con calibre, retrabajo op 37, horno 250-280 °C, test de lay out PV2005. Huecos: columna PROCESO vacia, velocidad del horno sin valor |
| Apoyacabezas Toyota TBA 71909 / 71951 y 71122 rev C | `Y:\...\PPAP CLIENTES\VW\TAOS\APC\APQP\1. Imput\QTR APC TAREK\E1-F1\` | dos filas por caracteristica (1 pieza inicio y fin de turno por calidad + 100 % por lote autocontrol); inspeccion final descripta con foto y poka-yoke |
| Rev 0 APC Patagonia (N. Perez, 04/06/2026, 3 hojas) | Escritorio `_EN ESPERA\Plan de control apc comparar con amfes...\PC APOYACABEZAS Patagonia Delantero Rev0.xls` (mail de Nicolas del 22/07) | el plan a corregir; errores tipicos en §3 del SKILL |

## Nuestras charlas (errores ya cometidos)

- 08/09/2026: el plan es de Calidad.
- 09/10/2026 (sesion f90bdf36, reclamo agujas PWA): formato de la app en vez del de Calidad; base de un
  borrador de marzo sin comparar con planta; proceso distinto de la HO 984; valores sin fuente;
  "Lider de produccion" en todas las filas; flamabilidad "por certificado"; recepcion incompleta;
  frecuencias distintas entre AMFE y plan. Fak: *"¿como te aseguraste de hacerlos bien?"*.
- 06/10/2026 (PC de Nicolas, APB): operaciones del flujograma faltantes, final sobre la costura oculta,
  set up con texto de otra maquina, parametros sin valor, una sola ficha de embalaje, S/R con dos marcas,
  calibre con certificado NO OK (`exports/PC_NICO_20261006/QUE QUEDA PARA LA REUNION CON NICO.txt`).
- 15/10/2026: el mail de Cecilia con planes de ejemplo **no esta** en el cache de mails (busque
  `c.rodriguez`, `Cecilia` + `plan de control`); el modelo son los planes que ella reviso en el servidor.
