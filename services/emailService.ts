
import { HouseState } from "../types";

let isRequestPending = false;

/**
 * Отправка заказа через Google Apps Script
 */
export const sendProjectToEmail = async (house: HouseState, grandTotal: number, zipBlob: Blob, changesCount: number = 0): Promise<boolean> => {
  if (isRequestPending) return false;
  isRequestPending = true;

  const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby4cJEKFHH68GoPeXUDE4L_GdmA1PO08j-6kRdPt2nH6IYcDT53WkW6rNvkLo9q7QUz/exec"; 

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base = reader.result as string;
        resolve(base.split(',')[1]);
      };
      reader.readAsDataURL(blob);
    });
  };

  try {
    const base64Data = await blobToBase64(zipBlob);
    const fileName = changesCount > 0 ? `${house.name}_изменения_${changesCount}.zip` : `${house.name}_${house.userName || 'Project'}.zip`;
    const payload = {
      projectId: house.name,
      clientName: house.userName || 'Клиент',
      clientPhone: house.userPhone || '---',
      clientEmail: house.userEmail,
      total: `${grandTotal.toLocaleString()} ₸`,
      fileName: fileName,
      fileData: base64Data,
      timestamp: Date.now() // Уникальный ID запроса
    };

    // Используем простой POST
    await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
    });

    setTimeout(() => { isRequestPending = false; }, 5000); // Разблокировка через 5 сек
    return true;
  } catch (error) {
    console.error("[EmailService] Error:", error);
    isRequestPending = false;
    return false;
  }
};
