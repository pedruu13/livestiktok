const { Jimp } = require('jimp');

async function removeBackground(inputFile, outputFile) {
    const image = await Jimp.read(inputFile);
    
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
        const r = this.bitmap.data[idx + 0];
        const g = this.bitmap.data[idx + 1];
        const b = this.bitmap.data[idx + 2];
        
        if (Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && r > 130 && r < 210) {
            this.bitmap.data[idx + 3] = 0; 
        }
    });

    await image.write(outputFile);
    console.log('Processed', outputFile);
}

async function run() {
    await removeBackground('public/games/luta/assets/bolso_sprites.png', 'public/games/luta/assets/bolso_clean.png');
    await removeBackground('public/games/luta/assets/lula_sprites.png', 'public/games/luta/assets/lula_clean.png');
}

run();
