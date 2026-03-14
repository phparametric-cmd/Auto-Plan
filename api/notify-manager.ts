import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { houseData } = req.body;
  const botToken = process.env.TELEGRAM_BOT_TOKEN || "8512109197:AAEnWLIZxzHAqz1pzksa3yJc91gep0qh9FA";
  const managerChatId = process.env.MANAGER_CHAT_ID || "8128470896";
  
  if (botToken && managerChatId && managerChatId !== "YOUR_CHAT_ID_HERE") {
    try {
      const message = `🚨 <b>НОВЫЙ ЗАКАЗ / ЗАПРОС!</b>\n\n` +
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
        `<i>(Отправлено через Vercel Serverless Function)</i>`;
      
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: managerChatId,
        text: message,
        parse_mode: 'HTML'
      });
      res.status(200).json({ success: true });
    } catch (e: any) {
      console.error("Error sending manager notification:", e.response?.data || e.message);
      res.status(500).json({ error: "Failed to send notification" });
    }
  } else {
    res.status(200).json({ success: false, message: "Bot or MANAGER_CHAT_ID not configured" });
  }
}
