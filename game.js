// ====================================
// game.js - 主入口 / 游戏循环 / 状态管理
// ====================================

var gameState = 'menu';
var gameMode = 'solo';     // 'solo' | 'coop' | 'network'
var difficulty = 'normal'; // 'easy' | 'normal' | 'hard'
var score = 0;
var wave = 1;
var waveTimer = 0;
var WAVE_DURATION = 1800;
var waveText = '';
var waveTextTimer = 0;

var DIFFICULTY_SETTINGS = {
    easy:   { enemySpeedMul: 0.5, spawnDelayAdd: 25, playerExtraHP: 3, bossHPMul: 0.4, waveMul: 1.6, expMul: 0.5 },
    normal: { enemySpeedMul: 0.75, spawnDelayAdd: 10, playerExtraHP: 1, bossHPMul: 0.7, waveMul: 1.2, expMul: 0.8 },
    hard:   { enemySpeedMul: 1.0, spawnDelayAdd: 0, playerExtraHP: 0, bossHPMul: 1.0, waveMul: 1.0, expMul: 1.0 },
    easy_m:   { enemySpeedMul: 0.4, spawnDelayAdd: 30, playerExtraHP: 4, bossHPMul: 0.35, waveMul: 1.8, expMul: 0.45 },
    normal_m: { enemySpeedMul: 0.6, spawnDelayAdd: 15, playerExtraHP: 2, bossHPMul: 0.6, waveMul: 1.4, expMul: 0.7 },
    hard_m:   { enemySpeedMul: 0.85, spawnDelayAdd: 5, playerExtraHP: 1, bossHPMul: 0.85, waveMul: 1.1, expMul: 0.9 },
};

function getDifficultySettings() {
    var key = difficulty;
    if (isMobile()) {
        key = difficulty + '_m';
    }
    return DIFFICULTY_SETTINGS[key] || DIFFICULTY_SETTINGS.normal;
}

function resetGame() {
    score = 0;
    wave = 1;
    waveTimer = 0;
    waveText = '';
    waveTextTimer = 0;
    boss = null;
    bossActive = false;
    bullets.length = 0;
    enemies.length = 0;
    particles.length = 0;
    expOrbs.length = 0;
    enemySpawnTimer = 0;
    drones = [];

    var ds = getDifficultySettings();
    resetEnemyParams();
    enemyBaseSpeed *= ds.enemySpeedMul;
    enemySpawnDelay += ds.spawnDelayAdd;

    resetPlayers(gameMode);

    document.getElementById('upgradePanel').style.display = 'none';
    document.getElementById('nameInputPanel').style.display = 'none';
    gameState = 'playing';
    if (gameMode !== 'network') startBGM();
    if (gameMode === 'network') startBGM();
}

function endGame() {
    gameState = 'gameover';
    stopBGM();
    checkAchievements();

    if (achievementPopup) {
        achievementPopup.timer = Math.max(achievementPopup.timer, 120);
    }
}

// ---------- 波次系统 ----------

function resetWave() {
    wave = 1;
    waveTimer = 0;
    waveText = '';
    waveTextTimer = 0;
}

function nextWave() {
    wave++;
    var ds = getDifficultySettings();
    enemyBaseSpeed += 0.45 * ds.enemySpeedMul;
    enemySpawnDelay = Math.max(8, enemySpawnDelay - Math.round(3 * ds.waveMul));
    waveText = '第 ' + wave + ' 波';
    waveTextTimer = 120;
    waveTimer = 0;

    if (wave % 7 === 0) {
        spawnBoss(ds.bossHPMul);
        waveText = '⚠ BOSS 来袭！';
        waveTextTimer = 180;
    }

    checkAchievements();
}

function updateWave() {
    if (gameState !== 'playing' || bossActive) return;
    waveTimer++;
    var ds = getDifficultySettings();
    if (waveTimer >= WAVE_DURATION * ds.waveMul) nextWave();
    if (waveTextTimer > 0) {
        waveTextTimer--;
        if (waveTextTimer <= 0) waveText = '';
    }
}

// ---------- 主循环 ----------

function update() {
    updateStars();
    updateNebulae();
    updateShootingStars();

    if (gameState === 'menu' || gameState === 'scoreboard' || gameState === 'network_lobby') return;

    if (gameState === 'upgrading') {
        if (gameMode === 'network' && networkState === 'playing') {
            if (networkRole === 'host') syncHostState();
        }
        return;
    }

    if (gameState === 'paused' || gameState === 'gameover' || gameState === 'nameInput') {
        updateParticles();
        return;
    }

    if (!p1 || (!p1.alive && !p2)) return;

    for (var i = 0; i < players.length; i++) {
        var player = players[i];
        if (player && player.alive && player.hp > 0) {
            if (gameMode === 'network' && player.playerIndex === 1 && networkRole === 'host') continue;
            if (gameMode === 'network' && player.playerIndex === 1 && networkRole === 'guest') continue;
            updatePlayerMovement(player, player.playerIndex === 1);
            updateDash(player);
        }
    }

    updateBullets();

    if (!bossActive) {
        enemySpawnTimer++;
        if (enemySpawnTimer >= enemySpawnDelay) {
            if (!(gameMode === 'network' && networkRole === 'guest')) {
                spawnEnemy();
            }
            enemySpawnTimer = 0;
        }
    }

    updateEnemies();
    if (!(gameMode === 'network' && networkRole === 'guest')) {
        checkBulletEnemyCollisions();
    }
    updateParticles();

    for (var i = 0; i < players.length; i++) {
        var p = players[i];
        if (p && p.alive) {
            updateExpOrbs(p);
        }
    }

    if (!(gameMode === 'network' && networkRole === 'guest')) {
        updateWave();
    }

    if (boss) updateBoss();

    for (var i = 0; i < players.length; i++) {
        var pl = players[i];
        if (pl && pl.alive && pl.droneCount > 0) {
            updateDrones(pl);
        }
    }

    if (achievementPopup) {
        achievementPopup.timer--;
        if (achievementPopup.timer <= 0) achievementPopup = null;
    }

    if (isAllPlayersDead()) {
        endGame();
        return;
    }

    if (p1 && p1.alive && p1.exp >= p1.expToNext) {
        triggerUpgrade();
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawNebulae();
    drawStars();
    drawShootingStars();

    if (gameState === 'menu') { drawMenu(); return; }
    if (gameState === 'scoreboard') { drawScoreboard(); return; }

    if (gameState === 'network_lobby') { drawNetworkLobby(); return; }

    applyShake();

    for (var i = 0; i < players.length; i++) {
        var player = players[i];
        if (player && player.alive && player.hp > 0) {
            drawPlayer(player);
        }
    }

    drawBullets();
    drawEnemies();
    if (boss) drawBoss();
    drawParticles();
    drawExpOrbs();
    drawDrones();
    drawCrosshair();

    if (p1 && p1.alive) {
        drawHealthBar(p1);
        drawExpBar(p1);
        drawDashIndicator(p1);
    }
    if (p2 && p2.alive) {
        drawHealthBar(p2);
        drawExpBar(p2);
        drawDashIndicator(p2);
    }

    drawScore();
    drawWaveDisplay();
    drawWaveText();
    drawAchievementPopup();

    if (gameState === 'gameover' || gameState === 'nameInput') {
        drawGameOver();
    }
    if (gameState === 'paused') {
        drawPauseOverlay();
    }

    clearShake();
}

// ---------- 移动端控件 ----------

function isMobile() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
}

function setupMobile() {
    if (!isMobile()) return;

    document.getElementById('mobileControls').style.display = 'block';

    var base = document.getElementById('joystickBase');
    var thumb = document.getElementById('joystickThumb');
    var baseRect = null;
    var joystickPointerId = null;

    base.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        base.setPointerCapture(e.pointerId);
        joystickPointerId = e.pointerId;
        baseRect = base.getBoundingClientRect();
        startBGM();
    });

    base.addEventListener('pointermove', function (e) {
        if (e.pointerId !== joystickPointerId) return;
        e.preventDefault();
        if (!baseRect) baseRect = base.getBoundingClientRect();
        var cx = baseRect.left + baseRect.width / 2;
        var cy = baseRect.top + baseRect.height / 2;
        var maxDist = baseRect.width / 2 - 25;
        var dx = e.clientX - cx;
        var dy = e.clientY - cy;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d > maxDist) { dx = dx / d * maxDist; dy = dy / d * maxDist; }
        thumb.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
        mobileMoveX = dx / maxDist;
        mobileMoveY = dy / maxDist;
    });

    base.addEventListener('pointerup', function (e) {
        if (e.pointerId !== joystickPointerId) return;
        e.preventDefault();
        joystickPointerId = null;
        thumb.style.transform = 'translate(-50%,-50%)';
        mobileMoveX = 0;
        mobileMoveY = 0;
    });

    base.addEventListener('pointercancel', function (e) {
        if (e.pointerId !== joystickPointerId) return;
        joystickPointerId = null;
        thumb.style.transform = 'translate(-50%,-50%)';
        mobileMoveX = 0;
        mobileMoveY = 0;
    });

    base.addEventListener('pointerleave', function (e) {
        if (e.pointerId !== joystickPointerId) return;
        joystickPointerId = null;
        thumb.style.transform = 'translate(-50%,-50%)';
        mobileMoveX = 0;
        mobileMoveY = 0;
    });

    var aimFireBase = document.getElementById('aimFireBase');
    var aimFireThumb = document.getElementById('aimFireThumb');
    var aimFireLabel = document.getElementById('aimFireLabel');
    var aimPointerId = null;
    var aimBaseRect = null;

    aimFireBase.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        aimFireBase.setPointerCapture(e.pointerId);
        aimPointerId = e.pointerId;
        aimBaseRect = aimFireBase.getBoundingClientRect();
        mobileFire = true;
        startBGM();
        updateAimFireThumb(e.clientX, e.clientY);
    });

    aimFireBase.addEventListener('pointermove', function (e) {
        if (e.pointerId !== aimPointerId) return;
        e.preventDefault();
        updateAimFireThumb(e.clientX, e.clientY);
    });

    aimFireBase.addEventListener('pointerup', function (e) {
        if (e.pointerId !== aimPointerId) return;
        e.preventDefault();
        aimPointerId = null;
        mobileFire = false;
        mobileAimActive = false;
        aimFireThumb.style.transform = 'translate(-50%,-50%)';
        aimFireLabel.style.display = '';
    });

    aimFireBase.addEventListener('pointercancel', function (e) {
        if (e.pointerId !== aimPointerId) return;
        aimPointerId = null;
        mobileFire = false;
        mobileAimActive = false;
        aimFireThumb.style.transform = 'translate(-50%,-50%)';
        aimFireLabel.style.display = '';
    });

    aimFireBase.addEventListener('pointerleave', function (e) {
        if (e.pointerId !== aimPointerId) return;
        aimPointerId = null;
        mobileFire = false;
        mobileAimActive = false;
        aimFireThumb.style.transform = 'translate(-50%,-50%)';
        aimFireLabel.style.display = '';
    });

    function updateAimFireThumb(clientX, clientY) {
        if (!aimBaseRect) return;
        var cx = aimBaseRect.left + aimBaseRect.width / 2;
        var cy = aimBaseRect.top + aimBaseRect.height / 2;
        var maxR = aimBaseRect.width / 2 - 22;
        var dx = clientX - cx;
        var dy = clientY - cy;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxR) { dx = dx / dist * maxR; dy = dy / dist * maxR; dist = maxR; }
        aimFireThumb.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
        aimFireLabel.style.display = 'none';
        if (dist > 3 || !mobileAimActive) {
            mobileAimAngle = Math.atan2(dy * 0.55, dx * 0.55);
        }
        mobileAimActive = true;
    }

    var dashBtn = document.getElementById('dashButton');
    dashBtn.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (p1 && p1.alive) tryDash(p1);
        startBGM();
    });

    document.body.style.touchAction = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.body.style.userSelect = 'none';
}

canvas.addEventListener('click', (e) => {
    startBGM();
});

// ---------- 键盘全局处理 ----------

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && gameState === 'upgrading') {
        skipUpgrade();
        return;
    }
    if ((e.key === 'Escape' || e.key === 'p') && gameState === 'playing') {
        gameState = 'paused';
        return;
    }
    if ((e.key === 'Escape' || e.key === 'p') && gameState === 'paused') {
        gameState = 'playing';
        return;
    }
    if (gameState === 'gameover' && e.key === 'Enter') {
        if (isHighScore(gameMode, score)) {
            showNameInput();
            gameState = 'nameInput';
        }
    }
    if (gameState === 'gameover' && e.key === 'r') {
        if (gameMode === 'network' && networkWs && networkWs.readyState === WebSocket.OPEN) {
            networkWs.send(JSON.stringify({ type: 'game_restart', room: networkRoom }));
        }
        resetGame();
    }
});

// ---------- 初始化 ----------

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

initStars();
initNebulae();
loadScores();
loadAchievements();
setupMobile();
setupNetworkLobbyInput();

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();
