// ====================================
// audio.js - 音效与背景音乐管理
// ====================================

let audioCtx = null;
let bgmPlaying = false;
let bgmTimeout = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playTone(frequency, duration, volume = 0.1, extra) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
    if (extra) extra(osc, gain);
}

function playSound(name) {
    initAudio();
    if (!audioCtx) return;
    switch (name) {
        case 'shoot':
            playTone(800, 0.08, 0.05);
            break;
        case 'shootAlt':
            playTone(600, 0.06, 0.04, (o) => {
                o.type = 'sawtooth';
            });
            break;
        case 'shootHeavy':
            playTone(200, 0.1, 0.07);
            break;
        case 'explosion':
            playTone(80, 0.25, 0.08);
            break;
        case 'explosionBig':
            playTone(50, 0.4, 0.1);
            break;
        case 'hit':
            playTone(120, 0.1, 0.06);
            break;
        case 'pickup':
            playTone(600, 0.1, 0.06, (o) => {
                o.frequency.linearRampToValueAtTime(900, audioCtx.currentTime + 0.1);
            });
            break;
        case 'dash':
            playTone(300, 0.12, 0.04, (o) => {
                o.frequency.linearRampToValueAtTime(600, audioCtx.currentTime + 0.12);
            });
            break;
        case 'click':
            playTone(500, 0.05, 0.04);
            break;
        case 'bossAppear':
            playTone(50, 0.5, 0.1);
            playTone(60, 0.5, 0.08);
            break;
        case 'levelUp':
            playTone(400, 0.08, 0.06, (o) => {
                o.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.08);
            });
            playTone(600, 0.12, 0.06, (o) => {
                o.frequency.linearRampToValueAtTime(1200, audioCtx.currentTime + 0.12);
            });
            break;
        case 'achievement':
            playTone(523, 0.1, 0.06);
            playTone(659, 0.1, 0.06, (o) => {
                o.start = o.start || (() => {});
            });
            setTimeout(() => {
                playTone(784, 0.15, 0.06);
            }, 100);
            break;
        case 'shieldBreak':
            playTone(900, 0.15, 0.05, (o) => {
                o.frequency.linearRampToValueAtTime(200, audioCtx.currentTime + 0.15);
            });
            break;
    }
}

function startBGM() {
    if (bgmPlaying) return;
    initAudio();
    bgmPlaying = true;
    playBGMLoop();
}

function stopBGM() {
    bgmPlaying = false;
    if (bgmTimeout) {
        clearTimeout(bgmTimeout);
        bgmTimeout = null;
    }
}

function playBGMLoop() {
    if (!audioCtx || !bgmPlaying) return;

    const notes = [220, 174.61, 130.81, 196];
    const noteLength = 1.2;

    notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.015, audioCtx.currentTime + i * noteLength);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + i * noteLength + noteLength);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + i * noteLength);
        osc.stop(audioCtx.currentTime + i * noteLength + noteLength);
    });

    const totalDuration = notes.length * noteLength * 1000;
    bgmTimeout = setTimeout(() => {
        if (bgmPlaying) playBGMLoop();
    }, totalDuration);
}
