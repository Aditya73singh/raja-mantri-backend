const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());

const players = {}; // Stores player data
const roles = ["Raja", "Mantri", "Chor", "Sipahi"];
const points = { Raja: 2000, Mantri: 900, Chor: 0, Sipahi: 700 };

function assignRoles() {
    const playerIds = Object.keys(players);
    const shuffledRoles = roles.sort(() => Math.random() - 0.5); // Shuffle roles

    playerIds.forEach((playerId, index) => {
        players[playerId].role = shuffledRoles[index];
        players[playerId].points = points[shuffledRoles[index]];
    });

    io.emit("gameStarted", players); // Notify all players that the game has started
}

io.on("connection", (socket) => {
    console.log(`✅ Player connected: ${socket.id}`);

    socket.on("joinGame", (playerName, callback) => {
        console.log(`🟢 Received joinGame event for: ${playerName} (Socket ID: ${socket.id})`);

        if (Object.keys(players).length < 4) {
            players[socket.id] = {
                id: socket.id,
                name: playerName,
                role: "",
                points: 0
            };

            io.emit("updatePlayers", players); // Broadcast player list
            callback({ success: true, message: "Joined successfully!" });

            // ✅ Start game when 4 players join
            if (Object.keys(players).length === 4) {
                console.log("🎮 4 Players Joined! Starting the Game...");
                assignRoles();
            }
        } else {
            console.log("❌ Game is full!");
            callback({ success: false, message: "Game is full! Try again later." });
        }
    });

    socket.on("disconnect", () => {
        console.log(`❌ Player disconnected: ${socket.id}`);
        delete players[socket.id];
        io.emit("updatePlayers", players);
    });
});

app.get("/", (req, res) => {
    res.send("🎮 Raja Mantri Game Server is Running!");
});

server.listen(5000, () => {
    console.log("🚀 Server is running on port 5000");
});
