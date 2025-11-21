import { WebSocketServer } from 'ws';
import { GameManager } from './GameManager.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;

const wss = new WebSocketServer({ port: PORT });

const gameManager = new GameManager();

wss.on('connection', function connection(ws) {
    gameManager.addUser(ws);

    ws.on("close", () => gameManager.removeUser(ws));
}); 

console.log(`WebSocket server running on port ${PORT}`);