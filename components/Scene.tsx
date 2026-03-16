
import React, { Suspense, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Canvas, ThreeEvent, useThree } from '@react-three/fiber';
import { CameraControls, PerspectiveCamera, Environment, ContactShadows, Billboard, Html } from '@react-three/drei';
import House from './House';
import Plot from './Plot';
import DimensionLines from './DimensionLines';
import { HouseState, PlotCorners, Point2D } from '../types';
import * as THREE from 'three';
import { getTranslation } from '../services/i18n';
import { getGatePositionAndRotation } from '../services/placement';

const getGarageWidth = (cars: number, isSmall: boolean = false) => (cars === 1 ? 4.5 : (cars === 2 ? 7.5 : 10.5)) * (isSmall ? 0.5 : 1);
const getCarportWidth = (cars: number, isSmall: boolean = false) => (cars === 1 ? 4 : (cars === 2 ? 7 : 10)) * (isSmall ? 0.5 : 1);

interface SceneProps {
  house: HouseState;
  setHouse: React.Dispatch<React.SetStateAction<HouseState>>;
  showHouse: boolean;
  isStyleStep: boolean;
  currentStep: number;
  setCurrentStep?: (step: number) => void;
  onCaptureRef?: React.MutableRefObject<((mode?: 'current' | 'top') => string) | null>;
  onBackgroundClick: () => void;
  selectedObjectId?: string | null;
  onSelectObject?: (id: string | null) => void;
  setIsMobileExpanded?: (val: boolean) => void;
}

const MiniSlider = ({ label, value, min, max, onChange, unit = "m" }: any) => (
  <div className="space-y-1 w-full pointer-events-auto">
    <div className="flex justify-between items-center px-0.5">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">{label}</span>
      <span className="text-[12px] font-black text-slate-900">{(value || 0).toFixed(1)} <span className="text-slate-300 text-[8px]">{unit}</span></span>
    </div>
    <input 
      type="range" min={min} max={max} step={0.1} value={value || 0} 
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => onChange(parseFloat(e.target.value))} 
      className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#ff5f1f]" 
    />
  </div>
);

const RotationControl = ({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) => {
  const degrees = Math.round((value * 180) / Math.PI);
  return (
    <div className="space-y-1 w-full pointer-events-auto">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight px-0.5">{label}</span>
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
        <button 
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onChange(value - (5 * Math.PI / 180)); }}
          className="w-6 h-6 rounded bg-white flex items-center justify-center text-slate-400 hover:text-[#ff5f1f] active:scale-90 transition-all shadow-sm"
        >
          <i className="fas fa-undo text-[10px]"></i>
        </button>
        <span className="flex-1 text-center text-[12px] font-black text-slate-900">{degrees}°</span>
        <button 
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onChange(value + (5 * Math.PI / 180)); }}
          className="w-6 h-6 rounded bg-white flex items-center justify-center text-slate-400 hover:text-[#ff5f1f] active:scale-90 transition-all shadow-sm"
        >
          <i className="fas fa-redo text-[10px]"></i>
        </button>
      </div>
    </div>
  );
};

const ObjectSettingsOverlay = ({ id, house, setHouse, onClose, t, isXFlashing }: any) => {
  const [position, setPosition] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [isDragging, setIsDragging] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging || !overlayRef.current) return;
      const rect = overlayRef.current.getBoundingClientRect();
      setPosition(prev => {
        const newX = prev.x + e.movementX;
        const newY = prev.y + e.movementY;
        const minX = rect.width / 2;
        const maxX = window.innerWidth - rect.width / 2;
        const minY = rect.height / 2;
        const maxY = window.innerHeight - rect.height / 2;
        return {
          x: Math.max(minX, Math.min(maxX, newX)),
          y: Math.max(minY, Math.min(maxY, newY))
        };
      });
    };
    const handlePointerUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging]);

  if (!id) return null;

  const handleUpdate = (updates: any) => {
    setHouse((prev: any) => ({ ...prev, ...updates }));
  };

  const isSmallPlot = house.plotWidth < 20 || house.plotLength < 20;

  let label = "";
  let width = 0;
  let depth = 0;
  let rotation = 0;
  let isGarageOrCarport = false;
  let cars = 0;

  if (id === 'house') {
    label = t.scene?.house || "Дом";
    width = house.houseWidth;
    depth = house.houseLength;
    rotation = house.houseRotation;
  } else if (id.startsWith('add_')) {
    const addId = id.replace('add_', '');
    const add = house.additions.find((a: any) => a.id === addId);
    if (add) {
      label = t.scene?.addition || "Пристройка";
      width = add.width;
      depth = add.length;
      rotation = add.rotation;
    }
  } else if (id === 'garage') {
    label = t.garage;
    width = getGarageWidth(house.garageCars, isSmallPlot);
    depth = isSmallPlot ? 3.25 : 6.5;
    rotation = house.garageRotation;
    isGarageOrCarport = true;
    cars = house.garageCars;
  } else if (id === 'carport') {
    label = t.carport;
    width = getCarportWidth(house.carportCars, isSmallPlot);
    depth = isSmallPlot ? 3.0 : 6.0;
    rotation = house.carportRotation;
    isGarageOrCarport = true;
    cars = house.carportCars;
  } else {
    label = t[id] || id;
    width = house[`${id}Width` as keyof HouseState] as number;
    depth = house[`${id}Depth` as keyof HouseState] as number;
    rotation = house[`${id}Rotation` as keyof HouseState] as number;
    if (id === 'garage' || id === 'carport') {
      isGarageOrCarport = true;
      cars = house[`${id}Cars` as keyof HouseState] as number;
    }
  }

  const isMobile = window.innerWidth < 1024;

  const content = (
    <div 
      ref={overlayRef}
      className="fixed w-[240px] max-h-[60vh] lg:max-h-[80vh] bg-white/95 backdrop-blur-2xl p-3 lg:p-4 rounded-[24px] lg:rounded-[32px] shadow-[0_20px_40px_rgba(0,0,0,0.15)] border border-white/50 flex flex-col gap-2 lg:gap-3 animate-in fade-in zoom-in-95 duration-300 z-[1000] pointer-events-auto overflow-y-auto scrollbar-hide"
      style={{ left: position.x, top: position.y, transform: 'translate(-50%, -50%)' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div 
        className="flex items-center justify-between pb-1.5 lg:pb-2 border-b border-slate-100 sticky top-0 bg-white/95 z-10 cursor-move touch-none"
        onPointerDown={(e) => {
          setIsDragging(true);
          e.stopPropagation();
        }}
      >
        <span className="text-[12px] lg:text-[14px] font-black uppercase tracking-[0.15em] text-[#ff5f1f] pointer-events-none">{label}</span>
        <button 
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose} 
          className={`w-7 h-7 lg:w-8 lg:h-8 rounded-full flex items-center justify-center transition-all duration-300 ${isXFlashing ? 'bg-red-500 text-white scale-110 shadow-[0_0_10px_rgba(239,68,68,0.4)]' : 'bg-slate-50 text-slate-300 hover:text-slate-900'}`}
        >
          <i className="fas fa-times text-[9px] lg:text-[10px]"></i>
        </button>
      </div>
      
      <div className="space-y-3 lg:space-y-4">
        {!isGarageOrCarport && (
          <>
            <div className="space-y-0.5">
              <MiniSlider label={t.scene?.width || "Ширина"} value={width} min={2} max={25} unit={t.m} onChange={(v: any) => {
                if (id === 'house') handleUpdate({ houseWidth: v });
                else if (id.startsWith('add_')) {
                  const addId = id.replace('add_', '');
                  handleUpdate({ additions: house.additions.map((a: any) => a.id === addId ? { ...a, width: v } : a) });
                } else handleUpdate({ [`${id}Width`]: v });
              }} />
            </div>
            
            <div className="space-y-0.5">
              <MiniSlider label={t.scene?.depth || "Глубина"} value={depth} min={2} max={25} unit={t.m} onChange={(v: any) => {
                if (id === 'house') handleUpdate({ houseLength: v });
                else if (id.startsWith('add_')) {
                  const addId = id.replace('add_', '');
                  handleUpdate({ additions: house.additions.map((a: any) => a.id === addId ? { ...a, length: v } : a) });
                } else handleUpdate({ [`${id}Depth`]: v });
              }} />
            </div>
          </>
        )}

        {isGarageOrCarport && (
          <div className="space-y-1">
            <span className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t.scene?.cars || "Машины"}</span>
            <div className="flex bg-slate-100 p-0.5 rounded-xl gap-0.5">
              {[1, 2, 3].map(n => (
                <button 
                  key={n} 
                  onClick={() => {
                    const newWidth = id === 'garage' ? getGarageWidth(n, isSmallPlot) : getCarportWidth(n, isSmallPlot);
                    const newDepth = id === 'garage' ? (isSmallPlot ? 3.25 : 6.5) : (isSmallPlot ? 3.0 : 6.0);
                    handleUpdate({ 
                      [`${id}Cars`]: n,
                      [`${id}Width`]: newWidth,
                      [`${id}Depth`]: newDepth
                    });
                  }} 
                  className={`flex-1 py-1.5 lg:py-2 rounded-lg text-[10px] lg:text-[12px] font-black transition-all ${cars === n ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-0.5">
          <RotationControl label={t.scene?.rotation || "Поворот"} value={rotation} onChange={(v) => {
            if (id === 'house') handleUpdate({ houseRotation: v });
            else if (id.startsWith('add_')) {
              const addId = id.replace('add_', '');
              handleUpdate({ additions: house.additions.map((a: any) => a.id === addId ? { ...a, rotation: v } : a) });
            } else handleUpdate({ [`${id}Rotation`]: v });
          }} />
        </div>
      </div>
    </div>
  );

  return content;
};

const ObjectLabel = ({ label, width, length, height, onToggleEdit, isEditing, onDragStart, t }: any) => (
  <Html position={[0, height + 0.2, 0]} center zIndexRange={[50, 60]}>
    <div className="flex flex-col items-center gap-1 pointer-events-none">
      <div 
        className="bg-slate-900/80 backdrop-blur-sm px-1.5 py-0.5 rounded-md shadow-sm border border-white/10 whitespace-nowrap pointer-events-auto cursor-move touch-none"
        onPointerDown={(e) => {
          if (onDragStart) {
            e.stopPropagation();
            onDragStart(e);
          }
        }}
      >
        <div className="flex flex-col items-center leading-none">
          <span className="text-[6px] font-black text-white uppercase tracking-widest mb-0.5">{label}</span>
          <div className="flex items-center gap-1">
            <span className="text-[6px] font-black text-orange-400">{(width || 0).toFixed(1)}x{(length || 0).toFixed(1)}{t?.m || "m"}</span>
            <span className="text-[5px] font-bold text-slate-400">{(width * length || 0).toFixed(1)} {t?.sqm || "m²"}</span>
          </div>
        </div>
      </div>
      
      {!isEditing && (
        <button 
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onToggleEdit(); }}
          className="pointer-events-auto w-6 h-6 rounded-full bg-white text-[#ff5f1f] shadow-lg flex items-center justify-center border border-slate-50 transition-all transform active:scale-90 hover:scale-110"
        >
          <i className="fas fa-cog text-[10px]"></i>
        </button>
      )}
    </div>
  </Html>
);

const isPointInPolygon = (point: Point2D, vs: Point2D[]) => {
  let x = point.x, z = point.z;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = vs[i].x, zi = vs[i].z;
    let xj = vs[j].x, zj = vs[j].z;
    let intersect = ((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

const getObjectCorners = (x: number, z: number, w: number, l: number, rot: number): Point2D[] => {
  const corners = [
    { x: -w / 2, z: -l / 2 },
    { x: w / 2, z: -l / 2 },
    { x: w / 2, z: l / 2 },
    { x: -w / 2, z: l / 2 }
  ];
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return corners.map(c => ({
    x: x + c.x * cos - c.z * sin,
    z: z + c.x * sin + c.z * cos
  }));
};

const LandscapeObject = ({ id, label, pos, color, args, onDragStart, isStepActive, rotation = 0, isSelected, house, setHouse, isMobile, editingId, setEditingId, onSelectObject, activeSettingId, setActiveSettingId }: any) => {
  const isCanopy = id === 'terrace' || id === 'carport';
  const width = args[0] || 1;
  const depth = args[2] || 1;
  const height = isCanopy ? 2.8 : (args[1] || 1);

  const isEditing = activeSettingId === id;

  const handleDrag = (e: any) => {
    e.stopPropagation();
    if (isStepActive) onDragStart(e);
  };

  return (
    <group position={[pos[0] || 0, 0, pos[1] || 0]} rotation={[0, rotation, 0]} onPointerDown={(e) => { e.stopPropagation(); }}>
      {isCanopy ? (
        <group>
          <mesh position={[0, 0.1, 0]} receiveShadow castShadow onPointerDown={handleDrag}>
            <boxGeometry args={[width, 0.2, depth]} />
            <meshStandardMaterial color={color} roughness={0.7} />
          </mesh>
          {[[-1,-1], [1,-1], [-1,1], [1,1]].map(([mx, mz], i) => (
            <mesh 
              key={i} 
              position={[(width/2 - 0.2)*mx, height/2, (depth/2 - 0.2)*mz]} 
              castShadow 
              onPointerDown={handleDrag}
            >
              <boxGeometry args={[0.2, height, 0.2]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
          ))}
          <mesh position={[0, height + 0.1, 0]} castShadow onPointerDown={handleDrag}>
            <boxGeometry args={[width + 0.2, 0.1, depth + 0.2]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
        </group>
      ) : (
        <group>
          <mesh position={[0, height / 2 + 0.01, 0]} castShadow receiveShadow onPointerDown={handleDrag}>
            <boxGeometry args={[width, height, depth]} />
            <meshStandardMaterial color={color} roughness={0.6} />
          </mesh>
        </group>
      )}

      <ObjectLabel 
        label={label} 
        width={width} 
        length={depth} 
        height={height}
        onToggleEdit={() => setActiveSettingId(isEditing ? null : id)}
        isEditing={isEditing}
        onDragStart={onDragStart}
        t={getTranslation(house?.lang || 'ru')}
      />
    </group>
  );
};

const NorthArrow = ({ corners }: { corners: PlotCorners }) => {
  const pos = corners.nw;
  return (
    <group position={[pos.x - 2, 0.1, pos.z - 2]}>
      {/* Line */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.1, 2]} />
        <meshBasicMaterial color="#64748b" transparent opacity={0.6} />
      </mesh>
      {/* Arrow head pointing to -Z */}
      <mesh position={[0, 0, -1]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.3, 0.6, 3]} />
        <meshBasicMaterial color="#64748b" transparent opacity={0.6} />
      </mesh>
      {/* N text */}
      <Html position={[0, 0.1, -1.6]} center transform rotation={[-Math.PI / 2, 0, 0]}>
        <div className="text-[14px] font-black text-slate-500 select-none">N</div>
      </Html>
    </group>
  );
};

const SceneContent = ({ house, setHouse, showHouse, currentStep, selectedObjectId, onSelectObject, activeSettingId, setActiveSettingId, onTriggerXFlash, isXFlashing, cameraControlsRef }: any) => {
  const { camera, raycaster } = useThree();
  const t = getTranslation(house.lang);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    if (!cameraControlsRef.current) return;
    const controls = cameraControlsRef.current;
    
    // Calculate bounding box for plot to know how far to zoom out
    const c = house.plotCorners || { nw: { x: -house.plotWidth/2, z: -house.plotLength/2 }, ne: { x: house.plotWidth/2, z: -house.plotLength/2 }, se: { x: house.plotWidth/2, z: house.plotLength/2 }, sw: { x: -house.plotWidth/2, z: house.plotLength/2 } };
    const v = c.vertices || [c.nw, c.ne, c.se, c.sw];
    let minX = 0, maxX = 0, minZ = 0, maxZ = 0;
    if (v.length > 0) {
      minX = Math.min(...v.map((p:any) => p.x));
      maxX = Math.max(...v.map((p:any) => p.x));
      minZ = Math.min(...v.map((p:any) => p.z));
      maxZ = Math.max(...v.map((p:any) => p.z));
    }
    const plotWidth = maxX - minX;
    const plotLength = maxZ - minZ;
    const plotSize = Math.max(plotWidth, plotLength);
    
    if (currentStep === 0) {
      // Step 0 (Участок): Top-Down view, zoom out further
      controls.setLookAt(0, plotSize * 1.5 + 40, 0, 0, 0, 0, true);
    } else if (currentStep === 1) {
      // Step 1 (Планировка): Isometric view, zoomed in on house
      const hx = house.housePosX;
      const hz = house.housePosZ;
      const houseSize = Math.max(house.houseWidth, house.houseLength);
      controls.setLookAt(hx + houseSize * 0.8 + 10, houseSize * 0.8 + 10, hz + houseSize * 0.8 + 10, hx, 0, hz, true);
    } else if (currentStep === 2) {
      // Step 2 (Объекты): Isometric view, zoomed out further
      controls.setLookAt(plotSize * 1.2 + 20, plotSize * 1.2 + 20, plotSize * 1.2 + 20, 0, 0, 0, true);
    } else if (currentStep === 3) {
      // Step 3 (Финиш): Top-Down view
      controls.setLookAt(0, plotSize * 1.5 + 40, 0, 0, 0, 0, true);
    }
  }, [currentStep, house.plotWidth, house.plotLength, house.housePosX, house.housePosZ, house.houseWidth, house.houseLength, house.plotCorners]);

  const [draggingItem, setDraggingItem] = useState<string | null>(null);
  const [resizingCorner, setResizingCorner] = useState<string | null>(null);
  const [draggingGate, setDraggingGate] = useState(false);
  const initialPos = useRef<{x: number, z: number}>({x: 0, z: 0});
  const [tempPos, setTempPos] = useState<{ id: string, x: number, z: number } | null>(null);
  const dragStartPoint = useRef<{x: number, z: number} | null>(null);
  const originalCorners = useRef<PlotCorners | null>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const corners: PlotCorners = useMemo(() => {
    return house.plotCorners || { nw: { x: -house.plotWidth/2, z: -house.plotLength/2 }, ne: { x: house.plotWidth/2, z: -house.plotLength/2 }, se: { x: house.plotWidth/2, z: house.plotLength/2 }, sw: { x: -house.plotWidth/2, z: house.plotLength/2 } };
  }, [house.plotCorners, house.plotWidth, house.plotLength]);

  const plotVertices = useMemo(() => {
    return corners.vertices || [corners.nw, corners.ne, corners.se, corners.sw];
  }, [corners]);

  const isSmallPlot = house.plotWidth < 20 || house.plotLength < 20;

  const handleDragStart = useCallback((id: string, e: any) => { 
    if (activeSettingId) {
      onTriggerXFlash?.();
      return; 
    }
    e.stopPropagation(); 
    setDraggingItem(id); 
    
    // Update raycaster to current mouse position
    const mouse = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);

    // Use ray-plane intersection for initial point
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersection);
    
    dragStartPoint.current = { x: intersection.x, z: intersection.z };
    
    // Record initial position for relative movement
    if (id === 'house') {
      initialPos.current = { x: house.housePosX, z: house.housePosZ };
    } else if (id.startsWith('add_')) {
      const addId = id.replace('add_', '');
      const add = house.additions.find((a: any) => a.id === addId);
      if (add) initialPos.current = { x: add.posX, z: add.posZ };
    } else {
      initialPos.current = { 
        x: house[`${id}PosX` as keyof HouseState] as number, 
        z: house[`${id}PosZ` as keyof HouseState] as number 
      };
    }
  }, [activeSettingId, raycaster, camera, house]);
  
  const handleResizeStart = useCallback((type: 'side' | 'corner' | 'gate', id: string, e: any) => { 
    if (activeSettingId) {
      onTriggerXFlash?.();
      return;
    }
    e.stopPropagation(); 
    if (type === 'corner') setResizingCorner(id); else if (type === 'gate') setDraggingGate(true); 
    
    // Update raycaster to current mouse position
    const mouse = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);

    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersection);
    
    dragStartPoint.current = { x: intersection.x, z: intersection.z }; 
    if (corners) originalCorners.current = JSON.parse(JSON.stringify(corners)); 
  }, [activeSettingId, corners, raycaster, camera]);
  
  const handleDragEnd = useCallback(() => { 
    if (draggingItem && tempPos) {
      setHouse((prev: HouseState) => {
        if (tempPos.id.startsWith('add_')) {
          const addId = tempPos.id.replace('add_', '');
          return { ...prev, additions: prev.additions.map(a => a.id === addId ? { ...a, posX: tempPos.x, posZ: tempPos.z } : a) };
        } else {
          return { ...prev, [`${tempPos.id}PosX`]: tempPos.x, [`${tempPos.id}PosZ`]: tempPos.z };
        }
      });
    }
    setDraggingItem(null); setResizingCorner(null); setDraggingGate(false); setTempPos(null); dragStartPoint.current = null; originalCorners.current = null; document.body.style.cursor = 'auto'; 
  }, [draggingItem, tempPos, setHouse]);

  const handlePointerMove = useCallback((e: any) => {
    if (!draggingItem && !resizingCorner && !draggingGate) return;
    if (!corners) return;

    // Use ray-plane intersection for smooth dragging
    const mouse = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);
    
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, intersection)) return;

    const { x, z } = intersection;
    
    if (!dragStartPoint.current) {
      dragStartPoint.current = { x, z };
      return;
    }

    const dx = x - dragStartPoint.current.x;
    const dz = z - dragStartPoint.current.z;

    if (Math.abs(dx) < 0.01 && Math.abs(dz) < 0.01) return;

    if (originalCorners.current && resizingCorner) {
       setHouse((p: any) => {
         const nc = JSON.parse(JSON.stringify(originalCorners.current));
         if (!nc) return p;
         const idx = parseInt(resizingCorner.replace('v', ''));
         if (nc.vertices && nc.vertices[idx]) {
           nc.vertices[idx].x += dx;
           nc.vertices[idx].z += dz;
         }
         return { ...p, plotCorners: nc };
       });
    }

    if (draggingGate && originalCorners.current) {
      setHouse((prev: any) => {
        const vertices = prev.plotCorners?.vertices || [prev.plotCorners?.nw, prev.plotCorners?.ne, prev.plotCorners?.se, prev.plotCorners?.sw];
        const idx = prev.gateSideIndex || 0;
        const p1 = vertices[idx % vertices.length];
        const p2 = vertices[(idx + 1) % vertices.length];
        
        if (!p1 || !p2) return prev;

        // Vector from p1 to p2
        const dx_seg = p2.x - p1.x;
        const dz_seg = p2.z - p1.z;
        const lenSq = dx_seg * dx_seg + dz_seg * dz_seg;
        if (lenSq < 0.01) return prev;

        // Vector from p1 to mouse
        const dx_mouse = x - p1.x;
        const dz_mouse = z - p1.z;

        // Project mouse onto segment: t = (A dot B) / |B|^2
        let t = (dx_mouse * dx_seg + dz_mouse * dz_seg) / lenSq;
        t = Math.max(0.05, Math.min(0.95, t));

        return { ...prev, gatePosX: t };
      });
    }

    if (draggingItem) {
      const currentX = initialPos.current.x + dx;
      const currentZ = initialPos.current.z + dz;

      let width = 0, length = 0, rot = 0, margin = 0.1;
      if (draggingItem === 'house') { 
        width = house.houseWidth; 
        length = house.houseLength; 
        rot = house.houseRotation; 
        margin = 3.0; 
      } else if (draggingItem.startsWith('add_')) {
        const addId = draggingItem.replace('add_', '');
        const add = house.additions.find((a: any) => a.id === addId);
        if (add) { 
          width = add.width; 
          length = add.length; 
          rot = add.rotation; 
          margin = 1.0; 
        }
      } else {
        const map: Record<string, [number, number, number]> = {
          'pool': [house.poolWidth, house.poolDepth, house.poolRotation], 
          'terrace': [house.terraceWidth, house.terraceDepth, house.terraceRotation],
          'bath': [house.bathWidth, house.bathDepth, house.bathRotation], 
          'bbq': [house.bbqWidth, house.bbqDepth, house.bbqRotation],
          'customObj': [house.customObjWidth, house.customObjDepth, house.customObjRotation],
          'garage': [getGarageWidth(house.garageCars, isSmallPlot), isSmallPlot ? 3.25 : 6.5, house.garageRotation],
          'carport': [getCarportWidth(house.carportCars, isSmallPlot), isSmallPlot ? 3.0 : 6.0, house.carportRotation]
        };
        if (map[draggingItem]) { 
          width = map[draggingItem][0]; 
          length = map[draggingItem][1]; 
          rot = map[draggingItem][2]; 
        }
      }

      const cornersCheck = getObjectCorners(currentX, currentZ, width + margin * 2, length + margin * 2, rot);
      const checkValid = cornersCheck.every(c => isPointInPolygon(c, plotVertices));

      if (checkValid || draggingItem === 'house') {
        setTempPos({ id: draggingItem, x: currentX, z: currentZ });
      }
    }
  }, [camera, raycaster, corners, draggingItem, resizingCorner, draggingGate, house, plotVertices]);

  useEffect(() => { 
    if (draggingItem || resizingCorner || draggingGate) { 
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handleDragEnd); 
      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handleDragEnd); 
      };
    } 
  }, [draggingItem, resizingCorner, draggingGate, handlePointerMove, handleDragEnd]);

  const isHouseEditing = activeSettingId === 'house';
  
  const getEffectivePos = (id: string, defaultX: number, defaultZ: number) => {
    if (tempPos && tempPos.id === id) return [tempPos.x, tempPos.z];
    return [defaultX, defaultZ];
  };

  const [houseX, houseZ] = getEffectivePos('house', house.housePosX, house.housePosZ);

  return (
    <group>
      <PerspectiveCamera makeDefault position={[80, 80, 80]} fov={35} />
      <CameraControls 
        ref={cameraControlsRef}
        enabled={!draggingItem && !(resizingCorner || draggingGate)} 
        minDistance={10} 
        maxDistance={600} 
        maxPolarAngle={Math.PI / 2.1} 
        minPolarAngle={0}
        maxAzimuthAngle={Infinity}
        minAzimuthAngle={-Infinity}
        mouseButtons={{
          left: 1,
          middle: 8,
          right: 2,
          wheel: 8,
        }}
        makeDefault 
      />
      
      <Plot 
        corners={corners} 
        gatePosX={house.gatePosX} 
        gateSideIndex={house.gateSideIndex || 0}
        selected={selectedObjectId === 'plot'} 
        isPlotStep={currentStep === 0} 
        onClick={(e:any) => { 
          if (draggingItem) return;
          e.stopPropagation(); 
          setActiveSettingId(null);
        }} 
        onUpdateGateSide={(idx, pos) => setHouse(p => {
          const newState = { 
            ...p, 
            gateSideIndex: idx,
            gatePosX: pos !== undefined ? pos : p.gatePosX 
          };
          
          // Update garage and carport positions if they exist
          if (newState.hasGarage) {
            const gW = getGarageWidth(newState.garageCars, newState.plotWidth < 20 || newState.plotLength < 20);
            const gD = (newState.plotWidth < 20 || newState.plotLength < 20) ? 3.25 : 6.5;
            const { x, z, rotation } = getGatePositionAndRotation(newState, gW, gD);
            newState.garagePosX = x;
            newState.garagePosZ = z;
            newState.garageRotation = rotation;
          }
          if (newState.hasCarport) {
            const cW = getCarportWidth(newState.carportCars, newState.plotWidth < 20 || newState.plotLength < 20);
            const cD = (newState.plotWidth < 20 || newState.plotLength < 20) ? 3.0 : 6.0;
            const { x, z, rotation } = getGatePositionAndRotation(newState, cW, cD, true);
            newState.carportPosX = x;
            newState.carportPosZ = z;
            newState.carportRotation = rotation;
          }
          
          return newState;
        })}
        customHandlePointerDown={handleResizeStart} 
      />
      
      <NorthArrow corners={corners} />
      
      {showHouse && (
        <group position={[houseX, 0, houseZ]} rotation={[0, house.houseRotation || 0, 0]} onPointerDown={(e) => { e.stopPropagation(); }}>
          <House state={house} selected={selectedObjectId === 'house'} onDragStart={(e) => handleDragStart('house', e)} isTransparent={currentStep === 1} />
          <ObjectLabel 
            label={t.scene?.house?.toUpperCase() || "ДОМ"} 
            width={house.houseWidth} 
            length={house.houseLength} 
            height={house.floors * 3.2}
            onToggleEdit={() => setActiveSettingId(isHouseEditing ? null : 'house')}
            isEditing={isHouseEditing}
            onDragStart={(e: any) => handleDragStart('house', e)}
            t={t}
          />
        </group>
      )}

      {(house.additions || []).map((add, idx) => {
        const addId = `add_${add.id}`;
        const isAddEditing = activeSettingId === addId;
        const [addX, addZ] = getEffectivePos(addId, add.posX, add.posZ);
        return (
          <group key={add.id} position={[addX, 0, addZ]} rotation={[0, add.rotation, 0]} onPointerDown={(e) => { e.stopPropagation(); }}>
            <House state={{ ...house, houseWidth: add.width, houseLength: add.length, floors: add.floors }} isAddition={true} selected={selectedObjectId === addId} onDragStart={(e) => handleDragStart(addId, e)} isTransparent={currentStep === 1} />
            <ObjectLabel 
              label={`${t.scene?.addition?.toUpperCase() || "ПРИСТРОЙКА"} ${idx + 1}`} 
              width={add.width} 
              length={add.length} 
              height={add.floors * 3.2}
              onToggleEdit={() => setActiveSettingId(isAddEditing ? null : addId)}
              isEditing={isAddEditing}
              onDragStart={(e: any) => handleDragStart(addId, e)}
              t={t}
            />
          </group>
        );
      })}

      {house.hasPool && <LandscapeObject id="pool" label={t.pool} pos={getEffectivePos('pool', house.poolPosX, house.poolPosZ)} color="#38bdf8" args={[house.poolWidth, 0.2, house.poolDepth]} rotation={house.poolRotation} onDragStart={(e:any) => handleDragStart('pool', e)} isStepActive={true} isSelected={selectedObjectId === 'pool'} house={house} setHouse={setHouse} isMobile={isMobile} onSelectObject={onSelectObject} activeSettingId={activeSettingId} setActiveSettingId={setActiveSettingId} />}
      {house.hasTerrace && <LandscapeObject id="terrace" label={t.terrace} pos={getEffectivePos('terrace', house.terracePosX, house.terracePosZ)} color="#94a3b8" args={[house.terraceWidth, 0.2, house.terraceDepth]} rotation={house.terraceRotation} onDragStart={(e:any) => handleDragStart('terrace', e)} isStepActive={true} isSelected={selectedObjectId === 'terrace'} house={house} setHouse={setHouse} isMobile={isMobile} onSelectObject={onSelectObject} activeSettingId={activeSettingId} setActiveSettingId={setActiveSettingId} />}
      {house.hasBath && <LandscapeObject id="bath" label={t.bath} pos={getEffectivePos('bath', house.bathPosX, house.bathPosZ)} color="#78350f" args={[house.bathWidth, 2.8, house.bathDepth]} rotation={house.bathRotation} onDragStart={(e:any) => handleDragStart('bath', e)} isStepActive={true} isSelected={selectedObjectId === 'bath'} house={house} setHouse={setHouse} isMobile={isMobile} onSelectObject={onSelectObject} activeSettingId={activeSettingId} setActiveSettingId={setActiveSettingId} />}
      {house.hasBBQ && <LandscapeObject id="bbq" label={t.bbq} pos={getEffectivePos('bbq', house.bbqPosX, house.bbqPosZ)} color="#475569" args={[house.bbqWidth, 2.5, house.bbqDepth]} rotation={house.bbqRotation} onDragStart={(e:any) => handleDragStart('bbq', e)} isStepActive={true} isSelected={selectedObjectId === 'bbq'} house={house} setHouse={setHouse} isMobile={isMobile} onSelectObject={onSelectObject} activeSettingId={activeSettingId} setActiveSettingId={setActiveSettingId} />}
      {house.hasCustomObj && <LandscapeObject id="customObj" label={t.hozblock} pos={getEffectivePos('customObj', house.customObjPosX, house.customObjPosZ)} color="#475569" args={[house.customObjWidth, 2.5, house.customObjDepth]} rotation={house.customObjRotation} onDragStart={(e:any) => handleDragStart('customObj', e)} isStepActive={true} isSelected={selectedObjectId === 'customObj'} house={house} setHouse={setHouse} isMobile={isMobile} onSelectObject={onSelectObject} activeSettingId={activeSettingId} setActiveSettingId={setActiveSettingId} />}
      {house.hasGarage && <LandscapeObject id="garage" label={t.garage} pos={getEffectivePos('garage', house.garagePosX, house.garagePosZ)} color="#1e293b" args={[getGarageWidth(house.garageCars, isSmallPlot), 3, isSmallPlot ? 3.25 : 6.5]} rotation={house.garageRotation} onDragStart={(e:any) => handleDragStart('garage', e)} isStepActive={true} isSelected={selectedObjectId === 'garage'} house={house} setHouse={setHouse} isMobile={isMobile} onSelectObject={onSelectObject} activeSettingId={activeSettingId} setActiveSettingId={setActiveSettingId} />}
      {house.hasCarport && <LandscapeObject id="carport" label={t.carport} pos={getEffectivePos('carport', house.carportPosX, house.carportPosZ)} color="#64748b" args={[getCarportWidth(house.carportCars, isSmallPlot), 2.8, isSmallPlot ? 3.0 : 6.0]} rotation={house.carportRotation} onDragStart={(e:any) => handleDragStart('carport', e)} isStepActive={true} isSelected={selectedObjectId === 'carport'} house={house} setHouse={setHouse} isMobile={isMobile} onSelectObject={onSelectObject} activeSettingId={activeSettingId} setActiveSettingId={setActiveSettingId} />}
      
      <DimensionLines currentStep={currentStep} corners={corners} houseWidth={house.houseWidth} houseLength={house.houseLength} housePosX={houseX} housePosZ={houseZ} showHouse={showHouse} />
      
      <Suspense fallback={null}>
        <Environment preset="city" />
        <ContactShadows opacity={0.4} scale={200} blur={2.5} far={40} />
      </Suspense>

      {(draggingItem || resizingCorner || draggingGate) && (
        <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.05,0]}>
          <planeGeometry args={[4000,4000]}/>
          <meshBasicMaterial transparent opacity={0}/>
        </mesh>
      )}
    </group>
  );
};

const Scene: React.FC<SceneProps> = (props) => {
  const [activeSettingId, setActiveSettingId] = useState<string | null>(null);
  const [isXFlashing, setIsXFlashing] = useState(false);
  const cameraControlsRef = useRef<any>(null);
  const t = getTranslation(props.house.lang);

  const triggerXFlash = () => {
    setIsXFlashing(true);
    setTimeout(() => setIsXFlashing(false), 600);
  };

  const getSunSettings = () => {
    if (!props.house.showShadows) {
      return { pos: [10, 20, 10] as [number, number, number], intensity: 1.5, ambient: 1.5 };
    }
    const time = props.house.sunTime || 12;
    // Map 6..20 to 0..PI
    const theta = ((time - 6) / 14) * Math.PI;
    const radius = 60;
    
    // East (+X) to West (-X)
    const x = Math.cos(theta) * radius;
    // Arching up and down
    const y = Math.max(Math.sin(theta) * radius, 5);
    // Pushing south (+Z) at noon
    const z = Math.sin(theta) * 30;
    
    const intensity = Math.max(0.5, Math.sin(theta) * 2.5);
    const ambient = Math.max(0.2, Math.sin(theta) * 0.8);
    
    return { pos: [x, y, z] as [number, number, number], intensity, ambient };
  };

  const sun = getSunSettings();

  return (
    <div className="absolute inset-0 z-0">
      <Canvas shadows gl={{ antialias: true, preserveDrawingBuffer: true }} onPointerDown={() => {
        props.onBackgroundClick();
        setActiveSettingId(null);
      }}>
        <color attach="background" args={['#ffffff']} />
        <ambientLight intensity={sun.ambient} />
        <directionalLight 
          position={sun.pos} 
          intensity={sun.intensity} 
          castShadow 
          shadow-mapSize={[2048, 2048]} 
          shadow-camera-left={-60}
          shadow-camera-right={60}
          shadow-camera-top={60}
          shadow-camera-bottom={-60}
          shadow-camera-near={0.1}
          shadow-camera-far={200}
        />
        <Suspense fallback={null}>
          <SceneContent {...props} activeSettingId={activeSettingId} setActiveSettingId={setActiveSettingId} onTriggerXFlash={triggerXFlash} isXFlashing={isXFlashing} cameraControlsRef={cameraControlsRef} />
        </Suspense>
      </Canvas>
      
      {/* Camera View Controls */}
      <div className="absolute top-48 right-4 lg:right-[620px] z-10 flex flex-col gap-2 pointer-events-auto">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            if (cameraControlsRef.current) {
              const plotSize = Math.max(props.house.plotWidth, props.house.plotLength);
              cameraControlsRef.current.setLookAt(plotSize * 1.2 + 20, plotSize * 1.2 + 20, plotSize * 1.2 + 20, 0, 0, 0, true);
            }
          }}
          className="w-8 h-8 bg-white/90 backdrop-blur rounded-lg shadow-sm flex items-center justify-center text-slate-600 hover:text-[#ff5f1f] hover:bg-white transition-all border border-slate-200"
          title={t.scene?.view3d || "3D Вид"}
        >
          <i className="fas fa-cube text-sm"></i>
        </button>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            if (cameraControlsRef.current) {
              const plotSize = Math.max(props.house.plotWidth, props.house.plotLength);
              cameraControlsRef.current.setLookAt(0, plotSize * 1.5 + 40, 0, 0, 0, 0, true);
            }
          }}
          className="w-8 h-8 bg-white/90 backdrop-blur rounded-lg shadow-sm flex items-center justify-center text-slate-600 hover:text-[#ff5f1f] hover:bg-white transition-all border border-slate-200"
          title={t.scene?.viewTop || "Вид сверху (План)"}
        >
          <i className="fas fa-map text-sm"></i>
        </button>
      </div>

      <ObjectSettingsOverlay 
        id={activeSettingId} 
        house={props.house} 
        setHouse={props.setHouse} 
        onClose={() => setActiveSettingId(null)} 
        t={t}
        isXFlashing={isXFlashing}
      />
    </div>
  );
};
export default Scene;
