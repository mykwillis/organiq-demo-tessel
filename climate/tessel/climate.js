/**
 * Demonstration of exposing the Tessel Climate module to Organiq clients.
 *
 * This demo is set up to expect an si7020 module connected to port 'A' of
 * your Tessel. It will expose a device with name 'ClimateDevice' in the global
 * Organiq namespace.
 */
var tessel = require('tessel');
var climatelib = require('climate-si7020');
var organiq = require('organiq-tessel');
var nodefn = require('when/node');

// Note: we assume that the module is plugged into port 'A' of the Tessel!
var climate = climatelib.use(tessel.port['A']);

// Convert node-style callbacks used in climate object methods to promises.
// Organiq allows property getters to return promises for their values, which
// simplifies the code a lot.
// https://github.com/cujojs/when/blob/master/docs/api.md#nodeliftall
var promisedClimate = nodefn.liftAll(climate);

// Ready state of the climate module.
var _ready = false;

// Implementation object that we will expose via Organiq.
var device = {

  // private methods (not exposed via Organiq b/c they have leading underscore)
  _temperature: function(scale) {
    if (!_ready) {
      return -1;
    }
    return promisedClimate.readTemperature(scale).then(function(temp) {
      return temp;
    });
  },

  _humidity: function() {
    if (!_ready) {
      return -1;
    }
    return promisedClimate.readHumidity().then(function(humid) {
      return humid;
    });
  },

  // exposed methods
  log: function(s) { console.log(s); },

  // exposed properties
  get ready() { return _ready; },
  get temperatureF() { return this._temperature('f'); },
  get temperatureC() { return this._temperature('c'); },
  get humidity() { return this._humidity(); }
};

organiq.registerDevice('ClimateDevice', device);

// When the climate module is ready, set the global ready flag and notify
// any listeners.
climate.on('ready', function() {
  _ready = true;
  device.emit('ready', true);
});

climate.on('error', function(err) {
  _ready = false;
  device.emit('error', err);
})

