$(function() {

var gamelist = [];
for (var name in games) {
  gamelist.push(games[name]);
}
gamelist.sort(function(a, b) {
  return b.modified - a.modified;
});

$.each(gamelist, function(_, game) {
  var date = new Date(game.modified);
  var thumb = $('<table>').addClass('thumb shadow');
  for (var i = 0; i < 5; ++i) {
    var row = $('<tr>').appendTo(thumb);
    for (var j = 0; j < 5; ++j) {
      var data = game.words[5 * i + j];
      var cell = $('<td>').appendTo(row);
      if (data.revealed) {
        cell.css('background-color', COLORS[data.identity]);
      }
    }
  }
  $('#games').append($('<tr>')
      .append($('<td>').append(
          game.name,
          $('<sub>').text(date.toLocaleString())).addClass('name'))
      .append($('<td>').append(thumb))
      .append($('<td>').text(game.wordlist))
      .append($('<td>').text(game.state).css('color', COLORS[game.team]))
      .append($('<td>').append(
          $('<span>').text(game.red).css('color', COLORS.red),
          '-',
          $('<span>').text(game.blue).css('color', COLORS.blue)))
      .append($('<td>').append(
          $('<a>').text('play').attr('href', '/' + game.name + '/player'),
          $('<sub>').append(
              $('<a>').text('spymaster').attr('href', '/' + game.name + '/spymaster')))));
});

});
