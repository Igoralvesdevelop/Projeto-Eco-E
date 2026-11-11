// Usar caminho relativo para funcionar tanto em localhost quanto no Ngrok sem quebrar no celular
const API_URL = '/api';

// Elementos HTML
const authSection = document.getElementById('auth-section');
const gameSection = document.getElementById('game-section');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const btnLogin = document.getElementById('btn-login');
const btnRestart = document.getElementById('btn-restart');
const userDisplay = document.getElementById('user-display');
const scoreDisplay = document.getElementById('score');
const timerDisplay = document.getElementById('timer');
const leaderboardList = document.getElementById('leaderboard-list');
const btnLoadPlayers = document.getElementById('btn-load-players');
const playersList = document.getElementById('players-list');

// Modal
const editModal = document.getElementById('edit-modal');
const editPlayerId = document.getElementById('edit-player-id');
const editUsername = document.getElementById('edit-username');
const editPassword = document.getElementById('edit-password');
const btnSaveEdit = document.getElementById('btn-save-edit');
const btnCancelEdit = document.getElementById('btn-cancel-edit');

// Canvas
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const walleImage = new Image();
walleImage.src = 'imagens/walle.png';

let currentUser = null;
let score = 0;
let timeSeconds = 0;
const MAX_TIME = 60;
let gameInterval = null;
let timerInterval = null;
let isGameOver = false;
let facingRight = true;

const robot = {
    x: 280,
    y: 180,
    width: 45,
    height: 45,
    speed: 5
};

let viruses = [];

const trashTypes = [
    { name: 'Placa-Mãe', icon: '📟', points: 1 },
    { name: 'Monitor Antigo', icon: '🖥️', points: 1 },
    { name: 'Bateria Líquida', icon: '🔋', points: 2 },
    { name: 'Teclado Quebrado', icon: '⌨️', points: 1 },
    { name: 'Notebook Velho', icon: '💻', points: 2 },
    { name: 'Celular Antigo', icon: '📱', points: 1 },
    { name: 'Disquete / HD', icon: '💾', points: 1 },
    { name: 'TV de Tubo', icon: '📺', points: 3 }
];

let items = [];
const keys = {};

// Teclas do Teclado
window.addEventListener('keydown', (e) => keys[e.code] = true);
window.addEventListener('keyup', (e) => keys[e.code] = false);

// CONTROLES TOUCH PARA CELULAR (D-PAD)
function setupTouchButton(buttonId, keyCode) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    const startAction = (e) => {
        e.preventDefault();
        keys[keyCode] = true;
    };

    const stopAction = (e) => {
        e.preventDefault();
        keys[keyCode] = false;
    };

    btn.addEventListener('touchstart', startAction);
    btn.addEventListener('touchend', stopAction);
    btn.addEventListener('mousedown', startAction);
    btn.addEventListener('mouseup', stopAction);
}

setupTouchButton('btn-up', 'KeyW');
setupTouchButton('btn-down', 'KeyS');
setupTouchButton('btn-left', 'KeyA');
setupTouchButton('btn-right', 'KeyD');

// ---------------- AUTENTICAÇÃO & RANKING ----------------

btnLogin.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) return alert('Preencha os campos!');

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
            authSection.style.display = 'none';
            gameSection.style.display = 'block';
            startGame();
        } else {
            alert(data.error);
        }
    } catch (err) {
        alert('Erro ao conectar ao servidor.');
    }
});

async function loadLeaderboard() {
    try {
        const res = await fetch(`${API_URL}/leaderboard`);
        const data = await res.json();
        leaderboardList.innerHTML = '';
        data.forEach(player => {
            const li = document.createElement('li');
            const hScore = player.high_score ?? 0;
            const bTime = player.best_time ?? 0;
            li.textContent = `${player.username} - ${hScore} pts (${bTime}s)`;
            leaderboardList.appendChild(li);
        });
    } catch (err) {
        console.error('Erro ao carregar ranking:', err);
    }
}

// ---------------- GERENCIAMENTO CRUD ----------------

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
                    <button class="btn-delete" onclick="deletePlayer(${p.id})">X</button>
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

// ---------------- LÓGICA DE SPAWN E VÍRUS ----------------

function spawnTrash() {
    if (items.length < 6) {
        const type = trashTypes[Math.floor(Math.random() * trashTypes.length)];
        items.push({
            x: Math.random() * (canvas.width - 35),
            y: Math.random() * (canvas.height - 35),
            size: 25,
            ...type
        });
    }
}

function addVirus() {
    if (viruses.length >= 4) return;

    viruses.push({
        id: Date.now() + Math.random(),
        x: Math.random() * (canvas.width - 40) + 10,
        y: Math.random() * (canvas.height - 40) + 10,
        size: 26,
        speedX: (Math.random() > 0.5 ? 1 : -1) * (3 + Math.random() * 2),
        speedY: (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 2),
        icon: '👾'
    });
}

function updateViruses() {
    viruses.forEach((v) => {
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
            v.x = Math.random() * (canvas.width - 40) + 10;
            v.y = Math.random() * (canvas.height - 40) + 10;

            timerDisplay.style.color = '#e74c3c';
            setTimeout(() => timerDisplay.style.color = '#fff', 400);

            if (timeSeconds >= MAX_TIME) {
                endGame();
            }
        }
    });
}

// ---------------- LOOP DO JOGO ----------------

function updateGame() {
    if (isGameOver) return;

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

    updateViruses();

    items.forEach((item, index) => {
        if (
            robot.x < item.x + item.size &&
            robot.x + robot.width > item.x &&
            robot.y < item.y + item.size &&
            robot.y + robot.height > item.y
        ) {
            items.splice(index, 1);
            score += item.points;
            scoreDisplay.textContent = score;
            spawnTrash();
        }
    });

    draw();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (walleImage.complete && walleImage.naturalWidth !== 0) {
        ctx.save();
        if (!facingRight) {
            ctx.translate(robot.x + robot.width, robot.y);
            ctx.scale(-1, 1);
            ctx.drawImage(walleImage, 0, 0, robot.width, robot.height);
        } else {
            ctx.drawImage(walleImage, robot.x, robot.y, robot.width, robot.height);
        }
        ctx.restore();
    } else {
        ctx.fillStyle = '#00fff5';
        ctx.fillRect(robot.x, robot.y, robot.width, robot.height);
    }

    ctx.font = '24px Arial';
    viruses.forEach(v => {
        ctx.fillText(v.icon, v.x, v.y + 20);
    });

    items.forEach(item => {
        ctx.font = '22px Arial';
        ctx.fillText(item.icon, item.x, item.y + 20);
    });
}

function startGame() {
    score = 0;
    timeSeconds = 0;
    isGameOver = false;
    robot.x = 280;
    robot.y = 180;
    items = [];
    viruses = [];

    addVirus();

    scoreDisplay.textContent = score;
    timerDisplay.textContent = MAX_TIME - timeSeconds;
    btnRestart.style.display = 'none';

    for (let i = 0; i < 4; i++) spawnTrash();

    clearInterval(gameInterval);
    clearInterval(timerInterval);

    gameInterval = setInterval(updateGame, 1000 / 60);

    timerInterval = setInterval(() => {
        timeSeconds++;
        const remainingTime = Math.max(0, MAX_TIME - timeSeconds);
        timerDisplay.textContent = remainingTime;

        if (timeSeconds % 20 === 0 && viruses.length < 4) {
            addVirus();
        }

        if (timeSeconds >= MAX_TIME) {
            endGame();
        }
    }, 1000);
}

async function endGame() {
    if (isGameOver) return;
    isGameOver = true;
    
    clearInterval(gameInterval);
    clearInterval(timerInterval);
    
    const timeSurvived = Math.min(timeSeconds, MAX_TIME);
    timerDisplay.textContent = 0;

    alert(`Fim de jogo! Você fez ${score} pontos coletando lixo de TI em ${timeSurvived}s.`);
    btnRestart.style.display = 'inline-block';

    try {
        await fetch(`${API_URL}/score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser, score, time: timeSurvived })
        });
        loadLeaderboard();
        loadPlayers();
    } catch (err) {
        console.error('Erro ao salvar pontuação:', err);
    }
}

btnRestart.addEventListener('click', startGame);

loadLeaderboard();
loadPlayers();