import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

// Cache for projects (in-memory, will reset on cold start, but enough for quick relays)
const projectCache: Record<string, any> = {};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const botToken = process.env.TELEGRAM_BOT_TOKEN || "8512109197:AAEnWLIZxzHAqz1pzksa3yJc91gep0qh9FA";
  const managerChatId = process.env.MANAGER_CHAT_ID || "8128470896";

  if (!botToken) return res.status(500).json({ error: "Bot token not configured" });

  try {
    const update = req.body;
    
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = msg.text || '';

      // Handle /start command
      if (text.startsWith('/start')) {
        const match = text.match(/\/start (.+)/);
        const projectId = match ? match[1] : null;

        if (projectId && projectCache[projectId]) {
          const project = projectCache[projectId];
          const { houseData, sitePlanUrl } = project;

          await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            chat_id: chatId,
            text: `Здравствуйте, ${houseData.userName || 'друг'}!\n\nСпасибо, что воспользовались PH HOME. Ваш проект "${houseData.name}" успешно сформирован.`
          });

          if (sitePlanUrl) {
            const base64Data = sitePlanUrl.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');
            const formData = new FormData();
            formData.append('chat_id', chatId.toString());
            formData.append('caption', 'Генеральный план вашего участка');
            formData.append('photo', new Blob([buffer], { type: 'image/png' }), 'plan.png');
            
            await axios.post(`https://api.telegram.org/bot${botToken}/sendPhoto`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });
          }
          
          await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            chat_id: chatId,
            text: "Наш архитектор свяжется с вами в ближайшее время для обсуждения деталей. Если у вас есть вопросы, можете задать их прямо здесь!"
          });
          
          // Notify manager
          const clientUser = msg.from;
          let clientLink = "Скрыт настройками приватности";
          if (clientUser?.username) {
            clientLink = `@${clientUser.username}`;
          } else if (clientUser?.id) {
            clientLink = `<a href="tg://user?id=${clientUser.id}">${clientUser.first_name || 'Клиент'}</a>`;
          }
          
          const managerMsg = `🔔 <b>КЛИЕНТ ПЕРЕШЕЛ В БОТА!</b>\n\n` +
                             `Имя в приложении: ${houseData.userName || 'Не указано'}\n` +
                             `Телефон: ${houseData.userPhone || 'Не указан'}\n` +
                             `Email: ${houseData.userEmail || 'Не указан'}\n` +
                             `Профиль Telegram: ${clientLink}\n` +
                             `Проект: ${houseData.name}`;
                             
          await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            chat_id: managerChatId,
            text: managerMsg,
            parse_mode: 'HTML'
          });
        } else if (projectId) {
          await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            chat_id: chatId,
            text: "⏳ Проект обрабатывается сервером...\n\nЕсли ваш проект не появится здесь в течение 5 секунд, пожалуйста, вернитесь в приложение и нажмите кнопку «Получить в Telegram» еще раз."
          });
        } else {
          await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            chat_id: chatId,
            text: "Добро пожаловать в PH HOME! Отправьте проект из приложения, чтобы увидеть его здесь."
          });
        }
      } 
      // Relay messages
      else if (!text.startsWith('/')) {
        // 1. Manager replying to client
        if (chatId.toString() === managerChatId) {
          if (msg.reply_to_message && msg.reply_to_message.text) {
            const match = msg.reply_to_message.text.match(/ID:\s*(\d+)/);
            if (match && match[1]) {
              const clientId = match[1];
              if (text) {
                await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                  chat_id: clientId,
                  text: text
                });
              } else {
                await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                  chat_id: managerChatId,
                  text: "Бот пока поддерживает только текстовые ответы."
                });
              }
            }
          }
        } 
        // 2. Client sending message to manager
        else {
          const clientName = msg.from?.first_name || 'Клиент';
          const clientUsername = msg.from?.username ? `(@${msg.from.username})` : '';
          
          const relayMsg = `💬 <b>Новое сообщение от клиента</b>\n` +
                           `От: ${clientName} ${clientUsername}\n` +
                           `ID: ${chatId}\n\n` +
                           `${text}\n\n` +
                           `<i>(Чтобы ответить, сделайте Reply / Ответить на это сообщение)</i>`;
                           
          await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            chat_id: managerChatId,
            text: relayMsg,
            parse_mode: 'HTML'
          });
        }
      }
    }
  } catch (e: any) {
    console.error("Webhook error:", e.response?.data || e.message);
  }

  res.status(200).json({ success: true });
}

// Helper to save project to cache from other endpoints
export function saveProjectToCache(projectId: string, data: any) {
  projectCache[projectId] = data;
}
