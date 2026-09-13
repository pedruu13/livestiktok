const { Jimp } = require('jimp');
async function run() {
    const img = await Jimp.read('public/games/luta/assets/bolso_sprites.png');
    console.log(img.bitmap.width, img.bitmap.height);
}
run();
