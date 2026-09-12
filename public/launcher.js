let currentGame = '/games/pipas/';

// Seleção de jogo via clique nos cards
document.querySelectorAll('.game-card').forEach((card) => {
  card.addEventListener('click', () => {
    // Remove active das outras
    document.querySelectorAll('.game-card').forEach(c => c.classList.remove('active'));
    // Adiciona na atual
    card.classList.add('active');
    
    currentGame = card.dataset.game;
    
    // Dispara mudança de jogo pro main.js (já atualiza gameWindow e OBS na hora se tiver conectado)
    if (window.tiktokKite) {
      window.tiktokKite.changeGame(currentGame);
    }
  });
});

// Atalhos de teclado
document.addEventListener('keydown', (e) => {
  if (e.key === '1') document.querySelectorAll('.game-card')[0].click();
  if (e.key === '2') document.querySelectorAll('.game-card')[1].click();
  if (e.key === '3') document.querySelectorAll('.game-card')[2].click();
});

// Lógica de Conexão
document.getElementById('connectBtn').addEventListener('click', () => {
  const user = document.getElementById('username').value.trim();
  if (!user) return alert('Por favor, digite seu usuário do TikTok!');
  
  const st = document.getElementById('status');
  st.innerText = 'Status: Buscando live...';
  st.style.color = '#fff';
  
  if (window.tiktokKite) {
    window.tiktokKite.startConnection(user, currentGame);
  }
});

if (window.tiktokKite) {
  // Status da Conexão
  window.tiktokKite.onConnectionStatus((data) => {
    const st = document.getElementById('status');
    st.innerText = 'Status: ' + data.msg;
    st.style.color = data.success ? '#10b981' : '#ef4444'; // verde ou vermelho
  });

  // Configurações e Testes
  document.getElementById('vol').addEventListener('input', (e) => {
    window.tiktokKite.changeVolume(e.target.value / 100);
  });

  document.getElementById('testChatBtn').addEventListener('click', () => window.tiktokKite.sendTestEvent('chat'));
  document.getElementById('testGiftBtn').addEventListener('click', () => window.tiktokKite.sendTestEvent('gift'));

  document.getElementById('pos-leaderboard').addEventListener('change', (e) => {
    window.tiktokKite.sendOverlayConfig({ target: 'leaderboard', value: e.target.value });
  });
  document.getElementById('pos-gifts').addEventListener('change', (e) => {
    window.tiktokKite.sendOverlayConfig({ target: 'gifts', value: e.target.value });
  });
}
