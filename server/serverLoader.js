const { workerData, parentPort } = require("worker_threads");
const path = require("path");
const fs = require("fs");

// Load environment variables from .env if it exists (local dev), otherwise use process.env (production)
const envPath = fs.existsSync(path.join(__dirname, "./.env"))
    ? path.join(__dirname, "./.env")
    : path.join(__dirname, "../.env");
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
    } else if (cmd === "broadcast") {
        global.gameManager.socketManager.broadcast(args[0]);
    } else if (cmd === "updateRole") {
        const username = args[0];
        const role = args[1];
        const socketManager = global.gameManager.socketManager;
        const canonicalTarget = username.toLowerCase();
        const accounts = require("./lib/accounts.js");
        (async () => {
            for (const client of socketManager.clients) {
                if (client.account && client.account.username.toLowerCase() === canonicalTarget) {
                    client.account.role = role;
                    client.permissions = await accounts.getPermissionsForSession(client.key);
                    client.isAdmin = (client.permissions && client.permissions.administrator) || (global.Config.admin_tokens && global.Config.admin_tokens.includes(client.key));
                    client.talk("m", 5_000, `Your account role has been updated to: ${role}`);
                    if (client.player && client.player.body) {
                        client.player.body.sendMessage(`Your permissions have been updated. Re-spawn to take effect.`);
                    }
                }
            }
        })().catch(err => console.error(err));
    }
});
