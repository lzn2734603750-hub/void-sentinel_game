// ====================================
// enemies.js - 敌人类型 / Boss / 生成逻辑
// ====================================

var enemies = [];
var enemyBaseSpeed = 2.5;
var enemySpawnDelay = 40;
var enemySpawnTimer = 0;

function resetEnemyParams() {
    enemyBaseSpeed = 2.5;
    enemySpawnDelay = 40;
}

const enemyTypes = [
    {
        name: 'chaser', radius: 16, color: '#f33', stroke: '#f66',
        glowColor: '#f00', hp: 1, spd: 1, score: 10, beh: 'chase',
    },
    {
        name: 'sprinter', radius: 10, color: '#fa0', stroke: '#fc4',
        glowColor: '#f80', hp: 1, spd: 2.5, score: 20, beh: 'sprint',
    },
    {
        name: 'tank', radius: 28, color: '#c4c', stroke: '#e7e',
        glowColor: '#c0f', hp: 3, spd: 0.6, score: 30, beh: 'chase',
    },
    {
        name: 'boomer', radius: 14, color: '#f40', stroke: '#f80',
        glowColor: '#f44', hp: 1, spd: 1.3, score: 15, beh: 'explode',
        range: 90, dmg: 2,
    },
    {
        name: 'swarmer', radius: 8, color: '#f8f', stroke: '#faf',
        glowColor: '#f0f', hp: 1, spd: 1.8, score: 8, beh: 'swarm',
    },
    {
        name: 'shielder', radius: 20, color: '#39f', stroke: '#6bf',
        glowColor: '#09f', hp: 2, spd: 0.9, score: 25, beh: 'shield',
        shieldHp: 1,
    },
    {
        name: 'golden', radius: 14, color: '#fd0', stroke: '#ff0',
        glowColor: '#fd0', hp: 2, spd: 1.5, score: 100, beh: 'golden',
    },
];

function getRandomEnemyType() {
    if (Math.random() < 0.02) return enemyTypes[6]; // 2% 金色敌人

    const weights =
        wave <= 2 ? [60, 10, 10, 10, 5, 5] :
        wave <= 5 ? [35, 20, 18, 12, 8, 7] :
        [22, 20, 20, 14, 12, 12];

    const rand = Math.random() * 100;
    let cum = 0;
    for (let i = 0; i < weights.length; i++) {
        cum += weights[i];
        if (rand <= cum) return enemyTypes[i];
    }
    return enemyTypes[0];
}

function spawnEnemy() {
    if (bossActive) return;
    const side = Math.floor(Math.random() * 4);
    let x, y;
    const pad = 30;
    switch (side) {
        case 0: x = Math.random() * canvas.width; y = -pad; break;
        case 1: x = canvas.width + pad; y = Math.random() * canvas.height; break;
        case 2: x = Math.random() * canvas.width; y = canvas.height + pad; break;
        case 3: x = -pad; y = Math.random() * canvas.height; break;
    }
    const t = getRandomEnemyType();
    var waveHpBonus = Math.floor(wave / 3);
    var waveSpdBonus = wave * 0.10;
    enemies.push({
        x, y,
        radius: t.radius,
        speed: enemyBaseSpeed * t.spd + Math.random() * 0.5 + waveSpdBonus,
        hp: t.hp + waveHpBonus,
        maxHp: t.hp + waveHpBonus,
        color: t.color,
        strokeColor: t.stroke,
        glowColor: t.glowColor,
        scoreValue: t.score,
        behavior: t.beh,
        explodeRange: t.range || 0,
        explodeDamage: t.dmg || 0,
        targetX: (function(){for(var _i=0;_i<players.length;_i++){var _p=players[_i];if(_p&&_p.alive&&_p.hp>0)return _p.x;}return canvas.width/2;})(),
        targetY: (function(){for(var _i=0;_i<players.length;_i++){var _p=players[_i];if(_p&&_p.alive&&_p.hp>0)return _p.y;}return canvas.height/2;})(),
        updateTargetTimer: 0,
        vx: 0,
        vy: 0,
        shieldHp: t.shieldHp || 0,
        wobble: Math.random() * Math.PI * 2,
    });
}

// 联机客机端：运行完整敌人AI移动但跳过碰撞检测（主机权威检测碰撞）
function updateEnemiesGuestVisual() {
    for (let i = enemies.length - 1; i >= 0; i--) {
        var e = enemies[i];

        // Boss子弹：只移动不出界删除，不做碰撞
        if (e.behavior === 'bossBullet') {
            e.x += e.vx;
            e.y += e.vy;
            if (e.x < -20 || e.x > canvas.width + 20 ||
                e.y < -20 || e.y > canvas.height + 20) {
                enemies.splice(i, 1);
            }
            continue;
        }

        var anyAlive = false;
        for (var pi2 = 0; pi2 < players.length; pi2++) {
            if (players[pi2] && players[pi2].alive && players[pi2].hp > 0) {
                anyAlive = true;
                break;
            }
        }
        if (!anyAlive) continue;

        e.wobble += 0.05;

        // 找最近存活玩家用于AI寻路
        var targetPlayer = null;
        var targetDist = Infinity;
        for (var pi = 0; pi < players.length; pi++) {
            var pp = players[pi];
            if (!pp || !pp.alive || pp.hp <= 0) continue;
            var pdx = pp.x - e.x, pdy = pp.y - e.y;
            var pd = pdx * pdx + pdy * pdy;
            if (pd < targetDist) { targetDist = pd; targetPlayer = pp; }
        }
        if (!targetPlayer) continue;

        var dx = targetPlayer.x - e.x;
        var dy = targetPlayer.y - e.y;
        var dist = Math.sqrt(dx * dx + dy * dy);

        // 运行移动AI（与 updateEnemies 一致但跳过碰撞和爆炸检测）
        switch (e.behavior) {
            case 'chase':
            case 'shield':
                if (dist > 0) { e.x += (dx / dist) * e.speed; e.y += (dy / dist) * e.speed; }
                break;
            case 'explode':
                if (dist > 0 && dist < 300) {
                    var spd = dist < 150 ? e.speed * 1.6 : e.speed;
                    e.x += (dx / dist) * spd;
                    e.y += (dy / dist) * spd;
                } else if (dist > 0) {
                    e.x += (dx / dist) * e.speed * 0.6;
                    e.y += (dy / dist) * e.speed * 0.6;
                }
                break;
            case 'sprint':
                if (!e.updateTargetTimer || e.updateTargetTimer <= 0) {
                    e.targetX = targetPlayer.x;
                    e.targetY = targetPlayer.y;
                    e.updateTargetTimer = 25;
                }
                e.updateTargetTimer--;
                var tdx = e.targetX - e.x, tdy = e.targetY - e.y;
                var tdist = Math.sqrt(tdx * tdx + tdy * tdy);
                if (tdist > 0) {
                    var spd2 = e.speed * 1.4;
                    e.x += (tdx / tdist) * spd2;
                    e.y += (tdy / tdist) * spd2;
                }
                break;
            case 'swarm':
                if (!e.updateTargetTimer || e.updateTargetTimer <= 0) {
                    var orbitAngle = Math.random() * Math.PI * 2;
                    var orbitDist = 60 + Math.random() * 100;
                    e.targetX = targetPlayer.x + Math.cos(orbitAngle) * orbitDist;
                    e.targetY = targetPlayer.y + Math.sin(orbitAngle) * orbitDist;
                    e.updateTargetTimer = 40;
                }
                e.updateTargetTimer--;
                var sdx = e.targetX - e.x, sdy = e.targetY - e.y;
                var sdist = Math.sqrt(sdx * sdx + sdy * sdy);
                if (sdist > 1) {
                    e.x += (sdx / sdist) * e.speed;
                    e.y += (sdy / sdist) * e.speed;
                }
                break;
            case 'golden':
                if (dist > 0) {
                    var gspd = e.speed * 1.2 + Math.sin(Date.now() * 0.003) * 0.5;
                    e.x += (dx / dist) * gspd;
                    e.y += (dy / dist) * gspd;
                }
                break;
        }
    }
}

function updateEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];

        // Boss子弹
        if (e.behavior === 'bossBullet') {
            e.x += e.vx;
            e.y += e.vy;
            if (e.x < -20 || e.x > canvas.width + 20 ||
                e.y < -20 || e.y > canvas.height + 20) {
                enemies.splice(i, 1);
                continue;
            }
            for (const player of players) {
                if (!player || !player.alive) continue;
                const dx = player.x - e.x;
                const dy = player.y - e.y;
                if (Math.sqrt(dx * dx + dy * dy) < player.radius + e.radius) {
                    damagePlayer(player, 1);
                    enemies.splice(i, 1);
                    break;
                }
            }
            continue;
        }

        var anyPlayerAlive = false;
        for (var pi2 = 0; pi2 < players.length; pi2++) {
            if (players[pi2] && players[pi2].alive && players[pi2].hp > 0) {
                anyPlayerAlive = true;
                break;
            }
        }
        if (!anyPlayerAlive) continue;

        e.wobble += 0.05;

        // 找到最近的存活玩家
        var targetPlayer = null;
        var targetDist = Infinity;
        for (var pi = 0; pi < players.length; pi++) {
            var pp = players[pi];
            if (!pp || !pp.alive || pp.hp <= 0) continue;
            var pdx = pp.x - e.x;
            var pdy = pp.y - e.y;
            var pd = pdx * pdx + pdy * pdy;
            if (pd < targetDist) { targetDist = pd; targetPlayer = pp; }
        }
        if (!targetPlayer) continue;

        var dx = targetPlayer.x - e.x;
        var dy = targetPlayer.y - e.y;
        var dist = Math.sqrt(dx * dx + dy * dy);

        switch (e.behavior) {
            case 'chase':
            case 'shield':
                if (dist > 0) {
                    e.x += (dx / dist) * e.speed;
                    e.y += (dy / dist) * e.speed;
                }
                break;
            case 'explode':
                if (dist > 0 && dist < 300) {
                    var spd = dist < 150 ? e.speed * 1.6 : e.speed;
                    e.x += (dx / dist) * spd;
                    e.y += (dy / dist) * spd;
                } else if (dist > 0) {
                    e.x += (dx / dist) * e.speed * 0.6;
                    e.y += (dy / dist) * e.speed * 0.6;
                }
                break;
            case 'sprint': {
                if (!e.updateTargetTimer || e.updateTargetTimer <= 0) {
                    e.targetX = targetPlayer.x;
                    e.targetY = targetPlayer.y;
                    e.updateTargetTimer = 25;
                }
                e.updateTargetTimer--;
                var tdx = e.targetX - e.x;
                var tdy = e.targetY - e.y;
                var tdist = Math.sqrt(tdx * tdx + tdy * tdy);
                if (tdist > 0) {
                    var spd2 = e.speed * 1.4;
                    e.x += (tdx / tdist) * spd2;
                    e.y += (tdy / tdist) * spd2;
                }
                break;
            }
            case 'swarm': {
                if (!e.updateTargetTimer || e.updateTargetTimer <= 0) {
                    var orbitAngle = Math.random() * Math.PI * 2;
                    var orbitDist = 60 + Math.random() * 100;
                    e.targetX = targetPlayer.x + Math.cos(orbitAngle) * orbitDist;
                    e.targetY = targetPlayer.y + Math.sin(orbitAngle) * orbitDist;
                    e.updateTargetTimer = 40;
                }
                e.updateTargetTimer--;
                var sdx = e.targetX - e.x;
                var sdy = e.targetY - e.y;
                var sdist = Math.sqrt(sdx * sdx + sdy * sdy);
                if (sdist > 1) {
                    e.x += (sdx / sdist) * e.speed;
                    e.y += (sdy / sdist) * e.speed;
                }
                break;
            }
            case 'golden': {
                if (dist > 0) {
                    var gspd = e.speed * 1.2 + Math.sin(Date.now() * 0.003) * 0.5;
                    e.x += (dx / dist) * gspd;
                    e.y += (dy / dist) * gspd;
                }
                break;
            }
        }

        // 爆炸型敌人近距离引爆
        if (e.behavior === 'explode') {
            for (const player of players) {
                if (!player || !player.alive || player.invincible) continue;
                const cdx = player.x - e.x;
                const cdy = player.y - e.y;
                const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
                if (cdist < e.explodeRange + player.radius) {
                    damagePlayer(player, e.explodeDamage);
                    spawnExplosion(e.x, e.y, 35);
                    enemies.splice(i, 1);
                    break;
                }
            }
            continue;
        }

        // 碰撞伤害检查
        for (const player of players) {
            if (!player || !player.alive || player.invincible) continue;
            const cdx = player.x - e.x;
            const cdy = player.y - e.y;
            const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
            if (cdist < player.radius + e.radius) {
                if (e.shieldHp > 0) {
                    e.shieldHp--;
                    spawnShieldParticles(e.x, e.y);
                } else {
                    damagePlayer(player, 1);
                }
                enemies.splice(i, 1);
                if (player.hp <= 0) player.hp = 0;
                break;
            }
        }
    }
}

function drawEnemies() {
    for (const e of enemies) {
        if (e.behavior === 'bossBullet') {
            ctx.fillStyle = '#f0f';
            ctx.shadowColor = '#f0f';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.radius * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            continue;
        }

        // 外发光
        ctx.shadowColor = e.glowColor;
        ctx.shadowBlur = 8;

        // 根据类型不同形状
        switch (e.behavior) {
            case 'sprinter':
                drawEnemyTriangle(e);
                break;
            case 'tank':
                drawEnemyHexagon(e);
                break;
            case 'swarmer':
                drawEnemyStar(e);
                break;
            case 'shield':
                drawEnemyShield(e);
                break;
            case 'golden':
                drawEnemyGolden(e);
                break;
            default:
                drawEnemyCircle(e);
        }

        ctx.shadowBlur = 0;

        // 血条（多血敌人）
        if (e.maxHp > 1) {
            const bw = e.radius * 2;
            const bh = 4;
            const by = e.y - e.radius - 8;
            ctx.fillStyle = '#333';
            ctx.fillRect(e.x - bw / 2, by, bw, bh);
            ctx.fillStyle = '#f00';
            ctx.fillRect(e.x - bw / 2, by, bw * (e.hp / e.maxHp), bh);
        }

        // 护盾条
        if (e.shieldHp > 0) {
            const bw = e.radius * 2;
            const bh = 3;
            const by = e.y - e.radius - 14;
            ctx.fillStyle = '#333';
            ctx.fillRect(e.x - bw / 2, by, bw, bh);
            ctx.fillStyle = '#09f';
            ctx.fillRect(e.x - bw / 2, by, bw, bh);
        }
    }
}

function drawEnemyCircle(e) {
    ctx.fillStyle = e.color;
    ctx.strokeStyle = e.strokeColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
}

function drawEnemyTriangle(e) {
    const r = e.radius;
    ctx.fillStyle = e.color;
    ctx.strokeStyle = e.strokeColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const dir = e.speed > 1.5 ? Math.atan2(e.vy || 0, e.vx || 0) : Math.PI / 2;
    for (let i = 0; i < 3; i++) {
        const a = i * (Math.PI * 2 / 3) + dir;
        const px = e.x + Math.cos(a) * r;
        const py = e.y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
}

function drawEnemyHexagon(e) {
    ctx.fillStyle = e.color;
    ctx.strokeStyle = e.strokeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2 + e.wobble * 0.1;
        const px = e.x + Math.cos(a) * e.radius;
        const py = e.y + Math.sin(a) * e.radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
}

function drawEnemyStar(e) {
    ctx.fillStyle = e.color;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const a = i * (Math.PI * 2 / 5) - Math.PI / 2 + e.wobble * 0.2;
        const px = e.x + Math.cos(a) * e.radius;
        const py = e.y + Math.sin(a) * e.radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

function drawEnemyShield(e) {
    ctx.fillStyle = e.color;
    ctx.strokeStyle = e.strokeColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (e.shieldHp > 0) {
        ctx.strokeStyle = '#0ff';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.01) * 0.3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius * 0.25, 0, Math.PI * 2);
    ctx.fill();
}

function drawEnemyGolden(e) {
    var glowPulse = 0.7 + Math.sin(Date.now() * 0.006) * 0.3;
    ctx.shadowColor = '#fd0';
    ctx.shadowBlur = 18 * glowPulse;

    var grad = ctx.createRadialGradient(e.x, e.y, e.radius * 0.3, e.x, e.y, e.radius);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(0.3, '#ffd700');
    grad.addColorStop(0.7, '#f80');
    grad.addColorStop(1, '#840');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#ff0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var i = 0; i < 8; i++) {
        var a = i / 8 * Math.PI * 2 + Date.now() * 0.001;
        var r = i % 2 === 0 ? e.radius : e.radius * 0.6;
        var px = e.x + Math.cos(a) * r;
        var py = e.y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius * 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fd0';
    ctx.shadowBlur = 6;
    ctx.fillText('?', e.x, e.y + e.radius + 14);
}

// ====================================
// Boss 系统
// ====================================
var boss = null;
var bossActive = false;

function spawnBoss(hpMul) {
    bossActive = true;
    enemies.length = 0;
    var baseHp = 25 + wave * 6;
    boss = {
        x: canvas.width / 2,
        y: canvas.height / 2 - 100,
        radius: 55,
        hp: Math.round(baseHp * (hpMul || 1)),
        maxHp: Math.round(baseHp * (hpMul || 1)),
        color: '#f0f',
        strokeColor: '#fff',
        attackTimer: 0,
        attackType: 0,
        vx: 0,
        vy: 0,
        phase: 0,
    };
    playSound('bossAppear');
}

function updateBoss() {
    if (!boss) return;

    var targetPlayer = null;
    var targetDist = Infinity;
    for (var pi = 0; pi < players.length; pi++) {
        var pp = players[pi];
        if (!pp || !pp.alive || pp.hp <= 0) continue;
        var pdx = pp.x - boss.x;
        var pdy = pp.y - boss.y;
        var pd = pdx * pdx + pdy * pdy;
        if (pd < targetDist) { targetDist = pd; targetPlayer = pp; }
    }
    if (!targetPlayer) return;

    var dx = targetPlayer.x - boss.x;
    var dy = targetPlayer.y - boss.y;
    var dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
        const spd = 1.3 + wave * 0.05;
        boss.x += (dx / dist) * spd;
        boss.y += (dy / dist) * spd;
    }

    if (boss.x < boss.radius) boss.x = boss.radius;
    if (boss.x > canvas.width - boss.radius) boss.x = canvas.width - boss.radius;
    if (boss.y < boss.radius) boss.y = boss.radius;
    if (boss.y > canvas.height - boss.radius) boss.y = canvas.height - boss.radius;

    boss.attackTimer++;
    if (boss.attackTimer > 50) {
        boss.attackTimer = 0;
        boss.attackType = Math.floor(Math.random() * 4);
        boss.phase = (boss.phase + 1) % 3;
    }

    switch (boss.attackType) {
        case 0: // 环形弹幕
            if (boss.attackTimer % 8 === 0) {
                const bulletCount = 12 + wave;
                for (let i = 0; i < bulletCount; i++) {
                    const a = (i / bulletCount) * Math.PI * 2 + boss.attackTimer * 0.1;
                    enemies.push({
                        x: boss.x, y: boss.y,
                        radius: 7,
                        hp: 1, maxHp: 1,
                        color: '#f0f', strokeColor: '#fff',
                        scoreValue: 0,
                        behavior: 'bossBullet',
                        vx: Math.cos(a) * 4,
                        vy: Math.sin(a) * 4,
                    });
                }
            }
            break;
        case 1: // 旋转光束
            {
                const la = (Date.now() * 0.004) % (Math.PI * 2);
                const beamCount = 6;
                for (let i = 0; i < beamCount; i++) {
                    const a = la + i * (Math.PI * 2 / beamCount);
                    const lx = boss.x + Math.cos(a) * 70;
                    const ly = boss.y + Math.sin(a) * 70;
                    particles.push({
                        x: lx, y: ly,
                        vx: Math.cos(a) * 0.3,
                        vy: Math.sin(a) * 0.3,
                        life: 0.4, decay: 0.04,
                        radius: 4, color: '#f0f',
                    });
                }
                for (const player of players) {
                    if (!player || !player.alive || player.invincible) continue;
                    for (let i = 0; i < beamCount; i++) {
                        const a = la + i * (Math.PI * 2 / beamCount);
                        const px = player.x - (boss.x + Math.cos(a) * 70);
                        const py = player.y - (boss.y + Math.sin(a) * 70);
                        if (Math.sqrt(px * px + py * py) < 22) {
                            damagePlayer(player, 1);
                            break;
                        }
                    }
                }
            }
            break;
        case 2: // 冲刺
            if (boss.attackTimer === 25) {
                var sdx = targetPlayer.x - boss.x;
                var sdy = targetPlayer.y - boss.y;
                var sdist = Math.sqrt(sdx * sdx + sdy * sdy);
                if (sdist > 0) {
                    boss.vx = (sdx / sdist) * 16;
                    boss.vy = (sdy / sdist) * 16;
                }
            }
            break;
        case 3: // 定向弹幕
            if (boss.attackTimer % 6 === 0) {
                for (const player of players) {
                    if (!player || !player.alive) continue;
                    const a = Math.atan2(player.y - boss.y, player.x - boss.x);
                    const spread = 0.35;
                    for (let j = -2; j <= 2; j++) {
                        const ba = a + j * spread;
                        enemies.push({
                            x: boss.x, y: boss.y,
                            radius: 6,
                            hp: 1, maxHp: 1,
                            color: '#faf', strokeColor: '#f0f',
                            scoreValue: 0,
                            behavior: 'bossBullet',
                            vx: Math.cos(ba) * 5,
                            vy: Math.sin(ba) * 5,
                        });
                    }
                }
            }
            break;
    }

    // 冲刺衰减
    if (boss.vx || boss.vy) {
        boss.x += boss.vx;
        boss.y += boss.vy;
        boss.vx *= 0.94;
        boss.vy *= 0.94;
        if (Math.abs(boss.vx) < 0.1) boss.vx = 0;
        if (Math.abs(boss.vy) < 0.1) boss.vy = 0;
    }

    // Boss 碰撞伤害
    for (const player of players) {
        if (!player || !player.alive || player.invincible) continue;
        const cdx = player.x - boss.x;
        const cdy = player.y - boss.y;
        const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
        if (cdist < player.radius + boss.radius) {
            damagePlayer(player, 2);
            const pa = Math.atan2(player.y - boss.y, player.x - boss.x);
            player.x += Math.cos(pa) * 40;
            player.y += Math.sin(pa) * 40;
        }
    }
}

function giveBossReward() {
    const rand = Math.random();
    if (rand < 0.3) {
        enemies.length = 0;
    } else if (rand < 0.6) {
        for (const player of players) {
            if (player && player.alive) {
                player.shieldActive = true;
                player.shieldTimer = 400;
            }
        }
    } else {
        for (const player of players) {
            if (player && player.alive) {
                player.maxHp += 1;
                player.hp = player.maxHp;
            }
        }
    }
}

function drawBoss() {
    if (!boss) return;

    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.rotate(Date.now() * 0.0015);

    // 外层光环
    ctx.shadowColor = '#f0f';
    ctx.shadowBlur = 25;
    ctx.strokeStyle = 'rgba(255,0,255,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, boss.radius + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Boss 六边形本体
    ctx.fillStyle = boss.color;
    ctx.strokeStyle = boss.strokeColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        const px = Math.cos(a) * boss.radius;
        const py = Math.sin(a) * boss.radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Boss 眼睛
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-18, -18, 10, 0, Math.PI * 2);
    ctx.arc(18, -18, 10, 0, Math.PI * 2);
    ctx.fill();

    var eyePlayer = null;
    var eyeDist = Infinity;
    for (var pi = 0; pi < players.length; pi++) {
        var ep = players[pi];
        if (!ep || !ep.alive || ep.hp <= 0) continue;
        var edx = ep.x - boss.x, edy = ep.y - boss.y;
        var ed = edx * edx + edy * edy;
        if (ed < eyeDist) { eyeDist = ed; eyePlayer = ep; }
    }
    var eyeAngle = eyePlayer ? Math.atan2(eyePlayer.y - boss.y, eyePlayer.x - boss.x) : 0;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-18 + Math.cos(eyeAngle) * 3, -18 + Math.sin(eyeAngle) * 3, 5, 0, Math.PI * 2);
    ctx.arc(18 + Math.cos(eyeAngle) * 3, -18 + Math.sin(eyeAngle) * 3, 5, 0, Math.PI * 2);
    ctx.fill();

    // Boss 嘴
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 10, 12, 0.2, Math.PI - 0.2);
    ctx.stroke();

    ctx.restore();

    // Boss 血条
    const bw = 250;
    const bh = 15;
    const bx = canvas.width / 2 - bw / 2;
    const by = 30;
    ctx.fillStyle = '#222';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#f0f';
    ctx.fillRect(bx, by, bw * (boss.hp / boss.maxHp), bh);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BOSS', canvas.width / 2, by - 6);
}
