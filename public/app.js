const API_URL = '/api';
const ADMIN_PASS = 'admin123';

// Elementos HTML
const authSection = document.getElementById('auth-section');
const authForm = document.getElementById('auth-form');
const authFeedback = document.getElementById('auth-feedback');
const gameSection = document.getElementById('game-section');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const btnTogglePass = document.getElementById('btn-toggle-pass');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const btnRestart = document.getElementById('btn-restart');
const btnMute = document.getElementById('btn-mute');
const userDisplay = document.getElementById('user-display');
const scoreDisplay = document.getElementById('score');
const comboBadge = document.getElementById('combo-badge');
const timerDisplay = document.getElementById('timer');
const leaderboardList = document.getElementById('leaderboard-list');
const qrCodeImg = document.getElementById('qr-code-img');

// Elementos do Placar Arcade
const arcade1Up = document.getElementById('arcade-1up');
const arcadeHighScore = document.getElementById('arcade-highscore');

// Elementos da Aba Admin
const btnOpenAdmin = document.getElementById('btn-open-admin');
const btnCloseAdmin = document.getElementById('btn-close-admin');
const adminOverlay = document.getElementById('admin-overlay');
const btnLoadPlayers = document.getElementById('btn-load-players');
const playersList = document.getElementById('players-list');

// Elementos da Tela de Game Over
const gameOverScreen = document.getElementById('game-over-screen');
const gameOverReason = document.getElementById('game-over-reason');
const finalScoreDisplay = document.getElementById('final-score');
const finalTimeDisplay = document.getElementById('final-time');
const finalRankDisplay = document.getElementById('final-rank');

// Modal de Edição
const editModal = document.getElementById('edit-modal');
const editPlayerId = document.getElementById('edit-player-id');
const editUsername = document.getElementById('edit-username');
const editPassword = document.getElementById('edit-password');
const btnSaveEdit = document.getElementById('btn-save-edit');
const btnCancelEdit = document.getElementById('btn-cancel-edit');

// Canvas Principal & Canvas Modo Atração
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const attractCanvas = document.getElementById('attractCanvas');
const attractCtx = attractCanvas.getContext('2d');

// Gera QR Code automático apontando para o endereço atual da feira (ngrok / localhost)
if (qrCodeImg) {
    const currentUrl = encodeURIComponent(window.location.href);
    qrCodeImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${currentUrl}`;
}

// ---------------- SISTEMA DE ÁUDIO 8-BIT (WEB AUDIO API) ----------------
let audioCtx = null;
let isMuted = false;

function initAudio() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playTone(freq, type = 'square', duration = 0.12, volume = 0.08, endFreq = null) {
    if (isMuted) return;
    initAudio();
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (endFreq) {
        osc.frequency.exponentialRampToValueAtTime(endFreq, audioCtx.currentTime + duration);
    }

    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

const sfx = {
    collect: (points) => {
        playTone(520 + points * 90, 'square', 0.11, 0.07, 880);
    },
    combo: () => {
        playTone(587, 'square', 0.09, 0.08);
        setTimeout(() => playTone(784, 'square', 0.14, 0.09, 1046), 85);
    },
    boot: () => {
        playTone(440, 'triangle', 0.1, 0.09);
        setTimeout(() => playTone(660, 'triangle', 0.1, 0.09), 80);
        setTimeout(() => playTone(880, 'triangle', 0.18, 0.1), 160);
    },
    hitAuto: () => {
        playTone(220, 'sawtooth', 0.28, 0.1, 75);
    },
    shock: () => {
        playTone(150, 'sawtooth', 0.12, 0.1, 320);
        setTimeout(() => playTone(120, 'square', 0.18, 0.1, 60), 100);
    },
    tick: () => {
        playTone(880, 'sine', 0.06, 0.05);
    },
    gameOver: () => {
        playTone(392, 'sawtooth', 0.16, 0.08);
        setTimeout(() => playTone(330, 'sawtooth', 0.16, 0.08), 160);
        setTimeout(() => playTone(261, 'sawtooth', 0.35, 0.09), 320);
    }
};

btnMute.addEventListener('click', () => {
    isMuted = !isMuted;
    btnMute.textContent = isMuted ? '🔇' : '🔊';
    if (!isMuted) initAudio();
});

// ---------------- IMAGENS DO JOGO ----------------
const walleImage = new Image();
walleImage.src = 'imagens/walle.png';

const attractImage = new Image();
attractImage.src = 'imagens/wal.png';

const batteryImage = new Image();
batteryImage.src = 'imagens/bateria.png';

const autoImage = new Image();
autoImage.src = 'imagens/auto.png';

const bootImage = new Image();
bootImage.src = 'imagens/bota.png';

// Imagens dos E-Lixos Específicos
const trashImages = {
    tubo: new Image(),
    not: new Image(),
    cel: new Image(),
    tec: new Image()
};
trashImages.tubo.src = 'imagens/tubo.png';
trashImages.not.src = 'imagens/not.png';
trashImages.cel.src = 'imagens/cel.png';
trashImages.tec.src = 'imagens/tec.png';

let currentUser = null;
let score = 0;
let timeSeconds = 0;
const MAX_TIME = 60;
let gameInterval = null;
let timerInterval = null;
let isGameOver = false;
let facingRight = true;
let isAdminUnlocked = false;

// Estado de paralisia pela bateria explosiva
let isStunned = false;
let stunTimeout = null;

// Sistema de Combo 2x
let comboStreak = 0;
let doublePointsUntil = 0;

// Tremor de tela e textos flutuantes
let shakeFrames = 0;
let floatingTexts = [];

function spawnFloatingText(text, x, y, color = '#fbbf24') {
    floatingTexts.push({
        text,
        x,
        y,
        color,
        alpha: 1,
        vy: -1.1
    });
}

const robot = {
    x: 280,
    y: 180,
    width: 48,
    height: 48,
    speed: 5
};

// Bateria Explosiva: aparece por 5s, some e espera 10s
const explosiveBattery = {
    x: 100,
    y: 100,
    width: 36,
    height: 36,
    active: false,
    stateStartTime: 0,
    visibleDuration: 5000,
    cooldownDuration: 10000
};

// Plantinha na Bota (+5s): aparece por 4.5s a cada 14s
const plantBoot = {
    x: 200,
    y: 200,
    width: 38,
    height: 38,
    active: false,
    stateStartTime: 0,
    visibleDuration: 4500,
    cooldownDuration: 14000
};

// Vilões AUTO (substituem os vírus)
let villains = [];

const trashTypes = [
    { name: 'Placa-Mãe', icon: '📟', points: 1 },
    { name: 'Monitor Antigo', icon: '🖥️', points: 1 },
    { name: 'Bateria Líquida', icon: '🔋', points: 2 },
    { name: 'Teclado Quebrado', icon: '⌨️', imgKey: 'tec', points: 1 },
    { name: 'Notebook Velho', icon: '💻', imgKey: 'not', points: 2 },
    { name: 'Celular Antigo', icon: '📱', imgKey: 'cel', points: 1 },
    { name: 'Disquete / HD', icon: '💾', points: 1 },
    { name: 'TV de Tubo', icon: '📺', imgKey: 'tubo', customSize: 48, points: 3 }
];

let items = [];
const keys = {};

window.addEventListener('keydown', (e) => keys[e.code] = true);
window.addEventListener('keyup', (e) => keys[e.code] = false);

// Controles Touch (D-Pad em Cruz)
function setupTouchButton(buttonId, keyCode) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    const startAction = (e) => {
        e.preventDefault();
        initAudio();
        keys[keyCode] = true;
    };

    const stopAction = (e) => {
        e.preventDefault();
        keys[keyCode] = false;
    };

    btn.addEventListener('touchstart', startAction, { passive: false });
    btn.addEventListener('touchend', stopAction, { passive: false });
    btn.addEventListener('touchcancel', stopAction, { passive: false });
    btn.addEventListener('mousedown', startAction);
    btn.addEventListener('mouseup', stopAction);
    btn.addEventListener('mouseleave', stopAction);
}

setupTouchButton('btn-up', 'KeyW');
setupTouchButton('btn-down', 'KeyS');
setupTouchButton('btn-left', 'KeyA');
setupTouchButton('btn-right', 'KeyD');

// ---------------- MODO ATRAÇÃO (FUNDO ANIMADO NA TELA INICIAL COM wal.png) ----------------
const attractWallE = { x: 60, y: 120, vx: 1.6, vy: 1.1, size: 64 };

function resizeAttractCanvas() {
    attractCanvas.width = window.innerWidth;
    attractCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeAttractCanvas);
resizeAttractCanvas();

function animateAttractMode() {
    if (authSection.style.display !== 'none') {
        attractCtx.clearRect(0, 0, attractCanvas.width, attractCanvas.height);

        attractWallE.x += attractWallE.vx;
        attractWallE.y += attractWallE.vy;

        if (attractWallE.x <= 10 || attractWallE.x >= attractCanvas.width - attractWallE.size - 10) {
            attractWallE.vx *= -1;
        }
        if (attractWallE.y <= 10 || attractWallE.y >= attractCanvas.height - attractWallE.size - 10) {
            attractWallE.vy *= -1;
        }

        if (attractImage.complete && attractImage.naturalWidth !== 0) {
            attractCtx.save();
            if (attractWallE.vx < 0) {
                attractCtx.translate(attractWallE.x + attractWallE.size, attractWallE.y);
                attractCtx.scale(-1, 1);
                attractCtx.drawImage(attractImage, 0, 0, attractWallE.size, attractWallE.size);
            } else {
                attractCtx.drawImage(attractImage, attractWallE.x, attractWallE.y, attractWallE.size, attractWallE.size);
            }
            attractCtx.restore();
        }
    }
    requestAnimationFrame(animateAttractMode);
}
animateAttractMode();

// ---------------- ABA ADMIN ----------------

btnOpenAdmin.addEventListener('click', () => {
    if (!isAdminUnlocked) {
        const pass = prompt('Digite a senha de administrador:');
        if (pass !== ADMIN_PASS) {
            if (pass !== null) alert('Senha de administrador incorreta!');
            return;
        }
        isAdminUnlocked = true;
    }
    adminOverlay.style.display = 'flex';
    loadPlayers();
});

btnCloseAdmin.addEventListener('click', () => {
    adminOverlay.style.display = 'none';
});

// ---------------- AUTENTICAÇÃO & RANKING ----------------

btnTogglePass.addEventListener('click', () => {
    passwordInput.classList.toggle('password-mask');
    btnTogglePass.textContent = passwordInput.classList.contains('password-mask') ? '👁️' : '🙈';
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    initAudio();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        authFeedback.textContent = '⚠️ Preencha usuário e senha para começar!';
        return;
    }

    authFeedback.textContent = '';
    btnLogin.disabled = true;
    btnLogin.textContent = '⏳ CONECTANDO...';

    try {
        const res = await fetch(`${API_URL}/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            currentUser = data.player.username;
            userDisplay.textContent = currentUser;
            arcade1Up.textContent = String(data.player.high_score ?? 0).padStart(4, '0');
            authSection.style.display = 'none';
            gameSection.style.display = 'block';
            startGame();
        } else {
            authFeedback.textContent = `❌ ${data.error}`;
        }
    } catch (err) {
        authFeedback.textContent = '❌ Erro ao conectar ao servidor.';
    } finally {
        btnLogin.disabled = false;
        btnLogin.textContent = 'INICIAR MISSÃO';
    }
});

btnLogout.addEventListener('click', () => {
    isGameOver = true;
    clearInterval(gameInterval);
    clearInterval(timerInterval);
    clearTimeout(stunTimeout);
    currentUser = null;
    passwordInput.value = '';
    authFeedback.textContent = '';
    gameSection.style.display = 'none';
    authSection.style.display = 'block';
});

async function loadLeaderboard() {
    try {
        const res = await fetch(`${API_URL}/leaderboard`);
        const data = await res.json();
        leaderboardList.innerHTML = '';

        const topScore = data.length > 0 ? (data[0].high_score ?? 0) : 0;
        arcadeHighScore.textContent = String(topScore).padStart(4, '0');

        const top5 = data.slice(0, 5);
        top5.forEach((player, index) => {
            const row = document.createElement('div');
            row.className = 'arcade-row';

            const pos = index + 1;
            const formattedScore = String(player.high_score ?? 0).padStart(4, '0');
            const nameUpper = player.username.toUpperCase().slice(0, 10);
            const timeVal = `${player.best_time ?? 0}S`;

            row.innerHTML = `
                <span>${pos}</span>
                <span>${formattedScore}</span>
                <span>${nameUpper}</span>
                <span>${timeVal}</span>
            `;
            leaderboardList.appendChild(row);
        });
    } catch (err) {
        console.error('Erro ao carregar ranking:', err);
    }
}

// ---------------- GERENCIAMENTO CRUD (ADMIN) ----------------

async function loadPlayers() {
    try {
        const res = await fetch(`${API_URL}/players`);
        const players = await res.json();
        playersList.innerHTML = '';

        players.forEach(p => {
            const tr = document.createElement('tr');
            const hScore = p.high_score ?? 0;
            const bTime = p.best_time ?? 0;
            tr.innerHTML = `
                <td>${p.id}</td>
                <td>${p.username}</td>
                <td>${hScore}</td>
                <td>${bTime}</td>
                <td>
                    <button class="btn-edit" onclick="openEditModal(${p.id}, '${p.username}')">Editar</button>
                    <button class="btn-delete" onclick="deletePlayer(${p.id})">Excluir</button>
                </td>
            `;
            playersList.appendChild(tr);
        });
    } catch (err) {
        console.error('Erro ao carregar jogadores:', err);
    }
}

function openEditModal(id, currentUsername) {
    editPlayerId.value = id;
    editUsername.value = currentUsername;
    editPassword.value = '';
    editModal.style.display = 'flex';
}

function closeEditModal() {
    editModal.style.display = 'none';
}

btnCancelEdit.addEventListener('click', closeEditModal);

btnSaveEdit.addEventListener('click', async () => {
    const id = editPlayerId.value;
    const username = editUsername.value.trim();
    const password = editPassword.value.trim();

    if (!username || !password) {
        return alert('Por favor, informe o novo nome de usuário e a nova senha.');
    }

    try {
        const res = await fetch(`${API_URL}/players/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (res.ok) {
            alert(data.message);
            closeEditModal();
            loadPlayers();
            loadLeaderboard();
        } else {
            alert(data.error);
        }
    } catch (err) {
        alert('Erro ao atualizar os dados do jogador.');
    }
});

async function deletePlayer(id) {
    if (!confirm('Deseja realmente excluir este jogador?')) return;

    try {
        const res = await fetch(`${API_URL}/players/${id}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            alert('Jogador excluído!');
            loadPlayers();
            loadLeaderboard();
        } else {
            const data = await res.json();
            alert(data.error);
        }
    } catch (err) {
        alert('Erro ao excluir jogador.');
    }
}

btnLoadPlayers.addEventListener('click', loadPlayers);

// ---------------- BATERIA EXPLOSIVA, PLANTINHA NA BOTA & VILÃO AUTO ----------------

function spawnExplosiveBattery() {
    let newX, newY, dist;
    do {
        newX = Math.random() * (canvas.width - explosiveBattery.width - 20) + 10;
        newY = Math.random() * (canvas.height - explosiveBattery.height - 20) + 10;
        dist = Math.hypot(newX - robot.x, newY - robot.y);
    } while (dist < 90);

    explosiveBattery.x = newX;
    explosiveBattery.y = newY;
    explosiveBattery.active = true;
    explosiveBattery.stateStartTime = Date.now();
}

function hideExplosiveBattery() {
    explosiveBattery.active = false;
    explosiveBattery.stateStartTime = Date.now();
}

function updateExplosiveBattery() {
    const elapsed = Date.now() - explosiveBattery.stateStartTime;

    if (explosiveBattery.active) {
        if (elapsed >= explosiveBattery.visibleDuration) {
            hideExplosiveBattery();
            return;
        }

        if (
            robot.x < explosiveBattery.x + explosiveBattery.width &&
            robot.x + robot.width > explosiveBattery.x &&
            robot.y < explosiveBattery.y + explosiveBattery.height &&
            robot.y + robot.height > explosiveBattery.y
        ) {
            isStunned = true;
            comboStreak = 0;
            doublePointsUntil = 0;
            shakeFrames = 14;
            sfx.shock();
            spawnFloatingText('⚡ TRAVADO 3s!', robot.x + 20, robot.y - 10, '#facc15');

            clearTimeout(stunTimeout);
            stunTimeout = setTimeout(() => {
                isStunned = false;
            }, 3000);

            hideExplosiveBattery();
        }
    } else {
        if (elapsed >= explosiveBattery.cooldownDuration) {
            spawnExplosiveBattery();
        }
    }
}

function spawnPlantBoot() {
    let newX, newY, dist;
    do {
        newX = Math.random() * (canvas.width - plantBoot.width - 20) + 10;
        newY = Math.random() * (canvas.height - plantBoot.height - 20) + 10;
        dist = Math.hypot(newX - robot.x, newY - robot.y);
    } while (dist < 80);

    plantBoot.x = newX;
    plantBoot.y = newY;
    plantBoot.active = true;
    plantBoot.stateStartTime = Date.now();
}

function hidePlantBoot() {
    plantBoot.active = false;
    plantBoot.stateStartTime = Date.now();
}

function updatePlantBoot() {
    const elapsed = Date.now() - plantBoot.stateStartTime;

    if (plantBoot.active) {
        if (elapsed >= plantBoot.visibleDuration) {
            hidePlantBoot();
            return;
        }

        if (
            robot.x < plantBoot.x + plantBoot.width &&
            robot.x + robot.width > plantBoot.x &&
            robot.y < plantBoot.y + plantBoot.height &&
            robot.y + robot.height > plantBoot.y
        ) {
            timeSeconds = Math.max(0, timeSeconds - 5);
            const remainingTime = Math.max(0, MAX_TIME - timeSeconds);
            timerDisplay.textContent = remainingTime;
            timerDisplay.style.color = '#4ade80';
            setTimeout(() => timerDisplay.style.color = '#fbbf24', 500);

            sfx.boot();
            spawnFloatingText('🌱 +5s TEMPO!', plantBoot.x + 15, plantBoot.y, '#4ade80');
            hidePlantBoot();
        }
    } else {
        if (elapsed >= plantBoot.cooldownDuration) {
            spawnPlantBoot();
        }
    }
}

function spawnTrash() {
    if (items.length < 6) {
        const type = trashTypes[Math.floor(Math.random() * trashTypes.length)];
        const itemSize = type.customSize || 34;
        items.push({
            x: Math.random() * (canvas.width - itemSize - 10) + 5,
            y: Math.random() * (canvas.height - itemSize - 10) + 5,
            size: itemSize,
            ...type
        });
    }
}

function addVillain() {
    if (villains.length >= 4) return;

    villains.push({
        id: Date.now() + Math.random(),
        x: Math.random() * (canvas.width - 45) + 10,
        y: Math.random() * (canvas.height - 45) + 10,
        size: 38,
        speedX: (Math.random() > 0.5 ? 1 : -1) * (2.8 + Math.random() * 1.8),
        speedY: (Math.random() > 0.5 ? 1 : -1) * (2.2 + Math.random() * 1.8)
    });
}

function updateVillains() {
    villains.forEach((v) => {
        v.x += v.speedX;
        v.y += v.speedY;

        if (v.x <= 0 || v.x >= canvas.width - v.size) v.speedX *= -1;
        if (v.y <= 0 || v.y >= canvas.height - v.size) v.speedY *= -1;

        if (
            robot.x < v.x + v.size &&
            robot.x + robot.width > v.x &&
            robot.y < v.y + v.size &&
            robot.y + robot.height > v.y
        ) {
            timeSeconds += 5;
            comboStreak = 0;
            doublePointsUntil = 0;
            shakeFrames = 14;
            sfx.hitAuto();
            spawnFloatingText('-5s!', robot.x + 20, robot.y - 8, '#f87171');

            v.x = Math.random() * (canvas.width - 45) + 10;
            v.y = Math.random() * (canvas.height - 45) + 10;

            const remainingTime = Math.max(0, MAX_TIME - timeSeconds);
            timerDisplay.textContent = remainingTime;
            timerDisplay.style.color = '#f87171';
            setTimeout(() => timerDisplay.style.color = '#fbbf24', 450);

            if (timeSeconds >= MAX_TIME) {
                endGame('O AUTO sabotou o Wall-E e o tempo acabou!');
            }
        }
    });
}

// ---------------- LOOP DO JOGO ----------------

function updateGame() {
    if (isGameOver) return;

    const isDoubleActive = Date.now() < doublePointsUntil;
    comboBadge.style.display = isDoubleActive ? 'inline-block' : 'none';

    if (!isStunned) {
        if ((keys['ArrowUp'] || keys['KeyW']) && robot.y > 0) robot.y -= robot.speed;
        if ((keys['ArrowDown'] || keys['KeyS']) && robot.y < canvas.height - robot.height) robot.y += robot.speed;
        if ((keys['ArrowLeft'] || keys['KeyA']) && robot.x > 0) {
            robot.x -= robot.speed;
            facingRight = false;
        }
        if ((keys['ArrowRight'] || keys['KeyD']) && robot.x < canvas.width - robot.width) {
            robot.x += robot.speed;
            facingRight = true;
        }
    }

    updateExplosiveBattery();
    updatePlantBoot();
    updateVillains();

    items.forEach((item, index) => {
        if (
            robot.x < item.x + item.size &&
            robot.x + robot.width > item.x &&
            robot.y < item.y + item.size &&
            robot.y + robot.height > item.y
        ) {
            items.splice(index, 1);

            comboStreak++;
            if (comboStreak === 3) {
                doublePointsUntil = Date.now() + 5000;
                sfx.combo();
                spawnFloatingText('🔥 COMBO 2X!', robot.x + 20, robot.y - 16, '#fbbf24');
            }

            const multiplier = Date.now() < doublePointsUntil ? 2 : 1;
            const gained = item.points * multiplier;
            score += gained;

            if (comboStreak !== 3) sfx.collect(gained);
            spawnFloatingText(`+${gained}`, item.x + 12, item.y, multiplier === 2 ? '#fbbf24' : '#38bdf8');

            scoreDisplay.textContent = score;
            arcade1Up.textContent = String(score).padStart(4, '0');
            spawnTrash();
        }
    });

    floatingTexts.forEach((ft) => {
        ft.y += ft.vy;
        ft.alpha -= 0.022;
    });
    floatingTexts = floatingTexts.filter((ft) => ft.alpha > 0);

    draw();
}

function drawSteampunkBackdrop() {
    ctx.save();
    ctx.strokeStyle = 'rgba(180, 83, 9, 0.09)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(217, 119, 6, 0.07)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 110, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 75, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

function draw() {
    ctx.save();

    if (shakeFrames > 0) {
        const dx = (Math.random() - 0.5) * 8;
        const dy = (Math.random() - 0.5) * 8;
        ctx.translate(dx, dy);
        shakeFrames--;
    }

    ctx.clearRect(-10, -10, canvas.width + 20, canvas.height + 20);
    drawSteampunkBackdrop();

    // Plantinha na Bota (+5s)
    if (plantBoot.active) {
        if (bootImage.complete && bootImage.naturalWidth !== 0) {
            ctx.save();
            ctx.shadowColor = '#4ade80';
            ctx.shadowBlur = 12;
            ctx.drawImage(bootImage, plantBoot.x, plantBoot.y, plantBoot.width, plantBoot.height);
            ctx.restore();
        } else {
            ctx.font = '26px Arial';
            ctx.fillText('🌱', plantBoot.x, plantBoot.y + 24);
        }
    }

    // Bateria Explosiva
    if (explosiveBattery.active) {
        if (batteryImage.complete && batteryImage.naturalWidth !== 0) {
            ctx.save();
            ctx.shadowColor = '#facc15';
            ctx.shadowBlur = 10;
            ctx.drawImage(
                batteryImage,
                explosiveBattery.x,
                explosiveBattery.y,
                explosiveBattery.width,
                explosiveBattery.height
            );
            ctx.restore();
        } else {
            ctx.font = '26px Arial';
            ctx.fillText('🧨', explosiveBattery.x, explosiveBattery.y + 24);
        }
    }

    // E-Lixos
    items.forEach(item => {
        const img = item.imgKey ? trashImages[item.imgKey] : null;
        if (img && img.complete && img.naturalWidth !== 0) {
            ctx.drawImage(img, item.x, item.y, item.size, item.size);
        } else {
            ctx.font = '24px Arial';
            ctx.fillText(item.icon, item.x, item.y + 24);
        }
    });

    // Vilões AUTO
    villains.forEach(v => {
        if (autoImage.complete && autoImage.naturalWidth !== 0) {
            ctx.save();
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 8;
            ctx.drawImage(autoImage, v.x, v.y, v.size, v.size);
            ctx.restore();
        } else {
            ctx.font = '26px Arial';
            ctx.fillText('🤖', v.x, v.y + 24);
        }
    });

    // Wall-E Jogável (walle.png)
    ctx.save();
    if (isStunned) {
        ctx.globalAlpha = Math.floor(Date.now() / 120) % 2 === 0 ? 0.45 : 0.95;
    } else if (Date.now() < doublePointsUntil) {
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 16;
    }

    if (walleImage.complete && walleImage.naturalWidth !== 0) {
        if (!facingRight) {
            ctx.translate(robot.x + robot.width, robot.y);
            ctx.scale(-1, 1);
            ctx.drawImage(walleImage, 0, 0, robot.width, robot.height);
        } else {
            ctx.drawImage(walleImage, robot.x, robot.y, robot.width, robot.height);
        }
    } else {
        ctx.fillStyle = isStunned ? '#f87171' : '#fbbf24';
        ctx.fillRect(robot.x, robot.y, robot.width, robot.height);
    }
    ctx.restore();

    if (isStunned) {
        ctx.font = 'bold 11px "Press Start 2P", monospace';
        ctx.fillStyle = '#facc15';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ TRAVADO!', robot.x + robot.width / 2, Math.max(16, robot.y - 8));
        ctx.textAlign = 'start';
    }

    floatingTexts.forEach((ft) => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.font = 'bold 13px "Press Start 2P", monospace';
        ctx.fillStyle = ft.color;
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
    });

    ctx.restore();
}

function startGame() {
    score = 0;
    timeSeconds = 0;
    isGameOver = false;
    isStunned = false;
    comboStreak = 0;
    doublePointsUntil = 0;
    shakeFrames = 0;
    floatingTexts = [];
    clearTimeout(stunTimeout);

    robot.x = 280;
    robot.y = 180;
    items = [];
    villains = [];

    gameOverScreen.style.display = 'none';
    comboBadge.style.display = 'none';

    spawnExplosiveBattery();
    hidePlantBoot();
    addVillain();

    scoreDisplay.textContent = score;
    arcade1Up.textContent = '0000';
    timerDisplay.textContent = MAX_TIME - timeSeconds;

    for (let i = 0; i < 4; i++) spawnTrash();

    clearInterval(gameInterval);
    clearInterval(timerInterval);

    gameInterval = setInterval(updateGame, 1000 / 60);

    timerInterval = setInterval(() => {
        timeSeconds++;
        const remainingTime = Math.max(0, MAX_TIME - timeSeconds);
        timerDisplay.textContent = remainingTime;

        if (remainingTime > 0 && remainingTime <= 10) {
            sfx.tick();
            timerDisplay.style.color = '#f87171';
        }

        if (timeSeconds % 20 === 0 && villains.length < 4) {
            addVillain();
        }

        if (timeSeconds >= MAX_TIME) {
            endGame('O tempo da missão esgotou!');
        }
    }, 1000);
}

async function endGame(reason = 'Fim de partida!') {
    if (isGameOver) return;
    isGameOver = true;
    isStunned = false;
    clearTimeout(stunTimeout);
    sfx.gameOver();
    
    clearInterval(gameInterval);
    clearInterval(timerInterval);
    
    const timeSurvived = Math.min(timeSeconds, MAX_TIME);
    timerDisplay.textContent = 0;

    gameOverReason.textContent = reason;
    finalScoreDisplay.textContent = score;
    finalTimeDisplay.textContent = timeSurvived;
    finalRankDisplay.textContent = 'Calculando...';
    gameOverScreen.style.display = 'flex';

    try {
        const res = await fetch(`${API_URL}/score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser, score, time: timeSurvived })
        });
        const data = await res.json();

        if (res.ok && data.rank) {
            const badge = data.updated ? ' (Novo Recorde!)' : '';
            finalRankDisplay.textContent = `#${data.rank}º de ${data.totalPlayers}${badge}`;
        } else {
            finalRankDisplay.textContent = '-';
        }

        loadLeaderboard();
        if (adminOverlay.style.display === 'flex') loadPlayers();
    } catch (err) {
        console.error('Erro ao salvar pontuação:', err);
        finalRankDisplay.textContent = 'Erro ao obter';
    }
}

btnRestart.addEventListener('click', () => {
    initAudio();
    startGame();
});

loadLeaderboard();