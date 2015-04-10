require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Module Dependencies.
 */
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var Schema = require('./schema');
var debug = require('debug')('organiq:sdk:device');

/**
 * Export DeviceWrapper constructor
 */
module.exports = DeviceWrapper;

/**
 * Local device interface.
 *
 * Manages the interface between Organiq and local objects implementing device
 * functionality. Could be called "native (JavaScript) device wrapper."
 *
 * It is relatively straightforward to create device objects that implement the
 * Organiq device interface (get/set/invoke/describe/config) and register them
 * directly with organiq.register(). However, it can be simpler and more natural
 * to implement methods and properties with native JavaScript functionality.
 *
 * DeviceWrapper encapsulates an existing 'native' JavaScript object and
 * automatically exposes its public methods, properties, and events to Organiq.
 *
 * var organiq = require('organiq-core');
 * var container = organiq();
 * ...
 * var device = new DeviceWrapper({
 *    someFunc: function() { ... }
 *    events: []
 *
 *
 * @param {Object} impl User-supplied implementation object.
 * @param {Object} [schema] schema for the device, specifying properties,
 *  methods, and events to expose. If omitted, the schema is created
 *  automatically by inspecting the given implementation object.
 * @param {Object} [options] optional options
 * @constructor
 */
function DeviceWrapper(impl, schema, options) {
  if (!(this instanceof DeviceWrapper)) {
    return new DeviceWrapper(impl, schema);
  }
  this.impl = impl;
  this.schema = schema || Schema.fromObjectDefinition(impl);
  this.config = {};
  options = options || {};
  this.strictSchema = options.strictSchema || false;

  // Make sure implementation object implements all of the functions given in
  // the schema.
  for (var m in this.schema.methods) {
    if (typeof impl[m] !== 'function') {
      throw new Error('Required method ' + m + ' is not implemented by object.');
    }
  }

  // We want to be notified whenever the implementation object modifies one of
  // its public properties. To do this, we replace the user-supplied property
  // (which may be a simple object, or some combination of getter/setter) with
  // a new getter/setter pair of our own. Our implementation is essentially a
  // 'spy' that calls through to the original implementation transparently.

  // Create getters/setters for all of the schema-defined properties that wrap
  // the definitions given in the implementation.

  /**
   * Helper method for creating a getter / setter pair for a property.
   *
   * @param {DeviceWrapper} target The device on which the new getter/setter will
   *  be defined
   * @param {Object} impl User-supplied implementation object
   * @param {String} property The property name to be spied on
   */
  function makePropertySpy(target, impl, property) {
    // Rename the original property implementation. Note that we can't do a
    // simple assignment, because this won't work correctly with getters.
    var impldesc = Object.getOwnPropertyDescriptor(impl, property);
    Object.defineProperty(impl, '__' + property, impldesc);

    var desc = { enumerable: true };

    // only create a getter for data descriptors (that is, normal properties
    // attached to an object), or accessor descriptors with a getter.
    if (typeof(impldesc.value) !== 'undefined' || impldesc.get !== 'undefined') {
      desc.get = function getSpy() { return impl['__' + property]; };
    }

    // only create a setter for writable data descriptors or accessor
    // descriptors with a setter.
    if (impldesc.writable || impldesc.set !== 'undefined') {
      desc.set =  function setSpy(value) {
        impl['__' + property] = value;  // call original implementation
        target.put(property, value);    // notify DeviceWrapper
      };
    }
    Object.defineProperty(impl, property, desc);
  }

  // Create a spy method for each property in the schema.
  for (var prop in this.schema.properties) {
    if (this.schema.properties.hasOwnProperty(prop)) {
      // It is possible that the implementation object doesn't have one of the
      // defined properties defined. Create a default property of the correct
      // type so that the getter/setter has something to wrap.
      if (!(prop in impl)) {
        impl[prop] = this.schema.properties[prop].constructor();
      }
      makePropertySpy(this, impl, prop);
    }
  }

  // If the implementation device is not already an EventEmitter, give it an
  // implementation.
  var self = this;
  if (typeof impl.on !== 'function') {
    impl.__emitter = new EventEmitter();
    impl.on = function(ev, fn) { return impl.__emitter.on(ev, fn); };
    impl.emit = function() { return impl.__emitter.emit.apply(impl, arguments); };
  }

  // install emit() spy that invokes our notify()
  impl.__emit = impl.emit;
  impl.emit = function() {
    var args = [].slice.call(arguments);  // convert arguments to Array
    var event = args.shift();

    // If this event is in the device schema, or we have strictSchema mode
    // disabled, then send the event via notify().
    if (!self.strictSchema || event in [self.schema.events]) {
      self.notify(event, args);
    }
    return impl.__emit.apply(impl, arguments);
  };
}
util.inherits(DeviceWrapper, EventEmitter);

/**
 * Get a local device property.
 *
 * Fetches the requested device property from the implementation object.
 *
 * @param {String} property
 */
DeviceWrapper.prototype.get = function(property) {
  if (!this.schema.properties.hasOwnProperty(property)) {
    throw Error('Property ' + property + ' is invalid for schema.');
  }
  return this.impl['__' + property];
};

/**
 * Set a property on a local device.
 *
 * @param {String} property
 * @param {Object} value
 */
DeviceWrapper.prototype.set = function(property, value) {
  if (!this.schema.properties.hasOwnProperty(property)) {
    throw Error('Property ' + property + ' is invalid for schema.');
  }
  // set the local device state by invoking the underlying device implementation
  // for the property (which was renamed when the spy was installed).
  this.impl['__' + property] = value;
};

/**
 * Invoke a method on a local device.
 *
 * @param {String} method
 * @param {Array} params List of parameters to pass to method
 */
DeviceWrapper.prototype.invoke = function(method, params) {
  if (!this.schema.methods.hasOwnProperty(method)) {
    throw Error('Method ' + method + ' is invalid for schema.');
  }
  var impl = this.impl;
  var args = params || [];
  if (!Array.isArray(args)) {
    args = [args];
  }
  return impl[method].apply(impl, args);
};

/**
 * Get device schema information.
 *
 * @param {String} property Currently unused.
 * @returns {Object} the device schema
 */
DeviceWrapper.prototype.describe = function(property) {
  switch(property) {
    case 'schema':
      return this.schema;
    case 'config':
      return this.config;
    default:
      throw new Error('Unrecognized describe property: ' + property);
  }
};

/**
 * Configure the device.
 *
 * @param {String} property Currently unused
 * @param {Object} config Configuration object
 */
DeviceWrapper.prototype.config = function(property, config) {
  debug('Updating config: ' + JSON.stringify(config, null, 2));
  this.config = config;
  return true;
};



/**
 * Notify the local device container of an event.
 *
 * This method is intended to be called by the device implementation itself,
 * and should not be called by other components.
 *
 * Note that events that are defined as part of the device schema are
 * automatically sent to the device container when emit()'d by the device.
 *
 * @param {String} event
 * @param {Array} params Array of parameters passed to event handler
 * @private
 */
DeviceWrapper.prototype.notify = function(event, params) {
  //params.unshift('notify', event);    // This breaks on Tessel
  params.unshift(event);
  params.unshift('notify');
  this.emit.apply(this, params);  // emit('notify', 'customEvent', params)
};

/**
 * Put a new metric via the local device container.
 *
 * This method may be used by any user-supplied code to notify the device
 * container of an updated device metric.
 *
 * Changes to public properties are automatically detected, and put() invoked.
 *
 * @param {String} metric
 * @param {Object} value
 * @private
 */
DeviceWrapper.prototype.put = function(metric, value) {
  this.emit('put', metric, value);
};


},{"./schema":3,"debug":5,"events":59,"util":63}],2:[function(require,module,exports){
/**
 * Module Dependencies.
 */
var when = require('when');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

/**
 * Export ProxyWrapper constructor
 */
module.exports = ProxyWrapper;

/**
 * Native wrapper for Organiq device proxy.
 *
 * var proxy = organiq.getDevice();
 * proxy.callMethod();
 * proxy.sync(function() {
 *  var someProp = proxy.propValue;
 *  var anotherProp = proxy.anotherValue;
 * });
 * proxy.on('someEvent', function(ev) {
 *  // process event
 * })
 *
 * @param {Schema} schema
 * @param {LocalDeviceProxy} proxy
 * @constructor
 */
function ProxyWrapper(schema, proxy) {
  if (!(this instanceof ProxyWrapper)) {
    return new ProxyWrapper(schema, proxy);
  }

  schema = schema || { properties: {}, methods: {}, events: {} };
  var cache = {};

  // build methods on the proxy object with names matching what's in schema.
  var methods = schema.methods;
  function makeMethod(method) {
    return function() {
      var args = [].slice.call(arguments); // pack into 'real' array
      return proxy.invoke(method, args);
    };
  }
  for(var method in methods) {
    if (methods.hasOwnProperty(method)) {
      this[method] = makeMethod(method);
    }
  }

  // build getters/setters for the properties
  var properties = schema.properties;
  function makeProperty(obj, property) {
    Object.defineProperty(obj, property, {
      get: function() { return cache[property]; },
      set: function(value) { this.set(property, value); },
      enumerable: true
    });
  }
  for(var property in properties) {
    if (properties.hasOwnProperty(property)) {
      makeProperty(this, property);
    }
  }

  // Register event handlers.
  var self = this;
  proxy.on('notify', function(event, args) {
    if (!Array.isArray(args)) {
      args = [args];
    }
    args.unshift(event);
    self.emit.apply(self, args); // e.g., this.emit('custom', arg0, arg1, ...)
  });

  proxy.on('put', function(metric, value) {
    self.emit(metric, value);
  });


  /**
   * Get a device property from the remote device.
   *
   * @param {String} property
   * @returns {Promise|*}
   */
  this.get = function(property) {
    return proxy.get(property).then(
      function(res) { cache[property] = res; return res; }
    );
  };

  /**
   * Set a device property on the remote device.
   *
   *
   * proxy.set('prop', '1');
   * var p = proxy.get('prop'); // might not get '1'!
   *
   * @param {String} property The property whose value is to be set.
   * @param {*} value The new value for the property.
   * @param {Object} options Options for how to handle setting
   * @param {Boolean=} options.optimistic If `true`, the new value will be
   *  assigned to the local property immediately, before the remote operation
   *  completes. If the set operation fails, it will be reverted to the
   *  original value. Default is true.
   * @param {Boolean=} options.updateOnSuccess If `true`, the local property
   *  value will be set to `value` upon successful completion. Default is true.
   * @returns {Promise|*}
   */
  this.set = function(property, value, options) {
    options = options || {};
    var optimistic = options.optimistic !== false;        // default true
    var updateOnSuccess = options.updateOnSuccess !== false;  // default true

    // Save off the current value of the property in the event we need to
    // restore it.
    var oldValue = property in cache ? cache[property]: undefined;
    if (optimistic) {
      cache[property] = value;
    }

    return proxy.set(property, value).then(
      function(res) {
        if (updateOnSuccess) {
          cache[property] = value;
          return res;
        }
      }
    ).catch(
      function(err) {
        // don't reset the value if it's different from what it was when we
        // first set it.
        if (optimistic && cache[property] === value) {
          cache[property] = oldValue;
        }
        throw err;
      });
  };

  /**
   * Invoke a method on the remote device.
   *
   * @param {String} method Name of the method to invoke.
   * @param {Array} args List of arguments to pass to the method.
   * @returns {*}
   */
  this.invoke = function(method, args) {
    return proxy.invoke(method, args);
  };

  /**
   * Configure the remote device.
   *
   * @param config
   * @returns {*}
   */
  this.config = function(config) {
    return proxy.config(config);
  };

  /**
   * Synchronize one or more device properties.
   *
   * Property values are not automatically synchronized when the remote device
   * when read. Instead, `sync` must be used to synchronize the local state
   * with the state from the remote device.
   *
   * @param {Array=} properties List of properties to sync. If not specified,
   *  this defaults to all properties, which can be expensive if the device has
   *  many defined properties.
   * @returns {Promise} A promise for the array of properties retrieved.
   */
  this.sync = function(properties) {
    var d = [];
    properties = properties || schema.properties;
    for(var property in properties) {
      if (properties.hasOwnProperty(property)) {
        d.push(this.get(property));
      }
    }
    return when.all(d);
  };
}
util.inherits(ProxyWrapper, EventEmitter);


},{"events":59,"util":63,"when":56}],3:[function(require,module,exports){
/**
 * Module Dependencies.
 */

/**
 * Export Schema constructor
 */
module.exports = Schema;


/**
 * Reserved names (for properties, events, methods) that will not be mapped to
 * the schema.
 *
 * Note that any name starting with an underscore is also skipped.
 *
 * @type {string[]}
 */
var reservedNames = [
  'on', 'emit'
];

//
// Schema
//
// Every Device object has an associated schema which provides information
// about the methods, properties, and events supported by that device. The
// Schema defines the Device interface completely, and allows for validation
// and authorization of operations involving the Device.
//
// Schema objects can be constructed manually, or they may be inferred
// automatically by the object passed to the Device constructor/define. Explicit
// definition is preferred to avoid the possibility of 'leakage' (e.g., private
// device state/information being exposed to external parties).
//
// A Schema is a fairly simple object: it has three sub-objects, one each
// for properties, methods, and events. Each of these, in turn, have one
// property for each 'member', with the value of each member giving its
// type (i.e., the Function object that is used to create instances of that
// type).
//
// The current set of supported types are limited to  JavaScript's Boolean,
// Number, and String, as well as lists and dictionaries (objects) composed of
// those types.
//
function Schema(attributes) {
  this.properties = attributes.properties;
  this.methods = attributes.methods;
  this.events = attributes.events;
}

// Build a Schema object based on a provided object.
//
// In addition, if an attribute with the name `events` is present, it is
// assumed to be an array of strings documenting the events emitted by
// this object.
//
// Check here:
// http://javascriptweblog.wordpress.com
//  /2011/08/08/fixing-the-javascript-typeof-operator/
// for a way that we can get better type information.
//
/**
 * Construct a Schema object based on a provided object definition.
 *
 * This method inspects the given object and automatically determines what
 * methods, properties, and events are supported by it.
 *
 * By default, all public functions defined on the object will be exposed as
 * methods, and all public getters will be exposed as properties. Any object
 * property that begins with an underscore will be skipped.
 *
 * Note that events are not automatically inferred; the object must have a
 * property named `events` that is an array of strings documenting the emitted
 * events.
 *
 * @param obj Implementation object whose schema is to be inferred.
 * @return {Schema}
 */
Schema.fromObjectDefinition = function(obj) {
  var schema = { properties: {}, methods: {}, events: {} };
  // N.B. We need to use getOwnPropertyNames() rather than for (var p in obj)
  // in order to pick up non-enumerable properties. On Tessel, getters are
  // not enumerable by default, so the normal for (var p in obj) will not
  // pick them up.
  var attrs = Object.getOwnPropertyNames(obj);
  for(var i=0;i<attrs.length;i++) {
    var attr = attrs[i];
    if (attr[0] === '_') { continue; } // skip properties with leading _
    if (reservedNames.indexOf(attr) !== -1) { continue; } // skip reserved words
    // console.log('attr ' + attrs[i] + ' has type: ' + (typeof obj[attrs[i]]));
    var desc = Object.getOwnPropertyDescriptor(obj, attr);
    if (desc.get !== undefined) { // this is a getter property
      schema.properties[attr] = { type: typeof obj[attr] }; // invoke
    }
    else if (typeof obj[attr] === "string") {
      schema.properties[attr] = { type: 'string', constructor: String };
    }
    else if (typeof obj[attr] === "number") {
      schema.properties[attr] = { type: 'number', constructor: Number };
    }
    else if (typeof obj[attr] === "boolean") {
      schema.properties[attr] = { type: 'boolean', constructor: Boolean };
    }
    else if (typeof obj[attr] === "function") {
      // todo: get signature of function
      // # arguments = obj[attr].length
      schema.methods[attr] = { type: 'unknown' };
    }
    else if (typeof obj[attr] === "object" && attr === "events") {
      var events = obj[attr];
      for (var j=0; j<events.length;j++) {
        schema.events[events[j]] = {};
      }
    }
  }
  return new Schema(schema);
};

// Dump out the object definition. The callback to stringify() lets us
// modify how to show function names, which is necessary to get method names
// to show up on Tessel.
Schema.prototype.toString = function() {
  console.log(JSON.stringify(this, function(key, val) {
    console.log(key, val);
    if (typeof val === 'function') {
      // val.name is not defined in Tessel firmware, but if we return 'method'
      // here it will show the name as key.
      //return val.name;
      return 'method';
    }
    return val;
  }, 4 /* indent */));
};

},{}],4:[function(require,module,exports){
(function (process){
/**
 * Shim for WebSocket inclusion.
 *
 * We normally use 'websockets/ws' for WebSockets support, but this fails on
 * Tessel, where the 'sitegui/nodejs-websocket' is required.
 */
var util = require('util');
var EventEmitter = require('events').EventEmitter;

module.exports = process.browser ? BrowserWebSocketShim
                                 : isTesselPackage() ? TesselWebSocketShim
                                                     : require('ws');


/**
 * Determine if we are executing in the Tessel package (as opposed to the
 * `normal` node or browser package).
 *
 * We depend on the 'name' attribute of the package.json in the current
 * directory being 'organiq-tessel'.
 *
 * @return {boolean} true if we are running in organiq-tessel package.
 */
function isTesselPackage() {
  var name = '';
  try { name = require('./package.json').name; }
  catch(e) { }

  return name === 'organiq-tessel';
}


/**
 * Wrapper for nodejs-websocket module, making it behave like the WebSockets/ws
 * module (enough for our needs, anyhow).
 *
 * @param url
 * @return {TesselWebSocketShim}
 * @constructor
 */
function TesselWebSocketShim(url) {
  if (!(this instanceof TesselWebSocketShim)) {
    return new TesselWebSocketShim(url);
  }
  var nws = require('nodejs-websocket');
  var self = this;
  var ws = nws.connect(url, function connect() {
    ws.on('text', function(s) { self.emit('message', s, {}); });
    ws.on('close', function(code, reason) {
      self.emit('close', code, reason);
    });
    ws.on('error', function(e) {
        self.emit('error', e); }
    );
    self.emit('open', self);
  });
  this.send = function(s, cb) { return ws.sendText(s, cb); };
}
util.inherits(TesselWebSocketShim, EventEmitter);


/**
 * Wrapper for native browser WebSocket, making it behave like the WebSockets/ws
 * module (enough for our needs, anyhow).
 *
 * @param url
 * @return {BrowserWebSocketShim}
 * @constructor
 */
function BrowserWebSocketShim(url) {
  if (!(this instanceof BrowserWebSocketShim)) {
    return new BrowserWebSocketShim(url);
  }
  var self = this;
  /*global WebSocket*/
  var ws = new WebSocket(url);
  ws.onopen = function connect() {
    self.emit('open', self);
  };
  ws.onmessage = function(event) {
    self.emit('message', event.data, {});
  };
  ws.onerror = function(ev) {
    self.emit('error', ev);
  };
  ws.onclose = function(ev) {
    self.emit('close', ev.code, ev.reason);
  };
  this.send = function(s, cb) { ws.send(s); if (cb) { cb(); } };
}
util.inherits(BrowserWebSocketShim, EventEmitter);

}).call(this,require('_process'))
},{"./package.json":undefined,"_process":61,"events":59,"nodejs-websocket":undefined,"util":63,"ws":57}],5:[function(require,module,exports){

/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;

/**
 * Use chrome.storage.local if we are in an app
 */

var storage;

if (typeof chrome !== 'undefined' && typeof chrome.storage !== 'undefined')
  storage = chrome.storage.local;
else
  storage = localstorage();

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // is webkit? http://stackoverflow.com/a/16459606/376773
  return ('WebkitAppearance' in document.documentElement.style) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (window.console && (console.firebug || (console.exception && console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31);
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  return JSON.stringify(v);
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs() {
  var args = arguments;
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return args;

  var c = 'color: ' + this.color;
  args = [args[0], c, 'color: inherit'].concat(Array.prototype.slice.call(args, 1));

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
  return args;
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      storage.removeItem('debug');
    } else {
      storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = storage.debug;
  } catch(e) {}
  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage(){
  try {
    return window.localStorage;
  } catch (e) {}
}

},{"./debug":6}],6:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = debug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = require('ms');

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lowercased letter, i.e. "n".
 */

exports.formatters = {};

/**
 * Previously assigned color.
 */

var prevColor = 0;

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 *
 * @return {Number}
 * @api private
 */

function selectColor() {
  return exports.colors[prevColor++ % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function debug(namespace) {

  // define the `disabled` version
  function disabled() {
  }
  disabled.enabled = false;

  // define the `enabled` version
  function enabled() {

    var self = enabled;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // add the `color` if not set
    if (null == self.useColors) self.useColors = exports.useColors();
    if (null == self.color && self.useColors) self.color = selectColor();

    var args = Array.prototype.slice.call(arguments);

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %o
      args = ['%o'].concat(args);
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    if ('function' === typeof exports.formatArgs) {
      args = exports.formatArgs.apply(self, args);
    }
    var logFn = enabled.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }
  enabled.enabled = true;

  var fn = exports.enabled(namespace) ? enabled : disabled;

  fn.namespace = namespace;

  return fn;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  var split = (namespaces || '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

},{"ms":7}],7:[function(require,module,exports){
/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} options
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options){
  options = options || {};
  if ('string' == typeof val) return parse(val);
  return options.long
    ? long(val)
    : short(val);
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(str);
  if (!match) return;
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function short(ms) {
  if (ms >= d) return Math.round(ms / d) + 'd';
  if (ms >= h) return Math.round(ms / h) + 'h';
  if (ms >= m) return Math.round(ms / m) + 'm';
  if (ms >= s) return Math.round(ms / s) + 's';
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function long(ms) {
  return plural(ms, d, 'day')
    || plural(ms, h, 'hour')
    || plural(ms, m, 'minute')
    || plural(ms, s, 'second')
    || ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) return;
  if (ms < n * 1.5) return Math.floor(ms / n) + ' ' + name;
  return Math.ceil(ms / n) + ' ' + name + 's';
}

},{}],8:[function(require,module,exports){
module.exports = require('./lib/organiq');

},{"./lib/organiq":9}],9:[function(require,module,exports){
var req = require('./request');
var express = require('./transports/express');
var websocket = require('./transports/websocket');
var when = require('when');
var debug = require('debug')('organiq:core');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

module.exports = Organiq;

/* test-code */
module.exports._LocalDeviceProxy = LocalDeviceProxy;
/* end test-code */

/**
 * Create an Organiq node.
 *
 * @param {Object=} options
 * @param {Array<String>} options.domains list of domains for which this node
 *  is authoritative.
 * @param {String} options.defaultDomain the default domain to use when non-
 *  qualified deviceids are used. If not specified, the default domain is '.'.
 * @returns {Organiq}
 * @constructor
 */
function Organiq(options) {
  if (!(this instanceof Organiq)) {
    return new Organiq(options);
  }
  options = options || {};

  this.stack = [];      // middleware stack, ordered toward downstream
  this.devices = {};    // registered device drivers by id
  this.proxies = {};    // arrays of connected local device proxies by id
  this.domains = [];    // domains for which we are authoritative
  this.gateways = {};   // upstream gateways by namespace

  this.domains = options.domains || [];
  this.defaultDomain = options.defaultDomain || '.';

  // TODO: The eventual behavior here should be that we only set the local node
  // TODO: as authority if the domain name matches one in this.domains. However,
  // TODO: the existing logic expects us to act as authority for any domain that
  // TODO: does not have a registered gateway. In particular, we have to find
  // TODO: a way to deal with the fact that gateways might not be registered
  // TODO: in advance of devices registering that rely on them...
  this.localAuthorityIfNoGateway = true;


  /**
   * Return an ExpressJS-compatible middleware interface
   *
   * @param options
   * @returns {ExpressDapi}
   */
  this.expressDapi = function(options) {
    return express(this, options);
  };

  /**
   * Return a WebSocket- and WebSocketServer-compatible interface.
   *
   * @param {Object=} options
   * @returns {WebSocketApi}
   */
  this.websocketApi = function(options) {
    return websocket(this, options);
  };

}
util.inherits(Organiq, EventEmitter);

/**
 * @name AuthorityInfo
 * @property {String} domain Normalized domain name
 * @property {String} deviceid Normalized fully-qualified device name
 * @property {Boolean} isLocal True if the local node is authoritative
 * @property {Object|null} gateway
 * @property {Boolean} isValid True if the device id is valid.
 * @property {String} err if isValid is False, contains string describing error.
 */

/**
 * Get information about the authority for a given deviceid.
 *
 * In addition to determining whether the local node is authoritative for a
 * device or a connected gateway, this routine also supplies a normalized
 * (canonical) deviceid by e.g., lower-casing the given name and appending the
 * default domain if no domain was specified.
 *
 * @param {String} deviceid. Device ids are of the form '[<domain>:]<name>',
 *  where [<domain>:] is optional. If no domain is specified (e.g., no colon
 *  is present), the default domain will be used for the device. If an empty
 *  domain is specified (e.g., the device id starts with a colon), then the
 *  device is assumed to be in the local, non-routed namespace.
 * @returns {AuthorityInfo} authority descriptor object
 * @private
 *
 */
Organiq.prototype.getDeviceAuthority = function getDeviceAuthority(deviceid) {
  /** @type {AuthorityInfo|Object} */
  var authority = {};

  try {
    var parts = deviceid.toLowerCase().split(':');
    if (parts.length === 1) {
      parts[1] = parts[0];
      parts[0] = this.defaultDomain;
    }
    authority.deviceid = parts.join(':');
    authority.domain = parts[0];

    if (authority.domain === '') {
      // An empty domain (e.g., one that was specified with a leading colon in
      // the name) specifies the local, non-routed domain
      authority.gateway = null;
      authority.isLocal = true;
    }
    else if (this.localAuthorityIfNoGateway) {
      // We are to act as the authority for this device if there is no gateway
      // registered for the specified domain.
      authority.gateway = this.gateways[authority.domain];
      if (!authority.gateway) {
        authority.gateway = this.gateways['*'];
      }
      authority.isLocal = !authority.gateway;
    } else {
      authority.isLocal = this.domains.indexOf(authority.domain) > -1;
      authority.gateway = authority.isLocal ? null : this.gateways[authority.domain];
      if (!authority.isLocal && !authority.gateway) {
        authority.gateway = this.gateways['*'];
      }
    }
    authority.isValid = !!(authority.isLocal || authority.gateway);
  }
  catch(e) {
    authority.isValid = false;
    authority.err = e.toString();
  }
  return authority;
};



/**
 * Add middleware to the Organiq stack.
 *
 * Middleware functions are called for every request that passes through the
 * system. They are invoked in the order that they are given to use().
 *
 * @param {function(OrganiqRequest, function)|function[]} fns
 * @returns {Organiq}
 */
Organiq.prototype.use = function use(fns) {

  if (typeof fns === 'function') {
    fns = [fns];
  }

  if (!Array.isArray(fns) || fns.length === 0) {
    throw new TypeError('.use() requires middleware functions');
  }

  fns.forEach(function (fn) {
    this.stack.push(fn);
    fn.organiq = this;
  }, this);

  return this;
};


/**
 * Dispatch a request through the local middleware stack.
 *
 * Requests may be either application-originated (downstream) or device-
 * originated (upstream). After being processed by the local middleware,
 * downstream messages are passed to a registered device (if present),
 * while upstream messages are fanned out to any registered proxies.
 *
 * The registered device may be a local device, or it may be a proxy for
 * a remote node on which the device is actually hosted.
 *
 * Registered proxies may be application (API) clients if we are the
 * authoritative node for the device. Otherwise, a single proxy representing
 * the authoritative node will be present.
 *
 * @param  {OrganiqRequest} req The request to dispatch
 * @return {Promise} A promise for a result value
 */
Organiq.prototype.dispatch = function dispatch(req) {

  var idx;                  // index of current handler in middleware stack
  var previousResult;       // last defined result returned from a handler
  var handlers = this.stack;// array of middleware handlers
  var finalHandler;         // function used when end of handlers reached
  var app = this;
  var downstream = req.isApplicationOriginated();

  // Application-originated requests go "downstream" through the stack,
  // from first (index 0) to last. Device-originated requests go "upstream",
  // starting at the last handler in the stack.
  idx = downstream ? 0 : handlers.length - 1;
  finalHandler = downstream ? finalHandlerDownstream : finalHandlerUpstream;

  return next();

  /**
   * Invoke the next middleware handler in the stack.
   *
   * If the request is not handled before it reaches the end of the stack,
   * the `finalHandler` is called to dispatch the request to the target device
   * (if currently registered).
   *
   * A reference to this function is provided to each layer, and the normal
   * case is that each layer will invoke next() to call the next layer if it
   * does not handle the request itself. We therefore are called recursively,
   * and a promise chain is built from the return values of each handler.
   *
   * @returns {Promise} a promise for a response to the request.
   */
  function next() {

    var layer = handlers[downstream ? idx++ : idx--] || finalHandler;
    var result;

    // Invoke the current layer. It may do any of the following:
    // - return the value of next() (normal case)
    // - return a result directly, or a promise (perhaps fulfilled or rejected)
    //    for a result
    // - return nothing
    // - throw an exception
    //
    // If an exception is thrown, we return a rejected promise that can be used
    // by previous layers in the stack to do error handling.
    // Note that this is different than how Connect middleware functions; in
    // Connect, errors are passed to _future_ layers in the stack, while in
    // Organiq, errors are accessible only to _previous_ layers.
    //
    // In the normal case, the layers will call next() recursively
    try { result = layer(req, next); }
    catch(e) {
      debug('Middleware threw an exception: ', e);
      return when.reject(e);
    }

    // At this point, all of the layers (including the finalHandler) that will
    // be called have been called, and we are unwinding the requests from
    // last-called to first-called layer.

    // We normally just return the value given us by the layer. However, layers
    // may not always return a value, in which case we return the most recent
    // well-defined result from any handler.
    if (typeof result === 'undefined') {
      result = previousResult;
    } else {
      previousResult = result;  // remember most recently returned result
    }

    // if result is still undefined here, it means that either (1) finalHandler
    // failed to return a value, or (2) a layer of middleware did not invoke
    // next() yet also failed to return a value.
    if (result === undefined) {
      var e = 'Layer ' + layer.name + ' must invoke next() or return a value.';
      debug(e);
      return when.reject(new Error(e));
    }

    // Return a promise to the caller
    return when(result);
  }

  /**
   * Handle an application-originated request after it has passed through the
   * middleware stack.
   *
   * The request will be passed to the device object (or its proxy) if it
   * exists, otherwise an Error will be raised.
   *
   * @param {OrganiqRequest} req request object
   */
  function finalHandlerDownstream(req) {

    var device = app.devices[req.deviceid];
    if (!device) {
      var msg = 'Device \'' + req.deviceid + '\' is not connected.';
      debug(msg);
      throw new Error(msg);
    }

    switch(req.method) {
      case 'GET':
        return device.get(req.identifier);
      case 'SET':
        return device.set(req.identifier, req.value) || true;
      case 'INVOKE':
        return device.invoke(req.identifier, req.params) || true;
      case 'SUBSCRIBE':
        return device.subscribe(req.identifier);
      case 'DESCRIBE':
        return device.describe(req.identifier);
      case 'CONFIG':
        return device.config(req.identifier, req.value);
      default:
        debug('Invalid request method: ' + req.method);
        throw new Error(req.method + ' is not a valid downstream request');
    }
  }

  /**
   * Handle a device-originated request after it has passed through the
   * middleware stack.
   *
   * If we are authoritative for this device, then any connected API clients
   * will receive a copy of the request. If we are not authoritative, the node
   * that is will be forwarded the request for processing.
   *
   * @param {OrganiqRequest} req request object
   * @returns {Boolean}
   */
  function finalHandlerUpstream(req) {
    // if we are not authoritative, app.proxies will have exactly one entry -
    // the entry for the authoritative node.
    var proxies = app.proxies[req.deviceid] || [];
    for (var i = 0; i < proxies.length; i++) {
      var proxy = proxies[i];
      try {
        switch (req.method) {
          case 'NOTIFY':
            proxy.emit('notify', req.identifier, req.params);
            break;
          case 'PUT':
            proxy.emit('put', req.identifier, req.value);
            break;
        }
      } catch (err) {
        debug('proxy.emit ' + req.method + ' threw exception:' + err);
      }
    }
    return true;
  }
};


/**
 * Register a device (or device proxy) with the system.
 *
 * The device may be either a locally-implemented device, or a proxy to a
 * device implemented elsewhere.
 *
 * If we are not authoritative for the given device, the registration will be
 * forwarded to the node that is.
 *
 * The device provided must implement get(), set(), invoke(), config(), and
 * subscribe(), describe().
 *
 * @param {String} deviceid
 * @param {DeviceWrapper|WebSocketDeviceProxy} device
 * @returns {DeviceWrapper} the device object given
 */
Organiq.prototype.register = function(deviceid, device) {
  var authority = this.getDeviceAuthority(deviceid);
  if (!authority.isValid) {
    return when.reject(new Error(authority.err));
  }
  deviceid = authority.deviceid;  // use the normalized device name

  // Make sure we haven't already registered this deviceid.
  var devices = this.devices;
  if (typeof devices[deviceid] !== 'undefined') {
    return when.reject(new Error(
      'Register called for already registered deviceid: ' + deviceid));
  }

  if (typeof device.on === 'function') {
    // Pass device-originated messages from the device into the organiq
    // middleware stack.
    var self = this;
    device.on('put', function (metric, value) {
      debug('LocalDevice '+deviceid+': PUT ' + metric + ',' + value);
      req = self.request.put(deviceid, metric, value);
      self.dispatch(req);
    });
    device.on('notify', function (event, args) {
      debug('LocalDevice '+deviceid+': NOTIFY ' + event + ',' + args);
      req = self.request.notify(deviceid, event, args);
      self.dispatch(req);
    });
  }

  this.devices[deviceid] = device;

  debug('Device registered: ' + deviceid);

  // forward the registration to a configured gateway, if present.
  // (This is the normal case when we are running as a device container).
  // Note that we return synchronously to the local client, but the gateway
  // registration is asynchronous.
  if (authority.gateway) {
    var proxy = new LocalDeviceProxy(this, deviceid);
    if (!this.proxies[deviceid]) {
      this.proxies[deviceid] = [];
    }
    this.proxies[deviceid].push(proxy);
    return authority.gateway.register(deviceid, proxy);
  }

  return when.resolve(deviceid);
};

/**
 * Removes a device registration from the system.
 *
 * Once deregistered, a device is no longer reachable.
 *
 * @param {string} deviceid
 * @returns {DeviceWrapper} the device originally registered
 *
 */
Organiq.prototype.deregister = function(deviceid) {
  var authority = this.getDeviceAuthority(deviceid);
  if (!authority.isValid) {
    return when.reject(new Error(authority.err));
  }
  deviceid = authority.deviceid;  // use the normalized device name

  if (typeof this.devices[deviceid] === 'undefined') {
    debug('deregister called for unregistered deviceid: ' + deviceid);
    return when.reject(new Error(
      'deregister of unregistered device: ' + deviceid));
  }

  var device = this.devices[deviceid];
  device.removeAllListeners();
  delete this.devices[deviceid];

  debug('Device deregistered: ' + deviceid);

  // Remove the LocalDeviceProxy that was created during registration and
  // tell the gateway to deregister it.
  if (authority.gateway) {
    // there should be exactly one proxy in this case, as no proxy other than
    // the one used for the registration should be allowed (b/c we are not
    // authoritative for this device).
    // so, remove the entire entry
    delete this.proxies[deviceid];
    return authority.gateway.deregister(deviceid);
  }
  return when(device);
};

/**
 * Get a proxy for a device.
 *
 * The returned device proxy is *always* connected to the authoritative node
 * for the requested device, regardless of what node the underlying device is
 * actually attached. This ensures that every proxy obtained with connect()
 * will always travel through the entire device stack configured for the target
 * device.
 *
 * If the local node is authoritative for the requested device, a local device
 * proxy will be returned. Otherwise, an appropriate remote device proxy
 * provided by a transport driver will be returned.
 *
 * Regardless of whether the proxy is local or remote, its methods can be used
 * to make requests of the target device (e.g., `invoke()` or `get()`), and
 * device-originated messages can be handled by installing event handlers for
 * 'put' and 'notify'.
 *
 * This method may be invoked by local code (in the case of an API client or
 * device container), or it may be invoked by a transport driver that is
 * relaying a request from a remote node.
 *
 * This method succeeds even when the requested deviceid is not current
 * registered.
 *
 * @param {string} deviceid Specifies the device to which to connect.
 * @return {LocalDeviceProxy} device proxy (local or remote)
 */
Organiq.prototype.connect = function(deviceid) {
  var authority = this.getDeviceAuthority(deviceid);
  if (!authority.isValid) {
    return when.reject(new Error(authority.err));
  }
  deviceid = authority.deviceid;  // use the normalized device name

  // If we are authoritative for this device, create a proxy object that routes
  // requests through the local device stack. We save off a reference to the
  // proxy so that we can invoke it for device-originated messages from the
  // device.
  if (authority.isLocal) {
    var proxy = new LocalDeviceProxy(this, deviceid);
    if (!this.proxies[deviceid]) {
      this.proxies[deviceid] = [];
    }
    this.proxies[deviceid].push(proxy);

    debug('Client connected to device: ' + deviceid);

    return proxy;
  }

  // We aren't authoritative for the device, so need to forward this request to
  // the authoritative node via the gateway. Note that we route through the
  // authoritative node even if the device is local (i.e., we are its device
  // container). This is necessary to ensure all requests for a device always
  // pass through the entire configured device stack.
  return authority.gateway.connect(deviceid);
};

/**
 * Release a proxy for a device.
 *
 * @params {LocalDeviceProxy} previously connected device proxy
 */
Organiq.prototype.disconnect = function(proxy) {
  var authority = this.getDeviceAuthority(proxy.deviceid);
  if (!authority.isValid) {
    return when.reject(new Error(authority.err));
  }
  var deviceid = authority.deviceid;  // use the normalized device name

  if (authority.isLocal) {
    var proxies = this.proxies[deviceid] || [];
    var idx = proxies.indexOf(proxy);
    if (idx > -1) {
      proxies.splice(idx, 1);
      if (proxies.length === 0) {
        delete this.proxies[deviceid];
      }
    }
  } else {
    return authority.gateway.disconnect(proxy);
  }
};

/**
 * Register a gateway with the system.
 *
 * If devices for which this gateway is authoritative have already been
 * registered, they will be registered with the gateway.
 *
 * A `gatewayRegistered` event is raised upon successful completion.
 *
 * The device provided must implement register(), deregister(), connect(),
 * and disconnect().
 *
 * @param {String} domain The domain for which this gateway is the authority.
 *  May be a domain name or the wildcard '*' domain, in which case the gateway
 *  is considered authority for all domains.
 * @param {Object} gateway
 *
 */
Organiq.prototype.registerGateway = function(domain, gateway) {
  domain = domain.toLowerCase();
  if (this.gateways[domain]) {
    throw new Error('Gateway already registered.');
  }
  this.gateways[domain] = gateway;

  if (this.localAuthorityIfNoGateway) {
    // In this transitional case, we may have registered devices locally that
    // should be registered with this gateway. Enumerate the registered devices,
    // and for any that we determine the authority should be this new gateway,
    // register them.
    var devices = this.devices;
    for (var deviceid in devices) {
      if (devices.hasOwnProperty(deviceid)) {
        var authority = this.getDeviceAuthority(deviceid);
        if (authority.gateway === gateway) {
          // TODO: This code is duplicated from register()
          var proxy = new LocalDeviceProxy(this, deviceid);
          if (!this.proxies[deviceid]) {
            this.proxies[deviceid] = [];
          }
          this.proxies[deviceid].push(proxy);
          gateway.register(deviceid, proxy);
        }
      }
    }

  }
  debug('Gateway registered.');

  this.emit('gatewayRegistered', domain);
  return gateway;
};

/**
 * Remove a gateway.
 *
 */
Organiq.prototype.deregisterGateway = function(domain) {
  domain = domain.toLowerCase();
  if (!this.gateways[domain]) {
    throw new Error('There is no registered gateway.');
  }
  delete this.gateways[domain];

  debug('Gateway deregistered.');
  return true;
};

/**
 * Expose the request constructor as a property on the app object.
 *
 * @type {OrganiqRequest|exports}
 */
Organiq.prototype.request = req;

/**
 * Provides a device interface to the local organiq stack.
 *
 * The standard device methods (get, set, invoke, config, describe) can be
 * invoked directly on this object, and event handlers are supported for
 * 'put' and 'notify'.
 *
 * Used in two contexts:
 *  (1) returned to callers of connect() if we are authoritative for the
 *      requested device.
 *  (2) passed to gateway.register() if a local device is registered for which
 *      we are not authoritative (and the gateway is).
 *
 * var proxy = organiq.connect(...);
 * proxy.get('someProp');
 * proxy.on('put', function onPut(metric, value) { ... });
 * proxy.on('notify', function onNotify(event, args) { ... });
 *
 * We do not currently track identity or other context information with the
 * proxy, but we are likely to do so in the future.
 *
 * @param {Organiq} organiq
 * @param deviceid
 * @constructor
 */
function LocalDeviceProxy(organiq, deviceid) {
  this.deviceid = deviceid;

  this.get = function(property) {
    var req = organiq.request.get(deviceid, property);
    return organiq.dispatch(req);
  };
  this.set = function(property, value) {
    var req = organiq.request.set(deviceid, property, value);
    return organiq.dispatch(req);
  };
  this.invoke = function(method, params) {
    var req = organiq.request.invoke(deviceid, method, params);
    return organiq.dispatch(req);
  };
  this.subscribe = function(event) {
    var req = organiq.request.subscribe(deviceid, event);
    return organiq.dispatch(req);
  };
  this.describe = function(property) {
    var req = organiq.request.describe(deviceid, property);
    return organiq.dispatch(req);
  };
  this.config = function(property, value) {
    var req = organiq.request.config(deviceid, property, value);
    return organiq.dispatch(req);
  };

  // emits 'put' and 'notify' events
}
util.inherits(LocalDeviceProxy, EventEmitter);


},{"./request":10,"./transports/express":11,"./transports/websocket":12,"debug":13,"events":59,"util":63,"when":33}],10:[function(require,module,exports){
/**
 * Module dependencies.
 */


/**
 * Organiq Request prototype.
 */

var exports = module.exports = OrganiqRequest;
var upstreamMethods = ['NOTIFY', 'PUT'];
var downstreamMethods = ['GET', 'SET', 'INVOKE', 'SUBSCRIBE', 'CONFIG',
                         'DESCRIBE'];

/*
 * Internal request representation.
 *
 * An OrganiqRequest object is used to move requests through the system after
 * they have been received from the network or other transport. It is this
 * object that is given to each layer of the middleware stack.
 *
 * These objects are normally created via the factory functions attached to
 * this constructor, e.g., OrganiqRequest.get(), OrganiqRequest.invoke(), etc.
 *
 * @returns {OrganiqRequest}
 * @constructor
 */
function OrganiqRequest(deviceid, method) {
  if (!(this instanceof OrganiqRequest)) {
    return new OrganiqRequest(deviceid, method);
  }

  this.deviceid = deviceid;   // target device
  this.method = method;   // one of GET, SET, INVOKE, ...
  this.identifier = null; // property, method, or metric name (if applicable)
  this.value = null;      // property or metric value being SET or PUT
  this.params = {};       // parameters of method or event (INVOKE or NOTIFY)
  this.reqid = null;      // unique request id used for overlapped requests
}

exports.get = function(deviceid, property) {
  var req = new OrganiqRequest(deviceid, 'GET');
  req.identifier = property;
  return req;
};
exports.set = function(deviceid, property, value) {
  var req = new OrganiqRequest(deviceid, 'SET');
  req.identifier = property;
  req.value = value;
  return req;
};
exports.invoke = function(deviceid, method, params) {
  var req = new OrganiqRequest(deviceid, 'INVOKE');
  req.identifier = method;
  req.params = params;
  return req;
};
exports.subscribe = function(deviceid, event) {
  var req = new OrganiqRequest(deviceid, 'SUBSCRIBE');
  req.identifier = event;
  return req;
};
exports.describe = function(deviceid, property) {
  var req = new OrganiqRequest(deviceid, 'DESCRIBE');
  req.identifier = property;
  return req;
};
exports.config = function(deviceid, property, value) {
  var req = new OrganiqRequest(deviceid, 'CONFIG');
  req.identifier = property;
  req.value = value;
  return req;
};
exports.put = function(deviceid, metric, value) {
  var req = new OrganiqRequest(deviceid, 'PUT');
  req.identifier = metric;
  req.value = value;
  return req;
};
exports.notify = function(deviceid, event, params) {
  var req = new OrganiqRequest(deviceid, 'NOTIFY');
  req.identifier = event;
  req.params = params;
  return req;
};

/**
 * OrganiqRequest instance methods.
 */
var proto = OrganiqRequest.prototype;

/**
 * Specifies whether the request originated from an application request
 * (as opposed to a device notification).
 *
 * @returns {boolean}
 */
proto.isApplicationOriginated = function isApplicationOriginated() {
  return downstreamMethods.indexOf(this.method) !== -1;
};

/**
 * Specifies whether the request originated from a device notification
 * (as opposed to an application request).
 *
 * @returns {boolean}
 */
proto.isDeviceOriginated = function isDeviceOriginated() {
  return upstreamMethods.indexOf(this.method) !== -1;
};

},{}],11:[function(require,module,exports){
/**
 * Express-compatible middleware for Organiq Device API stack.
 *
 * This module allows the Organiq device stack to be exposed as middleware in
 * an Express application. It implements the handle_request() interface
 * expected by Express by translating HTTP requests into appropriate Organiq
 * device API requests that are then dispatched.
 *
 * This module provides access to the low-level Device API interface by both
 * applications and devices. It does not implement the higher-level API used by
 * most applications that use Organiq.
 *
 * Organiq Device API requests are made over HTTP semantically. This module
 * converts the HTTP representation of a request to its Organiq equivalent.
 *
 */

/**
 * Module Dependencies.
 */
var debug = require('debug')('organiq:express');

/**
 * Export ExpressApi factory function.
 */
module.exports = ExpressDapi;



function ExpressDapi(organiq) {

  /**
   * Express-compatible middleware handler for Organiq Device API stack.
   *
   * Convert REST-ful Device API requests to the internal Organiq format and
   * dispatch them through the stack.
   *
   * Middleware requirements:
   *  params
   *  body (npm install body-parser)
   *
   * @api private
   */
  return function organiqApiHandler(httpreq, httpres, next) {
    var deviceid = httpreq.params.deviceid;
    var identifier = httpreq.params.identifier;
    var req;

    // GET /dapi/{deviceid}/{property} -> GET
    // PUT /dapi/{deviceid}/{property} -> SET
    // POST /dapi/{deviceid}/{method}  -> INVOKE
    // GET /dapi/{deviceid}/.schema    -> DESCRIBE
    // PUT /dapi/{deviceid}/.config    -> CONFIG
    // POST /dapi/{deviceid}/metrics   -> PUT [device-originated]
    // POST /dapi/{deviceid}/events    -> NOTIFY [device-originated]
    switch(httpreq.method) {
      case 'GET':
        if (identifier === '.schema') {
          req = organiq.request.describe(deviceid, identifier);
        } else {
          req = organiq.request.get(deviceid, identifier);
        }
        break;
      case 'PUT':
        if (identifier === '.config') {
          var config = httpreq.body;
          req = organiq.request.config(deviceid, identifier, config);
        } else {
          var value = httpreq.body;
          req = organiq.request.set(deviceid, identifier, value);
        }
        break;
      case 'POST':
        if (identifier === 'metrics') {
          // need to crack out the metric information. For now, we expect a
          // single metric with value to be here
          var metrics = httpreq.body;
          var metric = Object.keys(metrics)[0];
          var mvalue = metrics[metric];
          req = organiq.request.put(deviceid, metric, mvalue);
        } else if (identifier === 'events') {
          // need to crack out the event information. For now, we expect a
          // single metric with value to be here
          var events = httpreq.body;
          var event = Object.keys(events)[0];
          var evalue = events[event];
          req = organiq.request.notify(deviceid, event, evalue);
        } else {
          var params = JSON.stringify(httpreq.body);
          req = organiq.request.invoke(deviceid, identifier, params);
        }
        break;
      default:
        throw new Error("Invalid Request");
    }


    //
    // Dispatch the request through the Organiq stack.
    //
    organiq.dispatch(req)
      .then(function(res) {
        return httpres.json(res);
      })
      .catch(function(err) {
        debug('organiq.dispatch failed: ' + err);
        next(err);
      });
  };
}

},{"debug":13}],12:[function(require,module,exports){
/**
 * WebSocket API connection handler.
 *
 * Manages communication with applications and devices connected via the
 * WebSocket Device API.
 *
 * var organiq = require('organiq'),
 *     WebSocketApi = require('organiq/websocket'),
 *     app = organiq();
 * var WebSocketServer = require('ws').Server,
 *     wss = new WebSocketServer({port: 8080});
 *
 * wss.on('connection', new WebSocketApi(app));
 * // or...
 * wss.on('connection', app.websocketApi());
 *
 */

/**
 * Module Dependencies.
 */
var when_ = require('when');
var debug = require('debug')('organiq:websocket');
var util = require('util'); // node util
var EventEmitter = require('events').EventEmitter;

/**
 * Export WebSocketApi factory function.
 */
module.exports = WebSocketApi;

/* test-code */
module.exports._WebSocketGateway = WebSocketGateway;
module.exports._WebSocketDeviceProxy = WebSocketDeviceProxy;
/* end test-code */

var gatewayCommands = ['CONNECT', 'DISCONNECT', 'REGISTER', 'DEREGISTER'];
var downstreamCommands = ['GET', 'SET', 'INVOKE', 'SUBSCRIBE', 'DESCRIBE', 'CONFIG'];
var upstreamCommands = ['PUT', 'NOTIFY'];
var responseCommand = ['RESPONSE'];

function isGatewayCommand(method) {
  return gatewayCommands.indexOf(method) !== -1;
}

function isDownstreamCommand(method) {
  return downstreamCommands.indexOf(method) !== -1;
}

function isUpstreamCommand(method) {
  return upstreamCommands.indexOf(method) !== -1;
}

function isResponseCommand(method) {
  return method === 'RESPONSE';
}

function isValidRequestMethod(method) {
  return ((responseCommand.indexOf(method) !== -1) ||
          (downstreamCommands.indexOf(method) !== -1) ||
          (gatewayCommands.indexOf(method) !== -1) ||
          (upstreamCommands.indexOf(method) !== -1));
}

var MAX_SAFE_INTEGER = 9007199254740991;
function newId() {
  return Math.floor(Math.random() * MAX_SAFE_INTEGER).toString();
}

/**
 * WebSocket JSON 'wire' representation.
 *
 * An WebSocketRequest object is used to move device and administrative requests
 * between hosts connected via the WebSockets driver. This object is similar,
 * but not identical, to the OrganiqRequest used internally in the stack. In
 * particular, it includes administrative commands that are host-to-host and
 * not meaningful on a local host.
 *
 * method    identifier    value
 * GET        property
 * SET        property
 * INVOKE     method
 *
 * PUT        metric
 * NOTIFY     event
 *
 * CONNECT    n/a
 * DISCONNECT n/a
 * REGISTER   n/a
 * DEREGISTER n/a
 *
 * @returns {WebSocketRequest}
 * @constructor
 */
function WebSocketRequest(method, deviceid, connid, identifier, value) {
  if (!(this instanceof WebSocketRequest)) {
    return new WebSocketRequest(method, deviceid, connid, identifier, value);
  }

  this.method = method;
  this.deviceid = deviceid;
  this.connid = connid;
  this.identifier = identifier;
  this.value = value;
}
void(WebSocketRequest);


/**
 * Factory for the WebSocket API handler.
 *
 * Clients use ws.send() to deliver API requests and device notifications
 * in a simple JSON format. These messages are handled by the API handler
 * via on('message'). Properly-formatted requests are converted to
 * internal representations and dispatched through the Organiq stack.
 *
 * Downstream requests from applications to devices travel "forwards" through
 * the stack, while upstream notifications from devices travel "backwards".
 * Administrative requests are not dispatched through the stack, rather they are
 * processed by this component.
 *
 * Responses (both success and failure) are sent to the client with a special
 * message type of RESPONSE.
 *
 * Messages include:
 *  GET, SET, INVOKE, SUBSCRIBE, CONFIG - Application requests made by a client
 *    on this connection and directed at a device (that is not on this
 *    connection).
 *  PUT, NOTIFY - Device notifications originating from a device registered on
 *    this connection.
 *  REGISTER, DEREGISTER - administrative requests issued on behalf of devices
 *    by their device container.
 *  CONNECT, DISCONNECT - administrative requests issued on behalf of devices
 *    by their device container.
 *  RESPONSE - a reply to any of the above. The `reqid` of a RESPONSE message
 *    matches the `regid` given in the request to which it is the response.
 *
 * The JSON protocol format is similar, but not identical, to the internal
 * representation of Organiq messages used locally. Every message has the
 * following properties:
 *
 * Method
 * In addition to handling requests from applications and devices on the
 * connection, the server may also initiate requests to them. Such requests
 * generally originate from applications on other connections that want to
 * communicate with a device on this connection, or system components.
 *
 * Requests in both directions may be overlapped; that is, multiple requests
 * may be outstanding at any given time, and responses to those requests may
 * come in any order. To facilitate multiplexing, each request has an associated
 * `reqid` property (assigned by the sender) which is included in the RESPONSE
 * sent by the responder.
 *
 * @param {Organiq} organiq The core device proxy object
 * @param {object} options
 * @param {String} options.domain If set, this connection will register as
 *  a gateway authoritative for the given domain.
 * @returns {Function} handler function to be installed for 'connection'
 *  or 'open' handler.
 *
 */
function WebSocketApi(organiq, options) {
  options = options || {};
  options.gateway = options.gateway ? true : false;
  options.domain = options.domain || '*';

  /**
   * Connection handler function.
   *
   * This function should be installed as the 'connection' handler for a
   * server-side WebSocketServer, or the 'open' handler for a client-side
   * WebSocket.
   *
   *
   * var wss = new WebSocketServer(...);
   * wss.on('connection', handler) // when
   *  - or -
   * var ws = new WebSocket(...);
   * ws.on('open', handler)
   *
   * @params {WebSocket|undefined} A new WebSocket connection. If not specified,
   *  it is assumed that `this` refers to the WebSocket object.
   */
  return function webSocketApiConnectionHandler(ws) {

    /**
     * Local devices to which the remote node is currently connected.
     *
     * The devices in this collection provide access to locally-registered
     * devices via the local device stack. One entry exists for every currently-
     * established connection between the remote node and a local device.
     *
     * There are two types of device connections: client connections, and
     * master connections (or registrations). Client connections are created to
     * interface directly with API clients, and are used when the local node is
     * authoritative for the device. Master connections are normally created on
     * device containers, and serve to interface between a locally-registered
     * device and its (remote) master node.
     *
     * Connections are established between the remote node and a local device
     * whenever:
     *  (1) the remote node sends a CONNECT request (in response to an API
     *      client calling organiq.connect()) referencing a device for which the
     *      local node is authoritative;
     *  (2) the local node sends a REGISTER request (in response to a device
     *      container calling organiq.register()) identifying a local device
     *      for which the remote node is authoritative.
     *
     * These device objects facilitate both downstream and upstream
     * communication with devices. Downstream requests received from the remote
     * node can be handled simply by invoking the appropriate device method
     * (e.g., `get`, `invoke`), while upstream notifications from the device are
     * captured locally with event handlers and automatically forwarded to the
     * remote node as NOTIFY and PUT commands.
     *
     * In both cases the device object is a LocalDeviceObject that sits upstream
     * of the local device stack. Each device object has event handlers
     * installed that handle device-originated ('put' and 'notify') messages and
     * forward them across the WebSocket connection.
     *
     * @type {Object.<string, LocalDeviceProxy>}
     */
    var devices = {};   // LocalDeviceProxy objects by connid

    /**
     * Collection of proxies for remote devices for which we are authoritative.
     * These proxies are created when we receive a REGISTER from the remote
     * node, and are only used internally.
     *
     * Device proxies are created to stand in for devices that live on the
     * other side of the WebSocket connection. This collection holds only those
     * proxies that were created to interface with remote devices for which
     * we are authoritative.
     *
     * N.B. The proxies object holds only proxies that have been registered with
     *      the local system via organiq.register().
     *
     * @type {Object.<string, WebSocketDeviceProxy>}
     */
    var proxies = {};   // WebSocketDeviceProxy objects by deviceid

    /**
     * Collection of proxies for remote devices for which we are NOT
     * authoritative. These objects are created when a caller on the local node
     * invokes connect().
     *
     * @type {Object.<string, WebSocketDeviceProxy>}
     */
    var proxyConnections = {}; // WebSocketDeviceProxy arrays by deviceid
    var requests = {};  // outstanding server-originated requests, by reqid
    var _reqid = 0;     // request ID used for last server-originated request
    var handlers = {};  // protocol command handlers, by command

    // Access to functions within this closure are required for WebSocketGateway
    // and WebSocketDeviceProxy objects we create. We expose them via this
    // connection object.
    var connection = { sendRequest: sendRequest, sendResponse: sendResponse,
      sendFailureResponse: sendFailureResponse,
      connectLocalDevice: connectLocalDevice,
      disconnectLocalDevice: disconnectLocalDevice,
      disconnectLocalDeviceByDeviceId: disconnectLocalDeviceByDeviceId,
      registerProxyConnection: registerProxyConnection,
      deregisterProxyConnection: deregisterProxyConnection};

    ws = ws || this;    // in case of 'open', ws is undefined and `this` is WebSocket

    ws.on('message', processMessage);
    ws.on('close', processClose);
    ws.on('error', processError);

    // If this connection is being configured as a gateway, all local device
    // registrations need to be forwarded to the remote node. We do this by
    // exposing methods to the local host through a registered gateway object.
    if (options.gateway) {
      organiq.registerGateway(options.domain, new WebSocketGateway(connection));
    }

    /**
     * WebSocket message handler.
     *
     * This handler is installed with the WebSocket and receives all messages
     * sent by the remote node. Requests are of one of three types:
     *  (1) device request or notifications (e.g., GET, SET, INVOKE, NOTIFY)
     *  (2) administrative requests (e.g., REGISTER, CONNECT)
     *  (3) replies to one of the above.
     *
     * The format for both device and administrative requests is a JSON-
     * formatted WebSocketRequest object. Requests always include a `method`
     * and unique `reqid`, with slightly different properties depending on
     * request type. Responses to requests are indicated by method=`RESPONSE`,
     * and have the following additional properties:
     *  `reqid` - the value of reqid from the request message
     *  `success` - a boolean that is true if the request was successful
     *  `res` - on success, a JavaScript object representing the returned value
     *  `err` - on failure, a JavaScript Error object
     *
     * @param {String} data Data provided by the underlying WebSocket provider
     * @param {Object} flags includes `binary` property as boolean
     */
    function processMessage(data, flags) {
      // Check for (unsupported) binary message
      if (flags.binary) {
        throw new Error("Invalid (binary) message received.");
      }

      // Parse and validate the incoming message
      var msg;
      try { msg = JSON.parse(data); }
      catch(e) { debug('Invalid (non-JSON) message received.'); }

      if (!msg || !msg.reqid || !msg.method) {
        throw new Error('Invalid message (missing reqid or method)');
      }

      var method = msg.method;
      if (!isValidRequestMethod(method)) {
        throw new Error(
          'Invalid message received: invalid method \'' + method + '\'');
      }

      // Special handling for responses
      if (isResponseCommand(method)) {
        return handleResponse(msg);
      }

      // Administrative commands
      if (isGatewayCommand(method)) {
        return handlers[method](msg);
      }


      // Downstream commands may be received when we are either the
      // authoritative node for a device, or the remote node is authoritative
      // and the device is attached locally.
      if (isDownstreamCommand(method)) {
        if (typeof devices[msg.connid] === 'undefined') {
          var err = 'Invalid downstream command: bad connection ID.';
          return sendFailureResponse(msg, err);
        }
        var device = devices[msg.connid];
        var promise;

        switch (method) {
          case 'GET':
            promise = device.get(msg.identifier);
            break;
          case 'SET':
            promise = device.set(msg.identifier, msg.value);
            break;
          case 'INVOKE':
            promise = device.invoke(msg.identifier, msg.value);
            break;
          case 'SUBSCRIBE':
            promise = device.subscribe(msg.identifier);
            break;
          case 'DESCRIBE':
            promise = device.describe(msg.identifier);
            break;
          case 'CONFIG':
            promise = device.config(msg.identifier, msg.value);
            break;
        }

        return promise.then(function (res) {
            sendResponse(msg, res);
          })
          .catch(function (err) {
            debug('dispatch failed: ' + err);
            sendFailureResponse(msg, err);
          });
      }

      if (isUpstreamCommand(method)) {
        // If we are authoritative for this device, we will find a proxy for it
        // in proxies[]. This proxy is the one that we gave to the core node's
        // register(). We need to emit an event on it so that the core can send
        // it up through the local stack. In this case, there should be no
        // proxies in proxyConnections[], because any local attempt to connect()
        // to the device would've been handled directly by core.
        //
        // If we are not authoritative for this device, then we might have given
        // out proxies to local connect() API callers. We need to emit on all of
        // these objects to signal to the application-level code.
        var ps = proxies[msg.deviceid] || proxyConnections[msg.deviceid] || [];
        if (!Array.isArray(ps)) {
          ps = [ps];
        }
        for(var i=0;i<ps.length;i++) {
          var proxy = ps[i];
          try {
            switch (method) {
              case 'PUT':
                proxy.emit('put', msg.identifier, msg.value);
                break;
              case 'NOTIFY':
                var params = msg.value;
                if (!Array.isArray(params)) {
                  params = [params];
                }
                proxy.emit('notify', msg.identifier, params);
                break;
            }
          } catch(err) {
            debug('proxy.emit ' + msg.identifier + ' threw exception: ' + err);
          }
        }
        // we don't wait for the PUT or NOTIFY to complete; they are 'fire-and
        // forget' events.
        return sendResponse(msg, true);
      }
    }

    /**
     * Handle a REGISTER protocol command
     *
     * We receive REGISTER commands when we are the authoritative node for a
     * device that was registered on the remote node.
     *
     * We handle the command by creating a WebSocketDeviceProxy object and
     * registering it locally. This allows the remote device to be invoked
     * after requests for it have passed through the local device stack.
     *
     * The remote node should DEREGISTER the device if it goes offline. In
     * any case, the proxy object created locally will be deregistered if the
     * connection drops.
     *
     * If a device with the given deviceid has already been registered on this
     * connection, the operation fails.
     *
     * @param {object} req
     */
    handlers['REGISTER'] = function handleRegister(req) {
      var deviceid = req.deviceid;
      var connid = req.connid;

      // Only one instance of a given deviceid can be registered on a connection.
      if (typeof proxies[deviceid] !== 'undefined') {
        sendFailureResponse(req, 'Already registered');
        return;
      }

      // Create a proxy for the remote device, and register it with the local
      // system. If we get a valid registration id, return it to the caller.
      var proxy = new WebSocketDeviceProxy(connection, deviceid, connid);
      var regid = organiq.register(deviceid, proxy);
      if (regid) {
        proxies[deviceid] = proxy;
        sendResponse(req, deviceid);
      } else {
        sendFailureResponse(req, 'Device registration failed');
      }
    };

    /**
     * Handle a DEREGISTER protocol command.
     *
     * We receive DEREGISTER commands when we are the authoritative node for a
     * device that has been deregistered on the remote node.
     *
     * @param {Object} req
     */
    handlers['DEREGISTER'] = function handleDeregister(req) {
      var deviceid = req.deviceid;
      var proxy = proxies[deviceid];
      if (proxy) {
        delete proxies[deviceid];
        organiq.deregister(deviceid);
        sendResponse(req, proxy.deviceid);
      } else {
        sendFailureResponse(req, 'Unknown device');
      }
    };

    /**
     * Handle a CONNECT protocol command.
     *
     * We receive CONNECT requests when the remote node wants to connect to
     * the authoritative node for a device. When a device has been connected
     * in this manner, the remote node can issue application-originated commands
     * and receive device-originated messages.
     *
     * @param req
     */
    handlers['CONNECT'] = function handleConnect(req) {
      var deviceid = req.deviceid;

      // Attempt to connect to the device on the local node.
      var device = organiq.connect(deviceid);
      if (!device) {
        return sendFailureResponse(req, 'Device connect failed.');
      }

      // Install handlers so that we can generate WebSocket protocol when
      // device-originated messages (NOTIFY and PUT) occur on the device.
      var connid = connectLocalDevice(deviceid, device);

      debug('Connected remote device: ' + deviceid + '; connid=' + connid);

      sendResponse(req, connid);
    };

    /**
     * Handle a DISCONNECT protocol request.
     *
     * @param req
     */
    handlers['DISCONNECT'] = function handleDisconnect(req) {
      var connid = req.connid;

      var device = disconnectLocalDevice(connid);
      if (!device) {
        sendFailureResponse(req, 'Unknown device connection');
      }
      organiq.disconnect(device);

      debug('Disconnected remote device: ' + device.deviceid);

      sendResponse(req, true);
    };

    /**
     * Handle a closed WebSocket connection (via ws.on('close')).
     *
     * This method cleans up all state associated with the client connection.
     */
    function processClose() {
      debug('websocket closed.');
      for (var deviceid in proxies) {
        if (proxies.hasOwnProperty(deviceid)) {
          organiq.deregister(deviceid);
        }
      }
      proxies = {};
      if (options.gateway) {
        organiq.deregisterGateway(options.domain);
      }
    }

    /**
     * Handle an error raised on the WebSocket connection (via ws.on('error')).
     */
    function processError(err) {
      debug('websocket error: ' + err);
    }

    /**
     * Deliver a protocol request to this connection.
     *
     * @param msg
     * @param msg.method
     * @param msg.deviceid
     * @param msg.connid
     * @param msg.identifier
     * @param msg.value
     *
     * @returns {Promise|promise|}
     */
    function sendRequest(msg) {
      var deferred = when_.defer();
      msg.reqid = ++_reqid;
      requests[msg.reqid] = deferred;
      ws.send(JSON.stringify(msg), function ack(err) {
        if (err) {
          delete requests[msg.reqid];
          deferred.reject(err);
        }
      });
      return deferred.promise;
    }

    function sendResponse(req, res) {
      var msg = { reqid: req.reqid, deviceid: req.deviceid, method: 'RESPONSE',
                  success: true, res: res };
      ws.send(JSON.stringify(msg));
    }

    function sendFailureResponse(req, err) {
      var msg = { reqid: req.reqid, deviceid: req.deviceid, method: 'RESPONSE',
                  success: false, err: err };
      debug('request failed: ' + JSON.stringify(msg));
      ws.send(JSON.stringify(msg));
    }

    /**
     * Handle a response from a device on this connection.
     *
     * We simply look up the request based on the id and fulfill the
     * attached promise.
     *
     * @params {object} msg
     */
    function handleResponse(msg) {
      var deferred = requests[msg.reqid];
      delete requests[msg.reqid];

      if (msg.success) {
        deferred.resolve(msg.res);
      } else {
        debug('Request failed: ' + msg.err);
        deferred.reject(new Error(msg.err));
      }
    }

    /**
     * Connect to a local proxy object to enable sending/receiving.
     *
     * This routine installs event handlers for the given proxy to enable
     * device-originated messages to be passed to the remote node. It also
     * saves a reference to the proxy so that downstream messages can be
     * routed to it.
     *
     * @param {String} deviceid
     * @param {LocalDeviceProxy} device
     * @returns {*} The connection id for the local proxy.
     * @private
     */
    function connectLocalDevice(deviceid, device) {

      // Generate a new connection ID, which will be given to the remote node
      // to refer to this device connection.
      var connid = newId();

      // Install handlers so that we can generate WebSocket protocol when
      // device-originated messages (NOTIFY and PUT) occur on the device.
      if (typeof device.on === 'function') {
        device.on('notify', function (event, params) {
          var req = {
            method: 'NOTIFY', deviceid: deviceid, connid: connid,
            identifier: event, value: params
          };
          connection.sendRequest(req);
        });
        device.on('put', function (metric, value) {
          var req = {
            method: 'PUT', deviceid: deviceid, connid: connid,
            identifier: metric, value: value
          };
          connection.sendRequest(req);
        });
      }

      // Put the local device in the connection so we can find it to handle
      // future requests.
      devices[connid] = device;
      return connid;
    }

    /**
     * Disconnect the transport from the given proxy.
     *
     * We remove any installed event handlers and remove the reference to the
     * object.
     *
     * @param connid
     * @return {LocalDeviceProxy} the originally connected local device proxy
     */
    function disconnectLocalDevice(connid) {
      var device = devices[connid];
      if (device) {
        device.removeAllListeners();
        delete devices[connid];
      }
      return device;
    }

    function disconnectLocalDeviceByDeviceId(deviceid) {
      var connid;
      for(connid in devices) {
        if (devices.hasOwnProperty(connid)) {
          var device = devices[connid];
          if (device.deviceid === deviceid) {
            this.connection.disconnectLocalDevice(connid);
            return connid;
          }
        }
      }
      return null;
    }

    function registerProxyConnection(deviceid, proxy) {
      if (!proxyConnections[deviceid]) {
        proxyConnections[deviceid] = [];
      }
      proxyConnections[deviceid].push(proxy);
    }

    function deregisterProxyConnection(deviceid, proxy) {
      var proxies = proxyConnections[deviceid] || [];
      var idx = proxies.indexOf(proxy);
      if (idx > -1) {
        proxies.splice(idx, 1);
        if (proxies.length === 0) {
          delete proxyConnections[proxy.deviceid];
        }
      }
    }

  };
}


/**
 * Proxy for a remote device connected via WebSockets.
 *
 * Device proxies are created to stand in for devices that live on the
 * other side of a WebSocket connection. They can be used to send application-
 * originated requests to remote devices, and may also be used by locally-
 * connected clients to receive device-notifications from remote devices.
 *
 * Device proxies may be created in either of these situations:
 *  (1) a device is registered on the remote node for which the local node
 *      is authoritative. In this case, we will receive a REGISTER command
 *      from the remote host, causing us to create a device proxy and
 *      register it with the local system via organiq.register().
 *  (2) code running on the local node calls organiq.connect() to connect
 *      to a device for which the remote node to which we are connected is
 *      authoritative. In this case, organiq.connect() will invoke our
 *      connect() method, which allocates the proxy.
 *
 * @param {Object} connection
 * @param {String} deviceid
 * @param {String} connid
 * @constructor
 */
function WebSocketDeviceProxy(connection, deviceid, connid) {
  if (!(this instanceof WebSocketDeviceProxy)) {
    return new WebSocketDeviceProxy(connection, deviceid, connid);
  }

  /**
   * Send a device request via WebSocket to the connected remote node.
   *
   * @param {String} method
   * @param {String} identifier
   * @param {object=} value
   * @return {Promise}
   * @private
   */
  this.sendRequest = function sendRequest(method, identifier, value) {
    var req = {
      method: method,
      deviceid: deviceid,
      connid: connid,
      identifier: identifier
    };
    if (typeof value !== 'undefined') {
      req.value = value;
    }

    return connection.sendRequest(req);
  };
}

util.inherits(WebSocketDeviceProxy, EventEmitter);

WebSocketDeviceProxy.prototype.get = function(prop) {
  return this.sendRequest('GET', prop);
};

WebSocketDeviceProxy.prototype.set = function(prop, value) {
  return this.sendRequest('SET', prop, value);
};

WebSocketDeviceProxy.prototype.invoke = function(method, params) {
  return this.sendRequest('INVOKE', method, params);
};

WebSocketDeviceProxy.prototype.subscribe = function(event) {
  return this.sendRequest('SUBSCRIBE', event);
};

WebSocketDeviceProxy.prototype.describe = function(property) {
  return this.sendRequest('DESCRIBE', property);
};

WebSocketDeviceProxy.prototype.config = function(property, value) {
  return this.sendRequest('CONFIG', property, value);
};



/**
 * Gateway for forwarding messages to an upstream gateway.
 *
 * This object is used by the system to send device registration requests
 * to a connected Gateway. It is only used when the local WebSocket connection
 * is created with `gateway: true` in its options.
 *
 * This object also forwards device-originated notifications (NOTIFY, PUT).
 *
 * @param {Object} connection
 * @constructor
 */
function WebSocketGateway(connection) {
  this.connection = connection;
  this.sendRequest = connection.sendRequest;
}

/**
 * Get a proxy for a device for which this remote gateway is authoritative.
 *
 * This method is called by the local node when a connection request is made
 * for a device for which the remote gateway is authoritative.
 *
 * The returned device proxy uses the underlying WebSocket transport to
 * communicate device requests with the authoritative node.
 *
 * @param {String} deviceid
 * @returns {Promise|WebSocketDeviceProxy}
 */
WebSocketGateway.prototype.connect = function(deviceid) {
  var connection = this.connection; // needed for sendRequest handler
  var req = {
    method: 'CONNECT',
    deviceid: deviceid
  };
  return this.connection.sendRequest(req)
    .then(function(connid) {
      var proxy = new WebSocketDeviceProxy(connection, deviceid, connid);
      // these are currently needed to do disconnect below
      proxy.deviceid = deviceid;
      proxy.connid = connid;

      connection.registerProxyConnection(deviceid, proxy);

      debug('Client connected to WebSocket device: ' + deviceid);

      return proxy;
    });
};

/**
 *
 * @param {WebSocketDeviceProxy} proxy
 * @returns {Promise|*}
 */
WebSocketGateway.prototype.disconnect = function(proxy) {
  var connection = this.connection;
  var req = {
    method: 'DISCONNECT',
    deviceid: proxy.deviceid,
    connid: proxy.connid
  };
  return this.connection.sendRequest(req)
    .then(function(res) {
      connection.deregisterProxyConnection(proxy.deviceid, proxy);
      return res;
    });
};

/**
 * Register a device with the remote host.
 *
 * @param deviceid
 * @param device
 * @return {Promise<String|Error>} A promise resolving to the deviceid used in
 *  the registration, or an Error on rejection.
 */
WebSocketGateway.prototype.register = function(deviceid, device) {
  // We are given a LocalDeviceProxy, which sits upstream of the device stack.
  // We will be able to invoke the get, set, etc methods when we receive
  // WebSocket commands to do so. In order to forward device-originated messages
  // to remote clients, we need to register device handlers.
  var connid = this.connection.connectLocalDevice(deviceid, device);

  var req = {
    method: 'REGISTER',
    deviceid: deviceid,
    connid: connid
  };
  return this.connection.sendRequest(req);
};

/**
 * Deregister a previously-registered device with the remote host.
 *
 * @param deviceid
 * @return {Promise<String|Error>} A promise resolving to the deviceid of the
 *  device deregistered, or rejecting as an Error.
 */
WebSocketGateway.prototype.deregister = function(deviceid) {

  var connid = this.connection.disconnectLocalDeviceByDeviceId(deviceid);
  if (!connid) {
    return when_.reject(new Error('device was not registered.'));
  }

  var req = {
    method: 'DEREGISTER',
    deviceid: deviceid,
    connid: connid
  };
  return this.connection.sendRequest(req);
};

/**
 * Send a NOTIFY message to the remote host.
 *
 * @param deviceid
 * @param event
 * @param params
 * @returns {Promise<Boolean|Error>}
 */
WebSocketGateway.prototype.notify = function(deviceid, event, params) {
  var req = {
    method: 'NOTIFY',
    deviceid: deviceid,
    identifier: event,
    params: params
  };
  return this.connection.sendRequest(req);
};

/**
 * Send a PUT message to the remote host.
 *
 * @param deviceid
 * @param metric
 * @param value
 * @return {Promise<Boolean|Error>}
 */
WebSocketGateway.prototype.put = function(deviceid, metric, value) {
  var req = {
    method: 'PUT',
    deviceid: deviceid,
    identifier: metric,
    value: value
  };
  return this.connection.sendRequest(req);
};


},{"debug":13,"events":59,"util":63,"when":33}],13:[function(require,module,exports){
module.exports=require(5)
},{"./debug":14,"C:\\dev\\organiq\\sdk-js\\node_modules\\debug\\browser.js":5}],14:[function(require,module,exports){
module.exports=require(6)
},{"C:\\dev\\organiq\\sdk-js\\node_modules\\debug\\debug.js":6,"ms":15}],15:[function(require,module,exports){
module.exports=require(7)
},{"C:\\dev\\organiq\\sdk-js\\node_modules\\debug\\node_modules\\ms\\index.js":7}],16:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function (require) {

	var makePromise = require('./makePromise');
	var Scheduler = require('./Scheduler');
	var async = require('./env').asap;

	return makePromise({
		scheduler: new Scheduler(async)
	});

});
})(typeof define === 'function' && define.amd ? define : function (factory) { module.exports = factory(require); });

},{"./Scheduler":17,"./env":29,"./makePromise":31}],17:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	// Credit to Twisol (https://github.com/Twisol) for suggesting
	// this type of extensible queue + trampoline approach for next-tick conflation.

	/**
	 * Async task scheduler
	 * @param {function} async function to schedule a single async function
	 * @constructor
	 */
	function Scheduler(async) {
		this._async = async;
		this._running = false;

		this._queue = this;
		this._queueLen = 0;
		this._afterQueue = {};
		this._afterQueueLen = 0;

		var self = this;
		this.drain = function() {
			self._drain();
		};
	}

	/**
	 * Enqueue a task
	 * @param {{ run:function }} task
	 */
	Scheduler.prototype.enqueue = function(task) {
		this._queue[this._queueLen++] = task;
		this.run();
	};

	/**
	 * Enqueue a task to run after the main task queue
	 * @param {{ run:function }} task
	 */
	Scheduler.prototype.afterQueue = function(task) {
		this._afterQueue[this._afterQueueLen++] = task;
		this.run();
	};

	Scheduler.prototype.run = function() {
		if (!this._running) {
			this._running = true;
			this._async(this.drain);
		}
	};

	/**
	 * Drain the handler queue entirely, and then the after queue
	 */
	Scheduler.prototype._drain = function() {
		var i = 0;
		for (; i < this._queueLen; ++i) {
			this._queue[i].run();
			this._queue[i] = void 0;
		}

		this._queueLen = 0;
		this._running = false;

		for (i = 0; i < this._afterQueueLen; ++i) {
			this._afterQueue[i].run();
			this._afterQueue[i] = void 0;
		}

		this._afterQueueLen = 0;
	};

	return Scheduler;

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}],18:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	/**
	 * Custom error type for promises rejected by promise.timeout
	 * @param {string} message
	 * @constructor
	 */
	function TimeoutError (message) {
		Error.call(this);
		this.message = message;
		this.name = TimeoutError.name;
		if (typeof Error.captureStackTrace === 'function') {
			Error.captureStackTrace(this, TimeoutError);
		}
	}

	TimeoutError.prototype = Object.create(Error.prototype);
	TimeoutError.prototype.constructor = TimeoutError;

	return TimeoutError;
});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));
},{}],19:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	makeApply.tryCatchResolve = tryCatchResolve;

	return makeApply;

	function makeApply(Promise, call) {
		if(arguments.length < 2) {
			call = tryCatchResolve;
		}

		return apply;

		function apply(f, thisArg, args) {
			var p = Promise._defer();
			var l = args.length;
			var params = new Array(l);
			callAndResolve({ f:f, thisArg:thisArg, args:args, params:params, i:l-1, call:call }, p._handler);

			return p;
		}

		function callAndResolve(c, h) {
			if(c.i < 0) {
				return call(c.f, c.thisArg, c.params, h);
			}

			var handler = Promise._handler(c.args[c.i]);
			handler.fold(callAndResolveNext, c, void 0, h);
		}

		function callAndResolveNext(c, x, h) {
			c.params[c.i] = x;
			c.i -= 1;
			callAndResolve(c, h);
		}
	}

	function tryCatchResolve(f, thisArg, args, resolver) {
		try {
			resolver.resolve(f.apply(thisArg, args));
		} catch(e) {
			resolver.reject(e);
		}
	}

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));



},{}],20:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function(require) {

	var state = require('../state');
	var applier = require('../apply');

	return function array(Promise) {

		var applyFold = applier(Promise);
		var toPromise = Promise.resolve;
		var all = Promise.all;

		var ar = Array.prototype.reduce;
		var arr = Array.prototype.reduceRight;
		var slice = Array.prototype.slice;

		// Additional array combinators

		Promise.any = any;
		Promise.some = some;
		Promise.settle = settle;

		Promise.map = map;
		Promise.filter = filter;
		Promise.reduce = reduce;
		Promise.reduceRight = reduceRight;

		/**
		 * When this promise fulfills with an array, do
		 * onFulfilled.apply(void 0, array)
		 * @param {function} onFulfilled function to apply
		 * @returns {Promise} promise for the result of applying onFulfilled
		 */
		Promise.prototype.spread = function(onFulfilled) {
			return this.then(all).then(function(array) {
				return onFulfilled.apply(this, array);
			});
		};

		return Promise;

		/**
		 * One-winner competitive race.
		 * Return a promise that will fulfill when one of the promises
		 * in the input array fulfills, or will reject when all promises
		 * have rejected.
		 * @param {array} promises
		 * @returns {Promise} promise for the first fulfilled value
		 */
		function any(promises) {
			var p = Promise._defer();
			var resolver = p._handler;
			var l = promises.length>>>0;

			var pending = l;
			var errors = [];

			for (var h, x, i = 0; i < l; ++i) {
				x = promises[i];
				if(x === void 0 && !(i in promises)) {
					--pending;
					continue;
				}

				h = Promise._handler(x);
				if(h.state() > 0) {
					resolver.become(h);
					Promise._visitRemaining(promises, i, h);
					break;
				} else {
					h.visit(resolver, handleFulfill, handleReject);
				}
			}

			if(pending === 0) {
				resolver.reject(new RangeError('any(): array must not be empty'));
			}

			return p;

			function handleFulfill(x) {
				/*jshint validthis:true*/
				errors = null;
				this.resolve(x); // this === resolver
			}

			function handleReject(e) {
				/*jshint validthis:true*/
				if(this.resolved) { // this === resolver
					return;
				}

				errors.push(e);
				if(--pending === 0) {
					this.reject(errors);
				}
			}
		}

		/**
		 * N-winner competitive race
		 * Return a promise that will fulfill when n input promises have
		 * fulfilled, or will reject when it becomes impossible for n
		 * input promises to fulfill (ie when promises.length - n + 1
		 * have rejected)
		 * @param {array} promises
		 * @param {number} n
		 * @returns {Promise} promise for the earliest n fulfillment values
		 *
		 * @deprecated
		 */
		function some(promises, n) {
			/*jshint maxcomplexity:7*/
			var p = Promise._defer();
			var resolver = p._handler;

			var results = [];
			var errors = [];

			var l = promises.length>>>0;
			var nFulfill = 0;
			var nReject;
			var x, i; // reused in both for() loops

			// First pass: count actual array items
			for(i=0; i<l; ++i) {
				x = promises[i];
				if(x === void 0 && !(i in promises)) {
					continue;
				}
				++nFulfill;
			}

			// Compute actual goals
			n = Math.max(n, 0);
			nReject = (nFulfill - n + 1);
			nFulfill = Math.min(n, nFulfill);

			if(n > nFulfill) {
				resolver.reject(new RangeError('some(): array must contain at least '
				+ n + ' item(s), but had ' + nFulfill));
			} else if(nFulfill === 0) {
				resolver.resolve(results);
			}

			// Second pass: observe each array item, make progress toward goals
			for(i=0; i<l; ++i) {
				x = promises[i];
				if(x === void 0 && !(i in promises)) {
					continue;
				}

				Promise._handler(x).visit(resolver, fulfill, reject, resolver.notify);
			}

			return p;

			function fulfill(x) {
				/*jshint validthis:true*/
				if(this.resolved) { // this === resolver
					return;
				}

				results.push(x);
				if(--nFulfill === 0) {
					errors = null;
					this.resolve(results);
				}
			}

			function reject(e) {
				/*jshint validthis:true*/
				if(this.resolved) { // this === resolver
					return;
				}

				errors.push(e);
				if(--nReject === 0) {
					results = null;
					this.reject(errors);
				}
			}
		}

		/**
		 * Apply f to the value of each promise in a list of promises
		 * and return a new list containing the results.
		 * @param {array} promises
		 * @param {function(x:*, index:Number):*} f mapping function
		 * @returns {Promise}
		 */
		function map(promises, f) {
			return Promise._traverse(f, promises);
		}

		/**
		 * Filter the provided array of promises using the provided predicate.  Input may
		 * contain promises and values
		 * @param {Array} promises array of promises and values
		 * @param {function(x:*, index:Number):boolean} predicate filtering predicate.
		 *  Must return truthy (or promise for truthy) for items to retain.
		 * @returns {Promise} promise that will fulfill with an array containing all items
		 *  for which predicate returned truthy.
		 */
		function filter(promises, predicate) {
			var a = slice.call(promises);
			return Promise._traverse(predicate, a).then(function(keep) {
				return filterSync(a, keep);
			});
		}

		function filterSync(promises, keep) {
			// Safe because we know all promises have fulfilled if we've made it this far
			var l = keep.length;
			var filtered = new Array(l);
			for(var i=0, j=0; i<l; ++i) {
				if(keep[i]) {
					filtered[j++] = Promise._handler(promises[i]).value;
				}
			}
			filtered.length = j;
			return filtered;

		}

		/**
		 * Return a promise that will always fulfill with an array containing
		 * the outcome states of all input promises.  The returned promise
		 * will never reject.
		 * @param {Array} promises
		 * @returns {Promise} promise for array of settled state descriptors
		 */
		function settle(promises) {
			return all(promises.map(settleOne));
		}

		function settleOne(p) {
			var h = Promise._handler(p);
			if(h.state() === 0) {
				return toPromise(p).then(state.fulfilled, state.rejected);
			}

			h._unreport();
			return state.inspect(h);
		}

		/**
		 * Traditional reduce function, similar to `Array.prototype.reduce()`, but
		 * input may contain promises and/or values, and reduceFunc
		 * may return either a value or a promise, *and* initialValue may
		 * be a promise for the starting value.
		 * @param {Array|Promise} promises array or promise for an array of anything,
		 *      may contain a mix of promises and values.
		 * @param {function(accumulated:*, x:*, index:Number):*} f reduce function
		 * @returns {Promise} that will resolve to the final reduced value
		 */
		function reduce(promises, f /*, initialValue */) {
			return arguments.length > 2 ? ar.call(promises, liftCombine(f), arguments[2])
					: ar.call(promises, liftCombine(f));
		}

		/**
		 * Traditional reduce function, similar to `Array.prototype.reduceRight()`, but
		 * input may contain promises and/or values, and reduceFunc
		 * may return either a value or a promise, *and* initialValue may
		 * be a promise for the starting value.
		 * @param {Array|Promise} promises array or promise for an array of anything,
		 *      may contain a mix of promises and values.
		 * @param {function(accumulated:*, x:*, index:Number):*} f reduce function
		 * @returns {Promise} that will resolve to the final reduced value
		 */
		function reduceRight(promises, f /*, initialValue */) {
			return arguments.length > 2 ? arr.call(promises, liftCombine(f), arguments[2])
					: arr.call(promises, liftCombine(f));
		}

		function liftCombine(f) {
			return function(z, x, i) {
				return applyFold(f, void 0, [z,x,i]);
			};
		}
	};

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));

},{"../apply":19,"../state":32}],21:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	return function flow(Promise) {

		var resolve = Promise.resolve;
		var reject = Promise.reject;
		var origCatch = Promise.prototype['catch'];

		/**
		 * Handle the ultimate fulfillment value or rejection reason, and assume
		 * responsibility for all errors.  If an error propagates out of result
		 * or handleFatalError, it will be rethrown to the host, resulting in a
		 * loud stack track on most platforms and a crash on some.
		 * @param {function?} onResult
		 * @param {function?} onError
		 * @returns {undefined}
		 */
		Promise.prototype.done = function(onResult, onError) {
			this._handler.visit(this._handler.receiver, onResult, onError);
		};

		/**
		 * Add Error-type and predicate matching to catch.  Examples:
		 * promise.catch(TypeError, handleTypeError)
		 *   .catch(predicate, handleMatchedErrors)
		 *   .catch(handleRemainingErrors)
		 * @param onRejected
		 * @returns {*}
		 */
		Promise.prototype['catch'] = Promise.prototype.otherwise = function(onRejected) {
			if (arguments.length < 2) {
				return origCatch.call(this, onRejected);
			}

			if(typeof onRejected !== 'function') {
				return this.ensure(rejectInvalidPredicate);
			}

			return origCatch.call(this, createCatchFilter(arguments[1], onRejected));
		};

		/**
		 * Wraps the provided catch handler, so that it will only be called
		 * if the predicate evaluates truthy
		 * @param {?function} handler
		 * @param {function} predicate
		 * @returns {function} conditional catch handler
		 */
		function createCatchFilter(handler, predicate) {
			return function(e) {
				return evaluatePredicate(e, predicate)
					? handler.call(this, e)
					: reject(e);
			};
		}

		/**
		 * Ensures that onFulfilledOrRejected will be called regardless of whether
		 * this promise is fulfilled or rejected.  onFulfilledOrRejected WILL NOT
		 * receive the promises' value or reason.  Any returned value will be disregarded.
		 * onFulfilledOrRejected may throw or return a rejected promise to signal
		 * an additional error.
		 * @param {function} handler handler to be called regardless of
		 *  fulfillment or rejection
		 * @returns {Promise}
		 */
		Promise.prototype['finally'] = Promise.prototype.ensure = function(handler) {
			if(typeof handler !== 'function') {
				return this;
			}

			return this.then(function(x) {
				return runSideEffect(handler, this, identity, x);
			}, function(e) {
				return runSideEffect(handler, this, reject, e);
			});
		};

		function runSideEffect (handler, thisArg, propagate, value) {
			var result = handler.call(thisArg);
			return maybeThenable(result)
				? propagateValue(result, propagate, value)
				: propagate(value);
		}

		function propagateValue (result, propagate, x) {
			return resolve(result).then(function () {
				return propagate(x);
			});
		}

		/**
		 * Recover from a failure by returning a defaultValue.  If defaultValue
		 * is a promise, it's fulfillment value will be used.  If defaultValue is
		 * a promise that rejects, the returned promise will reject with the
		 * same reason.
		 * @param {*} defaultValue
		 * @returns {Promise} new promise
		 */
		Promise.prototype['else'] = Promise.prototype.orElse = function(defaultValue) {
			return this.then(void 0, function() {
				return defaultValue;
			});
		};

		/**
		 * Shortcut for .then(function() { return value; })
		 * @param  {*} value
		 * @return {Promise} a promise that:
		 *  - is fulfilled if value is not a promise, or
		 *  - if value is a promise, will fulfill with its value, or reject
		 *    with its reason.
		 */
		Promise.prototype['yield'] = function(value) {
			return this.then(function() {
				return value;
			});
		};

		/**
		 * Runs a side effect when this promise fulfills, without changing the
		 * fulfillment value.
		 * @param {function} onFulfilledSideEffect
		 * @returns {Promise}
		 */
		Promise.prototype.tap = function(onFulfilledSideEffect) {
			return this.then(onFulfilledSideEffect)['yield'](this);
		};

		return Promise;
	};

	function rejectInvalidPredicate() {
		throw new TypeError('catch predicate must be a function');
	}

	function evaluatePredicate(e, predicate) {
		return isError(predicate) ? e instanceof predicate : predicate(e);
	}

	function isError(predicate) {
		return predicate === Error
			|| (predicate != null && predicate.prototype instanceof Error);
	}

	function maybeThenable(x) {
		return (typeof x === 'object' || typeof x === 'function') && x !== null;
	}

	function identity(x) {
		return x;
	}

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}],22:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */
/** @author Jeff Escalante */

(function(define) { 'use strict';
define(function() {

	return function fold(Promise) {

		Promise.prototype.fold = function(f, z) {
			var promise = this._beget();

			this._handler.fold(function(z, x, to) {
				Promise._handler(z).fold(function(x, z, to) {
					to.resolve(f.call(this, z, x));
				}, x, this, to);
			}, z, promise._handler.receiver, promise._handler);

			return promise;
		};

		return Promise;
	};

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}],23:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function(require) {

	var inspect = require('../state').inspect;

	return function inspection(Promise) {

		Promise.prototype.inspect = function() {
			return inspect(Promise._handler(this));
		};

		return Promise;
	};

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));

},{"../state":32}],24:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	return function generate(Promise) {

		var resolve = Promise.resolve;

		Promise.iterate = iterate;
		Promise.unfold = unfold;

		return Promise;

		/**
		 * @deprecated Use github.com/cujojs/most streams and most.iterate
		 * Generate a (potentially infinite) stream of promised values:
		 * x, f(x), f(f(x)), etc. until condition(x) returns true
		 * @param {function} f function to generate a new x from the previous x
		 * @param {function} condition function that, given the current x, returns
		 *  truthy when the iterate should stop
		 * @param {function} handler function to handle the value produced by f
		 * @param {*|Promise} x starting value, may be a promise
		 * @return {Promise} the result of the last call to f before
		 *  condition returns true
		 */
		function iterate(f, condition, handler, x) {
			return unfold(function(x) {
				return [x, f(x)];
			}, condition, handler, x);
		}

		/**
		 * @deprecated Use github.com/cujojs/most streams and most.unfold
		 * Generate a (potentially infinite) stream of promised values
		 * by applying handler(generator(seed)) iteratively until
		 * condition(seed) returns true.
		 * @param {function} unspool function that generates a [value, newSeed]
		 *  given a seed.
		 * @param {function} condition function that, given the current seed, returns
		 *  truthy when the unfold should stop
		 * @param {function} handler function to handle the value produced by unspool
		 * @param x {*|Promise} starting value, may be a promise
		 * @return {Promise} the result of the last value produced by unspool before
		 *  condition returns true
		 */
		function unfold(unspool, condition, handler, x) {
			return resolve(x).then(function(seed) {
				return resolve(condition(seed)).then(function(done) {
					return done ? seed : resolve(unspool(seed)).spread(next);
				});
			});

			function next(item, newSeed) {
				return resolve(handler(item)).then(function() {
					return unfold(unspool, condition, handler, newSeed);
				});
			}
		}
	};

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}],25:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	return function progress(Promise) {

		/**
		 * @deprecated
		 * Register a progress handler for this promise
		 * @param {function} onProgress
		 * @returns {Promise}
		 */
		Promise.prototype.progress = function(onProgress) {
			return this.then(void 0, void 0, onProgress);
		};

		return Promise;
	};

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}],26:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function(require) {

	var env = require('../env');
	var TimeoutError = require('../TimeoutError');

	function setTimeout(f, ms, x, y) {
		return env.setTimer(function() {
			f(x, y, ms);
		}, ms);
	}

	return function timed(Promise) {
		/**
		 * Return a new promise whose fulfillment value is revealed only
		 * after ms milliseconds
		 * @param {number} ms milliseconds
		 * @returns {Promise}
		 */
		Promise.prototype.delay = function(ms) {
			var p = this._beget();
			this._handler.fold(handleDelay, ms, void 0, p._handler);
			return p;
		};

		function handleDelay(ms, x, h) {
			setTimeout(resolveDelay, ms, x, h);
		}

		function resolveDelay(x, h) {
			h.resolve(x);
		}

		/**
		 * Return a new promise that rejects after ms milliseconds unless
		 * this promise fulfills earlier, in which case the returned promise
		 * fulfills with the same value.
		 * @param {number} ms milliseconds
		 * @param {Error|*=} reason optional rejection reason to use, defaults
		 *   to a TimeoutError if not provided
		 * @returns {Promise}
		 */
		Promise.prototype.timeout = function(ms, reason) {
			var p = this._beget();
			var h = p._handler;

			var t = setTimeout(onTimeout, ms, reason, p._handler);

			this._handler.visit(h,
				function onFulfill(x) {
					env.clearTimer(t);
					this.resolve(x); // this = h
				},
				function onReject(x) {
					env.clearTimer(t);
					this.reject(x); // this = h
				},
				h.notify);

			return p;
		};

		function onTimeout(reason, h, ms) {
			var e = typeof reason === 'undefined'
				? new TimeoutError('timed out after ' + ms + 'ms')
				: reason;
			h.reject(e);
		}

		return Promise;
	};

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));

},{"../TimeoutError":18,"../env":29}],27:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function(require) {

	var setTimer = require('../env').setTimer;
	var format = require('../format');

	return function unhandledRejection(Promise) {

		var logError = noop;
		var logInfo = noop;
		var localConsole;

		if(typeof console !== 'undefined') {
			// Alias console to prevent things like uglify's drop_console option from
			// removing console.log/error. Unhandled rejections fall into the same
			// category as uncaught exceptions, and build tools shouldn't silence them.
			localConsole = console;
			logError = typeof localConsole.error !== 'undefined'
				? function (e) { localConsole.error(e); }
				: function (e) { localConsole.log(e); };

			logInfo = typeof localConsole.info !== 'undefined'
				? function (e) { localConsole.info(e); }
				: function (e) { localConsole.log(e); };
		}

		Promise.onPotentiallyUnhandledRejection = function(rejection) {
			enqueue(report, rejection);
		};

		Promise.onPotentiallyUnhandledRejectionHandled = function(rejection) {
			enqueue(unreport, rejection);
		};

		Promise.onFatalRejection = function(rejection) {
			enqueue(throwit, rejection.value);
		};

		var tasks = [];
		var reported = [];
		var running = null;

		function report(r) {
			if(!r.handled) {
				reported.push(r);
				logError('Potentially unhandled rejection [' + r.id + '] ' + format.formatError(r.value));
			}
		}

		function unreport(r) {
			var i = reported.indexOf(r);
			if(i >= 0) {
				reported.splice(i, 1);
				logInfo('Handled previous rejection [' + r.id + '] ' + format.formatObject(r.value));
			}
		}

		function enqueue(f, x) {
			tasks.push(f, x);
			if(running === null) {
				running = setTimer(flush, 0);
			}
		}

		function flush() {
			running = null;
			while(tasks.length > 0) {
				tasks.shift()(tasks.shift());
			}
		}

		return Promise;
	};

	function throwit(e) {
		throw e;
	}

	function noop() {}

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));

},{"../env":29,"../format":30}],28:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	return function addWith(Promise) {
		/**
		 * Returns a promise whose handlers will be called with `this` set to
		 * the supplied receiver.  Subsequent promises derived from the
		 * returned promise will also have their handlers called with receiver
		 * as `this`. Calling `with` with undefined or no arguments will return
		 * a promise whose handlers will again be called in the usual Promises/A+
		 * way (no `this`) thus safely undoing any previous `with` in the
		 * promise chain.
		 *
		 * WARNING: Promises returned from `with`/`withThis` are NOT Promises/A+
		 * compliant, specifically violating 2.2.5 (http://promisesaplus.com/#point-41)
		 *
		 * @param {object} receiver `this` value for all handlers attached to
		 *  the returned promise.
		 * @returns {Promise}
		 */
		Promise.prototype['with'] = Promise.prototype.withThis = function(receiver) {
			var p = this._beget();
			var child = p._handler;
			child.receiver = receiver;
			this._handler.chain(child, receiver);
			return p;
		};

		return Promise;
	};

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));


},{}],29:[function(require,module,exports){
(function (process){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

/*global process,document,setTimeout,clearTimeout,MutationObserver,WebKitMutationObserver*/
(function(define) { 'use strict';
define(function(require) {
	/*jshint maxcomplexity:6*/

	// Sniff "best" async scheduling option
	// Prefer process.nextTick or MutationObserver, then check for
	// setTimeout, and finally vertx, since its the only env that doesn't
	// have setTimeout

	var MutationObs;
	var capturedSetTimeout = typeof setTimeout !== 'undefined' && setTimeout;

	// Default env
	var setTimer = function(f, ms) { return setTimeout(f, ms); };
	var clearTimer = function(t) { return clearTimeout(t); };
	var asap = function (f) { return capturedSetTimeout(f, 0); };

	// Detect specific env
	if (isNode()) { // Node
		asap = function (f) { return process.nextTick(f); };

	} else if (MutationObs = hasMutationObserver()) { // Modern browser
		asap = initMutationObserver(MutationObs);

	} else if (!capturedSetTimeout) { // vert.x
		var vertxRequire = require;
		var vertx = vertxRequire('vertx');
		setTimer = function (f, ms) { return vertx.setTimer(ms, f); };
		clearTimer = vertx.cancelTimer;
		asap = vertx.runOnLoop || vertx.runOnContext;
	}

	return {
		setTimer: setTimer,
		clearTimer: clearTimer,
		asap: asap
	};

	function isNode () {
		return typeof process !== 'undefined' && process !== null &&
			typeof process.nextTick === 'function';
	}

	function hasMutationObserver () {
		return (typeof MutationObserver === 'function' && MutationObserver) ||
			(typeof WebKitMutationObserver === 'function' && WebKitMutationObserver);
	}

	function initMutationObserver(MutationObserver) {
		var scheduled;
		var node = document.createTextNode('');
		var o = new MutationObserver(run);
		o.observe(node, { characterData: true });

		function run() {
			var f = scheduled;
			scheduled = void 0;
			f();
		}

		var i = 0;
		return function (f) {
			scheduled = f;
			node.data = (i ^= 1);
		};
	}
});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));

}).call(this,require('_process'))
},{"_process":61}],30:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	return {
		formatError: formatError,
		formatObject: formatObject,
		tryStringify: tryStringify
	};

	/**
	 * Format an error into a string.  If e is an Error and has a stack property,
	 * it's returned.  Otherwise, e is formatted using formatObject, with a
	 * warning added about e not being a proper Error.
	 * @param {*} e
	 * @returns {String} formatted string, suitable for output to developers
	 */
	function formatError(e) {
		var s = typeof e === 'object' && e !== null && e.stack ? e.stack : formatObject(e);
		return e instanceof Error ? s : s + ' (WARNING: non-Error used)';
	}

	/**
	 * Format an object, detecting "plain" objects and running them through
	 * JSON.stringify if possible.
	 * @param {Object} o
	 * @returns {string}
	 */
	function formatObject(o) {
		var s = String(o);
		if(s === '[object Object]' && typeof JSON !== 'undefined') {
			s = tryStringify(o, s);
		}
		return s;
	}

	/**
	 * Try to return the result of JSON.stringify(x).  If that fails, return
	 * defaultValue
	 * @param {*} x
	 * @param {*} defaultValue
	 * @returns {String|*} JSON.stringify(x) or defaultValue
	 */
	function tryStringify(x, defaultValue) {
		try {
			return JSON.stringify(x);
		} catch(e) {
			return defaultValue;
		}
	}

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}],31:[function(require,module,exports){
(function (process){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	return function makePromise(environment) {

		var tasks = environment.scheduler;
		var emitRejection = initEmitRejection();

		var objectCreate = Object.create ||
			function(proto) {
				function Child() {}
				Child.prototype = proto;
				return new Child();
			};

		/**
		 * Create a promise whose fate is determined by resolver
		 * @constructor
		 * @returns {Promise} promise
		 * @name Promise
		 */
		function Promise(resolver, handler) {
			this._handler = resolver === Handler ? handler : init(resolver);
		}

		/**
		 * Run the supplied resolver
		 * @param resolver
		 * @returns {Pending}
		 */
		function init(resolver) {
			var handler = new Pending();

			try {
				resolver(promiseResolve, promiseReject, promiseNotify);
			} catch (e) {
				promiseReject(e);
			}

			return handler;

			/**
			 * Transition from pre-resolution state to post-resolution state, notifying
			 * all listeners of the ultimate fulfillment or rejection
			 * @param {*} x resolution value
			 */
			function promiseResolve (x) {
				handler.resolve(x);
			}
			/**
			 * Reject this promise with reason, which will be used verbatim
			 * @param {Error|*} reason rejection reason, strongly suggested
			 *   to be an Error type
			 */
			function promiseReject (reason) {
				handler.reject(reason);
			}

			/**
			 * @deprecated
			 * Issue a progress event, notifying all progress listeners
			 * @param {*} x progress event payload to pass to all listeners
			 */
			function promiseNotify (x) {
				handler.notify(x);
			}
		}

		// Creation

		Promise.resolve = resolve;
		Promise.reject = reject;
		Promise.never = never;

		Promise._defer = defer;
		Promise._handler = getHandler;

		/**
		 * Returns a trusted promise. If x is already a trusted promise, it is
		 * returned, otherwise returns a new trusted Promise which follows x.
		 * @param  {*} x
		 * @return {Promise} promise
		 */
		function resolve(x) {
			return isPromise(x) ? x
				: new Promise(Handler, new Async(getHandler(x)));
		}

		/**
		 * Return a reject promise with x as its reason (x is used verbatim)
		 * @param {*} x
		 * @returns {Promise} rejected promise
		 */
		function reject(x) {
			return new Promise(Handler, new Async(new Rejected(x)));
		}

		/**
		 * Return a promise that remains pending forever
		 * @returns {Promise} forever-pending promise.
		 */
		function never() {
			return foreverPendingPromise; // Should be frozen
		}

		/**
		 * Creates an internal {promise, resolver} pair
		 * @private
		 * @returns {Promise}
		 */
		function defer() {
			return new Promise(Handler, new Pending());
		}

		// Transformation and flow control

		/**
		 * Transform this promise's fulfillment value, returning a new Promise
		 * for the transformed result.  If the promise cannot be fulfilled, onRejected
		 * is called with the reason.  onProgress *may* be called with updates toward
		 * this promise's fulfillment.
		 * @param {function=} onFulfilled fulfillment handler
		 * @param {function=} onRejected rejection handler
		 * @param {function=} onProgress @deprecated progress handler
		 * @return {Promise} new promise
		 */
		Promise.prototype.then = function(onFulfilled, onRejected, onProgress) {
			var parent = this._handler;
			var state = parent.join().state();

			if ((typeof onFulfilled !== 'function' && state > 0) ||
				(typeof onRejected !== 'function' && state < 0)) {
				// Short circuit: value will not change, simply share handler
				return new this.constructor(Handler, parent);
			}

			var p = this._beget();
			var child = p._handler;

			parent.chain(child, parent.receiver, onFulfilled, onRejected, onProgress);

			return p;
		};

		/**
		 * If this promise cannot be fulfilled due to an error, call onRejected to
		 * handle the error. Shortcut for .then(undefined, onRejected)
		 * @param {function?} onRejected
		 * @return {Promise}
		 */
		Promise.prototype['catch'] = function(onRejected) {
			return this.then(void 0, onRejected);
		};

		/**
		 * Creates a new, pending promise of the same type as this promise
		 * @private
		 * @returns {Promise}
		 */
		Promise.prototype._beget = function() {
			return begetFrom(this._handler, this.constructor);
		};

		function begetFrom(parent, Promise) {
			var child = new Pending(parent.receiver, parent.join().context);
			return new Promise(Handler, child);
		}

		// Array combinators

		Promise.all = all;
		Promise.race = race;
		Promise._traverse = traverse;

		/**
		 * Return a promise that will fulfill when all promises in the
		 * input array have fulfilled, or will reject when one of the
		 * promises rejects.
		 * @param {array} promises array of promises
		 * @returns {Promise} promise for array of fulfillment values
		 */
		function all(promises) {
			return traverseWith(snd, null, promises);
		}

		/**
		 * Array<Promise<X>> -> Promise<Array<f(X)>>
		 * @private
		 * @param {function} f function to apply to each promise's value
		 * @param {Array} promises array of promises
		 * @returns {Promise} promise for transformed values
		 */
		function traverse(f, promises) {
			return traverseWith(tryCatch2, f, promises);
		}

		function traverseWith(tryMap, f, promises) {
			var handler = typeof f === 'function' ? mapAt : settleAt;

			var resolver = new Pending();
			var pending = promises.length >>> 0;
			var results = new Array(pending);

			for (var i = 0, x; i < promises.length && !resolver.resolved; ++i) {
				x = promises[i];

				if (x === void 0 && !(i in promises)) {
					--pending;
					continue;
				}

				traverseAt(promises, handler, i, x, resolver);
			}

			if(pending === 0) {
				resolver.become(new Fulfilled(results));
			}

			return new Promise(Handler, resolver);

			function mapAt(i, x, resolver) {
				if(!resolver.resolved) {
					traverseAt(promises, settleAt, i, tryMap(f, x, i), resolver);
				}
			}

			function settleAt(i, x, resolver) {
				results[i] = x;
				if(--pending === 0) {
					resolver.become(new Fulfilled(results));
				}
			}
		}

		function traverseAt(promises, handler, i, x, resolver) {
			if (maybeThenable(x)) {
				var h = getHandlerMaybeThenable(x);
				var s = h.state();

				if (s === 0) {
					h.fold(handler, i, void 0, resolver);
				} else if (s > 0) {
					handler(i, h.value, resolver);
				} else {
					resolver.become(h);
					visitRemaining(promises, i+1, h);
				}
			} else {
				handler(i, x, resolver);
			}
		}

		Promise._visitRemaining = visitRemaining;
		function visitRemaining(promises, start, handler) {
			for(var i=start; i<promises.length; ++i) {
				markAsHandled(getHandler(promises[i]), handler);
			}
		}

		function markAsHandled(h, handler) {
			if(h === handler) {
				return;
			}

			var s = h.state();
			if(s === 0) {
				h.visit(h, void 0, h._unreport);
			} else if(s < 0) {
				h._unreport();
			}
		}

		/**
		 * Fulfill-reject competitive race. Return a promise that will settle
		 * to the same state as the earliest input promise to settle.
		 *
		 * WARNING: The ES6 Promise spec requires that race()ing an empty array
		 * must return a promise that is pending forever.  This implementation
		 * returns a singleton forever-pending promise, the same singleton that is
		 * returned by Promise.never(), thus can be checked with ===
		 *
		 * @param {array} promises array of promises to race
		 * @returns {Promise} if input is non-empty, a promise that will settle
		 * to the same outcome as the earliest input promise to settle. if empty
		 * is empty, returns a promise that will never settle.
		 */
		function race(promises) {
			if(typeof promises !== 'object' || promises === null) {
				return reject(new TypeError('non-iterable passed to race()'));
			}

			// Sigh, race([]) is untestable unless we return *something*
			// that is recognizable without calling .then() on it.
			return promises.length === 0 ? never()
				 : promises.length === 1 ? resolve(promises[0])
				 : runRace(promises);
		}

		function runRace(promises) {
			var resolver = new Pending();
			var i, x, h;
			for(i=0; i<promises.length; ++i) {
				x = promises[i];
				if (x === void 0 && !(i in promises)) {
					continue;
				}

				h = getHandler(x);
				if(h.state() !== 0) {
					resolver.become(h);
					visitRemaining(promises, i+1, h);
					break;
				} else {
					h.visit(resolver, resolver.resolve, resolver.reject);
				}
			}
			return new Promise(Handler, resolver);
		}

		// Promise internals
		// Below this, everything is @private

		/**
		 * Get an appropriate handler for x, without checking for cycles
		 * @param {*} x
		 * @returns {object} handler
		 */
		function getHandler(x) {
			if(isPromise(x)) {
				return x._handler.join();
			}
			return maybeThenable(x) ? getHandlerUntrusted(x) : new Fulfilled(x);
		}

		/**
		 * Get a handler for thenable x.
		 * NOTE: You must only call this if maybeThenable(x) == true
		 * @param {object|function|Promise} x
		 * @returns {object} handler
		 */
		function getHandlerMaybeThenable(x) {
			return isPromise(x) ? x._handler.join() : getHandlerUntrusted(x);
		}

		/**
		 * Get a handler for potentially untrusted thenable x
		 * @param {*} x
		 * @returns {object} handler
		 */
		function getHandlerUntrusted(x) {
			try {
				var untrustedThen = x.then;
				return typeof untrustedThen === 'function'
					? new Thenable(untrustedThen, x)
					: new Fulfilled(x);
			} catch(e) {
				return new Rejected(e);
			}
		}

		/**
		 * Handler for a promise that is pending forever
		 * @constructor
		 */
		function Handler() {}

		Handler.prototype.when
			= Handler.prototype.become
			= Handler.prototype.notify // deprecated
			= Handler.prototype.fail
			= Handler.prototype._unreport
			= Handler.prototype._report
			= noop;

		Handler.prototype._state = 0;

		Handler.prototype.state = function() {
			return this._state;
		};

		/**
		 * Recursively collapse handler chain to find the handler
		 * nearest to the fully resolved value.
		 * @returns {object} handler nearest the fully resolved value
		 */
		Handler.prototype.join = function() {
			var h = this;
			while(h.handler !== void 0) {
				h = h.handler;
			}
			return h;
		};

		Handler.prototype.chain = function(to, receiver, fulfilled, rejected, progress) {
			this.when({
				resolver: to,
				receiver: receiver,
				fulfilled: fulfilled,
				rejected: rejected,
				progress: progress
			});
		};

		Handler.prototype.visit = function(receiver, fulfilled, rejected, progress) {
			this.chain(failIfRejected, receiver, fulfilled, rejected, progress);
		};

		Handler.prototype.fold = function(f, z, c, to) {
			this.when(new Fold(f, z, c, to));
		};

		/**
		 * Handler that invokes fail() on any handler it becomes
		 * @constructor
		 */
		function FailIfRejected() {}

		inherit(Handler, FailIfRejected);

		FailIfRejected.prototype.become = function(h) {
			h.fail();
		};

		var failIfRejected = new FailIfRejected();

		/**
		 * Handler that manages a queue of consumers waiting on a pending promise
		 * @constructor
		 */
		function Pending(receiver, inheritedContext) {
			Promise.createContext(this, inheritedContext);

			this.consumers = void 0;
			this.receiver = receiver;
			this.handler = void 0;
			this.resolved = false;
		}

		inherit(Handler, Pending);

		Pending.prototype._state = 0;

		Pending.prototype.resolve = function(x) {
			this.become(getHandler(x));
		};

		Pending.prototype.reject = function(x) {
			if(this.resolved) {
				return;
			}

			this.become(new Rejected(x));
		};

		Pending.prototype.join = function() {
			if (!this.resolved) {
				return this;
			}

			var h = this;

			while (h.handler !== void 0) {
				h = h.handler;
				if (h === this) {
					return this.handler = cycle();
				}
			}

			return h;
		};

		Pending.prototype.run = function() {
			var q = this.consumers;
			var handler = this.handler;
			this.handler = this.handler.join();
			this.consumers = void 0;

			for (var i = 0; i < q.length; ++i) {
				handler.when(q[i]);
			}
		};

		Pending.prototype.become = function(handler) {
			if(this.resolved) {
				return;
			}

			this.resolved = true;
			this.handler = handler;
			if(this.consumers !== void 0) {
				tasks.enqueue(this);
			}

			if(this.context !== void 0) {
				handler._report(this.context);
			}
		};

		Pending.prototype.when = function(continuation) {
			if(this.resolved) {
				tasks.enqueue(new ContinuationTask(continuation, this.handler));
			} else {
				if(this.consumers === void 0) {
					this.consumers = [continuation];
				} else {
					this.consumers.push(continuation);
				}
			}
		};

		/**
		 * @deprecated
		 */
		Pending.prototype.notify = function(x) {
			if(!this.resolved) {
				tasks.enqueue(new ProgressTask(x, this));
			}
		};

		Pending.prototype.fail = function(context) {
			var c = typeof context === 'undefined' ? this.context : context;
			this.resolved && this.handler.join().fail(c);
		};

		Pending.prototype._report = function(context) {
			this.resolved && this.handler.join()._report(context);
		};

		Pending.prototype._unreport = function() {
			this.resolved && this.handler.join()._unreport();
		};

		/**
		 * Wrap another handler and force it into a future stack
		 * @param {object} handler
		 * @constructor
		 */
		function Async(handler) {
			this.handler = handler;
		}

		inherit(Handler, Async);

		Async.prototype.when = function(continuation) {
			tasks.enqueue(new ContinuationTask(continuation, this));
		};

		Async.prototype._report = function(context) {
			this.join()._report(context);
		};

		Async.prototype._unreport = function() {
			this.join()._unreport();
		};

		/**
		 * Handler that wraps an untrusted thenable and assimilates it in a future stack
		 * @param {function} then
		 * @param {{then: function}} thenable
		 * @constructor
		 */
		function Thenable(then, thenable) {
			Pending.call(this);
			tasks.enqueue(new AssimilateTask(then, thenable, this));
		}

		inherit(Pending, Thenable);

		/**
		 * Handler for a fulfilled promise
		 * @param {*} x fulfillment value
		 * @constructor
		 */
		function Fulfilled(x) {
			Promise.createContext(this);
			this.value = x;
		}

		inherit(Handler, Fulfilled);

		Fulfilled.prototype._state = 1;

		Fulfilled.prototype.fold = function(f, z, c, to) {
			runContinuation3(f, z, this, c, to);
		};

		Fulfilled.prototype.when = function(cont) {
			runContinuation1(cont.fulfilled, this, cont.receiver, cont.resolver);
		};

		var errorId = 0;

		/**
		 * Handler for a rejected promise
		 * @param {*} x rejection reason
		 * @constructor
		 */
		function Rejected(x) {
			Promise.createContext(this);

			this.id = ++errorId;
			this.value = x;
			this.handled = false;
			this.reported = false;

			this._report();
		}

		inherit(Handler, Rejected);

		Rejected.prototype._state = -1;

		Rejected.prototype.fold = function(f, z, c, to) {
			to.become(this);
		};

		Rejected.prototype.when = function(cont) {
			if(typeof cont.rejected === 'function') {
				this._unreport();
			}
			runContinuation1(cont.rejected, this, cont.receiver, cont.resolver);
		};

		Rejected.prototype._report = function(context) {
			tasks.afterQueue(new ReportTask(this, context));
		};

		Rejected.prototype._unreport = function() {
			if(this.handled) {
				return;
			}
			this.handled = true;
			tasks.afterQueue(new UnreportTask(this));
		};

		Rejected.prototype.fail = function(context) {
			this.reported = true;
			emitRejection('unhandledRejection', this);
			Promise.onFatalRejection(this, context === void 0 ? this.context : context);
		};

		function ReportTask(rejection, context) {
			this.rejection = rejection;
			this.context = context;
		}

		ReportTask.prototype.run = function() {
			if(!this.rejection.handled && !this.rejection.reported) {
				this.rejection.reported = true;
				emitRejection('unhandledRejection', this.rejection) ||
					Promise.onPotentiallyUnhandledRejection(this.rejection, this.context);
			}
		};

		function UnreportTask(rejection) {
			this.rejection = rejection;
		}

		UnreportTask.prototype.run = function() {
			if(this.rejection.reported) {
				emitRejection('rejectionHandled', this.rejection) ||
					Promise.onPotentiallyUnhandledRejectionHandled(this.rejection);
			}
		};

		// Unhandled rejection hooks
		// By default, everything is a noop

		Promise.createContext
			= Promise.enterContext
			= Promise.exitContext
			= Promise.onPotentiallyUnhandledRejection
			= Promise.onPotentiallyUnhandledRejectionHandled
			= Promise.onFatalRejection
			= noop;

		// Errors and singletons

		var foreverPendingHandler = new Handler();
		var foreverPendingPromise = new Promise(Handler, foreverPendingHandler);

		function cycle() {
			return new Rejected(new TypeError('Promise cycle'));
		}

		// Task runners

		/**
		 * Run a single consumer
		 * @constructor
		 */
		function ContinuationTask(continuation, handler) {
			this.continuation = continuation;
			this.handler = handler;
		}

		ContinuationTask.prototype.run = function() {
			this.handler.join().when(this.continuation);
		};

		/**
		 * Run a queue of progress handlers
		 * @constructor
		 */
		function ProgressTask(value, handler) {
			this.handler = handler;
			this.value = value;
		}

		ProgressTask.prototype.run = function() {
			var q = this.handler.consumers;
			if(q === void 0) {
				return;
			}

			for (var c, i = 0; i < q.length; ++i) {
				c = q[i];
				runNotify(c.progress, this.value, this.handler, c.receiver, c.resolver);
			}
		};

		/**
		 * Assimilate a thenable, sending it's value to resolver
		 * @param {function} then
		 * @param {object|function} thenable
		 * @param {object} resolver
		 * @constructor
		 */
		function AssimilateTask(then, thenable, resolver) {
			this._then = then;
			this.thenable = thenable;
			this.resolver = resolver;
		}

		AssimilateTask.prototype.run = function() {
			var h = this.resolver;
			tryAssimilate(this._then, this.thenable, _resolve, _reject, _notify);

			function _resolve(x) { h.resolve(x); }
			function _reject(x)  { h.reject(x); }
			function _notify(x)  { h.notify(x); }
		};

		function tryAssimilate(then, thenable, resolve, reject, notify) {
			try {
				then.call(thenable, resolve, reject, notify);
			} catch (e) {
				reject(e);
			}
		}

		/**
		 * Fold a handler value with z
		 * @constructor
		 */
		function Fold(f, z, c, to) {
			this.f = f; this.z = z; this.c = c; this.to = to;
			this.resolver = failIfRejected;
			this.receiver = this;
		}

		Fold.prototype.fulfilled = function(x) {
			this.f.call(this.c, this.z, x, this.to);
		};

		Fold.prototype.rejected = function(x) {
			this.to.reject(x);
		};

		Fold.prototype.progress = function(x) {
			this.to.notify(x);
		};

		// Other helpers

		/**
		 * @param {*} x
		 * @returns {boolean} true iff x is a trusted Promise
		 */
		function isPromise(x) {
			return x instanceof Promise;
		}

		/**
		 * Test just enough to rule out primitives, in order to take faster
		 * paths in some code
		 * @param {*} x
		 * @returns {boolean} false iff x is guaranteed *not* to be a thenable
		 */
		function maybeThenable(x) {
			return (typeof x === 'object' || typeof x === 'function') && x !== null;
		}

		function runContinuation1(f, h, receiver, next) {
			if(typeof f !== 'function') {
				return next.become(h);
			}

			Promise.enterContext(h);
			tryCatchReject(f, h.value, receiver, next);
			Promise.exitContext();
		}

		function runContinuation3(f, x, h, receiver, next) {
			if(typeof f !== 'function') {
				return next.become(h);
			}

			Promise.enterContext(h);
			tryCatchReject3(f, x, h.value, receiver, next);
			Promise.exitContext();
		}

		/**
		 * @deprecated
		 */
		function runNotify(f, x, h, receiver, next) {
			if(typeof f !== 'function') {
				return next.notify(x);
			}

			Promise.enterContext(h);
			tryCatchReturn(f, x, receiver, next);
			Promise.exitContext();
		}

		function tryCatch2(f, a, b) {
			try {
				return f(a, b);
			} catch(e) {
				return reject(e);
			}
		}

		/**
		 * Return f.call(thisArg, x), or if it throws return a rejected promise for
		 * the thrown exception
		 */
		function tryCatchReject(f, x, thisArg, next) {
			try {
				next.become(getHandler(f.call(thisArg, x)));
			} catch(e) {
				next.become(new Rejected(e));
			}
		}

		/**
		 * Same as above, but includes the extra argument parameter.
		 */
		function tryCatchReject3(f, x, y, thisArg, next) {
			try {
				f.call(thisArg, x, y, next);
			} catch(e) {
				next.become(new Rejected(e));
			}
		}

		/**
		 * @deprecated
		 * Return f.call(thisArg, x), or if it throws, *return* the exception
		 */
		function tryCatchReturn(f, x, thisArg, next) {
			try {
				next.notify(f.call(thisArg, x));
			} catch(e) {
				next.notify(e);
			}
		}

		function inherit(Parent, Child) {
			Child.prototype = objectCreate(Parent.prototype);
			Child.prototype.constructor = Child;
		}

		function snd(x, y) {
			return y;
		}

		function noop() {}

		function initEmitRejection() {
			/*global process, self, CustomEvent*/
			if(typeof process !== 'undefined' && process !== null
				&& typeof process.emit === 'function') {
				// Returning falsy here means to call the default
				// onPotentiallyUnhandledRejection API.  This is safe even in
				// browserify since process.emit always returns falsy in browserify:
				// https://github.com/defunctzombie/node-process/blob/master/browser.js#L40-L46
				return function(type, rejection) {
					return type === 'unhandledRejection'
						? process.emit(type, rejection.value, rejection)
						: process.emit(type, rejection);
				};
			} else if(typeof self !== 'undefined' && typeof CustomEvent === 'function') {
				return (function(noop, self, CustomEvent) {
					var hasCustomEvent = false;
					try {
						var ev = new CustomEvent('unhandledRejection');
						hasCustomEvent = ev instanceof CustomEvent;
					} catch (e) {}

					return !hasCustomEvent ? noop : function(type, rejection) {
						var ev = new CustomEvent(type, {
							detail: {
								reason: rejection.value,
								key: rejection
							},
							bubbles: false,
							cancelable: true
						});

						return !self.dispatchEvent(ev);
					};
				}(noop, self, CustomEvent));
			}

			return noop;
		}

		return Promise;
	};
});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

}).call(this,require('_process'))
},{"_process":61}],32:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	return {
		pending: toPendingState,
		fulfilled: toFulfilledState,
		rejected: toRejectedState,
		inspect: inspect
	};

	function toPendingState() {
		return { state: 'pending' };
	}

	function toRejectedState(e) {
		return { state: 'rejected', reason: e };
	}

	function toFulfilledState(x) {
		return { state: 'fulfilled', value: x };
	}

	function inspect(handler) {
		var state = handler.state();
		return state === 0 ? toPendingState()
			 : state > 0   ? toFulfilledState(handler.value)
			               : toRejectedState(handler.value);
	}

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}],33:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */

/**
 * Promises/A+ and when() implementation
 * when is part of the cujoJS family of libraries (http://cujojs.com/)
 * @author Brian Cavalier
 * @author John Hann
 * @version 3.7.2
 */
(function(define) { 'use strict';
define(function (require) {

	var timed = require('./lib/decorators/timed');
	var array = require('./lib/decorators/array');
	var flow = require('./lib/decorators/flow');
	var fold = require('./lib/decorators/fold');
	var inspect = require('./lib/decorators/inspect');
	var generate = require('./lib/decorators/iterate');
	var progress = require('./lib/decorators/progress');
	var withThis = require('./lib/decorators/with');
	var unhandledRejection = require('./lib/decorators/unhandledRejection');
	var TimeoutError = require('./lib/TimeoutError');

	var Promise = [array, flow, fold, generate, progress,
		inspect, withThis, timed, unhandledRejection]
		.reduce(function(Promise, feature) {
			return feature(Promise);
		}, require('./lib/Promise'));

	var apply = require('./lib/apply')(Promise);

	// Public API

	when.promise     = promise;              // Create a pending promise
	when.resolve     = Promise.resolve;      // Create a resolved promise
	when.reject      = Promise.reject;       // Create a rejected promise

	when.lift        = lift;                 // lift a function to return promises
	when['try']      = attempt;              // call a function and return a promise
	when.attempt     = attempt;              // alias for when.try

	when.iterate     = Promise.iterate;      // DEPRECATED (use cujojs/most streams) Generate a stream of promises
	when.unfold      = Promise.unfold;       // DEPRECATED (use cujojs/most streams) Generate a stream of promises

	when.join        = join;                 // Join 2 or more promises

	when.all         = all;                  // Resolve a list of promises
	when.settle      = settle;               // Settle a list of promises

	when.any         = lift(Promise.any);    // One-winner race
	when.some        = lift(Promise.some);   // Multi-winner race
	when.race        = lift(Promise.race);   // First-to-settle race

	when.map         = map;                  // Array.map() for promises
	when.filter      = filter;               // Array.filter() for promises
	when.reduce      = lift(Promise.reduce);       // Array.reduce() for promises
	when.reduceRight = lift(Promise.reduceRight);  // Array.reduceRight() for promises

	when.isPromiseLike = isPromiseLike;      // Is something promise-like, aka thenable

	when.Promise     = Promise;              // Promise constructor
	when.defer       = defer;                // Create a {promise, resolve, reject} tuple

	// Error types

	when.TimeoutError = TimeoutError;

	/**
	 * Get a trusted promise for x, or by transforming x with onFulfilled
	 *
	 * @param {*} x
	 * @param {function?} onFulfilled callback to be called when x is
	 *   successfully fulfilled.  If promiseOrValue is an immediate value, callback
	 *   will be invoked immediately.
	 * @param {function?} onRejected callback to be called when x is
	 *   rejected.
	 * @param {function?} onProgress callback to be called when progress updates
	 *   are issued for x. @deprecated
	 * @returns {Promise} a new promise that will fulfill with the return
	 *   value of callback or errback or the completion value of promiseOrValue if
	 *   callback and/or errback is not supplied.
	 */
	function when(x, onFulfilled, onRejected, onProgress) {
		var p = Promise.resolve(x);
		if (arguments.length < 2) {
			return p;
		}

		return p.then(onFulfilled, onRejected, onProgress);
	}

	/**
	 * Creates a new promise whose fate is determined by resolver.
	 * @param {function} resolver function(resolve, reject, notify)
	 * @returns {Promise} promise whose fate is determine by resolver
	 */
	function promise(resolver) {
		return new Promise(resolver);
	}

	/**
	 * Lift the supplied function, creating a version of f that returns
	 * promises, and accepts promises as arguments.
	 * @param {function} f
	 * @returns {Function} version of f that returns promises
	 */
	function lift(f) {
		return function() {
			for(var i=0, l=arguments.length, a=new Array(l); i<l; ++i) {
				a[i] = arguments[i];
			}
			return apply(f, this, a);
		};
	}

	/**
	 * Call f in a future turn, with the supplied args, and return a promise
	 * for the result.
	 * @param {function} f
	 * @returns {Promise}
	 */
	function attempt(f /*, args... */) {
		/*jshint validthis:true */
		for(var i=0, l=arguments.length-1, a=new Array(l); i<l; ++i) {
			a[i] = arguments[i+1];
		}
		return apply(f, this, a);
	}

	/**
	 * Creates a {promise, resolver} pair, either or both of which
	 * may be given out safely to consumers.
	 * @return {{promise: Promise, resolve: function, reject: function, notify: function}}
	 */
	function defer() {
		return new Deferred();
	}

	function Deferred() {
		var p = Promise._defer();

		function resolve(x) { p._handler.resolve(x); }
		function reject(x) { p._handler.reject(x); }
		function notify(x) { p._handler.notify(x); }

		this.promise = p;
		this.resolve = resolve;
		this.reject = reject;
		this.notify = notify;
		this.resolver = { resolve: resolve, reject: reject, notify: notify };
	}

	/**
	 * Determines if x is promise-like, i.e. a thenable object
	 * NOTE: Will return true for *any thenable object*, and isn't truly
	 * safe, since it may attempt to access the `then` property of x (i.e.
	 *  clever/malicious getters may do weird things)
	 * @param {*} x anything
	 * @returns {boolean} true if x is promise-like
	 */
	function isPromiseLike(x) {
		return x && typeof x.then === 'function';
	}

	/**
	 * Return a promise that will resolve only once all the supplied arguments
	 * have resolved. The resolution value of the returned promise will be an array
	 * containing the resolution values of each of the arguments.
	 * @param {...*} arguments may be a mix of promises and values
	 * @returns {Promise}
	 */
	function join(/* ...promises */) {
		return Promise.all(arguments);
	}

	/**
	 * Return a promise that will fulfill once all input promises have
	 * fulfilled, or reject when any one input promise rejects.
	 * @param {array|Promise} promises array (or promise for an array) of promises
	 * @returns {Promise}
	 */
	function all(promises) {
		return when(promises, Promise.all);
	}

	/**
	 * Return a promise that will always fulfill with an array containing
	 * the outcome states of all input promises.  The returned promise
	 * will only reject if `promises` itself is a rejected promise.
	 * @param {array|Promise} promises array (or promise for an array) of promises
	 * @returns {Promise} promise for array of settled state descriptors
	 */
	function settle(promises) {
		return when(promises, Promise.settle);
	}

	/**
	 * Promise-aware array map function, similar to `Array.prototype.map()`,
	 * but input array may contain promises or values.
	 * @param {Array|Promise} promises array of anything, may contain promises and values
	 * @param {function(x:*, index:Number):*} mapFunc map function which may
	 *  return a promise or value
	 * @returns {Promise} promise that will fulfill with an array of mapped values
	 *  or reject if any input promise rejects.
	 */
	function map(promises, mapFunc) {
		return when(promises, function(promises) {
			return Promise.map(promises, mapFunc);
		});
	}

	/**
	 * Filter the provided array of promises using the provided predicate.  Input may
	 * contain promises and values
	 * @param {Array|Promise} promises array of promises and values
	 * @param {function(x:*, index:Number):boolean} predicate filtering predicate.
	 *  Must return truthy (or promise for truthy) for items to retain.
	 * @returns {Promise} promise that will fulfill with an array containing all items
	 *  for which predicate returned truthy.
	 */
	function filter(promises, predicate) {
		return when(promises, function(promises) {
			return Promise.filter(promises, predicate);
		});
	}

	return when;
});
})(typeof define === 'function' && define.amd ? define : function (factory) { module.exports = factory(require); });

},{"./lib/Promise":16,"./lib/TimeoutError":18,"./lib/apply":19,"./lib/decorators/array":20,"./lib/decorators/flow":21,"./lib/decorators/fold":22,"./lib/decorators/inspect":23,"./lib/decorators/iterate":24,"./lib/decorators/progress":25,"./lib/decorators/timed":26,"./lib/decorators/unhandledRejection":27,"./lib/decorators/with":28}],34:[function(require,module,exports){
module.exports=require(16)
},{"./Scheduler":35,"./env":47,"./makePromise":49,"C:\\dev\\organiq\\sdk-js\\node_modules\\organiq-core\\node_modules\\when\\lib\\Promise.js":16}],35:[function(require,module,exports){
module.exports=require(17)
},{"C:\\dev\\organiq\\sdk-js\\node_modules\\organiq-core\\node_modules\\when\\lib\\Scheduler.js":17}],36:[function(require,module,exports){
module.exports=require(18)
},{"C:\\dev\\organiq\\sdk-js\\node_modules\\organiq-core\\node_modules\\when\\lib\\TimeoutError.js":18}],37:[function(require,module,exports){
module.exports=require(19)
},{"C:\\dev\\organiq\\sdk-js\\node_modules\\organiq-core\\node_modules\\when\\lib\\apply.js":19}],38:[function(require,module,exports){
module.exports=require(20)
},{"../apply":37,"../state":50,"C:\\dev\\organiq\\sdk-js\\node_modules\\organiq-core\\node_modules\\when\\lib\\decorators\\array.js":20}],39:[function(require,module,exports){
module.exports=require(21)
},{"C:\\dev\\organiq\\sdk-js\\node_modules\\organiq-core\\node_modules\\when\\lib\\decorators\\flow.js":21}],40:[function(require,module,exports){
module.exports=require(22)
},{"C:\\dev\\organiq\\sdk-js\\node_modules\\organiq-core\\node_modules\\when\\lib\\decorators\\fold.js":22}],41:[function(require,module,exports){
module.exports=require(23)
},{"../state":50,"C:\\dev\\organiq\\sdk-js\\node_modules\\organiq-core\\node_modules\\when\\lib\\decorators\\inspect.js":23}],42:[function(require,module,exports){
module.exports=require(24)
},{"C:\\dev\\organiq\\sdk-js\\node_modules\\organiq-core\\node_modules\\when\\lib\\decorators\\iterate.js":24}],43:[function(require,module,exports){
module.exports=require(25)
},{"C:\\dev\\organiq\\sdk-js\\node_modules\\organiq-core\\node_modules\\when\\lib\\decorators\\progress.js":25}],44:[function(require,module,exports){
module.exports=require(26)
},{"../TimeoutError":36,"../env":47,"C:\\dev\\organiq\\sdk-js\\node_modules\\organiq-core\\node_modules\\when\\lib\\decorators\\timed.js":26}],45:[function(require,module,exports){
module.exports=require(27)
},{"../env":47,"../format":48,"C:\\dev\\organiq\\sdk-js\\node_modules\\organiq-core\\node_modules\\when\\lib\\decorators\\unhandledRejection.js":27}],46:[function(require,module,exports){
module.exports=require(28)
},{"C:\\dev\\organiq\\sdk-js\\node_modules\\organiq-core\\node_modules\\when\\lib\\decorators\\with.js":28}],47:[function(require,module,exports){
module.exports=require(29)
},{"C:\\dev\\organiq\\sdk-js\\node_modules\\organiq-core\\node_modules\\when\\lib\\env.js":29,"_process":61}],48:[function(require,module,exports){
module.exports=require(30)
},{"C:\\dev\\organiq\\sdk-js\\node_modules\\organiq-core\\node_modules\\when\\lib\\format.js":30}],49:[function(require,module,exports){
module.exports=require(31)
},{"C:\\dev\\organiq\\sdk-js\\node_modules\\organiq-core\\node_modules\\when\\lib\\makePromise.js":31,"_process":61}],50:[function(require,module,exports){
module.exports=require(32)
},{"C:\\dev\\organiq\\sdk-js\\node_modules\\organiq-core\\node_modules\\when\\lib\\state.js":32}],51:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function(require) {

	var PromiseMonitor = require('./monitor/PromiseMonitor');
	var ConsoleReporter = require('./monitor/ConsoleReporter');

	var promiseMonitor = new PromiseMonitor(new ConsoleReporter());

	return function(Promise) {
		return promiseMonitor.monitor(Promise);
	};
});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));

},{"./monitor/ConsoleReporter":52,"./monitor/PromiseMonitor":53}],52:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function(require) {

	var error = require('./error');
	var unhandledRejectionsMsg = '[promises] Unhandled rejections: ';
	var allHandledMsg = '[promises] All previously unhandled rejections have now been handled';

	function ConsoleReporter() {
		this._previouslyReported = false;
	}

	ConsoleReporter.prototype = initDefaultLogging();

	ConsoleReporter.prototype.log = function(traces) {
		if(traces.length === 0) {
			if(this._previouslyReported) {
				this._previouslyReported = false;
				this.msg(allHandledMsg);
			}
			return;
		}

		this._previouslyReported = true;
		this.groupStart(unhandledRejectionsMsg + traces.length);
		try {
			this._log(traces);
		} finally {
			this.groupEnd();
		}
	};

	ConsoleReporter.prototype._log = function(traces) {
		for(var i=0; i<traces.length; ++i) {
			this.warn(error.format(traces[i]));
		}
	};

	function initDefaultLogging() {
		/*jshint maxcomplexity:7*/
		var log, warn, groupStart, groupEnd;

		if(typeof console === 'undefined') {
			log = warn = consoleNotAvailable;
		} else {
			// Alias console to prevent things like uglify's drop_console option from
			// removing console.log/error. Unhandled rejections fall into the same
			// category as uncaught exceptions, and build tools shouldn't silence them.
			var localConsole = console;
			if(typeof localConsole.error === 'function'
				&& typeof localConsole.dir === 'function') {
				warn = function(s) {
					localConsole.error(s);
				};

				log = function(s) {
					localConsole.log(s);
				};

				if(typeof localConsole.groupCollapsed === 'function') {
					groupStart = function(s) {
						localConsole.groupCollapsed(s);
					};
					groupEnd = function() {
						localConsole.groupEnd();
					};
				}
			} else {
				// IE8 has console.log and JSON, so we can make a
				// reasonably useful warn() from those.
				// Credit to webpro (https://github.com/webpro) for this idea
				if (typeof localConsole.log ==='function'
					&& typeof JSON !== 'undefined') {
					log = warn = function (x) {
						if(typeof x !== 'string') {
							try {
								x = JSON.stringify(x);
							} catch(e) {}
						}
						localConsole.log(x);
					};
				}
			}
		}

		return {
			msg: log,
			warn: warn,
			groupStart: groupStart || warn,
			groupEnd: groupEnd || consoleNotAvailable
		};
	}

	function consoleNotAvailable() {}

	return ConsoleReporter;

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));

},{"./error":55}],53:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function(require) {

	var defaultStackJumpSeparator = 'from execution context:';
	var defaultStackFilter = /[\s\(\/\\](node|module|timers)\.js:|when([\/\\]{1,2}(lib|monitor|es6-shim)[\/\\]{1,2}|\.js)|(new\sPromise)\b|(\b(PromiseMonitor|ConsoleReporter|Scheduler|RunHandlerTask|ProgressTask|Promise|.*Handler)\.[\w_]\w\w+\b)|\b(tryCatch\w+|getHandler\w*)\b/i;

	var setTimer = require('../lib/env').setTimer;
	var error = require('./error');

	var executionContext = [];

	function PromiseMonitor(reporter) {
		this.logDelay = 0;
		this.stackFilter = defaultStackFilter;
		this.stackJumpSeparator = defaultStackJumpSeparator;
		this.filterDuplicateFrames = true;

		this._reporter = reporter;
		if(typeof reporter.configurePromiseMonitor === 'function') {
			reporter.configurePromiseMonitor(this);
		}

		this._traces = [];
		this._traceTask = 0;

		var self = this;
		this._doLogTraces = function() {
			self._logTraces();
		};
	}

	PromiseMonitor.prototype.monitor = function(Promise) {
		var self = this;
		Promise.createContext = function(p, context) {
			p.context = self.createContext(p, context);
		};

		Promise.enterContext = function(p) {
			executionContext.push(p.context);
		};

		Promise.exitContext = function() {
			executionContext.pop();
		};

		Promise.onPotentiallyUnhandledRejection = function(rejection, extraContext) {
			return self.addTrace(rejection, extraContext);
		};

		Promise.onPotentiallyUnhandledRejectionHandled = function(rejection) {
			return self.removeTrace(rejection);
		};

		Promise.onFatalRejection = function(rejection, extraContext) {
			return self.fatal(rejection, extraContext);
		};

		return this;
	};

	PromiseMonitor.prototype.createContext = function(at, parentContext) {
		var context = {
			parent: parentContext || executionContext[executionContext.length - 1],
			stack: void 0
		};
		error.captureStack(context, at.constructor);
		return context;
	};

	PromiseMonitor.prototype.addTrace = function(handler, extraContext) {
		var t, i;

		for(i = this._traces.length-1; i >= 0; --i) {
			t = this._traces[i];
			if(t.handler === handler) {
				break;
			}
		}

		if(i >= 0) {
			t.extraContext = extraContext;
		} else {
			this._traces.push({
				handler: handler,
				extraContext: extraContext
			});
		}

		this.logTraces();
	};

	PromiseMonitor.prototype.removeTrace = function(/*handler*/) {
		this.logTraces();
	};

	PromiseMonitor.prototype.fatal = function(handler, extraContext) {
		var err = new Error();
		err.stack = this._createLongTrace(handler.value, handler.context, extraContext).join('\n');
		setTimer(function() {
			throw err;
		}, 0);
	};

	PromiseMonitor.prototype.logTraces = function() {
		if(!this._traceTask) {
			this._traceTask = setTimer(this._doLogTraces, this.logDelay);
		}
	};

	PromiseMonitor.prototype._logTraces = function() {
		this._traceTask = void 0;
		this._traces = this._traces.filter(filterHandled);
		this._reporter.log(this.formatTraces(this._traces));
	};


	PromiseMonitor.prototype.formatTraces = function(traces) {
		return traces.map(function(t) {
			return this._createLongTrace(t.handler.value, t.handler.context, t.extraContext);
		}, this);
	};

	PromiseMonitor.prototype._createLongTrace = function(e, context, extraContext) {
		var trace = error.parse(e) || [String(e) + ' (WARNING: non-Error used)'];
		trace = filterFrames(this.stackFilter, trace, 0);
		this._appendContext(trace, context);
		this._appendContext(trace, extraContext);
		return this.filterDuplicateFrames ? this._removeDuplicates(trace) : trace;
	};

	PromiseMonitor.prototype._removeDuplicates = function(trace) {
		var seen = {};
		var sep = this.stackJumpSeparator;
		var count = 0;
		return trace.reduceRight(function(deduped, line, i) {
			if(i === 0) {
				deduped.unshift(line);
			} else if(line === sep) {
				if(count > 0) {
					deduped.unshift(line);
					count = 0;
				}
			} else if(!seen[line]) {
				seen[line] = true;
				deduped.unshift(line);
				++count;
			}
			return deduped;
		}, []);
	};

	PromiseMonitor.prototype._appendContext = function(trace, context) {
		trace.push.apply(trace, this._createTrace(context));
	};

	PromiseMonitor.prototype._createTrace = function(traceChain) {
		var trace = [];
		var stack;

		while(traceChain) {
			stack = error.parse(traceChain);

			if (stack) {
				stack = filterFrames(this.stackFilter, stack);
				appendStack(trace, stack, this.stackJumpSeparator);
			}

			traceChain = traceChain.parent;
		}

		return trace;
	};

	function appendStack(trace, stack, separator) {
		if (stack.length > 1) {
			stack[0] = separator;
			trace.push.apply(trace, stack);
		}
	}

	function filterFrames(stackFilter, stack) {
		return stack.filter(function(frame) {
			return !stackFilter.test(frame);
		});
	}

	function filterHandled(t) {
		return !t.handler.handled;
	}

	return PromiseMonitor;
});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));

},{"../lib/env":47,"./error":55}],54:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function(require) {

	var monitor = require('../monitor');
	var Promise = require('../when').Promise;

	return monitor(Promise);

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));

},{"../monitor":51,"../when":56}],55:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	var parse, captureStack, format;

	if(Error.captureStackTrace) {
		// Use Error.captureStackTrace if available
		parse = function(e) {
			return e && e.stack && e.stack.split('\n');
		};

		format = formatAsString;
		captureStack = Error.captureStackTrace;

	} else {
		// Otherwise, do minimal feature detection to determine
		// how to capture and format reasonable stacks.
		parse = function(e) {
			var stack = e && e.stack && e.stack.split('\n');
			if(stack && e.message) {
				stack.unshift(e.message);
			}
			return stack;
		};

		(function() {
			var e = new Error();
			if(typeof e.stack !== 'string') {
				format = formatAsString;
				captureStack = captureSpiderMonkeyStack;
			} else {
				format = formatAsErrorWithStack;
				captureStack = useStackDirectly;
			}
		}());
	}

	function captureSpiderMonkeyStack(host) {
		try {
			throw new Error();
		} catch(err) {
			host.stack = err.stack;
		}
	}

	function useStackDirectly(host) {
		host.stack = new Error().stack;
	}

	function formatAsString(longTrace) {
		return join(longTrace);
	}

	function formatAsErrorWithStack(longTrace) {
		var e = new Error();
		e.stack = formatAsString(longTrace);
		return e;
	}

	// About 5-10x faster than String.prototype.join o_O
	function join(a) {
		var sep = false;
		var s = '';
		for(var i=0; i< a.length; ++i) {
			if(sep) {
				s += '\n' + a[i];
			} else {
				s+= a[i];
				sep = true;
			}
		}
		return s;
	}

	return {
		parse: parse,
		format: format,
		captureStack: captureStack
	};

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}],56:[function(require,module,exports){
module.exports=require(33)
},{"./lib/Promise":34,"./lib/TimeoutError":36,"./lib/apply":37,"./lib/decorators/array":38,"./lib/decorators/flow":39,"./lib/decorators/fold":40,"./lib/decorators/inspect":41,"./lib/decorators/iterate":42,"./lib/decorators/progress":43,"./lib/decorators/timed":44,"./lib/decorators/unhandledRejection":45,"./lib/decorators/with":46,"C:\\dev\\organiq\\sdk-js\\node_modules\\organiq-core\\node_modules\\when\\when.js":33}],57:[function(require,module,exports){

/**
 * Module dependencies.
 */

var global = (function() { return this; })();

/**
 * WebSocket constructor.
 */

var WebSocket = global.WebSocket || global.MozWebSocket;

/**
 * Module exports.
 */

module.exports = WebSocket ? ws : null;

/**
 * WebSocket constructor.
 *
 * The third `opts` options object gets ignored in web browsers, since it's
 * non-standard, and throws a TypeError if passed to the constructor.
 * See: https://github.com/einaros/ws/issues/227
 *
 * @param {String} uri
 * @param {Array} protocols (optional)
 * @param {Object) opts (optional)
 * @api public
 */

function ws(uri, protocols, opts) {
  var instance;
  if (protocols) {
    instance = new WebSocket(uri, protocols);
  } else {
    instance = new WebSocket(uri);
  }
  return instance;
}

if (WebSocket) ws.prototype = WebSocket.prototype;

},{}],58:[function(require,module,exports){

},{}],59:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],60:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],61:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canMutationObserver = typeof window !== 'undefined'
    && window.MutationObserver;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    var queue = [];

    if (canMutationObserver) {
        var hiddenDiv = document.createElement("div");
        var observer = new MutationObserver(function () {
            var queueList = queue.slice();
            queue.length = 0;
            queueList.forEach(function (fn) {
                fn();
            });
        });

        observer.observe(hiddenDiv, { attributes: true });

        return function nextTick(fn) {
            if (!queue.length) {
                hiddenDiv.setAttribute('yes', 'no');
            }
            queue.push(fn);
        };
    }

    if (canPost) {
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],62:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],63:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":62,"_process":61,"inherits":60}],"organiq":[function(require,module,exports){
(function (process){
/**
 * Organiq Application and Device SDK.
 *
 * Provides interfaces for obtaining proxies for remote Organiq objects, and
 * implements a local device container for hosting devices.
 *
 */
var organiq = require('organiq-core');
var WebSocket = require('./websocket');
var when = require('when');
var fs = require('fs');
require('when/monitor/console');
var debug = require('debug')('sdk');

var Proxy_ = require('./proxy');
var Device = require('./device');
var Schema = require('./schema');


module.exports = OrganiqContainer;
module.exports.Device = Device;
module.exports.Proxy = Proxy_;
module.exports.Schema = Schema;


var DEFAULT_APIROOT = 'ws://api.organiq.io';
var DEFAULT_APITOKEN = '';
var DEFAULT_NAMESPACE = '.';
var DEFAULT_OPTIONS_PATH = './organiq.json';


/**
 * Create Organiq Device Container.
 *
 * The values used for API root and API token can be specified in any of the
 * following places:
 *  (1) Organiq constructor
 *  (2) organiq.json in the current working directory
 *  (3) ORGANIQ_APIROOT and ORGANIQ_APITOKEN environment variables
 *
 * If values are not found in any of these places, defaults are used.
 *
 * @param {Object} options Configuration options.
 * @param {String=} options.apiRoot The URI of the gateway server endpoint to which we
 *  should connect.
 * @param {String=} options.apiToken The authentication token to use with the gateway.
 * @param {String=} options.namespace The namespace to use for deviceids
 *  when one is not specified. Defaults to the global namespace ('.').
 * @param {String=} options.optionsPath Defaults to './organiq.json'
 * @param {Boolean=} options.autoConnect Defaults to true.
 * @param {Boolean=} options.strictSchema Defaults to false.
 *
 * @constructor
 */
function OrganiqContainer(options) {
  if (!(this instanceof OrganiqContainer)) {
    return new OrganiqContainer(options);
  }

  options = options || {};
  var apiRoot = options.apiRoot;
  var apiToken = options.apiToken;
  var namespace = options.namespace;
  var optionsPath = options.optionsPath || DEFAULT_OPTIONS_PATH;
  var autoConnect = options.autoConnect !== false;  // true if not given false
  var strictSchema = options.strictSchema || false; // false if not given true

  var deferredConnection = when.defer();
  var connection$ = deferredConnection.promise;

  // If we weren't given apiRoot and apiToken, look first in organiq.json.
  // Note that the special checks for fs.existsSync are necessary for this code
  // to work in a web browser environment (where it will not be defined).

  if (!apiRoot || !apiToken) {
    if (fs && fs.existsSync !== undefined && fs.existsSync(optionsPath)) {
      var s = fs.readFileSync(optionsPath, 'utf8');
      var config = JSON.parse(s);
      apiToken = config['token'];
      apiRoot = config['apiRoot'];
      namespace = config['namespace'];
    }
  }

  apiRoot = apiRoot || process.env['ORGANIQ_APIROOT'] || DEFAULT_APIROOT;
  apiToken = apiToken || process.env['ORGANIQ_APITOKEN'] || DEFAULT_APITOKEN;
  namespace = namespace || process.env['ORGANIQ_NAMESPACE'] || DEFAULT_NAMESPACE;

  // Create the local node.
  var core = new organiq({ defaultDomain: namespace });

  if (autoConnect) {
    connect(apiRoot, apiToken);
  }

  /**
   * Connect to an Organiq Gateway Server.
   *
   * Normally called automatically in the constructor.
   *
   * @param {String=} overrideApiRoot
   * @param {String=} overrideApiToken
   * @returns {Promise}
   */
  function connect(overrideApiRoot, overrideApiToken) {
    apiRoot = overrideApiRoot || apiRoot;
    apiToken = overrideApiToken || apiToken;


    // Listen for the 'gatewayRegistered' event from the local
    // node so that we can signal to the caller that
    // connection is complete.
    core.on('gatewayRegistered', function() {
      deferredConnection.resolve();
    });

    // Create a new websocket (client) connection, configuring it as a gateway
    // for the local organiq instance.
    var ws = new WebSocket(apiRoot);
    ws.on('open', core.websocketApi({ gateway:true }));

    return deferredConnection.promise;
  }

  /**
   * Register a local device object with the system.
   *
   * If `strictSchema` is enabled in options, a schema object must be provided
   * that specifies the properties, methods, and events exposed by the device
   * being registered. If `strictSchema` is not enabled, then the schema object
   * is optional. If omitted in this case, a schema will be automatically
   * created by inspecting the given `impl` object.
   *
   * @param {String} deviceid
   * @param {Object} impl Native implementation object
   * @param {Object} [schema] optional schema for interface
   * @returns {Device}
   */
  this.registerDevice = function(deviceid, impl, schema) {
    if (strictSchema && !schema) {
      throw new Error('Schema is required when `strictSchema` enabled');
    }
    var device = new Device(impl, schema, { strictSchema: strictSchema });
    return core.register(deviceid, device).then(function(deviceid) {
      void(deviceid); // unused
      return device;
    });
  };


  /**
   * Get a reference to a remote device.
   *
   * @param deviceId
   * @return {ProxyWrapper|Promise}
   */
  this.getDevice = function(deviceId) {
    var proxy = null;

    debug('getDevice(deviceId='+deviceId+')');

    // First, wait for the gateway connection to be established
    return connection$.then(function() {
      // Issue the core connect() request to get a core device proxy
      debug('getDevice connection established.');
      return core.connect(deviceId);
    }).then(function(proxy_) {
      // Query the device for its schema
      debug('getDevice received native device proxy.');
      proxy = proxy_;
      return proxy.describe('schema');
    }).then(function(schema) {
      // Create the proxy wrapper object for the caller
      debug('getDevice received device schema.');
      return new Proxy_(schema, proxy);
    }).catch(function(err) {
      console.log('getDevice error: ', err);
      throw err;
    });
  };
}


/**
 * Factory for a singleton OrganiqContainer object.
 *
 * It is common for the module client to want to use a single instance of
 * OrganiqContainer with default connection settings. This factory (together
 * with the class functions below) allows the constructor function exported by
 * this module to be used directly in this case, obviating the need for the
 * caller to manually create an instance.
 *
 * // verbose (normal) flow:
 * var organiq = require('organiq');
 * var options = { ... }
 * organiq = organiq(options);  // create instance with optional options
 * organiq.register(...);       // call via instance
 *
 * // using singleton pattern
 * var organiq = require('organiq');
 * organiq.register();  // implicitly create singleton and call through it
 * // ...
 * organiq.getDevice(); // calls through same singleton object
 *
 */
var Singleton = (function () {
  var o;
  return { get: function() { if (!o) { o = new OrganiqContainer(); } return o; } };
})();

/**
 * Calls `connect` of singleton object.
 *
 * @return {LocalDeviceProxy|Promise|WebSocketDeviceProxy|*|Connection}
 */
//OrganiqContainer.connect = function() {
//  var s = Singleton.get();
//  return s.connect.apply(s, arguments);
//};

/**
 * Calls `registerDevice` of singleton object.
 *
 * @return {LocalDeviceProxy|Promise|WebSocketDeviceProxy|*|Connection}
 */
OrganiqContainer.registerDevice = function() {
  var s = Singleton.get();
  return s.registerDevice.apply(s, arguments);
};

/**
 * Calls `getDevice` of singleton object.
 *
 * @return {LocalDeviceProxy|Promise|WebSocketDeviceProxy|*|Connection}
 */
OrganiqContainer.getDevice = function() {
  var s = Singleton.get();
  return s.getDevice.apply(s, arguments);
};

}).call(this,require('_process'))
},{"./device":1,"./proxy":2,"./schema":3,"./websocket":4,"_process":61,"debug":5,"fs":58,"organiq-core":8,"when":56,"when/monitor/console":54}]},{},[]);
