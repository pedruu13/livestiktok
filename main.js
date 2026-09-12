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
    width: 900,
    height: 750,
    resizable: true,
    autoHideMenuBar: true,
    title: "LiveTikTok - Painel Unificado",
    backgroundColor: '#0f172a', // Cor de fundo do painel
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadURL('http://localhost:3001');
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

ipcMain.on('start-connection', async (event, data) => {
  const { username: rawUsername, gameUrl } = data;
  const username = rawUsername.replace('@', '').trim(); // LIMPEZA AUTOMÁTICA DO ARROBA
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
        backgroundColor: '#000000', // <-- EVITA A TELA BRANCA INICIAL
        show: false, // Só mostra depois que carregar
        title: "Pipa Combate - Tela do Jogo (Ao Vivo)",
        webPreferences: {
          autoplayPolicy: 'no-user-gesture-required'
        }
      });
      
      gameWindow.once('ready-to-show', () => {
        gameWindow.show();
      });

      gameWindow.on('closed', () => {
        gameWindow = null;
      });
    }
    
    // Sempre carrega o jogo selecionado
    gameWindow.loadURL(`http://localhost:3001${gameUrl || '/games/pipas/'}`);

  } catch (err) {
    event.reply('connection-status', { 
      success: false, 
      msg: `Erro: ${err.message}` 
    });
  }
});


ipcMain.on('change-game', (event, url) => {
  if (gameWindow) {
    gameWindow.loadURL(`http://localhost:3001${url}`);
  }
  if (broadcastFunc) {
    broadcastFunc({ type: 'change-game', url });
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
