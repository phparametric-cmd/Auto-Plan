import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import axios from "axios";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

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
