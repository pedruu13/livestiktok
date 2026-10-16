// Jogo de Eleição - Disputa ao Vivo entre 22 e 13

const candidates = {
  22: { votes: 0, color: '#38bdf8' },
  13: { votes: 0, color: '#ef4444' },
};

const canvas = document.getElementById('rose-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let fallingRoses = [];
const ROUND_SECONDS = 180; // 3 minutos por rodada
let roundEndsAt = Date.now() + ROUND_SECONDS * 1000;
let lastT = performance.now();
let chatMessages = [];
let isRoundEnding = false;

class FallingRose {
  constructor(candidateNumber) {
    this.candidateNumber = candidateNumber;
    this.x = Math.random() * (canvas.width - 40) + 20;
    this.y = -30;
    this.vy = 2 + Math.random() * 3.5;
    this.vx = (Math.random() - 0.5) * 2;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.1;
    this.life = 140;
    this.size = 28 + Math.random() * 12;
  }

  update(dt) {
    this.y += this.vy * dt;
    this.x += this.vx * dt;
    this.rotation += this.rotationSpeed * dt;
    this.life -= dt;
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = Math.max(this.life / 140, 0);
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    ctx.font = `${this.size}px "Segoe UI Emoji", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (this.candidateNumber === 13) {
      ctx.shadowColor = 'rgba(239, 68, 68, 0.8)';
      ctx.shadowBlur = 8;
      ctx.fillText('🌹', 0, 0);
    } else {
      ctx.shadowColor = 'rgba(56, 189, 248, 0.8)';
      ctx.shadowBlur = 8;
      ctx.fillText('⭐', 0, 0);
    }

    ctx.restore();
  }
}

function connectWs() {
  const ws = new WebSocket(`ws://${location.host}/ws`);

  ws.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data);

      if (data.type === 'change-game') {
        window.location.href = data.url;
        return;
      }

      if (isRoundEnding) return;

      // Detecta votos no comentário do chat
      if (data.type === 'chat') {
        const rawText = data.comment || data.text || data.msg || "";
        const name = data.nickname || data.name || data.uniqueId || 'Espectador';
        const text = rawText.toLowerCase().trim();
        let candidateNumber = null;

        if (text.includes('22') || text.includes('mito') || text.includes('bolsonaro')) {
          candidateNumber = 22;
        } else if (text.includes('13') || text.includes('lula') || text.includes('faz o l')) {
          candidateNumber = 13;
        }

        if (candidateNumber) {
          candidates[candidateNumber].votes += 1;
          spawnRose(candidateNumber);
          addChatMessage(name, candidateNumber, 1, 'voto');
        }
      }

      // Curtidas (likes) apoiam o candidato que tem menos votos
      if (data.type === 'like') {
        const count = data.likeCount || 1;
        const candidateNumber = candidates[22].votes <= candidates[13].votes ? 22 : 13;
        candidates[candidateNumber].votes += count;
        for (let i = 0; i < Math.min(count, 3); i++) {
          spawnRose(candidateNumber);
        }
      }

      // Presentes = votos ponderados
      if (data.type === 'gift') {
        const rawText = (data.comment || data.text || data.giftName || "").toLowerCase();
        const giftVal = data.diamondCount || data.value || 1;
        const name = data.nickname || data.name || data.uniqueId || 'Apoiador';

        let candidateNumber = 22;
        if (rawText.includes('13') || rawText.includes('lula')) {
          candidateNumber = 13;
        } else if (rawText.includes('22') || rawText.includes('mito')) {
          candidateNumber = 22;
        } else {
          // Apoia quem está atrás para manter a disputa acirrada
          candidateNumber = candidates[22].votes <= candidates[13].votes ? 22 : 13;
        }

        const voteValue = Math.max(2, Math.ceil(giftVal * 2));
        candidates[candidateNumber].votes += voteValue;

        const spawnCount = Math.min(voteValue, 10);
        for (let i = 0; i < spawnCount; i++) {
          setTimeout(() => spawnRose(candidateNumber), i * 70);
        }

        addChatMessage(name, candidateNumber, voteValue, 'super voto');
      }
    } catch (err) {
      console.error('[Eleicao WS] Erro:', err);
    }
  };

  ws.onclose = () => {
    const st = document.getElementById('status');
    if (st) {
      st.textContent = 'Desconectado. Reconectando...';
      st.style.color = '#ef4444';
    }
    setTimeout(connectWs, 2000);
  };

  ws.onopen = () => {
    const st = document.getElementById('status');
    if (st) {
      st.textContent = 'Conectado! Votação aberta!';
      st.style.color = '#10b981';
    }
  };
}

function spawnRose(candidateNumber) {
  fallingRoses.push(new FallingRose(candidateNumber));
}

function addChatMessage(name, candidateNumber, votes, type) {
  const candidate = candidateNumber === 22 ? '22' : '13';
  const icon = candidateNumber === 22 ? '⭐' : '🌹';
  const teamClass = candidateNumber === 22 ? 'team-22' : 'team-13';
  const msg = `${icon} <strong>${name}</strong> +${votes} voto(s) no <strong>${candidate}</strong>!`;

  chatMessages.unshift({ html: msg, teamClass });
  if (chatMessages.length > 6) chatMessages.pop();

  renderChat();
}

function renderChat() {
  const chatEl = document.getElementById('chat-messages');
  if (!chatEl) return;
  chatEl.innerHTML = chatMessages
    .map((m) => `<div class="chat-msg ${m.teamClass}">${m.html}</div>`)
    .join('');
}

function updateScoreboard() {
  const total = candidates[22].votes + candidates[13].votes;
  const safeTotal = Math.max(total, 1);

  const pct22 = total === 0 ? 50 : Math.round((candidates[22].votes / safeTotal) * 100);
  const pct13 = total === 0 ? 50 : 100 - pct22;

  // Candidato 22
  const v22 = document.getElementById('votes-22');
  const p22 = document.getElementById('percent-22');
  const b22 = document.getElementById('bar-22');
  if (v22) v22.textContent = candidates[22].votes;
  if (p22) p22.textContent = `${pct22}%`;
  if (b22) b22.style.width = `${pct22}%`;

  // Candidato 13
  const v13 = document.getElementById('votes-13');
  const p13 = document.getElementById('percent-13');
  const b13 = document.getElementById('bar-13');
  if (v13) v13.textContent = candidates[13].votes;
  if (p13) p13.textContent = `${pct13}%`;
  if (b13) b13.style.width = `${pct13}%`;
}

function updateTimer() {
  const remaining = Math.max(0, Math.round((roundEndsAt - Date.now()) / 1000));
  const m = String(Math.floor(remaining / 60)).padStart(2, '0');
  const s = String(remaining % 60).padStart(2, '0');
  const timerEl = document.getElementById('timer');
  if (timerEl) timerEl.textContent = `${m}:${s}`;

  if (remaining === 0 && !isRoundEnding) {
    announceWinner();
  }
}

function announceWinner() {
  isRoundEnding = true;
  const winner = candidates[22].votes >= candidates[13].votes ? 22 : 13;
  const loser = winner === 22 ? 13 : 22;

  const modal = document.getElementById('winner-modal');
  const nameEl = document.getElementById('winner-name');
  const detailsEl = document.getElementById('winner-details');

  if (nameEl) nameEl.textContent = `CANDIDATO ${winner} VENCEU! 🏆`;
  if (detailsEl) {
    detailsEl.textContent = `Placar Final: Candidato 22 (${candidates[22].votes}) x Candidato 13 (${candidates[13].votes})`;
  }
  if (modal) modal.classList.remove('hidden');

  // Chuva de comemoração
  for (let i = 0; i < 25; i++) {
    setTimeout(() => spawnRose(winner), i * 100);
  }

  // Reinicia automaticamente em 8 segundos sem travar a live
  setTimeout(() => {
    if (modal) modal.classList.add('hidden');
    resetRound();
    isRoundEnding = false;
  }, 8000);
}

function resetRound() {
  candidates[22].votes = 0;
  candidates[13].votes = 0;
  chatMessages = [];
  fallingRoses = [];
  roundEndsAt = Date.now() + ROUND_SECONDS * 1000;
  updateScoreboard();
  renderChat();
}

function loop(t) {
  const dt = Math.min(3, (t - lastT) / 16.67);
  lastT = t;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  fallingRoses = fallingRoses.filter((r) => {
    r.update(dt);
    r.draw();
    return r.life > 0 && r.y < canvas.height + 50;
  });

  updateScoreboard();
  updateTimer();

  requestAnimationFrame(loop);
}

connectWs();
requestAnimationFrame(loop);
