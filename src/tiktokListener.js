const { EventEmitter } = require('events');
const { TikTokLiveConnection } = require('tiktok-live-connector');

function startTiktokListener(username) {
  const emitter = new EventEmitter();
  
  // Utilizando o motor v2.4.4 atualizado (TikTokLiveConnection)
  const tiktok = new TikTokLiveConnection(username, { 
    processInitialData: false
  });

  const promise = tiktok.connect()
    .then((state) => {
      console.log(`[tiktok] conectado à live de @${username} (roomId ${state.roomId})`);
      return state;
    })
    .catch((err) => {
      console.error('[tiktok] falha ao conectar.', err.message);
      throw err;
    });

  tiktok.on('chat', (data) => {
    emitter.emit('chat', {
      userId: data.uniqueId,
      name: data.nickname || data.uniqueId,
      avatarUrl: data.profilePictureUrl,
      text: data.comment,
    });
  });

  tiktok.on('gift', (data) => {
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

  return { emitter, promise };
}

module.exports = { startTiktokListener };
