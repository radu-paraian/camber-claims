import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class ForensicScene3D {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060a12);
    this.scene.fog = new THREE.FogExp2(0x060a12, 0.0085);

    const width = container.clientWidth || 900;
    const height = container.clientHeight || 600;
    const aspect = width / Math.max(height, 1);

    // 1. Perspective Camera (3D Orbit, Vehicle POVs, Ring CCTV POV)
    this.perspCamera = new THREE.PerspectiveCamera(46, aspect, 0.2, 300);
    this.perspCamera.position.set(18, 16, 22);
    this.perspCamera.lookAt(0, 0, 0);

    // 2. Orthographic Camera (Top Overhead, Side X-Axis, Front Z-Axis)
    this.orthoHalfSize = 22;
    this.orthoCamera = new THREE.OrthographicCamera(
      -this.orthoHalfSize * aspect,
      this.orthoHalfSize * aspect,
      this.orthoHalfSize,
      -this.orthoHalfSize,
      0.1,
      250
    );

    this.activeCamera = this.perspCamera;
    this.cameraMode = 'orbit';

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    container.querySelectorAll('canvas').forEach((c) => c.remove());
    container.prepend(this.renderer.domElement);

    // OrbitControls
    this.controls = new OrbitControls(this.perspCamera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 95;
    this.controls.target.set(-1.5, 0.5, -1.0);

    // Groups
    this.environmentGroup = new THREE.Group();
    this.causalPropsGroup = new THREE.Group();
    this.nonCausalClutterGroup = new THREE.Group();
    this.vehiclesGroup = new THREE.Group();
    this.trajectoriesGroup = new THREE.Group();
    this.camerasGroup = new THREE.Group();
    this.effectsGroup = new THREE.Group();

    this.scene.add(this.environmentGroup);
    this.scene.add(this.causalPropsGroup);
    this.scene.add(this.nonCausalClutterGroup);
    this.scene.add(this.trajectoriesGroup);
    this.scene.add(this.vehiclesGroup);
    this.scene.add(this.camerasGroup);
    this.scene.add(this.effectsGroup);

    this.vehicleMeshes = new Map();
    this.reportData = null;
    this.currentTime = 1.15;
    this.causalFilterActive = true;

    this._setupLighting();
    this._buildProceduralRoadEnvironment();
    this._buildCausalJunctionProps();
    this._buildNonCausalStrippedClutter();
    this._buildImpactAndSightlineEffects();

    // Resize Observer
    this.resizeObserver = new ResizeObserver(() => this._onResize());
    this.resizeObserver.observe(this.container);

    this._animate = this._animate.bind(this);
    this._rafId = requestAnimationFrame(this._animate);
  }

  _setupLighting() {
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 1.05);
    hemiLight.position.set(0, 40, 0);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xe2e8f0, 1.65);
    dirLight.position.set(22, 36, 18);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 2;
    dirLight.shadow.camera.far = 100;
    const d = 32;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    this.scene.add(dirLight);

    // Subtle cyan forensic rim light
    const rimLight = new THREE.PointLight(0x38bdf8, 1.2, 45);
    rimLight.position.set(-10, 12, -10);
    this.scene.add(rimLight);
  }

  _createProceduralJunctionTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d');

    // Coordinate mapping: 80m x 80m world area mapped to 2048x2048px
    // (0,0) world = (1024, 1024) canvas; 1m = 25.6px
    const m2px = 25.6;
    const cx = 1024;
    const cy = 1024;

    // Dark UK rural/suburban verge background
    ctx.fillStyle = '#0c1512';
    ctx.fillRect(0, 0, 2048, 2048);

    // Subtle forensic metric grid on outer terrain
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.06)';
    ctx.lineWidth = 1;
    for (let m = -40; m <= 40; m += 2) {
      const p = cx + m * m2px;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, 2048);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(2048, p);
      ctx.stroke();
    }

    // Pavements / Footways (2.0m wide around carriageways)
    ctx.fillStyle = '#26303d';
    const mainHalfW = 4.2 * m2px;
    const minorHalfW = 3.4 * m2px;
    const paveW = 1.8 * m2px;

    // Main road A521 pavements (West-East)
    ctx.fillRect(0, cy - mainHalfW - paveW, 2048, (mainHalfW + paveW) * 2);
    // Minor road Draycott Cross Rd pavements (North arm, z < 0)
    ctx.fillRect(cx - minorHalfW - paveW, 0, (minorHalfW + paveW) * 2, cy);

    // Wet UK Tarmacadam base
    ctx.fillStyle = '#181f29';
    ctx.fillRect(0, cy - mainHalfW, 2048, mainHalfW * 2);
    ctx.fillRect(cx - minorHalfW, 0, minorHalfW * 2, cy + 4);

    // Procedural asphalt aggregate noise & damp sheen patches
    for (let i = 0; i < 9000; i++) {
      const rx = Math.random() * 2048;
      const ry = Math.random() * 2048;
      const inMain = Math.abs(ry - cy) <= mainHalfW;
      const inMinor = rx >= cx - minorHalfW && rx <= cx + minorHalfW && ry <= cy;
      if (inMain || inMinor) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(6,10,18,0.06)';
        ctx.fillRect(rx, ry, 2, 2);
      }
    }

    // Kerb stones (light grey dashed border along road edges)
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    // South kerb continuous
    ctx.moveTo(0, cy + mainHalfW);
    ctx.lineTo(2048, cy + mainHalfW);
    // North-West kerb
    ctx.moveTo(0, cy - mainHalfW);
    ctx.lineTo(cx - minorHalfW, cy - mainHalfW);
    ctx.lineTo(cx - minorHalfW, 0);
    // North-East kerb
    ctx.moveTo(2048, cy - mainHalfW);
    ctx.lineTo(cx + minorHalfW, cy - mainHalfW);
    ctx.lineTo(cx + minorHalfW, 0);
    ctx.stroke();

    // UK Road Markings (Crisp Thermoplastic White #f1f5f9)
    ctx.strokeStyle = '#f1f5f9';
    ctx.fillStyle = '#f1f5f9';

    // 1. A521 Centre Hazard Warning Line (West and East of junction)
    ctx.lineWidth = 4;
    ctx.setLineDash([4.0 * m2px, 2.0 * m2px]);
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(cx - minorHalfW - 1.5 * m2px, cy);
    ctx.moveTo(cx + minorHalfW + 1.5 * m2px, cy);
    ctx.lineTo(2048, cy);
    ctx.stroke();

    // 2. Draycott Cross Rd Centre Line (Minor Road North)
    ctx.setLineDash([2.5 * m2px, 2.0 * m2px]);
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, cy - mainHalfW - 1.4 * m2px);
    ctx.stroke();

    // 3. UK Diagram 1003 Double Dashed GIVE WAY Line across Draycott Cross Rd mouth (z = -4.2m)
    ctx.setLineDash([0.6 * m2px, 0.45 * m2px]);
    ctx.lineWidth = 5;
    const giveWayY1 = cy - mainHalfW - 0.15 * m2px;
    const giveWayY2 = cy - mainHalfW - 0.48 * m2px;
    ctx.beginPath();
    ctx.moveTo(cx - minorHalfW + 6, giveWayY1);
    ctx.lineTo(cx, giveWayY1);
    ctx.moveTo(cx - minorHalfW + 6, giveWayY2);
    ctx.lineTo(cx, giveWayY2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. UK Painted Inverted White Triangle (Diagram 1023) in southbound emerging lane (x = -1.7m, z = -7.8m)
    const triX = cx - 1.7 * m2px;
    const triTopY = cy - 9.2 * m2px;
    const triApexY = cy - 6.2 * m2px;
    const triHalfW = 0.85 * m2px;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(triX - triHalfW, triTopY);
    ctx.lineTo(triX + triHalfW, triTopY);
    ctx.lineTo(triX, triApexY);
    ctx.closePath();
    ctx.stroke();

    // 5. Highway Code Stopping Distance Comparison Strips directly on A521 Eastbound Lane (z > 0)
    // Braking onset at x = -18.2m:
    // - 30 mph legal stopping distance (14.0m): x = -18.2m to x = -4.2m (Stops safely before junction!)
    // - 41.2 mph actual stopping distance (26.4m): x = -18.2m to x = +8.2m (Sweeps through impact point!)
    const startX = cx - 18.2 * m2px;
    const legalLen = 14.0 * m2px;
    const actualLen = 26.4 * m2px;

    // 30 mph Ideal Strip (Emerald)
    ctx.fillStyle = 'rgba(16, 185, 129, 0.28)';
    ctx.fillRect(startX, cy + 0.55 * m2px, legalLen, 0.95 * m2px);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.strokeRect(startX, cy + 0.55 * m2px, legalLen, 0.95 * m2px);

    ctx.fillStyle = '#a7f3d0';
    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.fillText('30 MPH STOP: 14.0m (SAFE BEFORE JUNCTION)', startX + 10, cy + 1.18 * m2px);

    // 41.2 mph Actual Strip (Crimson)
    ctx.fillStyle = 'rgba(239, 68, 68, 0.28)';
    ctx.fillRect(startX, cy + 1.75 * m2px, actualLen, 1.05 * m2px);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.strokeRect(startX, cy + 1.75 * m2px, actualLen, 1.05 * m2px);

    ctx.fillStyle = '#fecaca';
    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.fillText('41.2 MPH ACTUAL: 26.4m (IMPACT AT t=1.15s)', startX + 10, cy + 2.42 * m2px);

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  }

  _buildProceduralRoadEnvironment() {
    const roadTex = this._createProceduralJunctionTexture();
    const groundGeo = new THREE.PlaneGeometry(80, 80);
    const groundMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      roughness: 0.36, // Wet UK tarmac specular sheen
      metalness: 0.14,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    this.environmentGroup.add(groundMesh);
  }

  _createUKSignTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    if (type === 'give_way') {
      ctx.clearRect(0, 0, 256, 256);
      // Inverted white triangle with thick crimson border
      ctx.beginPath();
      ctx.moveTo(18, 28);
      ctx.lineTo(238, 28);
      ctx.lineTo(128, 232);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 22;
      ctx.strokeStyle = '#dc2626';
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 34px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GIVE', 128, 86);
      ctx.fillText('WAY', 128, 126);
    } else if (type === 'speed_30') {
      ctx.clearRect(0, 0, 256, 256);
      ctx.beginPath();
      ctx.arc(128, 128, 108, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 26;
      ctx.strokeStyle = '#dc2626';
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 104px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('30', 128, 134);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  _buildCausalJunctionProps() {
    this.causalPropsGroup.clear();

    // 1. UK GIVE WAY Sign on Post at (-3.6m, -4.5m)
    const postMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.4 });
    const gwGroup = new THREE.Group();
    gwGroup.position.set(-3.6, 0, -4.5);
    const gwPost = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 12), postMat);
    gwPost.position.y = 1.2;
    gwPost.castShadow = true;
    gwGroup.add(gwPost);

    const gwBoard = new THREE.Mesh(
      new THREE.PlaneGeometry(0.85, 0.85),
      new THREE.MeshBasicMaterial({
        map: this._createUKSignTexture('give_way'),
        transparent: true,
        side: THREE.DoubleSide,
      })
    );
    gwBoard.position.set(0, 2.25, 0.06);
    gwGroup.add(gwBoard);
    this.causalPropsGroup.add(gwGroup);

    // 2. UK 30 MPH Speed Limit Sign on Post at (-14.0m, 4.8m)
    const spGroup = new THREE.Group();
    spGroup.position.set(-14.0, 0, 4.8);
    const spPost = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 12), postMat);
    spPost.position.y = 1.25;
    spPost.castShadow = true;
    spGroup.add(spPost);

    const spBoard = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.8),
      new THREE.MeshBasicMaterial({
        map: this._createUKSignTexture('speed_30'),
        transparent: true,
        side: THREE.DoubleSide,
      })
    );
    spBoard.position.set(0, 2.3, 0);
    spBoard.rotation.y = Math.PI / 2;
    spGroup.add(spBoard);
    this.causalPropsGroup.add(spGroup);

    // 3. Northwest Corner Staffordshire Brick Terrace Building (x = -11.5m, z = -10.5m)
    const bldgGroup = new THREE.Group();
    bldgGroup.position.set(-11.5, 0, -10.5);
    const brickMat = new THREE.MeshStandardMaterial({
      color: 0x5c2d24,
      roughness: 0.85,
      metalness: 0.05,
    });
    const walls = new THREE.Mesh(new THREE.BoxGeometry(9.5, 5.8, 7.5), brickMat);
    walls.position.y = 2.9;
    walls.castShadow = true;
    walls.receiveShadow = true;
    bldgGroup.add(walls);

    const roofMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(6.8, 2.4, 4), roofMat);
    roof.position.y = 7.0;
    roof.rotation.y = Math.PI / 4;
    bldgGroup.add(roof);
    this.causalPropsGroup.add(bldgGroup);

    // 4. NW Corner Dense Sightline-Blocking Hedgerow & Trees (x: -10.5 to -4.2, z: -5.2)
    // This is the causal sightline blocker between Draycott Cross Rd and A521 Eastbound!
    const hedgeGroup = new THREE.Group();
    const hedgeMat = new THREE.MeshStandardMaterial({
      color: 0x14532d,
      roughness: 0.9,
      metalness: 0.05,
    });
    const mainHedge = new THREE.Mesh(new THREE.BoxGeometry(6.8, 2.1, 1.3), hedgeMat);
    mainHedge.position.set(-7.6, 1.05, -5.1);
    mainHedge.castShadow = true;
    hedgeGroup.add(mainHedge);

    const sideHedge = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.1, 6.2), hedgeMat);
    sideHedge.position.set(-4.4, 1.05, -8.2);
    sideHedge.castShadow = true;
    hedgeGroup.add(sideHedge);

    // Wireframe highlight around sightline hedge to emphasize its causal role
    const hedgeWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(6.85, 2.15, 1.35)),
      new THREE.LineBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.55 })
    );
    hedgeWire.position.copy(mainHedge.position);
    hedgeGroup.add(hedgeWire);

    this.causalPropsGroup.add(hedgeGroup);
  }

  _buildNonCausalStrippedClutter() {
    // 3 Non-Causal Background Objects stripped by the Agentic Video Filter.
    // Hidden by default when causalFilterActive === true; toggled visible as red-crossed ghost wireframes when unchecked.
    this.nonCausalClutterGroup.clear();

    const ghostMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      wireframe: true,
      transparent: true,
      opacity: 0.42,
    });

    const items = [
      { pos: [14.5, 0.75, 6.2], size: [4.1, 1.45, 1.8], label: 'STRIPPED #1: Non-Involved Parked Car' },
      { pos: [19.2, 1.15, -2.0], size: [5.4, 2.2, 2.1], label: 'STRIPPED #2: Distant Background Van' },
      { pos: [-12.5, 0.6, 6.5], size: [1.6, 1.2, 1.4], label: 'STRIPPED #3: Kerbside Bins / Clutter' },
    ];

    items.forEach((item) => {
      const grp = new THREE.Group();
      grp.position.set(item.pos[0], item.pos[1], item.pos[2]);
      const box = new THREE.Mesh(new THREE.BoxGeometry(...item.size), ghostMat);
      grp.add(box);

      const sprite = this._createLabelSprite(item.label, '#fca5a5', 'rgba(127, 29, 29, 0.88)');
      sprite.position.set(0, item.size[1] / 2 + 0.9, 0);
      sprite.scale.set(5.2, 1.1, 1);
      grp.add(sprite);

      this.nonCausalClutterGroup.add(grp);
    });

    this.nonCausalClutterGroup.visible = !this.causalFilterActive;
  }

  setCausalFilterActive(active) {
    this.causalFilterActive = Boolean(active);
    this.nonCausalClutterGroup.visible = !this.causalFilterActive;
  }

  _buildImpactAndSightlineEffects() {
    this.effectsGroup.clear();

    // Sightline Laser Ray between Vehicle A and Vehicle B
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-1.8, 1.2, -10),
      new THREE.Vector3(-16.0, 1.1, 1.6),
    ]);
    this.sightlineMat = new THREE.LineDashedMaterial({
      color: 0xef4444,
      dashSize: 0.6,
      gapSize: 0.35,
      transparent: true,
      opacity: 0.85,
    });
    this.sightlineRay = new THREE.Line(lineGeo, this.sightlineMat);
    this.sightlineRay.computeLineDistances();
    this.effectsGroup.add(this.sightlineRay);

    // Expanding Impact Shockwave Ring at (0.0, 0.2)
    const ringGeo = new THREE.RingGeometry(0.4, 0.75, 48);
    this.impactRingMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
    });
    this.impactRingMesh = new THREE.Mesh(ringGeo, this.impactRingMat);
    this.impactRingMesh.rotation.x = -Math.PI / 2;
    this.impactRingMesh.position.set(0.0, 0.06, 0.2);
    this.effectsGroup.add(this.impactRingMesh);

    // Vertical Impact Beacon Pillar
    const beaconGeo = new THREE.CylinderGeometry(0.06, 0.25, 4.5, 16, 1, true);
    this.impactBeaconMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
    });
    this.impactBeacon = new THREE.Mesh(beaconGeo, this.impactBeaconMat);
    this.impactBeacon.position.set(0.0, 2.25, 0.2);
    this.effectsGroup.add(this.impactBeacon);
  }

  _createLabelSprite(text, textColor = '#f8fafc', bgColor = 'rgba(15, 22, 35, 0.9)') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 112;
    const ctx = canvas.getContext('2d');

    const drawText = (str) => {
      ctx.clearRect(0, 0, 512, 112);
      ctx.fillStyle = bgColor;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(6, 6, 500, 100, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = textColor;
      ctx.font = 'bold 26px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(str, 256, 56);
    };

    drawText(text);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.userData.updateLabel = (newStr) => {
      if (sprite.userData.lastText === newStr) return;
      sprite.userData.lastText = newStr;
      drawText(newStr);
      tex.needsUpdate = true;
    };
    return sprite;
  }

  _createDetailedVehicleMesh(vehicle) {
    const rootGroup = new THREE.Group();
    const bodyTiltGroup = new THREE.Group();
    rootGroup.add(bodyTiltGroup);

    const isSUV =
      vehicle.vehicle_id === 'vehicle_a' ||
      (vehicle.label && vehicle.label.toLowerCase().includes('suv')) ||
      (vehicle.label && vehicle.label.toLowerCase().includes('peugeot'));

    const length = isSUV ? 4.35 : 4.25;
    const width = isSUV ? 1.84 : 1.79;
    const chassisH = isSUV ? 0.76 : 0.64;
    const cabinH = isSUV ? 0.66 : 0.56;

    const paintColor = new THREE.Color(vehicle.color_hex || '#2563EB');
    const bodyMat = new THREE.MeshStandardMaterial({
      color: paintColor,
      metalness: 0.55,
      roughness: 0.25,
    });

    // Lower sculpted chassis (aligned along Z axis: +Z is forward when heading=0? Let's make +Z North/South consistent with heading)
    // Wait: in schemas.py, heading_deg: 0 = North (-Z), 90 = East (+X), 180 = South (+Z).
    // If we build the vehicle with its front pointing toward -Z (North), then:
    // rotation.y = -THREE.MathUtils.degToRad(heading_deg) makes:
    // heading 0 -> -Z (North)
    // heading 90 -> +X (East)
    // heading 180 -> +Z (South)
    // Let's verify: if front is at -Z, rotating around Y by -90 deg (-PI/2) sends (0,0,-1) to (+1,0,0) = +X (East)!
    // And rotating around Y by -180 deg (-PI) sends (0,0,-1) to (0,0,+1) = +Z (South)!
    // That makes heading_deg 100% mathematically exact!

    const chassisMesh = new THREE.Mesh(new THREE.BoxGeometry(width, chassisH, length), bodyMat);
    chassisMesh.position.y = 0.32 + chassisH / 2;
    chassisMesh.castShadow = true;
    chassisMesh.receiveShadow = true;
    bodyTiltGroup.add(chassisMesh);

    // Cabin / Greenhouse
    const cabinMesh = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.86, cabinH, length * 0.56),
      bodyMat
    );
    cabinMesh.position.set(0, 0.32 + chassisH + cabinH / 2 - 0.04, 0.18);
    cabinMesh.castShadow = true;
    bodyTiltGroup.add(cabinMesh);

    // Dark tinted automotive glass wrap
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x091326,
      metalness: 0.85,
      roughness: 0.12,
    });
    const glassMesh = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.88, cabinH * 0.76, length * 0.52),
      glassMat
    );
    glassMesh.position.copy(cabinMesh.position);
    bodyTiltGroup.add(glassMesh);

    // 4 Wheels with Alloy Rims
    const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 20);
    wheelGeo.rotateZ(Math.PI / 2);
    const tyreMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85 });
    const rimGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.25, 12);
    rimGeo.rotateZ(Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.8, roughness: 0.25 });

    const wheelPositions = [
      [-width / 2, 0.34, -length * 0.32],
      [width / 2, 0.34, -length * 0.32],
      [-width / 2, 0.34, length * 0.32],
      [width / 2, 0.34, length * 0.32],
    ];
    const wheels = [];
    wheelPositions.forEach(([wx, wy, wz]) => {
      const wGrp = new THREE.Group();
      wGrp.position.set(wx, wy, wz);
      wGrp.add(new THREE.Mesh(wheelGeo, tyreMat));
      wGrp.add(new THREE.Mesh(rimGeo, rimMat));
      bodyTiltGroup.add(wGrp);
      wheels.push(wGrp);
    });

    // Front Headlights (at -length/2) + Subtle Light Cones
    const headLightMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
    const hlGeo = new THREE.BoxGeometry(0.32, 0.14, 0.06);
    const hlLeft = new THREE.Mesh(hlGeo, headLightMat);
    hlLeft.position.set(-width * 0.34, 0.72, -length / 2 - 0.01);
    const hlRight = hlLeft.clone();
    hlRight.position.x = width * 0.34;
    bodyTiltGroup.add(hlLeft, hlRight);

    // Subtle volumetric headlight cone
    const coneGeo = new THREE.ConeGeometry(0.95, 3.8, 16, 1, true);
    coneGeo.rotateX(Math.PI / 2);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.09,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const coneMesh = new THREE.Mesh(coneGeo, coneMat);
    coneMesh.position.set(0, 0.55, -length / 2 - 1.9);
    bodyTiltGroup.add(coneMesh);

    // Rear Emissive Crimson Brake Lights (at +length/2)
    const brakeLightMat = new THREE.MeshStandardMaterial({
      color: 0x7f1d1d,
      emissive: 0xef4444,
      emissiveIntensity: 0.25,
      roughness: 0.2,
    });
    const blGeo = new THREE.BoxGeometry(0.36, 0.15, 0.06);
    const blLeft = new THREE.Mesh(blGeo, brakeLightMat);
    blLeft.position.set(-width * 0.34, 0.76, length / 2 + 0.01);
    const blRight = blLeft.clone();
    blRight.position.x = width * 0.34;
    bodyTiltGroup.add(blLeft, blRight);

    // Velocity Vector Arrow
    const arrowColor = vehicle.vehicle_id === 'vehicle_a' ? 0x38bdf8 : 0xf97316;
    const velocityArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0, 0.5, 0),
      3.5,
      arrowColor,
      0.7,
      0.45
    );
    rootGroup.add(velocityArrow);

    // Floating Telemetry Label Sprite
    const labelSprite = this._createLabelSprite(
      `${vehicle.registration_plate} • 0.0 mph`,
      vehicle.vehicle_id === 'vehicle_a' ? '#38bdf8' : '#fdba74'
    );
    labelSprite.position.set(0, 2.55, 0);
    labelSprite.scale.set(4.5, 0.96, 1);
    rootGroup.add(labelSprite);

    return {
      rootGroup,
      bodyTiltGroup,
      brakeLightMat,
      velocityArrow,
      labelSprite,
      wheels,
      vehicleData: vehicle,
    };
  }

  loadCaseData(report) {
    this.reportData = report;
    this.vehiclesGroup.clear();
    this.trajectoriesGroup.clear();
    this.camerasGroup.clear();
    this.vehicleMeshes.clear();

    if (!report || !Array.isArray(report.vehicles)) return;

    // Position Impact Ring & Beacon at report's impact coordinates
    const ix = report.impact_x_meters ?? 0.0;
    const iz = report.impact_z_meters ?? 0.2;
    this.impactRingMesh.position.set(ix, 0.06, iz);
    this.impactBeacon.position.set(ix, 2.25, iz);

    // Build vehicles & trajectory ribbons
    report.vehicles.forEach((vehicle) => {
      const vObj = this._createDetailedVehicleMesh(vehicle);
      this.vehiclesGroup.add(vObj.rootGroup);
      this.vehicleMeshes.set(vehicle.vehicle_id, vObj);

      // Trajectory ribbon on tarmac
      if (Array.isArray(vehicle.keyframes) && vehicle.keyframes.length >= 2) {
        const pts = vehicle.keyframes.map(
          (kf) => new THREE.Vector3(kf.x_meters, 0.08, kf.z_meters)
        );
        const curve = new THREE.CatmullRomCurve3(pts);
        const tubeGeo = new THREE.TubeGeometry(curve, 48, 0.12, 8, false);
        const tubeMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(vehicle.color_hex || '#38bdf8'),
          transparent: true,
          opacity: 0.55,
        });
        this.trajectoriesGroup.add(new THREE.Mesh(tubeGeo, tubeMat));
      }
    });

    // Build 3D Camera Frustum Wireframes
    if (Array.isArray(report.detected_cameras)) {
      report.detected_cameras.forEach((cam) => {
        const camGrp = new THREE.Group();
        camGrp.position.set(cam.mount_position_x, cam.mount_position_y, cam.mount_position_z);
        const coneGeo = new THREE.ConeGeometry(1.1, 2.4, 4, 1, true);
        coneGeo.rotateX(Math.PI / 2);
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(coneGeo),
          new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 })
        );
        camGrp.lookAt(cam.look_at_x, 0.8, cam.look_at_z);
        camGrp.add(edges);
        this.camerasGroup.add(camGrp);
      });
    }

    this.updateAtTime(this.currentTime);
  }

  _interpolateKeyframe(keyframes, t) {
    if (!keyframes || keyframes.length === 0) {
      return {
        x_meters: 0,
        z_meters: 0,
        heading_deg: 0,
        speed_mph: 0,
        braking_active: false,
        roll_deg: 0,
      };
    }
    if (t <= keyframes[0].timestamp_sec) return { ...keyframes[0] };
    const last = keyframes[keyframes.length - 1];
    if (t >= last.timestamp_sec) return { ...last };

    for (let i = 0; i < keyframes.length - 1; i++) {
      const k0 = keyframes[i];
      const k1 = keyframes[i + 1];
      if (t >= k0.timestamp_sec && t <= k1.timestamp_sec) {
        const span = Math.max(k1.timestamp_sec - k0.timestamp_sec, 0.0001);
        const alpha = (t - k0.timestamp_sec) / span;
        return {
          x_meters: THREE.MathUtils.lerp(k0.x_meters, k1.x_meters, alpha),
          z_meters: THREE.MathUtils.lerp(k0.z_meters, k1.z_meters, alpha),
          heading_deg: THREE.MathUtils.lerp(k0.heading_deg, k1.heading_deg, alpha),
          speed_mph: THREE.MathUtils.lerp(k0.speed_mph, k1.speed_mph, alpha),
          braking_active: alpha < 0.5 ? k0.braking_active : k1.braking_active,
          roll_deg: THREE.MathUtils.lerp(k0.roll_deg || 0, k1.roll_deg || 0, alpha),
        };
      }
    }
    return { ...last };
  }

  updateAtTime(timestampSec) {
    this.currentTime = timestampSec;
    if (!this.reportData) return null;

    const telemetrySnapshot = {};
    const positions = {};

    this.vehicleMeshes.forEach((vObj, vehicleId) => {
      const kf = this._interpolateKeyframe(vObj.vehicleData.keyframes, timestampSec);
      telemetrySnapshot[vehicleId] = kf;

      vObj.rootGroup.position.set(kf.x_meters, 0, kf.z_meters);
      const yawRad = -THREE.MathUtils.degToRad(kf.heading_deg);
      vObj.rootGroup.rotation.y = yawRad;

      // Post-impact rollover tilt around vehicle longitudinal Z-axis
      const rollRad = THREE.MathUtils.degToRad(kf.roll_deg || 0);
      vObj.bodyTiltGroup.rotation.z = rollRad;
      vObj.bodyTiltGroup.position.y = Math.abs(Math.sin(rollRad)) * 0.42;

      // Nose dive pitch when braking actively
      vObj.bodyTiltGroup.rotation.x = kf.braking_active ? -0.045 : 0.0;

      // Emissive crimson brake lights
      vObj.brakeLightMat.emissiveIntensity = kf.braking_active ? 3.5 : 0.2;

      // Velocity arrow length proportional to speed_mph
      const speedLen = Math.max(0.4, (kf.speed_mph / 45) * 4.8);
      vObj.velocityArrow.setLength(speedLen, 0.65, 0.4);
      vObj.velocityArrow.visible = kf.speed_mph > 0.5;

      // Update floating 3D sprite readout
      if (vObj.labelSprite?.userData?.updateLabel) {
        const plate = vObj.vehicleData.registration_plate || vehicleId;
        const suffix =
          Math.abs(kf.roll_deg || 0) > 15
            ? `ROLL ${Math.round(kf.roll_deg)}°`
            : kf.braking_active
              ? 'BRAKING'
              : 'CRUISE';
        vObj.labelSprite.userData.updateLabel(
          `${plate} • ${kf.speed_mph.toFixed(1)} mph (${suffix})`
        );
      }

      positions[vehicleId] = new THREE.Vector3(kf.x_meters, 1.1, kf.z_meters);
    });

    // Update Sightline Laser Ray between Vehicle A and Vehicle B
    if (positions.vehicle_a && positions.vehicle_b) {
      const posAttr = this.sightlineRay.geometry.attributes.position;
      posAttr.setXYZ(0, positions.vehicle_a.x, 1.15, positions.vehicle_a.z);
      posAttr.setXYZ(1, positions.vehicle_b.x, 1.05, positions.vehicle_b.z);
      posAttr.needsUpdate = true;
      this.sightlineRay.computeLineDistances();
      // Crimson while occluded by NW hedge before t=0.65s, amber after emerging
      this.sightlineMat.color.setHex(timestampSec < 0.68 ? 0xef4444 : 0xf59e0b);
    }

    // Impact Shockwave Ring & Beacon animation around impact_timestamp_sec
    const impactT = this.reportData.impact_timestamp_sec ?? 1.15;
    const dtImpact = timestampSec - impactT;
    if (dtImpact >= -0.05 && dtImpact <= 1.2) {
      const norm = Math.max(0, dtImpact / 1.2);
      const scale = 1.0 + norm * 7.5;
      this.impactRingMesh.scale.set(scale, scale, 1);
      this.impactRingMat.opacity = Math.max(0, 0.85 * (1 - norm));
      this.impactBeaconMat.opacity = Math.max(0, 0.65 * (1 - norm));
    } else {
      this.impactRingMat.opacity = 0;
      this.impactBeaconMat.opacity = 0;
    }

    this._updateActiveCameraTransform(telemetrySnapshot);
    return telemetrySnapshot;
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
    const aspect =
      (this.container.clientWidth || 900) / Math.max(this.container.clientHeight || 600, 1);

    if (mode === 'top' || mode === 'side' || mode === 'front') {
      this.activeCamera = this.orthoCamera;
      this.controls.enabled = false;
      this.orthoCamera.left = -this.orthoHalfSize * aspect;
      this.orthoCamera.right = this.orthoHalfSize * aspect;
      this.orthoCamera.top = this.orthoHalfSize;
      this.orthoCamera.bottom = -this.orthoHalfSize;

      if (mode === 'top') {
        this.orthoCamera.up.set(0, 0, -1);
        this.orthoCamera.position.set(0, 55, 0);
        this.orthoCamera.lookAt(0, 0, 0);
      } else if (mode === 'side') {
        this.orthoCamera.up.set(0, 1, 0);
        this.orthoCamera.position.set(55, 4, 0);
        this.orthoCamera.lookAt(0, 1, 0);
      } else if (mode === 'front') {
        this.orthoCamera.up.set(0, 1, 0);
        this.orthoCamera.position.set(0, 4, 55);
        this.orthoCamera.lookAt(0, 1, 0);
      }
      this.orthoCamera.updateProjectionMatrix();
    } else {
      this.activeCamera = this.perspCamera;
      this.perspCamera.up.set(0, 1, 0);
      if (mode === 'orbit') {
        this.controls.enabled = true;
        this.perspCamera.fov = 46;
        this.perspCamera.position.set(17, 15, 20);
        this.controls.target.set(-1.5, 0.5, -1.0);
        this.controls.update();
      } else {
        this.controls.enabled = false;
        this.updateAtTime(this.currentTime);
      }
      this.perspCamera.updateProjectionMatrix();
    }
  }

  _updateActiveCameraTransform(snapshot) {
    if (this.cameraMode === 'pov_a' && snapshot.vehicle_a) {
      const kf = snapshot.vehicle_a;
      const rad = THREE.MathUtils.degToRad(kf.heading_deg);
      const fwdX = Math.sin(rad);
      const fwdZ = -Math.cos(rad);
      this.perspCamera.fov = 62;
      this.perspCamera.position.set(kf.x_meters - fwdX * 0.4, 1.55, kf.z_meters - fwdZ * 0.4);
      this.perspCamera.lookAt(kf.x_meters + fwdX * 14, 1.0, kf.z_meters + fwdZ * 14);
      this.perspCamera.updateProjectionMatrix();
    } else if (this.cameraMode === 'pov_b' && snapshot.vehicle_b) {
      const kf = snapshot.vehicle_b;
      const rad = THREE.MathUtils.degToRad(kf.heading_deg);
      const fwdX = Math.sin(rad);
      const fwdZ = -Math.cos(rad);
      this.perspCamera.fov = 62;
      this.perspCamera.position.set(kf.x_meters - fwdX * 0.4, 1.42, kf.z_meters - fwdZ * 0.4);
      this.perspCamera.lookAt(kf.x_meters + fwdX * 16, 1.0, kf.z_meters + fwdZ * 16);
      this.perspCamera.updateProjectionMatrix();
    } else if (this.cameraMode === 'cctv_1') {
      const cam =
        this.reportData?.detected_cameras?.[0] || {
          mount_position_x: 11.5,
          mount_position_y: 4.2,
          mount_position_z: 8.5,
          look_at_x: -1.5,
          look_at_z: -1.0,
          fov_deg: 68,
        };
      this.perspCamera.fov = Math.min(cam.fov_deg || 68, 75);
      this.perspCamera.position.set(cam.mount_position_x, cam.mount_position_y, cam.mount_position_z);
      this.perspCamera.lookAt(cam.look_at_x, 0.8, cam.look_at_z);
      this.perspCamera.updateProjectionMatrix();
    }
  }

  _onResize() {
    if (!this.container) return;
    const width = this.container.clientWidth || 900;
    const height = this.container.clientHeight || 600;
    const aspect = width / Math.max(height, 1);

    this.perspCamera.aspect = aspect;
    this.perspCamera.updateProjectionMatrix();

    this.orthoCamera.left = -this.orthoHalfSize * aspect;
    this.orthoCamera.right = this.orthoHalfSize * aspect;
    this.orthoCamera.top = this.orthoHalfSize;
    this.orthoCamera.bottom = -this.orthoHalfSize;
    this.orthoCamera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  _animate() {
    this._rafId = requestAnimationFrame(this._animate);
    if (this.cameraMode === 'orbit' && this.controls.enabled) {
      this.controls.update();
    }
    this.renderer.render(this.scene, this.activeCamera);
  }
}
