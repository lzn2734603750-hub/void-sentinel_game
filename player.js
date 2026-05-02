// ====================================
// player.js - 玩家系统 / 冲刺 / 护盾 / 僚机 / 冲击波
// ====================================

// 2P 联机模式 - 玩家数组
var players = [];
var p1 = null;
var p2 = null;

var PLAYER_COLORS = {
    p1:   { body: ['#0cf','#08f','#036'], flame: '#0cf', glow: '#0ff', name: 'P1' },
    p2:   { body: ['#f60','#f40','#600'], flame: '#f80', glow: '#f44', name: 'P2' },
    net1: { body: ['#0cf','#08f','#036'], flame: '#0cf', glow: '#0ff', name: 'Host' },
    net2: { body: ['#0f8','#0a4','#040'], flame: '#0f6', glow: '#0f0', name: 'Guest' },
};

function createPlayer(x, y, playerIndex) {
    var scheme;
    if (playerIndex === 0) {
        scheme = (gameMode === 'network' && networkRole === 'guest') ? PLAYER_COLORS.net2 : PLAYER_COLORS.p1;
    } else {
        scheme = (gameMode === 'network') ? PLAYER_COLORS.net1 : PLAYER_COLORS.p2;
    }
    return {
        x, y,
        radius: 18,
        speed: 5,
        angle: 0,
        hp: 5,
        maxHp: 5,
        hurtTimer: 0,
        bulletCount: 1,
        fireRate: 8,
        fireCooldown: 0,
        exp: 0,
        expToNext: 10,
        dashSpeed: 15,
        dashDuration: 10,
        dashCooldown: 0,
        dashCooldownMax: 90,
        dashTimer: 0,
        dashVx: 0,
        dashVy: 0,
        invincible: false,
        shieldActive: false,
        shieldTimer: 0,
        critChance: 0,
        droneCount: 0,
        shockwaveOnHit: false,
        bulletSpeed: 10,
        bulletDamage: 1,
        bulletSize: 1,
        magnetRange: 0,
        playerIndex,
        alive: true,
        colorScheme: scheme,
    };
}

function resetPlayers(gameMode) {
    players.length = 0;
    p1 = createPlayer(canvas.width / 2, canvas.height / 2, 0);
    var ds = window.getDifficultySettings ? getDifficultySettings() : { playerExtraHP: 0 };
    p1.hp += ds.playerExtraHP;
    p1.maxHp += ds.playerExtraHP;
    players.push(p1);

    if (gameMode === 'coop' || gameMode === 'network') {
        var ox = gameMode === 'network' && networkRole === 'guest' ? -60 : 60;
        p2 = createPlayer(canvas.width / 2 + ox, canvas.height / 2, 1);
        if (gameMode === 'coop') {
            p2.hp += ds.playerExtraHP;
            p2.maxHp += ds.playerExtraHP;
        }
        p2.bulletCount = 1;
        p2.speed = 5;
        players.push(p2);
    } else {
        p2 = null;
    }
}

// ---------- 键盘 / 移动端输入 ----------
var keys = {
    w: false, a: false, s: false, d: false, space: false, f: false,
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
    ShiftRight: false, ControlRight: false,
};

var mobileMoveX = 0;
var mobileMoveY = 0;
var mobileAimX = canvas.width / 2;
var mobileAimY = canvas.height / 2;
var mobileAimActive = false;
var mobileFire = false;
var mobileDash = false;

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); keys.space = true; return; }
    if (e.code === 'ShiftRight' || (e.key === 'Shift' && e.location === 2)) {
        e.preventDefault();
        keys.ShiftRight = true;
        return;
    }
    if (e.code === 'ControlRight') { e.preventDefault(); keys.ControlRight = true; return; }
    if (e.key in keys) { keys[e.key] = true; e.preventDefault(); }
    if (e.key.toLowerCase() in keys) { keys[e.key.toLowerCase()] = true; e.preventDefault(); }
});
window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') { e.preventDefault(); keys.space = false; return; }
    if (e.code === 'ShiftRight' || (e.key === 'Shift' && e.location === 2)) {
        e.preventDefault();
        keys.ShiftRight = false;
        return;
    }
    if (e.code === 'ControlRight') { e.preventDefault(); keys.ControlRight = false; return; }
    if (e.key in keys) { keys[e.key] = false; e.preventDefault(); }
    if (e.key.toLowerCase() in keys) { keys[e.key.toLowerCase()] = false; e.preventDefault(); }
});

// ---------- 鼠标 ----------
var mouseX = canvas.width / 2;
var mouseY = canvas.height / 2;
var mouseDown = false;

canvas.addEventListener('mousemove', (e) => {
    var rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});
canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
        mouseDown = true;
        var rect = canvas.getBoundingClientRect();
        var cx = e.clientX - rect.left;
        var cy = e.clientY - rect.top;
        if (typeof handleClick === 'function') handleClick(cx, cy);
        e.preventDefault();
    }
});
canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) { mouseDown = false; e.preventDefault(); }
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- 玩家移动逻辑 ----------
function updatePlayerMovement(player, isP2) {
    if (!player || !player.alive || player.hp <= 0) return;
    if (player.hurtTimer > 0) player.hurtTimer--;

    if (player.dashTimer <= 0) {
        let mx = 0, my = 0;
        if (!isP2) {
            if (keys.w || mobileMoveY < -0.2) my--;
            if (keys.s || mobileMoveY > 0.2) my++;
            if (keys.a || mobileMoveX < -0.2) mx--;
            if (keys.d || mobileMoveX > 0.2) mx++;
        } else {
            if (keys.ArrowUp) my--;
            if (keys.ArrowDown) my++;
            if (keys.ArrowLeft) mx--;
            if (keys.ArrowRight) mx++;
        }
        if (mx !== 0 && my !== 0) {
            const l = Math.sqrt(mx * mx + my * my);
            mx /= l; my /= l;
        }
        player.x += mx * player.speed;
        player.y += my * player.speed;
    }

    clampPlayerToCanvas(player);

    // 瞄准
    if (!isP2) {
        if (gameMode === 'solo') {
            if (isMobile() && mobileAimActive) {
                player.angle = Math.atan2(mobileAimY - player.y, mobileAimX - player.x);
            } else if (isMobile() && (mobileMoveX !== 0 || mobileMoveY !== 0)) {
                player.angle = Math.atan2(mobileMoveY, mobileMoveX);
            } else {
                player.angle = Math.atan2(mouseY - player.y, mouseX - player.x);
            }
        } else {
            var moveDirX = 0, moveDirY = 0;
            if (keys.w || mobileMoveY < -0.2) moveDirY--;
            if (keys.s || mobileMoveY > 0.2) moveDirY++;
            if (keys.a || mobileMoveX < -0.2) moveDirX--;
            if (keys.d || mobileMoveX > 0.2) moveDirX++;
            var hasMoveDir = moveDirX !== 0 || moveDirY !== 0;
            var moveAngle = hasMoveDir ? Math.atan2(moveDirY, moveDirX) : player.angle;

            var bestEnemy = null;
            var bestScore = Infinity;
            var AIM_CONE = Math.PI * 0.36; // ~65度锥形
            for (var ei = 0; ei < enemies.length; ei++) {
                var ee = enemies[ei];
                if (ee.behavior === 'bossBullet') continue;
                var edx = ee.x - player.x, edy = ee.y - player.y;
                var ed = Math.sqrt(edx * edx + edy * edy);
                if (ed > 280) continue;
                var eAngle = Math.atan2(edy, edx);
                var diff = Math.abs(eAngle - moveAngle);
                if (diff > Math.PI) diff = Math.PI * 2 - diff;
                if (diff < AIM_CONE && ed < bestScore) { bestScore = ed; bestEnemy = ee; }
            }
            if (boss && bossActive) {
                var bdx = boss.x - player.x, bdy = boss.y - player.y;
                var bd = Math.sqrt(bdx * bdx + bdy * bdy);
                var bAngle = Math.atan2(bdy, bdx);
                var bDiff = Math.abs(bAngle - moveAngle);
                if (bDiff > Math.PI) bDiff = Math.PI * 2 - bDiff;
                if (bd < 350 && bDiff < AIM_CONE && bd < bestScore) { bestEnemy = boss; }
            }
            if (bestEnemy) {
                player.angle = Math.atan2(bestEnemy.y - player.y, bestEnemy.x - player.x);
            } else if (hasMoveDir) {
                player.angle = moveAngle;
            }
        }
    } else {
        if (gameMode === 'coop') {
            player.angle = Math.atan2(mouseY - player.y, mouseX - player.x);
        } else {
            var aimX = 0, aimY = 0;
            if (keys.ArrowUp) aimY--;
            if (keys.ArrowDown) aimY++;
            if (keys.ArrowLeft) aimX--;
            if (keys.ArrowRight) aimX++;
            if (aimX !== 0 || aimY !== 0) {
                player.angle = Math.atan2(aimY, aimX);
            }
        }
    }

    // 射击
    var canFireMouse = gameMode === 'solo' || gameMode === 'network';
    if (!isP2) {
        if ((canFireMouse && (mouseDown || mobileFire)) || (!canFireMouse && keys.f)) {
            if (player.fireCooldown <= 0) {
                if (!(gameMode === 'network' && typeof networkRole !== 'undefined' && networkRole === 'guest')) {
                    spawnBullets(player);
                }
                player.fireCooldown = player.fireRate;
            }
        }
    } else {
        if (gameMode === 'coop') {
            if (mouseDown && player.fireCooldown <= 0) {
                spawnBullets(player);
                player.fireCooldown = player.fireRate;
            }
        } else {
            if (keys.ControlRight && player.fireCooldown <= 0) {
                spawnBullets(player);
                player.fireCooldown = player.fireRate;
            }
        }
    }
    if (player.fireCooldown > 0) player.fireCooldown--;

    // P1 空格冲刺, P2 Shift 冲刺
    if (!isP2 && keys.space && !mobileDash) {
        tryDash(player);
        keys.space = false;
    }
    if (isP2 && keys.ShiftRight) {
        tryDash(player);
        keys.ShiftRight = false;
    }
}

// ---------- 冲刺 ----------
function tryDash(player) {
    if (!player || !player.alive || player.hp <= 0 ||
        player.dashCooldown > 0 || player.dashTimer > 0) return;

    let mx = 0, my = 0;
    const isP2 = player.playerIndex === 1;

    if (!isP2) {
        if (keys.w || mobileMoveY < 0) my--;
        if (keys.s || mobileMoveY > 0) my++;
        if (keys.a || mobileMoveX < 0) mx--;
        if (keys.d || mobileMoveX > 0) mx++;
    } else {
        if (keys.ArrowUp) my--;
        if (keys.ArrowDown) my++;
        if (keys.ArrowLeft) mx--;
        if (keys.ArrowRight) mx++;
    }

    if (mx === 0 && my === 0) {
        const a = Math.atan2(mouseY - player.y, mouseX - player.x);
        mx = Math.cos(a);
        my = Math.sin(a);
    } else {
        const l = Math.sqrt(mx * mx + my * my);
        mx /= l;
        my /= l;
    }

    player.dashVx = mx * player.dashSpeed;
    player.dashVy = my * player.dashSpeed;
    player.dashTimer = player.dashDuration;
    player.invincible = true;
    player.dashCooldown = player.dashCooldownMax;
    playSound('dash');
}

function updateDash(player) {
    if (!player || !player.alive) return;
    if (player.dashCooldown > 0) player.dashCooldown--;
    if (player.dashTimer > 0) {
        player.x += player.dashVx;
        player.y += player.dashVy;
        clampPlayerToCanvas(player);
        player.dashTimer--;
        if (player.dashTimer <= 0) player.invincible = false;

        // 冲刺拖尾
        particles.push({
            x: player.x + (Math.random() - 0.5) * 10,
            y: player.y + (Math.random() - 0.5) * 10,
            vx: -player.dashVx * 0.3,
            vy: -player.dashVy * 0.3,
            life: 0.3,
            decay: 0.05,
            radius: 2 + Math.random() * 3,
            color: '#0ff',
        });
    }
    if (player.shieldActive) {
        player.shieldTimer--;
        if (player.shieldTimer <= 0) {
            player.shieldActive = false;
            playSound('shieldBreak');
        }
    }
}

// ---------- 护盾特效 ----------
function spawnShieldEffect(player) {
    spawnShieldParticles(player.x, player.y);
}

// ---------- 僚机系统 (多架) ----------
var drones = [];

function updateDrones(player) {
    if (!player || !player.alive || player.droneCount <= 0) {
        drones = [];
        return;
    }
    while (drones.length < player.droneCount) {
        drones.push({ angle: Math.random() * Math.PI * 2, timer: 0 });
    }
    while (drones.length > player.droneCount) {
        drones.pop();
    }
    for (var di = 0; di < drones.length; di++) {
        var dr = drones[di];
        dr.angle += 0.03 + di * 0.004;
        dr.timer++;
        var ox = player.x + Math.cos(dr.angle) * (40 + di * 10);
        var oy = player.y + Math.sin(dr.angle) * (40 + di * 10);
        if (dr.timer > 10) {
            dr.timer = 0;
            var closest = null, minDist = 280;
            for (var ei = 0; ei < enemies.length; ei++) {
                var ee = enemies[ei];
                if (ee.behavior === 'bossBullet') continue;
                var edx = ox - ee.x, edy = oy - ee.y;
                var ed = Math.sqrt(edx * edx + edy * edy);
                if (ed < minDist) { minDist = ed; closest = ee; }
            }
            if (closest) {
                var a = Math.atan2(closest.y - oy, closest.x - ox);
                bullets.push({
                    x: ox, y: oy,
                    vx: Math.cos(a) * 9,
                    vy: Math.sin(a) * 9,
                    radius: 3, damage: 1, color: '#0fa',
                    trail: [],
                });
                playSound('shootAlt');
            }
        }
    }
}

function drawDrones() {
    if (drones.length === 0) return;
    for (var di = 0; di < drones.length; di++) {
        var dr = drones[di];
        if (!p1 || !p1.alive) return;
        var ox = p1.x + Math.cos(dr.angle) * (40 + di * 10);
        var oy = p1.y + Math.sin(dr.angle) * (40 + di * 10);
        ctx.fillStyle = '#0fa';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#0fa';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(ox, oy, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ox, oy, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ---------- 冲击波 ----------
function triggerShockwave(player) {
    if (!player || !player.alive) return;
    for (let i = 0; i < 24; i++) {
        const a = i / 24 * Math.PI * 2;
        particles.push({
            x: player.x, y: player.y,
            vx: Math.cos(a) * 7,
            vy: Math.sin(a) * 7,
            life: 0.8, decay: 0.03,
            radius: 3, color: '#fff',
        });
    }
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (e.behavior === 'bossBullet') continue;
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        if (Math.sqrt(dx * dx + dy * dy) < 130) {
            e.hp -= 2;
            if (e.hp <= 0) {
                spawnExplosion(e.x, e.y, 15);
                spawnExpOrb(e.x, e.y);
                score += e.scoreValue;
                enemies.splice(i, 1);
            }
        }
    }
    playSound('explosion');
}

// ---------- 玩家伤害处理 ----------
function damagePlayer(player, amount) {
    if (!player || !player.alive) return;
    if (player.invincible) return;

    if (player.shieldActive) {
        spawnShieldEffect(player);
        return;
    }

    player.hp -= amount;
    player.hurtTimer = 15;
    triggerShake(amount > 1 ? 10 : 5, amount > 1 ? 15 : 8);
    playSound('hit');

    if (player.shockwaveOnHit) {
        triggerShockwave(player);
    }

    if (player.hp <= 0) {
        player.hp = 0;
        player.alive = false;
        spawnExplosion(player.x, player.y, 30, ['#0ff', '#0af', '#fff', '#08f']);
    }
}

function clampPlayerToCanvas(player) {
    if (!player) return;
    if (player.x < player.radius) player.x = player.radius;
    if (player.x > canvas.width - player.radius) player.x = canvas.width - player.radius;
    if (player.y < player.radius) player.y = player.radius;
    if (player.y > canvas.height - player.radius) player.y = canvas.height - player.radius;
}

function isAllPlayersDead() {
    return players.every(p => !p.alive || p.hp <= 0);
}
