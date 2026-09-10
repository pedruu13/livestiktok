const fs = require('fs');

// 1. Alterar o relógio para 5 minutos (300 segundos)
let kiteJs = fs.readFileSync('overlay/kite-game.js', 'utf8');
kiteJs = kiteJs.replace(/let time = 90;/g, 'let time = 300;');
kiteJs = kiteJs.replace(/if\(time <= 0\) time = 90;/g, 'if(time <= 0) time = 300;');
fs.writeFileSync('overlay/kite-game.js', kiteJs);

// 2. Limpar o nome de usuário (remover o @) para evitar erros do TikTok
let mainJs = fs.readFileSync('main.js', 'utf8');
if (!mainJs.includes("username.replace('@'")) {
  mainJs = mainJs.replace("ipcMain.on('start-connection', async (event, username) => {", "ipcMain.on('start-connection', async (event, username) => {\n  username = username.replace('@', '').trim(); // LIMPEZA AUTOMÁTICA DO ARROBA");
  fs.writeFileSync('main.js', mainJs);
}
console.log("Tempo ajustado para 5m e filtro de @ aplicado.");
