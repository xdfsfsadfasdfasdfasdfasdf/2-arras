const { workerData, parentPort } = require("worker_threads");
const path = require("path");
const fs = require("fs");

// Load environment variables from .env if it exists (local dev), otherwise use process.env (production)
const envPath = path.join(__dirname, "./.env");
if (fs.existsSync(envPath)) {
    const dotenv = require("./lib/dotenv.js");
    const environment = dotenv(fs.readFileSync(envPath).toString());
    for (const key in environment) {
        process.env[key] = environment[key];
    }
}

// Load required game components
let GLOBAL = require("./loaders/loader.js");
// Create the game server
new (require("./game.js").gameServer)(
    workerData.host,
    workerData.port,
    workerData.gamemode,
    workerData.region,
    workerData.webProperties,
    workerData.properties,
    workerData.isFeatured,
    parentPort,
    GLOBAL
);

// Handle commands sent from the main thread (dev terminal)
parentPort.on("message", (data) => {
    const [cmd, ...args] = data;
    if (!global.gameManager) return;
    if (cmd === "closeArena") {
        if (args[0]) global.gameManager._forcedVariation = args[0];
        global.gameManager.closeArena();
    } else if (cmd === "stopArena") {
        if (args[0]) global.gameManager._forcedVariation = args[0];
        global.gameManager.stopArena();
    } else if (cmd === "broadcast") global.gameManager.socketManager.broadcast(args[0]);
});
