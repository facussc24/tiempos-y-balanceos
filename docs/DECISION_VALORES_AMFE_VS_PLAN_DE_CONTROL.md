# Donde van los valores numericos: AMFE o Plan de Control

**Decidido el 16/08/2026.** Fak planteo la duda asi: *"en el AMFE dijimos que no ibamos a poner
numeros, iban solo en el Plan de Control. ¿O estoy equivocado? Pero como hacemos para pasarle los
datos a Calidad si no estan en el AMFE?"* y delego la resolucion contra los manuales.

## Respuesta corta

**Fak no esta equivocado.** Los valores van al Plan de Control. Y el AMFE **no es** el vehiculo
para pasarle datos a Calidad: el vehiculo es el Plan de Control, que es el documento que Barack
si distribuye. Lo que el AMFE le aporta a Calidad es **donde falta control**, no el numero.

## La evidencia

### 1. El formulario de AMFE de Barack no tiene columna de especificacion

Las columnas del Anexo III de `I-AC-005` (planilla real de la empresa) son: item del proceso ·
paso del proceso · elemento de trabajo (4M) · funcion del item · **funcion del paso del proceso y
caracteristica del producto (el valor cuantitativo es opcional)** · funcion del elemento de
trabajo · efecto de falla · modo de falla · causa de falla · severidad · **controles preventivos
corrientes (PC)** · ocurrencia · **controles detectivos corrientes (DC)** · deteccion · AP ·
caracteristicas especiales · accion preventiva/detectiva · responsable · fecha objetivo · estatus ·
accion tomada · fecha de terminacion · observaciones.

No hay ninguna columna llamada "especificacion" ni "tolerancia".

El Anexo I (Plan de Control) si las tiene, textual: `"Especificacion tolerancia"`,
`"Tecnica de evaluacion/medicion"`, `"Muestra: Tamaño / Frecuencia"`, `"Metodo de control"`.

### 2. El instructivo interno lo dice explicitamente

`I-AC-005 §5.2.2`: *"El AMFE no es un documento que se distribuya, pero si lo son los Planes de
controles, por lo general, mediante sistema informatico, a traves de archivos electronicos."*

`I-AC-005 §5.2`, contenido obligatorio del Plan de Control: *"Todas las caracteristicas y
operaciones del Flujograma, Hojas de Proceso o Fichas Tecnicas. Las acciones recomendadas salidas
del AMFE. Las caracteristicas especiales definidas tanto por el Cliente, como por la Organizacion.
Las recomendaciones para los Planes de Muestreo, de acuerdo con lo indicado en el procedimiento
P-10."*

Leido al reves: **las caracteristicas con sus valores entran al Plan de Control desde el
Flujograma, las Hojas de Proceso y las Fichas Tecnicas.** Del AMFE entran **las acciones
recomendadas**, nada mas.

> Por eso bajar la carpeta de Fichas Tecnicas del SGC fue exactamente lo correcto: la ficha
> tecnica es una de las tres fuentes oficiales de las caracteristicas del Plan de Control.

### 3. El manual permite el valor, pero solo en una columna y como opcional

Manual AMFE SETEC / AIAG-VDA 1ra edicion (`4- MANUALES\AMFE\MANUAL AMFE R06 Julio 2020`), el que
`I-AC-005 §3` cita como referencia vigente:

- Pag. 84, encabezado de columna: *"2-FUNCION DEL PASO DEL PROCESO Y CARACTERISTICA DEL PRODUCTO
  (EL VALOR CUANTITATIVO ES OPCIONAL)"*
- Pag. 86: *"El valor de la cantidad especificada es opcional para el formato de AMFE de proceso."*

O sea: el manual **no prohibe** el valor, lo hace **opcional**, y solo en la columna de
caracteristica del producto. La regla interna del repo (`rules/amfe.md §11`) es mas estricta que
el manual — es una decision de gobernanza de Barack, no una cita.

### 4. En los controles, el manual solo ejemplifica metodo

Pag. 96-98, ejemplos de controles preventivos: *"Control Estadistico de Proceso. Mantenimiento de
equipos. Poka Yoke preventivos. Verificacion de los sistemas anti errores. Calibracion de
equipos."* Y de detectivos: *"Inspecciones visuales, Inspeccion visual con lista de verificacion,
Inspeccion dimensional con equipo (calibre), Sistemas Poka Yoke detectivos... Muro de Control al
final de la linea, Monitoreos de torque."*

Ningun ejemplo lleva un valor. **No hay prohibicion explicita, pero tampoco un solo caso a favor.**

### 5. La practica real de la casa coincide

Medido sobre los 17 AMFE de Supabase (1701 causas):

| | con valor numerico |
|---|---|
| `detectionControl` | 27 / 1701 = **1,6 %** |
| `preventionControl` | 15 / 1701 = **0,9 %** |
| `failure.description` | 23 / 1183 = **1,9 %** |

El AMFE 150, el mas reciente y el que se uso de molde: **0 % de controles con valor**.

## La regla que queda

En el AMFE, el control lleva **metodo + instrumento + frecuencia + de que documento sale el
criterio**. El valor **no** va: se cita el plan que lo tiene.

```
Bien:  "Calibre digital, 3% del lote por entrega (P-10/I, plan de recepcion 1064)"
Mal:   "Calibre digital, 3% del lote por entrega. Cotas: diametro 90 mm, cota 130 mm"
```

La frecuencia de muestreo **si** va en el control: es la practica de la casa (los 31 controles de
recepcion del AMFE 150 dicen "1 muestra por entrega (P-10/I)").

## Como se le pasan entonces los datos a Calidad

1. **El Plan de Control** es el portador y el que se distribuye. Ahi va la especificacion.
2. **El AMFE** le muestra a Calidad donde el riesgo no tiene control, o lo tiene debil. Eso es
   justamente lo que aparecio en Patagonia: la cinta TPU sin ningun control de recepcion, la fila
   del soporte del apoyacabezas vacia entera, la tolerancia de espesor truncada en "2,1 +/-".
3. **El cuerpo del mail** lleva la lista de esos huecos, para que Calidad los cargue en el Plan de
   Control. No se hace un informe aparte.

## Que se corrigio con esta decision

El 16/08/2026 los tres AMFE de apoyacabezas se habian cargado con las cotas dentro del
`detectionControl` (unicos 27 casos del sistema, todos de esa corrida). Se reescribieron dejando
la referencia al plan. Verificado: `detectionControl` con valor numerico = **0** en los tres.

Pendiente para Fak, porque toca un documento ya entregado: el **AMFE 150** tiene 8 modos de falla
con el valor dentro de `failure.description` (*"Espesor del vinilo fuera de 1,8 - 2,5 mm"*,
*"Gramaje del vinilo fuera de 800 - 1000 g/m2"*), que es la tasa mas alta de los 17 y va contra
`rules/amfe.md §11`. Se paso a Calidad asi el 14/08. **No se toca sin que Fak lo decida.**
