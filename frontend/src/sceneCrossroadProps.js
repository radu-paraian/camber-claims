import * as THREE from 'three';

/**
 * Generates an off-white (#e8e6df) procedural texture for a true 4-way '+' crossroad,
 * a T-junction, or a country lane bend on #2a2d33 tarmac.
 */
export function createFourWayJunctionTexture(roadType) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d');

  // Deep matte slate-charcoal tarmac (#2a2d33)
  ctx.fillStyle = '#2a2d33';
  ctx.fillRect(0, 0, 2048, 2048);

  // Subtle asphalt grain
  ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
  for (let i = 0; i < 4000; i += 1) {
    const x = (i * 73) % 2048;
    const y = (i * 137) % 2048;
    ctx.fillRect(x, y, 2, 2);
  }

  const isBend = String(roadType || '').toLowerCase().includes('bend');
  const isTJunction =
    String(roadType || '').toLowerCase().includes('t_junction') &&
    !String(roadType || '').toLowerCase().includes('crossroad');

  const markColor = '#e8e6df';
  ctx.strokeStyle = markColor;
  ctx.fillStyle = markColor;
  ctx.lineCap = 'butt';

  const m2px = 2048 / 120; // 120m world span -> 17.0667 px/m
  const cx = 1024;
  const cy = 1024;
  const halfRoad = 4.2 * m2px; // ~71.7px

  if (isBend) {
    // Sweeping curve markings
    ctx.lineWidth = 5;
    ctx.setLineDash([28, 20]);
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.quadraticCurveTo(cx, cy, cx + 520, cy - 520);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    // East-West priority road edge lines (continuous outside crossroad throat)
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(232, 230, 223, 0.55)';
    // West arm edges
    ctx.beginPath();
    ctx.moveTo(0, cy - halfRoad + 4);
    ctx.lineTo(cx - halfRoad, cy - halfRoad + 4);
    ctx.moveTo(0, cy + halfRoad - 4);
    ctx.lineTo(cx - halfRoad, cy + halfRoad - 4);
    // East arm edges
    ctx.moveTo(cx + halfRoad, cy - halfRoad + 4);
    ctx.lineTo(2048, cy - halfRoad + 4);
    ctx.moveTo(cx + halfRoad, cy + halfRoad - 4);
    ctx.lineTo(2048, cy + halfRoad - 4);
    // South arm edges
    ctx.moveTo(cx - halfRoad + 4, cy + halfRoad);
    ctx.lineTo(cx - halfRoad + 4, 2048);
    ctx.moveTo(cx + halfRoad - 4, cy + halfRoad);
    ctx.lineTo(cx + halfRoad - 4, 2048);
    if (!isTJunction) {
      // North arm edges (true 4-way crossroad)
      ctx.moveTo(cx - halfRoad + 4, 0);
      ctx.lineTo(cx - halfRoad + 4, cy - halfRoad);
      ctx.moveTo(cx + halfRoad - 4, 0);
      ctx.lineTo(cx + halfRoad - 4, cy - halfRoad);
    }
    ctx.stroke();

    // East-West centre hazard lines (Diagram 1004)
    ctx.strokeStyle = markColor;
    ctx.lineWidth = 6;
    ctx.setLineDash([36, 18]);
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(cx - halfRoad - 8, cy);
    ctx.moveTo(cx + halfRoad + 8, cy);
    ctx.lineTo(2048, cy);
    ctx.stroke();

    // North-South centre lines
    ctx.lineWidth = 5;
    ctx.setLineDash([24, 20]);
    ctx.beginPath();
    ctx.moveTo(cx, cy + halfRoad + 14);
    ctx.lineTo(cx, 2048);
    if (!isTJunction) {
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, cy - halfRoad - 14);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // TSRGD Diagram 1003 Double Dashed Give Way Lines across South arm (z = +4.2m -> cy + halfRoad)
    // and North arm (z = -4.2m -> cy - halfRoad)
    ctx.lineWidth = 5;
    ctx.setLineDash([12, 8]);
    // South arm Give Way (across northbound lane x in [-halfRoad, 0] and full mouth)
    ctx.beginPath();
    ctx.moveTo(cx - halfRoad + 4, cy + halfRoad - 2);
    ctx.lineTo(cx + halfRoad - 4, cy + halfRoad - 2);
    ctx.moveTo(cx - halfRoad + 4, cy + halfRoad + 6);
    ctx.lineTo(cx + halfRoad - 4, cy + halfRoad + 6);
    if (!isTJunction) {
      // North arm Give Way (across southbound lane)
      ctx.moveTo(cx - halfRoad + 4, cy - halfRoad - 6);
      ctx.lineTo(cx + halfRoad - 4, cy - halfRoad - 6);
      ctx.moveTo(cx - halfRoad + 4, cy - halfRoad + 2);
      ctx.lineTo(cx + halfRoad - 4, cy - halfRoad + 2);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Give Way Approach Triangle Markings (TSRGD Diagram 1023)
    const drawGiveWayTriangle = (tx, ty, pointUp) => {
      ctx.save();
      ctx.strokeStyle = markColor;
      ctx.lineWidth = 4;
      const w = 16;
      const h = 34;
      ctx.beginPath();
      if (pointUp) {
        ctx.moveTo(tx, ty - h / 2);
        ctx.lineTo(tx - w / 2, ty + h / 2);
        ctx.lineTo(tx + w / 2, ty + h / 2);
      } else {
        ctx.moveTo(tx, ty + h / 2);
        ctx.lineTo(tx - w / 2, ty - h / 2);
        ctx.lineTo(tx + w / 2, ty - h / 2);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    };

    // South arm northbound lane (UK left-hand traffic: x < 0, moving -Z / up on canvas)
    drawGiveWayTriangle(cx - halfRoad * 0.5, cy + halfRoad + 38, false);
    if (!isTJunction) {
      // North arm southbound lane (UK left-hand traffic: x > 0, moving +Z / down on canvas)
      drawGiveWayTriangle(cx + halfRoad * 0.5, cy - halfRoad - 38, true);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds the 4-way '+' crossroad road plane, 4 corner verges, pavements (#383c45),
 * and bevelled granite kerbs (#525866), leaving all 4 road corridors open.
 */
export function buildFourWayRoadEnvironment(sceneInstance, roadType) {
  const group = sceneInstance.environmentGroup;
  const roadTex = createFourWayJunctionTexture(roadType);

  const roadMat = new THREE.MeshStandardMaterial({
    map: roadTex,
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.05,
    emissive: new THREE.Color(0xe8e6df),
    emissiveMap: roadTex,
    emissiveIntensity: 0.08,
  });

  const roadPlane = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), roadMat);
  roadPlane.rotation.x = -Math.PI / 2;
  roadPlane.receiveShadow = true;
  group.add(roadPlane);

  const isBend = String(roadType || '').toLowerCase().includes('bend');
  if (isBend) return;

  const isTJunction =
    String(roadType || '').toLowerCase().includes('t_junction') &&
    !String(roadType || '').toLowerCase().includes('crossroad');

  const vergeMat = new THREE.MeshStandardMaterial({
    color: 0x263829,
    roughness: 0.92,
    metalness: 0.02,
  });
  const pavementMat = new THREE.MeshStandardMaterial({
    color: 0x383c45,
    roughness: 0.85,
    metalness: 0.05,
  });
  const kerbMat = new THREE.MeshStandardMaterial({
    color: 0x525866,
    roughness: 0.75,
    metalness: 0.08,
  });

  // 4 Quadrant corner blocks so North, South, East, West arms (width [-4.2, +4.2]) are open
  const quadrants = [
    { sx: -1, sz: 1, name: 'SW' },
    { sx: 1, sz: 1, name: 'SE' },
    { sx: -1, sz: -1, name: 'NW' },
    { sx: 1, sz: -1, name: 'NE' },
  ];

  if (isTJunction) {
    // Continuous north bank for strict T-junction only
    const northVerge = new THREE.Mesh(new THREE.BoxGeometry(120, 0.14, 52), vergeMat);
    northVerge.position.set(0, 0.07, -30.5);
    northVerge.receiveShadow = true;
    group.add(northVerge);
  }

  for (const q of quadrants) {
    if (isTJunction && q.sz < 0) continue;

    // Grass / verge block outside pavement
    const verge = new THREE.Mesh(new THREE.BoxGeometry(50, 0.14, 50), vergeMat);
    verge.position.set(q.sx * 31.2, 0.07, q.sz * 31.2);
    verge.receiveShadow = true;
    group.add(verge);

    // E-W pavement strip along corridor edge (z = +/- 5.35m)
    const ewPave = new THREE.Mesh(new THREE.BoxGeometry(51.6, 0.15, 2.1), pavementMat);
    ewPave.position.set(q.sx * 30.0, 0.075, q.sz * 5.25);
    ewPave.receiveShadow = true;
    group.add(ewPave);

    // N-S pavement strip along corridor edge (x = +/- 5.25m)
    const nsPave = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.15, 51.6), pavementMat);
    nsPave.position.set(q.sx * 5.25, 0.075, q.sz * 30.0);
    nsPave.receiveShadow = true;
    group.add(nsPave);

    // Bevelled granite kerbs along E-W and N-S edges
    const ewKerb = new THREE.Mesh(new THREE.BoxGeometry(51.6, 0.17, 0.22), kerbMat);
    ewKerb.position.set(q.sx * 30.0, 0.085, q.sz * 4.25);
    ewKerb.castShadow = true;
    ewKerb.receiveShadow = true;
    group.add(ewKerb);

    const nsKerb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.17, 51.6), kerbMat);
    nsKerb.position.set(q.sx * 4.25, 0.085, q.sz * 30.0);
    nsKerb.castShadow = true;
    nsKerb.receiveShadow = true;
    group.add(nsKerb);
  }
}

function createCircularSignTexture(topText, isSpeed30 = true) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.beginPath();
  ctx.arc(128, 128, 116, 0, Math.PI * 2);
  ctx.fillStyle = '#f8fafc';
  ctx.fill();
  ctx.lineWidth = 22;
  ctx.strokeStyle = '#dc2626';
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = isSpeed30 ? 'bold 112px Inter, Arial, sans-serif' : 'bold 54px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(topText || '30', 128, 132);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createGiveWayTriangleTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);

  // Inverted triangle (apex down)
  ctx.beginPath();
  ctx.moveTo(20, 28);
  ctx.lineTo(236, 28);
  ctx.lineTo(128, 232);
  ctx.closePath();
  ctx.fillStyle = '#f8fafc';
  ctx.fill();
  ctx.lineWidth = 22;
  ctx.strokeStyle = '#dc2626';
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 34px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GIVE', 128, 86);
  ctx.fillText('WAY', 128, 124);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Reconstructs the exact Cheadle / Tean Rd Ring CCTV crossroad props:
 * - Foreground-Left (SW corner): pitched bay-window house roof, red-brown brick garden wall
 *   with stone coping & piers, gravel bed with 3 wheelie bins (blue/brown/black lids),
 *   and the foreground-left stacked GIVE WAY + 30 signpost.
 * - Opposite-Right (NE corner, x = +3.8m, z = -3.6m): knockable telegraph pole & 30/warning
 *   signpost struck by VL19 OKP, gravel pull-in apron, trimmed green hedgerow, post-and-rail
 *   fence, and 'FOR SALE' estate agent board.
 * - Opposite-Left (NW corner): dense hedgerow + foliage trees restricting sightline + street lamps.
 */
export function buildRingCctvJunctionProps(sceneInstance) {
  const group = sceneInstance.causalPropsGroup;
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.45,
    metalness: 0.65,
  });

  // 1. FOREGROUND-LEFT (SW CORNER) STACKED GIVE WAY + 30 SIGNPOST (x = -3.6m, z = +4.8m)
  const swSignGroup = new THREE.Group();
  swSignGroup.position.set(-3.6, 0, 4.8);
  const swPost = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 3.1, 12), postMat);
  swPost.position.y = 1.55;
  swPost.castShadow = true;
  swSignGroup.add(swPost);

  const giveWayTex = createGiveWayTriangleTexture();
  const giveWayMat = new THREE.MeshStandardMaterial({
    map: giveWayTex,
    transparent: true,
    alphaTest: 0.1,
    roughness: 0.35,
    side: THREE.DoubleSide,
  });
  const giveWayPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.82), giveWayMat);
  giveWayPlate.position.set(0, 2.75, 0.07);
  swSignGroup.add(giveWayPlate);

  const speed30Tex = createCircularSignTexture('30', true);
  const speed30Mat = new THREE.MeshStandardMaterial({
    map: speed30Tex,
    transparent: true,
    alphaTest: 0.1,
    roughness: 0.35,
    side: THREE.DoubleSide,
  });
  const speed30Plate = new THREE.Mesh(new THREE.CircleGeometry(0.36, 28), speed30Mat);
  speed30Plate.position.set(0, 1.98, 0.07);
  swSignGroup.add(speed30Plate);
  group.add(swSignGroup);

  // 2. FOREGROUND-LEFT (SW CORNER) RED-BROWN BRICK GARDEN WALL, COPING, GRAVEL, 3 WHEELIE BINS & BAY ROOF
  const swHouseGroup = new THREE.Group();
  const brickMat = new THREE.MeshStandardMaterial({ color: 0x7c3f34, roughness: 0.88 });
  const stoneCopingMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.7 });
  const roofSlateMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.78 });
  const houseRenderMat = new THREE.MeshStandardMaterial({ color: 0xd6d3cd, roughness: 0.85 });

  // Boundary brick wall running along x = -6.8 .. -14.5, z = +5.6 .. +11.5
  const wallNorth = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.95, 0.28), brickMat);
  wallNorth.position.set(-10.2, 0.48, 5.65);
  wallNorth.castShadow = true;
  wallNorth.receiveShadow = true;
  swHouseGroup.add(wallNorth);

  const copingNorth = new THREE.Mesh(new THREE.BoxGeometry(7.7, 0.08, 0.34), stoneCopingMat);
  copingNorth.position.set(-10.2, 0.99, 5.65);
  swHouseGroup.add(copingNorth);

  const wallEast = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.95, 5.6), brickMat);
  wallEast.position.set(-6.45, 0.48, 8.4);
  wallEast.castShadow = true;
  swHouseGroup.add(wallEast);

  const copingEast = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 5.7), stoneCopingMat);
  copingEast.position.set(-6.45, 0.99, 8.4);
  swHouseGroup.add(copingEast);

  // Corner brick pier with stone cap
  const pier = new THREE.Mesh(new THREE.BoxGeometry(0.44, 1.12, 0.44), brickMat);
  pier.position.set(-6.45, 0.56, 5.65);
  pier.castShadow = true;
  swHouseGroup.add(pier);
  const pierCap = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.1, 0.52), stoneCopingMat);
  pierCap.position.set(-6.45, 1.15, 5.65);
  swHouseGroup.add(pierCap);

  // Gravel garden bed inside wall
  const gravelMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.95 });
  const swGravel = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.16, 4.8), gravelMat);
  swGravel.position.set(-10.1, 0.08, 8.2);
  swGravel.receiveShadow = true;
  swHouseGroup.add(swGravel);

  // 3 Wheelie Bins (Blue lid, Brown lid, Black lid) inside the SW garden wall
  const binBodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
  const lidColors = [0x2563eb, 0x78350f, 0x0f172a];
  lidColors.forEach((lidHex, idx) => {
    const bin = new THREE.Group();
    bin.position.set(-7.3 - idx * 0.72, 0.15, 6.35);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.98, 0.58), binBodyMat);
    body.position.y = 0.49;
    body.castShadow = true;
    bin.add(body);
    const lid = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.08, 0.62),
      new THREE.MeshStandardMaterial({ color: lidHex, roughness: 0.5 })
    );
    lid.position.y = 1.01;
    bin.add(lid);
    swHouseGroup.add(bin);
  });

  // Foreground SW house mass + pitched bay-window roof
  const houseBody = new THREE.Mesh(new THREE.BoxGeometry(7.2, 5.6, 6.5), houseRenderMat);
  houseBody.position.set(-10.8, 2.8, 12.2);
  houseBody.castShadow = true;
  houseBody.receiveShadow = true;
  swHouseGroup.add(houseBody);

  const bayRoof = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.35, 4), roofSlateMat);
  bayRoof.rotation.y = Math.PI / 4;
  bayRoof.position.set(-8.6, 3.35, 8.6);
  bayRoof.castShadow = true;
  swHouseGroup.add(bayRoof);
  group.add(swHouseGroup);

  // 3. OPPOSITE-RIGHT (NE CORNER, x = +3.8m, z = -3.6m): KNOCKABLE TELEGRAPH POLE + 30/WARNING SIGNPOST
  const neKnockableGroup = new THREE.Group();
  neKnockableGroup.position.set(3.8, 0, -3.6);
  neKnockableGroup.userData.baseX = 3.8;
  neKnockableGroup.userData.baseZ = -3.6;

  // Timber telegraph/utility pole + sign post struck by VL19 OKP
  const woodPoleMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.85 });
  const nePole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 5.6, 12), woodPoleMat);
  nePole.position.set(0, 2.8, 0);
  nePole.castShadow = true;
  neKnockableGroup.add(nePole);

  const neSignPost = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 10), postMat);
  neSignPost.position.set(-0.22, 1.6, 0.18);
  neSignPost.castShadow = true;
  neKnockableGroup.add(neSignPost);

  const neTopTri = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.68), giveWayMat);
  neTopTri.position.set(-0.22, 2.85, 0.25);
  neKnockableGroup.add(neTopTri);

  const neSpeedDisc = new THREE.Mesh(new THREE.CircleGeometry(0.32, 24), speed30Mat);
  neSpeedDisc.position.set(-0.22, 2.12, 0.25);
  neKnockableGroup.add(neSpeedDisc);

  group.add(neKnockableGroup);
  sceneInstance.knockableSignRef = neKnockableGroup;
  if (Array.isArray(sceneInstance.knockableSignRefs)) {
    sceneInstance.knockableSignRefs.push(neKnockableGroup);
  }

  // 4. OPPOSITE-RIGHT (NE CORNER) GRAVEL PULL-IN APRON, TRIMMED GREEN HEDGEROW, POST-AND-RAIL FENCE & FOR SALE BOARD
  const neApron = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.16, 3.2), gravelMat);
  neApron.position.set(10.2, 0.08, -5.6);
  neApron.receiveShadow = true;
  group.add(neApron);

  const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x1f4726, roughness: 0.9 });
  const neHedge = new THREE.Mesh(new THREE.BoxGeometry(18.0, 2.1, 1.6), hedgeMat);
  neHedge.position.set(13.5, 1.05, -7.4);
  neHedge.castShadow = true;
  neHedge.receiveShadow = true;
  group.add(neHedge);

  const neSideHedge = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.1, 16.0), hedgeMat);
  neSideHedge.position.set(6.2, 1.05, -15.0);
  neSideHedge.castShadow = true;
  group.add(neSideHedge);

  // Post-and-rail timber fence along NE verge
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x6b4f35, roughness: 0.85 });
  for (let i = 0; i < 6; i += 1) {
    const px = 6.2 + i * 2.2;
    const fPost = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.15, 0.12), timberMat);
    fPost.position.set(px, 0.58, -6.35);
    fPost.castShadow = true;
    group.add(fPost);
  }
  const railTop = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.08, 0.06), timberMat);
  railTop.position.set(11.7, 0.92, -6.35);
  group.add(railTop);
  const railBot = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.08, 0.06), timberMat);
  railBot.position.set(11.7, 0.52, -6.35);
  group.add(railBot);

  // "FOR SALE" Estate Agent Board on NE corner
  const forSaleGroup = new THREE.Group();
  forSaleGroup.position.set(9.4, 0, -6.1);
  const fsPost = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.08), timberMat);
  fsPost.position.y = 1.1;
  forSaleGroup.add(fsPost);
  const fsBoard = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 0.62, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
  );
  fsBoard.position.set(0, 1.95, 0);
  forSaleGroup.add(fsBoard);
  group.add(forSaleGroup);

  // 5. OPPOSITE-LEFT (NW CORNER) SIGHTLINE-BLOCKING HEDGEROW, TREES & STREET LAMPS
  const nwHedgeEW = new THREE.Mesh(new THREE.BoxGeometry(22.0, 2.35, 1.8), hedgeMat);
  nwHedgeEW.position.set(-16.2, 1.18, -6.5);
  nwHedgeEW.castShadow = true;
  nwHedgeEW.receiveShadow = true;
  group.add(nwHedgeEW);

  const nwHedgeNS = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.35, 20.0), hedgeMat);
  nwHedgeNS.position.set(-6.2, 1.18, -15.5);
  nwHedgeNS.castShadow = true;
  nwHedgeNS.receiveShadow = true;
  group.add(nwHedgeNS);

  // Foliage trees behind NW and NE hedges
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x1a3d22, roughness: 0.88 });
  const treeCoords = [
    [-9.5, -8.5, 2.2],
    [-14.0, -8.2, 2.5],
    [-7.8, -13.0, 2.1],
    [8.2, -9.2, 2.3],
    [13.8, -9.0, 2.6],
  ];
  treeCoords.forEach(([tx, tz, rad]) => {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 2.6, 8), woodPoleMat);
    trunk.position.set(tx, 1.3, tz);
    trunk.castShadow = true;
    group.add(trunk);
    const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(rad, 1), canopyMat);
    canopy.position.set(tx, 3.6, tz);
    canopy.castShadow = true;
    canopy.receiveShadow = true;
    group.add(canopy);
  });

  // Low-poly street lamps with subtle warm luminaire glow
  const lampCoords = [
    [-14.5, -4.6],
    [15.5, 4.6],
    [-4.6, 15.5],
  ];
  const lampHeadMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    emissive: new THREE.Color(0xfef3c7),
    emissiveIntensity: 1.4,
    roughness: 0.3,
  });
  lampCoords.forEach(([lx, lz]) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 6.2, 10), postMat);
    pole.position.set(lx, 3.1, lz);
    pole.castShadow = true;
    group.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.24), lampHeadMat);
    head.position.set(lx, 6.2, lz);
    group.add(head);
  });
}
