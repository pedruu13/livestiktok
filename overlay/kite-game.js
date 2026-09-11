// ---------- Config ----------
const ROUND_SECONDS = 300; // 5 minutos
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
const sfxSpawn = new Audio('https://actions.google.com/sounds/v1/cartoon/pop.ogg');
sfxSpawn.volume = 0.4;
const sfxCut = new Audio('https://actions.google.com/sounds/v1/cartoon/whip_swipe.ogg');
sfxCut.volume = 0.6;
const sfxGift = new Audio('https://actions.google.com/sounds/v1/cartoon/magic_chime.ogg');
sfxGift.volume = 0.5;

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
    // Adiciona variação aleatória na altura e nasce mais no meio da tela
    this.y = (window.innerHeight * 0.45) + (Math.random() * 80 - 40); 
    this.targetY = this.y;
    this.angle = 0; // inclinação visual (banking) conforme se move
    this.phase = Math.random() * Math.PI * 2;
    this.lastActive = performance.now();
    this.cutFlashUntil = 0;
    this.combatCooldownUntil = 0; // Cooldown após matar alguém
    this.shieldUntil = 0; // Escudo comprado com presentes
    this.spawnInvulnerableUntil = performance.now() + 5000; // 5 SEGUNDOS DE IMUNIDADE AO NASCER
    this.bodyColor = BODY_COLORS[Math.floor(Math.random() * BODY_COLORS.length)];
    
    // NOVO: Design Pipa Combate (Modelos, Estampas e Cores)
    this.model = Math.floor(Math.random() * 4); // 0=Raia, 1=Pipa Clássica/Lápis, 2=Peixinho, 3=Batata/GT
    this.pattern = Math.floor(Math.random() * 4); // 0=Lisa, 1=Meio-a-Meio, 2=Faixa, 3=Cruz
    this.patternColor = `hsl(${Math.random() * 360}, 80%, 50%)`; // Cor do papel secundário

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
    this.lastActive = performance.now(); // PREVINE QUE A PIPA SUMA SE ELE ESTIVER ATIVO
    this.power += amount;
    this.targetY = Math.max(
      100, // Margem do topo para não ficar por trás do placar
      (window.innerHeight * 0.6) - (this.power * 4.0) // Sobe 4 pixels para CADA ponto de poder a partir do meio da tela!
    );

    // Presentes (qualquer valor >= 5) dão 6 segundos de ESCUDO INVENCÍVEL
    if (amount >= 5) {
      this.shieldUntil = performance.now() + 6000;
      sfxGift.currentTime = 0;
      sfxGift.play().catch(()=>{});
      
      floatingTexts.push({
        x: this.x,
        y: this.y - 40,
        text: `🎁 +${amount} (ESCUDO!)`,
        vy: -2.0,
        life: 90
      });
    } else if (amount > 0) {
      floatingTexts.push({
        x: this.x,
        y: this.y - 30,
        text: `+${amount} Força`,
        vy: -1.0,
        life: 60
      });
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
          const myGiftShield = now < this.shieldUntil;
          const targetGiftShield = now < this.target.shieldUntil;
          const mySpawnShield = now < this.spawnInvulnerableUntil;
          const targetSpawnShield = now < this.target.spawnInvulnerableUntil;
          const myCooldown = now < this.combatCooldownUntil;
          const targetCooldown = now < this.target.combatCooldownUntil;

          if (myGiftShield && targetGiftShield) {
            // Empate de presentes (ambas com escudo pago)
            this.target = null;
            this.debicarDx *= -1; // rebate
          } else if (myGiftShield && !targetGiftShield) {
            // Escudo de presente corta QUALQUER UM
            cutKite(this, this.target);
          } else if (targetGiftShield && !myGiftShield) {
            cutKite(this.target, this);
          } else if (mySpawnShield || targetSpawnShield || myCooldown || targetCooldown) {
            // Se alguém é recém-nascido ou está de cooldown (cansado após um corte), a pipa vira "FANTASMA" e apenas REBATE.
            // Ela não morre, mas também NÃO CORTA NINGUÉM. 
            this.target = null;
            this.debicarDx *= -1; 
          } else {
            // Combate Normal Justo: Vantagem Exponencial para quem tem mais poder
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
      ctx.lineWidth = 1.5; // Linha da rabiola mais fina
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        const p = this.trail[i];
        const prev = this.trail[i - 1];
        ctx.quadraticCurveTo(prev.x, prev.y, (p.x + prev.x) / 2, (p.y + prev.y) / 2);
      }
      ctx.stroke();
      
      // NOVO: Fitinhas da rabiola (tiras de plástico transversais)
      for (let i = 2; i < this.trail.length; i += 4) {
        const p = this.trail[i];
        const prev = this.trail[i - 1];
        // Calcula a normal para desenhar as fitas cruzando a linha
        const dx = p.x - prev.x;
        const dy = p.y - prev.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = (-dy / len) * 10; // comprimento da fita (metade)
        const ny = (dx / len) * 10;

        // Cores alternadas das fitinhas (Preto/Branco ou Colorido)
        ctx.strokeStyle = i % 8 === 2 ? '#111' : this.patternColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(p.x - nx, p.y - ny);
        ctx.lineTo(p.x + nx, p.y + ny);
        ctx.stroke();
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

      // corpo da pipa (Diferentes modelos e recortes)
      const grad = ctx.createLinearGradient(0, -size, 0, size);
      grad.addColorStop(0, skin.tip); // ponta clara/neon
      grad.addColorStop(1, skin.base); // base da skin

      ctx.beginPath();
      if (this.model === 1) { 
        // Pipa Clássica / Lápis (bico reto, corpo em losango)
        ctx.moveTo(0, -size * 1.2);
        ctx.lineTo(size * 0.7, -size * 0.4);
        ctx.lineTo(0, size);
        ctx.lineTo(-size * 0.7, -size * 0.4);
      } else if (this.model === 2) { 
        // Peixinho (mais fina em cima, gordinha embaixo)
        ctx.moveTo(0, -size * 1.0);
        ctx.lineTo(size * 0.6, -size * 0.1);
        ctx.lineTo(0, size * 1.2);
        ctx.lineTo(-size * 0.6, -size * 0.1);
      } else if (this.model === 3) { 
        // Batata / GT (muito larga e curta)
        ctx.moveTo(0, -size * 0.9);
        ctx.lineTo(size * 1.1, -size * 0.2);
        ctx.lineTo(0, size * 0.8);
        ctx.lineTo(-size * 1.1, -size * 0.2);
      } else { 
        // Raia / Flecha (padrão)
        ctx.moveTo(0, -size * 1.2);
        ctx.lineTo(size * 0.8, -size * 0.2);
        ctx.lineTo(0, size);
        ctx.lineTo(-size * 0.8, -size * 0.2);
      }
      ctx.closePath();
      
      // Preenche a cor de fundo (base)
      ctx.fillStyle = grad;
      ctx.fill();

      // ESTAMPAS / RECORTES DE PAPEL
      if (this.pattern > 0) {
        ctx.save();
        ctx.clip(); // Corta para não pintar fora do formato da pipa
        ctx.fillStyle = this.patternColor;
        ctx.beginPath();
        if (this.pattern === 1) { // Metade/Metade
          ctx.moveTo(0, -size*2); ctx.lineTo(size*2, -size*2); ctx.lineTo(size*2, size*2); ctx.lineTo(0, size*2);
        } else if (this.pattern === 2) { // Faixa horizontal no meio
          ctx.rect(-size*2, -size*0.2, size*4, size*0.4);
        } else if (this.pattern === 3) { // Cruz (Xadrez simples)
          ctx.rect(-size*2, -size*0.2, size*4, size*0.4);
          ctx.rect(-size*0.2, -size*2, size*0.4, size*4);
        }
        ctx.fill();
        ctx.restore();
      }

      ctx.lineWidth = 2;
      ctx.strokeStyle = skin.outline;
      ctx.stroke();

      // hastes internas (varetas)
      ctx.strokeStyle = skin.sticks;
      ctx.lineWidth = 2;
      ctx.beginPath();
      // Vareta central
      ctx.moveTo(0, -size * 1.2); 
      ctx.lineTo(0, size * (this.model === 2 ? 1.2 : 1.0)); // Desce mais no peixinho
      
      // Vareta envergada (horizontal)
      if (this.model === 1) {
        // Pipa clássica tem vareta reta ou leve curva
        ctx.moveTo(-size * 0.7, -size * 0.4);
        ctx.lineTo(size * 0.7, -size * 0.4);
      } else if (this.model === 2) {
        // Peixinho curva um pouco mais abaixo
        ctx.moveTo(-size * 0.6, -size * 0.1);
        ctx.quadraticCurveTo(0, -size * 0.5, size * 0.6, -size * 0.1);
      } else if (this.model === 3) {
        // GT é muito larga, curva suave
        ctx.moveTo(-size * 1.1, -size * 0.2);
        ctx.quadraticCurveTo(0, -size * 0.6, size * 1.1, -size * 0.2);
      } else {
        // Raia normal
        ctx.moveTo(-size * 0.8, -size * 0.2);
        ctx.quadraticCurveTo(0, -size * 0.6, size * 0.8, -size * 0.2);
      }
      ctx.stroke();ctx.stroke();

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
  loser.deadAt = performance.now();
  winner.cuts += 1;
  winner.cutFlashUntil = performance.now() + 200;
  
  // NOVO: Adiciona um tempo de recarga (cooldown) de 1.5s após cortar alguém
  // Isso impede que uma pipa corte 30 pipas seguidas em 1 segundo (efeito "velocidade absurda")
  winner.combatCooldownUntil = performance.now() + 1500;
  
  sfxCut.currentTime = 0;
  sfxCut.play().catch(()=>{});
  spawnCutParticles(loser.x, loser.y);

  // NOVO: Avisa na tela quem cortou quem!
  floatingTexts.push({
    x: loser.x,
    y: loser.y - 20, // Aparece um pouco acima de onde cortou
    text: `✂️ ${winner.name} cortou ${loser.name}!`,
    vy: -1.0, // sobe devagar
    life: 120 // duração de +- 2 segundos na tela
  });

  const fallen = { kite: loser, x: loser.x, y: loser.y, vy: -5.0, createdAt: performance.now(), caughtBy: null };
  fallenKites.push(fallen);
  winner.chasing = fallen;
}

function updateFallenKites(dt) {
  const now = performance.now();
  fallenKites = fallenKites.filter((f) => {
    f.y += f.vy * dt;
    f.vy += 0.15 * dt; // Gravidade mais forte para ela cair depois de pular

    if (!f.caughtBy) {
      kites.forEach((k) => {
        if (!k.alive || k.chasing !== f) return;
        
        // O perdedor tem 600ms de carência voando antes de poder ser pego.
        if (now - f.createdAt < 600) return;

        const dist = Math.hypot(k.x - f.x, k.y - f.y);
        if (dist < CATCH_DISTANCE) {
          k.trophies += 1;
          k.chasing = null;
          f.caughtBy = k;

          // NOVO: Avisa na tela que pegou a rabiola!
          floatingTexts.push({
            x: f.x,
            y: f.y,
            text: `🪁 +1 Troféu!`,
            vy: -1.0,
            life: 90
          });
        }
      });
    }

    const expired = f.y > window.innerHeight + 100; // Só some quando cair fora da tela
    if (expired) { // CORRIGIDO AQUI: Removemos o "|| f.caughtBy" para não sumir no meio do ar!
      kites.forEach((k) => { if (k.chasing === f) k.chasing = null; });
      return false;
    }
    return true;
  });
}

function drawFallenKites(t) {
  fallenKites.forEach((f) => {
    if (f.kite) {
      f.kite.x = f.x;
      f.kite.y = f.y;
      f.kite.angle += 0.05; // Rodopia enquanto cai
      f.kite.draw(t);
    }
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

// Função renderTimer removida para o modo de live infinita (24h)

function loop(t) {
  const dt = Math.min(3, (t - lastT) / 16.67);
  lastT = t;

  const now = performance.now();
  let activeKites = Array.from(kites.values()).filter(k => k.alive);
  if (activeKites.length > 50) {
    activeKites.sort((a,b) => (a.power - b.power) || (a.lastActive - b.lastActive));
    const k = activeKites[0];
    k.alive = false;
    k.deadAt = performance.now();
    spawnCutParticles(k.x, k.y);
    fallenKites.push({ kite: k, x: k.x, y: k.y, vy: -3.0, createdAt: performance.now(), caughtBy: null });
  }
  const canDieFromInactivity = activeKites.length > 3; // Mantém no mínimo 3 pipas vivas na tela para não ficar vazia
  activeKites.forEach(k => {
    if (canDieFromInactivity && now - k.lastActive > 60000 && k.power < 50) {
      k.alive = false;
      k.deadAt = performance.now();
      spawnCutParticles(k.x, k.y);
      fallenKites.push({ kite: k, x: k.x, y: k.y, vy: -3.0, createdAt: performance.now(), caughtBy: null });
    }
  });

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  kites.forEach((k) => k.update(t, dt));
  updateFallenKites(dt);
  drawFallenKites(t);
  kites.forEach((k) => k.alive && k.draw(t));
  updateAndDrawParticles(dt);
  updateAndDrawFloatingTexts(dt); // Habilita os textos subindo na tela

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
    
    if (data.type === 'config') {
      if (data.target === 'leaderboard') {
        const lb = document.getElementById('leaderboard');
        lb.style.display = data.value === 'hidden' ? 'none' : 'block';
        if (data.value !== 'hidden') {
          lb.style.transform = 'none';
          lb.style.top = data.value.includes('top') ? '150px' : 'auto';
          lb.style.bottom = data.value.includes('bottom') ? '15px' : 'auto';
          lb.style.left = data.value.includes('left') ? '10px' : 'auto';
          lb.style.right = data.value.includes('right') ? '10px' : 'auto';
        }
      }
      if (data.target === 'gifts') {
        const gg = document.getElementById('gift-guide');
        gg.style.display = data.value === 'hidden' ? 'none' : 'block';
        if (data.value !== 'hidden') {
          gg.style.transform = 'translateX(-50%)';
          gg.style.left = '50%';
          gg.style.bottom = data.value === 'bottom-center' ? '15px' : 'auto';
          gg.style.top = data.value === 'top-center' ? '150px' : 'auto';
        }
      }
    }
  
    if (data.type === 'gift') {
      const kite = getOrCreateKite(data.userId, data.name, data.avatarUrl);
      kite.addPower(data.value);
    }
    if (data.type === 'chat') {
      const kite = getOrCreateKite(data.userId, data.name, data.avatarUrl);
      kite.addPower(1);
    }
    if (data.type === 'join') {
      if (!kites.has(data.userId)) {
        const kite = getOrCreateKite(data.userId, data.name, data.avatarUrl);
        kite.addPower(3);
      }
    }
  };
  ws.onclose = () => setTimeout(connectWs, 2000);
}
connectWs();

setInterval(() => {
  const now = performance.now();
  kites.forEach((k, id) => {
    if (!k.alive && now - (k.deadAt || 0) > 3000) kites.delete(id);
  });
}, 2000);

const DEMO_MODE = new URLSearchParams(location.search).has('demo');
if (DEMO_MODE) {
  const demoNames = ['Ana', 'Bruno', 'Caca', 'Duda', 'Enzo', 'Fefe'];
  
  // Simula Presentes e Comentários (pipas fortes)
  setInterval(() => {
    const name = demoNames[Math.floor(Math.random() * demoNames.length)];
    const kite = getOrCreateKite(name, name, `https://i.pravatar.cc/64?u=${name}`);
    kite.addPower(5 + Math.random() * 40);
  }, 600);

  // Simula Entradas na Live (joins - pipas fracas)
  let joinId = 0;
  setInterval(() => {
    const name = "Joiner_" + (++joinId);
    if (!kites.has(name)) {
      const kite = getOrCreateKite(name, name, `https://i.pravatar.cc/64?u=${name}`);
      kite.addPower(3);
    }
  }, 1000);
}

// ====== SISTEMA DE ARRASTAR E SOLTAR (DRAG & DROP) ======
function makeDraggable(elmnt) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  let currentScale = 1;
  
  // Muda o cursor do mouse para a cruzinha de arrastar
  elmnt.style.cursor = 'move';
  // Permite que o elemento receba cliques
  elmnt.style.pointerEvents = 'auto';
  
  // Função para aumentar/diminuir com a rodinha do mouse
  elmnt.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      currentScale += 0.1; // Para cima aumenta
    } else {
      currentScale -= 0.1; // Para baixo diminui
    }
    
    // Limites de tamanho (30% ao menor, 300% ao maior)
    if (currentScale < 0.3) currentScale = 0.3;
    if (currentScale > 3.0) currentScale = 3.0;
    
    elmnt.style.transform = `scale(${currentScale})`;
  });
  
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
      
      // Quebra as travas do CSS originais
      elmnt.style.bottom = 'auto';
      elmnt.style.right = 'auto';
      
      // Define o Top e Left acompanhando o mouse
      elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
      elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
      
      // Mantém a escala atual mesmo arrastando
      elmnt.style.transform = `scale(${currentScale})`;
    };
  };
}

// Aplica o sistema nos 3 menus da tela
makeDraggable(document.getElementById("hud"));
makeDraggable(document.getElementById("leaderboard"));
makeDraggable(document.getElementById("gift-guide"));


// RELÓGIO DE TEMPO DE LIVE (UPTIME PARA 24H)
let startTime = Date.now();
setInterval(() => {
  let diff = Math.floor((Date.now() - startTime) / 1000);
  let h = Math.floor(diff / 3600);
  let m = Math.floor((diff % 3600) / 60);
  let s = diff % 60;
  
  let formatted = '';
  if (h > 0) {
    formatted += String(h).padStart(2, '0') + ':';
  }
  formatted += String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  
  const tEl = document.getElementById('timer');
  if(tEl) tEl.innerText = formatted;
}, 1000);
