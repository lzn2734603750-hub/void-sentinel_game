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
        if (networkState === 'playing') {
            networkState = 'connecting';
            networkError = '连接中断，尝试重连...';
            networkReconnectTimer = setTimeout(function () { connectToServer(); }, 3000);
        } else {
            networkState = 'idle';
            networkError = '无法连接到服务器 (' + networkServerUrl + ')';
        }
        stopStateSync();
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
            networkHostReady = false;
            networkGuestReady = false;
            if (msg.readyState) {
                networkHostReady = msg.readyState.hostReady;
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

        case 'game_state':
            remotePlayerState = msg.payload;
            applyRemoteState(msg.payload);
            break;

        case 'error':
            networkState = 'idle';
            networkRole = '';
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
    if (!networkWs || networkWs.readyState !== WebSocket.OPEN || !networkRoom) return;
    if (networkRole !== 'host') return;
    if (!networkPeerJoined) return;
    if (!networkHostReady || !networkGuestReady) return;
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

// ---------- 游戏状态同步 ----------
function startNetworkGame() {
    if (networkRole === 'host') {
        networkStateSyncTimer = setInterval(function () { syncHostState(); }, 50);
    } else {
        networkStateSyncTimer = setInterval(function () { syncGuestInput(); }, 50);
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
        shooting: mouseDown,
        fireRate: p1.fireRate, bulletCount: p1.bulletCount,
    };
    networkWs.send(JSON.stringify({ type: 'game_state', room: networkRoom, payload: { type: 'guest_input', data: input } }));
}

function buildGameState() {
    var state = {
        type: 'full_sync',
        host: null, enemies: [], boss: null,
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
    for (var i = 0; i < enemies.length; i++) {
        var e = enemies[i];
        state.enemies.push({ x: e.x, y: e.y, radius: e.radius, hp: e.hp, maxHp: e.maxHp, behavior: e.behavior, color: e.color, vx: e.vx, vy: e.vy });
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
        p2.hp = d.hp; p2.maxHp = d.maxHp; p2.exp = d.exp; p2.expToNext = d.expToNext;
        p2.shieldActive = d.shieldActive; p2.alive = d.hp > 0;
        return;
    }
    if (state.type === 'full_sync' && networkRole === 'guest') {
        score = state.score; wave = state.wave; waveText = state.waveText;
        gameState = state.gameState; gameMode = state.gameMode; difficulty = state.difficulty;
        if (state.host) {
            if (!p2) { p2 = createPlayer(state.host.x, state.host.y, 1); players.push(p2); }
            p2.x = state.host.x; p2.y = state.host.y; p2.angle = state.host.angle;
            p2.hp = state.host.hp; p2.maxHp = state.host.maxHp;
            p2.alive = state.host.hp > 0; p2.shieldActive = state.host.shieldActive;
        }
        enemies.length = 0;
        for (var i = 0; i < state.enemies.length; i++) {
            var ed = state.enemies[i];
            enemies.push({ x: ed.x, y: ed.y, radius: ed.radius, hp: ed.hp, maxHp: ed.maxHp, behavior: ed.behavior, color: ed.color, vx: ed.vx, vy: ed.vy, speed: 0, strokeColor: '#fff', glowColor: ed.color, scoreValue: 10, explodeRange: 0, explodeDamage: 0, updateTargetTimer: 0, wobble: 0, shieldHp: 0 });
        }
        if (state.boss) {
            if (!boss) spawnBoss();
            if (boss) { boss.x = state.boss.x; boss.y = state.boss.y; boss.hp = state.boss.hp; boss.maxHp = state.boss.maxHp; }
        }
    }
}
