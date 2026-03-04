import { HouseState } from '../types';

export const applyZoneRules = (house: HouseState): HouseState => {
  let { plotWidth, plotLength, gateSideIndex, gatePosX, plotCorners } = house;
  
  if (plotCorners && plotCorners.vertices && plotCorners.vertices.length > 0) {
    const xs = plotCorners.vertices.map(v => v.x);
    const zs = plotCorners.vertices.map(v => v.z);
    plotWidth = Math.max(...xs) - Math.min(...xs);
    plotLength = Math.max(...zs) - Math.min(...zs);
  }
  
  let layoutDepth = (gateSideIndex === 0 || gateSideIndex === 2) ? plotLength : plotWidth;
  let layoutWidth = (gateSideIndex === 0 || gateSideIndex === 2) ? plotWidth : plotLength;
  
  let frontZ = layoutDepth / 2;
  let backZ = -layoutDepth / 2;
  let leftX = -layoutWidth / 2;
  let rightX = layoutWidth / 2;
  
  let gX = (gatePosX - 0.5) * layoutWidth;
  
  // Compression factor for small plots
  const isSmall = layoutDepth < 30;
  const gap = isSmall ? 1 : 3;
  const poolGap = isSmall ? 3 : 5;
  
  let area = 0;
  if (plotCorners && plotCorners.vertices && plotCorners.vertices.length > 2) {
    const v = plotCorners.vertices;
    for (let i = 0; i < v.length; i++) {
      const j = (i + 1) % v.length;
      area += v[i].x * v[j].z;
      area -= v[j].x * v[i].z;
    }
  } else {
    area = plotWidth * plotLength;
  }
  const isSmallPlot = Math.abs(area) / 200 < 8;

  // 1. Transport: Close to gate.
  let garageWidth = (house.garageCars === 1 ? 4.5 : (house.garageCars === 2 ? 7.5 : 10.5)) * (isSmallPlot ? 0.5 : 1);
  let garageDepth = isSmallPlot ? 3.25 : 6.5;
  let carportWidth = (house.carportCars === 1 ? 4 : (house.carportCars === 2 ? 7 : 10)) * (isSmallPlot ? 0.5 : 1);
  let carportDepth = isSmallPlot ? 3 : 6;

  let garageZ = frontZ - garageDepth / 2 - gap;
  let garageX = gX + 3 + garageWidth / 2;
  if (garageX + garageWidth/2 > rightX) garageX = gX - 3 - garageWidth/2;
  
  let carportZ = frontZ - carportDepth / 2 - gap;
  let carportX = gX - 3 - carportWidth / 2;
  if (carportX - carportWidth/2 < leftX) carportX = gX + 3 + carportWidth/2;

  if (house.hasGarage && house.hasCarport) {
    if (Math.abs(garageX - carportX) < (garageWidth + carportWidth) / 2) {
      if (garageX > carportX) {
        garageX = carportX + carportWidth/2 + garageWidth/2 + 1;
      } else {
        carportX = garageX + garageWidth/2 + carportWidth/2 + 1;
      }
    }
  }

  // 2. House: Center, but closer to front, avoiding transport.
  let maxHz = frontZ - Math.max(house.hasGarage ? garageDepth : 0, house.hasCarport ? carportDepth : 0) - gap * 2 - house.houseLength / 2;
  let hZ = Math.min(layoutDepth / 6, maxHz);
  let hX = 0;
  
  // 3. Leisure: Behind house
  let terraceZ = hZ - house.houseLength / 2 - house.terraceDepth / 2;
  let terraceX = hX;
  
  let poolZ = terraceZ - house.terraceDepth / 2 - poolGap - house.poolDepth / 2;
  let poolX = hX;
  
  // 4. Bath and BBQ: Far corners
  let bathZ = backZ + house.bathDepth / 2 + gap;
  let bathX = leftX + house.bathWidth / 2 + gap;
  
  let bbqZ = backZ + house.bbqDepth / 2 + gap;
  let bbqX = rightX - house.bbqWidth / 2 - gap;
  
  // 5. Hozblock: Next to bath
  let customObjZ = backZ + house.customObjDepth / 2 + gap;
  let customObjX = bathX + house.bathWidth / 2 + house.customObjWidth / 2 + gap;

  // Prevent pool from overlapping with back objects
  let minPoolZ = backZ + Math.max(house.hasBath ? house.bathDepth : 0, house.hasBBQ ? house.bbqDepth : 0) + gap * 2 + house.poolDepth / 2;
  if (poolZ < minPoolZ) {
    poolZ = minPoolZ;
  }
  
  const mapCoords = (lx: number, lz: number) => {
    if (gateSideIndex === 0) return { x: -lx, z: -lz, rot: Math.PI };
    if (gateSideIndex === 1) return { x: lz, z: -lx, rot: Math.PI/2 };
    if (gateSideIndex === 2) return { x: lx, z: lz, rot: 0 };
    if (gateSideIndex === 3) return { x: -lz, z: lx, rot: -Math.PI/2 };
    return { x: lx, z: lz, rot: 0 };
  };
  
  const hPos = mapCoords(hX, hZ);
  const garagePos = mapCoords(garageX, garageZ);
  const carportPos = mapCoords(carportX, carportZ);
  const terracePos = mapCoords(terraceX, terraceZ);
  const poolPos = mapCoords(poolX, poolZ);
  const bathPos = mapCoords(bathX, bathZ);
  const bbqPos = mapCoords(bbqX, bbqZ);
  const customObjPos = mapCoords(customObjX, customObjZ);
  
  return {
    ...house,
    housePosX: hPos.x, housePosZ: hPos.z, houseRotation: hPos.rot,
    garagePosX: garagePos.x, garagePosZ: garagePos.z, garageRotation: garagePos.rot,
    carportPosX: carportPos.x, carportPosZ: carportPos.z, carportRotation: carportPos.rot,
    terracePosX: terracePos.x, terracePosZ: terracePos.z, terraceRotation: terracePos.rot,
    poolPosX: poolPos.x, poolPosZ: poolPos.z, poolRotation: poolPos.rot,
    bathPosX: bathPos.x, bathPosZ: bathPos.z, bathRotation: bathPos.rot,
    bbqPosX: bbqPos.x, bbqPosZ: bbqPos.z, bbqRotation: bbqPos.rot,
    customObjPosX: customObjPos.x, customObjPosZ: customObjPos.z, customObjRotation: customObjPos.rot,
  };
};
