
/**
 * КОНЦЕПТУАЛЬНЫЙ КОД SERVERLESS-ФУНКЦИИ (Node.js / Vercel / Netlify)
 * 
 * Этот файл является примером того, как должна выглядеть серверная часть.
 * В браузере напрямую не исполняется, требует Node.js среды.
 */

/*
import { NextApiRequest, NextApiResponse } from 'next';
import nodemailer from 'nodemailer';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { houseData, files } = req.body;
  const projectName = houseData.name;
  const clientName = houseData.userName;
  const folderName = `${projectName}_${clientName}`;

  try {
    // 1. Настройка почты (SMTP)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    // 2. Создание архива в памяти
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: any[] = [];
    archive.on('data', (chunk) => chunks.push(chunk));

    // 3. Формирование содержимого архива
    archive.append(JSON.stringify(houseData, null, 2), { name: `${folderName}/data.json` });
    
    // Добавление файлов (base64 -> buffer)
    files.forEach((file: any) => {
      const buffer = Buffer.from(file.data.split(',')[1], 'base64');
      archive.append(buffer, { name: `${folderName}/${file.name}` });
    });

    await archive.finalize();
    const zipBuffer = Buffer.concat(chunks);

    // 4. Отправка Email с вложением
    const mailOptions = {
      from: '"PH HOME System" <noreply@phhome.com>',
      to: [houseData.userEmail, 'admin@phhome.com'],
      subject: `Новый заказ проекта: ${projectName}`,
      text: `Поступил новый заказ от ${clientName}. Архив приложен к письму.`,
      attachments: [{
        filename: `${folderName}.zip`,
        content: zipBuffer
      }]
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ success: true, message: 'Project ordered and archived' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
*/
