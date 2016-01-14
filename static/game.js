$(function() {

var chatlist = $('#chatbox table'),
    chatbody = $('#chatbox tbody'),
    chattext = $('#chatbox input'),
    board = $('#board table'),
    event = io.connect('/' + game.name),
    team, name;

if ('name' in localStorage) {
  name = localStorage.name;
  $('#name').val(name);
}
$('#name').change(function() {
  name = localStorage.name = $(this).val().trim();
  render();
});
if ('team' in localStorage && localStorage.team in COLORS) {
  team = localStorage.team;
  document.getElementById(team).checked = true;
}
$('.team').change(function() {
  team = localStorage.team = $(this).attr('id');
  render();
});
if (!name) {
  $('#name').focus();
} else if (!admin) {
  chattext.focus();
}

function chatScroll(insert) {
  return function(data) {
    var bottom = chatlist.scrollTop() + chatlist.height() == chatbody.height();
    insert(data);
    var bound = $('#self').outerHeight();
    chatlist.css({overflowY: 'scroll', top: bound});
    if (chatlist.height() >= chatbody.height()) {
      chatlist.css({overflowY: 'auto', top: 'auto'});
    }
    if (bottom) {
      chatlist.scrollTop(chatbody.height());
    }
  };
}
function chatMessage(sender, message, data) {
  $('<tr>').append(sender.addClass('sender')
                         .toggleClass('admin', data.admin)
                         .css('color', COLORS[data.team]))
           .append(message.addClass('message'))
           .appendTo(chatbody);
}
$(window).resize(chatScroll(function() {})).resize();
event.on('chat', chatScroll(function(data) {
  chatMessage(
      $('<td>').text(data.sender),
      $('<td>').text(data.message),
      data);
}));
event.on('clue', chatScroll(function(data) {
  chatMessage(
      $('<td>').text(data.sender),
      $('<td>').append(
          'clued ',
          $('<strong>').text(data.game.clue),
          ' for ',
          $('<strong>').text(data.game.count)),
      data);
  game = data.game;
  render();
}));
event.on('guess', chatScroll(function(data) {
  chatMessage(
      $('<td>').text(data.sender),
      !data.word ? $('<td>').text('passed') : $('<td>').append(
          'guessed ',
          $('<strong>').text(data.word.word)
                       .css('color', COLORS[data.word.identity])),
      data);
  game = data.game;
  render();
}));
chattext.keypress(function(evt) {
  if (evt.which == 13) {
    evt.preventDefault();
    if (chattext.val().trim()) {
      $.post('say', {
        sender: name,
        team: team,
        message: chattext.val(),
        admin: admin ? 'admin' : ''
      });
      chattext.val('');
    }
  }
});

function guess(index) {
  $.post('guess', {
    index: index,
    team: team,
    name: name
  });
}
$(document).on('click', '.guessable .unrevealed', function() {
  guess($(this).data('index'));
});
$('#pass').click(function(evt) {
  evt.preventDefault();
  guess();
});

function render() {
  board.empty();
  for (var i = 0; i < 5; ++i) {
    var row = $('<tr>').appendTo(board);
    for (var j = 0; j < 5; ++j) {
      var data = game.words[5 * i + j];
      var cell = $('<td>').text(data.word)
                          .data('index', 5 * i + j)
                          .addClass('shadow')
                          .appendTo(row);
      if (data.revealed || admin) {
        cell.css('background-color', COLORS[data.identity]);
      } else {
        cell.addClass('unrevealed');
      }
    }
  }
  board.toggleClass('guessable',
      game.state == 'guess' && name && game.team == team);
  $('#header').css('background-color', COLORS[game.team]);
  chattext.prop('disabled', !name);

  var form = false, pass = false;
  switch (game.state) {
    case 'guess':
      if (!admin && name && game.team == team) {
        pass = true;
      }
      $('#clue').text(game.clue);
      $('#count').text(game.count);
      $('#header input').val('');
      break;
    case 'clue':
      if (admin && game.team == team) {
        form = true;
      } else {
        $('#clue').text('waiting for spymaster...');
        $('#count').text('');
      }
      break;
    case 'over':
      $('#clue').text(game.team + ' wins');
      $('#count').text('');
      break;
  }
  $('#header .tooltip').toggle(form);
  $('#header .clues').toggle(!form);
  $('#pass').toggle(pass);
  $('.labels').toggle(game.state == 'guess');
  $('input.dummy').prop('disabled', !form);
}
render();

});
