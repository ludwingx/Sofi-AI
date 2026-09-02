function getTelegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not defined');
  return {
    token,
    apiBase: `https://api.telegram.org/bot${token}`,
  };
}

export async function getMe() {
  const { apiBase } = getTelegramConfig();
  const res = await fetch(`${apiBase}/getMe`);
  return res.json();
}

export async function sendTelegramMessage(chatId: string | number, text: string, parseMode: 'HTML' | 'Markdown' | undefined = undefined) {
  const { apiBase } = getTelegramConfig();

  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
  };

  if (parseMode) {
    payload.parse_mode = parseMode;
  }

  const res = await fetch(`${apiBase}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return res.json();
}

export async function sendTelegramChatAction(chatId: string | number, action: 'typing' | 'upload_photo' | 'record_voice' = 'typing') {
  try {
    const { apiBase } = getTelegramConfig();
    await fetch(`${apiBase}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch (err) {
    console.error('Error sending chat action:', err);
  }
}

export async function setTelegramWebhook(webhookUrl: string, secretToken?: string) {
  const { apiBase } = getTelegramConfig();

  const body: Record<string, unknown> = { url: webhookUrl };
  if (secretToken) body.secret_token = secretToken;

  const res = await fetch(`${apiBase}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return res.json();
}

export async function deleteTelegramWebhook() {
  const { apiBase } = getTelegramConfig();
  const res = await fetch(`${apiBase}/deleteWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

export async function getTelegramWebhookInfo() {
  const { apiBase } = getTelegramConfig();
  const res = await fetch(`${apiBase}/getWebhookInfo`);
  return res.json();
}

export async function getTelegramUpdates(offset?: number, limit = 20, timeout = 30) {
  const { apiBase } = getTelegramConfig();

  const params = new URLSearchParams();
  if (offset !== undefined) params.append('offset', offset.toString());
  params.append('limit', limit.toString());
  params.append('timeout', timeout.toString());

  const res = await fetch(`${apiBase}/getUpdates?${params.toString()}`);
  return res.json();
}

export async function getTelegramFilePath(fileId: string): Promise<string | null> {
  try {
    const { token, apiBase } = getTelegramConfig();
    const res = await fetch(`${apiBase}/getFile?file_id=${fileId}`);
    const data = await res.json();
    if (data.ok && data.result?.file_path) {
      return `https://api.telegram.org/file/bot${token}/${data.result.file_path}`;
    }
    return null;
  } catch (err) {
    console.error('Error getting Telegram file:', err);
    return null;
  }
}

