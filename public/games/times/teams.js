// Jogo de Times - Presentes aumentam pontos do time

const teams = new Map(); // { teamName: { points, members: [], color } }
const roundSeconds = 300; // 5 minutos por rodada
let roundEndsAt = Date.now() + roundSeconds * 1000;
let lastT = performance.now();

const teamColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];

class Team {
  constructor(name, color) {
    this.name = name;
    this.points = 0;
    this.color = color;
    this.members = [];
  }

  addPoints(amount) {
    this.points += amount;
  }

  addMember(userId, userName) {
    if (!this.members.find(m => m.id === userId)) {
      this.members.push({ id: userId, name: userName });
    }
  }
}

function getOrCreateTeam(teamName) {
  if (!teams.has(teamName)) {
    const color = teamColors[teams.size % teamColors.length];
    teams.set(teamName, new Team(teamName, color));
  }
  return teams.get(teamName);
}

function connectWs() {
  const ws = new WebSocket(`ws://${location.host}/ws`);

  ws.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data);

      if (data.type === 'change-game') {
        window.location.href = data.url;
      }

      // Detecta o nome do time do comentário (primeira palavra)
      if (data.type === 'chat') {
        const teamName = extractTeamName(data.text) || 'Time Padrão';
        const team = getOrCreateTeam(teamName);
        team.addMember(data.userId, data.name);
        team.addPoints(1);
      }

      if (data.type === 'gift') {
        const teamName = extractTeamName(data.text) || 'Time Padrão';
        const team = getOrCreateTeam(teamName);
        team.addMember(data.userId, data.name);
        team.addPoints(data.value * 10);
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
    document.getElementById('status').textContent = 'Conectado ✅';
  };
}

function extractTeamName(text) {
  if (!text) return null;
  return text.trim().split(/\s+/)[0];
}

function renderScoreboard() {
  const sb = document.getElementById('teams-scoreboard');
  const sorted = Array.from(teams.values()).sort((a, b) => b.points - a.points);

  sb.innerHTML = sorted
    .map((team, idx) => {
      const pct = Math.max(sorted[0].points, 100); // normaliza pra 100 mínimo
      const width = (team.points / pct) * 100;
      return `
        <div class="team-bar">
          <div class="team-rank">${idx + 1}º</div>
          <div class="team-info">
            <span class="team-name">${team.name}</span>
            <span class="team-members">${team.members.length} ${team.members.length === 1 ? 'membro' : 'membros'}</span>
          </div>
          <div class="team-bar-container">
            <div class="team-bar-fill" style="width: ${width}%; background-color: ${team.color};"></div>
          </div>
          <div class="team-points">${team.points}</div>
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
  }
}

function announceWinner() {
  if (teams.size === 0) return;
  const winner = Array.from(teams.values()).sort((a, b) => b.points - a.points)[0];
  alert(`🏆 ${winner.name} VENCEU com ${winner.points} pontos!`);
}

function loop() {
  renderScoreboard();
  renderTimer();
  requestAnimationFrame(loop);
}

connectWs();
requestAnimationFrame(loop);
