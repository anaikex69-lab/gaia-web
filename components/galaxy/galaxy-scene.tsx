"use client"

import { Canvas } from "@react-three/fiber"
import { useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { Galaxy } from "./galaxy"

function BackgroundStars() {
  const ref = useRef<THREE.Points>(null)
  const { positions, sizes } = useMemo(() => {
    const n = 900
    const positions = new Float32Array(n * 3)
    const sizes = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      // distribute on a large sphere shell
      const r = 30 + Math.random() * 40
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.cos(phi)
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
      sizes[i] = Math.random() * 1.6 + 0.3
    }
    return { positions, sizes }
  }, [])

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.01
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{}}
        vertexShader={/* glsl */ `
          attribute float size;
          varying float vS;
          void main(){
            vS = size;
            vec4 mv = modelViewMatrix * vec4(position,1.0);
            gl_PointSize = size * (200.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={/* glsl */ `
          varying float vS;
          void main(){
            float d = length(gl_PointCoord - vec2(0.5));
            if(d>0.5) discard;
            float a = smoothstep(0.5,0.0,d);
            gl_FragColor = vec4(vec3(0.8,0.9,1.0), a * 0.8);
          }
        `}
      />
    </points>
  )
}

export function GalaxyScene({ thinking }: { thinking: boolean }) {
  return (
    <Canvas
      camera={{ position: [0, 7, 15], fov: 55, near: 0.1, far: 200 }}
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 2]}
    >
      <color attach="background" args={["#03040a"]} />
      <fog attach="fog" args={["#03040a", 22, 60]} />
      <BackgroundStars />
      <Galaxy thinking={thinking} />
    </Canvas>
  )
}