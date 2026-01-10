"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float } from "@react-three/drei";
import * as THREE from "three";
import { useMemo, useRef } from "react";

function FluxTerrain() {
    const mesh = useRef<THREE.Mesh>(null);
    const geometry = useRef<THREE.PlaneGeometry>(null);

    // Geometry parameters
    const width = 20;
    const depth = 20;
    const segments = 40;

    useFrame((state) => {
        if (!geometry.current) return;

        const time = state.clock.getElapsedTime();
        const positions = geometry.current.attributes.position;

        // Manual vertex displacement for wave effect
        // We iterate through vertices to creating a flowing "saddle" or wave shape
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i); // In PlaneGeometry, usually Z is flat, but we rotate it. Let's assume standard UV mapping.
            // Actually PlaneGeometry is X,Y. Z is 0.

            // Let's rely on the initial grid X,Y
            // We modulate Z height.

            // Calculate wave based on X and Y
            const waveX1 = 0.5 * Math.sin(x * 0.5 + time * 0.5);
            const waveX2 = 0.25 * Math.sin(x * 1.5 + time * 0.5);
            const waveY1 = 0.5 * Math.sin(y * 0.5 + time * 0.5);

            const multi = (x + 10) / 20; // mask ?

            const z = (waveX1 + waveX2 + waveY1) * 1.5;

            positions.setZ(i, z);
        }

        positions.needsUpdate = true;

        if (mesh.current) {
            mesh.current.rotation.z = time * 0.05; // Slow rotation
        }
    });

    return (
        <group rotation={[-Math.PI / 2.5, 0, 0]} position={[0, -2, 0]}>
            <mesh ref={mesh}>
                <planeGeometry ref={geometry} args={[width, depth, segments, segments]} />
                <meshBasicMaterial
                    color="#00F0FF"
                    wireframe
                    transparent
                    opacity={0.15}
                    side={THREE.DoubleSide}
                />
            </mesh>
            {/* Duplicate for glow effect */}
            <mesh position={[0, 0, -0.1]}>
                <planeGeometry args={[width, depth, segments, segments]} />
                <meshBasicMaterial
                    color="#FF2E63"
                    wireframe
                    transparent
                    opacity={0.05}
                    side={THREE.DoubleSide}
                />
            </mesh>
        </group>
    );
}

export default function Hero3D() {
    return (
        <div className="w-full h-full absolute inset-0 z-0 pointer-events-none">
            <Canvas camera={{ position: [0, 0, 10], fov: 45 }} gl={{ alpha: true }}>
                {/* Minimal Lighting */}
                <ambientLight intensity={0.5} />

                {/* The Flux Terrain */}
                <FluxTerrain />

                {/* Floating particles for depth */}
                <Float speed={1} rotationIntensity={0.5} floatIntensity={0.5}>
                    <points position={[0, 2, 0]}>
                        <sphereGeometry args={[8, 32, 32]} />
                        <pointsMaterial size={0.02} color="#ffffff" transparent opacity={0.4} sizeAttenuation />
                    </points>
                </Float>
            </Canvas>
        </div>
    );
}
