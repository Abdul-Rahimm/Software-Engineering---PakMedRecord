import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { usePrefersReducedMotion } from './motion';

// Liquid core inside a wireframe shell, circled by orbiting satellites
const Core = ({ accent }) => {
  const shell = useRef();
  const orbit = useRef();
  useFrame((state, d) => {
    if (shell.current) {
      shell.current.rotation.y += d * 0.25;
      shell.current.rotation.x += d * 0.1;
    }
    if (orbit.current) orbit.current.rotation.y -= d * 0.6;
    const { x, y } = state.pointer;
    state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, x * 0.8, 0.04);
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, y * 0.6, 0.04);
    state.camera.lookAt(0, 0, 0);
  });
  return (
    <group>
      <Float speed={2} rotationIntensity={0.6} floatIntensity={1.2}>
        <mesh>
          <icosahedronGeometry args={[1.25, 24]} />
          <MeshDistortMaterial color="#0b3b2e" emissive={accent} emissiveIntensity={0.14} roughness={0.22} metalness={0.35} distort={0.38} speed={2.2} />
        </mesh>
        <mesh ref={shell} scale={1.9}>
          <icosahedronGeometry args={[1, 1]} />
          <meshBasicMaterial color="#9fffe0" wireframe transparent opacity={0.22} toneMapped={false} />
        </mesh>
      </Float>
      <group ref={orbit} rotation={[0.5, 0, 0.25]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.9, 0.008, 8, 200]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.45} toneMapped={false} />
        </mesh>
        {[0, 2.1, 4.2].map((a) => (
          <mesh key={a} position={[Math.cos(a) * 2.9, 0, Math.sin(a) * 2.9]}>
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshBasicMaterial color={new THREE.Color('#3dffb0').multiplyScalar(2)} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

const OrbScene = ({ className, style, accent = '#10d68a', lift = 0 }) => {
  const reduced = usePrefersReducedMotion();
  return (
    <div className={className} style={style} aria-hidden>
      <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0, 7.5], fov: 45 }} gl={{ alpha: true, antialias: true }} frameloop={reduced ? 'demand' : 'always'}>
        <ambientLight intensity={0.4} />
        <pointLight position={[4, 4, 5]} intensity={70} color="#3dffb0" />
        <pointLight position={[-5, -3, 2]} intensity={60} color="#8b7bff" />
        <group position={[0, lift, 0]} scale={lift ? 0.82 : 1}>
          <Core accent={accent} />
        </group>
        <Sparkles count={70} scale={[9, 7, 5]} size={2} speed={0.4} color="#bdfcff" />
        <EffectComposer disableNormalPass>
          <Bloom intensity={1.1} luminanceThreshold={0.15} mipmapBlur />
        </EffectComposer>
      </Canvas>
    </div>
  );
};

export default OrbScene;
