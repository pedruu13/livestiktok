# Pipas no Céu — Overlay de live da TikTok

MVP do jogo de "pipas subindo e cortando a linha uma da outra" que aparece
como overlay em cima da live. Presentes fazem a pipa da pessoa subir; quando
duas pipas se cruzam, uma corta a outra (quem tem mais poder acumulado tem
mais chance de vencer o corte).

## Como funciona

```
src/
  tiktokListener.js -> conecta na live, normaliza eventos de chat, gift e join (entrada)
  wsServer.js       -> repassa esses eventos via WebSocket
main.js             -> entrypoint (Electron): serve o painel de controle e o overlay
overlay/
  index.html / style.css / kite-game.js -> o jogo em si (Canvas 2D),
  isso é o que você captura (ou abre no OBS)
dashboard/
  index.html -> o painel de controle para configurar a live e o som
```

## Rodando

1. `npm install`
2. `npm start` — Isso abrirá o painel de controle.
3. Digite o seu @ do TikTok no painel e clique em Conectar (precisa estar **ao vivo**).
4. No OBS: Pode capturar diretamente a janela sem bordas do jogo que vai abrir, ou adicionar como **Navegador (Browser Source)**:
   - URL: `http://localhost:3001`
   - Largura/altura: a resolução da sua cena (ex: 1080x1920 pra live vertical)

## Testando sem estar ao vivo

Abra `http://localhost:3001/?demo=true` no navegador ou adicione isso no OBS. Isso liga um modo demo que gera 
presentes e novas entradas na live com nomes aleatórios, só para você ver o jogo
funcionando (pipas VIPs brigando no alto e pipas comuns embaixo) e ajustar o visual antes de ir pra live.

## O que já está pronto

- **Pipas Automáticas**: A pipa nasce com um poder básico no momento em que a pessoa **entra** na live (evento de Join/Member).
- **Interações (Chat e Presentes)**: Comentar ou mandar presentes aumenta a força da pipa ("mais cerol", voa mais alto e tem escudo).
- **Combate de Verdade**: Cada pipa mira sozinha na pipa viva mais fraca por perto e faz um
  "debicar" (mergulho) pra tentar cruzar a linha.
- **Vantagem Justa**: Quando as linhas se cruzam, quem tem mais poder acumulado tem mais chance de cortar a outra.
- **Rabiolas e Troféus**: Depois de cortar, a pipa caída fica alguns segundos no ar e quem cortou
  precisa perseguir e **aparar a rabiola** (conta como troféu no placar).
- **Garbage Collection (Performance)**: Sistema otimizado com limpeza automática de memória (exclui pipas mortas após 3 segundos) para a live aguentar horas sem travar.
- **Leaderboard** no canto superior esquerdo (top 3 por troféus e cortes).
- **Timer de rodada** (5 minutos) que reinicia tudo ao zerar.

## Próximos ajustes que valem a pena

- **Persistência entre rodadas**: hoje zera tudo quando o timer acaba; se
  quiser um placar do dia inteiro, salve `power`/`cuts` antes do `kites.clear()`.
- **Trocar o visual**: o `style.css` já imita o pôr do sol com casinhas da
  referência — troque o `background` ou desenhe no canvas se quiser mais fidelidade.

## Aviso

Usa a API não-oficial da TikTok LIVE (`tiktok-live-connector`). Reveja os
Termos de Uso da TikTok antes de publicar/monetizar algo baseado nisso.
