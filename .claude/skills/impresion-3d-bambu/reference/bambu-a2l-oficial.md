# Lo que dice Bambu Lab de la A2L (wiki oficial, leída el 13/10/2026; releída y ampliada el 16/10/2026)

Cada dato con su página. **Los originales están en la nube de Ingeniería,
`INGENIERIA BARACK (NUNCA BORRAR)\4- MANUALES\IMPRESORA 3D BAMBU LAB A2L\`**: 20 páginas (11 del 13/10 y
9 del 16/10), cada una como transcripción `.txt` (texto original en inglés, con URL, fecha y cómo se
obtuvo) y captura `.png` de la página completa (las del 16/10 traen también el `.html` crudo). El 16/10 se
releyó este resumen contra los 11 originales: se corrigió el enredo (reintenta una vez antes de pausar). La
placa **no lleva pegamento**: `a2l-intro` dice que la texturada sirve para PLA, PETG y TPU y *"does not require
any adhesives"* (releído contra el original el 16/10 a la tarde). Ahí no va nada mío: este resumen vive en la skill
(regla `documentacion-oficial.md`). Copia de trabajo: `exports/impresion_3d/fuentes_bambu/*.txt` (se vuelve a bajar con `scripts/wiki_bambu.py <ruta> <carpeta>
[--captura]`; WebFetch da 402 con esta wiki, pedida como navegador contesta). Índice de la A2L:
`https://wiki.bambulab.com/en/a2l`. Antes de afirmar algo que no esté acá, se baja la página.

## La placa: por qué se despega una pieza y cómo se limpia

Fuentes: `en/filament-acc/acc/pei-plate-clean-guide` · `en/general/textured-PEI-plate-not-working-as-expected`
· `en/a2l/manual/first-print` · `en/a2l/maintenance/period-maintenance`.
Captura para mostrar: `exports/impresion_3d/fuentes_bambu/EVIDENCIA_limpieza_placa_Bambu.png`.

- **No tocar la superficie con los dedos**: la grasa de la piel baja la adherencia y no se ve
  hasta la primera capa.
- **Se lava con agua tibia + detergente de cocina + esponja, y se seca con papel.** El detergente
  no tiene que traer aceites ni humectantes.
- **Alcohol no, en la placa texturada**: *"Alcohol might just spread the oils on the print surface
  instead of removing it"*; el detergente desengrasa y la esponja llega adentro de la textura.
- **Acetona nunca**: *"Do not clean the Textured PEI with Acetone, as it will damage the PEI surface"*.
- **Prueba de que quedó limpia**: el agua forma una película pareja. Si corre en hilos y junta
  gotas, sigue sucia.
- Si después de lavar sigue sin pegar, en este orden: subir un poco la temperatura de la placa
  (en PLA, demasiado alta tapa la boquilla y da «pata de elefante»); agregar *skirt* a las piezas
  chicas para agrandar el apoyo (así lo dice la página; acá se hace con el borde, `brim_type`) y soportes a las
  altas y finas; revisar la temperatura si el perfil fue tocado;
  primera capa de 0,5 mm de ancho de línea y 0,25 mm de alto; dar vuelta la placa.
- **Sacar la pieza**: esperar a que placa y pieza lleguen a temperatura ambiente, sacar la chapa
  y flexionarla. La línea de purga se saca con la espátula (`first-print`: «Use a Scraper»).
- Una zona gastada del recubrimiento donde la impresora limpia la boquilla es normal; si el
  desgaste está en la zona de impresión, se usa la otra cara o se cambia la placa, y se nivela.
- Antes de poner la chapa: la cama magnética sin restos (se daña al calentar).

## Lo que la impresora detecta sola (y pausa)

Fuentes: `en/a2l/manual/a2l-faq` · `nozzle-clumping-detection` · `air-printing-and-filament-tangle-detection`.

- **Su wiki no documenta una detección de fallas por cámara** (fideos, pieza despegada: la «Spaghetti
  detection» es de X1/H2). Pide que la cámara quede apuntada al área de impresión *"to avoid any detection
  issues with the print area or nozzle"* (`a2l-intro`): algo de lo que detecta la usa, sin que diga qué.
  Detecta con sensores: fin de filamento, impresión en el aire, filamento trabado y pegote en la boquilla (`a2l-faq`:
  hereda de la A1 «filament runout detection, air printing detection, and filament tangle detection»). Por eso
  vale la pena mirar la cámara desde afuera.
- **Pegote en la boquilla** (sensor mecánico en el limpiador de purga; por defecto «Auto»): se
  controla cada vez que el cabezal pasa por la purga (extrusión, cambio de color), **obligatorio
  en las capas 2 y 3**, a intervalos fijos **hasta los 10 mm de altura**, y en PLA cada 6 g
  consumidos, 3 veces. **Después de los 10 mm y de esos 18 g ya no hay control fijo**, pero los demás
  siguen (*"the normal execution of other detection methods will not be affected"*): el de cada pasada por la
  purga, el de impresión en el aire y el de filamento trabado. Bambu avisa que no es una detección infalible.
- **Impresión en el aire** (boquilla tapada, filamento gastado o de diámetro raro): corta el filamento,
  retrae, pausa y avisa. Se detecta **después** de que pasa: antes de reanudar hay que mirar la pieza.
- **Filamento trabado o enredado** (el carrete o el tubo frenan; con el cargador de 4 lo mide el resorte del
  distribuidor de filamento del cabezal, el «hub» de la página): **con el cargador primero retrae y vuelve a cargar, UNA vez por filamento y por
  impresión; si vuelve a pasar, da error y pausa**. Entre las causas que manda revisar: filamento enredado,
  anudado o **trabado en el borde del carrete**, el cargador muy lejos o el tubo muy doblado, restos en la
  rueda de entrada. Con el cargador de 4 o carrete externo viene activada. Con filamentos flexibles (TPU,
  TPE) o PVA húmedo no se detecta el trabado. Si el sensor falla puede dar falsas alarmas: la página manda
  apagar la detección y probar cargar (no dice cuándo volver a prenderla).
- Todas se configuran en la pantalla: Ajustes > Opciones de impresión (`screen-operation`: sonidos,
  enredo, recuperación de pasos perdidos, pegote, detección de la placa, impresión en el aire, aislación de
  la cama). **En esa lista no hay un interruptor de recuperación ante cortes de luz**; si la A2L ofrece
  reanudar después de un corte, sus páginas no lo dicen (ver «Corte de luz», más abajo).

Fuentes: `air-printing-and-filament-tangle-detection` · `screen-operation` · `a2l-intro`.

- **Cámara: 0,5 cuadros por segundo** en la vista en vivo (una imagen cada 2 s; `a2l-faq`).

## Fin de filamento y rollo de respaldo

Fuentes: `ams-lite/manual/intro-ams-lite` (el cargador de 4 de la A2L es un AMS lite) · `a2l/manual/screen-operation`
· `ams/manual/ams-function-introduction`.

- Con un solo material: cuando el cabezal deja de ver filamento, mira si el sensor del lugar todavía lo
  ve; si lo ve, sigue empujando; si no, avisa que se terminó y pide cargar otro.
- Con varios colores, si la última punta ya se soltó del carrete y hay que cambiar de color, no la puede
  retraer: la purga entera y pasa al otro lugar.
- **«AMS Filament Backup»** (pantalla: Ajustes > Opciones AMS): cuando se termina el filamento de un lugar,
  pasa solo a otro lugar con un rollo de **la misma marca, tipo, color y temperatura de boquilla**. Si no
  encuentra uno igual, avisa. Pide tener cargada la información de todos los filamentos antes de imprimir.
- Las Opciones AMS de la A2L son: leer el chip al cargar, leer el chip al arrancar, el respaldo y el orden de
  los cargadores. **Ninguna estima lo que queda.** Esa estimación (por el giro del chip, 1 kg = 100 %) es del
  cargador grande (AMS), no del de 4 de la A2L. La impresora informó `remain = -1` y `tray_weight = 1000` el
  13/10 (dato de la máquina, no de la wiki): la cuenta la lleva el registro.

## Distribuidor de filamento del cabezal trabado («filament hub»: filamento cortado adentro)

Fuente: `a2l/troubleshooting/filament-hub-clear`. Cuando el filamento se corta adentro del distribuidor, la
carga siguiente falla (al revés no vale: una carga que falla puede tener otras causas). Se desarma el hub (espátula y pinza plana) y se saca el pedazo. **Antes: impresora apagada y
desenchufada, y la boquilla y la cama frías.**

## La tarjeta MicroSD

Fuente: `a2l-faq`. **La A2L no tiene memoria propia: sin la MicroSD no recibe ni arranca trabajos.** Viene con
una de 32 GB. Lo que sigue no es de Bambu sino observado acá (15/10/2026): el archivo que sube `--imprimir`
queda en la tarjeta y la impresión siguió mientras la PC no la veía.

## Corte de luz (página general de Bambu: la A2L no lo documenta; si la A2L lo hace, falta verlo)

Fuente: `knowledge-sharing/power-loss-recovery` (no nombra la A2L).
- La impresora detecta la caída de tensión y guarda dónde iba: ejes, filamento, renglón del código y
  temperaturas.
- **Al prender de nuevo, si hay un archivo de recuperación, la pantalla ofrece reanudar y reanuda solo si
  alguien confirma.** No sirve durante la primera capa.
- Recalienta, purga un poco y sigue desde el mismo renglón; casi siempre queda una marca en ese punto.
- **El PLA se enfría rápido y se puede despegar de la placa** si la temperatura baja de cierto punto: antes de
  reanudar hay que mirar la pieza.

## La red

Fuentes: `general/printer-network-ports` · `knowledge-sharing/enable-lan-mode` · `a2l-faq`.
- Puertos: 8883 (mensajes, MQTT), 990 y 50000-50100 (subida de archivos, FTP), 6000 o 322 (cámara),
  1990 y 2021 (el anuncio de la impresora en la red, SSDP, multicast/broadcast).
- En modo LAN, Bambu Studio tarda de 20 a 60 s en verla (*"or even longer in some rare cases"*). **No anda
  en algunas redes de invitados** (bloquean la comunicación entre equipos). Entre redes distintas (otra VLAN o
  subred) no la descubre sola, pero se conecta con «Bind with Access Code», la dirección y el código: lo que no
  cruza es el anuncio, no la conexión (esta skill se conecta por dirección al 8883).

## Carrete reutilizable y recarga (cómo cambiar un rollo)

Fuentes: `general/swaping-new-filament-with-bambu-reusable-spool` · `knowledge-sharing/bambu-reusable-spool`.
- Hay dos carretes reutilizables: de baja temperatura (≤ 70 °C, para PLA y PETG) y de alta (≤ 90 °C).
- Pasos de la recarga: sacar el envoltorio (si trae la tira transparente de protección, no sacarla todavía;
  la recarga de 250 g conserva su núcleo de cartón) → **abrir el carrete girándolo en contra del reloj: se
  separa en dos mitades** (la ancha y la angosta) → alinear la muesca del núcleo de cartón con la traba de
  la mitad ancha, apretar el rollo en su lugar y poner la mitad angosta → girar a favor del reloj hasta el
  «clic» → sacar la parte de la tira más cercana a la punta, meter la punta en el agujero redondo del carrete
  y recién ahí sacar el resto de la tira → apretar los costados del rollo si queda luz con el carrete (evita
  enredos) → sacar la etiqueta vieja y pegar la que viene con el rollo nuevo.
- **Si el chip que lee la impresora viaja con la recarga: la página no lo dice. A confirmar** (mirando una
  recarga, o en la página del producto).
- El carrete impreso en 3D es para usar de emergencia, no se seca filamento en él.

## Materiales, placas y ambiente

Fuente: `en/a2l/manual/a2l-faq`.

- Materiales: PLA, PETG, TPU y soportes para PLA/PETG. Con boquilla de acero endurecido, PLA-CF y
  PETG-CF. La FAQ la presenta para materiales de baja temperatura (cama hasta 80 °C, marco abierto) y no
  recomienda imprimir cerrado los de alta; no dice «ABS no». La pantalla trae una nivelación de cama a 80 °C
  *"before printing with high-temperature filaments such as ABS/ASA/PC/PA"* (`screen-operation`). Para ABS o
  ASA se le pregunta a Fak: la wiki no lo descarta ni lo garantiza.
- Placas admitidas: **Textured PEI**, Engineering y Cool Plate SuperTack Pro (`a2l-faq`). La «Cool Plate»
  común no está en esa lista (y el perfil de la A2L la marca `not_support_bed_type`: §5 de la SKILL).
- Ambiente: **15 a 30 °C**, humedad por debajo de 85 %.
- Cambio de color (`purge-mode`): en Bambu Studio hay modo Estándar (purga a la temperatura más
  alta recomendada; calienta en cada cambio) y Rápido (1,2 veces el volumen, a la temperatura de
  impresión: ahorra el calentar y enfriar de cada cambio).

## Mantenimiento que pide Bambu (para avisarle a Fak por horas y por rollos)

Fuente: `en/a2l/maintenance/period-maintenance`. Siempre con la impresora apagada y desenchufada.

| Qué | Cada cuánto |
|---|---|
| Lubricar la guía del eje X (aceite; **grasa prohibida** en esa guía) | 1 vez por mes |
| Lubricar las guías del eje Y | al desembalar y cada **200 horas** de impresión (la impresora avisa) |
| Limpiar los 2 ventiladores del cabezal | 1 vez por mes |
| Limpiar el engranaje del extrusor | cada **5 rollos** de PLA/PETG (2 con fibra de carbono), o si hay sub-extrusión o impresión en el aire |
| Revisar la cuchilla de corte de filamento (multicolor la gasta) | cada **3 rollos** |
| Tubos de PTFE | cada **6 rollos** de PLA (2 con fibra o madera) |
| Limpiador de silicona de la boquilla | cambiar cuando se vea dañado |
| Lavar la placa | seguido; siempre que se haya tocado |
