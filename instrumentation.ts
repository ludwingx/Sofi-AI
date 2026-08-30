export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startTelegramBackgroundPoller } = await import('./lib/telegram-poller');
    startTelegramBackgroundPoller();
  }
}
