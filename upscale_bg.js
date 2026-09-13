const { Jimp } = require('jimp');
const fs = require('fs');

async function upscaleBg() {
    const inputFile = 'C:/Users/pp/.gemini/antigravity/brain/a1e7854b-3710-4627-849d-cccd41703e49/.user_uploaded/media_1789332944704.jpg';
    const outputFile = 'public/games/luta/assets/bg_mockup.jpg';
    
    console.log('Reading:', inputFile);
    const img = await Jimp.read(inputFile);
    
    console.log('Resizing to 1920x1080 (Full HD)...');
    img.resize({ w: 1920, h: 1080 }); // Jimp v1 resize format might be different, let's use standard resize(1920, 1080)
    // Wait, Jimp v1 resize is img.resize({ w: 1920, h: 1080 })
    // Let's use standard method.
    
    await img.write(outputFile);
    console.log('Saved to:', outputFile);
}

upscaleBg().catch(console.error);
