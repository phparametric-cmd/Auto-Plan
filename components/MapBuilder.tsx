
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { HouseState, PlotCorners, Point2D } from '../types';
import { getTranslation } from '../services/i18n';
import html2canvas from 'html2canvas';

interface MapBuilderProps {
  house: HouseState;
  onConfirm: (corners: PlotCorners, center: { lat: number, lng: number }, heading: number, snapshotUrl?: string, snapshotBounds?: { width: number, height: number }) => void;
  onCancel: () => void;
}

declare const L: any;
declare const GeoSearch: any;

const MapBuilder: React.FC<MapBuilderProps> = ({ house, onConfirm, onCancel }) => {
  const t = getTranslation(house.lang);
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletInstance = useRef<any>(null);
  const polygonInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const searchProviderRef = useRef<any>(null);

  const [heading, setHeading] = useState(house.mapHeading || 0);
  const [plotArea, setPlotArea] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentMapCenter, setCurrentMapCenter] = useState<{lat: number, lng: number} | null>(null);

  const calculateGeodesicArea = (latlngs: any[]) => {
    if (!latlngs || latlngs.length < 3) return 0;
    try {
      if (L.GeometryUtil && typeof L.GeometryUtil.geodesicArea === 'function') {
        return L.GeometryUtil.geodesicArea(latlngs);
      }
      let area = 0;
      const R = 6371000;
      for (let i = 0; i < latlngs.length; i++) {
        const p1 = latlngs[i];
        const p2 = latlngs[(i + 1) % latlngs.length];
        area += (p2.lng - p1.lng) * (2 + Math.sin(p1.lat * Math.PI / 180) + Math.sin(p2.lat * Math.PI / 180));
      }
      area = area * R * R / 2.0;
      return Math.abs(area * Math.PI / 180);
    } catch (e) {
      console.error("Area calculation error", e);
      return 0;
    }
  };

  const updateMeasurements = useCallback(() => {
    if (!leafletInstance.current || !polygonInstance.current) return;
    const map = leafletInstance.current;
    const poly = polygonInstance.current;
    
    let latlngs = poly.getLatLngs();
    if (Array.isArray(latlngs[0])) latlngs = latlngs[0];

    const area = calculateGeodesicArea(latlngs);
    setPlotArea(area);

    // Clear old distance markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Draw side length labels - Icon size reduced 3x (from 120x60 to 40x20)
    const center = poly.getBounds().getCenter();
    const centerPt = map.latLngToLayerPoint(center);

    for (let i = 0; i < latlngs.length; i++) {
      const p1 = latlngs[i];
      const p2 = latlngs[(i + 1) % latlngs.length];
      const distance = map.distance(p1, p2);
      const midPoint = [(p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2];

      const midPt = map.latLngToLayerPoint(L.latLng(midPoint[0], midPoint[1]));
      const cx = midPt.x - centerPt.x;
      const cy = midPt.y - centerPt.y;
      const clen = Math.sqrt(cx * cx + cy * cy) || 1;
      const offsetPt = L.point(midPt.x + (cx / clen) * 25, midPt.y + (cy / clen) * 25);
      const offsetLatLng = map.layerPointToLatLng(offsetPt);

      const label = L.marker(offsetLatLng, {
        icon: L.divIcon({
          className: 'measurement-label',
          html: `<span>${distance.toFixed(1)}m</span>`,
          iconSize: [40, 20],
          iconAnchor: [20, 10]
        }),
        interactive: false
      }).addTo(map);
      markersRef.current.push(label);
    }
  }, []);

  const refreshGeoman = useCallback(() => {
    if (!polygonInstance.current) return;
    polygonInstance.current.pm.disable();
    polygonInstance.current.pm.enable({
      allowSelfIntersection: false,
      draggable: true,
      snappable: true,
      snapDistance: 30,
      allowEditing: true,
      allowRemoval: true,
      markerStyle: {
        radius: 10,
        weight: 15,
        color: 'rgba(255, 95, 31, 0.3)',
        fillColor: '#ff5f1f',
        fillOpacity: 1
      }
    });
  }, []);

  const repositionPolygon = useCallback((center: { lat: number, lng: number }) => {
    if (!polygonInstance.current) return;
    const w = house.plotWidth;
    const l = house.plotLength;
    const latOffset = (l / 111320) / 2;
    const lngOffset = (w / (111320 * Math.cos(center.lat * Math.PI / 180))) / 2;

    const coords = [
      [center.lat + latOffset, center.lng - lngOffset],
      [center.lat + latOffset, center.lng + lngOffset],
      [center.lat - latOffset, center.lng + lngOffset],
      [center.lat - latOffset, center.lng - lngOffset]
    ];

    polygonInstance.current.setLatLngs(coords);
    refreshGeoman();
    updateMeasurements();
  }, [house.plotWidth, house.plotLength, updateMeasurements, refreshGeoman]);

  useEffect(() => {
    if (!mapRef.current || leafletInstance.current) return;

    const initialPos: [number, number] = house.mapCenter 
      ? [house.mapCenter.lat, house.mapCenter.lng] 
      : [43.238, 76.889];

    const map = L.map(mapRef.current, {
      center: initialPos,
      zoom: 19,
      zoomControl: false,
      attributionControl: false
    });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 20,
      crossOrigin: 'anonymous' 
    }).addTo(map);

    leafletInstance.current = map;
    setCurrentMapCenter(map.getCenter());
    searchProviderRef.current = new GeoSearch.OpenStreetMapProvider();

    map.on('move', () => {
      setCurrentMapCenter(map.getCenter());
    });

    const latOffset = (house.plotLength / 111320) / 2;
    const lngOffset = (house.plotWidth / (111320 * Math.cos(initialPos[0] * Math.PI / 180))) / 2;
    
    let initialLatLngs;
    if (house.plotCorners && house.plotCorners.vertices && house.mapCenter) {
      // Restore from saved vertices
      const centerPoint = map.project(initialPos, map.getZoom());
      const p1 = map.getCenter();
      const p2 = map.unproject(map.project(p1).add(L.point(1, 0)));
      const metersPerPixel = map.distance(p1, p2);
      
      initialLatLngs = house.plotCorners.vertices.map(v => {
        const dx = v.x / metersPerPixel;
        const dy = v.z / metersPerPixel;
        const point = L.point(centerPoint.x + dx, centerPoint.y + dy);
        return map.unproject(point, map.getZoom());
      });
    } else {
      initialLatLngs = [
        [initialPos[0] + latOffset, initialPos[1] - lngOffset],
        [initialPos[0] + latOffset, initialPos[1] + lngOffset],
        [initialPos[0] - latOffset, initialPos[1] + lngOffset],
        [initialPos[0] - latOffset, initialPos[1] - lngOffset]
      ];
    }
    
    const poly = L.polygon(initialLatLngs, {
      color: '#FFFB00',
      weight: 6,
      fillColor: '#FFFB00',
      fillOpacity: 0.15
    }).addTo(map);

    polygonInstance.current = poly;

    poly.pm.enable({
      allowSelfIntersection: false,
      draggable: true,
      snappable: true,
      snapDistance: 30,
      allowEditing: true,
      allowRemoval: true,
      markerStyle: {
        radius: 10,
        weight: 15,
        color: 'rgba(255, 95, 31, 0.3)',
        fillColor: '#ff5f1f',
        fillOpacity: 1
      }
    });

    poly.on('pm:edit pm:dragend pm:vertexadded pm:vertexremoved pm:markerdragend pm:markerdrag', () => {
      updateMeasurements();
    });

    setTimeout(updateMeasurements, 100);

    return () => {
      map.remove();
      leafletInstance.current = null;
    };
  }, []);

  const handlePlaceAtCenter = () => {
    if (!leafletInstance.current) return;
    repositionPolygon(leafletInstance.current.getCenter());
  };

  const handleConfirm = async () => {
    if (!polygonInstance.current || !leafletInstance.current || !mapRef.current) return;
    setIsProcessing(true);

    const map = leafletInstance.current;
    const poly = polygonInstance.current;

    // 0. Center map on polygon bounds
    map.panTo(poly.getBounds().getCenter(), { animate: false });

    // 1. Hide border and fill for capture
    poly.setStyle({ opacity: 0, fillOpacity: 0 });

    // 2. Add temporary vertex markers (points)
    let currentLatLngs = poly.getLatLngs();
    if (Array.isArray(currentLatLngs[0])) currentLatLngs = currentLatLngs[0];
    
    const vertexMarkers = currentLatLngs.map((ll: any) => {
      return L.circleMarker(ll, {
        radius: 4,
        fillColor: '#FFFB00',
        color: '#000',
        weight: 1,
        opacity: 1,
        fillOpacity: 1,
        interactive: false
      }).addTo(map);
    });

    // Give a moment for markers to settle if any movement just happened
    await new Promise(resolve => setTimeout(resolve, 300));

    let snapshotUrl = undefined;
    try {
      // Capture the map with all labels using html2canvas
      const canvas = await html2canvas(mapRef.current, {
        useCORS: true,
        logging: false,
        backgroundColor: '#0f172a',
        scale: 1.5,
        ignoreElements: (el) => {
           return el.classList.contains('leaflet-control-container') || 
                  el.classList.contains('pm-marker-list') ||
                  el.tagName === 'FORM';
        }
      });
      snapshotUrl = canvas.toDataURL('image/jpeg', 0.9);
    } catch (e) {
      console.warn("Snapshot capture failed", e);
    }

    // 3. Restore polygon style and remove temp markers
    vertexMarkers.forEach((m: any) => m.remove());
    poly.setStyle({ opacity: 1, fillOpacity: 0.15 });

    const center = map.getCenter();
    const size = map.getSize();
    let latlngs = poly.getLatLngs();
    if (Array.isArray(latlngs[0])) latlngs = latlngs[0];

    // More accurate meters per pixel calculation
    const p1 = map.getCenter();
    const p2 = map.unproject(map.project(p1).add(L.point(1, 0)));
    const metersPerPixel = map.distance(p1, p2);

    const snapshotBounds = {
      width: size.x * metersPerPixel,
      height: size.y * metersPerPixel
    };

    const centerPoint = map.project(center, map.getZoom());

    const getLocalPos = (latlng: any): Point2D => {
      const point = map.project(latlng, map.getZoom());
      const dx = (point.x - centerPoint.x) * metersPerPixel;
      const dy = (point.y - centerPoint.y) * metersPerPixel;
      return { x: dx, z: dy };
    };

    const vertices = latlngs.map((ll: any) => getLocalPos(ll));

    const corners: PlotCorners = {
      nw: vertices[0],
      ne: vertices[1] || vertices[0],
      se: vertices[2] || vertices[0],
      sw: vertices[3] || vertices[0],
      vertices: vertices
    };

    onConfirm(corners, { lat: center.lat, lng: center.lng }, heading, snapshotUrl, snapshotBounds);
    setIsProcessing(false);
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900 flex flex-col font-sans overflow-hidden">
      <div className="absolute top-4 left-4 right-4 lg:left-6 lg:w-80 z-[1010] space-y-3">
        {/* Search Bar */}
        <form onSubmit={async (e) => { e.preventDefault(); const res = await searchProviderRef.current.search({ query: searchQuery }); if (res?.length) setSearchResults(res); }} 
              className="bg-white/95 backdrop-blur-xl p-2 rounded-full shadow-2xl border border-white/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
            <i className="fas fa-search text-slate-400 text-sm"></i>
          </div>
          <input 
            type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск адреса..." 
            className="flex-1 bg-transparent border-none outline-none font-bold text-slate-900 text-sm py-1"
          />
        </form>

        {/* Plot Area Statistics Display - Size and fonts reduced 3x as requested */}
        <div className="bg-white/95 backdrop-blur-xl p-1.5 rounded-xl shadow-2xl border border-white/20 flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-500 w-fit mx-auto">
          <div className="text-[6px] font-black text-slate-400 uppercase tracking-[0.1em] mb-0.5">ОБЩАЯ ПЛОЩАДЬ</div>
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] font-black text-slate-900">{(plotArea / 100).toFixed(1)}</span>
            <span className="text-[6px] font-black text-[#ff5f1f] uppercase tracking-wider">СОТОК</span>
          </div>
          <div className="text-[7px] font-black text-slate-300 mt-0.5">{Math.round(plotArea)} <span className="text-[6px]">М²</span></div>
        </div>

        {searchResults.length > 0 && (
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2">
            {searchResults.map((res: any, i: number) => (
              <button key={i} onClick={() => { 
                leafletInstance.current.flyTo({ lat: res.y, lng: res.x }, 19); 
                setSearchResults([]); 
                setSearchQuery('');
                setTimeout(() => repositionPolygon({ lat: res.y, lng: res.x }), 1500);
              }}
              className="w-full px-5 py-4 text-left hover:bg-slate-50 border-b border-slate-50 last:border-none flex items-center gap-4 transition-colors">
                <i className="fas fa-map-marker-alt text-[#ff5f1f] text-xs"></i>
                <span className="text-[12px] font-bold text-slate-900 line-clamp-1">{res.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 w-full h-full relative overflow-hidden bg-slate-950">
        <div id="leaflet-container-wrapper" style={{ transform: `rotate(${heading}deg)` }} className="w-full h-full">
          <div ref={mapRef} className="w-full h-full" />
        </div>
        
        {/* Visual crosshair at center */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-[1005]">
          <div className="relative w-12 h-12 flex items-center justify-center">
            <div className="absolute w-px h-full bg-white/30" />
            <div className="absolute w-full h-px bg-white/30" />
            <div className="w-2 h-2 rounded-full bg-[#ff5f1f] shadow-[0_0_12px_#ff5f1f]" />
          </div>
        </div>

        {/* Hint Box */}
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[1006] w-[90%] max-w-md pointer-events-none">
          <div className="bg-slate-900/80 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-2xl text-center">
            <p className="text-[10px] lg:text-xs font-medium text-white/90 leading-relaxed">
              <span className="text-[#ff5f1f] font-bold">Подсказка:</span> Нажмите на кнопку прицела справа, чтобы сместить участок в центр экрана. Вы можете изменять форму участка, перетаскивая точки на углах и по середине жёлтых линий.
            </p>
          </div>
        </div>

        <div className="absolute right-4 lg:right-6 top-1/2 -translate-y-1/2 z-[1006] flex flex-col gap-4">
          <button onClick={handlePlaceAtCenter} title="Центрировать участок"
            className="pointer-events-auto w-14 h-14 rounded-full bg-white text-[#ff5f1f] shadow-2xl flex items-center justify-center border border-slate-100 active:scale-90 transition-all hover:scale-110 animate-pulse-orange ring-2 ring-orange-100">
            <i className="fas fa-bullseye text-xl"></i>
          </button>
          
          <div className="bg-white/95 backdrop-blur-xl p-2 rounded-3xl shadow-2xl border border-slate-100 flex flex-col items-center gap-3">
             <button onClick={() => setHeading(h => h - 10)} className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center hover:text-[#ff5f1f] active:scale-90 transition-all pointer-events-auto">
                <i className="fas fa-undo"></i>
             </button>
             <span className="text-[10px] font-black text-slate-900">{heading}°</span>
             <button onClick={() => setHeading(h => h + 10)} className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center hover:text-[#ff5f1f] active:scale-90 transition-all pointer-events-auto">
                <i className="fas fa-redo"></i>
             </button>
          </div>
        </div>
        
        {/* Coordinate Overlay for capture */}
        <div className="absolute bottom-4 left-4 z-[1007] bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-white text-[11px] font-black font-mono shadow-2xl">
          {currentMapCenter ? `${currentMapCenter.lat.toFixed(6)}, ${currentMapCenter.lng.toFixed(6)}` : ''}
        </div>
      </div>

      <div className="absolute bottom-8 left-6 right-6 flex justify-between items-center pointer-events-none z-[1002]">
         <button onClick={onCancel} className="pointer-events-auto bg-white/95 backdrop-blur-xl text-slate-900 px-8 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl active:scale-95 transition-all hover:bg-slate-50">
           Отмена
         </button>
         
         <div className="bg-slate-900/60 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest hidden lg:block">
           <i className="fas fa-mouse-pointer text-[#ff5f1f] mr-2"></i> Тяните за края участка для изменения формы
         </div>
         
         <button onClick={handleConfirm} disabled={isProcessing}
           className="pointer-events-auto bg-[#ff5f1f] text-white px-10 py-5 rounded-2xl font-black uppercase text-[13px] tracking-widest shadow-2xl active:scale-95 disabled:opacity-50 flex items-center gap-3 transition-all">
           {isProcessing ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-check"></i>}
           Готово
         </button>
      </div>
    </div>
  );
};

export default MapBuilder;
