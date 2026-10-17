# REVIEW · hojas de proceso (HO, formulario I-IN-002.4-R01)

Lo que Fak devolvió de una hoja, convertido en qué mirar. El canon es `docs/CRITERIOS_HOJAS_DE_PROCESO.md` (con su
checklist del §6) y la skill `hojas-de-proceso`; el gate que la rechaza, `hoja_proceso_check.py` y el revisor del PDF.
Esto no lo reemplaza: es la lista corta para el revisor. Etiquetas y formato del informe: `REVIEW.md`.

| Qué mirar (Importante) | Por qué (la queja de Fak) | Dónde vive el criterio |
|---|---|---|
| Se juzga **impresa**: el texto se lee a tamaño real y nada queda cortado | «una hoja se juzga impresa» | `hojas-proceso.md` §5, `_xlsxAPdf.py` |
| Una pieza de nombre raro lleva su aclaración entre paréntesis **y** su recuadro con el nombre en la foto | 13/10: «Verificar que los acumuladores... no entiendo... es increíble que sigamos fallando en esto» | skill `hojas-de-proceso` 0.8 b bis |
| El plan de reacción va debajo de las fotos y el ciclo de control al lado, como la HO de Excel de la casa | 07/10: «te lo dije 300 veces, no es el estándar que decidimos» | canon §4.5, `bloque_plan()` |
| Ni un `TBD` en la descripción de un paso (el del número de hoja en el cajetín sí) | 24/09: «no puede haber ni 1 TBD» | `no-pfd-no-ho.md` |
| El logo es SOLO el oficial (`barack_logo.png`, hash `5d9207e12856`) | 09/10: «usaste un logo no oficial de Barack, gravísimo» | `core-prohibiciones.md` §9, `_sinFirmaIA.py` |
| Fotos reales o capturas; nada generado ni «mejorado» con IA | 09/10: «parecen hechas con IA... me da una fea sensación» | canon §2.2 |
| Una hoja que manda seguir pasos de una pantalla nombra primero las PIEZAS que se mueven | 25/09: «era extremadamente difícil de comprender» | memoria `project_hojas_proceso_img` |
| El número de HO es de la hoja, no pasa de 999 y sale de `python scripts/_hoNumeros.py` | | `ho-numeracion-guard.sh` |
| El EPP no lleva un valor por defecto: sale del puesto | tanda 1.5 (16/10) | generadores de `scripts/img/` |
| En CREADO POR va la persona (`F.Santoro`), nunca «Claude» | 08/10: «es un error gravísimo, no puede volver a suceder nunca» | `core-prohibiciones.md` §9 |

**Nit**: vocabulario de planta que no está en la tabla de términos del canon §3.2, una foto bien encuadrada pero un poco
oscura, el orden de los pasos dentro de una misma hoja cuando no cambia el proceso.
