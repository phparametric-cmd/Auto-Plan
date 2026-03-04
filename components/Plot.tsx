
import React, { useState, useMemo, useEffect } from 'react';
import { ThreeEvent, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { PlotCorners } from '../types';

interface PlotProps {
  corners: PlotCorners | null;
  gatePosX: number; 
  gateSideIndex: number;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  onUpdateGateSide?: (index: number, pos?: number) => void;
  customHandlePointerDown?: (type: 'side' | 'corner' | 'gate', id: string, e: ThreeEvent<PointerEvent>) => void;
  selected?: boolean;
  isPlotStep?: boolean;
}

const PlotCornerHandle = ({ position, onPointerDown }: { 
  position: [number, number, number], 
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void
}) => {
  const [hovered, setHover] = useState(false);
  return (
    <group position={position}>
      <mesh 
        onPointerDown={(e) => onPointerDown(e)} 
        onPointerOver={() => { setHover(true); document.body.style.cursor = 'move'; }} 
        onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto'; }}
      >
        <sphereGeometry args={[0.7, 16, 16]} />
        <meshStandardMaterial color={hovered ? "#ff5f1f" : "#3b82f6"} emissive={hovered ? "#ff5f1f" : "#3b82f6"} emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
};

const Plot: React.FC<PlotProps> = ({ corners, gatePosX, gateSideIndex, onClick, onUpdateGateSide, customHandlePointerDown, selected, isPlotStep }) => {
  const vertices = useMemo(() => {
    if (!corners) return [];
    return corners.vertices || [corners.nw, corners.ne, corners.se, corners.sw];
  }, [corners]);

  const gridTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = '#548e42';
      context.fillRect(0, 0, 128, 128);
      context.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      context.lineWidth = 2;
      context.strokeRect(0, 0, 128, 128);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    
    if (vertices.length > 0) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      vertices.forEach(v => {
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.z < minZ) minZ = v.z;
        if (v.z > maxZ) maxZ = v.z;
      });
      const width = maxX - minX;
      const height = maxZ - minZ;
      tex.repeat.set(width, height);
    } else {
      tex.repeat.set(10, 10);
    }
    
    return tex;
  }, [vertices]);

  const shape = useMemo(() => {
    if (vertices.length < 3) return null;
    const s = new THREE.Shape();
    s.moveTo(vertices[0].x, -vertices[0].z);
    for(let i = 1; i < vertices.length; i++) {
      s.lineTo(vertices[i].x, -vertices[i].z);
    }
    s.closePath();
    return s;
  }, [vertices]);

  const segments = useMemo(() => {
    if (vertices.length < 2) return [];
    const segs = [];
    for (let i = 0; i < vertices.length; i++) {
      segs.push({ start: vertices[i], end: vertices[(i + 1) % vertices.length] });
    }
    return segs;
  }, [vertices]);

  const gateSegment = useMemo(() => segments.length > 0 ? segments[gateSideIndex % segments.length] : null, [segments, gateSideIndex]);
  const gateWorldPos = useMemo(() => {
    if (!gateSegment) return new THREE.Vector3();
    const s = new THREE.Vector3(gateSegment.start.x, 0, gateSegment.start.z);
    const e = new THREE.Vector3(gateSegment.end.x, 0, gateSegment.end.z);
    return new THREE.Vector3().lerpVectors(s, e, gatePosX);
  }, [gateSegment, gatePosX]);

  const gateAngle = useMemo(() => {
    if (!gateSegment) return 0;
    const dx = gateSegment.end.x - gateSegment.start.x;
    const dz = gateSegment.end.z - gateSegment.start.z;
    return Math.atan2(dz, dx);
  }, [gateSegment]);

  if (!corners || !shape) return null;

  return (
    <group>
      {/* Grass Ground Mesh */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow onClick={onClick}>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial 
          map={gridTexture}
          roughness={0.8} 
        />
      </mesh>
      
      {/* Plot Fence/Wall boundaries */}
      <group>
        {segments.map((seg, i) => {
          const s = new THREE.Vector3(seg.start.x, 0, seg.start.z);
          const e = new THREE.Vector3(seg.end.x, 0, seg.end.z);
          const d = new THREE.Vector3().subVectors(e, s);
          const l = d.length();
          const c = new THREE.Vector3().addVectors(s, e).multiplyScalar(0.5);
          const a = Math.atan2(d.z, d.x);

          const isFront = i === gateSideIndex % segments.length;
          if (isFront) {
             const gateWidth = 5;
             const p1_len = Math.max(0.1, l * gatePosX - (gateWidth/2));
             const p2_len = Math.max(0.1, l * (1 - gatePosX) - (gateWidth/2));
             
             return (
               <group key={i} onClick={(e) => {
                 if (isPlotStep) {
                   e.stopPropagation();
                   // Calculate local position on the segment
                   if (e.point) {
                     const s = new THREE.Vector3(seg.start.x, 0, seg.start.z);
                     const e_vec = new THREE.Vector3(seg.end.x, 0, seg.end.z);
                     const d = new THREE.Vector3().subVectors(e_vec, s);
                     const l = d.length();
                     const p = new THREE.Vector3().subVectors(e.point, s);
                     const t = p.dot(d) / (l * l);
                     onUpdateGateSide?.(i, Math.max(0.1, Math.min(0.9, t)));
                   } else {
                     onUpdateGateSide?.(i);
                   }
                 }
               }}>
                 <mesh position={[s.x + (d.x * (p1_len/ (2*l))), 0.4, s.z + (d.z * (p1_len / (2*l)))]} rotation={[0, -a, 0]} castShadow>
                   <boxGeometry args={[p1_len, 0.8, 0.15]} />
                   <meshStandardMaterial color="#4a3728" />
                 </mesh>
                 <mesh position={[e.x - (d.x * (p2_len/ (2*l))), 0.4, e.z - (d.z * (p2_len / (2*l)))]} rotation={[0, -a, 0]} castShadow>
                   <boxGeometry args={[p2_len, 0.8, 0.15]} />
                   <meshStandardMaterial color="#4a3728" />
                 </mesh>
               </group>
             );
          }

          return (
            <mesh 
              key={i} 
              position={[c.x, 0.4, c.z]} 
              rotation={[0, -a, 0]} 
              castShadow
              onClick={(e) => {
                if (isPlotStep) {
                  e.stopPropagation();
                  if (e.point) {
                    const s = new THREE.Vector3(seg.start.x, 0, seg.start.z);
                    const e_vec = new THREE.Vector3(seg.end.x, 0, seg.end.z);
                    const d = new THREE.Vector3().subVectors(e_vec, s);
                    const l = d.length();
                    const p = new THREE.Vector3().subVectors(e.point, s);
                    const t = p.dot(d) / (l * l);
                    onUpdateGateSide?.(i, Math.max(0.1, Math.min(0.9, t)));
                  } else {
                    onUpdateGateSide?.(i);
                  }
                }
              }}
            >
              <boxGeometry args={[l, 0.8, 0.15]} />
              <meshStandardMaterial color="#4a3728" />
            </mesh>
          );
        })}
      </group>

      {/* Main entrance gate area */}
      <group position={[gateWorldPos.x, 0, gateWorldPos.z]} rotation={[0, -gateAngle, 0]}>
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[5, 0.05, 3]} />
          <meshStandardMaterial color="#ff5f1f" transparent opacity={0.15} />
        </mesh>
        
        {isPlotStep && (
          <group onPointerDown={(e) => customHandlePointerDown?.('gate', 'mainGate', e)}>
            <mesh position={[0, 1.2, 0]}>
               <sphereGeometry args={[0.5, 16, 16]} />
               <meshStandardMaterial color="#ff5f1f" emissive="#ff5f1f" emissiveIntensity={0.8} />
            </mesh>
            <mesh position={[0, 0.6, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 1.2]} />
              <meshStandardMaterial color="#ff5f1f" />
            </mesh>
          </group>
        )}
      </group>

      {/* Interactive corner handles for plot modification */}
      {isPlotStep && vertices.map((v, i) => (
        <PlotCornerHandle key={i} position={[v.x, 1, v.z]} onPointerDown={(e) => customHandlePointerDown?.('corner', `v${i}`, e)} />
      ))}
    </group>
  );
};

export default Plot;
