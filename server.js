// ====================================
// server.js - 虚空哨兵 v3（HTTP静态文件 + WebSocket 共存）
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

function onMessage(ws, raw) {
    var msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    var type = msg.type, roomCode = msg.room, payload = msg.payload;

    if (type === 'create_room') {
        var code = generateRoomCode();
        rooms[code] = { host: ws, guest: null, hostReady: false, guestReady: false };
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
            if (room.host && room.host.readyState === WebSocket.OPEN) {
                send(ws, { type: 'error', payload: '主机已在线' });
                return;
            }
            room.host = ws;
            ws.roomCode = roomCode;
            ws.role = 'host';
            send(ws, { type: 'room_rejoined', room: roomCode, role: 'host', readyState: roomReadyState(room) });
        } else if (role === 'guest') {
            if (room.guest && room.guest.readyState === WebSocket.OPEN) {
                send(ws, { type: 'error', payload: '客机已在房间' });
                return;
            }
            room.guest = ws;
            ws.roomCode = roomCode;
            ws.role = 'guest';
            send(ws, { type: 'room_rejoined', room: roomCode, role: 'guest', readyState: roomReadyState(room) });
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
        var rs = roomReadyState(room);
        if (!rs.allReady) { send(ws, { type: 'error', payload: '队友尚未就绪' }); return; }
        broadcastRoom(room, { type: 'host_start' });
        console.log('[房间] ' + roomCode + ' 主机开始游戏！');
        return;
    }

    if (type === 'game_state') {
        var room = rooms[roomCode];
        if (!room) return;
        var dest = ws.role === 'host' ? room.guest : room.host;
        send(dest, { type: 'game_state', payload: payload });
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
        leaveRoom(ws);
        return;
    }
}

function leaveRoom(ws) {
    var code = ws.roomCode;
    if (!code || !rooms[code]) return;
    var room = rooms[code];
    var other = ws.role === 'host' ? room.guest : room.host;
    send(other, { type: 'peer_left' });
    delete rooms[code];
    console.log('[房间] ' + code + ' 已关闭');
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
    console.log('[连接] 新客户端 (' + wss.clients.size + ' 在线)');
    ws.on('message', function (raw) { onMessage(ws, raw.toString()); });
    ws.on('close', function () {
        leaveRoom(ws);
        console.log('[连接] 客户端断开');
    });
    ws.on('error', function (err) {
        console.error('[错误] 客户端连接错误:', err.message || err);
    });
});

// ---------- 启动 ----------
server.listen(PORT, function () {
    console.log('========================================');
    console.log('  虚空哨兵 服务器 v3');
    console.log('  游戏页面: http://localhost:' + PORT);
    console.log('  信令服务: ws://localhost:' + PORT);
    console.log('========================================');
});
