const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const mysql = require('mysql');

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

app.use(express.static('public'));
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

let users = [];

wss.on('connection', ws => {
    console.log('Client connected');
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
    ws.on('close', () => {
        console.log('Client disconnected');
        if (userData) {
            users = users.filter(user => user.id !== userId);
            broadcastUsers();
        }
    });

    ws.on('error', error => {
        console.error('WebSocket error:', error);
    });
});

function broadcastUsers() {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(users));
        }
    });
}

const PORT = 3000;
server.listen(PORT, () => {
    console.log('Server is running on port'. $PORT);
});
