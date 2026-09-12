// Launcher - Menu de seleção de jogos

document.querySelectorAll('.game-card').forEach((card) => {
  card.querySelector('.play-btn').addEventListener('click', () => {
    const game = card.dataset.game;
    loadGame(game);
  });
});

function loadGame(gameName) {
  // Mapeia o nome do jogo pra a URL correta
  const games = {
    pipas: '/games/pipas/',
    times: '/games/times/',
    'gift-rain': '/games/gift-rain/',
  };

  const gameUrl = games[gameName];
  if (gameUrl) {
    window.location.href = gameUrl;
  }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === '1') loadGame('pipas');
  if (e.key === '2') loadGame('times');
  if (e.key === '3') loadGame('gift-rain');
  if (e.key === 'Escape') console.log('Press 1, 2, or 3 to select a game, or click above');
});


// Recebe comandos do Painel para trocar de jogo no OBS
const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(${protocol}///ws);
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'change-game') {
    window.location.href = msg.url;
  }
};
