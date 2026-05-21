function simplecollide(my, n) {
    // Cache values to avoid redundant calculations
    const dx = my.x - n.x, dy = my.y - n.y;
    const dist = Math.hypot(dx, dy);
    const difference = (1 + dist / 2) * global.gameManager.runSpeed;
    const pushability1 = my.intangibility ? 1 : my.pushability;
    const pushability2 = n.intangibility ? 1 : n.pushability;
    const factor = pushability1 / (pushability2 + 0.3) * 0.05 / difference;
    const fx = dx * factor, fy = dy * factor;
    my.accel.x += fx;
    my.accel.y += fy;
    n.accel.x -= fx;
    n.accel.y -= fy;
}

function firmcollide(my, n, buffer = 0) {
    // Cache positions and motions
    const mx = my.x + my.xMotion, myy = my.y + my.yMotion;
    const nx = n.x + n.xMotion, ny = n.y + n.yMotion;
    const dx = nx - mx, dy = ny - myy;
    const distSq = dx * dx + dy * dy;
    if (distSq === 0) return; // Prevent divide-by-zero

    const totalSize = my.realSize + n.realSize;
    const bufferLimit = totalSize + buffer;
    if (buffer > 0 && distSq <= bufferLimit * bufferLimit) {
        const dist = Math.sqrt(distSq);
        const factor = ((my.acceleration + n.acceleration) * (bufferLimit - dist)) /
            (buffer * global.gameManager.runSpeed * dist);
        const accelX = dx * factor, accelY = dy * factor;
        my.accel.x -= accelX;
        my.accel.y -= accelY;
        n.accel.x += accelX;
        n.accel.y += accelY;
    }
    if (distSq > totalSize * totalSize) return;

    const dist = Math.sqrt(distSq);
    const overlap = totalSize - dist;
    const iterations = Math.min(20, (overlap * 20) | 0);
    const factor = 0.01 * iterations / (dist * global.gameManager.runSpeed);
    const adjustX = dx * factor, adjustY = dy * factor;

    const mySpeed = Math.hypot(my.velocity.x, my.velocity.y);
    const nSpeed = Math.hypot(n.velocity.x, n.velocity.y);

    if (mySpeed <= Math.max(mySpeed, my.topSpeed)) {
        my.velocity.x -= adjustX;
        my.velocity.y -= adjustY;
    }
    if (nSpeed <= Math.max(nSpeed, n.topSpeed)) {
        n.velocity.x += adjustX;
        n.velocity.y += adjustY;
    }
    if (my.label.includes("Spike") && n.label.includes("Spike")) {
        const bounceFactor = 5;
        const dx = my.x - n.x;
        const dy = my.y - n.y;
        const dist = Math.hypot(dx, dy);
        const nx = dx / dist;
        const ny = dy / dist;
        const dot = my.velocity.x * nx + my.velocity.y * ny;
        if (dist === 0) return;
        const dot2 = n.velocity.x * (-nx) + n.velocity.y * (-ny);
        my.velocity.x = (my.velocity.x - 2 * dot * nx) * bounceFactor;
        my.velocity.y = (my.velocity.y - 2 * dot * ny) * bounceFactor;
        n.velocity.x = (n.velocity.x - 2 * dot2 * (-nx)) * bounceFactor;
        n.velocity.y = (n.velocity.y - 2 * dot2 * (-ny)) * bounceFactor;
    }
}

function firmcollidehard(my, n, buffer = 0) {
    let i1x = my.x + my.xMotion, i1y = my.y + my.yMotion;
    let i2x = n.x + n.xMotion, i2y = n.y + n.yMotion;
    let dx = i1x - i2x, dy = i1y - i2y;
    let dist = Math.sqrt(dx * dx + dy * dy);
    let s1 = Math.max(my.velocity.length, my.topSpeed);
    let s2 = Math.max(n.velocity.length, n.topSpeed);
    let strike1, strike2;
    if (buffer > 0 && dist <= my.realSize + n.realSize + buffer) {
        let repel = (my.acceleration + n.acceleration) * (my.realSize + n.realSize + buffer - dist) / buffer / Config.runSpeed;
        const rdx = dx / dist, rdy = dy / dist;
        my.accel.x += repel * rdx;
        my.accel.y += repel * rdy;
        n.accel.x -= repel * rdx;
        n.accel.y -= repel * rdy;
    }
    const runSpeedInv = 0.05 / Config.runSpeed;
    let cycles = 0; while (dist <= my.realSize + n.realSize && !(strike1 && strike2) && cycles < 150) { cycles += 1;
        strike1 = false;
        strike2 = false;
        const rdx = (i2x - i1x) / dist, rdy = (i2y - i1y) / dist;
        if (my.velocity.length <= s1) {
            my.velocity.x -= runSpeedInv * rdx;
            my.velocity.y -= runSpeedInv * rdy;
        } else {
            strike1 = true;
        }
        if (n.velocity.length <= s2) {
            n.velocity.x += runSpeedInv * rdx;
            n.velocity.y += runSpeedInv * rdy;
        } else {
            strike2 = true;
        }
        i1x = my.x + my.xMotion; i1y = my.y + my.yMotion;
        i2x = n.x + n.xMotion;  i2y = n.y + n.yMotion;
        dx = i1x - i2x; dy = i1y - i2y;
        dist = Math.sqrt(dx * dx + dy * dy);
    }
}

function reflectcollide(wall, bounce) {
    // Use cached values and avoid repeated Math.sqrt
    const dx = wall.x - bounce.x, dy = wall.y - bounce.y;
    const dist = Math.hypot(dx, dy);
    const difference = wall.size + bounce.size - dist;
    if (difference > 0) {
        const factor = difference / dist;
        bounce.accel.x -= factor * dx;
        bounce.accel.y -= factor * dy;
        return 1;
    }
    return 0;
}

function advancedcollide(my, n, doDamage, doInelastic, nIsFirmCollide = false) {
    let tock = Math.min(my.stepRemaining, n.stepRemaining),
        combinedRadius = n.size + my.size,
        motionMeX = my.xMotion, motionMeY = my.yMotion,
        motionNX = n.xMotion, motionNY = n.yMotion,
        deltaX = tock * (motionMeX - motionNX),
        deltaY = tock * (motionMeY - motionNY),
        diffX = my.x - n.x, diffY = my.y - n.y,
        diffLen = Math.sqrt(diffX * diffX + diffY * diffY),
        dirX = (n.x - my.x) / diffLen,
        dirY = (n.y - my.y) / diffLen,
        component = Math.max(0, dirX * deltaX + dirY * deltaY);

    // radius check
    if (component < diffLen - combinedRadius) return;

    // A more complex check
    let goahead = false,
        tmin = 1 - tock,
        tmax = 1,
        deltaLengthSquared = deltaX * deltaX + deltaY * deltaY,
        B = 2 * deltaX * diffX + 2 * deltaY * diffY,
        C = diffX * diffX + diffY * diffY - combinedRadius * combinedRadius,
        det = B * B - 4 * deltaLengthSquared * C,
        t;
    if (!deltaLengthSquared || det < 0 || C < 0) { // This shall catch mathematical errors
        t = 0;
        if (C < 0) { // We have already hit without moving
            goahead = true;
        }
    } else {
        let t1 = (-B - Math.sqrt(det)) / (2 * deltaLengthSquared),
            t2 = (-B + Math.sqrt(det)) / (2 * deltaLengthSquared);
        if (t1 < tmin || t1 > tmax) { // 1 is out of range
            if (t2 < tmin || t2 > tmax) { // 2 is out of range;
                t = false;
            } else { // 1 is out of range but 2 isn't
                t = t2;
                goahead = true;
            }
        } else { // 1 is in range
            if (t2 >= tmin && t2 <= tmax) { // They're both in range!
                t = Math.min(t1, t2);
                goahead = true; // That means it passed in and then out again.  Let's use when it's going in
            } else { // Only 1 is in range
                t = t1;
                goahead = true;
            }
        }
    }

    if (!goahead) return;
    /********* PROCEED ********/

    // Add to record
    my.collisionArray.push(n);
    n.collisionArray.push(my);
    if (t) {
        // Step to where the collision occured
        my.x += motionMeX * t;
        my.y += motionMeY * t;
        n.x += motionNX * t;
        n.y += motionNY * t;
        my.stepRemaining -= t;
        n.stepRemaining -= t;
        diffX = my.x - n.x; diffY = my.y - n.y;
        diffLen = Math.sqrt(diffX * diffX + diffY * diffY);
        dirX = (n.x - my.x) / diffLen;
        dirY = (n.y - my.y) / diffLen;
        component = Math.max(0, dirX * deltaX + dirY * deltaY);
    }

    let deltaLen = Math.sqrt(deltaLengthSquared);
    let componentNorm = component / deltaLen;
    let reductionFactor = 1,
        deathFactorMe = 1,
        deathFactorN = 1,
        accelerationFactor = deltaLen ? (
            (combinedRadius / 4) / (Math.floor(combinedRadius / deltaLen) + 1)
        ) : 0.001,
        depthMe = util.clamp((combinedRadius - diffLen) / (2 * my.size), 0, 1),
        depthN  = util.clamp((combinedRadius - diffLen) / (2 * n.size), 0, 1),
        combinedDepthUp   = depthMe * depthN,
        combinedDepthDown = (1 - depthMe) * (1 - depthN),
        penMeSqrt = Math.sqrt(my.penetration),
        penNSqrt  = Math.sqrt(n.penetration),
        savedHealthRatioMe = my.health.ratio,
        savedHealthRatioN  = n.health.ratio;
    if (doDamage) {
        let sfMe = my.maxSpeed ? Math.pow(Math.hypot(motionMeX, motionMeY) / my.maxSpeed, 0.25) : 1;
        let sfN  = n.maxSpeed  ? Math.pow(Math.hypot(motionNX, motionNY)   / n.maxSpeed,  0.25) : 1;
        /********** DO DAMAGE *********/
        let bail = false;
        if (n.type === my.settings.necroTarget && my.settings.necroTypes.includes(n.shape)) {
            bail = my.necro(n);
        } else if (my.type === my.settings.necroTypes && n.settings.necroTypes.includes(my.shape)) {
            bail = n.necro(my);
        }
        if (!bail && !my.invuln && !n.invuln) {
            // Calculate base damage
            let resistDiff = my.health.resist - n.health.resist,
                damageMe = Config.damage_multiplier * my.damage * (1 + resistDiff) * (1 + n.heteroMultiplier * (my.settings.damageClass === n.settings.damageClass)) * ((my.settings.buffVsFood && n.settings.damageType === 1) ? 3 : 1) * my.damageMultiplier() * Math.min(2, Math.max(sfMe, 1) * sfMe),
                damageN  = Config.damage_multiplier * n.damage  * (1 - resistDiff) * (1 + my.heteroMultiplier * (my.settings.damageClass === n.settings.damageClass)) * ((n.settings.buffVsFood && my.settings.damageType === 1) ? 3 : 1) * n.damageMultiplier()  * Math.min(2, Math.max(sfN,  1) * sfN);
            // Advanced damage calculations
            if (my.settings.ratioEffects) {
                damageMe *= Math.min(1, Math.pow(Math.max(my.health.ratio, my.shield.ratio), 1 / my.penetration));
            }
            if (n.settings.ratioEffects) {
                damageN *= Math.min(1, Math.pow(Math.max(n.health.ratio, n.shield.ratio), 1 / n.penetration));
            }
            if (my.settings.damageEffects) {
                damageMe *=
                    accelerationFactor *
                    (1 + (componentNorm - 1) * (1 - depthN) / my.penetration) *
                    (1 + penNSqrt * depthN - depthN) / penNSqrt;
            }
            if (n.settings.damageEffects) {
                damageN *=
                    accelerationFactor *
                    (1 + (componentNorm - 1) * (1 - depthMe) / n.penetration) *
                    (1 + penMeSqrt * depthMe - depthMe) / penMeSqrt;
            }
            // Find out if you'll die in this cycle, and if so how much damage you are able to do to the other target
            let damageToApplyMe = damageMe,
                damageToApplyN  = damageN;
            if (n.shield.max) {
                damageToApplyMe -= n.shield.getDamage(damageToApplyMe);
            }
            if (my.shield.max) {
                damageToApplyN -= my.shield.getDamage(damageToApplyN);
            }
            let stuff = my.health.getDamage(damageToApplyN, false);
            deathFactorMe = (stuff > my.health.amount) ? my.health.amount / stuff : 1;
            stuff = n.health.getDamage(damageToApplyMe, false);
            deathFactorN = (stuff > n.health.amount) ? n.health.amount / stuff : 1;
            reductionFactor = Math.min(deathFactorMe, deathFactorN);
            // Now apply it
            const __my = damageN  * deathFactorN;
            const __n  = damageMe * deathFactorMe;
            my.damageReceived += __my * Number(__my > 0
                ? my.team != n.team
                : !!n.healer && n.team == my.team && my.type == "tank" && n.master.id != my.id);
            n.damageReceived += __n * Number(__n > 0
                ? my.team != n.team
                : !!my.healer && n.team == my.team && n.type == "tank" && my.master.id != n.id);
        }
    }
    // Exit if healer (healers don't push on collide)
    if (n.healer && n.team == my.team && n.master.id != my.id) return;
    if (my.healer && n.team == my.team && my.master.id != n.id) return;
    /************* DO MOTION ***********/
    if (nIsFirmCollide < 0) {
        nIsFirmCollide *= -0.5;
        my.accel.x -= nIsFirmCollide * component * dirX;
        my.accel.y -= nIsFirmCollide * component * dirY;
        n.accel.x += nIsFirmCollide * component * dirX;
        n.accel.y += nIsFirmCollide * component * dirY;
    } else if (nIsFirmCollide > 0) {
        n.accel.x += nIsFirmCollide * (component * dirX + combinedDepthUp);
        n.accel.y += nIsFirmCollide * (component * dirY + combinedDepthUp);
    } else {
        // Calculate the impulse of the collision
        let knockback;
        if (my.knockback && n.knockback) {
            knockback = my.knockback * n.knockback;
        } else if (my.knockback) {
            knockback = my.knockback;
        } else if (n.knockback) {
            knockback = n.knockback;
        } else knockback = Config.knockback_multiplier;
        let elasticity = 2 - 4 * Math.atan(my.penetration * n.penetration) / Math.PI;
        if (doInelastic && my.settings.motionEffects && n.settings.motionEffects) {
            elasticity *= savedHealthRatioMe / penMeSqrt + savedHealthRatioN / penNSqrt;
        } else {
            elasticity *= 2;
        }
        let spring = 2 * Math.sqrt(savedHealthRatioMe * savedHealthRatioN) / Config.run_speed,
            elasticImpulse =
            combinedDepthDown * combinedDepthDown *
            elasticity * component *
            my.mass * n.mass / (my.mass + n.mass),
            springImpulse =
            knockback * spring * combinedDepthUp,
            impulse = -(elasticImpulse + springImpulse) * (1 - my.intangibility) * (1 - n.intangibility),
            forceX = impulse * dirX,
            forceY = impulse * dirY,
            modMe = knockback * my.pushability / my.mass * deathFactorN,
            modN  = knockback * n.pushability  / n.mass  * deathFactorMe;
        // Apply impulse as force
        my.accel.x += modMe * forceX;
        my.accel.y += modMe * forceY;
        n.accel.x -= modN * forceX;
        n.accel.y -= modN * forceY;
    }

}

function mooncollide(moon, bounce) {
    let collisionRadius = util.getDistance(moon, bounce);
    let properCollisionRadius = moon.size + bounce.size
    // Exit if too far
    if (collisionRadius >= properCollisionRadius) return;
    
    // Get elasticity
    let elasticity = bounce.type == 'tank' ? 0 : bounce.type == "bullet" ? 1 : bounce.pushability;

    // Place at edge of the moon
    let angleFromMoonToBounce = Math.atan2(bounce.y - moon.y, bounce.x - moon.x);
    bounce.x = moon.x + properCollisionRadius * Math.cos(angleFromMoonToBounce);
    bounce.y = moon.y + properCollisionRadius * Math.sin(angleFromMoonToBounce);
    
    // Find relative velocity vectors to the moon's surface
    let velocityDirection = bounce.velocity.direction;
    let tangentVelocity = bounce.velocity.length * Math.sin(angleFromMoonToBounce - velocityDirection);
    let perpendicularVelocity = bounce.velocity.length * Math.cos(angleFromMoonToBounce - velocityDirection) * elasticity * -1;

    // Exit if the reflection moves the bounced entity closer to the moon
    if (perpendicularVelocity < 0) return;

    // Get angle and magnitude of new velocity
    let newVelocityMagnitude = Math.sqrt(tangentVelocity ** 2 + perpendicularVelocity ** 2);
    let relativeVelocityAngle = Math.atan2(perpendicularVelocity, tangentVelocity);

    // Assign velocity after rotating to the new angle
    bounce.velocity.x = newVelocityMagnitude * Math.sin(Math.PI - relativeVelocityAngle - angleFromMoonToBounce);
    bounce.velocity.y = newVelocityMagnitude * Math.cos(Math.PI - relativeVelocityAngle - angleFromMoonToBounce);
    // So the bots aint a brain dead npc
    bounce.justHittedAWall = true;
}

function mazewallcollidekill(bounce, wall) {
    if (bounce.type !== 'tank' && bounce.type !== 'miniboss' && bounce.type !== 'food' && bounce.type !== 'crasher') {
        bounce.destroy();
    } else {
        bounce.collisionArray.push(wall);
    }
}

function mazewallcollide(wall, bounce) {
    if (bounce.god === true || bounce.passive === true || bounce.isArenaCloser || bounce.master.isArenaCloser) return;
    if (bounce.store.noWallCollision) return;
    if (bounce.team === wall.team && bounce.type === "tank") return;
    const trueWallSize = wall.size * lazyRealSizes[4] / Math.SQRT2 + 2;
    if (bounce.x + bounce.size < wall.x - trueWallSize ||
        bounce.x - bounce.size > wall.x + trueWallSize ||
        bounce.y + bounce.size < wall.y - trueWallSize ||
        bounce.y - bounce.size > wall.y + trueWallSize) return 0;
    if (wall.intangibility) return 0;

    const collisionFaces = [
        bounce.x < wall.x,
        bounce.y < wall.y,
        bounce.x >= wall.x,
        bounce.y > wall.y,
    ];
    const extendedOverFaces = [
        bounce.x < wall.x - trueWallSize,
        bounce.y < wall.y - trueWallSize,
        bounce.x > wall.x + trueWallSize,
        bounce.y > wall.y + trueWallSize,
    ];
    const wallPushPositions = [
        { x: wall.x - trueWallSize - bounce.size },
        { y: wall.y - trueWallSize - bounce.size },
        { x: wall.x + trueWallSize + bounce.size },
        { y: wall.y + trueWallSize + bounce.size },
    ];
    for (let i = 0; i < 4; i++) {
        if (!collisionFaces[i] | extendedOverFaces[(i + 3) % 4] | extendedOverFaces[(i + 1) % 4]) continue;
        mazewallcollidekill(bounce, wall);
        for (let axis in wallPushPositions[i]) {
            bounce[axis] = wallPushPositions[i][axis];
            bounce.velocity[axis] = 0;
            bounce.justHittedAWall = true;
            return true;
        }
    }
    const cornerPositions = [
        { x: wall.x - trueWallSize, y: wall.y - trueWallSize },
        { x: wall.x + trueWallSize, y: wall.y - trueWallSize },
        { x: wall.x + trueWallSize, y: wall.y + trueWallSize },
        { x: wall.x - trueWallSize, y: wall.y + trueWallSize },
    ];
    for (let i = 0; i < 4; i++) {
        if (
            !collisionFaces[i] | !collisionFaces[(i + 1) % 4] |
            !extendedOverFaces[i] | !extendedOverFaces[(i + 1) % 4]
        ) continue;
        const cornerX = cornerPositions[i].x;
        const cornerY = cornerPositions[i].y;
        if (Math.hypot(bounce.x - cornerX, bounce.y - cornerY) > bounce.size) return;
        mazewallcollidekill(bounce, wall);
        const angleFromCornerToBounce = Math.atan2(bounce.y - cornerY, bounce.x - cornerX);
        bounce.x = cornerX + bounce.size * Math.cos(angleFromCornerToBounce);
        bounce.y = cornerY + bounce.size * Math.sin(angleFromCornerToBounce);
        bounce.justHittedAWall = true;
        return true;
    }
}
function mazewallcustomcollide(wall, bounce) {
    /* By LA3T */
    if (!bounce || bounce.ac || bounce.passive) return;
    const canResize = bounce.type === 'tank';
    if (canResize) {
        if (!bounce.originalSize) {
            bounce.originalSize = bounce.SIZE;
        }
        if (!bounce.originalFov) {
            bounce.originalFov = bounce.FOV;
        }
    }
    
    const trueWallSize = wall.size * lazyRealSizes[4] / Math.SQRT2 + 2;
    const isColliding = !(
        bounce.x + bounce.size < wall.x - trueWallSize ||
        bounce.x - bounce.size > wall.x + trueWallSize ||
        bounce.y + bounce.size < wall.y - trueWallSize ||
        bounce.y - bounce.size > wall.y + trueWallSize
    );
    

    if (!isColliding) {
        bounce.touchingSizeWall = false;
        bounce.touchingFovWall = false;
        return;
    }
    
    const collisionFaces = [
        bounce.x < wall.x,
        bounce.y < wall.y,
        bounce.x >= wall.x,
        bounce.y > wall.y,
    ];
    const extendedOverFaces = [
        bounce.x < wall.x - trueWallSize,
        bounce.y < wall.y - trueWallSize,
        bounce.x > wall.x + trueWallSize,
        bounce.y > wall.y + trueWallSize,
    ];
    const wallPushPositions = [
        { x: wall.x - trueWallSize - bounce.size },
        { y: wall.y - trueWallSize - bounce.size },
        { x: wall.x + trueWallSize + bounce.size },
        { y: wall.y + trueWallSize + bounce.size },
    ];
    for (let i = 0; i < 4; i++) {
        if (!collisionFaces[i] | extendedOverFaces[(i + 3) % 4] | extendedOverFaces[(i + 1) % 4]) continue;
        bounce.collisionArray.push(wall);
        switch (wall.walltype) {
            case 2:
                if (bounce.health && !bounce.godmode && !bounce.passive && !bounce.isInvulnerable && !bounce.invuln) {
                    bounce.health.amount -= bounce.health.max * 0.2;
                    for (let axis in wallPushPositions[i]) {
                        bounce.velocity[axis] *= -1;
                    }
                }
                break;
            case 3:
                if (bounce.health && !bounce.godmode && !bounce.isInvulnerable && !bounce.invuln && bounce.health.amount < bounce.health.max) {
                    bounce.health.amount = Math.min(bounce.health.amount + bounce.health.max * 0.2, bounce.health.max);
                }
                break;
            case 4:
                const bounceFactor = 18.5;
                for (let axis in wallPushPositions[i]) {
                    if (i === 0 || i === 1) {
                        bounce.accel[axis] -= bounceFactor;
                    } else bounce.accel[axis] += bounceFactor;
                }
                break;
            case 5:
                if (canResize) {
                    bounce.touchingSizeWall = true;
                    bounce.SIZE = bounce.originalSize * 2;
                }
                break;
            case 6:
                if (canResize) {
                    bounce.touchingSizeWall = true;
                    if (bounce.SIZE > 5) {
                        bounce.SIZE = Math.max(bounce.SIZE * 0.95, 5);
                    }
                }
                break;
            case 7:
                if (canResize) {
                    bounce.touchingFovWall = true;
                    bounce.FOV = bounce.originalFov * 2.5;
                }
                break;
            case 8:
                for (let axis in wallPushPositions[i]) {
                }
                break;
        }
        
        for (let axis in wallPushPositions[i]) {
            bounce[axis] = wallPushPositions[i][axis];
            if (wall.walltype !== 2 && wall.walltype !== 4 && wall.walltype !== 8) {
                bounce.velocity[axis] = 0;
            }
            return true;
        }
    }
    const cornerPositions = [
        { x: wall.x - trueWallSize, y: wall.y - trueWallSize },
        { x: wall.x + trueWallSize, y: wall.y - trueWallSize },
        { x: wall.x + trueWallSize, y: wall.y + trueWallSize },
        { x: wall.x - trueWallSize, y: wall.y + trueWallSize },
    ];
    for (let i = 0; i < 4; i++) {
        if (!collisionFaces[i] | !collisionFaces[(i + 1) % 4] |
            !extendedOverFaces[i] | !extendedOverFaces[(i + 1) % 4]) continue;
        const cornerX = cornerPositions[i].x;
        const cornerY = cornerPositions[i].y;
        if (Math.hypot(bounce.x - cornerX, bounce.y - cornerY) > bounce.size) continue;
        bounce.collisionArray.push(wall);
        
        const angleFromCornerToBounce = Math.atan2(bounce.y - cornerY, bounce.x - cornerX);
        switch (wall.walltype) {
            case 2:
                if (bounce.health && !bounce.godmode && !bounce.passive && !bounce.isInvulnerable && !bounce.invuln) {
                    bounce.health.amount -= bounce.health.max * 0.2;
                }
                break;
            case 3:
                if (bounce.health && !bounce.godmode && !bounce.isInvulnerable && !bounce.invuln && bounce.health.amount < bounce.health.max) {
                    bounce.health.amount = Math.min(bounce.health.amount + bounce.health.max * 0.2, bounce.health.max);
                }
                break;
            case 4:
                const bounceFactor = 18.5;
                const dx = bounce.x - cornerX;
                const dy = bounce.y - cornerY;
                const dist = Math.hypot(dx, dy);
                const nx = dx / dist;
                const ny = dy / dist;
                const dot = bounce.accel.x * nx + bounce.accel.y * ny;
                bounce.accel.x += (bounce.accel.x - 2 * dot * nx) * bounceFactor;
                bounce.accel.y += (bounce.accel.y - 2 * dot * ny) * bounceFactor;
                break;
            case 5:
                if (canResize) {
                    bounce.touchingSizeWall = true;
                    bounce.SIZE = bounce.originalSize * 2;
                }
                break;
            case 6:
                if (canResize) {
                    bounce.touchingSizeWall = true;
                    if (bounce.SIZE > 5) {
                        bounce.SIZE = Math.max(bounce.SIZE * 0.95, 5);
                    }
                }
                break;
            case 7:
                if (canResize) {
                    bounce.touchingFovWall = true;
                    bounce.FOV = bounce.originalFov * 2.5;
                }
                break;
            case 8: 
                for (let axis in cornerPositions[i]) {
                    if (i == 2) {
                        bounce.velocity[axis] *= 2.5;
                    }
                }
                break;
        }
        if (wall.walltype !== 8) {
            bounce.x = cornerX + bounce.size * Math.cos(angleFromCornerToBounce);
            bounce.y = cornerY + bounce.size * Math.sin(angleFromCornerToBounce);
        }
        return true;
    }
}
module.exports = {
    simplecollide,
    firmcollide,
    firmcollidehard,
    reflectcollide,
    advancedcollide,
    mooncollide,
    mazewallcollide,
    mazewallcustomcollide
};
