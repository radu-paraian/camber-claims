import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  resolveVehiclePairPhysics,
  buildContinuousPhysicsTrajectory,
  WebGPUPhysicsAccelerator,
  getVehicleRigidSpec,
  computeCrashDestructionState,
} from './physicsEngine.js';

export class ForensicScene3D {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    // Clean Apple Maps 3D Dark/Dusk slate-indigo sky & fog palette (#2d3548)
    this.scene.background = new THREE.Color(0x2d3548);
    this.scene.fog = new THREE.FogExp2(0x2d3548, 0.0038);

    const width = container.clientWidth || 900;
    const height = container.clientHeight || 600;
    const aspect = width / Math.max(height, 1);

    // 1. Perspective Camera (3D Orbit View)
    this.perspCamera = new THREE.PerspectiveCamera(46, aspect, 0.2, 350);
    this.perspCamera.position.set(18, 16, 22);
    this.perspCamera.lookAt(0, 0, 0);

    // 2. Orthographic Camera (retained for API compatibility)
    this.orthoHalfSize = 22;
    this.orthoCamera = new THREE.OrthographicCamera(
      -this.orthoHalfSize * aspect,
      this.orthoHalfSize * aspect,
      this.orthoHalfSize,
      -this.orthoHalfSize,
      0.1,
      280
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
    this.renderer.toneMappingExposure = 1.08;

    container.querySelectorAll('canvas').forEach((c) => c.remove());
    container.prepend(this.renderer.domElement);

    // OrbitControls — zero damping + immediate pointer-tick render for instant 1:1 cursor responsiveness
    this.controls = new OrbitControls(this.perspCamera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.screenSpacePanning = true;
    this.controls.rotateSpeed = 1.0;
    this.controls.zoomSpeed = 1.2;
    this.controls.panSpeed = 1.0;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 105;
    this.controls.target.set(-1.5, 0.5, -1.0);
    this.controls.update();
    this.controls.addEventListener('change', () => {
      if (this.scene && this.activeCamera) {
        this.renderer.render(this.scene, this.activeCamera);
      }
    });

    // Scene Hierarchy Groups
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
    this.scene.add(this.effectsGroup);

    this.vehicleMeshes = new Map();
    this.reportData = null;
    this.currentTime = 1.15;
    this.causalFilterActive = true;
    this.groundMaterial = null;
    this.lastPhysicsTelemetry = null;
    this.knockableSignRef = null;
    this.debrisGroup = null;
    this.debrisMeshes = [];
    this.dustPlumeGroup = null;
    this.dustMeshes = [];

    // WebGPU Compute Physics Accelerator + Rigid-Body OBB-SAT Engine
    this.webgpuPhysics = new WebGPUPhysicsAccelerator();
    this.webgpuPhysics.init().catch(() => {});

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
    // Apple Maps 3D Dusk/Dark Mode even atmospheric lighting
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x334155, 1.5);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.3);
    dirLight.position.set(24, 42, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 2;
    dirLight.shadow.camera.far = 120;
    const d = 38;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0004;
    this.scene.add(dirLight);
  }

  _drawRoadArrow(ctx, x, y, angleRad, scale = 1.0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angleRad);
    ctx.scale(scale, scale);

    ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
    ctx.fillRect(-24, -2.8, 32, 5.6);
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(4, -9.5);
    ctx.lineTo(4, 9.5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  _createProceduralJunctionTexture(_report = null) {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d');

    // Coordinate mapping: 80m x 80m world area mapped to 2048x2048px
    // (0,0) world = (1024, 1024) canvas; 1m = 25.6px
    const m2px = 25.6;
    const cx = 1024;
    const cy = 1024;

    // 1. Apple Maps 3D smooth matte slate-grey urban base (#475267)
    ctx.fillStyle = '#475267';
    ctx.fillRect(0, 0, 2048, 2048);

    // 2. Crisp raised pavement / footway zones (#56637a)
    const mainHalfW = 4.2 * m2px;
    const minorHalfW = 3.4 * m2px;
    const paveW = 2.2 * m2px;

    ctx.fillStyle = '#56637a';
    // Main road sidewalks (West-East)
    ctx.fillRect(0, cy - mainHalfW - paveW, 2048, (mainHalfW + paveW) * 2);
    // Minor road sidewalks (North arm, z < 0)
    ctx.fillRect(cx - minorHalfW - paveW, 0, (minorHalfW + paveW) * 2, cy);

    // 3. Clean Dark Slate Road Surface (#252b3b)
    ctx.fillStyle = '#252b3b';
    // Main Road (West-East)
    ctx.fillRect(0, cy - mainHalfW, 2048, mainHalfW * 2);
    // Minor Road (North arm)
    ctx.fillRect(cx - minorHalfW, 0, minorHalfW * 2, cy + 8);

    // Filleted junction bellmouth corners
    ctx.fillStyle = '#252b3b';
    ctx.beginPath();
    ctx.moveTo(cx - minorHalfW - 22, cy - mainHalfW);
    ctx.quadraticCurveTo(cx - minorHalfW, cy - mainHalfW, cx - minorHalfW, cy - mainHalfW - 22);
    ctx.lineTo(cx - minorHalfW, cy - mainHalfW);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + minorHalfW + 22, cy - mainHalfW);
    ctx.quadraticCurveTo(cx + minorHalfW, cy - mainHalfW, cx + minorHalfW, cy - mainHalfW - 22);
    ctx.lineTo(cx + minorHalfW, cy - mainHalfW);
    ctx.closePath();
    ctx.fill();

    // 4. Clean Subtle Kerb Edge Lines (#64748b)
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 4.0;
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

    // 5. Clean Thin White Lane Markings (#e2e8f0)
    ctx.strokeStyle = '#e2e8f0';
    ctx.fillStyle = '#e2e8f0';

    // Main Road Centre Dashed Line (West and East of junction)
    ctx.lineWidth = 3.2;
    ctx.setLineDash([3.6 * m2px, 2.2 * m2px]);
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(cx - minorHalfW - 1.6 * m2px, cy);
    ctx.moveTo(cx + minorHalfW + 1.6 * m2px, cy);
    ctx.lineTo(2048, cy);
    ctx.stroke();

    // Minor Road Centre Line (North)
    ctx.setLineDash([2.4 * m2px, 1.8 * m2px]);
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, cy - mainHalfW - 1.2 * m2px);
    ctx.stroke();

    // UK Diagram 1003 Double Dashed GIVE WAY Line across minor road mouth (z = -4.2m)
    ctx.setLineDash([0.65 * m2px, 0.42 * m2px]);
    ctx.lineWidth = 4.5;
    const giveWayY1 = cy - mainHalfW - 0.14 * m2px;
    const giveWayY2 = cy - mainHalfW - 0.46 * m2px;
    ctx.beginPath();
    ctx.moveTo(cx - minorHalfW + 6, giveWayY1);
    ctx.lineTo(cx - 2, giveWayY1);
    ctx.moveTo(cx - minorHalfW + 6, giveWayY2);
    ctx.lineTo(cx - 2, giveWayY2);
    ctx.stroke();
    ctx.setLineDash([]);

    // UK Painted Inverted White Triangle (Diagram 1023) in southbound emerging lane (x = -1.7m, z = -7.8m)
    const triX = cx - 1.7 * m2px;
    const triTopY = cy - 9.1 * m2px;
    const triApexY = cy - 6.1 * m2px;
    const triHalfW = 0.82 * m2px;
    ctx.lineWidth = 4.0;
    ctx.beginPath();
    ctx.moveTo(triX - triHalfW, triTopY);
    ctx.lineTo(triX + triHalfW, triTopY);
    ctx.lineTo(triX, triApexY);
    ctx.closePath();
    ctx.stroke();

    // 6. Subtle Directional Lane Arrows
    [-31, -21, -11, 10, 21, 32].forEach((xm) => {
      this._drawRoadArrow(ctx, cx + xm * m2px, cy + 2.1 * m2px, 0, 0.9);
    });
    [-28, -16, 8, 18, 29].forEach((xm) => {
      this._drawRoadArrow(ctx, cx + xm * m2px, cy - 2.1 * m2px, Math.PI, 0.9);
    });
    [-28, -18, -12].forEach((zm) => {
      this._drawRoadArrow(ctx, cx - 1.7 * m2px, cy + zm * m2px, Math.PI / 2, 0.88);
    });
    [-26, -16, -8.5].forEach((zm) => {
      this._drawRoadArrow(ctx, cx + 1.7 * m2px, cy + zm * m2px, -Math.PI / 2, 0.88);
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  }

  _buildProceduralRoadEnvironment() {
    this.environmentGroup.clear();

    // 1. Main 80m x 80m Junction Surface (Apple Maps clean dark slate road + urban block)
    const roadTex = this._createProceduralJunctionTexture(this.reportData);
    const groundGeo = new THREE.PlaneGeometry(80, 80);
    this.groundMaterial = new THREE.MeshStandardMaterial({
      map: roadTex,
      roughness: 0.85,
      metalness: 0.02,
    });
    const groundMesh = new THREE.Mesh(groundGeo, this.groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    this.environmentGroup.add(groundMesh);

    // 2. Outer Smooth Matte Slate-Grey Urban Block Skirt (#475267)
    const skirtGeo = new THREE.PlaneGeometry(260, 260);
    const skirtMat = new THREE.MeshStandardMaterial({
      color: 0x475267,
      roughness: 0.92,
      metalness: 0.02,
    });
    const skirtMesh = new THREE.Mesh(skirtGeo, skirtMat);
    skirtMesh.rotation.x = -Math.PI / 2;
    skirtMesh.position.y = -0.04;
    this.environmentGroup.add(skirtMesh);

    // 3. Crisp Raised Pavements (#56637a) with Soft Muted Sage-Green Grass Verges (#345947)
    const paveMat = new THREE.MeshStandardMaterial({
      color: 0x56637a,
      roughness: 0.88,
      metalness: 0.02,
    });
    const kerbMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.82,
      metalness: 0.03,
    });
    const vergeMat = new THREE.MeshStandardMaterial({
      color: 0x345947,
      roughness: 0.9,
      metalness: 0.02,
    });

    const addQuadrantVerge = (x, z, w, d) => {
      const pavementSlab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.11, d), paveMat);
      pavementSlab.position.set(x, 0.055, z);
      pavementSlab.receiveShadow = true;
      this.environmentGroup.add(pavementSlab);

      const grassVerge = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(1, w - 3.6), 0.03, Math.max(1, d - 3.6)),
        vergeMat
      );
      grassVerge.position.set(x, 0.12, z);
      grassVerge.receiveShadow = true;
      this.environmentGroup.add(grassVerge);
    };

    // NW, NE, and South open suburban/rural verges
    addQuadrantVerge(-21.7, -22.1, 36.2, 35.4);
    addQuadrantVerge(21.7, -22.1, 36.2, 35.4);
    addQuadrantVerge(0.0, 22.1, 79.6, 35.4);

    // 3D bevelled kerb strips along A521 & Draycott Cross Rd
    const southKerb = new THREE.Mesh(new THREE.BoxGeometry(80, 0.12, 0.18), kerbMat);
    southKerb.position.set(0, 0.06, 4.29);
    this.environmentGroup.add(southKerb);

    const nwKerbRoad = new THREE.Mesh(new THREE.BoxGeometry(36.4, 0.12, 0.18), kerbMat);
    nwKerbRoad.position.set(-21.8, 0.06, -4.29);
    this.environmentGroup.add(nwKerbRoad);

    const neKerbRoad = new THREE.Mesh(new THREE.BoxGeometry(36.4, 0.12, 0.18), kerbMat);
    neKerbRoad.position.set(21.8, 0.06, -4.29);
    this.environmentGroup.add(neKerbRoad);
  }

  _createUKSignTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    if (type === 'give_way') {
      ctx.clearRect(0, 0, 256, 256);
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
      ctx.font = 'bold 34px -apple-system, BlinkMacSystemFont, "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GIVE', 128, 86);
      ctx.fillText('WAY', 128, 126);
    } else if (type === 'speed_30' || type === 'speed_60') {
      const speedText = type === 'speed_60' ? '60' : '30';
      ctx.clearRect(0, 0, 256, 256);
      ctx.beginPath();
      ctx.arc(128, 128, 108, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 26;
      ctx.strokeStyle = '#dc2626';
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 104px -apple-system, BlinkMacSystemFont, "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(speedText, 128, 134);
    } else if (type === 'warning_triangle') {
      // UK TSRGD Diagram 504.1 / 512 Upward Red Warning Triangle (Crossroads / Bend Warning)
      ctx.clearRect(0, 0, 256, 256);
      ctx.beginPath();
      ctx.moveTo(128, 24);
      ctx.lineTo(238, 224);
      ctx.lineTo(18, 224);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 22;
      ctx.strokeStyle = '#dc2626';
      ctx.stroke();

      // Priority Crossroad / Hazard Symbol inside triangle
      ctx.strokeStyle = '#09090b';
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.moveTo(128, 92);
      ctx.lineTo(128, 196);
      ctx.moveTo(86, 144);
      ctx.lineTo(170, 144);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  _buildNWResidentialHouse(x, z) {
    // Apple Maps 3D monolithic matte slate-blue-grey architectural massing on NW corner (x = -13, z = -13)
    const houseGroup = new THREE.Group();
    houseGroup.position.set(x, 0.14, z);

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x515e78,
      roughness: 0.90,
      metalness: 0.02,
    });
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x475267,
      roughness: 0.92,
      metalness: 0.02,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x5d6b86,
      roughness: 0.88,
      metalness: 0.03,
    });

    const w = 9.2;
    const h = 5.6;
    const d = 7.4;

    // Ground plinth course
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.36, d + 0.16), plinthMat);
    plinth.position.y = 0.18;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    houseGroup.add(plinth);

    // Main monolithic architectural mass
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    walls.position.y = h / 2;
    walls.castShadow = true;
    walls.receiveShadow = true;
    houseGroup.add(walls);

    // Secondary stepped architectural wing on West side for Apple Maps 3D massing depth
    const wingW = 3.8;
    const wingH = 4.2;
    const wingD = 5.4;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(wingW, wingH, wingD), wallMat);
    wing.position.set(-w / 2 - wingW / 2 + 0.2, wingH / 2, -0.5);
    wing.castShadow = true;
    wing.receiveShadow = true;
    houseGroup.add(wing);

    const wingRoof = new THREE.Mesh(
      new THREE.BoxGeometry(wingW + 0.18, 0.18, wingD + 0.18),
      roofMat
    );
    wingRoof.position.set(-w / 2 - wingW / 2 + 0.2, wingH + 0.09, -0.5);
    wingRoof.castShadow = true;
    wingRoof.receiveShadow = true;
    houseGroup.add(wingRoof);

    // Flat roof deck with subtle raised parapet edge (#5d6b86)
    const roofDeck = new THREE.Mesh(new THREE.BoxGeometry(w - 0.24, 0.14, d - 0.24), plinthMat);
    roofDeck.position.y = h + 0.04;
    roofDeck.receiveShadow = true;
    houseGroup.add(roofDeck);

    const parapetThick = 0.24;
    const parapetH = 0.28;
    const northParapet = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.16, parapetH, parapetThick),
      roofMat
    );
    northParapet.position.set(0, h + parapetH / 2, -d / 2);
    const southParapet = northParapet.clone();
    southParapet.position.set(0, h + parapetH / 2, d / 2);

    const eastParapet = new THREE.Mesh(
      new THREE.BoxGeometry(parapetThick, parapetH, d + 0.16),
      roofMat
    );
    eastParapet.position.set(w / 2, h + parapetH / 2, 0);
    const westParapet = eastParapet.clone();
    westParapet.position.set(-w / 2, h + parapetH / 2, 0);

    houseGroup.add(northParapet, southParapet, eastParapet, westParapet);

    return houseGroup;
  }

  _buildSouthGardenBoundaryWall() {
    // Clean Apple Maps 3D low garden boundary wall (height ~ 0.95m with coping cap) on the southern corner
    const wallGroup = new THREE.Group();

    const masonryMat = new THREE.MeshStandardMaterial({
      color: 0x515e78,
      roughness: 0.90,
      metalness: 0.02,
    });
    const copingMat = new THREE.MeshStandardMaterial({
      color: 0x5d6b86,
      roughness: 0.86,
      metalness: 0.03,
    });

    const wallLength = 14.0; // x from -16 to -2 (center at x = -9.0)
    const wallHeight = 0.88;
    const wallThick = 0.28;

    const mainWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallLength, wallHeight, wallThick),
      masonryMat
    );
    mainWall.position.set(-9.0, 0.11 + wallHeight / 2, 5.2);
    mainWall.castShadow = true;
    mainWall.receiveShadow = true;
    wallGroup.add(mainWall);

    // Coping cap along the top of the wall (~0.95m total height)
    const copingCap = new THREE.Mesh(
      new THREE.BoxGeometry(wallLength + 0.12, 0.08, wallThick + 0.08),
      copingMat
    );
    copingCap.position.set(-9.0, 0.11 + wallHeight + 0.04, 5.2);
    copingCap.castShadow = true;
    wallGroup.add(copingCap);

    // Masonry gate piers at x = -16, -9, and -2
    [-16.0, -9.0, -2.0].forEach((px) => {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.02, 0.42), masonryMat);
      pier.position.set(px, 0.11 + 0.51, 5.2);
      pier.castShadow = true;
      wallGroup.add(pier);

      const pierCap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, 0.5), copingMat);
      pierCap.position.set(px, 0.11 + 1.06, 5.2);
      wallGroup.add(pierCap);
    });

    // Short return wall at x = -2.0 heading south into driveway (z = 5.2 to 8.4)
    const returnWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallHeight, 3.2), masonryMat);
    returnWall.position.set(-2.0, 0.11 + wallHeight / 2, 6.8);
    returnWall.castShadow = true;
    wallGroup.add(returnWall);

    const returnCoping = new THREE.Mesh(
      new THREE.BoxGeometry(wallThick + 0.08, 0.08, 3.26),
      copingMat
    );
    returnCoping.position.set(-2.0, 0.11 + wallHeight + 0.04, 6.8);
    wallGroup.add(returnCoping);

    return wallGroup;
  }

  _buildCausalJunctionProps(report = null) {
    this.causalPropsGroup.clear();
    this.knockableSignRef = null;

    const postMat = new THREE.MeshStandardMaterial({
      color: 0xa1a1aa,
      metalness: 0.4,
      roughness: 0.5,
    });

    // Helper to place a 3D UK Traffic Sign on a cylindrical post with a floating TSRGD pill
    const addTrafficSignPost = (x, z, signType, pillText, pillAccent, boardRotY = 0) => {
      const signGroup = new THREE.Group();
      signGroup.position.set(x, 0, z);

      // Pivot group at the base of the sign post so post-impact strikes bend the pole from ground level
      const postPivot = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.45, 12), postMat);
      post.position.y = 1.225;
      post.castShadow = true;
      postPivot.add(post);
      signGroup.add(postPivot);

      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(0.85, 0.85),
        new THREE.MeshBasicMaterial({
          map: this._createUKSignTexture(signType),
          transparent: true,
          side: THREE.DoubleSide,
        })
      );
      board.position.set(0, 2.28, 0.06);
      board.rotation.y = boardRotY;
      board.userData.baseRotY = boardRotY;
      signGroup.add(board);

      const pill = this._createLabelSprite(pillText, pillAccent, 'rgba(18, 18, 21, 0.92)');
      pill.position.set(0, 3.18, 0);
      pill.scale.set(4.2, 0.84, 1);
      signGroup.add(pill);

      if (!this.knockableSignRef) {
        this.knockableSignRef = {
          signGroup,
          postPivot,
          board,
          pill,
          baseRotY: boardRotY,
        };
      }

      this.causalPropsGroup.add(signGroup);
    };

    // Dynamically extract road signs from agent report (`scene_environment_elements`) if present
    const envElements = Array.isArray(report?.scene_environment_elements)
      ? report.scene_environment_elements
      : [];
    const signElements = envElements.filter((el) => {
      const t = String(el.element_type || '').toLowerCase();
      return (
        el.is_causal !== false &&
        (t.includes('sign') || t.includes('give_way') || t.includes('speed_limit') || t.includes('warning'))
      );
    });

    if (signElements.length > 0) {
      signElements.forEach((el) => {
        const raw = `${el.element_type || ''} ${el.label || ''} ${el.tsrgd_diagram || ''}`.toLowerCase();
        let signType = 'give_way';
        let accent = '#ef4444';
        let rotY = 0;
        if (raw.includes('60')) {
          signType = 'speed_60';
          accent = '#f59e0b';
          rotY = Math.PI / 2;
        } else if (raw.includes('30') || raw.includes('speed')) {
          signType = 'speed_30';
          accent = '#f59e0b';
          rotY = Math.PI / 2;
        } else if (raw.includes('504') || raw.includes('crossroad') || raw.includes('warning') || raw.includes('bend')) {
          signType = 'warning_triangle';
          accent = '#f59e0b';
          rotY = Math.PI / 2;
        }
        const shortLabel = (el.tsrgd_diagram || el.label || 'UK Traffic Sign')
          .replace(/^TSRGD 2016\s*/i, '')
          .slice(0, 34);
        addTrafficSignPost(
          el.x_meters ?? -3.6,
          el.z_meters ?? -4.5,
          signType,
          shortLabel,
          accent,
          rotY
        );
      });
    } else {
      // Default Cheadle A521 / Draycott Cross Rd signs
      addTrafficSignPost(-3.6, -4.5, 'give_way', 'Give Way (Diagram 602/1003)', '#ef4444', 0);
      addTrafficSignPost(-14.0, 4.8, 'speed_30', '30 mph Limit (Diagram 670)', '#f59e0b', Math.PI / 2);
    }

    // 3. Monolithic Residential Building Massing set back on NW Corner (x = -13, z = -13)
    const nwHouse = this._buildNWResidentialHouse(-13.0, -13.0);
    this.causalPropsGroup.add(nwHouse);

    // 4. Low Southern Garden Boundary Wall with Coping Cap (x: -16 to -2, z = 5.2)
    const southWall = this._buildSouthGardenBoundaryWall();
    this.causalPropsGroup.add(southWall);

    // 5. NW Corner Smooth Rounded Hedgerow & Trees (Sightline Blocker — no orange wireframe clutter)
    const hedgeGroup = new THREE.Group();
    const hedgeMat = new THREE.MeshStandardMaterial({
      color: 0x2c4c3c,
      roughness: 0.9,
      metalness: 0.02,
    });
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x345947,
      roughness: 0.88,
      metalness: 0.02,
    });

    const mainHedgeBase = new THREE.Mesh(new THREE.BoxGeometry(6.8, 1.45, 1.3), hedgeMat);
    mainHedgeBase.position.set(-7.6, 0.725, -5.1);
    mainHedgeBase.castShadow = true;
    mainHedgeBase.receiveShadow = true;
    hedgeGroup.add(mainHedgeBase);

    const mainHedgeTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.65, 6.8, 18),
      hedgeMat
    );
    mainHedgeTop.rotation.z = Math.PI / 2;
    mainHedgeTop.position.set(-7.6, 1.45, -5.1);
    mainHedgeTop.castShadow = true;
    hedgeGroup.add(mainHedgeTop);

    const sideHedgeBase = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.45, 6.2), hedgeMat);
    sideHedgeBase.position.set(-4.4, 0.725, -8.2);
    sideHedgeBase.castShadow = true;
    sideHedgeBase.receiveShadow = true;
    hedgeGroup.add(sideHedgeBase);

    const sideHedgeTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.65, 6.2, 18),
      hedgeMat
    );
    sideHedgeTop.rotation.x = Math.PI / 2;
    sideHedgeTop.position.set(-4.4, 1.45, -8.2);
    sideHedgeTop.castShadow = true;
    hedgeGroup.add(sideHedgeTop);

    const cornerCrown = new THREE.Mesh(new THREE.SphereGeometry(0.95, 20, 16), canopyMat);
    cornerCrown.position.set(-4.55, 1.35, -5.2);
    cornerCrown.scale.set(1.1, 1.15, 1.1);
    cornerCrown.castShadow = true;
    hedgeGroup.add(cornerCrown);

    const treeCrown1 = new THREE.Mesh(new THREE.SphereGeometry(1.25, 20, 16), canopyMat);
    treeCrown1.position.set(-6.4, 2.35, -5.3);
    treeCrown1.scale.set(1.0, 1.18, 1.0);
    treeCrown1.castShadow = true;
    hedgeGroup.add(treeCrown1);

    this.causalPropsGroup.add(hedgeGroup);
  }

  _buildNonCausalStrippedClutter() {
    this.nonCausalClutterGroup.clear();

    const ghostMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      wireframe: true,
      transparent: true,
      opacity: 0.42,
    });

    const items = [
      {
        pos: [14.5, 0.75, 6.2],
        size: [4.1, 1.45, 1.8],
        label: 'Stripped #1 • Non-Involved Parked Car',
      },
      {
        pos: [19.2, 1.15, -2.0],
        size: [5.4, 2.2, 2.1],
        label: 'Stripped #3 • Distant Background Van',
      },
      {
        pos: [-12.5, 0.6, 6.5],
        size: [1.6, 1.2, 1.4],
        label: 'Stripped #3 • Kerbside Bins / Clutter',
      },
    ];

    items.forEach((item) => {
      const grp = new THREE.Group();
      grp.position.set(item.pos[0], item.pos[1], item.pos[2]);
      const box = new THREE.Mesh(new THREE.BoxGeometry(...item.size), ghostMat);
      grp.add(box);

      const sprite = this._createLabelSprite(
        item.label,
        '#ef4444',
        'rgba(18, 18, 21, 0.92)'
      );
      sprite.position.set(0, item.size[1] / 2 + 0.9, 0);
      sprite.scale.set(5.0, 1.0, 1);
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

    // 28 Ballistic Crash Debris Shards (shattered glass, dark bumper trim, painted body splinters)
    this.debrisGroup = new THREE.Group();
    this.debrisGroup.visible = false;
    this.debrisMeshes = [];

    const glassShardMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.15,
      metalness: 0.85,
      transparent: true,
      opacity: 0.88,
    });
    const trimShardMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.75,
      metalness: 0.2,
    });
    this.debrisMatBodyA = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      roughness: 0.32,
      metalness: 0.5,
    });
    this.debrisMatBodyB = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      roughness: 0.32,
      metalness: 0.5,
    });

    const shardGeos = [
      new THREE.DodecahedronGeometry(0.11, 0),
      new THREE.BoxGeometry(0.24, 0.05, 0.16),
      new THREE.TetrahedronGeometry(0.13, 0),
    ];

    for (let i = 0; i < 28; i++) {
      const mat =
        i % 4 === 0
          ? glassShardMat
          : i % 4 === 1
            ? trimShardMat
            : i % 4 === 2
              ? this.debrisMatBodyA
              : this.debrisMatBodyB;
      const mesh = new THREE.Mesh(shardGeos[i % shardGeos.length], mat);
      mesh.castShadow = true;
      this.debrisGroup.add(mesh);
      this.debrisMeshes.push(mesh);
    }
    this.effectsGroup.add(this.debrisGroup);

    // 12 Billowing Verge Dust / Smoke Plume Spheres
    this.dustPlumeGroup = new THREE.Group();
    this.dustPlumeGroup.visible = false;
    this.dustPuffMeshes = [];
    const puffGeo = new THREE.SphereGeometry(0.45, 14, 12);
    for (let i = 0; i < 12; i++) {
      const puffMat = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0x94a3b8 : 0x64748b,
        roughness: 0.96,
        metalness: 0.0,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      });
      const puffMesh = new THREE.Mesh(puffGeo, puffMat);
      this.dustPlumeGroup.add(puffMesh);
      this.dustPuffMeshes.push(puffMesh);
    }
    this.effectsGroup.add(this.dustPlumeGroup);
  }

  _createLabelSprite(
    text,
    accentColor = '#38bdf8',
    bgColor = 'rgba(18, 18, 21, 0.92)'
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = 576;
    canvas.height = 112;
    const ctx = canvas.getContext('2d');

    const drawPill = (str) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Sleek Monochrome Dark-Zinc Pill with Subtle White Border
      const pillX = 10;
      const pillY = 12;
      const pillW = canvas.width - 20;
      const pillH = canvas.height - 24;
      const radius = pillH / 2;

      ctx.save();
      ctx.fillStyle = bgColor;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, radius);
      ctx.fill();
      ctx.stroke();

      // Left Circular Status / Vehicle Badge
      const dotX = pillX + radius;
      const dotY = pillY + radius;
      const dotR = 22;

      ctx.beginPath();
      ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
      ctx.fillStyle = accentColor;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(dotX, dotY, 6.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Crisp White Typography
      ctx.fillStyle = '#f4f4f5';
      ctx.font =
        '600 24px -apple-system, BlinkMacSystemFont, "Inter", "Space Grotesk", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(str, dotX + dotR + 16, dotY + 1, pillW - (dotR * 2 + 44));
      ctx.restore();
    };

    drawPill(text);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.userData.updateLabel = (newStr) => {
      if (sprite.userData.lastText === newStr) return;
      sprite.userData.lastText = newStr;
      drawPill(newStr);
      tex.needsUpdate = true;
    };
    return sprite;
  }

  _createLicensePlateTexture(plateText, isRearYellow = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // UK BS AU 145e plate styling: white front (#f8fafc) or yellow rear (#facc15) with blue UK badge strip
    ctx.fillStyle = isRearYellow ? '#eab308' : '#f4f4f5';
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(2, 2, 252, 60, 6);
    ctx.fill();
    ctx.stroke();

    // Left UK blue sidebar
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(4, 4, 28, 56);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 13px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('UK', 18, 46);

    // Registration characters
    ctx.fillStyle = '#09090b';
    ctx.font = '800 34px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(plateText || 'UK 24', 142, 34);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  _resolveVehicleCategory(vehicle) {
    const raw = `${vehicle.body_type || ''} ${vehicle.type || ''} ${vehicle.label || ''} ${vehicle.vehicle_id || ''}`.toLowerCase();
    if (
      raw.includes('hgv') ||
      raw.includes('lorry') ||
      raw.includes('truck') ||
      raw.includes('artic') ||
      raw.includes('daf')
    ) {
      return 'hgv';
    }
    if (
      raw.includes('suv') ||
      raw.includes('peugeot') ||
      raw.includes('2008') ||
      raw.includes('evoque') ||
      raw.includes('range rover') ||
      raw.includes('crossover') ||
      vehicle.vehicle_id === 'vehicle_a'
    ) {
      return 'suv';
    }
    return 'hatchback';
  }

  _buildDetailedWheel(radius = 0.34, tireWidth = 0.23) {
    const wheelGroup = new THREE.Group();

    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x141518,
      roughness: 0.88,
      metalness: 0.05,
    });
    const alloyMat = new THREE.MeshStandardMaterial({
      color: 0xd4d4d8,
      roughness: 0.26,
      metalness: 0.78,
    });
    const darkHubMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.45,
      metalness: 0.5,
    });

    // Main rubber tire cylinder
    const tireGeo = new THREE.CylinderGeometry(radius, radius, tireWidth, 24);
    tireGeo.rotateZ(Math.PI / 2);
    const tireMesh = new THREE.Mesh(tireGeo, tireMat);
    tireMesh.castShadow = true;
    wheelGroup.add(tireMesh);

    // Recessed brake rotor hub
    const hubGeo = new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, tireWidth * 0.96, 18);
    hubGeo.rotateZ(Math.PI / 2);
    wheelGroup.add(new THREE.Mesh(hubGeo, darkHubMat));

    // Outer & inner alloy rim rings + 5 metallic spokes
    const rimRadius = radius * 0.64;
    const spokeGeo = new THREE.BoxGeometry(tireWidth + 0.015, rimRadius * 1.75, 0.048);
    for (let i = 0; i < 5; i++) {
      const spoke = new THREE.Mesh(spokeGeo, alloyMat);
      spoke.rotation.x = (i * Math.PI) / 5;
      wheelGroup.add(spoke);
    }

    const capGeo = new THREE.CylinderGeometry(radius * 0.2, radius * 0.2, tireWidth + 0.022, 14);
    capGeo.rotateZ(Math.PI / 2);
    wheelGroup.add(new THREE.Mesh(capGeo, alloyMat));

    return wheelGroup;
  }

  _buildVehicleMesh(vehicle) {
    const rootGroup = new THREE.Group();
    const bodyTiltGroup = new THREE.Group();
    rootGroup.add(bodyTiltGroup);

    const category = this._resolveVehicleCategory(vehicle);
    const paintColor = new THREE.Color(vehicle.color_hex || '#2563EB');

    const bodyMat = new THREE.MeshStandardMaterial({
      color: paintColor,
      metalness: 0.42,
      roughness: 0.28,
    });
    const lowerTrimMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.78,
      metalness: 0.12,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x111318,
      metalness: 0.75,
      roughness: 0.12,
    });

    // Helper: extrudes a 2D side-profile Shape (x = longitudinal Z from front -L/2 to rear +L/2, y = height Y)
    // across the vehicle width X with smooth 5-segment aerodynamic bevels
    const extrudeProfileToMesh = (shape, totalWidth, material, bevelThickness = 0.12, bevelSize = 0.08) => {
      const coreDepth = Math.max(0.2, totalWidth - bevelThickness * 2);
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: coreDepth,
        bevelEnabled: true,
        bevelThickness,
        bevelSize,
        bevelSegments: 5,
        curveSegments: 18,
      });
      geo.translate(0, 0, -coreDepth / 2);
      geo.rotateY(-Math.PI / 2);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    };

    let length = 4.32;
    let width = 1.82;
    const wheels = [];

    if (category === 'hgv') {
      length = 8.4;
      width = 2.42;

      // 1. Contoured HGV Tractor Cab Profile with Rounded Roof Wind Deflector
      const cabShape = new THREE.Shape();
      cabShape.moveTo(-4.1, 0.35);
      cabShape.quadraticCurveTo(-4.2, 0.75, -4.12, 1.35); // Lower grille
      cabShape.quadraticCurveTo(-4.02, 2.15, -3.72, 2.65); // Raked windshield
      cabShape.quadraticCurveTo(-3.35, 3.25, -2.25, 3.38); // Curved aero wind deflector
      cabShape.lineTo(-1.85, 3.38);
      cabShape.lineTo(-1.85, 0.35);
      cabShape.closePath();

      const cabMesh = extrudeProfileToMesh(cabShape, width, bodyMat, 0.12, 0.08);
      bodyTiltGroup.add(cabMesh);

      // Cab recessed wrap-around windshield & side windows
      const cabWinShape = new THREE.Shape();
      cabWinShape.moveTo(-4.02, 1.48);
      cabWinShape.quadraticCurveTo(-3.92, 2.12, -3.65, 2.55);
      cabWinShape.lineTo(-2.15, 2.55);
      cabWinShape.lineTo(-2.15, 1.48);
      cabWinShape.closePath();
      const cabWinMesh = extrudeProfileToMesh(cabWinShape, width + 0.02, glassMat, 0.06, 0.04);
      bodyTiltGroup.add(cabWinMesh);

      // 2. Contoured Articulated Box Trailer with Bevelled Edges
      const trailerShape = new THREE.Shape();
      trailerShape.moveTo(-1.45, 0.95);
      trailerShape.lineTo(-1.45, 3.42);
      trailerShape.lineTo(4.05, 3.42);
      trailerShape.lineTo(4.05, 0.95);
      trailerShape.closePath();
      const trailerMat = new THREE.MeshStandardMaterial({
        color: 0xe4e4e7,
        roughness: 0.55,
        metalness: 0.15,
      });
      const trailerMesh = extrudeProfileToMesh(trailerShape, width, trailerMat, 0.1, 0.06);
      bodyTiltGroup.add(trailerMesh);

      // Chassis rails
      const railMesh = new THREE.Mesh(new THREE.BoxGeometry(width * 0.78, 0.36, 7.8), lowerTrimMat);
      railMesh.position.set(0, 0.62, 0);
      bodyTiltGroup.add(railMesh);

      const hgwWheelCoords = [
        [-width / 2, 0.44, -3.05],
        [width / 2, 0.44, -3.05],
        [-width / 2, 0.44, -0.85],
        [width / 2, 0.44, -0.85],
        [-width / 2, 0.44, 2.65],
        [width / 2, 0.44, 2.65],
      ];
      hgwWheelCoords.forEach(([wx, wy, wz]) => {
        const w = this._buildDetailedWheel(0.44, 0.28);
        w.position.set(wx, wy, wz);
        bodyTiltGroup.add(w);
        wheels.push(w);
      });
    } else if (category === 'suv') {
      // Contoured Crossover SUV Profile (Peugeot 2008 / Range Rover Evoque proportions)
      length = 4.35;
      width = 1.84;

      const suvShape = new THREE.Shape();
      // Start at front lower bumper splitter (-2.08m)
      suvShape.moveTo(-2.06, 0.28);
      // Front bumper & upright SUV grille
      suvShape.quadraticCurveTo(-2.18, 0.52, -2.08, 0.84);
      // Sculpted clamshell bonnet / hood
      suvShape.quadraticCurveTo(-1.62, 0.96, -1.02, 1.02);
      // Raked A-pillar windshield
      suvShape.quadraticCurveTo(-0.62, 1.38, -0.28, 1.56);
      // Contoured SUV roofline
      suvShape.quadraticCurveTo(0.45, 1.61, 1.35, 1.54);
      // Rear roof spoiler & C-pillar tailgate
      suvShape.quadraticCurveTo(1.78, 1.36, 1.98, 1.04);
      // Rear tailgate & rounded bumper
      suvShape.quadraticCurveTo(2.16, 0.72, 2.04, 0.30);
      suvShape.lineTo(-2.06, 0.28);
      suvShape.closePath();

      const bodyMesh = extrudeProfileToMesh(suvShape, width, bodyMat, 0.12, 0.08);
      bodyTiltGroup.add(bodyMesh);

      // Recessed Dark-Tinted Side Window Greenhouse (DLO) & Windshield Wrap
      const dloShape = new THREE.Shape();
      dloShape.moveTo(-1.05, 1.03);
      dloShape.quadraticCurveTo(-0.62, 1.36, -0.26, 1.49);
      dloShape.quadraticCurveTo(0.45, 1.53, 1.28, 1.47);
      dloShape.quadraticCurveTo(1.66, 1.32, 1.82, 1.05);
      dloShape.lineTo(-1.05, 1.03);
      dloShape.closePath();

      const dloMesh = extrudeProfileToMesh(dloShape, width + 0.015, glassMat, 0.06, 0.04);
      bodyTiltGroup.add(dloMesh);

      // Lower anthracite SUV sill & wheel-arch cladding skirt
      const sillMesh = new THREE.Mesh(
        new THREE.BoxGeometry(width - 0.06, 0.14, length * 0.86),
        lowerTrimMat
      );
      sillMesh.position.set(0, 0.29, 0);
      bodyTiltGroup.add(sillMesh);

      // Subtle SUV satin roof rails
      const railGeo = new THREE.BoxGeometry(0.04, 0.045, 1.45);
      const railMat = new THREE.MeshStandardMaterial({ color: 0xa1a1aa, metalness: 0.7, roughness: 0.3 });
      [-width * 0.34, width * 0.34].forEach((rx) => {
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.position.set(rx, 1.66, 0.45);
        bodyTiltGroup.add(rail);
      });
    } else {
      // Sleek Contoured Fastback / Hatchback Profile (VW Golf / Ford Focus / Vauxhall Astra)
      length = 4.26;
      width = 1.79;

      const hatchShape = new THREE.Shape();
      // Front lower splitter (-2.04m)
      hatchShape.moveTo(-2.02, 0.24);
      // Rounded front nose & low grille
      hatchShape.quadraticCurveTo(-2.15, 0.44, -2.02, 0.68);
      // Low aerodynamic sloping bonnet
      hatchShape.quadraticCurveTo(-1.55, 0.84, -0.94, 0.91);
      // Sleek raked A-pillar windshield
      hatchShape.quadraticCurveTo(-0.48, 1.25, -0.10, 1.40);
      // Sweeping coupé-hatchback roof arch
      hatchShape.quadraticCurveTo(0.52, 1.44, 1.18, 1.37);
      // Raked C-pillar & hatchback glass tailgate
      hatchShape.quadraticCurveTo(1.68, 1.16, 1.94, 0.88);
      // Sculpted rear bumper valence
      hatchShape.quadraticCurveTo(2.12, 0.56, 1.98, 0.26);
      hatchShape.lineTo(-2.02, 0.24);
      hatchShape.closePath();

      const bodyMesh = extrudeProfileToMesh(hatchShape, width, bodyMat, 0.12, 0.08);
      bodyTiltGroup.add(bodyMesh);

      // Recessed Dark-Tinted Window Greenhouse (DLO) & Windshield Wrap
      const dloShape = new THREE.Shape();
      dloShape.moveTo(-0.98, 0.92);
      dloShape.quadraticCurveTo(-0.48, 1.23, -0.08, 1.34);
      dloShape.quadraticCurveTo(0.50, 1.37, 1.12, 1.31);
      dloShape.quadraticCurveTo(1.56, 1.14, 1.76, 0.92);
      dloShape.lineTo(-0.98, 0.92);
      dloShape.closePath();

      const dloMesh = extrudeProfileToMesh(dloShape, width + 0.015, glassMat, 0.06, 0.04);
      bodyTiltGroup.add(dloMesh);

      // Lower sill diffuser trim
      const sillMesh = new THREE.Mesh(
        new THREE.BoxGeometry(width - 0.08, 0.11, length * 0.84),
        lowerTrimMat
      );
      sillMesh.position.set(0, 0.25, 0);
      bodyTiltGroup.add(sillMesh);
    }

    // 4 Detailed Multi-Spoke Wheels for SUV / Hatchback
    if (category !== 'hgv') {
      const wheelRadius = category === 'suv' ? 0.36 : 0.33;
      const wheelZFront = -length * 0.315;
      const wheelZRear = length * 0.315;
      const wheelPositions = [
        [-width / 2 + 0.04, wheelRadius, wheelZFront],
        [width / 2 - 0.04, wheelRadius, wheelZFront],
        [-width / 2 + 0.04, wheelRadius, wheelZRear],
        [width / 2 - 0.04, wheelRadius, wheelZRear],
      ];
      wheelPositions.forEach(([wx, wy, wz]) => {
        const wGrp = this._buildDetailedWheel(wheelRadius, 0.23);
        wGrp.position.set(wx, wy, wz);
        bodyTiltGroup.add(wGrp);
        wheels.push(wGrp);
      });
    }

    // Aerodynamic Wing Mirrors on Left & Right Doors
    const mirrorGeo = new THREE.BoxGeometry(0.18, 0.11, 0.14);
    const mirrorY = category === 'suv' ? 1.06 : category === 'hgv' ? 1.85 : 0.95;
    const mirrorZ = category === 'hgv' ? -3.55 : -0.62;
    [-1, 1].forEach((side) => {
      const mirror = new THREE.Mesh(mirrorGeo, bodyMat);
      mirror.position.set(side * (width / 2 + 0.06), mirrorY, mirrorZ);
      mirror.rotation.y = side * -0.18;
      bodyTiltGroup.add(mirror);
    });

    // UK Front White & Rear Yellow Registration Plates
    const plateText = vehicle.registration_plate || 'UK 24';
    const plateGeo = new THREE.PlaneGeometry(0.52, 0.12);

    const frontPlateMesh = new THREE.Mesh(
      plateGeo,
      new THREE.MeshBasicMaterial({
        map: this._createLicensePlateTexture(plateText, false),
        side: THREE.DoubleSide,
      })
    );
    frontPlateMesh.position.set(0, category === 'suv' ? 0.48 : 0.42, -length / 2 - 0.09);
    frontPlateMesh.rotation.y = Math.PI;
    bodyTiltGroup.add(frontPlateMesh);

    const rearPlateMesh = new THREE.Mesh(
      plateGeo,
      new THREE.MeshBasicMaterial({
        map: this._createLicensePlateTexture(plateText, true),
        side: THREE.DoubleSide,
      })
    );
    rearPlateMesh.position.set(0, category === 'suv' ? 0.62 : 0.52, length / 2 + 0.09);
    bodyTiltGroup.add(rearPlateMesh);

    // Front LED Headlamps + Subtle Light Cones
    const headLightMat = new THREE.MeshBasicMaterial({ color: 0xfafafa });
    const hlGeo = new THREE.BoxGeometry(0.32, 0.12, 0.08);
    const hlY = category === 'suv' ? 0.78 : 0.64;
    const hlLeft = new THREE.Mesh(hlGeo, headLightMat);
    hlLeft.position.set(-width * 0.33, hlY, -length / 2 - 0.04);
    const hlRight = hlLeft.clone();
    hlRight.position.x = width * 0.33;
    bodyTiltGroup.add(hlLeft, hlRight);

    const coneGeo = new THREE.ConeGeometry(0.95, 3.8, 16, 1, true);
    coneGeo.rotateX(Math.PI / 2);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xf4f4f5,
      transparent: true,
      opacity: 0.07,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const coneMesh = new THREE.Mesh(coneGeo, coneMat);
    coneMesh.position.set(0, 0.55, -length / 2 - 1.9);
    bodyTiltGroup.add(coneMesh);

    // Rear Emissive Crimson LED Tail / Brake Light Clusters
    const brakeLightMat = new THREE.MeshStandardMaterial({
      color: 0x7f1d1d,
      emissive: 0xef4444,
      emissiveIntensity: 0.25,
      roughness: 0.2,
    });
    const blGeo = new THREE.BoxGeometry(0.36, 0.13, 0.08);
    const blY = category === 'suv' ? 0.88 : 0.74;
    const blLeft = new THREE.Mesh(blGeo, brakeLightMat);
    blLeft.position.set(-width * 0.33, blY, length / 2 + 0.04);
    const blRight = blLeft.clone();
    blRight.position.x = width * 0.33;
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

    // Floating Monochrome Dark-Zinc Pill Sprite
    const badgeColor = vehicle.vehicle_id === 'vehicle_a' ? '#3b82f6' : '#f97316';
    const labelSprite = this._createLabelSprite(
      `${vehicle.registration_plate} • 0.0 mph`,
      badgeColor,
      'rgba(18, 18, 21, 0.92)'
    );
    labelSprite.position.set(0, 2.45, 0);
    labelSprite.scale.set(4.8, 0.94, 1);
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

  _createDetailedVehicleMesh(vehicle) {
    return this._buildVehicleMesh(vehicle);
  }

  loadCaseData(report) {
    this.reportData = report;
    this.vehiclesGroup.clear();
    this.trajectoriesGroup.clear();
    this.camerasGroup.clear();
    this.vehicleMeshes.clear();

    if (!report || !Array.isArray(report.vehicles)) return;

    // Refresh procedural junction texture and 3D UK traffic signs dynamically for this report
    if (this.groundMaterial) {
      if (this.groundMaterial.map) this.groundMaterial.map.dispose();
      this.groundMaterial.map = this._createProceduralJunctionTexture(report);
      this.groundMaterial.needsUpdate = true;
    }
    this._buildCausalJunctionProps(report);

    // Position Impact Ring & Beacon at report's impact coordinates
    const ix = report.impact_x_meters ?? 0.0;
    const iz = report.impact_z_meters ?? 0.2;
    this.impactRingMesh.position.set(ix, 0.06, iz);
    this.impactBeacon.position.set(ix, 2.25, iz);

    // Build vehicles & trajectory ribbons strictly within observed video window [0, duration_seconds]
    const maxVideoDuration = Number(report.duration_seconds) || 4.5;
    this.continuousTrajectory = buildContinuousPhysicsTrajectory(report);

    report.vehicles.forEach((vehicle) => {
      const vObj = this._buildVehicleMesh(vehicle);
      this.vehiclesGroup.add(vObj.rootGroup);
      this.vehicleMeshes.set(vehicle.vehicle_id, vObj);

      // Trajectory ribbon on roadway (bounded strictly to observed video keyframes)
      if (Array.isArray(vehicle.keyframes) && vehicle.keyframes.length >= 2) {
        const boundedKfs = vehicle.keyframes.filter(
          (kf) => kf.timestamp_sec >= 0 && kf.timestamp_sec <= maxVideoDuration + 0.05
        );
        const pts = (boundedKfs.length >= 2 ? boundedKfs : vehicle.keyframes).map(
          (kf) => new THREE.Vector3(kf.x_meters, 0.06, kf.z_meters)
        );
        const curve = new THREE.CatmullRomCurve3(pts);
        const tubeGeo = new THREE.TubeGeometry(curve, 64, 0.09, 8, false);
        const tubeMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(vehicle.color_hex || '#38bdf8'),
          transparent: true,
          opacity: 0.55,
        });
        this.trajectoriesGroup.add(new THREE.Mesh(tubeGeo, tubeMat));
      }
    });

    // Color debris shards to match the two vehicles in this case
    if (this.debrisMatBodyA && report.vehicles[0]?.color_hex) {
      this.debrisMatBodyA.color.set(report.vehicles[0].color_hex);
    }
    if (this.debrisMatBodyB && report.vehicles[1]?.color_hex) {
      this.debrisMatBodyB.color.set(report.vehicles[1].color_hex);
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

  setTime(timeSec) {
    return this.updateAtTime(timeSec);
  }

  updateAtTime(timestampSec) {
    this.currentTime = timestampSec;
    if (!this.reportData) return null;

    const telemetrySnapshot = {};
    const positions = {};

    // 1. Interpolate raw keyframe states
    this.vehicleMeshes.forEach((vObj, vehicleId) => {
      telemetrySnapshot[vehicleId] = this._interpolateKeyframe(
        vObj.vehicleData.keyframes,
        timestampSec
      );
    });

    // 2. Enforce C1-Continuous Solid Rigid-Body OBB Physics (zero teleportation, zero interpenetration)
    const impactT = this.reportData.impact_timestamp_sec ?? 1.15;
    const vAObj = this.vehicleMeshes.get('vehicle_a');
    const vBObj = this.vehicleMeshes.get('vehicle_b');
    if (this.continuousTrajectory?.sampleAtTime && vAObj && vBObj) {
      const sampled = this.continuousTrajectory.sampleAtTime(timestampSec);
      if (sampled?.stateA && sampled?.stateB) {
        telemetrySnapshot.vehicle_a = sampled.stateA;
        telemetrySnapshot.vehicle_b = sampled.stateB;
        this.lastPhysicsTelemetry = {
          ...sampled.physicsTelemetry,
          webgpu_backend: this.webgpuPhysics?.backendLabel || 'WebGPU / Continuous OBB Integrator',
          webgpu_supported: Boolean(this.webgpuPhysics?.supported),
        };
        telemetrySnapshot._physics = this.lastPhysicsTelemetry;
      }
    } else if (vAObj && vBObj && telemetrySnapshot.vehicle_a && telemetrySnapshot.vehicle_b) {
      const resolved = resolveVehiclePairPhysics(
        telemetrySnapshot.vehicle_a,
        vAObj.vehicleData,
        telemetrySnapshot.vehicle_b,
        vBObj.vehicleData,
        timestampSec,
        impactT
      );
      telemetrySnapshot.vehicle_a = resolved.stateA;
      telemetrySnapshot.vehicle_b = resolved.stateB;
      this.lastPhysicsTelemetry = {
        ...resolved.physicsTelemetry,
        webgpu_backend: this.webgpuPhysics?.backendLabel || 'WebGPU / CPU Rigid-Body SAT',
        webgpu_supported: Boolean(this.webgpuPhysics?.supported),
      };
      telemetrySnapshot._physics = this.lastPhysicsTelemetry;
    }

    // 3. Compute post-impact crash destruction state (crumple, debris shards, dust plume, knocked road sign)
    const ix = this.reportData.impact_x_meters ?? 0.0;
    const iz = this.reportData.impact_z_meters ?? 0.2;
    const destruction = computeCrashDestructionState(timestampSec, impactT, ix, iz);

    // 4. Apply resolved solid-body states & post-impact crumple to 3D vehicle meshes
    this.vehicleMeshes.forEach((vObj, vehicleId) => {
      const kf = telemetrySnapshot[vehicleId];
      if (!kf) return;

      vObj.rootGroup.position.set(kf.x_meters, 0, kf.z_meters);
      const yawRad = -THREE.MathUtils.degToRad(kf.heading_deg);
      vObj.rootGroup.rotation.y = yawRad;

      // Post-impact rollover tilt around vehicle longitudinal Z-axis
      const rollRad = THREE.MathUtils.degToRad(kf.roll_deg || 0);
      vObj.bodyTiltGroup.rotation.z = rollRad;
      vObj.bodyTiltGroup.position.y = Math.abs(Math.sin(rollRad)) * 0.42;

      // Realistic post-impact front-end crumple compression & pitch
      const crumpleFactor = destruction?.active
        ? vehicleId === 'vehicle_a'
          ? destruction.crumpleA || 0
          : destruction.crumpleB || 0
        : 0;
      vObj.bodyTiltGroup.scale.set(
        1.0 + crumpleFactor * 0.035,
        1.0 + crumpleFactor * 0.025,
        1.0 - crumpleFactor * 0.085
      );

      // Nose dive pitch when braking actively + impact jolt
      const joltPitch = destruction?.active ? Math.sin(destruction.dt * 18) * Math.exp(-destruction.dt * 4.5) * 0.055 : 0;
      vObj.bodyTiltGroup.rotation.x = (kf.braking_active ? -0.038 : 0.0) + joltPitch;

      // Emissive crimson brake lights
      vObj.brakeLightMat.emissiveIntensity = kf.braking_active ? 3.5 : 0.2;

      // Spin wheels proportional to distance traveled
      if (Array.isArray(vObj.wheels)) {
        const wheelSpin = timestampSec * (kf.speed_mph * 0.44704) * 2.8;
        vObj.wheels.forEach((w) => {
          w.rotation.x = -wheelSpin;
        });
      }

      // Velocity arrow length proportional to speed_mph
      const speedLen = Math.max(0.4, (kf.speed_mph / 45) * 4.2);
      vObj.velocityArrow.setLength(speedLen, 0.55, 0.35);
      vObj.velocityArrow.visible = kf.speed_mph > 0.8;

      // Update floating monochrome pill readout
      if (vObj.labelSprite?.userData?.updateLabel) {
        const plate = vObj.vehicleData.registration_plate || vehicleId;
        const suffix =
          Math.abs(kf.roll_deg || 0) > 15
            ? `ROLL ${Math.round(kf.roll_deg)}°`
            : Math.abs(timestampSec - impactT) <= 0.08
              ? 'IMPACT'
              : kf.braking_active
                ? 'BRAKING'
                : 'MOVING';
        vObj.labelSprite.userData.updateLabel(
          `${plate} • ${kf.speed_mph.toFixed(1)} mph (${suffix})`
        );
      }

      positions[vehicleId] = new THREE.Vector3(kf.x_meters, 1.1, kf.z_meters);
    });

    // 5. Animate Ballistic Crash Debris Shards, Verge Dust Plume & Knocked Road Sign
    if (this.debrisGroup && Array.isArray(this.debrisMeshes)) {
      if (destruction?.active && Array.isArray(destruction.shards)) {
        this.debrisGroup.visible = true;
        this.debrisMeshes.forEach((mesh, idx) => {
          const s = destruction.shards[idx];
          if (!s) return;
          mesh.position.set(s.x, s.y, s.z);
          mesh.rotation.set(s.rx, s.ry, s.rz);
          mesh.scale.setScalar(s.scale || 1.0);
        });
      } else {
        this.debrisGroup.visible = false;
      }
    }

    if (this.dustPlumeGroup && Array.isArray(this.dustPuffMeshes)) {
      if (destruction?.active && Array.isArray(destruction.dustPuffs)) {
        this.dustPlumeGroup.visible = true;
        this.dustPuffMeshes.forEach((puff, idx) => {
          const d = destruction.dustPuffs[idx];
          if (!d) return;
          puff.position.set(d.x, d.y, d.z);
          puff.scale.setScalar(d.scale || 1.0);
          puff.material.opacity = d.opacity || 0.0;
        });
      } else {
        this.dustPlumeGroup.visible = false;
      }
    }

    if (this.knockableSignRef?.postPivot) {
      if (destruction?.active && destruction.signKnockdown) {
        this.knockableSignRef.postPivot.rotation.x = destruction.signKnockdown.tiltRadX || 0;
        this.knockableSignRef.postPivot.rotation.z = destruction.signKnockdown.tiltRadZ || 0;
      } else {
        this.knockableSignRef.postPivot.rotation.set(0, 0, 0);
      }
    }

    // 6. Subtle Impact Shockwave Ring & Beacon animation around impact_timestamp_sec
    const dtImpact = timestampSec - impactT;
    if (dtImpact >= -0.04 && dtImpact <= 0.95) {
      const norm = Math.max(0, dtImpact / 0.95);
      const scale = 1.0 + norm * 5.5;
      this.impactRingMesh.scale.set(scale, scale, 1);
      this.impactRingMat.opacity = Math.max(0, 0.72 * (1 - norm));
      this.impactBeaconMat.opacity = Math.max(0, 0.45 * (1 - norm));
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

  resize() {
    this._onResize();
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

  dispose() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.controls) {
      this.controls.dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
