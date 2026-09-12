const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const express = require('express');
const { createWsRelay } = require('./src/wsServer');
const { startTiktokListener } = require('./src/tiktokListener');

let mainWindow;
let gameWindow = null;
let expressApp = express();
let httpServer;
let broadcastFunc = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 450,
    height: 620,
    resizable: false,
    autoHideMenuBar: true,
    title: "Pipa Combate - Painel",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  mainWindow.loadFile('public/dashboard/index.html');
}

app.whenReady().then(() => {
  // Inicia o Servidor Local Overlay (OBS)
  expressApp.use(express.static(path.join(__dirname, 'public')));
  
  httpServer = expressApp.listen(3001, () => {
    console.log('[App] Overlay rodando em http://localhost:3001');
  });
  
  const wsRelay = createWsRelay(httpServer);
  broadcastFunc = wsRelay.broadcast;

  createWindow();
});

let currentTiktokConnection = null;

ipcMain.on('start-connection', async (event, username) => {
  username = username.replace('@', '').trim(); // LIMPEZA AUTOMÁTICA DO ARROBA
  try {
    if (currentTiktokConnection) {
      currentTiktokConnection.disconnect();
      currentTiktokConnection = null;
    }

    const connection = startTiktokListener(username);
    currentTiktokConnection = connection;
    const { emitter: tiktokEvents, promise: connectionPromise } = connection;
    
    await connectionPromise; // TRAVA DE SEGURANÇA: ESPERA CONECTAR DE VERDADE
    
    tiktokEvents.on('chat', (data) => broadcastFunc && broadcastFunc({ type: 'chat', ...data }));
    tiktokEvents.on('gift', (data) => broadcastFunc && broadcastFunc({ type: 'gift', ...data }));
    tiktokEvents.on('join', (data) => broadcastFunc && broadcastFunc({ type: 'join', ...data }));
    
    event.reply('connection-status', { 
      success: true, 
      msg: `SUCESSO! Conectado na live de @${username}!` 
    });

    // Abre a janela do jogo automaticamente!
    if (!gameWindow) {
      gameWindow = new BrowserWindow({
        width: 540,
        height: 960,
        frame: false, // <-- Tira a barra superior e as bordas (PERFEITO PARA CAPTURA)
        resizable: false,
        autoHideMenuBar: true,
        title: "Pipa Combate - Tela do Jogo (Ao Vivo)",
        webPreferences: {
          autoplayPolicy: 'no-user-gesture-required'
        }
      });
      gameWindow.loadURL('http://localhost:3001');
      
      gameWindow.on('closed', () => {
        gameWindow = null;
      });
    }

  } catch (err) {
    event.reply('connection-status', { 
      success: false, 
      msg: `Erro: ${err.message}` 
    });
  }
});


ipcMain.on('overlay-config', (event, data) => {
  if (broadcastFunc) broadcastFunc({ type: 'config', ...data });
});
  
ipcMain.on('change-volume', (event, volume) => {
  if (broadcastFunc) {
    broadcastFunc({ type: 'volume', value: volume });
  }
});

ipcMain.on('test-event', (event, type) => {
  if (!broadcastFunc) return;
  const rand = Math.floor(Math.random() * 9999);
  if (type === 'chat') {
    broadcastFunc({ type: 'chat', userId: 'bot_'+rand, name: 'Espectador '+rand, avatarUrl: '' });
  } else if (type === 'gift') {
    broadcastFunc({ type: 'gift', userId: 'rico_'+rand, name: 'Apoiador VIP', value: 50, avatarUrl: '' });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
