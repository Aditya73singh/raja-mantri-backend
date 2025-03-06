const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

app.use(cors()); // Allow frontend connections

const io = new Server(server, {
  cors: {
    origin: "*", // Change this to your frontend URL when deployed
    methods: ["GET", "POST"]
  }
});

// Define game variables
const roles = ["Raja", "Mantri", "Chor", "Sipahi"];
const points = { Raja: 2000, Mantri: 900, Chor: 0, Sipahi: 700 };
let players = {}; // Stores player data
let gameStarted = false;

// Handle player connection
io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Add player to game
  socket.on("joinGame", (name) => {
    if (Object.keys(players).length < 4) {
      players[socket.id] = { name, role: null, points: 0, totalPoints: 0 };
      console.log(`${name} joined the game.`);

      // Notify all players
      io.emit("updatePlayers", players);

      // Start game when 4 players join
      if (Object.keys(players).length === 4) {
        startGame();
      }
    }
  });

  // Assign roles randomly and start game
  function startGame() {
    let shuffledRoles = roles.sort(() => Math.random() - 0.5);
    let i = 0;

    for (let id in players) {
      players[id].role = shuffledRoles[i];
      players[id].points = points[shuffledRoles[i]];
      players[id].totalPoints += points[shuffledRoles[i]];
      i++;
    }

    gameStarted = true;
    io.emit("startGame", players);
  }

  // Handle Sipahi's guess
  socket.on("makeGuess", ({ sipahiId, guessedPlayerId }) => {
    let actualChor = Object.keys(players).find((id) => players[id].role === "Chor");
    let result;

    if (guessedPlayerId === actualChor) {
      result = { message: "Sipahi guessed correctly!" };
    } else {
      // Swap points
      let temp = players[sipahiId].points;
      players[sipahiId].points = players[actualChor].points;
      players[actualChor].points = temp;
      result = { message: "Sipahi guessed wrong! Points swapped." };
    }

    // Notify players about the round result
    io.emit("roundResult", { playerRoles: players, result });
  });

  // Handle player disconnection
  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);
    delete players[socket.id];

    // Reset game if a player leaves
    if (Object.keys(players).length < 4) {
      gameStarted = false;
      players = {};
      io.emit("gameReset");
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

