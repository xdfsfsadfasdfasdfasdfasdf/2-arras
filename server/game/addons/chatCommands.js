const prefix = "$";

/** COMMANDS **/
let commands = [
  {
        command: ["help"],
        description: "Show this help menu.",
        level: 0,
        run: ({ socket, level }) => {
            let useOldMenu = false;
            let lines = [
            "Help menu:",
            ...commands.filter((c) => level >= c.level && !c.hidden).map((c) => {
                    let cmdData = [c.command];
                    let commandText = cmdData.map((e) => e.map((name) => name).join(` or ${prefix} `)).join(" ")
                    let description = c.description ?? false;
                    let text = `- ${prefix} ${commandText}`;
                    if (description) text += ` - ${description}`;
                    return text;
                }),
            ];
            if (useOldMenu) {
                for (let line of lines.reverse()) {
                    socket.talk("m", 15_000, line);
                }
            } else socket.talk("Em", 15_000, JSON.stringify(lines));
        },
    },
    {
        command: ["leaderboard", "b"],
        description: "Select the leaderboard to display.",
        level: 0,
        run: ({ socket, args }) => {
            let sendAvailableLeaderboardMessage = () => {
                let lines = [
                    "Available leaderboards:",
                    ...leaderboards.map(lb => `- ${lb}`)
                ];
                socket.talk("Em", 10_000, JSON.stringify(lines));
            };

            const leaderboards = [
                "default",
                "players",
                "bosses",
                "global",
            ];
            const choice = args[0];

            if (!choice) {
                sendAvailableLeaderboardMessage(socket);
                return;
            }

            if (leaderboards.includes(choice)) {
                socket.status.selectedLeaderboard = choice;
                socket.status.forceNewBroadcast = true;
                socket.talk("m", 4_000, "Leaderboard changed.");
            } else {
                socket.talk("m", 4_000, "Unknown leaderboard.");
            }
        }
    },
    {
        command: ["toggle", "t"],
        description: "Enable or disable chat",
        level: 0,
        run: ({ socket }) => {
            socket.status.disablechat = !socket.status.disablechat;
            socket.talk("m", 3_000, `In-game chat ${socket.status.disablechat ? "disabled" : "enabled"}.`);
        }
    },
    {
        command: ["spectate", "spec"],
        description: "Toggle spectator mode.",
        level: 0,
        run: ({ socket }) => {
            const body = socket.player?.body;
            if (!body) return socket.talk("m", 3_000, "You must be spawned to use this command.");
            if (!socket.status.isSpectating && !body.invuln) return socket.talk("m", 3_000, "You can only enter spectator mode right after spawning.");
            if (!socket.status.isSpectating) {
                socket.status.isSpectating = true;
                socket.status.spectatorSpeed = 8;
                body.define({ RESET_UPGRADES: true, BATCH_UPGRADES: false });
                body.define("spectator");
                body.godmode = true;
                body.alpha = 0;
                body.alphaRange = [0, 0];
                socket.talk("spectating", true);
                socket.talk("m", 5_000, "Entered spectator mode. Type $spectate again to exit. Use -/= to zoom, [/] to change speed.");
            } else {
                socket.status.isSpectating = false;
                delete socket.status.spectatorSpeed;
                body.define({ RESET_UPGRADES: true, BATCH_UPGRADES: false });
                body.define(Config.spawn_class);
                body.godmode = false;
                body.alpha = 1;
                body.alphaRange = [0, 1];
                socket.talk("spectating", false);
                socket.talk("m", 4_000, "Exited spectator mode.");
            }
        }
    },
    {
        command: ["arena"],
        description: "Manage the arena",
        level: 1,
        hidden: true,
        run: ({ socket, args, gameManager }) => {
            let sendAvailableArenaMessage = () => {
                let lines = [
                    "Help menu:",
                    `- ${prefix} arena size dynamic - Make the size of the arena dynamic, depending on the number of players`,
                    `- ${prefix} arena size <width> <height> - Set the size of the arena`,
                    `- ${prefix} arena team <team> - Set the number of teams, from 0 (FFA) to 4 (4TDM)`,
                    `- ${prefix} arena spawnpoint [x] [y] - Set a location where all players spawn on default`,
                    `- ${prefix} arena close - Close the arena`,
                ];
                if (!Config.sandbox) lines.splice(1, 1)
                socket.talk("Em", 10_000, JSON.stringify(lines));
            }
            if (!args[0]) sendAvailableArenaMessage(); else {
                switch (args[0]) {
                    case "size":
                        if (args[1] === "dynamic") {
                            if (!Config.sandbox) return socket.talk("m", 3_000, "This command is only available on sandbox.");
                            gameManager.room.settings.sandbox.do_not_change_arena_size = false;
                        } else {
                            if (!args[1] || !args[2]) return socket.talk("m", 3_000, "Invalid arguments.");
                            if (args[1] % 2 === 0 && args[2] % 2 === 0) {
                                if (Config.sandbox) gameManager.room.settings.sandbox.do_not_change_arena_size = true;
                                gameManager.updateBounds(args[1] * 30, args[2] * 30);
                            } else {
                                socket.talk("m", 3000, "Arena size must be even.");
                            }
                        }
                        break;
                    case "team":
                        if (!args[1]) return socket.talk("m", 3_000, "Invalid argument.");
                        if (args[1] === "0") {
                            Config.mode = "ffa";
                            Config.teams = null;
                            socket.rememberedTeam = undefined;
                        } else {
                            Config.mode = "tdm";
                            Config.teams = args[1];
                            socket.rememberedTeam = undefined;
                        }
                        break;
                    case "spawnpoint":
                        if (!args[1] || !args[2]) return socket.talk("m", 3_000, "Invalid arguments.");
                        socket.talk("m", 4_000, "Spawnpoint set.");
                        global.spawnPoint = {
                            x: parseInt(args[1] * 30),
                            y: parseInt(args[2] * 30),
                        };
                        break;
                    case "close":
                        util.warn(`${socket.player.body.name === "" ? `An unnamed player (ip: ${socket.ip})` : socket.player.body.name} has closed the arena.`);
                        if (args[1]) {
                            gameManager._forcedVariation = args.slice(1).join(" ");
                        }
                        gameManager.closeArena();
                        break;
                    case "stop":
                        util.warn(`${socket.player.body.name === "" ? `An unnamed player (ip: ${socket.ip})` : socket.player.body.name} has stopped the arena (instant).`);
                        if (args[1]) {
                            gameManager._forcedVariation = args.slice(1).join(" ");
                        }
                        gameManager.stopArena();
                        break;
                    default:
                        socket.talk("m", 4_000, "Unknown subcommand.");
                }
            }
        }
    },
    {
        command: ["broadcast"],
        description: "Broadcast a message to all players.",
        level: 2,
        hidden: true,
        run: ({ args, socket, gameManager }) => {
            if (!args[0]) {
                socket.talk("m", 5_000, "No message specified.");
            }
            else {
                gameManager.socketManager.broadcast("[Broadcast] " + args.join(" "));
                socket.talk("m", 5_000, "Broadcast sent.");
            }
        }
    },
    {
        command: ["define"],
        description: "Change your tank.",
        level: 2,
        hidden: true,
        run: ({ args, socket }) => {
            if (!args[0]) {
                socket.talk("m", 5_000, "No entity specified.");
            }
            else {
                socket.player.body.define({RESET_UPGRADES: true, BATCH_UPGRADES: false});
                socket.player.body.define(args[0]);
                socket.talk("m", 5_000, `Changed to ${socket.player.body.label}`);
            }
        },
    },
    {
        command: ["level"],
        description: "Change your level.",
        level: 2,
        hidden: true,
        run: ({ args, socket }) => {
            if (!args[0]) {
                socket.talk("m", 5_000, "No level specified.");
            }
            else {
                socket.player.body.define({ LEVEL: args[0] });
                socket.talk("m", 5_000, `Changed to level ${socket.player.body.level}`);
            }
        },
    },
    {
        command: ["team"],
        description: "Change your team.", // player teams are -1 through -8, dreads are -10, room is -100 and enemies is -101
        level: 2,
        hidden: true,
        run: ({ args, socket }) => {
            if (!args[0]) {
                socket.talk("m", 5_000, "No team specified.");
            }
            else {
                socket.player.body.define({ COLOR: getTeamColor(args[0]), TEAM: args[0] });
                socket.talk("m", 5_000, `Changed to team ${socket.player.body.team}`);
            }
        },
    },
    {
        command: ["bot"],
        description: "Manage server bots. Usage: $bot [fill|<n>|clear|status]",
        level: 2,
        run: ({ socket, args, gameManager }) => {
            const handler = gameManager.gameHandler;
            const maxPlayers = gameManager.webProperties.maxPlayers || 20;
            const sub = args[0];
            const asNum = parseInt(sub);

            // Pick a team for the spawned bot (matches existing auto-bot logic).
            // In siege (tdm + 1 team), this returns TEAM_BLUE so bots fight bosses.
            const pickTeam = () =>
                (Config.mode === "tdm" || Config.mode === "tag")
                    ? getWeakestTeam()
                    : undefined;

            const spawnN = (n) => {
                for (let i = 0; i < n; i++) {
                    const team = pickTeam();
                    const loc = getSpawnableArea(team, gameManager);
                    handler.spawnBots(loc, team);
                }
            };

            if (sub === "clear") {
                const was = handler.bots.length;
                for (const b of [...handler.bots]) b.kill();
                Config.bot_cap = 0;
                socket.talk("m", 5_000, `Removed ${was} bot${was !== 1 ? "s" : ""}. Bot cap reset to 0.`);

            } else if (sub === "status") {
                socket.talk("Em", 6_000, JSON.stringify([
                    `Active bots: ${handler.bots.length}  |  Respawn cap: ${Config.bot_cap}`,
                    `Player cap: ${maxPlayers}`,
                    `Clients connected: ${gameManager.socketManager.clients.length}`,
                ]));

            } else {
                // $bot, $bot fill, or $bot <n>
                const isExplicitFill = !sub || sub === "fill";
                const target = isExplicitFill
                    ? maxPlayers
                    : (!isNaN(asNum) && asNum > 0 ? asNum : null);

                if (target === null) {
                    socket.talk("Em", 8_000, JSON.stringify([
                        "Bot commands:",
                        `- ${prefix}bot [fill] — Fill the server with bots up to player cap`,
                        `- ${prefix}bot <n>   — Spawn exactly n bots`,
                        `- ${prefix}bot clear  — Kill all bots and reset the cap to 0`,
                        `- ${prefix}bot status — Show active bot count, cap, and player info`,
                    ]));
                    return;
                }

                const toSpawn = Math.max(0, target - handler.bots.length);
                // Raise the respawn cap so bots re-fill the server after dying.
                Config.bot_cap = Math.max(Config.bot_cap, handler.bots.length + toSpawn);
                spawnN(toSpawn);

                const total = handler.bots.length;
                const msg = toSpawn > 0
                    ? `Spawned ${toSpawn} bot${toSpawn !== 1 ? "s" : ""}. Total: ${total}, respawn cap: ${Config.bot_cap}.`
                    : `Already at target (${total} bots active).`;
                socket.talk("m", 5_000, msg);
            }
        },
    },
    {
        command: ["developer", "dev"],
        description: "Developer commands, go troll some players or just take a look for yourself.",
        level: 3,
        run: ({ socket, args, gameManager }) => {
            let sendAvailableDevCommandsMessage = () => {
                let lines = [
                    "Help menu:",
                    "- $ (developer / dev) reloaddefs - reloads definitions.",
                ];
                socket.talk("Em", 10_000, JSON.stringify(lines));
            }
            let command = args[0];
            if (command === "reloaddefs" || command === "redefs") {
                /* IMPORT FROM (defsReloadCommand.js) */
                if (!global.reloadDefinitionsInfo) {
                    global.reloadDefinitionsInfo = {
                        lastReloadTime: 1,
                    };
                }
                // Rate limiter for anti-lag
                let time = performance.now();
                let sinceLastReload = time - global.reloadDefinitionsInfo.lastReloadTime;
                if (sinceLastReload < 5000) {
                    socket.talk('m', Config.popup_message_duration, `Wait ${Math.floor((5000 - sinceLastReload) / 100) / 10} seconds and try again.`);
                    return;
                }
                // Set the timeout timer ---
                lastReloadTime = time;

                // Remove function so all for(let x in arr) loops work
                delete Array.prototype.remove;

                // Before we purge the class, we are going to stop the game interval first
                gameManager.gameHandler.stop();

                // Now we can purge Class
                Class = {};
                classMap.clear();

                // Log it.
                util.warn(`[IMPORTANT] Definitions are going to be reloaded on server ${gameManager.gamemode} (${gameManager.webProperties.id})!`);

                // Purge all cache entries of every file in definitions
                for (let file in require.cache) {
                    if (!file.includes('definitions') || file.includes(__filename)) continue;
                    delete require.cache[file];
                }

                // Load all definitions
                gameManager.reloadDefinitions();

                // Put the removal function back
                Array.prototype.remove = function (index) {
                    if (index === this.length - 1) return this.pop();
                    let r = this[index];
                    this[index] = this.pop();
                    return r;
                };

                // Redefine all tanks and bosses
                for (let entity of entities.values()) {
                    // If it's a valid type, and it's not a turret
                    if (!['tank', 'miniboss', 'food'].includes(entity.type)) continue;
                    if (entity.bond) continue;

                    let entityDefs = JSON.parse(JSON.stringify(entity.defs));
                    // Save color to put it back later
                    let entityColor = entity.color.compiled;

                    // Redefine all properties and update values to match
                    entity.upgrades = [];
                    entity.define(entityDefs);
                    for (let instance of entities.values()) {
                        if (
                            instance.settings.clearOnMasterUpgrade &&
                            instance.master.id === entity.id
                        ) {
                            instance.kill();
                        }
                    }
                    entity.skill.update();
                    entity.syncTurrets();
                    entity.refreshBodyAttributes();
                    entity.color.interpret(entityColor);
                }

                // Tell the command sender
                socket.talk('m', Config.popup_message_duration, "Successfully reloaded all definitions.");


                // Erase mockups so it can rebuild.
                mockupData = [];
                mockupMap = {};
                
                // Load all mockups if enabled in configuration
                if (Config.load_all_mockups) global.loadAllMockups(false);

                setTimeout(() => { // Let it sit for a second.
                    // Erase cached mockups for each connected clients.
                    gameManager.clients.forEach(socket => {
                        socket.status.mockupData = socket.initMockupList();
                        socket.status.selectedLeaderboard2 = socket.status.selectedLeaderboard;
                        socket.status.selectedLeaderboard = "stop";
                        socket.talk("RE"); // Also reset the global.entities in the client so it can refresh.
                        if (Config.load_all_mockups) for (let i = 0; i < mockupData.length; i++) {
                            socket.talk("M", mockupData[i].index, JSON.stringify(mockupData[i]));
                        }
                        socket.status.selectedLeaderboard = socket.status.selectedLeaderboard2;
                        delete socket.status.selectedLeaderboard2;
                        socket.talk("CC"); // Clear cache
                    });
                    // Log it again.
                    util.warn(`[IMPORTANT] Definitions are successfully reloaded on server ${gameManager.gamemode} (${gameManager.webProperties.id})!`);
                    gameManager.gameHandler.run();
                }, 1000)
            } else sendAvailableDevCommandsMessage();
        },
    },
    {
        command: ["wave"],
        description: "Set which wave comes next in siege. Usage: $wave <n>",
        level: 2,
        hidden: true,
        run: ({ socket, args, gameManager }) => {
            const siege = gameManager.gamemodeManager?.gameSiege;
            if (!siege || !Config.siege) return socket.talk("m", 4_000, "Not a siege server.");
            const n = parseInt(args[0]);
            if (isNaN(n) || n < 1) return socket.talk("m", 4_000, "Usage: $wave <number>");
            // waveId is post-incremented before spawnWave, so set to n-2 so next ++ → n-1 (0-indexed) → displays as wave n
            siege.waveId = n - 2;
            socket.talk("m", 4_000, `Next wave will be Wave ${n}.`);
        },
    },
    {
        command: ["spawnegg"],
        description: "Spawn a specific rogue egg. Usage: $spawnegg <P|A|J|G|N>",
        level: 2,
        hidden: true,
        run: ({ socket, args, gameManager }) => {
            const siege = gameManager.gamemodeManager?.gameSiege;
            if (!siege || !Config.siege) return socket.talk("m", 4_000, "Not a siege server.");
            const letter = (args[0] || "").toUpperCase();
            if (!letter) return socket.talk("m", 4_000, "Usage: $spawnegg <P|A|J|G|N>  (Palisade/Armada/Julius/Genghis/Napoleon)");
            if (!siege.spawnRogueEggByType(letter)) {
                socket.talk("m", 4_000, "Unknown type. Use P, A, J, G, or N.");
            } else {
                socket.talk("m", 4_000, `Spawned a rogue egg (${letter}).`);
            }
        },
    },
    {
        command: ["god"],
        description: "Toggle god mode: invulnerable, phase through walls, hostile to players.",
        level: 2,
        run: ({ socket }) => {
            const body = socket.player?.body;
            if (!body) return socket.talk("m", 4_000, "You must be spawned to use this command.");

            if (body._godModeOn) {
                body.godmode = false;
                body.isArenaCloser = false;
                body.ac = false;
                body._godModeOn = false;
                socket.talk("m", 4_000, "God mode disabled.");
            } else {
                body.godmode = true;
                body.isArenaCloser = true;
                body.ac = true;
                body._godModeOn = true;
                socket.talk("m", 4_000, "God mode enabled. Use T to switch team if acting as a boss.");
            }
        },
    },
]

/** COMMANDS RUN FUNCTION **/
function runCommand(socket, message, gameManager) {
    if (!message.startsWith(prefix) || !socket?.player?.body) return;

    let args = message.slice(prefix.length).split(" ");
    let commandName = args.shift();
    let command = commands.find((command) => command.command.includes(commandName));
    if (command) {
        let permissionsLevel = Math.max(socket.isAdmin ? 2 : 0, socket.permissions?.level ?? 0);
        let level = command.level;

        if (permissionsLevel >= level) {
            try {
                command.run({ socket, message, args, level: permissionsLevel, gameManager: gameManager });
            } catch (e) {
                console.error("Error while running ", commandName);
                console.error(e);
                socket.talk("m", 5_000, "An error occurred while running this command.");
            }
        } else socket.talk("m", 5_000, "You do not have access to this command.");
    } else socket.talk("m", 5_000, "Unknown command.");

    return true;
}
global.addChatCommand = function (command) {
    if (!command.command || !command.run) {
        throw new Error("Invalid command format. A command must have at least a 'command' and a 'run' property.");
    }
    if (!Array.isArray(command.command)) {
        throw new Error("Invalid command format. The 'command' property must be an array of strings.");
    }
    if (commands.find(c => c.command.some(cmd => command.command.includes(cmd)))) {
        throw new Error("A command with this name already exists.");
    }
    commands.push(command);
}


/** CHAT MESSAGE EVENT **/
module.exports = ({ Events }) => {
    Events.on("chatMessage", ({ socket, message, preventDefault, gameManager }) => {
        if (message.startsWith(prefix)) {
            preventDefault();
            runCommand(socket, message, gameManager);
        }
    });
};