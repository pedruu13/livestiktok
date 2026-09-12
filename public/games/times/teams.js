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

const teams = new Map(); // { key: Team }
const roundSeconds = 300; // 5 minutos por rodada
let roundEndsAt = Date.now() + roundSeconds * 1000;
const ATTACKS_FOR_GOAL = 20;

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

// Criar times iniciais para não ficar vazio:
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

      // Comentário = Pressão (Ataque)
      if (data.type === 'chat') {
        const teamKey = findTeamByAlias(data.text);
        if (teamKey) {
          const team = getOrCreateTeam(teamKey);
          team.addMember(data.userId);
          team.addAttack();
        }
      }

      // Presente = Gol Direto! (1 moeda = 1 gol)
      if (data.type === 'gift') {
        const teamKey = findTeamByAlias(data.text);
        if (teamKey) {
          const team = getOrCreateTeam(teamKey);
          team.addMember(data.userId);
          team.addGoal(data.value || 1);
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

  sb.innerHTML = sorted
    .map((team, idx) => {
      const progressPct = (team.attacks / ATTACKS_FOR_GOAL) * 100;
      return `
        <div class="team-bar" style="border-left-color: ${team.color}">
          <div class="team-rank">${idx + 1}º</div>
          <div class="team-info">
            <span class="team-name" style="color: ${team.color}">${team.name}</span>
            <span class="team-members">${team.members.size} torcedores</span>
          </div>
          <div class="team-bar-container">
            <div class="team-bar-fill" style="width: ${progressPct}%;">PRESSÃO ${team.attacks}/${ATTACKS_FOR_GOAL}</div>
          </div>
          <div class="team-goals">
            <span class="goals-number">${team.goals}</span>
            <span class="goals-label">GOLS</span>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderTimer() {
  const remaining = Math.max(0, Math.round((roundEndsAt - Date.now()) / 1000));
  const m = String(Math.floor(remaining / 60)).padStart(2, '0');
  const s = String(remaining % 60).padStart(2, '0');
  document.getElementById('timer').textContent = `${m}:${s}`;

  if (remaining === 0) {
    announceWinner();
    roundEndsAt = Date.now() + roundSeconds * 1000;
    teams.clear();
    // Recria os times base
    getOrCreateTeam('flamengo');
    getOrCreateTeam('corinthians');
  }
}

function announceWinner() {
  if (teams.size === 0) return;
  const sorted = Array.from(teams.values()).sort((a, b) => b.goals - a.goals);
  const winner = sorted[0];
  alert(`🏆 ${winner.name} VENCEU A COPA TIKTOK COM ${winner.goals} GOLS!`);
}

function loop() {
  renderScoreboard();
  renderTimer();
  requestAnimationFrame(loop);
}

connectWs();
requestAnimationFrame(loop);
