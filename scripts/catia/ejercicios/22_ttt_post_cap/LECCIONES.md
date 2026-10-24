# Lecciones del ejercicio 22 (Too Tall Toby PPP01-02 Post Cap) — CATA, 24/10/2026

Corrida real: CATIA R21 (B21, 32 bits) de CATA con el Python 3.12.10 del sistema, `%TEMP%\catia_cata_tanda\22_r1`,
10:19:59 a 10:20:27. **Verde al primer intento**: 8 pasos sin falla, 28,5 s. Después del revisor se volvió a correr con el código
que se sube (`22_final`, 10:52): los mismos números. Volumen 42 248,444 mm³ (el mismo que el ej30
de la práctica en la PC principal), masa de CATIA 43,093 g contra 43,09 de la guía; antes del R1 del asa, 42 225,749
contra el gemelo de build123d 42 225,726 (0,023 mm³); el STEP medido con build123d da 42 248,593 (0,149 mm³ más).

Para la centralización (LECCIONES_CATIA.md / catia.md):

1. **El catálogo de materiales de la B21 de CATA no trae ABS**: la masa sale de CATIA igual, con Steel y su `Density`
   pasada a 1 020 kg/m³ (densidad implícita 1 019,99); salida.json lo dice (`sin_preferido`). El material sigue
   LLAMÁNDOSE Steel en el árbol: si la pieza se entrega, renombrarlo o decirlo (ya estaba en catia.md para el PLA).
2. **Un gemelo que no tiene un detalle se cruza ANTES de ese detalle**: el gemelo de la práctica no lleva el R1 del asa;
   la copia del ej30 guarda el volumen de CATIA justo antes del R1 (`ctx["vol_sin_r1"]`) y el juez compara ese contra el
   gemelo, y el final contra la guía.
3. Mismo molde que el 18: la pieza del 19/10 copiada con cambios mínimos anotados (`pieza_ej30.py`, armada por script) y
   el contrato del banco en un `catia.py` aparte.
- **El centro antes del R1 (pedido 10 de la principal, `22_p10`, 24/10 13:39)**: el gemelo no tiene los R1 del asa, así
  que su centro (−0,7344 · 0 · 28,451) se compara con el que mide CATIA ANTES del R1 (−0,734 · 0 · 28,451: 0,0004 mm). Con
  los R1 el centro de CATIA se corre a −0,747: 0,013 mm, más que TOL_CDG; comparar contra la pieza terminada habría dado
  rojo con la pieza bien. La pieza anota `cdg_sin_r1` (cambio 4 de la copia). El STEP: 1 sólido, centro a 0,0005 mm.
