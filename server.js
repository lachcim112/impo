const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

// Pełna baza kategorii i słów
const categoriesData = [
  { name: "Zwierzęta", words: ["lew","słoń","pingwin","kot","pies","żyrafa","tygrys","foka","wilk","lis","koń","lama","papuga","nietoperz","krokodyl","delfin","rekin","żółw","zebra","małpa","jeż","kret"] },
  { name: "Miasta", words: ["Warszawa","Kraków","Gdańsk","Wrocław","Poznań","Łódź","Lublin","Szczecin","Bydgoszcz","Katowice"] },
  { name: "Gry komputerowe", words: ["Minecraft","Fortnite","Counter-Strike","League of Legends","Valorant","The Sims","Among Us","GTA V","Call of Duty","Roblox","FIFA","Overwatch","PUBG","Tetris","Cyberpunk","Red Dead Redemption"] },
  { name: "Jedzenie", words: ["pizza","hamburger","makaron","sushi","zupa","pierogi","lody","sałatka","kanapka","ciasto","kotlet","gofry","naleśniki","tost","jajecznica","chleb","sernik","rosół","kebab","frytki"] },
  { name: "Filmy", words: ["Matrix","Titanic","Avatar","Gladiator","Shrek","Joker","Harry Potter","Toy Story","Gwiezdne Wojny","Władca Pierścieni","Batman","Król Lew","Rocky","Forrest Gump","Deadpool","Minionki"] },
  { name: "Zawody", words: ["lekarz","nauczyciel","policjant","strażak","programista","kucharz","prawnik","architekt","mechanik","muzyk","aktor","fotograf","weterynarz","dziennikarz","pilot","żołnierz","kierowca","tłumacz","hydraulik","ogrodnik"] },
  { name: "Sporty", words: ["piłka nożna","koszykówka","siatkówka","tenis","boks","pływanie","bieganie","jazda na rowerze","narciarstwo","golf","hokej","wspinaczka","karate","snowboard","wioślarstwo","skoki narciarskie","rugby","formuła 1"] },
  { name: "Państwa", words: ["Polska","Niemcy","Francja","Hiszpania","Włochy","Chiny","Japonia","Brazylia","USA","Kanada","Rosja","Australia","Indie","Norwegia","Szwecja","Ukraina","Argentyna","Egipt","Meksyk","Kuba"] },
  { name: "Rzeczy codzienne", words: ["telefon","klucz","komputer","długopis","kawa","łóżko","zegarek","kubek","portfel","krem","szczoteczka","kurtka","buty","okulary","notes","laptop","lampa","plecak","woda","lusterko"] },
  { name: "Postacie fikcyjne", words: ["Batman","Superman","Shrek","Spider-Man","Iron Man","Joker","Harry Potter","Gandalf","Elsa","Homer Simpson","Yoda","Darth Vader","Hobbit","Kubuś Puchatek","Myszka Miki","SpongeBob","Mario","Luigi","Thanos","Olaf"] },
  { name: "Części ciała", words: ["głowa","ręka","noga","oko","ucho","nos","usta","kolano","łokieć","dłoń","palec","włos","bark","plecy","pięta","serce","żebra","szyja","brzuch","język"] },
  { name: "Pojazdy", words: ["samochód","rower","motocykl","pociąg","samolot","autobus","hulajnoga","ciężarówka","traktor","tramwaj","łódź","skuter","karetka","radiowóz","wozy strażackie","segway","statek","czołg","metro","helikopter"] },
  { name: "Rośliny", words: ["drzewo","trawa","kwiat","róża","tulipan","słonecznik","kaktus","paproć","buk","dąb","brzoza","sosna","fiołek","lilia","lawenda","bluszcz","storczyk","hiacynt","malina","borówka"] },
  { name: "Zabawki", words: ["klocki","lalka","piłka","misiek","autko","puzzle","jojo","karty","gry planszowe","hula-hop","skakanka","plastelina","kostka Rubika","figurki","tamagotchi","pistolet na wodę","klocki Lego","konik","ciastolina","magnesy"] },
  { name: "Instrumenty", words: ["gitara","fortepian","skrzypce","perkusja","flet","trąbka","saksofon","harmonijka","banjo","akordeon","bęben","obój","kontrabas","klarnet","tamburyn","dzwonki","koto","harfa","marakasy","lira"] },
  { name: "Święta", words: ["Boże Narodzenie","Wielkanoc","Sylwester","Walentynki","Dzień Matki","Dzień Dziecka","Halloween","Nowy Rok","Dzień Kobiet","Andrzejki","Mikołajki","Święto Zmarłych","Trzech Króli","Dzień Ojca","Karnawał","Prima Aprilis","Zakończenie Roku"] },
  { name: "Marki", words: ["Nike","Adidas","Apple","Samsung","Toyota","BMW","Google","McDonald's","Coca-Cola","Pepsi","IKEA","Sony","Microsoft","Netflix","Lego","Puma","Nestle","Amazon","Zara","H&M"] },
  { name: "Zjawiska pogodowe", words: ["deszcz","śnieg","wiatr","burza","słońce","mróz","grad","mgła","upał","tęcza","zamieć","wichura","rosa","chmury","zachmurzenie","ciepło","zimno","huragan","piorun","tornado"] },
  { name: "Meble", words: ["stół","krzesło","kanapa","fotel","łóżko","biurko","regał","szafa","komoda","pufa","toaletka","witryna","ławka","taboret","stolik nocny","rama łóżka","półka","szafka RTV","wieszak","narożnik"] }
];

const lobbies = {}; // { lobbyId: { players: { socketId: name }, gameData } }

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('createLobby', (cb) => {
    const id = uuidv4().slice(0,8);
    lobbies[id] = { players: {} };
    if (cb) cb({ lobbyId: id });
  });

  socket.on('joinLobby', ({ lobbyId, name }, cb) => {
    if (!lobbies[lobbyId]) return cb && cb({ error: 'Lobby nie istnieje' });
    lobbies[lobbyId].players[socket.id] = name;
    socket.join(lobbyId);

    const players = Object.values(lobbies[lobbyId].players).map((n) => ({ name: n }));
    io.to(lobbyId).emit('players', players);

    if (cb) cb({ ok:true });
  });

  socket.on('leaveLobby', ({ lobbyId }, cb) => {
    if (lobbies[lobbyId] && lobbies[lobbyId].players[socket.id]) {
      delete lobbies[lobbyId].players[socket.id];
      socket.leave(lobbyId);

      const players = Object.values(lobbies[lobbyId].players).map((n) => ({ name: n }));
      io.to(lobbyId).emit('players', players);
    }
    if (cb) cb();
  });

  socket.on('startGame', ({ lobbyId, category }) => {
    const lobby = lobbies[lobbyId];
    if (!lobby) return;
    const playersArr = Object.entries(lobby.players); 
    if (playersArr.length < 3) return;

    const cat = categoriesData.find(c => c.name === category);
    if (!cat) return;

    const impostorIndex = Math.floor(Math.random() * playersArr.length);
    const wordIndex = Math.floor(Math.random() * cat.words.length);
    const word = cat.words[wordIndex];

    lobby.gameData = {
      players: playersArr.map(p => p[1]),
      impostorIndex,
      categoryName: cat.name,
      word
    };

    io.to(lobbyId).emit('gameStarted');
  });

  socket.on('joinGame', ({ lobbyId, name }) => {
    const lobby = lobbies[lobbyId];
    if (!lobby || !lobby.gameData) return;

    const playerIndex = lobby.gameData.players.findIndex(p => p === name);
    if (playerIndex === -1) return;

    const isImpostor = playerIndex === lobby.gameData.impostorIndex;

    socket.emit('gameData', {
      players: lobby.gameData.players,
      categoryName: lobby.gameData.categoryName,
      word: lobby.gameData.word,
      isImpostor
    });
  });

  socket.on('disconnect', () => {
    Object.keys(lobbies).forEach(lobbyId => {
      if (lobbies[lobbyId].players[socket.id]) {
        delete lobbies[lobbyId].players[socket.id];
        io.to(lobbyId).emit('players', Object.values(lobbies[lobbyId].players).map(n => ({ name: n })));
      }
    });
  });

  // Zliczanie graczy, którzy kliknęli "Przejdź dalej"
  socket.on('readyNext', ({ lobbyId }) => {
    const lobby = lobbies[lobbyId];
    if (!lobby) return;
    if (!lobby.gameData.readyPlayers) lobby.gameData.readyPlayers = {};
    lobby.gameData.readyPlayers[socket.id] = true;
    const total = Object.keys(lobby.players).length;
    const readyCount = Object.keys(lobby.gameData.readyPlayers).length;
    io.to(lobbyId).emit('readyProgress', { readyCount, total });

    if (readyCount === total) {
      lobby.gameData.readyPlayers = {};
      io.to(lobbyId).emit('allReadyNext'); // <-- to wywołanie musi być
    }
});

  // --- ETAP 2: Losowanie kolejności graczy ---
socket.on('getPlayerOrder', ({ lobbyId }) => {
  const lobby = lobbies[lobbyId];
  if (!lobby || !lobby.gameData) return;

  // Jeśli nie ma jeszcze kolejności – wylosuj
  if (!lobby.gameData.order) {
    const shuffled = [...lobby.gameData.players].sort(() => Math.random() - 0.5);
    lobby.gameData.order = shuffled;
  }

  socket.emit('playerOrder', { order: lobby.gameData.order });
});


// Reset kolejności po zakończeniu rundy (np. przy kolejnej rundzie)
//socket.on('resetOrder', ({ lobbyId }) => {
  //const lobby = lobbies[lobbyId];
  //if (lobby && lobby.gameData) {
    //lobby.gameData.order = null;
  //}
//});

// --- ETAP 3: Głosowanie decyzji po rundzie ---
socket.on('roundEndVote', ({ lobbyId, choice }) => {
  const lobby = lobbies[lobbyId];
  if (!lobby || !lobby.gameData) return;

  // Utwórz obiekt głosów jeśli nie istnieje
  if (!lobby.gameData.roundVotes) lobby.gameData.roundVotes = {};

  lobby.gameData.roundVotes[socket.id] = choice;

  const totalPlayers = Object.keys(lobby.players).length;
  const votes = Object.values(lobby.gameData.roundVotes);

  const countRound = votes.filter(v => v === 'round').length;
  const countVote = votes.filter(v => v === 'vote').length;

  // Emituj do wszystkich aktualne wyniki
  io.to(lobbyId).emit('roundVoteUpdate', { countRound, countVote, total: totalPlayers });

  // Jeśli wszyscy zagłosowali
  if (votes.length === totalPlayers) {
    let result = 'round';
    if (countVote > countRound) result = 'vote'; // Więcej za głosowaniem
    // W przypadku remisu zostaje 'round'

    io.to(lobbyId).emit('roundDecisionResult', { result });

    // Wyczyść głosy na przyszłość
    lobby.gameData.roundVotes = {};
  }
});

// --- ETAP 4: Głosowanie impostora ---
socket.on('voteImpostor', ({ lobbyId, target }) => {
  const lobby = lobbies[lobbyId];
  if (!lobby || !lobby.gameData) return;

  if (!lobby.gameData.votes) lobby.gameData.votes = {};
  lobby.gameData.votes[socket.id] = target;

  const totalPlayers = Object.keys(lobby.players).length;
  const votes = Object.values(lobby.gameData.votes);

  // Emituj aktualny stan głosów
  io.to(lobbyId).emit('voteProgress', { count: votes.length, total: totalPlayers });

  if (votes.length === totalPlayers) {
    // Zlicz wyniki głosowania
    const counts = {};
    for (const t of votes) counts[t] = (counts[t] || 0) + 1;

    let winner = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

    const impostorId = lobby.gameData.impostorId;
    const impostorPlayer = lobby.players[impostorId];

    const impostorName = impostorPlayer ? impostorPlayer.name : 'Nieznany';

    let result = 'gracze'; // gracze wygrywają
    if (winner !== impostorName) result = 'impostor'; // impostor nie został wybrany

    // Zachowaj wynik
    lobby.gameData.voteResult = { result, impostorName, votes: counts };

    io.to(lobbyId).emit('voteResult', lobby.gameData.voteResult);

    // Wyczyść głosy
    lobby.gameData.votes = {};
  }
});

socket.on('nextStep', ({ lobbyId }) => {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;
  // Wysyłamy do wszystkich w lobby sygnał do przejścia dalej
  io.to(lobbyId).emit('goToOrder');
});

});

server.listen(PORT, '0.0.0.0', () => console.log(`Serwer działa na porcie ${PORT}`));
