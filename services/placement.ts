import { HouseState } from '../types';

export const getGatePositionAndRotation = (house: HouseState, objWidth: number, objDepth: number, isLeft: boolean = false) => {
  const vertices = house.plotCorners?.vertices || [];
  if (vertices.length < 3) return { x: 0, z: 0, rotation: 0 };
  
  const gateIdx = house.gateSideIndex || 0;
  const p1 = vertices[gateIdx % vertices.length];
  const p2 = vertices[(gateIdx + 1) % vertices.length];
  const gatePosX = house.gatePosX || 0.5;
  
  const gx = p1.x + (p2.x - p1.x) * gatePosX;
  const gz = p1.z + (p2.z - p1.z) * gatePosX;
  
  const edgeAngle = Math.atan2(p2.z - p1.z, p2.x - p1.x);
  const inwardAngle = edgeAngle + Math.PI / 2;
  
  const inwardDist = objDepth / 2 + 1;
  const gateWidth = 4; // Approximate gate width
  
  // Place near the gate on opposite sides
  let x, z;
  if (isLeft) {
    // Place to the left of the gate
    x = gx + Math.cos(inwardAngle) * inwardDist - Math.cos(edgeAngle) * (gateWidth / 2 + objWidth / 2 + 1);
    z = gz + Math.sin(inwardAngle) * inwardDist - Math.sin(edgeAngle) * (gateWidth / 2 + objWidth / 2 + 1);
  } else {
    // Place to the right of the gate
    x = gx + Math.cos(inwardAngle) * inwardDist + Math.cos(edgeAngle) * (gateWidth / 2 + objWidth / 2 + 1);
    z = gz + Math.sin(inwardAngle) * inwardDist + Math.sin(edgeAngle) * (gateWidth / 2 + objWidth / 2 + 1);
  }
  
  // Clamp to plot bounds roughly
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  vertices.forEach(v => {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.z < minZ) minZ = v.z;
    if (v.z > maxZ) maxZ = v.z;
  });
  
  x = Math.max(minX + objWidth/2, Math.min(maxX - objWidth/2, x));
  z = Math.max(minZ + objDepth/2, Math.min(maxZ - objDepth/2, z));
  
  return { x, z, rotation: edgeAngle };
};

export const getSmartPosition = (house: HouseState, objType: 'pool' | 'bath' | 'bbq' | 'customObj', objWidth: number, objDepth: number) => {
  const vertices = house.plotCorners?.vertices || [];
  if (vertices.length < 3) return { x: 0, z: 0, rotation: 0 };
  
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  vertices.forEach(v => {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.z < minZ) minZ = v.z;
    if (v.z > maxZ) maxZ = v.z;
  });
  
  const gateIdx = house.gateSideIndex || 0;
  const p1 = vertices[gateIdx % vertices.length];
  const p2 = vertices[(gateIdx + 1) % vertices.length];
  const gx = p1.x + (p2.x - p1.x) * (house.gatePosX || 0.5);
  const gz = p1.z + (p2.z - p1.z) * (house.gatePosX || 0.5);
  
  const isGateSouth = gz > (minZ + maxZ) / 2;
  const isGateEast = gx > (minX + maxX) / 2;
  
  let x = 0, z = 0, rotation = 0;
  
  const backZ = isGateSouth ? minZ + objDepth/2 + 1.5 : maxZ - objDepth/2 - 1.5;
  const frontZ = isGateSouth ? maxZ - objDepth/2 - 1.5 : minZ + objDepth/2 + 1.5;
  const leftX = minX + objWidth/2 + 1.5;
  const rightX = maxX - objWidth/2 - 1.5;
  
  switch (objType) {
    case 'pool':
      x = house.housePosX;
      z = house.housePosZ + (isGateSouth ? -1 : 1) * (house.houseLength/2 + objDepth/2 + 2);
      rotation = house.houseRotation || 0;
      break;
    case 'bath':
      x = leftX;
      z = backZ;
      break;
    case 'bbq':
      x = rightX;
      z = backZ;
      break;
    case 'customObj':
      x = isGateEast ? leftX : rightX;
      z = (minZ + maxZ) / 2;
      break;
  }
  
  x = Math.max(minX + objWidth/2, Math.min(maxX - objWidth/2, x));
  z = Math.max(minZ + objDepth/2, Math.min(maxZ - objDepth/2, z));
  
  return { x, z, rotation };
};
