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
const points = { Raja: 800, Mantri: 900, Chor: 0, Sipahi: 1000 }; // Updated point values
let currentRound = 0;
const TOTAL_ROUNDS = 7;
let gameInProgress = false;

function assignRoles() {
    const playerIds = Object.keys(players);
    const shuffledRoles = roles.sort(() => Math.random() - 0.5); // Shuffle roles

    playerIds.forEach((playerId, index) => {
        const role = shuffledRoles[index];
        players[playerId].role = role;
        players[playerId].currentPoints = 0; // Points will be assigned after guessing
    });

    // Only reveal Raja and Sipahi roles to all players
    const publicPlayers = {};
    playerIds.forEach(id => {
        publicPlayers[id] = {
            id: players[id].id,
            name: players[id].name,
            role: players[id].role === "Raja" || players[id].role === "Sipahi" 
                ? players[id].role 
                : "Hidden",
            currentPoints: 0,
            totalPoints: players[id].totalPoints || 0
        };
    });

    io.emit("gameStarted", publicPlayers); // Notify all players with public roles

    // Send private role info to each player
    playerIds.forEach(id => {
        io.to(id).emit("yourRole", players[id].role);
    });

    // Find Raja & Sipahi
    const rajaId = playerIds.find(id => players[id].role === "Raja");
    const sipahiId = playerIds.find(id => players[id].role === "Sipahi");
    
    if (sipahiId) {
        io.to(sipahiId).emit("yourTurnToGuess"); // Tell Sipahi it's their turn
    }
}

function calculateRoundPoints(correctGuess) {
    const playerIds = Object.keys(players);
    
    playerIds.forEach(id => {
        const role = players[id].role;
        
        if (role === "Raja") {
            players[id].currentPoints = points.Raja;
        } 
        else if (role === "Mantri") {
            players[id].currentPoints = points.Mantri;
        }
        else if (role === "Chor") {
            players[id].currentPoints = correctGuess ? points.Chor : points.Sipahi;
        }
        else if (role === "Sipahi") {
            players[id].currentPoints = correctGuess ? points.Sipahi : points.Chor;
        }
        
        // Add round points to total
        players[id].totalPoints = (players[id].totalPoints || 0) + players[id].currentPoints;
    });
}

function determineWinner() {
    let highestScore = -1;
    let winnerId = null;
    
    Object.keys(players).forEach(id => {
        if (players[id].totalPoints > highestScore) {
            highestScore = players[id].totalPoints;
            winnerId = id;
        }
    });
    
    return winnerId;
}

function startNextRound() {
    if (currentRound < TOTAL_ROUNDS) {
        currentRound++;
        io.emit("roundStart", { round: currentRound, totalRounds: TOTAL_ROUNDS });
        assignRoles();
    } else {
        const winnerId = determineWinner();
        io.emit("gameOver", { 
            winner: players[winnerId], 
            finalScores: Object.values(players).map(p => ({ 
                name: p.name, 
                totalPoints: p.totalPoints 
            }))
        });
        
        // Reset game state for a new game
        currentRound = 0;
        Object.keys(players).forEach(id => {
            players[id].totalPoints = 0;
            players[id].currentPoints = 0;
            players[id].role = "";
        });
        gameInProgress = false;
    }
}

io.on("connection", (socket) => {
    console.log(`✅ Player connected: ${socket.id}`);

    socket.on("joinGame", (playerName, callback) => {
        console.log(`🟢 ${playerName} joined the game`);

        if (gameInProgress) {
            callback({ success: false, message: "Game already in progress!" });
            return;
        }

        if (Object.keys(players).length < 4) {
            players[socket.id] = {
                id: socket.id,
                name: playerName,
                role: "",
                currentPoints: 0,
                totalPoints: 0
            };

            io.emit("updatePlayers", Object.values(players).map(p => ({ 
                id: p.id, 
                name: p.name 
            })));
            
            callback({ success: true });

            if (Object.keys(players).length === 4) {
                console.log("🎮 4 Players Joined! Starting game...");
                gameInProgress = true;
                currentRound = 0;
                startNextRound();
            }
        } else {
            callback({ success: false, message: "Game is full!" });
        }
    });

    // ✅ Handling Sipahi's Guess
    socket.on("sipahiGuess", (guessedPlayerId) => {
        const sipahiId = Object.keys(players).find(id => players[id].role === "Sipahi");
        const chorId = Object.keys(players).find(id => players[id].role === "Chor");

        if (!sipahiId || !chorId || socket.id !== sipahiId) return;

        const correctGuess = guessedPlayerId === chorId;
        
        calculateRoundPoints(correctGuess);
        
        // Reveal all roles and points for this round
        const roundResults = {};
        Object.keys(players).forEach(id => {
            roundResults[id] = {
                id: players[id].id,
                name: players[id].name,
                role: players[id].role,
                currentPoints: players[id].currentPoints,
                totalPoints: players[id].totalPoints
            };
        });
        
        io.emit("roundResult", { 
            success: correctGuess, 
            players: roundResults,
            message: correctGuess ? 
                "✅ Sipahi guessed correctly! Points distributed accordingly." : 
                "❌ Wrong guess! Sipahi gets 0 points and Chor gets Sipahi's points."
        });
        
        // Wait a bit before starting next round
        setTimeout(() => {
            startNextRound();
        }, 5000);
    });

    socket.on("disconnect", () => {
        console.log(`❌ Player disconnected: ${socket.id}`);
        delete players[socket.id];
        
        if (gameInProgress && Object.keys(players).length < 4) {
            // Not enough players to continue
            io.emit("gameCancelled", { message: "A player disconnected. Game cancelled." });
            gameInProgress = false;
            currentRound = 0;
        }
        
        io.emit("updatePlayers", Object.values(players).map(p => ({ 
            id: p.id, 
            name: p.name 
        })));
    });
});

app.get("/", (req, res) => {
    res.send("🎮 Raja Mantri Game Server is Running!");
});

server.listen(5000, () => {
    console.log("🚀 Server running on port 5000");
});
