const BRASILEIRAO = {
  flamengo: { name: 'Flamengo', color: '#C52728', aliases: ['flamengo', 'mengo', 'mengao', 'fla'] },
  corinthians: { name: 'Corinthians', color: '#ffffff', aliases: ['corinthians', 'timao', 'curingao'] },
  palmeiras: { name: 'Palmeiras', color: '#006437', aliases: ['palmeiras', 'verdao', 'porco'] },
  saopaulo: { name: 'São Paulo', color: '#FE0000', aliases: ['sao paulo', 'saopaulo', 'tricolor', 'spfc'] },
  vasco: { name: 'Vasco', color: '#FFFFFF', aliases: ['vasco', 'vascao', 'gigante'] },
  botafogo: { name: 'Botafogo', color: '#FFFFFF', aliases: ['botafogo', 'fogao', 'estrela'] },
  fluminense: { name: 'Fluminense', color: '#9F243A', aliases: ['fluminense', 'flu', 'nense'] },
  gremio: { name: 'Grêmio', color: '#0D80BF', aliases: ['gremio', 'imortal', 'tricolor'] },
  inter: { name: 'Internacional', color: '#E50000', aliases: ['internacional', 'inter', 'colorado'] },
  cruzeiro: { name: 'Cruzeiro', color: '#003A94', aliases: ['cruzeiro', 'cabuloso', 'raposa'] },
  atleticomg: { name: 'Atlético-MG', color: '#FFFFFF', aliases: ['atletico', 'galo', 'mineiro', 'cam'] },
  bahia: { name: 'Bahia', color: '#0054A6', aliases: ['bahia', 'bahea', 'tricolor'] },
  vitoria: { name: 'Vitória', color: '#ED1C24', aliases: ['vitoria', 'leao'] },
  sport: { name: 'Sport', color: '#D30A11', aliases: ['sport', 'leao da ilha'] },
  santos: { name: 'Santos', color: '#FFFFFF', aliases: ['santos', 'peixe', 'santastico'] }
};

const teams = new Map();
const roundSeconds = 300;
let roundEndsAt = Date.now() + roundSeconds * 1000;
const ATTACKS_FOR_GOAL = 20;

// Variáveis para controle de áudio
const audioCache = {};
let lastAudioTime = 0;
const AUDIO_COOLDOWN = 3000;

function playTeamAudio(teamKey) {
  const now = Date.now();
  if (now - lastAudioTime < AUDIO_COOLDOWN) return;
  
  if (!audioCache[teamKey]) {
    audioCache[teamKey] = new Audio(`audio/${teamKey}.mp3`);
    audioCache[teamKey].volume = 0.5;
  }
  
  const audio = audioCache[teamKey];
  audio.currentTime = 0;
  
  audio.play().then(() => {
    lastAudioTime = Date.now();
  }).catch(() => {});
}

class Team {
  constructor(key, data) {
    this.key = key;
    this.name = data.name;
    this.color = data.color;
    this.goals = 0;
    this.attacks = 0;
    this.members = new Set();
  }

  addGoal(amount) {
    this.goals += amount;
  }

  addAttack() {
    this.attacks++;
    if (this.attacks >= ATTACKS_FOR_GOAL) {
      this.goals++;
      this.attacks = 0;
    }
  }

  addMember(userId) {
    this.members.add(userId);
  }
}

function findTeamByAlias(text) {
  if (!text) return null;
  const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  for (const [key, data] of Object.entries(BRASILEIRAO)) {
    for (const alias of data.aliases) {
      if (normalized.includes(alias)) {
        return key;
      }
    }
  }
  return null;
}

function getOrCreateTeam(key) {
  if (!teams.has(key)) {
    teams.set(key, new Team(key, BRASILEIRAO[key]));
  }
  return teams.get(key);
}

// Inicializa times padrão
getOrCreateTeam('flamengo');
getOrCreateTeam('corinthians');

function connectWs() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${location.host || 'localhost:3001'}/ws`);

  ws.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data);

      if (data.type === 'change-game') {
        window.location.href = data.url;
      }

      if (data.type === 'chat') {
        const teamKey = findTeamByAlias(data.text);
        if (teamKey) {
          const team = getOrCreateTeam(teamKey);
          team.addMember(data.userId);
          team.addAttack();
          playTeamAudio(teamKey);
        }
      }

      if (data.type === 'gift') {
        let userTeam = null;
        for (const team of teams.values()) {
          if (team.members.has(data.userId)) {
            userTeam = team;
            break;
          }
        }
        if (userTeam) {
          userTeam.addGoal(data.value || 1);
          playTeamAudio(userTeam.key);
        }
      }
    } catch (err) {
      console.error('[Teams WS] Erro:', err);
    }
  };

  ws.onclose = () => {
    document.getElementById('status').textContent = 'Desconectado. Reconectando em 2s...';
    setTimeout(connectWs, 2000);
  };

  ws.onopen = () => {
    document.getElementById('status').textContent = 'Conectado à live!';
  };
}

function renderScoreboard() {
  const sb = document.getElementById('teams-scoreboard');
  
  const sorted = Array.from(teams.values()).sort((a, b) => {
    if (b.goals !== a.goals) return b.goals - a.goals;
    return b.attacks - a.attacks;
  });

  sb.innerHTML = sorted.map((team, idx) => {
    const progressPct = (team.attacks / ATTACKS_FOR_GOAL) * 100;
    // Opcional: Para times que usam branco como cor principal (Santos/Vasco/Galo), o texto fica legível por causa do shadow
    return `
      <div class="team-card" style="border-left-color: ${team.color}">
        <div class="team-progress" style="width: ${progressPct}%; background-color: ${team.color};"></div>
        <div class="team-content">
          <div class="team-rank">${idx + 1}º</div>
          <div class="team-info">
            <div class="team-name" style="color: ${team.color}">${team.name}</div>
            <div class="team-stats">PRESSÃO: ${team.attacks}/${ATTACKS_FOR_GOAL} • ${team.members.size} Torcedores</div>
          </div>
          <div class="team-score" style="border-color: ${team.color}">
            <span class="score-number">${team.goals}</span>
            <span class="score-label">GOLS</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

let isModalOpen = false;

function renderTimer() {
  if (isModalOpen) return;
  const remaining = Math.max(0, Math.round((roundEndsAt - Date.now()) / 1000));
  const m = String(Math.floor(remaining / 60)).padStart(2, '0');
  const s = String(remaining % 60).padStart(2, '0');
  document.getElementById('timer').textContent = `${m}:${s}`;

  if (remaining === 0) {
    announceWinner();
  }
}

function announceWinner() {
  if (teams.size === 0) return;
  
  isModalOpen = true;
  
  const sorted = Array.from(teams.values()).sort((a, b) => {
    if (b.goals !== a.goals) return b.goals - a.goals;
    return b.attacks - a.attacks;
  });
  const winner = sorted[0];
  
  const modal = document.getElementById('winner-modal');
  const title = document.getElementById('winner-name');
  const desc = document.getElementById('winner-goals');
  
  title.textContent = `🏆 ${winner.name} VENCEU!`;
  title.style.color = winner.color;
  desc.textContent = `Com ${winner.goals} GOLS e ${winner.attacks} ATAQUES!`;
  
  modal.classList.remove('hidden');
  
  // Reseta depois de 5 segundos
  setTimeout(() => {
    modal.classList.add('hidden');
    roundEndsAt = Date.now() + roundSeconds * 1000;
    teams.clear();
    getOrCreateTeam('flamengo');
    getOrCreateTeam('corinthians');
    isModalOpen = false;
  }, 5000);
}

function loop() {
  if (!isModalOpen) {
    renderScoreboard();
    renderTimer();
  }
  requestAnimationFrame(loop);
}

connectWs();
requestAnimationFrame(loop);
