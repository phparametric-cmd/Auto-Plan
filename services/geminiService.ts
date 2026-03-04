
import { GoogleGenAI } from "@google/genai";
import { HouseState } from "../types";

/**
 * Генератор технического паспорта с использованием Google Gemini API.
 * Формирует профессиональный структурированный текст на основе параметров проекта на выбранном языке.
 */
export const generateProjectNarrative = async (house: HouseState): Promise<string> => {
  // Fix: Initializing GoogleGenAI with named apiKey parameter as per guidelines.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const plotArea = house.plotWidth * house.plotLength;
  const totalHouseArea = house.houseWidth * house.houseLength * house.floors;

  const floorPlanDetails = house.calculatedPlan?.map(f => {
    const roomsStr = f.rooms.map(r => `${r.name} (${r.area.toFixed(1)}м²)`).join(', ');
    const comment = house.floorComments[f.floorNumber - 1];
    return `FLOOR ${f.floorNumber}: ${roomsStr}${comment ? `\nNOTE: ${comment}` : ''}`;
  }).join('\n\n') || '';

  const targetLang = house.lang === 'ru' ? 'Russian' : (house.lang === 'en' ? 'English' : 'Kazakh');

  const prompt = `House parameters:
  Concept: ${house.type}. 
  Style details: ${house.styleDescription}
  
  Construction parameters:
  - Plot: ${house.plotWidth}x${house.plotLength}m (${(plotArea / 100).toFixed(1)} are)
  - House footprint: ${house.houseWidth}x${house.houseLength}m
  - Floors: ${house.floors}
  - Total house area: ${totalHouseArea.toFixed(1)} m²
  
  Explication of rooms:
  ${floorPlanDetails}
  
  Additional client wishes: ${house.extraWishes || 'none'}`;

  try {
    // Using gemini-3-pro-preview for complex architectural reasoning and professional narrative tasks.
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: `Ты выступаешь в роли системного архитектора-аналитика. Я буду предоставлять тебе данные проекта (текстовый манифест и параметры с генплана). Твоя задача — формировать из них 'Единый Архитектурный Контейнер'.

Твои правила работы:

Приоритет данных: Если данные в тексте и на картинке различаются (например, площадь участка), всегда отдавай приоритет данным с графического генплана как более актуальным.

Структура: Данные должны быть строго упакованы в 4 блока: [PROJECT], [SITE], [BUILDING], [LANDSCAPE].

Пространственная привязка: Для каждого объекта на участке указывай его габариты (AxB) и примерное расположение (например: 'в северо-западном углу' или 'примыкает к дому').

Формат: Используй Markdown для чистоты и возможности легкого копирования.

Твоя цель — сделать документ максимально 'читаемым' для других нейросетей-генераторов (Midjourney, Stable Diffusion, Revit AI). Подтверди готовность, и мы начнем сборку файла.`,
        thinkingConfig: { thinkingBudget: 32768 }
      }
    });
    // Correctly accessing the .text property directly on the GenerateContentResponse object.
    return response.text || "Specification generated.";
  } catch (error: any) {
    // Fix: Handle specific error for API key selection if the project is not found.
    if (error?.message?.includes("Requested entity was not found")) {
      const win = window as any;
      if (win.aistudio && typeof win.aistudio.openSelectKey === 'function') {
        await win.aistudio.openSelectKey();
      }
    }
    console.error("Gemini Narrative Error:", error);
    return `ARCHITECTURAL CONCEPT: ${house.type.toUpperCase()}\nTOTAL AREA: ${totalHouseArea.toFixed(1)} m²`;
  }
};

/**
 * Генерация фотореалистичной архитектурной визуализации.
 */
export const generateArchitecturalImage = async (
  house: HouseState, 
  view: 'front' | 'top', 
  screenshotBase64?: string
): Promise<string> => {
  if (view === 'top') return screenshotBase64 || "";

  // Fix: Create GoogleGenAI instance right before the call to ensure the latest API key is used.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const parts: any[] = [];
    
    if (screenshotBase64) {
      const base64Data = screenshotBase64.includes(',') ? screenshotBase64.split(',')[1] : screenshotBase64;
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: base64Data,
        },
      });
      parts.push({ 
        text: `Transform this 3D mockup into a photorealistic architectural visualization in ${house.type} style. 
        Follow the geometry shown exactly. Details: ${house.styleDescription}. 
        Environment: Realistic lighting, high-end architectural photography, cinematic quality.` 
      });
    } else {
      parts.push({ 
        text: `Professional architectural render of a modern house in ${house.type} style. 
        Details: ${house.styleDescription}. 
        Environment: Realistic lighting, high-end architectural photography, cinematic quality.` 
      });
    }

    // Using gemini-2.5-flash-image for image editing and general generation tasks.
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
    });

    // Fix: Iterating through parts using direct candidate access as per guideline examples for nano banana models.
    if (response.candidates && response.candidates[0] && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
      }
    }
  } catch (error: any) {
    // Fix: Trigger key selection dialog if requested entity was not found.
    if (error?.message?.includes("Requested entity was not found")) {
      const win = window as any;
      if (win.aistudio && typeof win.aistudio.openSelectKey === 'function') {
        await win.aistudio.openSelectKey();
      }
    }
    console.error("Gemini Image Generation Error:", error);
  }

  return screenshotBase64 || house.styleImageUrl || "";
};

/**
 * Генератор предварительного расчета стоимости строительства (сметчик).
 * Специализируется на г. Алматы, Казахстан.
 */
export const generateConstructionEstimate = async (house: HouseState): Promise<string> => {
  // Цены на 2026 год (в тенге)
  const PRICE_HOUSE = 550000;
  const PRICE_BATH = 343750; // Уменьшено в 2 раза
  const PRICE_GARAGE = 350000;
  const PRICE_CARPORT = 65000;
  const PRICE_TERRACE = 150000;
  const PRICE_FENCE = 50000;
  const PRICE_COMMUNICATIONS = 2500000;
  const PRICE_LANDSCAPING = 15000; // Уменьшено в 2 раза

  // Площади и объемы
  const plotAreaM2 = house.plotWidth * house.plotLength;
  const houseArea = house.houseWidth * house.houseLength * house.floors;
  const bathArea = house.hasBath ? house.bathWidth * house.bathDepth : 0;
  const garageArea = house.hasGarage ? house.garageCars * 20 : 0;
  const carportArea = house.hasCarport ? house.carportCars * 15 : 0;
  const terraceArea = house.hasTerrace ? house.terraceWidth * house.terraceDepth : 0;
  const fencePerimeter = (house.plotWidth + house.plotLength) * 2;
  
  const occupiedArea = (house.houseWidth * house.houseLength) + 
                       (house.hasPool ? house.poolWidth * house.poolDepth : 0) +
                       garageArea + carportArea + bathArea + terraceArea;
  const freePlotArea = Math.max(0, plotAreaM2 - occupiedArea);

  // Расчет стоимости
  const costHouse = houseArea * PRICE_HOUSE;
  const costBath = bathArea * PRICE_BATH;
  const costGarage = garageArea * PRICE_GARAGE;
  const costCarport = carportArea * PRICE_CARPORT;
  const costTerrace = terraceArea * PRICE_TERRACE;
  const costFence = fencePerimeter * PRICE_FENCE;
  const costCommunications = PRICE_COMMUNICATIONS;
  const costLandscaping = freePlotArea * PRICE_LANDSCAPING;

  const totalCost = costHouse + costBath + costGarage + costCarport + costTerrace + costFence + costCommunications + costLandscaping;

  const formatCurrency = (num: number) => new Intl.NumberFormat('ru-RU').format(Math.round(num)) + ' ₸';
  const formatArea = (num: number) => num.toFixed(1) + ' м²';
  const formatLength = (num: number) => num.toFixed(1) + ' п.м.';

  let rowsHtml = `
    <tr>
      <td>Строительство основного дома (Черновая + Фасад 100%)</td>
      <td>${formatArea(houseArea)}</td>
      <td style="text-align: right;">${formatCurrency(costHouse)}</td>
    </tr>
  `;

  if (house.hasBath) {
    rowsHtml += `
    <tr>
      <td>Строительство бани</td>
      <td>${formatArea(bathArea)}</td>
      <td style="text-align: right;">${formatCurrency(costBath)}</td>
    </tr>
    `;
  }

  if (house.hasGarage) {
    rowsHtml += `
    <tr>
      <td>Капитальный гараж</td>
      <td>${formatArea(garageArea)}</td>
      <td style="text-align: right;">${formatCurrency(costGarage)}</td>
    </tr>
    `;
  }

  if (house.hasCarport) {
    rowsHtml += `
    <tr>
      <td>Навес для авто</td>
      <td>${formatArea(carportArea)}</td>
      <td style="text-align: right;">${formatCurrency(costCarport)}</td>
    </tr>
    `;
  }

  if (house.hasTerrace) {
    rowsHtml += `
    <tr>
      <td>Терраса</td>
      <td>${formatArea(terraceArea)}</td>
      <td style="text-align: right;">${formatCurrency(costTerrace)}</td>
    </tr>
    `;
  }

  rowsHtml += `
    <tr>
      <td>Устройство забора</td>
      <td>${formatLength(fencePerimeter)}</td>
      <td style="text-align: right;">${formatCurrency(costFence)}</td>
    </tr>
    <tr>
      <td>Инженерные коммуникации</td>
      <td>1 компл.</td>
      <td style="text-align: right;">${formatCurrency(costCommunications)}</td>
    </tr>
    <tr>
      <td>Базовое благоустройство территории</td>
      <td>${formatArea(freePlotArea)}</td>
      <td style="text-align: right;">${formatCurrency(costLandscaping)}</td>
    </tr>
    <tr>
      <td>ИТОГО</td>
      <td></td>
      <td style="text-align: right;">${formatCurrency(totalCost)}</td>
    </tr>
  `;

  return `
    <table>
      <thead>
        <tr>
          <th style="text-align: left;">Наименование</th>
          <th style="text-align: left;">Объем/Площадь</th>
          <th style="text-align: right;">Итоговая стоимость</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;
};
