
import { ThreeElements } from '@react-three/fiber';
import React from 'react';

/**
 * Comprehensive augmentation for React Three Fiber elements.
 * This ensures compatibility across standard and automatic JSX transforms (React 18+).
 */
// Fix: Use global augmentation for JSX to cover standard TypeScript JSX transform.
declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
  // Fix: Explicitly augment React.JSX to support the automatic transform (React 18+).
  namespace React {
    namespace JSX {
      interface IntrinsicElements extends ThreeElements {}
    }
  }
}

// Fix: Explicitly augment the 'react' module's JSX namespace for React 18+ automatic transform support.
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

export type Language = 'ru' | 'en' | 'kk';

export type RoofType = 'flat' | 'hipped' | 'gabled';
export type HouseType = 
  | 'Modern Minimalism' 
  | 'Modern Classics' 
  | 'Wright Style' 
  | 'Industrial'
  | 'Custom';

export type LivingFormat = 'ordinary' | 'signature';

export interface Point2D {
  x: number;
  z: number;
}

export interface PlotCorners {
  nw: Point2D;
  ne: Point2D;
  sw: Point2D;
  se: Point2D;
  vertices?: Point2D[]; // Поддержка произвольной формы
}

export interface RoomInfo {
  id: string; 
  name: string;
  area: number;
  isLocked?: boolean; 
}

export interface FloorPlan {
  floorNumber: number;
  rooms: RoomInfo[];
  comment: string;
}

export interface ProjectFile {
  name: string;
  type: string;
  data: string; // Base64
}

export interface Addition {
  id: string;
  width: number;
  length: number;
  floors: number;
  posX: number;
  posZ: number;
  rotation: number;
}

export interface HouseState {
  lang: Language;
  userName: string;
  userPhone: string;
  userEmail: string;
  type: HouseType;
  format: LivingFormat;
  styleDescription: string;
  styleImageUrl?: string; 
  customStyleImage?: string;
  area: number;
  floors: number;
  roofType: RoofType;
  wallColor: string;
  roofColor: string;
  doorColor: string;
  name: string;
  description: string;
  plotWidth: number;
  plotLength: number;
  plotCorners?: PlotCorners; 
  gatePosX: number;
  gateSideIndex: number; // Индекс сегмента участка, на котором находятся ворота
  houseWidth: number;
  houseLength: number;
  housePosX: number;
  housePosZ: number;
  houseRotation: number;
  projectDate?: string;
  bedroomsCount: number;
  bedroomArea: number;
  bathroomsCount: number;
  hasOffice: boolean;
  hasPantry: boolean;
  isKitchenLivingCombined: boolean;
  floorComments: string[];
  calculatedPlan?: FloorPlan[];
  planningWishes?: string;
  
  additions: Addition[]; 

  hasTerrace: boolean;
  terraceWidth: number;
  terraceDepth: number;
  terracePosX: number;
  terracePosZ: number;
  terraceRotation: number;
  hasBBQ: boolean;
  bbqLabel: string;
  bbqWidth: number;
  bbqDepth: number;
  bbqPosX: number;
  bbqPosZ: number;
  bbqRotation: number;
  hasBath: boolean;
  bathWidth: number;
  bathDepth: number;
  bathPosX: number;
  bathPosZ: number;
  bathRotation: number;
  hasPool: boolean;
  poolWidth: number;
  poolDepth: number;
  poolPosX: number;
  poolPosZ: number;
  poolRotation: number;
  hasGarage: boolean;
  garageCars: number;
  garageWeight: number;
  garageGateOpen: boolean;
  garagePosX: number;
  garagePosZ: number;
  garageRotation: number;
  hasCarport: boolean;
  carportCars: number;
  carportWeight: number;
  carportPosX: number;
  carportPosZ: number;
  carportRotation: number;
  hasCustomObj: boolean;
  customObjLabel: string;
  customObjWidth: number;
  customObjDepth: number;
  customObjPosX: number;
  customObjPosZ: number;
  customObjRotation: number;
  extraWishes?: string;
  projectFiles: ProjectFile[];
  
  aiProjectDescription?: string;
  renderFrontUrl?: string;
  sitePlanUrl?: string;

  isMapMode?: boolean;
  mapCenter?: { lat: number, lng: number };
  mapHeading?: number;
  mapSnapshotUrl?: string; // Текстура спутника для 3D
  mapSnapshotScale?: number; // Масштаб (метров в пикселе или размер в метрах)
  mapSnapshotBounds?: { width: number, height: number };
}
