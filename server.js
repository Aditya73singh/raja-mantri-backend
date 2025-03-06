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

    // Find Sipahi & prompt them to guess
    const sipahi = playerIds.find(id => players[id].role === "Sipahi");
    if (sipahi) {
        io.to(sipahi).emit("yourTurnToGuess"); // Tell Sipahi it's their turn
    }
}

io.on("connection", (socket) => {
    console.log(`✅ Player connected: ${socket.id}`);

    socket.on("joinGame", (playerName, callback) => {
        console.log(`🟢 ${playerName} joined the game`);

        if (Object.keys(players).length < 4) {
            players[socket.id] = {
                id: socket.id,
                name: playerName,
                role: "",
                points: 0
            };

            io.emit("updatePlayers", players);
            callback({ success: true });

            if (Object.keys(players).length === 4) {
                console.log("🎮 4 Players Joined! Assigning roles...");
                assignRoles();
            }
        } else {
            callback({ success: false, message: "Game is full!" });
        }
    });

    // ✅ Handling Sipahi's Guess
    socket.on("sipahiGuess", (guessedPlayerId) => {
        const sipahiId = Object.keys(players).find(id => players[id].role === "Sipahi");
        const chorId = Object.keys(players).find(id => players[id].role === "Chor");

        if (!sipahiId || !chorId) return;

        if (guessedPlayerId === chorId) {
            console.log("✅ Sipahi guessed correctly!");
            io.emit("roundResult", { success: true, players });
        } else {
            console.log("❌ Wrong guess! Swapping points between Chor & Sipahi...");
            [players[sipahiId].points, players[chorId].points] = [players[chorId].points, players[sipahiId].points];
            io.emit("roundResult", { success: false, players });
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
    console.log("🚀 Server running on port 5000");
});
