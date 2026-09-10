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
    const userId = data.uniqueId || (data.user && data.user.displayId) || 'usuario';
    const name = data.nickname || (data.user && data.user.nickname) || userId;
    const avatarUrl = data.profilePictureUrl || (data.user && data.user.avatarThumb && data.user.avatarThumb.urlList && data.user.avatarThumb.urlList[0]) || '';
    const text = data.comment || data.content || '';

    emitter.emit('chat', {
      userId,
      name,
      avatarUrl,
      text
    });
  });

  tiktok.on('gift', (data) => {
    // Compatibilidade com v1 e v2
    const giftType = data.giftType !== undefined ? data.giftType : (data.gift && data.gift.type) || 1;
    const repeatEnd = data.repeatEnd !== undefined ? data.repeatEnd : true; // Se não tiver repeatEnd, assume true para registrar
    const diamonds = data.diamondCount || (data.gift && data.gift.diamondCount) || 1;
    const repeats = data.repeatCount || data.comboCount || 1;

    const userId = data.uniqueId || (data.user && data.user.displayId) || 'usuario';
    const name = data.nickname || (data.user && data.user.nickname) || userId;
    const avatarUrl = data.profilePictureUrl || (data.user && data.user.avatarThumb && data.user.avatarThumb.urlList && data.user.avatarThumb.urlList[0]) || '';

    if (giftType === 1 && !repeatEnd) return;

    emitter.emit('gift', {
      userId,
      name,
      avatarUrl,
      value: diamonds * repeats,
    });
  });

  tiktok.on('member', (data) => {
    const userId = data.user?.uniqueId || data.uniqueId || 'usuario';
    const name = data.user?.nickname || data.nickname || userId;
    const avatarUrl = data.user?.avatarThumb?.urlList?.[0] || data.profilePictureUrl || '';

    emitter.emit('join', { userId, name, avatarUrl });
  });

  tiktok.on('disconnected', () => {
    console.warn('[tiktok] desconectado.');
  });

  return { emitter, promise, disconnect: () => tiktok.disconnect() };
}

module.exports = { startTiktokListener };
