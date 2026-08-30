const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export async function getMe() {
  if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not defined');
  const res = await fetch(`${TELEGRAM_API_BASE}/getMe`);
  return res.json();
}

export async function sendTelegramMessage(chatId: string | number, text: string, parseMode: 'HTML' | 'Markdown' | undefined = undefined) {
  if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not defined');

  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
  };

  if (parseMode) {
    payload.parse_mode = parseMode;
  }

  const res = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return res.json();
}

export async function sendTelegramChatAction(chatId: string | number, action: 'typing' | 'upload_photo' | 'record_voice' = 'typing') {
  if (!TELEGRAM_BOT_TOKEN) return;

  try {
    await fetch(`${TELEGRAM_API_BASE}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch (err) {
    console.error('Error sending chat action:', err);
  }
}

export async function setTelegramWebhook(webhookUrl: string, secretToken?: string) {
  if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not defined');

  const body: Record<string, unknown> = { url: webhookUrl };
  if (secretToken) body.secret_token = secretToken;

  const res = await fetch(`${TELEGRAM_API_BASE}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return res.json();
}

export async function getTelegramUpdates(offset?: number, limit = 20, timeout = 30) {
  if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not defined');

  const params = new URLSearchParams();
  if (offset !== undefined) params.append('offset', offset.toString());
  params.append('limit', limit.toString());
  params.append('timeout', timeout.toString());

  const res = await fetch(`${TELEGRAM_API_BASE}/getUpdates?${params.toString()}`);
  return res.json();
}

export async function getTelegramFilePath(fileId: string): Promise<string | null> {
  if (!TELEGRAM_BOT_TOKEN) return null;

  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/getFile?file_id=${fileId}`);
    const data = await res.json();
    if (data.ok && data.result?.file_path) {
      return `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${data.result.file_path}`;
    }
    return null;
  } catch (err) {
    console.error('Error getting Telegram file:', err);
    return null;
  }
}
