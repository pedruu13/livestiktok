const { Jimp } = require('jimp');
const path = require('path');

async function removeWhiteBg(fileName) {
    const filePath = path.join('public/games/luta/assets', fileName);
    const outPath = filePath.replace('.jpg', '.png');
    console.log('Processing', filePath, '->', outPath);
    const img = await Jimp.read(filePath);
    
    img.scan(0, 0, img.bitmap.width, img.bitmap.height, function(x, y, idx) {
        const r = this.bitmap.data[idx + 0];
        const g = this.bitmap.data[idx + 1];
        const b = this.bitmap.data[idx + 2];
        
        // If it's pure white or very close (e.g. > 240)
        if (r > 240 && g > 240 && b > 240) {
            this.bitmap.data[idx + 3] = 0; // Transparent
        }
    });

    await img.write(outPath);
}

async function run() {
    await removeWhiteBg('bolso_clean.jpg');
    await removeWhiteBg('lula_clean.jpg');
    await removeWhiteBg('bolso_punch.jpg');
    await removeWhiteBg('lula_punch.jpg');
}

run();
