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

app.post('/users', (req, res) => {
    const { name, position } = req.body;
    const { lat, lon } = position;

    db.query('INSERT INTO users (username, latitude, longitude) VALUES (?, ?, ?)', [name, lat, lon], (err, result) => {
        if (err) {
            res.status(500).json({ error: 'Database error' });
            return;
        }
        res.status(201).json({ message: 'User added', user: { id: result.insertId, username: name, latitude: lat, longitude: lon } });
        broadcastUsers();  // Broadcast updated user list after adding a new user
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
        broadcastUsers();  // Broadcast updated user list after deleting a user
    });
});

let users = [];

wss.on('connection', ws => {
    console.log('Client connected');
    let userId;
    let userData;

    ws.on('message', message => {
        const data = JSON.parse(message);

        if (data.type === 'authenticate') {
            userId = data.userId;
            db.query('SELECT * FROM users WHERE id = ?', [userId], (err, result) => {
                if (err || result.length === 0) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
                    ws.close();
                    return;
                }

                userData = result[0];
                users.push(userData);

                ws.send(JSON.stringify({ type: 'authenticated', user: userData, users: users }));
                broadcastUsers();
            });
        } else if (data.type === 'updatePosition') {
            const { lat, lon } = data.position;
            db.query('UPDATE users SET latitude = ?, longitude = ? WHERE id = ?', [lat, lon, data.userId], err => {
                if (err) {
                    console.error('Error updating user position:', err);
                    return;
                }
                broadcastUsers();
            });
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        if (userData) {
            users = users.filter(user => user.id !== userData.id);
            broadcastUsers(userData.id); // Passez l'ID de l'utilisateur déconnecté
        }
    });

    ws.on('error', error => {
        console.error('WebSocket error:', error);
    });
});

function broadcastUsers(excludedUserId) {
    db.query('SELECT * FROM users', (err, results) => {
        if (err) {
            console.error('Error fetching users:', err);
            return;
        }
        const filteredUsers = results.filter(user => user.id !== excludedUserId);
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'update', users: filteredUsers }));
            }
        });
    });
}

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
