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
/*app.use(function(request, response) {
    writePage(response.status(404), '404', {
        message: 'page not found',
        info: request.path,
        title: '404s of Darkness'
    });
});*/
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
    game.count = request.body.count;
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

/*

app.get('/config', function(request, response) {
    response.type('application/json')
            .send(config);
});

app.post('/create', function(request, response) {
    try {
        var name = request.body.name.trim(), maps;
        if(!name || !Game.pattern.test(name))
            throw 'must provide name';
        try {
            maps = JSON.parse(request.body.maps);
        } catch(e) {
            throw 'must provide maps';
        }
        if(!maps.length)
            throw 'must provide maps';
    } catch(e) {
        writeError(response, e, 400);
    }
    queue(function() {
        return checkGame(name)
          .then(function(exists) {
            if(exists != 'no')
                throw exists == 'yes' ? 'name already used' : exists;
            var startcfg = JSON.parse(config);
            delete startcfg.maps;
            return new Game(name, [ new Turn(maps, startcfg),
                                    new Turn(maps, startcfg) ]);
        }).then(saveGame)
          .then(function() {
            response.redirect(303, '/game.' + name);
        }, function(err) {
            warn('Creating ' + name, err, err.stack);
            writeError(response, err, 400);
        })
    });
});

app.get('/game.:game', function(request, response, next) {
    writePage(response, 'lobby', {
        game: JSON.stringify(request.params.game),
        title: request.params.game + ' - Minions of Darkness'
    });
});

app.get('/game.:game/:seat', function(request, response, next) {
    writePage(response, 'play', {
        game: JSON.stringify(request.params.game),
        seat: JSON.stringify(request.params.seat),
        title: request.params.game + ' - Minions of Darkness',
        style: 'play'
    });
});

function warn(name, desc) {
    console.warn('\x1b[31;1m' + name + ':\x1b[0m ' + desc);
}

function writeError(response, text, code) {
    warn('Sent ' + code, text);
    return response.status(code)
                   .type('text/plain')
                   .send(code + '\n' + text + '\n');
}

function writePage(response, page, more) {
    var params = {
        title: 'Minions of Darkness',
        script: page,
        style: 'menu',
    };
    if(more)
        for(var key in more)
            params[key] = more[key];
    return response.render(page, params);
}

function checkGame(name) {
    return q.nfcall(fs.stat, 'var/games/game.' + name)
      .then(function() {
        return 'yes';
    }, function(err) {
      if(err.code == 'ENOENT')
          return 'no';
      return err;
    });
}

function saveGame(game) {
    game.date = new Date;
    var name = game.title, json = JSON.stringify(game);
    return q.fcall(function() {
        if(!Game.pattern.test(name))
            throw 'tried to save game with invalid name: ' + name;
        return q.nfcall(fs.writeFile, 'var/games/game.' + name, json);
    }).then(function() {
        var games = {};
        games[name] = json;
        io.sockets.in('/').emit('games', games);
        io.sockets.in(name).emit('games', games);
    }, function(err) {
        warn('Dumping ' + name, json);
        throw "Can't save " + name + ': ' + err;
    });
}

function loadGame(name) {
    return q.fcall(function() {
        if(!Game.pattern.test(name))
            throw 'tried to read game with invalid name: ' + name;
        return q.nfcall(fs.readFile, 'var/games/game.' + name, 'utf8');
    }).then(function(data) {
        return data;
    }, function(err) {
        throw "Can't load " + name + ': ' + err;
    });
}

var flock = q();
function queue(action) {
    flock = flock.then(function() {
        var transaction = q.defer();
        action().fin(function() {
            transaction.resolve();
        }).done();
        return transaction.promise;
    });
}

var clients = {},
    players = {};

function sendViewerList(chan) {
    var viewers = {};
    io.sockets.clients(chan).forEach(function(socket) {
        if(socket.id in clients)
            viewers[clients[socket.id].name] = true;
    });
    io.sockets.in(chan).emit('viewers', viewers);
}

function sendPlayerList(chan) {
    io.sockets.in(chan).emit('players', players[chan]);
}

io.sockets.on('connection', function(socket) {
    socket.on('login', function(data) {
        var game = data.game;
        clients[socket.id] = data;
        socket.join(game);
        sendViewerList(game);
        if('seat' in data)
            getDefault(players, game, [])[data.seat] = data.name;
        
        socket.on('disconnect', function() {
            delete clients[socket.id];
            socket.leave(game);
            sendViewerList(game);
            if('seat' in data)
                delete players[game][data.seat];
            sendPlayerList(game);
        });
        
        if(data.page == '/')
            dirs.readdir('var/games', function(files) {
                socket.emit('games', files);
            });
        else if(game)
            queue(function() {
                return loadGame(game)
                  .then(function(data) {
                    var games = {};
                    games[game] = data;
                    socket.emit('games', games);
                    getDefault(players, game, []);
                    sendPlayerList(game);
                }, function(err) {
                    socket.emit('nogame');
                })
            });
        
        socket.on('say', function(msg) {
            io.sockets.emit('chat', { sender: data, message: msg });
        });
        
        socket.on('action', function(msg) {
            queue(function() {
                return loadGame(game)
                  .then(function(data) {
                    return Game.load(JSON.parse(data)).update(msg);
                }).then(saveGame)
                  .then(function() {
                    if('seat' in data)
                        players[game][data.seat] = data.name;
                    sendPlayerList(game);
                }).fail(function(err) {
                    warn('Updating ' + game, err, err.stack);
                    socket.emit('wtf', '' + err);
                });
            });
        });
    });
});

/**/
