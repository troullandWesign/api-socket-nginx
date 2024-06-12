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
        console.error('Erreur de connexion à MySQL :', err);
        return;
    }
    console.log('Connecté à MySQL');
});

app.use(express.static('public'));
app.use(express.json());

// Route POST pour ajouter un nouvel utilisateur
app.post('/users', (req, res) => {
    const { name, position } = req.body;
    const { lat, lon } = position;

    db.query('INSERT INTO users (username, latitude, longitude) VALUES (?, ?, ?)', [name, lat, lon], (err, result) => {
        if (err) {
            res.status(500).json({ error: 'Erreur de base de données' });
            return;
        }
        res.status(201).json({ message: 'Utilisateur ajouté', user: { id: result.insertId, username: name, latitude: lat, longitude: lon } });
        broadcastUsers();  // Diffuser la liste des utilisateurs mise à jour après l'ajout d'un nouvel utilisateur
    });
});

// Route GET pour récupérer tous les utilisateurs
app.get('/users', (req, res) => {
    db.query('SELECT * FROM users', (err, results) => {
        if (err) {
            res.status(500).json({ error: 'Erreur de base de données' });
            return;
        }
        res.json(results);
    });
});

// Route DELETE pour supprimer un utilisateur par ID
app.delete('/users/:id', (req, res) => {
    const userId = req.params.id;
    db.query('DELETE FROM users WHERE id = ?', userId, (err, result) => {
        if (err) {
            console.error('Erreur de suppression de l\'utilisateur :', err);
            res.status(500).json({ error: 'Erreur de base de données' });
            return;
        }
        res.json({ message: 'Utilisateur supprimé avec succès' });
        broadcastUsers();  // Diffuser la liste des utilisateurs mise à jour après la suppression d'un utilisateur
    });
});

let users = [];

// Gestion des connexions WebSocket
wss.on('connection', ws => {
    console.log('Client connecté');
    let userId;
    let userData;

    // Gestion des messages reçus via WebSocket
    ws.on('message', message => {
        const data = JSON.parse(message);

        // Authentification de l'utilisateur
        if (data.type === 'authenticate') {
            userId = data.userId;
            db.query('SELECT * FROM users WHERE id = ?', [userId], (err, result) => {
                if (err || result.length === 0) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Authentification échouée' }));
                    ws.close();
                    return;
                }

                userData = result[0];
                users.push(userData);

                ws.send(JSON.stringify({ type: 'authenticated', user: userData, users: users }));
                broadcastUsers();
            });
        }
    });

    // Gestion de la déconnexion d'un client
    ws.on('close', () => {
        console.log('Client déconnecté');
        if (userData) {
            users = users.filter(user => user.id !== userData.id);
            broadcastUsers(userData.id); // Passez l'ID de l'utilisateur déconnecté
        }
    });

    ws.on('error', error => {
        console.error('Erreur WebSocket :', error);
    });
});

// Fonction pour diffuser la liste des utilisateurs à tous les clients WebSocket
function broadcastUsers(excludedUserId) {
    db.query('SELECT * FROM users', (err, results) => {
        if (err) {
            console.error('Erreur de récupération des utilisateurs :', err);
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

// Démarrage du serveur sur le port 3000
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Le serveur fonctionne sur le port ${PORT}`);
});
