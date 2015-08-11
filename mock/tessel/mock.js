var organiq = require('organiq');

var _counter = 0;

var device = {
  // exposed methods
  log: function(s) { console.log(s); },
  ping: function() { return 'pong'; },
  scream: function(s) { return s.toUpperCase() + '!!!'; },
  incrementCounter: function(i) { _counter += (i || 1); },

  // exposed properties
  get counter() { return _counter; },
  set counter(c) { _counter = c; }

};

organiq.registerDevice('MockTesselDevice', device);

function getRandomInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// emit a 'tick' event every second
setInterval(function() {
  device.emit('tick', Date.now());
  device.counter = device.counter + getRandomInt(-20, 20);

}, 10000);
