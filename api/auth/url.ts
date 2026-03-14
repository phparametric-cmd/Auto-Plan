import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const redirectUri = (req.query.redirectUri as string) || `https://${req.headers.host}/api/auth/callback`;

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
  res.status(200).json({ url: authUrl });
}
