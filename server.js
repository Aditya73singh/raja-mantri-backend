const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins (change this for security in production)
        methods: ["GET", "POST"]
    }
});

app.use(cors());

const players = {}; // Stores player data

io.on("connection", (socket) => {
    console.log(`✅ Player connected: ${socket.id}`);

    socket.on("joinGame", (playerName) => {
        console.log(`🟢 Player Joined: ${playerName} (${socket.id})`);

        if (Object.keys(players).length < 4) {
            players[socket.id] = {
                id: socket.id,
                name: playerName,
                role: "",
                points: 0
            };

            io.emit("updatePlayers", players); // Broadcast to all players
            socket.emit("joinedSuccessfully", { playerName, playerId: socket.id });
        } else {
            socket.emit("gameFull", "❌ Game is full! Try again later.");
        }
    });

    socket.on("disconnect", () => {
        console.log(`❌ Player disconnected: ${socket.id}`);
        delete players[socket.id];
        io.emit("updatePlayers", players); // Update all clients
    });
});

app.get("/", (req, res) => {
    res.send("🎮 Raja Mantri Game Server is Running!");
});

server.listen(5000, () => {
    console.log("🚀 Server is running on port 5000");
});
