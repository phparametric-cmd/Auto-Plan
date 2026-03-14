
import { HouseState } from "../types";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { sendProjectToEmail } from "./emailService";

interface OrderPayload {
  house: HouseState;
  passportBlob?: Blob;
  calculationBlob?: Blob;
  estimateBlob?: Blob;
  revisionCount?: number;
}

/**
 * Генерация подробного манифеста для ИИ в формате TXT
 */
const generateProjectAiManifest = (house: HouseState): string => {
  const plotArea = house.plotWidth * house.plotLength;
  const totalArea = house.houseWidth * house.houseLength * house.floors;

  let text = `====================================================\n`;
  text += `PH HOME PROJECT MANIFEST FOR AI DESIGN TOOLS\n`;
  text += `Generated: ${new Date().toLocaleString()}\n`;
  text += `Project ID: ${house.name}\n`;
  text += `====================================================\n\n`;

  text += `[CLIENT DATA]\n`;
  text += `Client: ${house.userName || 'N/A'}\n`;
  text += `Phone: ${house.userPhone || 'N/A'}\n`;
  text += `Email: ${house.userEmail || 'N/A'}\n\n`;

  text += `[SITE PARAMETERS]\n`;
  text += `Dimensions: ${house.plotWidth}m x ${house.plotLength}m\n`;
  text += `Total Area: ${(plotArea / 100).toFixed(2)} Sotka (Are)\n`;
  if (house.isMapMode && house.mapCenter) {
    text += `Coordinates: [Lat: ${house.mapCenter.lat.toFixed(6)}, Lng: ${house.mapCenter.lng.toFixed(6)}]\n`;
  }
  text += `Gate Position X: ${house.gatePosX.toFixed(2)}\n`;
  text += `Gate Side Index: ${house.gateSideIndex || 0}\n\n`;

  text += `[BUILDING GEOMETRY]\n`;
  text += `House Style: ${house.type}\n`;
  text += `Footprint: ${house.houseWidth}m x ${house.houseLength}m\n`;
  text += `Floors: ${house.floors}\n`;
  text += `Total Living Area: ${Math.round(totalArea)} m2\n`;
  text += `Center Position: [X: ${house.housePosX.toFixed(2)}, Z: ${house.housePosZ.toFixed(2)}]\n`;
  text += `Rotation: ${((house.houseRotation * 180) / Math.PI).toFixed(0)} deg\n\n`;

  text += `[ROOM SCHEDULE BY FLOORS]\n`;
  house.calculatedPlan?.forEach(floor => {
    text += `FLOOR #${floor.floorNumber}:\n`;
    floor.rooms.forEach(room => {
      text += `  - ${room.name}: ${Math.round(room.area)} m2\n`;
    });
    text += `\n`;
  });

  text += `[LANDSCAPE & OUTDOOR OBJECTS]\n`;
  text += `Positions relative to plot center (0,0):\n`;
  if (house.hasTerrace) text += `- Terrace: ${house.terraceWidth}x${house.terraceDepth}m at [X:${house.terracePosX.toFixed(2)}, Z:${house.terracePosZ.toFixed(2)}]\n`;
  if (house.hasPool) text += `- Pool: ${house.poolWidth}x${house.poolDepth}m at [X:${house.poolPosX.toFixed(2)}, Z:${house.poolPosZ.toFixed(2)}]\n`;
  if (house.hasBath) text += `- Bathhouse: ${house.bathWidth}x${house.bathDepth}m at [X:${house.bathPosX.toFixed(2)}, Z:${house.bathPosZ.toFixed(2)}]\n`;
  if (house.hasBBQ) text += `- BBQ: ${house.bbqWidth}x${house.bbqDepth}m at [X:${house.bbqPosX.toFixed(2)}, Z:${house.bbqPosZ.toFixed(2)}]\n`;
  if (house.hasGarage) text += `- Garage (${house.garageCars} cars): [X:${house.garagePosX.toFixed(2)}, Z:${house.garagePosZ.toFixed(2)}], Rot:${((house.garageRotation * 180) / Math.PI).toFixed(0)}\n`;
  if (house.hasCarport) text += `- Carport (${house.carportCars} cars): [X:${house.carportPosX.toFixed(2)}, Z:${house.carportPosZ.toFixed(2)}], Rot:${((house.carportRotation * 180) / Math.PI).toFixed(0)}\n`;
  
  house.additions.forEach((add, idx) => {
    text += `- House Part ${idx + 1}: ${add.width}x${add.length}m at [X:${add.posX.toFixed(2)}, Z:${add.posZ.toFixed(2)}], Floors:${add.floors}\n`;
  });

  text += `\n[WISHES]\n${house.extraWishes || 'No extra wishes.'}\n\n`;
  text += `[MANIFEST END]`;
  return text;
};

export const processProjectOrder = async ({ house, passportBlob, calculationBlob, estimateBlob, revisionCount = 0 }: OrderPayload): Promise<boolean> => {
  try {
    const zip = new JSZip();
    let folderName = `${house.name}_${house.userName || 'Project'}`;
    if (revisionCount > 0) {
      folderName += `_изменение_${revisionCount}`;
    }
    const projectFolder = zip.folder(folderName);
    if (!projectFolder) throw new Error("ZIP creation failed");

    // 1. Манифест для ИИ
    const aiManifest = generateProjectAiManifest(house);
    projectFolder.file("PROJECT_AI_MANIFEST.txt", aiManifest);

    // 2. PDF Документы
    if (passportBlob) projectFolder.file("ARCHITECTURAL_PASSPORT.pdf", passportBlob);
    if (calculationBlob) projectFolder.file("DESIGN_COST_CALCULATION.pdf", calculationBlob);
    if (estimateBlob) projectFolder.file("CONSTRUCTION_ESTIMATE.pdf", estimateBlob);

    // 3. Генплан (PNG)
    if (house.sitePlanUrl) {
      const base64Data = house.sitePlanUrl.split(',')[1];
      projectFolder.file("SITE_PLAN_LAYOUT.png", base64Data, { base64: true });
    }

    // 4. Снимок карты (если есть)
    if (house.mapSnapshotUrl) {
      const base64Data = house.mapSnapshotUrl.split(',')[1];
      projectFolder.file("SATELLITE_MAP.jpg", base64Data, { base64: true });
    }

    // 5. Файлы клиента
    house.projectFiles.forEach((f, idx) => {
      projectFolder.file(`ATTACHMENT_${idx + 1}_${f.name}`, f.data.split(',')[1], { base64: true });
    });

    const zipBlob = await zip.generateAsync({ type: "blob" });
    
    // Отправляем на почту
    await sendProjectToEmail(house, 0, zipBlob, revisionCount);

    return true;
  } catch (error) {
    console.error("[OrderService] Error:", error);
    return false;
  }
};
