#!/bin/bash
# gate.sh — espera hasta 6 minutos a que la PC tenga >= 3 GB de RAM libre y >= 3 GB de disco C libre antes de lanzar un Chromium.
# Sale 0 si hay recursos, 1 si no los hubo (en ese caso NO se lanza nada). Regla de Fak: no arrancar con menos de 3 GB libres.
for i in $(seq 1 36); do
  r=$(powershell -NoProfile -Command "[math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1MB,2)" | tr -d '\r' | tr ',' '.')
  d=$(powershell -NoProfile -Command "[math]::Round((Get-PSDrive C).Free/1GB,2)" | tr -d '\r' | tr ',' '.')
  n=$(tasklist 2>/dev/null | grep -ci "chrome\|headless_shell" )
  if awk "BEGIN{exit !($r>=3 && $d>=3)}"; then echo "gate OK ram=${r}GB disco=${d}GB chromium_abiertos=${n}"; exit 0; fi
  sleep 10
done
echo "gate NO: ram=${r}GB disco=${d}GB"; exit 1
