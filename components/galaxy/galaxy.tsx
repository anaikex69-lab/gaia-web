"use client"

import { useFrame, useThree } from "@react-three/fiber"
import { useMemo, useRef } from "react"
import * as THREE from "three"
import { generateGalaxy } from "./galaxy-data"

const starVertex = /* glsl */ `
  uniform float uTime;
  uniform float uThinking;
  uniform float uWaveA;
  uniform float uWaveB;
  uniform float uPixelRatio;
  attribute float aSize;
  attribute float aRadius;
  attribute float aSeed;
  varying float vIntensity;
  varying vec3 vColor;

  float waveBump(float r, float front) {
    float d = r - front;
    return exp(-d * d * 70.0);
  }

  void main() {
    vColor = color;

    // continuous gentle twinkle
    float twinkle = 0.65 + 0.35 * sin(uTime * 1.4 + aSeed * 6.2831);

    // expanding pulse waves while thinking
    float wave = max(waveBump(aRadius, uWaveA), waveBump(aRadius, uWaveB));
    float pulse = wave * uThinking;

    vIntensity = twinkle * (0.55 + 0.25 * uThinking) + pulse * 2.2;

    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float size = aSize * (1.0 + pulse * 2.6);
    gl_PointSize = size * uPixelRatio * (8.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`

const starFragment = /* glsl */ `
  varying float vIntensity;
  varying vec3 vColor;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    float glow = pow(core, 2.2);
    vec3 c = vColor * vIntensity;
    // hot white core for bright stars
    c += vec3(1.0) * pow(core, 6.0) * vIntensity * 0.5;
    gl_FragColor = vec4(c, glow);
  }
`

const lineVertex = /* glsl */ `
  uniform float uTime;
  uniform float uThinking;
  uniform float uWaveA;
  uniform float uWaveB;
  attribute float aRadius;
  attribute float aSeed;
  varying float vIntensity;
  varying vec3 vColor;

  float waveBump(float r, float front) {
    float d = r - front;
    return exp(-d * d * 55.0);
  }

  void main() {
    vColor = color;
    float idle = 0.12 + 0.06 * sin(uTime * 0.8 + aSeed);
    float wave = max(waveBump(aRadius, uWaveA), waveBump(aRadius, uWaveB));
    float pulse = wave * uThinking;
    vIntensity = idle + pulse * 1.6;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const lineFragment = /* glsl */ `
  varying float vIntensity;
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor * vIntensity, vIntensity);
  }
`

export function Galaxy({ thinking }: { thinking: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const starMat = useRef<THREE.ShaderMaterial>(null)
  const lineMat = useRef<THREE.ShaderMaterial>(null)
  const { gl } = useThree()

  const data = useMemo(() => generateGalaxy({ count: 1400, neighbors: 3 }), [])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uThinking: { value: 0 },
      uWaveA: { value: -1 },
      uWaveB: { value: -1 },
      uPixelRatio: { value: 1 },
    }),
    [],
  )

  // shared thinking value so both materials stay in sync
  const thinkRef = useRef(0)

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime

    // smoothly ease the thinking factor
    const target = thinking ? 1 : 0
    thinkRef.current += (target - thinkRef.current) * Math.min(1, delta * 4)
    const think = thinkRef.current

    // two interleaved expanding wave fronts (normalized radius 0 -> ~1.25)
    const speed = 0.85
    const period = 1.25 / speed
    const waveA = ((t * speed) % 1.25)
    const waveB = (((t * speed) + 0.625) % 1.25)
    void period

    if (starMat.current) {
      const u = starMat.current.uniforms
      u.uTime.value = t
      u.uThinking.value = think
      u.uWaveA.value = think > 0.01 ? waveA : -1
      u.uWaveB.value = think > 0.01 ? waveB : -1
      u.uPixelRatio.value = gl.getPixelRatio()
    }
    if (lineMat.current) {
      const u = lineMat.current.uniforms
      u.uTime.value = t
      u.uThinking.value = think
      u.uWaveA.value = think > 0.01 ? waveA : -1
      u.uWaveB.value = think > 0.01 ? waveB : -1
    }

    if (groupRef.current) {
      // slow continuous rotation, subtle speed-up while thinking
      groupRef.current.rotation.y += delta * (0.06 + think * 0.05)
    }
  })

  return (
    <group ref={groupRef} rotation={[Math.PI * 0.18, 0, 0]}>
      {/* connections */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[data.linePositions, 3]} />
          <bufferAttribute attach="attributes-color" args={[data.lineColors, 3]} />
          <bufferAttribute attach="attributes-aRadius" args={[data.lineRadii, 1]} />
          <bufferAttribute attach="attributes-aSeed" args={[data.lineSeeds, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={lineMat}
          vertexShader={lineVertex}
          fragmentShader={lineFragment}
          uniforms={uniforms}
          transparent
          vertexColors
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      {/* stars */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[data.colors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[data.sizes, 1]} />
          <bufferAttribute attach="attributes-aRadius" args={[data.radii, 1]} />
          <bufferAttribute attach="attributes-aSeed" args={[data.seeds, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={starMat}
          vertexShader={starVertex}
          fragmentShader={starFragment}
          uniforms={uniforms}
          transparent
          vertexColors
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* glowing galactic core */}
      <Core />
    </group>
  )
}

function Core() {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  useFrame((state) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.elapsedTime
  })
  return (
    <mesh>
      <sphereGeometry args={[0.9, 32, 32]} />
      <shaderMaterial
        ref={matRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{ uTime: { value: 0 } }}
        vertexShader={/* glsl */ `
          varying vec3 vN;
          varying vec3 vView;
          void main(){
            vN = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position,1.0);
            vView = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={/* glsl */ `
          uniform float uTime;
          varying vec3 vN;
          varying vec3 vView;
          void main(){
            // bright center, soft falloff toward the rim (glowing orb, not a hard ball)
            float facing = max(dot(vN, vView), 0.0);
            float glow = pow(facing, 2.5);
            float pulse = 0.85 + 0.15 * sin(uTime * 1.2);
            vec3 col = mix(vec3(0.45,0.7,1.0), vec3(1.0), glow) * pulse;
            gl_FragColor = vec4(col, glow * 0.55);
          }
        `}
      />
    </mesh>
  )
}