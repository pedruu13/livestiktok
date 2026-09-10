const fs = require('fs');

let js = fs.readFileSync('overlay/kite-game.js', 'utf8');

if (!js.includes('makeDraggable')) {
  js += `
// ====== SISTEMA DE ARRASTAR E SOLTAR (DRAG & DROP) ======
function makeDraggable(elmnt) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  // Muda o cursor do mouse para a cruzinha de arrastar
  elmnt.style.cursor = 'move';
  // Permite que o elemento receba cliques
  elmnt.style.pointerEvents = 'auto';
  
  elmnt.onmousedown = function(e) {
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    // Quando soltar o mouse, para de arrastar
    document.onmouseup = function() {
      document.onmouseup = null;
      document.onmousemove = null;
    };
    
    // Quando mover o mouse, calcula a nova posição
    document.onmousemove = function(e) {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      
      // Quebra as travas do CSS (transform, right, bottom) para mover livremente
      elmnt.style.transform = 'none';
      elmnt.style.bottom = 'auto';
      elmnt.style.right = 'auto';
      
      // Define o Top e Left acompanhando o mouse
      elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
      elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
    };
  };
}

// Aplica o sistema nos 3 menus da tela
makeDraggable(document.getElementById("hud"));
makeDraggable(document.getElementById("leaderboard"));
makeDraggable(document.getElementById("gift-guide"));
`;
  fs.writeFileSync('overlay/kite-game.js', js);
  console.log("Sistema Drag & Drop Injetado!");
}
