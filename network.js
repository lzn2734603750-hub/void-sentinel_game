// ====================================
// network.js - WebSocket 联机 / 房间管理 / 状态同步 v2
// ====================================

var networkState = 'idle';
var networkRole = '';
var networkRoom = '';
var networkPeerJoined = false;
var networkHostReady = false;
var networkGuestReady = false;
var networkError = '';
var networkServerUrl = detectNetworkUrl();

function detectNetworkUrl() {
    if (window.location.protocol === 'file:') return 'ws://localhost:3456';
    return (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host;
}

var networkWs = null;
var networkReconnectTimer = null;
var networkStateSyncTimer = null;
var networkCreateTimer = null;
var remotePlayerState = null;

function setNetworkServer(url) {
    networkServerUrl = url;
}

// ---------- 连接 ----------
function connectToServer() {
    if (networkWs && networkWs.readyState === WebSocket.OPEN) return;
    networkState = 'connecting';

    try { networkWs = new WebSocket(networkServerUrl); }
    catch (e) { networkState = 'idle'; return; }

    networkWs.onopen = function () {
        if (networkReconnectTimer) { clearTimeout(networkReconnectTimer); networkReconnectTimer = null; }
    };

    networkWs.onmessage = function (e) {
        var msg;
        try { msg = JSON.parse(e.data); } catch (err) { return; }
        handleNetworkMessage(msg);
    };

    networkWs.onclose = function () {
        if (networkState === 'playing' && networkRoom) {
            networkState = 'connecting';
            networkError = '连接中断，尝试重连...';
            stopStateSync();
            networkReconnectTimer = setTimeout(function () { reconnectToRoom(); }, 2000);
        } else {
            networkState = 'idle';
            networkError = '无法连接到服务器 (' + networkServerUrl + ')';
            stopStateSync();
        }
        clearCreateTimer();
    };

    networkWs.onerror = function () {};
}

// ---------- 消息处理 ----------
function handleNetworkMessage(msg) {
    switch (msg.type) {
        case 'room_created':
            networkRoom = msg.room;
            networkRole = 'host';
            networkState = 'waiting';
            networkPeerJoined = false;
            networkHostReady = true;
            networkGuestReady = false;
            if (msg.readyState) {
                networkGuestReady = msg.readyState.guestReady;
            }
            break;

        case 'room_joined':
            networkRoom = msg.room;
            networkState = 'waiting';
            networkPeerJoined = true;
            if (msg.readyState) {
                networkHostReady = msg.readyState.hostReady;
                networkGuestReady = msg.readyState.guestReady;
            }
            break;

        case 'room_rejoined':
            networkRoom = msg.room;
            networkState = 'playing';
            networkPeerJoined = true;
            networkHostReady = true;
            networkGuestReady = true;
            networkError = '';
            startNetworkGame();
            break;

        case 'peer_joined':
            networkPeerJoined = true;
            if (msg.readyState) {
                networkHostReady = msg.readyState.hostReady;
                networkGuestReady = msg.readyState.guestReady;
            }
            break;

        case 'ready_state':
            networkHostReady = msg.readyState.hostReady;
            networkGuestReady = msg.readyState.guestReady;
            break;

        case 'all_ready':
            // 双方就绪，但不自动开始，等主机点"开始游戏"
            break;

        case 'host_start':
            networkError = '';
            networkState = 'playing';
            if (networkRole === 'host') {
                startNetworkGame();
                resetGame();
            } else {
                startNetworkGame();
                resetGame();
            }
            break;

        case 'peer_left':
            networkPeerJoined = false;
            networkHostReady = false;
            networkGuestReady = false;
            networkState = 'waiting';
            remotePlayerState = null;
            break;

        case 'game_restart':
            startNetworkGame();
            resetGame();
            break;

        case 'game_state':
            remotePlayerState = msg.payload;
            applyRemoteState(msg.payload);
            break;

        case 'error':
            networkError = msg.payload || '发生错误';
            break;
    }
}

// ---------- 房间操作 ----------
function clearCreateTimer() {
    if (networkCreateTimer) { clearInterval(networkCreateTimer); networkCreateTimer = null; }
}

function createNetworkRoom() {
    networkError = '';
    connectToServer();
    networkCreateTimer = setInterval(function () {
        if (networkWs && networkWs.readyState === WebSocket.OPEN) {
            clearCreateTimer();
            networkWs.send(JSON.stringify({ type: 'create_room' }));
        }
    }, 100);
}

function joinNetworkRoom(code) {
    networkError = '';
    connectToServer();
    networkRoom = code;
    networkRole = 'guest';
    networkCreateTimer = setInterval(function () {
        if (networkWs && networkWs.readyState === WebSocket.OPEN) {
            clearCreateTimer();
            networkWs.send(JSON.stringify({ type: 'join_room', room: code }));
        }
    }, 100);
}

function toggleNetworkReady() {
    if (!networkWs || networkWs.readyState !== WebSocket.OPEN || !networkRoom) return;
    networkWs.send(JSON.stringify({ type: 'toggle_ready', room: networkRoom }));
    playSound('click');
}

function hostStartGame() {
    if (!networkWs || networkWs.readyState !== WebSocket.OPEN || !networkRoom) {
        networkError = '连接已断开';
        return;
    }
    if (networkRole !== 'host') return;
    if (!networkPeerJoined) {
        networkError = '队友尚未加入房间';
        return;
    }
    if (!networkGuestReady) {
        networkError = '队友尚未就绪';
        return;
    }
    networkError = '';
    networkWs.send(JSON.stringify({ type: 'host_start', room: networkRoom }));
    playSound('click');
}

function leaveNetworkRoom() {
    clearCreateTimer();
    if (networkReconnectTimer) { clearTimeout(networkReconnectTimer); networkReconnectTimer = null; }
    if (networkWs && networkWs.readyState === WebSocket.OPEN) {
        networkWs.send(JSON.stringify({ type: 'leave_room', room: networkRoom }));
    }
    stopStateSync();
    networkState = 'idle';
    networkRole = '';
    networkRoom = '';
    networkPeerJoined = false;
    networkHostReady = false;
    networkGuestReady = false;
    networkError = '';
    remotePlayerState = null;
    if (networkWs) { try { networkWs.close(); } catch(e) {} networkWs = null; }
}

function reconnectToRoom() {
    if (!networkRoom) return;
    connectToServer();
    networkReconnectTimer = setInterval(function () {
        if (networkWs && networkWs.readyState === WebSocket.OPEN) {
            clearTimeout(networkReconnectTimer);
            networkReconnectTimer = null;
            networkWs.send(JSON.stringify({ type: 'rejoin_room', room: networkRoom, role: networkRole }));
        }
    }, 100);
    setTimeout(function () {
        if (networkReconnectTimer) {
            clearTimeout(networkReconnectTimer);
            networkReconnectTimer = null;
            networkState = 'idle';
            networkError = '重连失败，请返回大厅';
        }
    }, 8000);
}

// ---------- 游戏状态同步 ----------
function startNetworkGame() {
    stopStateSync();
    if (networkRole === 'host') {
        networkStateSyncTimer = setInterval(function () { syncHostState(); }, 100);
    } else {
        networkStateSyncTimer = setInterval(function () { syncGuestInput(); }, 100);
    }
}

function stopStateSync() {
    if (networkStateSyncTimer) { clearInterval(networkStateSyncTimer); networkStateSyncTimer = null; }
}

function syncHostState() {
    if (!networkWs || networkWs.readyState !== WebSocket.OPEN || !networkRoom) return;
    var state = buildGameState();
    networkWs.send(JSON.stringify({ type: 'game_state', room: networkRoom, payload: state }));
}

function syncGuestInput() {
    if (!networkWs || networkWs.readyState !== WebSocket.OPEN || !networkRoom) return;
    if (!p1 || !p1.alive) return;
    var input = {
        x: p1.x, y: p1.y, angle: p1.angle,
        hp: p1.hp, maxHp: p1.maxHp,
        exp: p1.exp, expToNext: p1.expToNext,
        shieldActive: p1.shieldActive,
        dashCooldown: p1.dashCooldown,
        shooting: mouseDown || mobileFire,
        fireCooldown: p1.fireCooldown,
        fireRate: p1.fireRate, bulletCount: p1.bulletCount,
        bulletSpeed: p1.bulletSpeed, bulletDamage: p1.bulletDamage,
        bulletSize: p1.bulletSize, critChance: p1.critChance,
    };
    networkWs.send(JSON.stringify({ type: 'game_state', room: networkRoom, payload: { type: 'guest_input', data: input } }));
}

function buildGameState() {
    var state = {
        type: 'full_sync',
        host: null, guest: null, enemies: [], boss: null, bullets: [],
        score: score, wave: wave, waveText: waveText,
        gameState: gameState, gameMode: gameMode, difficulty: difficulty,
    };
    if (p1 && p1.alive) {
        state.host = {
            x: p1.x, y: p1.y, angle: p1.angle,
            hp: p1.hp, maxHp: p1.maxHp,
            exp: p1.exp, expToNext: p1.expToNext,
            shieldActive: p1.shieldActive, dashCooldown: p1.dashCooldown,
        };
    }
    if (p2 && p2.alive) {
        state.guest = {
            x: p2.x, y: p2.y, angle: p2.angle,
            hp: p2.hp, maxHp: p2.maxHp,
            exp: p2.exp, expToNext: p2.expToNext,
            shieldActive: p2.shieldActive, dashCooldown: p2.dashCooldown,
        };
    }
    for (var i = 0; i < enemies.length; i++) {
        var e = enemies[i];
        state.enemies.push({ x: e.x, y: e.y, radius: e.radius, hp: e.hp, maxHp: e.maxHp, behavior: e.behavior, color: e.color, vx: e.vx, vy: e.vy });
    }
    for (var j = 0; j < bullets.length; j++) {
        var bl = bullets[j];
        state.bullets.push({ x: bl.x, y: bl.y, vx: bl.vx, vy: bl.vy, radius: bl.radius, damage: bl.damage, color: bl.color, crit: bl.crit });
    }
    if (boss) {
        state.boss = { x: boss.x, y: boss.y, hp: boss.hp, maxHp: boss.maxHp, radius: boss.radius };
    }
    return state;
}

function applyRemoteState(state) {
    if (!state) return;
    if (state.type === 'guest_input' && networkRole === 'host') {
        if (!p2) { p2 = createPlayer(canvas.width / 2, canvas.height / 2, 1); players.push(p2); }
        var d = state.data;
        p2.x = d.x; p2.y = d.y; p2.angle = d.angle;
        clampPlayerToCanvas(p2);
        p2.hp = d.hp; p2.maxHp = d.maxHp; p2.exp = d.exp; p2.expToNext = d.expToNext;
        p2.shieldActive = d.shieldActive; p2.alive = d.hp > 0;
        p2.dashCooldown = d.dashCooldown || 0;
        p2.fireRate = d.fireRate; p2.bulletCount = d.bulletCount;
        p2.bulletSpeed = d.bulletSpeed || 10; p2.bulletDamage = d.bulletDamage || 1;
        p2.bulletSize = d.bulletSize || 1; p2.critChance = d.critChance || 0;
        p2.fireCooldown = d.fireCooldown;
        if (d.shooting && p2.fireCooldown <= 0 && p2.alive) {
            spawnBullets(p2);
            p2.fireCooldown = p2.fireRate;
        }
        if (p2.fireCooldown > 0) p2.fireCooldown--;
        return;
    }
    if (state.type === 'full_sync' && networkRole === 'guest') {
        score = state.score; wave = state.wave; waveText = state.waveText;
        gameState = state.gameState; gameMode = state.gameMode; difficulty = state.difficulty;
        if (state.host) {
            if (!p2) { p2 = createPlayer(state.host.x, state.host.y, 1); players.push(p2); }
            p2.x = state.host.x; p2.y = state.host.y; p2.angle = state.host.angle;
            clampPlayerToCanvas(p2);
            p2.hp = state.host.hp; p2.maxHp = state.host.maxHp;
            p2.alive = state.host.hp > 0; p2.shieldActive = state.host.shieldActive;
            p2.dashCooldown = state.host.dashCooldown || 0;
        }
        if (state.guest && p1 && p1.alive) {
            p1.exp = state.guest.exp;
            p1.expToNext = state.guest.expToNext;
            p1.maxHp = state.guest.maxHp;
            if (p1.hp > p1.maxHp) p1.hp = p1.maxHp;
        }
        enemies.length = 0;
        for (var i = 0; i < state.enemies.length; i++) {
            var ed = state.enemies[i];
            enemies.push({ x: ed.x, y: ed.y, radius: ed.radius, hp: ed.hp, maxHp: ed.maxHp, behavior: ed.behavior, color: ed.color, vx: ed.vx, vy: ed.vy, speed: 0, strokeColor: '#fff', glowColor: ed.color, scoreValue: 10, explodeRange: 0, explodeDamage: 0, updateTargetTimer: 0, wobble: 0, shieldHp: 0 });
        }
        bullets.length = 0;
        for (var k = 0; k < state.bullets.length; k++) {
            var bd = state.bullets[k];
            bullets.push({ x: bd.x, y: bd.y, vx: bd.vx, vy: bd.vy, radius: bd.radius, damage: bd.damage, color: bd.color, crit: bd.crit, trail: [] });
        }
        if (state.boss) {
            if (!boss) spawnBoss();
            if (boss) { boss.x = state.boss.x; boss.y = state.boss.y; boss.hp = state.boss.hp; boss.maxHp = state.boss.maxHp; }
        }
    }
}
