# -*- coding: utf-8 -*-
"""BBox rapido por solido de un STEP (sin mallar)."""
import sys
import gmsh

for path in sys.argv[1:]:
    gmsh.initialize()
    gmsh.option.setNumber("General.Terminal", 0)
    gmsh.model.add("m")
    try:
        gmsh.model.occ.importShapes(path)
        gmsh.model.occ.synchronize()
        vols = gmsh.model.getEntities(3)
        surfs = gmsh.model.getEntities(2)
        curves_free = [e for e in gmsh.model.getEntities(1)]
        bb = gmsh.model.getBoundingBox(-1, -1)
        print(f"\n=== {path}")
        print(f"solidos={len(vols)} superficies={len(surfs)} curvas={len(curves_free)}")
        print(f"BBOX: X[{bb[0]:.1f},{bb[3]:.1f}] Y[{bb[1]:.1f},{bb[4]:.1f}] Z[{bb[2]:.1f},{bb[5]:.1f}]  dims {bb[3]-bb[0]:.1f} x {bb[4]-bb[1]:.1f} x {bb[5]-bb[2]:.1f}")
        for dim, tag in vols[:12]:
            b = gmsh.model.getBoundingBox(dim, tag)
            name = gmsh.model.getEntityName(dim, tag)
            print(f"  vol {tag} '{name}': X[{b[0]:.1f},{b[3]:.1f}] Y[{b[1]:.1f},{b[4]:.1f}] Z[{b[2]:.1f},{b[5]:.1f}]  dims {b[3]-b[0]:.1f}x{b[4]-b[1]:.1f}x{b[5]-b[2]:.1f}")
        if len(vols) > 12:
            print(f"  ... y {len(vols)-12} mas")
    except Exception as e:
        print(f"ERROR {path}: {e}")
    gmsh.finalize()
