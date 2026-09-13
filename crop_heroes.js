const { Jimp } = require('jimp');

async function process() {
    const bolso = await Jimp.read('public/games/luta/assets/bolso_clean.png');
    bolso.autocrop();
    await bolso.write('public/games/luta/assets/bolso_cropped.png');
    
    const lula = await Jimp.read('public/games/luta/assets/lula_clean.png');
    lula.autocrop();
    await lula.write('public/games/luta/assets/lula_cropped.png');
    
    console.log('Cropped successfully!');
}
process().catch(console.error);
