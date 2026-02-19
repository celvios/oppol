
const fs = require('fs');
try {
    const data = fs.readFileSync('deploy_results.txt'); // buffer
    console.log(data.toString('utf8').substring(0, 1000));
    console.log("--- HEX ---");
    console.log(data.subarray(0, 100).toString('hex'));
} catch (e) { console.error(e); }
