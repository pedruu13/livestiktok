const statusEl = document.getElementById('status');
const bolsoChar = document.getElementById('bolso-char');
const lulaChar = document.getElementById('lula-char');
const hpBolsoEl = document.getElementById('hp-bolso');
const hpLulaEl = document.getElementById('hp-lula');
const pctBolsoEl = document.getElementById('pct-bolso');
const pctLulaEl = document.getElementById('pct-lula');
const hitFx = document.getElementById('hit-fx');
const gameContainer = document.getElementById('game-container');

// Audios
const audioPunch = new Audio('https://cdn.pixabay.com/download/audio/2022/03/15/audio_24e2ff1dc1.mp3?filename=punch-140236.mp3'); 
// (Fallback to a basic hit sound, can be replaced by user)

// Estado
let hpBolso = 100;
let hpLula = 100;
let hitsBolso = 0; // Comentários pro Bolsonaro
let hitsLula = 0;  // Comentários pro Lula
const HITS_PER_PERCENT = 10;
let isGameOver = false;

// Conexão WebSockets
const ws = new WebSocket('ws://' + location.host + '/ws');

ws.onopen = () => {
  statusEl.textContent = 'Conectado! Valendo!';
  statusEl.style.color = '#10b981';
};

ws.onclose = () => {
  statusEl.textContent = 'Desconectado. Aguarde...';
  statusEl.style.color = '#ef4444';
};

ws.onmessage = (event) => {
  if (isGameOver) return;
  const data = JSON.parse(event.data);

  if (data.type === 'chat') {
    handleChat(data.comment.toLowerCase());
  } else if (data.type === 'gift') {
    handleGift(data.giftName, data.diamondCount || data.value || 1);
  }
};

function handleChat(text) {
  if (text.includes('mito') || text.includes('22') || text.includes('bolsonaro')) {
    hitsBolso++;
    if (hitsBolso >= HITS_PER_PERCENT) {
      hitsBolso = 0;
      doDamage('lula', 1);
      animateAttack('bolso');
    }
  } else if (text.includes('lula') || text.includes('13') || text.includes('faz o l')) {
    hitsLula++;
    if (hitsLula >= HITS_PER_PERCENT) {
      hitsLula = 0;
      doDamage('bolso', 1);
      animateAttack('lula');
    }
  }
}

function handleGift(giftName, diamonds) {
  // Presentes = Dano Direto Esmagador (Especial)
  // Cada 1 diamante tira 1% de HP (ou podemos ajustar)
  // Como presentes são raros e caros, 1 diamante = 1% é muito forte (ex: rosa = 1%).
  // Vamos fazer: 1 presente = dano aleatório de 10% a 20% para ficar emocionante.
  
  // Quem ganhou o presente? O último que atacou mais ganha o bônus, ou o dono da live decide.
  // Vamos sortear ou basear no "time" atual do usuário?
  // Na ausência de times rígidos como no futebol, o presente pode curar quem tá perdendo ou atacar aleatoriamente.
  // Vamos fazer com que o presente cause um SUPER DANO no que estiver ganhando (Mecânica de reviravolta).
  
  const target = hpBolso > hpLula ? 'bolso' : 'lula';
  const attacker = target === 'bolso' ? 'lula' : 'bolso';
  
  const damage = Math.min(25, diamonds * 2); // Cap em 25% por presente para não acabar instantaneamente
  
  doDamage(target, damage);
  animateAttack(attacker, true);
}

function animateAttack(attackerId, isSpecial = false) {
  const attackerEl = attackerId === 'bolso' ? bolsoChar : lulaChar;
  const targetEl = attackerId === 'bolso' ? lulaChar : bolsoChar;
  
  attackerEl.classList.add('attacking');
  
  setTimeout(() => {
    // Impacto
    audioPunch.currentTime = 0;
    audioPunch.play().catch(e=>console.log(e));
    
    targetEl.classList.add('hit');
    gameContainer.classList.add('shake-screen');
    
    hitFx.style.left = attackerId === 'bolso' ? '55%' : '40%';
    hitFx.classList.remove('hidden');
    
    setTimeout(() => {
      attackerEl.classList.remove('attacking');
      targetEl.classList.remove('hit');
      gameContainer.classList.remove('shake-screen');
      hitFx.classList.add('hidden');
    }, 350);
  }, 100);
}

function doDamage(targetId, amount) {
  if (targetId === 'bolso') {
    hpBolso = Math.max(0, hpBolso - amount);
    hpBolsoEl.style.width = hpBolso + '%';
    pctBolsoEl.textContent = hpBolso + '%';
  } else {
    hpLula = Math.max(0, hpLula - amount);
    hpLulaEl.style.width = hpLula + '%';
    pctLulaEl.textContent = hpLula + '%';
  }

  checkWin();
}

function checkWin() {
  if (hpBolso <= 0 || hpLula <= 0) {
    isGameOver = true;
    const winner = hpBolso > 0 ? 'BOLSONARO' : 'LULA';
    
    setTimeout(() => announceWinner(winner), 500);
  }
}

function announceWinner(winnerName) {
  const modal = document.getElementById('winner-modal');
  document.getElementById('winner-name').textContent = winnerName + ' VENCEU!';
  modal.classList.remove('hidden');
  
  // Reseta automaticamente depois de 8 segundos (para lives 24h)
  setTimeout(() => {
    modal.classList.add('hidden');
    resetGame();
  }, 8000);
}

function resetGame() {
  hpBolso = 100;
  hpLula = 100;
  hitsBolso = 0;
  hitsLula = 0;
  
  hpBolsoEl.style.width = '100%';
  pctBolsoEl.textContent = '100%';
  
  hpLulaEl.style.width = '100%';
  pctLulaEl.textContent = '100%';
  
  isGameOver = false;
}
