// ── Constants ─────────────────────────────────────────────────────────────────
const SANCTUARY_MIN_LEVEL = 120;
const DREAD_TEAM = 99; // all dreadnoughts share this team (friendly to each other)
const PORTAL_RADIUS      = 200;   // units — gravity well starts here
const PORTAL_HORIZON     = 80;    // units — teleport/repel threshold
const PORTAL_GRAVITY     = 25000;
const PORTAL_LAUNCH      = 6000;
const PORTAL_LIFESPAN    = 120000; // ms alive
const PORTAL_COOLDOWN    = 10000;  // ms before respawn

// ── Zone tile registries (populated by tile INIT, deduplicated for re-init) ──
let ffaTiles        = [];
let labyTiles       = [];
let sanctuaryTiles  = [];

// ── Lifecycle tracking (for clean re-init on arena close / soft restart) ─────
let mazeWallEntities     = []; // half-wall entities spawned by buildLabyrinthWalls
let activePortalIntervals = [];
let activePortalTimeouts  = [];
let foodCycleInterval     = null;

// ── Portal teleport helpers ───────────────────────────────────────────────────
function launchEntity(entity, loc) {
    let angle = Math.random() * Math.PI * 2;
    let force = PORTAL_LAUNCH * Config.room_bound_force;
    entity.x = loc.x;
    entity.y = loc.y;
    entity.cannotTeleport = true;
    setTimeout(() => {
        entity.velocity.x = Math.cos(angle) * force;
        entity.velocity.y = Math.sin(angle) * force;
        setTimeout(() => { entity.cannotTeleport = false; }, 250);
    }, 100);
    entity.protect();
    for (let o of entities.values()) {
        if (o.id !== entity.id && o.master.master.id === entity.id &&
                (o.type === 'drone' || o.type === 'minion' || o.type === 'satellite')) {
            o.x = loc.x;
            o.y = loc.y;
        }
    }
}

function randomTileLoc(tileArr) {
    return ran.choose(tileArr).randomInside();
}

// ── Portal entity lifecycle ───────────────────────────────────────────────────
// type = {
//   visual   : string  — Class name to define on the portal entity
//   label    : string  — shown above the portal
//   minLevel : number|null — repel if tank is below this level (and not a dread)
//   landIn   : () => array of tiles — landing zone tile array
// }
function spawnPortal(type, sourceTiles) {
    if (!sourceTiles.length) return;

    let pos = randomTileLoc(sourceTiles);
    let ent = new Entity(pos);
    ent.define(type.visual);
    ent.team = TEAM_ROOM;
    ent.name  = type.label;
    ent.label = type.label;
    ent.minimapColor = 19; // pureBlack
    ent.alwaysShowOnMinimap = true;
    ent.protect();
    ent.life();

    let landArr = type.landIn();

    // Per-tick detection loop (every 50 ms ≈ 20 Hz)
    let loop = setInterval(() => {
        if (ent.isDead()) { clearInterval(loop); util.remove(activePortalIntervals, activePortalIntervals.indexOf(loop)); return; }

        for (let [, e] of entities) {
            if (e.type !== 'tank' || e.passive || e.cannotTeleport) continue;

            let dx = e.x - ent.x,
                dy = e.y - ent.y,
                dist = Math.hypot(dx, dy);

            if (dist > PORTAL_RADIUS) continue; // out of range entirely

            let isDread = e.defs.some(d => d.includes('dreadsV1') || d.includes('dreadsV2'));

            if (dist > PORTAL_HORIZON) {
                // Gravity well
                let f = Config.room_bound_force * PORTAL_GRAVITY / (dist * dist);
                e.velocity.x -= dx * f;
                e.velocity.y -= dy * f;
                continue;
            }

            // Within event horizon ─ check level gate (Forge portal)
            if (type.minLevel && !isDread && e.skill.level < type.minLevel) {
                if (!e._portalAlerted) {
                    e.sendMessage(`You need to be level ${type.minLevel} to enter the Forge!`);
                    e._portalAlerted = true;
                    setTimeout(() => { e._portalAlerted = false; }, 50);
                }
                // Repel
                let f = 3e4 / (dist * dist) * 0.3;
                e.accel.x += dx * f;
                e.accel.y += dy * f;
                continue;
            }

            if (!landArr.length) continue;

            // Transform if needed (Forge portal)
            if (type.transform && !isDread) {
                e.define('dreadnought_dreadsV1');
                e.refreshBodyAttributes();
                e.team = DREAD_TEAM; // join shared dreadnought team
            }

            launchEntity(e, randomTileLoc(landArr));
        }
    }, 50);

    activePortalIntervals.push(loop);
    // Kill after lifespan, then respawn after cooldown
    let killTimer = setTimeout(() => {
        ent.kill();
        clearInterval(loop);
        util.remove(activePortalIntervals, activePortalIntervals.indexOf(loop));
        let respawn = setTimeout(() => spawnPortal(type, sourceTiles), PORTAL_COOLDOWN);
        activePortalTimeouts.push(respawn);
    }, PORTAL_LIFESPAN);
    activePortalTimeouts.push(killTimer);
}

// ── Tile: FFA zone (spawnable, food-eligible, landing zone) ───────────────────
tileClass.ffa_tile = new Tile({
    COLOR: 'white',
    NAME: 'FFA',
    INIT: (tile, room) => {
        if (!ffaTiles.includes(tile)) ffaTiles.push(tile);
        room.spawnableDefault.push(tile);
    }
});

// ── Tile: Labyrinth (not globally spawnable; shiny shapes; landing zone) ──────
const labyFoodTable = [
    [0.001, [[1296,'jewel'],[216,'legendaryTriangle'],[36,'legendarySquare'],[6,'legendaryPentagon']]],
    [0.02,  [[625,'gem'],[125,'shinyTriangle'],[25,'shinySquare'],[5,'shinyPentagon']]],
    [1,     [[65,'egg'],[64,'triangle'],[45,'square'],[7,'pentagon']]],
];
function pickLabyFood() {
    let roll = Math.random();
    for (let [thresh, pool] of labyFoodTable) {
        if (roll < thresh) {
            let tot = pool.reduce((s,[w])=>s+w, 0), r = Math.random()*tot;
            for (let [w,t] of pool) { r -= w; if (r <= 0) return t; }
        }
    }
    return 'egg';
}

tileClass.labyrinth = new Tile({
    COLOR: 'white',
    NAME: 'Labyrinth',
    INIT: (tile) => { if (!labyTiles.includes(tile)) labyTiles.push(tile); },
    TICK: () => {
        // Rare shape spawning is handled globally by the maze-builder
        // individual tile TICK kept light intentionally
    }
});

// ── Tile: Sanctuary zone ──────────────────────────────────────────────────────
tileClass.sanctuary_tile = new Tile({
    COLOR: 'white',
    NAME: 'Sanctuary',
    INIT: (tile) => { if (!sanctuaryTiles.includes(tile)) sanctuaryTiles.push(tile); }
});

// ── Tile: Maze builder + portal manager ───────────────────────────────────────
// Place ONE of these tiles anywhere in the room. It initialises after all zone
// tiles, then (after a short delay) builds the labyrinth walls and spawns portals.
//
// Maze structure inside the 25×25 labyrinth zone:
//   – 1-tile free border all around
//   – 5-tile open inner perimeter
//   – 3 half-wall chamfer at each corner transition
//   – DFS maze in the central ~11×11 tile area
//   – 5×5 empty center (no walls)
tileClass.maze_builder = new Tile({
    COLOR: 'white',
    NAME: '',
    INIT: (tile, room) => {
        // Spawn a regular wall entity here so the separator has no gap
        let w = new Entity(tile.loc);
        w.define('wall');
        w.team = TEAM_ROOM;
        w.SIZE = room.tileWidth / 2 / lazyRealSizes[4] * Math.SQRT2 - 2;
        w.protect();
        w.life();
        makeHitbox(w);
        walls.push(w);
        w.on('dead', () => util.remove(walls, walls.indexOf(w)));

        setTimeout(() => {
            buildLabyrinthWalls(room);
            startPortalCycles();
            startLabyFoodCycle();
        }, 1500);
    }
});

// ── Labyrinth wall builder ────────────────────────────────────────────────────
// Structure (matching the reference image):
//   • Outer ring (row 0, row H-1, col 0, col W-1): FREE — 0.5-tile navigable border
//   • Inner area (rows 1..H-2, cols 1..W-2): DFS maze — starts ALL WALLS, paths carved out
//   • 4 corner 3×3 clear zones in the inner area corners
//   • Center 4×4 clear zone
function buildLabyrinthWalls(room) {
    if (!labyTiles.length) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let t of labyTiles) {
        if (t.loc.x < minX) minX = t.loc.x;
        if (t.loc.y < minY) minY = t.loc.y;
        if (t.loc.x > maxX) maxX = t.loc.x;
        if (t.loc.y > maxY) maxY = t.loc.y;
    }

    let TW = room.tileWidth, TH = room.tileHeight;
    let ZONE_W = Math.round((maxX - minX) / TW) + 1; // e.g. 15
    let ZONE_H = Math.round((maxY - minY) / TH) + 1; // e.g. 13

    let grid = Array.from({length: ZONE_H}, () => new Array(ZONE_W).fill(null));
    for (let t of labyTiles) {
        let tx = Math.round((t.loc.x - minX) / TW);
        let ty = Math.round((t.loc.y - minY) / TH);
        grid[ty][tx] = t;
    }

    // Wall entity fills one tile — adjacent walls touch with no gap
    let halfWallSize = Math.min(TW, TH) / 2 / lazyRealSizes[4] * Math.SQRT2 - 2;

    // Kill any walls left over from a previous maze (soft restart)
    for (let w of mazeWallEntities) {
        if (!w.isDead()) { util.remove(walls, walls.indexOf(w)); w.kill(); }
    }
    mazeWallEntities = [];

    function placeHalfWall(wx, wy) {
        let o = new Entity({x: wx, y: wy});
        o.define('wall');
        o.team = TEAM_ROOM;
        o.SIZE = halfWallSize;
        o.protect();
        o.life();
        makeHitbox(o);
        walls.push(o);
        mazeWallEntities.push(o);
        o.on('dead', () => {
            util.remove(walls, walls.indexOf(o));
            util.remove(mazeWallEntities, mazeWallEntities.indexOf(o));
        });
    }

    // Inner area dimensions (excluding free 1-tile border on all sides)
    let IW = ZONE_W - 2; // e.g. 13
    let IH = ZONE_H - 2; // e.g. 11

    // Start: every inner tile is a wall
    let isWall = Array.from({length: IH}, () => new Array(IW).fill(true));

    // ── DFS backtracker — carve corridors through the all-wall inner grid ──────
    // Cells live at odd positions (1,3,5…); walls between cells are at even positions.
    let visited = Array.from({length: IH}, () => new Array(IW).fill(false));

    function carve(iy, ix) {
        visited[iy][ix] = true;
        isWall[iy][ix] = false; // this cell becomes a corridor
        let dirs = [[0,2],[0,-2],[2,0],[-2,0]];
        for (let i = dirs.length-1; i > 0; i--) {
            let j = Math.floor(Math.random()*(i+1));
            [dirs[i],dirs[j]] = [dirs[j],dirs[i]];
        }
        for (let [dy, dx] of dirs) {
            let ny = iy+dy, nx = ix+dx;
            if (ny >= 0 && ny < IH && nx >= 0 && nx < IW && !visited[ny][nx]) {
                isWall[iy + dy/2][ix + dx/2] = false; // carve passage wall
                carve(ny, nx);
            }
        }
    }
    carve(1, 1);

    // ── Spawn wall entities for every remaining wall tile ─────────────────────
    // Outer border (zone row/col 0 and ZONE_H-1/ZONE_W-1) is intentionally skipped —
    // those tiles stay empty, forming the free navigable border around the maze.
    for (let iy = 0; iy < IH; iy++) {
        for (let ix = 0; ix < IW; ix++) {
            if (!isWall[iy][ix]) continue;
            let t = grid[iy + 1][ix + 1]; // +1 to skip the free border row/col
            if (t) placeHalfWall(t.loc.x, t.loc.y);
        }
    }
}

// ── Portal cycle manager ──────────────────────────────────────────────────────
function startPortalCycles() {
    // Cancel any running portal loops from a previous arena cycle
    for (let id of activePortalIntervals) clearInterval(id);
    for (let id of activePortalTimeouts)  clearTimeout(id);
    activePortalIntervals = [];
    activePortalTimeouts  = [];
    // Portal type definitions
    const portalTypes = [
        {
            // FFA → Labyrinth (radiant/spiky wormhole)
            visual   : 'spikyPortal_dreadsV1',
            label    : 'Labyrinth',
            minLevel : null,
            transform: false,
            landIn   : () => labyTiles,
            source   : ffaTiles,
        },
        {
            // Labyrinth → Labyrinth radiant (return to FFA)
            visual   : 'spikyPortal_dreadsV1',
            label    : 'FFA',
            minLevel : null,
            transform: false,
            landIn   : () => ffaTiles,
            source   : labyTiles,
        },
        {
            // Labyrinth → Sanctuary (Forge portal, level gate)
            visual   : 'bluePortal_dreadsV1',
            label    : 'Forge (Lv.120+)',
            minLevel : SANCTUARY_MIN_LEVEL,
            transform: true,
            landIn   : () => sanctuaryTiles,
            source   : labyTiles,
        },
        {
            // Sanctuary → Labyrinth (gray exit)
            visual   : 'spikyPortal_dreadsV1',
            label    : 'Labyrinth',
            minLevel : null,
            transform: false,
            landIn   : () => labyTiles,
            source   : sanctuaryTiles,
        },
        {
            // Sanctuary → FFA (colored exit)
            visual   : 'greenPortal_dreadsV1',
            label    : 'FFA',
            minLevel : null,
            transform: false,
            landIn   : () => ffaTiles,
            source   : sanctuaryTiles,
        },
    ];

    for (let type of portalTypes) {
        spawnPortal(type, type.source);
    }
}

// ── Labyrinth rare food cycle ─────────────────────────────────────────────────
function startLabyFoodCycle() {
    if (foodCycleInterval) clearInterval(foodCycleInterval);
    foodCycleInterval = setInterval(() => {
        if (!labyTiles.length) return;
        let t = ran.choose(labyTiles);
        let o = new Entity(t.randomInside());
        o.define(pickLabyFood());
        o.facing = ran.randomAngle();
        o.team = TEAM_ENEMIES;
        o.isFood = true;
    }, 500); // roughly 2 rare-biased shapes per second across the whole labyrinth
}
