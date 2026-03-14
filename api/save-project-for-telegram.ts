import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { projectId, houseData, sitePlanUrl } = req.body;
  if (!projectId) return res.status(400).json({ error: "Missing projectId" });
  
  const botToken = process.env.TELEGRAM_BOT_TOKEN || "8512109197:AAEnWLIZxzHAqz1pzksa3yJc91gep0qh9FA";
  const managerChatId = process.env.MANAGER_CHAT_ID || "8128470896";

  if (botToken && managerChatId) {
    try {
      const message = `🚨 <b>НОВЫЙ ПРОЕКТ СФОРМИРОВАН!</b>\n\n` +
        `👤 <b>Клиент:</b>\n` +
        `Имя: ${houseData.userName || 'Не указано'}\n` +
        `Телефон: ${houseData.userPhone || 'Не указан'}\n` +
        `Email: ${houseData.userEmail || 'Не указан'}\n\n` +
        `📝 <b>Проект:</b> ${houseData.name || 'Без названия'}\n\n` +
        `📐 <b>Участок:</b> ${houseData.plotWidth}x${houseData.plotLength} м\n` +
        `🏠 <b>Дом:</b> ${houseData.houseWidth}x${houseData.houseLength} м (Этажей: ${houseData.floors})\n\n` +
        `🚗 <b>Дополнения:</b>\n` +
        `- Гараж: ${houseData.hasGarage ? 'Да' : 'Нет'}\n` +
        `- Навес: ${houseData.hasCarport ? 'Да' : 'Нет'}\n` +
        `- Барбекю: ${houseData.hasBBQ ? 'Да' : 'Нет'}\n` +
        `- Хозблок: ${houseData.hasCustomObj ? 'Да' : 'Нет'}\n` +
        `- Пристроек: ${houseData.additions?.length || 0}\n\n` +
        `<i>Примечание: Проект сохранен через Vercel Serverless Function.</i>`;
      
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: managerChatId,
        text: message,
        parse_mode: 'HTML'
      });
      
      if (sitePlanUrl) {
        const base64Data = sitePlanUrl.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Use FormData to send photo via Telegram API
        const formData = new FormData();
        formData.append('chat_id', managerChatId);
        formData.append('caption', 'План участка клиента');
        
        // Create a blob from buffer
        const blob = new Blob([buffer], { type: 'image/png' });
        formData.append('photo', blob, 'plan.png');
        
        await axios.post(`https://api.telegram.org/bot${botToken}/sendPhoto`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
      }
    } catch (e: any) {
      console.error("Error sending project data to manager via Telegram API:", e.response?.data || e.message);
    }
  }
  
  res.status(200).json({ success: true });
}
