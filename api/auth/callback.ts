import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state } = req.query;
  const redirectUri = (state as string) || `https://${req.headers.host}/api/auth/callback`;

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
}
