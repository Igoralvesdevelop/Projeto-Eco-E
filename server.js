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

// Registra partida e atualiza o recorde SEM ZERAR o anterior
app.post('/api/score', async (req, res) => {
    const { username, score, time } = req.body;

    try {
        const [players] = await db.query('SELECT id, high_score, best_time FROM players WHERE username = ?', [username]);
        if (players.length === 0) return res.status(404).json({ error: 'Jogador não encontrado' });

        const player = players[0];
        const currentHighScore = player.high_score || 0;
        const currentBestTime = player.best_time || 0;

        // Salva histórico da partida
        await db.query('INSERT INTO matches (player_id, score, time_seconds) VALUES (?, ?, ?)', [player.id, score, time]);

        // Avalia se o resultado atual é melhor que o armazenado
        const isBetterScore = score > currentHighScore;
        const isEqualScoreBetterTime = (score === currentHighScore && time > currentBestTime);

        if (isBetterScore || isEqualScoreBetterTime) {
            const newScore = Math.max(score, currentHighScore);
            const newTime = isBetterScore ? time : Math.max(time, currentBestTime);

            await db.query(
                'UPDATE players SET high_score = ?, best_time = ? WHERE id = ?',
                [newScore, newTime, player.id]
            );

            return res.json({ updated: true, newHighScore: newScore, newBestTime: newTime });
        }

        res.json({ updated: false, high_score: currentHighScore, best_time: currentBestTime });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/leaderboard', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT username, 
                   COALESCE(high_score, 0) AS high_score, 
                   COALESCE(best_time, 0) AS best_time 
            FROM players 
            ORDER BY high_score DESC, best_time DESC 
            LIMIT 10
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------- OPERAÇÕES CRUD DE JOGADORES ----------------

// Listar todos os jogadores sem permitir valores nulos no retorno
app.get('/api/players', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT id, username, 
                   COALESCE(high_score, 0) AS high_score, 
                   COALESCE(best_time, 0) AS best_time, 
                   created_at 
            FROM players 
            ORDER BY id DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Atualiza EXCLUSIVAMENTE o nome de usuário e a senha (não altera pontuação nem tempo)
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

// Excluir um jogador por ID
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