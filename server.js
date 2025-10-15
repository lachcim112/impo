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

    lobby.gameData = {
      players: playersArr.map((p) => p[1]),
      categoryName,
      word,
      impostorIndex
    };

    io.to(lobbyId).emit('gameStarted');
  });


  // Dołączanie do gry i otrzymywanie indywidualnych danych
  socket.on('joinGame', ({ lobbyId, name }) => {
    const lobby = lobbies[lobbyId];
    if (!lobby || !lobby.gameData) {
      console.log(`joinGame: brak lobby/gameData dla ${lobbyId}`);
      return;
    }

    // Upewnij się, że socket jest w pokoju lobby (na wypadek odświeżenia strony)
    socket.join(lobbyId);

    const playerIndex = lobby.gameData.players.findIndex(p => p === name);
    if (playerIndex === -1) {
      console.log(`joinGame: nie znaleziono gracza ${name} w lobby ${lobbyId}`);
      return;
    }

    const isImpostor = playerIndex === lobby.gameData.impostorIndex;

    console.log(`joinGame: ${name} (socket ${socket.id}) dołączył do gry w ${lobbyId}, isImpostor=${isImpostor}`);

    socket.emit('gameData', {
      players: lobby.gameData.players,
      categoryName: lobby.gameData.categoryName,
      word: lobby.gameData.word,
      isImpostor
    });
  });

  // Kliknięcie "Przejdź dalej" — natychmiast dla wszystkich
  socket.on('readyNext', ({ lobbyId }) => {
    console.log(`readyNext received from socket ${socket.id} for lobby ${lobbyId}`);
    const lobby = lobbies[lobbyId];
    if (!lobby) {
      console.log(`readyNext: lobby ${lobbyId} nie istnieje`);
      return;
    }
    // Wyślij do wszystkich w pokoju sygnał przejścia
    io.to(lobbyId).emit('allReadyNext');
    console.log(`allReadyNext emitted to lobby ${lobbyId}`);
  });

 // Event do pobrania kolejności graczy
socket.on('getPlayerOrder', ({ lobbyId }) => {
  const lobby = lobbies[lobbyId];
  if (!lobby || !lobby.gameData) return;

  // Jeśli kolejność już nie została wylosowana, losujemy
  if (!lobby.gameData.playerOrder) {
    const players = [...lobby.gameData.players];
    for (let i = players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [players[i], players[j]] = [players[j], players[i]];
    }
    lobby.gameData.playerOrder = players;
  }

  // Wyślij kolejność do wszystkich w lobby
  io.to(lobbyId).emit('playerOrder', lobby.gameData.playerOrder);
});

// Każdy gracz kliknął "Koniec rundy" — wszyscy przechodzą do roundend.html
socket.on('readyNextOrder', ({ lobbyId }) => {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;
  io.to(lobbyId).emit('allReadyNextOrder');
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
