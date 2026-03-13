import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import axios from "axios";
import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for large base64 images
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Telegram Bot Setup
  const botToken = process.env.TELEGRAM_BOT_TOKEN || "8512109197:AAEnWLIZxzHAqz1pzksa3yJc91gep0qh9FA";
  let bot: TelegramBot | null = null;
  let botInfo: TelegramBot.User | null = null;
  
  // Use a file-based cache so multiple containers (dev/preview) can share the data
  const CACHE_FILE = path.join(process.cwd(), '.telegram_cache.json');
  
  const getProjectsCache = () => {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const data = fs.readFileSync(CACHE_FILE, 'utf-8');
        return JSON.parse(data);
      }
    } catch (e) {
      console.error("Error reading cache file:", e);
    }
    return {};
  };

  const setProjectCache = (projectId: string, data: any) => {
    try {
      const cache = getProjectsCache();
      cache[projectId] = { ...data, timestamp: Date.now() };
      
      // Cleanup old entries (older than 1 hour)
      const now = Date.now();
      for (const key in cache) {
        if (now - cache[key].timestamp > 3600000) {
          delete cache[key];
        }
      }
      
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
    } catch (e) {
      console.error("Error writing cache file:", e);
    }
  };

  // Use a global variable to prevent multiple instances during hot reloads
  if (botToken) {
    if ((global as any).__telegramBot) {
      try {
        await (global as any).__telegramBot.stopPolling();
      } catch (e) {
        console.error("Error stopping old bot polling:", e);
      }
    }
    
    bot = new TelegramBot(botToken, { polling: true });
    (global as any).__telegramBot = bot;
    
    // Ignore polling errors to prevent console spam when both dev and preview containers run the bot
    bot.on('polling_error', (error: any) => {
      const isConflict = error.code === 'ETELEGRAM' && error.message?.includes('409 Conflict');
      const isNetworkError = error.message?.includes('ECONNRESET') || error.message?.includes('EFATAL') || error.code === 'EFATAL';
      
      if (isConflict || isNetworkError) {
        // Silently ignore 409 Conflict errors and transient network disconnects
        return;
      }
      console.error("Telegram polling error:", error.message || error);
    });

    bot.getMe().then(info => {
      botInfo = info;
      console.log("Telegram bot initialized:", info.username);
    }).catch(err => console.error("Telegram bot init error:", err));

    bot.onText(/\/start (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const projectId = match ? match[1] : null;

      const cache = getProjectsCache();

      if (projectId && cache[projectId]) {
        const project = cache[projectId];
        const { houseData, sitePlanUrl } = project;

        await bot!.sendMessage(chatId, `Здравствуйте, ${houseData.userName || 'друг'}!\n\nСпасибо, что воспользовались PH HOME. Ваш проект "${houseData.name}" успешно сформирован.`);

        if (sitePlanUrl) {
          try {
            const base64Data = sitePlanUrl.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');
            await bot!.sendPhoto(chatId, buffer, { caption: 'Генеральный план вашего участка' });
          } catch (e) {
            console.error("Error sending photo to telegram:", e);
          }
        }
        
        await bot!.sendMessage(chatId, "Наш архитектор свяжется с вами в ближайшее время для обсуждения деталей. Если у вас есть вопросы, можете задать их прямо здесь!");
        
        // Уведомляем менеджера о том, что клиент зашел в бота
        const managerChatId = process.env.MANAGER_CHAT_ID || "8128470896";
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
                           
        await bot!.sendMessage(managerChatId, managerMsg, { parse_mode: 'HTML' });
      } else if (projectId) {
        // Если проект не найден в кэше этого контейнера (из-за того, что работают 2 сервера: dev и preview)
        bot!.sendMessage(chatId, "⏳ Проект обрабатывается сервером...\n\nЕсли ваш проект не появится здесь в течение 5 секунд, пожалуйста, вернитесь в приложение и нажмите кнопку «Получить в Telegram» еще раз.");
      } else {
        bot!.sendMessage(chatId, "Добро пожаловать в PH HOME! Отправьте проект из приложения, чтобы увидеть его здесь.");
      }
    });

    // Пересылка сообщений между клиентом и менеджером (чат через бота)
    bot.on('message', async (msg) => {
      // Игнорируем команды вроде /start
      if (msg.text && msg.text.startsWith('/')) return;
      
      const managerChatId = process.env.MANAGER_CHAT_ID || "8128470896";
      
      // 1. Если пишет менеджер (ответ клиенту)
      if (msg.chat.id.toString() === managerChatId) {
        if (msg.reply_to_message && msg.reply_to_message.text) {
          // Ищем ID клиента в тексте сообщения, на которое отвечает менеджер
          const match = msg.reply_to_message.text.match(/ID:\s*(\d+)/);
          if (match && match[1]) {
            const clientId = match[1];
            try {
              if (msg.text) {
                await bot!.sendMessage(clientId, msg.text);
              } else {
                await bot!.sendMessage(managerChatId, "Бот пока поддерживает только текстовые ответы.");
              }
            } catch (e) {
              await bot!.sendMessage(managerChatId, "❌ Ошибка при отправке ответа клиенту. Возможно, он заблокировал бота.");
            }
          }
        }
        return;
      }
      
      // 2. Если пишет клиент (пересылаем менеджеру)
      const clientName = msg.from?.first_name || 'Клиент';
      const clientUsername = msg.from?.username ? `(@${msg.from.username})` : '';
      const text = msg.text || '[Не текстовое сообщение]';
      
      const relayMsg = `💬 <b>Новое сообщение от клиента</b>\n` +
                       `От: ${clientName} ${clientUsername}\n` +
                       `ID: ${msg.chat.id}\n\n` +
                       `${text}\n\n` +
                       `<i>(Чтобы ответить, сделайте Reply / Ответить на это сообщение)</i>`;
                       
      try {
        await bot!.sendMessage(managerChatId, relayMsg, { parse_mode: 'HTML' });
      } catch (e) {
        console.error("Relay error:", e);
      }
    });
  }

  app.post("/api/save-project-for-telegram", async (req, res) => {
    const { projectId, houseData, sitePlanUrl } = req.body;
    if (!projectId) return res.status(400).json({ error: "Missing projectId" });
    
    setProjectCache(projectId, { houseData, sitePlanUrl });
    
    // Send all project data to manager
    const managerChatId = process.env.MANAGER_CHAT_ID || "8128470896";
    if (bot && managerChatId) {
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
          `<i>Примечание: Чтобы получать эти уведомления на номер +77072207261, владелец номера должен написать боту /start и вписать свой chat_id в переменную MANAGER_CHAT_ID.</i>`;
        
        await bot.sendMessage(managerChatId, message, { parse_mode: 'HTML' });
        
        if (sitePlanUrl) {
          const base64Data = sitePlanUrl.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, 'base64');
          await bot.sendPhoto(managerChatId, buffer, { caption: 'План участка клиента' });
        }
      } catch (e) {
        console.error("Error sending project data to manager:", e);
      }
    }
    
    res.json({ success: true });
  });

  app.post("/api/notify-manager", async (req, res) => {
    const { houseData } = req.body;
    // Используем ID чата из переменных окружения, либо вы можете вписать его сюда напрямую
    // Чтобы бот мог отправить сообщение на номер +77072207261, 
    // владелец этого номера должен написать боту /start и узнать свой chat_id
    const managerChatId = process.env.MANAGER_CHAT_ID || "8128470896";
    
    if (bot && managerChatId && managerChatId !== "YOUR_CHAT_ID_HERE") {
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
          `<i>(Для получения уведомлений на +77072207261, владелец номера должен написать боту /start и указать свой chat_id в MANAGER_CHAT_ID)</i>`;
        
        await bot.sendMessage(managerChatId, message, { parse_mode: 'HTML' });
        res.json({ success: true });
      } catch (e) {
        console.error("Error sending manager notification:", e);
        res.status(500).json({ error: "Failed to send notification" });
      }
    } else {
      res.json({ success: false, message: "Bot or MANAGER_CHAT_ID not configured" });
    }
  });

  app.get("/api/telegram-bot-info", (req, res) => {
    if (botInfo) {
      res.json({ username: botInfo.username });
    } else {
      res.status(500).json({ error: "Bot not initialized" });
    }
  });

  // OAuth Endpoints
  app.get("/api/auth/url", (req, res) => {
    const redirectUri = req.query.redirectUri as string || `https://${req.headers.host}/auth/callback`;

    const params = new URLSearchParams({
      client_id: process.env.CLIENT_ID || "",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "consent",
      state: redirectUri
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    res.json({ url: authUrl });
  });

  app.get(["/auth/callback", "/auth/callback/"], async (req, res) => {
    const { code, state } = req.query;
    // Use state if provided, otherwise fallback
    const redirectUri = (state as string) || `https://${req.headers.host}/auth/callback`;

    try {
      if (code && process.env.CLIENT_ID && process.env.CLIENT_SECRET) {
        // Exchange code for tokens
        const tokenResponse = await axios.post("https://oauth2.googleapis.com/token", {
          code,
          client_id: process.env.CLIENT_ID,
          client_secret: process.env.CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: "authorization_code"
        });

        const { access_token, id_token } = tokenResponse.data;

        // Fetch user info
        const userInfoResponse = await axios.get("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${access_token}` }
        });

        const userInfo = userInfoResponse.data;

        // Send success message to parent window and close popup
        res.send(`
          <html>
            <body>
              <script>
                const userInfo = ${JSON.stringify(userInfo)};
                try {
                  localStorage.setItem('ph_user_info', JSON.stringify(userInfo));
                } catch (e) {}
                
                if (window.opener) {
                  window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', user: userInfo }, '*');
                  window.close();
                } else {
                  window.location.href = '/';
                }
              </script>
              <p>Авторизация успешна. Окно закроется автоматически.</p>
            </body>
          </html>
        `);
      } else {
        res.send(`
          <html>
            <body>
              <p>Ошибка авторизации. Закройте окно и попробуйте снова.</p>
              <p style="color: gray; font-size: 12px;">Детали: code=${!!code}, clientId=${!!process.env.CLIENT_ID}, clientSecret=${!!process.env.CLIENT_SECRET}</p>
              <script>setTimeout(() => window.close(), 5000);</script>
            </body>
          </html>
        `);
      }
    } catch (error: any) {
      console.error("OAuth error:", error.response?.data || error.message);
      res.send(`
        <html>
          <body>
            <p>Ошибка авторизации. Закройте окно и попробуйте снова.</p>
            <p style="color: gray; font-size: 12px;">Детали: ${error.response?.data?.error_description || error.message}</p>
            <script>setTimeout(() => window.close(), 5000);</script>
          </body>
        </html>
      `);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
