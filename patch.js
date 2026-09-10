const fs = require('fs');
let code = fs.readFileSync('overlay/kite-game.js', 'utf8');

// 1. lastActive
code = code.replace(/this\.phase = Math\.random\(\) \* Math\.PI \* 2;/, 'this.phase = Math.random() * Math.PI * 2;\n    this.lastActive = performance.now();');
code = code.replace(/this\.shieldUntil = performance\.now\(\) \+ 5000;/, 'this.shieldUntil = performance.now() + 5000;\n    this.lastActive = performance.now();');

// 2. VIP Size
code = code.replace(/let size = 20 \+ Math\.min\(this\.power, 60\);/, 'let size = 25 + Math.min(this.power * 0.4, 80);');

// 3. Neon Aura
code = code.replace(/\/\/ PISCA BRANCO SE CORTOU ALGU.M/, '// AURA NEON PARA PRESENTES E VIP\n    if (this.power >= 50) {\n      ctx.shadowColor = skin.tip;\n      ctx.shadowBlur = this.power >= 200 ? 30 : 15;\n    }\n\n    // PISCA BRANCO');
code = code.replace(/ctx\.stroke\(\);\n\n    \/\/ RABIOLAS/, 'ctx.stroke();\n\n    // Limpa sombra pro resto\n    ctx.shadowBlur = 0;\n\n    // RABIOLAS');

// 4. Double Tails
const oldRab = /ctx\.beginPath\(\);\s+ctx\.moveTo\(0, size\);\s+for \(let i = 0; i < tailLength; i \+= 10\) \{[\s\S]*?ctx\.stroke\(\);/;
const newRab = `const rabiolas = this.power >= 200 ? [-size*0.3, size*0.3] : [0];
    rabiolas.forEach(offset => {
      ctx.beginPath();
      ctx.moveTo(offset, size);
      for (let i = 0; i < tailLength; i += 10) {
        let wave = offset + Math.sin(t * 0.008 - i * 0.06 + this.phase) * (size * 0.4);
        ctx.lineTo(wave, size + i);
      }
      ctx.strokeStyle = skin.tip;
      ctx.lineWidth = this.power >= 200 ? 3.5 : 1.5;
      ctx.stroke();
    });`;
code = code.replace(oldRab, newRab);

// 5. Crown
code = code.replace(/if \(this\.img\.complete/, `if (this.power >= 200) {
      ctx.font = '36px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('👑', 0, -size * 0.9 - 15);
    }

    if (this.img.complete`);

// 6. getOrCreateKite
code = code.replace(/if \(!kite\) \{/, 'if (!kite || !kite.alive) {');

// 7. Loop Anti-Clutter
const oldLoop = /const dt = Math\.min\(3, \(t - lastT\) \/ 16\.67\);[\s\S]*?ctx\.clearRect\(0, 0, canvas\.width, canvas\.height\);/;
const newLoop = `const dt = Math.min(3, (t - lastT) / 16.67);
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

  ctx.clearRect(0, 0, canvas.width, canvas.height);`;
code = code.replace(oldLoop, newLoop);

fs.writeFileSync('overlay/kite-game.js', code);
console.log('PATCHED');
