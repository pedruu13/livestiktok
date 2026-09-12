// Gift Rain - Ícones de presentes caindo conforme chegam

const canvas = document.getElementById('gift-canvas');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

let fallingGifts = [];
let totalGiftsReceived = 0;
let totalValue = 0;
let lastT = performance.now();

// Emojis dos presentes TikTok
const giftEmojis = {
  rose: '🌹',
  heart: '❤️',
  diamond: '💎',
  gift: '🎁',
  crown: '👑',
  fireworks: '✨',
  star: '⭐',
  flower: '🌸',
  gift_bow: '🎀',
};

class FallingGift {
  constructor(emoji, multiplier, value) {
    this.emoji = emoji;
    this.multiplier = multiplier;
    this.value = value;
    this.x = Math.random() * canvas.width;
    this.y = -50;
    this.vy = 2 + Math.random() * 2; // velocidade de queda
    this.vx = (Math.random() - 0.5) * 1.5; // movimento lateral
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.1;
    this.life = 100; // frames antes de sumir
    this.createdAt = performance.now();
  }

  update(dt) {
    this.y += this.vy * dt;
    this.x += this.vx * dt;
    this.rotation += this.rotationSpeed * dt;
    this.life -= dt;
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = Math.max(this.life / 100, 0);
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.emoji, 0, 0);
    
    // Multiplicador (1x, 5x, 10x, etc)
    if (this.multiplier > 1) {
      ctx.font = 'bold 20px Arial';
      ctx.fillStyle = '#ffd700';
      ctx.fillText(`${this.multiplier}x`, 0, 40);
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
      }

      if (data.type === 'gift') {
        const emoji = Object.values(giftEmojis)[Math.floor(Math.random() * Object.keys(giftEmojis).length)];
        const multiplier = estimateMultiplier(data.value);
        
        // Cria 3-5 cópias do mesmo presente caindo em paralelo
        const count = Math.min(Math.ceil(Math.log(data.value) / 2), 5);
        for (let i = 0; i < count; i++) {
          setTimeout(() => {
            fallingGifts.push(new FallingGift(emoji, multiplier, data.value));
          }, i * 100);
        }

        totalGiftsReceived++;
        totalValue += data.value;
        updateStats();
      }
    } catch (err) {
      console.error('[Gift Rain WS]:', err);
    }
  };

  ws.onclose = () => setTimeout(connectWs, 2000);
  ws.onopen = () => console.log('[Gift Rain] Conectado');
}

function estimateMultiplier(diamondValue) {
  if (diamondValue <= 1) return 1;
  if (diamondValue <= 5) return 5;
  if (diamondValue <= 10) return 10;
  if (diamondValue <= 50) return 50;
  if (diamondValue <= 100) return 100;
  if (diamondValue <= 500) return 500;
  return 1000;
}

function updateStats() {
  document.getElementById('total-gifts').textContent = `Presentes: ${totalGiftsReceived}`;
  document.getElementById('total-value').textContent = `Valor: 💎 ${totalValue}`;
}

function loop(t) {
  const dt = Math.min(3, (t - lastT) / 16.67);
  lastT = t;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  fallingGifts = fallingGifts.filter((g) => {
    g.update(dt);
    g.draw();
    return g.life > 0 && g.y < canvas.height + 100;
  });

  requestAnimationFrame(loop);
}

connectWs();
requestAnimationFrame(loop);
