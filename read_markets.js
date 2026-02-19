
const fs = require('fs');
const path = require('path');

const file = 'markets_live.txt';

try {
    console.log(`--- Reading ${file} ---`);
    let data;
    try {
        data = fs.readFileSync(file, 'utf8');
    } catch (e) {
        console.log("UTF8 failed, trying UTF16LE");
        data = fs.readFileSync(file, 'utf16le');
    }

    // Just print the first 20 lines to find an ID
    const lines = data.split('\n');
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
        console.log(lines[i].trim());
    }
} catch (err) {
    console.error(`Error reading ${file}:`, err.message);
}
