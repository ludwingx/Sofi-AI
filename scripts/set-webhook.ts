import 'dotenv/config';
import { getTelegramWebhookInfo, setTelegramWebhook, deleteTelegramWebhook, getMe } from '../lib/telegram';

async function main() {
  const args = process.argv.slice(2);
  const action = args[0];

  console.log('🤖 Verificando bot de Telegram...');
  const me = await getMe();
  if (!me.ok) {
    console.error('❌ Error conectando con Telegram:', me);
    return;
  }
  console.log(`✅ Bot conectado: @${me.result.username} (${me.result.first_name})`);

  if (action === 'delete') {
    console.log('🗑️ Eliminando webhook de Telegram...');
    const res = await deleteTelegramWebhook();
    console.log('Resultado:', res);
  } else if (action && action.startsWith('http')) {
    const url = action.endsWith('/api/telegram') ? action : `${action.replace(/\/$/, '')}/api/telegram`;
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    console.log(`🔗 Configurando webhook hacia: ${url}`);
    const res = await setTelegramWebhook(url, secret);
    console.log('Resultado:', res);
  }

  const info = await getTelegramWebhookInfo();
  console.log('\n📊 Estado actual del Webhook en Telegram:');
  console.log(JSON.stringify(info.result, null, 2));
}

main().catch(console.error);
