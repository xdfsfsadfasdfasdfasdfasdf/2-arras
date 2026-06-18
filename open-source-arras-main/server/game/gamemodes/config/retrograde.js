module.exports = {
    retrograde: true,
    daily_tank: false,

    // Portal from Retrograde to the 4TDM arena (Nexus-style wormhole).
    // Replace the IP string with your actual 4TDM server address.
    server_travel: [
        { ip: "localhost:3001", portal_properties: { spawn_chance: 8, color: "#3a1c66" } }, // → 4TDM
    ],
    server_travel_properties: {
        portals: 1,
        loop_interval: 20000,
    },
}
