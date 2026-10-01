import { useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { usePrefersReducedMotion } from './motion';

const PAIRS = 46;
const RADIUS = 1.35;
const RISE = 0.24;
const TWIST = 0.36;

// HDR (>1) instance colours so the nucleotides catch the bloom pass
const strandColorA = new THREE.Color('#3dffb0').multiplyScalar(1.6);
const strandColorB = new THREE.Color('#22d3ee').multiplyScalar(1.6);
const rungColor = new THREE.Color('#8b7bff');

// Instanced double helix: two strands of glowing nucleotides joined by base-pair rungs
const Helix = () => {
  const group = useRef();
  const spheres = useRef();
  const rungs = useRef();

  const { sphereMatrices, sphereColors, rungMatrices } = useMemo(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const sm = [];
    const sc = [];
    const rm = [];
    const up = new THREE.Vector3(0, 1, 0);
    const half = (PAIRS * RISE) / 2;

    for (let i = 0; i < PAIRS; i++) {
      const a = i * TWIST;
      const y = i * RISE - half;
      const p1 = new THREE.Vector3(Math.cos(a) * RADIUS, y, Math.sin(a) * RADIUS);
      const p2 = new THREE.Vector3(Math.cos(a + Math.PI) * RADIUS, y, Math.sin(a + Math.PI) * RADIUS);

      const size = 0.13 + 0.03 * Math.sin(i * 0.7);
      s.setScalar(size);
      sm.push(m.clone().compose(p1, q.identity(), s));
      sm.push(m.clone().compose(p2, q.identity(), s));
      sc.push(strandColorA, strandColorB);

      // rung between the pair
      const mid = p1.clone().add(p2).multiplyScalar(0.5);
      const dir = p2.clone().sub(p1);
      const len = dir.length();
      const rq = new THREE.Quaternion().setFromUnitVectors(up, dir.normalize());
      rm.push(new THREE.Matrix4().compose(mid, rq, new THREE.Vector3(1, len, 1)));
    }
    return { sphereMatrices: sm, sphereColors: sc, rungMatrices: rm };
  }, []);

  useLayoutEffect(() => {
    sphereMatrices.forEach((mat, i) => {
      spheres.current.setMatrixAt(i, mat);
      spheres.current.setColorAt(i, sphereColors[i]);
    });
    spheres.current.instanceMatrix.needsUpdate = true;
    spheres.current.instanceColor.needsUpdate = true;
    rungMatrices.forEach((mat, i) => rungs.current.setMatrixAt(i, mat));
    rungs.current.instanceMatrix.needsUpdate = true;
  }, [sphereMatrices, sphereColors, rungMatrices]);

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.35;
    // gentle parallax toward the pointer
    const { x, y } = state.pointer;
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -0.35 + y * 0.18, 0.04);
    group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, 0.42 - x * 0.15, 0.04);
  });

  return (
    <group ref={group} rotation={[-0.35, 0, 0.42]}>
      <instancedMesh ref={spheres} args={[null, null, PAIRS * 2]}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial toneMapped={false} roughness={0.2} metalness={0.1} />
      </instancedMesh>
      <instancedMesh ref={rungs} args={[null, null, PAIRS]}>
        <cylinderGeometry args={[0.022, 0.022, 1, 8]} />
        <meshStandardMaterial color={rungColor} emissive={rungColor} emissiveIntensity={1.4} toneMapped={false} transparent opacity={0.75} />
      </instancedMesh>
    </group>
  );
};

// Thin orbit rings around the helix
const Rings = () => {
  const ref = useRef();
  useFrame((_, d) => {
    if (ref.current) {
      ref.current.rotation.z += d * 0.08;
      ref.current.rotation.x += d * 0.03;
    }
  });
  return (
    <group ref={ref} rotation={[1.2, 0.2, 0]}>
      {[3.2, 4.1, 5.2].map((r, i) => (
        <mesh key={r} rotation={[0, 0, i * 0.6]}>
          <torusGeometry args={[r, 0.006, 8, 160]} />
          <meshBasicMaterial color={i === 1 ? '#22d3ee' : '#3dffb0'} transparent opacity={0.28 - i * 0.06} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
};

const HelixScene = ({ className, style }) => {
  const reduced = usePrefersReducedMotion();
  return (
    <div className={className} style={style} aria-hidden>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 9], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        frameloop={reduced ? 'demand' : 'always'}
      >
        <color attach="background" args={['#04060c']} />
        <ambientLight intensity={0.35} />
        <pointLight position={[6, 6, 6]} intensity={60} color="#3dffb0" />
        <pointLight position={[-6, -4, 4]} intensity={50} color="#8b7bff" />
        <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.8}>
          <Helix />
        </Float>
        <Rings />
        <Sparkles count={140} scale={[14, 10, 8]} size={2.2} speed={0.35} color="#9fffe0" opacity={0.7} />
        <EffectComposer disableNormalPass>
          <Bloom intensity={1.25} luminanceThreshold={0.12} luminanceSmoothing={0.3} mipmapBlur />
        </EffectComposer>
      </Canvas>
    </div>
  );
};

export default HelixScene;
