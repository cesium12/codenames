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
var game = new Game(path.basename(wordlist), words);

app.get('/', function(request, response, next) {
  if (!game) {
    next();
  } else {
    response.render('game', {
      wordlist: game.wordlist,
      game: JSON.stringify(game),
      admin: false
    });
  }
});

app.get('/spymaster', function(request, response, next) {
  if (!game) {
    next();
  } else {
    response.render('game', {
      wordlist: game.wordlist,
      game: JSON.stringify(game),
      admin: true
    });
  }
});

app.post('/clue', function(request, response, next) {
  if (!game) {
    next();
  } else {
    var ret = game.clue(request.body);
    if (ret) {
      io.sockets.emit('clue', ret);
    }
    response.sendStatus(204);
  }
});

app.post('/guess', function(request, response, next) {
  if (!game) {
    next();
  } else {
    var ret = game.guess(request.body);
    if (ret) {
      io.sockets.emit('guess', ret);
    }
    response.sendStatus(204);
  }
});

io.sockets.on('connection', function(socket) {
  socket.on('say', function(msg) {
    // TODO chat rooms
    game.log('chat', msg);
    io.sockets.emit('chat', msg);
  });
});

function Game(wordlist, words) {
  this.team = 'red';
  this.state = 'clue';
  this.red = 9;
  this.blue = 8;
  this.clue = null;
  this.count = null;
  this.words = [];
  this.events = [];

  this.wordlist = wordlist;
  this.shuffle(words);
  this.shuffle(this.identities);
  for (var i = 0; i < 25; ++i) {
    this.words.push({
      word: words[i],
      identity: this.identities[i],
      revealed: false
    });
  }
};
Game.prototype.shuffle = function(list) {
  list.sort(function() {
    return Math.random() - 0.5;
  });
};
Game.prototype.log = function(type, data) {
  data.type = type;
  data.time = +new Date;
  this.events.push(data);
};
Game.prototype.other = {
  red: 'blue',
  blue: 'red'
};
Game.prototype.identities = function() {
  var identities = ['assassin'];
  for (var i = 0; i < 9; ++i) { identities.push('red');     }
  for (var i = 0; i < 8; ++i) { identities.push('blue');    }
  for (var i = 0; i < 7; ++i) { identities.push('neutral'); }
  return identities;
}();
Game.prototype.clue = function(data) {
  if (this.team == data.team && this.state == 'clue') {
    this.log('clue', data);
    this.state = 'guess';
    this.clue = data.clue;
    this.count = Number(data.count);
    return {
      game: this,
      sender: data.name,
      team: data.team,
      admin: true
    };
  }
};
Game.prototype.guess = function(data) {
  if (this.team == data.team && this.state == 'guess') {
    this.log('guess', data);
    var word = this.words[data.index];
    var win = null;
    if (!word) {
      this.count = -1;
    } else if (!word.revealed) {
      word.revealed = true;
      if (word.identity in this.other) {
        --this[word.identity];
        if (this[word.identity] <= 0) {
          win = word.identity;
        }
      }
      if (word.identity == game.team) {
        --this.count;
      } else if (word.identity == 'assassin') {
        win = this.other[this.team];
      } else {
        this.count = -1;
      }
    }
    if (win) {
      this.team = win;
      this.state = 'over';
    } else if (this.count < 0) {
      this.team = this.other[this.team];
      this.state = 'clue';
      this.clue = null;
      this.count = null;
    }
    return {
      game: this,
      word: word,
      sender: data.name,
      team: data.team,
      admin: false
    };
  }
};
