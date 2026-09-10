const { WebSocketServer } = require('ws');

/** Cria um WS server anexado a um http.Server já existente e devolve uma função broadcast(). */
function createWsRelay(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (socket) => {
    console.log('[ws] overlay conectado');
    socket.send(JSON.stringify({ type: 'hello' }));
  });

  function broadcast(payload) {
    const message = JSON.stringify(payload);
    wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) client.send(message);
    });
  }

  return { broadcast };
}

module.exports = { createWsRelay };
