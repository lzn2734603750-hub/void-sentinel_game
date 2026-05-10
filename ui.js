// ====================================
// ui.js - HUD / 菜单 / 排行榜 / 升级面板 / 成就
// ====================================

// ---------- 升级系统 ----------

const allUpgrades = [
    { name: '射速提升', icon: '⚡', desc: '射击间隔 -2 帧', apply: function(p) { p.fireRate = Math.max(3, p.fireRate - 2); } },
    { name: '移动加速', icon: '👟', desc: '移速 +1.5', apply: function(p) { p.speed = (p.speed || 5) + 1.5; } },
    { name: '子弹数+1', icon: '🔫', desc: '子弹+1', apply: function(p) { p.bulletCount += 1; } },
    { name: '双炮齐射', icon: '🔫🔫', desc: '弹数x2，扩角', apply: function(p) { p.bulletCount = Math.max(2, p.bulletCount * 2); } },
    { name: '扩散射击', icon: '💠', desc: '宽角扇形弹幕，子弹+3', apply: function(p) { p.bulletCount += 3; p.spreadMode = (p.spreadMode || 0) + 1; } },
    { name: '回复生命', icon: '❤️', desc: '回满生命值', apply: function(p) { p.hp = p.maxHp; } },
    { name: '最大生命+1', icon: '💖', desc: '最大生命 +1 并回满', apply: function(p) { p.maxHp += 1; p.hp = p.maxHp; } },
    { name: '暴击提升', icon: '💥', desc: '暴击率 +25%', apply: function(p) { p.critChance = Math.min(1, (p.critChance || 0) + 0.25); } },
    { name: '僚机+1', icon: '🛸', desc: '增加 1 架僚机', apply: function(p) { p.droneCount = (p.droneCount || 0) + 1; } },
    { name: '受伤冲击波', icon: '💫', desc: '受击释放冲击波', apply: function(p) { p.shockwaveOnHit = true; } },
    { name: '子弹加速', icon: '🚀', desc: '子弹速度 +3', apply: function(p) { p.bulletSpeed = (p.bulletSpeed || 10) + 3; } },
    { name: '子弹伤害+1', icon: '💢', desc: '子弹伤害 +1', apply: function(p) { p.bulletDamage = (p.bulletDamage || 1) + 1; } },
    { name: '护盾强化', icon: '🛡️', desc: '获得 500 帧护盾', apply: function(p) { p.shieldActive = true; p.shieldTimer = 500; } },
    { name: '冲刺冷却缩短', icon: '💨', desc: '冲刺CD -40', apply: function(p) { p.dashCooldownMax = Math.max(30, p.dashCooldownMax - 40); } },
    { name: '吸铁石', icon: '🧲', desc: '吸经验范围+80', apply: function(p) { p.magnetRange = (p.magnetRange || 0) + 80; } },
];

var upgradeCards = [];

function buildUpgradePanel() {
    const panel = document.createElement('div');
    panel.id = 'upgradePanel';
    panel.innerHTML =
        '<div class="upgrade-title">⬆ 选择一项升级</div>' +
        '<div class="upgrade-cards" id="upgradeCards"></div>' +
        '<div class="upgrade-skip" id="upgradeSkip">按 ESC 跳过</div>';
    document.body.appendChild(panel);

    const sty = document.createElement('style');
    sty.textContent = `
#upgradePanel{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.85);z-index:100;flex-direction:column;align-items:center;justify-content:center;}
.upgrade-title{color:#0ff;font-size:30px;margin-bottom:25px;text-shadow:0 0 20px #0ff;}
.upgrade-cards{display:flex;gap:20px;flex-wrap:wrap;justify-content:center;max-width:90vw;}
.upgrade-card{background:linear-gradient(135deg,#0a0a1e,#1a1a3e);border:2px solid #444;border-radius:14px;padding:20px 16px;width:170px;text-align:center;cursor:pointer;transition:.2s;}
.upgrade-card:hover{border-color:#0ff;transform:scale(1.06);box-shadow:0 0 25px rgba(0,255,255,.3);}
.upgrade-card .icon{font-size:40px;margin-bottom:8px;}
.upgrade-card .name{color:#fff;font-size:17px;font-weight:bold;margin-bottom:6px;}
.upgrade-card .desc{color:#aaa;font-size:13px;line-height:1.4;}
.upgrade-skip{color:#666;font-size:14px;margin-top:30px;}
`;
    document.head.appendChild(sty);

    document.addEventListener('keydown', (e) => {
        if (gameState === 'upgrading' && e.key === 'Escape') {
            skipUpgrade();
        }
    });
}

function triggerUpgrade() {
    gameState = 'upgrading';
    var others = allUpgrades.filter(function (u) { return u.name !== '回复生命'; });
    var shuffled = others.sort(function () { return Math.random() - 0.5; });
    upgradeCards = shuffled.slice(0, 3);
    var heal = allUpgrades.find(function (u) { return u.name === '回复生命'; });
    upgradeCards.push(heal);
    upgradeCards.sort(function () { return Math.random() - 0.5; });

    const container = document.getElementById('upgradeCards');
    container.innerHTML = '';

    upgradeCards.forEach((card, i) => {
        const el = document.createElement('div');
        el.className = 'upgrade-card';
        el.innerHTML =
            '<div class="icon">' + card.icon + '</div>' +
            '<div class="name">' + card.name + '</div>' +
            '<div class="desc">' + card.desc + '</div>';
        el.addEventListener('click', () => selectUpgrade(i));
        container.appendChild(el);
    });

    document.getElementById('upgradePanel').style.display = 'flex';
    playSound('levelUp');
}

function selectUpgrade(i) {
    const card = upgradeCards[i];
    for (const player of players) {
        if (!player || !player.alive) continue;
        card.apply(player);
    }
    if (p1 && p1.alive) {
        p1.expToNext += 5;
        p1.exp = 0;
    }
    document.getElementById('upgradePanel').style.display = 'none';
    gameState = 'playing';
}

function skipUpgrade() {
    if (p1 && p1.alive) {
        p1.exp = Math.floor(p1.expToNext * 0.5);
    }
    document.getElementById('upgradePanel').style.display = 'none';
    gameState = 'playing';
}

// ---------- 成就系统 ----------

const achievementDefs = [
    { id: 'first_kill', name: '初次击杀', desc: '击杀第一个敌人', check: () => score >= 10 },
    { id: 'wave5', name: '突破第五波', desc: '达到第 5 波', check: () => wave >= 5 },
    { id: 'wave10', name: '无尽挑战者', desc: '达到第 10 波', check: () => wave >= 10 },
    { id: 'boss_slayer', name: 'Boss 猎手', desc: '击败一个 Boss', check: () => false, once: true },
    { id: 'rich', name: '经验丰收', desc: '单次获得 60 经验', check: () => p1 && p1.exp >= 60, once: true },
    { id: 'coop_win', name: '战友', desc: '合作模式存活 5 波', check: () => gameMode === 'coop' && wave >= 5 },
    { id: 'score_500', name: '星际猎人', desc: '单局得分 500', check: () => score >= 500 },
    { id: 'score_2000', name: '银河霸主', desc: '单局得分 2000', check: () => score >= 2000 },
];

var achievements = {};
var achievementPopup = null;

function loadAchievements() {
    try {
        achievements = JSON.parse(localStorage.getItem('voidSentinelAchievements')) || {};
    } catch (e) {
        achievements = {};
    }
}
function saveAchievements() {
    localStorage.setItem('voidSentinelAchievements', JSON.stringify(achievements));
}

function unlockAchievement(id) {
    if (!achievements[id]) {
        achievements[id] = Date.now();
        saveAchievements();
        const def = achievementDefs.find(a => a.id === id);
        if (def) {
            achievementPopup = { name: def.name, timer: 150 };
            playSound('achievement');
        }
    }
}

function checkAchievements() {
    for (const def of achievementDefs) {
        if (def.once && achievements[def.id]) continue;
        if (def.check()) unlockAchievement(def.id);
    }
}

// ---------- 排行榜（多模式） ----------

var highScores = { solo: [], coop: [] };

function loadScores() {
    try {
        const data = JSON.parse(localStorage.getItem('voidSentinelScores2'));
        if (data && data.solo) {
            highScores = data;
        } else {
            const old = JSON.parse(localStorage.getItem('voidSentinelScores'));
            highScores = { solo: old || [], coop: [] };
        }
    } catch (e) {
        highScores = { solo: [], coop: [] };
    }
}

function saveScores() {
    localStorage.setItem('voidSentinelScores2', JSON.stringify(highScores));
}

function addScore(mode, name, pts) {
    const list = highScores[mode] || [];
    list.push({ name, score: pts });
    list.sort((a, b) => b.score - a.score);
    if (list.length > 15) list.pop();
    highScores[mode] = list;
    saveScores();
}

function isHighScore(mode, pts) {
    const list = highScores[mode] || [];
    if (pts === 0) return false;
    return list.length < 15 || pts > list[list.length - 1].score;
}

function clearScores(mode) {
    if (mode) {
        highScores[mode] = [];
    } else {
        highScores = { solo: [], coop: [] };
    }
    saveScores();
}

// ---------- 姓名输入面板 ----------

function buildNameInputPanel() {
    const panel = document.createElement('div');
    panel.id = 'nameInputPanel';
    panel.innerHTML =
        '<div class="name-input-title">🏆 新纪录！</div>' +
        '<input type="text" id="nameField" placeholder="输入你的名字 (2-8字)" maxlength="8" />' +
        '<div style="display:flex;gap:20px;margin-top:20px">' +
        '<button id="submitScoreBtn" class="glow-btn">提交</button>' +
        '<button id="cancelScoreBtn" class="glow-btn dim">跳过</button>' +
        '</div>';
    document.body.appendChild(panel);

    const sty = document.createElement('style');
    sty.textContent = `
#nameInputPanel{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.92);z-index:200;flex-direction:column;align-items:center;justify-content:center;}
.name-input-title{color:#ffd700;font-size:36px;margin-bottom:20px;text-shadow:0 0 20px #ffd700;}
#nameField{font-size:24px;padding:12px 20px;border-radius:8px;border:2px solid #0ff;background:rgba(0,20,40,.9);color:#fff;text-align:center;width:260px;outline:none;}
#nameField:focus{border-color:#ffd700;box-shadow:0 0 20px rgba(255,215,0,.3);}
.glow-btn{font-size:20px;padding:12px 28px;border:2px solid #0ff;background:rgba(0,40,60,.8);color:#fff;border-radius:8px;cursor:pointer;transition:.2s;}
.glow-btn:hover{background:rgba(0,60,100,.8);box-shadow:0 0 20px rgba(0,255,255,.3);}
.glow-btn.dim{border-color:#666;color:#999;}
.glow-btn.dim:hover{background:rgba(40,40,40,.8);}
`;
    document.head.appendChild(sty);

    document.getElementById('submitScoreBtn').addEventListener('click', () => {
        const name = document.getElementById('nameField').value.trim() || '无名';
        addScore(gameMode, name, score);
        hideNameInput();
        gameState = 'gameover';
    });
    document.getElementById('cancelScoreBtn').addEventListener('click', () => {
        hideNameInput();
        gameState = 'gameover';
    });
    document.getElementById('nameField').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('submitScoreBtn').click();
    });
}

function showNameInput() {
    document.getElementById('nameInputPanel').style.display = 'flex';
    const field = document.getElementById('nameField');
    field.value = '';
    setTimeout(() => field.focus(), 100);
}

function hideNameInput() {
    document.getElementById('nameInputPanel').style.display = 'none';
}

// ---------- 点击检测 ----------

function rectContains(rx, ry, rw, rh, cx, cy) {
    return cx >= rx && cx <= rx + rw && cy >= ry && cy <= ry + rh;
}

function handleClick(cx, cy) {
    var hw = canvas.width / 2;

    if (gameState === 'menu') {
        // 难度选择
        var diffY = canvas.height / 2 - 115;
        var diffX = hw - 85;
        if (cy >= diffY + 14 && cy <= diffY + 44) {
            if (cx >= diffX && cx <= diffX + 52) { difficulty = 'easy'; playSound('click'); return; }
            if (cx >= diffX + 56 && cx <= diffX + 108) { difficulty = 'normal'; playSound('click'); return; }
            if (cx >= diffX + 116 && cx <= diffX + 168) { difficulty = 'hard'; playSound('click'); return; }
        }

        // 单人模式
        if (rectContains(hw - 120, canvas.height / 2 - 10, 240, 55, cx, cy)) {
            playSound('click');
            gameMode = 'solo';
            resetGame();
            return;
        }
        // 本地合作
        if (rectContains(hw - 120, canvas.height / 2 + 60, 240, 55, cx, cy)) {
            playSound('click');
            gameMode = 'coop';
            resetGame();
            return;
        }
        // 网络联机
        if (rectContains(hw - 120, canvas.height / 2 + 130, 240, 55, cx, cy)) {
            playSound('click');
            gameMode = 'network';
            leaveNetworkRoom();
            window._joinCode = '';
            gameState = 'network_lobby';
            return;
        }
        // 排行榜
        if (rectContains(hw - 80, canvas.height / 2 + 200, 160, 45, cx, cy)) {
            playSound('click');
            gameState = 'scoreboard';
            return;
        }
        return;
    }

    if (gameState === 'network_lobby') {
        handleNetworkLobbyClick(cx, cy);
        return;
    }

    if (gameState === 'paused') {
        var pcy = canvas.height / 2 + 20;
        if (rectContains(hw - 110, pcy, 220, 55, cx, cy)) {
            playSound('click');
            gameState = 'playing';
            return;
        }
        if (rectContains(hw - 110, pcy + 80, 220, 55, cx, cy)) {
            playSound('click');
            stopBGM();
            boss = null;
            bossActive = false;
            bullets.length = 0;
            enemies.length = 0;
            particles.length = 0;
            expOrbs.length = 0;
            enemySpawnTimer = 0;
            players.forEach(function(p) { if (p) p.drones = []; });
            players.length = 0;
            p1 = null;
            p2 = null;
            score = 0;
            wave = 1;
            gameMode = 'solo';
            gameState = 'menu';
            return;
        }
        return;
    }

    if (gameState === 'gameover') {
        var gbx = Math.max(30, hw - 110);
        var gbw = Math.min(220, canvas.width - 60);
        var high = isHighScore(gameMode, score);
        var gbtnY = high ? canvas.height / 2 + 100 : canvas.height / 2 + 35;

        if (high && rectContains(gbx, canvas.height / 2 + 35, gbw, 52, cx, cy)) {
            playSound('click');
            showNameInput();
            gameState = 'nameInput';
            return;
        }
        if (rectContains(gbx, gbtnY, gbw, 52, cx, cy)) {
            if (gameMode === 'network' && networkRole === 'guest') return;
            playSound('click');
            tryNetworkRestart();
            return;
        }
        if (rectContains(gbx, gbtnY + 70, gbw, 52, cx, cy)) {
            playSound('click');
            if (gameMode === 'network') {
                leaveNetworkRoom();
            }
            stopBGM();
            boss = null;
            bossActive = false;
            bullets.length = 0;
            enemies.length = 0;
            particles.length = 0;
            expOrbs.length = 0;
            enemySpawnTimer = 0;
            players.forEach(function(p) { if (p) p.drones = []; });
            players.length = 0;
            p1 = null;
            p2 = null;
            score = 0;
            wave = 1;
            gameMode = 'solo';
            gameState = 'menu';
            return;
        }
        return;
    }

    if (gameState === 'scoreboard') {
        if (rectContains(hw - 100, 100, 90, 36, cx, cy)) {
            playSound('click');
            scoreboardMode = 'solo';
            return;
        }
        if (rectContains(hw + 10, 100, 90, 36, cx, cy)) {
            playSound('click');
            scoreboardMode = 'coop';
            return;
        }
        if (rectContains(hw - 90, canvas.height - 100, 180, 50, cx, cy)) {
            playSound('click');
            gameState = 'menu';
            return;
        }
        if (rectContains(hw - 50, canvas.height - 45, 100, 35, cx, cy)) {
            playSound('click');
            clearScores(scoreboardMode);
            return;
        }
    }
}

// ---------- HUD 绘制 ----------

function drawHealthBar(player) {
    if (!player || !player.alive) return;
    const isP2 = player.playerIndex === 1;
    const w = 200, h = 18;
    const x = isP2 ? canvas.width - 220 : 20;
    const y = isP2 ? 20 : 20;

    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);

    ctx.fillStyle = '#333';
    ctx.fillRect(x, y, w, h);

    const hpRatio = player.hp / player.maxHp;
    const hpColor = hpRatio > 0.5 ? `rgb(${Math.floor(255*(1-hpRatio)*2)},255,0)` :
        `rgb(255,${Math.floor(255*hpRatio*2)},0)`;
    ctx.fillStyle = hpColor;
    ctx.fillRect(x, y, w * hpRatio, h);

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = isP2 ? 'right' : 'left';
    const label = isP2 ? 'P2' : '';
    ctx.fillText((label ? label + ' ' : '') + 'HP ' + player.hp + '/' + player.maxHp,
        isP2 ? x + w - 5 : x + 5, y + 13);
}

function drawExpBar(player) {
    if (!player || !player.alive) return;
    const isP2 = player.playerIndex === 1;
    const w = 200, h = 8;
    const x = isP2 ? canvas.width - 220 : 20;
    const y = isP2 ? 44 : 44;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#0ff';
    ctx.fillRect(x, y, w * (player.exp / player.expToNext), h);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
}

function drawDashIndicator(player) {
    if (!player || !player.alive) return;
    const isP2 = player.playerIndex === 1;
    const s = 26;
    const x = isP2 ? canvas.width - 40 : 20;
    const y = isP2 ? 60 : 60;

    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2, s / 2 + 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2);
    ctx.fill();

    if (player.dashCooldown > 0) {
        const ratio = player.dashCooldown / player.dashCooldownMax;
        ctx.fillStyle = 'rgba(0,255,255,.5)';
        ctx.beginPath();
        ctx.moveTo(x + s / 2, y + s / 2);
        ctx.arc(x + s / 2, y + s / 2, s / 2, -Math.PI / 2, -Math.PI / 2 + (1 - ratio) * Math.PI * 2);
        ctx.closePath();
        ctx.fill();
    } else {
        ctx.fillStyle = '#0ff';
        ctx.beginPath();
        ctx.arc(x + s / 2, y + s / 2, s / 2 - 2, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.strokeStyle = '#0ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText('D', x + s / 2, y + s / 2 + 4);
}

function drawScore() {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'right';
    ctx.shadowColor = '#0ff';
    ctx.shadowBlur = 8;
    ctx.fillText('分数: ' + score, canvas.width - 20, 85);
    ctx.shadowBlur = 0;
}

function drawWaveDisplay() {
    ctx.fillStyle = '#ccc';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'right';
    var modeStr = gameMode === 'coop' ? '合作' : gameMode === 'network' ? '联机' : '单人';
    var diffStr = difficulty === 'easy' ? '简单' : difficulty === 'hard' ? '困难' : '普通';
    ctx.fillText('第 ' + wave + ' 波  |  ' + modeStr + '  |  ' + diffStr,
        canvas.width - 20, 108);
}

function drawWaveText() {
    if (!waveTextTimer || !waveText) return;
    const alpha = waveTextTimer > 30 ? 1 : waveTextTimer / 30;
    ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#0ff';
    ctx.shadowBlur = 20;
    ctx.fillText(waveText, canvas.width / 2, canvas.height / 2 - 40);
    ctx.shadowBlur = 0;
}

var scoreboardMode = 'solo';

// ---------- 菜单绘制 ----------

function drawMenu() {
    ctx.fillStyle = '#0ff';
    ctx.font = 'bold 56px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#0ff';
    ctx.shadowBlur = 30;
    ctx.fillText('虚 空 哨 兵', canvas.width / 2, canvas.height / 2 - 220);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    ctx.fillText('单人: WASD移动 | 鼠标瞄准+射击 | 空格闪避', canvas.width / 2, canvas.height / 2 - 170);
    ctx.fillText('合作: P1(WASD+F射击+空格闪避)  P2(方向键+鼠标瞄准射击+右Shift闪避)', canvas.width / 2, canvas.height / 2 - 148);

    var hw = canvas.width / 2;

    // 难度选择
    var diffY = canvas.height / 2 - 115;
    ctx.fillStyle = '#888';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▼ 难度选择 ▼', hw, diffY + 8);
    var diffX = hw - 85;
    drawDifficultySelector(diffX, diffY + 14, 'easy', '简单');
    drawDifficultySelector(diffX + 56, diffY + 14, 'normal', '普通');
    drawDifficultySelector(diffX + 116, diffY + 14, 'hard', '困难');

    // 单人模式按钮
    var sbtnX = hw - 120, sbtnY = canvas.height / 2 - 10;
    drawButton(sbtnX, sbtnY, 240, 55, '#0ff', '单人模式', '🚀');
    // 合作模式按钮（本地）
    var cbtnX = hw - 120, cbtnY = canvas.height / 2 + 60;
    drawButton(cbtnX, cbtnY, 240, 55, '#f0f', '本地合作', '👥');
    // 网络联机按钮
    var nbtnX = hw - 120, nbtnY = canvas.height / 2 + 130;
    drawButton(nbtnX, nbtnY, 240, 55, '#0f0', '网络联机', '🌐');
    // 排行榜按钮
    var lbtnX = hw - 80, lbtnY = canvas.height / 2 + 200;
    drawButton(lbtnX, lbtnY, 160, 45, '#888', '排行榜', '🏆');

    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#555';
    ctx.fillText('v2.1  |  点击或触屏操作  |  按R重开', canvas.width / 2, canvas.height - 20);
}

function drawDifficultySelector(x, y, diff, label) {
    var isSelected = difficulty === diff;
    ctx.fillStyle = isSelected ? 'rgba(0,255,255,.2)' : 'rgba(255,255,255,.05)';
    ctx.fillRect(x, y, 52, 30);
    ctx.strokeStyle = isSelected ? '#0ff' : '#555';
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.strokeRect(x, y, 52, 30);
    ctx.fillStyle = isSelected ? '#0ff' : '#888';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + 26, y + 21);
}

// ---------- 网络联机大厅 ----------

function drawNetworkLobby() {
    ctx.fillStyle = '#0ff';
    ctx.font = 'bold 38px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#0ff';
    ctx.shadowBlur = 15;
    ctx.fillText('🌐 网络联机大厅', canvas.width / 2, 80);
    ctx.shadowBlur = 0;

    var hw = canvas.width / 2;
    var cy = 160;

    ctx.fillStyle = '#555';
    ctx.font = '12px sans-serif';
    ctx.fillText('服务器: ' + networkServerUrl, hw, cy - 20);

    if (networkState === 'connecting') {
        ctx.fillStyle = '#ffd700';
        ctx.font = '24px sans-serif';
        ctx.fillText('正在连接服务器...', hw, cy + 20);
        ctx.fillStyle = '#888';
        ctx.font = '14px sans-serif';
        ctx.fillText(networkServerUrl, hw, cy + 50);
        drawButton(hw - 90, canvas.height - 110, 180, 50, '#f44', '取消', '');
        return;
    }

    if (networkError && networkState === 'idle' && networkRole === '') {
        ctx.fillStyle = '#f44';
        ctx.font = '18px sans-serif';
        ctx.fillText('⚠ ' + networkError, hw, cy + 20);
        ctx.fillStyle = '#888';
        ctx.font = '14px sans-serif';
        ctx.fillText('请确保已启动信令服务器: node server.js', hw, cy + 50);
        ctx.fillStyle = '#aaa';
        ctx.font = '13px sans-serif';
        ctx.fillText('或使用 ngrok/公网IP 暴露端口', hw, cy + 72);
        drawButton(hw - 190, cy + 90, 100, 40, '#0f0', '重试', '');
        drawButton(hw + 90, cy + 90, 100, 40, '#f44', '返回', '');
        return;
    }

    if (networkState === 'playing') {
        if (networkError) {
            ctx.fillStyle = '#f44';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('⚠ ' + networkError, hw, cy + 50);
        } else {
            ctx.fillStyle = '#0f0';
            ctx.font = '24px sans-serif';
            ctx.fillText('游戏进行中...', hw, cy + 30);
        }
        return;
    }

    if (networkState === 'waiting' && (networkRole === 'host' || networkRole === 'guest' || networkPeerJoined)) {
        drawNetworkWaitingPage(hw, cy);
        return;
    }

    ctx.fillStyle = '#0f0';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('加入房间', hw, cy);
    ctx.fillStyle = '#888';
    ctx.font = '16px sans-serif';
    ctx.fillText('输入房间码:', hw, cy + 35);
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 2;
    ctx.strokeRect(hw - 80, cy + 48, 160, 45);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px sans-serif';
    var joinCode = window._joinCode || '';
    ctx.fillText(joinCode || '____', hw, cy + 80);
    ctx.fillStyle = '#888';
    ctx.font = '13px sans-serif';
    ctx.fillText('键入4位码后点 加入 / 创建', hw, cy + 115);
    drawButton(hw - 190, cy + 130, 100, 40, '#0f0', '加入', '');
    drawButton(hw + 90, cy + 130, 100, 40, '#0f0', '创建', '');

    drawNetworkDifficulty(hw);
    drawButton(hw - 90, canvas.height - 50, 180, 40, '#f44', '返回', '');
}

function drawNetworkWaitingPage(hw, cy) {
    if (networkError) {
        ctx.fillStyle = '#f44';
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚠ ' + networkError, hw, cy - 10);
    }

    ctx.fillStyle = '#0f0';
    ctx.font = 'bold 46px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#0f0';
    ctx.shadowBlur = 16;
    ctx.fillText('🏠 ' + (networkRoom || '----'), hw, cy + 5);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    ctx.fillText('房间码（分享给队友）', hw, cy + 28);

    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hw - 200, cy + 46);
    ctx.lineTo(hw + 200, cy + 46);
    ctx.stroke();

    var baseY = cy + 72;

    if (networkRole === 'host') {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#0ff';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText('👑 你（主机）', hw - 170, baseY);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#0f0';
        ctx.fillText('—', hw + 170, baseY);

        baseY += 36;
        ctx.textAlign = 'left';
        if (networkPeerJoined) {
            ctx.fillStyle = '#f80';
            ctx.fillText('👤 队友', hw - 170, baseY);
        } else {
            ctx.fillStyle = '#555';
            ctx.fillText('👤 等待队友加入...', hw - 170, baseY);
        }
        ctx.textAlign = 'right';
        if (!networkPeerJoined) {
            ctx.fillStyle = '#555';
            ctx.fillText('—', hw + 170, baseY);
        } else if (networkGuestReady) {
            ctx.fillStyle = '#0f0';
            ctx.fillText('✅ 已就绪', hw + 170, baseY);
        } else {
            ctx.fillStyle = '#f80';
            ctx.fillText('⏳ 未就绪', hw + 170, baseY);
        }

        baseY += 52;
        var allReady = networkPeerJoined && networkGuestReady;
        var btnColor = allReady ? '#0f0' : '#555';
        var btnText = allReady ? '▶ 开始游戏' : (networkPeerJoined ? '等待队友就绪' : '等待队友加入');
        drawButton(hw - 95, baseY, 190, 48, btnColor, btnText, '');
        window._netHostBtnY = baseY;
    }

    if (networkRole === 'guest') {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#0ff';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText('👑 主机', hw - 170, baseY);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#0f0';
        ctx.fillText('—', hw + 170, baseY);

        baseY += 36;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#f80';
        ctx.fillText('👤 你（客机）', hw - 170, baseY);
        ctx.textAlign = 'right';
        if (networkGuestReady) {
            ctx.fillStyle = '#0f0';
            ctx.fillText('✅ 已就绪', hw + 170, baseY);
        } else {
            ctx.fillStyle = '#f80';
            ctx.fillText('⏳ 未就绪', hw + 170, baseY);
        }

        baseY += 52;
        var readyText = networkGuestReady ? '✅ 已就绪（点击取消）' : '准备';
        var readyColor = networkGuestReady ? '#ffd700' : '#0f0';
        drawButton(hw - 95, baseY, 190, 48, readyColor, readyText, '');
        window._netGuestBtnY = baseY;

        baseY += 54;
        ctx.fillStyle = '#555';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(networkGuestReady ? '等待主机开始游戏...' : '点击"准备"后等待主机开始', hw, baseY);
    }

    drawNetworkDifficulty(hw);
    drawButton(hw - 90, canvas.height - 50, 180, 40, '#f44', '返回', '');
}

function drawNetworkDifficulty(hw) {
    var diffY = canvas.height - 120;
    ctx.fillStyle = '#888';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▼ 难度选择 ▼', hw, diffY - 5);
    var diffX = hw - 85;
    drawDifficultySelector(diffX, diffY + 2, 'easy', '简单');
    drawDifficultySelector(diffX + 56, diffY + 2, 'normal', '普通');
    drawDifficultySelector(diffX + 116, diffY + 2, 'hard', '困难');
}

function handleNetworkLobbyClick(cx, cy) {
    var hw = canvas.width / 2;

    if (cx >= hw - 90 && cx <= hw + 90 && cy >= canvas.height - 50 && cy <= canvas.height - 10) {
        playSound('click');
        leaveNetworkRoom();
        gameState = 'menu';
        return;
    }

    if (networkState === 'connecting') {
        if (cx >= hw - 90 && cx <= hw + 90 && cy >= canvas.height - 110 && cy <= canvas.height - 60) {
            leaveNetworkRoom();
            gameState = 'menu';
        }
        return;
    }

    if (networkState === 'waiting' && networkRole === 'host') {
        var btnY = window._netHostBtnY || 320;
        if (cx >= hw - 95 && cx <= hw + 95 && cy >= btnY && cy <= btnY + 48) {
            if (networkPeerJoined && networkGuestReady) {
                hostStartGame();
            }
            return;
        }
    }

    if (networkState === 'waiting' && networkRole === 'guest') {
        var gBtnY = window._netGuestBtnY || 320;
        if (cx >= hw - 95 && cx <= hw + 95 && cy >= gBtnY && cy <= gBtnY + 48) {
            toggleNetworkReady();
            return;
        }
    }

    if (networkRole === '') {
        if (cx >= hw - 190 && cx <= hw - 90 && cy >= 160 + 130 && cy <= 160 + 170) {
            playSound('click');
            var code = window._joinCode;
            if (code && code.length === 4) {
                networkRole = 'guest';
                joinNetworkRoom(code);
            }
            return;
        }
        if (cx >= hw + 90 && cx <= hw + 190 && cy >= 160 + 130 && cy <= 160 + 170) {
            playSound('click');
            networkRole = 'host';
            createNetworkRoom();
            return;
        }
    }

    var diffY = canvas.height - 120;
    var diffX = hw - 85;
    if (cy >= diffY + 2 && cy <= diffY + 32) {
        if (cx >= diffX && cx <= diffX + 52) { difficulty = 'easy'; playSound('click'); return; }
        if (cx >= diffX + 56 && cx <= diffX + 108) { difficulty = 'normal'; playSound('click'); return; }
        if (cx >= diffX + 116 && cx <= diffX + 168) { difficulty = 'hard'; playSound('click'); return; }
    }
}

function drawButton(x, y, w, h, color, text, icon) {
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.15;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(icon + '  ' + text, x + w / 2, y + h / 2 + 8);
}

// ---------- 排行榜绘制 ----------

function drawScoreboard() {
    ctx.fillStyle = '#0ff';
    ctx.font = 'bold 38px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#0ff';
    ctx.shadowBlur = 12;
    ctx.fillText('🏆 排行榜', canvas.width / 2, 60);
    ctx.shadowBlur = 0;

    const hw = canvas.width / 2;

    // 模式标签
    const tabY = 100;
    const soloCol = scoreboardMode === 'solo' ? '#0ff' : '#555';
    const coopCol = scoreboardMode === 'coop' ? '#f0f' : '#555';

    drawTab(hw - 100, tabY, 90, 36, soloCol, '单人');
    drawTab(hw + 10, tabY, 90, 36, coopCol, '合作');

    const list = highScores[scoreboardMode] || [];
    if (list.length === 0) {
        ctx.fillStyle = '#666';
        ctx.font = '22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('暂无记录', canvas.width / 2, 220);
    } else {
        const sx = canvas.width / 2 - 160;
        let y = 160;
        ctx.textAlign = 'left';
        list.forEach((entry, i) => {
            const rank = i + 1;
            const rankCol = rank === 1 ? '#ffd700' : rank === 2 ? '#c0c0c0' : rank === 3 ? '#cd7f32' : '#fff';
            ctx.fillStyle = rankCol;
            ctx.font = 'bold 20px sans-serif';
            ctx.fillText(
                (rank === 1 ? '👑 ' : '') + rank + '. ' + entry.name,
                sx, y
            );
            ctx.textAlign = 'right';
            ctx.fillText(entry.score, canvas.width / 2 + 160, y);
            ctx.textAlign = 'left';
            y += 38;
        });
    }

    // 返回按钮
    const bx = hw - 90, by = canvas.height - 100;
    drawButton(bx, by, 180, 50, '#0ff', '返回菜单', '');
    // 清空按钮
    const cx = hw - 50, cy = canvas.height - 45;
    ctx.fillStyle = 'rgba(255,50,50,.2)';
    ctx.fillRect(cx, cy, 100, 35);
    ctx.strokeStyle = '#f44';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx, cy, 100, 35);
    ctx.fillStyle = '#f88';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('清空', cx + 50, cy + 24);
}

function drawTab(x, y, w, h, color, text) {
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, x + w / 2, y + h / 2 + 6);
}

// ---------- 游戏结束 ----------

function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#f00';
    ctx.shadowBlur = 15;
    ctx.fillText('游 戏 结 束', canvas.width / 2, canvas.height / 2 - 90);
    ctx.shadowBlur = 0;

    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('最终分数: ' + score, canvas.width / 2, canvas.height / 2 - 30);
    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    var diffStr = difficulty === 'easy' ? '简单' : difficulty === 'hard' ? '困难' : '普通';
    var modeStr = gameMode === 'coop' ? '合作' : gameMode === 'network' ? '联机' : '单人';
    ctx.fillText('模式: ' + modeStr + '  |  难度: ' + diffStr + '  |  第 ' + wave + ' 波',
        canvas.width / 2, canvas.height / 2 + 2);

    var hw = canvas.width / 2;

    if (isHighScore(gameMode, score)) {
        drawButton(Math.max(30, hw - 110), canvas.height / 2 + 35, Math.min(220, canvas.width - 60), 52, '#ffd700', '录入排行榜', '⭐');
    }

    var btnY = isHighScore(gameMode, score) ? canvas.height / 2 + 100 : canvas.height / 2 + 35;
    var isNetworkGuest = gameMode === 'network' && networkRole === 'guest';
    var restartText = isNetworkGuest ? '等待主机重新开始' : '重新开始';
    var restartColor = isNetworkGuest ? '#555' : '#0ff';
    drawButton(Math.max(30, hw - 110), btnY, Math.min(220, canvas.width - 60), 52, restartColor, restartText, '');
    drawButton(Math.max(30, hw - 110), btnY + 70, Math.min(220, canvas.width - 60), 52, '#888', '返回菜单', '');
}

// ---------- 玩家绘制 ----------

function drawPlayer(player) {
    if (!player || !player.alive || player.hp <= 0) return;

    var cs = player.colorScheme || PLAYER_COLORS.p1;
    var b0 = cs.body[0], b1 = cs.body[1], b2 = cs.body[2];
    var glow = cs.glow;
    var flameCol = cs.flame;

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    // 引擎火焰
    var flameLen = 8 + Math.random() * 8;
    var flameGrad = ctx.createLinearGradient(-player.radius, 0, -player.radius - flameLen, 0);
    flameGrad.addColorStop(0, flameCol);
    flameGrad.addColorStop(0.5, hexToRgba(flameCol, 0.5));
    flameGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.moveTo(-player.radius - 2, -player.radius * 0.35);
    ctx.lineTo(-player.radius - flameLen, 0);
    ctx.lineTo(-player.radius - 2, player.radius * 0.35);
    ctx.closePath();
    ctx.fill();

    // 冲刺时增加火焰
    if (player.dashTimer > 0) {
        var dashFlameLen = 15 + Math.random() * 10;
        var dashGrad = ctx.createLinearGradient(-player.radius - 5, 0, -player.radius - dashFlameLen, 0);
        dashGrad.addColorStop(0, 'rgba(255,255,255,.8)');
        dashGrad.addColorStop(0.3, hexToRgba(flameCol, 0.6));
        dashGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = dashGrad;
        ctx.beginPath();
        ctx.moveTo(-player.radius - 5, -player.radius * 0.3);
        ctx.lineTo(-player.radius - dashFlameLen, -2);
        ctx.lineTo(-player.radius - dashFlameLen, 2);
        ctx.lineTo(-player.radius - 5, player.radius * 0.3);
        ctx.closePath();
        ctx.fill();
    }

    // 飞船本体
    ctx.globalAlpha = player.invincible ? 0.5 + Math.sin(Date.now() * 0.03) * 0.3 : 1;

    // 外发光
    ctx.shadowColor = glow;
    ctx.shadowBlur = 12;

    // 船身渐变
    var bodyGrad = ctx.createLinearGradient(0, -player.radius, 0, player.radius);
    bodyGrad.addColorStop(0, b0);
    bodyGrad.addColorStop(0.5, b1);
    bodyGrad.addColorStop(1, b2);
    ctx.fillStyle = bodyGrad;

    ctx.beginPath();
    ctx.moveTo(player.radius + 2, 0);
    ctx.lineTo(-player.radius * 0.4, -player.radius * 0.65);
    ctx.lineTo(-player.radius * 0.2, -player.radius * 0.25);
    ctx.lineTo(-player.radius * 0.2, player.radius * 0.25);
    ctx.lineTo(-player.radius * 0.4, player.radius * 0.65);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 驾驶舱
    var cockpitGrad = ctx.createRadialGradient(-2, 0, 1, -2, 0, player.radius * 0.35);
    cockpitGrad.addColorStop(0, '#fff');
    cockpitGrad.addColorStop(1, b0);
    ctx.fillStyle = cockpitGrad;
    ctx.beginPath();
    ctx.ellipse(player.radius * 0.2, 0, player.radius * 0.35, player.radius * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    // 机翼尾翼
    ctx.fillStyle = b2;
    ctx.beginPath();
    ctx.moveTo(-player.radius * 0.15, -player.radius * 0.8);
    ctx.lineTo(-player.radius * 0.5, -player.radius * 0.65);
    ctx.lineTo(-player.radius * 0.15, -player.radius * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-player.radius * 0.15, player.radius * 0.8);
    ctx.lineTo(-player.radius * 0.5, player.radius * 0.65);
    ctx.lineTo(-player.radius * 0.15, player.radius * 0.5);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // 名字标签
    if (gameMode === 'coop' || gameMode === 'network') {
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = glow;
        ctx.shadowColor = glow;
        ctx.shadowBlur = 6;
        ctx.fillText(cs.name, 0, -player.radius - 14);
        ctx.shadowBlur = 0;
    }

    // 护盾效果
    if (player.shieldActive) {
        ctx.strokeStyle = 'rgba(' + hexToRgb(glow) + ',' + (0.5 + Math.sin(Date.now() * 0.01) * 0.3) + ')';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, player.radius + 9, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255,255,255,' + (0.2 + Math.sin(Date.now() * 0.015) * 0.15) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, player.radius + 12, 0, Math.PI * 2);
        ctx.stroke();
    }

    // 受伤闪烁
    if (player.hurtTimer > 0 && Math.floor(player.hurtTimer / 3) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,100,100,.4)';
        ctx.fillRect(-player.radius - 5, -player.radius - 5, (player.radius + 5) * 2, (player.radius + 5) * 2);
    }

    ctx.restore();
}

function hexToRgb(hex) {
    if (hex.length === 4) {
        hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return r + ',' + g + ',' + b;
}

function hexToRgba(hex, alpha) {
    return 'rgba(' + hexToRgb(hex) + ',' + alpha + ')';
}

// ---------- 准星 ----------

function drawCrosshair() {
    ctx.strokeStyle = 'rgba(255,0,0,.6)';
    ctx.lineWidth = 1.5;
    const s = 10;
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mouseX - s - 4, mouseY);
    ctx.lineTo(mouseX + s + 4, mouseY);
    ctx.moveTo(mouseX, mouseY - s - 4);
    ctx.lineTo(mouseX, mouseY + s + 4);
    ctx.stroke();
}

// ---------- 成就弹出 ----------

function drawAchievementPopup() {
    if (!achievementPopup) return;
    const alpha = achievementPopup.timer > 30 ? 1 : achievementPopup.timer / 30;
    const by = 80;
    ctx.fillStyle = 'rgba(0,0,0,' + (0.8 * alpha) + ')';
    ctx.fillRect(canvas.width / 2 - 130, by, 260, 55);
    ctx.strokeStyle = 'rgba(255,215,0,' + alpha + ')';
    ctx.lineWidth = 2;
    ctx.strokeRect(canvas.width / 2 - 130, by, 260, 55);
    ctx.fillStyle = 'rgba(255,215,0,' + alpha + ')';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏆 成就解锁: ' + achievementPopup.name, canvas.width / 2, by + 36);
}

function setupNetworkLobbyInput() {
    window._joinCode = '';
    window.addEventListener('keydown', function netKeyHandler(e) {
        if (gameState !== 'network_lobby') return;
        if (networkRole !== '' && networkRole !== 'guest') return;
        if (e.key.length === 1 && /^[A-Za-z0-9]$/.test(e.key) && (window._joinCode || '').length < 4) {
            window._joinCode = (window._joinCode || '') + e.key.toUpperCase();
        }
        if (e.key === 'Backspace') {
            window._joinCode = (window._joinCode || '').slice(0, -1);
        }
    });
}

// ---------- 暂停 ----------

function drawPauseOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#0ff';
    ctx.shadowBlur = 18;
    ctx.fillText('已暂停', canvas.width / 2, canvas.height / 2 - 80);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#aaa';
    ctx.font = '16px sans-serif';
    ctx.fillText('按 Esc 或 P 恢复', canvas.width / 2, canvas.height / 2 - 30);

    var hw = canvas.width / 2;
    var cy = canvas.height / 2 + 20;
    drawButton(hw - 110, cy, 220, 55, '#0ff', '继续游戏', '▶');
    drawButton(hw - 110, cy + 80, 220, 55, '#f44', '返回主菜单', '◀');
}

// ---------- 断线提示 ----------

function drawDisconnectOverlay() {
    if (!networkError || gameState !== 'playing') return;
    if (gameMode !== 'network') return;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f44';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#f00';
    ctx.shadowBlur = 12;
    ctx.fillText('⚠ ' + networkError, canvas.width / 2, canvas.height / 2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    ctx.fillText('正在尝试自动重连...', canvas.width / 2, canvas.height / 2 + 35);
}

// ---------- 初始化 ----------

buildUpgradePanel();
buildNameInputPanel();
