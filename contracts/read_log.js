const fs = require('fs');
try {
    const content = fs.readFileSync('zap_deploy.log', 'utf16le');
    console.log(content);
} catch (e) {
    console.log("Error reading file:", e.message);
    try {
        const content8 = fs.readFileSync('zap_deploy.log', 'utf8');
        console.log(content8);
    } catch (e2) {
        console.log("Error reading utf8:", e2.message);
    }
}
