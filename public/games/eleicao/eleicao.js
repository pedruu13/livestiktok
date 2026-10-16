// Jogo Eleição ao Vivo - Urna Eletrônica Interativa (Otimizado sem Canvas)

const state = {
  votes22: 0,
  votes13: 0,
  roundDuration: 274, // 04:34
  roundEndsAt: Date.now() + 274 * 1000,
  isEnding: false
};

// Síntese de Som da Urna Eletrônica (Web Audio API)
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Bip curto de digitação do teclado
function playKeyBeep() {
  try {
    const actx = getAudioContext();
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1050, actx.currentTime);
    gain.gain.setValueAtTime(0.12, actx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(actx.destination);
    osc.start();
    osc.stop(actx.currentTime + 0.07);
  } catch (e) {}
}

// Som de CONFIRMA da urna brasileira ("pilililili")
function playConfirmaSound() {
  try {
    const actx = getAudioContext();
    const now = actx.currentTime;

    // Tom 1: 750 Hz
    const osc1 = actx.createOscillator();
    const gain1 = actx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(750, now);
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.setValueAtTime(0.18, now + 0.12);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc1.connect(gain1);
    gain1.connect(actx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Tom 2: 1100 Hz
    const osc2 = actx.createOscillator();
    const gain2 = actx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1100, now + 0.15);
    gain2.gain.setValueAtTime(0.22, now + 0.15);
    gain2.gain.setValueAtTime(0.22, now + 0.55);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(actx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.65);
  } catch (e) {}
}

// Filas de animação das mãos
let queue22 = 0;
let isAnimating22 = false;

let queue13 = 0;
let isAnimating13 = false;

function bumpRose(candidate) {
  const el = document.getElementById(`fixed-rose-${candidate}`);
  if (el) {
    el.classList.remove('bump');
    void el.offsetWidth; // trigger reflow
    el.classList.add('bump');
  }
}

function triggerVote22(voterName = 'Espectador', amount = 1) {
  state.votes22 += amount;
  updateScoreboard();
  addChatBubble(voterName, 22);
  bumpRose(22);

  const mult = document.getElementById('mult-22');
  if (mult) mult.textContent = `x${state.votes22}`;

  queue22 += amount;
  if (!isAnimating22) {
    processHand22();
  }
}

function processHand22() {
  if (queue22 <= 0) {
    isAnimating22 = false;
    return;
  }
  isAnimating22 = true;
  queue22 = Math.max(0, queue22 - 1);

  const hand = document.getElementById('hand-22');
  const tapEffect = document.getElementById('tap-effect-22');
  const floatPoint = document.getElementById('float-point-22');

  // 1. Mão sobe até o teclado
  hand.classList.add('typing');
  playKeyBeep();

  setTimeout(() => {
    // 2. Mão aperta a tecla
    hand.classList.add('tap-down');
    tapEffect.classList.add('active');

    setTimeout(() => {
      // 3. Aperta o verde (Confirma)
      tapEffect.classList.add('confirma-green');
      playConfirmaSound();

      // Ponto flutuante
      floatPoint.classList.add('active');
      setTimeout(() => floatPoint.classList.remove('active'), 400);

      setTimeout(() => {
        // 4. Mão desce suavemente
        tapEffect.classList.remove('active', 'confirma-green');
        hand.classList.remove('tap-down', 'typing');

        setTimeout(() => {
          processHand22();
        }, 120);
      }, 160);
    }, 100);
  }, 120);
}

function triggerVote13(voterName = 'Espectador', amount = 1) {
  state.votes13 += amount;
  updateScoreboard();
  addChatBubble(voterName, 13);
  bumpRose(13);

  const mult = document.getElementById('mult-13');
  if (mult) mult.textContent = `x${state.votes13}`;

  queue13 += amount;
  if (!isAnimating13) {
    processHand13();
  }
}

function processHand13() {
  if (queue13 <= 0) {
    isAnimating13 = false;
    return;
  }
  isAnimating13 = true;
  queue13 = Math.max(0, queue13 - 1);

  const hand = document.getElementById('hand-13');
  const tapEffect = document.getElementById('tap-effect-13');
  const floatPoint = document.getElementById('float-point-13');

  // 1. Mão sobe até o teclado
  hand.classList.add('typing');
  playKeyBeep();

  setTimeout(() => {
    // 2. Mão aperta a tecla
    hand.classList.add('tap-down');
    tapEffect.classList.add('active');

    setTimeout(() => {
      // 3. Aperta Confirma
      tapEffect.classList.add('confirma-green');
      playConfirmaSound();

      // Ponto flutuante
      floatPoint.classList.add('active');
      setTimeout(() => floatPoint.classList.remove('active'), 400);

      setTimeout(() => {
        // 4. Mão desce suavemente
        tapEffect.classList.remove('active', 'confirma-green');
        hand.classList.remove('tap-down', 'typing');

        setTimeout(() => {
          processHand13();
        }, 120);
      }, 160);
    }, 100);
  }, 120);
}

// Atualiza placar completo e badges
function updateScoreboard() {
  const v22 = state.votes22;
  const v13 = state.votes13;
  const total = v22 + v13;
  const diff = Math.abs(v22 - v13);

  const safeTotal = Math.max(total, 1);
  const pct22 = total === 0 ? 50.0 : ((v22 / safeTotal) * 100);
  const pct13 = total === 0 ? 50.0 : ((v13 / safeTotal) * 100);

  // Números
  document.getElementById('votes-22').textContent = v22;
  document.getElementById('votes-13').textContent = v13;
  document.getElementById('count-22').textContent = `${v22} votos`;
  document.getElementById('count-13').textContent = `${v13} votos`;

  // Porcentagens
  document.getElementById('pct-22').textContent = `${pct22.toFixed(1).replace('.', ',')}%`;
  document.getElementById('pct-13').textContent = `${pct13.toFixed(1).replace('.', ',')}%`;

  // Barras
  document.getElementById('bar-22').style.width = `${pct22}%`;
  document.getElementById('bar-13').style.width = `${pct13}%`;

  // Topo: Total e Diferença
  document.getElementById('total-votes').textContent = total;
  document.getElementById('diff-votes').textContent = diff;

  // Badge do Líder
  const leaderPill = document.getElementById('leader-pill');
  const crown22 = document.getElementById('crown-22');
  const crown13 = document.getElementById('crown-13');

  if (v22 > v13) {
    leaderPill.className = 'leader-pill pill-blue';
    leaderPill.textContent = '22 NA FRENTE';
    crown22.classList.remove('hidden');
    crown13.classList.add('hidden');
  } else if (v13 > v22) {
    leaderPill.className = 'leader-pill pill-red';
    leaderPill.textContent = '13 NA FRENTE';
    crown22.classList.add('hidden');
    crown13.classList.remove('hidden');
  } else {
    leaderPill.className = 'leader-pill pill-tie';
    leaderPill.textContent = 'EMPATE';
    crown22.classList.add('hidden');
    crown13.classList.add('hidden');
  }
}

// Chat de Votantes na tela
const chatStream = document.getElementById('chat-stream');

function addChatBubble(name, voteNum) {
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';

  const voteClass = voteNum === 22 ? 'bubble-vote-22' : 'bubble-vote-13';
  const icon = voteNum === 22 ? '⭐' : '🌹';

  bubble.innerHTML = `
    <div class="bubble-avatar">${icon}</div>
    <span class="bubble-name">${escapeHtml(name)}</span>
    <span class="${voteClass}">${voteNum}</span>
  `;

  chatStream.appendChild(bubble);

  // Mantém no máximo 5 mensagens
  if (chatStream.children.length > 5) {
    chatStream.removeChild(chatStream.firstElementChild);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Timer e Fim de Rodada
function updateTimer() {
  const remaining = Math.max(0, Math.round((state.roundEndsAt - Date.now()) / 1000));
  const m = String(Math.floor(remaining / 60)).padStart(2, '0');
  const s = String(remaining % 60).padStart(2, '0');
  document.getElementById('timer').textContent = `${m}:${s}`;

  if (remaining === 0 && !state.isEnding) {
    announceWinner();
  }
}

function announceWinner() {
  state.isEnding = true;
  const v22 = state.votes22;
  const v13 = state.votes13;

  const winner = v22 >= v13 ? 22 : 13;
  const modal = document.getElementById('winner-modal');
  const title = document.getElementById('winner-title');
  const score = document.getElementById('winner-score');

  title.textContent = `CANDIDATO ${winner} ELEITO! 🏆`;
  score.textContent = `Resultado: 22 com ${v22} votos vs 13 com ${v13} votos`;
  modal.classList.remove('hidden');

  bumpRose(winner);
  playConfirmaSound();

  // Reinicia automaticamente em 8 segundos sem travar a live
  setTimeout(() => {
    modal.classList.add('hidden');
    resetRound();
    state.isEnding = false;
  }, 8000);
}

function resetRound() {
  state.votes22 = 0;
  state.votes13 = 0;
  state.roundEndsAt = Date.now() + state.roundDuration * 1000;
  updateScoreboard();
  chatStream.innerHTML = '';
  const m22 = document.getElementById('mult-22');
  const m13 = document.getElementById('mult-13');
  if (m22) m22.textContent = 'x1';
  if (m13) m13.textContent = 'x1';
}

// Timer Loop leve (1 segundo)
setInterval(updateTimer, 500);

// Conexão WebSocket com o Backend
function connectWebSocket() {
  const ws = new WebSocket(`ws://${location.host}/ws`);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'change-game') {
        window.location.href = data.url;
        return;
      }

      if (state.isEnding) return;

      // 1. COMENTÁRIOS DE VOTO
      if (data.type === 'chat') {
        const rawText = data.comment || data.text || data.msg || "";
        const name = data.nickname || data.name || data.uniqueId || 'Espectador';
        const text = rawText.toLowerCase().trim();

        if (text.includes('22') || text.includes('mito') || text.includes('bolsonaro')) {
          triggerVote22(name, 1);
        } else if (text.includes('13') || text.includes('lula') || text.includes('faz o l')) {
          triggerVote13(name, 1);
        }
      }

      // 2. CURTIDAS (LIKES)
      if (data.type === 'like') {
        const count = data.likeCount || 1;
        // Curtidas ajudam quem está perdendo para deixar a live emocionante
        if (state.votes22 <= state.votes13) {
          triggerVote22('Live Curtidas', Math.min(count, 2));
        } else {
          triggerVote13('Live Curtidas', Math.min(count, 2));
        }
      }

      // 3. PRESENTES (GIFTS)
      if (data.type === 'gift') {
        const rawText = (data.comment || data.text || data.giftName || "").toLowerCase();
        const giftVal = data.diamondCount || data.value || 1;
        const name = data.nickname || data.name || data.uniqueId || 'Apoiador VIP';

        const points = Math.max(2, Math.ceil(giftVal * 2));

        if (rawText.includes('13') || rawText.includes('lula')) {
          triggerVote13(name, points);
        } else if (rawText.includes('22') || rawText.includes('mito')) {
          triggerVote22(name, points);
        } else {
          // Se não mencionar, apoia quem está atrás
          if (state.votes22 <= state.votes13) {
            triggerVote22(name, points);
          } else {
            triggerVote13(name, points);
          }
        }
      }

    } catch (err) {
      console.error('[Urna WS] Erro:', err);
    }
  };

  ws.onclose = () => {
    setTimeout(connectWebSocket, 2000);
  };
}

connectWebSocket();
updateScoreboard();
