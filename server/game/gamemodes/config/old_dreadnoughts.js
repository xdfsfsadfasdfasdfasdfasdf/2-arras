module.exports = {
    classic_food: true,
    tier_cap: 13,
    level_cap: 180,
    level_cap_cheat: 180,
    growth: true,
    spawn_class: 'basic',
    enable_bosses: false,
    bot_cap: 0,
    do_not_override_room: false,
    room_setup: ['room_old_dreadnoughts'],
    // Larger tiles to keep physical map size similar to the old 87×27 layout
    map_tile_width: 305,
    map_tile_height: 305,
    defineLevelSkillPoints: level => {
        if (level <= 40) return 1;
        if (level <= 45 && (level & 1) == 1) return 1;
        if (level <= 51 && (level % 2) == 1) return 1;
        if (level % 10 == 1) return 1;
        return 0;
    },
}