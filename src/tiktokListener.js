const { EventEmitter } = require('events');
const { WebcastPushConnection } = require('tiktok-live-connector');

/**
 * Conecta na live da TikTok e emite eventos normalizados:
 *  - 'gift'  { userId, name, avatarUrl, value }
 *  - 'chat'  { userId, name, avatarUrl, text }
 * `value` do gift é uma estimativa simples (repeatCount * diamondCount do tipo de presente).
 */
function startTiktokListener(username) {
  const tiktok = new (require("tiktok-live-connector").WebcastPushConnection)(username);
  const emitter = new EventEmitter();
  

  

  tiktok.on('chat', (data) => {
    emitter.emit('chat', {
      userId: data.uniqueId,
      name: data.nickname || data.uniqueId,
      avatarUrl: data.profilePictureUrl,
      text: data.comment,
    });
  });

  tiktok.on('gift', (data) => {
    // Só conta quando o combo de presente terminou, pra não somar em duplicidade
    if (data.giftType === 1 && !data.repeatEnd) return;

    const diamonds = data.diamondCount || 1;
    const repeats = data.repeatCount || 1;

    emitter.emit('gift', {
      userId: data.uniqueId,
      name: data.nickname || data.uniqueId,
      avatarUrl: data.profilePictureUrl,
      value: diamonds * repeats,
    });
  });

  tiktok.on('disconnected', () => {
    console.warn('[tiktok] desconectado. Tentando reconectar em 5s...');
    setTimeout(() => tiktok.connect().catch(() => {}), 5000);
  });

  return { emitter, promise: tiktok.connect() };
}

module.exports = { startTiktokListener };
