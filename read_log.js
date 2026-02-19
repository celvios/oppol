
const fs = require('fs');
const path = require('path');

const files = ['deploy_results.txt', 'deploy_12_output.txt'];

files.forEach(file => {
    try {
        console.log(`--- Reading ${file} ---`);
        let data;
        try {
            data = fs.readFileSync(file, 'utf8');
        } catch (e) {
            console.log("UTF8 failed, trying UTF16LE");
            data = fs.readFileSync(file, 'utf16le');
        }

        const matches = data.match(/0x[a-fA-F0-9]{64}/g);
        if (matches) {
            console.log(`Found ${matches.length} hashes. First 5:`);
            matches.slice(0, 5).forEach(h => console.log(h));
        } else {
            console.log("No hashes found in " + file);
        }
    } catch (err) {
        console.error(`Error reading ${file}:`, err.message);
    }
});
