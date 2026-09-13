const { Jimp } = require('jimp');
const path = require('path');

async function processLula() {
    const inputFile = 'C:/Users/pp/.gemini/antigravity/brain/a1e7854b-3710-4627-849d-cccd41703e49/.user_uploaded/media_1789333762178.jpg';
    const outputFile = 'public/games/luta/assets/lula_clean.png';
    console.log('Processing Lula...');
    
    const img = await Jimp.read(inputFile);
    
    // Remove black background (RGB close to 0)
    img.scan(0, 0, img.bitmap.width, img.bitmap.height, function(x, y, idx) {
        const r = this.bitmap.data[idx + 0];
        const g = this.bitmap.data[idx + 1];
        const b = this.bitmap.data[idx + 2];
        
        if (r < 20 && g < 20 && b < 20) {
            this.bitmap.data[idx + 3] = 0; // Transparent
        }
    });

    await img.write(outputFile);
    console.log('Lula saved!');
}

async function processBolso() {
    const inputFile = 'C:/Users/pp/.gemini/antigravity/brain/a1e7854b-3710-4627-849d-cccd41703e49/.user_uploaded/media_1789333762246.png';
    const outputFile = 'public/games/luta/assets/bolso_clean.png';
    console.log('Processing Bolso...');
    
    const img = await Jimp.read(inputFile);
    
    // Remove white background (RGB close to 255) if it exists
    img.scan(0, 0, img.bitmap.width, img.bitmap.height, function(x, y, idx) {
        const r = this.bitmap.data[idx + 0];
        const g = this.bitmap.data[idx + 1];
        const b = this.bitmap.data[idx + 2];
        
        if (r > 240 && g > 240 && b > 240) {
            this.bitmap.data[idx + 3] = 0; // Transparent
        }
    });

    await img.write(outputFile);
    console.log('Bolso saved!');
}

async function run() {
    await processLula();
    await processBolso();
}

run().catch(console.error);
