
let oldGroups = {
    elites: [ "eliteDestroyer", "eliteGunner", "eliteSprayer", "eliteBattleship", "eliteSpawner", "sprayerLegion" ],
    deltas: [ "deltaDestroyer", "deltaGunner", "deltaSprayer", "deltaBattleship" ],
    mysticals: [ "summoner", "eliteSkimmer", "nestKeeper", "roguePalisade" ],
    celestials: [ "paladin", "freyja", "zaphkiel", "nyx", "theia" ],
    eternals: [ "legionaryCrasher", "kronos", "odin" ],
};

class Siege {
    constructor() {
        this.room = global.gameManager.room;
        this.waveCodes = [
            ran.chooseN(oldGroups.elites, 1),
            ran.chooseN(oldGroups.elites, 2),
            ran.chooseN(oldGroups.elites, 3),
            ran.chooseN(oldGroups.elites, 4),
            ran.chooseN(oldGroups.elites, 3).concat(ran.chooseN(oldGroups.mysticals, 1)),
            ran.chooseN(oldGroups.elites, 2).concat(ran.chooseN(oldGroups.mysticals, 2)),
            ran.chooseN(oldGroups.elites, 1).concat(ran.chooseN(oldGroups.mysticals, 3)),
            ran.chooseN(oldGroups.mysticals, 4),
            ran.chooseN(oldGroups.elites, 1).concat(ran.chooseN(oldGroups.mysticals, 4)),
            ran.chooseN(oldGroups.elites, 2).concat(ran.chooseN(oldGroups.mysticals, 4)),
            ran.chooseN(oldGroups.elites, 3).concat(ran.chooseN(oldGroups.mysticals, 4)),
            ran.chooseN(oldGroups.elites, 4).concat(ran.chooseN(oldGroups.mysticals, 4)),
            [ oldGroups.celestials[0] ],
            [ oldGroups.celestials[1] ],
            [ oldGroups.celestials[2] ],
            [ oldGroups.celestials[3] ],
            [ oldGroups.celestials[4] ],
            ran.chooseN(oldGroups.elites, 1).concat(ran.chooseN(oldGroups.mysticals, 1)).concat(ran.chooseN(oldGroups.celestials, 1)),
            ran.chooseN(oldGroups.elites, 3).concat(ran.chooseN(oldGroups.mysticals, 1)).concat(ran.chooseN(oldGroups.celestials, 1)),
            ran.chooseN(oldGroups.elites, 3).concat(ran.chooseN(oldGroups.mysticals, 3)).concat(ran.chooseN(oldGroups.celestials, 1)),
            ran.chooseN(oldGroups.elites, 4).concat(ran.chooseN(oldGroups.mysticals, 4)).concat(ran.chooseN(oldGroups.celestials, 1)),
            ran.chooseN(oldGroups.celestials, 2),
            ran.chooseN(oldGroups.elites, 1).concat(ran.chooseN(oldGroups.mysticals, 2)).concat(ran.chooseN(oldGroups.celestials, 2)),
            ran.chooseN(oldGroups.elites, 3).concat(ran.chooseN(oldGroups.mysticals, 3)).concat(ran.chooseN(oldGroups.celestials, 2)),
            ran.chooseN(oldGroups.elites, 4).concat(ran.chooseN(oldGroups.mysticals, 4)).concat(ran.chooseN(oldGroups.celestials, 2)),
            ran.chooseN(oldGroups.celestials, 3),
            ran.chooseN(oldGroups.elites, 3).concat(ran.chooseN(oldGroups.mysticals, 3)).concat(ran.chooseN(oldGroups.celestials, 3)),
            ran.chooseN(oldGroups.elites, 4).concat(ran.chooseN(oldGroups.mysticals, 4)).concat(ran.chooseN(oldGroups.celestials, 3)),
            ran.chooseN(oldGroups.celestials, 4),
            ran.chooseN(oldGroups.elites, 2).concat(ran.chooseN(oldGroups.mysticals, 2)).concat(ran.chooseN(oldGroups.celestials, 4)),
            ran.chooseN(oldGroups.elites, 4).concat(ran.chooseN(oldGroups.mysticals, 4)).concat(ran.chooseN(oldGroups.celestials, 4)),
            ran.chooseN(oldGroups.celestials, 5),
            ran.chooseN(oldGroups.elites, 4).concat(ran.chooseN(oldGroups.mysticals, 4)).concat(ran.chooseN(oldGroups.celestials, 5)),
            ran.chooseN(oldGroups.eternals, 1),
        ];
        this.friendlyBossChoices = ["roguePalisade", "rogueArmada", "julius", "genghis", "napoleon"];
        this.bigFodderChoices = ["sentryGun", "sentrySwarm", "sentryTrap"];
        this.smallFodderChoices = ["crasher"];
        this.sentinelChoices = ["sentinelMinigun", "sentinelLauncher", "sentinelCrossbow"];
        this.defineProperties();
    }
    defineProperties() {
        // Clean up any leftover rogue eggs from a previous cycle
        if (this.rogueEggs) {
            for (const egg of this.rogueEggs) {
                if (!egg.isDead()) egg.kill();
            }
        }
        this.length = Config.use_limited_waves ? this.waveCodes.length : Config.wave_cap;
        this.waves = this.generateWaves();
        this.waveId = -1;
        this.gameActive = false;
        this.timer = 0;
        this.remainingEnemies = 0;
        this.sanctuaryTier = 1;
        this.sanctuaries = [];
        this.leftSanctuaries = 0;
        this.rogueEggs = [];
    }
    generateWaves() {
        this.waveLabels = [];
        let waves = [];
        for (let i = 0; i < this.length; i++) {
            if (Config.use_limited_waves) {
                waves.push(this.waveCodes[i]);
                this.waveLabels.push(null);
            } else {
                const { bosses, label } = this._generateWave(i);
                waves.push(bosses);
                this.waveLabels.push(label);
            }
        }
        return waves;
    }

    _generateWave(i) {
        const waveNum = i + 1;
        const specialChance = waveNum >= 50 ? 0.10 : waveNum >= 30 ? 0.08 : 0.05;
        if (Math.random() < specialChance) {
            const result = this._tryGenerateSpecialWave(waveNum);
            if (result) return result;
        }
        return { bosses: this._generateNormalWave(waveNum), label: null };
    }

    _generateNormalWave(waveNum) {
        const pool = this._getBossPool(waveNum);
        const count = this._getGroupSize(waveNum);
        const totalWeight = pool.reduce((s, e) => s + e.w, 0);
        const wave = [];
        for (let j = 0; j < count; j++) {
            let r = Math.random() * totalWeight;
            for (const { boss, w } of pool) {
                r -= w;
                if (r <= 0) { wave.push(boss); break; }
            }
        }
        return wave;
    }

    _getBossPool(waveNum) {
        const pool = [];
        const add = (bosses, w) => { for (const boss of bosses) pool.push({ boss, w }); };

        // Elites — always available
        add(["eliteDestroyer","eliteGunner","eliteSprayer","eliteBattleship","eliteSpawner","eliteTrapGuard","eliteSpinner","eliteSkimmer"], 10);
        // Mysticals — wave 5+
        if (waveNum >= 5)  add(["sorcerer","summoner","enchantress","exorcistor","shaman","witch"], 8);
        // Nesters — wave 10+
        if (waveNum >= 10) add(["nestKeeper","nestWarden","nestGuardian"], 7);
        // Terrestrials — wave 20+, weight ramps up over time
        if (waveNum >= 20) add(["ares","gersemi","ezekiel","eris","selene"],
            Math.min(6, Math.floor((waveNum - 20) / 5) + 2));
        // Celestials — wave 20+, ramp slower
        if (waveNum >= 20) add(["paladin","freyja","zaphkiel","nyx","theia","atlas","hera","horus","anubis","isis",
                                 "tethys","ullr","dellingr","osiris","alcis","khonsu","hyperion","nephthys",
                                 "tyr","vor","aether","iapetus","baldr","eros","hjordis","sif","freyr","styx","apollo","ptah"],
            Math.min(4, Math.floor((waveNum - 20) / 10) + 1));
        // Eternals — wave 30+
        if (waveNum >= 30) add(["legionaryCrasherFix","kronos","odin","amun"],
            Math.min(3, Math.floor((waveNum - 30) / 10) + 1));

        return pool;
    }

    _getGroupSize(waveNum) {
        if (waveNum <= 4)  return 2 + Math.floor(Math.random() * 2);            // 2–3
        if (waveNum <= 9)  return 3 + Math.floor(Math.random() * 3);            // 3–5
        if (waveNum <= 14) return 5 + Math.floor(Math.random() * 3);            // 5–7
        if (waveNum <= 19) return 6 + Math.floor(Math.random() * 3);            // 6–8
        if (waveNum <= 24) return 7 + Math.floor(Math.random() * 4);            // 7–10
        if (waveNum <= 29) return 8 + Math.floor(Math.random() * 5);            // 8–12
        if (waveNum <= 49) return 10 + Math.floor(Math.random() * 6);           // 10–15
        return 15 + Math.floor(Math.random() * Math.ceil((waveNum - 49) / 3)); // 15+ scaling
    }

    _tryGenerateSpecialWave(waveNum) {
        const available = ['crashers', 'elites', 'sentries'];
        if (waveNum >= 5)  available.push('mysticals');
        if (waveNum >= 10) available.push('nesters');
        if (waveNum >= 20) available.push('celestials');

        const type = ran.choose(available);
        const scale = Math.max(1, Math.floor(waveNum / 10));
        let bosses = [], label = '';

        if (type === 'crashers') {
            const count = Math.min(50, 15 + scale * 5);
            for (let i = 0; i < count; i++) bosses.push('crasher');
            label = 'Crashers Only';
        } else if (type === 'elites') {
            const pool = ["eliteDestroyer","eliteGunner","eliteSprayer","eliteBattleship","eliteSpawner","eliteTrapGuard","eliteSpinner","eliteSkimmer"];
            const count = Math.min(20, 6 + scale * 2);
            for (let i = 0; i < count; i++) bosses.push(ran.choose(pool));
            label = 'Elites Only';
        } else if (type === 'sentries') {
            const pool = ["sentryGun","sentrySwarm","sentryTrap","sentinelMinigun","sentinelLauncher","sentinelCrossbow"];
            const count = Math.min(30, 10 + scale * 5);
            for (let i = 0; i < count; i++) bosses.push(ran.choose(pool));
            label = 'Sentries & Sentinels';
        } else if (type === 'mysticals') {
            const pool = ["sorcerer","summoner","enchantress","exorcistor","shaman","witch"];
            const count = Math.min(8, 3 + scale);
            for (let i = 0; i < count; i++) bosses.push(ran.choose(pool));
            label = 'Mysticals Only';
        } else if (type === 'nesters') {
            const pool = ["nestKeeper","nestWarden","nestGuardian"];
            const count = Math.min(15, 4 + scale * 2);
            for (let i = 0; i < count; i++) bosses.push(ran.choose(pool));
            label = 'Nesters Only';
        } else if (type === 'celestials') {
            // No duplicate Terrestrials or Celestials — all five of each, shuffled
            bosses.push(...ran.chooseN(["ares","gersemi","ezekiel","eris","selene"], 5));
            bosses.push(...ran.chooseN(["paladin","freyja","zaphkiel","nyx","theia"], 5));
            label = 'Terrestrials & Celestials';
        }

        return bosses.length ? { bosses, label } : null;
    }

    spawnSanctuary(tile, team, type = false, addToSanctuaryList = true) {
        type = type ? type : "sanctuaryTier3";
        let o = new Entity(tile.loc);
        o.team = team;
        this.defineSanctuary(o, type, o.team === TEAM_ENEMIES ? "DESTROYED" : false);
        if (addToSanctuaryList) this.sanctuaries.push(o);
        o.on('dead', () => {
            if (o.team === TEAM_ENEMIES) {
                // Allow the player to spawn so we add it to the spawnable locations.
                this.room.spawnable[TEAM_BLUE].push(tile);
                this.spawnSanctuary(tile, TEAM_BLUE, `sanctuaryTier${this.sanctuaryTier}`);
                tile.color = "blue";
                if (this.leftSanctuaries == 0) global.gameManager.socketManager.broadcast('You can now respawn.');
                this.leftSanctuaries++;
                global.gameManager.socketManager.broadcast('A sanctuary has been restored!');
            } else {
                // Don't allow players to spawn at the destroyed sanctuary so we remove it from spawnable location.
                if (this.gameActive) util.remove(this.room.spawnable[TEAM_BLUE], this.room.spawnable[TEAM_BLUE].indexOf(tile));
                util.remove(this.sanctuaries, this.sanctuaries.indexOf(o));
                let newTeam = TEAM_ENEMIES;
                this.spawnSanctuary(tile, newTeam, "dominator", false);
                tile.color = "yellow";
                this.leftSanctuaries--;
                global.gameManager.socketManager.broadcast('A sanctuary has been destroyed!');
                if (this.leftSanctuaries == 0) {
                    global.cannotRespawn = true;
                    let timeRemaining = 61; // 1 minute
                    global.gameManager.socketManager.broadcast('All of the sanctuaries are destroyed. You cannot respawn.');
                    let loop = setInterval(() => {
                        if (this.leftSanctuaries !== 0) global.cannotRespawn = false, clearInterval(loop);
                        timeRemaining--;
                        if (timeRemaining == 0) {
                            this.playerLose();
                            clearInterval(loop);
                        } else if (
                            timeRemaining % 10 == 0 ||
                            timeRemaining == 5 ||
                            timeRemaining == 3 ||
                            timeRemaining == 2 ||
                            timeRemaining == 1
                        ) {
                            global.gameManager.socketManager.broadcast(
                                `Your team will lose in ${timeRemaining} Secon${timeRemaining == 1 ? "d" : "ds"}.`,
                            );
                        }
                    }, 1000) // 1 Second.
                }
            }
            global.gameManager.socketManager.broadcastRoom();
        });
    }

    defineSanctuary(entity, type, customName = false) {
        entity.define(type);
        entity.color.base = customName && customName === "DESTROYED" ? "grey" : getTeamColor(entity.team);
        entity.skill.score = 111069;
        entity.name = `${customName ? customName : getTeamName(entity.team)} Sanctuary`;
        entity.SIZE = this.room.tileWidth / Config.sanctuary_size ?? 13.5;
        entity.isDominator = true;
        entity.displayName = true;
        entity.nameColor = "#ffffff";
        entity.define({ DANGER: 11 });
    }

    playerWin() {
        if (this.gameActive) {
            this.gameActive = false;
            global.gameManager.socketManager.broadcast('Your team has won the game!');
            setTimeout(() => {global.gameManager.closeArena()}, 1500);
        }
    }
    bossWin() {
        global.gameManager.socketManager.broadcast('Team boss has won the game!');
        setTimeout(() => {global.gameManager.closeArena()}, 1500);
    }
    playerLose() {
        if (this.gameActive) {
            this.gameActive = false;
            global.gameManager.socketManager.broadcast("Your team has lost the game.");
            setTimeout(() => {this.bossWin()}, 3000);
        }
    }

    spawnEnemyWrapper(loc, type) {
        let enemy = new Entity(loc);
        enemy.define(type);
        enemy.team = TEAM_ENEMIES;
        enemy.FOV = 30;
        enemy.refreshSkills();
        enemy.refreshBodyAttributes();
        enemy.isBoss = true;
        if (Config.siege) enemy.controllers.push(new ioTypes.siegeAI(enemy, {}, global.gameManager));
        this.remainingEnemies++;
        enemy.on('dead', () => {
            if (!this.gameActive) return;
            if (!--this.remainingEnemies) {
                this.hatchAllEggs(); // surviving eggs hatch when the wave is cleared
                global.gameManager.socketManager.broadcast(`Wave ${this.waveId + 1} defeated!`);
                global.gameManager.socketManager.broadcast(`The next wave will start shortly.`);
            } else {
                const n = this.remainingEnemies;
                global.gameManager.socketManager.broadcast(`Wave ${this.waveId + 1} — ${n} boss${n !== 1 ? 'es' : ''} remaining.`);
            }
        });
        return enemy;
    }

    spawnWave(waveId) {
        const waveNum = waveId + 1;
        const waveLabel = this.waveLabels?.[waveId];
        const broadcastMsg = waveLabel ? `Wave ${waveNum} — ${waveLabel}!` : `Wave ${waveNum} has started!`;
        global.gameManager.socketManager.broadcast(broadcastMsg);
        util.log(broadcastMsg);

        for (let boss of this.waves[waveId]) {
            let spot = ran.choose(global.gameManager.room.spawnable["bossSpawnTile"]).randomInside();
            let enemy = this.spawnEnemyWrapper(spot, boss);
            enemy.define({ DANGER: 25 + enemy.SIZE / 5 });
        }

        if (!Config.use_limited_waves) {
            for (let i = 0; i < this.waveId / 5; i++) {
                this.spawnEnemyWrapper(ran.choose(global.gameManager.room.spawnable["bossSpawnTile"]).randomInside(), ran.choose(this.sentinelChoices));
            }
            for (let i = 0; i < this.waveId / 2; i++) {
                this.spawnEnemyWrapper(ran.choose(global.gameManager.room.spawnable["bossSpawnTile"]).randomInside(), ran.choose(this.smallFodderChoices));
            }
        }

        // Tier 2 starts at wave 5, +1 every 5 waves, caps at 6
        let newSancTier = Math.min(Math.floor(waveNum / 5) + 1, 6);
        if (newSancTier != this.sanctuaryTier) {
            for (let sanc of this.sanctuaries) {
                this.defineSanctuary(sanc, `sanctuaryTier${newSancTier}`);
            }
            global.gameManager.socketManager.broadcast(`The sanctuaries have been upgraded to Tier ${newSancTier}!`);
            this.sanctuaryTier = newSancTier;
        }

        // Rogue eggs — higher chance during waves 5–9 per wiki ("likely to spawn")
        if (Config.rogue_eggs) {
            const eggChance = (waveNum >= 5 && waveNum <= 9) ? 0.20 : 0.07;
            if (Math.random() < eggChance) this.spawnRogueEgg(false);
            if (Math.random() < 0.01) this.spawnRogueEgg(true);
        }
    }

    _spawnEgg(shape, hatchClass) {
        // Eggs appear near alive player-team sanctuaries so players can see and protect them
        const aliveSancs = this.sanctuaries.filter(s => !s.isDead() && s.team !== TEAM_ENEMIES);
        let spot;
        if (aliveSancs.length) {
            const sanc = ran.choose(aliveSancs);
            const angle = Math.random() * Math.PI * 2;
            const dist = 60 + Math.random() * 60; // 60–120 units from sanctuary centre
            spot = { x: sanc.x + Math.cos(angle) * dist, y: sanc.y + Math.sin(angle) * dist };
        } else {
            // No sanctuaries alive — spawn anywhere in the playable room area
            const room = global.gameManager.room;
            spot = {
                x: (Math.random() - 0.5) * room.width * 0.85,
                y: (Math.random() - 0.5) * room.height * 0.85,
            };
        }

        let egg = new Entity(spot);
        egg.define('rogueEgg');
        egg.define({ SHAPE: shape });
        egg.team = TEAM_BLUE; // rogues are allies; enemies will attack the egg
        egg.alwaysShowOnMinimap = true;
        egg.minimapColor = 17; // darkGrey
        egg._hatchClass = hatchClass;
        egg.controllers.push(new ioTypes.spin(egg, { speed: 0.02 }));

        let hatchTimer = setTimeout(() => this.hatchRogueEgg(egg), 45000);
        egg.on('dead', () => {
            clearTimeout(hatchTimer);
            util.remove(this.rogueEggs, this.rogueEggs.indexOf(egg));
        });

        this.rogueEggs.push(egg);
        global.gameManager.socketManager.broadcast(`A Rogue Egg has appeared!`);
        return true;
    }

    spawnRogueEgg(forceNonagon = false) {
        let shape, hatchClass;
        if (forceNonagon) {
            shape = 9;
            hatchClass = ran.choose(['julius', 'genghis', 'napoleon']);
        } else {
            shape = Math.random() < 0.5 ? 6 : 7;
            hatchClass = shape === 6 ? 'roguePalisade' : 'rogueArmada';
        }
        this._spawnEgg(shape, hatchClass);
    }

    spawnRogueEggByType(letter) {
        const map = {
            'P': { shape: 6, hatchClass: 'roguePalisade' },
            'A': { shape: 7, hatchClass: 'rogueArmada' },
            'J': { shape: 9, hatchClass: 'julius' },
            'G': { shape: 9, hatchClass: 'genghis' },
            'N': { shape: 9, hatchClass: 'napoleon' },
        };
        const type = map[letter];
        if (!type) return false;
        return this._spawnEgg(type.shape, type.hatchClass);
    }

    hatchRogueEgg(egg) {
        if (egg.isDead()) return;
        const pos = { x: egg.x, y: egg.y };
        egg.kill();

        let rogue = new Entity(pos);
        rogue.define(egg._hatchClass);
        rogue.team = TEAM_BLUE; // ally — fights alongside players
        rogue.settings.no_collisions = false; // ensure rogues push each other apart
        rogue.refreshSkills();
        rogue.refreshBodyAttributes();
        // Follow the highest-score ally; class combat controllers handle targeting enemies
        rogue.controllers.push(new ioTypes.huntHighestScore(rogue, {}, global.gameManager));
        global.gameManager.socketManager.broadcast(`A ${rogue.label || egg._hatchClass} has hatched!`);
    }

    hatchAllEggs() {
        for (const egg of [...this.rogueEggs]) {
            this.hatchRogueEgg(egg);
        }
        this.rogueEggs = [];
    }

    // runs once when the server starts
    start(mazeType) {
        this.gameActive = true;
        for (let tile of this.room.spawnable[TEAM_BLUE]) {
            tile.color = tile.bluePrint.COLOR;
            this.leftSanctuaries += 1;
            this.spawnSanctuary(tile, TEAM_BLUE, "sanctuaryTier1");
        }
        // Spawn maze if we want to.
        if (mazeType) {
            let mazeGenerator = new global.mazeGenerator.MazeGenerator(mazeType);
            let { squares, width, height } = mazeGenerator.placeMinimal();
            squares.forEach(element => {
                let wall = new Entity({
                    x: global.gameManager.room.width / width * element.x - global.gameManager.room.width / 2 + global.gameManager.room.width / width / 2 * element.size, 
                    y: global.gameManager.room.height / height * element.y - global.gameManager.room.height / 2 + global.gameManager.room.height / height / 2 * element.size
                })
                wall.define("wall");
                wall.SIZE = global.gameManager.room.width / width / 2 * element.size / lazyRealSizes[4] * Math.SQRT2 - 2;
                wall.life();
                wall.protect();
                makeHitbox(wall);
                walls.push(wall);
                if (Config.spooky_theme) {
                    let eyeSize = 12 * (Math.random() + 0.45);
                    let spookyEye = new Entity({ x: wall.x + (wall.size - eyeSize * 2) * Math.random() - wall.size / 2, y: wall.y + (wall.size - eyeSize * 2) * Math.random() - wall.size / 2 })
                    spookyEye.define("hwEye");
                    spookyEye.define({FACING_TYPE: ["manual", {angle: ran.randomAngle()}]})
                    spookyEye.SIZE = eyeSize;
                    spookyEye.minimapColor = 18;
                }
            });
        }
    }

    reset() {
        this.defineProperties();
    }
    
    redefine(theshit) {
        this.room = theshit.room;
        this.defineProperties();
    }

    // runs every second
    loop() {
        // If the game isnt active, then dont run the rest of the code.
        if (global.gameManager.arenaClosed) this.gameActive = false;
        if (!this.gameActive) return;
        //the timer has ran out? reset timer and spawn the next wave
        if (this.timer <= 0) {
            this.timer = 3; // 5 seconds
            this.waveId++;
            if (this.waves[this.waveId]) {
                this.spawnWave(this.waveId);

            //if there is no next wave then simply let the players win
            } else {
                this.playerWin();
            }

        //if the timer has not ran out and there arent any remaining enemies left, decrease the timer
        } else if (!this.remainingEnemies) {
            this.timer--;
        }
    }
}

module.exports = { Siege };