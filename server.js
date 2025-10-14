const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

const categoriesData = [
  { name: "Zwierzęta", words: ["lew","słoń","pingwin","kot","pies"] },
  { name: "Miasta", words: ["Warszawa","Kraków","Gdańsk"] }
  // skrócone dla czytelności — możesz zostawić pełną listę
];

const lobbies = {}; // { lobbyId: { players: { socketId: name }, gameData, playerOrder } }

io.on('connection', (socket) => {
  console.log('[S] Socket connected:', socket.id);

  socket.on('createLobby', (cb) => {
    const id = uuidv4().slice(0,8);
    lobbies[id] = { players: {}, gameData: null, playerOrder: null };
    console.log(`[S] Lobby created: ${id}`);
    if (cb) cb({ lobbyId: id });
  });

  socket.on('joinLobby', ({ lobbyId, name }, cb) => {
    if (!lobbies[lobbyId]) {
      console.log(`[S] joinLobby: lobby ${lobbyId} not found`);
      return cb && cb({ error: 'Lobby nie istnieje' });
    }
    lobbies[lobbyId].players[socket.id] = name;
    socket.join(lobbyId);
    console.log(`[S] joinLobby: ${name} joined ${lobbyId} (socket ${socket.id})`);
    const players = Object.values(lobbies[lobbyId].players).map(n => ({ name: n }));
    io.to(lobbyId).emit('players', players);
    if (cb) cb({ ok: true });
  });

  socket.on('leaveLobby', ({ lobbyId }, cb) => {
    if (lobbies[lobbyId] && lobbies[lobbyId].players[socket.id]) {
      console.log(`[S] leaveLobby: ${lobbies[lobbyId].players[socket.id]} left ${lobbyId}`);
      delete lobbies[lobbyId].players[socket.id];
      socket.leave(lobbyId);
      io.to(lobbyId).emit('players', Object.values(lobbies[lobbyId].players).map(n => ({ name: n })));
    }
    if (cb) cb();
  });

  socket.on('startGame', ({ lobbyId, category }) => {
    const lobby = lobbies[lobbyId];
    if (!lobby) { console.log(`[S] startGame: lobby ${lobbyId} not found`); return; }
    const playersArr = Object.entries(lobby.players);
    if (playersArr.length < 1) { console.log(`[S] startGame: not enough players in ${lobbyId}`); return; }

    const cat = categoriesData.find(c => c.name === category) || categoriesData[0];
    const word = cat.words[Math.floor(Math.random() * cat.words.length)];
    const impostorIndex = Math.floor(Math.random() * playersArr.length);

    lobby.gameData = {
      players: playersArr.map(p => p[1]), // names
      impostorIndex,
      categoryName: cat.name,
      word
    };
    lobby.playerOrder = null; // reset order for new game
    console.log(`[S] startGame: lobby ${lobbyId} started. players=${JSON.stringify(lobby.gameData.players)}`);
    io.to(lobbyId).emit('gameStarted'); // clients should request their own data via joinGame
  });

  socket.on('joinGame', ({ lobbyId, name }) => {
    const lobby = lobbies[lobbyId];
    if (!lobby) { console.log(`[S] joinGame: missing lobby ${lobbyId}`); return; }

    // ensure socket is in the room (handles direct navigation / refresh)
    socket.join(lobbyId);

    // If gameData exists, try to find player by name; otherwise attempt to derive players from lobby map
    let playersList = lobby.gameData && Array.isArray(lobby.gameData.players) ? lobby.gameData.players : Object.values(lobby.players);
    if (!playersList || playersList.length === 0) {
      console.log(`[S] joinGame: no players list available for ${lobbyId}`);
      // still emit something so client can show message
      socket.emit('gameData', { players: [], categoryName: '', word: '', isImpostor: false });
      return;
    }

    const playerIndex = playersList.findIndex(p => p === name);
    if (playerIndex === -1) {
      console.log(`[S] joinGame: player name ${name} not found in lobby ${lobbyId}. playersList=${JSON.stringify(playersList)}`);
      // allow joining anyway: find by socket mapping if present
      const nameFromMap = lobby.players[socket.id];
      const idx = playersList.findIndex(p => p === nameFromMap);
      if (idx !== -1) {
        // override name variable to existing mapping
        socket.emit('gameData', {
          players: playersList,
          categoryName: lobby.gameData ? lobby.gameData.categoryName : '',
          word: lobby.gameData ? lobby.gameData.word : '',
          isImpostor: idx === (lobby.gameData ? lobby.gameData.impostorIndex : -1)
        });
        return;
      }
      // if still not found, emit basic info
      socket.emit('gameData', { players: playersList, categoryName: lobby.gameData ? lobby.gameData.categoryName : '', word: lobby.gameData ? lobby.gameData.word : '', isImpostor: false });
      return;
    }

    const isImpostor = lobby.gameData ? (playerIndex === lobby.gameData.impostorIndex) : false;
    console.log(`[S] joinGame: ${name} (socket ${socket.id}) joined game in ${lobbyId}, isImpostor=${isImpostor}`);
    socket.emit('gameData', {
      players: playersList,
      categoryName: lobby.gameData ? lobby.gameData.categoryName : '',
      word: lobby.gameData ? lobby.gameData.word : '',
      isImpostor
    });
  });

  // proceed -> all go to order.html
  socket.on('proceedToOrder', ({ lobbyId }) => {
    console.log(`[S] proceedToOrder from ${socket.id} for lobby ${lobbyId}`);
    if (!lobbies[lobbyId]) { console.log(`[S] proceedToOrder: lobby missing ${lobbyId}`); return; }
    io.to(lobbyId).emit('goToOrder');
  });

  // getPlayerOrder: create or reuse playerOrder and emit it
  socket.on('getPlayerOrder', ({ lobbyId }) => {
    const lobby = lobbies[lobbyId];
    if (!lobby) {
      console.log(`[S] getPlayerOrder: lobby ${lobbyId} not found`);
      socket.emit('playerOrder', []); // reply empty so client won't hang
      return;
    }

    // ensure socket is in room (in case of direct nav)
    socket.join(lobbyId);

    // derive players list: prefer gameData.players, fallback to lobby.players map
    let playersList = lobby.gameData && Array.isArray(lobby.gameData.players) && lobby.gameData.players.length > 0
      ? lobby.gameData.players
      : Object.values(lobby.players);

    if (!playersList || playersList.length === 0) {
      console.log(`[S] getPlayerOrder: no players for lobby ${lobbyId}`);
      socket.emit('playerOrder', []);
      return;
    }

    if (!lobby.playerOrder) {
      lobby.playerOrder = [...playersList].sort(() => Math.random() - 0.5);
      console.log(`[S] getPlayerOrder: new order for ${lobbyId}: ${JSON.stringify(lobby.playerOrder)}`);
    } else {
      console.log(`[S] getPlayerOrder: reuse order for ${lobbyId}: ${JSON.stringify(lobby.playerOrder)}`);
    }

    io.to(lobbyId).emit('playerOrder', lobby.playerOrder);
  });

  // endRound: any click moves all to roundend
  socket.on('endRound', ({ lobbyId }) => {
    console.log(`[S] endRound from ${socket.id} for ${lobbyId}`);
    if (!lobbies[lobbyId]) { console.log(`[S] endRound: missing lobby ${lobbyId}`); return; }
    io.to(lobbyId).emit('goToRoundEnd');
  });

  socket.on('disconnect', () => {
    console.log('[S] disconnect', socket.id);
    Object.keys(lobbies).forEach(lobbyId => {
      if (lobbies[lobbyId].players[socket.id]) {
        console.log(`[S] Removing ${lobbies[lobbyId].players[socket.id]} from ${lobbyId}`);
        delete lobbies[lobbyId].players[socket.id];
        io.to(lobbyId).emit('players', Object.values(lobbies[lobbyId].players).map(n => ({ name: n })));
      }
    });
  });

});

server.listen(PORT, '0.0.0.0', () => console.log(`Serwer działa na porcie ${PORT}`));
