
import React, { useState, useRef, useEffect } from 'react';
import Scene from './components/Scene';
import Controls from './components/Controls';
import WelcomeScreen from './components/WelcomeScreen';
import Assistant from './components/Assistant';
import MapBuilder from './components/MapBuilder';
import { HouseState, Language, Point2D, PlotCorners } from './types';
import { getTranslation } from './services/i18n';

import { applyZoneRules } from './services/layoutService';

const LOGO_URL = "https://raw.githubusercontent.com/phparametric-cmd/ph/3a1686781dd89eb77cf6f7ca10c15c739ae48eff/Ph.jpeg";

const generateProjectID = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `PH-${year}${month}-${random}`;
};

const getFormattedDate = () => {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${d}.${m}.${y} | ${h}:${min}`;
};

const INITIAL_PLOT_WIDTH = 25;
const INITIAL_PLOT_LENGTH = 40;

const DEFAULT_CORNERS: PlotCorners = {
  nw: { x: -INITIAL_PLOT_WIDTH / 2, z: -INITIAL_PLOT_LENGTH / 2 },
  ne: { x: INITIAL_PLOT_WIDTH / 2, z: -INITIAL_PLOT_LENGTH / 2 },
  se: { x: INITIAL_PLOT_WIDTH / 2, z: INITIAL_PLOT_LENGTH / 2 },
  sw: { x: -INITIAL_PLOT_WIDTH / 2, z: INITIAL_PLOT_LENGTH / 2 },
  vertices: [
    { x: -INITIAL_PLOT_WIDTH / 2, z: -INITIAL_PLOT_LENGTH / 2 },
    { x: INITIAL_PLOT_WIDTH / 2, z: -INITIAL_PLOT_LENGTH / 2 },
    { x: INITIAL_PLOT_WIDTH / 2, z: INITIAL_PLOT_LENGTH / 2 },
    { x: -INITIAL_PLOT_WIDTH / 2, z: INITIAL_PLOT_LENGTH / 2 }
  ]
};

const INITIAL_STATE: HouseState = {
  lang: 'ru',
  userName: "",
  userPhone: "",
  userEmail: "",
  name: generateProjectID(),
  description: "Stable PH HOME architectural framework.",
  type: "Modern Minimalism",
  format: "ordinary",
  styleDescription: "", 
  area: 120, 
  floors: 2,
  roofType: 'flat',
  wallColor: "#ffffff",
  roofColor: "#1e1e1e",
  doorColor: "#1e1e1e",
  plotWidth: INITIAL_PLOT_WIDTH, 
  plotLength: INITIAL_PLOT_LENGTH, 
  plotCorners: { ...DEFAULT_CORNERS },
  isMapMode: true,
  gatePosX: 0.5, 
  gateSideIndex: 2,
  houseWidth: 12,
  houseLength: 10, 
  housePosX: 0,
  housePosZ: 5,
  houseRotation: 0,
  bedroomsCount: 3,
  bedroomArea: 16,
  bathroomsCount: 2,
  hasOffice: false,
  hasPantry: true,
  isKitchenLivingCombined: true,
  floorComments: ["", "", ""],
  calculatedPlan: [],
  planningWishes: "",
  additions: [],
  hasTerrace: false,
  terraceWidth: 5,
  terraceDepth: 4,
  terracePosX: 0,
  terracePosZ: -8,
  terraceRotation: 0,
  hasBBQ: false,
  bbqLabel: "Зона BBQ",
  bbqWidth: 3.5,
  bbqDepth: 3.5,
  bbqPosX: -8,
  bbqPosZ: -12,
  bbqRotation: 0,
  hasBath: false,
  bathWidth: 6,
  bathDepth: 6,
  bathPosX: -8,
  bathPosZ: -6,
  bathRotation: 0,
  hasPool: false,
  poolWidth: 8,
  poolDepth: 4,
  poolPosX: 8,
  poolPosZ: -4,
  poolRotation: 0,
  hasGarage: false,
  garageCars: 1,
  garageWeight: 3.5,
  garageGateOpen: false,
  garagePosX: 8,
  garagePosZ: 14,
  garageRotation: 0,
  hasCarport: false,
  carportCars: 2,
  carportWeight: 2.5,
  carportPosX: -8,
  carportPosZ: 15,
  carportRotation: 0,
  hasCustomObj: false,
  customObjLabel: "Хозблок",
  customObjWidth: 4,
  customObjDepth: 3,
  customObjPosX: 0,
  customObjPosZ: -16,
  customObjRotation: 0,
  extraWishes: "",
  projectFiles: []
};

const App: React.FC = () => {
  const [house, setHouse] = useState<HouseState>(INITIAL_STATE);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [showMapBuilder, setShowMapBuilder] = useState(false);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const [isNextStepFlashing, setIsNextStepFlashing] = useState(false);
  const [houseUnlocked, setHouseUnlocked] = useState(false);
  const [customAssistantMsg, setCustomAssistantMsg] = useState<{ title: string, text: string } | undefined>(undefined);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [isIdle, setIsIdle] = useState(false);
  
  const captureRef = useRef<((mode?: 'current' | 'top') => string) | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetIdleTimer = () => {
    setIsIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setIsIdle(true);
    }, 15000);
  };

  useEffect(() => {
    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('mousedown', resetIdleTimer);
    window.addEventListener('touchstart', resetIdleTimer);
    window.addEventListener('keydown', resetIdleTimer);
    resetIdleTimer();
    return () => {
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('mousedown', resetIdleTimer);
      window.removeEventListener('touchstart', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);
  
  useEffect(() => {
    if (currentStep === 1 && !houseUnlocked) {
      setHouseUnlocked(true);
    }
  }, [currentStep, houseUnlocked]);

  const handleStart = (config: Partial<HouseState>) => {
    setHouse(prev => {
      const next = { ...prev, ...config, projectDate: getFormattedDate() };
      // Null-safe spread to prevent "Cannot convert null to object"
      if (config.plotCorners) {
        next.plotCorners = { ...(prev.plotCorners || {}), ...config.plotCorners };
      }
      return next;
    });
    setHasStarted(true);
    if (config.isMapMode) {
      setShowMapBuilder(true);
    }
  };

  const handleBackToWelcome = () => {
    setHasStarted(false);
    setShowMapBuilder(false);
    setCurrentStep(0);
    setSelectedObjectId(null);
    setIsNextStepFlashing(false);
    setIsMobileExpanded(false);
  };

  const handleMapConfirm = (corners: PlotCorners, center: { lat: number, lng: number }, heading: number, snapshotUrl?: string, snapshotBounds?: { width: number, height: number }) => {
    // Calculate plot center in local coordinates
    let centerX = 0;
    let centerZ = 0;
    let newPlotWidth = INITIAL_PLOT_WIDTH;
    let newPlotLength = INITIAL_PLOT_LENGTH;

    if (corners.vertices && corners.vertices.length > 0) {
      centerX = corners.vertices.reduce((sum, v) => sum + v.x, 0) / corners.vertices.length;
      centerZ = corners.vertices.reduce((sum, v) => sum + v.z, 0) / corners.vertices.length;
      
      const xs = corners.vertices.map(v => v.x);
      const zs = corners.vertices.map(v => v.z);
      newPlotWidth = Math.max(...xs) - Math.min(...xs);
      newPlotLength = Math.max(...zs) - Math.min(...zs);
    }

    setHouse(prev => {
      const next = { 
        ...prev, 
        plotCorners: corners, 
        plotWidth: newPlotWidth,
        plotLength: newPlotLength,
        mapCenter: center, 
        mapHeading: heading,
        mapSnapshotUrl: snapshotUrl,
        mapSnapshotBounds: snapshotBounds,
        housePosX: centerX,
        housePosZ: centerZ
      };
      return applyZoneRules(next);
    });
    setShowMapBuilder(false);
    
    const t = getTranslation(house.lang);
    setCustomAssistantMsg({
      title: t.sema,
      text: t.guidance[0]
    });
    // Clear the custom message after some time so it doesn't stay forever
    setTimeout(() => setCustomAssistantMsg(undefined), 8000);
  };

  const changeLang = (lang: Language) => {
    setHouse(prev => ({ ...prev, lang }));
  };

  return (
    <div className="relative w-full h-screen bg-white overflow-hidden">
      {!hasStarted ? (
        <>
          <WelcomeScreen onStart={handleStart} existingData={house} onLangChange={changeLang} />
          <Assistant step={-1} isWelcome={true} lang={house.lang} />
        </>
      ) : (
        <>
          {showMapBuilder && (
            <MapBuilder 
              house={house} 
              onConfirm={handleMapConfirm} 
              onCancel={() => setShowMapBuilder(false)} 
            />
          )}
          <Scene 
            house={house} 
            setHouse={setHouse} 
            showHouse={houseUnlocked} 
            isStyleStep={true} 
            currentStep={currentStep} 
            setCurrentStep={setCurrentStep}
            onCaptureRef={captureRef} 
            selectedObjectId={selectedObjectId} 
            onSelectObject={setSelectedObjectId} 
            onBackgroundClick={() => {
              setSelectedObjectId(null);
              setIsMobileExpanded(false);
            }} 
            setIsMobileExpanded={setIsMobileExpanded}
          />
          {!showMapBuilder && (
            <Assistant 
              step={currentStep} 
              customMessage={customAssistantMsg} 
              lang={house.lang} 
              onClose={() => setCustomAssistantMsg(undefined)}
            />
          )}
          <Controls 
            house={house} 
            setHouse={setHouse} 
            currentStep={currentStep} 
            setCurrentStep={setCurrentStep} 
            onCaptureRef={captureRef} 
            onBackToWelcome={handleBackToWelcome} 
            onSetAssistantMsg={setCustomAssistantMsg} 
            isMobileExpanded={isMobileExpanded} 
            setIsMobileExpanded={setIsMobileExpanded} 
            isNextStepFlashing={isNextStepFlashing || isIdle} 
            setIsNextStepFlashing={setIsNextStepFlashing} 
            selectedObjectId={selectedObjectId}
          />
        </>
      )}
    </div>
  );
};

export default App;
