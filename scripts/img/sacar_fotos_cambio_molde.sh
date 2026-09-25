#!/usr/bin/env bash
# Las fotos de las hojas del CAMBIO DE MOLDE de la moldeadora IMG, sacadas del VIDEO con la
# procedencia adentro de cada archivo (fotodevideo.py), y despues rotuladas (rotular.py).
#   bash scripts/img/sacar_fotos_cambio_molde.sh               # todo: pisa las fotos
#   bash scripts/img/sacar_fotos_cambio_molde.sh --solo-marcas # solo los recuadros
# Rotacion: el IMG_0663 declara rotation=90 y esta mal (va --rot 90); el IMG_0667 gira el
# telefono a los 42 s (antes --rot 0, despues --rot 270). Se MIRA la plancha al terminar.
#
# 25/09/2026, rehechas porque Fak no entendia las hojas: cada foto de un paso muestra la
# MAQUINA (no un recorte de la pantalla) y lleva un recuadro sobre lo que el paso nombra.
set -e
cd "$(dirname "$0")/../.."
F=.claude/skills/hojas-de-proceso/scripts/fotodevideo.py
R=.claude/skills/hojas-de-proceso/scripts/rotular.py
L="C:/Users/FacundoS-PC/BARACK ARGENTINA SRL/Ingeniería y Proyecto - General/INGENIERIA BARACK (NUNCA BORRAR)/5- VIDEOS Y FOTOS/1- CLIENTES/NOVAX/TOP ROLL/MAQUINA MOLDEADORA IMG"
V579="$L/2026-09-02 - MOLDEADORA - pantalla de parametros y botonera (IMG_0579).MOV"
V662="$L/2026-09-04 - MOLDEADORA - HMI, portico y trabajo sobre la maquina con los tecnicos (IMG_0662).MOV"
V663="$L/2026-09-04 - MOLDEADORA - trabajo dentro de la maquina - cableado y mangueras (IMG_0663).MOV"
V664="$L/2026-09-04 - CAMBIO DE MOLDE - amarre con cadenas y grua sobre la mesa (IMG_0664).MOV"
V666="$L/2026-09-04 - CAMBIO DE MOLDE - el molde en el carro saliendo de la maquina (IMG_0666).MOV"
V667="$L/2026-09-04 - MOLDEADORA - ajustes en la maquina y pantallas de temperatura por zona (IMG_0667).MOV"
A=scripts/img/assets_cm
mkdir -p "$A"

s() {  # video seg rot crop out nota [radio]
  py -3 "$F" sacar --video "$1" --seg "$2" --rot "$3" --crop "$4" --out "$A/$5" --nota "$6" \
     --radio "${7:-0.6}" --ancho 1800
}
r() {  # base salida marca [marca...]   (una sola marca: recuadro sin numero)
  # --grosor 9: la foto de un paso sale de ~8 cm impresa, y el recuadro automatico (4 px)
  # no se ve en el papel. El mapa de la hoja 38 va grande: G=6.
  local base="$1" out="$2"; shift 2
  local args=()
  for m in "$@"; do args+=(--marca "$m"); done
  py -3 "$R" --foto "$A/$base" --out "$A/$out" --banda ninguna --ancho 1800 \
     --grosor "${G:-9}" "${args[@]}"
}

if [ "$1" != "--solo-marcas" ]; then
s "$V663" 70   90  "0,0,100,100"      cm00_paquete.jpg   "el paquete del molde en la maquina: molde inferior, molde auxiliar y cuchilla sobre sus pilares"
s "$V579" 412.267 0 "9,16,88,80"      cm38_base.jpg      "RESET, selector automatico/manual, lista de modos y el icono Cambio Molde" 0
s "$V662" 1301 0   "0,1,97,98"        cm39_base.jpg      "pantalla Cambio Molde, lista de desmontaje en castellano" 0
s "$V662" 344  0   "40,42,60,53.3"    cm40b_vinilo.jpg   "el vinilo solo, sin sustrato, apoyado sobre el molde inferior" 0
s "$V662" 433  0   "0,6,100,89"       cm40c_grasa.jpg    "grasa en la punta del pilar, con pincel"
s "$V662" 529  0   "0,6,100,89"       cm40d_pilar.jpg    "pilar en el taco rojo, trabado con su pasador" 0.3
s "$V662" 645  0   "0,6,100,89"       cm41a_auxiliar.jpg "el molde auxiliar bajado sobre el molde inferior, con el vinilo en el medio"
s "$V662" 686  0   "15,10,65,57.8"    cm41b_palanca.jpg  "panel de aire del costado: la palanca derecha es la del molde auxiliar"
s "$V662" 805  0   "12,0,76,67.6"     cm41d_sube.jpg     "despues del paso 9: la maquina subio y el molde auxiliar quedo apoyado" 1
s "$V662" 1232 0   "22,30,78,69.3"    cm42_pilar_cuchilla.jpg "un pilar de la cuchilla con su taco rojo, debajo de la placa de la cuchilla" 0.4
s "$V662" 1351 0   "5,0,90,80"        cm42_cuchilla_abajo.jpg "la cuchilla bajada sobre sus pilares, encima del molde auxiliar" 0.5
s "$V662" 1369 0   "30,26,40,35.6"    cm42c_palanca.jpg  "panel de aire del costado: la palanca izquierda es la de la cuchilla" 0
s "$V663" 70   90  "22,0,56,50"       cm42_cuchilla_apoyada.jpg "la cuchilla apoyada sobre sus pilares despues del paso 15, con la maquina arriba"
s "$V663" 142  90  "0,6,100,89"       cm43a_conectores.jpg "acoples de agua y ficha electrica del molde inferior"
s "$V663" 400  90  "25,33.3,75,66.7"  cm43_carro_contra.jpg "el carro de cambio de molde puesto contra la maquina"
s "$V664" 40   0   "30,30,42,37.3"    cm43c_pasador.jpg  "el pasador de tope con su cadena" 0.5
s "$V664" 60   0   "20,0,78,69.3"     cm43d_empuje.jpg   "dos operarios pasan el molde al carro, con el molde auxiliar y la cuchilla apoyados encima"
s "$V666" 45   0   "5,22,78,69.3"     cm44a_carro.jpg    "el carro de cambio de molde con el molde completo" 1
s "$V667" 150  270 "10,15,80,71.1"    cm44c_empuje.jpg   "el molde empujado hacia adentro de la maquina"
s "$V663" 120  90  "0,12,80,71.1"     cm44d_agua.jpg     "acoples de agua y ficha electrica del molde inferior"
s "$V667" 197.5 270 "9.4,22,44.6,39.6" cm44_senales_paso5.jpg "lista de montaje en castellano: pasos 2 a 7, con las 4 senales del paso 5" 0.3
fi

# ── Los recuadros (en % de la foto ya recortada; se MIRAN despues en la plancha) ──
# El mapa del molde: tres marcas numeradas = los tres renglones de la hoja 38.
# Los pilares NO se marcan aca: en esta foto hay pilares largos que atraviesan la placa del medio
# y no se puede probar cual es del molde auxiliar y cual de la cuchilla (25/09/2026).
G=6 r cm00_paquete.jpg    cm38_mapa.jpg \
  "30,53,31,14|Molde inferior (franja verde)" \
  "30,40,31,10.5|Molde auxiliar (cartel amarillo)" \
  "30,16,31,17|Cuchilla"
# La pantalla de la hoja 40: los numeros van donde no tapan el rotulo "Paso N" de la lista.
G=6 r cm39_base.jpg       cm39_pantalla.jpg \
  "7,13.5,8.8,14|Desmontaje (arriba) / Montaje (abajo)" \
  "63.8,28.5,7.2,5.2|Boton gris: mantenerlo apretado" \
  "34,30,6.5,6.5|El verde: paso hecho" \
  "64.5,50.5,21.5,6.5|Texto rojo: a mano" \
  "47.8,61.8,8.6,5.5|Senales del paso"
r cm40b_vinilo.jpg        cm41_1_vinilo.jpg      "1,37,40,25|Vinilo sobre el molde inferior"
r cm40c_grasa.jpg         cm41_2_grasa.jpg       "40,52,20,20|Punta del pilar"
r cm40d_pilar.jpg         cm41_3_pilar.jpg       "50,36,20,33|Pilar en el taco rojo"
r cm41a_auxiliar.jpg      cm41_4_baja.jpg        "7,17,63,26|Molde auxiliar"
r cm41b_palanca.jpg       cm41_5_palanca.jpg     "48,52,22,33|Palanca derecha"
r cm41d_sube.jpg          cm41_6_apoyado.jpg     "23,19,40,22|Molde auxiliar apoyado"
r cm42_pilar_cuchilla.jpg cm42_1_pilar.jpg       "32,5,11,53|Pilar de la cuchilla"
r cm42_cuchilla_abajo.jpg cm42_2_baja.jpg        "25,4,50,30|Cuchilla"
r cm42c_palanca.jpg       cm42_3_palanca.jpg     "19,36,20,37|Palanca izquierda"
r cm42_cuchilla_apoyada.jpg cm42_4_apoyada.jpg   "15,28,54,37|Cuchilla apoyada"
r cm43a_conectores.jpg    cm43_1_agua.jpg        "2,36,48,44|Acoples de agua"
r cm43_carro_contra.jpg   cm43_2_carro.jpg       "26,26,41,73|Carro"
r cm43c_pasador.jpg       cm43_3_pasador.jpg     "35,26,30,72|Pasador de tope con cadena"
r cm43d_empuje.jpg        cm43_4_empuje.jpg      "21,7,60,88|El molde con todo encima"
r cm44a_carro.jpg         cm44_1_carro.jpg       "3,58,68,40|Carro"
r cm44c_empuje.jpg        cm44_2_empuje.jpg      "15,8,58,52|Molde"
r cm44d_agua.jpg          cm44_3_agua.jpg        "40,36,32,20|Acoples de agua"
r cm44_senales_paso5.jpg  cm44_4_senales.jpg     "40,43,22,16|Las 4 senales del Paso 5"
echo LISTO
