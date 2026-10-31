import { useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Sphere, Torus, MeshDistortMaterial, Sparkles, Float } from '@react-three/drei'
import * as THREE from 'three'

/* ────────────────────────────────────────────
   Inner scene rendered inside the Canvas
   ──────────────────────────────────────────── */

function GlowingSphere() {
  const meshRef = useRef<THREE.Mesh>(null!)

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.15
      meshRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.3) * 0.1
    }
  })

  return (
    <Sphere ref={meshRef} args={[1, 64, 64]}>
      <MeshDistortMaterial
        color="#00e5ff"
        emissive="#4d7cfe"
        emissiveIntensity={0.4}
        roughness={0.2}
        metalness={0.8}
        distort={0.25}
        speed={1.5}
        transparent
        opacity={0.92}
      />
    </Sphere>
  )
}

function RotatingRings() {
  const ring1 = useRef<THREE.Mesh>(null!)
  const ring2 = useRef<THREE.Mesh>(null!)
  const ring3 = useRef<THREE.Mesh>(null!)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (ring1.current) {
      ring1.current.rotation.x = t * 0.5
      ring1.current.rotation.y = t * 0.3
    }
    if (ring2.current) {
      ring2.current.rotation.x = t * -0.4
      ring2.current.rotation.z = t * 0.35
    }
    if (ring3.current) {
      ring3.current.rotation.y = t * 0.6
      ring3.current.rotation.z = t * -0.25
    }
  })

  return (
    <>
      <Torus ref={ring1} args={[1.6, 0.02, 16, 100]} rotation={[Math.PI / 3, 0, 0]}>
        <meshStandardMaterial color="#00e5ff" emissive="#00e5ff" emissiveIntensity={0.8} transparent opacity={0.6} />
      </Torus>
      <Torus ref={ring2} args={[1.9, 0.015, 16, 100]} rotation={[Math.PI / 5, Math.PI / 4, 0]}>
        <meshStandardMaterial color="#7c3aed" emissive="#7c3aed" emissiveIntensity={0.8} transparent opacity={0.5} />
      </Torus>
      <Torus ref={ring3} args={[2.2, 0.01, 16, 100]} rotation={[Math.PI / 2, Math.PI / 6, Math.PI / 3]}>
        <meshStandardMaterial color="#4d7cfe" emissive="#4d7cfe" emissiveIntensity={0.6} transparent opacity={0.35} />
      </Torus>
    </>
  )
}

function OrbGroup() {
  const groupRef = useRef<THREE.Group>(null!)
  const { pointer } = useThree()

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    // gentle floating
    groupRef.current.position.y = Math.sin(t * 0.6) * 0.25
    // subtle mouse follow
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      pointer.y * 0.15,
      0.05
    )
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      pointer.x * 0.15,
      0.05
    )
  })

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.3}>
      <group ref={groupRef}>
        <GlowingSphere />
        <RotatingRings />

        {/* Floating particles */}
        <Sparkles
          count={80}
          scale={5}
          size={2}
          speed={0.4}
          color="#00e5ff"
          opacity={0.6}
        />
        <Sparkles
          count={40}
          scale={4}
          size={1.5}
          speed={0.3}
          color="#7c3aed"
          opacity={0.4}
        />
      </group>
    </Float>
  )
}

function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.15} />
      <pointLight position={[3, 2, 4]} color="#00e5ff" intensity={2} distance={10} />
      <pointLight position={[-3, -1, 3]} color="#7c3aed" intensity={1.5} distance={10} />
      <pointLight position={[0, 3, -2]} color="#4d7cfe" intensity={1} distance={8} />
    </>
  )
}

/* ────────────────────────────────────────────
   Fallback when WebGL is unavailable
   ──────────────────────────────────────────── */

function WebGLFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="relative">
        {/* Outer glow rings */}
        <div className="absolute inset-0 animate-spin-slow rounded-full border-2 border-cyan-400/30 blur-sm" style={{ width: 220, height: 220, top: -10, left: -10 }} />
        <div className="absolute inset-0 rounded-full border border-neon-purple/20" style={{ width: 260, height: 260, top: -30, left: -30, animation: 'spin 25s linear infinite reverse' }} />
        {/* Core orb */}
        <div className="h-[200px] w-[200px] animate-float rounded-full bg-gradient-to-br from-cyan-400/40 via-neon-blue/30 to-neon-purple/40 shadow-2xl shadow-cyan-400/20 backdrop-blur-xl" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-24 w-24 rounded-full bg-gradient-to-br from-cyan-400/60 to-neon-blue/40 blur-xl" />
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────
   Loading fallback while canvas initializes
   ──────────────────────────────────────────── */

function CanvasLoader() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-32 w-32 animate-pulse rounded-full bg-gradient-to-br from-cyan-400/20 to-neon-purple/20 blur-xl" />
    </div>
  )
}

/* ────────────────────────────────────────────
   Exported AIOrb component
   ──────────────────────────────────────────── */

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    )
  } catch {
    return false
  }
}

const AIOrb = () => {
  const webgl = useMemo(() => isWebGLAvailable(), [])

  if (!webgl) {
    return (
      <div className="h-full w-full">
        <WebGLFallback />
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <Suspense fallback={<CanvasLoader />}>
        <Canvas
          camera={{ position: [0, 0, 5], fov: 45 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true }}
          style={{ background: 'transparent' }}
        >
          <SceneLighting />
          <OrbGroup />
        </Canvas>
      </Suspense>
    </div>
  )
}

export default AIOrb
