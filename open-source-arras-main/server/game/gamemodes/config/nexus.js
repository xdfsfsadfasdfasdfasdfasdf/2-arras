module.exports = {
    mode: "tdm",
    teams: 4,
    map_tile_width: 200,
    map_tile_height: 200,
    enable_food: false,
    enable_bosses: false,
    allow_server_travel: true,
    room_setup: ['room_nexus'],

    // Portals that lead to the 4TDM and Retrograde arenas.
    // Replace the IP strings with your actual server addresses.
    server_travel: [
        { ip: "localhost:3001", portal_properties: { spawn_chance: 5, color: "#1c5766" } }, // → 4TDM
        { ip: "localhost:3002", portal_properties: { spawn_chance: 5, color: "#5c1c66" } }, // → Retrograde FFA
    ],
    server_travel_properties: {
        portals: 2,
        loop_interval: 15000,
    },
}
