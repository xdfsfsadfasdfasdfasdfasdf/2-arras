// Old Dreadnoughts — 75 wide × 32 tall
// tile size: 305×305
//
// Column layout:
//   col  0      : outer left wall
//   cols 1–30   : FFA zone      (30×30, rows 1-30)  ← same size as labyrinth
//   cols 31–34  : separator     (4 wide)
//   cols 35–64  : Labyrinth     (30×30, rows 1-30)  ← square
//   cols 65–68  : separator     (4 wide)
//   cols 69–73  : Sanctuary     (5×30, rows 1-30)
//   col  74     : outer right wall
//   rows 0, 31  : outer walls

const {
    wall:           WALL,
    ffa_tile:       FFAT,
    nest:           NEST,
    labyrinth:      LABY,
    sanctuary_tile: SANC,
    maze_builder:   MBLDR,
} = tileClass;

function fill(room, r1, c1, r2, c2, tile) {
    for (let r = r1; r <= r2; r++)
        for (let c = c1; c <= c2; c++)
            room[r][c] = tile;
}

const W = 75, H = 32;
let room = Array.from({length: H}, () => new Array(W).fill(WALL));

// FFA zone: cols 1-30, rows 1-30  (30×30)
fill(room, 1, 1, 30, 30, FFAT);

// FFA nest: centred in 30×30  (cols 12-18, rows 12-19)
fill(room, 12, 12, 19, 18, NEST);

// Labyrinth zone: cols 35-64, rows 1-30  (30×30 square)
fill(room, 1, 35, 30, 64, LABY);

// Sanctuary zone: cols 69-73, rows 1-30
fill(room, 1, 69, 30, 73, SANC);

// maze_builder in the centre of the first separator
room[15][32] = MBLDR;

// ── Team bases — FFA zone only (labyrinth & sanctuary stay neutral) ───────────
// FFA zone: cols 1–30 (C1..C2) × rows 1–30 (R1..R2).
if (Config.mode === 'tdm') {
    const R1 = 1, R2 = 30, C1 = 1, C2 = 30;
    const zoneH = R2 - R1 + 1; // 30

    if (Config.teams === 2) {
        // Left edge = team 1, right edge = team 2; 5 defenders per side spread evenly
        const gap = Math.ceil((zoneH - 1) / 6);
        for (let r = R1; r <= R2; r++) {
            room[r][C1] = tileClass.base1;
            room[r][C2] = tileClass.base2;
        }
        for (let i = -2; i <= 2; i++) {
            const r = Math.floor((R1 + R2) / 2 - gap * i);
            room[r][C1] = tileClass.baseprotected1;
            room[r][C2] = tileClass.baseprotected2;
        }
    } else if (Config.teams >= 4) {
        // One team per corner of the FFA zone: 3 base tiles + 1 defender each
        const corners = [
            { spawns: [[R1,C1],[R1+1,C1],[R1,C1+1]], prot: [R1+1,C1+1] },
            { spawns: [[R2,C2],[R2-1,C2],[R2,C2-1]], prot: [R2-1,C2-1] },
            { spawns: [[R1,C2],[R1+1,C2],[R1,C2-1]], prot: [R1+1,C2-1] },
            { spawns: [[R2,C1],[R2-1,C1],[R2,C1+1]], prot: [R2-1,C1+1] },
        ];
        for (let i = 0; i < Math.min(Config.teams, 4); i++) {
            const { spawns, prot } = corners[i];
            for (let [r,c] of spawns) room[r][c] = tileClass[`base${i+1}`];
            room[prot[0]][prot[1]] = tileClass[`baseprotected${i+1}`];
        }
    }
}

module.exports = room;
