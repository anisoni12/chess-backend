import { WebSocket } from "ws";
import { Chess } from "chess.js";
export declare class Game {
    player1: WebSocket;
    player2: WebSocket;
    board: Chess;
    private moves;
    private startTime;
    private whiteTime;
    private blackTime;
    private lastMoveTime;
    private timeInterval;
    player1Username: string;
    player2Username: string;
    constructor(player1: WebSocket, player2: WebSocket, timeControl?: number, player1Username?: string, player2Username?: string);
    private startTimer;
    private stopTimer;
    private broadcastTimeUpdate;
    private handleTimeout;
    makeMove(socket: WebSocket, move: {
        from: string;
        to: string;
    }): void;
    resign(socket: WebSocket): void;
    offerDraw(socket: WebSocket): void;
    respondToDraw(socket: WebSocket, accepted: boolean): void;
}
//# sourceMappingURL=Game.d.ts.map