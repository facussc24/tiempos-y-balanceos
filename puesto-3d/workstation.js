// Puesto de Trabajo - Construcción paramétrica (v14)
// Todas las medidas en milímetros. 1 unidad Three.js = 1 mm.
// SISTEMA DE COORDENADAS:
//   X: largo (lado a lado)
//   Y: alto (vertical)
//   Z: profundidad (zF=-W/2 frente, zB=+W/2 fondo)

import * as THREE from 'three';

// ──────────────────────────────────────────────────────────────
// DIMENSIONES (todas en mm)
// ──────────────────────────────────────────────────────────────
export const D = {
  base: {
    length: 1600,
    depth:  1000,
    tableTop: 900,
    bottomRailY: 150,
  },
  backPost: {
    length: 2050,         // ✅ poste trasero entero (de rueda a tope)
  },
  // Caños horizontales en la pared trasera (entre los postes traseros)
  back: {
    tubeTopFromCima: 230, // ✅ 23 cm desde la cima hasta el primer caño cross
    tubeGap: 370,         // ⏳ distancia entre el 1° y el 2° cross (chapa 330 entre ambos)
  },
  panchaSheet: {
    height: 330,          // ✅ 33 cm
  },
  // Riostra/refuerzo diagonal de la visera (1 a cada lado)
  brace: {
    length: 480,           // ✅ hipotenusa medida por el usuario (48 cm)
    fromCimaDown: 320,     // ✅ 32 cm desde la cima, bajando por el poste trasero
  },
  // Visera HORIZONTAL (techo a 90°)
  canopy: {
    depth:     460,       // ⏳ proyección horizontal del techo hacia el frente
    frontDrop: 0,         // ✅ horizontal — sin caída
  },
  // Chapa techo: en los laterales empieza 40 mm hacia adentro
  topSheet: {
    sideInset: 40,        // ✅ "restale 4cm de cada lateral"
  },
  tube: 40,
  tubeWall: 1.6,        // espesor de pared del caño (mm)
  caster: {
    wheelDia: 75,
    wheelThickness: 30, // espesor de la rueda (mm)
    bracketH: 30,
  },
};

// ──────────────────────────────────────────────────────────────
// MATERIALES (todos gris — sin tinte naranja)
// ──────────────────────────────────────────────────────────────
export const MAT = {
  tube:    new THREE.MeshStandardMaterial({ color: 0xb4bac1, metalness: 0.25, roughness: 0.55 }),
  highlight: new THREE.MeshStandardMaterial({ color: 0xe5392b, metalness: 0.2, roughness: 0.4, emissive: 0x551111, emissiveIntensity: 0.3 }),
  sheet:   new THREE.MeshStandardMaterial({ color: 0xc6ccd2, metalness: 0.15, roughness: 0.7 }),
  table:   new THREE.MeshStandardMaterial({ color: 0xd9dde0, metalness: 0.55, roughness: 0.35 }),
  rubber:  new THREE.MeshStandardMaterial({ color: 0x6a1a22, metalness: 0.1,  roughness: 0.8 }),
  metal:   new THREE.MeshStandardMaterial({ color: 0x8a9098, metalness: 0.7,  roughness: 0.4 }),
  light:   new THREE.MeshStandardMaterial({ color: 0xfff7d0, emissive: 0xfff0b0, emissiveIntensity: 0.6 }),
};

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────
let _idCounter = 0;
function nextId(prefix = 'p') {
  return `${prefix}-${++_idCounter}`;
}

export function tube(length, axis = 'x', label = '', opts = {}) {
  const t = D.tube;
  let geo;
  if (axis === 'x') geo = new THREE.BoxGeometry(length, t, t);
  else if (axis === 'y') geo = new THREE.BoxGeometry(t, length, t);
  else geo = new THREE.BoxGeometry(t, t, length);
  // Cada tubo tiene su PROPIO material (clonado), así el highlight no afecta a otros
  const m = new THREE.Mesh(geo, MAT.tube.clone());
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData = {
    kind: 'tube',
    label: label || `pieza ${++_idCounter}`,
    length,
    axis,
    section: `${t}×${t}`,
    group: opts.group || 'estructura',
    pieceId: opts.pieceId || nextId('t'),
    confirmed: opts.confirmed !== false,
  };
  return m;
}

function sheet(w, h, d, material = MAT.sheet, label = 'chapa', extras = {}) {
  const g = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(g, material);
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData = { kind: 'sheet', label, width: w, height: h, depth: d, ...extras };
  return m;
}

// Chapa inclinada (para la visera)
function inclinedSheet(w, length, thickness, material, label, extras = {}) {
  const g = new THREE.BoxGeometry(w, thickness, length);
  const m = new THREE.Mesh(g, material);
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData = { kind: 'sheet', label, width: w, length, thickness, ...extras };
  return m;
}

// ──────────────────────────────────────────────────────────────
// MITER TUBE — caño con cortes a inglete en los extremos
// Encastra flush contra superficies de otros caños.
// p_lower / p_upper: Vector3 con los puntos donde se corta el CENTERLINE
// cutPlanes: { lower: {axis, value}, upper: {axis, value} } — los planos de corte
// ──────────────────────────────────────────────────────────────
function makeMiterTube(p_lower, p_upper, cutPlanes, halfCross, material, userData) {
  const ax = new THREE.Vector3().subVectors(p_upper, p_lower);
  const ax_n = ax.clone().normalize();
  const ux = new THREE.Vector3(1, 0, 0);
  // perpendicular dentro del plano YZ (asume el caño está en YZ)
  const uperp = new THREE.Vector3().crossVectors(ux, ax_n).normalize();

  // 4 aristas largas, cada una desplazada del centerline
  const offsets = [
    [+halfCross, +halfCross],
    [-halfCross, +halfCross],
    [-halfCross, -halfCross],
    [+halfCross, -halfCross],
  ];
  const edgeLines = offsets.map(([offX, offP]) => {
    const o = new THREE.Vector3()
      .addScaledVector(ux, offX)
      .addScaledVector(uperp, offP);
    return { point: p_lower.clone().add(o), dir: ax_n };
  });

  // intersección línea↔plano cardinal
  const intersect = (line, plane) => {
    const comp = plane.axis;
    const t = (plane.value - line.point[comp]) / line.dir[comp];
    return line.point.clone().addScaledVector(line.dir, t);
  };
  const lowerVerts = edgeLines.map(e => intersect(e, cutPlanes.lower));
  const upperVerts = edgeLines.map(e => intersect(e, cutPlanes.upper));

  // construir geometría
  const positions = [];
  const pushTri = (a, b, c) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  const pushQuad = (a, b, c, d) => { pushTri(a, b, c); pushTri(a, c, d); };

  // cara inferior (corte)
  pushQuad(lowerVerts[3], lowerVerts[2], lowerVerts[1], lowerVerts[0]);
  // cara superior (corte)
  pushQuad(upperVerts[0], upperVerts[1], upperVerts[2], upperVerts[3]);
  // 4 caras largas
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    pushQuad(lowerVerts[i], lowerVerts[j], upperVerts[j], upperVerts[i]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();

  const mat = material.clone();
  mat.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = userData;
  // guardamos endpoints para que el despiece pueda re-orientar la geometría
  mesh.userData.p_lower = p_lower.clone();
  mesh.userData.p_upper = p_upper.clone();
  return mesh;
}

export function caster(label = 'Rueda ø75') {
  const g = new THREE.Group();
  const br = new THREE.Mesh(new THREE.BoxGeometry(70, 30, 70), MAT.metal);
  br.position.y = D.caster.wheelDia + 15;
  g.add(br);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(80, 6, 80), MAT.metal);
  plate.position.y = D.caster.wheelDia + 33;
  g.add(plate);
  const wheel = new THREE.Mesh(
    new THREE.CylinderGeometry(D.caster.wheelDia/2, D.caster.wheelDia/2, 32, 24),
    MAT.rubber
  );
  wheel.rotation.x = Math.PI / 2;
  wheel.position.y = D.caster.wheelDia / 2;
  g.add(wheel);
  const brake = new THREE.Mesh(
    new THREE.BoxGeometry(28, 14, 8),
    new THREE.MeshStandardMaterial({ color: 0xe55a1e, roughness: 0.6 })
  );
  brake.position.set(20, 26, 30);
  g.add(brake);
  g.userData = { kind: 'caster', label, dia: D.caster.wheelDia, pieceId: nextId('w') };
  return g;
}

// ──────────────────────────────────────────────────────────────
// BUILD — puesto completo
// ──────────────────────────────────────────────────────────────
export function buildWorkstation() {
  _idCounter = 0; // reset para que los pieceIds sean estables entre llamadas
  const root = new THREE.Group();
  root.name = 'puesto';

  const { length: L, depth: W, tableTop: H, bottomRailY: B } = D.base;
  const T = D.tube;

  const casterH = D.caster.wheelDia + D.caster.bracketH;   // 105
  const legBottom = casterH;
  const frontLegLen = (H - T) - legBottom;                 // ~755
  const backPostLen = D.backPost.length;                    // 2050
  const backTopY = legBottom + backPostLen;                 // 2155 (tope poste trasero)

  const xL = -L/2 + T/2;
  const xR =  L/2 - T/2;
  const zF = -W/2 + T/2;
  const zB =  W/2 - T/2;

  // dimensiones internas (entre postes / patas)
  const innerX = L - 2*T;   // 1520
  const innerZ = W - 2*T;   // 920

  // ──────────────────────────────────────────────────────────────
  // 1) PATAS DELANTERAS — 2 cortas (755 mm)
  // ──────────────────────────────────────────────────────────────
  [
    { x: xL, z: zF, label: 'Pata delantera izquierda', id: 'pata-fl' },
    { x: xR, z: zF, label: 'Pata delantera derecha',    id: 'pata-fr' },
  ].forEach(p => {
    const t = tube(frontLegLen, 'y', p.label, { group: 'base', pieceId: p.id });
    t.position.set(p.x, legBottom + frontLegLen/2, p.z);
    root.add(t);
  });

  // ──────────────────────────────────────────────────────────────
  // 2) POSTES TRASEROS LARGOS — 2 de 2050 mm
  // ──────────────────────────────────────────────────────────────
  [
    { x: xL, z: zB, label: 'Poste trasero izquierdo', id: 'poste-bl' },
    { x: xR, z: zB, label: 'Poste trasero derecho',    id: 'poste-br' },
  ].forEach(p => {
    const t = tube(backPostLen, 'y', p.label, { group: 'estructura', pieceId: p.id });
    t.position.set(p.x, legBottom + backPostLen/2, p.z);
    root.add(t);
  });

  // ──────────────────────────────────────────────────────────────
  // 3) Ruedas
  // ──────────────────────────────────────────────────────────────
  [[xL,zF,'fl'],[xR,zF,'fr'],[xL,zB,'bl'],[xR,zB,'br']].forEach(([x,z,id]) => {
    const c = caster(`Rueda ${id.toUpperCase()}`);
    c.position.set(x, 0, z);
    root.add(c);
  });

  // ──────────────────────────────────────────────────────────────
  // 4) MARCO SUPERIOR DEL CHASSIS — y = H - T/2 = 880
  //    FRENTE: 1600 mm (cubre las esquinas porque las patas terminan en H-T)
  //    FONDO:  1520 mm (los postes traseros llenan las esquinas)
  // ──────────────────────────────────────────────────────────────
  // Larguero superior FRENTE — 1600 mm (corner-to-corner)
  {
    const t = tube(L, 'x', 'Larguero superior frente (1600)', { group: 'base', pieceId: 'larg-sup-f' });
    t.position.set(0, H - T/2, zF);
    root.add(t);
  }
  // Larguero superior FONDO — 1520 mm (entre los postes traseros)
  {
    const t = tube(innerX, 'x', 'Larguero superior fondo', { group: 'base', pieceId: 'larg-sup-b' });
    t.position.set(0, H - T/2, zB);
    root.add(t);
  }
  [
    { x: xL, label: 'Travesaño superior izquierdo', id: 'trav-sup-l' },
    { x: xR, label: 'Travesaño superior derecho',   id: 'trav-sup-r' },
  ].forEach(p => {
    const t = tube(innerZ, 'z', p.label, { group: 'base', pieceId: p.id });
    t.position.set(p.x, H - T/2, 0);
    root.add(t);
  });

  // ──────────────────────────────────────────────────────────────
  // 5) MARCO INFERIOR DEL CHASSIS — y = B + T/2 = 170
  // ──────────────────────────────────────────────────────────────
  [
    { z: zF, label: 'Larguero inferior frente', id: 'larg-inf-f' },
    { z: zB, label: 'Larguero inferior fondo',  id: 'larg-inf-b' },
  ].forEach(p => {
    const t = tube(innerX, 'x', p.label, { group: 'base', pieceId: p.id });
    t.position.set(0, B + T/2, p.z);
    root.add(t);
  });
  [
    { x: xL, label: 'Travesaño inferior izquierdo', id: 'trav-inf-l' },
    { x: xR, label: 'Travesaño inferior derecho',   id: 'trav-inf-r' },
  ].forEach(p => {
    const t = tube(innerZ, 'z', p.label, { group: 'base', pieceId: p.id });
    t.position.set(p.x, B + T/2, 0);
    root.add(t);
  });

  // ──────────────────────────────────────────────────────────────
  // 6) MESADA (chapa aluminio)
  // ──────────────────────────────────────────────────────────────
  const top = sheet(L + 20, 20, W + 20, MAT.table, 'Mesada aluminio',
                    { width: L, height: 20, depth: W, sheetKind: 'mesada' });
  top.position.set(0, H + 10, 0);
  root.add(top);

  // ──────────────────────────────────────────────────────────────
  // 7) ESTRUCTURA TRASERA / PANCHA — 3 caños horizontales en zB
  //    - Tube 0: larguero superior visera — AHORA en el nivel del brazo (y=2175)
  //    - Tube 1: 1° cross (-230 desde la cima de la pancha = 2155)
  //    - Tube 2: 2° cross (la chapa de 330 mm va entre 1 y 2)
  // ──────────────────────────────────────────────────────────────
  const cimaY = backTopY;                              // 2155 (top del poste trasero)
  const viseraY = cimaY + T/2;                         // 2175 (centro de brazos+largueros visera; sentados encima del poste)
  const tube0Y = viseraY;                              // larguero superior visera (nivel brazo)
  const tube1TopY = cimaY - D.back.tubeTopFromCima;    // 2155-230 = 1925 (top de cross-1 medido desde la junta brazo/poste)
  const tube1Y    = tube1TopY - T/2;                   // 1905
  const tube2TopY = tube1TopY - T - D.panchaSheet.height; // 1925 - 40 - 330 = 1555
  const tube2Y    = tube2TopY - T/2;                   // 1535

  [
    { y: tube0Y, label: 'Larguero superior visera (nivel brazo)', id: 'visera-top' },
    { y: tube1Y, label: '1° cross pancha (-230 desde cima)',     id: 'cross-1' },
    { y: tube2Y, label: '2° cross pancha (chapa 330 entre 1 y 2)', id: 'cross-2' },
  ].forEach(p => {
    const t = tube(innerX, 'x', p.label, { group: 'pancha', pieceId: p.id });
    t.position.set(0, p.y, zB);
    root.add(t);
  });

  // ──────────────────────────────────────────────────────────────
  // 8) CHAPA PANCHA — la "chapita chiquita"
  //    1520 × 330 entre Tube 1 y Tube 2
  // ──────────────────────────────────────────────────────────────
  const panchaY = (tube1Y - T/2 + tube2Y + T/2) / 2;   // centro vertical
  const panchaActualH = (tube1Y - T/2) - (tube2Y + T/2); // distancia entre bordes internos
  // panchaActualH = 1885 - 1555 = 330 ✓
  const panchaSheetMesh = sheet(innerX, panchaActualH, 3, MAT.sheet,
                                `Chapa pancha (${innerX} × ${Math.round(panchaActualH)} mm)`,
                                { width: innerX, height: panchaActualH, depth: 3, sheetKind: 'pancha', pieceId: 'chapa-pancha' });
  panchaSheetMesh.position.set(0, panchaY, zB + T/2 + 1.5);
  root.add(panchaSheetMesh);

  // ──────────────────────────────────────────────────────────────
  // 9) VISERA — brazos laterales DOMINANTES al tope (apoyados sobre los postes traseros)
  //    Brazos en Y = viseraY = cimaY + T/2 = 2175 (sentados sobre los postes de 2050)
  //    Brazos van desde el fondo (cara trasera del poste) hasta el frente del techo → length 500
  //    Largueros superior visera + frontal visera al mismo Y, butt-joinean en los brazos
  // ──────────────────────────────────────────────────────────────
  const visBackY  = viseraY;                           // 2175
  const visFrontY = visBackY;                          // horizontal (sin caída)
  const visFrontZ = zB - D.canopy.depth;               // proyección del voladizo hacia adelante
  // brazos voladizos: dominantes — cubren desde la cara TRASERA del poste (zB + T/2)
  // hasta la cara del larguero frontal visera. Length = (zB + T/2) - (visFrontZ - T/2) = D.canopy.depth + T
  const brazoLen = D.canopy.depth + T;                 // 460 + 40 = 500
  const brazoCenterZ = (zB + T/2 + visFrontZ - T/2) / 2;
  [
    { x: xL, label: 'Brazo lateral visera izq (DOM)', id: 'diag-l' },
    { x: xR, label: 'Brazo lateral visera der (DOM)', id: 'diag-r' },
  ].forEach(p => {
    const t = tube(brazoLen, 'z', p.label, { group: 'visera', pieceId: p.id });
    t.position.set(p.x, visBackY, brazoCenterZ);
    root.add(t);
  });

  // 9b) larguero frontal visera — al MISMO nivel que los brazos (butt-joinea)
  {
    const t = tube(innerX, 'x', 'Larguero frontal visera', { group: 'visera', pieceId: 'larg-front-vis' });
    t.position.set(0, visFrontY, visFrontZ);
    root.add(t);
  }

  // 9d) RIOSTRA/REFUERZO diagonal de la visera — 1 a cada lado
  //     Hipotenusa 480 mm, cateto vertical 320 (confirmado por el usuario)
  //     Cortes a INGLETE en ambos extremos para encastrar flush:
  //       · extremo inferior → corte vertical en z=460 (cara frontal del poste)
  //       · extremo superior → corte horizontal en y=2155 (cara inferior del brazo)
  {
    const braceLen = D.brace.length;            // 480
    const dy = D.brace.fromCimaDown;            // 320 (vertical)
    const dz = Math.sqrt(braceLen*braceLen - dy*dy); // ≈ 357.77 (horizontal proyección)
    const postFrontZ = zB - T/2;                // 460 — cara frontal del poste trasero
    const brazoBottomY = cimaY;                 // 2155 — cara inferior del brazo (top del poste)
    const lowerY = brazoBottomY - dy;           // 1835
    const upperZ = postFrontZ - dz;             // ≈ 102.23

    const cutPlanes = {
      lower: { axis: 'z', value: postFrontZ },
      upper: { axis: 'y', value: brazoBottomY },
    };

    [
      { x: xL, label: 'Riostra refuerzo visera izq (inglete)', id: 'riostra-l' },
      { x: xR, label: 'Riostra refuerzo visera der (inglete)', id: 'riostra-r' },
    ].forEach(p => {
      const p_lower = new THREE.Vector3(p.x, lowerY, postFrontZ);
      const p_upper = new THREE.Vector3(p.x, brazoBottomY, upperZ);
      const angleDeg = Math.round(Math.atan2(dy, dz) * 180 / Math.PI);  // ≈42° desde horizontal
      const mesh = makeMiterTube(p_lower, p_upper, cutPlanes, T/2, MAT.tube, {
        kind: 'tube',
        label: p.label,
        length: braceLen,
        axis: 'oblique',
        angleDeg,
        section: `${T}×${T}`,
        group: 'visera',
        pieceId: p.id,
      });
      root.add(mesh);
    });
  }

  // 9c) CHAPA TECHO — ahora 1520 × brazoLen, sentada arriba de los brazos
  const techoW = L - 2 * D.topSheet.sideInset;
  {
    const techo = inclinedSheet(
      techoW,
      brazoLen,                     // largo coincide con el brazo (500)
      3,
      MAT.sheet,
      `Chapa techo (${techoW} × ${brazoLen} mm)`,
      { width: techoW, length: brazoLen, sheetKind: 'techo', pieceId: 'chapa-techo' }
    );
    techo.position.set(0, visBackY + T/2 + 1.5, brazoCenterZ);
    root.add(techo);
  }

  // ──────────────────────────────────────────────────────────────
  // 10) tubo fluorescente bajo la visera
  // ──────────────────────────────────────────────────────────────
  {
    const fluo = new THREE.Mesh(
      new THREE.CylinderGeometry(15, 15, 1200, 16),
      MAT.light
    );
    fluo.rotation.z = Math.PI/2;
    fluo.position.set(0, visBackY - 60, brazoCenterZ);
    root.add(fluo);
    const pl = new THREE.PointLight(0xfff2c8, 0.5, 3000);
    pl.position.copy(fluo.position);
    pl.position.y -= 40;
    root.add(pl);
  }

  // ──────────────────────────────────────────────────────────────
  // 11) (placeholder ventilador removido — confunde visualmente)
  // ──────────────────────────────────────────────────────────────

  root.userData = { kind: 'puesto', dims: D };
  return root;
}

// ──────────────────────────────────────────────────────────────
// BOM — simplificada: una sola lista con largo, sección, ángulo y cantidad
// ──────────────────────────────────────────────────────────────
export function buildBOM(workstation) {
  const tubes = [];
  const casters = [];
  const sheets = [];
  workstation.traverse(o => {
    if (o.userData?.kind === 'tube')   tubes.push(o);
    if (o.userData?.kind === 'caster') casters.push(o);
    // Excluimos la mesada de aluminio: la compra el cliente, NO va en el BOM.
    // Sigue renderizandose en el 3D como referencia visual.
    if (o.userData?.kind === 'sheet' && o.userData.sheetKind && o.userData.sheetKind !== 'mesada') sheets.push(o);
  });

  // agrupar por (largo + ángulo) para distinguir caños rectos vs con inglete
  const byKey = new Map();
  tubes.forEach(t => {
    const L = Math.round(t.userData.length);
    const ang = t.userData.angleDeg || 0;
    const key = `${L}|${ang}`;
    if (!byKey.has(key)) byKey.set(key, { length: L, angleDeg: ang, count: 0, pieceIds: [] });
    const g = byKey.get(key);
    g.count++;
    g.pieceIds.push(t.userData.pieceId);
  });

  const rows = [...byKey.values()].sort((a,b) => b.length - a.length);
  const totalLen = rows.reduce((s,r) => s + r.length * r.count, 0);
  return {
    rows,
    totalPieces: tubes.length,
    totalLen,
    casters: casters.length,
    sheets,
    tubeWall: D.tubeWall,
    tubeSection: D.tube,
    casterDia: D.caster.wheelDia,
    casterThickness: D.caster.wheelThickness,
  };
}

// ──────────────────────────────────────────────────────────────
// DESPIECE
// ──────────────────────────────────────────────────────────────
export function buildExploded() {
  const root = new THREE.Group();
  root.name = 'despiece';

  const w = buildWorkstation();
  const tubes = [];
  w.traverse(o => { if (o.userData?.kind === 'tube') tubes.push(o); });

  const byLen = new Map();
  tubes.forEach(t => {
    const k = Math.round(t.userData.length);
    if (!byLen.has(k)) byLen.set(k, []);
    byLen.get(k).push(t);
  });

  const sorted = [...byLen.keys()].sort((a,b) => b - a);
  const T = D.tube;
  const tubeGap = 12;
  const rowGap = 60;

  let zCursor = 0;
  const rowsMeta = [];
  sorted.forEach((L, rowIdx) => {
    const group = byLen.get(L);
    group.forEach((src, i) => {
      let t;
      if (src.userData.axis === 'oblique' && src.userData.p_lower && src.userData.p_upper) {
        // RIOSTRA: clonamos la geometría real (con sus cortes a inglete)
        // y la transformamos para acostarla horizontal en el despiece.
        const geo = src.geometry.clone();
        const p_lower = src.userData.p_lower;
        const p_upper = src.userData.p_upper;
        const center = new THREE.Vector3().addVectors(p_lower, p_upper).multiplyScalar(0.5);
        const dir = new THREE.Vector3().subVectors(p_upper, p_lower).normalize();
        // 1) centrar la geometría en el origen
        geo.translate(-center.x, -center.y, -center.z);
        // 2) rotar para que el eje del caño quede a lo largo de +X
        const quat = new THREE.Quaternion().setFromUnitVectors(dir, new THREE.Vector3(1, 0, 0));
        geo.applyQuaternion(quat);
        // material y mesh
        const mat = MAT.tube.clone();
        mat.side = THREE.DoubleSide;
        t = new THREE.Mesh(geo, mat);
        t.castShadow = true;
        t.receiveShadow = true;
        t.userData = {
          kind: 'tube',
          label: src.userData.label,
          length: src.userData.length,
          axis: 'oblique',
          section: src.userData.section,
          group: src.userData.group,
          pieceId: src.userData.pieceId,
        };
        t.position.set(0, T/2, zCursor + i * (T + tubeGap));
      } else {
        // caño recto normal
        t = tube(L, 'x', src.userData.label, {
          group: src.userData.group,
          pieceId: src.userData.pieceId,
        });
        t.position.set(0, T/2, zCursor + i * (T + tubeGap));
      }
      root.add(t);
    });
    const rowDepth = group.length * (T + tubeGap);
    rowsMeta.push({
      kind: 'tube',
      length: L,
      count: group.length,
      label: `${L} mm × ${group.length}`,
      z: zCursor + (rowDepth - (T+tubeGap))/2,
    });
    zCursor += rowDepth + rowGap;
  });

  // ── CHAPAS (pancha + techo) — recostadas sobre el piso del despiece
  zCursor += 80;
  const panchaW = D.base.length - 2 * D.tube;        // 1520
  const panchaH = D.panchaSheet.height;              // 330
  const techoW  = D.base.length - 2 * D.topSheet.sideInset; // 1520
  const techoL  = Math.hypot(D.canopy.depth, D.canopy.frontDrop) || D.canopy.depth;

  // chapa pancha (1520 × 330)
  {
    const g = new THREE.BoxGeometry(panchaW, 3, panchaH);
    const m = new THREE.Mesh(g, MAT.sheet);
    m.castShadow = true; m.receiveShadow = true;
    m.position.set(0, 2, zCursor + panchaH/2);
    m.userData = { kind: 'sheet', label: `Chapa pancha (${panchaW} × ${panchaH} mm)`, pieceId: 'chapa-pancha' };
    root.add(m);
    rowsMeta.push({
      kind: 'sheet',
      length: panchaW,
      width: panchaH,
      count: 1,
      label: `Chapa pancha · ${panchaW} × ${panchaH} mm`,
      z: zCursor + panchaH/2,
    });
    zCursor += panchaH + 90;
  }

  // chapa techo (1520 × largo del brazo = 500)
  {
    const techoLForExpl = D.canopy.depth + D.tube;
    const g = new THREE.BoxGeometry(techoW, 3, techoLForExpl);
    const m = new THREE.Mesh(g, MAT.sheet);
    m.castShadow = true; m.receiveShadow = true;
    m.position.set(0, 2, zCursor + techoLForExpl/2);
    m.userData = { kind: 'sheet', label: `Chapa techo (${techoW} × ${techoLForExpl} mm)`, pieceId: 'chapa-techo' };
    root.add(m);
    rowsMeta.push({
      kind: 'sheet',
      length: techoW,
      width: techoLForExpl,
      count: 1,
      label: `Chapa techo · ${techoW} × ${techoLForExpl} mm`,
      z: zCursor + techoLForExpl/2,
    });
    zCursor += techoLForExpl + 90;
  }

  // ruedas al final
  zCursor += 30;
  for (let i = 0; i < 4; i++) {
    const c = caster(`Rueda ${['FL','FR','BL','BR'][i]}`);
    c.position.set(-300 + i * 200, 0, zCursor);
    root.add(c);
  }
  rowsMeta.push({
    kind: 'caster',
    length: D.caster.wheelDia,
    count: 4,
    label: `Rueda ø${D.caster.wheelDia} c/freno × 4`,
    z: zCursor,
  });

  root.userData.rowsMeta = rowsMeta;
  return root;
}
