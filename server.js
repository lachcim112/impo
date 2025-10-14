const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

const lobbies = {}; // { lobbyId: { players: { socketId: name }, gameData } }

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // Tworzenie lobby
  socket.on('createLobby', (cb) => {
    const id = uuidv4().slice(0, 8);
    lobbies[id] = { players: {} };
    if (cb) cb({ lobbyId: id });
  });

  // Dołączanie do lobby
  socket.on('joinLobby', ({ lobbyId, name }, cb) => {
    if (!lobbies[lobbyId]) return cb && cb({ error: 'Lobby nie istnieje' });
    lobbies[lobbyId].players[socket.id] = name;
    socket.join(lobbyId);

    const players = Object.values(lobbies[lobbyId].players).map((n) => ({ name: n }));
    io.to(lobbyId).emit('players', players);
    if (cb) cb({ ok: true });
  });

  // Start gry
  socket.on('startGame', ({ lobbyId, category }) => {
    const lobby = lobbies[lobbyId];
    if (!lobby) return;
    const playersArr = Object.entries(lobby.players);
    if (playersArr.length < 3) return;

    const categoryName = category || "Zwierzęta";
    const word = "Testowe hasło";
    const impostorIndex = Math.floor(Math.random() * playersArr.length);

    lobby.gameData = {
      players: playersArr.map((p) => p[1]),
      categoryName,
      word,
      impostorIndex
    };

    io.to(lobbyId).emit('gameStarted');
  });

  // Dołączanie do gry
  socket.on('joinGame', ({ lobbyId, name }) => {
    const lobby = lobbies[lobbyId];
    if (!lobby || !lobby.gameData) return;
    const playerIndex = lobby.gameData.players.findIndex((p) => p === name);
    if (playerIndex === -1) return;

    const isImpostor = playerIndex === lobby.gameData.impostorIndex;
    socket.emit('gameData', {
      categoryName: lobby.gameData.categoryName,
      word: lobby.gameData.word,
      isImpostor
    });
  });

  // ✅ Kliknięcie "Przejdź dalej" — działa jak start gry
  socket.on('readyNext', ({ lobbyId }) => {
    if (!lobbies[lobbyId]) return;
    console.log(`Przycisk "Przejdź dalej" kliknięty w lobby ${lobbyId}`);
    io.to(lobbyId).emit('allReadyNext'); // wysyła do wszystkich
  });

  socket.on('disconnect', () => {
    Object.keys(lobbies).forEach((lobbyId) => {
      if (lobbies[lobbyId].players[socket.id]) {
        delete lobbies[lobbyId].players[socket.id];
        io.to(lobbyId).emit(
          'players',
          Object.values(lobbies[lobbyId].players).map((n) => ({ name: n }))
        );
      }
    });
  });
});

server.listen(PORT, '0.0.0.0', () =>
  console.log(`✅ Serwer działa na porcie ${PORT}`)
);
