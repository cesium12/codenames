"use strict";

var express = require('express'),
    fs = require('fs'),
    path = require('path');

var app = express();
app.set('view engine', 'html');
app.engine('html', require('hogy').init());
app.use(require('body-parser').urlencoded({extended: false}));
app.use(express.static(__dirname + '/static'));
app.use(require('morgan')('dev'))
var io = require('socket.io').listen(app.listen(0xc0de)); //49374

var wordlist = process.argv[2];
if (!wordlist) {
  throw 'must specify a wordlist';
}
var words = fs.readFileSync(wordlist, 'utf8').split('\n');
words = words.filter(function(word) { return word; });
words.sort(function() { return Math.random() - 0.5; });
var identities = ['assassin'];
for (var i = 0; i < 9; ++i) { identities.push('red');     }
for (var i = 0; i < 8; ++i) { identities.push('blue');    }
for (var i = 0; i < 7; ++i) { identities.push('neutral'); }
identities.sort(function() { return Math.random() - 0.5; });
var game = {
  team: 'red',
  state: 'clue',
  red: 9,
  blue: 8,
  clue: null,
  count: null,
  words: []
};
for (var i = 0; i < 25; ++i) {
  game.words.push({
    word: words[i],
    identity: identities[i],
    revealed: false
  });
}
console.log(game);

app.get('/', function(request, response) {
  response.render('game', {
    wordlist: path.basename(wordlist),
    game: JSON.stringify(game),
    admin: false
  });
});

app.get('/spymaster', function(request, response) {
  response.render('game', {
    wordlist: path.basename(wordlist),
    game: JSON.stringify(game),
    admin: true
  });
});

app.post('/clue', function(request, response) {
  console.log(request.body);
  if (game.team == request.body.team && game.state == 'clue') {
    game.state = 'guess';
    game.clue = request.body.clue;
    game.count = Number(request.body.count);
    io.sockets.emit('clue', {
      game: game,
      sender: request.body.name,
      team: request.body.team,
      admin: true
    });
  }
  response.sendStatus(204);
});

app.post('/guess', function(request, response) {
  console.log(request.body);
  if (game.team == request.body.team && game.state == 'guess') {
    var other = {red: 'blue', blue: 'red'};
    var word = game.words[request.body.index];
    var win = null;
    if (!word) {
      game.count = -1;
    } else if (!word.revealed) {
      word.revealed = true;
      if (word.identity in game) {
        --game[word.identity];
        if (game[word.identity] <= 0) {
          win = word.identity;
        }
      }
      if (word.identity == game.team) {
        --game.count;
      } else if (word.identity == 'assassin') {
        win = other[game.team];
      } else {
        game.count = -1;
      }
    }
    if (win) {
      game.team = win;
      game.state = 'over';
    } else if (game.count < 0) {
      game.team = other[game.team];
      game.state = 'clue';
      game.clue = null;
      game.count = null;
    }
    io.sockets.emit('guess', {
      game: game,
      word: word,
      sender: request.body.name,
      team: request.body.team,
      admin: false
    });
  }
  response.sendStatus(204);
});

io.sockets.on('connection', function(socket) {
  socket.on('say', function(msg) {
    io.sockets.emit('chat', msg);
  });
});
