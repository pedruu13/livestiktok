const { Jimp } = require('jimp');
async function run() {
    const bg = await Jimp.read('C:/Users/pp/.gemini/antigravity/brain/a1e7854b-3710-4627-849d-cccd41703e49/.user_uploaded/media_1789332944704.jpg');
    console.log('Original BG:', bg.bitmap.width, 'x', bg.bitmap.height);
}
run();
