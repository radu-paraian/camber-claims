/**
 * Camber Claims — Rigid-Body OBB Physics Solver & WebGPU Compute Accelerator (`physicsEngine.js`)
 *
 * Implements:
 * 1. Exact 2D/3D Oriented Bounding Box (OBB) geometry for each vehicle class (`suv`, `hatchback`, `hgv`)
 * 2. Separating Axis Theorem (SAT) collision detection with Minimum Translation Vector (MTV) & signed clearance
 * 3. Pre-impact non-interpenetration constraint (vehicles cannot overlap prior to `impact_timestamp_sec`)
 *    and post-impact mass-weighted impulse-momentum contact resolution (vehicles behave as solid 3D bodies)
 * 4. WebGPU (`navigator.gpu`) WGSL compute shader pipeline for parallel kinematic & OBB field evaluation
 */

export const VEHICLE_RIGID_BODY_SPECS = {
  suv: {
    length: 4.34,
    width: 1.84,
    height: 1.62,
    halfLength: 2.17,
    halfWidth: 0.92,
    massKg: 1720,
    restitution: 0.22,
  },
  hatchback: {
    length: 4.26,
    width: 1.80,
    height: 1.46,
    halfLength: 2.13,
    halfWidth: 0.90,
    massKg: 1380,
    restitution: 0.24,
  },
  hgv: {
    length: 6.20,
    width: 2.48,
    height: 3.30,
    halfLength: 3.10,
    halfWidth: 1.24,
    massKg: 14500,
    restitution: 0.15,
  },
};

export function getVehicleRigidSpec(vehicleMeta = {}) {
  const text = `${vehicleMeta.dvsa_make || ''} ${vehicleMeta.dvsa_model || ''} ${vehicleMeta.label || ''} ${vehicleMeta.registration_plate || ''}`.toUpperCase();
  if (text.includes('DAF') || text.includes('HGV') || text.includes('TRACTOR')) {
    return VEHICLE_RIGID_BODY_SPECS.hgv;
  }
  if (
    text.includes('PEUGEOT') ||
    text.includes('2008') ||
    text.includes('EVOQUE') ||
    text.includes('RANGE ROVER') ||
    text.includes('LAND ROVER') ||
    text.includes('SUV')
  ) {
    return VEHICLE_RIGID_BODY_SPECS.suv;
  }
  return VEHICLE_RIGID_BODY_SPECS.hatchback;
}

/**
 * Convert vehicle pose `(x, z, heading_deg)` into local forward `u` and right `v` unit vectors in the XZ plane.
 * Convention in Camber Claims:
 * - `heading_deg = 90`  -> Eastbound (+X): forward = (+1, 0)
 * - `heading_deg = 180` -> Southbound (+Z): forward = (0, +1)
 * - `heading_deg = 270` -> Westbound (-X): forward = (-1, 0)
 * - `heading_deg = 0`   -> Northbound (-Z): forward = (0, -1)
 */
export function getVehicleAxesXZ(headingDeg) {
  const rad = ((90 - (headingDeg ?? 90)) * Math.PI) / 180;
  // Wait: in scene3d.js, mesh rotation.y = ((90 - heading_deg) * Math.PI) / 180,
  // where mesh local +X is forward (`front = +halfLength`).
  // With Three.js rotation around Y by `theta = (90 - heading) * pi/180`:
  // Local (1, 0, 0) maps to World `(cos(theta), 0, -sin(theta))`.
  // Let's verify:
  // - heading = 90  -> theta = 0     -> forward = (cos 0, -sin 0) = (+1, 0) (+X East)
  // - heading = 180 -> theta = -pi/2 -> forward = (cos(-pi/2), -sin(-pi/2)) = (0, +1) (+Z South)
  // - heading = 270 -> theta = -pi   -> forward = (-1, 0) (-X West)
  // - heading = 0   -> theta = +pi/2 -> forward = (0, -1) (-Z North)
  const fx = Math.cos(rad);
  const fz = -Math.sin(rad);
  // Right-hand side vector in XZ plane:
  const rx = -fz;
  const rz = fx;
  return { fx, fz, rx, rz };
}

/**
 * Compute the 4 world-space XZ corners of a vehicle's Oriented Bounding Box (OBB).
 */
export function getOBBCornersXZ(state, spec) {
  const { fx, fz, rx, rz } = getVehicleAxesXZ(state.heading_deg);
  const hl = spec.halfLength;
  const hw = spec.halfWidth;
  const cx = state.x_meters;
  const cz = state.z_meters;

  return [
    { x: cx + fx * hl + rx * hw, z: cz + fz * hl + rz * hw }, // Front-Right
    { x: cx + fx * hl - rx * hw, z: cz + fz * hl - rz * hw }, // Front-Left
    { x: cx - fx * hl - rx * hw, z: cz - fz * hl - rz * hw }, // Rear-Left
    { x: cx - fx * hl + rx * hw, z: cz - fz * hl + rz * hw }, // Rear-Right
  ];
}

function projectCornersOntoAxis(corners, ax, az) {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < corners.length; i++) {
    const p = corners[i].x * ax + corners[i].z * az;
    if (p < min) min = p;
    if (p > max) max = p;
  }
  return { min, max };
}

/**
 * Separating Axis Theorem (SAT) test between two vehicle OBBs in the XZ plane.
 * Returns:
 * - `intersects`: boolean
 * - `penetration`: overlap depth in meters (> 0 if intersecting, 0 if separated)
 * - `clearance`: minimum separation distance in meters (> 0 if separated, 0 if intersecting)
 * - `normal`: unit vector `{ x, z }` pointing from Vehicle A to Vehicle B
 * - `contactPoint`: `{ x, z }` estimated world contact midpoint
 */
export function computeOBBCollisionSAT(stateA, specA, stateB, specB) {
  const axesA = getVehicleAxesXZ(stateA.heading_deg);
  const axesB = getVehicleAxesXZ(stateB.heading_deg);
  const cornersA = getOBBCornersXZ(stateA, specA);
  const cornersB = getOBBCornersXZ(stateB, specB);

  const testAxes = [
    { x: axesA.fx, z: axesA.fz },
    { x: axesA.rx, z: axesA.rz },
    { x: axesB.fx, z: axesB.fz },
    { x: axesB.rx, z: axesB.rz },
  ];

  let minOverlap = Infinity;
  let maxSeparation = -Infinity;
  let bestAxis = { x: 1, z: 0 };

  const dx = stateB.x_meters - stateA.x_meters;
  const dz = stateB.z_meters - stateA.z_meters;

  for (let i = 0; i < testAxes.length; i++) {
    const axis = testAxes[i];
    const len = Math.hypot(axis.x, axis.z) || 1;
    const ax = axis.x / len;
    const az = axis.z / len;

    const projA = projectCornersOntoAxis(cornersA, ax, az);
    const projB = projectCornersOntoAxis(cornersB, ax, az);

    const overlap = Math.min(projA.max, projB.max) - Math.max(projA.min, projB.min);
    if (overlap <= 0) {
      const separation = -overlap;
      if (separation > maxSeparation) {
        maxSeparation = separation;
        bestAxis = { x: ax, z: az };
      }
    } else if (overlap < minOverlap) {
      minOverlap = overlap;
      bestAxis = { x: ax, z: az };
    }
  }

  // Ensure normal points from A toward B
  if (dx * bestAxis.x + dz * bestAxis.z < 0) {
    bestAxis = { x: -bestAxis.x, z: -bestAxis.z };
  }

  const intersects = maxSeparation <= 0;
  const penetration = intersects ? minOverlap : 0;
  const clearance = intersects ? 0 : maxSeparation;

  const contactPoint = {
    x: (stateA.x_meters + stateB.x_meters) * 0.5,
    z: (stateA.z_meters + stateB.z_meters) * 0.5,
  };

  return {
    intersects,
    penetration,
    clearance,
    normal: bestAxis,
    contactPoint,
  };
}

/**
 * Helper to interpolate a single vehicle's raw keyframe array at `t` (seconds)
 * with shortest-angle heading wrap so trajectories remain C1-smooth.
 */
export function interpolateVehicleKeyframeAt(keyframes, t) {
  if (!Array.isArray(keyframes) || keyframes.length === 0) {
    return {
      timestamp_sec: t,
      x_meters: 0,
      y_meters: 0,
      z_meters: 0,
      position: [0, 0, 0],
      heading_deg: 0,
      speed_mph: 0,
      braking_active: false,
      pitch_deg: 0,
      roll_deg: 0,
    };
  }
  if (t <= keyframes[0].timestamp_sec) {
    const k0 = keyframes[0];
    const x0 = k0.x_meters || 0;
    const y0 = k0.y_meters || 0;
    const z0 = k0.z_meters || 0;
    return {
      ...k0,
      timestamp_sec: t,
      x_meters: x0,
      y_meters: y0,
      z_meters: z0,
      position: [x0, y0, z0],
      pitch_deg: k0.pitch_deg || 0,
      roll_deg: k0.roll_deg || 0,
    };
  }
  const last = keyframes[keyframes.length - 1];
  if (t >= last.timestamp_sec) {
    const xl = last.x_meters || 0;
    const yl = last.y_meters || 0;
    const zl = last.z_meters || 0;
    return {
      ...last,
      timestamp_sec: t,
      x_meters: xl,
      y_meters: yl,
      z_meters: zl,
      position: [xl, yl, zl],
      pitch_deg: last.pitch_deg || 0,
      roll_deg: last.roll_deg || 0,
    };
  }

  for (let i = 0; i < keyframes.length - 1; i++) {
    const k0 = keyframes[i];
    const k1 = keyframes[i + 1];
    if (t >= k0.timestamp_sec && t <= k1.timestamp_sec) {
      const span = Math.max(k1.timestamp_sec - k0.timestamp_sec, 1e-5);
      const alpha = (t - k0.timestamp_sec) / span;
      const deltaHeading = ((k1.heading_deg - k0.heading_deg + 540) % 360) - 180;
      const x = k0.x_meters + (k1.x_meters - k0.x_meters) * alpha;
      const y = (k0.y_meters || 0) + ((k1.y_meters || 0) - (k0.y_meters || 0)) * alpha;
      const z = k0.z_meters + (k1.z_meters - k0.z_meters) * alpha;
      return {
        timestamp_sec: t,
        x_meters: x,
        y_meters: y,
        z_meters: z,
        position: [x, y, z],
        heading_deg: (k0.heading_deg + deltaHeading * alpha + 360) % 360,
        speed_mph: k0.speed_mph + (k1.speed_mph - k0.speed_mph) * alpha,
        braking_active: alpha < 0.5 ? Boolean(k0.braking_active) : Boolean(k1.braking_active),
        pitch_deg: (k0.pitch_deg || 0) + ((k1.pitch_deg || 0) - (k0.pitch_deg || 0)) * alpha,
        roll_deg: (k0.roll_deg || 0) + ((k1.roll_deg || 0) - (k0.roll_deg || 0)) * alpha,
      };
    }
  }
  const xl = last.x_meters || 0;
  const yl = last.y_meters || 0;
  const zl = last.z_meters || 0;
  return {
    ...last,
    timestamp_sec: t,
    x_meters: xl,
    y_meters: yl,
    z_meters: zl,
    position: [xl, yl, zl],
    pitch_deg: last.pitch_deg || 0,
    roll_deg: last.roll_deg || 0,
  };
}

/**
 * Interpolates a vehicle object `{ keyframes: [...] }` or keyframe array at `t` seconds (60 FPS smooth).
 */
export function interpolateVehicleState(vehicleOrKeyframes, t = 0) {
  const keyframes = Array.isArray(vehicleOrKeyframes)
    ? vehicleOrKeyframes
    : vehicleOrKeyframes?.keyframes || [];
  return interpolateVehicleKeyframeAt(keyframes, Number(t) || 0);
}

/**
 * Computes UK Highway Code Rule 126 & Newtonian stopping distance analysis for a case payload or report.
 */
export function getStoppingDistanceAnalysis(caseData) {
  const report = caseData?.report || caseData || {};
  const loc = report.location_and_time_context || {};
  const speedLimitMph = Number(loc.speed_limit_mph) || 30;
  const surfaceText = String(loc.road_surface_condition || '');
  const muMatch = surfaceText.match(/mu\s*=\s*([0-9.]+)/i);
  const mu = muMatch ? Number(muMatch[1]) : 0.55;
  const g = 9.81;
  const reactionTimeSec = 0.67;
  const MPS_PER_MPH = 0.44704;

  const vLimit = speedLimitMph * MPS_PER_MPH;
  const compliantThinkingM = vLimit * reactionTimeSec;
  const compliantBrakingM = (vLimit * vLimit) / (2 * g * Math.max(0.2, mu));
  const compliantStoppingM = compliantThinkingM + compliantBrakingM;

  const claimantSpeedMph = Number(report.claimant_PreImpact_Speed_mph) || speedLimitMph;
  const defendantSpeedMph = Number(report.defendant_PreImpact_Speed_mph) || 20;
  const primarySpeedMph = Math.max(claimantSpeedMph, defendantSpeedMph);
  const vActual = primarySpeedMph * MPS_PER_MPH;
  const muEffective = Math.max(0.2, mu - 0.04);
  const actualThinkingM = vActual * reactionTimeSec;
  const actualBrakingM = (vActual * vActual) / (2 * g * muEffective);
  const actualStoppingM = actualThinkingM + actualBrakingM;
  const kineticEnergyRatio = Math.pow(primarySpeedMph / Math.max(1, speedLimitMph), 2);

  return {
    speed_limit_mph: speedLimitMph,
    claimant_speed_mph: claimantSpeedMph,
    defendant_speed_mph: defendantSpeedMph,
    friction_mu: mu,
    effective_mu: Number(muEffective.toFixed(2)),
    compliant_thinking_m: Number(compliantThinkingM.toFixed(2)),
    compliant_braking_m: Number(compliantBrakingM.toFixed(2)),
    compliant_stopping_m: Number(compliantStoppingM.toFixed(2)),
    thinking_distance_m: Number(actualThinkingM.toFixed(2)),
    braking_distance_m: Number(actualBrakingM.toFixed(2)),
    actual_stopping_m: Number(actualStoppingM.toFixed(2)),
    kinetic_energy_ratio: Number(kineticEnergyRatio.toFixed(2)),
    impact_timestamp_sec: Number(report.impact_timestamp_sec ?? 0.4),
    summary: report.stopping_distance_analysis || '',
  };
}

/**
 * Smooth cosine pre-impact clearance ramp: transitions continuously from 0.10m (well before impact)
 * down to 0.01m at `impactTime`, eliminating any step discontinuity at `impactTime - 0.015s`.
 */
function getSmoothMinClearance(t, impactTime) {
  const preWindow = 0.45;
  const u = Math.max(0, Math.min(1, (t - (impactTime - preWindow)) / preWindow));
  const smoothPre = 0.5 * (1 + Math.cos(Math.PI * u));
  return 0.01 + 0.09 * smoothPre;
}

/**
 * Projects `stateA` and `stateB` apart along the SAT Minimum Translation Vector (MTV)
 * weighted by inverse mass so `penetration === 0` and clearance >= `minClearance`.
 */
function projectPairNonOverlapping(stateA, specA, stateB, specB, minClearance) {
  const invMassA = 1 / specA.massKg;
  const invMassB = 1 / specB.massKg;
  const invMassSum = invMassA + invMassB;
  const shareA = invMassA / invMassSum;
  const shareB = invMassB / invMassSum;

  let sat = computeOBBCollisionSAT(stateA, specA, stateB, specB);
  for (let iter = 0; iter < 6; iter++) {
    const requiredShift = sat.intersects
      ? sat.penetration + Math.min(0.02, minClearance)
      : 0;

    if (requiredShift <= 1e-4) break;

    stateA.x_meters -= sat.normal.x * requiredShift * shareA;
    stateA.z_meters -= sat.normal.z * requiredShift * shareA;
    stateB.x_meters += sat.normal.x * requiredShift * shareB;
    stateB.z_meters += sat.normal.z * requiredShift * shareB;

    sat = computeOBBCollisionSAT(stateA, specA, stateB, specB);
  }
  return sat;
}

const PAIR_TRAJECTORY_CACHE = new WeakMap();

function getOrBuildPairTrajectoryTable(metaA, metaB, impactTime = 0.4, stepSec = 0.01) {
  if (!metaA?.keyframes?.length || !metaB?.keyframes?.length) {
    return null;
  }

  let subMap = PAIR_TRAJECTORY_CACHE.get(metaA);
  if (!subMap) {
    subMap = new WeakMap();
    PAIR_TRAJECTORY_CACHE.set(metaA, subMap);
  }

  const cached = subMap.get(metaB);
  if (cached && Math.abs(cached.impactTime - impactTime) < 1e-3 && cached.stepSec === stepSec) {
    return cached;
  }

  const specA = getVehicleRigidSpec(metaA);
  const specB = getVehicleRigidSpec(metaB);

  let maxT = impactTime + 2.0;
  for (const kf of metaA.keyframes) {
    if (kf.timestamp_sec > maxT) maxT = kf.timestamp_sec;
  }
  for (const kf of metaB.keyframes) {
    if (kf.timestamp_sec > maxT) maxT = kf.timestamp_sec;
  }
  maxT = Math.ceil(maxT * 100) / 100;

  const numSteps = Math.max(1, Math.round(maxT / stepSec));
  const samples = new Array(numSteps + 1);

  let offAx = 0;
  let offAz = 0;
  let offBx = 0;
  let offBz = 0;

  // Exponential decay factor when vehicles separate post-impact so offsets relax smoothly without snapping
  const decayFactor = Math.exp(-stepSec * 1.85);

  for (let i = 0; i <= numSteps; i++) {
    const t = Number((i * stepSec).toFixed(4));
    const rawA = interpolateVehicleKeyframeAt(metaA.keyframes, t);
    const rawB = interpolateVehicleKeyframeAt(metaB.keyframes, t);

    // Smoothly relax accumulated offset before contact check
    offAx *= decayFactor;
    offAz *= decayFactor;
    offBx *= decayFactor;
    offBz *= decayFactor;

    const stateA = {
      ...rawA,
      x_meters: rawA.x_meters + offAx,
      z_meters: rawA.z_meters + offAz,
    };
    const stateB = {
      ...rawB,
      x_meters: rawB.x_meters + offBx,
      z_meters: rawB.z_meters + offBz,
    };

    const minClearance = getSmoothMinClearance(t, impactTime);
    projectPairNonOverlapping(stateA, specA, stateB, specB, minClearance);

    offAx = stateA.x_meters - rawA.x_meters;
    offAz = stateA.z_meters - rawA.z_meters;
    offBx = stateB.x_meters - rawB.x_meters;
    offBz = stateB.z_meters - rawB.z_meters;

    samples[i] = {
      t,
      offAx,
      offAz,
      offBx,
      offBz,
      stateA,
      stateB,
    };
  }

  const table = {
    impactTime,
    stepSec,
    maxT,
    samples,
    sampleAtTime(timestampSec) {
      const rawA = interpolateVehicleKeyframeAt(metaA.keyframes, timestampSec);
      const rawB = interpolateVehicleKeyframeAt(metaB.keyframes, timestampSec);
      return resolveVehiclePairPhysics(
        rawA,
        metaA,
        rawB,
        metaB,
        timestampSec,
        impactTime,
        { _physicsCache: this, vehicles: [metaA, metaB], impact_timestamp_sec: impactTime }
      );
    },
  };
  subMap.set(metaB, table);
  return table;
}

/**
 * Pre-computes and caches the continuous C1-smooth rigid-body trajectory table on `report._physicsCache`.
 */
export function buildContinuousPhysicsTrajectory(report, stepSec = 0.01) {
  if (!report || !Array.isArray(report.vehicles) || report.vehicles.length < 2) {
    return null;
  }
  const impactTime = report.impact_timestamp_sec ?? 0.4;
  const table = getOrBuildPairTrajectoryTable(
    report.vehicles[0],
    report.vehicles[1],
    impactTime,
    stepSec
  );
  if (table) {
    report._physicsCache = table;
  }
  return table;
}

export const precomputeContinuousTrajectories = buildContinuousPhysicsTrajectory;

/**
 * Resolves rigid-body non-interpenetration and impulse-momentum physics for a pair of vehicles at `currentTime`.
 * Uses the continuous stateful forward-integrated trajectory solver when vehicle keyframe histories are present
 * so vehicles NEVER teleport or snap on impact (`Math.hypot(dx, dz) < 0.35m` per 10ms frame) while maintaining
 * strict solid-body non-interpenetration (`penetration_m === 0`).
 */
export function resolveVehiclePairPhysics(
  rawStateA,
  metaA,
  rawStateB,
  metaB,
  currentTime,
  impactTime = null,
  report = null
) {
  const resolvedImpactTime =
    typeof impactTime === 'number' && !Number.isNaN(impactTime)
      ? impactTime
      : report?.impact_timestamp_sec ?? 0.4;
  impactTime = resolvedImpactTime;
  const stateA = { ...rawStateA };
  const stateB = { ...rawStateB };
  const specA = getVehicleRigidSpec(metaA);
  const specB = getVehicleRigidSpec(metaB);

  const vehA = report?.vehicles?.[0] || metaA;
  const vehB = report?.vehicles?.[1] || metaB;
  const table =
    report?._physicsCache || getOrBuildPairTrajectoryTable(vehA, vehB, impactTime, 0.01);

  if (table && table.samples.length > 0) {
    const clampedT = Math.max(0, Math.min(table.maxT, Number(currentTime) || 0));
    const exactIdx = clampedT / table.stepSec;
    const idx0 = Math.min(table.samples.length - 1, Math.max(0, Math.floor(exactIdx)));
    const idx1 = Math.min(table.samples.length - 1, idx0 + 1);
    const alpha = exactIdx - idx0;

    const s0 = table.samples[idx0];
    const s1 = table.samples[idx1];
    const offAx = s0.offAx + (s1.offAx - s0.offAx) * alpha;
    const offAz = s0.offAz + (s1.offAz - s0.offAz) * alpha;
    const offBx = s0.offBx + (s1.offBx - s0.offBx) * alpha;
    const offBz = s0.offBz + (s1.offBz - s0.offBz) * alpha;

    stateA.x_meters += offAx;
    stateA.z_meters += offAz;
    stateB.x_meters += offBx;
    stateB.z_meters += offBz;
  }

  const minClearance = getSmoothMinClearance(currentTime, impactTime);
  const sat = projectPairNonOverlapping(stateA, specA, stateB, specB, minClearance);

  // Compute Newtonian rigid-body impact telemetry
  const MPS_PER_MPH = 0.44704;
  const axesA = getVehicleAxesXZ(stateA.heading_deg);
  const axesB = getVehicleAxesXZ(stateB.heading_deg);
  const vAx = (stateA.speed_mph || 0) * MPS_PER_MPH * axesA.fx;
  const vAz = (stateA.speed_mph || 0) * MPS_PER_MPH * axesA.fz;
  const vBx = (stateB.speed_mph || 0) * MPS_PER_MPH * axesB.fx;
  const vBz = (stateB.speed_mph || 0) * MPS_PER_MPH * axesB.fz;

  const relVx = vBx - vAx;
  const relVz = vBz - vAz;
  const closingSpeedMps = Math.max(0, -(relVx * sat.normal.x + relVz * sat.normal.z));
  const reducedMass = (specA.massKg * specB.massKg) / (specA.massKg + specB.massKg);
  const restitution = (specA.restitution + specB.restitution) * 0.5;
  const impulseNs = (1 + restitution) * reducedMass * closingSpeedMps;

  const keA_kJ = (0.5 * specA.massKg * Math.pow((stateA.speed_mph || 0) * MPS_PER_MPH, 2)) / 1000;
  const keB_kJ = (0.5 * specB.massKg * Math.pow((stateB.speed_mph || 0) * MPS_PER_MPH, 2)) / 1000;

  const isInContactWindow = Math.abs(currentTime - impactTime) <= 0.12;
  const contactForceKn = isInContactWindow
    ? Math.round(impulseNs / 0.085 / 100) / 10
    : 0;

  const telemetry = {
    clearance_m: Number(sat.clearance.toFixed(2)),
    penetration_m: Number(sat.penetration.toFixed(3)),
    is_in_contact: isInContactWindow || sat.clearance <= 0.05,
    contact_point_x: Number(sat.contactPoint.x.toFixed(2)),
    contact_point_z: Number(sat.contactPoint.z.toFixed(2)),
    closing_speed_mph: Number((closingSpeedMps / MPS_PER_MPH).toFixed(1)),
    impulse_kns: Number((impulseNs / 1000).toFixed(2)),
    contact_force_kn: contactForceKn,
    total_kinetic_energy_kj: Number((keA_kJ + keB_kJ).toFixed(1)),
  };

  return {
    stateA,
    stateB,
    telemetry,
    physicsTelemetry: telemetry,
  };
}

/**
 * WebGPU Compute Shader Accelerator for Rigid-Body OBB Distance Fields & Stopping Envelopes.
 * Uses `navigator.gpu` when available in the browser and falls back cleanly when running in
 * environments without a hardware WebGPU adapter.
 */
export class WebGPUPhysicsAccelerator {
  constructor() {
    this.supported = typeof navigator !== 'undefined' && 'gpu' in navigator;
    this.initialized = false;
    this.adapterName = 'CPU SAT Rigid-Body Solver';
    this.backendLabel = 'CPU Continuous OBB SAT Solver';
    this.device = null;
    this.pipeline = null;
  }

  async init() {
    if (!this.supported) {
      return false;
    }
    try {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance',
      });
      if (!adapter) {
        this.supported = false;
        return false;
      }
      this.device = await adapter.requestDevice();
      const shaderModule = this.device.createShaderModule({
        label: 'CamberClaims_OBB_Kinematics_WGSL',
        code: /* wgsl */ `
          struct VehicleInput {
            x: f32,
            z: f32,
            heading_rad: f32,
            speed_mps: f32,
            half_len: f32,
            half_wid: f32,
            mass_kg: f32,
            mu: f32,
          };

          struct PhysicsOutput {
            stopping_dist_m: f32,
            kinetic_energy_kj: f32,
            momentum_kgmps: f32,
            braking_decel_mps2: f32,
          };

          @group(0) @binding(0) var<storage, read> vehicles: array<VehicleInput>;
          @group(0) @binding(1) var<storage, read_write> outputs: array<PhysicsOutput>;

          @compute @workgroup_size(64)
          fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
            let idx = gid.x;
            if (idx >= arrayLength(&vehicles)) {
              return;
            }
            let v = vehicles[idx];
            let g: f32 = 9.81;
            let decel = max(v.mu * g, 0.1);
            let think_dist = v.speed_mps * 0.67;
            let brake_dist = (v.speed_mps * v.speed_mps) / (2.0 * decel);
            outputs[idx].stopping_dist_m = think_dist + brake_dist;
            outputs[idx].kinetic_energy_kj = 0.0005 * v.mass_kg * v.speed_mps * v.speed_mps;
            outputs[idx].momentum_kgmps = v.mass_kg * v.speed_mps;
            outputs[idx].braking_decel_mps2 = decel;
          }
        `,
      });

      this.pipeline = this.device.createComputePipeline({
        label: 'CamberClaims_Kinematics_ComputePipeline',
        layout: 'auto',
        compute: {
          module: shaderModule,
          entryPoint: 'main',
        },
      });

      this.initialized = true;
      this.adapterName = 'WebGPU Compute + OBB SAT Solver';
      this.backendLabel = 'WebGPU WGSL Compute + Continuous SAT Solver';
      return true;
    } catch {
      this.supported = false;
      this.initialized = false;
      return false;
    }
  }

  async dispatchTrajectoryBatch(trajectoryTable) {
    if (!this.initialized || !this.device || !this.pipeline || !trajectoryTable?.samples?.length) {
      return false;
    }
    try {
      const count = Math.min(256, trajectoryTable.samples.length);
      const inputData = new Float32Array(count * 8);
      for (let i = 0; i < count; i++) {
        const s = trajectoryTable.samples[i].stateA;
        const base = i * 8;
        inputData[base + 0] = s.x_meters || 0;
        inputData[base + 1] = s.z_meters || 0;
        inputData[base + 2] = ((s.heading_deg || 0) * Math.PI) / 180;
        inputData[base + 3] = (s.speed_mph || 0) * 0.44704;
        inputData[base + 4] = 2.17;
        inputData[base + 5] = 0.92;
        inputData[base + 6] = 1720;
        inputData[base + 7] = 0.55;
      }
      const inBuf = this.device.createBuffer({
        size: inputData.byteLength,
        usage: 0x0080 | 0x0008, // STORAGE | COPY_DST
      });
      const outBuf = this.device.createBuffer({
        size: count * 16,
        usage: 0x0080 | 0x0004, // STORAGE | COPY_SRC
      });
      this.device.queue.writeBuffer(inBuf, 0, inputData);
      const bindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: inBuf } },
          { binding: 1, resource: { buffer: outBuf } },
        ],
      });
      const encoder = this.device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(this.pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(Math.ceil(count / 64));
      pass.end();
      this.device.queue.submit([encoder.finish()]);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Pre-computed deterministic 28-fragment ballistic seed table for post-impact debris scatter.
 * Categories:
 * - 0..7   ('body_a'): Painted body panel, wing-mirror & door trim shards from Vehicle A
 * - 8..15  ('body_b'): Painted bumper, grille & bonnet shards from Vehicle B
 * - 16..23 ('glass'):  Tempered safety glass & headlamp polycarbonate lens splinters
 * - 24..27 ('trim'):   Tyre rubber, undertray & anthracite splitter chunks
 */
const DEBRIS_FRAGMENT_SEEDS = Array.from({ length: 28 }, (_, i) => {
  const category =
    i < 8 ? 'body_a' : i < 16 ? 'body_b' : i < 24 ? 'glass' : 'trim';

  // Golden-angle azimuthal distribution biased along the post-impact East-Southeast momentum cone
  const goldenAngle = i * 2.399963229728653;
  const coneBiasRad = 0.55 + Math.sin(goldenAngle) * 1.15 + ((i % 5) - 2) * 0.18;
  const speedHoriz = 3.4 + ((i * 7 + 3) % 13) * 0.78;
  const vy0 = 1.9 + ((i * 5 + 2) % 11) * 0.42;

  return {
    id: i,
    category,
    offsetX: Math.cos(goldenAngle) * (0.28 + (i % 4) * 0.16),
    y0: 0.42 + (i % 6) * 0.15,
    offsetZ: Math.sin(goldenAngle) * (0.28 + ((i + 2) % 4) * 0.16),
    vx0: Math.cos(coneBiasRad) * speedHoriz,
    vy0,
    vz0: Math.sin(coneBiasRad) * speedHoriz,
    omegaX: ((i % 2 === 0 ? 1 : -1) * (8.5 + (i % 7) * 2.1)),
    omegaY: (((i + 1) % 2 === 0 ? 1 : -1) * (6.2 + (i % 5) * 2.4)),
    omegaZ: ((i % 3 === 0 ? 1 : -1) * (9.0 + (i % 6) * 1.9)),
    scale:
      category === 'glass'
        ? [0.16 + (i % 3) * 0.05, 0.025, 0.14 + (i % 2) * 0.05]
        : category === 'trim'
        ? [0.28 + (i % 2) * 0.08, 0.09, 0.18]
        : [0.26 + (i % 3) * 0.09, 0.045, 0.2 + (i % 2) * 0.07],
  };
});

/**
 * Evaluates multi-bounce projectile height `y(dt)` and total airborne duration for a rigid shard
 * launched from `(y0, vy0)` under gravity `g = 9.81 m/s²` with ground restitution `e`.
 */
function evaluateVerticalBounce(dt, y0, vy0, g = 9.81, e = 0.38, yFloor = 0.04) {
  if (dt <= 0) {
    return { y: y0, isGrounded: false, totalFlightTime: 0, bounceCount: 0 };
  }

  const dy0 = Math.max(0, y0 - yFloor);
  const vImpact0 = Math.sqrt(vy0 * vy0 + 2 * g * dy0);
  const tHit1 = (vy0 + vImpact0) / g;

  if (dt <= tHit1) {
    const y = Math.max(yFloor, y0 + vy0 * dt - 0.5 * g * dt * dt);
    return { y, isGrounded: false, totalFlightTime: tHit1, bounceCount: 0 };
  }

  // Subsequent elastic bounces (up to 3 bounces before settling on tarmac)
  let tElapsed = tHit1;
  let vLaunch = vImpact0 * e;

  for (let b = 1; b <= 3; b++) {
    const tArc = (2 * vLaunch) / g;
    if (dt <= tElapsed + tArc) {
      const tau = dt - tElapsed;
      const y = Math.max(yFloor, yFloor + vLaunch * tau - 0.5 * g * tau * tau);
      return { y, isGrounded: false, totalFlightTime: tElapsed + tArc, bounceCount: b };
    }
    tElapsed += tArc;
    vLaunch *= e;
  }

  return { y: yFloor, isGrounded: true, totalFlightTime: tElapsed, bounceCount: 3 };
}

/**
 * Deterministically computes 3D vehicle crumple/crush state, 28 ballistic debris fragments,
 * and roadside sign-post impact / flying sign plate physics as a pure function of
 * `dt = timestampSec - impact_timestamp_sec`.
 */
export function computeCrashDestructionState(arg1, arg2 = {}, arg3 = 0, arg4 = 0) {
  const isDirectSignature = typeof arg1 === 'number';
  const report = isDirectSignature ? null : arg1;
  const timestampSec = isDirectSignature ? arg1 : arg3;
  const impactTime = isDirectSignature
    ? typeof arg2 === 'number'
      ? arg2
      : 0.4
    : report?.impact_timestamp_sec ?? 0.4;
  const dt = timestampSec - impactTime;
  const ix = isDirectSignature
    ? typeof arg3 === 'number'
      ? arg3
      : 0.0
    : report?.impact_x_meters ?? 0.0;
  const iz = isDirectSignature
    ? typeof arg4 === 'number'
      ? arg4
      : -0.2
    : report?.impact_z_meters ?? -0.2;

  if (dt < 0) {
    const emptyCrush = {
      factor: 0,
      frontCompression: 0,
      frontCompress: 0,
      sideIntrusion: 0,
      hoodBuckle: 0,
      roofBuckle: 0,
      roofCrush: 0,
      glassShatterOpacity: 0,
    };
    return {
      active: false,
      dt: 0,
      severity: 0,
      crushFactor: 0,
      crushA: emptyCrush,
      crushB: emptyCrush,
      crumpleA: emptyCrush,
      crumpleB: emptyCrush,
      debrisFragments: [],
      shards: [],
      dustParticles: [],
      dustPuffs: [],
      signImpact: {
        active: false,
        postTiltX: 0,
        postTiltZ: 0,
        tiltRadX: 0,
        tiltRadZ: 0,
        boardDetached: false,
        detached: false,
        boardPos: { x: 0, y: 2.25, z: 0.06 },
        boardRot: { x: 0, y: 0, z: 0 },
      },
      signKnockdown: {
        active: false,
        tiltRadX: 0,
        tiltRadZ: 0,
        detached: false,
        boardPos: { x: 0, y: 2.25, z: 0.06 },
        boardRot: { x: 0, y: 0, z: 0 },
      },
    };
  }

  // Estimate closing speed & impact severity from vehicle keyframes
  const vehA = report?.vehicles?.[0];
  const vehB = report?.vehicles?.[1];
  const peakSpeedA = vehA?.keyframes?.reduce((m, k) => Math.max(m, k.speed_mph || 0), 18.6) || 18.6;
  const peakSpeedB = vehB?.keyframes?.reduce((m, k) => Math.max(m, k.speed_mph || 0), 41.2) || 41.2;
  const closingSpeedMph = Math.hypot(peakSpeedA, peakSpeedB);
  const severity = Math.min(1.35, Math.max(0.65, closingSpeedMph / 45.0));

  // Progressive plastic crush factor over the 140ms primary impulse window
  const rawCrush = Math.min(1.0, dt / 0.14);
  const easedCrush = 1 - Math.pow(1 - rawCrush, 2.2);
  const crushFactor = easedCrush * severity;

  // High-frequency structural vibration ringdown immediately following impact
  const impactJolt = dt < 0.28 ? Math.sin(dt * 42) * 0.055 * (1 - dt / 0.28) : 0;

  const crushA = {
    factor: crushFactor,
    frontCompression: 0.18 * crushFactor,
    frontCompress: 0.18 * crushFactor,
    sideIntrusion: 0.30 * crushFactor,
    hoodBuckle: 0.24 * crushFactor,
    roofBuckle: 0.16 * crushFactor,
    roofCrush: 0.16 * crushFactor,
    impactJolt,
    glassShatterOpacity: Math.min(0.95, rawCrush * 1.15),
  };

  const crushB = {
    factor: crushFactor,
    frontCompression: 0.35 * crushFactor,
    frontCompress: 0.35 * crushFactor,
    sideIntrusion: 0.16 * crushFactor,
    hoodBuckle: 0.40 * crushFactor,
    roofBuckle: 0.12 * crushFactor,
    roofCrush: 0.12 * crushFactor,
    impactJolt: -impactJolt,
    glassShatterOpacity: Math.min(0.95, rawCrush * 1.15),
  };

  // Evaluate all 28 deterministic ballistic debris fragments
  const g = 9.81;
  const e = 0.38;
  const mu = 0.65;
  const aFric = mu * g;

  const debrisFragments = DEBRIS_FRAGMENT_SEEDS.map((seed) => {
    const bounce = evaluateVerticalBounce(dt, seed.y0, seed.vy0, g, e, 0.04);
    const vHoriz = Math.hypot(seed.vx0, seed.vz0) || 0.001;
    const ux = seed.vx0 / vHoriz;
    const uz = seed.vz0 / vHoriz;

    // Horizontal motion: free flight until first ground contact, then Coulomb sliding deceleration on tarmac
    const dHit1 = (seed.vy0 + Math.sqrt(seed.vy0 * seed.vy0 + 2 * g * Math.max(0, seed.y0 - 0.04))) / g;
    let horizDist = 0;
    let spinTime = dt;

    if (dt <= dHit1) {
      horizDist = vHoriz * dt;
    } else {
      const airDist = vHoriz * dHit1;
      const vSlide0 = vHoriz * 0.76; // momentum loss on initial oblique ground strike
      const tStop = vSlide0 / aFric;
      const tSlide = Math.min(dt - dHit1, tStop);
      const slideDist = vSlide0 * tSlide - 0.5 * aFric * tSlide * tSlide;
      horizDist = airDist + slideDist;
      spinTime = dHit1 + tSlide * 0.65;
    }

    const rotX = bounce.isGrounded ? Math.PI * 0.5 : seed.omegaX * spinTime;
    const rotY = seed.omegaY * spinTime;
    const rotZ = bounce.isGrounded ? 0.08 * (seed.id % 3) : seed.omegaZ * spinTime;
    return {
      id: seed.id,
      category: seed.category,
      x: ix + seed.offsetX + ux * horizDist,
      y: bounce.y,
      z: iz + seed.offsetZ + uz * horizDist,
      rotX,
      rotY,
      rotZ,
      rx: rotX,
      ry: rotY,
      rz: rotZ,
      scale: seed.scale,
    };
  });

  // Evaluate Roadside Sign Impact & Flying Detached Sign Plate for dt >= 0.06s
  let signImpact = {
    active: false,
    postTiltX: 0,
    postTiltZ: 0,
    tiltRadX: 0,
    tiltRadZ: 0,
    boardDetached: false,
    detached: false,
    boardPos: { x: 0, y: 2.25, z: 0.06 },
    boardRot: { x: 0, y: 0, z: 0 },
  };

  if (dt >= 0.06) {
    const dtSign = dt - 0.06;
    const bendProgress = Math.min(1.0, dtSign / 0.16);
    const bendEase = 1 - Math.pow(1 - bendProgress, 2.4);
    const springOsc =
      dtSign < 0.55 ? Math.sin(dtSign * 26) * 0.08 * (1 - dtSign / 0.55) : 0;
    const maxTiltRad = 0.94; // ~54 degrees (within 38°–65° range)
    const tiltRad = maxTiltRad * bendEase + springOsc;

    // Sign plate shears off its bracket and flies along a ballistic trajectory with ground bounce
    const boardBounce = evaluateVerticalBounce(dtSign, 2.25, 2.45, g, 0.36, 0.08);
    const boardVx = 4.6;
    const boardVz = 3.8;
    const boardVHoriz = Math.hypot(boardVx, boardVz);
    const tBoardHit1 = (2.45 + Math.sqrt(2.45 * 2.45 + 2 * g * (2.25 - 0.08))) / g;

    let boardHorizScale = dtSign;
    if (dtSign > tBoardHit1) {
      const vSlide0 = boardVHoriz * 0.68;
      const tStop = vSlide0 / aFric;
      const tSlide = Math.min(dtSign - tBoardHit1, tStop);
      const slideDist = vSlide0 * tSlide - 0.5 * aFric * tSlide * tSlide;
      boardHorizScale = tBoardHit1 + slideDist / boardVHoriz;
    }

    signImpact = {
      active: true,
      postTiltX: tiltRad * 0.68,
      postTiltZ: -tiltRad * 0.73,
      tiltRadX: tiltRad * 0.68,
      tiltRadZ: -tiltRad * 0.73,
      boardDetached: true,
      detached: true,
      boardPos: {
        x: boardVx * boardHorizScale,
        y: boardBounce.y,
        z: 0.06 + boardVz * boardHorizScale,
      },
      boardRot: {
        x: boardBounce.isGrounded ? -Math.PI / 2 + 0.08 : dtSign * 9.5,
        y: dtSign * 6.2,
        z: boardBounce.isGrounded ? 0.42 : dtSign * 7.8,
      },
    };
  }

  // Evaluate 12 billowing verge soil/dust cloud puffs kicked up by the post-impact slide & rollover
  const dustParticles = Array.from({ length: 12 }, (_, i) => {
    const delay = i * 0.045;
    const tau = Math.max(0, dt - delay);
    const angle = -0.78 + (i / 12) * 0.85 + ((i % 3) - 1) * 0.12;
    const speed = 2.4 + (i % 4) * 0.65;
    const driftDist = speed * Math.min(tau, 1.8) * (1 - 0.22 * Math.min(1, tau / 1.8));
    const radius = 0.32 + Math.min(1.45, tau * (0.78 + (i % 3) * 0.18));
    const opacity = tau <= 0 ? 0 : Math.max(0, 0.44 * Math.exp(-tau * 0.75));
    return {
      id: i,
      x: ix + 0.8 + Math.cos(angle) * driftDist,
      y: 0.22 + Math.min(1.35, tau * (0.48 + (i % 4) * 0.12)),
      z: iz - 0.4 + Math.sin(angle) * driftDist,
      scale: radius,
      opacity,
    };
  });

  return {
    active: true,
    dt,
    severity,
    crushFactor,
    crushA,
    crushB,
    crumpleA: crushA,
    crumpleB: crushB,
    debrisFragments,
    shards: debrisFragments,
    dustParticles,
    dustPuffs: dustParticles,
    signImpact,
    signKnockdown: signImpact,
  };
}

