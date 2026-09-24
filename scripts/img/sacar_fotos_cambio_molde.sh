#!/usr/bin/env bash
# Las fotos de las hojas del CAMBIO DE MOLDE de la moldeadora IMG, sacadas del VIDEO con la
# procedencia adentro de cada archivo (fotodevideo.py). Se re-corre entero: pisa las fotos.
#   bash scripts/img/sacar_fotos_cambio_molde.sh
# Rotacion: el IMG_0663 declara rotation=90 y esta mal (va --rot 90); el IMG_0667 gira el
# telefono a los 42 s (antes --rot 0, despues --rot 270). Se MIRA la plancha al terminar.
set -e
cd "$(dirname "$0")/../.."
F=.claude/skills/hojas-de-proceso/scripts/fotodevideo.py
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

s "$V663" 70   90  "0,0,100,100"      cm00_paquete.jpg   "el paquete del molde en la maquina: molde inferior, molde auxiliar y cuchilla sobre sus pilares"
s "$V579" 412.267 0 "9,16,88,80"      cm38_base.jpg      "RESET, selector automatico/manual, lista de modos y el icono Cambio Molde" 0
s "$V662" 1301 0   "0,1,97,98"        cm39_base.jpg      "pantalla Cambio Molde, lista de desmontaje en castellano" 0
s "$V662" 44   0   "13,10,62,55"      cm40a_pasos.jpg    "pasos 1 y 2 de la lista de desmontaje"
s "$V662" 344  0   "40,42,60,53.3"    cm40b_vinilo.jpg   "el vinilo solo, sin sustrato, apoyado sobre el molde verde" 0
s "$V662" 433  0   "0,6,100,89"       cm40c_grasa.jpg    "grasa en la punta del pilar, con pincel"
s "$V662" 529  0   "0,6,100,89"       cm40d_pilar.jpg    "pilar en el taco rojo, trabado con su pasador" 0.3
s "$V662" 645  0   "0,6,100,89"       cm41a_auxiliar.jpg "el molde auxiliar bajando a la posicion de cambio"
s "$V662" 686  0   "15,10,65,57.8"    cm41b_palanca.jpg  "panel de aire del costado de la maquina: las dos palancas"
s "$V662" 742  0   "25.5,54,34.3,30.5" cm41c_senales.jpg "pasos 7 a 9 de la lista de desmontaje: las cuatro senales del paso 7 en verde" 0
s "$V662" 805  0   "12,0,76,67.6"     cm41d_sube.jpg     "el molde auxiliar subido despues del paso 9" 1
s "$V662" 1190 0   "13,36,45,40"      cm42a_pilares.jpg  "un pilar de la cuchilla puesto en su agujero de la placa" 0.5
s "$V662" 1290 0   "45,18,52,46.2"    cm42b_cuchilla.jpg "pasos 11 a 15 de la lista de desmontaje"
s "$V662" 1369 0   "30,26,40,35.6"    cm42c_palanca.jpg  "panel de aire del costado: la segunda palanca, la de la cuchilla" 0
s "$V663" 34   90  "52,26,40,35.6"    cm42d_sube.jpg     "paso 15 de la lista de desmontaje, con el dedo en el boton" 0.5
s "$V663" 142  90  "0,6,100,89"       cm43a_conectores.jpg "acoples de agua y ficha electrica del molde inferior"
s "$V662" 1301 0   "55,51,40,35.6"    cm43b_pantalla.jpg "pasos 16 a 21 de la lista de desmontaje" 0
s "$V664" 40   0   "30,5,70,62.2"     cm43c_pasador.jpg  "el pasador de tope con su cadena" 0.5
s "$V664" 78   0   "0,6,100,89"       cm43d_empuje.jpg   "dos operarios empujan el molde al carro"
s "$V666" 45   0   "5,22,78,69.3"     cm44a_carro.jpg    "el carro de cambio de molde con el molde completo" 1
s "$V667" 51   270 "5,18,45,40"       cm44b_montaje.jpg  "boton Montaje Manual y los primeros pasos de la lista"
s "$V667" 150  270 "10,15,80,71.1"    cm44c_empuje.jpg   "el molde nuevo empujado hacia adentro de la maquina"
s "$V663" 120  90  "0,12,80,71.1"     cm44d_agua.jpg     "acoples de agua y ficha electrica del molde inferior"
s "$V667" 51   270 "3,7,86,84"        cm45_base.jpg      "pantalla Cambio Molde, lista de montaje en castellano" 0
echo LISTO
