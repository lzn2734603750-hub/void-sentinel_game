// ====================================
// bullets.js - 子弹系统 / 武器变异 / 拖尾特效
// ====================================

var bullets = [];

function spawnBullets(player) {
    if (!player || !player.alive) return;

    const baseAngle = player.angle;
    const count = player.bulletCount;
    const spread = Math.min(0.4, 0.15 + count * 0.05);
    const isCrit = player.critChance > 0 && Math.random() < player.critChance;
    const bs = player.bulletSpeed || 10;
    const bd = player.bulletDamage || 1;
    const bsz = player.bulletSize || 1;

    for (let i = 0; i < count; i++) {
        let angle;
        if (count === 1) {
            angle = baseAngle;
        } else {
            angle = baseAngle - spread / 2 + (spread / (count - 1)) * i;
        }
        bullets.push({
            x: player.x + Math.cos(angle) * (player.radius + 10),
            y: player.y + Math.sin(angle) * (player.radius + 10),
            vx: Math.cos(angle) * bs,
            vy: Math.sin(angle) * bs,
            radius: (isCrit ? 5 : 3) * bsz,
            damage: isCrit ? bd * 2 : bd,
            color: isCrit ? '#f4f' : '#ff0',
            trail: [],
            maxTrail: isCrit ? 8 : 5,
            crit: isCrit,
            type: isCrit ? 'crit' : 'normal',
        });
    }

    if (isCrit) {
        playSound('shootHeavy');
    } else {
        playSound('shoot');
    }
}

function updateBullets() {
    for (const b of bullets) {
        // 记录拖尾位置
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > b.maxTrail) b.trail.shift();

        b.x += b.vx;
        b.y += b.vy;
    }

    // 移除越界子弹
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        if (b.x < -20 || b.x > canvas.width + 20 ||
            b.y < -20 || b.y > canvas.height + 20) {
            bullets.splice(i, 1);
        }
    }
}

function drawBullets() {
    for (const b of bullets) {
        // 拖尾效果
        if (b.trail.length > 1) {
            for (let i = 1; i < b.trail.length; i++) {
                const t = b.trail[i];
                const prev = b.trail[i - 1];
                const alpha = i / b.trail.length;
                ctx.strokeStyle = b.color;
                ctx.globalAlpha = alpha * 0.5;
                ctx.lineWidth = b.radius * alpha;
                ctx.beginPath();
                ctx.moveTo(prev.x, prev.y);
                ctx.lineTo(t.x, t.y);
                ctx.stroke();
            }
        }

        ctx.globalAlpha = 1;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = b.crit ? 14 : 8;

        // 外层光晕
        const glowGrad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius * 2.5);
        glowGrad.addColorStop(0, b.color);
        glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * 2.5, 0, Math.PI * 2);
        ctx.fill();

        // 子弹本体
        ctx.fillStyle = b.crit ? '#fff' : b.color;
        ctx.beginPath();
        if (b.crit) {
            // 暴击：六角形
            drawHexagon(b.x, b.y, b.radius);
        } else if (b.radius > 4) {
            // 大子弹：钻石形
            drawDiamond(b.x, b.y, b.radius);
        } else {
            // 普通：圆形带亮点
            ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        }
        ctx.fill();

        // 核心亮点
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
}

function drawHexagon(x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2 - Math.PI / 2;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
}

function drawDiamond(x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.7, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r * 0.7, y);
    ctx.closePath();
}

// ---------- 子弹与敌人碰撞 ----------
function checkBulletEnemyCollisions() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        let hit = false;

        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (e.behavior === 'bossBullet') continue;

            const dx = b.x - e.x;
            const dy = b.y - e.y;
            if (Math.sqrt(dx * dx + dy * dy) < b.radius + e.radius) {
                e.hp -= b.damage;
                hit = true;

                if (e.hp <= 0) {
                    var particleCount = e.radius > 25 ? 40 : 20;
                    var explosionColors = ['#f80', '#fc0', '#ff4'];
                    if (e.behavior === 'golden') {
                        particleCount = 50;
                        explosionColors = ['#ffd700', '#ff0', '#fff', '#fd0'];
                    }
                    spawnExplosion(e.x, e.y, particleCount, explosionColors);
                    spawnExpOrb(e.x, e.y);
                    triggerShake(e.radius > 25 ? 6 : 3, e.radius > 25 ? 10 : 5);
                    score += e.scoreValue;
                    playSound('explosion');

                    if (e.behavior === 'golden') {
                        for (var pi = 0; pi < players.length; pi++) {
                            var pl = players[pi];
                            if (pl && pl.alive) {
                                pl.maxHp += 1;
                                pl.hp = pl.maxHp;
                            }
                        }
                        triggerShake(12, 20);
                        playSound('achievement');
                        achievementPopup = { name: '额外生命！', timer: 150 };
                    }

                    if (e.behavior === 'tank') {
                        spawnExpOrb(e.x + 15, e.y);
                        spawnExpOrb(e.x - 15, e.y);
                        spawnExpOrb(e.x, e.y + 15);
                    }
                    enemies.splice(j, 1);
                    checkAchievements();
                }
                break;
            }
        }

        // Boss 碰撞
        if (!hit && boss && bossActive) {
            const dx = b.x - boss.x;
            const dy = b.y - boss.y;
            if (Math.sqrt(dx * dx + dy * dy) < b.radius + boss.radius) {
                boss.hp -= b.damage;
                hit = true;

                if (boss.hp <= 0) {
                    spawnExplosion(boss.x, boss.y, 60, ['#f0f', '#f0f', '#fff', '#faf']);
                    score += 200;
                    for (let k = 0; k < 18; k++) {
                        spawnExpOrb(
                            boss.x + (Math.random() - 0.5) * 120,
                            boss.y + (Math.random() - 0.5) * 120
                        );
                    }
                    giveBossReward();
                    unlockAchievement('boss_slayer');
                    boss = null;
                    bossActive = false;
                    playSound('explosionBig');
                    triggerShake(18, 25);
                    checkAchievements();
                }
            }
        }

        if (hit) {
            bullets.splice(i, 1);
        }
    }
}
