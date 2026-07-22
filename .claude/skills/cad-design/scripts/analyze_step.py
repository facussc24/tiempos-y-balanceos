# -*- coding: utf-8 -*-
"""Analiza un STEP: solidos, bounding boxes, volumenes, caras planas con normal/angulo."""
import sys, math
import gmsh

path = sys.argv[1]

gmsh.initialize()
gmsh.option.setNumber("General.Terminal", 0)
gmsh.model.add("m")
gmsh.model.occ.importShapes(path)
gmsh.model.occ.synchronize()

vols = gmsh.model.getEntities(3)
surfs = gmsh.model.getEntities(2)
print(f"ARCHIVO: {path}")
print(f"Solidos: {len(vols)} | Superficies: {len(surfs)}")

xmin, ymin, zmin, xmax, ymax, zmax = gmsh.model.getBoundingBox(-1, -1)
print(f"BBOX TOTAL: X[{xmin:.2f},{xmax:.2f}] Y[{ymin:.2f},{ymax:.2f}] Z[{zmin:.2f},{zmax:.2f}]")
print(f"  dims: {xmax-xmin:.2f} x {ymax-ymin:.2f} x {zmax-zmin:.2f} mm")

for dim, tag in vols:
    bb = gmsh.model.getBoundingBox(dim, tag)
    mass = gmsh.model.occ.getMass(dim, tag)
    com = gmsh.model.occ.getCenterOfMass(dim, tag)
    name = gmsh.model.getEntityName(dim, tag)
    print(f"\nSOLIDO tag={tag} name='{name}'")
    print(f"  bbox: X[{bb[0]:.2f},{bb[3]:.2f}] Y[{bb[1]:.2f},{bb[4]:.2f}] Z[{bb[2]:.2f},{bb[5]:.2f}]")
    print(f"  dims: {bb[3]-bb[0]:.2f} x {bb[4]-bb[1]:.2f} x {bb[5]-bb[2]:.2f} mm")
    print(f"  volumen: {mass/1000:.2f} cm3 | centro masa: ({com[0]:.1f}, {com[1]:.1f}, {com[2]:.1f})")
    # caras planas del solido
    _, sdown = gmsh.model.getAdjacencies(dim, tag)
    planes = []
    for st in sdown:
        stype = gmsh.model.getType(2, st)
        area = gmsh.model.occ.getMass(2, st)
        if stype == "Plane":
            try:
                ubs = gmsh.model.getParametrizationBounds(2, st)
                u = (ubs[0][0] + ubs[1][0]) / 2
                v = (ubs[0][1] + ubs[1][1]) / 2
                n = gmsh.model.getNormal(st, [u, v])
                # angulo de la normal respecto a +Z
                nz = max(-1.0, min(1.0, n[2]))
                ang = math.degrees(math.acos(nz))
                planes.append((area, st, n, ang))
            except Exception as e:
                planes.append((area, st, None, None))
    planes.sort(reverse=True)
    print(f"  caras planas (top 12 por area):")
    for area, st, n, ang in planes[:12]:
        if n is not None:
            print(f"    surf {st}: area={area:.0f} mm2  normal=({n[0]:+.3f},{n[1]:+.3f},{n[2]:+.3f})  ang_vs_Z={ang:.2f} deg  inclinacion_cara_vs_horizontal={abs(ang if ang<=90 else 180-ang):.2f}")
        else:
            print(f"    surf {st}: area={area:.0f} mm2  (sin normal)")
    # tipos de superficies no planas
    other = {}
    for st in sdown:
        t = gmsh.model.getType(2, st)
        if t != "Plane":
            other[t] = other.get(t, 0) + 1
    if other:
        print(f"  otras superficies: {other}")

gmsh.finalize()
