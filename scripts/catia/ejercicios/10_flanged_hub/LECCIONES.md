# Lecciones del ejercicio 10 (Flanged Hub) — CATA, 24/10/2026

Corridas reales: CATIA R21 (B21, 32 bits) de CATA con el Python 3.12.10 del sistema.
- `10_r1` (09:19): ROJO en el nervio. El volumen dio justo (587,781 mm³) pero el centro de lo agregado salió a 0,34 mm
  de build123d y el control del centro (0,01 mm) lo frenó. Era la MEDICIÓN, no el nervio (lección 1).
- `10_r2` (09:20) y `10_r3` (09:26, con el código que se sube): verdes. 13 pasos sin falla, 34,0 s en total (9,3 s de
  build123d, CATIA conectó a los 18,6 s, 4,6 s de pasos). Volumen 138 144,669 mm³ = build123d (diferencia 0,000), centro
  de gravedad a 0,0005 mm, masa de CATIA 372,991 g contra 372,99 ± 1 de la guía (0,001 g). El STEP que exportó CATIA,
  medido con build123d, da 138 144,678 (0,009 mm³ más que el sólido de CATIA: lo que mueve exportar a STEP una pieza
  con superficies de revolución y cuñas; informativo, el juez compara el sólido).

Para la centralización (LECCIONES_CATIA.md / catia.md), lo nuevo que dejó este ejercicio:

1. **El centro de algo chico agregado a algo grande no se saca de `catia_base.medir`**: `medir` redondea el centro de
   gravedad a 0,001 mm, y el centro de lo agregado sale de restar dos centros: el error llega a
   (v0 + v1) × 0,0005 / dv = 0,38 mm con 588 mm³ sobre 226 000 (medido: 0,11 en x y 0,32 en z). Para ese control se lee
   el centro con todos los decimales (`GetCOG` por VBScript, `medir_fino` del catia.py): con eso el centro del nervio dio
   (22,6181; 0; 30,1705) = build123d en los cuatro decimales. El control de sentido de `juez_comun.extruir` (1 mm) no
   tiene este problema; uno de centésimas sí.
2. **Plano por ecuación (`AddNewPlaneEquation(a, b, c, d)`, plano a·x + b·y + c·z = d) y su croquis**: con la normal
   (−0,7071; 0; 0,7071) y d 5,3033, `GetPlane` dio origen (−3,75; 0; 3,75) = el pie de la perpendicular desde el origen,
   dirección 1 (0,7071; 0; 0,7071) y dirección 2 (0; 1; 0). Proyectando los puntos 3D del trapecio sobre esas dos
   direcciones (desde ese origen) el croquis cayó exacto: la H del croquis es la dirección 1 y la V la 2, también en un
   plano que no es de origen.
3. **Un nervio en CUÑA no sale con Stiffener** (espesor parejo: el ej32 de la práctica dio 373,51 g por eso). Sale como
   prisma: trapecio en un plano normal al filo y pad simétrico, con el patrón circular de CATIA (×3 / 120°) sobre ese pad.
4. **Orden que ahorra los booleanos**: el banco recorta el prisma con una caja (si no, rellena el rebaje). En CATIA se hizo
   el exterior SIN el rebaje, después los nervios, y recién después el Groove del rebaje, que se lleva las partes del
   prisma que caían en el hueco. build123d midió que los dos órdenes dan el mismo sólido (diferencia 7·10⁻⁹ mm³).
5. **Shaft y Groove con el perfil apoyado en el eje y la CenterLine encima** (la recta del croquis de h −5 a 60 en v 0,
   como el ej32, que no tocaba el eje): CATIA toma la CenterLine como eje y no como tramo del perfil, aunque se pise con
   el lado del perfil que va sobre el eje. Los R3 de revolución, como arcos del croquis: el volumen de Pappus (Green sobre
   el perfil, `volumen_revolucion`) dio igual que CATIA y que build123d (225 829,051 el exterior, 74 902,151 el rebaje).
6. **Hole Type 2 (con caja) + patrón ×6** desde la cara de z 8: la cara se eligió por topología del cuerpo (la corona de
   z 8 tiene el centro sobre el eje, una sola candidata). Saca 644,027 cada uno = la cuenta; no hizo falta darlo vuelta.

**24/10, topología del STEP (PEDIDO 32):** el boceto del punto de `AddNewHoleFromPoint` queda visible y el STEP salía con un
vértice suelto en (53,975; 0; 8): 103 vértices con 1 fuera del sólido (topologia_step.py del 54). Se oculta `h.Sketch` con lo
demás antes de exportar: 10_vert (24/10 17:09) verde y 102 vértices, nada suelto.
