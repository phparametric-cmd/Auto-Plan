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
      if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
        // Silently ignore 409 Conflict errors caused by multiple containers
      } else {
        console.error("Telegram polling error:", error.message);
      }
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
      } else {
        bot!.sendMessage(chatId, "Добро пожаловать в PH HOME! К сожалению, проект не найден или ссылка устарела.");
      }
    });
  }

  app.post("/api/save-project-for-telegram", (req, res) => {
    const { projectId, houseData, sitePlanUrl } = req.body;
    if (!projectId) return res.status(400).json({ error: "Missing projectId" });
    
    setProjectCache(projectId, { houseData, sitePlanUrl });
    
    res.json({ success: true });
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
                if (window.opener) {
                  window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', user: ${JSON.stringify(userInfo)} }, '*');
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
              <script>setTimeout(() => window.close(), 3000);</script>
            </body>
          </html>
        `);
      }
    } catch (error) {
      console.error("OAuth error:", error);
      res.send(`
        <html>
          <body>
            <p>Ошибка авторизации. Закройте окно и попробуйте снова.</p>
            <script>setTimeout(() => window.close(), 3000);</script>
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
