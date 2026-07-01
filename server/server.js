// Log startup messages
console.log("Starting up...");
console.log("Importing modules...\n");

const path = require("path");
const fs = require("fs");
const http = require("http");
const url = require("url");
const pjson = require('../package.json')
const accounts = require("./lib/accounts.js");

const { Worker, SHARE_ENV } = require("worker_threads");

// Increase the stack trace limit for better debugging
Error.stackTraceLimit = Infinity;

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

// Load all necessary modules and files via the loader
const GLOBAL = require("./loaders/loader.js");

// Load definitions and tile definitions
new definitionCombiner(
    {
        groups: path.join(__dirname, './lib/definitions/groups'),
        addonsFolder: path.join(__dirname, './lib/definitions/entityAddons')
    }
).loadDefinitions();
GLOBAL.loadRooms(true);

// Optionally load all mockups if enabled in configuration
if (Config.load_all_mockups) global.loadAllMockups();

// Log loader information including creation date and time
console.log(`Successfully loaded all files.`);
console.log(`Created on date ${GLOBAL.creationDate} at timestamp ${GLOBAL.creationTime}`);

// Define the public directory for static files
const publicRoot = path.join(__dirname, "../public/"),
mimeSet = {
    js: "application/javascript",
    json: "application/json",
    css: "text/css",
    html: "text/html",
    md: "text/markdown",
    png: "image/png",
    svg: "image/svg+xml",
};

let wsServer; // WebSocket server instance
let server; // HTTP server instance

function readJsonBody(req, callback) {
    let body = "";
    req.on("data", chunk => {
        body += chunk;
        if (body.length > 1e6) req.destroy();
    });
    req.on("end", () => {
        try {
            callback(JSON.parse(body || "{}"));
        } catch {
            callback(null);
        }
    });
}

function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
}

function getSessionFromRequest(req) {
    const authorization = req.headers.authorization || "";
    if (authorization.startsWith("Bearer ")) return authorization.slice("Bearer ".length).trim();
    return "";
}

// Attempt to create a WebSocket server instance using the 'ws' package
try {
    const WebSocketServer = require("ws").WebSocketServer;
    wsServer = new WebSocketServer({ noServer: true });
} catch (err) {
    throw new Error(
        "Package 'ws' is not installed! To install it, run 'npm install ws' in the terminal."
    );
}

// Log a warning if Access-Control-Allow-Origin is enabled
if (Config.allow_ACAO && Config.startup_logs) {
    util.warn("Access-Control-Allow-Origin is enabled, which allows any server/client to access data from the WebServer.");
}

// Create an HTTP server to handle both API and static file requests
server = http.createServer(async (req, res) => {
    let query = {};
    let pathname = req.url.split("?")[0];
    if (req.url.includes("?")) req.url.split("?")[1].split("&").map(i => {
        let key = i.split("=")[0];
        let value = i.split("=")[1];
        query[key] = value;
    });
    let readString = ""; // Response content for API endpoints
    let ok = true; // Flag to indicate whether we use default API response
    let serversIP = [];
    let clientHeaders = ["/ext/custom-shape"];
    let selectedHeader = null;

    // Set CORS headers if enabled in the configuration or allow only the children servers.
    for (let server of global.servers) if (server.ip !== Config.host && server.ip) {
        let http = server.ip.startsWith("localhost") ? `http://${server.ip}` : `https://${server.ip}`;
        serversIP.push(http);
    };
    if (Config.allow_ACAO || serversIP.includes(req.headers.origin)) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    }
    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }
    for (let i = 0; i < clientHeaders.length; i++) {
        if (clientHeaders[i] == req.url) {
            selectedHeader = clientHeaders[i];
        }
    }
    // Handle specific API endpoints based on the request URL
    switch (pathname) {
        case "/api/account/register": {
            ok = false;
            readJsonBody(req, async json => {
                if (!json) return sendJson(res, 400, { ok: false, error: "Invalid JSON body." });
                const result = await accounts.register(json.username, json.password);
                sendJson(res, result.ok ? 200 : 400, result);
            });
        } break;

        case "/api/account/login": {
            ok = false;
            readJsonBody(req, async json => {
                if (!json) return sendJson(res, 400, { ok: false, error: "Invalid JSON body." });
                const result = await accounts.login(json.username, json.password);
                sendJson(res, result.ok ? 200 : 401, result);
            });
        } break;

        case "/api/account/logout": {
            ok = false;
            readJsonBody(req, async json => {
                const session = getSessionFromRequest(req) || json?.session || "";
                const result = await accounts.logout(session);
                sendJson(res, 200, result);
            });
        } break;

        case "/api/account/me": {
            ok = false;
            const account = await accounts.getAccountBySession(getSessionFromRequest(req));
            sendJson(res, account ? 200 : 401, account ? { ok: true, account } : { ok: false, error: "Not logged in." });
        } break;

        case "/api/account/watch-ad": {
            ok = false;
            const account = await accounts.getAccountBySession(getSessionFromRequest(req));
            if (!account) {
                sendJson(res, 401, { ok: false, error: "Not logged in." });
            } else {
                const result = await accounts.grantAdWatcher(account.id);
                sendJson(res, 200, result);
            }
        } break;

        case "/api/account/search": {
            ok = false;
            const targetUsername = query.username || "";
            const account = await accounts.searchAccount(targetUsername);
            if (!account) {
                sendJson(res, 404, { ok: false, error: "User not found." });
            } else {
                const executorSession = getSessionFromRequest(req);
                const executorPermissions = executorSession ? await accounts.getPermissionsForSession(executorSession) : null;
                const canManage = executorPermissions && executorPermissions.level >= 3;
                sendJson(res, 200, { ok: true, account, canManage });
            }
        } break;

        case "/api/account/update-bio": {
            ok = false;
            readJsonBody(req, async json => {
                const session = getSessionFromRequest(req) || json?.session || "";
                const result = await accounts.updateBio(session, json?.bio);
                sendJson(res, result.ok ? 200 : 400, result);
            });
        } break;

        case "/api/account/update-role": {
            ok = false;
            readJsonBody(req, async json => {
                const session = getSessionFromRequest(req) || json?.session || "";
                const targetUsername = json?.targetUsername || "";
                const action = json?.action || "";
                
                const executorPermissions = await accounts.getPermissionsForSession(session);
                if (!executorPermissions || executorPermissions.level < 3) {
                    return sendJson(res, 403, { ok: false, error: "Unauthorized. Requires dev or eternal role." });
                }
                
                const executorRoleStr = executorPermissions.role || "player";
                const isEternal = executorRoleStr.split(",").map(r => r.trim().toLowerCase()).includes("eternal") || executorPermissions.accountName.toLowerCase() === "phi";
                
                const targetAccount = await accounts.getAccountByUsername(targetUsername);
                if (!targetAccount) return sendJson(res, 404, { ok: false, error: "Target user not found." });
                
                let targetRoles = (targetAccount.role || "player").split(",").map(r => r.trim().toLowerCase()).filter(Boolean);
                if (targetAccount.username.toLowerCase() === "phi") {
                    targetRoles = ["eternal"];
                }
                
                let newRoleStr = "";
                let targetRole = "player";
                
                if (action === "promote") {
                    if (targetRoles.includes("player")) {
                        targetRole = "shiny";
                    } else if (targetRoles.includes("shiny")) {
                        targetRole = "developer";
                    } else if (targetRoles.includes("developer") || targetRoles.includes("dev")) {
                        targetRole = "eternal";
                    } else {
                        return sendJson(res, 400, { ok: false, error: "User is already at the maximum role." });
                    }
                    
                    if (targetRole === "eternal" && !isEternal) {
                        return sendJson(res, 403, { ok: false, error: "Only eternal accounts can promote to eternal." });
                    }
                    if (targetRole === "developer" && !isEternal) {
                        return sendJson(res, 403, { ok: false, error: "Only eternal accounts can promote to developer." });
                    }
                    
                    let newRoles = targetRoles.filter(r => r !== "player");
                    if (!newRoles.includes(targetRole)) newRoles.push(targetRole);
                    newRoleStr = newRoles.join(",");
                } else if (action === "demote") {
                    const targetHasEternal = targetRoles.includes("eternal");
                    const targetHasDev = targetRoles.includes("developer") || targetRoles.includes("dev");
                    
                    if (targetHasEternal && !isEternal) {
                        return sendJson(res, 403, { ok: false, error: "You cannot demote an eternal account." });
                    }
                    if (targetHasDev && !isEternal) {
                        return sendJson(res, 403, { ok: false, error: "You cannot demote a developer account." });
                    }
                    
                    newRoleStr = "player";
                } else {
                    return sendJson(res, 400, { ok: false, error: "Invalid action." });
                }
                
                const resDb = await accounts.updateAccountRole(targetUsername, newRoleStr);
                if (resDb.ok) {
                    updateLocalClients(targetUsername, newRoleStr);
                    if (global.serverWorkers) {
                        for (let worker of global.serverWorkers) {
                            if (worker) {
                                worker.postMessage(["updateRole", targetUsername, newRoleStr]);
                            }
                        }
                    }
                    sendJson(res, 200, { ok: true, role: newRoleStr });
                } else {
                    sendJson(res, 500, { ok: false, error: resDb.error || "Failed to update role." });
                }
            });
        } break;

        case "/getServers.json": {
            // Serve a list of active servers (excluding hidden ones)
            readString = JSON.stringify(servers.filter((s) => s && !s.hidden).map((server) => ({
                ip: server.ip,
                players: server.players,
                maxPlayers: server.maxPlayers,
                id: server.id,
                featured: server.featured,
                region: server.region,
                gameMode: server.gameMode,
            })));
        } break;
        case "/getTotalPlayers": {
            let countPlayers = 0;
            servers.forEach((s) => {
                countPlayers += s.players;
            });
            readString = JSON.stringify(countPlayers);
        } break;
        case "/version": {
            readString = JSON.stringify({ver: 'v' + pjson.version, devBuild: Config.devBuild});
        } break;
        
        case "/api/getAddonAuthors": {
            if (!query.token || query.token !== process.env.DEVELOPER) {
                res.writeHead(403);
                res.end("Forbidden");
                return;
            }
            readString = JSON.stringify(global.addonAuthorInfos);
        } break;


        case "/api/sendPlayer": {
            ok = false;
            let body = "";
            req.on("data", c => body += c);
            req.on("end", () => {
                let json = null;
                try {
                    json = JSON.parse(body);
              } catch { }
                  if (json) {
                      if (json.key === process.env.API_KEY) {
                            let { id, name, definition, score, level, skillcap, skill, points, killCount } = json;
                            global.travellingPlayers.push({ id, name, definition, score, level, skillcap, skill, points, killCount });
                            res.writeHead(200);
                            res.end("OK");
                        } else {
                            res.writeHead(403);
                            res.end("Access Denied");
                        }
                    } else {
                        res.writeHead(400);
                        res.end("Invalid JSON body");
                    }
            });
        } break;
        case "/portalPermission": {
            ok = false;
            let sserver = [];
            if (Config.allow_server_travel && global.launchedOnMainServer) {
                for (let i = 0; i < global.servers.length; i++) {
                    let server = global.servers[i];
                    if (server.gameManager) sserver.push(server);
                }
                res.writeHead(200);
                res.end(JSON.stringify(sserver.map((server) => ({
                    ip: server.ip,
                    players: server.players,
                    gameMode: server.gameMode,
                }))));
            } else {
                res.writeHead(404);
                res.end("Denied.");
            }
        } break;
        case "/isOnline": {
            readString = "true";
        } break;
        case selectedHeader: {
            // For all other routes, serve static files from the public directory
            ok = false;
            let fileToGet = path.join(publicRoot, req.url);

            // If the requested file doesn't exist or isn't a file, default to the INDEX_HTML file
            if (!fs.existsSync(fileToGet) || !fs.lstatSync(fileToGet).isFile()) {
                fileToGet = path.join(publicRoot, `${selectedHeader}/index.html`);
            }

            // Determine the file's MIME type based on its extension and serve the file stream
            const extension = fileToGet.split(".").pop();
            res.writeHead(200, { "Content-Type": mimeSet[extension] || "text/html" });
            fs.createReadStream(fileToGet).pipe(res);
        } break;

        default: {
            // For all other routes, serve static files from the public directory
            ok = false;
            let fileToGet = path.join(publicRoot, pathname);

            // If the requested file doesn't exist or isn't a file, default to the main_menu file
            if (!fs.existsSync(fileToGet) || !fs.lstatSync(fileToGet).isFile()) {
                fileToGet = path.join(publicRoot, Config.main_menu);
            }

            // Determine the file's MIME type based on its extension and serve the file stream
            const extension = fileToGet.split(".").pop();
            res.writeHead(200, { "Content-Type": mimeSet[extension] || "text/html" });
            fs.createReadStream(fileToGet).pipe(res);
        } break;
    }

    // If an API endpoint was handled, send the JSON response
    if (ok) {
        res.writeHead(200);
        res.end(readString);
    }
});

// Loads a game server
function loadGameServer(loadViaMain = false, host, port, gamemode, region, webProperties, properties, isFeatured) {
    // Determine the new server index and initialize an empty object in the global servers array
    if (!loadViaMain) {
        let index = global.servers.length;
        global.servers.push({});

        // Create a new worker thread to load the game server asynchronously
        let worker = new Worker("./server/serverLoader.js", {
            workerData: {
                host,
                port: port || (4000 + index + 1),
                gamemode,
                region,
                webProperties: { ...webProperties, wsPath: '/ws/' + webProperties.id },
                properties,
                isFeatured,
                index,
            },
            env: SHARE_ENV
        });
        global.serverWorkers = global.serverWorkers || [];
        global.serverWorkers[index] = worker;

        // Listen for messages from the worker to update the server's status
        worker.on("message", message => {
            const flag = message.shift();
            switch (flag) {
                case false:
                    // Initial load: store server details
                    global.servers[index] = message.shift();
                    break;
                case true:
                    // Update: change the server's player count
                    global.servers[index].players = message.shift();
                    break;
                case "doneLoading":
                    // Once loading is complete, trigger the server loaded callback
                    onServerLoaded();
                    break;
            }
        });
    } else {
        const webPropsWithPath = { ...webProperties, wsPath: '/ws/' + webProperties.id };
        global.servers.push({ loadedViaMainServer: true });
        setTimeout(() => {
            if (global.launchedOnMainServer) {
                console.warn("Only one server can be loaded via through the main server!\nProcess terminated.");
                process.exit(1);
            }
            global.launchedOnMainServer = true;
            new (require("./game.js").gameServer)(Config.host, Config.port, gamemode, region, webPropsWithPath, properties, isFeatured, false);
        }, 10)
    }
}

function updateLocalClients(username, newRoleStr) {
    for (let sv of global.servers) {
        if (sv.gameManager && sv.gameManager.socketManager) {
            updateSocketsForManager(sv.gameManager.socketManager, username, newRoleStr);
        }
    }
}

async function updateSocketsForManager(socketManager, username, newRoleStr) {
    const canonicalTarget = username.toLowerCase();
    for (const client of socketManager.clients) {
        if (client.account && client.account.username.toLowerCase() === canonicalTarget) {
            client.account.role = newRoleStr;
            client.permissions = await accounts.getPermissionsForSession(client.key);
            client.isAdmin = (client.permissions && client.permissions.administrator) || (Config.admin_tokens && Config.admin_tokens.includes(client.key));
            client.talk("m", 5_000, `Your account role has been updated to: ${newRoleStr}`);
            if (client.player && client.player.body) {
                client.player.body.sendMessage(`Your permissions have been updated. Re-spawn to take effect.`);
            }
        }
    }
}

// Server Loaded Callback
let loadedServers = 0;
global.onServerLoaded = () => {
    loadedServers++;
    // Once all servers are loaded, log the status and routing table
    if (loadedServers >= global.servers.length) {
        util.saveToLog("Servers up", "All servers booted up.", 0x37F554);
        if (Config.startup_logs) {
            util.log("Dumping endpoint -> gamemode routing table");
            for (const game of global.servers) {
                console.log("> " + `${Config.host}/#${game.id}`.padEnd(40, " ") + " -> " + game.gameMode);
            }
            console.log("\n");
        }
        let serverStartEndTime = performance.now();
        console.log("Server loaded in " + util.rounder(serverStartEndTime, 4) + " milliseconds.");
        console.log("[WEB SERVER]: Server listening on port", Config.port);
    }
};

// Start the HTTP Server & Load Game Servers
server.listen(Config.port, () => {
    Config.servers.forEach(server => {
        // Load all of the servers.
        loadGameServer(
            server.share_client_server,
            server.host,
            server.port,
            server.gamemode,
            server.region,
            { id: server.id, maxPlayers: server.player_cap },
            server.properties,
            server.featured
        );
    })
});

// Upgrade HTTP connections to WebSocket connections, routing to the correct game server by path
server.on("upgrade", (req, socket, head) => {
    const reqPath = req.url.split('?')[0];
    const target = global.servers.find(sv => sv.wsPath && sv.wsPath === reqPath);

    if (!target) { socket.destroy(); return; }

    // share_client_server mode: game runs in main thread
    if (target.gameManager) {
        wsServer.handleUpgrade(req, socket, head, (ws) => target.gameManager.socketManager.connect(ws, req));
        return;
    }

    // Worker mode: WebSocket-level proxy — handshake with client, then bridge to worker's internal WS
    wsServer.handleUpgrade(req, socket, head, (clientWs) => {
        const upstream = new (require('ws'))(`ws://127.0.0.1:${target.port}`);
        upstream.on('open', () => {
            clientWs.on('message', (data, isBinary) => {
                if (upstream.readyState === 1) upstream.send(data, { binary: isBinary });
            });
            upstream.on('message', (data, isBinary) => {
                if (clientWs.readyState === 1) clientWs.send(data, { binary: isBinary });
            });
            clientWs.on('close', () => { try { upstream.terminate(); } catch(e) {} });
            upstream.on('close', () => { try { clientWs.terminate(); } catch(e) {} });
            clientWs.on('error', () => { try { upstream.terminate(); } catch(e) {} });
            upstream.on('error', () => { try { clientWs.terminate(); } catch(e) {} });
        });
        upstream.on('error', () => { try { clientWs.terminate(); } catch(e) {} });
    });
});

// Set up a loop to periodically call Bun's garbage collector if running under Bun
if (typeof Bun !== 'undefined') {
    setInterval(() => Bun.gc(true), 1000);
}

// Log that the web server has been initialized if logging is enabled
if (Config.startup_logs) console.log("Web Server initialized.");
