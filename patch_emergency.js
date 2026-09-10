const fs = require('fs');

// 1. ARRUMAR O TIKTOK LISTENER PARA RETORNAR A PROMESSA DE CONEXÃO VERDADEIRA
let tiktokJs = fs.readFileSync('src/tiktokListener.js', 'utf8');
tiktokJs = tiktokJs.replace('function startTiktokListener(username) {', 'function startTiktokListener(username) {\n  const tiktok = new (require("tiktok-live-connector").WebcastPushConnection)(username);');
tiktokJs = tiktokJs.replace('const tiktok = new WebcastPushConnection(username);', '');
tiktokJs = tiktokJs.replace('return emitter;', 'return { emitter, promise: tiktok.connect() };');
// Limpa o connect antigo que ficava solto
tiktokJs = tiktokJs.replace(/tiktok\s*\.connect\(\)\s*\.then\(\(state\) => \{[\s\S]*?\}\)\s*\.catch\(\(err\) => \{[\s\S]*?\}\);/g, '');
fs.writeFileSync('src/tiktokListener.js', tiktokJs);

// 2. ARRUMAR O MAIN.JS PARA SÓ DAR "CONECTADO" SE A PROMESSA FUNCIONAR
let mainJs = fs.readFileSync('main.js', 'utf8');
mainJs = mainJs.replace("ipcMain.on('start-connection', (event, username) => {", "ipcMain.on('start-connection', async (event, username) => {");
const oldTryBlock = `const tiktokEvents = startTiktokListener(username);
    
    tiktokEvents.on('chat', (data) => broadcastFunc && broadcastFunc({ type: 'chat', ...data }));
    tiktokEvents.on('gift', (data) => broadcastFunc && broadcastFunc({ type: 'gift', ...data }));
    
    event.reply('connection-status', { 
      success: true, 
      msg: \`Conectado na live de @\${username}!\` 
    });`;
const newTryBlock = `const { emitter: tiktokEvents, promise: connectionPromise } = startTiktokListener(username);
    
    await connectionPromise; // TRAVA DE SEGURANÇA: ESPERA CONECTAR DE VERDADE
    
    tiktokEvents.on('chat', (data) => broadcastFunc && broadcastFunc({ type: 'chat', ...data }));
    tiktokEvents.on('gift', (data) => broadcastFunc && broadcastFunc({ type: 'gift', ...data }));
    
    event.reply('connection-status', { 
      success: true, 
      msg: \`SUCESSO! Conectado na live de @\${username}!\` 
    });`;
mainJs = mainJs.replace(oldTryBlock, newTryBlock);
fs.writeFileSync('main.js', mainJs);

// 3. DAR VIDA AO RELÓGIO DA TELA (CONTAGEM REGRESSIVA)
let kiteJs = fs.readFileSync('overlay/kite-game.js', 'utf8');
if(!kiteJs.includes('// RELÓGIO')) {
  kiteJs += `\n
// RELÓGIO / TIMER DA LIVE
let time = 90;
setInterval(() => {
  time--;
  if(time <= 0) time = 90; // Reseta a cada 1 min e meio
  let m = Math.floor(time / 60);
  let s = time % 60;
  const tEl = document.getElementById('timer');
  if(tEl) tEl.innerText = \`0\${m}:\${s < 10 ? '0' : ''}\${s}\`;
}, 1000);
`;
  fs.writeFileSync('overlay/kite-game.js', kiteJs);
}

console.log('Correções Críticas Aplicadas!');
