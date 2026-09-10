// ---------- Config ----------
const ROUND_SECONDS = 90;
const CROSS_DISTANCE = 20; // Reduzido (antes era 40) para precisar cruzar mais de perto
const SAW_THRESHOLD = 60;
const CATCH_DISTANCE = 35;
const CATCH_WINDOW_MS = 2500;
const RISE_PER_POWER = 2.5; // Aumentado (antes era 0.3) para subirem de verdade
const TRAIL_LENGTH = 14;

// ---------- Setup do canvas ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const leaderboardEl = document.getElementById('leaderboard');
const timerEl = document.getElementById('timer');

// Efeitos Sonoros (SFX)
const sfxSpawn = new Audio('https://www.soundjay.com/button/sounds/button-10.mp3');
sfxSpawn.volume = 0.4;
const sfxCut = new Audio('https://www.soundjay.com/misc/sounds/whoosh-3.mp3');
sfxCut.volume = 0.6;
const sfxGift = new Audio('https://www.soundjay.com/misc/sounds/magic-chime-01.mp3');
sfxGift.volume = 0.5;
const sfxSpawn = new Audio('https://www.soundjay.com/misc/sounds/pop-1.mp3');
sfxSpawn.volume = 0.3;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// ---------- Estado do jogo ----------
const kites = new Map();
let fallenKites = [];
let roundEndsAt = Date.now() + ROUND_SECONDS * 1000;
let lastT = performance.now();

const BODY_COLORS = ['#3b2f5e', '#4a2f45', '#2f3c52', '#3f2b4a', '#2b3f45'];

class Kite {
  constructor(userId, name, avatarUrl) {
    this.userId = userId;
    this.name = name;
    this.power = 0;
    this.cuts = 0;
    this.trophies = 0;
    this.alive = true;
    this.anchorX = 60 + Math.random() * (window.innerWidth - 120);
    this.x = this.anchorX;
    this.prevX = this.x;
    this.y = window.innerHeight - 100; // Nasce um pouco mais alta (antes era -20)
    this.targetY = this.y;
    this.angle = 0; // inclinação visual (banking) conforme se move
    this.phase = Math.random() * Math.PI * 2;
    this.lastActive = performance.now();
    this.cutFlashUntil = 0;
    this.shieldUntil = 0; // Tempo de invencibilidade ganho por presentes
    this.bodyColor = BODY_COLORS[Math.floor(Math.random() * BODY_COLORS.length)];

    this.target = null;
    this.sawProgress = 0;
    this.chasing = null;
    this.debicarUntil = 0;
    this.debicarDx = 0;

    this.trail = []; // rastro da ponta de baixo, pra desenhar a rabiola ondulando

    this.img = new Image();
    this.img.crossOrigin = 'anonymous';
    this.img.src = avatarUrl || '';
  }

  addPower(amount) {
    this.power += amount;
    this.targetY = Math.max(
      100, // Margem do topo para não ficar por trás do placar
      window.innerHeight - 150 - (this.power * 4.0) // Sobe 4 pixels para CADA ponto de poder!
    );

    // Presentes (qualquer valor >= 5) dão 6 segundos de ESCUDO INVENCÍVEL
    if (amount >= 5) {
      this.shieldUntil = performance.now() + 6000;
      sfxGift.currentTime = 0;
      sfxGift.play().catch(()=>{});
    }
  }

  update(t, dt) {
    if (!this.alive) return;
    this.prevX = this.x;

    // Movimento vertical (sobe/desce) MUITO mais suave (cerca de 8% por frame)
    this.y += (this.targetY - this.y) * (1 - Math.pow(0.92, dt));

    if (this.chasing && fallenKites.includes(this.chasing)) {
      // Persegue a rabiola suavemente (10% por frame)
      this.x += (this.chasing.x - this.x) * (1 - Math.pow(0.90, dt));
    } else {
      this.chasing = null;

      if (!this.target || !this.target.alive) {
        this.target = pickTarget(this);
      }

      if (this.target) {
        if (t > this.debicarUntil) {
          // Aumentado o intervalo de ataques (agora entre 2.5s e 4.5s)
          this.debicarUntil = t + 2500 + Math.random() * 2000;
          this.debicarDx = Math.sign(this.target.x - this.x) * (30 + Math.random() * 40);
        }
        // Desbicão (ataque lateral) SUAVE (cerca de 4% por frame, em vez de 45%)
        this.x += ((this.target.x + this.debicarDx) - this.x) * (1 - Math.pow(0.96, dt));

        const dist = Math.hypot(this.x - this.target.x, this.y - this.target.y);
        if (dist < CROSS_DISTANCE) {
          const now = performance.now();
          const myShield = now < this.shieldUntil;
          const targetShield = now < this.target.shieldUntil;

          if (myShield && !targetShield) {
            // Atacante com presente ativo -> CORTA NA HORA (INVENCÍVEL)
            cutKite(this, this.target);
          } else if (targetShield && !myShield) {
            // Alvo com presente ativo -> DEFENDE E CORTA O ATACANTE NA HORA
            cutKite(this.target, this);
          } else {
            // Vantagem Exponencial para quem tem mais presentes
            const myPowerSq = Math.pow(this.power + 10, 2);
            const targetPowerSq = Math.pow(this.target.power + 10, 2);
            const myChance = myPowerSq / (myPowerSq + targetPowerSq);

            if (Math.random() < myChance) {
              cutKite(this, this.target);
            } else {
              cutKite(this.target, this);
            }
          }
          this.target = null;
        }
      } else {
        // Voo mais livre pela tela se não tiver alvo
        const wanderX = this.anchorX + Math.sin(t / 900 + this.phase) * 150;
        this.x += (wanderX - this.x) * (1 - Math.pow(0.96, dt));
      }
    }

    // inclina a pipa na direção do movimento (banking), também suavizado
    const vx = this.x - this.prevX;
    const targetAngle = Math.max(-0.5, Math.min(0.5, vx * 0.08));
    this.angle += (targetAngle - this.angle) * (1 - Math.pow(0.85, dt));

    // guarda posição da ponta de baixo pra desenhar a rabiola ondulando
    this.trail.unshift({ x: this.x, y: this.y + 34 });
    if (this.trail.length > TRAIL_LENGTH) this.trail.pop();
  }

  draw(t) {
    const isCutFlash = t < this.cutFlashUntil;

    // linha (string) até o chão, com leve curva de vento
    ctx.strokeStyle = isCutFlash ? '#ff4d4d' : 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(this.anchorX, window.innerHeight);
    ctx.quadraticCurveTo(this.x, (this.y + window.innerHeight) / 2, this.x, this.y + 22);
    ctx.stroke();

    // rabiola ondulando, seguindo o rastro da pipa (desenha antes do corpo)
    if (this.trail.length > 2) {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        const p = this.trail[i];
        const prev = this.trail[i - 1];
        ctx.quadraticCurveTo(prev.x, prev.y, (p.x + prev.x) / 2, (p.y + prev.y) / 2);
      }
      ctx.stroke();
      // laçinhos coloridos ao longo da rabiola
      for (let i = 2; i < this.trail.length; i += 4) {
        const p = this.trail[i];
        ctx.fillStyle = i % 8 === 2 ? '#d85a30' : '#f0997b';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const size = 34;
    ctx.save();
    ctx.translate(this.x, this.y);
    
    // 1. TAMANHO: Pipa fica até 60% maior baseada no poder (ostentação)
    const scale = 1 + Math.min(this.power / 1000, 0.6);
    ctx.scale(scale, scale);
    ctx.rotate(this.angle);
    
    // 2. AURA DE CEROL: Brilha dependendo do nível de força
    let auraColor = 'transparent';
    if (this.power > 500) auraColor = '#ff3333';      // Fogo/Metálico (Top Tier)
    else if (this.power > 250) auraColor = '#ffd166'; // Dourado (Linha Indonésia)
    else if (this.power > 100) auraColor = '#a87ffb'; // Roxo (Chileno)
    else if (this.power > 30) auraColor = '#4ca1af';  // Azul (Comum)

    if (auraColor !== 'transparent') {
      ctx.shadowColor = auraColor;
      ctx.shadowBlur = 15 + Math.random() * 5; // Pulsa levemente
    }

    const skin = getKiteSkin(this.power, this.bodyColor);

    // corpo da pipa (estilo Raia/Flecha de Pipa Combate com Skins)
    const grad = ctx.createLinearGradient(0, -size, 0, size);
    grad.addColorStop(0, skin.tip); // ponta clara/neon
    grad.addColorStop(1, skin.base); // base da skin

    ctx.beginPath();
    ctx.moveTo(0, -size * 1.2); // bico mais longo
    ctx.lineTo(size * 0.8, -size * 0.2); // lateral
    ctx.lineTo(0, size); // base (rabiola)
    ctx.lineTo(-size * 0.8, -size * 0.2); // lateral
    ctx.closePath();
    
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = skin.outline;
    ctx.stroke();

    // hastes internas (vareta envergada e central mudando de cor)
    ctx.strokeStyle = skin.sticks;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -size * 1.2); ctx.lineTo(0, size); // vareta central
    // vareta envergada (curva)
    ctx.moveTo(-size * 0.8, -size * 0.2);
    ctx.quadraticCurveTo(0, -size * 0.6, size * 0.8, -size * 0.2);
    ctx.stroke();

    // RABIOLA (Cauda animada que balança com o vento)
    ctx.beginPath();
    ctx.moveTo(0, size); // Começa na base da pipa
    let tailLength = size * (2.5 + Math.min(this.power / 200, 3)); // Cauda cresce com o poder
    
    for (let i = 0; i < tailLength; i += 6) {
      let wave = Math.sin(t * 0.008 - i * 0.06 + this.phase) * (size * 0.4);
      ctx.lineTo(wave, size + i);
    }
    ctx.strokeStyle = skin.tip; // Cor da rabiola combina com os detalhes
    ctx.lineWidth = this.power > 300 ? 3 : 1.5; // Fica mais grossa se for VIP
    ctx.stroke();

    // ESCUDO INVENCÍVEL DE PRESENTE (Anel Dourado Pulsante)
    if (t < this.shieldUntil) {
      ctx.save();
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#ffeaa7';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, size * 1.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (this.power >= 200) {
      ctx.font = '36px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('👑', 0, -size * 0.9 - 15);
    }

    if (this.img.complete && this.img.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, -size * 0.2, size * 0.45, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(this.img, -size * 0.45, -size * 0.65, size * 0.9, size * 0.9);
      ctx.restore();
    }

    if (this.trophies > 0) {
      ctx.beginPath();
      ctx.arc(size * 0.6, -size * 0.7, 14, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd166';
      ctx.fill();
      ctx.fillStyle = '#3c2f52';
      ctx.font = '900 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(this.trophies, size * 0.6, -size * 0.7 + 5);
    }

    ctx.restore();

    ctx.fillStyle = '#fff';
    ctx.font = '900 24px Arial'; // Fonte GIGANTE para celular
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,1)'; // Sombra mais forte
    ctx.shadowBlur = 8;
    ctx.fillText(this.name, this.x, this.y + size + (this.power > 150 ? 50 : 30));
    ctx.shadowBlur = 0;
  }
}

function getKiteSkin(power, baseColor) {
  if (power < 50) return { tip: '#ffffff', base: baseColor, sticks: 'rgba(0,0,0,0.4)', outline: '#333' }; // Comum
  if (power < 150) return { tip: '#a5f3fc', base: '#0284c7', sticks: '#38bdf8', outline: '#0369a1' }; // Rara (Azul Neon)
  if (power < 300) return { tip: '#fbcfe8', base: '#9333ea', sticks: '#e879f9', outline: '#7e22ce' }; // Épica (Roxa)
  if (power < 500) return { tip: '#fef08a', base: '#ea580c', sticks: '#fbbf24', outline: '#9a3412' }; // Lendária (Ouro)
  return { tip: '#fca5a5', base: '#171717', sticks: '#ef4444', outline: '#dc2626' }; // Mítica (Preta/Vermelha)
}

function pickTarget(kite) {
  let best = null;
  let bestDist = Infinity;
  kites.forEach((other) => {
    if (other === kite || !other.alive || other.target === kite) return;
    const dist = Math.hypot(kite.x - other.x, kite.y - other.y);
    if (dist < bestDist) {
      best = other;
      bestDist = dist;
    }
  });
  return best;
}

function getOrCreateKite(userId, name, avatarUrl) {
  let kite = kites.get(userId);
  if (!kite || !kite.alive) {
    // Toca som de pop
    sfxSpawn.currentTime = 0;
    sfxSpawn.play().catch(()=>{});

    kite = new Kite(userId, name, avatarUrl);
    kites.set(userId, kite);
  }
  return kite;
}

function cutKite(winner, loser) {
  loser.alive = false;
  winner.cuts += 1;
  winner.cutFlashUntil = performance.now() + 200;
  sfxCut.currentTime = 0;
  sfxCut.play().catch(()=>{});
  spawnCutParticles(loser.x, loser.y);

  const fallen = { x: loser.x, y: loser.y, vy: 1.2, createdAt: performance.now(), caughtBy: null };
  fallenKites.push(fallen);
  winner.chasing = fallen;
}

function updateFallenKites(dt) {
  const now = performance.now();
  fallenKites = fallenKites.filter((f) => {
    f.y += f.vy * dt;
    f.vy += 0.05 * dt;

    kites.forEach((k) => {
      if (!k.alive || k.chasing !== f) return;
      const dist = Math.hypot(k.x - f.x, k.y - f.y);
      if (dist < CATCH_DISTANCE) {
        k.trophies += 1;
        k.chasing = null;
        f.caughtBy = k;
      }
    });

    const expired = now - f.createdAt > CATCH_WINDOW_MS || f.y > window.innerHeight;
    if (expired || f.caughtBy) {
      kites.forEach((k) => { if (k.chasing === f) k.chasing = null; });
      return false;
    }
    return true;
  });
}

function drawFallenKites() {
  fallenKites.forEach((f) => {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(Math.PI);
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(14, 0);
    ctx.lineTo(0, 18);
    ctx.lineTo(-14, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(140,120,160,0.7)';
    ctx.fill();
    ctx.restore();
  });
}

let floatingTexts = [];
function updateAndDrawFloatingTexts(dt) {
  floatingTexts = floatingTexts.filter(ft => ft.life > 0);
  floatingTexts.forEach(ft => {
    ft.y += ft.vy * dt;
    ft.life -= dt;
    const alpha = Math.max(0, ft.life / 60);
    
    ctx.save();
    ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`; // Texto Dourado
    ctx.font = '900 16px Arial';
    ctx.textAlign = 'center';
    ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.lineWidth = 3;
    ctx.strokeText(ft.text, ft.x, ft.y);
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  });
}

let particles = [];
function spawnCutParticles(x, y) {
  for (let i = 0; i < 18; i++) {
    particles.push({ x, y, vx: (Math.random() - 0.5) * 6, vy: Math.random() * -4 - 1, life: 40 + Math.random() * 20 });
  }
}
function updateAndDrawParticles(dt) {
  particles = particles.filter((p) => p.life > 0);
  particles.forEach((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 0.15 * dt;
    p.life -= dt;
    ctx.fillStyle = `rgba(255,255,255,${Math.max(p.life / 60, 0)})`;
    ctx.fillRect(p.x, p.y, 3, 3);
  });
}

function renderLeaderboard() {
  const top = [...kites.values()]
    .sort((a, b) => (b.trophies - a.trophies) || (b.cuts - a.cuts))
    .slice(0, 3);

  const el = document.getElementById('leaderboard');
  el.innerHTML = top
    .map((k, i) => `
      <div class="lb-row">
        <span class="lb-rank">${i + 1}º</span>
        <img src="${k.img.src}" onerror="this.style.visibility='hidden'" />
        <span>${k.name}</span>
        <span class="lb-cuts">🏆 ${k.trophies}</span>
      </div>
    `)
    .join('');
}

function renderTimer() {
  const remaining = Math.max(0, Math.round((roundEndsAt - Date.now()) / 1000));
  const m = String(Math.floor(remaining / 60)).padStart(2, '0');
  const s = String(remaining % 60).padStart(2, '0');
  document.getElementById('timer').textContent = `${m}:${s}`;

  if (remaining === 0) {
    roundEndsAt = Date.now() + ROUND_SECONDS * 1000;
    kites.clear();
    fallenKites = [];
  }
}

function loop(t) {
  const dt = Math.min(3, (t - lastT) / 16.67);
  lastT = t;

  const now = performance.now();
  let activeKites = Array.from(kites.values()).filter(k => k.alive);
  if (activeKites.length > 30) {
    activeKites.sort((a,b) => (a.power - b.power) || (a.lastActive - b.lastActive));
    activeKites[0].alive = false;
    spawnCutParticles(activeKites[0].x, activeKites[0].y);
  }
  activeKites.forEach(k => {
    if (now - k.lastActive > 60000 && k.power < 50) {
      k.alive = false;
    }
  });

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  kites.forEach((k) => k.update(t, dt));
  updateFallenKites(dt);
  drawFallenKites();
  kites.forEach((k) => k.alive && k.draw(t));
  updateAndDrawParticles(dt);

  renderTimer();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

setInterval(renderLeaderboard, 500);

function connectWs() {
  const ws = new WebSocket(`ws://${location.host}/ws`);
  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.type === 'volume') {
      // Ajusta o volume global baseado no slider do painel de controle
      sfxSpawn.volume = data.value * 0.6; // Som menorzinho
      sfxCut.volume = data.value;
      sfxGift.volume = data.value * 0.8;
    }
    if (data.type === 'gift') {
      const kite = getOrCreateKite(data.userId, data.name, data.avatarUrl);
      kite.addPower(data.value);
    }
    if (data.type === 'chat') {
      const kite = getOrCreateKite(data.userId, data.name, data.avatarUrl);
      kite.addPower(1);
    }
  };
  ws.onclose = () => setTimeout(connectWs, 2000);
}
connectWs();

const DEMO_MODE = new URLSearchParams(location.search).has('demo');
if (DEMO_MODE) {
  const demoNames = ['Ana', 'Bruno', 'Caca', 'Duda', 'Enzo', 'Fefe'];
  setInterval(() => {
    const name = demoNames[Math.floor(Math.random() * demoNames.length)];
    const kite = getOrCreateKite(name, name, `https://i.pravatar.cc/64?u=${name}`);
    kite.addPower(5 + Math.random() * 40);
  }, 600);
}

// ====== SISTEMA DE ARRASTAR E SOLTAR (DRAG & DROP) ======
function makeDraggable(elmnt) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  // Muda o cursor do mouse para a cruzinha de arrastar
  elmnt.style.cursor = 'move';
  // Permite que o elemento receba cliques
  elmnt.style.pointerEvents = 'auto';
  
  elmnt.onmousedown = function(e) {
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    // Quando soltar o mouse, para de arrastar
    document.onmouseup = function() {
      document.onmouseup = null;
      document.onmousemove = null;
    };
    
    // Quando mover o mouse, calcula a nova posição
    document.onmousemove = function(e) {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      
      // Quebra as travas do CSS (transform, right, bottom) para mover livremente
      elmnt.style.transform = 'none';
      elmnt.style.bottom = 'auto';
      elmnt.style.right = 'auto';
      
      // Define o Top e Left acompanhando o mouse
      elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
      elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
    };
  };
}

// Aplica o sistema nos 3 menus da tela
makeDraggable(document.getElementById("hud"));
makeDraggable(document.getElementById("leaderboard"));
makeDraggable(document.getElementById("gift-guide"));
