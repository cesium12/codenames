"use strict";

var express = require('express'),
    fs = require('fs'),
    path = require('path');

var wordlists = readdir('wordlists', function(data) {
  return data.split('\n').filter(function(word) {
    return word;
  });
});
var games = readdir('games', function(data) {
  data = JSON.parse(data);
  var game = Object.create(Game.prototype);
  for (var key in data) {
    game[key] = data[key];
  }
  io.of('/' + game.name);
  return game;
});

var app = express();
app.set('strict routing', true);
app.set('view engine', 'html');
app.engine('html', require('hogy').init());
app.use(require('body-parser').urlencoded({extended: false}));
app.use(express.static(__dirname + '/static'));
app.use(require('morgan')('dev'))
var io = require('socket.io').listen(app.listen(0xc0de)); //49374

app.param('game', function(request, response, next, game) {
  request.game = games[game];
  next();
});

app.get('/', function(request, response) {
  response.render('lobby', {
    wordlists: Object.keys(wordlists).map(function(key) {
      return {name: key};
    }),
    json: JSON.stringify(games)
  });
});

app.post('/', function(request, response, next) {
  if (request.body.name in games || !(request.body.wordlist in wordlists)) {
    next();
  } else {
    games[request.body.name] = new Game(request.body.name, request.body.wordlist, function() {
      response.redirect(303, '/');
    });
    io.of('/' + request.body.name);
  }
});

app.get('/:game/player', function(request, response, next) {
  if (!request.game) {
    next();
  } else {
    response.render('game', {
      game: request.game,
      json: JSON.stringify(request.game),
      admin: false
    });
  }
});

app.get('/:game/spymaster', function(request, response, next) {
  if (!request.game) {
    next();
  } else {
    response.render('game', {
      game: request.game,
      json: JSON.stringify(request.game),
      admin: true
    });
  }
});

app.post('/:game/clue', function(request, response, next) {
  if (!request.game) {
    next();
  } else {
    request.game.doClue(request.body, function(data) {
      io.of('/' + request.game.name).emit('clue', data);
    });
    response.sendStatus(204);
  }
});

app.post('/:game/guess', function(request, response, next) {
  if (!request.game) {
    next();
  } else {
    request.game.doGuess(request.body, function(data) {
      io.of('/' + request.game.name).emit('guess', data);
    });
    response.sendStatus(204);
  }
});

app.post('/:game/chat', function(request, response, next) {
  if (!request.game) {
    next();
  } else {
    request.game.doChat(request.body, function(data) {
      io.of('/' + request.game.name).emit('chat', data);
    });
    response.sendStatus(204);
  }
});

// TODO on join, send the history

function Game(name, wordlist, callback) {
  this.team = 'red';
  this.state = 'clue';
  this.red = 9;
  this.blue = 8;
  this.clue = null;
  this.count = null;
  this.words = [];
  this.events = [];

  this.name = name;
  this.wordlist = wordlist;
  this.created = +new Date;
  this.modified = +new Date;
  this.shuffle(wordlists[wordlist]);
  this.shuffle(this.identities);
  for (var i = 0; i < 25; ++i) {
    this.words.push({
      word: wordlists[wordlist][i],
      identity: this.identities[i],
      revealed: false
    });
  }

  this.save(callback);
};
Game.prototype.shuffle = function(list) {
  list.sort(function() {
    return Math.random() - 0.5;
  });
};
Game.prototype.log = function(type, data, callback) {
  data.type = type;
  data.time = +new Date;
  this.events.push(data);
  this.modified = +new Date;
  this.save(callback);
};
Game.prototype.save = function(callback) {
  fs.writeFile(path.join('games', this.name), JSON.stringify(this), function(err) {
    if (err) {
      console.error(err);
    }
    callback();
  });
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
Game.prototype.doClue = function(data, callback) {
  if (this.team == data.team && this.state == 'clue') {
    this.state = 'guess';
    this.clue = data.clue;
    this.count = Number(data.count);
    this.log('clue', data, function() {
      callback({
        game: this,
        sender: data.name,
        team: data.team,
        admin: true
      });
    }.bind(this));
  }
};
Game.prototype.doGuess = function(data, callback) {
  if (this.team == data.team && this.state == 'guess') {
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
      if (word.identity == this.team) {
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
    this.log('guess', data, function() {
      callback({
        game: this,
        word: word,
        sender: data.name,
        team: data.team,
        admin: false
      });
    }.bind(this));
  }
};
Game.prototype.doChat = function(data, callback) {
  data.admin = Boolean(data.admin);
  this.log('chat', data, function() {
    callback(data);
  });
};

function readdir(dir, process) {
  var out = {};
  fs.mkdir(dir, function(err) {
    if (err) {
      console.error(err);
    }
    fs.readdir(dir, function(err, files) {
      if (err) {
        console.error(err);
        return;
      }
      files.forEach(function(file) {
        fs.readFile(path.join(dir, file), 'utf8', function(err, data) {
          if (err) {
            console.error(err);
            return;
          }
          out[file] = process(data);
        });
      });
    });
  });
  return out;
}
