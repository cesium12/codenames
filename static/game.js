var COLORS = {
  red: 'red',
  blue: 'blue',
  neutral: 'white',
  assassin: 'black'
};

$(function() {

var chatlist = $('#chatbox table'),
    chatbody = $('#chatbox tbody'),
    chatform = $('#chatbox form'),
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
$(window).resize(chatScroll(function() {})).resize();
event.on('chat', chatScroll(function(data) {
  $('<tr>').append($('<td>').text(data.sender).addClass('sender'))
           .append($('<td>').text(data.message).addClass('message'))
           .toggleClass('admin', data.admin)
           .appendTo(chatbody);
}));
chatform.submit(function(evt) {
  evt.preventDefault();
  if (chattext.val()) {
    event.emit('say', {
      sender: localStorage.name,
      message: chattext.val(),
      admin: admin
    });
    chattext.val('');
  }
  chattext.blur();
});
$(document).keypress(function(evt) {
  if (evt.which == 13) {
    chattext.focus();
  }
});

function render(state) {
  board.empty();
  for (var i = 0; i < 5; ++i) {
    var row = $('<tr>').appendTo(board);
    for (var j = 0; j < 5; ++j) {
      var data = state.words[5 * i + j];
      var cell = $('<td>').text(data.word).addClass('shadow').appendTo(row);
      if (data.revealed || admin) {
        cell.css('background-color', COLORS[data.identity]);
      }
    }
  }
}
render(state);

});
