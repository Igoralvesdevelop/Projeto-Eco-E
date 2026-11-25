const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------- AUTENTICAÇÃO E RANKING ----------------

app.post('/api/auth', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Preencha todos os campos' });

    try {
        const [rows] = await db.query('SELECT * FROM players WHERE username = ?', [username]);

        if (rows.length > 0) {
            const player = rows[0];
            if (player.password === password) {
                res.json({
                    message: 'Login bem-sucedido',
                    player: {
                        id: player.id,
                        username: player.username,
                        high_score: player.high_score || 0,
                        best_time: player.best_time || 0
                    }
                });
            } else {
                res.status(401).json({ error: 'Senha incorreta' });
            }
        } else {
            const [result] = await db.query(
                'INSERT INTO players (username, password, high_score, best_time) VALUES (?, ?, 0, 0)',
                [username, password]
            );
            res.json({
                message: 'Conta criada com sucesso',
                player: { id: result.insertId, username, high_score: 0, best_time: 0 }
            });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/score', async (req, res) => {
    const { username, score, time } = req.body;

    try {
        const [players] = await db.query('SELECT id, high_score, best_time FROM players WHERE username = ?', [username]);
        if (players.length === 0) return res.status(404).json({ error: 'Jogador não encontrado' });

        const player = players[0];
        const currentHighScore = player.high_score || 0;
        const currentBestTime = player.best_time || 0;

        await db.query('INSERT INTO matches (player_id, score, time_seconds) VALUES (?, ?, ?)', [player.id, score, time]);

        const isBetter = score > currentHighScore || (score === currentHighScore && time > currentBestTime);

        if (isBetter) {
            await db.query('UPDATE players SET high_score = ?, best_time = ? WHERE id = ?', [score, time, player.id]);
            res.json({ updated: true, newHighScore: score, newBestTime: time });
        } else {
            res.json({ updated: false });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/leaderboard', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT username, high_score, best_time 
            FROM players 
            ORDER BY high_score DESC, best_time DESC 
            LIMIT 10
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------- CRUD DE JOGADORES (PAINEL ADMIN) ----------------

// Listar todos os jogadores
app.get('/api/players', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, username, high_score, best_time, created_at FROM players ORDER BY id DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Atualizar apenas Nome e Senha (preservando high_score e best_time)
app.put('/api/players/:id', async (req, res) => {
    const { id } = req.params;
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Nome de usuário e senha são obrigatórios.' });
    }

    try {
        const [result] = await db.query(
            'UPDATE players SET username = ?, password = ? WHERE id = ?',
            [username, password, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Jogador não encontrado.' });
        }

        res.json({ message: 'Dados de acesso atualizados com sucesso!' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Este nome de usuário já está em uso.' });
        }
        res.status(500).json({ error: err.message });
    }
});

// Deletar jogador
app.delete('/api/players/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await db.query('DELETE FROM players WHERE id = ?', [id]);
        res.json({ message: 'Jogador removido com sucesso!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});