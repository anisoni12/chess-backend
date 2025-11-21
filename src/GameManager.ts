import { WebSocket } from "ws";
import { INIT_GAME, MOVE, RESIGN, DRAW_OFFER, DRAW_RESPONSE, TIME_CONTROL, SET_USERNAME } from "./messages.js";
import { Game } from "./Game.js";

interface PendingUser {
    socket: WebSocket;
    timeControl: number;
    username: string;   // Add username
}

interface UserInfo {
    socket: WebSocket;
    username: string;
}

export class GameManager {
    private games: Game[];
    private pendingUsers: PendingUser[];
    private users: WebSocket[];
    private usernames: Map<WebSocket, string>;  //Username Map

    constructor() {
        this.games = [];
        this.pendingUsers = [];
        this.users = [];
        this.usernames = new Map();
    }

    addUser(socket: WebSocket) {
        this.users.push(socket);
        this.addHandler(socket);
    }

    removeUser(socket: WebSocket) {
        this.users = this.users.filter(user => user !== socket);

        // Remove usernames
        this.usernames.delete(socket);

        // Remove from pending users
        this.pendingUsers = this.pendingUsers.filter((u) => u.socket !== socket);


        // Find and end any active game this user is in
        const game = this.games.find(game =>
            game.player1 === socket || game.player2 === socket
        );

        if (game) {
            console.log("Player disconnected from active game");
            const opponent = game.player1 === socket ? game.player2 : game.player1;
            opponent.send(JSON.stringify({
                type: "opponent_disconnected",
                payload: {
                    message: "Your opponent has disconnected"
                }
            }));

            // Remove the game from active games
            this.games = this.games.filter(g => g !== game);
        }
        console.log("User disconnected, Total users:", this.users.length);
    }

    private addHandler(socket: WebSocket) {
        let userTimeControl = 600; // default game 10 minutes 
        let username = "Guest";     // Default Username

        socket.on("message", (data) => {
            const message = JSON.parse(data.toString());
            console.log("Message received:", message.type);

            // 👤 SET USERNAME HANDLER
            if (message.type === SET_USERNAME) {
                username = message.payload.username || "Guest";
                this.usernames.set(socket, username);
                console.log(`Username set: ${username}`);
                return;
            }

            // TIMER CONTROL SELECTION
            if (message.type === TIME_CONTROL) {
                userTimeControl = message.payload.timeControl;
                console.log("Time control set to:", userTimeControl, "seconds");
                return;
            }

            if (message.type === INIT_GAME) {
                // Check if user is already in a game
                const existingGame = this.games.find((game) =>
                    game.player1 === socket || game.player2 === socket
                );

                if (existingGame) {
                    console.log("User already in a game!");
                    socket.send(JSON.stringify({
                        type: "error",
                        payload: { message: "You are already in a game" }
                    }));
                    return;
                }

                // Check if user is already waiting
                if (this.pendingUsers.find((u) => u.socket === socket)) {
                    console.log("User already waiting for opponent!");
                    return;
                }

                // get username from map 
                const currentUsername = this.usernames.get(socket) || username;


                // ⏱️ Try to match with pending user of SAME time control
                const matchingUser = this.pendingUsers.find(
                    (u) => u.timeControl === userTimeControl
                );

                if (matchingUser) {
                    console.log(
                        `Starting Game - ${matchingUser.username} vs ${currentUsername}`
                    );

                    // 👤 CREATE GAME WITH USERNAMES
                    const game = new Game(
                        matchingUser.socket,
                        socket,
                        userTimeControl,
                        matchingUser.username,
                        currentUsername
                    );

                    this.games.push(game);

                    // Remove matched user from pending
                    this.pendingUsers = this.pendingUsers.filter(
                        (u) => u.socket !== matchingUser.socket
                    );
                } else {
                    console.log(
                        `${currentUsername} waiting for opponent with same time control...`
                    );

                    // 👤 Add to pending with username
                    this.pendingUsers.push({
                        socket: socket,
                        timeControl: userTimeControl,
                        username: currentUsername,
                    });

                    socket.send(
                        JSON.stringify({
                            type: "waiting",
                            payload: {
                                message: "Waiting for opponent...",
                            },
                        })
                    );
                }
            }


            if (message.type === MOVE) {
                console.log("Move request received")
                const game = this.games.find((game) => game.player1 === socket || game.player2 === socket);

                if (game) {
                    console.log("Processing move...");
                    game.makeMove(socket, message.payload);
                } else {
                    console.log("No active game found for this user");
                    socket.send(JSON.stringify({
                        type: "error",
                        payload: { message: "You are not in an active game" }
                    }));
                }
            }

            // RESIGN HANDLER
            if (message.type === RESIGN) {
                console.log("Resign request received");

                const game = this.games.find((game) =>
                    game.player1 === socket || game.player2 === socket
                );

                if (game) {
                    console.log("Player resigned from active game");
                    game.resign(socket);

                    // Remove game from active games 
                    this.games = this.games.filter((g) => g !== game);
                } else {
                    console.log("No active game found for resign");
                    socket.send(JSON.stringify({
                        type: "error",
                        payload: { message: "You are not in an active game" },
                    }));
                }
            }

            // DRAW OFFER HANDLER
            if (message.type === DRAW_OFFER) {
                console.log("Draw offer received");

                const game = this.games.find((game) =>
                    game.player1 === socket || game.player2 === socket
                );

                if (game) {
                    console.log("Sending draw offer to opponent...");
                    game.offerDraw(socket);
                } else {
                    console.log("No active game found for draw offer");
                    socket.send(JSON.stringify({
                        type: "error",
                        payload: { message: "You are not in an active game" }
                    }));
                }
            }

            // DRAW RESPONSE HANDLER
            if (message.type === DRAW_RESPONSE) {
                console.log("Draw response received:", message.payload.accepted);

                const game = this.games.find((game) =>
                    game.player1 === socket || game.player2 === socket
                );

                if (game) {
                    game.respondToDraw(socket, message.payload.accepted);

                    // If accepted, remove game
                    if (message.payload.accepted) {
                        this.games = this.games.filter((g) => g !== game);
                    }
                }
            }

        });
    }
}