// Maps a server's initial gamemode key (this.gamemode.join(',')) to its variation pool.
// On every arena close the server picks one entry at random and applies it.
//
// Each entry: { name, modes (config filenames to load in order), overrides (Config keys) }
module.exports = {
    // FFA  →  stays FFA 70% / becomes maze 30%
    'ffa': [
        { name: 'FFA',      modes: ['ffa'],          overrides: { maze_type: 0 } },
        { name: 'FFA',      modes: ['ffa'],          overrides: { maze_type: 0 } },
        { name: 'FFA',      modes: ['ffa'],          overrides: { maze_type: 0 } },
        { name: 'FFA',      modes: ['ffa'],          overrides: { maze_type: 0 } },
        { name: 'FFA',      modes: ['ffa'],          overrides: { maze_type: 0 } },
        { name: 'FFA',      modes: ['ffa'],          overrides: { maze_type: 0 } },
        { name: 'FFA',      modes: ['ffa'],          overrides: { maze_type: 0 } },
        { name: 'FFA Maze', modes: ['maze', 'ffa'],  overrides: {} },
        { name: 'FFA Maze', modes: ['maze', 'ffa'],  overrides: {} },
        { name: 'FFA Maze', modes: ['maze', 'ffa'],  overrides: {} },
    ],

    // 4TDM  →  2TDM / FFA / 4TDM / Clan Wars
    'tdm': [
        { name: '2TDM',      modes: ['tdm'],       overrides: { teams: 2, mode: 'tdm' } },
        { name: 'FFA',       modes: ['ffa'],       overrides: { mode: 'ffa' } },
        { name: '4TDM',      modes: ['tdm'],       overrides: { teams: 4, mode: 'tdm' } },
        { name: 'Clan Wars', modes: ['clan_wars'], overrides: {} },
    ],

    // Retrograde FFA  →  Retrograde 2TDM / Retrograde FFA / Retrograde 4TDM / Soccer
    'retrograde,ffa': [
        { name: 'Retrograde 2TDM', modes: ['retrograde', 'tdm'], overrides: { teams: 2 } },
        { name: 'Retrograde FFA',  modes: ['retrograde', 'ffa'], overrides: {} },
        { name: 'Retrograde 4TDM', modes: ['retrograde', 'tdm'], overrides: { teams: 4 } },
        { name: 'Soccer',   modes: ['soccer'],             overrides: {} },
    ],
    // also match servers configured as ['ffa', 'retrograde']
    'ffa,retrograde': [
        { name: 'Retrograde 2TDM', modes: ['retrograde', 'tdm'], overrides: { teams: 2 } },
        { name: 'Retrograde FFA',  modes: ['retrograde', 'ffa'], overrides: {} },
        { name: 'Retrograde 4TDM', modes: ['retrograde', 'tdm'], overrides: { teams: 4 } },
        { name: 'Soccer',   modes: ['soccer'],             overrides: {} },
    ],

    // Siege Classic  →  Classic / Citadel / Blitz / Fortress
    'siege_classic': [
        { name: 'Siege Classic',  modes: ['siege_classic'],  overrides: {} },
        { name: 'Siege Citadel',  modes: ['siege_citadel'],  overrides: {} },
        { name: 'Siege Blitz',    modes: ['siege_blitz'],    overrides: {} },
        { name: 'Siege Fortress', modes: ['siege_fortress'], overrides: {} },
    ],

    // Old Siege (merged)  →  all siege variants including Old Siege, no shapes
    'old_siege': [
        { name: 'Old Siege',      modes: ['old_siege'],      overrides: { enable_food: false } },
        { name: 'Siege Classic',  modes: ['siege_classic'],  overrides: { enable_food: false } },
        { name: 'Siege Citadel',  modes: ['siege_citadel'],  overrides: { enable_food: false } },
        { name: 'Siege Blitz',    modes: ['siege_blitz'],    overrides: { enable_food: false } },
        { name: 'Siege Fortress', modes: ['siege_fortress'], overrides: { enable_food: false } },
    ],

    // Old Dreadnoughts  →  Growth / Overgrowth / Old Dreadnoughts, each with FFA / 2TDM / 4TDM arena
    'old_dreadnoughts': [
        { name: 'Growth FFA',           modes: ['growth'],           overrides: { mode: 'ffa' } },
        { name: 'Growth 2TDM',          modes: ['growth'],           overrides: { mode: 'tdm', teams: 2 } },
        { name: 'Growth 4TDM',          modes: ['growth'],           overrides: { mode: 'tdm', teams: 4 } },
        { name: 'Overgrowth FFA',       modes: ['overgrowth'],       overrides: { mode: 'ffa' } },
        { name: 'Overgrowth 2TDM',      modes: ['overgrowth'],       overrides: { mode: 'tdm', teams: 2 } },
        { name: 'Overgrowth 4TDM',      modes: ['overgrowth'],       overrides: { mode: 'tdm', teams: 4 } },
        { name: 'Old Dreadnoughts FFA',  modes: ['old_dreadnoughts'], overrides: { mode: 'ffa' } },
        { name: 'Old Dreadnoughts 2TDM', modes: ['old_dreadnoughts'], overrides: { mode: 'tdm', teams: 2 } },
        { name: 'Old Dreadnoughts 4TDM', modes: ['old_dreadnoughts'], overrides: { mode: 'tdm', teams: 4 } },
    ],
};
