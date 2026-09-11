// ========== CONFIG ==========
const CROSS_DISTANCE = 25;
const CATCH_DISTANCE = 35;
const TRAIL_LENGTH = 14;
const BASE_HP = 100;
const COUNTDOWN_SECONDS = 10;
const MAX_BATTLE_SECONDS = 90;
const VICTORY_SECONDS = 5;
const MIN_PLAYERS = 2;
const DAMAGE_MIN = 15;
const DAMAGE_MAX = 30;
const COMBAT_COOLDOWN_MS = 1500;
const SPAWN_SHIELD_MS = 3000;
const GIFT_SHIELD_MS = 6000;

// ========== CANVAS ==========
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// ========== SFX ==========
const sfxSpawn = new Audio('https://actions.google.com/sounds/v1/cartoon/pop.ogg');
sfxSpawn.volume = 0.4;
const sfxCut = new Audio('https://actions.google.com/sounds/v1/cartoon/whip_swipe.ogg');
sfxCut.volume = 0.6;
const sfxGift = new Audio('https://actions.google.com/sounds/v1/cartoon/magic_chime.ogg');
sfxGift.volume = 0.5;

// ========== ESTADO DA BATALHA ==========
const kites = new Map();
let fallenKites = [];
let floatingTexts = [];
let particles = [];
let lastT = performance.now();

// Estados: 'waiting' | 'countdown' | 'fighting' | 'victory' | 'fake'
let battleState = 'waiting';
let nextBattleQueue = [];   // [{userId, name, avatarUrl, bonusPower}]
let countdownStart = 0;
let battleStart = 0;
let battleWinner = null;
let victoryStart = 0;
let lastParticipants = [];  // Guarda os últimos participantes para batalha fake

const BODY_COLORS = ['#3b2f5e', '#4a2f45', '#2f3c52', '#3f2b4a', '#2b3f45'];
const FAKE_NAMES = [
  'Zé Pipa', 'Maria Cerol', 'João Linha', 'Ana Raia',
  'Pedro Vento', 'Bia Rabiola', 'Gael Batata', 'Luna GT',
  'Davi Peixinho', 'Lara Flecha'
];

// ========== CLASSE KITE ==========
class Kite {
  constructor(userId, name, avatarUrl, bonusPower) {
    this.userId = userId;
    this.name = name;
    this.hp = BASE_HP;
    this.maxHp = BASE_HP;
    this.power = bonusPower || 0;
    this.cuts = 0;
    this.trophies = 0;
    this.alive = true;
    this.deadAt = 0;
    this.anchorX = 60 + Math.random() * (window.innerWidth - 120);
    this.x = this.anchorX;
    this.prevX = this.x;
    this.y = (window.innerHeight * 0.45) + (Math.random() * 80 - 40);
    this.targetY = this.y;
    this.angle = 0;
    this.phase = Math.random() * Math.PI * 2;
    this.lastActive = performance.now();
    this.cutFlashUntil = 0;
    this.combatCooldownUntil = 0;
    this.shieldUntil = 0;
    this.spawnInvulnerableUntil = performance.now() + SPAWN_SHIELD_MS;
    this.bodyColor = BODY_COLORS[Math.floor(Math.random() * BODY_COLORS.length)];
    this.model = Math.floor(Math.random() * 4);   // 0=Raia, 1=Lápis, 2=Peixinho, 3=Batata/GT
    this.pattern = Math.floor(Math.random() * 4);  // 0=Lisa, 1=Meio-a-Meio, 2=Faixa, 3=Cruz
    this.patternColor = `hsl(${Math.random() * 360}, 80%, 50%)`;
    this.target = null;
    this.chasing = null;
    this.debicarUntil = 0;
    this.debicarDx = 0;
    this.trail = [];
    this.img = new Image();
    this.img.crossOrigin = 'anonymous';
    this.img.src = avatarUrl || '';
  }

  healHp(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  addPower(amount) {
    const now = performance.now();
    this.lastActive = now;
    this.power += amount;

    if (amount >= 5) {
      this.shieldUntil = now + GIFT_SHIELD_MS;
      this.healHp(30);
      sfxGift.currentTime = 0;
      sfxGift.play().catch(() => {});
      floatingTexts.push({
        x: this.x, y: this.y - 40,
        text: '🎁 ESCUDO + CURA!', vy: -2.0, life: 90
      });
    } else if (amount > 0) {
      this.healHp(5);
      floatingTexts.push({
        x: this.x, y: this.y - 30,
        text: `+${amount} Força`, vy: -1.0, life: 60
      });
    }
  }

  update(t, dt) {
    if (!this.alive) return;
    const now = performance.now();
    this.prevX = this.x;

    // Durante vitória, só flutua
    if (battleState === 'victory') {
      const wanderX = this.anchorX + Math.sin(t / 900 + this.phase) * 150;
      this.x += (wanderX - this.x) * (1 - Math.pow(0.96, dt));
      this.y += (this.targetY - this.y) * (1 - Math.pow(0.92, dt));
      const vx = this.x - this.prevX;
      const targetAngle = Math.max(-0.5, Math.min(0.5, vx * 0.08));
      this.angle += (targetAngle - this.angle) * (1 - Math.pow(0.85, dt));
      this.trail.unshift({ x: this.x, y: this.y + 34 });
      if (this.trail.length > TRAIL_LENGTH) this.trail.pop();
      return;
    }

    // Movimento vertical suave
    this.y += (this.targetY - this.y) * (1 - Math.pow(0.92, dt));

    if (this.chasing && fallenKites.includes(this.chasing)) {
      // Persegue a rabiola caída
      this.x += (this.chasing.x - this.x) * (1 - Math.pow(0.90, dt));
    } else {
      this.chasing = null;

      if (!this.target || !this.target.alive) {
        this.target = pickTarget(this);
      }

      if (this.target) {
        if (t > this.debicarUntil) {
          this.debicarUntil = t + 2500 + Math.random() * 2000;
          this.debicarDx = Math.sign(this.target.x - this.x) * (30 + Math.random() * 40);
        }
        this.x += ((this.target.x + this.debicarDx) - this.x) * (1 - Math.pow(0.96, dt));

        const dist = Math.hypot(this.x - this.target.x, this.y - this.target.y);
        if (dist < CROSS_DISTANCE) {
          const myShield = now < this.shieldUntil;
          const tgtShield = now < this.target.shieldUntil;
          const mySpawn = now < this.spawnInvulnerableUntil;
          const tgtSpawn = now < this.target.spawnInvulnerableUntil;
          const myCd = now < this.combatCooldownUntil;
          const tgtCd = now < this.target.combatCooldownUntil;

          if (myShield && tgtShield) {
            // Ambos com escudo — rebate
            this.target = null;
            this.debicarDx *= -1;
          } else if (myShield && !tgtShield) {
            damageKite(this, this.target);
          } else if (tgtShield && !myShield) {
            damageKite(this.target, this);
          } else if (mySpawn || tgtSpawn || myCd || tgtCd) {
            // Recém-nascido ou em cooldown — rebate sem dano
            this.target = null;
            this.debicarDx *= -1;
          } else {
            // Combate normal — quem tem mais poder tem vantagem
            const myPow = Math.pow(this.power + 10, 2);
            const tgtPow = Math.pow(this.target.power + 10, 2);
            const myChance = myPow / (myPow + tgtPow);
            if (Math.random() < myChance) {
              damageKite(this, this.target);
            } else {
              damageKite(this.target, this);
            }
          }
          this.target = null;
        }
      } else {
        // Sem alvo, voa livre
        const wanderX = this.anchorX + Math.sin(t / 900 + this.phase) * 150;
        this.x += (wanderX - this.x) * (1 - Math.pow(0.96, dt));
      }
    }

    // Banking (inclinação visual)
    const vx = this.x - this.prevX;
    const targetAngle = Math.max(-0.5, Math.min(0.5, vx * 0.08));
    this.angle += (targetAngle - this.angle) * (1 - Math.pow(0.85, dt));

    // Rastro para rabiola
    this.trail.unshift({ x: this.x, y: this.y + 34 });
    if (this.trail.length > TRAIL_LENGTH) this.trail.pop();
  }

  // Helper: desenha o contorno do corpo da pipa (reutilizado para fill e stroke)
  _drawBodyPath(size) {
    ctx.beginPath();
    if (this.model === 1) {
      ctx.moveTo(0, -size * 1.2);
      ctx.lineTo(size * 0.7, -size * 0.4);
      ctx.lineTo(0, size);
      ctx.lineTo(-size * 0.7, -size * 0.4);
    } else if (this.model === 2) {
      ctx.moveTo(0, -size * 1.0);
      ctx.lineTo(size * 0.6, -size * 0.1);
      ctx.lineTo(0, size * 1.2);
      ctx.lineTo(-size * 0.6, -size * 0.1);
    } else if (this.model === 3) {
      ctx.moveTo(0, -size * 0.9);
      ctx.lineTo(size * 1.1, -size * 0.2);
      ctx.lineTo(0, size * 0.8);
      ctx.lineTo(-size * 1.1, -size * 0.2);
    } else {
      ctx.moveTo(0, -size * 1.2);
      ctx.lineTo(size * 0.8, -size * 0.2);
      ctx.lineTo(0, size);
      ctx.lineTo(-size * 0.8, -size * 0.2);
    }
    ctx.closePath();
  }

  draw(t) {
    const now = performance.now();
    const isCutFlash = now < this.cutFlashUntil;

    // Linha (string) até o chão — só se viva
    if (this.alive) {
      ctx.strokeStyle = isCutFlash ? '#ff4d4d' : 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(this.anchorX, window.innerHeight);
      ctx.quadraticCurveTo(this.x, (this.y + window.innerHeight) / 2, this.x, this.y + 22);
      ctx.stroke();
    }

    // Rabiola trail — só se viva
    if (this.alive && this.trail.length > 2) {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        const p = this.trail[i];
        const prev = this.trail[i - 1];
        ctx.quadraticCurveTo(prev.x, prev.y, (p.x + prev.x) / 2, (p.y + prev.y) / 2);
      }
      ctx.stroke();

      // Fitinhas da rabiola
      for (let i = 2; i < this.trail.length; i += 4) {
        const p = this.trail[i];
        const prev = this.trail[i - 1];
        const dx = p.x - prev.x;
        const dy = p.y - prev.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = (-dy / len) * 10;
        const ny = (dx / len) * 10;
        ctx.strokeStyle = i % 8 === 2 ? '#111' : this.patternColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(p.x - nx, p.y - ny);
        ctx.lineTo(p.x + nx, p.y + ny);
        ctx.stroke();
      }
    }

    // ===== CORPO DA PIPA =====
    const size = 34;
    ctx.save(); // <<< SAVE principal
    ctx.translate(this.x, this.y);

    const scale = 1 + Math.min(this.power / 1000, 0.6);
    ctx.scale(scale, scale);
    ctx.rotate(this.angle);

    // Aura de cerol
    if (this.power > 30) {
      let auraColor;
      if (this.power > 500) auraColor = '#ff3333';
      else if (this.power > 250) auraColor = '#ffd166';
      else if (this.power > 100) auraColor = '#a87ffb';
      else auraColor = '#4ca1af';
      ctx.shadowColor = auraColor;
      ctx.shadowBlur = 15 + Math.random() * 5;
    }

    const skin = getKiteSkin(this.power, this.bodyColor);

    // Preenchimento do corpo
    const grad = ctx.createLinearGradient(0, -size, 0, size);
    grad.addColorStop(0, skin.tip);
    grad.addColorStop(1, skin.base);
    this._drawBodyPath(size);
    ctx.fillStyle = grad;
    ctx.fill();

    // Estampas / recortes de papel
    if (this.pattern > 0) {
      ctx.save(); // <<< SAVE estampa
      this._drawBodyPath(size);
      ctx.clip();
      ctx.fillStyle = this.patternColor;
      ctx.beginPath();
      if (this.pattern === 1) {
        ctx.moveTo(0, -size * 2);
        ctx.lineTo(size * 2, -size * 2);
        ctx.lineTo(size * 2, size * 2);
        ctx.lineTo(0, size * 2);
      } else if (this.pattern === 2) {
        ctx.rect(-size * 2, -size * 0.2, size * 4, size * 0.4);
      } else {
        ctx.rect(-size * 2, -size * 0.2, size * 4, size * 0.4);
        ctx.rect(-size * 0.2, -size * 2, size * 0.4, size * 4);
      }
      ctx.fill();
      ctx.restore(); // <<< RESTORE estampa
    }

    // Outline (redesenha o path depois do clip)
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    this._drawBodyPath(size);
    ctx.lineWidth = 2;
    ctx.strokeStyle = skin.outline;
    ctx.stroke();

    // Varetas internas
    ctx.strokeStyle = skin.sticks;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -size * 1.2);
    ctx.lineTo(0, size * (this.model === 2 ? 1.2 : 1.0));
    if (this.model === 1) {
      ctx.moveTo(-size * 0.7, -size * 0.4);
      ctx.lineTo(size * 0.7, -size * 0.4);
    } else if (this.model === 2) {
      ctx.moveTo(-size * 0.6, -size * 0.1);
      ctx.quadraticCurveTo(0, -size * 0.5, size * 0.6, -size * 0.1);
    } else if (this.model === 3) {
      ctx.moveTo(-size * 1.1, -size * 0.2);
      ctx.quadraticCurveTo(0, -size * 0.6, size * 1.1, -size * 0.2);
    } else {
      ctx.moveTo(-size * 0.8, -size * 0.2);
      ctx.quadraticCurveTo(0, -size * 0.6, size * 0.8, -size * 0.2);
    }
    ctx.stroke();

    // Rabiola animada (cauda)
    ctx.beginPath();
    ctx.moveTo(0, size);
    const tailLength = size * (2.5 + Math.min(this.power / 200, 3));
    for (let i = 0; i < tailLength; i += 6) {
      const wave = Math.sin(t * 0.008 - i * 0.06 + this.phase) * (size * 0.4);
      ctx.lineTo(wave, size + i);
    }
    ctx.strokeStyle = skin.tip;
    ctx.lineWidth = this.power > 300 ? 3 : 1.5;
    ctx.stroke();

    // Escudo de presente (anel dourado)
    if (now < this.shieldUntil) {
      ctx.save(); // <<< SAVE escudo
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#ffeaa7';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, size * 1.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore(); // <<< RESTORE escudo
    }

    // Coroa (VIP)
    if (this.power >= 200) {
      ctx.font = '36px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('👑', 0, -size * 0.9 - 15);
    }

    // Avatar
    if (this.img.complete && this.img.naturalWidth > 0) {
      ctx.save(); // <<< SAVE avatar
      ctx.beginPath();
      ctx.arc(0, -size * 0.2, size * 0.45, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(this.img, -size * 0.45, -size * 0.65, size * 0.9, size * 0.9);
      ctx.restore(); // <<< RESTORE avatar
    }

    // Troféus
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

    ctx.restore(); // <<< RESTORE principal

    // ===== BARRA DE VIDA (coordenadas do mundo, sempre horizontal) =====
    if (this.alive && (battleState === 'fighting' || battleState === 'fake')) {
      const barW = 50;
      const barH = 6;
      const hpRatio = Math.max(0, this.hp / this.maxHp);
      const barX = this.x - barW / 2;
      const barY = this.y - (size * scale) - 20;

      // Fundo
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(barX, barY, barW, barH);

      // Vida (verde → amarelo → vermelho)
      const r = hpRatio > 0.5 ? Math.floor(255 * (1 - hpRatio) * 2) : 255;
      const g = hpRatio > 0.5 ? 255 : Math.floor(255 * hpRatio * 2);
      ctx.fillStyle = `rgb(${r},${g},0)`;
      ctx.fillRect(barX, barY, barW * hpRatio, barH);

      // Borda
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);

      // Texto HP
      ctx.fillStyle = '#fff';
      ctx.font = '900 10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(Math.ceil(this.hp), this.x, barY - 2);
    }

    // Nome do jogador (coordenadas do mundo)
    ctx.fillStyle = '#fff';
    ctx.font = '900 20px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,1)';
    ctx.shadowBlur = 8;
    ctx.fillText(this.name, this.x, this.y + size + 30);
    ctx.shadowBlur = 0;
  }
}

// ========== SKINS ==========
function getKiteSkin(power, baseColor) {
  if (power < 50)  return { tip: '#ffffff', base: baseColor,  sticks: 'rgba(0,0,0,0.4)', outline: '#333'    };
  if (power < 150) return { tip: '#a5f3fc', base: '#0284c7',  sticks: '#38bdf8',          outline: '#0369a1' };
  if (power < 300) return { tip: '#fbcfe8', base: '#9333ea',  sticks: '#e879f9',          outline: '#7e22ce' };
  if (power < 500) return { tip: '#fef08a', base: '#ea580c',  sticks: '#fbbf24',          outline: '#9a3412' };
  return              { tip: '#fca5a5', base: '#171717',  sticks: '#ef4444',          outline: '#dc2626' };
}

// ========== ALVO ==========
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

// ========== SISTEMA DE DANO ==========
function damageKite(attacker, defender) {
  if (!defender.alive) return;
  const baseDmg = DAMAGE_MIN + Math.random() * (DAMAGE_MAX - DAMAGE_MIN);
  const powerBonus = 1 + (attacker.power / 200);
  const dmg = Math.floor(baseDmg * powerBonus);

  defender.hp -= dmg;
  defender.cutFlashUntil = performance.now() + 200;
  attacker.combatCooldownUntil = performance.now() + COMBAT_COOLDOWN_MS;

  sfxCut.currentTime = 0;
  sfxCut.play().catch(() => {});
  spawnCutParticles(defender.x, defender.y);

  floatingTexts.push({
    x: defender.x, y: defender.y - 30,
    text: `-${dmg} HP`, vy: -1.5, life: 60
  });

  if (defender.hp <= 0) {
    killKite(attacker, defender);
  }

  attacker.target = null;
  attacker.debicarDx *= -1;
}

function killKite(winner, loser) {
  loser.alive = false;
  loser.deadAt = performance.now();
  loser.hp = 0;
  winner.cuts += 1;
  winner.trophies += 1;

  floatingTexts.push({
    x: loser.x, y: loser.y - 20,
    text: `✂️ ${winner.name} cortou ${loser.name}!`,
    vy: -1.0, life: 120
  });

  const vx = (Math.random() - 0.5) * 4.0;
  const fallen = {
    kite: loser, x: loser.x, y: loser.y,
    vx: vx, vy: -1.0,
    createdAt: performance.now(), caughtBy: null
  };
  fallenKites.push(fallen);
  winner.chasing = fallen;
}

// ========== PIPAS CAÍDAS ==========
function updateFallenKites(dt) {
  const now = performance.now();
  fallenKites = fallenKites.filter((f) => {
    if (f.vx) f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.vy += 0.15 * dt;

    if (!f.caughtBy) {
      kites.forEach((k) => {
        if (!k.alive || k.chasing !== f) return;
        if (now - f.createdAt < 600) return;
        const dist = Math.hypot(k.x - f.x, k.y - f.y);
        if (dist < CATCH_DISTANCE) {
          k.chasing = null;
          f.caughtBy = k;
          floatingTexts.push({
            x: f.x, y: f.y,
            text: '🪁 +1 Troféu!', vy: -1.0, life: 90
          });
        }
      });
    }

    const expired = f.y > window.innerHeight + 100;
    if (expired) {
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
      f.kite.angle += 0.05;
      f.kite.draw(t);
    }
  });
}

// ========== TEXTOS FLUTUANTES ==========
function updateAndDrawFloatingTexts(dt) {
  floatingTexts = floatingTexts.filter(ft => ft.life > 0);
  floatingTexts.forEach(ft => {
    ft.y += ft.vy * dt;
    ft.life -= dt;
    const alpha = Math.max(0, ft.life / 60);

    ctx.save();
    ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
    ctx.font = '900 16px Arial';
    ctx.textAlign = 'center';
    ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.lineWidth = 3;
    ctx.strokeText(ft.text, ft.x, ft.y);
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  });
}

// ========== PARTÍCULAS ==========
function spawnCutParticles(x, y) {
  for (let i = 0; i < 18; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 6,
      vy: Math.random() * -4 - 1,
      life: 40 + Math.random() * 20
    });
  }
}

function updateAndDrawParticles(dt) {
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 0.15 * dt;
    p.life -= dt;
    ctx.fillStyle = `rgba(255,255,255,${Math.max(p.life / 60, 0)})`;
    ctx.fillRect(p.x, p.y, 3, 3);
  });
}

// ========== SISTEMA DE BATALHA ==========
function addToQueue(userId, name, avatarUrl, bonusPower) {
  const existing = nextBattleQueue.find(p => p.userId === userId);
  if (existing) {
    existing.bonusPower += bonusPower;
    return;
  }

  nextBattleQueue.push({ userId, name, avatarUrl, bonusPower });
  sfxSpawn.currentTime = 0;
  sfxSpawn.play().catch(() => {});

  // Transições automáticas
  if (battleState === 'fake' && nextBattleQueue.length >= MIN_PLAYERS) {
    endCurrentBattle();
    battleState = 'countdown';
    countdownStart = performance.now();
  } else if (battleState === 'waiting' && nextBattleQueue.length >= MIN_PLAYERS) {
    battleState = 'countdown';
    countdownStart = performance.now();
  }
}

function handleChatEvent(userId, name, avatarUrl) {
  // Se está numa batalha e a pessoa já tem pipa viva, cura +5 HP
  if ((battleState === 'fighting' || battleState === 'fake') && kites.has(userId)) {
    const k = kites.get(userId);
    if (k.alive) {
      k.healHp(5);
      k.lastActive = performance.now();
      floatingTexts.push({
        x: k.x, y: k.y - 30,
        text: '+5 HP', vy: -1.0, life: 45
      });
      return;
    }
  }
  addToQueue(userId, name, avatarUrl, 0);
}

function handleGiftEvent(userId, name, avatarUrl, value) {
  // Se está na batalha com pipa viva, dá poder + cura + escudo
  if ((battleState === 'fighting' || battleState === 'fake') && kites.has(userId)) {
    const k = kites.get(userId);
    if (k.alive) {
      k.addPower(value);
      return;
    }
  }
  addToQueue(userId, name, avatarUrl, value);
}

function handleJoinEvent(userId, name, avatarUrl) {
  // Só adiciona se não está na batalha atual
  if (kites.has(userId)) return;
  addToQueue(userId, name, avatarUrl, 0);
}

function startBattle(isFake) {
  kites.clear();
  fallenKites = [];
  floatingTexts = [];
  particles = [];

  let participants;
  if (isFake) {
    if (lastParticipants.length >= 2) {
      participants = lastParticipants.map(p => ({ ...p, bonusPower: 0 }));
    } else {
      const count = 4 + Math.floor(Math.random() * 3);
      participants = [];
      for (let i = 0; i < count; i++) {
        participants.push({
          userId: 'fake_' + i,
          name: FAKE_NAMES[i % FAKE_NAMES.length],
          avatarUrl: '',
          bonusPower: Math.floor(Math.random() * 10)
        });
      }
    }
  } else {
    participants = nextBattleQueue.splice(0);
    lastParticipants = participants.map(p => ({ ...p }));
  }

  participants.forEach(p => {
    const kite = new Kite(p.userId, p.name, p.avatarUrl, p.bonusPower || 0);
    kites.set(p.userId, kite);
  });

  battleState = isFake ? 'fake' : 'fighting';
  battleStart = performance.now();
  battleWinner = null;
}

function endCurrentBattle() {
  kites.forEach(k => { k.alive = false; });
  fallenKites = [];
}

function updateBattleState() {
  const now = performance.now();

  if (battleState === 'waiting') {
    if (nextBattleQueue.length >= MIN_PLAYERS) {
      battleState = 'countdown';
      countdownStart = now;
    } else if (now > 5000) { // Se passar 5 segundos e não tiver ninguém, inicia fake
      startBattle(true);
    }
  }

  else if (battleState === 'countdown') {
    const elapsed = (now - countdownStart) / 1000;
    if (elapsed >= COUNTDOWN_SECONDS) {
      startBattle(false);
    }
  }

  else if (battleState === 'fighting' || battleState === 'fake') {
    const aliveKites = Array.from(kites.values()).filter(k => k.alive);
    const elapsed = (now - battleStart) / 1000;

    // Último vivo = campeão
    if (aliveKites.length <= 1) {
      battleWinner = aliveKites[0] || null;
      battleState = 'victory';
      victoryStart = now;
      return;
    }

    // Tempo esgotado = quem tem mais HP vence
    if (elapsed >= MAX_BATTLE_SECONDS) {
      aliveKites.sort((a, b) => b.hp - a.hp);
      const winner = aliveKites[0];
      for (let i = 1; i < aliveKites.length; i++) {
        const loser = aliveKites[i];
        loser.alive = false;
        loser.deadAt = now;
        spawnCutParticles(loser.x, loser.y);
        const vx = (Math.random() - 0.5) * 4.0;
        fallenKites.push({
          kite: loser, x: loser.x, y: loser.y,
          vx, vy: -1.0, createdAt: now, caughtBy: null
        });
      }
      battleWinner = winner;
      battleState = 'victory';
      victoryStart = now;
    }
  }

  else if (battleState === 'victory') {
    const elapsed = (now - victoryStart) / 1000;
    if (elapsed >= VICTORY_SECONDS) {
      if (nextBattleQueue.length >= MIN_PLAYERS) {
        battleState = 'countdown';
        countdownStart = now;
      } else {
        startBattle(true); // Batalha fake
      }
    }
  }
}

// ========== HUD (DOM) ==========
function updateHUD() {
  const now = performance.now();
  const titleEl = document.getElementById('title');
  const timerEl = document.getElementById('timer');
  const subEl = document.getElementById('subtitle');
  if (!titleEl || !timerEl || !subEl) return;

  titleEl.innerText = '🪁 PIPA COMBATE';

  if (battleState === 'waiting') {
    timerEl.innerText = '--:--';
    subEl.innerText = '💬 Comente para entrar na batalha!';
  }

  else if (battleState === 'countdown') {
    const elapsed = (now - countdownStart) / 1000;
    const remaining = Math.max(0, Math.ceil(COUNTDOWN_SECONDS - elapsed));
    timerEl.innerText = remaining > 0 ? String(remaining) : 'LUTA!';
    subEl.innerText = `${nextBattleQueue.length} pipas prontas para a batalha!`;
  }

  else if (battleState === 'fighting') {
    const elapsed = (now - battleStart) / 1000;
    const remaining = Math.max(0, MAX_BATTLE_SECONDS - elapsed);
    const mins = Math.floor(remaining / 60);
    const secs = Math.floor(remaining % 60);
    timerEl.innerText = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    const aliveCount = Array.from(kites.values()).filter(k => k.alive).length;
    subEl.innerText = `⚔️ ${aliveCount} pipas vivas!`;
  }

  else if (battleState === 'fake') {
    const elapsed = (now - battleStart) / 1000;
    const remaining = Math.max(0, MAX_BATTLE_SECONDS - elapsed);
    const mins = Math.floor(remaining / 60);
    const secs = Math.floor(remaining % 60);
    timerEl.innerText = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    const aliveCount = Array.from(kites.values()).filter(k => k.alive).length;
    subEl.innerText = `🎭 EXIBIÇÃO • ${aliveCount} pipas • Comente para entrar!`;
  }

  else if (battleState === 'victory') {
    const elapsed = (now - victoryStart) / 1000;
    const nextIn = Math.max(0, Math.ceil(VICTORY_SECONDS - elapsed));
    timerEl.innerText = '🏆';
    if (battleWinner) {
      subEl.innerText = `${battleWinner.name} venceu! Próxima em ${nextIn}s...`;
    } else {
      subEl.innerText = `Empate! Próxima em ${nextIn}s...`;
    }
  }
}

// ========== OVERLAY DE BATALHA (CANVAS) ==========
function drawBattleOverlay(t) {
  const now = performance.now();

  if (battleState === 'waiting') {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,1)';
    ctx.shadowBlur = 10;

    ctx.fillStyle = '#fff';
    ctx.font = '900 32px Arial';
    ctx.fillText('💬 COMENTE PARA ENTRAR!', canvas.width / 2, canvas.height / 2 - 20);

    ctx.font = '900 20px Arial';
    ctx.fillStyle = '#ffd166';
    const count = nextBattleQueue.length;
    ctx.fillText(
      count === 0
        ? 'Esperando jogadores...'
        : `${count} jogador(es) na fila — falta ${Math.max(0, MIN_PLAYERS - count)}!`,
      canvas.width / 2, canvas.height / 2 + 25
    );

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  else if (battleState === 'countdown') {
    const elapsed = (now - countdownStart) / 1000;
    const remaining = Math.ceil(COUNTDOWN_SECONDS - elapsed);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,1)';
    ctx.shadowBlur = 15;

    if (remaining > 0) {
      const pulse = 1 + Math.sin(elapsed * 8) * 0.1;
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = '#fff';
      ctx.font = '900 100px Arial';
      ctx.fillText(String(remaining), 0, 30);
      ctx.restore();
    } else {
      ctx.fillStyle = '#ff4444';
      ctx.font = '900 80px Arial';
      ctx.fillText('LUTA!', canvas.width / 2, canvas.height / 2 + 20);
    }

    ctx.font = '900 22px Arial';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(
      `${nextBattleQueue.length} pipas vão lutar!`,
      canvas.width / 2, canvas.height / 2 + 80
    );

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  else if (battleState === 'victory') {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,1)';
    ctx.shadowBlur = 15;

    ctx.fillStyle = '#ffd166';
    ctx.font = '900 48px Arial';
    ctx.fillText('🏆 CAMPEÃO! 🏆', canvas.width / 2, canvas.height / 2 - 40);

    if (battleWinner) {
      ctx.fillStyle = '#fff';
      ctx.font = '900 36px Arial';
      ctx.fillText(battleWinner.name, canvas.width / 2, canvas.height / 2 + 20);
    } else {
      ctx.fillStyle = '#fff';
      ctx.font = '900 36px Arial';
      ctx.fillText('EMPATE!', canvas.width / 2, canvas.height / 2 + 20);
    }

    const elapsed = (now - victoryStart) / 1000;
    const nextIn = Math.max(0, Math.ceil(VICTORY_SECONDS - elapsed));
    ctx.fillStyle = '#aaa';
    ctx.font = '900 18px Arial';
    ctx.fillText(`Próxima batalha em ${nextIn}s...`, canvas.width / 2, canvas.height / 2 + 70);

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Badge "EXIBIÇÃO" no canto durante batalha fake
  if (battleState === 'fake') {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 165, 0, 0.8)';
    const badgeW = 180;
    const badgeH = 30;
    const badgeX = canvas.width / 2 - badgeW / 2;
    const badgeY = canvas.height - 50;
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
    ctx.fillStyle = '#000';
    ctx.font = '900 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🎭 BATALHA DE EXIBIÇÃO', canvas.width / 2, badgeY + 20);
    ctx.restore();
  }
}

// ========== LEADERBOARD ==========
function renderLeaderboard() {
  const el = document.getElementById('leaderboard');
  if (!el) return;

  if (battleState === 'fighting' || battleState === 'fake') {
    const alive = Array.from(kites.values())
      .filter(k => k.alive)
      .sort((a, b) => b.hp - a.hp)
      .slice(0, 5);

    el.innerHTML = alive.map((k, i) => `
      <div class="lb-row">
        <span class="lb-rank">${i + 1}º</span>
        <img src="${k.img.src}" onerror="this.style.visibility='hidden'" />
        <span>${k.name}</span>
        <span class="lb-cuts">❤️ ${Math.ceil(k.hp)}</span>
      </div>
    `).join('');
  } else if (battleState === 'waiting' || battleState === 'countdown') {
    el.innerHTML = nextBattleQueue.slice(0, 8).map((p, i) => `
      <div class="lb-row">
        <span class="lb-rank">${i + 1}º</span>
        <img src="${p.avatarUrl}" onerror="this.style.visibility='hidden'" />
        <span>${p.name}</span>
        <span class="lb-cuts">🪁</span>
      </div>
    `).join('');
  } else {
    el.innerHTML = '';
  }
}

// ========== LOOP PRINCIPAL ==========
function loop(t) {
  const dt = Math.min(3, (t - lastT) / 16.67);
  lastT = t;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  updateBattleState();

  // Atualiza e desenha pipas durante batalha
  if (battleState === 'fighting' || battleState === 'fake' || battleState === 'victory') {
    kites.forEach(k => k.update(t, dt));
    updateFallenKites(dt);
    drawFallenKites(t);
    kites.forEach(k => k.alive && k.draw(t));
    updateAndDrawParticles(dt);
    updateAndDrawFloatingTexts(dt);
  }

  drawBattleOverlay(t);
  updateHUD();

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

setInterval(renderLeaderboard, 500);

// ========== WEBSOCKET ==========
function connectWs() {
  const ws = new WebSocket(`ws://${location.host}/ws`);
  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);

    if (data.type === 'volume') {
      sfxSpawn.volume = data.value * 0.6;
      sfxCut.volume = data.value;
      sfxGift.volume = data.value * 0.8;
    }

    if (data.type === 'config') {
      if (data.target === 'leaderboard') {
        const lb = document.getElementById('leaderboard');
        if (lb) {
          lb.style.display = data.value === 'hidden' ? 'none' : 'block';
          if (data.value !== 'hidden') {
            lb.style.transform = 'none';
            lb.style.top = data.value.includes('top') ? '150px' : 'auto';
            lb.style.bottom = data.value.includes('bottom') ? '15px' : 'auto';
            lb.style.left = data.value.includes('left') ? '10px' : 'auto';
            lb.style.right = data.value.includes('right') ? '10px' : 'auto';
          }
        }
      }
      if (data.target === 'gifts') {
        const gg = document.getElementById('gift-guide');
        if (gg) {
          gg.style.display = data.value === 'hidden' ? 'none' : 'block';
          if (data.value !== 'hidden') {
            gg.style.transform = 'translateX(-50%)';
            gg.style.left = '50%';
            gg.style.bottom = data.value === 'bottom-center' ? '15px' : 'auto';
            gg.style.top = data.value === 'top-center' ? '150px' : 'auto';
          }
        }
      }
    }

    if (data.type === 'gift') {
      handleGiftEvent(data.userId, data.name, data.avatarUrl, data.value);
    }
    if (data.type === 'chat') {
      handleChatEvent(data.userId, data.name, data.avatarUrl);
    }
    if (data.type === 'join') {
      handleJoinEvent(data.userId, data.name, data.avatarUrl);
    }
  };
  ws.onclose = () => setTimeout(connectWs, 2000);
}
connectWs();

// ========== DEMO MODE ==========
const DEMO_MODE = new URLSearchParams(location.search).has('demo');
if (DEMO_MODE) {
  const demoNames = ['Ana', 'Bruno', 'Caca', 'Duda', 'Enzo', 'Fefe', 'Gabi', 'Hugo'];
  let demoIndex = 0;

  // Simula comentários (entram na batalha)
  setInterval(() => {
    const name = demoNames[demoIndex % demoNames.length];
    demoIndex++;
    handleChatEvent(name, name, `https://i.pravatar.cc/64?u=${name}`);
  }, 800);

  // Simula presentes durante batalha
  setInterval(() => {
    const name = demoNames[Math.floor(Math.random() * demoNames.length)];
    handleGiftEvent(name, name, `https://i.pravatar.cc/64?u=${name}`, 5 + Math.floor(Math.random() * 30));
  }, 3000);
}

// ========== DRAG & DROP ==========
function makeDraggable(elmnt) {
  if (!elmnt) return;
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  let currentScale = 1;

  elmnt.style.cursor = 'move';
  elmnt.style.pointerEvents = 'auto';

  elmnt.addEventListener('wheel', (e) => {
    e.preventDefault();
    currentScale += e.deltaY < 0 ? 0.1 : -0.1;
    currentScale = Math.max(0.3, Math.min(3.0, currentScale));
    elmnt.style.transform = `scale(${currentScale})`;
  });

  elmnt.onmousedown = function(e) {
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;

    document.onmouseup = function() {
      document.onmouseup = null;
      document.onmousemove = null;
    };

    document.onmousemove = function(e) {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      elmnt.style.bottom = 'auto';
      elmnt.style.right = 'auto';
      elmnt.style.top = (elmnt.offsetTop - pos2) + 'px';
      elmnt.style.left = (elmnt.offsetLeft - pos1) + 'px';
      elmnt.style.transform = `scale(${currentScale})`;
    };
  };
}

makeDraggable(document.getElementById('hud'));
makeDraggable(document.getElementById('leaderboard'));
makeDraggable(document.getElementById('gift-guide'));
