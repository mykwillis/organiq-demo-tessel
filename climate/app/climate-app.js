var organiq = require('organiq');

organiq.getDevice('ClimateDevice')
.then(
  function(device) {

    device.on('ready', function(b) {
      console.log('Climate device is now ready.');
    });

    device.on('error', function(err) {
      console.log('Climate device has encountered an error: ', err);
    });

    // Print out temperature and humidity every five seconds.
    setInterval(function() {
      device.sync().then(function() {
        console.log('Temperature: ' + device.temperatureF.toFixed(4));
        console.log('Humidity: ' + device.humidity.toFixed(4));
      },function(err) {
        console.log('Error encountered synchronizing device.', err);
      });
    }, 5000)
  },
  function(err) {
    console.log('Failed to connect to climate module: ', err);
  }
);


