const { Jimp } = require('jimp');
async function run() {
    const bg = await Jimp.read('public/games/luta/assets/bg_mockup.jpg');
    console.log('Upscaled BG:', bg.bitmap.width, 'x', bg.bitmap.height);
}
run();
