
import React, { useMemo } from 'react';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { PlotCorners, Point2D } from '../types';

interface DimensionLineProps {
  start: [number, number, number];
  end: [number, number, number];
  label: string;
  color?: string;
  offsetY?: number;
  visible?: boolean;
  normal: [number, number, number];
  isPlotStep?: boolean;
}

const TextLabel = ({ text, color = "#0f172a" }: { text: string, color?: string }) => {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = color; 
      ctx.beginPath();
      ctx.roundRect(280, 40, 464, 176, 24);
      ctx.fill();
      
      ctx.fillStyle = 'white';
      ctx.font = '900 128px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 512, 128);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 16;
    return tex;
  }, [text, color]);

  return (
    <Billboard>
      <mesh>
        <planeGeometry args={[10, 2.5]} />
        <meshBasicMaterial map={texture} transparent alphaTest={0.1} depthWrite={false} />
      </mesh>
    </Billboard>
  );
};

const DimensionLine: React.FC<DimensionLineProps> = ({ start, end, label, color = "#0f172a", offsetY = 0.05, visible = true, normal }) => {
  if (!visible) return null;
  const labelOffset = 6.0;
  
  const { startVec, endVec, dimStart, dimEnd, midPoint, direction, lineGeometry } = useMemo(() => {
    const sV = new THREE.Vector3(start[0], start[1] + offsetY, start[2]);
    const eV = new THREE.Vector3(end[0], end[1] + offsetY, end[2]);
    const outNormal = new THREE.Vector3(...normal).normalize();
    
    const dS = sV.clone().add(outNormal.clone().multiplyScalar(labelOffset));
    const dE = eV.clone().add(outNormal.clone().multiplyScalar(labelOffset));
    const mP = new THREE.Vector3().addVectors(dS, dE).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(dE, dS).normalize();
    
    const geometry = new THREE.BufferGeometry().setFromPoints([dS, dE]);
    
    return { startVec: sV, endVec: eV, dimStart: dS, dimEnd: dE, midPoint: mP, direction: dir, lineGeometry: geometry };
  }, [start, end, normal, offsetY]);

  const tickStartGeom = useMemo(() => new THREE.BufferGeometry().setFromPoints([startVec, dimStart]), [startVec, dimStart]);
  const tickEndGeom = useMemo(() => new THREE.BufferGeometry().setFromPoints([endVec, dimEnd]), [endVec, dimEnd]);

  return (
    <group>
      {/* Main dimension line segment */}
      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial attach="material" color={color} transparent opacity={0.6} />
      </lineSegments>
      
      {/* Tick lines for dimension start and end */}
      <lineSegments geometry={tickStartGeom}>
        <lineBasicMaterial attach="material" color={color} transparent opacity={0.3} />
      </lineSegments>
      <lineSegments geometry={tickEndGeom}>
        <lineBasicMaterial attach="material" color={color} transparent opacity={0.3} />
      </lineSegments>

      {/* Dimension arrow markers */}
      <mesh position={[dimStart.x, dimStart.y, dimStart.z]} rotation={[0, -Math.atan2(direction.z, direction.x), Math.PI / 4]}>
        <boxGeometry args={[0.04, 2.0, 0.04]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
      
      <mesh position={[dimEnd.x, dimEnd.y, dimEnd.z]} rotation={[0, -Math.atan2(direction.z, direction.x), Math.PI / 4]}>
        <boxGeometry args={[0.04, 2.0, 0.04]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>

      {/* Numeric value label billboard */}
      <group position={[midPoint.x, midPoint.y + 2.0, midPoint.z]}>
        <TextLabel text={label} color={color} />
      </group>
    </group>
  );
};

interface DimensionsGroupProps {
  corners: PlotCorners | null;
  houseWidth: number;
  houseLength: number;
  housePosX: number;
  housePosZ: number;
  showHouse: boolean;
  currentStep: number;
}

const DimensionLines: React.FC<DimensionsGroupProps> = ({ corners, houseWidth, houseLength, housePosX, housePosZ, showHouse, currentStep }) => {
  const isPlotStep = currentStep === 0;
  
  const dist = (p1: Point2D, p2: Point2D) => 
    Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.z - p1.z, 2));

  const vertices = useMemo(() => {
    if (!corners) return [];
    return corners.vertices || [corners.nw, corners.ne, corners.se, corners.sw];
  }, [corners]);

  const centroid = useMemo(() => {
    if (vertices.length === 0) return { x: 0, z: 0 };
    let x = 0, z = 0;
    vertices.forEach(v => { x += v.x; z += v.z; });
    return { x: x / vertices.length, z: z / vertices.length };
  }, [vertices]);

  if (!corners || vertices.length < 2) return null;

  return (
    <group>
      {/* Plot boundary dimension lines */}
      {vertices.map((v, i) => {
        const nextV = vertices[(i + 1) % vertices.length];
        const d = dist(v, nextV);
        const dx = nextV.x - v.x;
        const dz = nextV.z - v.z;
        let nx = -dz;
        let nz = dx;
        const midX = (v.x + nextV.x) / 2;
        const midZ = (v.z + nextV.z) / 2;
        const toMid = { x: midX - centroid.x, z: midZ - centroid.z };
        if (nx * toMid.x + nz * toMid.z < 0) {
          nx = -nx;
          nz = -nz;
        }

        return (
          <DimensionLine 
            key={`plot-dim-${i}-${v.x}-${v.z}`}
            start={[v.x, 0, v.z]} 
            end={[nextV.x, 0, nextV.z]} 
            label={`${(d || 0).toFixed(1)}m`} 
            normal={[nx, 0, nz]} 
            isPlotStep={isPlotStep} 
          />
        );
      })}

      {/* House structure dimension lines when visible */}
      {showHouse && (
        <group>
          <DimensionLine 
            start={[-houseWidth / 2 + housePosX, 0.5, houseLength / 2 + housePosZ]} 
            end={[houseWidth / 2 + housePosX, 0.5, houseLength / 2 + housePosZ]} 
            label={`${(houseWidth || 0).toFixed(1)}m`} 
            color="#ff5f1f" 
            normal={[0, 0, 1]} 
          />
          <DimensionLine 
            start={[houseWidth / 2 + housePosX, 0.5, -houseLength / 2 + housePosZ]} 
            end={[houseWidth / 2 + housePosX, 0.5, houseLength / 2 + housePosZ]} 
            label={`${(houseLength || 0).toFixed(1)}m`} 
            color="#ff5f1f" 
            normal={[1, 0, 0]} 
          />
        </group>
      )}
    </group>
  );
};

export default DimensionLines;
