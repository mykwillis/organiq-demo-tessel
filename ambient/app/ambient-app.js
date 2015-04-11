var organiq = require('organiq');

organiq.getDevice('AmbientDevice')
.then(
  function(device) {

    device.on('ready', function(b) {
      console.log('Ambient device is now ready.');
    });

    device.on('error', function(err) {
      console.log('Ambient device has encountered an error: ', err);
    });

    // Print out sound and light level every five seconds.
    setInterval(function() {
      device.sync().then(function() {
        console.log('Light Level: ' + device.lightLevel);
        console.log('Sound Level: ' + device.soundLevel);
      },function(err) {
        console.log('Error encountered synchronizing device.', err);
      });
    }, 5000)
  },
  function(err) {
    console.log('Failed to connect to ambient module: ', err);
  }
);


