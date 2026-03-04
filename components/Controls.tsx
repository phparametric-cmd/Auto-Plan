
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { HouseState, FloorPlan, RoomInfo, Point2D, Addition } from '../types';
import { processProjectOrder } from '../services/orderService';
import { generatePDFBlob } from '../services/pdfService';
import { generateConstructionEstimate } from '../services/geminiService';
import EstimateView from './EstimateView';
import { getTranslation } from '../services/i18n';
import { saveAs } from "file-saver";
import html2canvas from 'html2canvas';

const MIN_ROOM_AREA = 2;
const WALL_RATIO = 0.15;
const HALL_RATIO = 0.09; 
const STAIR_AREA = 7.5;

const ROTATION_STEP = 10 * Math.PI / 180; // 10 degrees in radians

const LOGO_URL = "https://raw.githubusercontent.com/phparametric-cmd/ph/3a1686781dd89eb77cf6f7ca10c15c739ae48eff/Ph.jpeg";
const MODEL_PHOTO_URL = "https://raw.githubusercontent.com/phparametric-cmd/ph/6daf2fc233f4eefef2e9d9f79e3326aeb1560d39/%D1%84%D0%BE%D1%82%D0%BE%20%D0%BC%D0%B0%D0%BA%D0%B5%D1%82%D0%B0%20.jpg";
const CONTACT_INFO = {
  phone: "+7 707 220 72 61",
  email: "ph.parametric@gmail.com"
};

const getGarageWidth = (cars: number, isSmall: boolean = false) => (cars === 1 ? 4.5 : (cars === 2 ? 7.5 : 10.5)) * (isSmall ? 0.5 : 1);
const getCarportWidth = (cars: number, isSmall: boolean = false) => (cars === 1 ? 4 : (cars === 2 ? 7 : 10)) * (isSmall ? 0.5 : 1);

const Slider = ({ label, value, min, max, onChange, unit = "м", step = 0.1, isHighlighted = false }: any) => (
  <div className={`space-y-1 lg:space-y-2 p-0.5 lg:p-1 rounded-lg transition-all ${isHighlighted ? 'bg-orange-50/50' : ''}`}>
    <div className="flex justify-between items-end">
      <span className="text-[7px] lg:text-sm font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <span className={`font-black text-[10px] lg:text-base ${isHighlighted ? 'text-[#ff5f1f]' : 'text-slate-900'}`}>{(value || 0).toFixed(1)} <span className="text-slate-300 text-[7px] lg:text-sm">{unit}</span></span>
    </div>
    <input 
      type="range" min={min} max={max} step={step} value={value || 0} 
      onChange={(e) => onChange(parseFloat(e.target.value))} 
      className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#ff5f1f]" 
    />
  </div>
);

const StepGuidance = ({ text }: { text: string }) => (
  <div className="bg-slate-50 border border-slate-100 p-3 lg:p-6 rounded-2xl mb-1 animate-in fade-in slide-in-from-top-4 duration-500">
    <div className="flex gap-2 lg:gap-4">
      <div className="w-6 h-6 lg:w-10 lg:h-10 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0">
        <i className="fas fa-info text-[#ff5f1f] text-[8px] lg:text-lg"></i>
      </div>
      <p className="text-[10px] lg:text-base font-bold text-slate-500 leading-tight lg:leading-relaxed whitespace-pre-line">{text}</p>
    </div>
  </div>
);

const ToggleObject = ({ label, active, onToggle, children, isFocused, isMobileExpanded = true }: any) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isFocused && ref.current && isMobileExpanded) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isFocused, isMobileExpanded]);

  return (
    <div ref={ref} className={`p-2 lg:p-3 rounded-xl lg:rounded-2xl border transition-all duration-500 ${active ? 'bg-white border-slate-200 shadow-lg' : 'bg-slate-50 border-slate-100 opacity-60'} ${isFocused ? 'ring-2 ring-[#ff5f1f] border-[#ff5f1f]' : ''}`}>
      <div className="flex justify-between items-center mb-1 lg:mb-2">
        <span className={`text-[9px] lg:text-[11px] font-black uppercase tracking-widest ${isFocused ? 'text-[#ff5f1f]' : 'text-slate-900'}`}>{label}</span>
        <button 
          onClick={(e) => { e.stopPropagation(); onToggle(!active); }} 
          className={`w-8 lg:w-12 h-4 lg:h-6 rounded-full transition-all relative pointer-events-auto ${active ? 'bg-[#ff5f1f]' : 'bg-slate-300'}`}
        >
          <div className={`absolute top-0.5 w-3 lg:h-4 lg:w-4 h-3 bg-white rounded-full transition-all ${active ? 'left-4 lg:left-7' : 'left-1'}`} />
        </button>
      </div>
      {active && <div className="space-y-1.5 lg:space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">{children}</div>}
    </div>
  );
};

interface ControlsProps {
  house: HouseState;
  setHouse: React.Dispatch<React.SetStateAction<HouseState>>;
  currentStep: number;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
  onCaptureRef?: React.MutableRefObject<((mode?: 'current' | 'top') => string) | null>;
  onBackToWelcome?: () => void;
  onSetAssistantMsg?: (msg: { title: string, text: string } | undefined) => void;
  isMobileExpanded: boolean;
  setIsMobileExpanded: (val: boolean) => void;
  isNextStepFlashing?: boolean;
  setIsNextStepFlashing?: (val: boolean) => void;
  selectedObjectId?: string | null;
}

const Controls: React.FC<ControlsProps> = ({ 
  house, setHouse, currentStep, setCurrentStep, onCaptureRef, onBackToWelcome, 
  isMobileExpanded, setIsMobileExpanded, selectedObjectId, isNextStepFlashing
}) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const t = getTranslation(house.lang);
  const [isDownloadingPassport, setIsDownloadingPassport] = useState(false);
  const [isDownloadingCalc, setIsDownloadingCalc] = useState(false);
  const [isDownloadingEstimate, setIsDownloadingEstimate] = useState(false);
  const [estimateHtml, setEstimateHtml] = useState<string>("");
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [revisionCount, setRevisionCount] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(true);
  const [hasVisitedStep1, setHasVisitedStep1] = useState(false);
  const hasEnteredStep1 = useRef(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const sitePlanExportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentStep === 1) {
      hasEnteredStep1.current = true;
    } else if (hasEnteredStep1.current && !hasVisitedStep1) {
      setHasVisitedStep1(true);
    }
  }, [currentStep, hasVisitedStep1]);

  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [house]);

  const isSmallPlot = useMemo(() => {
    const corners = house.plotCorners || { nw: { x: -house.plotWidth/2, z: -house.plotLength/2 }, ne: { x: house.plotWidth/2, z: -house.plotLength/2 }, se: { x: house.plotWidth/2, z: house.plotLength/2 }, sw: { x: -house.plotWidth/2, z: house.plotLength/2 } };
    const v = corners.vertices || [corners.nw, corners.ne, corners.se, corners.sw];
    if (v.length < 3) return false;
    let area = 0;
    for (let i = 0; i < v.length; i++) {
      const j = (i + 1) % v.length;
      area += v[i].x * v[j].z;
      area -= v[j].x * v[i].z;
    }
    return Math.abs(area) / 200 < 7;
  }, [house.plotCorners, house.plotWidth, house.plotLength]);
  const scaleFactor = isSmallPlot ? 0.666 : 1;

  const isHouseOutOfBounds = useMemo(() => {
    const corners = house.plotCorners || { nw: { x: -house.plotWidth/2, z: -house.plotLength/2 }, ne: { x: house.plotWidth/2, z: -house.plotLength/2 }, se: { x: house.plotWidth/2, z: house.plotLength/2 }, sw: { x: -house.plotWidth/2, z: house.plotLength/2 } };
    const v = corners.vertices || [corners.nw, corners.ne, corners.se, corners.sw];
    
    const hw2 = house.houseWidth / 2 + 3;
    const hl2 = house.houseLength / 2 + 3;
    const hx = house.housePosX;
    const hz = house.housePosZ;
    const rot = house.houseRotation || 0;
    
    if (house.houseWidth > house.plotWidth - 6 || house.houseLength > house.plotLength - 6) return true;

    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const getRotated = (x: number, z: number) => ({
      x: hx + x * cos - z * sin,
      z: hz + x * sin + z * cos
    });
    
    const houseCorners = [
      getRotated(-hw2, -hl2),
      getRotated(hw2, -hl2),
      getRotated(hw2, hl2),
      getRotated(-hw2, hl2)
    ];
    
    const isInside = (pt: any, poly: any[]) => {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x, zi = poly[i].z;
        const xj = poly[j].x, zj = poly[j].z;
        const intersect = ((zi > pt.z) !== (zj > pt.z)) && (pt.x < (xj - xi) * (pt.z - zi) / (zj - zi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    };
    
    return !houseCorners.every(c => isInside(c, v));
  }, [house]);

  const handleOrderSilent = async () => {
    if (!hasUnsavedChanges || !house.userEmail) return;
    try {
        let currentEstimateHtml = estimateHtml;
        if (!currentEstimateHtml) {
          currentEstimateHtml = await generateConstructionEstimate(house);
          setEstimateHtml(currentEstimateHtml);
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const passportEl = document.getElementById('passport-doc-root');
        const calcEl = document.getElementById('calculation-doc-root');
        const sitePlanEl = sitePlanExportRef.current;
        const estimateEl = document.getElementById('estimate-doc-root');

        if (!passportEl || !calcEl || !sitePlanEl) return;

        const sitePlanCanvas = await html2canvas(sitePlanEl, { scale: 2, backgroundColor: '#ffffff' });
        const sitePlanUrl = sitePlanCanvas.toDataURL('image/png');
        
        const passportBlob = await generatePDFBlob(passportEl, `Passport_${house.name}`);
        const calculationBlob = await generatePDFBlob(calcEl, `Calculation_${house.name}`);
        const estimateBlob = estimateEl ? await generatePDFBlob(estimateEl, `Estimate_${house.name}`) : undefined;

        const success = await processProjectOrder({ 
            house: { ...house, sitePlanUrl }, 
            passportBlob, 
            calculationBlob,
            estimateBlob,
            revisionCount
        });
        
        if (success) {
          setHasUnsavedChanges(false);
          setRevisionCount(prev => prev + 1);
        }
    } catch (e: any) { 
        console.error(e); 
    }
  };

  useEffect(() => {
    const stepsToExpand = [2, 3, 4, 5]; 
    if (stepsToExpand.includes(currentStep)) {
      setIsMobileExpanded(true);
    }
  }, [currentStep, setIsMobileExpanded]);

  const STEPS = useMemo(() => [
    { id: 'plot', label: t.plotParams, icon: 'fa-map-marked-alt' },
    { id: 'house', label: 'ДОМ', icon: 'fa-home' },
    { id: 'planning', label: t.planning, icon: 'fa-th-large' },
    { id: 'landscape', label: t.objects, icon: 'fa-tree' },
    { id: 'parking', label: t.parking, icon: 'fa-car' },
    { id: 'finish', label: t.finish, icon: 'fa-check-double' },
  ], [t]);

  const handleStepClick = (idx: number) => {
    if (idx === currentStep) setIsMobileExpanded(!isMobileExpanded);
    else setCurrentStep(idx);
  };

  const handleBack = () => {
    if (currentStep === 0) onBackToWelcome?.();
    else setCurrentStep(prev => prev - 1);
  };

  const handleContinue = () => {
    if (currentStep < 5) setCurrentStep(prev => prev + 1);
  };

  const maxFloors = useMemo(() => Math.max(house.floors, ...house.additions.map(a => a.floors), 0), [house.floors, house.additions]);

  const getAreaForFloor = useCallback((floorIdx: number) => {
    const floorNum = floorIdx + 1;
    let area = 0;
    if (house.floors >= floorNum) area += house.houseWidth * house.houseLength;
    house.additions.forEach(add => { if (add.floors >= floorNum) area += add.width * add.length; });
    return area;
  }, [house.houseWidth, house.houseLength, house.floors, house.additions]);

  const totalArea = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < maxFloors; i++) sum += getAreaForFloor(i);
    return sum;
  }, [maxFloors, getAreaForFloor]);

  const totalBuildingsArea = useMemo(() => {
    let sum = totalArea;
    if (house.hasPool) sum += house.poolWidth * house.poolDepth;
    if (house.hasGarage) sum += getGarageWidth(house.garageCars, isSmallPlot) * (isSmallPlot ? 3.25 : 6.5);
    if (house.hasCarport) sum += getCarportWidth(house.carportCars, isSmallPlot) * (isSmallPlot ? 3.0 : 6.0);
    if (house.hasBath) sum += house.bathWidth * house.bathDepth;
    if (house.hasTerrace) sum += house.terraceWidth * house.terraceDepth;
    if (house.hasBBQ) sum += house.bbqWidth * house.bbqDepth;
    if (house.hasCustomObj) sum += house.customObjWidth * house.customObjDepth;
    return sum;
  }, [totalArea, house, isSmallPlot]);

  const totalFootprint = useMemo(() => getAreaForFloor(0), [getAreaForFloor]);

  const plotSotkaValue = useMemo(() => {
    const corners = house.plotCorners || { nw: { x: -house.plotWidth/2, z: -house.plotLength/2 }, ne: { x: house.plotWidth/2, z: -house.plotLength/2 }, se: { x: house.plotWidth/2, z: house.plotLength/2 }, sw: { x: -house.plotWidth/2, z: house.plotLength/2 } };
    const v = corners.vertices || [corners.nw, corners.ne, corners.se, corners.sw];
    if (v.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < v.length; i++) {
      const j = (i + 1) % v.length;
      area += v[i].x * v[j].z;
      area -= v[j].x * v[i].z;
    }
    return Math.abs(area) / 200;
  }, [house.plotCorners, house.plotWidth, house.plotLength]);

  const plotSotka = useMemo(() => plotSotkaValue.toFixed(1), [plotSotkaValue]);

  const balanceFloorRooms = useCallback((rooms: RoomInfo[], targetFloorArea: number): RoomInfo[] => {
    const stairArea = maxFloors > 1 ? STAIR_AREA : 0; 
    const NIA = targetFloorArea * (1 - WALL_RATIO - HALL_RATIO) - stairArea;
    if (targetFloorArea <= 0) return [];
    
    let currentRooms = rooms.map(r => ({...r, area: Math.max(MIN_ROOM_AREA, r.area)}));
    const lockedRooms = currentRooms.filter(r => r.isLocked);
    const unlockedRooms = currentRooms.filter(r => !r.isLocked);
    
    const totalLockedArea = lockedRooms.reduce((sum, r) => sum + r.area, 0);
    let remainingNIA = NIA - totalLockedArea;
    
    if (unlockedRooms.length > 0) {
      const perRoom = Math.max(MIN_ROOM_AREA, remainingNIA / unlockedRooms.length);
      return currentRooms.map(r => r.isLocked ? r : { ...r, area: perRoom });
    }
    return currentRooms;
  }, [maxFloors]);

  useEffect(() => {
    const rt = t.rooms;
    if (house.calculatedPlan?.length === maxFloors) {
       const updated = house.calculatedPlan.map((floor, fIdx) => ({ ...floor, rooms: balanceFloorRooms(floor.rooms, getAreaForFloor(fIdx)) }));
       if (JSON.stringify(updated) !== JSON.stringify(house.calculatedPlan)) setHouse(p => ({ ...p, calculatedPlan: updated }));
       return;
    }
    
    const newPlans: FloorPlan[] = [];
    const totalHouseArea = house.houseWidth * house.houseLength * maxFloors;
    
    for (let i = 0; i < maxFloors; i++) {
      const floorNum = i + 1;
      let rooms: RoomInfo[] = [];
      if (floorNum === 1) {
        rooms.push(
          { id: 'f1_hall', name: rt.hallway, area: 6, isLocked: true },
          { id: 'f1_wc', name: rt.guestWC, area: 4, isLocked: true },
          { id: 'f1_tech', name: rt.tech, area: 7, isLocked: true },
          { id: 'f1_kitchen', name: rt.kitchen, area: 15, isLocked: true },
          { id: 'f1_living', name: rt.living, area: 45, isLocked: false }
        );
        if (totalHouseArea > 200) {
          rooms.push({ id: 'f1_office', name: 'Кабинет', area: 15, isLocked: false });
        }
      } else {
        if (totalHouseArea > 300) {
          rooms.push(
            { id: `f${floorNum}_master`, name: rt.masterSuite, area: 25, isLocked: false },
            { id: `f${floorNum}_bed1`, name: 'Спальня 1', area: 16, isLocked: false },
            { id: `f${floorNum}_bed2`, name: 'Спальня 2', area: 16, isLocked: false },
            { id: `f${floorNum}_bed3`, name: 'Спальня 3', area: 16, isLocked: false },
            { id: `f${floorNum}_bath1`, name: rt.bathroom, area: 6, isLocked: true },
            { id: `f${floorNum}_bath2`, name: 'Санузел 2', area: 6, isLocked: true }
          );
        } else if (totalHouseArea > 200) {
          rooms.push(
            { id: `f${floorNum}_master`, name: rt.masterSuite, area: 25, isLocked: false },
            { id: `f${floorNum}_bed1`, name: 'Спальня 1', area: 16, isLocked: false },
            { id: `f${floorNum}_bed2`, name: 'Спальня 2', area: 16, isLocked: false },
            { id: `f${floorNum}_bath1`, name: rt.bathroom, area: 6, isLocked: true },
            { id: `f${floorNum}_bath2`, name: 'Санузел 2', area: 6, isLocked: true }
          );
        } else {
          rooms.push(
            { id: `f${floorNum}_master`, name: rt.masterSuite, area: 25, isLocked: false },
            { id: `f${floorNum}_kids`, name: rt.kids, area: 14, isLocked: true },
            { id: `f${floorNum}_bath`, name: rt.bathroom, area: 6, isLocked: true }
          );
        }
      }
      newPlans.push({ floorNumber: floorNum, rooms: balanceFloorRooms(rooms, getAreaForFloor(i)), comment: "" });
    }
    setHouse(p => ({ ...p, calculatedPlan: newPlans }));
  }, [maxFloors, getAreaForFloor, balanceFloorRooms, setHouse, t.rooms, house.houseWidth, house.houseLength]);

  const updateRoom = (fIdx: number, rId: string, updates: Partial<RoomInfo>) => {
    setHouse(prev => {
      if (!prev.calculatedPlan) return prev;
      const plans = [...prev.calculatedPlan];
      const shouldLock = updates.area !== undefined;
      
      plans[fIdx].rooms = plans[fIdx].rooms.map(r => 
        r.id === rId ? { ...r, ...updates, isLocked: shouldLock ? true : r.isLocked } : r
      );
      
      plans[fIdx].rooms = balanceFloorRooms(plans[fIdx].rooms, getAreaForFloor(fIdx));
      return { ...prev, calculatedPlan: plans };
    });
  };

  const updateAddition = (id: string, updates: Partial<Addition>) => {
    setHouse(prev => ({
      ...prev,
      additions: prev.additions.map(a => a.id === id ? { ...a, ...updates } : a)
    }));
  };

  const addRoom = (fIdx: number) => {
    setHouse(prev => {
      if (!prev.calculatedPlan) return prev;
      const plans = JSON.parse(JSON.stringify(prev.calculatedPlan));
      const newRoom = { 
        id: `r_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, 
        name: "Новое помещение", 
        area: 10, 
        isLocked: false 
      };
      plans[fIdx].rooms.push(newRoom);
      plans[fIdx].rooms = balanceFloorRooms(plans[fIdx].rooms, getAreaForFloor(fIdx));
      return { ...prev, calculatedPlan: plans };
    });
  };

  const removeRoom = (fIdx: number, rId: string) => {
    setHouse(prev => {
      if (!prev.calculatedPlan) return prev;
      const plans = [...prev.calculatedPlan];
      plans[fIdx].rooms = plans[fIdx].rooms.filter(r => r.id !== rId);
      plans[fIdx].rooms = balanceFloorRooms(plans[fIdx].rooms, getAreaForFloor(fIdx));
      return { ...prev, calculatedPlan: plans };
    });
  };

  const setHouseAndValidate = (updates: any) => {
    setHouse(prev => {
      const next = { ...prev, ...updates };
      // Allow dimensions to exceed plot size to show warning to user
      return next;
    });
  };

  const handleDownloadPassport = async () => {
    const el = document.getElementById('passport-doc-root');
    if (!el) return;
    setIsDownloadingPassport(true);
    try {
      const passportBlob = await generatePDFBlob(el, `Passport_${house.name}`);
      saveAs(passportBlob, `Passport_${house.name}.pdf`);
    } catch (e) { console.error(e); } finally { setIsDownloadingPassport(false); }
  };

  const handleDownloadCalculation = async () => {
    const el = document.getElementById('calculation-doc-root');
    if (!el) return;
    setIsDownloadingCalc(true);
    try {
      const calculationBlob = await generatePDFBlob(el, `Calculation_${house.name}`);
      saveAs(calculationBlob, `Calculation_${house.name}.pdf`);
    } catch (e) { console.error(e); } finally { setIsDownloadingCalc(false); }
  };

  const handleDownloadEstimate = async () => {
    setIsDownloadingEstimate(true);
    try {
      let currentHtml = estimateHtml;
      if (!currentHtml) {
        currentHtml = await generateConstructionEstimate(house);
        setEstimateHtml(currentHtml);
      }
      
      // Give React a moment to render the hidden component with the new HTML
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const el = document.getElementById('estimate-doc-root');
      if (!el) return;
      
      const estimateBlob = await generatePDFBlob(el, `Estimate_${house.name}`);
      saveAs(estimateBlob, `Estimate_${house.name}.pdf`);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setIsDownloadingEstimate(false); 
    }
  };

  const SitePlanSVG = ({ isForExport = false }: { isForExport?: boolean }) => {
    const scale = isForExport ? 10 : 6; 
    const padding = 60;
    
    const corners = house.plotCorners || {
        nw: { x: -house.plotWidth / 2, z: -house.plotLength / 2 },
        ne: { x: house.plotWidth / 2, z: -house.plotLength / 2 },
        se: { x: house.plotWidth / 2, z: house.plotLength / 2 },
        sw: { x: -house.plotWidth / 2, z: house.plotLength / 2 }
    };

    const minX = Math.min(corners.nw.x, corners.ne.x, corners.se.x, corners.sw.x);
    const maxX = Math.max(corners.nw.x, corners.ne.x, corners.se.x, corners.sw.x);
    const minZ = Math.min(corners.nw.z, corners.ne.z, corners.se.z, corners.sw.z);
    const maxZ = Math.max(corners.nw.z, corners.ne.z, corners.se.z, corners.sw.z);
    
    const plotW = maxX - minX;
    const plotL = maxZ - minZ;

    const svgW = plotW * scale + padding * 2;
    const svgL = plotL * scale + padding * 2;

    const worldToSvg = (x: number, z: number) => ({
      x: (x - minX) * scale + padding,
      y: (z - minZ) * scale + padding
    });

    const polygonPoints = (house.plotCorners?.vertices || [corners.nw, corners.ne, corners.se, corners.sw])
      .map(p => {
        const svg = worldToSvg(p.x, p.z);
        return `${svg.x},${svg.y}`;
      }).join(' ');

    const renderObj = (x: number, z: number, width: number, depth: number, label: string, color: string, rotation: number = 0) => {
      const svg = worldToSvg(x, z);
      const sw = width * scale;
      const sd = depth * scale;
      const isDark = color === '#1e293b' || color === '#0f172a' || color === '#334155';

      return (
        <g key={`${label}-${x}-${z}`} transform={`translate(${svg.x}, ${svg.y}) rotate(${-(rotation * 180) / Math.PI})`}>
          <rect x={-sw/2} y={-sd/2} width={sw} height={sd} fill={color} stroke="#000" strokeWidth="1" />
          <text x="0" y="-2" textAnchor="middle" fill={isDark ? 'white' : 'black'} fontSize={isForExport ? "10" : "7"} fontWeight="900" style={{ textTransform: 'uppercase' }}>{label}</text>
          <text x="0" y="8" textAnchor="middle" fill={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'} fontSize={isForExport ? "8" : "5"} fontWeight="bold">{(width || 0).toFixed(1)} x {(depth || 0).toFixed(1)}м</text>
        </g>
      );
    };

    const dist = (p1: Point2D, p2: Point2D) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.z - p1.z, 2));

    return (
      <svg width={svgW} height={svgL} viewBox={`0 0 ${svgW} ${svgL}`} className="bg-white">
        <polygon points={polygonPoints} fill="#f0fdf4" stroke="#166534" strokeWidth="2" strokeDasharray="5,3" />
        <g fontSize={isForExport ? "12" : "9"} fontWeight="900" fill="#166534">
          {(house.plotCorners?.vertices || [corners.nw, corners.ne, corners.se, corners.sw]).map((p, i, arr) => {
            const next = arr[(i + 1) % arr.length];
            const s1 = worldToSvg(p.x, p.z);
            const s2 = worldToSvg(next.x, next.z);
            const mx = (s1.x + s2.x) / 2;
            const my = (s1.y + s2.y) / 2;
            const length = dist(p, next);
            const angle = Math.atan2(s2.y - s1.y, s2.x - s1.x) * 180 / Math.PI;
            return (
              <text key={i} x={mx} y={my} textAnchor="middle" transform={`rotate(${angle}, ${mx}, ${my}) translate(0, -8)`}>
                {(length || 0).toFixed(1)}м
              </text>
            );
          })}
        </g>
        {renderObj(house.housePosX, house.housePosZ, house.houseWidth, house.houseLength, "ДОМ", "#1e293b", house.houseRotation)}
        
        {/* Gate rendering in SVG */}
        {(() => {
          const vertices = house.plotCorners?.vertices || [corners.nw, corners.ne, corners.se, corners.sw];
          const gateIdx = house.gateSideIndex || 0;
          const p1 = vertices[gateIdx % vertices.length];
          const p2 = vertices[(gateIdx + 1) % vertices.length];
          const s1 = worldToSvg(p1.x, p1.z);
          const s2 = worldToSvg(p2.x, p2.z);
          const gatePosX = house.gatePosX || 0.5;
          const gx = s1.x + (s2.x - s1.x) * gatePosX;
          const gy = s1.y + (s2.y - s1.y) * gatePosX;
          const angle = Math.atan2(s2.y - s1.y, s2.x - s1.x) * 180 / Math.PI;
          return (
            <g transform={`rotate(${angle}, ${gx}, ${gy})`}>
              <rect x={gx - 15} y={gy - 2} width="30" height="4" fill="#ff5f1f" stroke="#000" strokeWidth="0.5" />
              <text x={gx} y={gy - 5} textAnchor="middle" fontSize="6" fontWeight="black" fill="#ff5f1f">ВОРОТА</text>
            </g>
          );
        })()}
        {house.additions.map((add, idx) => renderObj(add.posX, add.posZ, add.width, add.length, `ЧАСТЬ ${idx+1}`, "#334155", add.rotation))}
        {house.hasPool && renderObj(house.poolPosX, house.poolPosZ, house.poolWidth, house.poolDepth, t.pool, "#38bdf8", house.poolRotation)}
        {house.hasTerrace && renderObj(house.terracePosX, house.terracePosZ, house.terraceWidth, house.terraceDepth, t.terrace, "#94a3b8", house.terraceRotation)}
        {house.hasBath && renderObj(house.bathPosX, house.bathPosZ, house.bathWidth, house.bathDepth, t.bath, "#78350f", house.bathRotation)}
        {house.hasBBQ && renderObj(house.bbqPosX, house.bbqPosZ, house.bbqWidth, house.bbqDepth, t.bbq, "#475569", house.bbqRotation)}
        {house.hasCustomObj && renderObj(house.customObjPosX, house.customObjPosZ, house.customObjWidth, house.customObjDepth, t.hozblock, "#475569", house.customObjRotation)}
        {house.hasGarage && renderObj(house.garagePosX, house.garagePosZ, getGarageWidth(house.garageCars, isSmallPlot), isSmallPlot ? 3.25 : 6.5, t.garage, "#1e293b", house.garageRotation)}
        {house.hasCarport && renderObj(house.carportPosX, house.carportPosZ, getCarportWidth(house.carportCars, isSmallPlot), isSmallPlot ? 3.0 : 6.0, t.carport, "#64748b", house.carportRotation)}
        
        {/* North Arrow */}
        {(() => {
          const nwSvg = worldToSvg(corners.nw.x, corners.nw.z);
          return (
            <g transform={`translate(${nwSvg.x - 30}, ${nwSvg.y - 30})`}>
              <line x1="0" y1="20" x2="0" y2="-20" stroke="#64748b" strokeWidth="2" />
              <path d="M -5 -15 L 0 -25 L 5 -15 Z" fill="#64748b" />
              <circle cx="0" cy="22" r="2" fill="#64748b" />
              <text x="0" y="-30" textAnchor="middle" fontSize="10" fontWeight="black" fill="#64748b">N</text>
            </g>
          );
        })()}

        <g transform={`translate(${padding}, ${svgL - 25})`} fontSize="10" fontWeight="bold">
           <text fill="#64748b">УЧАСТОК: {plotSotka} сот. | ОБЩАЯ ПЛОЩАДЬ: {Math.round(totalArea)} м²</text>
           {house.isMapMode && house.mapCenter && (
             <text y="12" fill="#64748b" fontSize="8">КООРДИНАТЫ: {house.mapCenter.lat.toFixed(6)}, {house.mapCenter.lng.toFixed(6)}</text>
           )}
        </g>
      </svg>
    );
  };

  const handleOrder = async () => {
    setIsOrdering(true);
    setOrderError(null);
    try {
        // Generate estimate HTML if not already done
        let currentEstimateHtml = estimateHtml;
        if (!currentEstimateHtml) {
          currentEstimateHtml = await generateConstructionEstimate(house);
          setEstimateHtml(currentEstimateHtml);
          // Wait for React to render the hidden component
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const passportEl = document.getElementById('passport-doc-root');
        const calcEl = document.getElementById('calculation-doc-root');
        const sitePlanEl = sitePlanExportRef.current;
        const estimateEl = document.getElementById('estimate-doc-root');

        if (!passportEl || !calcEl || !sitePlanEl) {
          throw new Error("Не найдены элементы для генерации PDF.");
        }

        const sitePlanCanvas = await html2canvas(sitePlanEl, { scale: 2, backgroundColor: '#ffffff' });
        const sitePlanUrl = sitePlanCanvas.toDataURL('image/png');
        
        const passportBlob = await generatePDFBlob(passportEl, `Passport_${house.name}`);
        const calculationBlob = await generatePDFBlob(calcEl, `Calculation_${house.name}`);
        const estimateBlob = estimateEl ? await generatePDFBlob(estimateEl, `Estimate_${house.name}`) : undefined;

        const success = await processProjectOrder({ 
            house: { ...house, sitePlanUrl }, 
            passportBlob, 
            calculationBlob,
            estimateBlob,
            revisionCount
        });
        
        if (success) {
          setOrderSuccess(true);
          setHasUnsavedChanges(false);
          setRevisionCount(prev => prev + 1);
        } else {
          throw new Error("Ошибка при отправке проекта.");
        }
    } catch (e: any) { 
        console.error(e); 
        setOrderError(e.message || "Произошла неизвестная ошибка.");
    } finally { 
        setIsOrdering(false); 
    }
  };

  return (
    <>
      {/* Mobile Warning */}
      {isMobile && isHouseOutOfBounds && (
        <div className="fixed top-[60px] left-4 right-4 z-[1000] bg-red-500 text-white p-3 rounded-xl text-[10px] font-bold uppercase flex items-start gap-2 shadow-2xl animate-in fade-in slide-in-from-top-4">
          <i className="fas fa-exclamation-triangle mt-0.5 text-red-200"></i>
          <span className="leading-relaxed">Внимание: Дом не помещается на участок. Уменьшите размеры дома или сместите его, чтобы соблюсти отступы 3 метра от границ участка.</span>
        </div>
      )}

      {/* Desktop Top Navigation Bar */}
      <div className="hidden lg:flex fixed top-6 left-6 right-[620px] justify-between items-center z-[500] pointer-events-none">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleBack} 
            className="pointer-events-auto bg-white/90 backdrop-blur-xl text-slate-900 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/20 hover:bg-white hover:scale-105 transition-all group"
          >
            <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-[#ff5f1f] transition-colors">
              <i className="fas fa-chevron-left text-slate-900 group-hover:text-white text-[10px]"></i>
            </div>
            <span className="text-[12px] font-black uppercase tracking-widest">{currentStep === 0 ? 'ВЫХОД' : 'НАЗАД'}</span>
          </button>

          <div className="bg-white/90 backdrop-blur-xl px-6 py-3 rounded-2xl shadow-2xl border border-white/20 flex flex-col items-start pointer-events-auto">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">ПРОЕКТ № {house.name}</span>
            <span className="text-[12px] font-bold text-slate-900 uppercase tracking-widest">{house.userName || 'БЕЗ ИМЕНИ'}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 pointer-events-auto">
          <div className="flex items-center gap-4 bg-white/80 backdrop-blur-xl px-8 py-3 rounded-3xl shadow-2xl border border-white/20">
            <div className="flex flex-col items-center px-4 border-r border-slate-200">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">УЧАСТОК</span>
              <span className="text-[16px] font-black text-slate-900 leading-none">{plotSotka} <span className="text-[10px] text-slate-400">СОТ.</span></span>
            </div>
            
            {currentStep >= 1 && (
              <div className="flex flex-col items-center px-4 border-r border-slate-200 animate-in fade-in slide-in-from-top-2 duration-500">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">ДОМ</span>
                <span className="text-[16px] font-black text-[#ff5f1f] leading-none">{Math.round(totalArea)} <span className="text-[10px] text-slate-400">М²</span></span>
              </div>
            )}

            {currentStep >= 3 && (
              <div className="flex flex-col items-center px-4 animate-in fade-in slide-in-from-top-2 duration-500">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">ПОСТРОЙКИ</span>
                <span className="text-[16px] font-black text-slate-900 leading-none">{Math.round(totalBuildingsArea)} <span className="text-[10px] text-slate-400">М²</span></span>
              </div>
            )}
          </div>

          {currentStep < 5 && (
            <button 
              onClick={handleContinue} 
              className={`bg-slate-900 text-white px-8 py-3 rounded-2xl shadow-2xl flex items-center gap-3 hover:bg-[#ff5f1f] hover:scale-105 transition-all group ${currentStep === 4 || isNextStepFlashing ? 'animate-pulse-orange ring-4 ring-orange-100' : ''}`}
            >
              <span className="text-[12px] font-black uppercase tracking-widest">{t.continue}</span>
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white transition-colors">
                <i className="fas fa-chevron-right text-white group-hover:text-[#ff5f1f] text-[10px]"></i>
              </div>
            </button>
          )}
        </div>
      </div>

      <div className="fixed -left-[10000px] top-0 pointer-events-none bg-white p-10" ref={sitePlanExportRef}>
         <div className="flex flex-col gap-6">
            <div className="flex justify-between items-end border-b-4 border-slate-900 pb-4">
               <div>
                  <h2 className="text-3xl font-black uppercase">Генеральный План</h2>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Проект: {house.name}</p>
               </div>
               <div className="text-right text-[10px] font-black uppercase text-slate-400">М 1:100</div>
            </div>
            <SitePlanSVG isForExport={true} />
            <div className="flex justify-between border-t-2 border-slate-100 pt-4 text-[9px] font-bold text-slate-400 uppercase">
               <span>Заказчик: {house.userName}</span>
               <span>PH HOME Parametric System</span>
            </div>
         </div>
      </div>

      <div className="fixed -left-[5000px] top-0 pointer-events-none bg-white p-16" style={{ width: '850px' }}>
         <div id="passport-doc-root" className="flex flex-col gap-10 text-slate-900 font-sans pb-24 px-8 bg-white" style={{ width: '850px' }}>
            <div className="flex justify-between items-start border-b border-slate-200 pb-8 mt-6">
               <div className="flex flex-col gap-4">
                  <img src={LOGO_URL} className="w-14 h-14 rounded-xl object-cover grayscale" alt="PH Logo" />
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[9px] font-bold text-slate-900 uppercase tracking-[0.2em]">{CONTACT_INFO.phone}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">{CONTACT_INFO.email}</p>
                  </div>
               </div>
               <div className="flex flex-col items-end gap-3">
                  <h1 className="text-3xl font-light uppercase tracking-[0.3em] leading-tight text-right text-slate-900">Архитектурный<br/><span className="font-black">Паспорт</span></h1>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.4em]">ПРОЕКТ № {house.name}</p>
                  </div>
               </div>
            </div>
            
            <div className="grid grid-cols-12 gap-10">
               <div className="col-span-5 space-y-10">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] mb-2">ЗАКАЗЧИК</p>
                    <p className="text-xl font-light text-slate-900 leading-tight">{house.userName || '---'}</p>
                    <p className="text-xs font-medium text-slate-400 mt-1">{house.userPhone}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6 border-t border-slate-100 pt-6">
                     <div className="text-left">
                        <p className="text-[7px] font-black text-slate-300 uppercase mb-2 tracking-[0.15em]">ОБЩАЯ ПЛОЩАДЬ</p>
                        <p className="text-2xl font-light text-slate-900">{Math.round(totalBuildingsArea)}<span className="text-xs ml-1 text-slate-400">м²</span></p>
                     </div>
                     <div className="text-left">
                        <p className="text-[7px] font-black text-slate-300 uppercase mb-2 tracking-[0.15em]">УЧАСТОК</p>
                        <p className="text-2xl font-light text-slate-900">{plotSotka}<span className="text-xs ml-1 text-slate-400">сот.</span></p>
                     </div>
                  </div>

                  {house.isMapMode && house.mapCenter && (
                    <div className="pt-4 border-t border-slate-100">
                      <p className="text-[7px] font-black text-slate-300 uppercase tracking-[0.15em] mb-2">ЛОКАЦИЯ</p>
                      <p className="text-[9px] font-medium font-mono text-slate-400 tracking-widest">{house.mapCenter.lat.toFixed(6)}, {house.mapCenter.lng.toFixed(6)}</p>
                    </div>
                  )}

                  <div className="pt-6 border-t border-slate-100">
                    <h3 className="text-[8px] font-black uppercase text-slate-300 mb-3 tracking-[0.2em]">КОНЦЕПЦИЯ</h3>
                    <p className="text-xs font-bold leading-relaxed text-slate-800 uppercase tracking-wider">{house.type}</p>
                    <p className="text-[11px] font-medium leading-relaxed text-slate-400 mt-2 italic">{house.styleDescription}</p>
                  </div>
               </div>

               <div className="col-span-7 flex flex-col gap-6">
                  <div className="bg-white rounded-[48px] p-6 flex items-center justify-center overflow-hidden border border-slate-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.06)] aspect-square">
                     <SitePlanSVG />
                  </div>
                  <p className="text-[7px] font-black text-slate-300 uppercase tracking-[0.4em] text-center">ГЕНЕРАЛЬНЫЙ ПЛАН • МАСШТАБ 1:100</p>
               </div>
            </div>

            {house.isMapMode && house.mapSnapshotUrl && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">КАРТА СО СПУТНИКА</h3>
                <img src={house.mapSnapshotUrl} crossOrigin="anonymous" className="w-full h-auto object-contain rounded-[40px] border-2 border-slate-100 shadow-lg" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-8">
               <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ВЕДОМОСТЬ СТРОЕНИЙ</h3>
                  <div className="space-y-2">
                     <div className="flex justify-between border-b py-2 text-sm font-bold">
                        <span>Основной дом ({house.floors} эт)</span>
                        <div className="text-right">
                           <span className="block">{house.houseWidth}x{house.houseLength}м</span>
                           <span className="text-[10px] text-[#ff5f1f]">{Math.round(house.houseWidth * house.houseLength * house.floors)} м²</span>
                        </div>
                     </div>
                     {house.additions.map((a, i) => (
                       <div key={i} className="flex justify-between border-b py-2 text-sm font-bold">
                          <span>Пристройка {i+1} ({a.floors} эт)</span>
                          <div className="text-right">
                             <span className="block">{a.width}x{a.length}м</span>
                             <span className="text-[10px] text-[#ff5f1f]">{Math.round(a.width * a.length * a.floors)} м²</span>
                          </div>
                       </div>
                     ))}
                     {house.hasPool && (
                       <div className="flex justify-between border-b py-2 text-sm font-bold">
                          <span>{t.pool}</span>
                          <div className="text-right">
                             <span className="block">{house.poolWidth}x{house.poolDepth}м</span>
                             <span className="text-[10px] text-[#ff5f1f]">{Math.round(house.poolWidth * house.poolDepth)} м²</span>
                          </div>
                       </div>
                     )}
                     {house.hasGarage && (
                       <div className="flex justify-between border-b py-2 text-sm font-bold">
                          <span>{t.garage} ({house.garageCars} авт)</span>
                          <div className="text-right">
                             <span className="block">{getGarageWidth(house.garageCars, isSmallPlot)}x{isSmallPlot ? 3.25 : 6.5}м</span>
                             <span className="text-[10px] text-[#ff5f1f]">{Math.round(getGarageWidth(house.garageCars, isSmallPlot) * (isSmallPlot ? 3.25 : 6.5))} м²</span>
                          </div>
                       </div>
                     )}
                     {house.hasCarport && (
                       <div className="flex justify-between border-b py-2 text-sm font-bold">
                          <span>{t.carport} ({house.carportCars} авт)</span>
                          <div className="text-right">
                             <span className="block">{getCarportWidth(house.carportCars, isSmallPlot)}x{isSmallPlot ? 3.0 : 6.0}м</span>
                             <span className="text-[10px] text-[#ff5f1f]">{Math.round(getCarportWidth(house.carportCars, isSmallPlot) * (isSmallPlot ? 3.0 : 6.0))} м²</span>
                          </div>
                       </div>
                     )}
                     {house.hasBath && (
                       <div className="flex justify-between border-b py-2 text-sm font-bold">
                          <span>{t.bath}</span>
                          <div className="text-right">
                             <span className="block">{house.bathWidth}x{house.bathDepth}м</span>
                             <span className="text-[10px] text-[#ff5f1f]">{Math.round(house.bathWidth * house.bathDepth)} м²</span>
                          </div>
                       </div>
                     )}
                     {house.hasTerrace && (
                       <div className="flex justify-between border-b py-2 text-sm font-bold">
                          <span>{t.terrace}</span>
                          <div className="text-right">
                             <span className="block">{house.terraceWidth}x{house.terraceDepth}м</span>
                             <span className="text-[10px] text-[#ff5f1f]">{Math.round(house.terraceWidth * house.terraceDepth)} м²</span>
                          </div>
                       </div>
                     )}
                     {house.hasBBQ && (
                       <div className="flex justify-between border-b py-2 text-sm font-bold">
                          <span>{t.bbq}</span>
                          <div className="text-right">
                             <span className="block">{house.bbqWidth}x{house.bbqDepth}м</span>
                             <span className="text-[10px] text-[#ff5f1f]">{Math.round(house.bbqWidth * house.bbqDepth)} м²</span>
                          </div>
                       </div>
                     )}
                     <div className="flex justify-between pt-4 border-t-2 border-slate-900 text-lg font-black">
                        <span>ИТОГО ПЛОЩАДЬ СТРОЕНИЙ</span>
                        <span>{Math.round(totalBuildingsArea)} м²</span>
                     </div>
                  </div>
               </div>
               <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ВИЗУАЛИЗАЦИЯ СТИЛЯ</h3>
                  {house.styleImageUrl && <img src={house.styleImageUrl} crossOrigin="anonymous" className="w-full h-auto max-h-64 object-contain rounded-3xl shadow-lg bg-slate-50" />}
               </div>
            </div>
            <div>
               <h2 className="text-xl font-black mb-6 uppercase border-b-2 border-slate-100 pb-2">ЭКСПЛИКАЦИЯ ПОМЕЩЕНИЙ</h2>
               <div className="grid grid-cols-2 gap-10">
                  {house.calculatedPlan?.map((floor, i) => (
                    <div key={i} className="space-y-3">
                       <div className="flex justify-between items-center bg-orange-50 px-3 py-1 rounded-full">
                          <p className="font-black text-[12px] text-[#ff5f1f] uppercase">{floor.floorNumber} ЭТАЖ</p>
                          <p className="font-black text-[10px] text-slate-500">{Math.round(floor.rooms.reduce((acc, r) => acc + r.area, 0))} м²</p>
                       </div>
                       <div className="space-y-1">
                        {floor.rooms.map(r => (
                          <div key={r.id} className="flex justify-between border-b border-slate-50 py-2 text-[13px]">
                            <span className="font-medium">{r.name}</span>
                            <span className="font-black">{Math.round(r.area)} м²</span>
                          </div>
                        ))}
                        <div className="flex justify-between border-b border-slate-50 py-2 text-[13px] opacity-60 italic">
                          <span>Стены и перегородки</span>
                          <span className="font-black">{Math.round(getAreaForFloor(i) * WALL_RATIO)} м²</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-50 py-2 text-[13px] opacity-60 italic">
                          <span>Холлы и коридоры</span>
                          <span className="font-black">{Math.round(getAreaForFloor(i) * HALL_RATIO)} м²</span>
                        </div>
                        {maxFloors > 1 && (
                          <div className="flex justify-between border-b border-slate-50 py-2 text-[13px] opacity-60 italic">
                            <span>Лестница</span>
                            <span className="font-black">{STAIR_AREA} м²</span>
                          </div>
                        )}
                       </div>
                    </div>
                  ))}
               </div>
            </div>
            <div className="mt-auto pt-10 border-t border-slate-100 flex justify-between items-end text-[9px] text-slate-400 font-bold uppercase tracking-widest">
               <span>PH HOME Parametric System • {new Date().toLocaleDateString()}</span>
               <span>Проект сформирован автоматически</span>
            </div>
         </div>
         <div id="calculation-doc-root" className="flex flex-col gap-10 text-slate-900 p-12 font-sans bg-white pb-24" style={{ width: '850px' }}>
            <div className="flex justify-between items-start border-b border-slate-200 pb-8 mt-6">
               <div className="flex flex-col gap-4">
                  <img src={LOGO_URL} className="w-14 h-14 rounded-xl object-cover grayscale" alt="PH Logo" />
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[9px] font-bold text-slate-900 uppercase tracking-[0.2em]">{CONTACT_INFO.phone}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">{CONTACT_INFO.email}</p>
                  </div>
               </div>
               <div className="flex flex-col items-end gap-3 text-right">
                  <h1 className="text-3xl font-light uppercase tracking-[0.3em] leading-tight text-slate-900">Расчёт стоимости<br/><span className="font-black">Проектирования</span></h1>
                  <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.4em]">ПРОЕКТ № {house.name}</p>
               </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
               <p className="text-[10px] font-medium text-slate-500 leading-relaxed italic text-center">
                  {t.preliminaryNotice}
               </p>
            </div>

            <div className="grid grid-cols-12 gap-10">
               <div className="col-span-12 space-y-2">
                  <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] mb-2">ЗАКАЗЧИК</p>
                  <p className="text-xl font-light text-slate-900 leading-tight">{house.userName || '---'}</p>
                  <p className="text-xs font-medium text-slate-400 mt-1">{house.userPhone || '---'}</p>
                  <p className="text-xs font-medium text-slate-400">{house.userEmail || '---'}</p>
               </div>
            </div>

            <div className="space-y-8">
               <div className="space-y-4">
                  <h3 className="text-[8px] font-black uppercase text-slate-300 tracking-[0.2em]">Детализация стоимости</h3>
                  <table className="w-full border-collapse">
                     <thead>
                        <tr className="border-b border-slate-200">
                           <th className="text-left py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Наименование</th>
                           <th className="text-left py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Параметры</th>
                           <th className="text-right py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Стоимость</th>
                        </tr>
                     </thead>
                     <tbody className="text-[11px] font-medium">
                        <tr className="border-b border-slate-50">
                           <td className="py-4 text-slate-600">Проектирование основного дома</td>
                           <td className="py-4 text-slate-400">{Math.round(totalArea)} м²</td>
                           <td className="py-4 text-right font-bold text-slate-900">
                              {(() => {
                                 const houseArea = Math.round(totalArea);
                                 if (houseArea <= 250) return (1000000).toLocaleString();
                                 if (houseArea <= 450) return (1750000).toLocaleString();
                                 if (houseArea <= 700) return (2850000).toLocaleString();
                                 return (houseArea * 4000).toLocaleString();
                              })()} ₸
                           </td>
                        </tr>
                        <tr className="border-b border-slate-50">
                           <td className="py-4 text-slate-600">Проектирование доп. построек</td>
                           <td className="py-4 text-slate-400">{Math.round(totalBuildingsArea - totalArea)} м²</td>
                           <td className="py-4 text-right font-bold text-slate-900">
                              {(Math.round(totalBuildingsArea - totalArea) * 1000).toLocaleString()} ₸
                           </td>
                        </tr>
                        <tr className="border-b border-slate-50">
                           <td className="py-4 text-slate-600">Посадка объектов на участок</td>
                           <td className="py-4 text-slate-400">{plotSotka} сот.</td>
                           <td className="py-4 text-right font-bold text-slate-900">
                              {(Math.round(plotSotkaValue * 20000)).toLocaleString()} ₸
                           </td>
                        </tr>
                        <tr className="bg-slate-50/50">
                           <td colSpan={2} className="py-5 pl-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Итого стоимость проекта</td>
                           <td className="py-5 pr-4 text-right text-[16px] font-black text-[#ff5f1f]">
                              {(() => {
                                 const houseArea = Math.round(totalArea);
                                 const additionalObjectsArea = Math.round(totalBuildingsArea - totalArea);
                                 const sitingCost = Math.round(plotSotkaValue * 20000);
                                 let houseBasePrice = 0;
                                 if (houseArea <= 250) houseBasePrice = 1000000;
                                 else if (houseArea <= 450) houseBasePrice = 1750000;
                                 else if (houseArea <= 700) houseBasePrice = 2850000;
                                 else houseBasePrice = houseArea * 4000;
                                 const additionalObjectsPrice = additionalObjectsArea * 1000;
                                 return (houseBasePrice + additionalObjectsPrice + sitingCost).toLocaleString();
                              })()} ₸
                           </td>
                        </tr>
                     </tbody>
                  </table>
               </div>

               <div className="grid grid-cols-2 gap-12">
                  <div className="space-y-6">
                     <h3 className="text-[8px] font-black uppercase text-slate-300 tracking-[0.2em]">Состав проекта</h3>
                     <div className="space-y-4">
                        <p className="text-[11px] font-black text-slate-900 leading-tight uppercase tracking-wider">{t.conceptModel}</p>
                        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                           <p className="text-[9px] font-black text-[#ff5f1f] uppercase tracking-widest text-center">В стоимость входит 3D макет 1:50</p>
                        </div>
                        <ul className="grid grid-cols-1 gap-2">
                           {t.conceptList.map((item: string, i: number) => (
                              <li key={i} className="text-[10px] font-medium flex items-start gap-2 text-slate-500">
                                 <div className="w-1 h-1 bg-slate-300 rounded-full mt-1.5 shrink-0" />
                                 {item}
                              </li>
                           ))}
                        </ul>
                     </div>
                  </div>
                  <div className="space-y-6">
                     <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em]">Визуализация макета</p>
                     <div className="rounded-[32px] overflow-hidden border border-slate-100 shadow-lg grayscale-[0.2] hover:grayscale-0 transition-all duration-700">
                        <img src={MODEL_PHOTO_URL} crossOrigin="anonymous" className="w-full h-auto object-cover" alt="3D Model" />
                     </div>
                  </div>
               </div>
            </div>

            <div className="mt-auto pt-10 border-t border-slate-100 flex justify-between items-end text-[9px] text-slate-400 font-bold uppercase tracking-widest">
               <span>PH HOME Parametric System • {new Date().toLocaleDateString()}</span>
               <span>Расчет сформирован автоматически</span>
            </div>
         </div>
      </div>

      <div className="lg:hidden fixed top-3 left-3 right-3 pointer-events-auto flex justify-between items-start z-[500]">
        <button onClick={handleBack} className="pointer-events-auto bg-white/90 backdrop-blur text-slate-900 px-3 py-1.5 rounded-[12px] shadow-xl flex items-center gap-1.5 border border-slate-100 active:scale-95 transition-all">
          <div className="w-4 h-4 bg-slate-100 rounded-full flex items-center justify-center">
            <i className="fas fa-chevron-left text-slate-900 text-[8px]"></i>
          </div>
          <span className="text-[10px] font-black uppercase tracking-tighter">{currentStep === 0 ? 'ВЫХОД' : 'НАЗАД'}</span>
        </button>
        <div className="flex items-start gap-1.5 pointer-events-none">
          <div className="bg-white/90 backdrop-blur px-2 py-1 rounded-[12px] shadow-xl border border-slate-100 flex flex-col items-center">
            <span className="text-[6px] font-black text-slate-400 uppercase tracking-tighter mb-0.5 leading-none">УЧАСТОК</span>
            <span className="text-[11px] font-black text-[#ff5f1f] leading-none">{plotSotka} <span className="text-[8px] text-slate-900 font-bold">СОТ.</span></span>
          </div>
          {currentStep < 5 && (
            <button onClick={handleContinue} className={`pointer-events-auto bg-white/90 backdrop-blur text-slate-900 px-3 py-1.5 rounded-[12px] shadow-xl flex items-center gap-1.5 border border-slate-100 active:scale-95 transition-all ${currentStep === 4 || isNextStepFlashing ? 'animate-pulse-orange ring-2 ring-[#ff5f1f]' : ''}`}>
              <span className="text-[10px] font-black uppercase tracking-tighter">{t.continue}</span>
              <div className="w-4 h-4 bg-[#0f172a] rounded-full flex items-center justify-center">
                <i className="fas fa-chevron-right text-white text-[8px]"></i>
              </div>
            </button>
          )}
        </div>
      </div>

      <div className={`fixed bottom-0 lg:inset-y-0 right-0 w-full lg:w-[600px] pointer-events-none p-2 lg:p-4 flex flex-col gap-1 z-[400] transition-transform duration-500 ease-in-out ${!isMobileExpanded ? 'translate-y-[calc(100%-100px)] lg:translate-y-0' : 'translate-y-0'}`}>
        <div className="bg-white/95 backdrop-blur-3xl p-3 lg:p-6 pb-20 lg:pb-6 rounded-[32px] lg:rounded-[48px] border border-slate-200 pointer-events-auto shadow-2xl flex flex-col gap-3 lg:gap-5 overflow-y-auto max-h-[85vh] lg:max-h-full scrollbar-hide relative">
          <div onClick={() => !isMobileExpanded && setIsMobileExpanded(true)} className="w-full flex flex-col gap-2 cursor-pointer lg:cursor-default sticky top-0 z-[100] bg-white/95 backdrop-blur-md pt-2 pb-1">
            <div onClick={(e) => { e.stopPropagation(); setIsMobileExpanded(!isMobileExpanded); }} className="lg:hidden w-12 h-1 bg-slate-300 rounded-full mx-auto shrink-0 cursor-pointer py-2 bg-clip-content" />
            
            <div className="flex justify-between items-center bg-slate-100/95 p-0.5 rounded-2xl shrink-0 border border-slate-200 shadow-sm">
              <button onClick={() => onBackToWelcome?.()} className="hidden lg:flex w-12 py-3 px-0.5 rounded-xl flex-col items-center gap-0.5 transition-all text-slate-400 hover:text-[#ff5f1f] hover:bg-white hover:shadow-md">
                <i className="fas fa-arrow-left text-[13px]"></i>
                <span className="text-[7.5px] font-black uppercase tracking-tighter text-center leading-none">ВЫХОД</span>
              </button>
              <div className="hidden lg:block w-[1px] h-8 bg-slate-200 mx-1"></div>
              {STEPS.map((step, i) => (
                <button key={step.id} onClick={(e) => { e.stopPropagation(); handleStepClick(i); }} className={`flex-1 py-2 lg:py-3 px-0.5 rounded-xl flex flex-col items-center gap-0.5 transition-all ${i === currentStep ? 'bg-white shadow-md text-[#ff5f1f] animate-pulse-fast' : 'text-slate-400 hover:text-slate-600'}`}>
                  <i className={`fas ${step.icon} text-[11px] lg:text-[13px]`}></i>
                  <span className={`text-[6px] lg:text-[7.5px] font-black uppercase tracking-tighter text-center leading-none`}>{step.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-3 lg:space-y-5 mt-2">
            <StepGuidance text={currentStep === 1 && !hasVisitedStep1 ? "Двигай дом, найди лучшее расположение." : t.stepInstructions[currentStep]} />

            {currentStep === 0 && (
              <div className="space-y-2 lg:space-y-4 animate-in fade-in duration-500">
                <div className={`bg-slate-50 p-4 lg:p-8 rounded-2xl lg:rounded-[40px] border flex flex-col items-center justify-center gap-1 lg:gap-3 transition-all ${selectedObjectId === 'plot' ? 'border-[#ff5f1f] ring-2 ring-orange-100 bg-white' : 'border-slate-100'}`}>
                   <span className="text-[9px] lg:text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] lg:tracking-[0.25em] mb-0.5 lg:mb-1">{t.plotArea}</span>
                   <div className="flex items-baseline gap-1.5 lg:gap-2">
                      <span className="text-slate-900 font-black text-4xl lg:text-6xl tracking-tighter">{plotSotka}</span>
                      <span className="bg-[#ff5f1f] text-white font-black px-3 lg:px-5 py-1.5 lg:py-2 rounded-lg lg:rounded-xl text-[9px] lg:text-[12px] uppercase tracking-widest shadow-lg shadow-orange-500/20">{t.sotka}</span>
                   </div>
                   <div className="mt-1 lg:mt-2 flex items-center gap-1.5 lg:gap-2 text-slate-400">
                      <i className="fas fa-expand-arrows-alt text-[8px] lg:text-sm"></i>
                      <span className="text-[7px] lg:text-[9px] font-bold uppercase tracking-widest">Тяните за углы для изменения</span>
                   </div>
                </div>

                <div className="bg-white rounded-2xl lg:rounded-[28px] p-3 lg:p-5 border shadow-md space-y-2 lg:space-y-3">
                  <h4 className="text-[8px] lg:text-[10px] font-black uppercase text-slate-400 tracking-widest">{t.gatePos}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setHouse(p => {
                        const vertices = p.plotCorners?.vertices || [];
                        const count = vertices.length || 4;
                        return { ...p, gateSideIndex: (p.gateSideIndex - 1 + count) % count };
                      })}
                      className="py-4 lg:py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[11px] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
                    >
                      <i className="fas fa-chevron-left"></i>
                    </button>
                    <button 
                      onClick={() => setHouse(p => {
                        const vertices = p.plotCorners?.vertices || [];
                        const count = vertices.length || 4;
                        return { ...p, gateSideIndex: (p.gateSideIndex + 1) % count };
                      })}
                      className="py-4 lg:py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[11px] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
                    >
                      <i className="fas fa-chevron-right"></i>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-3 lg:space-y-6 animate-in fade-in duration-500">
                <div className={`p-3 lg:p-6 rounded-2xl lg:rounded-[32px] grid grid-cols-2 gap-2 lg:gap-4 shadow-xl transition-all duration-500 ${selectedObjectId === 'house' ? 'bg-[#ff5f1f] scale-[1.01] ring-2 ring-orange-200' : 'bg-[#0f172a]'}`}>
                  <div className="col-span-2 flex items-center justify-between mb-0.5 lg:mb-1">
                    <div className="flex items-center gap-1.5 lg:gap-2">
                      <div className={`w-5 h-5 lg:w-7 lg:h-7 rounded-full flex items-center justify-center ${selectedObjectId === 'house' ? 'bg-white text-[#ff5f1f]' : 'bg-slate-800 text-white'}`}><i className="fas fa-cog text-[8px] lg:text-sm"></i></div>
                      <h3 className="text-white text-[9px] lg:text-[11px] font-black uppercase tracking-widest">Параметры дома</h3>
                    </div>
                  </div>
                  <div className="flex flex-col"><span className={`text-[7px] lg:text-[8px] font-black uppercase mb-0.5 ${selectedObjectId === 'house' ? 'text-white/60' : 'text-slate-500'}`}>{t.totalArea}</span><span className="text-white text-lg lg:text-2xl font-black">{Math.round(totalArea)} <span className="text-[8px] lg:text-[10px]">M²</span></span></div>
                  <div className="flex flex-col"><span className={`text-[7px] lg:text-[8px] font-black uppercase mb-0.5 ${selectedObjectId === 'house' ? 'text-white/60' : 'text-slate-500'}`}>{t.floorArea}</span><span className="text-white text-lg lg:text-2xl font-black">{Math.round(totalFootprint)} <span className="text-[8px] lg:text-[10px]">M²</span></span></div>
                  
                  <div className="col-span-2 flex items-center gap-1.5">
                    <button onClick={() => setHouse(p => ({...p, houseRotation: p.houseRotation - ROTATION_STEP}))} className={`flex-1 py-1.5 lg:py-3 rounded-lg lg:rounded-xl font-black uppercase text-[8px] lg:text-[9px] transition-all bg-[#ff5f1f] text-white`}><i className="fas fa-undo mr-1 lg:mr-1.5"></i> -10°</button>
                    <button onClick={() => setHouse(p => ({...p, houseRotation: p.houseRotation + ROTATION_STEP}))} className={`flex-1 py-1.5 lg:py-3 rounded-lg lg:rounded-xl font-black uppercase text-[8px] lg:text-[9px] transition-all bg-[#ff5f1f] text-white`}><i className="fas fa-redo mr-1 lg:mr-1.5"></i> +10°</button>
                  </div>
                </div>
                <div className="space-y-3 lg:space-y-5">
                  {!isMobile && isHouseOutOfBounds && (
                    <div className="bg-red-500 text-white p-3 lg:p-4 rounded-xl lg:rounded-2xl text-[9px] lg:text-[11px] font-bold uppercase flex items-start gap-3 shadow-lg animate-in fade-in slide-in-from-top-2">
                      <i className="fas fa-exclamation-triangle mt-0.5 text-red-200 text-sm lg:text-base"></i>
                      <span className="leading-relaxed">Внимание: Дом не помещается на участок. Уменьшите размеры дома или сместите его, чтобы соблюсти отступы 3 метра от границ участка.</span>
                    </div>
                  )}
                  <Slider label={t.width} value={house.houseWidth} min={4} max={Math.max(30, house.plotWidth)} onChange={(v: number) => setHouseAndValidate({ houseWidth: v })} />
                  <Slider label={t.length} value={house.houseLength} min={4} max={Math.max(30, house.plotLength)} onChange={(v: number) => setHouseAndValidate({ houseLength: v })} />
                  <div className="flex bg-slate-100 p-0.5 lg:p-1 rounded-xl lg:rounded-2xl gap-0.5">{[1, 2, 3].map(n => (<button key={n} onClick={() => setHouse(p => ({...p, floors: n}))} className={`flex-1 py-1.5 lg:py-3 rounded-lg lg:rounded-xl font-black text-[10px] lg:text-[12px] uppercase transition-all ${house.floors === n ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'}`}>{n} {t.floors}</button>))}</div>
                  <div className="space-y-2 lg:space-y-3">
                    <button onClick={() => setHouse(p => ({ ...p, additions: [...p.additions, { id: Math.random().toString(36).substr(2, 9), width: 6, length: 6, floors: 1, posX: house.housePosX + 8, posZ: house.housePosZ, rotation: 0 }] }))} className="w-full py-2 lg:py-4 rounded-xl lg:rounded-2xl border-2 border-dashed border-slate-300 text-slate-400 font-black uppercase text-[9px] lg:text-[10px] hover:border-[#ff5f1f] hover:text-[#ff5f1f] transition-all">
                      <i className="fas fa-plus mr-1.5"></i> {t.addAddition}
                    </button>
                    {house.additions.map((add, idx) => (
                      <div key={add.id} className="p-2 lg:p-4 bg-slate-50 border border-slate-100 rounded-xl lg:rounded-2xl space-y-2 lg:space-y-3">
                         <div className="flex justify-between items-center">
                            <span className="text-[8px] lg:text-[9px] font-black uppercase text-slate-400">Пристройка {idx + 1}</span>
                            <button onClick={() => setHouse(p => ({ ...p, additions: p.additions.filter(a => a.id !== add.id) }))} className="w-5 h-5 lg:w-7 lg:h-7 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-300 hover:text-red-500 transition-all"><i className="fas fa-times text-[9px] lg:text-sm"></i></button>
                         </div>
                         <Slider label={t.width} value={add.width} min={2} max={15} onChange={(v: number) => updateAddition(add.id, { width: v })} />
                         <Slider label={t.length} value={add.length} min={2} max={15} onChange={(v: number) => updateAddition(add.id, { length: v })} />
                         <div className="flex bg-slate-100 p-0.5 rounded-lg lg:rounded-xl gap-0.5">{[1, 2, 3].map(n => (<button key={n} onClick={() => updateAddition(add.id, { floors: n })} className={`flex-1 py-1 lg:py-1.5 rounded-md lg:rounded-lg text-[8px] lg:text-[9px] font-black transition-all ${add.floors === n ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>{n} эт</button>))}</div>
                         <div className="flex gap-1.5">
                           <button onClick={() => updateAddition(add.id, { rotation: add.rotation - ROTATION_STEP })} className="flex-1 py-1 lg:py-1.5 bg-slate-900 text-white rounded-md lg:rounded-lg text-[8px] lg:text-[9px] font-black"><i className="fas fa-undo mr-1"></i> -10°</button>
                           <button onClick={() => updateAddition(add.id, { rotation: add.rotation + ROTATION_STEP })} className="flex-1 py-1 lg:py-1.5 bg-slate-900 text-white rounded-md lg:rounded-lg text-[8px] lg:text-[9px] font-black"><i className="fas fa-redo mr-1"></i> +10°</button>
                         </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-2 lg:space-y-4 animate-in fade-in duration-500">
                <div className="bg-[#0f172a] p-2 lg:p-4 rounded-2xl lg:rounded-[28px] space-y-2 lg:space-y-4">
                  {house.calculatedPlan?.map((floor, fIdx) => {
                    const floorArea = getAreaForFloor(fIdx);
                    const wallArea = floorArea * WALL_RATIO;
                    const hallArea = floorArea * HALL_RATIO;
                    const stairs = maxFloors > 1 ? STAIR_AREA : 0;
                    return (
                      <div key={`floor-${fIdx}`} className="space-y-1.5 lg:space-y-3 border-b border-slate-800 pb-2 lg:pb-4 last:border-none last:pb-0">
                        <div className="flex justify-between items-center px-1">
                          <span className="text-white font-black text-[9px] lg:text-[12px] uppercase">{floor.floorNumber} ЭТАЖ</span>
                          <span className="text-[#ff5f1f] font-black text-[9px] lg:text-[12px]">{Math.round(floorArea)} м²</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                           <div className="bg-slate-800 p-1 lg:p-1.5 rounded-md lg:rounded-lg text-center"><span className="block text-[5px] lg:text-[6px] text-slate-400 uppercase">Стены 15%</span><span className="text-[8px] lg:text-[10px] text-white font-black">{Math.round(wallArea)}м²</span></div>
                           <div className="bg-slate-800 p-1 lg:p-1.5 rounded-md lg:rounded-lg text-center"><span className="block text-[5px] lg:text-[6px] text-slate-400 uppercase">Холлы 9%</span><span className="text-[8px] lg:text-[10px] text-white font-black">{Math.round(hallArea)}м²</span></div>
                           <div className="bg-slate-800 p-1 lg:p-1.5 rounded-md lg:rounded-lg text-center"><span className="block text-[5px] lg:text-[6px] text-slate-400 uppercase">Лестница</span><span className="text-[8px] lg:text-[10px] text-white font-black">{stairs}м²</span></div>
                        </div>
                        <div className="space-y-1.5 lg:space-y-3">
                          {floor.rooms.map(room => (
                            <div key={room.id} className="p-2 lg:p-3 bg-slate-800/40 rounded-lg lg:rounded-xl border border-slate-700/30 group space-y-1 lg:space-y-2">
                              <div className="flex items-center gap-1.5 lg:gap-2">
                                <input type="text" value={room.name} onChange={e => updateRoom(fIdx, room.id, { name: e.target.value })} className="flex-1 bg-transparent border-none text-[10px] lg:text-[12px] font-bold text-slate-200 outline-none" />
                                <div className="flex items-center gap-1">
                                  <button onClick={() => setHouse(prev => { 
                                    if(!prev.calculatedPlan) return prev; 
                                    const p=[...prev.calculatedPlan]; 
                                    p[fIdx].rooms=p[fIdx].rooms.map(r=>r.id===room.id?{...r,isLocked:!r.isLocked}:r); 
                                    return {...prev, calculatedPlan:p}
                                  })} className={`w-5 h-5 lg:w-7 lg:h-7 flex items-center justify-center rounded-md lg:rounded-lg transition-all ${room.isLocked ? 'bg-[#ff5f1f] text-white' : 'bg-slate-700 text-slate-400'}`}>
                                    <i className={`fas ${room.isLocked ? 'fa-lock' : 'fa-lock-open'} text-[7px] lg:text-[9px]`}></i>
                                  </button>
                                  <button onClick={() => removeRoom(fIdx, room.id)} className="w-5 h-5 lg:w-7 lg:h-7 flex items-center justify-center text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                    <i className="fas fa-trash-alt text-[7px] lg:text-[9px]"></i>
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-0.5 lg:space-y-1">
                                <div className="flex justify-between items-center text-[7px] lg:text-[9px] uppercase font-black text-slate-500">
                                   <span>Площадь</span>
                                   <span className="text-white">{Math.round(room.area)} м²</span>
                                </div>
                                <input 
                                  type="range" 
                                  min={MIN_ROOM_AREA} 
                                  max={Math.round(floorArea)} 
                                  step={1}
                                  value={Math.round(room.area)}
                                  onChange={(e) => updateRoom(fIdx, room.id, { area: parseInt(e.target.value) })}
                                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#ff5f1f]"
                                />
                              </div>
                            </div>
                          ))}
                          <button onClick={() => addRoom(fIdx)} className="w-full py-3 lg:py-2 border-2 border-dashed border-slate-700 text-slate-500 rounded-lg lg:rounded-xl text-[9px] lg:text-[9px] font-black uppercase hover:border-[#ff5f1f] hover:text-[#ff5f1f] transition-all pointer-events-auto relative z-10">
                            <i className="fas fa-plus mr-1.5"></i> Добавить помещение
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-2 lg:space-y-4 animate-in fade-in duration-500">
                <ToggleObject isMobileExpanded={isMobileExpanded} isFocused={selectedObjectId === 'pool'} label={t.pool} active={house.hasPool} onToggle={(v: boolean) => setHouse(p => ({...p, hasPool: v, poolWidth: v ? 4 * scaleFactor : p.poolWidth, poolDepth: v ? 8 * scaleFactor : p.poolDepth}))}>
                  <Slider label={t.width} value={house.poolWidth} min={3} max={15} onChange={(v: number) => setHouse(p => ({...p, poolWidth: v}))} />
                  <Slider label={t.depth} value={house.poolDepth} min={2} max={10} onChange={(v: number) => setHouse(p => ({...p, poolDepth: v}))} />
                  <div className="flex gap-2">
                    <button onClick={() => setHouse(p => ({...p, poolRotation: p.poolRotation - ROTATION_STEP}))} className="flex-1 py-3 bg-slate-100 rounded-xl font-black uppercase text-[10px]"><i className="fas fa-undo mr-2"></i> -10°</button>
                    <button onClick={() => setHouse(p => ({...p, poolRotation: p.poolRotation + ROTATION_STEP}))} className="flex-1 py-3 bg-slate-100 rounded-xl font-black uppercase text-[10px]"><i className="fas fa-redo mr-2"></i> +10°</button>
                  </div>
                </ToggleObject>
                <ToggleObject isMobileExpanded={isMobileExpanded} isFocused={selectedObjectId === 'terrace'} label={t.terrace} active={house.hasTerrace} onToggle={(v: boolean) => setHouse(p => ({...p, hasTerrace: v, terraceWidth: v ? 4 * scaleFactor : p.terraceWidth, terraceDepth: v ? 3 * scaleFactor : p.terraceDepth}))}>
                  <Slider label={t.width} value={house.terraceWidth} min={3} max={15} onChange={(v: number) => setHouse(p => ({...p, terraceWidth: v}))} />
                  <Slider label={t.depth} value={house.terraceDepth} min={3} max={10} onChange={(v: number) => setHouse(p => ({...p, terraceDepth: v}))} />
                  <div className="flex gap-2">
                    <button onClick={() => setHouse(p => ({...p, terraceRotation: p.terraceRotation - ROTATION_STEP}))} className="flex-1 py-3 bg-slate-100 rounded-xl font-black uppercase text-[10px]"><i className="fas fa-undo mr-2"></i> -10°</button>
                    <button onClick={() => setHouse(p => ({...p, terraceRotation: p.terraceRotation + ROTATION_STEP}))} className="flex-1 py-3 bg-slate-100 rounded-xl font-black uppercase text-[10px]"><i className="fas fa-redo mr-2"></i> +10°</button>
                  </div>
                </ToggleObject>
                <ToggleObject isMobileExpanded={isMobileExpanded} isFocused={selectedObjectId === 'bath'} label={t.bath} active={house.hasBath} onToggle={(v: boolean) => setHouse(p => ({...p, hasBath: v, bathWidth: v ? 4 * scaleFactor : p.bathWidth, bathDepth: v ? 6 * scaleFactor : p.bathDepth}))}>
                  <Slider label={t.width} value={house.bathWidth} min={3} max={12} onChange={(v: number) => setHouse(p => ({...p, bathWidth: v}))} />
                  <Slider label={t.depth} value={house.bathDepth} min={3} max={12} onChange={(v: number) => setHouse(p => ({...p, bathDepth: v}))} />
                  <div className="flex gap-2">
                    <button onClick={() => setHouse(p => ({...p, bathRotation: p.bathRotation - ROTATION_STEP}))} className="flex-1 py-3 bg-slate-100 rounded-xl font-black uppercase text-[10px]"><i className="fas fa-undo mr-2"></i> -10°</button>
                    <button onClick={() => setHouse(p => ({...p, bathRotation: p.bathRotation + ROTATION_STEP}))} className="flex-1 py-3 bg-slate-100 rounded-xl font-black uppercase text-[10px]"><i className="fas fa-redo mr-2"></i> +10°</button>
                  </div>
                </ToggleObject>
                <ToggleObject isMobileExpanded={isMobileExpanded} isFocused={selectedObjectId === 'bbq'} label={t.bbq} active={house.hasBBQ} onToggle={(v: boolean) => setHouse(p => ({...p, hasBBQ: v, bbqWidth: v ? 3 * scaleFactor : p.bbqWidth, bbqDepth: v ? 4 * scaleFactor : p.bbqDepth}))}>
                  <Slider label={t.width} value={house.bbqWidth} min={2} max={8} onChange={(v: number) => setHouse(p => ({...p, bbqWidth: v}))} />
                  <Slider label={t.depth} value={house.bbqDepth} min={2} max={8} onChange={(v: number) => setHouse(p => ({...p, bbqDepth: v}))} />
                  <div className="flex gap-2">
                    <button onClick={() => setHouse(p => ({...p, bbqRotation: p.bbqRotation - ROTATION_STEP}))} className="flex-1 py-3 bg-slate-100 rounded-xl font-black uppercase text-[10px]"><i className="fas fa-undo mr-2"></i> -10°</button>
                    <button onClick={() => setHouse(p => ({...p, bbqRotation: p.bbqRotation + ROTATION_STEP}))} className="flex-1 py-3 bg-slate-100 rounded-xl font-black uppercase text-[10px]"><i className="fas fa-redo mr-2"></i> +10°</button>
                  </div>
                </ToggleObject>
                <ToggleObject isMobileExpanded={isMobileExpanded} isFocused={selectedObjectId === 'customObj'} label={t.hozblock} active={house.hasCustomObj} onToggle={(v: boolean) => setHouse(p => ({...p, hasCustomObj: v, customObjWidth: v ? 3 * scaleFactor : p.customObjWidth, customObjDepth: v ? 4 * scaleFactor : p.customObjDepth}))}>
                  <Slider label={t.width} value={house.customObjWidth} min={2} max={10} onChange={(v: number) => setHouse(p => ({...p, customObjWidth: v}))} />
                  <Slider label={t.depth} value={house.customObjDepth} min={2} max={10} onChange={(v: number) => setHouse(p => ({...p, customObjDepth: v}))} />
                  <div className="flex gap-2">
                    <button onClick={() => setHouse(p => ({...p, customObjRotation: p.customObjRotation - ROTATION_STEP}))} className="flex-1 py-3 bg-slate-100 rounded-xl font-black uppercase text-[10px]"><i className="fas fa-undo mr-2"></i> -10°</button>
                    <button onClick={() => setHouse(p => ({...p, customObjRotation: p.customObjRotation + ROTATION_STEP}))} className="flex-1 py-3 bg-slate-100 rounded-xl font-black uppercase text-[10px]"><i className="fas fa-redo mr-2"></i> +10°</button>
                  </div>
                </ToggleObject>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-3 lg:space-y-4 animate-in fade-in duration-500">
                <ToggleObject isMobileExpanded={isMobileExpanded} isFocused={selectedObjectId === 'garage'} label={t.garage} active={house.hasGarage} onToggle={(v: boolean) => setHouse(p => ({...p, hasGarage: v}))}>
                  <div className="flex gap-1.5 lg:gap-2 mb-2 lg:mb-4">
                    {[1, 2, 3].map(n => (
                      <button 
                        key={n} 
                        onClick={() => setHouse(p => ({
                          ...p, 
                          garageCars: n,
                          garageWidth: n === 1 ? 4.5 : (n === 2 ? 7.5 : 10.5),
                          garageDepth: 6.5
                        }))} 
                        className={`flex-1 py-2 lg:py-4 rounded-lg lg:rounded-xl text-[10px] lg:text-[12px] font-black uppercase ${house.garageCars === n ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-400'}`}
                      >
                        {n} {n === 1 ? 'машина' : (n < 5 ? 'машины' : 'машин')}
                      </button>
                    ))}
                  </div>
                  {/* Stepped rotation */}
                  <div className="flex gap-2">
                    <button onClick={() => setHouse(p => ({...p, garageRotation: p.garageRotation - ROTATION_STEP}))} className="flex-1 py-2 lg:py-3 bg-slate-100 rounded-lg lg:rounded-xl font-black uppercase text-[9px] lg:text-[10px]"><i className="fas fa-undo mr-1 lg:mr-2"></i> -10°</button>
                    <button onClick={() => setHouse(p => ({...p, garageRotation: p.garageRotation + ROTATION_STEP}))} className="flex-1 py-2 lg:py-3 bg-slate-100 rounded-lg lg:rounded-xl font-black uppercase text-[9px] lg:text-[10px]"><i className="fas fa-redo mr-1 lg:mr-2"></i> +10°</button>
                  </div>
                </ToggleObject>
                <ToggleObject isMobileExpanded={isMobileExpanded} isFocused={selectedObjectId === 'carport'} label={t.carport} active={house.hasCarport} onToggle={(v: boolean) => setHouse(p => ({...p, hasCarport: v}))}>
                  <div className="flex gap-1.5 lg:gap-2 mb-2 lg:mb-4">
                    {[1, 2, 3].map(n => (
                      <button 
                        key={n} 
                        onClick={() => setHouse(p => ({
                          ...p, 
                          carportCars: n,
                          carportWidth: n === 1 ? 4 : (n === 2 ? 7 : 10),
                          carportDepth: 6.0
                        }))} 
                        className={`flex-1 py-2 lg:py-4 rounded-lg lg:rounded-xl text-[10px] lg:text-[12px] font-black uppercase ${house.carportCars === n ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-400'}`}
                      >
                        {n} {n === 1 ? 'машина' : (n < 5 ? 'машины' : 'машин')}
                      </button>
                    ))}
                  </div>
                  {/* Stepped rotation */}
                  <div className="flex gap-2">
                    <button onClick={() => setHouse(p => ({...p, carportRotation: p.carportRotation - ROTATION_STEP}))} className="flex-1 py-2 lg:py-3 bg-slate-100 rounded-lg lg:rounded-xl font-black uppercase text-[9px] lg:text-[10px]"><i className="fas fa-undo mr-1 lg:mr-2"></i> -10°</button>
                    <button onClick={() => setHouse(p => ({...p, carportRotation: p.carportRotation + ROTATION_STEP}))} className="flex-1 py-2 lg:py-3 bg-slate-100 rounded-lg lg:rounded-xl font-black uppercase text-[9px] lg:text-[10px]"><i className="fas fa-redo mr-1 lg:mr-2"></i> +10°</button>
                  </div>
                </ToggleObject>
              </div>
            )}

            {currentStep === 5 && (
              <div className="space-y-4 lg:space-y-6 animate-in fade-in duration-500 pb-6 lg:pb-10">
                <div className="bg-white rounded-[24px] lg:rounded-[32px] p-4 lg:p-6 border shadow-lg space-y-3 lg:space-y-4">
                  <h4 className="text-[9px] lg:text-[11px] font-black uppercase text-slate-400 tracking-widest">ФАЙЛЫ И ПОЖЕЛАНИЯ</h4>
                  <textarea value={house.extraWishes} onChange={e => setHouse(p => ({...p, extraWishes: e.target.value}))} className="w-full bg-slate-50 border border-slate-100 rounded-xl lg:rounded-2xl px-3 lg:px-4 py-2 lg:py-3 text-[12px] lg:text-[14px] font-bold min-h-[80px] lg:min-h-[120px]" placeholder="Дополнительные пожелания..." />
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-3">
                    <label className="py-3 lg:py-4 bg-slate-100 text-slate-900 rounded-xl lg:rounded-2xl font-black uppercase text-[10px] lg:text-[11px] flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-200 transition-all lg:col-span-2">
                      <i className="fas fa-upload text-[12px] lg:text-base"></i>
                      ЗАГРУЗИТЬ СВОИ ФАЙЛЫ
                      <input 
                        type="file" 
                        multiple 
                        className="hidden" 
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          files.forEach(file => {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const data = ev.target?.result as string;
                              setHouse(prev => ({
                                ...prev,
                                projectFiles: [...prev.projectFiles, { name: file.name, type: file.type, data }]
                              }));
                            };
                            reader.readAsDataURL(file);
                          });
                        }} 
                      />
                    </label>
                  </div>

                  {house.projectFiles.length > 0 && (
                    <div className="pt-2 space-y-1">
                      <p className="text-[8px] font-black text-slate-400 uppercase">Загруженные файлы ({house.projectFiles.length})</p>
                      <div className="flex flex-wrap gap-1">
                        {house.projectFiles.map((f, i) => (
                          <div key={i} className="bg-slate-50 px-2 py-1 rounded-md text-[9px] font-bold flex items-center gap-1 border border-slate-100">
                            <span className="truncate max-w-[100px]">{f.name}</span>
                            <button onClick={() => setHouse(prev => ({ ...prev, projectFiles: prev.projectFiles.filter((_, idx) => idx !== i) }))} className="text-slate-300 hover:text-red-500"><i className="fas fa-times"></i></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="bg-white rounded-[24px] lg:rounded-[32px] p-4 lg:p-6 border shadow-lg space-y-3 lg:space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] lg:text-[12px] font-black text-[#ff5f1f] uppercase tracking-widest">для получение расчетов напиши сою почту и нажми скачать проект</p>
                  </div>
                  <input 
                    type="email" 
                    value={house.userEmail} 
                    onChange={e => setHouse(p => ({...p, userEmail: e.target.value}))} 
                    className={`w-full bg-slate-50 border rounded-lg lg:rounded-xl px-3 lg:px-4 py-3 lg:py-4 text-[14px] lg:text-[16px] font-bold outline-none transition-all ${house.userEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(house.userEmail) ? 'border-red-300 bg-red-50' : 'border-slate-100 focus:border-[#ff5f1f]'}`} 
                    placeholder="Ваш Email..." 
                  />
                  <div className="space-y-3">
                    <button 
                      onClick={() => { handleDownloadPassport(); if(house.userEmail) handleOrderSilent(); }} 
                      disabled={!house.userEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(house.userEmail) || !hasUnsavedChanges}
                      className="w-full py-3 lg:py-4 bg-[#0f172a] text-white rounded-xl lg:rounded-2xl font-black uppercase text-[10px] lg:text-[11px] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <i className={`fas ${isDownloadingPassport ? 'fa-spinner fa-spin' : 'fa-file-pdf'} text-[12px] lg:text-base`}></i>ПАСПОРТ PDF
                    </button>
                    <button 
                      onClick={() => { handleDownloadCalculation(); if(house.userEmail) handleOrderSilent(); }} 
                      disabled={!house.userEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(house.userEmail) || !hasUnsavedChanges}
                      className="w-full py-3 lg:py-4 bg-[#ff5f1f] text-white rounded-xl lg:rounded-2xl font-black uppercase text-[10px] lg:text-[11px] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <i className={`fas ${isDownloadingCalc ? 'fa-spinner fa-spin' : 'fa-file-invoice-dollar'} text-[12px] lg:text-base`}></i>Стоимость проектирования
                    </button>
                    <button 
                      onClick={() => { handleDownloadEstimate(); if(house.userEmail) handleOrderSilent(); }} 
                      disabled={!house.userEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(house.userEmail) || !hasUnsavedChanges}
                      className="w-full py-3 lg:py-4 bg-slate-100 text-slate-900 rounded-xl lg:rounded-2xl font-black uppercase text-[10px] lg:text-[11px] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <i className={`fas ${isDownloadingEstimate ? 'fa-spinner fa-spin' : 'fa-file-invoice'} text-[12px] lg:text-base`}></i>Стоимость строительства
                    </button>
                  </div>
                  {orderError && (
                    <p className="text-[10px] lg:text-[12px] font-bold text-red-500 text-center">{orderError}</p>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex flex-row gap-3 shrink-0 pt-4 border-t border-slate-100">
             {currentStep < 5 && (
               <>
                 <button onClick={handleContinue} className={`hidden lg:flex flex-[2] py-6 bg-[#0f172a] text-white rounded-[32px] text-[12px] font-black uppercase items-center justify-center gap-3 active:scale-95 shadow-xl transition-all ${currentStep === 4 || isNextStepFlashing ? 'animate-pulse-orange ring-4 ring-[#ff5f1f]' : ''}`}>ДАЛЕЕ <i className="fas fa-chevron-right text-[10px]"></i></button>
                 <button onClick={() => setIsMobileExpanded(false)} className={`lg:hidden flex-[2] py-6 bg-[#0f172a] text-white rounded-[32px] text-[12px] font-black uppercase items-center justify-center active:scale-95 shadow-xl transition-all ${isNextStepFlashing ? 'animate-pulse-orange ring-2 ring-[#ff5f1f]' : ''}`}>ПРИМЕНИТЬ</button>
               </>
             )}
             {currentStep === 5 && <button onClick={() => setIsMobileExpanded(false)} className="flex-1 py-6 bg-[#ff5f1f] text-white rounded-[32px] text-[12px] font-black uppercase flex items-center justify-center active:scale-95 shadow-xl">ВЕРНУТЬСЯ В 3D</button>}
          </div>
        </div>
      </div>

      {/* Hidden Estimate View for PDF generation */}
      <div className="fixed -left-[15000px] top-0 pointer-events-none">
        <EstimateView house={house} estimateHtml={estimateHtml} />
      </div>
    </>
  );
};
export default Controls;
