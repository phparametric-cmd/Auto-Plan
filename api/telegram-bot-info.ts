import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || "8512109197:AAEnWLIZxzHAqz1pzksa3yJc91gep0qh9FA";
  
  if (botToken) {
    try {
      const response = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`);
      res.status(200).json({ username: response.data.result.username });
    } catch (e) {
      res.status(500).json({ error: "Bot not initialized" });
    }
  } else {
    res.status(500).json({ error: "Bot not initialized" });
  }
}
