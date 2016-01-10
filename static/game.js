var COLORS = {
  red: 'tomato',
  blue: 'skyblue',
  neutral: 'tan',
  assassin: 'gray'
};

$(function() {

var chatlist = $('#chatbox table'),
    chatbody = $('#chatbox tbody'),
    chattext = $('#chatbox input'),
    board = $('#board table'),
    event = io.connect();

if ('name' in localStorage) {
  $('#name').val(localStorage.name);
}
$('#name').change(function() {
  localStorage.name = $(this).val();
  chattext.prop('disabled', !localStorage.name);
}).change();
if ('team' in localStorage && localStorage.team in COLORS) {
  document.getElementById(localStorage.team).checked = true;
}
$('.team').change(function() {
  localStorage.team = $(this).attr('id');
  render();
});

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
      event.emit('say', {
        sender: localStorage.name,
        team: localStorage.team,
        message: chattext.val(),
        admin: admin
      });
      chattext.val('');
    }
  }
});

$(document).on('click', '.guessable .unrevealed', function() {
  $.post('/guess', {
    index: $(this).data('index'),
    team: localStorage.team,
    name: localStorage.name
  });
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
      game.state == 'guess' && game.team == localStorage.team);
  $('#header').css('background-color', COLORS[game.team]);
  // TODO disable (and clear) or enable the form
  console.log(game.team, game.state);
}
render();

});
