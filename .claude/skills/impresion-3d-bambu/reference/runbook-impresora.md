# La impresora 3D (Bambu A2L): qué hacer cuando algo no anda

Hoja de una carilla para quien esté en la planta (Fak, Leo, Paulo). La armó Ingeniería el 16/10/2026 con lo
que pasó el 15/10 a la noche y con la wiki oficial de Bambu (las páginas están en
`4- MANUALES\IMPRESORA 3D BAMBU LAB A2L\`). No reemplaza la wiki: si algo de acá no coincide, manda la wiki.

## «La impresora no contesta» (la PC dice «no la encuentro» o «sin conexión»)

1. Andá a la impresora y mirá la pantalla: ¿está prendida? ¿Dice imprimiendo, pausa o finalizada?
2. Si dice **imprimiendo, dejala**: la impresión no necesita la PC ni el wifi; el archivo está en la tarjeta
   de la impresora.
3. En la pantalla, **Ajustes > WLAN**: tiene que estar en la wifi `barack_Oficinas_PA` (2,4 GHz). Ahí se ve su
   dirección (192.168.1.algo). El programa la busca solo por su número de serie; si igual no la encuentra,
   pasale esa dirección a la persona que usa la PC.
4. **Ajustes > Solo LAN**: «Solo LAN» y «Modo desarrollador» tienen que estar prendidos. Si cambió el código de
   acceso, lo escribe Fak en la ventanita del programa, **nunca en un chat ni en un mail**.

## «Volvió la luz, ¿qué hago?»

5. Si la pantalla **ofrece reanudar**: primero mirá la pieza. Si está pegada y en su lugar, Reanudar; si se
   movió o se despegó, Cancelar. (El PLA se enfría rápido y se puede despegar.)
6. Si dice **«Impresión finalizada»**: sacale una foto a la pantalla antes de tocar «Ok», revisá las piezas y
   sacá la placa recién cuando esté fría.
7. Si está en la pantalla de inicio sin preguntar nada, la impresión se perdió: no mandes otra hasta sacar lo
   que quedó en la placa.

## Antes de mandar cualquier impresión

8. **Placa vacía y limpia.** Si sacaste piezas, anotalo: `registro.py --placa-libre` (o decíselo al asistente).
   Sin eso, el programa no manda la próxima.
9. La placa se lava con **agua tibia, detergente y esponja**; alcohol no, acetona nunca. No se toca con los dedos.

## Se terminó o se enredó el filamento (la impresora queda en pausa)

10. Mirá qué dice la pantalla. **Si se terminó el rollo**: cargá un rollo **igual** (misma marca, material y
    color) en un lugar libre o en el mismo, y tocá reanudar. **Si dice enredo**: el filamento suele estar
    anudado o **trabado en el borde del carrete**; destrabalo, revisá que el tubo no esté muy doblado y reanudá.
11. Con un segundo rollo igual cargado y **«AMS Filament Backup»** prendido (Ajustes > Opciones AMS), la
    impresora cambia sola de rollo. El negro va siempre con respaldo.
12. Si el filamento se cortó adentro del cabezal y no carga: es el «hub» trabado; se desarma con la impresora
    apagada y fría (wiki `filament-hub-clear`). Avisá a Fak antes de abrir nada.

## Cómo cambiar un rollo en el carrete reutilizable (wiki `swaping-new-filament-with-bambu-reusable-spool`)

13. Sacá el envoltorio del rollo nuevo (si trae una tira transparente, **no la saques todavía**).
14. **Abrí el carrete girándolo en contra del reloj**: se separa en dos mitades.
15. Alineá la muesca del núcleo de cartón con la traba de la mitad ancha, apretá el rollo, poné la mitad
    angosta y girala a favor del reloj hasta el «clic».
16. Sacá la tira cerca de la punta, metela en el agujero redondo del carrete y recién ahí sacá el resto.
    Si queda luz entre el rollo y el carrete, apretá los costados con la mano (así no se enreda).
17. Cambiá la etiqueta vieja por la que viene con el rollo nuevo. Cortá la punta recta antes de cargarla.
18. **Pesá el rollo montado** en una balanza y anotalo: `registro.py --pesar <lugar> <gramos>`. La impresora
    no sabe cuánto le queda a un rollo; la cuenta la lleva el programa y la balanza la corrige.
    (Si el chip del rollo viaja con la recarga, la wiki no lo dice: a confirmar mirando una recarga.)
