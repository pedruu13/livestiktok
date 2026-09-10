require('dotenv').config();
const path = require('path');
const express = require('express');
const { startTiktokListener } = require('./tiktokListener');
const { createWsRelay } = require('./wsServer');

const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME;
const PORT = process.env.PORT || 3001;

const app = express();
app.use(express.static(path.join(__dirname, '..', 'overlay')));

const httpServer = app.listen(PORT, () => {
  console.log(`[server] overlay disponível em http://localhost:${PORT}`);
  console.log('[server] adicione essa URL como Browser Source no OBS');
});

const { broadcast } = createWsRelay(httpServer);

if (!TIKTOK_USERNAME || TIKTOK_USERNAME === 'seu_usuario_da_tiktok') {
  console.warn('\n================================================================');
  console.warn('[AVISO] TIKTOK_USERNAME ainda não foi preenchido no arquivo .env!');
  console.warn('[AVISO] O modo Demo (http://localhost:3001/?demo=true) funcionará perfeitamente.');
  console.warn('[AVISO] Para conectar na sua live real, coloque seu usuário no .env');
  console.warn('================================================================\n');
} else {
  console.log(`[tiktok] tentando conectar com a conta @${TIKTOK_USERNAME}...`);
  const tiktokEvents = startTiktokListener(TIKTOK_USERNAME);
  tiktokEvents.on('chat', (data) => broadcast({ type: 'chat', ...data }));
  tiktokEvents.on('gift', (data) => broadcast({ type: 'gift', ...data }));
}
