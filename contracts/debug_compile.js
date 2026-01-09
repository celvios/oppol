const { exec } = require("child_process");

console.log("Starting compilation...");
exec("npx hardhat compile", { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
    console.log("--- STDOUT ---");
    console.log(stdout);
    console.log("--- STDERR ---");
    console.log(stderr);
    if (error) {
        console.log("--- ERROR ---");
        console.log("Error code:", error.code);
    }
});
