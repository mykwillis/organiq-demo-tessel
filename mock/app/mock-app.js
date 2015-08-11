var organiq = require('organiq');

organiq.getDevice('MockTesselDevice')
.then(function(device) {
    device.log('Write this message to the Tessel console.');

    device.ping().then(function(res) {
      console.log('ping -> ' + res);
    });

    device.scream('i am a robot').then(function(res) {
      console.log('scream -> ' + res);
    });

    device.on('tick', function(ts) {
      console.log('received tick at ' + ts);
    });
  });


organiq.installDriver('MockTesselDevice', function(req, next) {
  return next();
});