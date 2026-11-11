-- Criação da base de dados se não existir
CREATE DATABASE IF NOT EXISTS eco_game;
USE eco_game;

-- Tabela de Jogadores (players)
CREATE TABLE IF NOT EXISTS players (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    high_score INT DEFAULT 0,
    best_time INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Historico de Partidas (matches)
CREATE TABLE IF NOT EXISTS matches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NOT NULL,
    score INT NOT NULL,
    time_seconds INT NOT NULL,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- Índice para otimizar as consultas do Hall dos Melhores
CREATE INDEX idx_ranking ON players (high_score DESC, best_time DESC);