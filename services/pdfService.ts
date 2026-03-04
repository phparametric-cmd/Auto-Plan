
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Генерирует PDF из HTML элемента.
 * Масштабирует контент по ширине листа A4 (210мм) и автоматически подбирает высоту страницы,
 * чтобы весь контент поместился на одной странице без разрывов.
 */
export const generatePDFBlob = async (element: HTMLElement, fileName: string): Promise<Blob> => {
  if (!element) throw new Error("Element for PDF generation not found.");
  await new Promise(resolve => setTimeout(resolve, 1000)); // Ждем отрисовку

  try {
    const canvas = await html2canvas(element, {
      scale: 2, // Оптимально для качества и веса
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    
    const pdfWidth = 210; // Ширина A4 в мм
    const margin = 10; // Отступы по краям
    
    const usableWidth = pdfWidth - (margin * 2);

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Масштабируем по ширине
    const ratio = usableWidth / canvasWidth;
    const finalWidth = usableWidth;
    const finalHeight = canvasHeight * ratio;

    const pdfHeight = finalHeight + (margin * 2);

    // Создаем PDF с кастомной высотой
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pdfWidth, pdfHeight] });

    pdf.addImage(imgData, 'JPEG', margin, margin, finalWidth, finalHeight);

    return pdf.output('blob');
  } catch (error) {
    console.error(`[pdfService] Failed to generate PDF:`, error);
    throw error;
  }
};
