// This is the checking loop. Runs at 1Hz.
class speedcheckloop {
    constructor() {
        this.fails = 0;
        this.isRestarting = false;
        this.lastDetailedLog = 0;
    }
    update() {
        let activationtime = logs.activation.sum(),
            collidetime = logs.collide.sum(),
            movetime = logs.entities.sum(),
            maptime = logs.minimap.sum(),
            physicstime = logs.physics.sum(),
            lifetime = logs.life.sum(),
            thoughtime = logs.though.sum(),
            selfietime = logs.selfie.sum();
        let playertime = logs.network.record();
        let masterrecord = logs.master.record();
        let sum = masterrecord.average + playertime.average;
        let loops = logs.loops.getTallyCount();

        global.fps = (1000/sum).toFixed(2);
        for (let e of entities.values()) {
            if (e.isPlayer && e.socket) {
                e.socket.talk("svInfo", global.gameManager.name, (sum).toFixed(1));
            }
        }
        if (sum > 1000 / global.gameManager.roomSpeed / 30) {
            this.fails++;
            if (Config.startup_logs) {
                util.warn(`Last server tick took too long! [Loops: ${loops}, Entities: ${entities.size}, Clients: ${global.gameManager.clients.length}, Backlog: ${(sum * global.gameManager.roomSpeed * 3).toFixed(1)}%]`);
                const now = Date.now();
                if (now - this.lastDetailedLog >= 10000) {
                    this.lastDetailedLog = now;
                    util.warn('  activation: ' + activationtime + '  collision: ' + collidetime + '  cycle: ' + movetime);
                    util.warn('  network: ' + playertime.sum + '  minimap: ' + maptime + '  physics: ' + physicstime);
                    util.warn('  life: ' + lifetime + '  thought: ' + thoughtime + '  selfie: ' + selfietime);
                }
            }
            if (this.fails > 20 && (sum).toFixed(0) > 300 && !this.isRestarting) {
                this.isRestarting = true;
                util.error("FAILURE!");
                global.gameManager.socketManager.broadcast("Server overloaded! Restarting...");
                global.gameManager.gameHandler.stop();
                setTimeout(() => {global.gameManager.close()}, 900);
                setTimeout(() => {this.isRestarting = false}, 3000);
            }
        } else {
            this.fails = 0;
        }
    }
    onError(error) {
        if (this.isRestarting) return;
        this.isRestarting = true;
        util.error("FAILURE!");
        global.gameManager.socketManager.broadcast("Server Error! Restarting...");
        setTimeout(() => {global.gameManager.close()}, 900);
        setTimeout(() => {this.isRestarting = false}, 3000);
        console.error(error);
    }
}

module.exports = { speedcheckloop };