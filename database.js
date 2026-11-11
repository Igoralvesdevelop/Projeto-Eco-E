const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',      // Ajuste se o seu usuário MySQL for diferente
    password: '',      // Insira a senha do seu MySQL aqui
    database: 'eco_game',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function initDb() {
    try {
        const connection = await pool.getConnection();
        
        // Tabela de jogadores garantindo que high_score e best_time padrão sejam 0
        await connection.query(`
            CREATE TABLE IF NOT EXISTS players (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                high_score INT DEFAULT 0,
                best_time INT DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabela de histórico de partidas
        await connection.query(`
            CREATE TABLE IF NOT EXISTS matches (
                id INT AUTO_INCREMENT PRIMARY KEY,
                player_id INT NOT NULL,
                score INT NOT NULL,
                time_seconds INT NOT NULL,
                played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
            )
        `);

        console.log('⚡ Conectado e tabelas verificadas no MySQL (eco_game).');
        connection.release();
    } catch (err) {
        console.error('❌ Erro ao conectar/inicializar MySQL:', err.message);
    }
}

initDb();

module.exports = pool;