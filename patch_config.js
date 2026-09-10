const fs = require('fs');

// 1. Modificar o HTML do Painel de Controle
let html = fs.readFileSync('dashboard/index.html', 'utf8');
if(!html.includes('id="pos-leaderboard"')) {
  const configBox = `
    <div class="box">
      <label>⚙️ Posição na Tela do Jogo:</label>
      <div style="display: flex; gap: 10px; margin-bottom: 5px;">
        <select id="pos-leaderboard" style="padding: 8px; width: 50%; background: #0f172a; color: white; border: 1px solid #475569; border-radius: 8px;">
          <option value="top-left">Placar: Topo Esq</option>
          <option value="top-right">Placar: Topo Dir</option>
          <option value="bottom-left">Placar: Baixo Esq</option>
          <option value="bottom-right">Placar: Baixo Dir</option>
          <option value="hidden">Placar: Oculto</option>
        </select>
        <select id="pos-gifts" style="padding: 8px; width: 50%; background: #0f172a; color: white; border: 1px solid #475569; border-radius: 8px;">
          <option value="bottom-center">Guia: Baixo</option>
          <option value="top-center">Guia: Topo</option>
          <option value="hidden">Guia: Oculto</option>
        </select>
      </div>
    </div>
  `;
  html = html.replace('<div class="box">\n      <label>Testar Jogo (Off-Live):</label>', configBox + '\n    <div class="box">\n      <label>Testar Jogo (Off-Live):</label>');
  
  const configJs = `
    document.getElementById('pos-leaderboard').addEventListener('change', (e) => {
      ipcRenderer.send('overlay-config', { target: 'leaderboard', value: e.target.value });
    });
    document.getElementById('pos-gifts').addEventListener('change', (e) => {
      ipcRenderer.send('overlay-config', { target: 'gifts', value: e.target.value });
    });
  `;
  html = html.replace("document.getElementById('testGiftBtn').addEventListener('click', () => ipcRenderer.send('test-event', 'gift'));", "document.getElementById('testGiftBtn').addEventListener('click', () => ipcRenderer.send('test-event', 'gift'));\n" + configJs);
  fs.writeFileSync('dashboard/index.html', html);
}

// 2. Modificar main.js para repassar as configurações
let mainJs = fs.readFileSync('main.js', 'utf8');
if(!mainJs.includes('overlay-config')) {
  const configIpc = `
ipcMain.on('overlay-config', (event, data) => {
  if (broadcastFunc) broadcastFunc({ type: 'config', ...data });
});
  `;
  mainJs = mainJs.replace("ipcMain.on('change-volume'", configIpc + "\nipcMain.on('change-volume'");
  // Aumentar altura do painel principal para caber a nova caixa
  mainJs = mainJs.replace('height: 520,', 'height: 620,');
  fs.writeFileSync('main.js', mainJs);
}

// 3. Modificar kite-game.js para obedecer às configurações
let kiteJs = fs.readFileSync('overlay/kite-game.js', 'utf8');
if(!kiteJs.includes("data.type === 'config'")) {
  const configLogic = `
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
  `;
  kiteJs = kiteJs.replace("if (data.type === 'gift')", configLogic + "\n    if (data.type === 'gift')");
  fs.writeFileSync('overlay/kite-game.js', kiteJs);
}

console.log("Configurações injetadas com sucesso!");
