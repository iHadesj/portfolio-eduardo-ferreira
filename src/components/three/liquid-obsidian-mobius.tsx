"use client";

import { useEffect, useMemo, useRef } from "react";
import { Float } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import {
  createRibbonFrames,
  ribbonPoint,
  ribbonThickness,
  ribbonWidth,
  type RibbonFrame,
} from "./infinity-path";

const VERTEX_SHADER = /* glsl */ `
  attribute vec2 aOutward;

  uniform float uActivity;
  uniform float uImpact;
  uniform vec2 uPointer;
  uniform float uPulse;
  uniform float uPulsePhase;
  uniform float uScrollProgress;
  uniform float uSpinEnergy;
  uniform float uTime;
  uniform float uUnderworld;

  varying float vDeformation;
  varying float vInteraction;
  varying vec2 vLoop;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  void main() {
    vec4 baseViewPosition = modelViewMatrix * vec4(position, 1.0);
    vec4 baseClipPosition = projectionMatrix * baseViewPosition;
    vec2 screenPosition = baseClipPosition.xy / baseClipPosition.w;
    float pointerDistance = distance(screenPosition, uPointer);
    float proximity = smoothstep(0.72, 0.05, pointerDistance) * uActivity;

    float loopPhase = uv.x * 6.2832;
    float crossSectionPhase = uv.y * 6.2832 + uv.x * 3.1416;
    float surfaceBreath = sin(uTime * 1.38);
    float predatorBreath = sin(uTime * 2.72 + sin(uTime * 0.74) * 0.58);
    float breathingCycle = mix(surfaceBreath, predatorBreath, uUnderworld);
    float surfaceUndertow = sin(uTime * 0.57 + 1.4);
    float predatorUndertow = sin(uTime * 1.31 + 0.8);
    float breathingUndertow = mix(
      surfaceUndertow,
      predatorUndertow,
      uUnderworld
    );
    float bodyBreath =
      (
        breathingCycle * mix(0.027, 0.048, uUnderworld) +
        breathingUndertow * mix(0.011, 0.018, uUnderworld)
      ) *
      (0.78 + cos(loopPhase * 2.0 - 0.35) * 0.22);

    float travelingWave = sin(loopPhase * 3.0 - uTime * 2.4);
    float crossWave =
      cos(loopPhase * 5.0 + uTime * 1.45) * cos(crossSectionPhase * 2.0);
    float contraction =
      pow(sin(loopPhase * 2.0 - uTime * 1.62) * 0.5 + 0.5, 3.0) *
      (0.026 + cos(crossSectionPhase) * 0.01);
    float predatoryContraction =
      pow(sin(loopPhase * 3.0 - uTime * 4.35) * 0.5 + 0.5, 5.0) *
      (0.057 + cos(crossSectionPhase * 2.0) * 0.016) *
      uUnderworld;
    float crawlingRipple = sin(
      loopPhase * 4.0 -
      uTime * 2.15 +
      sin(loopPhase - uTime * 0.42) * 0.82
    ) * mix(0.016, 0.029, uUnderworld);
    float violentRipple =
      sin(
        loopPhase * 7.0 -
        uTime * 5.4 +
        sin(loopPhase * 2.0 + uTime * 1.7) * 1.15
      ) *
      0.022 *
      uUnderworld;
    float nervousTwitch =
      sin(loopPhase * 7.0 + uTime * 2.8) *
      mix(0.006, 0.017, uUnderworld);
    float idleFlow =
      travelingWave * 0.024 +
      crossWave * 0.012 +
      bodyBreath +
      contraction +
      predatoryContraction +
      crawlingRipple +
      violentRipple +
      nervousTwitch;
    float cursorFlow =
      proximity *
      (travelingWave * 0.11 + crossWave * 0.035) *
      mix(1.0, 1.45, uUnderworld);
    float pulseDistance = abs(atan(
      sin(loopPhase - uPulsePhase),
      cos(loopPhase - uPulsePhase)
    ));
    float pulseEnvelope = smoothstep(0.58, 0.04, pulseDistance) * uPulse;
    float pulseWave =
      sin(crossSectionPhase * 2.0 + uPulsePhase * 1.5) *
      pulseEnvelope *
      mix(0.075, 0.125, uUnderworld);
    float spinWave =
      sin(loopPhase * 9.0 - uTime * 10.5 + crossSectionPhase * 2.0) *
      uSpinEnergy *
      uUnderworld *
      0.064;
    float impactWave =
      sin(loopPhase * 12.0 - uTime * 15.0) *
      uImpact *
      uUnderworld *
      0.09;
    float displacement =
      idleFlow + cursorFlow + pulseWave + spinWave + impactWave;

    vec3 transformed = position + normal * displacement;
    // Precomputed per vertex: a figure-eight has no single centre to push
    // away from, and the push fades out at the waist instead of tearing it.
    vec2 radialDirection = aOutward;
    float livingStretch =
      sin(loopPhase * 2.0 + uTime * 1.65) * 0.025 +
      sin(loopPhase * 5.0 - uTime * 0.92) * 0.009;
    transformed.xy += radialDirection * (
      livingStretch +
      bodyBreath * 0.48 +
      proximity * 0.05 +
      uImpact * uUnderworld * 0.055
    );
    transformed.z *= 1.0 + breathingCycle * 0.075;
    transformed.z +=
      sin(loopPhase * 2.0 - uTime * 1.08) * 0.018 +
      sin(
        loopPhase * 3.0 +
        uTime * 3.7 +
        sin(loopPhase * 5.0 - uTime * 1.4)
      ) *
      0.034 *
      uUnderworld +
      proximity * cos(crossSectionPhase * 2.0) * 0.048;
    float scrollDissolve = smoothstep(0.28, 0.96, uScrollProgress);
    transformed += normal * (
      sin(loopPhase * 11.0 + crossSectionPhase * 3.0) * 0.055 + 0.035
    ) * scrollDissolve;
    vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);

    vDeformation =
      proximity +
      abs(idleFlow) * 8.0 +
      uPulse * 0.35 +
      (uSpinEnergy * 0.5 + uImpact) * uUnderworld;
    vInteraction = max(
      max(proximity, pulseEnvelope),
      (uSpinEnergy * 0.62 + uImpact) * uUnderworld
    );
    vLoop = vec2(cos(uv.x * 6.2832), sin(uv.x * 6.2832));
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vWorldPosition = worldPosition.xyz;
    vUv = uv;

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uActivity;
  uniform float uImpact;
  uniform float uModeFrom;
  uniform float uModeProgress;
  uniform float uModeTo;
  uniform float uScrollProgress;
  uniform float uSpinEnergy;
  uniform float uTime;
  uniform float uUnderworld;

  varying float vDeformation;
  varying float vInteraction;
  varying vec2 vLoop;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    vec3 geometricNormal = normalize(
      cross(dFdx(vWorldPosition), dFdy(vWorldPosition))
    );
    vec3 normal = normalize(mix(normalize(vWorldNormal), geometricNormal, 0.18));
    normal = faceforward(normal, -viewDirection, normal);

    float transitionEdge = uModeProgress * 1.3 - 0.15;
    float materialWave = 1.0 - smoothstep(
      transitionEdge - 0.08,
      transitionEdge + 0.08,
      vUv.x
    );
    float materialMode = mix(uModeFrom, uModeTo, materialWave);
    float requestedGoldMode = clamp(
      1.0 - abs(materialMode - 1.0),
      0.0,
      1.0
    );
    float emberMode = smoothstep(1.05, 2.0, materialMode);
    float worldMode = max(uUnderworld, emberMode);
    // Underworld is authoritative: a previously selected gold material must
    // never override the red palette while the secret theme is active.
    float goldMode = requestedGoldMode * (1.0 - worldMode);

    float facing = max(dot(normal, viewDirection), 0.0);
    float fresnel = pow(1.0 - facing, 2.15);
    float edgeDistance = abs(cos(vUv.y * 6.2832));
    float goldEdge = smoothstep(0.91, 0.99, edgeDistance);
    float surfaceBreathLight = sin(uTime * 1.38) * 0.5 + 0.5;
    float predatorBreathLight =
      sin(uTime * 3.05 + sin(uTime * 0.9) * 0.7) * 0.5 + 0.5;
    float breathLight = mix(
      surfaceBreathLight,
      predatorBreathLight,
      worldMode
    );

    float loopAngle = atan(vLoop.y, vLoop.x);
    float surfaceBand = sin(
      loopAngle * 2.0 +
      cos(vUv.y * 12.5664) * 1.2 -
      uTime * 1.05
    ) * 0.5 + 0.5;
    float predatorBand = sin(
      loopAngle * 3.0 +
      cos(vUv.y * 18.8496) * 1.45 -
      uTime * 3.15 +
      sin(loopAngle * 5.0 + uTime * 1.7) * 0.72
    ) * 0.5 + 0.5;
    float liquidBand = mix(surfaceBand, predatorBand, worldMode);
    liquidBand = smoothstep(0.42, 0.95, liquidBand);

    vec2 glintDirection = mix(
      vec2(cos(uTime * 0.75), sin(uTime * 0.75)),
      vec2(cos(uTime * 1.85), sin(uTime * 1.85)),
      worldMode
    );
    float glintAlignment = dot(normalize(vLoop), glintDirection);
    float travelingGlint = smoothstep(0.64, 1.0, glintAlignment);

    float surfaceVein = abs(sin(
      loopAngle * 5.0 -
      uTime * 1.8 +
      sin(loopAngle * 2.0 + uTime * 1.1) * 1.35 +
      cos(vUv.y * 12.5664) * 1.8
    ));
    float predatorVein = abs(sin(
      loopAngle * 8.0 -
      uTime * 5.4 +
      sin(loopAngle * 3.0 + uTime * 2.2) * 1.7 +
      cos(vUv.y * 18.8496) * 2.15
    ));
    float veinField = mix(surfaceVein, predatorVein, worldMode);
    float livingVein = smoothstep(0.91, 0.985, veinField);
    float veinPulse =
      sin(uTime * mix(2.4, 5.8, worldMode) - loopAngle * 3.0) *
      0.5 +
      0.5;

    vec3 sweepDirection = normalize(vec3(
      sin(uTime * 0.72),
      0.68,
      cos(uTime * 0.72) + 0.72
    ));
    float movingSpecular = pow(max(
      dot(reflect(-sweepDirection, normal), viewDirection),
      0.0
    ), 18.0);
    vec3 sharpSweepDirection = normalize(vec3(
      cos(uTime * 0.43 + 1.2),
      -0.42,
      sin(uTime * 0.43 + 1.2) + 0.9
    ));
    float sharpSpecular = pow(max(
      dot(reflect(-sharpSweepDirection, normal), viewDirection),
      0.0
    ), 48.0);
    float reflectionRibbon = pow(fresnel, 0.72) * (
      sin(vWorldPosition.y * 8.0 - vWorldPosition.x * 3.5 + uTime * 0.55) *
      0.5 + 0.5
    );

    vec3 obsidian = mix(
      vec3(0.006, 0.005, 0.009),
      vec3(0.0015, 0.0002, 0.0005),
      worldMode
    );
    vec3 graphite = mix(
      vec3(0.055, 0.065, 0.075),
      vec3(0.052, 0.0025, 0.007),
      worldMode
    );
    vec3 coldReflection = mix(
      vec3(0.13, 0.34, 0.38),
      vec3(0.38, 0.006, 0.016),
      worldMode
    );
    vec3 molten = mix(
      vec3(0.91, 0.54, 0.18),
      vec3(0.79, 0.018, 0.009),
      worldMode
    );
    vec3 brightGold = mix(
      vec3(1.0, 0.76, 0.34),
      vec3(1.0, 0.075, 0.022),
      worldMode
    );
    obsidian = mix(obsidian, vec3(0.045, 0.018, 0.002), goldMode);
    graphite = mix(graphite, vec3(0.28, 0.105, 0.012), goldMode);
    coldReflection = mix(coldReflection, vec3(0.98, 0.46, 0.08), goldMode);
    molten = mix(molten, vec3(1.0, 0.68, 0.14), goldMode);
    brightGold = mix(brightGold, vec3(1.0, 0.93, 0.56), goldMode);

    vec3 color = mix(obsidian, graphite, fresnel * 0.8 + liquidBand * 0.16);
    color += coldReflection * fresnel * (0.48 + liquidBand * 0.26);
    color += molten * liquidBand * fresnel * (0.17 + breathLight * 0.07);
    color += mix(coldReflection, molten, edgeDistance) * liquidBand * 0.075;
    color += mix(coldReflection, brightGold, travelingGlint) * movingSpecular * 0.86;
    color += brightGold * sharpSpecular * (0.82 + goldMode * 0.35);
    color += coldReflection * reflectionRibbon * (0.13 + goldMode * 0.1);
    color += mix(coldReflection, brightGold, veinPulse) * livingVein * (0.14 + uActivity * 0.12);
    color += coldReflection * liquidBand * (0.035 + veinPulse * 0.04);
    color += graphite * vDeformation * 0.32;
    color +=
      brightGold *
      livingVein *
      worldMode *
      (0.13 + predatorBreathLight * 0.18);
    color += brightGold * vInteraction * (0.24 + fresnel * 0.22);
    color +=
      brightGold *
      worldMode *
      (
        uImpact * (0.42 + fresnel * 0.48) +
        uSpinEnergy * (livingVein * 0.24 + goldEdge * 0.2)
      );

    vec3 edgeColor = mix(molten, brightGold, travelingGlint);
    color = mix(
      color,
      edgeColor,
      goldEdge * (0.68 + travelingGlint * 0.26 + breathLight * 0.08)
    );
    color +=
      brightGold *
      goldEdge *
      travelingGlint *
      (0.4 + breathLight * 0.1 + uActivity * 0.22);

    // Skip the comparatively expensive dissolve noise while the hero is in
    // its normal state. The uniform branch is coherent across the whole draw.
    if (uScrollProgress > 0.3) {
      float dissolveAmount = smoothstep(0.3, 0.94, uScrollProgress);
      float dissolveNoise = fract(sin(dot(
        floor(vUv * vec2(144.0, 28.0)),
        vec2(12.9898, 78.233)
      )) * 43758.5453);
      if (dissolveNoise < dissolveAmount * 0.94) discard;
      float dissolveEdge = 1.0 - smoothstep(
        0.0,
        0.075,
        abs(dissolveNoise - dissolveAmount * 0.94)
      );
      color += brightGold * dissolveEdge * dissolveAmount * 0.72;
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const FULL_TURN = Math.PI * 2;
const LONG_PRESS_MS = 720;
const MATERIAL_CHANGE_COOLDOWN_MS = 1200;
const TRAIL_LIFETIME = 0.62;

interface TrailField {
  positions: Float32Array;
  colors: Float32Array;
  velocities: Float32Array;
  life: Float32Array;
  cursor: number;
}

interface DissolveField {
  base: Float32Array;
  positions: Float32Array;
  colors: Float32Array;
  directions: Float32Array;
}

function seededValue(index: number) {
  const value = Math.sin(index * 12.9898 + 4.1414) * 43758.5453;
  return value - Math.floor(value);
}

function createTrailField(count: number): TrailField {
  const positions = new Float32Array(count * 3);
  positions.fill(20);
  return {
    positions,
    colors: new Float32Array(count * 3),
    velocities: new Float32Array(count * 3),
    life: new Float32Array(count),
    cursor: 0,
  };
}

function createDissolveField(count: number): DissolveField {
  const base = new Float32Array(count * 3);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const directions = new Float32Array(count * 3);
  const frames = createRibbonFrames(count);

  for (let index = 0; index < count; index += 1) {
    const frame = frames[index]!;
    const across = ((index % 7) / 6 - 0.5) * 1.7 * ribbonWidth(frame.u);
    const point = ribbonPoint(frame, across, 0);
    const offset = index * 3;
    const seed = seededValue(index);
    const secondSeed = seededValue(index + count);

    base[offset] = point[0];
    base[offset + 1] = point[1];
    base[offset + 2] = point[2];
    positions[offset] = point[0];
    positions[offset + 1] = point[1];
    positions[offset + 2] = point[2];

    // Embers peel away from the outer edge of each lobe and sink slowly.
    directions[offset] =
      frame.outward[0] * (0.28 + seed * 0.38) + point[0] * 0.08;
    directions[offset + 1] = -0.5 - seed * 0.45 + frame.outward[1] * 0.18;
    directions[offset + 2] = (secondSeed - 0.5) * 0.72;

    const warm = index % 4 !== 0;
    colors[offset] = warm ? 1 : 0.24;
    colors[offset + 1] = warm ? 0.57 + seed * 0.24 : 0.62;
    colors[offset + 2] = warm ? 0.08 : 0.68;
  }

  return { base, positions, colors, directions };
}

/**
 * Möbius ribbon swept along the figure-eight in `infinity-path`. Rings are
 * closed tubes (width × thin thickness); the last ring stitches to the first
 * with a half-ring offset, which is exactly the half-twist the frames carry.
 */
function createInfinityRibbonGeometry(uSegments: number, vSegments: number) {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const uvs: number[] = [];
  const outward: number[] = [];
  const indices: number[] = [];
  const frames = createRibbonFrames(uSegments);

  for (let uIndex = 0; uIndex < uSegments; uIndex += 1) {
    const frame = frames[uIndex]!;
    const uRatio = uIndex / uSegments;
    const halfWidth = ribbonWidth(frame.u);
    const halfThickness = ribbonThickness(frame.u);

    for (let vIndex = 0; vIndex < vSegments; vIndex += 1) {
      const vRatio = vIndex / vSegments;
      const crossSection = vRatio * Math.PI * 2;
      const point = ribbonPoint(
        frame,
        halfWidth * Math.cos(crossSection),
        halfThickness * Math.sin(crossSection),
      );

      positions.push(point[0], point[1], point[2]);
      uvs.push(uRatio, vRatio);
      outward.push(frame.outward[0], frame.outward[1]);
    }
  }

  const row = vSegments;
  const halfTurn = vSegments / 2;
  for (let uIndex = 0; uIndex < uSegments; uIndex += 1) {
    for (let vIndex = 0; vIndex < vSegments; vIndex += 1) {
      const a = uIndex * row + vIndex;
      const nextV = (vIndex + 1) % vSegments;
      const d = uIndex * row + nextV;
      const closesLoop = uIndex === uSegments - 1;
      const nextRow = closesLoop ? 0 : (uIndex + 1) * row;
      const b = closesLoop
        ? nextRow + ((vIndex + halfTurn) % vSegments)
        : nextRow + vIndex;
      const c = closesLoop
        ? nextRow + ((nextV + halfTurn) % vSegments)
        : nextRow + nextV;
      indices.push(a, b, d, b, c, d);
    }
  }

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute(
    "aOutward",
    new THREE.Float32BufferAttribute(outward, 2),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Coarse centre-line samples used to place pointer trails on the ribbon. */
const TRAIL_ANCHORS: RibbonFrame[] = createRibbonFrames(96);

interface LiquidObsidianMobiusProps {
  /** Freeze ornamental motion after the final performance degradation step. */
  frozen?: boolean;
  /** Adds geometry only on capable, high-density desktop screens. */
  highDetail?: boolean;
  /** Touch devices use drag inertia instead of pointer parallax. */
  touch?: boolean;
  /** Turns the sculpture into its faster black-and-red underworld form. */
  underworld?: boolean;
  /** Hides the mobile gesture hint after the first direct manipulation. */
  onFirstInteraction?: () => void;
  /** Projects the sculpture's moving highlight into the surrounding hero. */
  onLightChange?: (state: MobiusLightState) => void;
}

export interface MobiusLightState {
  x: number;
  y: number;
  energy: number;
  angle: number;
}

export function LiquidObsidianMobius({
  frozen = false,
  highDetail = false,
  touch = false,
  underworld = false,
  onFirstInteraction,
  onLightChange,
}: LiquidObsidianMobiusProps) {
  const groupRef = useRef<THREE.Group>(null);
  const scrollGroupRef = useRef<THREE.Group>(null);
  const sculptureRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const trailRef = useRef<THREE.Points>(null);
  const trailGeometryRef = useRef<THREE.BufferGeometry>(null);
  const trailMaterialRef = useRef<THREE.PointsMaterial>(null);
  const dissolveRef = useRef<THREE.Points>(null);
  const dissolveGeometryRef = useRef<THREE.BufferGeometry>(null);
  const dissolveMaterialRef = useRef<THREE.PointsMaterial>(null);
  const hovered = useRef(false);
  const elapsed = useRef(0);
  const pulse = useRef(0);
  const pulsePhase = useRef(0);
  const pulseHapticPending = useRef(false);
  const impact = useRef(0);
  const spinEnergy = useRef(0);
  /** Extra turn from clicks and drags; settles back on a half turn. */
  const spinOffset = useRef(0);
  const clickTimes = useRef<number[]>([]);
  const lastTap = useRef(0);
  const lastMaterialChange = useRef(Number.NEGATIVE_INFINITY);
  const longPressTimer = useRef<number | undefined>(undefined);
  const firstInteractionSent = useRef(false);
  const scrollTarget = useRef(0);
  const lastDissolve = useRef(Number.NEGATIVE_INFINITY);
  const lastLightUpdate = useRef(0);
  const materialTransition = useRef({ from: 0, to: 0, progress: 1 });
  const deviceTilt = useRef({ x: 0, y: 0 });
  const orientationBaseline = useRef<{ beta: number; gamma: number } | null>(
    null,
  );
  const orientationListener = useRef<
    ((event: DeviceOrientationEvent) => void) | null
  >(null);
  const { pointer } = useThree();

  const drag = useRef({
    active: false,
    x: 0,
    y: 0,
    travel: 0,
    longPressed: false,
  });
  const offset = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });

  const geometry = useMemo(
    () =>
      createInfinityRibbonGeometry(
        highDetail ? 240 : touch ? 120 : 160,
        highDetail ? 34 : touch ? 18 : 24,
      ),
    [highDetail, touch],
  );
  const trailFieldRef = useRef(createTrailField(touch ? 14 : 34));
  const dissolveFieldRef = useRef(createDissolveField(touch ? 36 : 78));
  const uniforms = useMemo(
    () => ({
      uActivity: { value: 0 },
      uImpact: { value: 0 },
      uModeFrom: { value: 0 },
      uModeProgress: { value: 1 },
      uModeTo: { value: 0 },
      uPointer: { value: new THREE.Vector2(3, 3) },
      uPulse: { value: 0 },
      uPulsePhase: { value: 0 },
      uScrollProgress: { value: 0 },
      uSpinEnergy: { value: 0 },
      uTime: { value: 0 },
      uUnderworld: { value: 0 },
    }),
    [],
  );

  useEffect(() => {
    const trailGeometry = trailGeometryRef.current;
    const dissolveGeometry = dissolveGeometryRef.current;
    if (trailGeometry) {
      trailGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(trailFieldRef.current.positions, 3),
      );
      trailGeometry.setAttribute(
        "color",
        new THREE.BufferAttribute(trailFieldRef.current.colors, 3),
      );
    }
    if (dissolveGeometry) {
      dissolveGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(dissolveFieldRef.current.positions, 3),
      );
      dissolveGeometry.setAttribute(
        "color",
        new THREE.BufferAttribute(dissolveFieldRef.current.colors, 3),
      );
    }
  }, []);

  useEffect(() => {
    const updateScroll = () => {
      const travel = Math.max(window.innerHeight * 0.82, 1);
      const nextScroll = clamp(window.scrollY / travel, 0, 1);
      // Keep this synchronized even while frameloop="never". Otherwise the
      // scene resumes from an old scroll state and rapidly catches up.
      scrollTarget.current = nextScroll;
    };
    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("resize", updateScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", updateScroll);
    };
  }, []);

  useEffect(
    () => () => {
      if (longPressTimer.current) {
        window.clearTimeout(longPressTimer.current);
      }
      if (orientationListener.current) {
        window.removeEventListener(
          "deviceorientation",
          orientationListener.current,
        );
      }
    },
    [],
  );

  useFrame((_, rawDelta) => {
    // R3F can report a large first delta after an off-screen pause. Capping it
    // prevents inertia, pulses and autonomous rotation from jumping at once.
    const delta = Math.min(rawDelta, 1 / 30);
    const group = groupRef.current;
    const scrollGroup = scrollGroupRef.current;
    const sculpture = sculptureRef.current;
    const material = materialRef.current;
    if (!group || !scrollGroup || !sculpture || !material) return;

    const dragState = drag.current;
    const response = Math.min(1, delta * 7);
    material.uniforms.uUnderworld!.value +=
      ((underworld ? 1 : 0) - material.uniforms.uUnderworld!.value) *
      Math.min(1, delta * 2.8);
    const aggression = material.uniforms.uUnderworld!.value as number;
    spinEnergy.current = Math.max(
      0,
      spinEnergy.current - delta * (0.82 + (1 - aggression) * 1.25),
    );
    impact.current = Math.max(
      0,
      impact.current - delta * (1.35 + (1 - aggression) * 1.4),
    );
    const scroll = scrollTarget.current;

    const transition = materialTransition.current;
    transition.progress = Math.min(1, transition.progress + delta * 0.92);

    if (pulse.current > 0) {
      pulsePhase.current += delta * (5.7 + aggression * 1.5);
      const pulseProgress = pulsePhase.current / FULL_TURN;
      pulse.current = clamp((1 - pulseProgress) / 0.2, 0, 1);
      if (pulseProgress >= 1) {
        pulse.current = 0;
        pulsePhase.current = 0;
        if (pulseHapticPending.current) navigator.vibrate?.(12);
        pulseHapticPending.current = false;
      }
    }

    if (!frozen) {
      elapsed.current += delta * (1 + aggression * 0.42);
    }

    // Performance degradation may pause the ornamental animation, but direct
    // manipulation must stay responsive on lower-powered Android devices.
    if (!dragState.active) {
      offset.current.x = clamp(
        offset.current.x + velocity.current.x,
        -0.38,
        0.38,
      );
      offset.current.y += velocity.current.y;
      const decay = Math.pow(0.91 + aggression * 0.035, delta * 60);
      velocity.current.x *= decay;
      velocity.current.y *= decay;
      offset.current.x += (0 - offset.current.x) * Math.min(1, delta * 0.9);
      offset.current.y += (0 - offset.current.y) * Math.min(1, delta * 0.18);
    }

    const gyroTiltX =
      touch && !dragState.active ? deviceTilt.current.y * 0.12 : 0;
    const gyroTiltY =
      touch && !dragState.active ? deviceTilt.current.x * 0.17 : 0;
    const pointerTiltX = touch ? gyroTiltX : pointer.y * 0.14;
    const pointerTiltY = touch ? gyroTiltY : pointer.x * 0.2;
    const targetX = 0.58 + pointerTiltX + offset.current.x;
    const targetY = -0.44 + pointerTiltY + offset.current.y;
    const rotationResponse =
      1 -
      Math.exp(
        -delta *
          (touch && dragState.active
            ? 13 + aggression * 8
            : 2.8 + aggression * 2.4),
      );
    group.rotation.x += (targetX - group.rotation.x) * rotationResponse;
    group.rotation.y += (targetY - group.rotation.y) * rotationResponse;
    // A touch to the right on desktop keeps the wider loop clear of the
    // headline column that overlaps the canvas.
    const targetPositionX = touch ? 0 : 0.24 + pointer.x * 0.12;
    const targetPositionY = touch ? 0 : pointer.y * 0.09;
    const positionResponse = 1 - Math.exp(-delta * 2.15);
    group.position.x += (targetPositionX - group.position.x) * positionResponse;
    group.position.y += (targetPositionY - group.position.y) * positionResponse;
    // A subtle scroll response is enough; a full turn looked like a burst of
    // autonomous motion when returning to the hero.
    scrollGroup.rotation.z = scroll * 0.85;
    scrollGroup.position.y = -scroll * 0.22;
    scrollGroup.scale.setScalar(1 - scroll * 0.08);

    if (!frozen) {
      const breath = Math.sin(elapsed.current * 1.38);
      const undertow = Math.sin(elapsed.current * 0.57 + 1.4);
      const predatorPulse = Math.sin(
        elapsed.current * 3.85 + Math.sin(elapsed.current * 1.13) * 0.9,
      );
      const livingScale =
        breath * 0.038 +
        undertow * 0.013 +
        predatorPulse * 0.032 * aggression +
        impact.current * 0.07 * aggression;

      // The loop no longer spins freely: an infinity that keeps turning reads
      // as an 8 half of the time. It sways around the horizontal instead, and
      // any extra turn from clicks or drags settles on the nearest half turn
      // (the figure-eight is symmetric under 180°).
      const kick =
        pulse.current * (0.85 + aggression * 0.45) +
        spinEnergy.current * aggression * 1.6 +
        impact.current * aggression * 2.1;
      spinOffset.current += delta * kick;
      const restingTurn = Math.round(spinOffset.current / Math.PI) * Math.PI;
      spinOffset.current +=
        (restingTurn - spinOffset.current) *
        Math.min(1, delta * 1.1) *
        (1 - Math.min(1, kick));
      sculpture.rotation.z =
        spinOffset.current +
        Math.sin(elapsed.current * 0.33) * 0.19 +
        Math.sin(elapsed.current * 0.71 + 1.3) * 0.055 +
        Math.sin(elapsed.current * 1.9) * 0.07 * aggression;
      sculpture.rotation.x =
        Math.sin(elapsed.current * 0.81) * 0.16 +
        Math.sin(elapsed.current * 1.93) * 0.052 +
        Math.sin(elapsed.current * 3.42) * 0.095 * aggression +
        Math.sin(elapsed.current * 13.0) * impact.current * aggression * 0.13;
      sculpture.rotation.y =
        Math.cos(elapsed.current * 0.66) * 0.19 +
        Math.sin(elapsed.current * 1.47) * 0.038 +
        Math.cos(elapsed.current * 4.18) * 0.072 * aggression;
      sculpture.position.x =
        Math.sin(elapsed.current * 0.72) * 0.045 +
        Math.sin(elapsed.current * 1.71) * 0.012 +
        Math.sin(elapsed.current * 3.6) * 0.026 * aggression;
      sculpture.position.y =
        Math.cos(elapsed.current * 0.59) * 0.034 +
        Math.sin(elapsed.current * 1.34) * 0.014 +
        Math.cos(elapsed.current * 3.15) * 0.021 * aggression;
      sculpture.position.z =
        Math.sin(elapsed.current * 0.91) * 0.026 +
        Math.sin(elapsed.current * 4.7) * 0.018 * aggression;
      sculpture.scale.set(
        1 + livingScale * (0.72 + aggression * 0.25),
        1 + livingScale * (1.12 + aggression * 0.42),
        1 - livingScale * (0.46 + aggression * 0.28),
      );
    }

    const lightNow = performance.now();
    if (
      onLightChange &&
      lightNow - lastLightUpdate.current >= (touch ? 80 : 50)
    ) {
      lastLightUpdate.current = lightNow;
      const orbit =
        sculpture.rotation.z +
        group.rotation.y * 0.62 +
        group.rotation.x * 0.24;
      onLightChange({
        x: touch ? 50 + Math.sin(orbit) * 9 : 62 + Math.sin(orbit) * 8,
        y: touch ? 64 + Math.cos(orbit * 0.82) * 6 : 50 + Math.cos(orbit) * 7,
        energy: clamp(
          0.46 +
            (hovered.current || dragState.active ? 0.2 : 0) +
            pulse.current * 0.2 +
            spinEnergy.current * 0.16 +
            aggression * 0.14,
          0,
          1,
        ),
        angle: (orbit * 180) / Math.PI,
      });
    }

    const trailField = trailFieldRef.current;
    const trailPositions = trailField.positions;
    const trailColors = trailField.colors;
    let trailChanged = false;
    for (let index = 0; index < trailField.life.length; index += 1) {
      const previousLife = trailField.life[index]!;
      if (previousLife <= 0) continue;

      const remaining = Math.max(0, previousLife - delta);
      trailField.life[index] = remaining;
      trailChanged = true;
      const offsetIndex = index * 3;
      if (remaining > 0) {
        const strength = remaining / TRAIL_LIFETIME;
        trailPositions[offsetIndex] =
          trailPositions[offsetIndex]! +
          trailField.velocities[offsetIndex]! * delta;
        trailPositions[offsetIndex + 1] =
          trailPositions[offsetIndex + 1]! +
          trailField.velocities[offsetIndex + 1]! * delta;
        trailPositions[offsetIndex + 2] =
          trailPositions[offsetIndex + 2]! +
          trailField.velocities[offsetIndex + 2]! * delta;
        trailColors[offsetIndex] = strength;
        trailColors[offsetIndex + 1] =
          strength * (aggression > 0.45 ? 0.08 : 0.58);
        trailColors[offsetIndex + 2] =
          strength * (aggression > 0.45 ? 0.025 : 0.12);
      } else {
        trailPositions[offsetIndex] = 20;
        trailPositions[offsetIndex + 1] = 20;
        trailPositions[offsetIndex + 2] = 20;
      }
    }
    if (trailChanged && trailRef.current) {
      const positionAttribute =
        trailRef.current.geometry.getAttribute("position");
      const colorAttribute = trailRef.current.geometry.getAttribute("color");
      if (positionAttribute) positionAttribute.needsUpdate = true;
      if (colorAttribute) colorAttribute.needsUpdate = true;
    }

    const dissolve = clamp((scroll - 0.18) / 0.82, 0, 1);
    const dissolveField = dissolveFieldRef.current;
    const dissolveChanged = Math.abs(dissolve - lastDissolve.current) > 0.002;
    if (dissolveChanged && dissolveRef.current && dissolveMaterialRef.current) {
      for (let index = 0; index < dissolveField.positions.length; index += 1) {
        dissolveField.positions[index] =
          dissolveField.base[index]! +
          dissolveField.directions[index]! * dissolve * 0.92;
      }
      const positionAttribute =
        dissolveRef.current.geometry.getAttribute("position");
      if (positionAttribute) positionAttribute.needsUpdate = true;
      dissolveMaterialRef.current.opacity = Math.sin(dissolve * Math.PI) * 0.78;
      lastDissolve.current = dissolve;
    }

    const targetActivity = hovered.current || dragState.active ? 1 : 0;
    const pointerUniform = material.uniforms.uPointer!.value as THREE.Vector2;
    pointerUniform.lerp(pointer, response);
    material.uniforms.uTime!.value = elapsed.current;
    material.uniforms.uImpact!.value = impact.current;
    material.uniforms.uPulse!.value = pulse.current;
    material.uniforms.uPulsePhase!.value = pulsePhase.current;
    material.uniforms.uScrollProgress!.value = scroll;
    material.uniforms.uSpinEnergy!.value = spinEnergy.current;
    material.uniforms.uModeFrom!.value = transition.from;
    material.uniforms.uModeTo!.value = transition.to;
    material.uniforms.uModeProgress!.value = transition.progress;
    material.uniforms.uActivity!.value +=
      (targetActivity - material.uniforms.uActivity!.value) * response;
  });

  function clearLongPress() {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = undefined;
    }
  }

  function isAggressiveMode() {
    return underworld;
  }

  function enableDeviceTilt() {
    if (!touch || orientationListener.current) return;

    const listener = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return;
      if (!orientationBaseline.current) {
        orientationBaseline.current = {
          beta: event.beta,
          gamma: event.gamma,
        };
      }
      const baseline = orientationBaseline.current;
      deviceTilt.current.x = clamp((event.gamma - baseline.gamma) / 24, -1, 1);
      deviceTilt.current.y = clamp((event.beta - baseline.beta) / 32, -1, 1);
    };

    orientationListener.current = listener;
    window.addEventListener("deviceorientation", listener, { passive: true });
  }

  function markFirstInteraction() {
    if (!firstInteractionSent.current) {
      firstInteractionSent.current = true;
      onFirstInteraction?.();
    }
    enableDeviceTilt();
  }

  function triggerPulse(withCompletionHaptic: boolean) {
    pulse.current = 1;
    pulsePhase.current = 0;
    pulseHapticPending.current = withCompletionHaptic;
  }

  function emitTrail(worldPoint: THREE.Vector3, movement: number) {
    const group = groupRef.current;
    if (!group || movement < 1.5) return;

    const local = group.worldToLocal(worldPoint.clone());
    // Snap the hit point to the nearest stretch of the ribbon's centre line,
    // projected on the drawing plane (the hit sphere has no useful depth).
    let anchor = TRAIL_ANCHORS[0]!;
    let nearest = Number.POSITIVE_INFINITY;
    for (const candidate of TRAIL_ANCHORS) {
      const dx = candidate.center[0] - local.x;
      const dy = candidate.center[1] - local.y;
      const distance = dx * dx + dy * dy;
      if (distance < nearest) {
        nearest = distance;
        anchor = candidate;
      }
    }
    const source = new THREE.Vector3(
      anchor.center[0] + anchor.outward[0] * 0.04,
      anchor.center[1] + anchor.outward[1] * 0.04,
      anchor.center[2],
    );

    const aggressiveMode = isAggressiveMode();
    const emissionCount = aggressiveMode
      ? movement > 8
        ? 3
        : 2
      : movement > 10
        ? 2
        : 1;
    const particleSpeed = aggressiveMode ? 1.65 : 1;
    for (let emission = 0; emission < emissionCount; emission += 1) {
      const trailField = trailFieldRef.current;
      const index = trailField.cursor % trailField.life.length;
      trailField.cursor += 1;
      const offsetIndex = index * 3;
      const seed = seededValue(trailField.cursor + emission);
      const radialX = anchor.outward[0] || anchor.center[0] * 0.5;
      const radialY = anchor.outward[1] || 0.35;

      trailField.positions[offsetIndex] = source.x + (seed - 0.5) * 0.055;
      trailField.positions[offsetIndex + 1] =
        source.y + (seededValue(index + 31) - 0.5) * 0.055;
      trailField.positions[offsetIndex + 2] = source.z;
      trailField.velocities[offsetIndex] =
        radialX * (0.12 + seed * 0.13) * particleSpeed;
      trailField.velocities[offsetIndex + 1] =
        (radialY * (0.12 + seed * 0.13) + 0.035) * particleSpeed;
      trailField.velocities[offsetIndex + 2] =
        (seed - 0.5) * 0.22 * particleSpeed;
      trailField.life[index] = TRAIL_LIFETIME;
    }
  }

  function handlePointerDown(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    (event.target as Element).setPointerCapture?.(event.pointerId);
    markFirstInteraction();
    hovered.current = true;
    drag.current = {
      active: true,
      x: event.clientX,
      y: event.clientY,
      travel: 0,
      longPressed: false,
    };
    velocity.current.x = 0;
    velocity.current.y = 0;

    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      const dragState = drag.current;
      if (!dragState.active || dragState.travel > 10) return;
      dragState.longPressed = true;
      impact.current = 1;
      spinEnergy.current = Math.max(spinEnergy.current, 0.72);
      triggerPulse(false);
      navigator.vibrate?.([24, 32, 54]);
      longPressTimer.current = undefined;
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(event: ThreeEvent<PointerEvent>) {
    const dragState = drag.current;
    if (!dragState.active) return;

    const dx = event.clientX - dragState.x;
    const dy = event.clientY - dragState.y;
    dragState.x = event.clientX;
    dragState.y = event.clientY;
    dragState.travel += Math.abs(dx) + Math.abs(dy);
    if (dragState.travel > 10) clearLongPress();

    const movement = Math.abs(dx) + Math.abs(dy);
    const aggressiveMode = isAggressiveMode();
    const dragMultiplier = aggressiveMode ? 1.48 : 1;
    const yaw = dx * (touch ? 0.0062 : 0.0045) * dragMultiplier;
    const tilt = dy * (touch ? 0.0044 : 0.0032) * dragMultiplier;
    offset.current.y += yaw;
    offset.current.x = clamp(offset.current.x + tilt, -0.38, 0.38);
    velocity.current.y = yaw;
    velocity.current.x = tilt;
    if (aggressiveMode) {
      spinEnergy.current = clamp(
        spinEnergy.current + movement * (touch ? 0.02 : 0.014),
        0,
        1,
      );
    }
    emitTrail(event.point, movement);
  }

  function handlePointerUp(event: ThreeEvent<PointerEvent>) {
    if (!drag.current.active) return;
    clearLongPress();
    drag.current.active = false;
    (event.target as Element).releasePointerCapture?.(event.pointerId);
    if (touch) hovered.current = false;
  }

  function handleLostPointerCapture() {
    clearLongPress();
    drag.current.active = false;
    if (touch) hovered.current = false;
  }

  function handleClick() {
    if (drag.current.longPressed) {
      drag.current.longPressed = false;
      return;
    }
    if (drag.current.travel > 8) return;

    const now = performance.now();
    const aggressiveMode = isAggressiveMode();
    triggerPulse(!aggressiveMode);
    if (aggressiveMode) {
      const kickDirection = clickTimes.current.length % 2 === 0 ? 1 : -1;
      impact.current = 1;
      spinEnergy.current = Math.max(spinEnergy.current, 0.86);
      offset.current.x = clamp(offset.current.x - 0.11, -0.38, 0.38);
      velocity.current.y += kickDirection * 0.052;
      navigator.vibrate?.([18, 16, 34]);
    }

    if (now - lastTap.current < 340) {
      // Consume the pair even during the cooldown so a rapid tap burst cannot
      // be reinterpreted as several consecutive material changes.
      lastTap.current = 0;
      const transition = materialTransition.current;
      const canChangeMaterial =
        !aggressiveMode &&
        transition.progress >= 0.92 &&
        now - lastMaterialChange.current >= MATERIAL_CHANGE_COOLDOWN_MS;

      if (canChangeMaterial) {
        // Red is exclusive to Underworld. Surface gestures only alternate
        // between obsidian and liquid gold.
        const nextMode = transition.to === 0 ? 1 : 0;
        transition.from = transition.to;
        transition.to = nextMode;
        transition.progress = 0;
        lastMaterialChange.current = now;
        navigator.vibrate?.([10, 24, 10]);
      }
    } else {
      lastTap.current = now;
    }

    const recent = clickTimes.current.filter((time) => now - time < 2000);
    recent.push(now);
    clickTimes.current = recent;
    if (recent.length >= 5) {
      clickTimes.current = [];
      lastTap.current = 0;
      lastMaterialChange.current = now;
      console.warn(
        '%c🔥 A fita não tem começo nem fim — nem lado de dentro. Digite "hades" (fora de um campo) para descer ao submundo.',
        "color:#e8a33d",
      );
    }
  }

  return (
    <Float
      speed={
        frozen ? 0 : underworld ? (touch ? 1.65 : 2.15) : touch ? 0.85 : 1.15
      }
      rotationIntensity={
        frozen ? 0 : underworld ? (touch ? 0.11 : 0.16) : touch ? 0.055 : 0.09
      }
      floatIntensity={
        frozen ? 0 : underworld ? (touch ? 0.28 : 0.36) : touch ? 0.18 : 0.25
      }
    >
      <group
        ref={groupRef}
        rotation={[0.58, -0.44, -0.1]}
        scale={touch ? 0.9 : 0.96}
      >
        <group ref={scrollGroupRef}>
          <group ref={sculptureRef}>
            <mesh geometry={geometry} raycast={() => null}>
              <shaderMaterial
                ref={materialRef}
                uniforms={uniforms}
                vertexShader={VERTEX_SHADER}
                fragmentShader={FRAGMENT_SHADER}
                side={THREE.DoubleSide}
              />
            </mesh>

            <points ref={dissolveRef} frustumCulled={false}>
              <bufferGeometry ref={dissolveGeometryRef} />
              <pointsMaterial
                ref={dissolveMaterialRef}
                size={touch ? 0.042 : 0.032}
                vertexColors
                transparent
                opacity={0}
                depthWrite={false}
                toneMapped={false}
                blending={THREE.AdditiveBlending}
              />
            </points>
          </group>
        </group>

        <points ref={trailRef} frustumCulled={false}>
          <bufferGeometry ref={trailGeometryRef} />
          <pointsMaterial
            ref={trailMaterialRef}
            size={touch ? 0.05 : 0.036}
            vertexColors
            transparent
            opacity={0.92}
            depthWrite={false}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
          />
        </points>

        <mesh
          onPointerOver={() => (hovered.current = true)}
          onPointerOut={() => (hovered.current = false)}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onLostPointerCapture={handleLostPointerCapture}
          onClick={handleClick}
        >
          <sphereGeometry args={[1.72, 24, 18]} />
          <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
        </mesh>
      </group>
    </Float>
  );
}
