/**
 * Demonstration of exposing the Tessel Ambient module to Organiq clients.
 *
 * This demo is set up to expect an ambient-attx4 module connected to port 'B'
 * of your Tessel. It will expose a device with name 'AmbientDevice' in the
 * global Organiq namespace.
 *
 * BUGBUG: This demo does not seem to currently work correctly on Tessel, as
 * BUGBUG: the asynchronous callbacks aren't being invoked.
 */
var tessel = require('tessel');
var ambientlib = require('ambient-attx4');
var organiq = require('organiq-tessel');
var nodefn = require('when/node');

// Note: we assume that the module is plugged into port 'B' of the Tessel!
var ambient = ambientlib.use(tessel.port['B']);

// Convert node-style callbacks used in ambient object methods to promises.
// Organiq allows property getters to return promises for their values, which
// simplifies the code a lot.
// https://github.com/cujojs/when/blob/master/docs/api.md#nodeliftall
var promisedAmbient = nodefn.liftAll(ambient);

// Ready state of the ambient module.
var _ready = false;

// Implementation object that we will expose via Organiq.
var device = {
  // exposed properties
  get ready() { return _ready; },
  get lightLevel() { return promisedAmbient.getLightLevel(); },
  get soundLevel() { return promisedAmbient.getSoundLevel(); },

  // exposed methods
  setLightTrigger: function(val) {
    return promisedAmbient.setLightTrigger(val);
  },
  clearLightTrigger: function() {
    return promisedAmbient.clearLightTrigger();
  },
  setSoundTrigger: function(val) {
    return promisedAmbient.setSoundTrigger(val);
  },
  clearSoundTrigger: function() {
    return promisedAmbient.clearSoundTrigger();
  }
};

ambient.on('ready', function() {
  _ready = true;
  device.emit('ready', true);
});

ambient.on('error', function(err) {
  _ready = false;
  device.emit('error', err);
});

ambient.on('light', function(data) {
  device.emit('light', data);
});

ambient.on('sound', function(data) {
  device.emit('sound', data);
});

ambient.on('light-trigger', function(data) {
  device.emit('light-trigger', data);
});

ambient.on('sound-trigger', function(data) {
  device.emit('sound-trigger', data);
});

organiq.registerDevice('AmbientDevice', device);
