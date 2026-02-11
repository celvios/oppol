const fs = require('fs');
async function main() {
    console.log("Starting test...");
    try {
        fs.writeFileSync("C:/Users/toluk/Documents/oppol/test_fs.txt", "Hello World");
        console.log("File written successfully.");
    } catch (e) {
        console.error("Error writing file:", e);
    }
}
main();
