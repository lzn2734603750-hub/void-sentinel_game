// ====================================
// server.js - 虚空哨兵 v4（HTTP静态文件 + WebSocket 共存）
// 启动: node server.js              (默认端口 3456)
//       node server.js 8888         (自定义端口)
// 部署: 支持 Render / Railway 等云平台
//       PORT 由环境变量自动设置
// ====================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.argv[2] || process.env.PORT || 3456;

// ---------- 静态文件 MIME ----------
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
};

// ---------- WebSocket 房间管理 ----------
const rooms = {};
const ROOM_CLEANUP_DELAY = 30000; // 30秒后清理空房间（给重连留时间）
const HEARTBEAT_INTERVAL = 15000; // 15秒心跳
const HEARTBEAT_TIMEOUT = 30000;  // 30秒无响应判定断线

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function send(ws, data) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

function broadcastRoom(room, data) {
    send(room.host, data);
    send(room.guest, data);
}

function roomReadyState(room) {
    var hostReady = room.hostReady || false;
    var guestReady = room.guestReady || false;
    return { hostReady: hostReady, guestReady: guestReady, allReady: hostReady && guestReady };
}

// 验证游戏状态输入，防止恶意数据
function validatePosition(x, y) {
    var nx = Number(x), ny = Number(y);
    if (isNaN(nx) || isNaN(ny)) return false;
    if (nx < -500 || nx > 10000 || ny < -500 || ny > 10000) return false;
    return true;
}

function onMessage(ws, raw) {
    var msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    var type = msg.type, roomCode = msg.room, payload = msg.payload;

    if (type === 'create_room') {
        var code = generateRoomCode();
        rooms[code] = { host: ws, guest: null, hostReady: true, guestReady: false };
        ws.roomCode = code;
        ws.role = 'host';
        send(ws, { type: 'room_created', room: code, readyState: roomReadyState(rooms[code]) });
        console.log('[房间] ' + code + ' 已创建 (Host)');
        return;
    }

    if (type === 'join_room') {
        var room = rooms[roomCode];
        if (!room) { send(ws, { type: 'error', payload: '房间不存在' }); return; }
        if (room.guest) { send(ws, { type: 'error', payload: '房间已满' }); return; }
        room.guest = ws;
        ws.roomCode = roomCode;
        ws.role = 'guest';
        send(ws, { type: 'room_joined', room: roomCode, readyState: roomReadyState(room) });
        send(room.host, { type: 'peer_joined', readyState: roomReadyState(room) });
        console.log('[房间] ' + roomCode + ' Guest 已加入');
        return;
    }

    if (type === 'rejoin_room') {
        var room = rooms[roomCode];
        if (!room) { send(ws, { type: 'error', payload: '房间已失效，请重新创建' }); return; }
        var role = msg.role;
        if (role === 'host') {
            // 重连时检查之前是否为主机，允许替换已断开的连接
            if (room.host && room.host !== ws && room.host.readyState === WebSocket.OPEN) {
                send(ws, { type: 'error', payload: '主机已在线' });
                return;
            }
            room.host = ws; ws.roomCode = roomCode; ws.role = 'host';
            ws.isAlive = true;
            if (room._cleanupTimer) { clearTimeout(room._cleanupTimer); room._cleanupTimer = null; }
            room._disconnectedRole = null;
            send(ws, { type: 'room_rejoined', room: roomCode, role: 'host', readyState: roomReadyState(room) });
            // 通知客机主机已重连
            if (room.guest && room.guest.readyState === WebSocket.OPEN) {
                send(room.guest, { type: 'peer_reconnected', payload: 'host' });
            }
        } else if (role === 'guest') {
            if (room.guest && room.guest !== ws && room.guest.readyState === WebSocket.OPEN) {
                send(ws, { type: 'error', payload: '客机已在房间' });
                return;
            }
            room.guest = ws; ws.roomCode = roomCode; ws.role = 'guest';
            ws.isAlive = true;
            if (room._cleanupTimer) { clearTimeout(room._cleanupTimer); room._cleanupTimer = null; }
            room._disconnectedRole = null;
            send(ws, { type: 'room_rejoined', room: roomCode, role: 'guest', readyState: roomReadyState(room) });
            // 通知主机客机已重连
            if (room.host && room.host.readyState === WebSocket.OPEN) {
                send(room.host, { type: 'peer_reconnected', payload: 'guest' });
            }
        }
        console.log('[房间] ' + roomCode + ' ' + (role || 'unknown') + ' 重连');
        return;
    }

    if (type === 'toggle_ready') {
        var room = rooms[roomCode];
        if (!room) return;
        if (ws.role === 'host') room.hostReady = !room.hostReady;
        if (ws.role === 'guest') room.guestReady = !room.guestReady;
        var rs = roomReadyState(room);
        broadcastRoom(room, { type: 'ready_state', readyState: rs });
        console.log('[房间] ' + roomCode + ' Ready: H=' + rs.hostReady + ' G=' + rs.guestReady);
        return;
    }

    if (type === 'host_start') {
        var room = rooms[roomCode];
        if (!room) return;
        if (ws.role !== 'host') return;
        if (!room.guest) { send(ws, { type: 'error', payload: '队友尚未加入' }); return; }
        if (!room.guestReady) { send(ws, { type: 'error', payload: '队友尚未就绪' }); return; }
        broadcastRoom(room, { type: 'host_start' });
        console.log('[房间] ' + roomCode + ' 主机开始游戏！');
        return;
    }

    if (type === 'game_state') {
        var room = rooms[roomCode];
        if (!room) return;
        // 基本输入验证：限制 payload 大小防止内存攻击
        var payloadStr = JSON.stringify(payload);
        if (payloadStr.length > 500000) return;
        // 验证 guest 输入坐标合法性
        if (ws.role === 'guest' && payload && payload.type === 'guest_input' && payload.data) {
            var d = payload.data;
            if (!validatePosition(d.x, d.y)) return;
        }
        var dest = ws.role === 'host' ? room.guest : room.host;
        send(dest, { type: 'game_state', payload: payload });
        return;
    }

    if (type === 'pong') {
        ws.isAlive = true;
        return;
    }

    if (type === 'game_restart') {
        var room = rooms[roomCode];
        if (!room) return;
        var dest = ws.role === 'host' ? room.guest : room.host;
        send(dest, { type: 'game_restart' });
        return;
    }

    if (type === 'leave_room') {
        leaveRoom(ws, true);
        return;
    }
}

function leaveRoom(ws, intentional) {
    var code = ws.roomCode;
    if (!code || !rooms[code]) return;
    var room = rooms[code];
    var role = ws.role;
    var other = role === 'host' ? room.guest : room.host;

    if (intentional) {
        // 主动离开：通知对方并立即关闭房间
        send(other, { type: 'peer_left', payload: '对方离开了房间' });
        if (room._cleanupTimer) clearTimeout(room._cleanupTimer);
        delete rooms[code];
        console.log('[房间] ' + code + ' 已关闭（' + role + ' 主动离开）');
    } else {
        // 意外断开：通知对方并保留房间等待重连
        send(other, { type: 'peer_disconnected', payload: '对方连接中断，等待重连...' });
        room._disconnectedRole = role;
        room._disconnectedTime = Date.now();
        if (room._cleanupTimer) clearTimeout(room._cleanupTimer);
        room._cleanupTimer = setTimeout(function () {
            if (rooms[code]) {
                var r = rooms[code];
                var leftover = r._disconnectedRole === 'host' ? r.guest : r.host;
                send(leftover, { type: 'peer_left', payload: '重连超时，房间已关闭' });
                delete rooms[code];
                console.log('[房间] ' + code + ' 重连超时，已清理');
            }
        }, ROOM_CLEANUP_DELAY);
        console.log('[房间] ' + code + ' ' + role + ' 断开，保留房间等待重连');
    }
}

// ---------- HTTP 服务器 ----------
const server = http.createServer(function (req, res) {
    var url = req.url.split('?')[0];
    if (url === '/') url = '/index.html';

    var filePath = path.join(__dirname, url);
    var ext = path.extname(filePath);

    fs.readFile(filePath, function (err, data) {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
    });
});

// ---------- WebSocket 附加到 HTTP ----------
const wss = new WebSocket.Server({ server: server });

wss.on('connection', function (ws) {
    ws.isAlive = true;
    console.log('[连接] 新客户端 (' + wss.clients.size + ' 在线)');

    ws.on('message', function (raw) {
        ws.isAlive = true;
        onMessage(ws, raw.toString());
    });

    ws.on('pong', function () {
        ws.isAlive = true;
    });

    ws.on('close', function (code) {
        // 1000=正常关闭, 1001=离开页面, 其他=异常断开
        var intentional = (code === 1000 || code === 1001);
        leaveRoom(ws, intentional);
        console.log('[连接] 客户端断开 (code=' + code + ')');
    });

    ws.on('error', function (err) {
        console.error('[错误] 客户端连接错误:', err.message || err);
    });
});

// 心跳检测：定时 ping 所有客户端，清理死连接
const heartbeatTimer = setInterval(function () {
    wss.clients.forEach(function (ws) {
        if (ws.isAlive === false) {
            ws.terminate();
            return;
        }
        ws.isAlive = false;
        try { ws.ping(); } catch (e) {}
    });
}, HEARTBEAT_INTERVAL);

wss.on('close', function () {
    clearInterval(heartbeatTimer);
});

// 定期清理空房间
setInterval(function () {
    var now = Date.now();
    for (var code in rooms) {
        var room = rooms[code];
        var hostDead = !room.host || room.host.readyState !== WebSocket.OPEN;
        var guestDead = !room.guest || room.guest.readyState !== WebSocket.OPEN;
        if (hostDead && guestDead) {
            if (room._cleanupTimer) clearTimeout(room._cleanupTimer);
            delete rooms[code];
            console.log('[清理] 房间 ' + code + ' 双方均已断开，已删除');
        } else if (room._disconnectedRole && room._disconnectedTime) {
            if (now - room._disconnectedTime > ROOM_CLEANUP_DELAY + 10000) {
                var leftover = room._disconnectedRole === 'host' ? room.guest : room.host;
                send(leftover, { type: 'peer_left', payload: '重连超时，房间已关闭' });
                if (room._cleanupTimer) clearTimeout(room._cleanupTimer);
                delete rooms[code];
                console.log('[清理] 房间 ' + code + ' 重连超时，已删除');
            }
        }
    }
}, 15000);

// ---------- 启动 ----------
server.listen(PORT, function () {
    console.log('========================================');
    console.log('  虚空哨兵 服务器 v4');
    console.log('  游戏页面: http://localhost:' + PORT);
    console.log('  信令服务: ws://localhost:' + PORT);
    console.log('  心跳检测: ' + (HEARTBEAT_INTERVAL / 1000) + 's 间隔');
    console.log('========================================');
});
