import { WebSocket } from "ws";
export declare class GameManager {
    private games;
    private pendingUsers;
    private users;
    private usernames;
    constructor();
    addUser(socket: WebSocket): void;
    removeUser(socket: WebSocket): void;
    private addHandler;
}
//# sourceMappingURL=GameManager.d.ts.map