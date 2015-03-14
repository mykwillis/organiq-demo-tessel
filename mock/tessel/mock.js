var organiq = require('organiq-tessel');

var _counter = 0;

var device = {
  // exposed methods
  log: function(s) { console.log(s); },
  ping: function() { return 'pong'; },
  scream: function(s) { return s.toUpperCase() + '!!!'; },
  incrementCounter: function(i) { _counter += (i || 1); },

  // exposed properties
  get counter() { return _counter; }

};

organiq.registerDevice('MockTesselDevice', device);

// emit a 'tick' event every second
setInterval(function() {
  device.emit('tick', Date.now());
}, 1000);