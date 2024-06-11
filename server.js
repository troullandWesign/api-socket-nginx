const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

let users = [];

wss.on('connection', ws => {
    console.log('Client connected');
    let userId = uuidv4();
    let userData;

    ws.on('message', message => {
        try {
            const data = JSON.parse(message);
            if (data.disconnect) {
                users = users.filter(user => user.id !== data.id);
                broadcastUsers();
            } else {
                userData = { ...data, id: userId };
                users = users.filter(user => user.id !== userId);
                users.push(userData);
                broadcastUsers();
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
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
    console.log(`Server is running on port ${PORT}`);

});
