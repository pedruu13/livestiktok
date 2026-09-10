# Pipas no Céu — overlay de live da TikTok

MVP do jogo de "pipas subindo e cortando a linha uma da outra" que aparece
como overlay em cima da live. Presentes fazem a pipa da pessoa subir; quando
duas pipas se cruzam, uma corta a outra (quem tem mais poder acumulado tem
mais chance de vencer o corte).

## Como funciona

```
src/
  tiktokListener.js -> conecta na live, normaliza eventos de chat/gift
  wsServer.js        -> repassa esses eventos via WebSocket
  index.js           -> entrypoint: serve o overlay + liga tudo
overlay/
  index.html / style.css / kite-game.js -> o jogo em si (Canvas 2D),
  isso é o que você adiciona no OBS como Browser Source
```

## Rodando

1. `npm install`
2. `cp .env.example .env` e preencha `TIKTOK_USERNAME`
3. `npm start` — precisa da conta já **ao vivo** na TikTok
4. No OBS: **Fontes → + → Navegador (Browser Source)**
   - URL: `http://localhost:3001`
   - Largura/altura: a resolução da sua cena (ex: 1080x1920 pra live vertical)
   - Marque "Atualizar navegador quando a cena ficar ativa"

## Testando sem estar ao vivo

Abra `http://localhost:3001/?demo=true` — isso liga um modo demo que gera
presentes falsos de nomes aleatórios a cada ~600ms, só pra você ver o jogo
funcionando e ajustar o visual antes de ir pra live de verdade.

## O que já está pronto

- Pipa nasce quando a pessoa comenta, sobe conforme manda presentes (mais
  presente = "mais cerol" = voa mais alto e serra mais rápido)
- Cada pipa mira sozinha na pipa viva mais fraca por perto e faz um
  "debicar" (mergulho) pra tentar cruzar a linha dela — igual no jogo
  original, não é corte por sorteio de proximidade
- Depois de cruzar, entra numa fase de "serrando" com barra de progresso
  visível — quem tem mais poder acumulado serra mais rápido
- Depois de cortar, a pipa caída fica alguns segundos no ar e quem cortou
  precisa perseguir e **aparar a rabiola** — só isso conta ponto de verdade
  (vira "troféu"). Cortar sem aparar não soma no placar, só no contador
  de cortes que serve de desempate
- Leaderboard no canto superior esquerdo (top 3 por troféus/rabiolas aparadas)
- Timer de rodada (90s por padrão) que reinicia tudo ao zerar

## Próximos ajustes que valem a pena

- **Balanceamento**: hoje `RISE_PER_POWER` e a fórmula de chance de corte em
  `kite-game.js` são um ponto de partida — ajuste jogando no modo demo.
- **Persistência entre rodadas**: hoje zera tudo quando o timer acaba; se
  quiser um placar do dia inteiro, salve `power`/`cuts` antes do `kites.clear()`.
- **Efeitos sonoros**: adicionar um `<audio>` tocado em `spawnCutParticles()`
  dá um impacto e tanto pra live.
- **Trocar o visual**: o `style.css` já imita o pôr do sol com casinhas da
  referência — troque o `background` do `#hud`/`body` ou desenhe o skyline
  no canvas se quiser mais fidelidade.

## Aviso

Usa a API não-oficial da TikTok LIVE (`tiktok-live-connector`). Reveja os
Termos de Uso da TikTok antes de publicar/monetizar algo baseado nisso.
