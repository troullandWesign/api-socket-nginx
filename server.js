const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const mysql = require('mysql');

// Charger les certificats SSL
const privateKey = fs.readFileSync('/etc/letsencrypt/live/thomas.roulland.caen.mds-project.fr/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/thomas.roulland.caen.mds-project.fr/fullchain.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };

// Configuration de la connexion MySQL
const db = mysql.createConnection({
    host: '195.110.35.218',
    user: 'root',
    password: '',
    database: 'api_users',
});

db.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL');
});

const app = express();
const httpServer = http.createServer(app);
const httpsServer = https.createServer(credentials, app);
const wss = new WebSocket.Server({ server: httpsServer });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API RESTful pour gérer les utilisateurs
app.post('/users', (req, res) => {
    const { name, position } = req.body;
    const { lat, lon } = position;

    db.query('INSERT INTO users (username, latitude, longitude) VALUES (?, ?, ?)', [name, lat, lon], (err, result) => {
        if (err) {
            res.status(500).json({ error: 'Database error' });
            return;
        }
        res.status(201).json({ message: 'User added', user: { id: result.insertId, username: name, latitude: lat, longitude: lon } });
    });
});

app.get('/users', (req, res) => {
    db.query('SELECT * FROM users', (err, results) => {
        if (err) {
            res.status(500).json({ error: 'Database error' });
            return;
        }
        res.json(results);
    });
});

app.delete('/users/:id', (req, res) => {
    const userId = req.params.id;
    db.query('DELETE FROM users WHERE id = ?', userId, (err, result) => {
        if (err) {
            console.error('Error deleting user:', err);
            res.status(500).json({ error: 'Database error' });
            return;
        }
        res.json({ message: 'User deleted successfully' });
    });
});

// WebSocket pour la communication en temps réel
wss.on('connection', (ws) => {
    // Envoyer la liste initiale des utilisateurs
    db.query('SELECT * FROM users', (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return;
        }

        const users = results.map(user => ({
            username: user.username,
            position: { lat: user.latitude, lon: user.longitude }
        }));

        ws.send(JSON.stringify({ users }));
    });

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        const { name, position } = data;
        const { lat, lon } = position;

        db.query('UPDATE users SET latitude = ?, longitude = ? WHERE username = ?', [lat, lon, name], (err, result) => {
            if (err) {
                console.error('Database error:', err);
                return;
            }

            // Diffuser la mise à jour à tous les clients connectés
            db.query('SELECT * FROM users', (err, results) => {
                if (err) {
                    console.error('Database error:', err);
                    return;
                }

                const users = results.map(user => ({
                    username: user.username,
                    position: { lat: user.latitude, lon: user.longitude }
                }));

                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ users }));
                    }
                });
            });
        });
    });
});

const PORT = 3000;
const SSL_PORT = 3443;

httpServer.listen(PORT, () => {
    console.log(`HTTP Server is running on http://thomas.roulland.caen.mds-project.fr:${PORT}`);
});

httpsServer.listen(SSL_PORT, () => {
    console.log(`HTTPS Server is running on https://thomas.roulland.caen.mds-project.fr:${SSL_PORT}`);
});
