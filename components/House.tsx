
import React from 'react';
import { HouseState, HouseType } from '../types';

/**
 * Architectural visualization of the main house structure.
 */
interface HouseProps {
  state: HouseState;
  isAddition?: boolean;
  selected?: boolean;
  onDragStart?: (e: any) => void;
}

const WindowFrame = ({ width, height, type }: { width: number, height: number, type: HouseType }) => {
  const isIndustrial = type === 'Industrial';
  const frameColor = isIndustrial ? "#111" : "#fff";
  const frameThickness = isIndustrial ? 0.04 : 0.08;
  
  return (
    <group>
      {/* Window glass mesh */}
      <mesh>
        <boxGeometry args={[width - 0.1, height - 0.1, 0.02]} />
        <meshStandardMaterial color="#93c5fd" transparent opacity={0.4} metalness={0.8} roughness={0.1} />
      </mesh>
      {/* Horizontal frame parts */}
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[width, frameThickness, 0.06]} />
        <meshStandardMaterial color={frameColor} />
      </mesh>
      {/* Vertical frame parts */}
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[frameThickness, height, 0.06]} />
        <meshStandardMaterial color={frameColor} />
      </mesh>
      <mesh position={[width/2, 0, 0.01]}>
        <boxGeometry args={[frameThickness, height, 0.06]} />
        <meshStandardMaterial color={frameColor} />
      </mesh>
      <mesh position={[-width/2, 0, 0.01]}>
        <boxGeometry args={[frameThickness, height, 0.06]} />
        <meshStandardMaterial color={frameColor} />
      </mesh>
      <mesh position={[0, height/2, 0.01]}>
        <boxGeometry args={[width, frameThickness, 0.06]} />
        <meshStandardMaterial color={frameColor} />
      </mesh>
      <mesh position={[0, -height/2, 0.01]}>
        <boxGeometry args={[width, frameThickness, 0.06]} />
        <meshStandardMaterial color={frameColor} />
      </mesh>
    </group>
  );
};

const House: React.FC<HouseProps> = ({ state, isAddition = false, selected = false, onDragStart }) => {
  const hW = state.houseWidth;
  const hL = state.houseLength;
  const floorHeight = 3.2;
  const totalHeight = state.floors * floorHeight;

  return (
    <group>
      {/* Foundation structure */}
      <mesh 
        position={[0, 0.15, 0]} 
        receiveShadow 
        castShadow
        onPointerDown={(e) => {
          if (onDragStart) {
            e.stopPropagation();
            onDragStart(e);
          }
        }}
      >
        <boxGeometry args={[hW + 0.2, 0.3, hL + 0.2]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.9} />
      </mesh>

      {/* Floors iteration */}
      {Array.from({ length: state.floors }).map((_, i) => (
        <group key={i} position={[0, i * floorHeight + floorHeight/2 + 0.3, 0]}>
          <mesh 
            castShadow 
            receiveShadow
            onPointerDown={(e) => {
              if (onDragStart) {
                e.stopPropagation();
                onDragStart(e);
              }
            }}
          >
            <boxGeometry args={[hW, floorHeight, hL]} />
            <meshStandardMaterial color={state.wallColor} roughness={0.6} />
          </mesh>
          <mesh 
            position={[0, floorHeight/2, 0]}
            onPointerDown={(e) => {
              if (onDragStart) {
                e.stopPropagation();
                onDragStart(e);
              }
            }}
          >
            <boxGeometry args={[hW + 0.1, 0.1, hL + 0.1]} />
            <meshStandardMaterial color="#94a3b8" />
          </mesh>
          
          {/* Windows - Only for main house component */}
          {!isAddition && (
            <group position={[0, 0, hL/2 + 0.01]}>
               <group position={[-hW/4, 0, 0]}><WindowFrame width={hW/3} height={1.8} type={state.type} /></group>
               <group position={[hW/4, 0, 0]}><WindowFrame width={hW/3} height={1.8} type={state.type} /></group>
            </group>
          )}
        </group>
      ))}

      {/* Roof structure */}
      <group position={[0, totalHeight + 0.3, 0]}>
        <mesh 
          castShadow
          onPointerDown={(e) => {
            if (onDragStart) {
              e.stopPropagation();
              onDragStart(e);
            }
          }}
        >
          <boxGeometry args={[hW + 0.6, 0.3, hL + 0.6]} />
          <meshStandardMaterial color={state.roofColor} />
        </mesh>
      </group>

      {/* Entrance door - Only for main house */}
      {!isAddition && (
        <group 
          position={[0, 1.35, hL/2 + 0.05]}
          onPointerDown={(e) => {
            if (onDragStart) {
              e.stopPropagation();
              onDragStart(e);
            }
          }}
        >
          <mesh castShadow>
            <boxGeometry args={[1.4, 2.2, 0.1]} />
            <meshStandardMaterial color={state.doorColor} metalness={0.5} roughness={0.3} />
          </mesh>
          <mesh position={[0, 1.2, 0.4]}>
            <boxGeometry args={[2, 0.1, 1]} />
            <meshStandardMaterial color={state.roofColor} />
          </mesh>
        </group>
      )}
    </group>
  );
};

export default House;
