import { WebSocket } from "ws";
import { Chess } from "chess.js";
import { GAME_OVER, INIT_GAME, MOVE, DRAW_OFFER, DRAW_RESPONSE, TIME_UPDATE } from "./messages.js";

export class Game {
  public player1: WebSocket;
  public player2: WebSocket;
  public board: Chess;
  private moves: string[];
  private startTime: Date;

  // TIMER PROPERTIES 
  private whiteTime: number;
  private blackTime: number;
  private lastMoveTime: number;
  private timeInterval: NodeJS.Timeout | null = null;

  // Player Profile Properties 
  public player1Username: string;
  public player2Username: string;

  constructor(player1: WebSocket, player2: WebSocket, timeControl: number = 600, player1Username: string = "Player1", player2Username: string = "Player2") {
    this.player1 = player1;
    this.player2 = player2;
    this.board = new Chess();
    this.moves = [];
    this.startTime = new Date();

    // Initialize timers (default 10 minutes = 600 seconds )
    this.whiteTime = timeControl;
    this.blackTime = timeControl;
    this.lastMoveTime = Date.now();

    // store usernames
    this.player1Username = player1Username;
    this.player2Username = player2Username;

    this.player1.send(
      JSON.stringify({
        type: INIT_GAME,
        payload: {
          color: "white",
          timeControl: this.whiteTime,
          whitePlayer: this.player1Username,
          blackPlayer: this.player2Username,
        },
      })
    );
    this.player2.send(
      JSON.stringify({
        type: INIT_GAME,
        payload: {
          color: "black",
          timeControl: this.blackTime,
          whitePlayer: this.player1Username,
          blackPlayer: this.player2Username,
        },
      })
    );

    // start the timer 
    this.startTimer();
    console.log(
      `Game created: ${this.player1Username} (white) vs ${this.player2Username} (black)`
    );
  }


  // START TIMER 
  private startTimer() {
    this.timeInterval = setInterval(() => {
      const currentTime = Date.now();
      const elapsedSeconds = Math.floor((currentTime - this.lastMoveTime) / 1000);

      // Deduct time from current player
      if (this.board.turn() === "w") {
        this.whiteTime = Math.max(0, this.whiteTime - elapsedSeconds);
      } else {
        this.blackTime = Math.max(0, this.blackTime - elapsedSeconds);
      }

      this.lastMoveTime = currentTime;
      // Send time update to both players
      this.broadcastTimeUpdate();

      // Check for timeout
      if (this.whiteTime <= 0) {
        this.handleTimeout("white");
      } else if (this.blackTime <= 0) {
        this.handleTimeout("black");
      }
    }, 1000);
  }

  private stopTimer() {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
      this.timeInterval = null;
    }
  }

  private broadcastTimeUpdate() {
    const timeMessage = JSON.stringify({
      type: TIME_UPDATE,
      payload: {
        whiteTime: this.whiteTime,
        blackTime: this.blackTime,
      },
    });

    this.player1.send(timeMessage);
    this.player2.send(timeMessage);
  }

  // HANDLE TIMEOUT (player runs out of time)
  private handleTimeout(color: "white" | "black") {
    this.stopTimer();

    const winner = color === "white" ? "black" : "white";

    const gameOverMessage = JSON.stringify({
      type: GAME_OVER,
      payload: {
        winner: winner,
        reason: "timeout",
      },
    });

    this.player1.send(gameOverMessage);
    this.player2.send(gameOverMessage);

    console.log(`${color} ran out of time! ${winner} wins!`);
  }

  makeMove(
    socket: WebSocket,
    move: {
      from: string;
      to: string;
      promotion?: string;
    }) {

    // FIXED: Use board.turn() instead of moveCount % 2
    // Player1 is WHITE ('w'), Player2 is BLACK ('b')
    if (this.board.turn() === "w" && socket !== this.player1) {
      console.log("Not white's turn");
      return;
    }

    if (this.board.turn() === "b" && socket !== this.player2) {
      console.log("Not black's turn");
      return;
    }

    // TRY TO MAKE THE MOVE
    try {
      this.board.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion || 'q'
      });
      console.log("Move successful:", move);

      // Reset move timer
      this.lastMoveTime = Date.now();

      const moveMessage = JSON.stringify({
        type: MOVE,
        payload: { move },
      });

      this.player1.send(moveMessage);
      this.player2.send(moveMessage);

      // Check for checkmate or stalemate
      if (this.board.isGameOver()) {
        this.stopTimer(); // ⏱️ Stop timer on game over

        let winner = "draw";
        let reason = "stalemate";

        if (this.board.isCheckmate()) {
          winner = this.board.turn() === "w" ? "black" : "white";
          reason = "checkmate";
        }

        const gameOverMessage = JSON.stringify({
          type: GAME_OVER,
          payload: { winner, reason },
        });

        this.player1.send(gameOverMessage);
        this.player2.send(gameOverMessage);

        console.log("Game over:", winner, reason);
      }
    } catch (e) {
      console.log("Invalid move:", e);
      socket.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Invalid move" },
        })
      );
    }
  }


  // RESIGN METHOD 
  resign(socket: WebSocket) {
    this.stopTimer();   //Stop timer on resignation

    const winner = socket === this.player1 ? "black" : "white";

    const gameOverMessage = JSON.stringify({
      type: GAME_OVER,
      payload: {
        winner: winner,
        reason: "resignation",
      },
    });


    this.player1.send(gameOverMessage);
    this.player2.send(gameOverMessage);

    console.log((`${winner} wins by resignation`));
  }

  // DRAW METHOD 
  offerDraw(socket: WebSocket) {

    const opponent = socket === this.player1 ? this.player2 : this.player1;

    // Sends draw offer to opponent
    opponent.send(
      JSON.stringify({
        type: "draw_offer",
      })
    );

    console.log("Draw offer sent to opponent");
  }

  // METHOD TO HANDLE DRAW RESPONSE 
  respondToDraw(socket: WebSocket, accepted: boolean) {
    const opponent = socket === this.player1 ? this.player2 : this.player1;

    if (accepted) {
      this.stopTimer(); // stop timer 

      const gameOverMessage = JSON.stringify({
        type: GAME_OVER,
        payload: {
          winner: "draw",
          reason: "agreement",
        },
      });

      this.player1.send(gameOverMessage);
      this.player2.send(gameOverMessage);

      console.log("Draw accepted by both players");
    } else {
      opponent.send(
        JSON.stringify({
          type: "draw_declined",
        })
      );

      console.log("Draw offer declined");
    }
  }
}