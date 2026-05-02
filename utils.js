// ====================================
// utils.js - 星空背景 / 星云 / 流星 / 粒子 / 震动 / 经验球
// ====================================

var canvas = document.getElementById('gameCanvas');
var ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ---------- 多层星空 ----------
const STAR_LAYERS = [
    { count: 80,  minR: 0.3, maxR: 1.0, minSpd: 0.1, maxSpd: 0.3, colors: ['#aaccff','#ccddff','#ffffff'], twinkle: 0.3 },
    { count: 60,  minR: 0.6, maxR: 1.8, minSpd: 0.3, maxSpd: 0.6, colors: ['#ffffff','#ffffcc','#ffeedd'], twinkle: 0.5 },
    { count: 40,  minR: 0.4, maxR: 1.2, minSpd: 0.5, maxSpd: 1.0, colors: ['#ffccaa','#ffddaa','#88ccff'], twinkle: 0.6 },
];

var stars = [];

function initStars() {
    stars.length = 0;
    for (const layer of STAR_LAYERS) {
        for (let i = 0; i < layer.count; i++) {
            stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                radius: layer.minR + Math.random() * (layer.maxR - layer.minR),
                speed: layer.minSpd + Math.random() * (layer.maxSpd - layer.minSpd),
                color: layer.colors[Math.floor(Math.random() * layer.colors.length)],
                twinkleSpeed: layer.twinkle * (0.5 + Math.random()),
                twinklePhase: Math.random() * Math.PI * 2,
                layer: layer,
            });
        }
    }
}
initStars();

function updateStars() {
    for (const s of stars) {
        s.y += s.speed;
        s.twinklePhase += s.twinkleSpeed * 0.02;
        if (s.y > canvas.height + 5) {
            s.y = -5;
            s.x = Math.random() * canvas.width;
        }
    }
}

function drawStars() {
    for (const s of stars) {
        const alpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(s.twinklePhase));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();

        if (s.radius > 1.2 && Math.sin(s.twinklePhase) > 0.7) {
            ctx.globalAlpha = alpha * 0.4;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.radius * 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1;
}

// ---------- 星云背景 ----------
var nebulae = [];
var NEBULA_COUNT = 4;

function initNebulae() {
    nebulae.length = 0;
    const colors = [
        { inner: 'rgba(80,40,120,0.04)', outer: 'rgba(80,40,120,0)' },
        { inner: 'rgba(20,60,120,0.05)', outer: 'rgba(20,60,120,0)' },
        { inner: 'rgba(100,30,80,0.03)', outer: 'rgba(100,30,80,0)' },
        { inner: 'rgba(30,80,100,0.04)', outer: 'rgba(30,80,100,0)' },
    ];
    for (let i = 0; i < NEBULA_COUNT; i++) {
        const c = colors[i];
        nebulae.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: 150 + Math.random() * 300,
            innerColor: c.inner,
            outerColor: c.outer,
            speed: 0.05 + Math.random() * 0.15,
            angle: Math.random() * Math.PI * 2,
            wobble: Math.random() * Math.PI * 2,
        });
    }
}
initNebulae();

function updateNebulae() {
    for (const n of nebulae) {
        n.wobble += 0.002;
        n.y += n.speed;
        n.x += Math.sin(n.wobble) * 0.3;
        if (n.y > canvas.height + n.radius) {
            n.y = -n.radius;
            n.x = Math.random() * canvas.width;
        }
    }
}

function drawNebulae() {
    for (const n of nebulae) {
        const gradient = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius);
        gradient.addColorStop(0, n.innerColor);
        gradient.addColorStop(1, n.outerColor);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ---------- 流星 ----------
var shootingStars = [];
var MAX_SHOOTING_STARS = 2;

function trySpawnShootingStar() {
    if (shootingStars.length >= MAX_SHOOTING_STARS) return;
    if (Math.random() > 0.003) return;

    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height * 0.3;
    const angle = Math.PI / 4 + Math.random() * Math.PI / 4;
    const speed = 6 + Math.random() * 10;
    shootingStars.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.01 + Math.random() * 0.02,
        length: 40 + Math.random() * 60,
        radius: 0.8 + Math.random() * 1.5,
    });
}

function updateShootingStars() {
    trySpawnShootingStar();
    for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i];
        s.x += s.vx;
        s.y += s.vy;
        s.life -= s.decay;
        if (s.life <= 0) shootingStars.splice(i, 1);
    }
}

function drawShootingStars() {
    for (const s of shootingStars) {
        const tailX = s.x - s.vx * s.length * 0.06;
        const tailY = s.y - s.vy * s.length * 0.06;
        const gradient = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
        gradient.addColorStop(0, `rgba(255,255,255,${s.life})`);
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = gradient;
        ctx.lineWidth = s.radius * s.life;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        ctx.fillStyle = `rgba(255,255,255,${s.life})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ---------- 粒子系统 ----------
var particles = [];

function spawnExplosion(x, y, count = 25, colors = ['#f80', '#fc0', '#ff4']) {
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 2 + Math.random() * 5;
        particles.push({
            x, y,
            vx: Math.cos(a) * s,
            vy: Math.sin(a) * s,
            life: 1,
            decay: 0.02 + Math.random() * 0.04,
            radius: 1.5 + Math.random() * 2.5,
            color: colors[Math.floor(Math.random() * colors.length)],
        });
    }
}

function spawnShieldParticles(x, y) {
    for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 2 + Math.random() * 3;
        particles.push({
            x, y,
            vx: Math.cos(a) * s,
            vy: Math.sin(a) * s,
            life: 0.6,
            decay: 0.04,
            radius: 2 + Math.random() * 2,
            color: '#0ff',
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
}

// ---------- 震动系统 ----------
var shakeDuration = 0;
var shakeIntensity = 0;

function triggerShake(duration, intensity) {
    shakeDuration = Math.max(shakeDuration, duration);
    shakeIntensity = Math.max(shakeIntensity, intensity);
}

function applyShake() {
    if (shakeDuration > 0) {
        ctx.save();
        ctx.translate(
            (Math.random() - 0.5) * shakeIntensity * 2,
            (Math.random() - 0.5) * shakeIntensity * 2
        );
        shakeDuration--;
        shakeIntensity *= 0.9;
    }
}

function clearShake() {
    if (shakeDuration > 0 || shakeIntensity > 0.1) ctx.restore();
}

// ---------- 经验球 ----------
var expOrbs = [];

function spawnExpOrb(x, y) {
    expOrbs.push({
        x, y,
        radius: 5,
        glow: 0,
        glowDir: 1,
    });
}

function updateExpOrbs(player) {
    if (!player || player.hp <= 0) return;
    for (let i = expOrbs.length - 1; i >= 0; i--) {
        const o = expOrbs[i];
        o.glow += 0.05 * o.glowDir;
        if (o.glow > 1) o.glowDir = -1;
        if (o.glow < 0) o.glowDir = 1;

        const dx = player.x - o.x;
        const dy = player.y - o.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const attractDist = 80 + o.radius;

        if (dist < attractDist) {
            const force = (attractDist - dist) / attractDist;
            o.x += (dx / dist) * force * 3;
            o.y += (dy / dist) * force * 3;
        }
        if (dist < 20 + o.radius) {
            var ds = window.getDifficultySettings ? getDifficultySettings() : { expMul: 1 };
            player.exp += ds.expMul || 1;
            expOrbs.splice(i, 1);
            playSound('pickup');
        }
    }
}

function drawExpOrbs() {
    ctx.fillStyle = '#0f8';
    ctx.shadowColor = '#0f8';
    ctx.shadowBlur = 12;
    for (const o of expOrbs) {
        ctx.globalAlpha = 0.7 + o.glow * 0.3;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.radius + o.glow, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f8';
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
}

// ---------- 窗口大小调整 ----------
window.addEventListener('resize', () => {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    initStars();
    initNebulae();
});
