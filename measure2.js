const { Jimp } = require('jimp');
async function run() {
    const bolso = await Jimp.read('public/games/luta/assets/bolso_cropped.png');
    console.log('Bolso:', bolso.bitmap.width, 'x', bolso.bitmap.height);
    const lula = await Jimp.read('public/games/luta/assets/lula_cropped.png');
    console.log('Lula:', lula.bitmap.width, 'x', lula.bitmap.height);
}
run();
