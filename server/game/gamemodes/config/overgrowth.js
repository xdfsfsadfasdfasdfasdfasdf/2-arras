// Overgrowth — Growth with an uncapped level ceiling and stronger shapes.
module.exports = {
    growth: true,
    level_cap: 9999,
    level_cap_cheat: 9999,
    tier_cap: 99,
    defineLevelSkillPoints: level => {
        if (level <= 40) return 1;
        if (level <= 45 && (level & 1) == 1) return 1;
        if (level <= 51 && (level % 2) == 1) return 1;
        if (level % 10 == 1) return 1;
        return 0;
    }
}
