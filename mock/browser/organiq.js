require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
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

},{}],3:[function(require,module,exports){
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

},{}],4:[function(require,module,exports){
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

},{}],5:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],6:[function(require,module,exports){
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
},{"./support/isBuffer":5,"_process":4,"inherits":3}],7:[function(require,module,exports){
/**
 * Client Provider.
 *
 * The Client provides the application SDK. While this component can share a
 * gateway connection with the Device Container, it is different in a few
 * ways:
 *  - Requests sent through this module never touch a local device stack
 *  - Unlike the device container, which does not attempt to forcibly reconnect
 *    to a disconnected gateway for every message, the client will attempt to
 *    reconnect broken connections whenever possible.
 *
 * The idea is that this module tries to behave as an application programmer
 * would like it to (always retry operations, etc). The Device Container
 * attempts to make the entire interface as declarative as possible, not
 * troubling the user code with any troubles it encounters.
 *
 * @type {OrganiqRequest|exports|module.exports}
 */


var when = require('when');
var debug = require('debug')('organiq:core');
var EventEmitter = require('events').EventEmitter;
var OrganiqRequest = require('./request');
var util = require('util');
module.exports = Client;

/**
 * Create a Client node.
 *
 * @param {Object=} options
 * @returns {Client}
 * @constructor
 */
function Client(options) {
  if (!(this instanceof Client)) {
    return new Client(options);
  }
  options = options || {};

  this.proxies = {};    // connected remote device proxies, by deviceid
  this.gateway = null;    // gateway with which we are associated
  this.namespace = null;  // namespace used on gateway
  //this.pendingRequests = {};  // requests sent while disconnected
}
util.inherits(Client, EventEmitter);

/**
 * Get a proxy for a device.
 *
 * @param {string} deviceid Specifies the device to which to connect.
 * @return {RemoteDeviceProxy} device proxy
 */
Client.prototype.connect = function(deviceid) {
  var proxies = this.proxies;
  if (typeof proxies[deviceid] !== 'undefined') {
    return when(proxies[deviceid]);  // BUGBUG, ref count?
  }

  var gateway = this.gateway;
  if (!gateway) {
    throw new Error('No gateway attached.');
  }

  function listener() {d.resolve();}
  if (!gateway.connected) {
    var d = when.defer();
    gateway.on('connect', listener);
    return when(d.promise).timeout(5000)
      .then(function () {
        var req = new OrganiqRequest(deviceid, 'CONNECT');
        return gateway.dispatch(req);
      })
      .then(function() {
        return new RemoteDeviceProxy(gateway, deviceid);
      })
      .finally(function() {
        gateway.removeListener('on', listener);
      });
  } else{
    return this.gateway.connect(deviceid)
      .then(function() {
        var proxy = new RemoteDeviceProxy(gateway, deviceid);
        proxies[deviceid] = proxy;
        return proxy;
      });
  }

};

/**
 * Release a proxy for a device.
 *
 * @params {LocalDeviceProxy} previously connected device proxy
 */
Client.prototype.disconnect = function(proxy) {
  var req = new OrganiqRequest(proxy.deviceid, 'DISCONNECT');
    return this.gateway.dispatch(req);
};

Client.prototype.attachGateway = function attachGateway(gateway, namespace) {
  debug('[Client] Gateway attached to namespace ' + namespace);
  if (this.gateway) {
    throw new Error('Gateway already attached');
  }
  this.gateway = gateway;
  this.namespace = namespace;
  //var self = this;

  gateway.on('connect', function() {
    debug('Gateway connected (namespace: ' + namespace + ')');
    //for (var reqid in self.pendingRequests) {
    //  if (self.pendingRequests.hasOwnProperty(reqid)) {
    //    gateway.dispatch(self.pendingRequests[reqid]);
    //    delete self.pendingRequests[reqid];
    //  }
    //}
  });
  gateway.on('disconnect', function() {
    debug('Gateway disconnnected (namespace: ' + namespace + ')');
    // nothing
  });
};

/**
 * Dispatch an upstream request to a connected client.
 *
 * @param  {OrganiqRequest} req The request to dispatch
 * @return {Promise} A promise for a result value
 */
Client.prototype.dispatch = function dispatch(req) {
  /** @type {RemoteDeviceProxy} */
  var proxy = this.proxies[req.deviceid];
  var res = req.method === 'NOTIFY' ? true : req.value;
  if (!proxy) {
    // nothing to do
    return when(res);
  }

  switch(req.method) {
    case 'NOTIFY':
      proxy.emit('notify', req.identifier, req.params);
      break;
    case 'PUT':
      proxy.emit('put', req.identifier, req.value);
      break;
    default:
      debug('Invalid upstream method: ' + req.method);
      throw new Error(req.method + ' is not a valid upstream notification');
  }

  return when(res);
};

/**
 * Remote Device Proxy.
 *
 * This object is given to callers of connect(), providing them an object-
 * based interface to a remote device.
 *
 * This proxy can work with any Gateway, provided it supports the dispatch()
 * method accepting an OrganiqRequest.
 *
 * @param {object} gateway
 * @param deviceid
 * @return {RemoteDeviceProxy}
 * @constructor
 */
function RemoteDeviceProxy(gateway, deviceid) {
  if (!(this instanceof RemoteDeviceProxy)) {
    return new RemoteDeviceProxy(gateway, deviceid);
  }

  this.deviceid = deviceid;
  this.gateway = gateway;
  this.dispatch = function(req) {
    return this.gateway.dispatch(req);
  };
}
//emits 'notify' and 'put'
util.inherits(RemoteDeviceProxy, EventEmitter);

RemoteDeviceProxy.prototype.get = function(prop) {
  var req = OrganiqRequest.get(this.deviceid, prop);
  return this.dispatch(req);
};

RemoteDeviceProxy.prototype.set = function(prop, value) {
  var req = OrganiqRequest.set(this.deviceid, prop, value);
  return this.dispatch(req);
};

RemoteDeviceProxy.prototype.invoke = function(method, params) {
  var req = OrganiqRequest.invoke(this.deviceid, method, params);
  return this.dispatch(req);
};

RemoteDeviceProxy.prototype.subscribe = function(event) {
  var req = OrganiqRequest.subscribe(this.deviceid, event);
  return this.dispatch(req);
};

RemoteDeviceProxy.prototype.describe = function(property) {
  var req = OrganiqRequest.describe(this.deviceid, property);
  return this.dispatch(req);
};

RemoteDeviceProxy.prototype.config = function(property, value) {
  var req = OrganiqRequest.config(this.deviceid, property, value);
  return this.dispatch(req);
};


},{"./request":11,"debug":15,"events":2,"util":6,"when":40}],8:[function(require,module,exports){
var OrganiqRequest = require('./request');
var when = require('when');
var debug = require('debug')('organiq:core');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
module.exports = Container;

/**
 * Create a Container node.
 *
 * @param {Object=} options
 * @returns {Container}
 * @constructor
 */
function Container(options) {
  if (!(this instanceof Container)) {
    return new Container(options);
  }
  //options = options || {};

  this.stack = [];        // middleware stack, ordered toward downstream
  this.devices = {};      // registered local device objects, by deviceid
  this.gateway = null;    // gateway with which we are associated
  this.namespace = null;  // namespace used on gateway
}
util.inherits(Container, EventEmitter);


/**
 * Add middleware to the Organiq stack.
 *
 * Middleware functions are called for every request that passes through the
 * system. They are invoked in the order that they are given to use().
 *
 * @param {function(OrganiqRequest, function)|function[]} fns
 * @returns {Container}
 */
Container.prototype.use = function use(fns) {

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
 * while upstream messages are sent to the gateway.
 *
 * @param  {OrganiqRequest} req The request to dispatch
 * @return {Promise} A promise for a result value
 */
Container.prototype.dispatch = function dispatch(req) {

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
   * the `finalHandler` is called to dispatch the request to the target device.
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
   * The request will be passed to the device object if it exists, otherwise
   * an Error will be raised.
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
   * We forward the request to the gateway.
   *
   * @param {OrganiqRequest} req request object
   * @returns {Boolean}
   */
  function finalHandlerUpstream(req) {
    if (app.gateway && app.gateway.connected) {
      app.gateway.dispatch(req);
    }
    return true;
  }
};


/**
 * Register a device with the system.
 *
 * The device may be either a locally-implemented device, or a proxy to a
 * device implemented elsewhere.
 *
 *
 * @param {String} deviceid
 * @param {Device|EventEmitter} device
 * @returns {Device} the device object given
 */
Container.prototype.register = function(deviceid, device) {

  var self = this;

  // Make sure we haven't already registered this deviceid.
  var devices = this.devices;
  if (typeof devices[deviceid] !== 'undefined') {
    return when.reject(new Error(
      'Register called for already registered deviceid: ' + deviceid));
  }

  if (typeof device.on === 'function') {
    // Pass device-originated messages from the device into the organiq
    // middleware stack.
    device.on('put', function onPut(metric, value) {
      debug('LocalDevice '+deviceid+': PUT ' + metric + ',' + value);
      var req = OrganiqRequest.put(deviceid, metric, value);
      self.dispatch(req);
    });
    device.on('notify', function onNotify(event, args) {
      debug('LocalDevice '+deviceid+': NOTIFY ' + event + ',' + args);
      var req = OrganiqRequest.notify(deviceid, event, args);
      self.dispatch(req);
    });
  }

  this.devices[deviceid] = device;
  this.emit('deviceRegistered', deviceid);

  debug('Device registered locally: ' + deviceid);

  if (this.gateway && this.gateway.connected) {
    this.registerWithGateway(deviceid);
  }
  return device;
};

Container.prototype.registerWithGateway = function(deviceid) {
  debug('Registering ' + deviceid + ' with gateway.');
  var req = new OrganiqRequest(deviceid, 'REGISTER');
  this.gateway.dispatch(req).then(function() {
    debug('Device registered with gateway: ' + deviceid);
  }, function(err) {
    debug('Failed to register device ' + deviceid + ': ' + err);
  });
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
Container.prototype.deregister = function(deviceid) {
  if (typeof this.devices[deviceid] === 'undefined') {
    debug('deregister called for unregistered deviceid: ' + deviceid);
    return when.reject(new Error(
      'deregister of unregistered device: ' + deviceid));
  }

  var device = this.devices[deviceid];
  device.removeAllListeners();
  delete this.devices[deviceid];
  this.emit('deviceDeregistered', deviceid);

  debug('Device deregistered: ' + deviceid);

  var req = new OrganiqRequest(deviceid, 'DEREGISTER');
  return this.gateway.dispatch(req);
};

Container.prototype.attachGateway = function attachGateway(gateway, namespace) {
  debug('Gateway attached to namespace ' + namespace);
  if (this.gateway) {
    throw new Error('Gateway already attached');
  }
  this.gateway = gateway;
  this.namespace = namespace;
  var self = this;

  gateway.on('connect', function() {
    debug('Gateway connected (namespace: ' + namespace + ')');
    for (var deviceid in self.devices) {
      if (self.devices.hasOwnProperty(deviceid)) {
        self.registerWithGateway(deviceid);
      }
    }
  });
  gateway.on('disconnect', function() {
    debug('Gateway disconnnected (namespace: ' + namespace + ')');
    // nothing
  });
};

},{"./request":11,"debug":15,"events":2,"util":6,"when":40}],9:[function(require,module,exports){
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
 * @param {String} property. Maybe be one of .schema or .config
 * @returns {Object} the device schema
 */
DeviceWrapper.prototype.describe = function(property) {
  switch(property) {
    case '.schema':
      return this.schema;
    case '.config':
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


},{"./schema":12,"debug":15,"events":2,"util":6}],10:[function(require,module,exports){
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


},{"events":2,"util":6,"when":40}],11:[function(require,module,exports){
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

},{}],12:[function(require,module,exports){
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

},{}],13:[function(require,module,exports){
/**
 * WebSocket transport.
 *
 * This module is responsible for tunneling Organiq protocol requests over a
 * WebSocket connection. It may be used as a transport for any of device
 * containers, client handlers, or gateway servers.
 *
 * The transport does not maintain any state information concerning which
 * devices or applications are connected on either side of a connection. It is
 * the responsibility of the device and client containers to do so.
 *
 * Messages sent:
 *  REGISTER, DEREGISTER - administrative requests sent by a local device
 *    container to a remote gateway.
 *  CONNECT, DISCONNECT - administrative requests sent by a local application
 *    client to a remote gateway.
 *  PUT, NOTIFY - Device notifications sent from a local device container to
 *    remote application clients.
 *  GET, SET, INVOKE, SUBSCRIBE, CONFIG - Application requests sent from a local
 *    application client to a remote device container.
 *
 * Messages received:
 *  REGISTER, DEREGISTER - administrative requests sent by a remote device
 *    container to a local gateway.
 *  CONNECT, DISCONNECT - administrative requests sent by a remote application
 *    client to a local gateway.
 *  GET, SET, INVOKE, SUBSCRIBE, CONFIG - Application requests sent from a
 *    remote application client (possibly via a gateway). Forwarded to local
 *    device container.
 *  PUT, NOTIFY - Device notifications sent from a remote device container
 *    (possibly via a gateway). Forwarded to local application client.
 *
 * Requests in both directions may be overlapped; that is, multiple requests
 * may be outstanding at any given time, and responses to those requests may
 * come in any order. To facilitate multiplexing, each request has an associated
 * `reqid` property (assigned by the sender) which is included in the RESPONSE
 * sent by the responder.
 *
 * The format for both device and administrative requests is a JSON-
 * formatted WebSocketRequest object.
 *
 *  `reqid` - Unique request id generated by sender
 *  `deviceid` -
 *  `method` -
 *  `identifier` -
 *  `value` -
 *
 * Requests always include a `method`
 * and unique `reqid`, with slightly different properties depending on
 * request type. Responses to requests are indicated by method=`RESPONSE`,
 * and have the following additional properties:
 *  `reqid` - the value of reqid from the request message
 *  `success` - a boolean that is true if the request was successful
 *  `res` - on success, a JavaScript object representing the returned value
 *  `err` - on failure, a JavaScript Error object
 */

/**
 * Module Dependencies.
 */
var when_ = require('when');
var debug = require('debug')('organiq:websocket');
var OrganiqRequest = require('./request.js');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

/**
 * Export WebSocketApi factory function.
 */
module.exports = WebSocketTransport;

var gatewayCommands = ['REGISTER', 'DEREGISTER', 'CONNECT', 'DISCONNECT'];
var downstreamCommands = ['GET', 'SET', 'INVOKE', 'SUBSCRIBE', 'DESCRIBE', 'CONFIG'];
var upstreamCommands = ['PUT', 'NOTIFY'];
var responseCommand = ['RESPONSE'];
void(gatewayCommands||responseCommand);


function isDownstreamCommand(method) {
  return downstreamCommands.indexOf(method) !== -1;
}

function isUpstreamCommand(method) {
  return upstreamCommands.indexOf(method) !== -1;
}

//function isGatewayCommmand(method) {
//  return gatewayCommands.indexOf(method) !== -1;
//}

//var MAX_SAFE_INTEGER = 9007199254740991;
//function newId() {
//  return Math.floor(Math.random() * MAX_SAFE_INTEGER).toString();
//}

var DEFAULT_REQUEST_TIMEOUT = 5000;   // five seconds

function webSocketRequestToOrganiqRequest(msg) {
  var r = OrganiqRequest;
  switch (msg.method) {
    case 'GET': return r.get(msg.deviceid, msg.identifier);
    case 'SET': return r.set(msg.deviceid, msg.identifier, msg.value);
    case 'INVOKE': return r.invoke(msg.deviceid, msg.identifier, msg.value);
    case 'SUBSCRIBE': return r.subscribe(msg.deviceid, msg.identifier);
    case 'DESCRIBE': return r.describe(msg.deviceid, msg.identifier);
    case 'CONFIG': return r.config(msg.deviceid, msg.identifier, msg.value);
    case 'PUT': return r.put(msg.deviceid, msg.identifier, msg.value);
    case 'NOTIFY': return r.notify(msg.deviceid, msg.identifier, msg.value);
    default:
      throw new Error('Invalid WebSocket method: ' + msg.method);
  }
}

function OrganiqToWSRequest(req) {
  var msg = {deviceid: req.deviceid, method: req.method, identifier: req.identifier};
  msg.connid = req.deviceid;  // BUGBUG: temporary hack to work with old gateway server
  switch (req.method) {
    case 'GET': return msg;
    case 'SET': msg.value = req.value; return msg;
    case 'INVOKE': msg.value = req.params; return msg;
    case 'SUBSCRIBE': return msg;
    case 'DESCRIBE': return msg;
    case 'CONFIG': msg.value = req.value; return msg;
    case 'PUT': msg.value = req.value; return msg;
    case 'NOTIFY': msg.value = req.params; return msg;
    case 'REGISTER': return msg;
    case 'DEREGISTER': return msg;
    case 'CONNECT': return msg;
    case 'DISCONNECT': return msg;
    default:
      throw new Error('Invalid OrganiqRequest method: ' + msg.method);
  }
}

/**
 * @name Dispatcher
 * @property {function(OrganiqRequest)} dispatch - method to dispatch OrganiqRequest
 */

/**
 * Factory for the WebSocket API handler.
 *
 *
 * @param {Dispatcher} downstream The dispatcher to invoke when downstream
 *  messages are received from the network peer. This is normally a local device
 *  container.
 * @param {Dispatcher} upstream The dispatcher to invoke when upstream messages
 *  are received from the network peer. This is normally a client application
 *  container.
 * @param {object} options
 * @param {object} options.namespace
 * @param {object} options.requestTimeout
 * @returns {Function} handler function to be installed as WebSocket 'open'
 *  handler.
 *
 */
function WebSocketTransport(downstream, upstream, options) {
  if (!(this instanceof WebSocketTransport)) {
    return new WebSocketTransport(downstream, upstream);
  }
  options = options || {};
  var REQUEST_TIMEOUT = options.requestTimeout || DEFAULT_REQUEST_TIMEOUT;

  var requests = {};      // outstanding server-originated requests, by reqid
  var _reqid = 0;         // request ID of last server-originated request
  var ws = null;
  var self = this;

  // public interface
  this.connectionHandler = webSocketApiConnectionHandler;
  this.connected = false;
  this.dispatch = dispatch;

  /**
   * Connection handler function.
   *
   * This function should be installed as the 'open' handler for a client-side
   * WebSocket.
   *
   * var ws = new WebSocket(...);
   * ws.on('open', handler)
   *
   * @params {WebSocket|undefined} A new WebSocket connection. If not specified,
   *  it is assumed that `this` refers to the WebSocket object.
   */
  function webSocketApiConnectionHandler(ws_) {
    ws = ws_ || this;

    ws.on('message', processMessage);
    ws.on('close', processClose);
    ws.on('error', processError);

    self.connected = true;
    self.emit('connect');
  }

  /**
   * WebSocket message handler.
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
    try {
      msg = JSON.parse(data);
    }
    catch (e) {
      debug('Invalid (non-JSON) message received.');
    }

    if (!msg || !msg.reqid || !msg.method) {
      throw new Error('Invalid message (missing reqid or method)');
    }

    var method = msg.method;

    // Responses are handled by resolve-ing or reject-ing the promise that
    // was returned to the caller when the original request was made.
    if (method === 'RESPONSE') {
      var deferred = requests[msg.reqid];
      delete requests[msg.reqid];

      if (!deferred) {
        debug('RESPONSE received but no pending request. Cancelled or timed out?');
      } else {
        if (msg.success) {
          debug('[' + msg.reqid + '] RESPONSE (' + msg.res + ')');
          deferred.resolve(msg.res);
        } else {
          debug('[' + msg.reqid + '] RESPONSE ERROR(' + msg.err + ')');
          deferred.reject(new Error(msg.err));
        }
      }
    }

    // Downstream requests are dispatched to the local router.
    else if (isDownstreamCommand(method)) {
      var req = webSocketRequestToOrganiqRequest(msg);

      return downstream.dispatch(req).then(function (res) {
        sendResponse(msg, res);
      }).catch(function (err) {
        debug('dispatch failed: ' + err);
        var errMessage = (err instanceof Error) ? err.message : err;
        sendFailureResponse(msg, errMessage);
      });
    }

    // Upstream requests go up to application clients
    else if (isUpstreamCommand(method)) {
      var reqUp = webSocketRequestToOrganiqRequest(msg);

      return upstream.dispatch(reqUp).then(function (res) {
        sendResponse(msg, res);
      }).catch(function (err) {
        debug('dispatch failed: ' + err);
        var errMessage = (err instanceof Error) ? err.message : err;
        sendFailureResponse(msg, errMessage);
      });
    }

    //else if (isGatewayCommmand(method)) {
    //  switch(method) {
    //    case 'CONNECT':
    //      return gateway.connect(msg.deviceid)
    //  }
    //}

    else {
      throw new Error(
        'Invalid message received: invalid method \'' + method + '\'');
    }
  }


  /**
   * Handle a closed WebSocket connection (via ws.on('close')).
   *
   * This method cleans up all state associated with the client connection.
   */
  function processClose() {
    debug('websocket closed.');
    self.connected = false;
    self.emit('disconnect');
    for (var reqid in requests) {
      if (requests.hasOwnProperty(reqid)) {
        var deferred = requests[reqid];
        deferred.reject(new Error('Connection was closed.'));
        delete requests[deferred];
      }
    }
  }


  /**
   * Handle an error raised on the WebSocket connection (via ws.on('error')).
   */
  function processError(err) {
    debug('websocket error: ' + err);
  }


  /**
   * Deliver a WebSocket protocol request to the gateway.
   *
   * @param msg
   * @param msg.method
   * @param msg.deviceid
   * @param msg.identifier
   * @param msg.value
   *
   * @returns {Promise|{then, catch, finally}|deferred.promise}
   */
  function sendWebSocketRequest(msg) {
    debug('[' + _reqid+1 + ']: Sending ' + msg.deviceid +'.' + msg.method + ':' +
      msg.identifier + '(' + msg.value + ')' );
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


  function cancelRequest(msg) {
    if (typeof requests[msg.reqid] !== 'undefined') {
      delete requests[msg.reqid];
      // deferred.reject(cancelled) ?
    }
  }


  /**
   * Send a successful response for a request previously received.
   *
   * @param req
   * @param res
   */
  function sendResponse(req, res) {
    var msg = {
      reqid: req.reqid, deviceid: req.deviceid, method: 'RESPONSE',
      success: true, res: res
    };
    ws.send(JSON.stringify(msg));
  }


  /**
   * Send a failure response for a request previously received.
   *
   * @param req
   * @param err
   */
  function sendFailureResponse(req, err) {
    var msg = {
      reqid: req.reqid, deviceid: req.deviceid, method: 'RESPONSE',
      success: false, err: err
    };
    debug('request failed: ' + JSON.stringify(msg));
    ws.send(JSON.stringify(msg));
  }

  /**
   * Dispatch a request to the remote peer.
   *
   * @param {OrganiqRequest} req
   */
  function dispatch(req) {
    var msg = OrganiqToWSRequest(req);
    return sendWebSocketRequest(msg)
      .timeout(REQUEST_TIMEOUT)
      .catch(when_.TimeoutError, function(e) {
        cancelRequest(msg);
        throw e;
      });
  }
}
util.inherits(WebSocketTransport, EventEmitter);


},{"./request.js":11,"debug":15,"events":2,"util":6,"when":40}],14:[function(require,module,exports){
(function (process){
/**
 * Shim for WebSocket inclusion.
 *
 * We normally use 'websockets/ws' for WebSockets support, but this fails in
 * the browser. Apparently. Need to revisit this.
 */
var util = require('util');
var EventEmitter = require('events').EventEmitter;

module.exports = process.browser ? BrowserWebSocketShim
                                 : require('ws');

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
},{"_process":4,"events":2,"util":6,"ws":undefined}],15:[function(require,module,exports){

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
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

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
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
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
    r = exports.storage.debug;
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

},{"./debug":16}],16:[function(require,module,exports){

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

},{"ms":17}],17:[function(require,module,exports){
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
  str = '' + str;
  if (str.length > 10000) return;
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

},{}],18:[function(require,module,exports){
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

},{"./Scheduler":19,"./env":31,"./makePromise":33}],19:[function(require,module,exports){
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

},{}],20:[function(require,module,exports){
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
},{}],21:[function(require,module,exports){
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



},{}],22:[function(require,module,exports){
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

},{"../apply":21,"../state":34}],23:[function(require,module,exports){
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

},{}],24:[function(require,module,exports){
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

},{}],25:[function(require,module,exports){
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

},{"../state":34}],26:[function(require,module,exports){
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

},{}],27:[function(require,module,exports){
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

},{}],28:[function(require,module,exports){
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

},{"../TimeoutError":20,"../env":31}],29:[function(require,module,exports){
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

},{"../env":31,"../format":32}],30:[function(require,module,exports){
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


},{}],31:[function(require,module,exports){
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
		return typeof process !== 'undefined' &&
			Object.prototype.toString.call(process) === '[object process]';
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
},{"_process":4}],32:[function(require,module,exports){
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

},{}],33:[function(require,module,exports){
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
},{"_process":4}],34:[function(require,module,exports){
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

},{}],35:[function(require,module,exports){
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

},{"./monitor/ConsoleReporter":36,"./monitor/PromiseMonitor":37}],36:[function(require,module,exports){
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
				// typeof localConsole.log will return 'object' in IE8, so can't test it with === 'function'
				// Since this is more of a corner case for IE8, I'm ok to check it with !== 'undefined' to reduce complexity
				if (typeof localConsole.log !== 'undefined' && typeof JSON !== 'undefined') {
					log = warn = function(x) {
						if (typeof x !== 'string') {
							try {
								x = JSON.stringify(x);
							} catch (e) {
							}
						}
						localConsole.log(x);
					};
				} else {
					log = warn = consoleNotAvailable;
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

},{"./error":39}],37:[function(require,module,exports){
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

},{"../lib/env":31,"./error":39}],38:[function(require,module,exports){
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

},{"../monitor":35,"../when":40}],39:[function(require,module,exports){
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

},{}],40:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */

/**
 * Promises/A+ and when() implementation
 * when is part of the cujoJS family of libraries (http://cujojs.com/)
 * @author Brian Cavalier
 * @author John Hann
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

},{"./lib/Promise":18,"./lib/TimeoutError":20,"./lib/apply":21,"./lib/decorators/array":22,"./lib/decorators/flow":23,"./lib/decorators/fold":24,"./lib/decorators/inspect":25,"./lib/decorators/iterate":26,"./lib/decorators/progress":27,"./lib/decorators/timed":28,"./lib/decorators/unhandledRejection":29,"./lib/decorators/with":30}],"organiq":[function(require,module,exports){
(function (process){
/**
 * Organiq Application and Device SDK.
 *
 * Provides interfaces for obtaining proxies for remote Organiq objects, and
 * implements a local device container for hosting devices.
 *
 */
var DeviceContainer = require('./deviceContainer');
var ClientContainer = require('./clientContainer');
var WebSocket = require('./websocket');
var WebSocketTransport = require('./webSocketTransport');
//var when = require('when');
var fs = require('fs');
require('when/monitor/console');
var debug = require('debug')('sdk');

var Proxy_ = require('./proxyWrapper');
var Device = require('./deviceWrapper');
var Schema = require('./schema');


module.exports = Organiq;
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
 *  (3) ORGANIQ_APIROOT, ORGANIQ_APITOKEN, and ORGANIQ_NAMESPACE environment
 *    variables
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
function Organiq(options) {
  if (!(this instanceof Organiq)) {
    return new Organiq(options);
  }

  options = options || {};
  var apiRoot = options.apiRoot;
  var apiToken = options.apiToken;
  var namespace = options.namespace;
  var optionsPath = options.optionsPath || DEFAULT_OPTIONS_PATH;
  //var autoConnect = options.autoConnect !== false;  // true if not given false
  var strictSchema = options.strictSchema || false; // false if not given true


  // If we weren't given all configurable parameters, look in organiq.json.
  // Note that the special checks for fs.existsSync are necessary for this code
  // to work in a web browser environment (where it will not be defined).

  if (!apiRoot || !apiToken || !!namespace) {
    if (fs && fs.existsSync !== undefined && fs.existsSync(optionsPath)) {
      var s = fs.readFileSync(optionsPath, 'utf8');
      var config = JSON.parse(s);
      apiToken = apiToken || config['token'];
      apiRoot = apiRoot || config['apiRoot'];
      namespace = namespace || config['namespace'];
    }
  }

  apiRoot = apiRoot || process.env['ORGANIQ_APIROOT'] || DEFAULT_APIROOT;
  apiToken = apiToken || process.env['ORGANIQ_APITOKEN'] || DEFAULT_APITOKEN;
  namespace = namespace || process.env['ORGANIQ_NAMESPACE'] || DEFAULT_NAMESPACE;

  // Create a device container and client node, and connect them to the gateway
  // via the WebSocketTransport.
  var container = new DeviceContainer({defaultDomain: namespace});
  var client = new ClientContainer({defaultDomain: namespace});
  var gateway = new WebSocketTransport(container, client);
  client.attachGateway(gateway, namespace);
  container.attachGateway(gateway, namespace);

  var ws = new WebSocket(apiRoot);
  ws.on('open', gateway.connectionHandler);
  ws.on('error', function (e) {
    debug('Failed to connect container to gateway server: ' + e);
  });


  /**
   * Normalize a user-supplied deviceid.
   *
   * For convenience, the SDK allows user to supply deviceids without being
   * fully qualified. The Organiq core always requires fully-qualified ids.
   *
   * @param deviceid
   * @return {string} A normalized deviceid of the form <domain>:<deviceid>
   */
  function normalizeDeviceId(deviceid) {
    var parts = deviceid.toLowerCase().split(':');
    if (parts.length === 1) {
      parts[1] = parts[0];
      parts[0] = namespace;
    }
    return parts.join(':');
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
  this.registerDevice = function (deviceid, impl, schema) {
    if (strictSchema && !schema) {
      throw new Error('Schema is required when `strictSchema` enabled');
    }
    deviceid = normalizeDeviceId(deviceid);
    var device = new Device(impl, schema, {strictSchema: strictSchema});
    return container.register(deviceid, device);
  };

  /**
   * Get a reference to a remote device.
   *
   * @param deviceid
   * @return {ProxyWrapper|Promise}
   */
  this.getDevice = function(deviceid) {
    var proxy = null;

    deviceid = normalizeDeviceId(deviceid);
    debug('getDevice(deviceid='+deviceid+')');

    return client.connect(deviceid)
      .then(function(proxy_) {
      // Query the device for its schema
      debug('getDevice received native device proxy.');
      proxy = proxy_;
      return proxy.describe('.schema');
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
 * Factory for a singleton Organiq object.
 *
 * It is common for the module client to want to use a single instance of
 * Organiq with default connection settings (or settings configured in the
 * environment or config file). This factory, together with the class functions
 * below, allows the constructor function exported by this module to be used
 * directly in this case, obviating the need for the caller to manually create
 * an instance.
 *
 * // verbose (normal) flow:
 * var organiq = require('organiq');
 * var options = { ... }
 * var app = organiq(options);  // create instance with optional options
 * app.register(...);           // call via instance
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
  return { get: function() { if (!o) { o = new Organiq(); } return o; } };
})();

/**
 * Calls `registerDevice` of singleton object.
 *
 * @return {LocalDeviceProxy|Promise|WebSocketDeviceProxy|*|Connection}
 */
Organiq.registerDevice = function() {
  var s = Singleton.get();
  return s.registerDevice.apply(s, arguments);
};

/**
 * Calls `getDevice` of singleton object.
 *
 * @return {LocalDeviceProxy|Promise|WebSocketDeviceProxy|*|Connection}
 */
Organiq.getDevice = function() {
  var s = Singleton.get();
  return s.getDevice.apply(s, arguments);
};

}).call(this,require('_process'))
},{"./clientContainer":7,"./deviceContainer":8,"./deviceWrapper":9,"./proxyWrapper":10,"./schema":12,"./webSocketTransport":13,"./websocket":14,"_process":4,"debug":15,"fs":1,"when/monitor/console":38}]},{},[])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uXFwuLlxcLi5cXFVzZXJzXFxNeWsgV2lsbGlzXFxBcHBEYXRhXFxSb2FtaW5nXFxucG1cXG5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwiLi5cXC4uXFwuLlxcVXNlcnNcXE15ayBXaWxsaXNcXEFwcERhdGFcXFJvYW1pbmdcXG5wbVxcbm9kZV9tb2R1bGVzXFxicm93c2VyaWZ5XFxsaWJcXF9lbXB0eS5qcyIsIi4uXFwuLlxcLi5cXFVzZXJzXFxNeWsgV2lsbGlzXFxBcHBEYXRhXFxSb2FtaW5nXFxucG1cXG5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxldmVudHNcXGV2ZW50cy5qcyIsIi4uXFwuLlxcLi5cXFVzZXJzXFxNeWsgV2lsbGlzXFxBcHBEYXRhXFxSb2FtaW5nXFxucG1cXG5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxpbmhlcml0c1xcaW5oZXJpdHNfYnJvd3Nlci5qcyIsIi4uXFwuLlxcLi5cXFVzZXJzXFxNeWsgV2lsbGlzXFxBcHBEYXRhXFxSb2FtaW5nXFxucG1cXG5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxwcm9jZXNzXFxicm93c2VyLmpzIiwiLi5cXC4uXFwuLlxcVXNlcnNcXE15ayBXaWxsaXNcXEFwcERhdGFcXFJvYW1pbmdcXG5wbVxcbm9kZV9tb2R1bGVzXFxicm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXHV0aWxcXHN1cHBvcnRcXGlzQnVmZmVyQnJvd3Nlci5qcyIsIi4uXFwuLlxcLi5cXFVzZXJzXFxNeWsgV2lsbGlzXFxBcHBEYXRhXFxSb2FtaW5nXFxucG1cXG5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFx1dGlsXFx1dGlsLmpzIiwibGliXFxjbGllbnRDb250YWluZXIuanMiLCJsaWJcXGRldmljZUNvbnRhaW5lci5qcyIsImxpYlxcZGV2aWNlV3JhcHBlci5qcyIsImxpYlxccHJveHlXcmFwcGVyLmpzIiwibGliXFxyZXF1ZXN0LmpzIiwibGliXFxzY2hlbWEuanMiLCJsaWJcXHdlYlNvY2tldFRyYW5zcG9ydC5qcyIsImxpYlxcd2Vic29ja2V0LmpzIiwibm9kZV9tb2R1bGVzXFxkZWJ1Z1xcYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlc1xcZGVidWdcXGRlYnVnLmpzIiwibm9kZV9tb2R1bGVzXFxkZWJ1Z1xcbm9kZV9tb2R1bGVzXFxtc1xcaW5kZXguanMiLCJub2RlX21vZHVsZXNcXHdoZW5cXGxpYlxcUHJvbWlzZS5qcyIsIm5vZGVfbW9kdWxlc1xcd2hlblxcbGliXFxTY2hlZHVsZXIuanMiLCJub2RlX21vZHVsZXNcXHdoZW5cXGxpYlxcVGltZW91dEVycm9yLmpzIiwibm9kZV9tb2R1bGVzXFx3aGVuXFxsaWJcXGFwcGx5LmpzIiwibm9kZV9tb2R1bGVzXFx3aGVuXFxsaWJcXGRlY29yYXRvcnNcXGFycmF5LmpzIiwibm9kZV9tb2R1bGVzXFx3aGVuXFxsaWJcXGRlY29yYXRvcnNcXGZsb3cuanMiLCJub2RlX21vZHVsZXNcXHdoZW5cXGxpYlxcZGVjb3JhdG9yc1xcZm9sZC5qcyIsIm5vZGVfbW9kdWxlc1xcd2hlblxcbGliXFxkZWNvcmF0b3JzXFxpbnNwZWN0LmpzIiwibm9kZV9tb2R1bGVzXFx3aGVuXFxsaWJcXGRlY29yYXRvcnNcXGl0ZXJhdGUuanMiLCJub2RlX21vZHVsZXNcXHdoZW5cXGxpYlxcZGVjb3JhdG9yc1xccHJvZ3Jlc3MuanMiLCJub2RlX21vZHVsZXNcXHdoZW5cXGxpYlxcZGVjb3JhdG9yc1xcdGltZWQuanMiLCJub2RlX21vZHVsZXNcXHdoZW5cXGxpYlxcZGVjb3JhdG9yc1xcdW5oYW5kbGVkUmVqZWN0aW9uLmpzIiwibm9kZV9tb2R1bGVzXFx3aGVuXFxsaWJcXGRlY29yYXRvcnNcXHdpdGguanMiLCJub2RlX21vZHVsZXNcXHdoZW5cXGxpYlxcZW52LmpzIiwibm9kZV9tb2R1bGVzXFx3aGVuXFxsaWJcXGZvcm1hdC5qcyIsIm5vZGVfbW9kdWxlc1xcd2hlblxcbGliXFxtYWtlUHJvbWlzZS5qcyIsIm5vZGVfbW9kdWxlc1xcd2hlblxcbGliXFxzdGF0ZS5qcyIsIm5vZGVfbW9kdWxlc1xcd2hlblxcbW9uaXRvci5qcyIsIm5vZGVfbW9kdWxlc1xcd2hlblxcbW9uaXRvclxcQ29uc29sZVJlcG9ydGVyLmpzIiwibm9kZV9tb2R1bGVzXFx3aGVuXFxtb25pdG9yXFxQcm9taXNlTW9uaXRvci5qcyIsIm5vZGVfbW9kdWxlc1xcd2hlblxcbW9uaXRvclxcY29uc29sZS5qcyIsIm5vZGVfbW9kdWxlc1xcd2hlblxcbW9uaXRvclxcZXJyb3IuanMiLCJub2RlX21vZHVsZXNcXHdoZW5cXHdoZW4uanMiLCJsaWJcXGluZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1a0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0VEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2WUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDalNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2o2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcE9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIixudWxsLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgdmFyIG07XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSAwO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKGVtaXR0ZXIuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gMTtcbiAgZWxzZVxuICAgIHJldCA9IGVtaXR0ZXIuX2V2ZW50c1t0eXBlXS5sZW5ndGg7XG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCJpZiAodHlwZW9mIE9iamVjdC5jcmVhdGUgPT09ICdmdW5jdGlvbicpIHtcbiAgLy8gaW1wbGVtZW50YXRpb24gZnJvbSBzdGFuZGFyZCBub2RlLmpzICd1dGlsJyBtb2R1bGVcbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpbmhlcml0cyhjdG9yLCBzdXBlckN0b3IpIHtcbiAgICBjdG9yLnN1cGVyXyA9IHN1cGVyQ3RvclxuICAgIGN0b3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShzdXBlckN0b3IucHJvdG90eXBlLCB7XG4gICAgICBjb25zdHJ1Y3Rvcjoge1xuICAgICAgICB2YWx1ZTogY3RvcixcbiAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgIH1cbiAgICB9KTtcbiAgfTtcbn0gZWxzZSB7XG4gIC8vIG9sZCBzY2hvb2wgc2hpbSBmb3Igb2xkIGJyb3dzZXJzXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaW5oZXJpdHMoY3Rvciwgc3VwZXJDdG9yKSB7XG4gICAgY3Rvci5zdXBlcl8gPSBzdXBlckN0b3JcbiAgICB2YXIgVGVtcEN0b3IgPSBmdW5jdGlvbiAoKSB7fVxuICAgIFRlbXBDdG9yLnByb3RvdHlwZSA9IHN1cGVyQ3Rvci5wcm90b3R5cGVcbiAgICBjdG9yLnByb3RvdHlwZSA9IG5ldyBUZW1wQ3RvcigpXG4gICAgY3Rvci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBjdG9yXG4gIH1cbn1cbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbnByb2Nlc3MubmV4dFRpY2sgPSAoZnVuY3Rpb24gKCkge1xuICAgIHZhciBjYW5TZXRJbW1lZGlhdGUgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5zZXRJbW1lZGlhdGU7XG4gICAgdmFyIGNhbk11dGF0aW9uT2JzZXJ2ZXIgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5NdXRhdGlvbk9ic2VydmVyO1xuICAgIHZhciBjYW5Qb3N0ID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICAmJiB3aW5kb3cucG9zdE1lc3NhZ2UgJiYgd2luZG93LmFkZEV2ZW50TGlzdGVuZXJcbiAgICA7XG5cbiAgICBpZiAoY2FuU2V0SW1tZWRpYXRlKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoZikgeyByZXR1cm4gd2luZG93LnNldEltbWVkaWF0ZShmKSB9O1xuICAgIH1cblxuICAgIHZhciBxdWV1ZSA9IFtdO1xuXG4gICAgaWYgKGNhbk11dGF0aW9uT2JzZXJ2ZXIpIHtcbiAgICAgICAgdmFyIGhpZGRlbkRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgICAgIHZhciBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBxdWV1ZUxpc3QgPSBxdWV1ZS5zbGljZSgpO1xuICAgICAgICAgICAgcXVldWUubGVuZ3RoID0gMDtcbiAgICAgICAgICAgIHF1ZXVlTGlzdC5mb3JFYWNoKGZ1bmN0aW9uIChmbikge1xuICAgICAgICAgICAgICAgIGZuKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgb2JzZXJ2ZXIub2JzZXJ2ZShoaWRkZW5EaXYsIHsgYXR0cmlidXRlczogdHJ1ZSB9KTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgICAgICAgICAgIGlmICghcXVldWUubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgaGlkZGVuRGl2LnNldEF0dHJpYnV0ZSgneWVzJywgJ25vJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBxdWV1ZS5wdXNoKGZuKTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAoY2FuUG9zdCkge1xuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIChldikge1xuICAgICAgICAgICAgdmFyIHNvdXJjZSA9IGV2LnNvdXJjZTtcbiAgICAgICAgICAgIGlmICgoc291cmNlID09PSB3aW5kb3cgfHwgc291cmNlID09PSBudWxsKSAmJiBldi5kYXRhID09PSAncHJvY2Vzcy10aWNrJykge1xuICAgICAgICAgICAgICAgIGV2LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgIGlmIChxdWV1ZS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBmbiA9IHF1ZXVlLnNoaWZ0KCk7XG4gICAgICAgICAgICAgICAgICAgIGZuKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LCB0cnVlKTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgICAgICAgICAgIHF1ZXVlLnB1c2goZm4pO1xuICAgICAgICAgICAgd2luZG93LnBvc3RNZXNzYWdlKCdwcm9jZXNzLXRpY2snLCAnKicpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jdGlvbiBuZXh0VGljayhmbikge1xuICAgICAgICBzZXRUaW1lb3V0KGZuLCAwKTtcbiAgICB9O1xufSkoKTtcblxucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG4vLyBUT0RPKHNodHlsbWFuKVxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGlzQnVmZmVyKGFyZykge1xuICByZXR1cm4gYXJnICYmIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnXG4gICAgJiYgdHlwZW9mIGFyZy5jb3B5ID09PSAnZnVuY3Rpb24nXG4gICAgJiYgdHlwZW9mIGFyZy5maWxsID09PSAnZnVuY3Rpb24nXG4gICAgJiYgdHlwZW9mIGFyZy5yZWFkVUludDggPT09ICdmdW5jdGlvbic7XG59IiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCl7XG4vLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxudmFyIGZvcm1hdFJlZ0V4cCA9IC8lW3NkaiVdL2c7XG5leHBvcnRzLmZvcm1hdCA9IGZ1bmN0aW9uKGYpIHtcbiAgaWYgKCFpc1N0cmluZyhmKSkge1xuICAgIHZhciBvYmplY3RzID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIG9iamVjdHMucHVzaChpbnNwZWN0KGFyZ3VtZW50c1tpXSkpO1xuICAgIH1cbiAgICByZXR1cm4gb2JqZWN0cy5qb2luKCcgJyk7XG4gIH1cblxuICB2YXIgaSA9IDE7XG4gIHZhciBhcmdzID0gYXJndW1lbnRzO1xuICB2YXIgbGVuID0gYXJncy5sZW5ndGg7XG4gIHZhciBzdHIgPSBTdHJpbmcoZikucmVwbGFjZShmb3JtYXRSZWdFeHAsIGZ1bmN0aW9uKHgpIHtcbiAgICBpZiAoeCA9PT0gJyUlJykgcmV0dXJuICclJztcbiAgICBpZiAoaSA+PSBsZW4pIHJldHVybiB4O1xuICAgIHN3aXRjaCAoeCkge1xuICAgICAgY2FzZSAnJXMnOiByZXR1cm4gU3RyaW5nKGFyZ3NbaSsrXSk7XG4gICAgICBjYXNlICclZCc6IHJldHVybiBOdW1iZXIoYXJnc1tpKytdKTtcbiAgICAgIGNhc2UgJyVqJzpcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoYXJnc1tpKytdKTtcbiAgICAgICAgfSBjYXRjaCAoXykge1xuICAgICAgICAgIHJldHVybiAnW0NpcmN1bGFyXSc7XG4gICAgICAgIH1cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiB4O1xuICAgIH1cbiAgfSk7XG4gIGZvciAodmFyIHggPSBhcmdzW2ldOyBpIDwgbGVuOyB4ID0gYXJnc1srK2ldKSB7XG4gICAgaWYgKGlzTnVsbCh4KSB8fCAhaXNPYmplY3QoeCkpIHtcbiAgICAgIHN0ciArPSAnICcgKyB4O1xuICAgIH0gZWxzZSB7XG4gICAgICBzdHIgKz0gJyAnICsgaW5zcGVjdCh4KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHN0cjtcbn07XG5cblxuLy8gTWFyayB0aGF0IGEgbWV0aG9kIHNob3VsZCBub3QgYmUgdXNlZC5cbi8vIFJldHVybnMgYSBtb2RpZmllZCBmdW5jdGlvbiB3aGljaCB3YXJucyBvbmNlIGJ5IGRlZmF1bHQuXG4vLyBJZiAtLW5vLWRlcHJlY2F0aW9uIGlzIHNldCwgdGhlbiBpdCBpcyBhIG5vLW9wLlxuZXhwb3J0cy5kZXByZWNhdGUgPSBmdW5jdGlvbihmbiwgbXNnKSB7XG4gIC8vIEFsbG93IGZvciBkZXByZWNhdGluZyB0aGluZ3MgaW4gdGhlIHByb2Nlc3Mgb2Ygc3RhcnRpbmcgdXAuXG4gIGlmIChpc1VuZGVmaW5lZChnbG9iYWwucHJvY2VzcykpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gZXhwb3J0cy5kZXByZWNhdGUoZm4sIG1zZykuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9O1xuICB9XG5cbiAgaWYgKHByb2Nlc3Mubm9EZXByZWNhdGlvbiA9PT0gdHJ1ZSkge1xuICAgIHJldHVybiBmbjtcbiAgfVxuXG4gIHZhciB3YXJuZWQgPSBmYWxzZTtcbiAgZnVuY3Rpb24gZGVwcmVjYXRlZCgpIHtcbiAgICBpZiAoIXdhcm5lZCkge1xuICAgICAgaWYgKHByb2Nlc3MudGhyb3dEZXByZWNhdGlvbikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IobXNnKTtcbiAgICAgIH0gZWxzZSBpZiAocHJvY2Vzcy50cmFjZURlcHJlY2F0aW9uKSB7XG4gICAgICAgIGNvbnNvbGUudHJhY2UobXNnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IobXNnKTtcbiAgICAgIH1cbiAgICAgIHdhcm5lZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICB9XG5cbiAgcmV0dXJuIGRlcHJlY2F0ZWQ7XG59O1xuXG5cbnZhciBkZWJ1Z3MgPSB7fTtcbnZhciBkZWJ1Z0Vudmlyb247XG5leHBvcnRzLmRlYnVnbG9nID0gZnVuY3Rpb24oc2V0KSB7XG4gIGlmIChpc1VuZGVmaW5lZChkZWJ1Z0Vudmlyb24pKVxuICAgIGRlYnVnRW52aXJvbiA9IHByb2Nlc3MuZW52Lk5PREVfREVCVUcgfHwgJyc7XG4gIHNldCA9IHNldC50b1VwcGVyQ2FzZSgpO1xuICBpZiAoIWRlYnVnc1tzZXRdKSB7XG4gICAgaWYgKG5ldyBSZWdFeHAoJ1xcXFxiJyArIHNldCArICdcXFxcYicsICdpJykudGVzdChkZWJ1Z0Vudmlyb24pKSB7XG4gICAgICB2YXIgcGlkID0gcHJvY2Vzcy5waWQ7XG4gICAgICBkZWJ1Z3Nbc2V0XSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgbXNnID0gZXhwb3J0cy5mb3JtYXQuYXBwbHkoZXhwb3J0cywgYXJndW1lbnRzKTtcbiAgICAgICAgY29uc29sZS5lcnJvcignJXMgJWQ6ICVzJywgc2V0LCBwaWQsIG1zZyk7XG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBkZWJ1Z3Nbc2V0XSA9IGZ1bmN0aW9uKCkge307XG4gICAgfVxuICB9XG4gIHJldHVybiBkZWJ1Z3Nbc2V0XTtcbn07XG5cblxuLyoqXG4gKiBFY2hvcyB0aGUgdmFsdWUgb2YgYSB2YWx1ZS4gVHJ5cyB0byBwcmludCB0aGUgdmFsdWUgb3V0XG4gKiBpbiB0aGUgYmVzdCB3YXkgcG9zc2libGUgZ2l2ZW4gdGhlIGRpZmZlcmVudCB0eXBlcy5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqIFRoZSBvYmplY3QgdG8gcHJpbnQgb3V0LlxuICogQHBhcmFtIHtPYmplY3R9IG9wdHMgT3B0aW9uYWwgb3B0aW9ucyBvYmplY3QgdGhhdCBhbHRlcnMgdGhlIG91dHB1dC5cbiAqL1xuLyogbGVnYWN5OiBvYmosIHNob3dIaWRkZW4sIGRlcHRoLCBjb2xvcnMqL1xuZnVuY3Rpb24gaW5zcGVjdChvYmosIG9wdHMpIHtcbiAgLy8gZGVmYXVsdCBvcHRpb25zXG4gIHZhciBjdHggPSB7XG4gICAgc2VlbjogW10sXG4gICAgc3R5bGl6ZTogc3R5bGl6ZU5vQ29sb3JcbiAgfTtcbiAgLy8gbGVnYWN5Li4uXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID49IDMpIGN0eC5kZXB0aCA9IGFyZ3VtZW50c1syXTtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPj0gNCkgY3R4LmNvbG9ycyA9IGFyZ3VtZW50c1szXTtcbiAgaWYgKGlzQm9vbGVhbihvcHRzKSkge1xuICAgIC8vIGxlZ2FjeS4uLlxuICAgIGN0eC5zaG93SGlkZGVuID0gb3B0cztcbiAgfSBlbHNlIGlmIChvcHRzKSB7XG4gICAgLy8gZ290IGFuIFwib3B0aW9uc1wiIG9iamVjdFxuICAgIGV4cG9ydHMuX2V4dGVuZChjdHgsIG9wdHMpO1xuICB9XG4gIC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcbiAgaWYgKGlzVW5kZWZpbmVkKGN0eC5zaG93SGlkZGVuKSkgY3R4LnNob3dIaWRkZW4gPSBmYWxzZTtcbiAgaWYgKGlzVW5kZWZpbmVkKGN0eC5kZXB0aCkpIGN0eC5kZXB0aCA9IDI7XG4gIGlmIChpc1VuZGVmaW5lZChjdHguY29sb3JzKSkgY3R4LmNvbG9ycyA9IGZhbHNlO1xuICBpZiAoaXNVbmRlZmluZWQoY3R4LmN1c3RvbUluc3BlY3QpKSBjdHguY3VzdG9tSW5zcGVjdCA9IHRydWU7XG4gIGlmIChjdHguY29sb3JzKSBjdHguc3R5bGl6ZSA9IHN0eWxpemVXaXRoQ29sb3I7XG4gIHJldHVybiBmb3JtYXRWYWx1ZShjdHgsIG9iaiwgY3R4LmRlcHRoKTtcbn1cbmV4cG9ydHMuaW5zcGVjdCA9IGluc3BlY3Q7XG5cblxuLy8gaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9BTlNJX2VzY2FwZV9jb2RlI2dyYXBoaWNzXG5pbnNwZWN0LmNvbG9ycyA9IHtcbiAgJ2JvbGQnIDogWzEsIDIyXSxcbiAgJ2l0YWxpYycgOiBbMywgMjNdLFxuICAndW5kZXJsaW5lJyA6IFs0LCAyNF0sXG4gICdpbnZlcnNlJyA6IFs3LCAyN10sXG4gICd3aGl0ZScgOiBbMzcsIDM5XSxcbiAgJ2dyZXknIDogWzkwLCAzOV0sXG4gICdibGFjaycgOiBbMzAsIDM5XSxcbiAgJ2JsdWUnIDogWzM0LCAzOV0sXG4gICdjeWFuJyA6IFszNiwgMzldLFxuICAnZ3JlZW4nIDogWzMyLCAzOV0sXG4gICdtYWdlbnRhJyA6IFszNSwgMzldLFxuICAncmVkJyA6IFszMSwgMzldLFxuICAneWVsbG93JyA6IFszMywgMzldXG59O1xuXG4vLyBEb24ndCB1c2UgJ2JsdWUnIG5vdCB2aXNpYmxlIG9uIGNtZC5leGVcbmluc3BlY3Quc3R5bGVzID0ge1xuICAnc3BlY2lhbCc6ICdjeWFuJyxcbiAgJ251bWJlcic6ICd5ZWxsb3cnLFxuICAnYm9vbGVhbic6ICd5ZWxsb3cnLFxuICAndW5kZWZpbmVkJzogJ2dyZXknLFxuICAnbnVsbCc6ICdib2xkJyxcbiAgJ3N0cmluZyc6ICdncmVlbicsXG4gICdkYXRlJzogJ21hZ2VudGEnLFxuICAvLyBcIm5hbWVcIjogaW50ZW50aW9uYWxseSBub3Qgc3R5bGluZ1xuICAncmVnZXhwJzogJ3JlZCdcbn07XG5cblxuZnVuY3Rpb24gc3R5bGl6ZVdpdGhDb2xvcihzdHIsIHN0eWxlVHlwZSkge1xuICB2YXIgc3R5bGUgPSBpbnNwZWN0LnN0eWxlc1tzdHlsZVR5cGVdO1xuXG4gIGlmIChzdHlsZSkge1xuICAgIHJldHVybiAnXFx1MDAxYlsnICsgaW5zcGVjdC5jb2xvcnNbc3R5bGVdWzBdICsgJ20nICsgc3RyICtcbiAgICAgICAgICAgJ1xcdTAwMWJbJyArIGluc3BlY3QuY29sb3JzW3N0eWxlXVsxXSArICdtJztcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gc3RyO1xuICB9XG59XG5cblxuZnVuY3Rpb24gc3R5bGl6ZU5vQ29sb3Ioc3RyLCBzdHlsZVR5cGUpIHtcbiAgcmV0dXJuIHN0cjtcbn1cblxuXG5mdW5jdGlvbiBhcnJheVRvSGFzaChhcnJheSkge1xuICB2YXIgaGFzaCA9IHt9O1xuXG4gIGFycmF5LmZvckVhY2goZnVuY3Rpb24odmFsLCBpZHgpIHtcbiAgICBoYXNoW3ZhbF0gPSB0cnVlO1xuICB9KTtcblxuICByZXR1cm4gaGFzaDtcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRWYWx1ZShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMpIHtcbiAgLy8gUHJvdmlkZSBhIGhvb2sgZm9yIHVzZXItc3BlY2lmaWVkIGluc3BlY3QgZnVuY3Rpb25zLlxuICAvLyBDaGVjayB0aGF0IHZhbHVlIGlzIGFuIG9iamVjdCB3aXRoIGFuIGluc3BlY3QgZnVuY3Rpb24gb24gaXRcbiAgaWYgKGN0eC5jdXN0b21JbnNwZWN0ICYmXG4gICAgICB2YWx1ZSAmJlxuICAgICAgaXNGdW5jdGlvbih2YWx1ZS5pbnNwZWN0KSAmJlxuICAgICAgLy8gRmlsdGVyIG91dCB0aGUgdXRpbCBtb2R1bGUsIGl0J3MgaW5zcGVjdCBmdW5jdGlvbiBpcyBzcGVjaWFsXG4gICAgICB2YWx1ZS5pbnNwZWN0ICE9PSBleHBvcnRzLmluc3BlY3QgJiZcbiAgICAgIC8vIEFsc28gZmlsdGVyIG91dCBhbnkgcHJvdG90eXBlIG9iamVjdHMgdXNpbmcgdGhlIGNpcmN1bGFyIGNoZWNrLlxuICAgICAgISh2YWx1ZS5jb25zdHJ1Y3RvciAmJiB2YWx1ZS5jb25zdHJ1Y3Rvci5wcm90b3R5cGUgPT09IHZhbHVlKSkge1xuICAgIHZhciByZXQgPSB2YWx1ZS5pbnNwZWN0KHJlY3Vyc2VUaW1lcywgY3R4KTtcbiAgICBpZiAoIWlzU3RyaW5nKHJldCkpIHtcbiAgICAgIHJldCA9IGZvcm1hdFZhbHVlKGN0eCwgcmV0LCByZWN1cnNlVGltZXMpO1xuICAgIH1cbiAgICByZXR1cm4gcmV0O1xuICB9XG5cbiAgLy8gUHJpbWl0aXZlIHR5cGVzIGNhbm5vdCBoYXZlIHByb3BlcnRpZXNcbiAgdmFyIHByaW1pdGl2ZSA9IGZvcm1hdFByaW1pdGl2ZShjdHgsIHZhbHVlKTtcbiAgaWYgKHByaW1pdGl2ZSkge1xuICAgIHJldHVybiBwcmltaXRpdmU7XG4gIH1cblxuICAvLyBMb29rIHVwIHRoZSBrZXlzIG9mIHRoZSBvYmplY3QuXG4gIHZhciBrZXlzID0gT2JqZWN0LmtleXModmFsdWUpO1xuICB2YXIgdmlzaWJsZUtleXMgPSBhcnJheVRvSGFzaChrZXlzKTtcblxuICBpZiAoY3R4LnNob3dIaWRkZW4pIHtcbiAgICBrZXlzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModmFsdWUpO1xuICB9XG5cbiAgLy8gSUUgZG9lc24ndCBtYWtlIGVycm9yIGZpZWxkcyBub24tZW51bWVyYWJsZVxuICAvLyBodHRwOi8vbXNkbi5taWNyb3NvZnQuY29tL2VuLXVzL2xpYnJhcnkvaWUvZHd3NTJzYnQodj12cy45NCkuYXNweFxuICBpZiAoaXNFcnJvcih2YWx1ZSlcbiAgICAgICYmIChrZXlzLmluZGV4T2YoJ21lc3NhZ2UnKSA+PSAwIHx8IGtleXMuaW5kZXhPZignZGVzY3JpcHRpb24nKSA+PSAwKSkge1xuICAgIHJldHVybiBmb3JtYXRFcnJvcih2YWx1ZSk7XG4gIH1cblxuICAvLyBTb21lIHR5cGUgb2Ygb2JqZWN0IHdpdGhvdXQgcHJvcGVydGllcyBjYW4gYmUgc2hvcnRjdXR0ZWQuXG4gIGlmIChrZXlzLmxlbmd0aCA9PT0gMCkge1xuICAgIGlmIChpc0Z1bmN0aW9uKHZhbHVlKSkge1xuICAgICAgdmFyIG5hbWUgPSB2YWx1ZS5uYW1lID8gJzogJyArIHZhbHVlLm5hbWUgOiAnJztcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZSgnW0Z1bmN0aW9uJyArIG5hbWUgKyAnXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICAgIGlmIChpc1JlZ0V4cCh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZShSZWdFeHAucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpLCAncmVnZXhwJyk7XG4gICAgfVxuICAgIGlmIChpc0RhdGUodmFsdWUpKSB7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoRGF0ZS5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSksICdkYXRlJyk7XG4gICAgfVxuICAgIGlmIChpc0Vycm9yKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGZvcm1hdEVycm9yKHZhbHVlKTtcbiAgICB9XG4gIH1cblxuICB2YXIgYmFzZSA9ICcnLCBhcnJheSA9IGZhbHNlLCBicmFjZXMgPSBbJ3snLCAnfSddO1xuXG4gIC8vIE1ha2UgQXJyYXkgc2F5IHRoYXQgdGhleSBhcmUgQXJyYXlcbiAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgYXJyYXkgPSB0cnVlO1xuICAgIGJyYWNlcyA9IFsnWycsICddJ107XG4gIH1cblxuICAvLyBNYWtlIGZ1bmN0aW9ucyBzYXkgdGhhdCB0aGV5IGFyZSBmdW5jdGlvbnNcbiAgaWYgKGlzRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgdmFyIG4gPSB2YWx1ZS5uYW1lID8gJzogJyArIHZhbHVlLm5hbWUgOiAnJztcbiAgICBiYXNlID0gJyBbRnVuY3Rpb24nICsgbiArICddJztcbiAgfVxuXG4gIC8vIE1ha2UgUmVnRXhwcyBzYXkgdGhhdCB0aGV5IGFyZSBSZWdFeHBzXG4gIGlmIChpc1JlZ0V4cCh2YWx1ZSkpIHtcbiAgICBiYXNlID0gJyAnICsgUmVnRXhwLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKTtcbiAgfVxuXG4gIC8vIE1ha2UgZGF0ZXMgd2l0aCBwcm9wZXJ0aWVzIGZpcnN0IHNheSB0aGUgZGF0ZVxuICBpZiAoaXNEYXRlKHZhbHVlKSkge1xuICAgIGJhc2UgPSAnICcgKyBEYXRlLnByb3RvdHlwZS50b1VUQ1N0cmluZy5jYWxsKHZhbHVlKTtcbiAgfVxuXG4gIC8vIE1ha2UgZXJyb3Igd2l0aCBtZXNzYWdlIGZpcnN0IHNheSB0aGUgZXJyb3JcbiAgaWYgKGlzRXJyb3IodmFsdWUpKSB7XG4gICAgYmFzZSA9ICcgJyArIGZvcm1hdEVycm9yKHZhbHVlKTtcbiAgfVxuXG4gIGlmIChrZXlzLmxlbmd0aCA9PT0gMCAmJiAoIWFycmF5IHx8IHZhbHVlLmxlbmd0aCA9PSAwKSkge1xuICAgIHJldHVybiBicmFjZXNbMF0gKyBiYXNlICsgYnJhY2VzWzFdO1xuICB9XG5cbiAgaWYgKHJlY3Vyc2VUaW1lcyA8IDApIHtcbiAgICBpZiAoaXNSZWdFeHAodmFsdWUpKSB7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoUmVnRXhwLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSwgJ3JlZ2V4cCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoJ1tPYmplY3RdJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gIH1cblxuICBjdHguc2Vlbi5wdXNoKHZhbHVlKTtcblxuICB2YXIgb3V0cHV0O1xuICBpZiAoYXJyYXkpIHtcbiAgICBvdXRwdXQgPSBmb3JtYXRBcnJheShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLCBrZXlzKTtcbiAgfSBlbHNlIHtcbiAgICBvdXRwdXQgPSBrZXlzLm1hcChmdW5jdGlvbihrZXkpIHtcbiAgICAgIHJldHVybiBmb3JtYXRQcm9wZXJ0eShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLCBrZXksIGFycmF5KTtcbiAgICB9KTtcbiAgfVxuXG4gIGN0eC5zZWVuLnBvcCgpO1xuXG4gIHJldHVybiByZWR1Y2VUb1NpbmdsZVN0cmluZyhvdXRwdXQsIGJhc2UsIGJyYWNlcyk7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0UHJpbWl0aXZlKGN0eCwgdmFsdWUpIHtcbiAgaWYgKGlzVW5kZWZpbmVkKHZhbHVlKSlcbiAgICByZXR1cm4gY3R4LnN0eWxpemUoJ3VuZGVmaW5lZCcsICd1bmRlZmluZWQnKTtcbiAgaWYgKGlzU3RyaW5nKHZhbHVlKSkge1xuICAgIHZhciBzaW1wbGUgPSAnXFwnJyArIEpTT04uc3RyaW5naWZ5KHZhbHVlKS5yZXBsYWNlKC9eXCJ8XCIkL2csICcnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoLycvZywgXCJcXFxcJ1wiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoL1xcXFxcIi9nLCAnXCInKSArICdcXCcnO1xuICAgIHJldHVybiBjdHguc3R5bGl6ZShzaW1wbGUsICdzdHJpbmcnKTtcbiAgfVxuICBpZiAoaXNOdW1iZXIodmFsdWUpKVxuICAgIHJldHVybiBjdHguc3R5bGl6ZSgnJyArIHZhbHVlLCAnbnVtYmVyJyk7XG4gIGlmIChpc0Jvb2xlYW4odmFsdWUpKVxuICAgIHJldHVybiBjdHguc3R5bGl6ZSgnJyArIHZhbHVlLCAnYm9vbGVhbicpO1xuICAvLyBGb3Igc29tZSByZWFzb24gdHlwZW9mIG51bGwgaXMgXCJvYmplY3RcIiwgc28gc3BlY2lhbCBjYXNlIGhlcmUuXG4gIGlmIChpc051bGwodmFsdWUpKVxuICAgIHJldHVybiBjdHguc3R5bGl6ZSgnbnVsbCcsICdudWxsJyk7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0RXJyb3IodmFsdWUpIHtcbiAgcmV0dXJuICdbJyArIEVycm9yLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSArICddJztcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRBcnJheShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLCBrZXlzKSB7XG4gIHZhciBvdXRwdXQgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSB2YWx1ZS5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICBpZiAoaGFzT3duUHJvcGVydHkodmFsdWUsIFN0cmluZyhpKSkpIHtcbiAgICAgIG91dHB1dC5wdXNoKGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsXG4gICAgICAgICAgU3RyaW5nKGkpLCB0cnVlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG91dHB1dC5wdXNoKCcnKTtcbiAgICB9XG4gIH1cbiAga2V5cy5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuICAgIGlmICgha2V5Lm1hdGNoKC9eXFxkKyQvKSkge1xuICAgICAgb3V0cHV0LnB1c2goZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cyxcbiAgICAgICAgICBrZXksIHRydWUpKTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gb3V0cHV0O1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleSwgYXJyYXkpIHtcbiAgdmFyIG5hbWUsIHN0ciwgZGVzYztcbiAgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodmFsdWUsIGtleSkgfHwgeyB2YWx1ZTogdmFsdWVba2V5XSB9O1xuICBpZiAoZGVzYy5nZXQpIHtcbiAgICBpZiAoZGVzYy5zZXQpIHtcbiAgICAgIHN0ciA9IGN0eC5zdHlsaXplKCdbR2V0dGVyL1NldHRlcl0nLCAnc3BlY2lhbCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdHIgPSBjdHguc3R5bGl6ZSgnW0dldHRlcl0nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBpZiAoZGVzYy5zZXQpIHtcbiAgICAgIHN0ciA9IGN0eC5zdHlsaXplKCdbU2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9XG4gIGlmICghaGFzT3duUHJvcGVydHkodmlzaWJsZUtleXMsIGtleSkpIHtcbiAgICBuYW1lID0gJ1snICsga2V5ICsgJ10nO1xuICB9XG4gIGlmICghc3RyKSB7XG4gICAgaWYgKGN0eC5zZWVuLmluZGV4T2YoZGVzYy52YWx1ZSkgPCAwKSB7XG4gICAgICBpZiAoaXNOdWxsKHJlY3Vyc2VUaW1lcykpIHtcbiAgICAgICAgc3RyID0gZm9ybWF0VmFsdWUoY3R4LCBkZXNjLnZhbHVlLCBudWxsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciA9IGZvcm1hdFZhbHVlKGN0eCwgZGVzYy52YWx1ZSwgcmVjdXJzZVRpbWVzIC0gMSk7XG4gICAgICB9XG4gICAgICBpZiAoc3RyLmluZGV4T2YoJ1xcbicpID4gLTEpIHtcbiAgICAgICAgaWYgKGFycmF5KSB7XG4gICAgICAgICAgc3RyID0gc3RyLnNwbGl0KCdcXG4nKS5tYXAoZnVuY3Rpb24obGluZSkge1xuICAgICAgICAgICAgcmV0dXJuICcgICcgKyBsaW5lO1xuICAgICAgICAgIH0pLmpvaW4oJ1xcbicpLnN1YnN0cigyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzdHIgPSAnXFxuJyArIHN0ci5zcGxpdCgnXFxuJykubWFwKGZ1bmN0aW9uKGxpbmUpIHtcbiAgICAgICAgICAgIHJldHVybiAnICAgJyArIGxpbmU7XG4gICAgICAgICAgfSkuam9pbignXFxuJyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tDaXJjdWxhcl0nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgfVxuICBpZiAoaXNVbmRlZmluZWQobmFtZSkpIHtcbiAgICBpZiAoYXJyYXkgJiYga2V5Lm1hdGNoKC9eXFxkKyQvKSkge1xuICAgICAgcmV0dXJuIHN0cjtcbiAgICB9XG4gICAgbmFtZSA9IEpTT04uc3RyaW5naWZ5KCcnICsga2V5KTtcbiAgICBpZiAobmFtZS5tYXRjaCgvXlwiKFthLXpBLVpfXVthLXpBLVpfMC05XSopXCIkLykpIHtcbiAgICAgIG5hbWUgPSBuYW1lLnN1YnN0cigxLCBuYW1lLmxlbmd0aCAtIDIpO1xuICAgICAgbmFtZSA9IGN0eC5zdHlsaXplKG5hbWUsICduYW1lJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5hbWUgPSBuYW1lLnJlcGxhY2UoLycvZywgXCJcXFxcJ1wiKVxuICAgICAgICAgICAgICAgICAucmVwbGFjZSgvXFxcXFwiL2csICdcIicpXG4gICAgICAgICAgICAgICAgIC5yZXBsYWNlKC8oXlwifFwiJCkvZywgXCInXCIpO1xuICAgICAgbmFtZSA9IGN0eC5zdHlsaXplKG5hbWUsICdzdHJpbmcnKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbmFtZSArICc6ICcgKyBzdHI7XG59XG5cblxuZnVuY3Rpb24gcmVkdWNlVG9TaW5nbGVTdHJpbmcob3V0cHV0LCBiYXNlLCBicmFjZXMpIHtcbiAgdmFyIG51bUxpbmVzRXN0ID0gMDtcbiAgdmFyIGxlbmd0aCA9IG91dHB1dC5yZWR1Y2UoZnVuY3Rpb24ocHJldiwgY3VyKSB7XG4gICAgbnVtTGluZXNFc3QrKztcbiAgICBpZiAoY3VyLmluZGV4T2YoJ1xcbicpID49IDApIG51bUxpbmVzRXN0Kys7XG4gICAgcmV0dXJuIHByZXYgKyBjdXIucmVwbGFjZSgvXFx1MDAxYlxcW1xcZFxcZD9tL2csICcnKS5sZW5ndGggKyAxO1xuICB9LCAwKTtcblxuICBpZiAobGVuZ3RoID4gNjApIHtcbiAgICByZXR1cm4gYnJhY2VzWzBdICtcbiAgICAgICAgICAgKGJhc2UgPT09ICcnID8gJycgOiBiYXNlICsgJ1xcbiAnKSArXG4gICAgICAgICAgICcgJyArXG4gICAgICAgICAgIG91dHB1dC5qb2luKCcsXFxuICAnKSArXG4gICAgICAgICAgICcgJyArXG4gICAgICAgICAgIGJyYWNlc1sxXTtcbiAgfVxuXG4gIHJldHVybiBicmFjZXNbMF0gKyBiYXNlICsgJyAnICsgb3V0cHV0LmpvaW4oJywgJykgKyAnICcgKyBicmFjZXNbMV07XG59XG5cblxuLy8gTk9URTogVGhlc2UgdHlwZSBjaGVja2luZyBmdW5jdGlvbnMgaW50ZW50aW9uYWxseSBkb24ndCB1c2UgYGluc3RhbmNlb2ZgXG4vLyBiZWNhdXNlIGl0IGlzIGZyYWdpbGUgYW5kIGNhbiBiZSBlYXNpbHkgZmFrZWQgd2l0aCBgT2JqZWN0LmNyZWF0ZSgpYC5cbmZ1bmN0aW9uIGlzQXJyYXkoYXIpIHtcbiAgcmV0dXJuIEFycmF5LmlzQXJyYXkoYXIpO1xufVxuZXhwb3J0cy5pc0FycmF5ID0gaXNBcnJheTtcblxuZnVuY3Rpb24gaXNCb29sZWFuKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Jvb2xlYW4nO1xufVxuZXhwb3J0cy5pc0Jvb2xlYW4gPSBpc0Jvb2xlYW47XG5cbmZ1bmN0aW9uIGlzTnVsbChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gbnVsbDtcbn1cbmV4cG9ydHMuaXNOdWxsID0gaXNOdWxsO1xuXG5mdW5jdGlvbiBpc051bGxPclVuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PSBudWxsO1xufVxuZXhwb3J0cy5pc051bGxPclVuZGVmaW5lZCA9IGlzTnVsbE9yVW5kZWZpbmVkO1xuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuZXhwb3J0cy5pc051bWJlciA9IGlzTnVtYmVyO1xuXG5mdW5jdGlvbiBpc1N0cmluZyhhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnO1xufVxuZXhwb3J0cy5pc1N0cmluZyA9IGlzU3RyaW5nO1xuXG5mdW5jdGlvbiBpc1N5bWJvbChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdzeW1ib2wnO1xufVxuZXhwb3J0cy5pc1N5bWJvbCA9IGlzU3ltYm9sO1xuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuZXhwb3J0cy5pc1VuZGVmaW5lZCA9IGlzVW5kZWZpbmVkO1xuXG5mdW5jdGlvbiBpc1JlZ0V4cChyZSkge1xuICByZXR1cm4gaXNPYmplY3QocmUpICYmIG9iamVjdFRvU3RyaW5nKHJlKSA9PT0gJ1tvYmplY3QgUmVnRXhwXSc7XG59XG5leHBvcnRzLmlzUmVnRXhwID0gaXNSZWdFeHA7XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuZXhwb3J0cy5pc09iamVjdCA9IGlzT2JqZWN0O1xuXG5mdW5jdGlvbiBpc0RhdGUoZCkge1xuICByZXR1cm4gaXNPYmplY3QoZCkgJiYgb2JqZWN0VG9TdHJpbmcoZCkgPT09ICdbb2JqZWN0IERhdGVdJztcbn1cbmV4cG9ydHMuaXNEYXRlID0gaXNEYXRlO1xuXG5mdW5jdGlvbiBpc0Vycm9yKGUpIHtcbiAgcmV0dXJuIGlzT2JqZWN0KGUpICYmXG4gICAgICAob2JqZWN0VG9TdHJpbmcoZSkgPT09ICdbb2JqZWN0IEVycm9yXScgfHwgZSBpbnN0YW5jZW9mIEVycm9yKTtcbn1cbmV4cG9ydHMuaXNFcnJvciA9IGlzRXJyb3I7XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuZXhwb3J0cy5pc0Z1bmN0aW9uID0gaXNGdW5jdGlvbjtcblxuZnVuY3Rpb24gaXNQcmltaXRpdmUoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IG51bGwgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdib29sZWFuJyB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ251bWJlcicgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnc3ltYm9sJyB8fCAgLy8gRVM2IHN5bWJvbFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ3VuZGVmaW5lZCc7XG59XG5leHBvcnRzLmlzUHJpbWl0aXZlID0gaXNQcmltaXRpdmU7XG5cbmV4cG9ydHMuaXNCdWZmZXIgPSByZXF1aXJlKCcuL3N1cHBvcnQvaXNCdWZmZXInKTtcblxuZnVuY3Rpb24gb2JqZWN0VG9TdHJpbmcobykge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG8pO1xufVxuXG5cbmZ1bmN0aW9uIHBhZChuKSB7XG4gIHJldHVybiBuIDwgMTAgPyAnMCcgKyBuLnRvU3RyaW5nKDEwKSA6IG4udG9TdHJpbmcoMTApO1xufVxuXG5cbnZhciBtb250aHMgPSBbJ0phbicsICdGZWInLCAnTWFyJywgJ0FwcicsICdNYXknLCAnSnVuJywgJ0p1bCcsICdBdWcnLCAnU2VwJyxcbiAgICAgICAgICAgICAgJ09jdCcsICdOb3YnLCAnRGVjJ107XG5cbi8vIDI2IEZlYiAxNjoxOTozNFxuZnVuY3Rpb24gdGltZXN0YW1wKCkge1xuICB2YXIgZCA9IG5ldyBEYXRlKCk7XG4gIHZhciB0aW1lID0gW3BhZChkLmdldEhvdXJzKCkpLFxuICAgICAgICAgICAgICBwYWQoZC5nZXRNaW51dGVzKCkpLFxuICAgICAgICAgICAgICBwYWQoZC5nZXRTZWNvbmRzKCkpXS5qb2luKCc6Jyk7XG4gIHJldHVybiBbZC5nZXREYXRlKCksIG1vbnRoc1tkLmdldE1vbnRoKCldLCB0aW1lXS5qb2luKCcgJyk7XG59XG5cblxuLy8gbG9nIGlzIGp1c3QgYSB0aGluIHdyYXBwZXIgdG8gY29uc29sZS5sb2cgdGhhdCBwcmVwZW5kcyBhIHRpbWVzdGFtcFxuZXhwb3J0cy5sb2cgPSBmdW5jdGlvbigpIHtcbiAgY29uc29sZS5sb2coJyVzIC0gJXMnLCB0aW1lc3RhbXAoKSwgZXhwb3J0cy5mb3JtYXQuYXBwbHkoZXhwb3J0cywgYXJndW1lbnRzKSk7XG59O1xuXG5cbi8qKlxuICogSW5oZXJpdCB0aGUgcHJvdG90eXBlIG1ldGhvZHMgZnJvbSBvbmUgY29uc3RydWN0b3IgaW50byBhbm90aGVyLlxuICpcbiAqIFRoZSBGdW5jdGlvbi5wcm90b3R5cGUuaW5oZXJpdHMgZnJvbSBsYW5nLmpzIHJld3JpdHRlbiBhcyBhIHN0YW5kYWxvbmVcbiAqIGZ1bmN0aW9uIChub3Qgb24gRnVuY3Rpb24ucHJvdG90eXBlKS4gTk9URTogSWYgdGhpcyBmaWxlIGlzIHRvIGJlIGxvYWRlZFxuICogZHVyaW5nIGJvb3RzdHJhcHBpbmcgdGhpcyBmdW5jdGlvbiBuZWVkcyB0byBiZSByZXdyaXR0ZW4gdXNpbmcgc29tZSBuYXRpdmVcbiAqIGZ1bmN0aW9ucyBhcyBwcm90b3R5cGUgc2V0dXAgdXNpbmcgbm9ybWFsIEphdmFTY3JpcHQgZG9lcyBub3Qgd29yayBhc1xuICogZXhwZWN0ZWQgZHVyaW5nIGJvb3RzdHJhcHBpbmcgKHNlZSBtaXJyb3IuanMgaW4gcjExNDkwMykuXG4gKlxuICogQHBhcmFtIHtmdW5jdGlvbn0gY3RvciBDb25zdHJ1Y3RvciBmdW5jdGlvbiB3aGljaCBuZWVkcyB0byBpbmhlcml0IHRoZVxuICogICAgIHByb3RvdHlwZS5cbiAqIEBwYXJhbSB7ZnVuY3Rpb259IHN1cGVyQ3RvciBDb25zdHJ1Y3RvciBmdW5jdGlvbiB0byBpbmhlcml0IHByb3RvdHlwZSBmcm9tLlxuICovXG5leHBvcnRzLmluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKTtcblxuZXhwb3J0cy5fZXh0ZW5kID0gZnVuY3Rpb24ob3JpZ2luLCBhZGQpIHtcbiAgLy8gRG9uJ3QgZG8gYW55dGhpbmcgaWYgYWRkIGlzbid0IGFuIG9iamVjdFxuICBpZiAoIWFkZCB8fCAhaXNPYmplY3QoYWRkKSkgcmV0dXJuIG9yaWdpbjtcblxuICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKGFkZCk7XG4gIHZhciBpID0ga2V5cy5sZW5ndGg7XG4gIHdoaWxlIChpLS0pIHtcbiAgICBvcmlnaW5ba2V5c1tpXV0gPSBhZGRba2V5c1tpXV07XG4gIH1cbiAgcmV0dXJuIG9yaWdpbjtcbn07XG5cbmZ1bmN0aW9uIGhhc093blByb3BlcnR5KG9iaiwgcHJvcCkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCk7XG59XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKCdfcHJvY2VzcycpLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIiwiLyoqXHJcbiAqIENsaWVudCBQcm92aWRlci5cclxuICpcclxuICogVGhlIENsaWVudCBwcm92aWRlcyB0aGUgYXBwbGljYXRpb24gU0RLLiBXaGlsZSB0aGlzIGNvbXBvbmVudCBjYW4gc2hhcmUgYVxyXG4gKiBnYXRld2F5IGNvbm5lY3Rpb24gd2l0aCB0aGUgRGV2aWNlIENvbnRhaW5lciwgaXQgaXMgZGlmZmVyZW50IGluIGEgZmV3XHJcbiAqIHdheXM6XHJcbiAqICAtIFJlcXVlc3RzIHNlbnQgdGhyb3VnaCB0aGlzIG1vZHVsZSBuZXZlciB0b3VjaCBhIGxvY2FsIGRldmljZSBzdGFja1xyXG4gKiAgLSBVbmxpa2UgdGhlIGRldmljZSBjb250YWluZXIsIHdoaWNoIGRvZXMgbm90IGF0dGVtcHQgdG8gZm9yY2libHkgcmVjb25uZWN0XHJcbiAqICAgIHRvIGEgZGlzY29ubmVjdGVkIGdhdGV3YXkgZm9yIGV2ZXJ5IG1lc3NhZ2UsIHRoZSBjbGllbnQgd2lsbCBhdHRlbXB0IHRvXHJcbiAqICAgIHJlY29ubmVjdCBicm9rZW4gY29ubmVjdGlvbnMgd2hlbmV2ZXIgcG9zc2libGUuXHJcbiAqXHJcbiAqIFRoZSBpZGVhIGlzIHRoYXQgdGhpcyBtb2R1bGUgdHJpZXMgdG8gYmVoYXZlIGFzIGFuIGFwcGxpY2F0aW9uIHByb2dyYW1tZXJcclxuICogd291bGQgbGlrZSBpdCB0byAoYWx3YXlzIHJldHJ5IG9wZXJhdGlvbnMsIGV0YykuIFRoZSBEZXZpY2UgQ29udGFpbmVyXHJcbiAqIGF0dGVtcHRzIHRvIG1ha2UgdGhlIGVudGlyZSBpbnRlcmZhY2UgYXMgZGVjbGFyYXRpdmUgYXMgcG9zc2libGUsIG5vdFxyXG4gKiB0cm91YmxpbmcgdGhlIHVzZXIgY29kZSB3aXRoIGFueSB0cm91YmxlcyBpdCBlbmNvdW50ZXJzLlxyXG4gKlxyXG4gKiBAdHlwZSB7T3JnYW5pcVJlcXVlc3R8ZXhwb3J0c3xtb2R1bGUuZXhwb3J0c31cclxuICovXHJcblxyXG5cclxudmFyIHdoZW4gPSByZXF1aXJlKCd3aGVuJyk7XHJcbnZhciBkZWJ1ZyA9IHJlcXVpcmUoJ2RlYnVnJykoJ29yZ2FuaXE6Y29yZScpO1xyXG52YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xyXG52YXIgT3JnYW5pcVJlcXVlc3QgPSByZXF1aXJlKCcuL3JlcXVlc3QnKTtcclxudmFyIHV0aWwgPSByZXF1aXJlKCd1dGlsJyk7XHJcbm1vZHVsZS5leHBvcnRzID0gQ2xpZW50O1xyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSBhIENsaWVudCBub2RlLlxyXG4gKlxyXG4gKiBAcGFyYW0ge09iamVjdD19IG9wdGlvbnNcclxuICogQHJldHVybnMge0NsaWVudH1cclxuICogQGNvbnN0cnVjdG9yXHJcbiAqL1xyXG5mdW5jdGlvbiBDbGllbnQob3B0aW9ucykge1xyXG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBDbGllbnQpKSB7XHJcbiAgICByZXR1cm4gbmV3IENsaWVudChvcHRpb25zKTtcclxuICB9XHJcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XHJcblxyXG4gIHRoaXMucHJveGllcyA9IHt9OyAgICAvLyBjb25uZWN0ZWQgcmVtb3RlIGRldmljZSBwcm94aWVzLCBieSBkZXZpY2VpZFxyXG4gIHRoaXMuZ2F0ZXdheSA9IG51bGw7ICAgIC8vIGdhdGV3YXkgd2l0aCB3aGljaCB3ZSBhcmUgYXNzb2NpYXRlZFxyXG4gIHRoaXMubmFtZXNwYWNlID0gbnVsbDsgIC8vIG5hbWVzcGFjZSB1c2VkIG9uIGdhdGV3YXlcclxuICAvL3RoaXMucGVuZGluZ1JlcXVlc3RzID0ge307ICAvLyByZXF1ZXN0cyBzZW50IHdoaWxlIGRpc2Nvbm5lY3RlZFxyXG59XHJcbnV0aWwuaW5oZXJpdHMoQ2xpZW50LCBFdmVudEVtaXR0ZXIpO1xyXG5cclxuLyoqXHJcbiAqIEdldCBhIHByb3h5IGZvciBhIGRldmljZS5cclxuICpcclxuICogQHBhcmFtIHtzdHJpbmd9IGRldmljZWlkIFNwZWNpZmllcyB0aGUgZGV2aWNlIHRvIHdoaWNoIHRvIGNvbm5lY3QuXHJcbiAqIEByZXR1cm4ge1JlbW90ZURldmljZVByb3h5fSBkZXZpY2UgcHJveHlcclxuICovXHJcbkNsaWVudC5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKGRldmljZWlkKSB7XHJcbiAgdmFyIHByb3hpZXMgPSB0aGlzLnByb3hpZXM7XHJcbiAgaWYgKHR5cGVvZiBwcm94aWVzW2RldmljZWlkXSAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgIHJldHVybiB3aGVuKHByb3hpZXNbZGV2aWNlaWRdKTsgIC8vIEJVR0JVRywgcmVmIGNvdW50P1xyXG4gIH1cclxuXHJcbiAgdmFyIGdhdGV3YXkgPSB0aGlzLmdhdGV3YXk7XHJcbiAgaWYgKCFnYXRld2F5KSB7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIGdhdGV3YXkgYXR0YWNoZWQuJyk7XHJcbiAgfVxyXG5cclxuICBmdW5jdGlvbiBsaXN0ZW5lcigpIHtkLnJlc29sdmUoKTt9XHJcbiAgaWYgKCFnYXRld2F5LmNvbm5lY3RlZCkge1xyXG4gICAgdmFyIGQgPSB3aGVuLmRlZmVyKCk7XHJcbiAgICBnYXRld2F5Lm9uKCdjb25uZWN0JywgbGlzdGVuZXIpO1xyXG4gICAgcmV0dXJuIHdoZW4oZC5wcm9taXNlKS50aW1lb3V0KDUwMDApXHJcbiAgICAgIC50aGVuKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgcmVxID0gbmV3IE9yZ2FuaXFSZXF1ZXN0KGRldmljZWlkLCAnQ09OTkVDVCcpO1xyXG4gICAgICAgIHJldHVybiBnYXRld2F5LmRpc3BhdGNoKHJlcSk7XHJcbiAgICAgIH0pXHJcbiAgICAgIC50aGVuKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiBuZXcgUmVtb3RlRGV2aWNlUHJveHkoZ2F0ZXdheSwgZGV2aWNlaWQpO1xyXG4gICAgICB9KVxyXG4gICAgICAuZmluYWxseShmdW5jdGlvbigpIHtcclxuICAgICAgICBnYXRld2F5LnJlbW92ZUxpc3RlbmVyKCdvbicsIGxpc3RlbmVyKTtcclxuICAgICAgfSk7XHJcbiAgfSBlbHNle1xyXG4gICAgcmV0dXJuIHRoaXMuZ2F0ZXdheS5jb25uZWN0KGRldmljZWlkKVxyXG4gICAgICAudGhlbihmdW5jdGlvbigpIHtcclxuICAgICAgICB2YXIgcHJveHkgPSBuZXcgUmVtb3RlRGV2aWNlUHJveHkoZ2F0ZXdheSwgZGV2aWNlaWQpO1xyXG4gICAgICAgIHByb3hpZXNbZGV2aWNlaWRdID0gcHJveHk7XHJcbiAgICAgICAgcmV0dXJuIHByb3h5O1xyXG4gICAgICB9KTtcclxuICB9XHJcblxyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJlbGVhc2UgYSBwcm94eSBmb3IgYSBkZXZpY2UuXHJcbiAqXHJcbiAqIEBwYXJhbXMge0xvY2FsRGV2aWNlUHJveHl9IHByZXZpb3VzbHkgY29ubmVjdGVkIGRldmljZSBwcm94eVxyXG4gKi9cclxuQ2xpZW50LnByb3RvdHlwZS5kaXNjb25uZWN0ID0gZnVuY3Rpb24ocHJveHkpIHtcclxuICB2YXIgcmVxID0gbmV3IE9yZ2FuaXFSZXF1ZXN0KHByb3h5LmRldmljZWlkLCAnRElTQ09OTkVDVCcpO1xyXG4gICAgcmV0dXJuIHRoaXMuZ2F0ZXdheS5kaXNwYXRjaChyZXEpO1xyXG59O1xyXG5cclxuQ2xpZW50LnByb3RvdHlwZS5hdHRhY2hHYXRld2F5ID0gZnVuY3Rpb24gYXR0YWNoR2F0ZXdheShnYXRld2F5LCBuYW1lc3BhY2UpIHtcclxuICBkZWJ1ZygnW0NsaWVudF0gR2F0ZXdheSBhdHRhY2hlZCB0byBuYW1lc3BhY2UgJyArIG5hbWVzcGFjZSk7XHJcbiAgaWYgKHRoaXMuZ2F0ZXdheSkge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKCdHYXRld2F5IGFscmVhZHkgYXR0YWNoZWQnKTtcclxuICB9XHJcbiAgdGhpcy5nYXRld2F5ID0gZ2F0ZXdheTtcclxuICB0aGlzLm5hbWVzcGFjZSA9IG5hbWVzcGFjZTtcclxuICAvL3ZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgZ2F0ZXdheS5vbignY29ubmVjdCcsIGZ1bmN0aW9uKCkge1xyXG4gICAgZGVidWcoJ0dhdGV3YXkgY29ubmVjdGVkIChuYW1lc3BhY2U6ICcgKyBuYW1lc3BhY2UgKyAnKScpO1xyXG4gICAgLy9mb3IgKHZhciByZXFpZCBpbiBzZWxmLnBlbmRpbmdSZXF1ZXN0cykge1xyXG4gICAgLy8gIGlmIChzZWxmLnBlbmRpbmdSZXF1ZXN0cy5oYXNPd25Qcm9wZXJ0eShyZXFpZCkpIHtcclxuICAgIC8vICAgIGdhdGV3YXkuZGlzcGF0Y2goc2VsZi5wZW5kaW5nUmVxdWVzdHNbcmVxaWRdKTtcclxuICAgIC8vICAgIGRlbGV0ZSBzZWxmLnBlbmRpbmdSZXF1ZXN0c1tyZXFpZF07XHJcbiAgICAvLyAgfVxyXG4gICAgLy99XHJcbiAgfSk7XHJcbiAgZ2F0ZXdheS5vbignZGlzY29ubmVjdCcsIGZ1bmN0aW9uKCkge1xyXG4gICAgZGVidWcoJ0dhdGV3YXkgZGlzY29ubm5lY3RlZCAobmFtZXNwYWNlOiAnICsgbmFtZXNwYWNlICsgJyknKTtcclxuICAgIC8vIG5vdGhpbmdcclxuICB9KTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBEaXNwYXRjaCBhbiB1cHN0cmVhbSByZXF1ZXN0IHRvIGEgY29ubmVjdGVkIGNsaWVudC5cclxuICpcclxuICogQHBhcmFtICB7T3JnYW5pcVJlcXVlc3R9IHJlcSBUaGUgcmVxdWVzdCB0byBkaXNwYXRjaFxyXG4gKiBAcmV0dXJuIHtQcm9taXNlfSBBIHByb21pc2UgZm9yIGEgcmVzdWx0IHZhbHVlXHJcbiAqL1xyXG5DbGllbnQucHJvdG90eXBlLmRpc3BhdGNoID0gZnVuY3Rpb24gZGlzcGF0Y2gocmVxKSB7XHJcbiAgLyoqIEB0eXBlIHtSZW1vdGVEZXZpY2VQcm94eX0gKi9cclxuICB2YXIgcHJveHkgPSB0aGlzLnByb3hpZXNbcmVxLmRldmljZWlkXTtcclxuICB2YXIgcmVzID0gcmVxLm1ldGhvZCA9PT0gJ05PVElGWScgPyB0cnVlIDogcmVxLnZhbHVlO1xyXG4gIGlmICghcHJveHkpIHtcclxuICAgIC8vIG5vdGhpbmcgdG8gZG9cclxuICAgIHJldHVybiB3aGVuKHJlcyk7XHJcbiAgfVxyXG5cclxuICBzd2l0Y2gocmVxLm1ldGhvZCkge1xyXG4gICAgY2FzZSAnTk9USUZZJzpcclxuICAgICAgcHJveHkuZW1pdCgnbm90aWZ5JywgcmVxLmlkZW50aWZpZXIsIHJlcS5wYXJhbXMpO1xyXG4gICAgICBicmVhaztcclxuICAgIGNhc2UgJ1BVVCc6XHJcbiAgICAgIHByb3h5LmVtaXQoJ3B1dCcsIHJlcS5pZGVudGlmaWVyLCByZXEudmFsdWUpO1xyXG4gICAgICBicmVhaztcclxuICAgIGRlZmF1bHQ6XHJcbiAgICAgIGRlYnVnKCdJbnZhbGlkIHVwc3RyZWFtIG1ldGhvZDogJyArIHJlcS5tZXRob2QpO1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IocmVxLm1ldGhvZCArICcgaXMgbm90IGEgdmFsaWQgdXBzdHJlYW0gbm90aWZpY2F0aW9uJyk7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gd2hlbihyZXMpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJlbW90ZSBEZXZpY2UgUHJveHkuXHJcbiAqXHJcbiAqIFRoaXMgb2JqZWN0IGlzIGdpdmVuIHRvIGNhbGxlcnMgb2YgY29ubmVjdCgpLCBwcm92aWRpbmcgdGhlbSBhbiBvYmplY3QtXHJcbiAqIGJhc2VkIGludGVyZmFjZSB0byBhIHJlbW90ZSBkZXZpY2UuXHJcbiAqXHJcbiAqIFRoaXMgcHJveHkgY2FuIHdvcmsgd2l0aCBhbnkgR2F0ZXdheSwgcHJvdmlkZWQgaXQgc3VwcG9ydHMgdGhlIGRpc3BhdGNoKClcclxuICogbWV0aG9kIGFjY2VwdGluZyBhbiBPcmdhbmlxUmVxdWVzdC5cclxuICpcclxuICogQHBhcmFtIHtvYmplY3R9IGdhdGV3YXlcclxuICogQHBhcmFtIGRldmljZWlkXHJcbiAqIEByZXR1cm4ge1JlbW90ZURldmljZVByb3h5fVxyXG4gKiBAY29uc3RydWN0b3JcclxuICovXHJcbmZ1bmN0aW9uIFJlbW90ZURldmljZVByb3h5KGdhdGV3YXksIGRldmljZWlkKSB7XHJcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFJlbW90ZURldmljZVByb3h5KSkge1xyXG4gICAgcmV0dXJuIG5ldyBSZW1vdGVEZXZpY2VQcm94eShnYXRld2F5LCBkZXZpY2VpZCk7XHJcbiAgfVxyXG5cclxuICB0aGlzLmRldmljZWlkID0gZGV2aWNlaWQ7XHJcbiAgdGhpcy5nYXRld2F5ID0gZ2F0ZXdheTtcclxuICB0aGlzLmRpc3BhdGNoID0gZnVuY3Rpb24ocmVxKSB7XHJcbiAgICByZXR1cm4gdGhpcy5nYXRld2F5LmRpc3BhdGNoKHJlcSk7XHJcbiAgfTtcclxufVxyXG4vL2VtaXRzICdub3RpZnknIGFuZCAncHV0J1xyXG51dGlsLmluaGVyaXRzKFJlbW90ZURldmljZVByb3h5LCBFdmVudEVtaXR0ZXIpO1xyXG5cclxuUmVtb3RlRGV2aWNlUHJveHkucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uKHByb3ApIHtcclxuICB2YXIgcmVxID0gT3JnYW5pcVJlcXVlc3QuZ2V0KHRoaXMuZGV2aWNlaWQsIHByb3ApO1xyXG4gIHJldHVybiB0aGlzLmRpc3BhdGNoKHJlcSk7XHJcbn07XHJcblxyXG5SZW1vdGVEZXZpY2VQcm94eS5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24ocHJvcCwgdmFsdWUpIHtcclxuICB2YXIgcmVxID0gT3JnYW5pcVJlcXVlc3Quc2V0KHRoaXMuZGV2aWNlaWQsIHByb3AsIHZhbHVlKTtcclxuICByZXR1cm4gdGhpcy5kaXNwYXRjaChyZXEpO1xyXG59O1xyXG5cclxuUmVtb3RlRGV2aWNlUHJveHkucHJvdG90eXBlLmludm9rZSA9IGZ1bmN0aW9uKG1ldGhvZCwgcGFyYW1zKSB7XHJcbiAgdmFyIHJlcSA9IE9yZ2FuaXFSZXF1ZXN0Lmludm9rZSh0aGlzLmRldmljZWlkLCBtZXRob2QsIHBhcmFtcyk7XHJcbiAgcmV0dXJuIHRoaXMuZGlzcGF0Y2gocmVxKTtcclxufTtcclxuXHJcblJlbW90ZURldmljZVByb3h5LnByb3RvdHlwZS5zdWJzY3JpYmUgPSBmdW5jdGlvbihldmVudCkge1xyXG4gIHZhciByZXEgPSBPcmdhbmlxUmVxdWVzdC5zdWJzY3JpYmUodGhpcy5kZXZpY2VpZCwgZXZlbnQpO1xyXG4gIHJldHVybiB0aGlzLmRpc3BhdGNoKHJlcSk7XHJcbn07XHJcblxyXG5SZW1vdGVEZXZpY2VQcm94eS5wcm90b3R5cGUuZGVzY3JpYmUgPSBmdW5jdGlvbihwcm9wZXJ0eSkge1xyXG4gIHZhciByZXEgPSBPcmdhbmlxUmVxdWVzdC5kZXNjcmliZSh0aGlzLmRldmljZWlkLCBwcm9wZXJ0eSk7XHJcbiAgcmV0dXJuIHRoaXMuZGlzcGF0Y2gocmVxKTtcclxufTtcclxuXHJcblJlbW90ZURldmljZVByb3h5LnByb3RvdHlwZS5jb25maWcgPSBmdW5jdGlvbihwcm9wZXJ0eSwgdmFsdWUpIHtcclxuICB2YXIgcmVxID0gT3JnYW5pcVJlcXVlc3QuY29uZmlnKHRoaXMuZGV2aWNlaWQsIHByb3BlcnR5LCB2YWx1ZSk7XHJcbiAgcmV0dXJuIHRoaXMuZGlzcGF0Y2gocmVxKTtcclxufTtcclxuXHJcbiIsInZhciBPcmdhbmlxUmVxdWVzdCA9IHJlcXVpcmUoJy4vcmVxdWVzdCcpO1xyXG52YXIgd2hlbiA9IHJlcXVpcmUoJ3doZW4nKTtcclxudmFyIGRlYnVnID0gcmVxdWlyZSgnZGVidWcnKSgnb3JnYW5pcTpjb3JlJyk7XHJcbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XHJcbnZhciB1dGlsID0gcmVxdWlyZSgndXRpbCcpO1xyXG5tb2R1bGUuZXhwb3J0cyA9IENvbnRhaW5lcjtcclxuXHJcbi8qKlxyXG4gKiBDcmVhdGUgYSBDb250YWluZXIgbm9kZS5cclxuICpcclxuICogQHBhcmFtIHtPYmplY3Q9fSBvcHRpb25zXHJcbiAqIEByZXR1cm5zIHtDb250YWluZXJ9XHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKi9cclxuZnVuY3Rpb24gQ29udGFpbmVyKG9wdGlvbnMpIHtcclxuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQ29udGFpbmVyKSkge1xyXG4gICAgcmV0dXJuIG5ldyBDb250YWluZXIob3B0aW9ucyk7XHJcbiAgfVxyXG4gIC8vb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XHJcblxyXG4gIHRoaXMuc3RhY2sgPSBbXTsgICAgICAgIC8vIG1pZGRsZXdhcmUgc3RhY2ssIG9yZGVyZWQgdG93YXJkIGRvd25zdHJlYW1cclxuICB0aGlzLmRldmljZXMgPSB7fTsgICAgICAvLyByZWdpc3RlcmVkIGxvY2FsIGRldmljZSBvYmplY3RzLCBieSBkZXZpY2VpZFxyXG4gIHRoaXMuZ2F0ZXdheSA9IG51bGw7ICAgIC8vIGdhdGV3YXkgd2l0aCB3aGljaCB3ZSBhcmUgYXNzb2NpYXRlZFxyXG4gIHRoaXMubmFtZXNwYWNlID0gbnVsbDsgIC8vIG5hbWVzcGFjZSB1c2VkIG9uIGdhdGV3YXlcclxufVxyXG51dGlsLmluaGVyaXRzKENvbnRhaW5lciwgRXZlbnRFbWl0dGVyKTtcclxuXHJcblxyXG4vKipcclxuICogQWRkIG1pZGRsZXdhcmUgdG8gdGhlIE9yZ2FuaXEgc3RhY2suXHJcbiAqXHJcbiAqIE1pZGRsZXdhcmUgZnVuY3Rpb25zIGFyZSBjYWxsZWQgZm9yIGV2ZXJ5IHJlcXVlc3QgdGhhdCBwYXNzZXMgdGhyb3VnaCB0aGVcclxuICogc3lzdGVtLiBUaGV5IGFyZSBpbnZva2VkIGluIHRoZSBvcmRlciB0aGF0IHRoZXkgYXJlIGdpdmVuIHRvIHVzZSgpLlxyXG4gKlxyXG4gKiBAcGFyYW0ge2Z1bmN0aW9uKE9yZ2FuaXFSZXF1ZXN0LCBmdW5jdGlvbil8ZnVuY3Rpb25bXX0gZm5zXHJcbiAqIEByZXR1cm5zIHtDb250YWluZXJ9XHJcbiAqL1xyXG5Db250YWluZXIucHJvdG90eXBlLnVzZSA9IGZ1bmN0aW9uIHVzZShmbnMpIHtcclxuXHJcbiAgaWYgKHR5cGVvZiBmbnMgPT09ICdmdW5jdGlvbicpIHtcclxuICAgIGZucyA9IFtmbnNdO1xyXG4gIH1cclxuXHJcbiAgaWYgKCFBcnJheS5pc0FycmF5KGZucykgfHwgZm5zLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignLnVzZSgpIHJlcXVpcmVzIG1pZGRsZXdhcmUgZnVuY3Rpb25zJyk7XHJcbiAgfVxyXG5cclxuICBmbnMuZm9yRWFjaChmdW5jdGlvbiAoZm4pIHtcclxuICAgIHRoaXMuc3RhY2sucHVzaChmbik7XHJcbiAgICBmbi5vcmdhbmlxID0gdGhpcztcclxuICB9LCB0aGlzKTtcclxuXHJcbiAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG5cclxuLyoqXHJcbiAqIERpc3BhdGNoIGEgcmVxdWVzdCB0aHJvdWdoIHRoZSBsb2NhbCBtaWRkbGV3YXJlIHN0YWNrLlxyXG4gKlxyXG4gKiBSZXF1ZXN0cyBtYXkgYmUgZWl0aGVyIGFwcGxpY2F0aW9uLW9yaWdpbmF0ZWQgKGRvd25zdHJlYW0pIG9yIGRldmljZS1cclxuICogb3JpZ2luYXRlZCAodXBzdHJlYW0pLiBBZnRlciBiZWluZyBwcm9jZXNzZWQgYnkgdGhlIGxvY2FsIG1pZGRsZXdhcmUsXHJcbiAqIGRvd25zdHJlYW0gbWVzc2FnZXMgYXJlIHBhc3NlZCB0byBhIHJlZ2lzdGVyZWQgZGV2aWNlIChpZiBwcmVzZW50KSxcclxuICogd2hpbGUgdXBzdHJlYW0gbWVzc2FnZXMgYXJlIHNlbnQgdG8gdGhlIGdhdGV3YXkuXHJcbiAqXHJcbiAqIEBwYXJhbSAge09yZ2FuaXFSZXF1ZXN0fSByZXEgVGhlIHJlcXVlc3QgdG8gZGlzcGF0Y2hcclxuICogQHJldHVybiB7UHJvbWlzZX0gQSBwcm9taXNlIGZvciBhIHJlc3VsdCB2YWx1ZVxyXG4gKi9cclxuQ29udGFpbmVyLnByb3RvdHlwZS5kaXNwYXRjaCA9IGZ1bmN0aW9uIGRpc3BhdGNoKHJlcSkge1xyXG5cclxuICB2YXIgaWR4OyAgICAgICAgICAgICAgICAgIC8vIGluZGV4IG9mIGN1cnJlbnQgaGFuZGxlciBpbiBtaWRkbGV3YXJlIHN0YWNrXHJcbiAgdmFyIHByZXZpb3VzUmVzdWx0OyAgICAgICAvLyBsYXN0IGRlZmluZWQgcmVzdWx0IHJldHVybmVkIGZyb20gYSBoYW5kbGVyXHJcbiAgdmFyIGhhbmRsZXJzID0gdGhpcy5zdGFjazsvLyBhcnJheSBvZiBtaWRkbGV3YXJlIGhhbmRsZXJzXHJcbiAgdmFyIGZpbmFsSGFuZGxlcjsgICAgICAgICAvLyBmdW5jdGlvbiB1c2VkIHdoZW4gZW5kIG9mIGhhbmRsZXJzIHJlYWNoZWRcclxuICB2YXIgYXBwID0gdGhpcztcclxuICB2YXIgZG93bnN0cmVhbSA9IHJlcS5pc0FwcGxpY2F0aW9uT3JpZ2luYXRlZCgpO1xyXG5cclxuICAvLyBBcHBsaWNhdGlvbi1vcmlnaW5hdGVkIHJlcXVlc3RzIGdvIFwiZG93bnN0cmVhbVwiIHRocm91Z2ggdGhlIHN0YWNrLFxyXG4gIC8vIGZyb20gZmlyc3QgKGluZGV4IDApIHRvIGxhc3QuIERldmljZS1vcmlnaW5hdGVkIHJlcXVlc3RzIGdvIFwidXBzdHJlYW1cIixcclxuICAvLyBzdGFydGluZyBhdCB0aGUgbGFzdCBoYW5kbGVyIGluIHRoZSBzdGFjay5cclxuICBpZHggPSBkb3duc3RyZWFtID8gMCA6IGhhbmRsZXJzLmxlbmd0aCAtIDE7XHJcbiAgZmluYWxIYW5kbGVyID0gZG93bnN0cmVhbSA/IGZpbmFsSGFuZGxlckRvd25zdHJlYW0gOiBmaW5hbEhhbmRsZXJVcHN0cmVhbTtcclxuXHJcbiAgcmV0dXJuIG5leHQoKTtcclxuXHJcbiAgLyoqXHJcbiAgICogSW52b2tlIHRoZSBuZXh0IG1pZGRsZXdhcmUgaGFuZGxlciBpbiB0aGUgc3RhY2suXHJcbiAgICpcclxuICAgKiBJZiB0aGUgcmVxdWVzdCBpcyBub3QgaGFuZGxlZCBiZWZvcmUgaXQgcmVhY2hlcyB0aGUgZW5kIG9mIHRoZSBzdGFjayxcclxuICAgKiB0aGUgYGZpbmFsSGFuZGxlcmAgaXMgY2FsbGVkIHRvIGRpc3BhdGNoIHRoZSByZXF1ZXN0IHRvIHRoZSB0YXJnZXQgZGV2aWNlLlxyXG4gICAqXHJcbiAgICogQSByZWZlcmVuY2UgdG8gdGhpcyBmdW5jdGlvbiBpcyBwcm92aWRlZCB0byBlYWNoIGxheWVyLCBhbmQgdGhlIG5vcm1hbFxyXG4gICAqIGNhc2UgaXMgdGhhdCBlYWNoIGxheWVyIHdpbGwgaW52b2tlIG5leHQoKSB0byBjYWxsIHRoZSBuZXh0IGxheWVyIGlmIGl0XHJcbiAgICogZG9lcyBub3QgaGFuZGxlIHRoZSByZXF1ZXN0IGl0c2VsZi4gV2UgdGhlcmVmb3JlIGFyZSBjYWxsZWQgcmVjdXJzaXZlbHksXHJcbiAgICogYW5kIGEgcHJvbWlzZSBjaGFpbiBpcyBidWlsdCBmcm9tIHRoZSByZXR1cm4gdmFsdWVzIG9mIGVhY2ggaGFuZGxlci5cclxuICAgKlxyXG4gICAqIEByZXR1cm5zIHtQcm9taXNlfSBhIHByb21pc2UgZm9yIGEgcmVzcG9uc2UgdG8gdGhlIHJlcXVlc3QuXHJcbiAgICovXHJcbiAgZnVuY3Rpb24gbmV4dCgpIHtcclxuXHJcbiAgICB2YXIgbGF5ZXIgPSBoYW5kbGVyc1tkb3duc3RyZWFtID8gaWR4KysgOiBpZHgtLV0gfHwgZmluYWxIYW5kbGVyO1xyXG4gICAgdmFyIHJlc3VsdDtcclxuXHJcbiAgICAvLyBJbnZva2UgdGhlIGN1cnJlbnQgbGF5ZXIuIEl0IG1heSBkbyBhbnkgb2YgdGhlIGZvbGxvd2luZzpcclxuICAgIC8vIC0gcmV0dXJuIHRoZSB2YWx1ZSBvZiBuZXh0KCkgKG5vcm1hbCBjYXNlKVxyXG4gICAgLy8gLSByZXR1cm4gYSByZXN1bHQgZGlyZWN0bHksIG9yIGEgcHJvbWlzZSAocGVyaGFwcyBmdWxmaWxsZWQgb3IgcmVqZWN0ZWQpXHJcbiAgICAvLyAgICBmb3IgYSByZXN1bHRcclxuICAgIC8vIC0gcmV0dXJuIG5vdGhpbmdcclxuICAgIC8vIC0gdGhyb3cgYW4gZXhjZXB0aW9uXHJcbiAgICAvL1xyXG4gICAgLy8gSWYgYW4gZXhjZXB0aW9uIGlzIHRocm93biwgd2UgcmV0dXJuIGEgcmVqZWN0ZWQgcHJvbWlzZSB0aGF0IGNhbiBiZSB1c2VkXHJcbiAgICAvLyBieSBwcmV2aW91cyBsYXllcnMgaW4gdGhlIHN0YWNrIHRvIGRvIGVycm9yIGhhbmRsaW5nLlxyXG4gICAgLy8gTm90ZSB0aGF0IHRoaXMgaXMgZGlmZmVyZW50IHRoYW4gaG93IENvbm5lY3QgbWlkZGxld2FyZSBmdW5jdGlvbnM7IGluXHJcbiAgICAvLyBDb25uZWN0LCBlcnJvcnMgYXJlIHBhc3NlZCB0byBfZnV0dXJlXyBsYXllcnMgaW4gdGhlIHN0YWNrLCB3aGlsZSBpblxyXG4gICAgLy8gT3JnYW5pcSwgZXJyb3JzIGFyZSBhY2Nlc3NpYmxlIG9ubHkgdG8gX3ByZXZpb3VzXyBsYXllcnMuXHJcbiAgICAvL1xyXG4gICAgLy8gSW4gdGhlIG5vcm1hbCBjYXNlLCB0aGUgbGF5ZXJzIHdpbGwgY2FsbCBuZXh0KCkgcmVjdXJzaXZlbHlcclxuICAgIHRyeSB7IHJlc3VsdCA9IGxheWVyKHJlcSwgbmV4dCk7IH1cclxuICAgIGNhdGNoKGUpIHtcclxuICAgICAgZGVidWcoJ01pZGRsZXdhcmUgdGhyZXcgYW4gZXhjZXB0aW9uOiAnLCBlKTtcclxuICAgICAgcmV0dXJuIHdoZW4ucmVqZWN0KGUpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEF0IHRoaXMgcG9pbnQsIGFsbCBvZiB0aGUgbGF5ZXJzIChpbmNsdWRpbmcgdGhlIGZpbmFsSGFuZGxlcikgdGhhdCB3aWxsXHJcbiAgICAvLyBiZSBjYWxsZWQgaGF2ZSBiZWVuIGNhbGxlZCwgYW5kIHdlIGFyZSB1bndpbmRpbmcgdGhlIHJlcXVlc3RzIGZyb21cclxuICAgIC8vIGxhc3QtY2FsbGVkIHRvIGZpcnN0LWNhbGxlZCBsYXllci5cclxuXHJcbiAgICAvLyBXZSBub3JtYWxseSBqdXN0IHJldHVybiB0aGUgdmFsdWUgZ2l2ZW4gdXMgYnkgdGhlIGxheWVyLiBIb3dldmVyLCBsYXllcnNcclxuICAgIC8vIG1heSBub3QgYWx3YXlzIHJldHVybiBhIHZhbHVlLCBpbiB3aGljaCBjYXNlIHdlIHJldHVybiB0aGUgbW9zdCByZWNlbnRcclxuICAgIC8vIHdlbGwtZGVmaW5lZCByZXN1bHQgZnJvbSBhbnkgaGFuZGxlci5cclxuICAgIGlmICh0eXBlb2YgcmVzdWx0ID09PSAndW5kZWZpbmVkJykge1xyXG4gICAgICByZXN1bHQgPSBwcmV2aW91c1Jlc3VsdDtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHByZXZpb3VzUmVzdWx0ID0gcmVzdWx0OyAgLy8gcmVtZW1iZXIgbW9zdCByZWNlbnRseSByZXR1cm5lZCByZXN1bHRcclxuICAgIH1cclxuXHJcbiAgICAvLyBpZiByZXN1bHQgaXMgc3RpbGwgdW5kZWZpbmVkIGhlcmUsIGl0IG1lYW5zIHRoYXQgZWl0aGVyICgxKSBmaW5hbEhhbmRsZXJcclxuICAgIC8vIGZhaWxlZCB0byByZXR1cm4gYSB2YWx1ZSwgb3IgKDIpIGEgbGF5ZXIgb2YgbWlkZGxld2FyZSBkaWQgbm90IGludm9rZVxyXG4gICAgLy8gbmV4dCgpIHlldCBhbHNvIGZhaWxlZCB0byByZXR1cm4gYSB2YWx1ZS5cclxuICAgIGlmIChyZXN1bHQgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICB2YXIgZSA9ICdMYXllciAnICsgbGF5ZXIubmFtZSArICcgbXVzdCBpbnZva2UgbmV4dCgpIG9yIHJldHVybiBhIHZhbHVlLic7XHJcbiAgICAgIGRlYnVnKGUpO1xyXG4gICAgICByZXR1cm4gd2hlbi5yZWplY3QobmV3IEVycm9yKGUpKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBSZXR1cm4gYSBwcm9taXNlIHRvIHRoZSBjYWxsZXJcclxuICAgIHJldHVybiB3aGVuKHJlc3VsdCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgYW4gYXBwbGljYXRpb24tb3JpZ2luYXRlZCByZXF1ZXN0IGFmdGVyIGl0IGhhcyBwYXNzZWQgdGhyb3VnaCB0aGVcclxuICAgKiBtaWRkbGV3YXJlIHN0YWNrLlxyXG4gICAqXHJcbiAgICogVGhlIHJlcXVlc3Qgd2lsbCBiZSBwYXNzZWQgdG8gdGhlIGRldmljZSBvYmplY3QgaWYgaXQgZXhpc3RzLCBvdGhlcndpc2VcclxuICAgKiBhbiBFcnJvciB3aWxsIGJlIHJhaXNlZC5cclxuICAgKlxyXG4gICAqIEBwYXJhbSB7T3JnYW5pcVJlcXVlc3R9IHJlcSByZXF1ZXN0IG9iamVjdFxyXG4gICAqL1xyXG4gIGZ1bmN0aW9uIGZpbmFsSGFuZGxlckRvd25zdHJlYW0ocmVxKSB7XHJcblxyXG4gICAgdmFyIGRldmljZSA9IGFwcC5kZXZpY2VzW3JlcS5kZXZpY2VpZF07XHJcbiAgICBpZiAoIWRldmljZSkge1xyXG4gICAgICB2YXIgbXNnID0gJ0RldmljZSBcXCcnICsgcmVxLmRldmljZWlkICsgJ1xcJyBpcyBub3QgY29ubmVjdGVkLic7XHJcbiAgICAgIGRlYnVnKG1zZyk7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihtc2cpO1xyXG4gICAgfVxyXG5cclxuICAgIHN3aXRjaChyZXEubWV0aG9kKSB7XHJcbiAgICAgIGNhc2UgJ0dFVCc6XHJcbiAgICAgICAgcmV0dXJuIGRldmljZS5nZXQocmVxLmlkZW50aWZpZXIpO1xyXG4gICAgICBjYXNlICdTRVQnOlxyXG4gICAgICAgIHJldHVybiBkZXZpY2Uuc2V0KHJlcS5pZGVudGlmaWVyLCByZXEudmFsdWUpIHx8IHRydWU7XHJcbiAgICAgIGNhc2UgJ0lOVk9LRSc6XHJcbiAgICAgICAgcmV0dXJuIGRldmljZS5pbnZva2UocmVxLmlkZW50aWZpZXIsIHJlcS5wYXJhbXMpIHx8IHRydWU7XHJcbiAgICAgIGNhc2UgJ1NVQlNDUklCRSc6XHJcbiAgICAgICAgcmV0dXJuIGRldmljZS5zdWJzY3JpYmUocmVxLmlkZW50aWZpZXIpO1xyXG4gICAgICBjYXNlICdERVNDUklCRSc6XHJcbiAgICAgICAgcmV0dXJuIGRldmljZS5kZXNjcmliZShyZXEuaWRlbnRpZmllcik7XHJcbiAgICAgIGNhc2UgJ0NPTkZJRyc6XHJcbiAgICAgICAgcmV0dXJuIGRldmljZS5jb25maWcocmVxLmlkZW50aWZpZXIsIHJlcS52YWx1ZSk7XHJcbiAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgZGVidWcoJ0ludmFsaWQgcmVxdWVzdCBtZXRob2Q6ICcgKyByZXEubWV0aG9kKTtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IocmVxLm1ldGhvZCArICcgaXMgbm90IGEgdmFsaWQgZG93bnN0cmVhbSByZXF1ZXN0Jyk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgYSBkZXZpY2Utb3JpZ2luYXRlZCByZXF1ZXN0IGFmdGVyIGl0IGhhcyBwYXNzZWQgdGhyb3VnaCB0aGVcclxuICAgKiBtaWRkbGV3YXJlIHN0YWNrLlxyXG4gICAqXHJcbiAgICogV2UgZm9yd2FyZCB0aGUgcmVxdWVzdCB0byB0aGUgZ2F0ZXdheS5cclxuICAgKlxyXG4gICAqIEBwYXJhbSB7T3JnYW5pcVJlcXVlc3R9IHJlcSByZXF1ZXN0IG9iamVjdFxyXG4gICAqIEByZXR1cm5zIHtCb29sZWFufVxyXG4gICAqL1xyXG4gIGZ1bmN0aW9uIGZpbmFsSGFuZGxlclVwc3RyZWFtKHJlcSkge1xyXG4gICAgaWYgKGFwcC5nYXRld2F5ICYmIGFwcC5nYXRld2F5LmNvbm5lY3RlZCkge1xyXG4gICAgICBhcHAuZ2F0ZXdheS5kaXNwYXRjaChyZXEpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfVxyXG59O1xyXG5cclxuXHJcbi8qKlxyXG4gKiBSZWdpc3RlciBhIGRldmljZSB3aXRoIHRoZSBzeXN0ZW0uXHJcbiAqXHJcbiAqIFRoZSBkZXZpY2UgbWF5IGJlIGVpdGhlciBhIGxvY2FsbHktaW1wbGVtZW50ZWQgZGV2aWNlLCBvciBhIHByb3h5IHRvIGFcclxuICogZGV2aWNlIGltcGxlbWVudGVkIGVsc2V3aGVyZS5cclxuICpcclxuICpcclxuICogQHBhcmFtIHtTdHJpbmd9IGRldmljZWlkXHJcbiAqIEBwYXJhbSB7RGV2aWNlfEV2ZW50RW1pdHRlcn0gZGV2aWNlXHJcbiAqIEByZXR1cm5zIHtEZXZpY2V9IHRoZSBkZXZpY2Ugb2JqZWN0IGdpdmVuXHJcbiAqL1xyXG5Db250YWluZXIucHJvdG90eXBlLnJlZ2lzdGVyID0gZnVuY3Rpb24oZGV2aWNlaWQsIGRldmljZSkge1xyXG5cclxuICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gIC8vIE1ha2Ugc3VyZSB3ZSBoYXZlbid0IGFscmVhZHkgcmVnaXN0ZXJlZCB0aGlzIGRldmljZWlkLlxyXG4gIHZhciBkZXZpY2VzID0gdGhpcy5kZXZpY2VzO1xyXG4gIGlmICh0eXBlb2YgZGV2aWNlc1tkZXZpY2VpZF0gIT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICByZXR1cm4gd2hlbi5yZWplY3QobmV3IEVycm9yKFxyXG4gICAgICAnUmVnaXN0ZXIgY2FsbGVkIGZvciBhbHJlYWR5IHJlZ2lzdGVyZWQgZGV2aWNlaWQ6ICcgKyBkZXZpY2VpZCkpO1xyXG4gIH1cclxuXHJcbiAgaWYgKHR5cGVvZiBkZXZpY2Uub24gPT09ICdmdW5jdGlvbicpIHtcclxuICAgIC8vIFBhc3MgZGV2aWNlLW9yaWdpbmF0ZWQgbWVzc2FnZXMgZnJvbSB0aGUgZGV2aWNlIGludG8gdGhlIG9yZ2FuaXFcclxuICAgIC8vIG1pZGRsZXdhcmUgc3RhY2suXHJcbiAgICBkZXZpY2Uub24oJ3B1dCcsIGZ1bmN0aW9uIG9uUHV0KG1ldHJpYywgdmFsdWUpIHtcclxuICAgICAgZGVidWcoJ0xvY2FsRGV2aWNlICcrZGV2aWNlaWQrJzogUFVUICcgKyBtZXRyaWMgKyAnLCcgKyB2YWx1ZSk7XHJcbiAgICAgIHZhciByZXEgPSBPcmdhbmlxUmVxdWVzdC5wdXQoZGV2aWNlaWQsIG1ldHJpYywgdmFsdWUpO1xyXG4gICAgICBzZWxmLmRpc3BhdGNoKHJlcSk7XHJcbiAgICB9KTtcclxuICAgIGRldmljZS5vbignbm90aWZ5JywgZnVuY3Rpb24gb25Ob3RpZnkoZXZlbnQsIGFyZ3MpIHtcclxuICAgICAgZGVidWcoJ0xvY2FsRGV2aWNlICcrZGV2aWNlaWQrJzogTk9USUZZICcgKyBldmVudCArICcsJyArIGFyZ3MpO1xyXG4gICAgICB2YXIgcmVxID0gT3JnYW5pcVJlcXVlc3Qubm90aWZ5KGRldmljZWlkLCBldmVudCwgYXJncyk7XHJcbiAgICAgIHNlbGYuZGlzcGF0Y2gocmVxKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgdGhpcy5kZXZpY2VzW2RldmljZWlkXSA9IGRldmljZTtcclxuICB0aGlzLmVtaXQoJ2RldmljZVJlZ2lzdGVyZWQnLCBkZXZpY2VpZCk7XHJcblxyXG4gIGRlYnVnKCdEZXZpY2UgcmVnaXN0ZXJlZCBsb2NhbGx5OiAnICsgZGV2aWNlaWQpO1xyXG5cclxuICBpZiAodGhpcy5nYXRld2F5ICYmIHRoaXMuZ2F0ZXdheS5jb25uZWN0ZWQpIHtcclxuICAgIHRoaXMucmVnaXN0ZXJXaXRoR2F0ZXdheShkZXZpY2VpZCk7XHJcbiAgfVxyXG4gIHJldHVybiBkZXZpY2U7XHJcbn07XHJcblxyXG5Db250YWluZXIucHJvdG90eXBlLnJlZ2lzdGVyV2l0aEdhdGV3YXkgPSBmdW5jdGlvbihkZXZpY2VpZCkge1xyXG4gIGRlYnVnKCdSZWdpc3RlcmluZyAnICsgZGV2aWNlaWQgKyAnIHdpdGggZ2F0ZXdheS4nKTtcclxuICB2YXIgcmVxID0gbmV3IE9yZ2FuaXFSZXF1ZXN0KGRldmljZWlkLCAnUkVHSVNURVInKTtcclxuICB0aGlzLmdhdGV3YXkuZGlzcGF0Y2gocmVxKS50aGVuKGZ1bmN0aW9uKCkge1xyXG4gICAgZGVidWcoJ0RldmljZSByZWdpc3RlcmVkIHdpdGggZ2F0ZXdheTogJyArIGRldmljZWlkKTtcclxuICB9LCBmdW5jdGlvbihlcnIpIHtcclxuICAgIGRlYnVnKCdGYWlsZWQgdG8gcmVnaXN0ZXIgZGV2aWNlICcgKyBkZXZpY2VpZCArICc6ICcgKyBlcnIpO1xyXG4gIH0pO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJlbW92ZXMgYSBkZXZpY2UgcmVnaXN0cmF0aW9uIGZyb20gdGhlIHN5c3RlbS5cclxuICpcclxuICogT25jZSBkZXJlZ2lzdGVyZWQsIGEgZGV2aWNlIGlzIG5vIGxvbmdlciByZWFjaGFibGUuXHJcbiAqXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBkZXZpY2VpZFxyXG4gKiBAcmV0dXJucyB7RGV2aWNlV3JhcHBlcn0gdGhlIGRldmljZSBvcmlnaW5hbGx5IHJlZ2lzdGVyZWRcclxuICpcclxuICovXHJcbkNvbnRhaW5lci5wcm90b3R5cGUuZGVyZWdpc3RlciA9IGZ1bmN0aW9uKGRldmljZWlkKSB7XHJcbiAgaWYgKHR5cGVvZiB0aGlzLmRldmljZXNbZGV2aWNlaWRdID09PSAndW5kZWZpbmVkJykge1xyXG4gICAgZGVidWcoJ2RlcmVnaXN0ZXIgY2FsbGVkIGZvciB1bnJlZ2lzdGVyZWQgZGV2aWNlaWQ6ICcgKyBkZXZpY2VpZCk7XHJcbiAgICByZXR1cm4gd2hlbi5yZWplY3QobmV3IEVycm9yKFxyXG4gICAgICAnZGVyZWdpc3RlciBvZiB1bnJlZ2lzdGVyZWQgZGV2aWNlOiAnICsgZGV2aWNlaWQpKTtcclxuICB9XHJcblxyXG4gIHZhciBkZXZpY2UgPSB0aGlzLmRldmljZXNbZGV2aWNlaWRdO1xyXG4gIGRldmljZS5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcclxuICBkZWxldGUgdGhpcy5kZXZpY2VzW2RldmljZWlkXTtcclxuICB0aGlzLmVtaXQoJ2RldmljZURlcmVnaXN0ZXJlZCcsIGRldmljZWlkKTtcclxuXHJcbiAgZGVidWcoJ0RldmljZSBkZXJlZ2lzdGVyZWQ6ICcgKyBkZXZpY2VpZCk7XHJcblxyXG4gIHZhciByZXEgPSBuZXcgT3JnYW5pcVJlcXVlc3QoZGV2aWNlaWQsICdERVJFR0lTVEVSJyk7XHJcbiAgcmV0dXJuIHRoaXMuZ2F0ZXdheS5kaXNwYXRjaChyZXEpO1xyXG59O1xyXG5cclxuQ29udGFpbmVyLnByb3RvdHlwZS5hdHRhY2hHYXRld2F5ID0gZnVuY3Rpb24gYXR0YWNoR2F0ZXdheShnYXRld2F5LCBuYW1lc3BhY2UpIHtcclxuICBkZWJ1ZygnR2F0ZXdheSBhdHRhY2hlZCB0byBuYW1lc3BhY2UgJyArIG5hbWVzcGFjZSk7XHJcbiAgaWYgKHRoaXMuZ2F0ZXdheSkge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKCdHYXRld2F5IGFscmVhZHkgYXR0YWNoZWQnKTtcclxuICB9XHJcbiAgdGhpcy5nYXRld2F5ID0gZ2F0ZXdheTtcclxuICB0aGlzLm5hbWVzcGFjZSA9IG5hbWVzcGFjZTtcclxuICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gIGdhdGV3YXkub24oJ2Nvbm5lY3QnLCBmdW5jdGlvbigpIHtcclxuICAgIGRlYnVnKCdHYXRld2F5IGNvbm5lY3RlZCAobmFtZXNwYWNlOiAnICsgbmFtZXNwYWNlICsgJyknKTtcclxuICAgIGZvciAodmFyIGRldmljZWlkIGluIHNlbGYuZGV2aWNlcykge1xyXG4gICAgICBpZiAoc2VsZi5kZXZpY2VzLmhhc093blByb3BlcnR5KGRldmljZWlkKSkge1xyXG4gICAgICAgIHNlbGYucmVnaXN0ZXJXaXRoR2F0ZXdheShkZXZpY2VpZCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9KTtcclxuICBnYXRld2F5Lm9uKCdkaXNjb25uZWN0JywgZnVuY3Rpb24oKSB7XHJcbiAgICBkZWJ1ZygnR2F0ZXdheSBkaXNjb25ubmVjdGVkIChuYW1lc3BhY2U6ICcgKyBuYW1lc3BhY2UgKyAnKScpO1xyXG4gICAgLy8gbm90aGluZ1xyXG4gIH0pO1xyXG59O1xyXG4iLCIvKipcclxuICogTW9kdWxlIERlcGVuZGVuY2llcy5cclxuICovXHJcbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XHJcbnZhciB1dGlsID0gcmVxdWlyZSgndXRpbCcpO1xyXG52YXIgU2NoZW1hID0gcmVxdWlyZSgnLi9zY2hlbWEnKTtcclxudmFyIGRlYnVnID0gcmVxdWlyZSgnZGVidWcnKSgnb3JnYW5pcTpzZGs6ZGV2aWNlJyk7XHJcblxyXG4vKipcclxuICogRXhwb3J0IERldmljZVdyYXBwZXIgY29uc3RydWN0b3JcclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0gRGV2aWNlV3JhcHBlcjtcclxuXHJcbi8qKlxyXG4gKiBMb2NhbCBkZXZpY2UgaW50ZXJmYWNlLlxyXG4gKlxyXG4gKiBNYW5hZ2VzIHRoZSBpbnRlcmZhY2UgYmV0d2VlbiBPcmdhbmlxIGFuZCBsb2NhbCBvYmplY3RzIGltcGxlbWVudGluZyBkZXZpY2VcclxuICogZnVuY3Rpb25hbGl0eS4gQ291bGQgYmUgY2FsbGVkIFwibmF0aXZlIChKYXZhU2NyaXB0KSBkZXZpY2Ugd3JhcHBlci5cIlxyXG4gKlxyXG4gKiBJdCBpcyByZWxhdGl2ZWx5IHN0cmFpZ2h0Zm9yd2FyZCB0byBjcmVhdGUgZGV2aWNlIG9iamVjdHMgdGhhdCBpbXBsZW1lbnQgdGhlXHJcbiAqIE9yZ2FuaXEgZGV2aWNlIGludGVyZmFjZSAoZ2V0L3NldC9pbnZva2UvZGVzY3JpYmUvY29uZmlnKSBhbmQgcmVnaXN0ZXIgdGhlbVxyXG4gKiBkaXJlY3RseSB3aXRoIG9yZ2FuaXEucmVnaXN0ZXIoKS4gSG93ZXZlciwgaXQgY2FuIGJlIHNpbXBsZXIgYW5kIG1vcmUgbmF0dXJhbFxyXG4gKiB0byBpbXBsZW1lbnQgbWV0aG9kcyBhbmQgcHJvcGVydGllcyB3aXRoIG5hdGl2ZSBKYXZhU2NyaXB0IGZ1bmN0aW9uYWxpdHkuXHJcbiAqXHJcbiAqIERldmljZVdyYXBwZXIgZW5jYXBzdWxhdGVzIGFuIGV4aXN0aW5nICduYXRpdmUnIEphdmFTY3JpcHQgb2JqZWN0IGFuZFxyXG4gKiBhdXRvbWF0aWNhbGx5IGV4cG9zZXMgaXRzIHB1YmxpYyBtZXRob2RzLCBwcm9wZXJ0aWVzLCBhbmQgZXZlbnRzIHRvIE9yZ2FuaXEuXHJcbiAqXHJcbiAqIHZhciBvcmdhbmlxID0gcmVxdWlyZSgnb3JnYW5pcS1jb3JlJyk7XHJcbiAqIHZhciBjb250YWluZXIgPSBvcmdhbmlxKCk7XHJcbiAqIC4uLlxyXG4gKiB2YXIgZGV2aWNlID0gbmV3IERldmljZVdyYXBwZXIoe1xyXG4gKiAgICBzb21lRnVuYzogZnVuY3Rpb24oKSB7IC4uLiB9XHJcbiAqICAgIGV2ZW50czogW11cclxuICpcclxuICpcclxuICogQHBhcmFtIHtPYmplY3R9IGltcGwgVXNlci1zdXBwbGllZCBpbXBsZW1lbnRhdGlvbiBvYmplY3QuXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBbc2NoZW1hXSBzY2hlbWEgZm9yIHRoZSBkZXZpY2UsIHNwZWNpZnlpbmcgcHJvcGVydGllcyxcclxuICogIG1ldGhvZHMsIGFuZCBldmVudHMgdG8gZXhwb3NlLiBJZiBvbWl0dGVkLCB0aGUgc2NoZW1hIGlzIGNyZWF0ZWRcclxuICogIGF1dG9tYXRpY2FsbHkgYnkgaW5zcGVjdGluZyB0aGUgZ2l2ZW4gaW1wbGVtZW50YXRpb24gb2JqZWN0LlxyXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIG9wdGlvbmFsIG9wdGlvbnNcclxuICogQGNvbnN0cnVjdG9yXHJcbiAqL1xyXG5mdW5jdGlvbiBEZXZpY2VXcmFwcGVyKGltcGwsIHNjaGVtYSwgb3B0aW9ucykge1xyXG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBEZXZpY2VXcmFwcGVyKSkge1xyXG4gICAgcmV0dXJuIG5ldyBEZXZpY2VXcmFwcGVyKGltcGwsIHNjaGVtYSk7XHJcbiAgfVxyXG4gIHRoaXMuaW1wbCA9IGltcGw7XHJcbiAgdGhpcy5zY2hlbWEgPSBzY2hlbWEgfHwgU2NoZW1hLmZyb21PYmplY3REZWZpbml0aW9uKGltcGwpO1xyXG4gIHRoaXMuY29uZmlnID0ge307XHJcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XHJcbiAgdGhpcy5zdHJpY3RTY2hlbWEgPSBvcHRpb25zLnN0cmljdFNjaGVtYSB8fCBmYWxzZTtcclxuXHJcbiAgLy8gTWFrZSBzdXJlIGltcGxlbWVudGF0aW9uIG9iamVjdCBpbXBsZW1lbnRzIGFsbCBvZiB0aGUgZnVuY3Rpb25zIGdpdmVuIGluXHJcbiAgLy8gdGhlIHNjaGVtYS5cclxuICBmb3IgKHZhciBtIGluIHRoaXMuc2NoZW1hLm1ldGhvZHMpIHtcclxuICAgIGlmICh0eXBlb2YgaW1wbFttXSAhPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1JlcXVpcmVkIG1ldGhvZCAnICsgbSArICcgaXMgbm90IGltcGxlbWVudGVkIGJ5IG9iamVjdC4nKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vIFdlIHdhbnQgdG8gYmUgbm90aWZpZWQgd2hlbmV2ZXIgdGhlIGltcGxlbWVudGF0aW9uIG9iamVjdCBtb2RpZmllcyBvbmUgb2ZcclxuICAvLyBpdHMgcHVibGljIHByb3BlcnRpZXMuIFRvIGRvIHRoaXMsIHdlIHJlcGxhY2UgdGhlIHVzZXItc3VwcGxpZWQgcHJvcGVydHlcclxuICAvLyAod2hpY2ggbWF5IGJlIGEgc2ltcGxlIG9iamVjdCwgb3Igc29tZSBjb21iaW5hdGlvbiBvZiBnZXR0ZXIvc2V0dGVyKSB3aXRoXHJcbiAgLy8gYSBuZXcgZ2V0dGVyL3NldHRlciBwYWlyIG9mIG91ciBvd24uIE91ciBpbXBsZW1lbnRhdGlvbiBpcyBlc3NlbnRpYWxseSBhXHJcbiAgLy8gJ3NweScgdGhhdCBjYWxscyB0aHJvdWdoIHRvIHRoZSBvcmlnaW5hbCBpbXBsZW1lbnRhdGlvbiB0cmFuc3BhcmVudGx5LlxyXG5cclxuICAvLyBDcmVhdGUgZ2V0dGVycy9zZXR0ZXJzIGZvciBhbGwgb2YgdGhlIHNjaGVtYS1kZWZpbmVkIHByb3BlcnRpZXMgdGhhdCB3cmFwXHJcbiAgLy8gdGhlIGRlZmluaXRpb25zIGdpdmVuIGluIHRoZSBpbXBsZW1lbnRhdGlvbi5cclxuXHJcbiAgLyoqXHJcbiAgICogSGVscGVyIG1ldGhvZCBmb3IgY3JlYXRpbmcgYSBnZXR0ZXIgLyBzZXR0ZXIgcGFpciBmb3IgYSBwcm9wZXJ0eS5cclxuICAgKlxyXG4gICAqIEBwYXJhbSB7RGV2aWNlV3JhcHBlcn0gdGFyZ2V0IFRoZSBkZXZpY2Ugb24gd2hpY2ggdGhlIG5ldyBnZXR0ZXIvc2V0dGVyIHdpbGxcclxuICAgKiAgYmUgZGVmaW5lZFxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBpbXBsIFVzZXItc3VwcGxpZWQgaW1wbGVtZW50YXRpb24gb2JqZWN0XHJcbiAgICogQHBhcmFtIHtTdHJpbmd9IHByb3BlcnR5IFRoZSBwcm9wZXJ0eSBuYW1lIHRvIGJlIHNwaWVkIG9uXHJcbiAgICovXHJcbiAgZnVuY3Rpb24gbWFrZVByb3BlcnR5U3B5KHRhcmdldCwgaW1wbCwgcHJvcGVydHkpIHtcclxuICAgIC8vIFJlbmFtZSB0aGUgb3JpZ2luYWwgcHJvcGVydHkgaW1wbGVtZW50YXRpb24uIE5vdGUgdGhhdCB3ZSBjYW4ndCBkbyBhXHJcbiAgICAvLyBzaW1wbGUgYXNzaWdubWVudCwgYmVjYXVzZSB0aGlzIHdvbid0IHdvcmsgY29ycmVjdGx5IHdpdGggZ2V0dGVycy5cclxuICAgIHZhciBpbXBsZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoaW1wbCwgcHJvcGVydHkpO1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGltcGwsICdfXycgKyBwcm9wZXJ0eSwgaW1wbGRlc2MpO1xyXG5cclxuICAgIHZhciBkZXNjID0geyBlbnVtZXJhYmxlOiB0cnVlIH07XHJcblxyXG4gICAgLy8gb25seSBjcmVhdGUgYSBnZXR0ZXIgZm9yIGRhdGEgZGVzY3JpcHRvcnMgKHRoYXQgaXMsIG5vcm1hbCBwcm9wZXJ0aWVzXHJcbiAgICAvLyBhdHRhY2hlZCB0byBhbiBvYmplY3QpLCBvciBhY2Nlc3NvciBkZXNjcmlwdG9ycyB3aXRoIGEgZ2V0dGVyLlxyXG4gICAgaWYgKHR5cGVvZihpbXBsZGVzYy52YWx1ZSkgIT09ICd1bmRlZmluZWQnIHx8IGltcGxkZXNjLmdldCAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgZGVzYy5nZXQgPSBmdW5jdGlvbiBnZXRTcHkoKSB7IHJldHVybiBpbXBsWydfXycgKyBwcm9wZXJ0eV07IH07XHJcbiAgICB9XHJcblxyXG4gICAgLy8gb25seSBjcmVhdGUgYSBzZXR0ZXIgZm9yIHdyaXRhYmxlIGRhdGEgZGVzY3JpcHRvcnMgb3IgYWNjZXNzb3JcclxuICAgIC8vIGRlc2NyaXB0b3JzIHdpdGggYSBzZXR0ZXIuXHJcbiAgICBpZiAoaW1wbGRlc2Mud3JpdGFibGUgfHwgaW1wbGRlc2Muc2V0ICE9PSAndW5kZWZpbmVkJykge1xyXG4gICAgICBkZXNjLnNldCA9ICBmdW5jdGlvbiBzZXRTcHkodmFsdWUpIHtcclxuICAgICAgICBpbXBsWydfXycgKyBwcm9wZXJ0eV0gPSB2YWx1ZTsgIC8vIGNhbGwgb3JpZ2luYWwgaW1wbGVtZW50YXRpb25cclxuICAgICAgICB0YXJnZXQucHV0KHByb3BlcnR5LCB2YWx1ZSk7ICAgIC8vIG5vdGlmeSBEZXZpY2VXcmFwcGVyXHJcbiAgICAgIH07XHJcbiAgICB9XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoaW1wbCwgcHJvcGVydHksIGRlc2MpO1xyXG4gIH1cclxuXHJcbiAgLy8gQ3JlYXRlIGEgc3B5IG1ldGhvZCBmb3IgZWFjaCBwcm9wZXJ0eSBpbiB0aGUgc2NoZW1hLlxyXG4gIGZvciAodmFyIHByb3AgaW4gdGhpcy5zY2hlbWEucHJvcGVydGllcykge1xyXG4gICAgaWYgKHRoaXMuc2NoZW1hLnByb3BlcnRpZXMuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcclxuICAgICAgLy8gSXQgaXMgcG9zc2libGUgdGhhdCB0aGUgaW1wbGVtZW50YXRpb24gb2JqZWN0IGRvZXNuJ3QgaGF2ZSBvbmUgb2YgdGhlXHJcbiAgICAgIC8vIGRlZmluZWQgcHJvcGVydGllcyBkZWZpbmVkLiBDcmVhdGUgYSBkZWZhdWx0IHByb3BlcnR5IG9mIHRoZSBjb3JyZWN0XHJcbiAgICAgIC8vIHR5cGUgc28gdGhhdCB0aGUgZ2V0dGVyL3NldHRlciBoYXMgc29tZXRoaW5nIHRvIHdyYXAuXHJcbiAgICAgIGlmICghKHByb3AgaW4gaW1wbCkpIHtcclxuICAgICAgICBpbXBsW3Byb3BdID0gdGhpcy5zY2hlbWEucHJvcGVydGllc1twcm9wXS5jb25zdHJ1Y3RvcigpO1xyXG4gICAgICB9XHJcbiAgICAgIG1ha2VQcm9wZXJ0eVNweSh0aGlzLCBpbXBsLCBwcm9wKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vIElmIHRoZSBpbXBsZW1lbnRhdGlvbiBkZXZpY2UgaXMgbm90IGFscmVhZHkgYW4gRXZlbnRFbWl0dGVyLCBnaXZlIGl0IGFuXHJcbiAgLy8gaW1wbGVtZW50YXRpb24uXHJcbiAgdmFyIHNlbGYgPSB0aGlzO1xyXG4gIGlmICh0eXBlb2YgaW1wbC5vbiAhPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgaW1wbC5fX2VtaXR0ZXIgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XHJcbiAgICBpbXBsLm9uID0gZnVuY3Rpb24oZXYsIGZuKSB7IHJldHVybiBpbXBsLl9fZW1pdHRlci5vbihldiwgZm4pOyB9O1xyXG4gICAgaW1wbC5lbWl0ID0gZnVuY3Rpb24oKSB7IHJldHVybiBpbXBsLl9fZW1pdHRlci5lbWl0LmFwcGx5KGltcGwsIGFyZ3VtZW50cyk7IH07XHJcbiAgfVxyXG5cclxuICAvLyBpbnN0YWxsIGVtaXQoKSBzcHkgdGhhdCBpbnZva2VzIG91ciBub3RpZnkoKVxyXG4gIGltcGwuX19lbWl0ID0gaW1wbC5lbWl0O1xyXG4gIGltcGwuZW1pdCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7ICAvLyBjb252ZXJ0IGFyZ3VtZW50cyB0byBBcnJheVxyXG4gICAgdmFyIGV2ZW50ID0gYXJncy5zaGlmdCgpO1xyXG5cclxuICAgIC8vIElmIHRoaXMgZXZlbnQgaXMgaW4gdGhlIGRldmljZSBzY2hlbWEsIG9yIHdlIGhhdmUgc3RyaWN0U2NoZW1hIG1vZGVcclxuICAgIC8vIGRpc2FibGVkLCB0aGVuIHNlbmQgdGhlIGV2ZW50IHZpYSBub3RpZnkoKS5cclxuICAgIGlmICghc2VsZi5zdHJpY3RTY2hlbWEgfHwgZXZlbnQgaW4gW3NlbGYuc2NoZW1hLmV2ZW50c10pIHtcclxuICAgICAgc2VsZi5ub3RpZnkoZXZlbnQsIGFyZ3MpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGltcGwuX19lbWl0LmFwcGx5KGltcGwsIGFyZ3VtZW50cyk7XHJcbiAgfTtcclxufVxyXG51dGlsLmluaGVyaXRzKERldmljZVdyYXBwZXIsIEV2ZW50RW1pdHRlcik7XHJcblxyXG4vKipcclxuICogR2V0IGEgbG9jYWwgZGV2aWNlIHByb3BlcnR5LlxyXG4gKlxyXG4gKiBGZXRjaGVzIHRoZSByZXF1ZXN0ZWQgZGV2aWNlIHByb3BlcnR5IGZyb20gdGhlIGltcGxlbWVudGF0aW9uIG9iamVjdC5cclxuICpcclxuICogQHBhcmFtIHtTdHJpbmd9IHByb3BlcnR5XHJcbiAqL1xyXG5EZXZpY2VXcmFwcGVyLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbihwcm9wZXJ0eSkge1xyXG4gIGlmICghdGhpcy5zY2hlbWEucHJvcGVydGllcy5oYXNPd25Qcm9wZXJ0eShwcm9wZXJ0eSkpIHtcclxuICAgIHRocm93IEVycm9yKCdQcm9wZXJ0eSAnICsgcHJvcGVydHkgKyAnIGlzIGludmFsaWQgZm9yIHNjaGVtYS4nKTtcclxuICB9XHJcbiAgcmV0dXJuIHRoaXMuaW1wbFsnX18nICsgcHJvcGVydHldO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFNldCBhIHByb3BlcnR5IG9uIGEgbG9jYWwgZGV2aWNlLlxyXG4gKlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gcHJvcGVydHlcclxuICogQHBhcmFtIHtPYmplY3R9IHZhbHVlXHJcbiAqL1xyXG5EZXZpY2VXcmFwcGVyLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbihwcm9wZXJ0eSwgdmFsdWUpIHtcclxuICBpZiAoIXRoaXMuc2NoZW1hLnByb3BlcnRpZXMuaGFzT3duUHJvcGVydHkocHJvcGVydHkpKSB7XHJcbiAgICB0aHJvdyBFcnJvcignUHJvcGVydHkgJyArIHByb3BlcnR5ICsgJyBpcyBpbnZhbGlkIGZvciBzY2hlbWEuJyk7XHJcbiAgfVxyXG4gIC8vIHNldCB0aGUgbG9jYWwgZGV2aWNlIHN0YXRlIGJ5IGludm9raW5nIHRoZSB1bmRlcmx5aW5nIGRldmljZSBpbXBsZW1lbnRhdGlvblxyXG4gIC8vIGZvciB0aGUgcHJvcGVydHkgKHdoaWNoIHdhcyByZW5hbWVkIHdoZW4gdGhlIHNweSB3YXMgaW5zdGFsbGVkKS5cclxuICB0aGlzLmltcGxbJ19fJyArIHByb3BlcnR5XSA9IHZhbHVlO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEludm9rZSBhIG1ldGhvZCBvbiBhIGxvY2FsIGRldmljZS5cclxuICpcclxuICogQHBhcmFtIHtTdHJpbmd9IG1ldGhvZFxyXG4gKiBAcGFyYW0ge0FycmF5fSBwYXJhbXMgTGlzdCBvZiBwYXJhbWV0ZXJzIHRvIHBhc3MgdG8gbWV0aG9kXHJcbiAqL1xyXG5EZXZpY2VXcmFwcGVyLnByb3RvdHlwZS5pbnZva2UgPSBmdW5jdGlvbihtZXRob2QsIHBhcmFtcykge1xyXG4gIGlmICghdGhpcy5zY2hlbWEubWV0aG9kcy5oYXNPd25Qcm9wZXJ0eShtZXRob2QpKSB7XHJcbiAgICB0aHJvdyBFcnJvcignTWV0aG9kICcgKyBtZXRob2QgKyAnIGlzIGludmFsaWQgZm9yIHNjaGVtYS4nKTtcclxuICB9XHJcbiAgdmFyIGltcGwgPSB0aGlzLmltcGw7XHJcbiAgdmFyIGFyZ3MgPSBwYXJhbXMgfHwgW107XHJcbiAgaWYgKCFBcnJheS5pc0FycmF5KGFyZ3MpKSB7XHJcbiAgICBhcmdzID0gW2FyZ3NdO1xyXG4gIH1cclxuICByZXR1cm4gaW1wbFttZXRob2RdLmFwcGx5KGltcGwsIGFyZ3MpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEdldCBkZXZpY2Ugc2NoZW1hIGluZm9ybWF0aW9uLlxyXG4gKlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gcHJvcGVydHkuIE1heWJlIGJlIG9uZSBvZiAuc2NoZW1hIG9yIC5jb25maWdcclxuICogQHJldHVybnMge09iamVjdH0gdGhlIGRldmljZSBzY2hlbWFcclxuICovXHJcbkRldmljZVdyYXBwZXIucHJvdG90eXBlLmRlc2NyaWJlID0gZnVuY3Rpb24ocHJvcGVydHkpIHtcclxuICBzd2l0Y2gocHJvcGVydHkpIHtcclxuICAgIGNhc2UgJy5zY2hlbWEnOlxyXG4gICAgICByZXR1cm4gdGhpcy5zY2hlbWE7XHJcbiAgICBjYXNlICcuY29uZmlnJzpcclxuICAgICAgcmV0dXJuIHRoaXMuY29uZmlnO1xyXG4gICAgZGVmYXVsdDpcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbnJlY29nbml6ZWQgZGVzY3JpYmUgcHJvcGVydHk6ICcgKyBwcm9wZXJ0eSk7XHJcbiAgfVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIENvbmZpZ3VyZSB0aGUgZGV2aWNlLlxyXG4gKlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gcHJvcGVydHkgQ3VycmVudGx5IHVudXNlZFxyXG4gKiBAcGFyYW0ge09iamVjdH0gY29uZmlnIENvbmZpZ3VyYXRpb24gb2JqZWN0XHJcbiAqL1xyXG5EZXZpY2VXcmFwcGVyLnByb3RvdHlwZS5jb25maWcgPSBmdW5jdGlvbihwcm9wZXJ0eSwgY29uZmlnKSB7XHJcbiAgZGVidWcoJ1VwZGF0aW5nIGNvbmZpZzogJyArIEpTT04uc3RyaW5naWZ5KGNvbmZpZywgbnVsbCwgMikpO1xyXG4gIHRoaXMuY29uZmlnID0gY29uZmlnO1xyXG4gIHJldHVybiB0cnVlO1xyXG59O1xyXG5cclxuXHJcblxyXG4vKipcclxuICogTm90aWZ5IHRoZSBsb2NhbCBkZXZpY2UgY29udGFpbmVyIG9mIGFuIGV2ZW50LlxyXG4gKlxyXG4gKiBUaGlzIG1ldGhvZCBpcyBpbnRlbmRlZCB0byBiZSBjYWxsZWQgYnkgdGhlIGRldmljZSBpbXBsZW1lbnRhdGlvbiBpdHNlbGYsXHJcbiAqIGFuZCBzaG91bGQgbm90IGJlIGNhbGxlZCBieSBvdGhlciBjb21wb25lbnRzLlxyXG4gKlxyXG4gKiBOb3RlIHRoYXQgZXZlbnRzIHRoYXQgYXJlIGRlZmluZWQgYXMgcGFydCBvZiB0aGUgZGV2aWNlIHNjaGVtYSBhcmVcclxuICogYXV0b21hdGljYWxseSBzZW50IHRvIHRoZSBkZXZpY2UgY29udGFpbmVyIHdoZW4gZW1pdCgpJ2QgYnkgdGhlIGRldmljZS5cclxuICpcclxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XHJcbiAqIEBwYXJhbSB7QXJyYXl9IHBhcmFtcyBBcnJheSBvZiBwYXJhbWV0ZXJzIHBhc3NlZCB0byBldmVudCBoYW5kbGVyXHJcbiAqIEBwcml2YXRlXHJcbiAqL1xyXG5EZXZpY2VXcmFwcGVyLnByb3RvdHlwZS5ub3RpZnkgPSBmdW5jdGlvbihldmVudCwgcGFyYW1zKSB7XHJcbiAgLy9wYXJhbXMudW5zaGlmdCgnbm90aWZ5JywgZXZlbnQpOyAgICAvLyBUaGlzIGJyZWFrcyBvbiBUZXNzZWxcclxuICBwYXJhbXMudW5zaGlmdChldmVudCk7XHJcbiAgcGFyYW1zLnVuc2hpZnQoJ25vdGlmeScpO1xyXG4gIHRoaXMuZW1pdC5hcHBseSh0aGlzLCBwYXJhbXMpOyAgLy8gZW1pdCgnbm90aWZ5JywgJ2N1c3RvbUV2ZW50JywgcGFyYW1zKVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIFB1dCBhIG5ldyBtZXRyaWMgdmlhIHRoZSBsb2NhbCBkZXZpY2UgY29udGFpbmVyLlxyXG4gKlxyXG4gKiBUaGlzIG1ldGhvZCBtYXkgYmUgdXNlZCBieSBhbnkgdXNlci1zdXBwbGllZCBjb2RlIHRvIG5vdGlmeSB0aGUgZGV2aWNlXHJcbiAqIGNvbnRhaW5lciBvZiBhbiB1cGRhdGVkIGRldmljZSBtZXRyaWMuXHJcbiAqXHJcbiAqIENoYW5nZXMgdG8gcHVibGljIHByb3BlcnRpZXMgYXJlIGF1dG9tYXRpY2FsbHkgZGV0ZWN0ZWQsIGFuZCBwdXQoKSBpbnZva2VkLlxyXG4gKlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gbWV0cmljXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWx1ZVxyXG4gKiBAcHJpdmF0ZVxyXG4gKi9cclxuRGV2aWNlV3JhcHBlci5wcm90b3R5cGUucHV0ID0gZnVuY3Rpb24obWV0cmljLCB2YWx1ZSkge1xyXG4gIHRoaXMuZW1pdCgncHV0JywgbWV0cmljLCB2YWx1ZSk7XHJcbn07XHJcblxyXG4iLCIvKipcclxuICogTW9kdWxlIERlcGVuZGVuY2llcy5cclxuICovXHJcbnZhciB3aGVuID0gcmVxdWlyZSgnd2hlbicpO1xyXG52YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xyXG52YXIgdXRpbCA9IHJlcXVpcmUoJ3V0aWwnKTtcclxuXHJcbi8qKlxyXG4gKiBFeHBvcnQgUHJveHlXcmFwcGVyIGNvbnN0cnVjdG9yXHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IFByb3h5V3JhcHBlcjtcclxuXHJcbi8qKlxyXG4gKiBOYXRpdmUgd3JhcHBlciBmb3IgT3JnYW5pcSBkZXZpY2UgcHJveHkuXHJcbiAqXHJcbiAqIHZhciBwcm94eSA9IG9yZ2FuaXEuZ2V0RGV2aWNlKCk7XHJcbiAqIHByb3h5LmNhbGxNZXRob2QoKTtcclxuICogcHJveHkuc3luYyhmdW5jdGlvbigpIHtcclxuICogIHZhciBzb21lUHJvcCA9IHByb3h5LnByb3BWYWx1ZTtcclxuICogIHZhciBhbm90aGVyUHJvcCA9IHByb3h5LmFub3RoZXJWYWx1ZTtcclxuICogfSk7XHJcbiAqIHByb3h5Lm9uKCdzb21lRXZlbnQnLCBmdW5jdGlvbihldikge1xyXG4gKiAgLy8gcHJvY2VzcyBldmVudFxyXG4gKiB9KVxyXG4gKlxyXG4gKiBAcGFyYW0ge1NjaGVtYX0gc2NoZW1hXHJcbiAqIEBwYXJhbSB7TG9jYWxEZXZpY2VQcm94eX0gcHJveHlcclxuICogQGNvbnN0cnVjdG9yXHJcbiAqL1xyXG5mdW5jdGlvbiBQcm94eVdyYXBwZXIoc2NoZW1hLCBwcm94eSkge1xyXG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBQcm94eVdyYXBwZXIpKSB7XHJcbiAgICByZXR1cm4gbmV3IFByb3h5V3JhcHBlcihzY2hlbWEsIHByb3h5KTtcclxuICB9XHJcblxyXG4gIHNjaGVtYSA9IHNjaGVtYSB8fCB7IHByb3BlcnRpZXM6IHt9LCBtZXRob2RzOiB7fSwgZXZlbnRzOiB7fSB9O1xyXG4gIHZhciBjYWNoZSA9IHt9O1xyXG5cclxuICAvLyBidWlsZCBtZXRob2RzIG9uIHRoZSBwcm94eSBvYmplY3Qgd2l0aCBuYW1lcyBtYXRjaGluZyB3aGF0J3MgaW4gc2NoZW1hLlxyXG4gIHZhciBtZXRob2RzID0gc2NoZW1hLm1ldGhvZHM7XHJcbiAgZnVuY3Rpb24gbWFrZU1ldGhvZChtZXRob2QpIHtcclxuICAgIHJldHVybiBmdW5jdGlvbigpIHtcclxuICAgICAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7IC8vIHBhY2sgaW50byAncmVhbCcgYXJyYXlcclxuICAgICAgcmV0dXJuIHByb3h5Lmludm9rZShtZXRob2QsIGFyZ3MpO1xyXG4gICAgfTtcclxuICB9XHJcbiAgZm9yKHZhciBtZXRob2QgaW4gbWV0aG9kcykge1xyXG4gICAgaWYgKG1ldGhvZHMuaGFzT3duUHJvcGVydHkobWV0aG9kKSkge1xyXG4gICAgICB0aGlzW21ldGhvZF0gPSBtYWtlTWV0aG9kKG1ldGhvZCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyBidWlsZCBnZXR0ZXJzL3NldHRlcnMgZm9yIHRoZSBwcm9wZXJ0aWVzXHJcbiAgdmFyIHByb3BlcnRpZXMgPSBzY2hlbWEucHJvcGVydGllcztcclxuICBmdW5jdGlvbiBtYWtlUHJvcGVydHkob2JqLCBwcm9wZXJ0eSkge1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgcHJvcGVydHksIHtcclxuICAgICAgZ2V0OiBmdW5jdGlvbigpIHsgcmV0dXJuIGNhY2hlW3Byb3BlcnR5XTsgfSxcclxuICAgICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkgeyB0aGlzLnNldChwcm9wZXJ0eSwgdmFsdWUpOyB9LFxyXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXHJcbiAgICB9KTtcclxuICB9XHJcbiAgZm9yKHZhciBwcm9wZXJ0eSBpbiBwcm9wZXJ0aWVzKSB7XHJcbiAgICBpZiAocHJvcGVydGllcy5oYXNPd25Qcm9wZXJ0eShwcm9wZXJ0eSkpIHtcclxuICAgICAgbWFrZVByb3BlcnR5KHRoaXMsIHByb3BlcnR5KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vIFJlZ2lzdGVyIGV2ZW50IGhhbmRsZXJzLlxyXG4gIHZhciBzZWxmID0gdGhpcztcclxuICBwcm94eS5vbignbm90aWZ5JywgZnVuY3Rpb24oZXZlbnQsIGFyZ3MpIHtcclxuICAgIGlmICghQXJyYXkuaXNBcnJheShhcmdzKSkge1xyXG4gICAgICBhcmdzID0gW2FyZ3NdO1xyXG4gICAgfVxyXG4gICAgYXJncy51bnNoaWZ0KGV2ZW50KTtcclxuICAgIHNlbGYuZW1pdC5hcHBseShzZWxmLCBhcmdzKTsgLy8gZS5nLiwgdGhpcy5lbWl0KCdjdXN0b20nLCBhcmcwLCBhcmcxLCAuLi4pXHJcbiAgfSk7XHJcblxyXG4gIHByb3h5Lm9uKCdwdXQnLCBmdW5jdGlvbihtZXRyaWMsIHZhbHVlKSB7XHJcbiAgICBzZWxmLmVtaXQobWV0cmljLCB2YWx1ZSk7XHJcbiAgfSk7XHJcblxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBkZXZpY2UgcHJvcGVydHkgZnJvbSB0aGUgcmVtb3RlIGRldmljZS5cclxuICAgKlxyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBwcm9wZXJ0eVxyXG4gICAqIEByZXR1cm5zIHtQcm9taXNlfCp9XHJcbiAgICovXHJcbiAgdGhpcy5nZXQgPSBmdW5jdGlvbihwcm9wZXJ0eSkge1xyXG4gICAgcmV0dXJuIHByb3h5LmdldChwcm9wZXJ0eSkudGhlbihcclxuICAgICAgZnVuY3Rpb24ocmVzKSB7IGNhY2hlW3Byb3BlcnR5XSA9IHJlczsgcmV0dXJuIHJlczsgfVxyXG4gICAgKTtcclxuICB9O1xyXG5cclxuICAvKipcclxuICAgKiBTZXQgYSBkZXZpY2UgcHJvcGVydHkgb24gdGhlIHJlbW90ZSBkZXZpY2UuXHJcbiAgICpcclxuICAgKlxyXG4gICAqIHByb3h5LnNldCgncHJvcCcsICcxJyk7XHJcbiAgICogdmFyIHAgPSBwcm94eS5nZXQoJ3Byb3AnKTsgLy8gbWlnaHQgbm90IGdldCAnMSchXHJcbiAgICpcclxuICAgKiBAcGFyYW0ge1N0cmluZ30gcHJvcGVydHkgVGhlIHByb3BlcnR5IHdob3NlIHZhbHVlIGlzIHRvIGJlIHNldC5cclxuICAgKiBAcGFyYW0geyp9IHZhbHVlIFRoZSBuZXcgdmFsdWUgZm9yIHRoZSBwcm9wZXJ0eS5cclxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyBPcHRpb25zIGZvciBob3cgdG8gaGFuZGxlIHNldHRpbmdcclxuICAgKiBAcGFyYW0ge0Jvb2xlYW49fSBvcHRpb25zLm9wdGltaXN0aWMgSWYgYHRydWVgLCB0aGUgbmV3IHZhbHVlIHdpbGwgYmVcclxuICAgKiAgYXNzaWduZWQgdG8gdGhlIGxvY2FsIHByb3BlcnR5IGltbWVkaWF0ZWx5LCBiZWZvcmUgdGhlIHJlbW90ZSBvcGVyYXRpb25cclxuICAgKiAgY29tcGxldGVzLiBJZiB0aGUgc2V0IG9wZXJhdGlvbiBmYWlscywgaXQgd2lsbCBiZSByZXZlcnRlZCB0byB0aGVcclxuICAgKiAgb3JpZ2luYWwgdmFsdWUuIERlZmF1bHQgaXMgdHJ1ZS5cclxuICAgKiBAcGFyYW0ge0Jvb2xlYW49fSBvcHRpb25zLnVwZGF0ZU9uU3VjY2VzcyBJZiBgdHJ1ZWAsIHRoZSBsb2NhbCBwcm9wZXJ0eVxyXG4gICAqICB2YWx1ZSB3aWxsIGJlIHNldCB0byBgdmFsdWVgIHVwb24gc3VjY2Vzc2Z1bCBjb21wbGV0aW9uLiBEZWZhdWx0IGlzIHRydWUuXHJcbiAgICogQHJldHVybnMge1Byb21pc2V8Kn1cclxuICAgKi9cclxuICB0aGlzLnNldCA9IGZ1bmN0aW9uKHByb3BlcnR5LCB2YWx1ZSwgb3B0aW9ucykge1xyXG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XHJcbiAgICB2YXIgb3B0aW1pc3RpYyA9IG9wdGlvbnMub3B0aW1pc3RpYyAhPT0gZmFsc2U7ICAgICAgICAvLyBkZWZhdWx0IHRydWVcclxuICAgIHZhciB1cGRhdGVPblN1Y2Nlc3MgPSBvcHRpb25zLnVwZGF0ZU9uU3VjY2VzcyAhPT0gZmFsc2U7ICAvLyBkZWZhdWx0IHRydWVcclxuXHJcbiAgICAvLyBTYXZlIG9mZiB0aGUgY3VycmVudCB2YWx1ZSBvZiB0aGUgcHJvcGVydHkgaW4gdGhlIGV2ZW50IHdlIG5lZWQgdG9cclxuICAgIC8vIHJlc3RvcmUgaXQuXHJcbiAgICB2YXIgb2xkVmFsdWUgPSBwcm9wZXJ0eSBpbiBjYWNoZSA/IGNhY2hlW3Byb3BlcnR5XTogdW5kZWZpbmVkO1xyXG4gICAgaWYgKG9wdGltaXN0aWMpIHtcclxuICAgICAgY2FjaGVbcHJvcGVydHldID0gdmFsdWU7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHByb3h5LnNldChwcm9wZXJ0eSwgdmFsdWUpLnRoZW4oXHJcbiAgICAgIGZ1bmN0aW9uKHJlcykge1xyXG4gICAgICAgIGlmICh1cGRhdGVPblN1Y2Nlc3MpIHtcclxuICAgICAgICAgIGNhY2hlW3Byb3BlcnR5XSA9IHZhbHVlO1xyXG4gICAgICAgICAgcmV0dXJuIHJlcztcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICkuY2F0Y2goXHJcbiAgICAgIGZ1bmN0aW9uKGVycikge1xyXG4gICAgICAgIC8vIGRvbid0IHJlc2V0IHRoZSB2YWx1ZSBpZiBpdCdzIGRpZmZlcmVudCBmcm9tIHdoYXQgaXQgd2FzIHdoZW4gd2VcclxuICAgICAgICAvLyBmaXJzdCBzZXQgaXQuXHJcbiAgICAgICAgaWYgKG9wdGltaXN0aWMgJiYgY2FjaGVbcHJvcGVydHldID09PSB2YWx1ZSkge1xyXG4gICAgICAgICAgY2FjaGVbcHJvcGVydHldID0gb2xkVmFsdWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRocm93IGVycjtcclxuICAgICAgfSk7XHJcbiAgfTtcclxuXHJcbiAgLyoqXHJcbiAgICogSW52b2tlIGEgbWV0aG9kIG9uIHRoZSByZW1vdGUgZGV2aWNlLlxyXG4gICAqXHJcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1ldGhvZCBOYW1lIG9mIHRoZSBtZXRob2QgdG8gaW52b2tlLlxyXG4gICAqIEBwYXJhbSB7QXJyYXl9IGFyZ3MgTGlzdCBvZiBhcmd1bWVudHMgdG8gcGFzcyB0byB0aGUgbWV0aG9kLlxyXG4gICAqIEByZXR1cm5zIHsqfVxyXG4gICAqL1xyXG4gIHRoaXMuaW52b2tlID0gZnVuY3Rpb24obWV0aG9kLCBhcmdzKSB7XHJcbiAgICByZXR1cm4gcHJveHkuaW52b2tlKG1ldGhvZCwgYXJncyk7XHJcbiAgfTtcclxuXHJcbiAgLyoqXHJcbiAgICogQ29uZmlndXJlIHRoZSByZW1vdGUgZGV2aWNlLlxyXG4gICAqXHJcbiAgICogQHBhcmFtIGNvbmZpZ1xyXG4gICAqIEByZXR1cm5zIHsqfVxyXG4gICAqL1xyXG4gIHRoaXMuY29uZmlnID0gZnVuY3Rpb24oY29uZmlnKSB7XHJcbiAgICByZXR1cm4gcHJveHkuY29uZmlnKGNvbmZpZyk7XHJcbiAgfTtcclxuXHJcbiAgLyoqXHJcbiAgICogU3luY2hyb25pemUgb25lIG9yIG1vcmUgZGV2aWNlIHByb3BlcnRpZXMuXHJcbiAgICpcclxuICAgKiBQcm9wZXJ0eSB2YWx1ZXMgYXJlIG5vdCBhdXRvbWF0aWNhbGx5IHN5bmNocm9uaXplZCB3aGVuIHRoZSByZW1vdGUgZGV2aWNlXHJcbiAgICogd2hlbiByZWFkLiBJbnN0ZWFkLCBgc3luY2AgbXVzdCBiZSB1c2VkIHRvIHN5bmNocm9uaXplIHRoZSBsb2NhbCBzdGF0ZVxyXG4gICAqIHdpdGggdGhlIHN0YXRlIGZyb20gdGhlIHJlbW90ZSBkZXZpY2UuXHJcbiAgICpcclxuICAgKiBAcGFyYW0ge0FycmF5PX0gcHJvcGVydGllcyBMaXN0IG9mIHByb3BlcnRpZXMgdG8gc3luYy4gSWYgbm90IHNwZWNpZmllZCxcclxuICAgKiAgdGhpcyBkZWZhdWx0cyB0byBhbGwgcHJvcGVydGllcywgd2hpY2ggY2FuIGJlIGV4cGVuc2l2ZSBpZiB0aGUgZGV2aWNlIGhhc1xyXG4gICAqICBtYW55IGRlZmluZWQgcHJvcGVydGllcy5cclxuICAgKiBAcmV0dXJucyB7UHJvbWlzZX0gQSBwcm9taXNlIGZvciB0aGUgYXJyYXkgb2YgcHJvcGVydGllcyByZXRyaWV2ZWQuXHJcbiAgICovXHJcbiAgdGhpcy5zeW5jID0gZnVuY3Rpb24ocHJvcGVydGllcykge1xyXG4gICAgdmFyIGQgPSBbXTtcclxuICAgIHByb3BlcnRpZXMgPSBwcm9wZXJ0aWVzIHx8IHNjaGVtYS5wcm9wZXJ0aWVzO1xyXG4gICAgZm9yKHZhciBwcm9wZXJ0eSBpbiBwcm9wZXJ0aWVzKSB7XHJcbiAgICAgIGlmIChwcm9wZXJ0aWVzLmhhc093blByb3BlcnR5KHByb3BlcnR5KSkge1xyXG4gICAgICAgIGQucHVzaCh0aGlzLmdldChwcm9wZXJ0eSkpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gd2hlbi5hbGwoZCk7XHJcbiAgfTtcclxufVxyXG51dGlsLmluaGVyaXRzKFByb3h5V3JhcHBlciwgRXZlbnRFbWl0dGVyKTtcclxuXHJcbiIsIi8qKlxyXG4gKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxyXG4gKi9cclxuXHJcblxyXG4vKipcclxuICogT3JnYW5pcSBSZXF1ZXN0IHByb3RvdHlwZS5cclxuICovXHJcblxyXG52YXIgZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gT3JnYW5pcVJlcXVlc3Q7XHJcbnZhciB1cHN0cmVhbU1ldGhvZHMgPSBbJ05PVElGWScsICdQVVQnXTtcclxudmFyIGRvd25zdHJlYW1NZXRob2RzID0gWydHRVQnLCAnU0VUJywgJ0lOVk9LRScsICdTVUJTQ1JJQkUnLCAnQ09ORklHJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICdERVNDUklCRSddO1xyXG5cclxuLypcclxuICogSW50ZXJuYWwgcmVxdWVzdCByZXByZXNlbnRhdGlvbi5cclxuICpcclxuICogQW4gT3JnYW5pcVJlcXVlc3Qgb2JqZWN0IGlzIHVzZWQgdG8gbW92ZSByZXF1ZXN0cyB0aHJvdWdoIHRoZSBzeXN0ZW0gYWZ0ZXJcclxuICogdGhleSBoYXZlIGJlZW4gcmVjZWl2ZWQgZnJvbSB0aGUgbmV0d29yayBvciBvdGhlciB0cmFuc3BvcnQuIEl0IGlzIHRoaXNcclxuICogb2JqZWN0IHRoYXQgaXMgZ2l2ZW4gdG8gZWFjaCBsYXllciBvZiB0aGUgbWlkZGxld2FyZSBzdGFjay5cclxuICpcclxuICogVGhlc2Ugb2JqZWN0cyBhcmUgbm9ybWFsbHkgY3JlYXRlZCB2aWEgdGhlIGZhY3RvcnkgZnVuY3Rpb25zIGF0dGFjaGVkIHRvXHJcbiAqIHRoaXMgY29uc3RydWN0b3IsIGUuZy4sIE9yZ2FuaXFSZXF1ZXN0LmdldCgpLCBPcmdhbmlxUmVxdWVzdC5pbnZva2UoKSwgZXRjLlxyXG4gKlxyXG4gKiBAcmV0dXJucyB7T3JnYW5pcVJlcXVlc3R9XHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKi9cclxuZnVuY3Rpb24gT3JnYW5pcVJlcXVlc3QoZGV2aWNlaWQsIG1ldGhvZCkge1xyXG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBPcmdhbmlxUmVxdWVzdCkpIHtcclxuICAgIHJldHVybiBuZXcgT3JnYW5pcVJlcXVlc3QoZGV2aWNlaWQsIG1ldGhvZCk7XHJcbiAgfVxyXG5cclxuICB0aGlzLmRldmljZWlkID0gZGV2aWNlaWQ7ICAgLy8gdGFyZ2V0IGRldmljZVxyXG4gIHRoaXMubWV0aG9kID0gbWV0aG9kOyAgIC8vIG9uZSBvZiBHRVQsIFNFVCwgSU5WT0tFLCAuLi5cclxuICB0aGlzLmlkZW50aWZpZXIgPSBudWxsOyAvLyBwcm9wZXJ0eSwgbWV0aG9kLCBvciBtZXRyaWMgbmFtZSAoaWYgYXBwbGljYWJsZSlcclxuICB0aGlzLnZhbHVlID0gbnVsbDsgICAgICAvLyBwcm9wZXJ0eSBvciBtZXRyaWMgdmFsdWUgYmVpbmcgU0VUIG9yIFBVVFxyXG4gIHRoaXMucGFyYW1zID0ge307ICAgICAgIC8vIHBhcmFtZXRlcnMgb2YgbWV0aG9kIG9yIGV2ZW50IChJTlZPS0Ugb3IgTk9USUZZKVxyXG4gIHRoaXMucmVxaWQgPSBudWxsOyAgICAgIC8vIHVuaXF1ZSByZXF1ZXN0IGlkIHVzZWQgZm9yIG92ZXJsYXBwZWQgcmVxdWVzdHNcclxufVxyXG5cclxuZXhwb3J0cy5nZXQgPSBmdW5jdGlvbihkZXZpY2VpZCwgcHJvcGVydHkpIHtcclxuICB2YXIgcmVxID0gbmV3IE9yZ2FuaXFSZXF1ZXN0KGRldmljZWlkLCAnR0VUJyk7XHJcbiAgcmVxLmlkZW50aWZpZXIgPSBwcm9wZXJ0eTtcclxuICByZXR1cm4gcmVxO1xyXG59O1xyXG5leHBvcnRzLnNldCA9IGZ1bmN0aW9uKGRldmljZWlkLCBwcm9wZXJ0eSwgdmFsdWUpIHtcclxuICB2YXIgcmVxID0gbmV3IE9yZ2FuaXFSZXF1ZXN0KGRldmljZWlkLCAnU0VUJyk7XHJcbiAgcmVxLmlkZW50aWZpZXIgPSBwcm9wZXJ0eTtcclxuICByZXEudmFsdWUgPSB2YWx1ZTtcclxuICByZXR1cm4gcmVxO1xyXG59O1xyXG5leHBvcnRzLmludm9rZSA9IGZ1bmN0aW9uKGRldmljZWlkLCBtZXRob2QsIHBhcmFtcykge1xyXG4gIHZhciByZXEgPSBuZXcgT3JnYW5pcVJlcXVlc3QoZGV2aWNlaWQsICdJTlZPS0UnKTtcclxuICByZXEuaWRlbnRpZmllciA9IG1ldGhvZDtcclxuICByZXEucGFyYW1zID0gcGFyYW1zO1xyXG4gIHJldHVybiByZXE7XHJcbn07XHJcbmV4cG9ydHMuc3Vic2NyaWJlID0gZnVuY3Rpb24oZGV2aWNlaWQsIGV2ZW50KSB7XHJcbiAgdmFyIHJlcSA9IG5ldyBPcmdhbmlxUmVxdWVzdChkZXZpY2VpZCwgJ1NVQlNDUklCRScpO1xyXG4gIHJlcS5pZGVudGlmaWVyID0gZXZlbnQ7XHJcbiAgcmV0dXJuIHJlcTtcclxufTtcclxuZXhwb3J0cy5kZXNjcmliZSA9IGZ1bmN0aW9uKGRldmljZWlkLCBwcm9wZXJ0eSkge1xyXG4gIHZhciByZXEgPSBuZXcgT3JnYW5pcVJlcXVlc3QoZGV2aWNlaWQsICdERVNDUklCRScpO1xyXG4gIHJlcS5pZGVudGlmaWVyID0gcHJvcGVydHk7XHJcbiAgcmV0dXJuIHJlcTtcclxufTtcclxuZXhwb3J0cy5jb25maWcgPSBmdW5jdGlvbihkZXZpY2VpZCwgcHJvcGVydHksIHZhbHVlKSB7XHJcbiAgdmFyIHJlcSA9IG5ldyBPcmdhbmlxUmVxdWVzdChkZXZpY2VpZCwgJ0NPTkZJRycpO1xyXG4gIHJlcS5pZGVudGlmaWVyID0gcHJvcGVydHk7XHJcbiAgcmVxLnZhbHVlID0gdmFsdWU7XHJcbiAgcmV0dXJuIHJlcTtcclxufTtcclxuZXhwb3J0cy5wdXQgPSBmdW5jdGlvbihkZXZpY2VpZCwgbWV0cmljLCB2YWx1ZSkge1xyXG4gIHZhciByZXEgPSBuZXcgT3JnYW5pcVJlcXVlc3QoZGV2aWNlaWQsICdQVVQnKTtcclxuICByZXEuaWRlbnRpZmllciA9IG1ldHJpYztcclxuICByZXEudmFsdWUgPSB2YWx1ZTtcclxuICByZXR1cm4gcmVxO1xyXG59O1xyXG5leHBvcnRzLm5vdGlmeSA9IGZ1bmN0aW9uKGRldmljZWlkLCBldmVudCwgcGFyYW1zKSB7XHJcbiAgdmFyIHJlcSA9IG5ldyBPcmdhbmlxUmVxdWVzdChkZXZpY2VpZCwgJ05PVElGWScpO1xyXG4gIHJlcS5pZGVudGlmaWVyID0gZXZlbnQ7XHJcbiAgcmVxLnBhcmFtcyA9IHBhcmFtcztcclxuICByZXR1cm4gcmVxO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIE9yZ2FuaXFSZXF1ZXN0IGluc3RhbmNlIG1ldGhvZHMuXHJcbiAqL1xyXG52YXIgcHJvdG8gPSBPcmdhbmlxUmVxdWVzdC5wcm90b3R5cGU7XHJcblxyXG4vKipcclxuICogU3BlY2lmaWVzIHdoZXRoZXIgdGhlIHJlcXVlc3Qgb3JpZ2luYXRlZCBmcm9tIGFuIGFwcGxpY2F0aW9uIHJlcXVlc3RcclxuICogKGFzIG9wcG9zZWQgdG8gYSBkZXZpY2Ugbm90aWZpY2F0aW9uKS5cclxuICpcclxuICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAqL1xyXG5wcm90by5pc0FwcGxpY2F0aW9uT3JpZ2luYXRlZCA9IGZ1bmN0aW9uIGlzQXBwbGljYXRpb25PcmlnaW5hdGVkKCkge1xyXG4gIHJldHVybiBkb3duc3RyZWFtTWV0aG9kcy5pbmRleE9mKHRoaXMubWV0aG9kKSAhPT0gLTE7XHJcbn07XHJcblxyXG4vKipcclxuICogU3BlY2lmaWVzIHdoZXRoZXIgdGhlIHJlcXVlc3Qgb3JpZ2luYXRlZCBmcm9tIGEgZGV2aWNlIG5vdGlmaWNhdGlvblxyXG4gKiAoYXMgb3Bwb3NlZCB0byBhbiBhcHBsaWNhdGlvbiByZXF1ZXN0KS5cclxuICpcclxuICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAqL1xyXG5wcm90by5pc0RldmljZU9yaWdpbmF0ZWQgPSBmdW5jdGlvbiBpc0RldmljZU9yaWdpbmF0ZWQoKSB7XHJcbiAgcmV0dXJuIHVwc3RyZWFtTWV0aG9kcy5pbmRleE9mKHRoaXMubWV0aG9kKSAhPT0gLTE7XHJcbn07XHJcbiIsIi8qKlxyXG4gKiBNb2R1bGUgRGVwZW5kZW5jaWVzLlxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBFeHBvcnQgU2NoZW1hIGNvbnN0cnVjdG9yXHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IFNjaGVtYTtcclxuXHJcblxyXG4vKipcclxuICogUmVzZXJ2ZWQgbmFtZXMgKGZvciBwcm9wZXJ0aWVzLCBldmVudHMsIG1ldGhvZHMpIHRoYXQgd2lsbCBub3QgYmUgbWFwcGVkIHRvXHJcbiAqIHRoZSBzY2hlbWEuXHJcbiAqXHJcbiAqIE5vdGUgdGhhdCBhbnkgbmFtZSBzdGFydGluZyB3aXRoIGFuIHVuZGVyc2NvcmUgaXMgYWxzbyBza2lwcGVkLlxyXG4gKlxyXG4gKiBAdHlwZSB7c3RyaW5nW119XHJcbiAqL1xyXG52YXIgcmVzZXJ2ZWROYW1lcyA9IFtcclxuICAnb24nLCAnZW1pdCdcclxuXTtcclxuXHJcbi8vXHJcbi8vIFNjaGVtYVxyXG4vL1xyXG4vLyBFdmVyeSBEZXZpY2Ugb2JqZWN0IGhhcyBhbiBhc3NvY2lhdGVkIHNjaGVtYSB3aGljaCBwcm92aWRlcyBpbmZvcm1hdGlvblxyXG4vLyBhYm91dCB0aGUgbWV0aG9kcywgcHJvcGVydGllcywgYW5kIGV2ZW50cyBzdXBwb3J0ZWQgYnkgdGhhdCBkZXZpY2UuIFRoZVxyXG4vLyBTY2hlbWEgZGVmaW5lcyB0aGUgRGV2aWNlIGludGVyZmFjZSBjb21wbGV0ZWx5LCBhbmQgYWxsb3dzIGZvciB2YWxpZGF0aW9uXHJcbi8vIGFuZCBhdXRob3JpemF0aW9uIG9mIG9wZXJhdGlvbnMgaW52b2x2aW5nIHRoZSBEZXZpY2UuXHJcbi8vXHJcbi8vIFNjaGVtYSBvYmplY3RzIGNhbiBiZSBjb25zdHJ1Y3RlZCBtYW51YWxseSwgb3IgdGhleSBtYXkgYmUgaW5mZXJyZWRcclxuLy8gYXV0b21hdGljYWxseSBieSB0aGUgb2JqZWN0IHBhc3NlZCB0byB0aGUgRGV2aWNlIGNvbnN0cnVjdG9yL2RlZmluZS4gRXhwbGljaXRcclxuLy8gZGVmaW5pdGlvbiBpcyBwcmVmZXJyZWQgdG8gYXZvaWQgdGhlIHBvc3NpYmlsaXR5IG9mICdsZWFrYWdlJyAoZS5nLiwgcHJpdmF0ZVxyXG4vLyBkZXZpY2Ugc3RhdGUvaW5mb3JtYXRpb24gYmVpbmcgZXhwb3NlZCB0byBleHRlcm5hbCBwYXJ0aWVzKS5cclxuLy9cclxuLy8gQSBTY2hlbWEgaXMgYSBmYWlybHkgc2ltcGxlIG9iamVjdDogaXQgaGFzIHRocmVlIHN1Yi1vYmplY3RzLCBvbmUgZWFjaFxyXG4vLyBmb3IgcHJvcGVydGllcywgbWV0aG9kcywgYW5kIGV2ZW50cy4gRWFjaCBvZiB0aGVzZSwgaW4gdHVybiwgaGF2ZSBvbmVcclxuLy8gcHJvcGVydHkgZm9yIGVhY2ggJ21lbWJlcicsIHdpdGggdGhlIHZhbHVlIG9mIGVhY2ggbWVtYmVyIGdpdmluZyBpdHNcclxuLy8gdHlwZSAoaS5lLiwgdGhlIEZ1bmN0aW9uIG9iamVjdCB0aGF0IGlzIHVzZWQgdG8gY3JlYXRlIGluc3RhbmNlcyBvZiB0aGF0XHJcbi8vIHR5cGUpLlxyXG4vL1xyXG4vLyBUaGUgY3VycmVudCBzZXQgb2Ygc3VwcG9ydGVkIHR5cGVzIGFyZSBsaW1pdGVkIHRvICBKYXZhU2NyaXB0J3MgQm9vbGVhbixcclxuLy8gTnVtYmVyLCBhbmQgU3RyaW5nLCBhcyB3ZWxsIGFzIGxpc3RzIGFuZCBkaWN0aW9uYXJpZXMgKG9iamVjdHMpIGNvbXBvc2VkIG9mXHJcbi8vIHRob3NlIHR5cGVzLlxyXG4vL1xyXG5mdW5jdGlvbiBTY2hlbWEoYXR0cmlidXRlcykge1xyXG4gIHRoaXMucHJvcGVydGllcyA9IGF0dHJpYnV0ZXMucHJvcGVydGllcztcclxuICB0aGlzLm1ldGhvZHMgPSBhdHRyaWJ1dGVzLm1ldGhvZHM7XHJcbiAgdGhpcy5ldmVudHMgPSBhdHRyaWJ1dGVzLmV2ZW50cztcclxufVxyXG5cclxuLy8gQnVpbGQgYSBTY2hlbWEgb2JqZWN0IGJhc2VkIG9uIGEgcHJvdmlkZWQgb2JqZWN0LlxyXG4vL1xyXG4vLyBJbiBhZGRpdGlvbiwgaWYgYW4gYXR0cmlidXRlIHdpdGggdGhlIG5hbWUgYGV2ZW50c2AgaXMgcHJlc2VudCwgaXQgaXNcclxuLy8gYXNzdW1lZCB0byBiZSBhbiBhcnJheSBvZiBzdHJpbmdzIGRvY3VtZW50aW5nIHRoZSBldmVudHMgZW1pdHRlZCBieVxyXG4vLyB0aGlzIG9iamVjdC5cclxuLy9cclxuLy8gQ2hlY2sgaGVyZTpcclxuLy8gaHR0cDovL2phdmFzY3JpcHR3ZWJsb2cud29yZHByZXNzLmNvbVxyXG4vLyAgLzIwMTEvMDgvMDgvZml4aW5nLXRoZS1qYXZhc2NyaXB0LXR5cGVvZi1vcGVyYXRvci9cclxuLy8gZm9yIGEgd2F5IHRoYXQgd2UgY2FuIGdldCBiZXR0ZXIgdHlwZSBpbmZvcm1hdGlvbi5cclxuLy9cclxuLyoqXHJcbiAqIENvbnN0cnVjdCBhIFNjaGVtYSBvYmplY3QgYmFzZWQgb24gYSBwcm92aWRlZCBvYmplY3QgZGVmaW5pdGlvbi5cclxuICpcclxuICogVGhpcyBtZXRob2QgaW5zcGVjdHMgdGhlIGdpdmVuIG9iamVjdCBhbmQgYXV0b21hdGljYWxseSBkZXRlcm1pbmVzIHdoYXRcclxuICogbWV0aG9kcywgcHJvcGVydGllcywgYW5kIGV2ZW50cyBhcmUgc3VwcG9ydGVkIGJ5IGl0LlxyXG4gKlxyXG4gKiBCeSBkZWZhdWx0LCBhbGwgcHVibGljIGZ1bmN0aW9ucyBkZWZpbmVkIG9uIHRoZSBvYmplY3Qgd2lsbCBiZSBleHBvc2VkIGFzXHJcbiAqIG1ldGhvZHMsIGFuZCBhbGwgcHVibGljIGdldHRlcnMgd2lsbCBiZSBleHBvc2VkIGFzIHByb3BlcnRpZXMuIEFueSBvYmplY3RcclxuICogcHJvcGVydHkgdGhhdCBiZWdpbnMgd2l0aCBhbiB1bmRlcnNjb3JlIHdpbGwgYmUgc2tpcHBlZC5cclxuICpcclxuICogTm90ZSB0aGF0IGV2ZW50cyBhcmUgbm90IGF1dG9tYXRpY2FsbHkgaW5mZXJyZWQ7IHRoZSBvYmplY3QgbXVzdCBoYXZlIGFcclxuICogcHJvcGVydHkgbmFtZWQgYGV2ZW50c2AgdGhhdCBpcyBhbiBhcnJheSBvZiBzdHJpbmdzIGRvY3VtZW50aW5nIHRoZSBlbWl0dGVkXHJcbiAqIGV2ZW50cy5cclxuICpcclxuICogQHBhcmFtIG9iaiBJbXBsZW1lbnRhdGlvbiBvYmplY3Qgd2hvc2Ugc2NoZW1hIGlzIHRvIGJlIGluZmVycmVkLlxyXG4gKiBAcmV0dXJuIHtTY2hlbWF9XHJcbiAqL1xyXG5TY2hlbWEuZnJvbU9iamVjdERlZmluaXRpb24gPSBmdW5jdGlvbihvYmopIHtcclxuICB2YXIgc2NoZW1hID0geyBwcm9wZXJ0aWVzOiB7fSwgbWV0aG9kczoge30sIGV2ZW50czoge30gfTtcclxuICAvLyBOLkIuIFdlIG5lZWQgdG8gdXNlIGdldE93blByb3BlcnR5TmFtZXMoKSByYXRoZXIgdGhhbiBmb3IgKHZhciBwIGluIG9iailcclxuICAvLyBpbiBvcmRlciB0byBwaWNrIHVwIG5vbi1lbnVtZXJhYmxlIHByb3BlcnRpZXMuIE9uIFRlc3NlbCwgZ2V0dGVycyBhcmVcclxuICAvLyBub3QgZW51bWVyYWJsZSBieSBkZWZhdWx0LCBzbyB0aGUgbm9ybWFsIGZvciAodmFyIHAgaW4gb2JqKSB3aWxsIG5vdFxyXG4gIC8vIHBpY2sgdGhlbSB1cC5cclxuICB2YXIgYXR0cnMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhvYmopO1xyXG4gIGZvcih2YXIgaT0wO2k8YXR0cnMubGVuZ3RoO2krKykge1xyXG4gICAgdmFyIGF0dHIgPSBhdHRyc1tpXTtcclxuICAgIGlmIChhdHRyWzBdID09PSAnXycpIHsgY29udGludWU7IH0gLy8gc2tpcCBwcm9wZXJ0aWVzIHdpdGggbGVhZGluZyBfXHJcbiAgICBpZiAocmVzZXJ2ZWROYW1lcy5pbmRleE9mKGF0dHIpICE9PSAtMSkgeyBjb250aW51ZTsgfSAvLyBza2lwIHJlc2VydmVkIHdvcmRzXHJcbiAgICAvLyBjb25zb2xlLmxvZygnYXR0ciAnICsgYXR0cnNbaV0gKyAnIGhhcyB0eXBlOiAnICsgKHR5cGVvZiBvYmpbYXR0cnNbaV1dKSk7XHJcbiAgICB2YXIgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Iob2JqLCBhdHRyKTtcclxuICAgIGlmIChkZXNjLmdldCAhPT0gdW5kZWZpbmVkKSB7IC8vIHRoaXMgaXMgYSBnZXR0ZXIgcHJvcGVydHlcclxuICAgICAgc2NoZW1hLnByb3BlcnRpZXNbYXR0cl0gPSB7IHR5cGU6IHR5cGVvZiBvYmpbYXR0cl0gfTsgLy8gaW52b2tlXHJcbiAgICB9XHJcbiAgICBlbHNlIGlmICh0eXBlb2Ygb2JqW2F0dHJdID09PSBcInN0cmluZ1wiKSB7XHJcbiAgICAgIHNjaGVtYS5wcm9wZXJ0aWVzW2F0dHJdID0geyB0eXBlOiAnc3RyaW5nJywgY29uc3RydWN0b3I6IFN0cmluZyB9O1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZiAodHlwZW9mIG9ialthdHRyXSA9PT0gXCJudW1iZXJcIikge1xyXG4gICAgICBzY2hlbWEucHJvcGVydGllc1thdHRyXSA9IHsgdHlwZTogJ251bWJlcicsIGNvbnN0cnVjdG9yOiBOdW1iZXIgfTtcclxuICAgIH1cclxuICAgIGVsc2UgaWYgKHR5cGVvZiBvYmpbYXR0cl0gPT09IFwiYm9vbGVhblwiKSB7XHJcbiAgICAgIHNjaGVtYS5wcm9wZXJ0aWVzW2F0dHJdID0geyB0eXBlOiAnYm9vbGVhbicsIGNvbnN0cnVjdG9yOiBCb29sZWFuIH07XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmICh0eXBlb2Ygb2JqW2F0dHJdID09PSBcImZ1bmN0aW9uXCIpIHtcclxuICAgICAgLy8gdG9kbzogZ2V0IHNpZ25hdHVyZSBvZiBmdW5jdGlvblxyXG4gICAgICAvLyAjIGFyZ3VtZW50cyA9IG9ialthdHRyXS5sZW5ndGhcclxuICAgICAgc2NoZW1hLm1ldGhvZHNbYXR0cl0gPSB7IHR5cGU6ICd1bmtub3duJyB9O1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZiAodHlwZW9mIG9ialthdHRyXSA9PT0gXCJvYmplY3RcIiAmJiBhdHRyID09PSBcImV2ZW50c1wiKSB7XHJcbiAgICAgIHZhciBldmVudHMgPSBvYmpbYXR0cl07XHJcbiAgICAgIGZvciAodmFyIGo9MDsgajxldmVudHMubGVuZ3RoO2orKykge1xyXG4gICAgICAgIHNjaGVtYS5ldmVudHNbZXZlbnRzW2pdXSA9IHt9O1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG4gIHJldHVybiBuZXcgU2NoZW1hKHNjaGVtYSk7XHJcbn07XHJcblxyXG4vLyBEdW1wIG91dCB0aGUgb2JqZWN0IGRlZmluaXRpb24uIFRoZSBjYWxsYmFjayB0byBzdHJpbmdpZnkoKSBsZXRzIHVzXHJcbi8vIG1vZGlmeSBob3cgdG8gc2hvdyBmdW5jdGlvbiBuYW1lcywgd2hpY2ggaXMgbmVjZXNzYXJ5IHRvIGdldCBtZXRob2QgbmFtZXNcclxuLy8gdG8gc2hvdyB1cCBvbiBUZXNzZWwuXHJcblNjaGVtYS5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcclxuICBjb25zb2xlLmxvZyhKU09OLnN0cmluZ2lmeSh0aGlzLCBmdW5jdGlvbihrZXksIHZhbCkge1xyXG4gICAgY29uc29sZS5sb2coa2V5LCB2YWwpO1xyXG4gICAgaWYgKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgLy8gdmFsLm5hbWUgaXMgbm90IGRlZmluZWQgaW4gVGVzc2VsIGZpcm13YXJlLCBidXQgaWYgd2UgcmV0dXJuICdtZXRob2QnXHJcbiAgICAgIC8vIGhlcmUgaXQgd2lsbCBzaG93IHRoZSBuYW1lIGFzIGtleS5cclxuICAgICAgLy9yZXR1cm4gdmFsLm5hbWU7XHJcbiAgICAgIHJldHVybiAnbWV0aG9kJztcclxuICAgIH1cclxuICAgIHJldHVybiB2YWw7XHJcbiAgfSwgNCAvKiBpbmRlbnQgKi8pKTtcclxufTtcclxuIiwiLyoqXHJcbiAqIFdlYlNvY2tldCB0cmFuc3BvcnQuXHJcbiAqXHJcbiAqIFRoaXMgbW9kdWxlIGlzIHJlc3BvbnNpYmxlIGZvciB0dW5uZWxpbmcgT3JnYW5pcSBwcm90b2NvbCByZXF1ZXN0cyBvdmVyIGFcclxuICogV2ViU29ja2V0IGNvbm5lY3Rpb24uIEl0IG1heSBiZSB1c2VkIGFzIGEgdHJhbnNwb3J0IGZvciBhbnkgb2YgZGV2aWNlXHJcbiAqIGNvbnRhaW5lcnMsIGNsaWVudCBoYW5kbGVycywgb3IgZ2F0ZXdheSBzZXJ2ZXJzLlxyXG4gKlxyXG4gKiBUaGUgdHJhbnNwb3J0IGRvZXMgbm90IG1haW50YWluIGFueSBzdGF0ZSBpbmZvcm1hdGlvbiBjb25jZXJuaW5nIHdoaWNoXHJcbiAqIGRldmljZXMgb3IgYXBwbGljYXRpb25zIGFyZSBjb25uZWN0ZWQgb24gZWl0aGVyIHNpZGUgb2YgYSBjb25uZWN0aW9uLiBJdCBpc1xyXG4gKiB0aGUgcmVzcG9uc2liaWxpdHkgb2YgdGhlIGRldmljZSBhbmQgY2xpZW50IGNvbnRhaW5lcnMgdG8gZG8gc28uXHJcbiAqXHJcbiAqIE1lc3NhZ2VzIHNlbnQ6XHJcbiAqICBSRUdJU1RFUiwgREVSRUdJU1RFUiAtIGFkbWluaXN0cmF0aXZlIHJlcXVlc3RzIHNlbnQgYnkgYSBsb2NhbCBkZXZpY2VcclxuICogICAgY29udGFpbmVyIHRvIGEgcmVtb3RlIGdhdGV3YXkuXHJcbiAqICBDT05ORUNULCBESVNDT05ORUNUIC0gYWRtaW5pc3RyYXRpdmUgcmVxdWVzdHMgc2VudCBieSBhIGxvY2FsIGFwcGxpY2F0aW9uXHJcbiAqICAgIGNsaWVudCB0byBhIHJlbW90ZSBnYXRld2F5LlxyXG4gKiAgUFVULCBOT1RJRlkgLSBEZXZpY2Ugbm90aWZpY2F0aW9ucyBzZW50IGZyb20gYSBsb2NhbCBkZXZpY2UgY29udGFpbmVyIHRvXHJcbiAqICAgIHJlbW90ZSBhcHBsaWNhdGlvbiBjbGllbnRzLlxyXG4gKiAgR0VULCBTRVQsIElOVk9LRSwgU1VCU0NSSUJFLCBDT05GSUcgLSBBcHBsaWNhdGlvbiByZXF1ZXN0cyBzZW50IGZyb20gYSBsb2NhbFxyXG4gKiAgICBhcHBsaWNhdGlvbiBjbGllbnQgdG8gYSByZW1vdGUgZGV2aWNlIGNvbnRhaW5lci5cclxuICpcclxuICogTWVzc2FnZXMgcmVjZWl2ZWQ6XHJcbiAqICBSRUdJU1RFUiwgREVSRUdJU1RFUiAtIGFkbWluaXN0cmF0aXZlIHJlcXVlc3RzIHNlbnQgYnkgYSByZW1vdGUgZGV2aWNlXHJcbiAqICAgIGNvbnRhaW5lciB0byBhIGxvY2FsIGdhdGV3YXkuXHJcbiAqICBDT05ORUNULCBESVNDT05ORUNUIC0gYWRtaW5pc3RyYXRpdmUgcmVxdWVzdHMgc2VudCBieSBhIHJlbW90ZSBhcHBsaWNhdGlvblxyXG4gKiAgICBjbGllbnQgdG8gYSBsb2NhbCBnYXRld2F5LlxyXG4gKiAgR0VULCBTRVQsIElOVk9LRSwgU1VCU0NSSUJFLCBDT05GSUcgLSBBcHBsaWNhdGlvbiByZXF1ZXN0cyBzZW50IGZyb20gYVxyXG4gKiAgICByZW1vdGUgYXBwbGljYXRpb24gY2xpZW50IChwb3NzaWJseSB2aWEgYSBnYXRld2F5KS4gRm9yd2FyZGVkIHRvIGxvY2FsXHJcbiAqICAgIGRldmljZSBjb250YWluZXIuXHJcbiAqICBQVVQsIE5PVElGWSAtIERldmljZSBub3RpZmljYXRpb25zIHNlbnQgZnJvbSBhIHJlbW90ZSBkZXZpY2UgY29udGFpbmVyXHJcbiAqICAgIChwb3NzaWJseSB2aWEgYSBnYXRld2F5KS4gRm9yd2FyZGVkIHRvIGxvY2FsIGFwcGxpY2F0aW9uIGNsaWVudC5cclxuICpcclxuICogUmVxdWVzdHMgaW4gYm90aCBkaXJlY3Rpb25zIG1heSBiZSBvdmVybGFwcGVkOyB0aGF0IGlzLCBtdWx0aXBsZSByZXF1ZXN0c1xyXG4gKiBtYXkgYmUgb3V0c3RhbmRpbmcgYXQgYW55IGdpdmVuIHRpbWUsIGFuZCByZXNwb25zZXMgdG8gdGhvc2UgcmVxdWVzdHMgbWF5XHJcbiAqIGNvbWUgaW4gYW55IG9yZGVyLiBUbyBmYWNpbGl0YXRlIG11bHRpcGxleGluZywgZWFjaCByZXF1ZXN0IGhhcyBhbiBhc3NvY2lhdGVkXHJcbiAqIGByZXFpZGAgcHJvcGVydHkgKGFzc2lnbmVkIGJ5IHRoZSBzZW5kZXIpIHdoaWNoIGlzIGluY2x1ZGVkIGluIHRoZSBSRVNQT05TRVxyXG4gKiBzZW50IGJ5IHRoZSByZXNwb25kZXIuXHJcbiAqXHJcbiAqIFRoZSBmb3JtYXQgZm9yIGJvdGggZGV2aWNlIGFuZCBhZG1pbmlzdHJhdGl2ZSByZXF1ZXN0cyBpcyBhIEpTT04tXHJcbiAqIGZvcm1hdHRlZCBXZWJTb2NrZXRSZXF1ZXN0IG9iamVjdC5cclxuICpcclxuICogIGByZXFpZGAgLSBVbmlxdWUgcmVxdWVzdCBpZCBnZW5lcmF0ZWQgYnkgc2VuZGVyXHJcbiAqICBgZGV2aWNlaWRgIC1cclxuICogIGBtZXRob2RgIC1cclxuICogIGBpZGVudGlmaWVyYCAtXHJcbiAqICBgdmFsdWVgIC1cclxuICpcclxuICogUmVxdWVzdHMgYWx3YXlzIGluY2x1ZGUgYSBgbWV0aG9kYFxyXG4gKiBhbmQgdW5pcXVlIGByZXFpZGAsIHdpdGggc2xpZ2h0bHkgZGlmZmVyZW50IHByb3BlcnRpZXMgZGVwZW5kaW5nIG9uXHJcbiAqIHJlcXVlc3QgdHlwZS4gUmVzcG9uc2VzIHRvIHJlcXVlc3RzIGFyZSBpbmRpY2F0ZWQgYnkgbWV0aG9kPWBSRVNQT05TRWAsXHJcbiAqIGFuZCBoYXZlIHRoZSBmb2xsb3dpbmcgYWRkaXRpb25hbCBwcm9wZXJ0aWVzOlxyXG4gKiAgYHJlcWlkYCAtIHRoZSB2YWx1ZSBvZiByZXFpZCBmcm9tIHRoZSByZXF1ZXN0IG1lc3NhZ2VcclxuICogIGBzdWNjZXNzYCAtIGEgYm9vbGVhbiB0aGF0IGlzIHRydWUgaWYgdGhlIHJlcXVlc3Qgd2FzIHN1Y2Nlc3NmdWxcclxuICogIGByZXNgIC0gb24gc3VjY2VzcywgYSBKYXZhU2NyaXB0IG9iamVjdCByZXByZXNlbnRpbmcgdGhlIHJldHVybmVkIHZhbHVlXHJcbiAqICBgZXJyYCAtIG9uIGZhaWx1cmUsIGEgSmF2YVNjcmlwdCBFcnJvciBvYmplY3RcclxuICovXHJcblxyXG4vKipcclxuICogTW9kdWxlIERlcGVuZGVuY2llcy5cclxuICovXHJcbnZhciB3aGVuXyA9IHJlcXVpcmUoJ3doZW4nKTtcclxudmFyIGRlYnVnID0gcmVxdWlyZSgnZGVidWcnKSgnb3JnYW5pcTp3ZWJzb2NrZXQnKTtcclxudmFyIE9yZ2FuaXFSZXF1ZXN0ID0gcmVxdWlyZSgnLi9yZXF1ZXN0LmpzJyk7XHJcbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XHJcbnZhciB1dGlsID0gcmVxdWlyZSgndXRpbCcpO1xyXG5cclxuLyoqXHJcbiAqIEV4cG9ydCBXZWJTb2NrZXRBcGkgZmFjdG9yeSBmdW5jdGlvbi5cclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0gV2ViU29ja2V0VHJhbnNwb3J0O1xyXG5cclxudmFyIGdhdGV3YXlDb21tYW5kcyA9IFsnUkVHSVNURVInLCAnREVSRUdJU1RFUicsICdDT05ORUNUJywgJ0RJU0NPTk5FQ1QnXTtcclxudmFyIGRvd25zdHJlYW1Db21tYW5kcyA9IFsnR0VUJywgJ1NFVCcsICdJTlZPS0UnLCAnU1VCU0NSSUJFJywgJ0RFU0NSSUJFJywgJ0NPTkZJRyddO1xyXG52YXIgdXBzdHJlYW1Db21tYW5kcyA9IFsnUFVUJywgJ05PVElGWSddO1xyXG52YXIgcmVzcG9uc2VDb21tYW5kID0gWydSRVNQT05TRSddO1xyXG52b2lkKGdhdGV3YXlDb21tYW5kc3x8cmVzcG9uc2VDb21tYW5kKTtcclxuXHJcblxyXG5mdW5jdGlvbiBpc0Rvd25zdHJlYW1Db21tYW5kKG1ldGhvZCkge1xyXG4gIHJldHVybiBkb3duc3RyZWFtQ29tbWFuZHMuaW5kZXhPZihtZXRob2QpICE9PSAtMTtcclxufVxyXG5cclxuZnVuY3Rpb24gaXNVcHN0cmVhbUNvbW1hbmQobWV0aG9kKSB7XHJcbiAgcmV0dXJuIHVwc3RyZWFtQ29tbWFuZHMuaW5kZXhPZihtZXRob2QpICE9PSAtMTtcclxufVxyXG5cclxuLy9mdW5jdGlvbiBpc0dhdGV3YXlDb21tbWFuZChtZXRob2QpIHtcclxuLy8gIHJldHVybiBnYXRld2F5Q29tbWFuZHMuaW5kZXhPZihtZXRob2QpICE9PSAtMTtcclxuLy99XHJcblxyXG4vL3ZhciBNQVhfU0FGRV9JTlRFR0VSID0gOTAwNzE5OTI1NDc0MDk5MTtcclxuLy9mdW5jdGlvbiBuZXdJZCgpIHtcclxuLy8gIHJldHVybiBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBNQVhfU0FGRV9JTlRFR0VSKS50b1N0cmluZygpO1xyXG4vL31cclxuXHJcbnZhciBERUZBVUxUX1JFUVVFU1RfVElNRU9VVCA9IDUwMDA7ICAgLy8gZml2ZSBzZWNvbmRzXHJcblxyXG5mdW5jdGlvbiB3ZWJTb2NrZXRSZXF1ZXN0VG9PcmdhbmlxUmVxdWVzdChtc2cpIHtcclxuICB2YXIgciA9IE9yZ2FuaXFSZXF1ZXN0O1xyXG4gIHN3aXRjaCAobXNnLm1ldGhvZCkge1xyXG4gICAgY2FzZSAnR0VUJzogcmV0dXJuIHIuZ2V0KG1zZy5kZXZpY2VpZCwgbXNnLmlkZW50aWZpZXIpO1xyXG4gICAgY2FzZSAnU0VUJzogcmV0dXJuIHIuc2V0KG1zZy5kZXZpY2VpZCwgbXNnLmlkZW50aWZpZXIsIG1zZy52YWx1ZSk7XHJcbiAgICBjYXNlICdJTlZPS0UnOiByZXR1cm4gci5pbnZva2UobXNnLmRldmljZWlkLCBtc2cuaWRlbnRpZmllciwgbXNnLnZhbHVlKTtcclxuICAgIGNhc2UgJ1NVQlNDUklCRSc6IHJldHVybiByLnN1YnNjcmliZShtc2cuZGV2aWNlaWQsIG1zZy5pZGVudGlmaWVyKTtcclxuICAgIGNhc2UgJ0RFU0NSSUJFJzogcmV0dXJuIHIuZGVzY3JpYmUobXNnLmRldmljZWlkLCBtc2cuaWRlbnRpZmllcik7XHJcbiAgICBjYXNlICdDT05GSUcnOiByZXR1cm4gci5jb25maWcobXNnLmRldmljZWlkLCBtc2cuaWRlbnRpZmllciwgbXNnLnZhbHVlKTtcclxuICAgIGNhc2UgJ1BVVCc6IHJldHVybiByLnB1dChtc2cuZGV2aWNlaWQsIG1zZy5pZGVudGlmaWVyLCBtc2cudmFsdWUpO1xyXG4gICAgY2FzZSAnTk9USUZZJzogcmV0dXJuIHIubm90aWZ5KG1zZy5kZXZpY2VpZCwgbXNnLmlkZW50aWZpZXIsIG1zZy52YWx1ZSk7XHJcbiAgICBkZWZhdWx0OlxyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgV2ViU29ja2V0IG1ldGhvZDogJyArIG1zZy5tZXRob2QpO1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gT3JnYW5pcVRvV1NSZXF1ZXN0KHJlcSkge1xyXG4gIHZhciBtc2cgPSB7ZGV2aWNlaWQ6IHJlcS5kZXZpY2VpZCwgbWV0aG9kOiByZXEubWV0aG9kLCBpZGVudGlmaWVyOiByZXEuaWRlbnRpZmllcn07XHJcbiAgbXNnLmNvbm5pZCA9IHJlcS5kZXZpY2VpZDsgIC8vIEJVR0JVRzogdGVtcG9yYXJ5IGhhY2sgdG8gd29yayB3aXRoIG9sZCBnYXRld2F5IHNlcnZlclxyXG4gIHN3aXRjaCAocmVxLm1ldGhvZCkge1xyXG4gICAgY2FzZSAnR0VUJzogcmV0dXJuIG1zZztcclxuICAgIGNhc2UgJ1NFVCc6IG1zZy52YWx1ZSA9IHJlcS52YWx1ZTsgcmV0dXJuIG1zZztcclxuICAgIGNhc2UgJ0lOVk9LRSc6IG1zZy52YWx1ZSA9IHJlcS5wYXJhbXM7IHJldHVybiBtc2c7XHJcbiAgICBjYXNlICdTVUJTQ1JJQkUnOiByZXR1cm4gbXNnO1xyXG4gICAgY2FzZSAnREVTQ1JJQkUnOiByZXR1cm4gbXNnO1xyXG4gICAgY2FzZSAnQ09ORklHJzogbXNnLnZhbHVlID0gcmVxLnZhbHVlOyByZXR1cm4gbXNnO1xyXG4gICAgY2FzZSAnUFVUJzogbXNnLnZhbHVlID0gcmVxLnZhbHVlOyByZXR1cm4gbXNnO1xyXG4gICAgY2FzZSAnTk9USUZZJzogbXNnLnZhbHVlID0gcmVxLnBhcmFtczsgcmV0dXJuIG1zZztcclxuICAgIGNhc2UgJ1JFR0lTVEVSJzogcmV0dXJuIG1zZztcclxuICAgIGNhc2UgJ0RFUkVHSVNURVInOiByZXR1cm4gbXNnO1xyXG4gICAgY2FzZSAnQ09OTkVDVCc6IHJldHVybiBtc2c7XHJcbiAgICBjYXNlICdESVNDT05ORUNUJzogcmV0dXJuIG1zZztcclxuICAgIGRlZmF1bHQ6XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBPcmdhbmlxUmVxdWVzdCBtZXRob2Q6ICcgKyBtc2cubWV0aG9kKTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBAbmFtZSBEaXNwYXRjaGVyXHJcbiAqIEBwcm9wZXJ0eSB7ZnVuY3Rpb24oT3JnYW5pcVJlcXVlc3QpfSBkaXNwYXRjaCAtIG1ldGhvZCB0byBkaXNwYXRjaCBPcmdhbmlxUmVxdWVzdFxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBGYWN0b3J5IGZvciB0aGUgV2ViU29ja2V0IEFQSSBoYW5kbGVyLlxyXG4gKlxyXG4gKlxyXG4gKiBAcGFyYW0ge0Rpc3BhdGNoZXJ9IGRvd25zdHJlYW0gVGhlIGRpc3BhdGNoZXIgdG8gaW52b2tlIHdoZW4gZG93bnN0cmVhbVxyXG4gKiAgbWVzc2FnZXMgYXJlIHJlY2VpdmVkIGZyb20gdGhlIG5ldHdvcmsgcGVlci4gVGhpcyBpcyBub3JtYWxseSBhIGxvY2FsIGRldmljZVxyXG4gKiAgY29udGFpbmVyLlxyXG4gKiBAcGFyYW0ge0Rpc3BhdGNoZXJ9IHVwc3RyZWFtIFRoZSBkaXNwYXRjaGVyIHRvIGludm9rZSB3aGVuIHVwc3RyZWFtIG1lc3NhZ2VzXHJcbiAqICBhcmUgcmVjZWl2ZWQgZnJvbSB0aGUgbmV0d29yayBwZWVyLiBUaGlzIGlzIG5vcm1hbGx5IGEgY2xpZW50IGFwcGxpY2F0aW9uXHJcbiAqICBjb250YWluZXIuXHJcbiAqIEBwYXJhbSB7b2JqZWN0fSBvcHRpb25zXHJcbiAqIEBwYXJhbSB7b2JqZWN0fSBvcHRpb25zLm5hbWVzcGFjZVxyXG4gKiBAcGFyYW0ge29iamVjdH0gb3B0aW9ucy5yZXF1ZXN0VGltZW91dFxyXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IGhhbmRsZXIgZnVuY3Rpb24gdG8gYmUgaW5zdGFsbGVkIGFzIFdlYlNvY2tldCAnb3BlbidcclxuICogIGhhbmRsZXIuXHJcbiAqXHJcbiAqL1xyXG5mdW5jdGlvbiBXZWJTb2NrZXRUcmFuc3BvcnQoZG93bnN0cmVhbSwgdXBzdHJlYW0sIG9wdGlvbnMpIHtcclxuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgV2ViU29ja2V0VHJhbnNwb3J0KSkge1xyXG4gICAgcmV0dXJuIG5ldyBXZWJTb2NrZXRUcmFuc3BvcnQoZG93bnN0cmVhbSwgdXBzdHJlYW0pO1xyXG4gIH1cclxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcclxuICB2YXIgUkVRVUVTVF9USU1FT1VUID0gb3B0aW9ucy5yZXF1ZXN0VGltZW91dCB8fCBERUZBVUxUX1JFUVVFU1RfVElNRU9VVDtcclxuXHJcbiAgdmFyIHJlcXVlc3RzID0ge307ICAgICAgLy8gb3V0c3RhbmRpbmcgc2VydmVyLW9yaWdpbmF0ZWQgcmVxdWVzdHMsIGJ5IHJlcWlkXHJcbiAgdmFyIF9yZXFpZCA9IDA7ICAgICAgICAgLy8gcmVxdWVzdCBJRCBvZiBsYXN0IHNlcnZlci1vcmlnaW5hdGVkIHJlcXVlc3RcclxuICB2YXIgd3MgPSBudWxsO1xyXG4gIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgLy8gcHVibGljIGludGVyZmFjZVxyXG4gIHRoaXMuY29ubmVjdGlvbkhhbmRsZXIgPSB3ZWJTb2NrZXRBcGlDb25uZWN0aW9uSGFuZGxlcjtcclxuICB0aGlzLmNvbm5lY3RlZCA9IGZhbHNlO1xyXG4gIHRoaXMuZGlzcGF0Y2ggPSBkaXNwYXRjaDtcclxuXHJcbiAgLyoqXHJcbiAgICogQ29ubmVjdGlvbiBoYW5kbGVyIGZ1bmN0aW9uLlxyXG4gICAqXHJcbiAgICogVGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgaW5zdGFsbGVkIGFzIHRoZSAnb3BlbicgaGFuZGxlciBmb3IgYSBjbGllbnQtc2lkZVxyXG4gICAqIFdlYlNvY2tldC5cclxuICAgKlxyXG4gICAqIHZhciB3cyA9IG5ldyBXZWJTb2NrZXQoLi4uKTtcclxuICAgKiB3cy5vbignb3BlbicsIGhhbmRsZXIpXHJcbiAgICpcclxuICAgKiBAcGFyYW1zIHtXZWJTb2NrZXR8dW5kZWZpbmVkfSBBIG5ldyBXZWJTb2NrZXQgY29ubmVjdGlvbi4gSWYgbm90IHNwZWNpZmllZCxcclxuICAgKiAgaXQgaXMgYXNzdW1lZCB0aGF0IGB0aGlzYCByZWZlcnMgdG8gdGhlIFdlYlNvY2tldCBvYmplY3QuXHJcbiAgICovXHJcbiAgZnVuY3Rpb24gd2ViU29ja2V0QXBpQ29ubmVjdGlvbkhhbmRsZXIod3NfKSB7XHJcbiAgICB3cyA9IHdzXyB8fCB0aGlzO1xyXG5cclxuICAgIHdzLm9uKCdtZXNzYWdlJywgcHJvY2Vzc01lc3NhZ2UpO1xyXG4gICAgd3Mub24oJ2Nsb3NlJywgcHJvY2Vzc0Nsb3NlKTtcclxuICAgIHdzLm9uKCdlcnJvcicsIHByb2Nlc3NFcnJvcik7XHJcblxyXG4gICAgc2VsZi5jb25uZWN0ZWQgPSB0cnVlO1xyXG4gICAgc2VsZi5lbWl0KCdjb25uZWN0Jyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBXZWJTb2NrZXQgbWVzc2FnZSBoYW5kbGVyLlxyXG4gICAqXHJcbiAgICogQHBhcmFtIHtTdHJpbmd9IGRhdGEgRGF0YSBwcm92aWRlZCBieSB0aGUgdW5kZXJseWluZyBXZWJTb2NrZXQgcHJvdmlkZXJcclxuICAgKiBAcGFyYW0ge09iamVjdH0gZmxhZ3MgaW5jbHVkZXMgYGJpbmFyeWAgcHJvcGVydHkgYXMgYm9vbGVhblxyXG4gICAqL1xyXG4gIGZ1bmN0aW9uIHByb2Nlc3NNZXNzYWdlKGRhdGEsIGZsYWdzKSB7XHJcbiAgICAvLyBDaGVjayBmb3IgKHVuc3VwcG9ydGVkKSBiaW5hcnkgbWVzc2FnZVxyXG4gICAgaWYgKGZsYWdzLmJpbmFyeSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIChiaW5hcnkpIG1lc3NhZ2UgcmVjZWl2ZWQuXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFBhcnNlIGFuZCB2YWxpZGF0ZSB0aGUgaW5jb21pbmcgbWVzc2FnZVxyXG4gICAgdmFyIG1zZztcclxuICAgIHRyeSB7XHJcbiAgICAgIG1zZyA9IEpTT04ucGFyc2UoZGF0YSk7XHJcbiAgICB9XHJcbiAgICBjYXRjaCAoZSkge1xyXG4gICAgICBkZWJ1ZygnSW52YWxpZCAobm9uLUpTT04pIG1lc3NhZ2UgcmVjZWl2ZWQuJyk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCFtc2cgfHwgIW1zZy5yZXFpZCB8fCAhbXNnLm1ldGhvZCkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgbWVzc2FnZSAobWlzc2luZyByZXFpZCBvciBtZXRob2QpJyk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIG1ldGhvZCA9IG1zZy5tZXRob2Q7XHJcblxyXG4gICAgLy8gUmVzcG9uc2VzIGFyZSBoYW5kbGVkIGJ5IHJlc29sdmUtaW5nIG9yIHJlamVjdC1pbmcgdGhlIHByb21pc2UgdGhhdFxyXG4gICAgLy8gd2FzIHJldHVybmVkIHRvIHRoZSBjYWxsZXIgd2hlbiB0aGUgb3JpZ2luYWwgcmVxdWVzdCB3YXMgbWFkZS5cclxuICAgIGlmIChtZXRob2QgPT09ICdSRVNQT05TRScpIHtcclxuICAgICAgdmFyIGRlZmVycmVkID0gcmVxdWVzdHNbbXNnLnJlcWlkXTtcclxuICAgICAgZGVsZXRlIHJlcXVlc3RzW21zZy5yZXFpZF07XHJcblxyXG4gICAgICBpZiAoIWRlZmVycmVkKSB7XHJcbiAgICAgICAgZGVidWcoJ1JFU1BPTlNFIHJlY2VpdmVkIGJ1dCBubyBwZW5kaW5nIHJlcXVlc3QuIENhbmNlbGxlZCBvciB0aW1lZCBvdXQ/Jyk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgaWYgKG1zZy5zdWNjZXNzKSB7XHJcbiAgICAgICAgICBkZWJ1ZygnWycgKyBtc2cucmVxaWQgKyAnXSBSRVNQT05TRSAoJyArIG1zZy5yZXMgKyAnKScpO1xyXG4gICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZShtc2cucmVzKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgZGVidWcoJ1snICsgbXNnLnJlcWlkICsgJ10gUkVTUE9OU0UgRVJST1IoJyArIG1zZy5lcnIgKyAnKScpO1xyXG4gICAgICAgICAgZGVmZXJyZWQucmVqZWN0KG5ldyBFcnJvcihtc2cuZXJyKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gRG93bnN0cmVhbSByZXF1ZXN0cyBhcmUgZGlzcGF0Y2hlZCB0byB0aGUgbG9jYWwgcm91dGVyLlxyXG4gICAgZWxzZSBpZiAoaXNEb3duc3RyZWFtQ29tbWFuZChtZXRob2QpKSB7XHJcbiAgICAgIHZhciByZXEgPSB3ZWJTb2NrZXRSZXF1ZXN0VG9PcmdhbmlxUmVxdWVzdChtc2cpO1xyXG5cclxuICAgICAgcmV0dXJuIGRvd25zdHJlYW0uZGlzcGF0Y2gocmVxKS50aGVuKGZ1bmN0aW9uIChyZXMpIHtcclxuICAgICAgICBzZW5kUmVzcG9uc2UobXNnLCByZXMpO1xyXG4gICAgICB9KS5jYXRjaChmdW5jdGlvbiAoZXJyKSB7XHJcbiAgICAgICAgZGVidWcoJ2Rpc3BhdGNoIGZhaWxlZDogJyArIGVycik7XHJcbiAgICAgICAgdmFyIGVyck1lc3NhZ2UgPSAoZXJyIGluc3RhbmNlb2YgRXJyb3IpID8gZXJyLm1lc3NhZ2UgOiBlcnI7XHJcbiAgICAgICAgc2VuZEZhaWx1cmVSZXNwb25zZShtc2csIGVyck1lc3NhZ2UpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBVcHN0cmVhbSByZXF1ZXN0cyBnbyB1cCB0byBhcHBsaWNhdGlvbiBjbGllbnRzXHJcbiAgICBlbHNlIGlmIChpc1Vwc3RyZWFtQ29tbWFuZChtZXRob2QpKSB7XHJcbiAgICAgIHZhciByZXFVcCA9IHdlYlNvY2tldFJlcXVlc3RUb09yZ2FuaXFSZXF1ZXN0KG1zZyk7XHJcblxyXG4gICAgICByZXR1cm4gdXBzdHJlYW0uZGlzcGF0Y2gocmVxVXApLnRoZW4oZnVuY3Rpb24gKHJlcykge1xyXG4gICAgICAgIHNlbmRSZXNwb25zZShtc2csIHJlcyk7XHJcbiAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uIChlcnIpIHtcclxuICAgICAgICBkZWJ1ZygnZGlzcGF0Y2ggZmFpbGVkOiAnICsgZXJyKTtcclxuICAgICAgICB2YXIgZXJyTWVzc2FnZSA9IChlcnIgaW5zdGFuY2VvZiBFcnJvcikgPyBlcnIubWVzc2FnZSA6IGVycjtcclxuICAgICAgICBzZW5kRmFpbHVyZVJlc3BvbnNlKG1zZywgZXJyTWVzc2FnZSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8vZWxzZSBpZiAoaXNHYXRld2F5Q29tbW1hbmQobWV0aG9kKSkge1xyXG4gICAgLy8gIHN3aXRjaChtZXRob2QpIHtcclxuICAgIC8vICAgIGNhc2UgJ0NPTk5FQ1QnOlxyXG4gICAgLy8gICAgICByZXR1cm4gZ2F0ZXdheS5jb25uZWN0KG1zZy5kZXZpY2VpZClcclxuICAgIC8vICB9XHJcbiAgICAvL31cclxuXHJcbiAgICBlbHNlIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICdJbnZhbGlkIG1lc3NhZ2UgcmVjZWl2ZWQ6IGludmFsaWQgbWV0aG9kIFxcJycgKyBtZXRob2QgKyAnXFwnJyk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlIGEgY2xvc2VkIFdlYlNvY2tldCBjb25uZWN0aW9uICh2aWEgd3Mub24oJ2Nsb3NlJykpLlxyXG4gICAqXHJcbiAgICogVGhpcyBtZXRob2QgY2xlYW5zIHVwIGFsbCBzdGF0ZSBhc3NvY2lhdGVkIHdpdGggdGhlIGNsaWVudCBjb25uZWN0aW9uLlxyXG4gICAqL1xyXG4gIGZ1bmN0aW9uIHByb2Nlc3NDbG9zZSgpIHtcclxuICAgIGRlYnVnKCd3ZWJzb2NrZXQgY2xvc2VkLicpO1xyXG4gICAgc2VsZi5jb25uZWN0ZWQgPSBmYWxzZTtcclxuICAgIHNlbGYuZW1pdCgnZGlzY29ubmVjdCcpO1xyXG4gICAgZm9yICh2YXIgcmVxaWQgaW4gcmVxdWVzdHMpIHtcclxuICAgICAgaWYgKHJlcXVlc3RzLmhhc093blByb3BlcnR5KHJlcWlkKSkge1xyXG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHJlcXVlc3RzW3JlcWlkXTtcclxuICAgICAgICBkZWZlcnJlZC5yZWplY3QobmV3IEVycm9yKCdDb25uZWN0aW9uIHdhcyBjbG9zZWQuJykpO1xyXG4gICAgICAgIGRlbGV0ZSByZXF1ZXN0c1tkZWZlcnJlZF07XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgYW4gZXJyb3IgcmFpc2VkIG9uIHRoZSBXZWJTb2NrZXQgY29ubmVjdGlvbiAodmlhIHdzLm9uKCdlcnJvcicpKS5cclxuICAgKi9cclxuICBmdW5jdGlvbiBwcm9jZXNzRXJyb3IoZXJyKSB7XHJcbiAgICBkZWJ1Zygnd2Vic29ja2V0IGVycm9yOiAnICsgZXJyKTtcclxuICB9XHJcblxyXG5cclxuICAvKipcclxuICAgKiBEZWxpdmVyIGEgV2ViU29ja2V0IHByb3RvY29sIHJlcXVlc3QgdG8gdGhlIGdhdGV3YXkuXHJcbiAgICpcclxuICAgKiBAcGFyYW0gbXNnXHJcbiAgICogQHBhcmFtIG1zZy5tZXRob2RcclxuICAgKiBAcGFyYW0gbXNnLmRldmljZWlkXHJcbiAgICogQHBhcmFtIG1zZy5pZGVudGlmaWVyXHJcbiAgICogQHBhcmFtIG1zZy52YWx1ZVxyXG4gICAqXHJcbiAgICogQHJldHVybnMge1Byb21pc2V8e3RoZW4sIGNhdGNoLCBmaW5hbGx5fXxkZWZlcnJlZC5wcm9taXNlfVxyXG4gICAqL1xyXG4gIGZ1bmN0aW9uIHNlbmRXZWJTb2NrZXRSZXF1ZXN0KG1zZykge1xyXG4gICAgZGVidWcoJ1snICsgX3JlcWlkKzEgKyAnXTogU2VuZGluZyAnICsgbXNnLmRldmljZWlkICsnLicgKyBtc2cubWV0aG9kICsgJzonICtcclxuICAgICAgbXNnLmlkZW50aWZpZXIgKyAnKCcgKyBtc2cudmFsdWUgKyAnKScgKTtcclxuICAgIHZhciBkZWZlcnJlZCA9IHdoZW5fLmRlZmVyKCk7XHJcbiAgICBtc2cucmVxaWQgPSArK19yZXFpZDtcclxuICAgIHJlcXVlc3RzW21zZy5yZXFpZF0gPSBkZWZlcnJlZDtcclxuICAgIHdzLnNlbmQoSlNPTi5zdHJpbmdpZnkobXNnKSwgZnVuY3Rpb24gYWNrKGVycikge1xyXG4gICAgICBpZiAoZXJyKSB7XHJcbiAgICAgICAgZGVsZXRlIHJlcXVlc3RzW21zZy5yZXFpZF07XHJcbiAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycik7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XHJcbiAgfVxyXG5cclxuXHJcbiAgZnVuY3Rpb24gY2FuY2VsUmVxdWVzdChtc2cpIHtcclxuICAgIGlmICh0eXBlb2YgcmVxdWVzdHNbbXNnLnJlcWlkXSAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgZGVsZXRlIHJlcXVlc3RzW21zZy5yZXFpZF07XHJcbiAgICAgIC8vIGRlZmVycmVkLnJlamVjdChjYW5jZWxsZWQpID9cclxuICAgIH1cclxuICB9XHJcblxyXG5cclxuICAvKipcclxuICAgKiBTZW5kIGEgc3VjY2Vzc2Z1bCByZXNwb25zZSBmb3IgYSByZXF1ZXN0IHByZXZpb3VzbHkgcmVjZWl2ZWQuXHJcbiAgICpcclxuICAgKiBAcGFyYW0gcmVxXHJcbiAgICogQHBhcmFtIHJlc1xyXG4gICAqL1xyXG4gIGZ1bmN0aW9uIHNlbmRSZXNwb25zZShyZXEsIHJlcykge1xyXG4gICAgdmFyIG1zZyA9IHtcclxuICAgICAgcmVxaWQ6IHJlcS5yZXFpZCwgZGV2aWNlaWQ6IHJlcS5kZXZpY2VpZCwgbWV0aG9kOiAnUkVTUE9OU0UnLFxyXG4gICAgICBzdWNjZXNzOiB0cnVlLCByZXM6IHJlc1xyXG4gICAgfTtcclxuICAgIHdzLnNlbmQoSlNPTi5zdHJpbmdpZnkobXNnKSk7XHJcbiAgfVxyXG5cclxuXHJcbiAgLyoqXHJcbiAgICogU2VuZCBhIGZhaWx1cmUgcmVzcG9uc2UgZm9yIGEgcmVxdWVzdCBwcmV2aW91c2x5IHJlY2VpdmVkLlxyXG4gICAqXHJcbiAgICogQHBhcmFtIHJlcVxyXG4gICAqIEBwYXJhbSBlcnJcclxuICAgKi9cclxuICBmdW5jdGlvbiBzZW5kRmFpbHVyZVJlc3BvbnNlKHJlcSwgZXJyKSB7XHJcbiAgICB2YXIgbXNnID0ge1xyXG4gICAgICByZXFpZDogcmVxLnJlcWlkLCBkZXZpY2VpZDogcmVxLmRldmljZWlkLCBtZXRob2Q6ICdSRVNQT05TRScsXHJcbiAgICAgIHN1Y2Nlc3M6IGZhbHNlLCBlcnI6IGVyclxyXG4gICAgfTtcclxuICAgIGRlYnVnKCdyZXF1ZXN0IGZhaWxlZDogJyArIEpTT04uc3RyaW5naWZ5KG1zZykpO1xyXG4gICAgd3Muc2VuZChKU09OLnN0cmluZ2lmeShtc2cpKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERpc3BhdGNoIGEgcmVxdWVzdCB0byB0aGUgcmVtb3RlIHBlZXIuXHJcbiAgICpcclxuICAgKiBAcGFyYW0ge09yZ2FuaXFSZXF1ZXN0fSByZXFcclxuICAgKi9cclxuICBmdW5jdGlvbiBkaXNwYXRjaChyZXEpIHtcclxuICAgIHZhciBtc2cgPSBPcmdhbmlxVG9XU1JlcXVlc3QocmVxKTtcclxuICAgIHJldHVybiBzZW5kV2ViU29ja2V0UmVxdWVzdChtc2cpXHJcbiAgICAgIC50aW1lb3V0KFJFUVVFU1RfVElNRU9VVClcclxuICAgICAgLmNhdGNoKHdoZW5fLlRpbWVvdXRFcnJvciwgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGNhbmNlbFJlcXVlc3QobXNnKTtcclxuICAgICAgICB0aHJvdyBlO1xyXG4gICAgICB9KTtcclxuICB9XHJcbn1cclxudXRpbC5pbmhlcml0cyhXZWJTb2NrZXRUcmFuc3BvcnQsIEV2ZW50RW1pdHRlcik7XHJcblxyXG4iLCIoZnVuY3Rpb24gKHByb2Nlc3Mpe1xuLyoqXHJcbiAqIFNoaW0gZm9yIFdlYlNvY2tldCBpbmNsdXNpb24uXHJcbiAqXHJcbiAqIFdlIG5vcm1hbGx5IHVzZSAnd2Vic29ja2V0cy93cycgZm9yIFdlYlNvY2tldHMgc3VwcG9ydCwgYnV0IHRoaXMgZmFpbHMgaW5cclxuICogdGhlIGJyb3dzZXIuIEFwcGFyZW50bHkuIE5lZWQgdG8gcmV2aXNpdCB0aGlzLlxyXG4gKi9cclxudmFyIHV0aWwgPSByZXF1aXJlKCd1dGlsJyk7XHJcbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHByb2Nlc3MuYnJvd3NlciA/IEJyb3dzZXJXZWJTb2NrZXRTaGltXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogcmVxdWlyZSgnd3MnKTtcclxuXHJcbi8qKlxyXG4gKiBXcmFwcGVyIGZvciBuYXRpdmUgYnJvd3NlciBXZWJTb2NrZXQsIG1ha2luZyBpdCBiZWhhdmUgbGlrZSB0aGUgV2ViU29ja2V0cy93c1xyXG4gKiBtb2R1bGUgKGVub3VnaCBmb3Igb3VyIG5lZWRzLCBhbnlob3cpLlxyXG4gKlxyXG4gKiBAcGFyYW0gdXJsXHJcbiAqIEByZXR1cm4ge0Jyb3dzZXJXZWJTb2NrZXRTaGltfVxyXG4gKiBAY29uc3RydWN0b3JcclxuICovXHJcbmZ1bmN0aW9uIEJyb3dzZXJXZWJTb2NrZXRTaGltKHVybCkge1xyXG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBCcm93c2VyV2ViU29ja2V0U2hpbSkpIHtcclxuICAgIHJldHVybiBuZXcgQnJvd3NlcldlYlNvY2tldFNoaW0odXJsKTtcclxuICB9XHJcbiAgdmFyIHNlbGYgPSB0aGlzO1xyXG4gIC8qZ2xvYmFsIFdlYlNvY2tldCovXHJcbiAgdmFyIHdzID0gbmV3IFdlYlNvY2tldCh1cmwpO1xyXG4gIHdzLm9ub3BlbiA9IGZ1bmN0aW9uIGNvbm5lY3QoKSB7XHJcbiAgICBzZWxmLmVtaXQoJ29wZW4nLCBzZWxmKTtcclxuICB9O1xyXG4gIHdzLm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGV2ZW50KSB7XHJcbiAgICBzZWxmLmVtaXQoJ21lc3NhZ2UnLCBldmVudC5kYXRhLCB7fSk7XHJcbiAgfTtcclxuICB3cy5vbmVycm9yID0gZnVuY3Rpb24oZXYpIHtcclxuICAgIHNlbGYuZW1pdCgnZXJyb3InLCBldik7XHJcbiAgfTtcclxuICB3cy5vbmNsb3NlID0gZnVuY3Rpb24oZXYpIHtcclxuICAgIHNlbGYuZW1pdCgnY2xvc2UnLCBldi5jb2RlLCBldi5yZWFzb24pO1xyXG4gIH07XHJcbiAgdGhpcy5zZW5kID0gZnVuY3Rpb24ocywgY2IpIHsgd3Muc2VuZChzKTsgaWYgKGNiKSB7IGNiKCk7IH0gfTtcclxufVxyXG51dGlsLmluaGVyaXRzKEJyb3dzZXJXZWJTb2NrZXRTaGltLCBFdmVudEVtaXR0ZXIpO1xyXG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKCdfcHJvY2VzcycpKSIsIlxuLyoqXG4gKiBUaGlzIGlzIHRoZSB3ZWIgYnJvd3NlciBpbXBsZW1lbnRhdGlvbiBvZiBgZGVidWcoKWAuXG4gKlxuICogRXhwb3NlIGBkZWJ1ZygpYCBhcyB0aGUgbW9kdWxlLlxuICovXG5cbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vZGVidWcnKTtcbmV4cG9ydHMubG9nID0gbG9nO1xuZXhwb3J0cy5mb3JtYXRBcmdzID0gZm9ybWF0QXJncztcbmV4cG9ydHMuc2F2ZSA9IHNhdmU7XG5leHBvcnRzLmxvYWQgPSBsb2FkO1xuZXhwb3J0cy51c2VDb2xvcnMgPSB1c2VDb2xvcnM7XG5leHBvcnRzLnN0b3JhZ2UgPSAndW5kZWZpbmVkJyAhPSB0eXBlb2YgY2hyb21lXG4gICAgICAgICAgICAgICAmJiAndW5kZWZpbmVkJyAhPSB0eXBlb2YgY2hyb21lLnN0b3JhZ2VcbiAgICAgICAgICAgICAgICAgID8gY2hyb21lLnN0b3JhZ2UubG9jYWxcbiAgICAgICAgICAgICAgICAgIDogbG9jYWxzdG9yYWdlKCk7XG5cbi8qKlxuICogQ29sb3JzLlxuICovXG5cbmV4cG9ydHMuY29sb3JzID0gW1xuICAnbGlnaHRzZWFncmVlbicsXG4gICdmb3Jlc3RncmVlbicsXG4gICdnb2xkZW5yb2QnLFxuICAnZG9kZ2VyYmx1ZScsXG4gICdkYXJrb3JjaGlkJyxcbiAgJ2NyaW1zb24nXG5dO1xuXG4vKipcbiAqIEN1cnJlbnRseSBvbmx5IFdlYktpdC1iYXNlZCBXZWIgSW5zcGVjdG9ycywgRmlyZWZveCA+PSB2MzEsXG4gKiBhbmQgdGhlIEZpcmVidWcgZXh0ZW5zaW9uIChhbnkgRmlyZWZveCB2ZXJzaW9uKSBhcmUga25vd25cbiAqIHRvIHN1cHBvcnQgXCIlY1wiIENTUyBjdXN0b21pemF0aW9ucy5cbiAqXG4gKiBUT0RPOiBhZGQgYSBgbG9jYWxTdG9yYWdlYCB2YXJpYWJsZSB0byBleHBsaWNpdGx5IGVuYWJsZS9kaXNhYmxlIGNvbG9yc1xuICovXG5cbmZ1bmN0aW9uIHVzZUNvbG9ycygpIHtcbiAgLy8gaXMgd2Via2l0PyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8xNjQ1OTYwNi8zNzY3NzNcbiAgcmV0dXJuICgnV2Via2l0QXBwZWFyYW5jZScgaW4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlKSB8fFxuICAgIC8vIGlzIGZpcmVidWc/IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzM5ODEyMC8zNzY3NzNcbiAgICAod2luZG93LmNvbnNvbGUgJiYgKGNvbnNvbGUuZmlyZWJ1ZyB8fCAoY29uc29sZS5leGNlcHRpb24gJiYgY29uc29sZS50YWJsZSkpKSB8fFxuICAgIC8vIGlzIGZpcmVmb3ggPj0gdjMxP1xuICAgIC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvVG9vbHMvV2ViX0NvbnNvbGUjU3R5bGluZ19tZXNzYWdlc1xuICAgIChuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkubWF0Y2goL2ZpcmVmb3hcXC8oXFxkKykvKSAmJiBwYXJzZUludChSZWdFeHAuJDEsIDEwKSA+PSAzMSk7XG59XG5cbi8qKlxuICogTWFwICVqIHRvIGBKU09OLnN0cmluZ2lmeSgpYCwgc2luY2Ugbm8gV2ViIEluc3BlY3RvcnMgZG8gdGhhdCBieSBkZWZhdWx0LlxuICovXG5cbmV4cG9ydHMuZm9ybWF0dGVycy5qID0gZnVuY3Rpb24odikge1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodik7XG59O1xuXG5cbi8qKlxuICogQ29sb3JpemUgbG9nIGFyZ3VtZW50cyBpZiBlbmFibGVkLlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZm9ybWF0QXJncygpIHtcbiAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gIHZhciB1c2VDb2xvcnMgPSB0aGlzLnVzZUNvbG9ycztcblxuICBhcmdzWzBdID0gKHVzZUNvbG9ycyA/ICclYycgOiAnJylcbiAgICArIHRoaXMubmFtZXNwYWNlXG4gICAgKyAodXNlQ29sb3JzID8gJyAlYycgOiAnICcpXG4gICAgKyBhcmdzWzBdXG4gICAgKyAodXNlQ29sb3JzID8gJyVjICcgOiAnICcpXG4gICAgKyAnKycgKyBleHBvcnRzLmh1bWFuaXplKHRoaXMuZGlmZik7XG5cbiAgaWYgKCF1c2VDb2xvcnMpIHJldHVybiBhcmdzO1xuXG4gIHZhciBjID0gJ2NvbG9yOiAnICsgdGhpcy5jb2xvcjtcbiAgYXJncyA9IFthcmdzWzBdLCBjLCAnY29sb3I6IGluaGVyaXQnXS5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJncywgMSkpO1xuXG4gIC8vIHRoZSBmaW5hbCBcIiVjXCIgaXMgc29tZXdoYXQgdHJpY2t5LCBiZWNhdXNlIHRoZXJlIGNvdWxkIGJlIG90aGVyXG4gIC8vIGFyZ3VtZW50cyBwYXNzZWQgZWl0aGVyIGJlZm9yZSBvciBhZnRlciB0aGUgJWMsIHNvIHdlIG5lZWQgdG9cbiAgLy8gZmlndXJlIG91dCB0aGUgY29ycmVjdCBpbmRleCB0byBpbnNlcnQgdGhlIENTUyBpbnRvXG4gIHZhciBpbmRleCA9IDA7XG4gIHZhciBsYXN0QyA9IDA7XG4gIGFyZ3NbMF0ucmVwbGFjZSgvJVthLXolXS9nLCBmdW5jdGlvbihtYXRjaCkge1xuICAgIGlmICgnJSUnID09PSBtYXRjaCkgcmV0dXJuO1xuICAgIGluZGV4Kys7XG4gICAgaWYgKCclYycgPT09IG1hdGNoKSB7XG4gICAgICAvLyB3ZSBvbmx5IGFyZSBpbnRlcmVzdGVkIGluIHRoZSAqbGFzdCogJWNcbiAgICAgIC8vICh0aGUgdXNlciBtYXkgaGF2ZSBwcm92aWRlZCB0aGVpciBvd24pXG4gICAgICBsYXN0QyA9IGluZGV4O1xuICAgIH1cbiAgfSk7XG5cbiAgYXJncy5zcGxpY2UobGFzdEMsIDAsIGMpO1xuICByZXR1cm4gYXJncztcbn1cblxuLyoqXG4gKiBJbnZva2VzIGBjb25zb2xlLmxvZygpYCB3aGVuIGF2YWlsYWJsZS5cbiAqIE5vLW9wIHdoZW4gYGNvbnNvbGUubG9nYCBpcyBub3QgYSBcImZ1bmN0aW9uXCIuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBsb2coKSB7XG4gIC8vIHRoaXMgaGFja2VyeSBpcyByZXF1aXJlZCBmb3IgSUU4LzksIHdoZXJlXG4gIC8vIHRoZSBgY29uc29sZS5sb2dgIGZ1bmN0aW9uIGRvZXNuJ3QgaGF2ZSAnYXBwbHknXG4gIHJldHVybiAnb2JqZWN0JyA9PT0gdHlwZW9mIGNvbnNvbGVcbiAgICAmJiBjb25zb2xlLmxvZ1xuICAgICYmIEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseS5jYWxsKGNvbnNvbGUubG9nLCBjb25zb2xlLCBhcmd1bWVudHMpO1xufVxuXG4vKipcbiAqIFNhdmUgYG5hbWVzcGFjZXNgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VzXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzYXZlKG5hbWVzcGFjZXMpIHtcbiAgdHJ5IHtcbiAgICBpZiAobnVsbCA9PSBuYW1lc3BhY2VzKSB7XG4gICAgICBleHBvcnRzLnN0b3JhZ2UucmVtb3ZlSXRlbSgnZGVidWcnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXhwb3J0cy5zdG9yYWdlLmRlYnVnID0gbmFtZXNwYWNlcztcbiAgICB9XG4gIH0gY2F0Y2goZSkge31cbn1cblxuLyoqXG4gKiBMb2FkIGBuYW1lc3BhY2VzYC5cbiAqXG4gKiBAcmV0dXJuIHtTdHJpbmd9IHJldHVybnMgdGhlIHByZXZpb3VzbHkgcGVyc2lzdGVkIGRlYnVnIG1vZGVzXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBsb2FkKCkge1xuICB2YXIgcjtcbiAgdHJ5IHtcbiAgICByID0gZXhwb3J0cy5zdG9yYWdlLmRlYnVnO1xuICB9IGNhdGNoKGUpIHt9XG4gIHJldHVybiByO1xufVxuXG4vKipcbiAqIEVuYWJsZSBuYW1lc3BhY2VzIGxpc3RlZCBpbiBgbG9jYWxTdG9yYWdlLmRlYnVnYCBpbml0aWFsbHkuXG4gKi9cblxuZXhwb3J0cy5lbmFibGUobG9hZCgpKTtcblxuLyoqXG4gKiBMb2NhbHN0b3JhZ2UgYXR0ZW1wdHMgdG8gcmV0dXJuIHRoZSBsb2NhbHN0b3JhZ2UuXG4gKlxuICogVGhpcyBpcyBuZWNlc3NhcnkgYmVjYXVzZSBzYWZhcmkgdGhyb3dzXG4gKiB3aGVuIGEgdXNlciBkaXNhYmxlcyBjb29raWVzL2xvY2Fsc3RvcmFnZVxuICogYW5kIHlvdSBhdHRlbXB0IHRvIGFjY2VzcyBpdC5cbiAqXG4gKiBAcmV0dXJuIHtMb2NhbFN0b3JhZ2V9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBsb2NhbHN0b3JhZ2UoKXtcbiAgdHJ5IHtcbiAgICByZXR1cm4gd2luZG93LmxvY2FsU3RvcmFnZTtcbiAgfSBjYXRjaCAoZSkge31cbn1cbiIsIlxuLyoqXG4gKiBUaGlzIGlzIHRoZSBjb21tb24gbG9naWMgZm9yIGJvdGggdGhlIE5vZGUuanMgYW5kIHdlYiBicm93c2VyXG4gKiBpbXBsZW1lbnRhdGlvbnMgb2YgYGRlYnVnKClgLlxuICpcbiAqIEV4cG9zZSBgZGVidWcoKWAgYXMgdGhlIG1vZHVsZS5cbiAqL1xuXG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBkZWJ1ZztcbmV4cG9ydHMuY29lcmNlID0gY29lcmNlO1xuZXhwb3J0cy5kaXNhYmxlID0gZGlzYWJsZTtcbmV4cG9ydHMuZW5hYmxlID0gZW5hYmxlO1xuZXhwb3J0cy5lbmFibGVkID0gZW5hYmxlZDtcbmV4cG9ydHMuaHVtYW5pemUgPSByZXF1aXJlKCdtcycpO1xuXG4vKipcbiAqIFRoZSBjdXJyZW50bHkgYWN0aXZlIGRlYnVnIG1vZGUgbmFtZXMsIGFuZCBuYW1lcyB0byBza2lwLlxuICovXG5cbmV4cG9ydHMubmFtZXMgPSBbXTtcbmV4cG9ydHMuc2tpcHMgPSBbXTtcblxuLyoqXG4gKiBNYXAgb2Ygc3BlY2lhbCBcIiVuXCIgaGFuZGxpbmcgZnVuY3Rpb25zLCBmb3IgdGhlIGRlYnVnIFwiZm9ybWF0XCIgYXJndW1lbnQuXG4gKlxuICogVmFsaWQga2V5IG5hbWVzIGFyZSBhIHNpbmdsZSwgbG93ZXJjYXNlZCBsZXR0ZXIsIGkuZS4gXCJuXCIuXG4gKi9cblxuZXhwb3J0cy5mb3JtYXR0ZXJzID0ge307XG5cbi8qKlxuICogUHJldmlvdXNseSBhc3NpZ25lZCBjb2xvci5cbiAqL1xuXG52YXIgcHJldkNvbG9yID0gMDtcblxuLyoqXG4gKiBQcmV2aW91cyBsb2cgdGltZXN0YW1wLlxuICovXG5cbnZhciBwcmV2VGltZTtcblxuLyoqXG4gKiBTZWxlY3QgYSBjb2xvci5cbiAqXG4gKiBAcmV0dXJuIHtOdW1iZXJ9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzZWxlY3RDb2xvcigpIHtcbiAgcmV0dXJuIGV4cG9ydHMuY29sb3JzW3ByZXZDb2xvcisrICUgZXhwb3J0cy5jb2xvcnMubGVuZ3RoXTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBkZWJ1Z2dlciB3aXRoIHRoZSBnaXZlbiBgbmFtZXNwYWNlYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZGVidWcobmFtZXNwYWNlKSB7XG5cbiAgLy8gZGVmaW5lIHRoZSBgZGlzYWJsZWRgIHZlcnNpb25cbiAgZnVuY3Rpb24gZGlzYWJsZWQoKSB7XG4gIH1cbiAgZGlzYWJsZWQuZW5hYmxlZCA9IGZhbHNlO1xuXG4gIC8vIGRlZmluZSB0aGUgYGVuYWJsZWRgIHZlcnNpb25cbiAgZnVuY3Rpb24gZW5hYmxlZCgpIHtcblxuICAgIHZhciBzZWxmID0gZW5hYmxlZDtcblxuICAgIC8vIHNldCBgZGlmZmAgdGltZXN0YW1wXG4gICAgdmFyIGN1cnIgPSArbmV3IERhdGUoKTtcbiAgICB2YXIgbXMgPSBjdXJyIC0gKHByZXZUaW1lIHx8IGN1cnIpO1xuICAgIHNlbGYuZGlmZiA9IG1zO1xuICAgIHNlbGYucHJldiA9IHByZXZUaW1lO1xuICAgIHNlbGYuY3VyciA9IGN1cnI7XG4gICAgcHJldlRpbWUgPSBjdXJyO1xuXG4gICAgLy8gYWRkIHRoZSBgY29sb3JgIGlmIG5vdCBzZXRcbiAgICBpZiAobnVsbCA9PSBzZWxmLnVzZUNvbG9ycykgc2VsZi51c2VDb2xvcnMgPSBleHBvcnRzLnVzZUNvbG9ycygpO1xuICAgIGlmIChudWxsID09IHNlbGYuY29sb3IgJiYgc2VsZi51c2VDb2xvcnMpIHNlbGYuY29sb3IgPSBzZWxlY3RDb2xvcigpO1xuXG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuXG4gICAgYXJnc1swXSA9IGV4cG9ydHMuY29lcmNlKGFyZ3NbMF0pO1xuXG4gICAgaWYgKCdzdHJpbmcnICE9PSB0eXBlb2YgYXJnc1swXSkge1xuICAgICAgLy8gYW55dGhpbmcgZWxzZSBsZXQncyBpbnNwZWN0IHdpdGggJW9cbiAgICAgIGFyZ3MgPSBbJyVvJ10uY29uY2F0KGFyZ3MpO1xuICAgIH1cblxuICAgIC8vIGFwcGx5IGFueSBgZm9ybWF0dGVyc2AgdHJhbnNmb3JtYXRpb25zXG4gICAgdmFyIGluZGV4ID0gMDtcbiAgICBhcmdzWzBdID0gYXJnc1swXS5yZXBsYWNlKC8lKFthLXolXSkvZywgZnVuY3Rpb24obWF0Y2gsIGZvcm1hdCkge1xuICAgICAgLy8gaWYgd2UgZW5jb3VudGVyIGFuIGVzY2FwZWQgJSB0aGVuIGRvbid0IGluY3JlYXNlIHRoZSBhcnJheSBpbmRleFxuICAgICAgaWYgKG1hdGNoID09PSAnJSUnKSByZXR1cm4gbWF0Y2g7XG4gICAgICBpbmRleCsrO1xuICAgICAgdmFyIGZvcm1hdHRlciA9IGV4cG9ydHMuZm9ybWF0dGVyc1tmb3JtYXRdO1xuICAgICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBmb3JtYXR0ZXIpIHtcbiAgICAgICAgdmFyIHZhbCA9IGFyZ3NbaW5kZXhdO1xuICAgICAgICBtYXRjaCA9IGZvcm1hdHRlci5jYWxsKHNlbGYsIHZhbCk7XG5cbiAgICAgICAgLy8gbm93IHdlIG5lZWQgdG8gcmVtb3ZlIGBhcmdzW2luZGV4XWAgc2luY2UgaXQncyBpbmxpbmVkIGluIHRoZSBgZm9ybWF0YFxuICAgICAgICBhcmdzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIGluZGV4LS07XG4gICAgICB9XG4gICAgICByZXR1cm4gbWF0Y2g7XG4gICAgfSk7XG5cbiAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGV4cG9ydHMuZm9ybWF0QXJncykge1xuICAgICAgYXJncyA9IGV4cG9ydHMuZm9ybWF0QXJncy5hcHBseShzZWxmLCBhcmdzKTtcbiAgICB9XG4gICAgdmFyIGxvZ0ZuID0gZW5hYmxlZC5sb2cgfHwgZXhwb3J0cy5sb2cgfHwgY29uc29sZS5sb2cuYmluZChjb25zb2xlKTtcbiAgICBsb2dGbi5hcHBseShzZWxmLCBhcmdzKTtcbiAgfVxuICBlbmFibGVkLmVuYWJsZWQgPSB0cnVlO1xuXG4gIHZhciBmbiA9IGV4cG9ydHMuZW5hYmxlZChuYW1lc3BhY2UpID8gZW5hYmxlZCA6IGRpc2FibGVkO1xuXG4gIGZuLm5hbWVzcGFjZSA9IG5hbWVzcGFjZTtcblxuICByZXR1cm4gZm47XG59XG5cbi8qKlxuICogRW5hYmxlcyBhIGRlYnVnIG1vZGUgYnkgbmFtZXNwYWNlcy4gVGhpcyBjYW4gaW5jbHVkZSBtb2Rlc1xuICogc2VwYXJhdGVkIGJ5IGEgY29sb24gYW5kIHdpbGRjYXJkcy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlc1xuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBlbmFibGUobmFtZXNwYWNlcykge1xuICBleHBvcnRzLnNhdmUobmFtZXNwYWNlcyk7XG5cbiAgdmFyIHNwbGl0ID0gKG5hbWVzcGFjZXMgfHwgJycpLnNwbGl0KC9bXFxzLF0rLyk7XG4gIHZhciBsZW4gPSBzcGxpdC5sZW5ndGg7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIGlmICghc3BsaXRbaV0pIGNvbnRpbnVlOyAvLyBpZ25vcmUgZW1wdHkgc3RyaW5nc1xuICAgIG5hbWVzcGFjZXMgPSBzcGxpdFtpXS5yZXBsYWNlKC9cXCovZywgJy4qPycpO1xuICAgIGlmIChuYW1lc3BhY2VzWzBdID09PSAnLScpIHtcbiAgICAgIGV4cG9ydHMuc2tpcHMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWVzcGFjZXMuc3Vic3RyKDEpICsgJyQnKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGV4cG9ydHMubmFtZXMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWVzcGFjZXMgKyAnJCcpKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBEaXNhYmxlIGRlYnVnIG91dHB1dC5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGRpc2FibGUoKSB7XG4gIGV4cG9ydHMuZW5hYmxlKCcnKTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIGdpdmVuIG1vZGUgbmFtZSBpcyBlbmFibGVkLCBmYWxzZSBvdGhlcndpc2UuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGVuYWJsZWQobmFtZSkge1xuICB2YXIgaSwgbGVuO1xuICBmb3IgKGkgPSAwLCBsZW4gPSBleHBvcnRzLnNraXBzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKGV4cG9ydHMuc2tpcHNbaV0udGVzdChuYW1lKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICBmb3IgKGkgPSAwLCBsZW4gPSBleHBvcnRzLm5hbWVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKGV4cG9ydHMubmFtZXNbaV0udGVzdChuYW1lKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuLyoqXG4gKiBDb2VyY2UgYHZhbGAuXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gdmFsXG4gKiBAcmV0dXJuIHtNaXhlZH1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGNvZXJjZSh2YWwpIHtcbiAgaWYgKHZhbCBpbnN0YW5jZW9mIEVycm9yKSByZXR1cm4gdmFsLnN0YWNrIHx8IHZhbC5tZXNzYWdlO1xuICByZXR1cm4gdmFsO1xufVxuIiwiLyoqXG4gKiBIZWxwZXJzLlxuICovXG5cbnZhciBzID0gMTAwMDtcbnZhciBtID0gcyAqIDYwO1xudmFyIGggPSBtICogNjA7XG52YXIgZCA9IGggKiAyNDtcbnZhciB5ID0gZCAqIDM2NS4yNTtcblxuLyoqXG4gKiBQYXJzZSBvciBmb3JtYXQgdGhlIGdpdmVuIGB2YWxgLlxuICpcbiAqIE9wdGlvbnM6XG4gKlxuICogIC0gYGxvbmdgIHZlcmJvc2UgZm9ybWF0dGluZyBbZmFsc2VdXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8TnVtYmVyfSB2YWxcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtTdHJpbmd8TnVtYmVyfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHZhbCwgb3B0aW9ucyl7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICBpZiAoJ3N0cmluZycgPT0gdHlwZW9mIHZhbCkgcmV0dXJuIHBhcnNlKHZhbCk7XG4gIHJldHVybiBvcHRpb25zLmxvbmdcbiAgICA/IGxvbmcodmFsKVxuICAgIDogc2hvcnQodmFsKTtcbn07XG5cbi8qKlxuICogUGFyc2UgdGhlIGdpdmVuIGBzdHJgIGFuZCByZXR1cm4gbWlsbGlzZWNvbmRzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcbiAqIEByZXR1cm4ge051bWJlcn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHBhcnNlKHN0cikge1xuICBzdHIgPSAnJyArIHN0cjtcbiAgaWYgKHN0ci5sZW5ndGggPiAxMDAwMCkgcmV0dXJuO1xuICB2YXIgbWF0Y2ggPSAvXigoPzpcXGQrKT9cXC4/XFxkKykgKihtaWxsaXNlY29uZHM/fG1zZWNzP3xtc3xzZWNvbmRzP3xzZWNzP3xzfG1pbnV0ZXM/fG1pbnM/fG18aG91cnM/fGhycz98aHxkYXlzP3xkfHllYXJzP3x5cnM/fHkpPyQvaS5leGVjKHN0cik7XG4gIGlmICghbWF0Y2gpIHJldHVybjtcbiAgdmFyIG4gPSBwYXJzZUZsb2F0KG1hdGNoWzFdKTtcbiAgdmFyIHR5cGUgPSAobWF0Y2hbMl0gfHwgJ21zJykudG9Mb3dlckNhc2UoKTtcbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSAneWVhcnMnOlxuICAgIGNhc2UgJ3llYXInOlxuICAgIGNhc2UgJ3lycyc6XG4gICAgY2FzZSAneXInOlxuICAgIGNhc2UgJ3knOlxuICAgICAgcmV0dXJuIG4gKiB5O1xuICAgIGNhc2UgJ2RheXMnOlxuICAgIGNhc2UgJ2RheSc6XG4gICAgY2FzZSAnZCc6XG4gICAgICByZXR1cm4gbiAqIGQ7XG4gICAgY2FzZSAnaG91cnMnOlxuICAgIGNhc2UgJ2hvdXInOlxuICAgIGNhc2UgJ2hycyc6XG4gICAgY2FzZSAnaHInOlxuICAgIGNhc2UgJ2gnOlxuICAgICAgcmV0dXJuIG4gKiBoO1xuICAgIGNhc2UgJ21pbnV0ZXMnOlxuICAgIGNhc2UgJ21pbnV0ZSc6XG4gICAgY2FzZSAnbWlucyc6XG4gICAgY2FzZSAnbWluJzpcbiAgICBjYXNlICdtJzpcbiAgICAgIHJldHVybiBuICogbTtcbiAgICBjYXNlICdzZWNvbmRzJzpcbiAgICBjYXNlICdzZWNvbmQnOlxuICAgIGNhc2UgJ3NlY3MnOlxuICAgIGNhc2UgJ3NlYyc6XG4gICAgY2FzZSAncyc6XG4gICAgICByZXR1cm4gbiAqIHM7XG4gICAgY2FzZSAnbWlsbGlzZWNvbmRzJzpcbiAgICBjYXNlICdtaWxsaXNlY29uZCc6XG4gICAgY2FzZSAnbXNlY3MnOlxuICAgIGNhc2UgJ21zZWMnOlxuICAgIGNhc2UgJ21zJzpcbiAgICAgIHJldHVybiBuO1xuICB9XG59XG5cbi8qKlxuICogU2hvcnQgZm9ybWF0IGZvciBgbXNgLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBtc1xuICogQHJldHVybiB7U3RyaW5nfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gc2hvcnQobXMpIHtcbiAgaWYgKG1zID49IGQpIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gZCkgKyAnZCc7XG4gIGlmIChtcyA+PSBoKSByZXR1cm4gTWF0aC5yb3VuZChtcyAvIGgpICsgJ2gnO1xuICBpZiAobXMgPj0gbSkgcmV0dXJuIE1hdGgucm91bmQobXMgLyBtKSArICdtJztcbiAgaWYgKG1zID49IHMpIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gcykgKyAncyc7XG4gIHJldHVybiBtcyArICdtcyc7XG59XG5cbi8qKlxuICogTG9uZyBmb3JtYXQgZm9yIGBtc2AuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1zXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBsb25nKG1zKSB7XG4gIHJldHVybiBwbHVyYWwobXMsIGQsICdkYXknKVxuICAgIHx8IHBsdXJhbChtcywgaCwgJ2hvdXInKVxuICAgIHx8IHBsdXJhbChtcywgbSwgJ21pbnV0ZScpXG4gICAgfHwgcGx1cmFsKG1zLCBzLCAnc2Vjb25kJylcbiAgICB8fCBtcyArICcgbXMnO1xufVxuXG4vKipcbiAqIFBsdXJhbGl6YXRpb24gaGVscGVyLlxuICovXG5cbmZ1bmN0aW9uIHBsdXJhbChtcywgbiwgbmFtZSkge1xuICBpZiAobXMgPCBuKSByZXR1cm47XG4gIGlmIChtcyA8IG4gKiAxLjUpIHJldHVybiBNYXRoLmZsb29yKG1zIC8gbikgKyAnICcgKyBuYW1lO1xuICByZXR1cm4gTWF0aC5jZWlsKG1zIC8gbikgKyAnICcgKyBuYW1lICsgJ3MnO1xufVxuIiwiLyoqIEBsaWNlbnNlIE1JVCBMaWNlbnNlIChjKSBjb3B5cmlnaHQgMjAxMC0yMDE0IG9yaWdpbmFsIGF1dGhvciBvciBhdXRob3JzICovXG4vKiogQGF1dGhvciBCcmlhbiBDYXZhbGllciAqL1xuLyoqIEBhdXRob3IgSm9obiBIYW5uICovXG5cbihmdW5jdGlvbihkZWZpbmUpIHsgJ3VzZSBzdHJpY3QnO1xuZGVmaW5lKGZ1bmN0aW9uIChyZXF1aXJlKSB7XG5cblx0dmFyIG1ha2VQcm9taXNlID0gcmVxdWlyZSgnLi9tYWtlUHJvbWlzZScpO1xuXHR2YXIgU2NoZWR1bGVyID0gcmVxdWlyZSgnLi9TY2hlZHVsZXInKTtcblx0dmFyIGFzeW5jID0gcmVxdWlyZSgnLi9lbnYnKS5hc2FwO1xuXG5cdHJldHVybiBtYWtlUHJvbWlzZSh7XG5cdFx0c2NoZWR1bGVyOiBuZXcgU2NoZWR1bGVyKGFzeW5jKVxuXHR9KTtcblxufSk7XG59KSh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQgPyBkZWZpbmUgOiBmdW5jdGlvbiAoZmFjdG9yeSkgeyBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkocmVxdWlyZSk7IH0pO1xuIiwiLyoqIEBsaWNlbnNlIE1JVCBMaWNlbnNlIChjKSBjb3B5cmlnaHQgMjAxMC0yMDE0IG9yaWdpbmFsIGF1dGhvciBvciBhdXRob3JzICovXG4vKiogQGF1dGhvciBCcmlhbiBDYXZhbGllciAqL1xuLyoqIEBhdXRob3IgSm9obiBIYW5uICovXG5cbihmdW5jdGlvbihkZWZpbmUpIHsgJ3VzZSBzdHJpY3QnO1xuZGVmaW5lKGZ1bmN0aW9uKCkge1xuXG5cdC8vIENyZWRpdCB0byBUd2lzb2wgKGh0dHBzOi8vZ2l0aHViLmNvbS9Ud2lzb2wpIGZvciBzdWdnZXN0aW5nXG5cdC8vIHRoaXMgdHlwZSBvZiBleHRlbnNpYmxlIHF1ZXVlICsgdHJhbXBvbGluZSBhcHByb2FjaCBmb3IgbmV4dC10aWNrIGNvbmZsYXRpb24uXG5cblx0LyoqXG5cdCAqIEFzeW5jIHRhc2sgc2NoZWR1bGVyXG5cdCAqIEBwYXJhbSB7ZnVuY3Rpb259IGFzeW5jIGZ1bmN0aW9uIHRvIHNjaGVkdWxlIGEgc2luZ2xlIGFzeW5jIGZ1bmN0aW9uXG5cdCAqIEBjb25zdHJ1Y3RvclxuXHQgKi9cblx0ZnVuY3Rpb24gU2NoZWR1bGVyKGFzeW5jKSB7XG5cdFx0dGhpcy5fYXN5bmMgPSBhc3luYztcblx0XHR0aGlzLl9ydW5uaW5nID0gZmFsc2U7XG5cblx0XHR0aGlzLl9xdWV1ZSA9IHRoaXM7XG5cdFx0dGhpcy5fcXVldWVMZW4gPSAwO1xuXHRcdHRoaXMuX2FmdGVyUXVldWUgPSB7fTtcblx0XHR0aGlzLl9hZnRlclF1ZXVlTGVuID0gMDtcblxuXHRcdHZhciBzZWxmID0gdGhpcztcblx0XHR0aGlzLmRyYWluID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRzZWxmLl9kcmFpbigpO1xuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogRW5xdWV1ZSBhIHRhc2tcblx0ICogQHBhcmFtIHt7IHJ1bjpmdW5jdGlvbiB9fSB0YXNrXG5cdCAqL1xuXHRTY2hlZHVsZXIucHJvdG90eXBlLmVucXVldWUgPSBmdW5jdGlvbih0YXNrKSB7XG5cdFx0dGhpcy5fcXVldWVbdGhpcy5fcXVldWVMZW4rK10gPSB0YXNrO1xuXHRcdHRoaXMucnVuKCk7XG5cdH07XG5cblx0LyoqXG5cdCAqIEVucXVldWUgYSB0YXNrIHRvIHJ1biBhZnRlciB0aGUgbWFpbiB0YXNrIHF1ZXVlXG5cdCAqIEBwYXJhbSB7eyBydW46ZnVuY3Rpb24gfX0gdGFza1xuXHQgKi9cblx0U2NoZWR1bGVyLnByb3RvdHlwZS5hZnRlclF1ZXVlID0gZnVuY3Rpb24odGFzaykge1xuXHRcdHRoaXMuX2FmdGVyUXVldWVbdGhpcy5fYWZ0ZXJRdWV1ZUxlbisrXSA9IHRhc2s7XG5cdFx0dGhpcy5ydW4oKTtcblx0fTtcblxuXHRTY2hlZHVsZXIucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uKCkge1xuXHRcdGlmICghdGhpcy5fcnVubmluZykge1xuXHRcdFx0dGhpcy5fcnVubmluZyA9IHRydWU7XG5cdFx0XHR0aGlzLl9hc3luYyh0aGlzLmRyYWluKTtcblx0XHR9XG5cdH07XG5cblx0LyoqXG5cdCAqIERyYWluIHRoZSBoYW5kbGVyIHF1ZXVlIGVudGlyZWx5LCBhbmQgdGhlbiB0aGUgYWZ0ZXIgcXVldWVcblx0ICovXG5cdFNjaGVkdWxlci5wcm90b3R5cGUuX2RyYWluID0gZnVuY3Rpb24oKSB7XG5cdFx0dmFyIGkgPSAwO1xuXHRcdGZvciAoOyBpIDwgdGhpcy5fcXVldWVMZW47ICsraSkge1xuXHRcdFx0dGhpcy5fcXVldWVbaV0ucnVuKCk7XG5cdFx0XHR0aGlzLl9xdWV1ZVtpXSA9IHZvaWQgMDtcblx0XHR9XG5cblx0XHR0aGlzLl9xdWV1ZUxlbiA9IDA7XG5cdFx0dGhpcy5fcnVubmluZyA9IGZhbHNlO1xuXG5cdFx0Zm9yIChpID0gMDsgaSA8IHRoaXMuX2FmdGVyUXVldWVMZW47ICsraSkge1xuXHRcdFx0dGhpcy5fYWZ0ZXJRdWV1ZVtpXS5ydW4oKTtcblx0XHRcdHRoaXMuX2FmdGVyUXVldWVbaV0gPSB2b2lkIDA7XG5cdFx0fVxuXG5cdFx0dGhpcy5fYWZ0ZXJRdWV1ZUxlbiA9IDA7XG5cdH07XG5cblx0cmV0dXJuIFNjaGVkdWxlcjtcblxufSk7XG59KHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCA/IGRlZmluZSA6IGZ1bmN0aW9uKGZhY3RvcnkpIHsgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KCk7IH0pKTtcbiIsIi8qKiBAbGljZW5zZSBNSVQgTGljZW5zZSAoYykgY29weXJpZ2h0IDIwMTAtMjAxNCBvcmlnaW5hbCBhdXRob3Igb3IgYXV0aG9ycyAqL1xuLyoqIEBhdXRob3IgQnJpYW4gQ2F2YWxpZXIgKi9cbi8qKiBAYXV0aG9yIEpvaG4gSGFubiAqL1xuXG4oZnVuY3Rpb24oZGVmaW5lKSB7ICd1c2Ugc3RyaWN0JztcbmRlZmluZShmdW5jdGlvbigpIHtcblxuXHQvKipcblx0ICogQ3VzdG9tIGVycm9yIHR5cGUgZm9yIHByb21pc2VzIHJlamVjdGVkIGJ5IHByb21pc2UudGltZW91dFxuXHQgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZVxuXHQgKiBAY29uc3RydWN0b3Jcblx0ICovXG5cdGZ1bmN0aW9uIFRpbWVvdXRFcnJvciAobWVzc2FnZSkge1xuXHRcdEVycm9yLmNhbGwodGhpcyk7XG5cdFx0dGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcblx0XHR0aGlzLm5hbWUgPSBUaW1lb3V0RXJyb3IubmFtZTtcblx0XHRpZiAodHlwZW9mIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCBUaW1lb3V0RXJyb3IpO1xuXHRcdH1cblx0fVxuXG5cdFRpbWVvdXRFcnJvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEVycm9yLnByb3RvdHlwZSk7XG5cdFRpbWVvdXRFcnJvci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBUaW1lb3V0RXJyb3I7XG5cblx0cmV0dXJuIFRpbWVvdXRFcnJvcjtcbn0pO1xufSh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQgPyBkZWZpbmUgOiBmdW5jdGlvbihmYWN0b3J5KSB7IG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeSgpOyB9KSk7IiwiLyoqIEBsaWNlbnNlIE1JVCBMaWNlbnNlIChjKSBjb3B5cmlnaHQgMjAxMC0yMDE0IG9yaWdpbmFsIGF1dGhvciBvciBhdXRob3JzICovXG4vKiogQGF1dGhvciBCcmlhbiBDYXZhbGllciAqL1xuLyoqIEBhdXRob3IgSm9obiBIYW5uICovXG5cbihmdW5jdGlvbihkZWZpbmUpIHsgJ3VzZSBzdHJpY3QnO1xuZGVmaW5lKGZ1bmN0aW9uKCkge1xuXG5cdG1ha2VBcHBseS50cnlDYXRjaFJlc29sdmUgPSB0cnlDYXRjaFJlc29sdmU7XG5cblx0cmV0dXJuIG1ha2VBcHBseTtcblxuXHRmdW5jdGlvbiBtYWtlQXBwbHkoUHJvbWlzZSwgY2FsbCkge1xuXHRcdGlmKGFyZ3VtZW50cy5sZW5ndGggPCAyKSB7XG5cdFx0XHRjYWxsID0gdHJ5Q2F0Y2hSZXNvbHZlO1xuXHRcdH1cblxuXHRcdHJldHVybiBhcHBseTtcblxuXHRcdGZ1bmN0aW9uIGFwcGx5KGYsIHRoaXNBcmcsIGFyZ3MpIHtcblx0XHRcdHZhciBwID0gUHJvbWlzZS5fZGVmZXIoKTtcblx0XHRcdHZhciBsID0gYXJncy5sZW5ndGg7XG5cdFx0XHR2YXIgcGFyYW1zID0gbmV3IEFycmF5KGwpO1xuXHRcdFx0Y2FsbEFuZFJlc29sdmUoeyBmOmYsIHRoaXNBcmc6dGhpc0FyZywgYXJnczphcmdzLCBwYXJhbXM6cGFyYW1zLCBpOmwtMSwgY2FsbDpjYWxsIH0sIHAuX2hhbmRsZXIpO1xuXG5cdFx0XHRyZXR1cm4gcDtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBjYWxsQW5kUmVzb2x2ZShjLCBoKSB7XG5cdFx0XHRpZihjLmkgPCAwKSB7XG5cdFx0XHRcdHJldHVybiBjYWxsKGMuZiwgYy50aGlzQXJnLCBjLnBhcmFtcywgaCk7XG5cdFx0XHR9XG5cblx0XHRcdHZhciBoYW5kbGVyID0gUHJvbWlzZS5faGFuZGxlcihjLmFyZ3NbYy5pXSk7XG5cdFx0XHRoYW5kbGVyLmZvbGQoY2FsbEFuZFJlc29sdmVOZXh0LCBjLCB2b2lkIDAsIGgpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGNhbGxBbmRSZXNvbHZlTmV4dChjLCB4LCBoKSB7XG5cdFx0XHRjLnBhcmFtc1tjLmldID0geDtcblx0XHRcdGMuaSAtPSAxO1xuXHRcdFx0Y2FsbEFuZFJlc29sdmUoYywgaCk7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gdHJ5Q2F0Y2hSZXNvbHZlKGYsIHRoaXNBcmcsIGFyZ3MsIHJlc29sdmVyKSB7XG5cdFx0dHJ5IHtcblx0XHRcdHJlc29sdmVyLnJlc29sdmUoZi5hcHBseSh0aGlzQXJnLCBhcmdzKSk7XG5cdFx0fSBjYXRjaChlKSB7XG5cdFx0XHRyZXNvbHZlci5yZWplY3QoZSk7XG5cdFx0fVxuXHR9XG5cbn0pO1xufSh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQgPyBkZWZpbmUgOiBmdW5jdGlvbihmYWN0b3J5KSB7IG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeSgpOyB9KSk7XG5cblxuIiwiLyoqIEBsaWNlbnNlIE1JVCBMaWNlbnNlIChjKSBjb3B5cmlnaHQgMjAxMC0yMDE0IG9yaWdpbmFsIGF1dGhvciBvciBhdXRob3JzICovXG4vKiogQGF1dGhvciBCcmlhbiBDYXZhbGllciAqL1xuLyoqIEBhdXRob3IgSm9obiBIYW5uICovXG5cbihmdW5jdGlvbihkZWZpbmUpIHsgJ3VzZSBzdHJpY3QnO1xuZGVmaW5lKGZ1bmN0aW9uKHJlcXVpcmUpIHtcblxuXHR2YXIgc3RhdGUgPSByZXF1aXJlKCcuLi9zdGF0ZScpO1xuXHR2YXIgYXBwbGllciA9IHJlcXVpcmUoJy4uL2FwcGx5Jyk7XG5cblx0cmV0dXJuIGZ1bmN0aW9uIGFycmF5KFByb21pc2UpIHtcblxuXHRcdHZhciBhcHBseUZvbGQgPSBhcHBsaWVyKFByb21pc2UpO1xuXHRcdHZhciB0b1Byb21pc2UgPSBQcm9taXNlLnJlc29sdmU7XG5cdFx0dmFyIGFsbCA9IFByb21pc2UuYWxsO1xuXG5cdFx0dmFyIGFyID0gQXJyYXkucHJvdG90eXBlLnJlZHVjZTtcblx0XHR2YXIgYXJyID0gQXJyYXkucHJvdG90eXBlLnJlZHVjZVJpZ2h0O1xuXHRcdHZhciBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZTtcblxuXHRcdC8vIEFkZGl0aW9uYWwgYXJyYXkgY29tYmluYXRvcnNcblxuXHRcdFByb21pc2UuYW55ID0gYW55O1xuXHRcdFByb21pc2Uuc29tZSA9IHNvbWU7XG5cdFx0UHJvbWlzZS5zZXR0bGUgPSBzZXR0bGU7XG5cblx0XHRQcm9taXNlLm1hcCA9IG1hcDtcblx0XHRQcm9taXNlLmZpbHRlciA9IGZpbHRlcjtcblx0XHRQcm9taXNlLnJlZHVjZSA9IHJlZHVjZTtcblx0XHRQcm9taXNlLnJlZHVjZVJpZ2h0ID0gcmVkdWNlUmlnaHQ7XG5cblx0XHQvKipcblx0XHQgKiBXaGVuIHRoaXMgcHJvbWlzZSBmdWxmaWxscyB3aXRoIGFuIGFycmF5LCBkb1xuXHRcdCAqIG9uRnVsZmlsbGVkLmFwcGx5KHZvaWQgMCwgYXJyYXkpXG5cdFx0ICogQHBhcmFtIHtmdW5jdGlvbn0gb25GdWxmaWxsZWQgZnVuY3Rpb24gdG8gYXBwbHlcblx0XHQgKiBAcmV0dXJucyB7UHJvbWlzZX0gcHJvbWlzZSBmb3IgdGhlIHJlc3VsdCBvZiBhcHBseWluZyBvbkZ1bGZpbGxlZFxuXHRcdCAqL1xuXHRcdFByb21pc2UucHJvdG90eXBlLnNwcmVhZCA9IGZ1bmN0aW9uKG9uRnVsZmlsbGVkKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy50aGVuKGFsbCkudGhlbihmdW5jdGlvbihhcnJheSkge1xuXHRcdFx0XHRyZXR1cm4gb25GdWxmaWxsZWQuYXBwbHkodGhpcywgYXJyYXkpO1xuXHRcdFx0fSk7XG5cdFx0fTtcblxuXHRcdHJldHVybiBQcm9taXNlO1xuXG5cdFx0LyoqXG5cdFx0ICogT25lLXdpbm5lciBjb21wZXRpdGl2ZSByYWNlLlxuXHRcdCAqIFJldHVybiBhIHByb21pc2UgdGhhdCB3aWxsIGZ1bGZpbGwgd2hlbiBvbmUgb2YgdGhlIHByb21pc2VzXG5cdFx0ICogaW4gdGhlIGlucHV0IGFycmF5IGZ1bGZpbGxzLCBvciB3aWxsIHJlamVjdCB3aGVuIGFsbCBwcm9taXNlc1xuXHRcdCAqIGhhdmUgcmVqZWN0ZWQuXG5cdFx0ICogQHBhcmFtIHthcnJheX0gcHJvbWlzZXNcblx0XHQgKiBAcmV0dXJucyB7UHJvbWlzZX0gcHJvbWlzZSBmb3IgdGhlIGZpcnN0IGZ1bGZpbGxlZCB2YWx1ZVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGFueShwcm9taXNlcykge1xuXHRcdFx0dmFyIHAgPSBQcm9taXNlLl9kZWZlcigpO1xuXHRcdFx0dmFyIHJlc29sdmVyID0gcC5faGFuZGxlcjtcblx0XHRcdHZhciBsID0gcHJvbWlzZXMubGVuZ3RoPj4+MDtcblxuXHRcdFx0dmFyIHBlbmRpbmcgPSBsO1xuXHRcdFx0dmFyIGVycm9ycyA9IFtdO1xuXG5cdFx0XHRmb3IgKHZhciBoLCB4LCBpID0gMDsgaSA8IGw7ICsraSkge1xuXHRcdFx0XHR4ID0gcHJvbWlzZXNbaV07XG5cdFx0XHRcdGlmKHggPT09IHZvaWQgMCAmJiAhKGkgaW4gcHJvbWlzZXMpKSB7XG5cdFx0XHRcdFx0LS1wZW5kaW5nO1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aCA9IFByb21pc2UuX2hhbmRsZXIoeCk7XG5cdFx0XHRcdGlmKGguc3RhdGUoKSA+IDApIHtcblx0XHRcdFx0XHRyZXNvbHZlci5iZWNvbWUoaCk7XG5cdFx0XHRcdFx0UHJvbWlzZS5fdmlzaXRSZW1haW5pbmcocHJvbWlzZXMsIGksIGgpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGgudmlzaXQocmVzb2x2ZXIsIGhhbmRsZUZ1bGZpbGwsIGhhbmRsZVJlamVjdCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYocGVuZGluZyA9PT0gMCkge1xuXHRcdFx0XHRyZXNvbHZlci5yZWplY3QobmV3IFJhbmdlRXJyb3IoJ2FueSgpOiBhcnJheSBtdXN0IG5vdCBiZSBlbXB0eScpKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHA7XG5cblx0XHRcdGZ1bmN0aW9uIGhhbmRsZUZ1bGZpbGwoeCkge1xuXHRcdFx0XHQvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSovXG5cdFx0XHRcdGVycm9ycyA9IG51bGw7XG5cdFx0XHRcdHRoaXMucmVzb2x2ZSh4KTsgLy8gdGhpcyA9PT0gcmVzb2x2ZXJcblx0XHRcdH1cblxuXHRcdFx0ZnVuY3Rpb24gaGFuZGxlUmVqZWN0KGUpIHtcblx0XHRcdFx0Lypqc2hpbnQgdmFsaWR0aGlzOnRydWUqL1xuXHRcdFx0XHRpZih0aGlzLnJlc29sdmVkKSB7IC8vIHRoaXMgPT09IHJlc29sdmVyXG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0ZXJyb3JzLnB1c2goZSk7XG5cdFx0XHRcdGlmKC0tcGVuZGluZyA9PT0gMCkge1xuXHRcdFx0XHRcdHRoaXMucmVqZWN0KGVycm9ycyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBOLXdpbm5lciBjb21wZXRpdGl2ZSByYWNlXG5cdFx0ICogUmV0dXJuIGEgcHJvbWlzZSB0aGF0IHdpbGwgZnVsZmlsbCB3aGVuIG4gaW5wdXQgcHJvbWlzZXMgaGF2ZVxuXHRcdCAqIGZ1bGZpbGxlZCwgb3Igd2lsbCByZWplY3Qgd2hlbiBpdCBiZWNvbWVzIGltcG9zc2libGUgZm9yIG5cblx0XHQgKiBpbnB1dCBwcm9taXNlcyB0byBmdWxmaWxsIChpZSB3aGVuIHByb21pc2VzLmxlbmd0aCAtIG4gKyAxXG5cdFx0ICogaGF2ZSByZWplY3RlZClcblx0XHQgKiBAcGFyYW0ge2FycmF5fSBwcm9taXNlc1xuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBuXG5cdFx0ICogQHJldHVybnMge1Byb21pc2V9IHByb21pc2UgZm9yIHRoZSBlYXJsaWVzdCBuIGZ1bGZpbGxtZW50IHZhbHVlc1xuXHRcdCAqXG5cdFx0ICogQGRlcHJlY2F0ZWRcblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzb21lKHByb21pc2VzLCBuKSB7XG5cdFx0XHQvKmpzaGludCBtYXhjb21wbGV4aXR5OjcqL1xuXHRcdFx0dmFyIHAgPSBQcm9taXNlLl9kZWZlcigpO1xuXHRcdFx0dmFyIHJlc29sdmVyID0gcC5faGFuZGxlcjtcblxuXHRcdFx0dmFyIHJlc3VsdHMgPSBbXTtcblx0XHRcdHZhciBlcnJvcnMgPSBbXTtcblxuXHRcdFx0dmFyIGwgPSBwcm9taXNlcy5sZW5ndGg+Pj4wO1xuXHRcdFx0dmFyIG5GdWxmaWxsID0gMDtcblx0XHRcdHZhciBuUmVqZWN0O1xuXHRcdFx0dmFyIHgsIGk7IC8vIHJldXNlZCBpbiBib3RoIGZvcigpIGxvb3BzXG5cblx0XHRcdC8vIEZpcnN0IHBhc3M6IGNvdW50IGFjdHVhbCBhcnJheSBpdGVtc1xuXHRcdFx0Zm9yKGk9MDsgaTxsOyArK2kpIHtcblx0XHRcdFx0eCA9IHByb21pc2VzW2ldO1xuXHRcdFx0XHRpZih4ID09PSB2b2lkIDAgJiYgIShpIGluIHByb21pc2VzKSkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdCsrbkZ1bGZpbGw7XG5cdFx0XHR9XG5cblx0XHRcdC8vIENvbXB1dGUgYWN0dWFsIGdvYWxzXG5cdFx0XHRuID0gTWF0aC5tYXgobiwgMCk7XG5cdFx0XHRuUmVqZWN0ID0gKG5GdWxmaWxsIC0gbiArIDEpO1xuXHRcdFx0bkZ1bGZpbGwgPSBNYXRoLm1pbihuLCBuRnVsZmlsbCk7XG5cblx0XHRcdGlmKG4gPiBuRnVsZmlsbCkge1xuXHRcdFx0XHRyZXNvbHZlci5yZWplY3QobmV3IFJhbmdlRXJyb3IoJ3NvbWUoKTogYXJyYXkgbXVzdCBjb250YWluIGF0IGxlYXN0ICdcblx0XHRcdFx0KyBuICsgJyBpdGVtKHMpLCBidXQgaGFkICcgKyBuRnVsZmlsbCkpO1xuXHRcdFx0fSBlbHNlIGlmKG5GdWxmaWxsID09PSAwKSB7XG5cdFx0XHRcdHJlc29sdmVyLnJlc29sdmUocmVzdWx0cyk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFNlY29uZCBwYXNzOiBvYnNlcnZlIGVhY2ggYXJyYXkgaXRlbSwgbWFrZSBwcm9ncmVzcyB0b3dhcmQgZ29hbHNcblx0XHRcdGZvcihpPTA7IGk8bDsgKytpKSB7XG5cdFx0XHRcdHggPSBwcm9taXNlc1tpXTtcblx0XHRcdFx0aWYoeCA9PT0gdm9pZCAwICYmICEoaSBpbiBwcm9taXNlcykpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdFByb21pc2UuX2hhbmRsZXIoeCkudmlzaXQocmVzb2x2ZXIsIGZ1bGZpbGwsIHJlamVjdCwgcmVzb2x2ZXIubm90aWZ5KTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHA7XG5cblx0XHRcdGZ1bmN0aW9uIGZ1bGZpbGwoeCkge1xuXHRcdFx0XHQvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSovXG5cdFx0XHRcdGlmKHRoaXMucmVzb2x2ZWQpIHsgLy8gdGhpcyA9PT0gcmVzb2x2ZXJcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXN1bHRzLnB1c2goeCk7XG5cdFx0XHRcdGlmKC0tbkZ1bGZpbGwgPT09IDApIHtcblx0XHRcdFx0XHRlcnJvcnMgPSBudWxsO1xuXHRcdFx0XHRcdHRoaXMucmVzb2x2ZShyZXN1bHRzKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRmdW5jdGlvbiByZWplY3QoZSkge1xuXHRcdFx0XHQvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSovXG5cdFx0XHRcdGlmKHRoaXMucmVzb2x2ZWQpIHsgLy8gdGhpcyA9PT0gcmVzb2x2ZXJcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRlcnJvcnMucHVzaChlKTtcblx0XHRcdFx0aWYoLS1uUmVqZWN0ID09PSAwKSB7XG5cdFx0XHRcdFx0cmVzdWx0cyA9IG51bGw7XG5cdFx0XHRcdFx0dGhpcy5yZWplY3QoZXJyb3JzKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFwcGx5IGYgdG8gdGhlIHZhbHVlIG9mIGVhY2ggcHJvbWlzZSBpbiBhIGxpc3Qgb2YgcHJvbWlzZXNcblx0XHQgKiBhbmQgcmV0dXJuIGEgbmV3IGxpc3QgY29udGFpbmluZyB0aGUgcmVzdWx0cy5cblx0XHQgKiBAcGFyYW0ge2FycmF5fSBwcm9taXNlc1xuXHRcdCAqIEBwYXJhbSB7ZnVuY3Rpb24oeDoqLCBpbmRleDpOdW1iZXIpOip9IGYgbWFwcGluZyBmdW5jdGlvblxuXHRcdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG1hcChwcm9taXNlcywgZikge1xuXHRcdFx0cmV0dXJuIFByb21pc2UuX3RyYXZlcnNlKGYsIHByb21pc2VzKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBGaWx0ZXIgdGhlIHByb3ZpZGVkIGFycmF5IG9mIHByb21pc2VzIHVzaW5nIHRoZSBwcm92aWRlZCBwcmVkaWNhdGUuICBJbnB1dCBtYXlcblx0XHQgKiBjb250YWluIHByb21pc2VzIGFuZCB2YWx1ZXNcblx0XHQgKiBAcGFyYW0ge0FycmF5fSBwcm9taXNlcyBhcnJheSBvZiBwcm9taXNlcyBhbmQgdmFsdWVzXG5cdFx0ICogQHBhcmFtIHtmdW5jdGlvbih4OiosIGluZGV4Ok51bWJlcik6Ym9vbGVhbn0gcHJlZGljYXRlIGZpbHRlcmluZyBwcmVkaWNhdGUuXG5cdFx0ICogIE11c3QgcmV0dXJuIHRydXRoeSAob3IgcHJvbWlzZSBmb3IgdHJ1dGh5KSBmb3IgaXRlbXMgdG8gcmV0YWluLlxuXHRcdCAqIEByZXR1cm5zIHtQcm9taXNlfSBwcm9taXNlIHRoYXQgd2lsbCBmdWxmaWxsIHdpdGggYW4gYXJyYXkgY29udGFpbmluZyBhbGwgaXRlbXNcblx0XHQgKiAgZm9yIHdoaWNoIHByZWRpY2F0ZSByZXR1cm5lZCB0cnV0aHkuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZmlsdGVyKHByb21pc2VzLCBwcmVkaWNhdGUpIHtcblx0XHRcdHZhciBhID0gc2xpY2UuY2FsbChwcm9taXNlcyk7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5fdHJhdmVyc2UocHJlZGljYXRlLCBhKS50aGVuKGZ1bmN0aW9uKGtlZXApIHtcblx0XHRcdFx0cmV0dXJuIGZpbHRlclN5bmMoYSwga2VlcCk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBmaWx0ZXJTeW5jKHByb21pc2VzLCBrZWVwKSB7XG5cdFx0XHQvLyBTYWZlIGJlY2F1c2Ugd2Uga25vdyBhbGwgcHJvbWlzZXMgaGF2ZSBmdWxmaWxsZWQgaWYgd2UndmUgbWFkZSBpdCB0aGlzIGZhclxuXHRcdFx0dmFyIGwgPSBrZWVwLmxlbmd0aDtcblx0XHRcdHZhciBmaWx0ZXJlZCA9IG5ldyBBcnJheShsKTtcblx0XHRcdGZvcih2YXIgaT0wLCBqPTA7IGk8bDsgKytpKSB7XG5cdFx0XHRcdGlmKGtlZXBbaV0pIHtcblx0XHRcdFx0XHRmaWx0ZXJlZFtqKytdID0gUHJvbWlzZS5faGFuZGxlcihwcm9taXNlc1tpXSkudmFsdWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGZpbHRlcmVkLmxlbmd0aCA9IGo7XG5cdFx0XHRyZXR1cm4gZmlsdGVyZWQ7XG5cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gYSBwcm9taXNlIHRoYXQgd2lsbCBhbHdheXMgZnVsZmlsbCB3aXRoIGFuIGFycmF5IGNvbnRhaW5pbmdcblx0XHQgKiB0aGUgb3V0Y29tZSBzdGF0ZXMgb2YgYWxsIGlucHV0IHByb21pc2VzLiAgVGhlIHJldHVybmVkIHByb21pc2Vcblx0XHQgKiB3aWxsIG5ldmVyIHJlamVjdC5cblx0XHQgKiBAcGFyYW0ge0FycmF5fSBwcm9taXNlc1xuXHRcdCAqIEByZXR1cm5zIHtQcm9taXNlfSBwcm9taXNlIGZvciBhcnJheSBvZiBzZXR0bGVkIHN0YXRlIGRlc2NyaXB0b3JzXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2V0dGxlKHByb21pc2VzKSB7XG5cdFx0XHRyZXR1cm4gYWxsKHByb21pc2VzLm1hcChzZXR0bGVPbmUpKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBzZXR0bGVPbmUocCkge1xuXHRcdFx0dmFyIGggPSBQcm9taXNlLl9oYW5kbGVyKHApO1xuXHRcdFx0aWYoaC5zdGF0ZSgpID09PSAwKSB7XG5cdFx0XHRcdHJldHVybiB0b1Byb21pc2UocCkudGhlbihzdGF0ZS5mdWxmaWxsZWQsIHN0YXRlLnJlamVjdGVkKTtcblx0XHRcdH1cblxuXHRcdFx0aC5fdW5yZXBvcnQoKTtcblx0XHRcdHJldHVybiBzdGF0ZS5pbnNwZWN0KGgpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFRyYWRpdGlvbmFsIHJlZHVjZSBmdW5jdGlvbiwgc2ltaWxhciB0byBgQXJyYXkucHJvdG90eXBlLnJlZHVjZSgpYCwgYnV0XG5cdFx0ICogaW5wdXQgbWF5IGNvbnRhaW4gcHJvbWlzZXMgYW5kL29yIHZhbHVlcywgYW5kIHJlZHVjZUZ1bmNcblx0XHQgKiBtYXkgcmV0dXJuIGVpdGhlciBhIHZhbHVlIG9yIGEgcHJvbWlzZSwgKmFuZCogaW5pdGlhbFZhbHVlIG1heVxuXHRcdCAqIGJlIGEgcHJvbWlzZSBmb3IgdGhlIHN0YXJ0aW5nIHZhbHVlLlxuXHRcdCAqIEBwYXJhbSB7QXJyYXl8UHJvbWlzZX0gcHJvbWlzZXMgYXJyYXkgb3IgcHJvbWlzZSBmb3IgYW4gYXJyYXkgb2YgYW55dGhpbmcsXG5cdFx0ICogICAgICBtYXkgY29udGFpbiBhIG1peCBvZiBwcm9taXNlcyBhbmQgdmFsdWVzLlxuXHRcdCAqIEBwYXJhbSB7ZnVuY3Rpb24oYWNjdW11bGF0ZWQ6KiwgeDoqLCBpbmRleDpOdW1iZXIpOip9IGYgcmVkdWNlIGZ1bmN0aW9uXG5cdFx0ICogQHJldHVybnMge1Byb21pc2V9IHRoYXQgd2lsbCByZXNvbHZlIHRvIHRoZSBmaW5hbCByZWR1Y2VkIHZhbHVlXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVkdWNlKHByb21pc2VzLCBmIC8qLCBpbml0aWFsVmFsdWUgKi8pIHtcblx0XHRcdHJldHVybiBhcmd1bWVudHMubGVuZ3RoID4gMiA/IGFyLmNhbGwocHJvbWlzZXMsIGxpZnRDb21iaW5lKGYpLCBhcmd1bWVudHNbMl0pXG5cdFx0XHRcdFx0OiBhci5jYWxsKHByb21pc2VzLCBsaWZ0Q29tYmluZShmKSk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogVHJhZGl0aW9uYWwgcmVkdWNlIGZ1bmN0aW9uLCBzaW1pbGFyIHRvIGBBcnJheS5wcm90b3R5cGUucmVkdWNlUmlnaHQoKWAsIGJ1dFxuXHRcdCAqIGlucHV0IG1heSBjb250YWluIHByb21pc2VzIGFuZC9vciB2YWx1ZXMsIGFuZCByZWR1Y2VGdW5jXG5cdFx0ICogbWF5IHJldHVybiBlaXRoZXIgYSB2YWx1ZSBvciBhIHByb21pc2UsICphbmQqIGluaXRpYWxWYWx1ZSBtYXlcblx0XHQgKiBiZSBhIHByb21pc2UgZm9yIHRoZSBzdGFydGluZyB2YWx1ZS5cblx0XHQgKiBAcGFyYW0ge0FycmF5fFByb21pc2V9IHByb21pc2VzIGFycmF5IG9yIHByb21pc2UgZm9yIGFuIGFycmF5IG9mIGFueXRoaW5nLFxuXHRcdCAqICAgICAgbWF5IGNvbnRhaW4gYSBtaXggb2YgcHJvbWlzZXMgYW5kIHZhbHVlcy5cblx0XHQgKiBAcGFyYW0ge2Z1bmN0aW9uKGFjY3VtdWxhdGVkOiosIHg6KiwgaW5kZXg6TnVtYmVyKToqfSBmIHJlZHVjZSBmdW5jdGlvblxuXHRcdCAqIEByZXR1cm5zIHtQcm9taXNlfSB0aGF0IHdpbGwgcmVzb2x2ZSB0byB0aGUgZmluYWwgcmVkdWNlZCB2YWx1ZVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlZHVjZVJpZ2h0KHByb21pc2VzLCBmIC8qLCBpbml0aWFsVmFsdWUgKi8pIHtcblx0XHRcdHJldHVybiBhcmd1bWVudHMubGVuZ3RoID4gMiA/IGFyci5jYWxsKHByb21pc2VzLCBsaWZ0Q29tYmluZShmKSwgYXJndW1lbnRzWzJdKVxuXHRcdFx0XHRcdDogYXJyLmNhbGwocHJvbWlzZXMsIGxpZnRDb21iaW5lKGYpKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBsaWZ0Q29tYmluZShmKSB7XG5cdFx0XHRyZXR1cm4gZnVuY3Rpb24oeiwgeCwgaSkge1xuXHRcdFx0XHRyZXR1cm4gYXBwbHlGb2xkKGYsIHZvaWQgMCwgW3oseCxpXSk7XG5cdFx0XHR9O1xuXHRcdH1cblx0fTtcblxufSk7XG59KHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCA/IGRlZmluZSA6IGZ1bmN0aW9uKGZhY3RvcnkpIHsgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KHJlcXVpcmUpOyB9KSk7XG4iLCIvKiogQGxpY2Vuc2UgTUlUIExpY2Vuc2UgKGMpIGNvcHlyaWdodCAyMDEwLTIwMTQgb3JpZ2luYWwgYXV0aG9yIG9yIGF1dGhvcnMgKi9cbi8qKiBAYXV0aG9yIEJyaWFuIENhdmFsaWVyICovXG4vKiogQGF1dGhvciBKb2huIEhhbm4gKi9cblxuKGZ1bmN0aW9uKGRlZmluZSkgeyAndXNlIHN0cmljdCc7XG5kZWZpbmUoZnVuY3Rpb24oKSB7XG5cblx0cmV0dXJuIGZ1bmN0aW9uIGZsb3coUHJvbWlzZSkge1xuXG5cdFx0dmFyIHJlc29sdmUgPSBQcm9taXNlLnJlc29sdmU7XG5cdFx0dmFyIHJlamVjdCA9IFByb21pc2UucmVqZWN0O1xuXHRcdHZhciBvcmlnQ2F0Y2ggPSBQcm9taXNlLnByb3RvdHlwZVsnY2F0Y2gnXTtcblxuXHRcdC8qKlxuXHRcdCAqIEhhbmRsZSB0aGUgdWx0aW1hdGUgZnVsZmlsbG1lbnQgdmFsdWUgb3IgcmVqZWN0aW9uIHJlYXNvbiwgYW5kIGFzc3VtZVxuXHRcdCAqIHJlc3BvbnNpYmlsaXR5IGZvciBhbGwgZXJyb3JzLiAgSWYgYW4gZXJyb3IgcHJvcGFnYXRlcyBvdXQgb2YgcmVzdWx0XG5cdFx0ICogb3IgaGFuZGxlRmF0YWxFcnJvciwgaXQgd2lsbCBiZSByZXRocm93biB0byB0aGUgaG9zdCwgcmVzdWx0aW5nIGluIGFcblx0XHQgKiBsb3VkIHN0YWNrIHRyYWNrIG9uIG1vc3QgcGxhdGZvcm1zIGFuZCBhIGNyYXNoIG9uIHNvbWUuXG5cdFx0ICogQHBhcmFtIHtmdW5jdGlvbj99IG9uUmVzdWx0XG5cdFx0ICogQHBhcmFtIHtmdW5jdGlvbj99IG9uRXJyb3Jcblx0XHQgKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxuXHRcdCAqL1xuXHRcdFByb21pc2UucHJvdG90eXBlLmRvbmUgPSBmdW5jdGlvbihvblJlc3VsdCwgb25FcnJvcikge1xuXHRcdFx0dGhpcy5faGFuZGxlci52aXNpdCh0aGlzLl9oYW5kbGVyLnJlY2VpdmVyLCBvblJlc3VsdCwgb25FcnJvcik7XG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdCAqIEFkZCBFcnJvci10eXBlIGFuZCBwcmVkaWNhdGUgbWF0Y2hpbmcgdG8gY2F0Y2guICBFeGFtcGxlczpcblx0XHQgKiBwcm9taXNlLmNhdGNoKFR5cGVFcnJvciwgaGFuZGxlVHlwZUVycm9yKVxuXHRcdCAqICAgLmNhdGNoKHByZWRpY2F0ZSwgaGFuZGxlTWF0Y2hlZEVycm9ycylcblx0XHQgKiAgIC5jYXRjaChoYW5kbGVSZW1haW5pbmdFcnJvcnMpXG5cdFx0ICogQHBhcmFtIG9uUmVqZWN0ZWRcblx0XHQgKiBAcmV0dXJucyB7Kn1cblx0XHQgKi9cblx0XHRQcm9taXNlLnByb3RvdHlwZVsnY2F0Y2gnXSA9IFByb21pc2UucHJvdG90eXBlLm90aGVyd2lzZSA9IGZ1bmN0aW9uKG9uUmVqZWN0ZWQpIHtcblx0XHRcdGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMikge1xuXHRcdFx0XHRyZXR1cm4gb3JpZ0NhdGNoLmNhbGwodGhpcywgb25SZWplY3RlZCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmKHR5cGVvZiBvblJlamVjdGVkICE9PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmVuc3VyZShyZWplY3RJbnZhbGlkUHJlZGljYXRlKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIG9yaWdDYXRjaC5jYWxsKHRoaXMsIGNyZWF0ZUNhdGNoRmlsdGVyKGFyZ3VtZW50c1sxXSwgb25SZWplY3RlZCkpO1xuXHRcdH07XG5cblx0XHQvKipcblx0XHQgKiBXcmFwcyB0aGUgcHJvdmlkZWQgY2F0Y2ggaGFuZGxlciwgc28gdGhhdCBpdCB3aWxsIG9ubHkgYmUgY2FsbGVkXG5cdFx0ICogaWYgdGhlIHByZWRpY2F0ZSBldmFsdWF0ZXMgdHJ1dGh5XG5cdFx0ICogQHBhcmFtIHs/ZnVuY3Rpb259IGhhbmRsZXJcblx0XHQgKiBAcGFyYW0ge2Z1bmN0aW9ufSBwcmVkaWNhdGVcblx0XHQgKiBAcmV0dXJucyB7ZnVuY3Rpb259IGNvbmRpdGlvbmFsIGNhdGNoIGhhbmRsZXJcblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjcmVhdGVDYXRjaEZpbHRlcihoYW5kbGVyLCBwcmVkaWNhdGUpIHtcblx0XHRcdHJldHVybiBmdW5jdGlvbihlKSB7XG5cdFx0XHRcdHJldHVybiBldmFsdWF0ZVByZWRpY2F0ZShlLCBwcmVkaWNhdGUpXG5cdFx0XHRcdFx0PyBoYW5kbGVyLmNhbGwodGhpcywgZSlcblx0XHRcdFx0XHQ6IHJlamVjdChlKTtcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRW5zdXJlcyB0aGF0IG9uRnVsZmlsbGVkT3JSZWplY3RlZCB3aWxsIGJlIGNhbGxlZCByZWdhcmRsZXNzIG9mIHdoZXRoZXJcblx0XHQgKiB0aGlzIHByb21pc2UgaXMgZnVsZmlsbGVkIG9yIHJlamVjdGVkLiAgb25GdWxmaWxsZWRPclJlamVjdGVkIFdJTEwgTk9UXG5cdFx0ICogcmVjZWl2ZSB0aGUgcHJvbWlzZXMnIHZhbHVlIG9yIHJlYXNvbi4gIEFueSByZXR1cm5lZCB2YWx1ZSB3aWxsIGJlIGRpc3JlZ2FyZGVkLlxuXHRcdCAqIG9uRnVsZmlsbGVkT3JSZWplY3RlZCBtYXkgdGhyb3cgb3IgcmV0dXJuIGEgcmVqZWN0ZWQgcHJvbWlzZSB0byBzaWduYWxcblx0XHQgKiBhbiBhZGRpdGlvbmFsIGVycm9yLlxuXHRcdCAqIEBwYXJhbSB7ZnVuY3Rpb259IGhhbmRsZXIgaGFuZGxlciB0byBiZSBjYWxsZWQgcmVnYXJkbGVzcyBvZlxuXHRcdCAqICBmdWxmaWxsbWVudCBvciByZWplY3Rpb25cblx0XHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0XHQgKi9cblx0XHRQcm9taXNlLnByb3RvdHlwZVsnZmluYWxseSddID0gUHJvbWlzZS5wcm90b3R5cGUuZW5zdXJlID0gZnVuY3Rpb24oaGFuZGxlcikge1xuXHRcdFx0aWYodHlwZW9mIGhhbmRsZXIgIT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB0aGlzLnRoZW4oZnVuY3Rpb24oeCkge1xuXHRcdFx0XHRyZXR1cm4gcnVuU2lkZUVmZmVjdChoYW5kbGVyLCB0aGlzLCBpZGVudGl0eSwgeCk7XG5cdFx0XHR9LCBmdW5jdGlvbihlKSB7XG5cdFx0XHRcdHJldHVybiBydW5TaWRlRWZmZWN0KGhhbmRsZXIsIHRoaXMsIHJlamVjdCwgZSk7XG5cdFx0XHR9KTtcblx0XHR9O1xuXG5cdFx0ZnVuY3Rpb24gcnVuU2lkZUVmZmVjdCAoaGFuZGxlciwgdGhpc0FyZywgcHJvcGFnYXRlLCB2YWx1ZSkge1xuXHRcdFx0dmFyIHJlc3VsdCA9IGhhbmRsZXIuY2FsbCh0aGlzQXJnKTtcblx0XHRcdHJldHVybiBtYXliZVRoZW5hYmxlKHJlc3VsdClcblx0XHRcdFx0PyBwcm9wYWdhdGVWYWx1ZShyZXN1bHQsIHByb3BhZ2F0ZSwgdmFsdWUpXG5cdFx0XHRcdDogcHJvcGFnYXRlKHZhbHVlKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBwcm9wYWdhdGVWYWx1ZSAocmVzdWx0LCBwcm9wYWdhdGUsIHgpIHtcblx0XHRcdHJldHVybiByZXNvbHZlKHJlc3VsdCkudGhlbihmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBwcm9wYWdhdGUoeCk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWNvdmVyIGZyb20gYSBmYWlsdXJlIGJ5IHJldHVybmluZyBhIGRlZmF1bHRWYWx1ZS4gIElmIGRlZmF1bHRWYWx1ZVxuXHRcdCAqIGlzIGEgcHJvbWlzZSwgaXQncyBmdWxmaWxsbWVudCB2YWx1ZSB3aWxsIGJlIHVzZWQuICBJZiBkZWZhdWx0VmFsdWUgaXNcblx0XHQgKiBhIHByb21pc2UgdGhhdCByZWplY3RzLCB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aWxsIHJlamVjdCB3aXRoIHRoZVxuXHRcdCAqIHNhbWUgcmVhc29uLlxuXHRcdCAqIEBwYXJhbSB7Kn0gZGVmYXVsdFZhbHVlXG5cdFx0ICogQHJldHVybnMge1Byb21pc2V9IG5ldyBwcm9taXNlXG5cdFx0ICovXG5cdFx0UHJvbWlzZS5wcm90b3R5cGVbJ2Vsc2UnXSA9IFByb21pc2UucHJvdG90eXBlLm9yRWxzZSA9IGZ1bmN0aW9uKGRlZmF1bHRWYWx1ZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMudGhlbih2b2lkIDAsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gZGVmYXVsdFZhbHVlO1xuXHRcdFx0fSk7XG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdCAqIFNob3J0Y3V0IGZvciAudGhlbihmdW5jdGlvbigpIHsgcmV0dXJuIHZhbHVlOyB9KVxuXHRcdCAqIEBwYXJhbSAgeyp9IHZhbHVlXG5cdFx0ICogQHJldHVybiB7UHJvbWlzZX0gYSBwcm9taXNlIHRoYXQ6XG5cdFx0ICogIC0gaXMgZnVsZmlsbGVkIGlmIHZhbHVlIGlzIG5vdCBhIHByb21pc2UsIG9yXG5cdFx0ICogIC0gaWYgdmFsdWUgaXMgYSBwcm9taXNlLCB3aWxsIGZ1bGZpbGwgd2l0aCBpdHMgdmFsdWUsIG9yIHJlamVjdFxuXHRcdCAqICAgIHdpdGggaXRzIHJlYXNvbi5cblx0XHQgKi9cblx0XHRQcm9taXNlLnByb3RvdHlwZVsneWllbGQnXSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0XHR9KTtcblx0XHR9O1xuXG5cdFx0LyoqXG5cdFx0ICogUnVucyBhIHNpZGUgZWZmZWN0IHdoZW4gdGhpcyBwcm9taXNlIGZ1bGZpbGxzLCB3aXRob3V0IGNoYW5naW5nIHRoZVxuXHRcdCAqIGZ1bGZpbGxtZW50IHZhbHVlLlxuXHRcdCAqIEBwYXJhbSB7ZnVuY3Rpb259IG9uRnVsZmlsbGVkU2lkZUVmZmVjdFxuXHRcdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHRcdCAqL1xuXHRcdFByb21pc2UucHJvdG90eXBlLnRhcCA9IGZ1bmN0aW9uKG9uRnVsZmlsbGVkU2lkZUVmZmVjdCkge1xuXHRcdFx0cmV0dXJuIHRoaXMudGhlbihvbkZ1bGZpbGxlZFNpZGVFZmZlY3QpWyd5aWVsZCddKHRoaXMpO1xuXHRcdH07XG5cblx0XHRyZXR1cm4gUHJvbWlzZTtcblx0fTtcblxuXHRmdW5jdGlvbiByZWplY3RJbnZhbGlkUHJlZGljYXRlKCkge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ2NhdGNoIHByZWRpY2F0ZSBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGV2YWx1YXRlUHJlZGljYXRlKGUsIHByZWRpY2F0ZSkge1xuXHRcdHJldHVybiBpc0Vycm9yKHByZWRpY2F0ZSkgPyBlIGluc3RhbmNlb2YgcHJlZGljYXRlIDogcHJlZGljYXRlKGUpO1xuXHR9XG5cblx0ZnVuY3Rpb24gaXNFcnJvcihwcmVkaWNhdGUpIHtcblx0XHRyZXR1cm4gcHJlZGljYXRlID09PSBFcnJvclxuXHRcdFx0fHwgKHByZWRpY2F0ZSAhPSBudWxsICYmIHByZWRpY2F0ZS5wcm90b3R5cGUgaW5zdGFuY2VvZiBFcnJvcik7XG5cdH1cblxuXHRmdW5jdGlvbiBtYXliZVRoZW5hYmxlKHgpIHtcblx0XHRyZXR1cm4gKHR5cGVvZiB4ID09PSAnb2JqZWN0JyB8fCB0eXBlb2YgeCA9PT0gJ2Z1bmN0aW9uJykgJiYgeCAhPT0gbnVsbDtcblx0fVxuXG5cdGZ1bmN0aW9uIGlkZW50aXR5KHgpIHtcblx0XHRyZXR1cm4geDtcblx0fVxuXG59KTtcbn0odHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kID8gZGVmaW5lIDogZnVuY3Rpb24oZmFjdG9yeSkgeyBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKTsgfSkpO1xuIiwiLyoqIEBsaWNlbnNlIE1JVCBMaWNlbnNlIChjKSBjb3B5cmlnaHQgMjAxMC0yMDE0IG9yaWdpbmFsIGF1dGhvciBvciBhdXRob3JzICovXG4vKiogQGF1dGhvciBCcmlhbiBDYXZhbGllciAqL1xuLyoqIEBhdXRob3IgSm9obiBIYW5uICovXG4vKiogQGF1dGhvciBKZWZmIEVzY2FsYW50ZSAqL1xuXG4oZnVuY3Rpb24oZGVmaW5lKSB7ICd1c2Ugc3RyaWN0JztcbmRlZmluZShmdW5jdGlvbigpIHtcblxuXHRyZXR1cm4gZnVuY3Rpb24gZm9sZChQcm9taXNlKSB7XG5cblx0XHRQcm9taXNlLnByb3RvdHlwZS5mb2xkID0gZnVuY3Rpb24oZiwgeikge1xuXHRcdFx0dmFyIHByb21pc2UgPSB0aGlzLl9iZWdldCgpO1xuXG5cdFx0XHR0aGlzLl9oYW5kbGVyLmZvbGQoZnVuY3Rpb24oeiwgeCwgdG8pIHtcblx0XHRcdFx0UHJvbWlzZS5faGFuZGxlcih6KS5mb2xkKGZ1bmN0aW9uKHgsIHosIHRvKSB7XG5cdFx0XHRcdFx0dG8ucmVzb2x2ZShmLmNhbGwodGhpcywgeiwgeCkpO1xuXHRcdFx0XHR9LCB4LCB0aGlzLCB0byk7XG5cdFx0XHR9LCB6LCBwcm9taXNlLl9oYW5kbGVyLnJlY2VpdmVyLCBwcm9taXNlLl9oYW5kbGVyKTtcblxuXHRcdFx0cmV0dXJuIHByb21pc2U7XG5cdFx0fTtcblxuXHRcdHJldHVybiBQcm9taXNlO1xuXHR9O1xuXG59KTtcbn0odHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kID8gZGVmaW5lIDogZnVuY3Rpb24oZmFjdG9yeSkgeyBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKTsgfSkpO1xuIiwiLyoqIEBsaWNlbnNlIE1JVCBMaWNlbnNlIChjKSBjb3B5cmlnaHQgMjAxMC0yMDE0IG9yaWdpbmFsIGF1dGhvciBvciBhdXRob3JzICovXG4vKiogQGF1dGhvciBCcmlhbiBDYXZhbGllciAqL1xuLyoqIEBhdXRob3IgSm9obiBIYW5uICovXG5cbihmdW5jdGlvbihkZWZpbmUpIHsgJ3VzZSBzdHJpY3QnO1xuZGVmaW5lKGZ1bmN0aW9uKHJlcXVpcmUpIHtcblxuXHR2YXIgaW5zcGVjdCA9IHJlcXVpcmUoJy4uL3N0YXRlJykuaW5zcGVjdDtcblxuXHRyZXR1cm4gZnVuY3Rpb24gaW5zcGVjdGlvbihQcm9taXNlKSB7XG5cblx0XHRQcm9taXNlLnByb3RvdHlwZS5pbnNwZWN0ID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gaW5zcGVjdChQcm9taXNlLl9oYW5kbGVyKHRoaXMpKTtcblx0XHR9O1xuXG5cdFx0cmV0dXJuIFByb21pc2U7XG5cdH07XG5cbn0pO1xufSh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQgPyBkZWZpbmUgOiBmdW5jdGlvbihmYWN0b3J5KSB7IG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeShyZXF1aXJlKTsgfSkpO1xuIiwiLyoqIEBsaWNlbnNlIE1JVCBMaWNlbnNlIChjKSBjb3B5cmlnaHQgMjAxMC0yMDE0IG9yaWdpbmFsIGF1dGhvciBvciBhdXRob3JzICovXG4vKiogQGF1dGhvciBCcmlhbiBDYXZhbGllciAqL1xuLyoqIEBhdXRob3IgSm9obiBIYW5uICovXG5cbihmdW5jdGlvbihkZWZpbmUpIHsgJ3VzZSBzdHJpY3QnO1xuZGVmaW5lKGZ1bmN0aW9uKCkge1xuXG5cdHJldHVybiBmdW5jdGlvbiBnZW5lcmF0ZShQcm9taXNlKSB7XG5cblx0XHR2YXIgcmVzb2x2ZSA9IFByb21pc2UucmVzb2x2ZTtcblxuXHRcdFByb21pc2UuaXRlcmF0ZSA9IGl0ZXJhdGU7XG5cdFx0UHJvbWlzZS51bmZvbGQgPSB1bmZvbGQ7XG5cblx0XHRyZXR1cm4gUHJvbWlzZTtcblxuXHRcdC8qKlxuXHRcdCAqIEBkZXByZWNhdGVkIFVzZSBnaXRodWIuY29tL2N1am9qcy9tb3N0IHN0cmVhbXMgYW5kIG1vc3QuaXRlcmF0ZVxuXHRcdCAqIEdlbmVyYXRlIGEgKHBvdGVudGlhbGx5IGluZmluaXRlKSBzdHJlYW0gb2YgcHJvbWlzZWQgdmFsdWVzOlxuXHRcdCAqIHgsIGYoeCksIGYoZih4KSksIGV0Yy4gdW50aWwgY29uZGl0aW9uKHgpIHJldHVybnMgdHJ1ZVxuXHRcdCAqIEBwYXJhbSB7ZnVuY3Rpb259IGYgZnVuY3Rpb24gdG8gZ2VuZXJhdGUgYSBuZXcgeCBmcm9tIHRoZSBwcmV2aW91cyB4XG5cdFx0ICogQHBhcmFtIHtmdW5jdGlvbn0gY29uZGl0aW9uIGZ1bmN0aW9uIHRoYXQsIGdpdmVuIHRoZSBjdXJyZW50IHgsIHJldHVybnNcblx0XHQgKiAgdHJ1dGh5IHdoZW4gdGhlIGl0ZXJhdGUgc2hvdWxkIHN0b3Bcblx0XHQgKiBAcGFyYW0ge2Z1bmN0aW9ufSBoYW5kbGVyIGZ1bmN0aW9uIHRvIGhhbmRsZSB0aGUgdmFsdWUgcHJvZHVjZWQgYnkgZlxuXHRcdCAqIEBwYXJhbSB7KnxQcm9taXNlfSB4IHN0YXJ0aW5nIHZhbHVlLCBtYXkgYmUgYSBwcm9taXNlXG5cdFx0ICogQHJldHVybiB7UHJvbWlzZX0gdGhlIHJlc3VsdCBvZiB0aGUgbGFzdCBjYWxsIHRvIGYgYmVmb3JlXG5cdFx0ICogIGNvbmRpdGlvbiByZXR1cm5zIHRydWVcblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpdGVyYXRlKGYsIGNvbmRpdGlvbiwgaGFuZGxlciwgeCkge1xuXHRcdFx0cmV0dXJuIHVuZm9sZChmdW5jdGlvbih4KSB7XG5cdFx0XHRcdHJldHVybiBbeCwgZih4KV07XG5cdFx0XHR9LCBjb25kaXRpb24sIGhhbmRsZXIsIHgpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEBkZXByZWNhdGVkIFVzZSBnaXRodWIuY29tL2N1am9qcy9tb3N0IHN0cmVhbXMgYW5kIG1vc3QudW5mb2xkXG5cdFx0ICogR2VuZXJhdGUgYSAocG90ZW50aWFsbHkgaW5maW5pdGUpIHN0cmVhbSBvZiBwcm9taXNlZCB2YWx1ZXNcblx0XHQgKiBieSBhcHBseWluZyBoYW5kbGVyKGdlbmVyYXRvcihzZWVkKSkgaXRlcmF0aXZlbHkgdW50aWxcblx0XHQgKiBjb25kaXRpb24oc2VlZCkgcmV0dXJucyB0cnVlLlxuXHRcdCAqIEBwYXJhbSB7ZnVuY3Rpb259IHVuc3Bvb2wgZnVuY3Rpb24gdGhhdCBnZW5lcmF0ZXMgYSBbdmFsdWUsIG5ld1NlZWRdXG5cdFx0ICogIGdpdmVuIGEgc2VlZC5cblx0XHQgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjb25kaXRpb24gZnVuY3Rpb24gdGhhdCwgZ2l2ZW4gdGhlIGN1cnJlbnQgc2VlZCwgcmV0dXJuc1xuXHRcdCAqICB0cnV0aHkgd2hlbiB0aGUgdW5mb2xkIHNob3VsZCBzdG9wXG5cdFx0ICogQHBhcmFtIHtmdW5jdGlvbn0gaGFuZGxlciBmdW5jdGlvbiB0byBoYW5kbGUgdGhlIHZhbHVlIHByb2R1Y2VkIGJ5IHVuc3Bvb2xcblx0XHQgKiBAcGFyYW0geCB7KnxQcm9taXNlfSBzdGFydGluZyB2YWx1ZSwgbWF5IGJlIGEgcHJvbWlzZVxuXHRcdCAqIEByZXR1cm4ge1Byb21pc2V9IHRoZSByZXN1bHQgb2YgdGhlIGxhc3QgdmFsdWUgcHJvZHVjZWQgYnkgdW5zcG9vbCBiZWZvcmVcblx0XHQgKiAgY29uZGl0aW9uIHJldHVybnMgdHJ1ZVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHVuZm9sZCh1bnNwb29sLCBjb25kaXRpb24sIGhhbmRsZXIsIHgpIHtcblx0XHRcdHJldHVybiByZXNvbHZlKHgpLnRoZW4oZnVuY3Rpb24oc2VlZCkge1xuXHRcdFx0XHRyZXR1cm4gcmVzb2x2ZShjb25kaXRpb24oc2VlZCkpLnRoZW4oZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0XHRcdHJldHVybiBkb25lID8gc2VlZCA6IHJlc29sdmUodW5zcG9vbChzZWVkKSkuc3ByZWFkKG5leHQpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXG5cdFx0XHRmdW5jdGlvbiBuZXh0KGl0ZW0sIG5ld1NlZWQpIHtcblx0XHRcdFx0cmV0dXJuIHJlc29sdmUoaGFuZGxlcihpdGVtKSkudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRyZXR1cm4gdW5mb2xkKHVuc3Bvb2wsIGNvbmRpdGlvbiwgaGFuZGxlciwgbmV3U2VlZCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fTtcblxufSk7XG59KHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCA/IGRlZmluZSA6IGZ1bmN0aW9uKGZhY3RvcnkpIHsgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KCk7IH0pKTtcbiIsIi8qKiBAbGljZW5zZSBNSVQgTGljZW5zZSAoYykgY29weXJpZ2h0IDIwMTAtMjAxNCBvcmlnaW5hbCBhdXRob3Igb3IgYXV0aG9ycyAqL1xuLyoqIEBhdXRob3IgQnJpYW4gQ2F2YWxpZXIgKi9cbi8qKiBAYXV0aG9yIEpvaG4gSGFubiAqL1xuXG4oZnVuY3Rpb24oZGVmaW5lKSB7ICd1c2Ugc3RyaWN0JztcbmRlZmluZShmdW5jdGlvbigpIHtcblxuXHRyZXR1cm4gZnVuY3Rpb24gcHJvZ3Jlc3MoUHJvbWlzZSkge1xuXG5cdFx0LyoqXG5cdFx0ICogQGRlcHJlY2F0ZWRcblx0XHQgKiBSZWdpc3RlciBhIHByb2dyZXNzIGhhbmRsZXIgZm9yIHRoaXMgcHJvbWlzZVxuXHRcdCAqIEBwYXJhbSB7ZnVuY3Rpb259IG9uUHJvZ3Jlc3Ncblx0XHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0XHQgKi9cblx0XHRQcm9taXNlLnByb3RvdHlwZS5wcm9ncmVzcyA9IGZ1bmN0aW9uKG9uUHJvZ3Jlc3MpIHtcblx0XHRcdHJldHVybiB0aGlzLnRoZW4odm9pZCAwLCB2b2lkIDAsIG9uUHJvZ3Jlc3MpO1xuXHRcdH07XG5cblx0XHRyZXR1cm4gUHJvbWlzZTtcblx0fTtcblxufSk7XG59KHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCA/IGRlZmluZSA6IGZ1bmN0aW9uKGZhY3RvcnkpIHsgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KCk7IH0pKTtcbiIsIi8qKiBAbGljZW5zZSBNSVQgTGljZW5zZSAoYykgY29weXJpZ2h0IDIwMTAtMjAxNCBvcmlnaW5hbCBhdXRob3Igb3IgYXV0aG9ycyAqL1xuLyoqIEBhdXRob3IgQnJpYW4gQ2F2YWxpZXIgKi9cbi8qKiBAYXV0aG9yIEpvaG4gSGFubiAqL1xuXG4oZnVuY3Rpb24oZGVmaW5lKSB7ICd1c2Ugc3RyaWN0JztcbmRlZmluZShmdW5jdGlvbihyZXF1aXJlKSB7XG5cblx0dmFyIGVudiA9IHJlcXVpcmUoJy4uL2VudicpO1xuXHR2YXIgVGltZW91dEVycm9yID0gcmVxdWlyZSgnLi4vVGltZW91dEVycm9yJyk7XG5cblx0ZnVuY3Rpb24gc2V0VGltZW91dChmLCBtcywgeCwgeSkge1xuXHRcdHJldHVybiBlbnYuc2V0VGltZXIoZnVuY3Rpb24oKSB7XG5cdFx0XHRmKHgsIHksIG1zKTtcblx0XHR9LCBtcyk7XG5cdH1cblxuXHRyZXR1cm4gZnVuY3Rpb24gdGltZWQoUHJvbWlzZSkge1xuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBhIG5ldyBwcm9taXNlIHdob3NlIGZ1bGZpbGxtZW50IHZhbHVlIGlzIHJldmVhbGVkIG9ubHlcblx0XHQgKiBhZnRlciBtcyBtaWxsaXNlY29uZHNcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gbXMgbWlsbGlzZWNvbmRzXG5cdFx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdFx0ICovXG5cdFx0UHJvbWlzZS5wcm90b3R5cGUuZGVsYXkgPSBmdW5jdGlvbihtcykge1xuXHRcdFx0dmFyIHAgPSB0aGlzLl9iZWdldCgpO1xuXHRcdFx0dGhpcy5faGFuZGxlci5mb2xkKGhhbmRsZURlbGF5LCBtcywgdm9pZCAwLCBwLl9oYW5kbGVyKTtcblx0XHRcdHJldHVybiBwO1xuXHRcdH07XG5cblx0XHRmdW5jdGlvbiBoYW5kbGVEZWxheShtcywgeCwgaCkge1xuXHRcdFx0c2V0VGltZW91dChyZXNvbHZlRGVsYXksIG1zLCB4LCBoKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiByZXNvbHZlRGVsYXkoeCwgaCkge1xuXHRcdFx0aC5yZXNvbHZlKHgpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBhIG5ldyBwcm9taXNlIHRoYXQgcmVqZWN0cyBhZnRlciBtcyBtaWxsaXNlY29uZHMgdW5sZXNzXG5cdFx0ICogdGhpcyBwcm9taXNlIGZ1bGZpbGxzIGVhcmxpZXIsIGluIHdoaWNoIGNhc2UgdGhlIHJldHVybmVkIHByb21pc2Vcblx0XHQgKiBmdWxmaWxscyB3aXRoIHRoZSBzYW1lIHZhbHVlLlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBtcyBtaWxsaXNlY29uZHNcblx0XHQgKiBAcGFyYW0ge0Vycm9yfCo9fSByZWFzb24gb3B0aW9uYWwgcmVqZWN0aW9uIHJlYXNvbiB0byB1c2UsIGRlZmF1bHRzXG5cdFx0ICogICB0byBhIFRpbWVvdXRFcnJvciBpZiBub3QgcHJvdmlkZWRcblx0XHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0XHQgKi9cblx0XHRQcm9taXNlLnByb3RvdHlwZS50aW1lb3V0ID0gZnVuY3Rpb24obXMsIHJlYXNvbikge1xuXHRcdFx0dmFyIHAgPSB0aGlzLl9iZWdldCgpO1xuXHRcdFx0dmFyIGggPSBwLl9oYW5kbGVyO1xuXG5cdFx0XHR2YXIgdCA9IHNldFRpbWVvdXQob25UaW1lb3V0LCBtcywgcmVhc29uLCBwLl9oYW5kbGVyKTtcblxuXHRcdFx0dGhpcy5faGFuZGxlci52aXNpdChoLFxuXHRcdFx0XHRmdW5jdGlvbiBvbkZ1bGZpbGwoeCkge1xuXHRcdFx0XHRcdGVudi5jbGVhclRpbWVyKHQpO1xuXHRcdFx0XHRcdHRoaXMucmVzb2x2ZSh4KTsgLy8gdGhpcyA9IGhcblx0XHRcdFx0fSxcblx0XHRcdFx0ZnVuY3Rpb24gb25SZWplY3QoeCkge1xuXHRcdFx0XHRcdGVudi5jbGVhclRpbWVyKHQpO1xuXHRcdFx0XHRcdHRoaXMucmVqZWN0KHgpOyAvLyB0aGlzID0gaFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRoLm5vdGlmeSk7XG5cblx0XHRcdHJldHVybiBwO1xuXHRcdH07XG5cblx0XHRmdW5jdGlvbiBvblRpbWVvdXQocmVhc29uLCBoLCBtcykge1xuXHRcdFx0dmFyIGUgPSB0eXBlb2YgcmVhc29uID09PSAndW5kZWZpbmVkJ1xuXHRcdFx0XHQ/IG5ldyBUaW1lb3V0RXJyb3IoJ3RpbWVkIG91dCBhZnRlciAnICsgbXMgKyAnbXMnKVxuXHRcdFx0XHQ6IHJlYXNvbjtcblx0XHRcdGgucmVqZWN0KGUpO1xuXHRcdH1cblxuXHRcdHJldHVybiBQcm9taXNlO1xuXHR9O1xuXG59KTtcbn0odHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kID8gZGVmaW5lIDogZnVuY3Rpb24oZmFjdG9yeSkgeyBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkocmVxdWlyZSk7IH0pKTtcbiIsIi8qKiBAbGljZW5zZSBNSVQgTGljZW5zZSAoYykgY29weXJpZ2h0IDIwMTAtMjAxNCBvcmlnaW5hbCBhdXRob3Igb3IgYXV0aG9ycyAqL1xuLyoqIEBhdXRob3IgQnJpYW4gQ2F2YWxpZXIgKi9cbi8qKiBAYXV0aG9yIEpvaG4gSGFubiAqL1xuXG4oZnVuY3Rpb24oZGVmaW5lKSB7ICd1c2Ugc3RyaWN0JztcbmRlZmluZShmdW5jdGlvbihyZXF1aXJlKSB7XG5cblx0dmFyIHNldFRpbWVyID0gcmVxdWlyZSgnLi4vZW52Jykuc2V0VGltZXI7XG5cdHZhciBmb3JtYXQgPSByZXF1aXJlKCcuLi9mb3JtYXQnKTtcblxuXHRyZXR1cm4gZnVuY3Rpb24gdW5oYW5kbGVkUmVqZWN0aW9uKFByb21pc2UpIHtcblxuXHRcdHZhciBsb2dFcnJvciA9IG5vb3A7XG5cdFx0dmFyIGxvZ0luZm8gPSBub29wO1xuXHRcdHZhciBsb2NhbENvbnNvbGU7XG5cblx0XHRpZih0eXBlb2YgY29uc29sZSAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdC8vIEFsaWFzIGNvbnNvbGUgdG8gcHJldmVudCB0aGluZ3MgbGlrZSB1Z2xpZnkncyBkcm9wX2NvbnNvbGUgb3B0aW9uIGZyb21cblx0XHRcdC8vIHJlbW92aW5nIGNvbnNvbGUubG9nL2Vycm9yLiBVbmhhbmRsZWQgcmVqZWN0aW9ucyBmYWxsIGludG8gdGhlIHNhbWVcblx0XHRcdC8vIGNhdGVnb3J5IGFzIHVuY2F1Z2h0IGV4Y2VwdGlvbnMsIGFuZCBidWlsZCB0b29scyBzaG91bGRuJ3Qgc2lsZW5jZSB0aGVtLlxuXHRcdFx0bG9jYWxDb25zb2xlID0gY29uc29sZTtcblx0XHRcdGxvZ0Vycm9yID0gdHlwZW9mIGxvY2FsQ29uc29sZS5lcnJvciAhPT0gJ3VuZGVmaW5lZCdcblx0XHRcdFx0PyBmdW5jdGlvbiAoZSkgeyBsb2NhbENvbnNvbGUuZXJyb3IoZSk7IH1cblx0XHRcdFx0OiBmdW5jdGlvbiAoZSkgeyBsb2NhbENvbnNvbGUubG9nKGUpOyB9O1xuXG5cdFx0XHRsb2dJbmZvID0gdHlwZW9mIGxvY2FsQ29uc29sZS5pbmZvICE9PSAndW5kZWZpbmVkJ1xuXHRcdFx0XHQ/IGZ1bmN0aW9uIChlKSB7IGxvY2FsQ29uc29sZS5pbmZvKGUpOyB9XG5cdFx0XHRcdDogZnVuY3Rpb24gKGUpIHsgbG9jYWxDb25zb2xlLmxvZyhlKTsgfTtcblx0XHR9XG5cblx0XHRQcm9taXNlLm9uUG90ZW50aWFsbHlVbmhhbmRsZWRSZWplY3Rpb24gPSBmdW5jdGlvbihyZWplY3Rpb24pIHtcblx0XHRcdGVucXVldWUocmVwb3J0LCByZWplY3Rpb24pO1xuXHRcdH07XG5cblx0XHRQcm9taXNlLm9uUG90ZW50aWFsbHlVbmhhbmRsZWRSZWplY3Rpb25IYW5kbGVkID0gZnVuY3Rpb24ocmVqZWN0aW9uKSB7XG5cdFx0XHRlbnF1ZXVlKHVucmVwb3J0LCByZWplY3Rpb24pO1xuXHRcdH07XG5cblx0XHRQcm9taXNlLm9uRmF0YWxSZWplY3Rpb24gPSBmdW5jdGlvbihyZWplY3Rpb24pIHtcblx0XHRcdGVucXVldWUodGhyb3dpdCwgcmVqZWN0aW9uLnZhbHVlKTtcblx0XHR9O1xuXG5cdFx0dmFyIHRhc2tzID0gW107XG5cdFx0dmFyIHJlcG9ydGVkID0gW107XG5cdFx0dmFyIHJ1bm5pbmcgPSBudWxsO1xuXG5cdFx0ZnVuY3Rpb24gcmVwb3J0KHIpIHtcblx0XHRcdGlmKCFyLmhhbmRsZWQpIHtcblx0XHRcdFx0cmVwb3J0ZWQucHVzaChyKTtcblx0XHRcdFx0bG9nRXJyb3IoJ1BvdGVudGlhbGx5IHVuaGFuZGxlZCByZWplY3Rpb24gWycgKyByLmlkICsgJ10gJyArIGZvcm1hdC5mb3JtYXRFcnJvcihyLnZhbHVlKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gdW5yZXBvcnQocikge1xuXHRcdFx0dmFyIGkgPSByZXBvcnRlZC5pbmRleE9mKHIpO1xuXHRcdFx0aWYoaSA+PSAwKSB7XG5cdFx0XHRcdHJlcG9ydGVkLnNwbGljZShpLCAxKTtcblx0XHRcdFx0bG9nSW5mbygnSGFuZGxlZCBwcmV2aW91cyByZWplY3Rpb24gWycgKyByLmlkICsgJ10gJyArIGZvcm1hdC5mb3JtYXRPYmplY3Qoci52YWx1ZSkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGVucXVldWUoZiwgeCkge1xuXHRcdFx0dGFza3MucHVzaChmLCB4KTtcblx0XHRcdGlmKHJ1bm5pbmcgPT09IG51bGwpIHtcblx0XHRcdFx0cnVubmluZyA9IHNldFRpbWVyKGZsdXNoLCAwKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRmdW5jdGlvbiBmbHVzaCgpIHtcblx0XHRcdHJ1bm5pbmcgPSBudWxsO1xuXHRcdFx0d2hpbGUodGFza3MubGVuZ3RoID4gMCkge1xuXHRcdFx0XHR0YXNrcy5zaGlmdCgpKHRhc2tzLnNoaWZ0KCkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBQcm9taXNlO1xuXHR9O1xuXG5cdGZ1bmN0aW9uIHRocm93aXQoZSkge1xuXHRcdHRocm93IGU7XG5cdH1cblxuXHRmdW5jdGlvbiBub29wKCkge31cblxufSk7XG59KHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCA/IGRlZmluZSA6IGZ1bmN0aW9uKGZhY3RvcnkpIHsgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KHJlcXVpcmUpOyB9KSk7XG4iLCIvKiogQGxpY2Vuc2UgTUlUIExpY2Vuc2UgKGMpIGNvcHlyaWdodCAyMDEwLTIwMTQgb3JpZ2luYWwgYXV0aG9yIG9yIGF1dGhvcnMgKi9cbi8qKiBAYXV0aG9yIEJyaWFuIENhdmFsaWVyICovXG4vKiogQGF1dGhvciBKb2huIEhhbm4gKi9cblxuKGZ1bmN0aW9uKGRlZmluZSkgeyAndXNlIHN0cmljdCc7XG5kZWZpbmUoZnVuY3Rpb24oKSB7XG5cblx0cmV0dXJuIGZ1bmN0aW9uIGFkZFdpdGgoUHJvbWlzZSkge1xuXHRcdC8qKlxuXHRcdCAqIFJldHVybnMgYSBwcm9taXNlIHdob3NlIGhhbmRsZXJzIHdpbGwgYmUgY2FsbGVkIHdpdGggYHRoaXNgIHNldCB0b1xuXHRcdCAqIHRoZSBzdXBwbGllZCByZWNlaXZlci4gIFN1YnNlcXVlbnQgcHJvbWlzZXMgZGVyaXZlZCBmcm9tIHRoZVxuXHRcdCAqIHJldHVybmVkIHByb21pc2Ugd2lsbCBhbHNvIGhhdmUgdGhlaXIgaGFuZGxlcnMgY2FsbGVkIHdpdGggcmVjZWl2ZXJcblx0XHQgKiBhcyBgdGhpc2AuIENhbGxpbmcgYHdpdGhgIHdpdGggdW5kZWZpbmVkIG9yIG5vIGFyZ3VtZW50cyB3aWxsIHJldHVyblxuXHRcdCAqIGEgcHJvbWlzZSB3aG9zZSBoYW5kbGVycyB3aWxsIGFnYWluIGJlIGNhbGxlZCBpbiB0aGUgdXN1YWwgUHJvbWlzZXMvQStcblx0XHQgKiB3YXkgKG5vIGB0aGlzYCkgdGh1cyBzYWZlbHkgdW5kb2luZyBhbnkgcHJldmlvdXMgYHdpdGhgIGluIHRoZVxuXHRcdCAqIHByb21pc2UgY2hhaW4uXG5cdFx0ICpcblx0XHQgKiBXQVJOSU5HOiBQcm9taXNlcyByZXR1cm5lZCBmcm9tIGB3aXRoYC9gd2l0aFRoaXNgIGFyZSBOT1QgUHJvbWlzZXMvQStcblx0XHQgKiBjb21wbGlhbnQsIHNwZWNpZmljYWxseSB2aW9sYXRpbmcgMi4yLjUgKGh0dHA6Ly9wcm9taXNlc2FwbHVzLmNvbS8jcG9pbnQtNDEpXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge29iamVjdH0gcmVjZWl2ZXIgYHRoaXNgIHZhbHVlIGZvciBhbGwgaGFuZGxlcnMgYXR0YWNoZWQgdG9cblx0XHQgKiAgdGhlIHJldHVybmVkIHByb21pc2UuXG5cdFx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdFx0ICovXG5cdFx0UHJvbWlzZS5wcm90b3R5cGVbJ3dpdGgnXSA9IFByb21pc2UucHJvdG90eXBlLndpdGhUaGlzID0gZnVuY3Rpb24ocmVjZWl2ZXIpIHtcblx0XHRcdHZhciBwID0gdGhpcy5fYmVnZXQoKTtcblx0XHRcdHZhciBjaGlsZCA9IHAuX2hhbmRsZXI7XG5cdFx0XHRjaGlsZC5yZWNlaXZlciA9IHJlY2VpdmVyO1xuXHRcdFx0dGhpcy5faGFuZGxlci5jaGFpbihjaGlsZCwgcmVjZWl2ZXIpO1xuXHRcdFx0cmV0dXJuIHA7XG5cdFx0fTtcblxuXHRcdHJldHVybiBQcm9taXNlO1xuXHR9O1xuXG59KTtcbn0odHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kID8gZGVmaW5lIDogZnVuY3Rpb24oZmFjdG9yeSkgeyBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKTsgfSkpO1xuXG4iLCIoZnVuY3Rpb24gKHByb2Nlc3Mpe1xuLyoqIEBsaWNlbnNlIE1JVCBMaWNlbnNlIChjKSBjb3B5cmlnaHQgMjAxMC0yMDE0IG9yaWdpbmFsIGF1dGhvciBvciBhdXRob3JzICovXG4vKiogQGF1dGhvciBCcmlhbiBDYXZhbGllciAqL1xuLyoqIEBhdXRob3IgSm9obiBIYW5uICovXG5cbi8qZ2xvYmFsIHByb2Nlc3MsZG9jdW1lbnQsc2V0VGltZW91dCxjbGVhclRpbWVvdXQsTXV0YXRpb25PYnNlcnZlcixXZWJLaXRNdXRhdGlvbk9ic2VydmVyKi9cbihmdW5jdGlvbihkZWZpbmUpIHsgJ3VzZSBzdHJpY3QnO1xuZGVmaW5lKGZ1bmN0aW9uKHJlcXVpcmUpIHtcblx0Lypqc2hpbnQgbWF4Y29tcGxleGl0eTo2Ki9cblxuXHQvLyBTbmlmZiBcImJlc3RcIiBhc3luYyBzY2hlZHVsaW5nIG9wdGlvblxuXHQvLyBQcmVmZXIgcHJvY2Vzcy5uZXh0VGljayBvciBNdXRhdGlvbk9ic2VydmVyLCB0aGVuIGNoZWNrIGZvclxuXHQvLyBzZXRUaW1lb3V0LCBhbmQgZmluYWxseSB2ZXJ0eCwgc2luY2UgaXRzIHRoZSBvbmx5IGVudiB0aGF0IGRvZXNuJ3Rcblx0Ly8gaGF2ZSBzZXRUaW1lb3V0XG5cblx0dmFyIE11dGF0aW9uT2JzO1xuXHR2YXIgY2FwdHVyZWRTZXRUaW1lb3V0ID0gdHlwZW9mIHNldFRpbWVvdXQgIT09ICd1bmRlZmluZWQnICYmIHNldFRpbWVvdXQ7XG5cblx0Ly8gRGVmYXVsdCBlbnZcblx0dmFyIHNldFRpbWVyID0gZnVuY3Rpb24oZiwgbXMpIHsgcmV0dXJuIHNldFRpbWVvdXQoZiwgbXMpOyB9O1xuXHR2YXIgY2xlYXJUaW1lciA9IGZ1bmN0aW9uKHQpIHsgcmV0dXJuIGNsZWFyVGltZW91dCh0KTsgfTtcblx0dmFyIGFzYXAgPSBmdW5jdGlvbiAoZikgeyByZXR1cm4gY2FwdHVyZWRTZXRUaW1lb3V0KGYsIDApOyB9O1xuXG5cdC8vIERldGVjdCBzcGVjaWZpYyBlbnZcblx0aWYgKGlzTm9kZSgpKSB7IC8vIE5vZGVcblx0XHRhc2FwID0gZnVuY3Rpb24gKGYpIHsgcmV0dXJuIHByb2Nlc3MubmV4dFRpY2soZik7IH07XG5cblx0fSBlbHNlIGlmIChNdXRhdGlvbk9icyA9IGhhc011dGF0aW9uT2JzZXJ2ZXIoKSkgeyAvLyBNb2Rlcm4gYnJvd3NlclxuXHRcdGFzYXAgPSBpbml0TXV0YXRpb25PYnNlcnZlcihNdXRhdGlvbk9icyk7XG5cblx0fSBlbHNlIGlmICghY2FwdHVyZWRTZXRUaW1lb3V0KSB7IC8vIHZlcnQueFxuXHRcdHZhciB2ZXJ0eFJlcXVpcmUgPSByZXF1aXJlO1xuXHRcdHZhciB2ZXJ0eCA9IHZlcnR4UmVxdWlyZSgndmVydHgnKTtcblx0XHRzZXRUaW1lciA9IGZ1bmN0aW9uIChmLCBtcykgeyByZXR1cm4gdmVydHguc2V0VGltZXIobXMsIGYpOyB9O1xuXHRcdGNsZWFyVGltZXIgPSB2ZXJ0eC5jYW5jZWxUaW1lcjtcblx0XHRhc2FwID0gdmVydHgucnVuT25Mb29wIHx8IHZlcnR4LnJ1bk9uQ29udGV4dDtcblx0fVxuXG5cdHJldHVybiB7XG5cdFx0c2V0VGltZXI6IHNldFRpbWVyLFxuXHRcdGNsZWFyVGltZXI6IGNsZWFyVGltZXIsXG5cdFx0YXNhcDogYXNhcFxuXHR9O1xuXG5cdGZ1bmN0aW9uIGlzTm9kZSAoKSB7XG5cdFx0cmV0dXJuIHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJyAmJlxuXHRcdFx0T2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHByb2Nlc3MpID09PSAnW29iamVjdCBwcm9jZXNzXSc7XG5cdH1cblxuXHRmdW5jdGlvbiBoYXNNdXRhdGlvbk9ic2VydmVyICgpIHtcblx0XHRyZXR1cm4gKHR5cGVvZiBNdXRhdGlvbk9ic2VydmVyID09PSAnZnVuY3Rpb24nICYmIE11dGF0aW9uT2JzZXJ2ZXIpIHx8XG5cdFx0XHQodHlwZW9mIFdlYktpdE11dGF0aW9uT2JzZXJ2ZXIgPT09ICdmdW5jdGlvbicgJiYgV2ViS2l0TXV0YXRpb25PYnNlcnZlcik7XG5cdH1cblxuXHRmdW5jdGlvbiBpbml0TXV0YXRpb25PYnNlcnZlcihNdXRhdGlvbk9ic2VydmVyKSB7XG5cdFx0dmFyIHNjaGVkdWxlZDtcblx0XHR2YXIgbm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcnKTtcblx0XHR2YXIgbyA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKHJ1bik7XG5cdFx0by5vYnNlcnZlKG5vZGUsIHsgY2hhcmFjdGVyRGF0YTogdHJ1ZSB9KTtcblxuXHRcdGZ1bmN0aW9uIHJ1bigpIHtcblx0XHRcdHZhciBmID0gc2NoZWR1bGVkO1xuXHRcdFx0c2NoZWR1bGVkID0gdm9pZCAwO1xuXHRcdFx0ZigpO1xuXHRcdH1cblxuXHRcdHZhciBpID0gMDtcblx0XHRyZXR1cm4gZnVuY3Rpb24gKGYpIHtcblx0XHRcdHNjaGVkdWxlZCA9IGY7XG5cdFx0XHRub2RlLmRhdGEgPSAoaSBePSAxKTtcblx0XHR9O1xuXHR9XG59KTtcbn0odHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kID8gZGVmaW5lIDogZnVuY3Rpb24oZmFjdG9yeSkgeyBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkocmVxdWlyZSk7IH0pKTtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoJ19wcm9jZXNzJykpIiwiLyoqIEBsaWNlbnNlIE1JVCBMaWNlbnNlIChjKSBjb3B5cmlnaHQgMjAxMC0yMDE0IG9yaWdpbmFsIGF1dGhvciBvciBhdXRob3JzICovXG4vKiogQGF1dGhvciBCcmlhbiBDYXZhbGllciAqL1xuLyoqIEBhdXRob3IgSm9obiBIYW5uICovXG5cbihmdW5jdGlvbihkZWZpbmUpIHsgJ3VzZSBzdHJpY3QnO1xuZGVmaW5lKGZ1bmN0aW9uKCkge1xuXG5cdHJldHVybiB7XG5cdFx0Zm9ybWF0RXJyb3I6IGZvcm1hdEVycm9yLFxuXHRcdGZvcm1hdE9iamVjdDogZm9ybWF0T2JqZWN0LFxuXHRcdHRyeVN0cmluZ2lmeTogdHJ5U3RyaW5naWZ5XG5cdH07XG5cblx0LyoqXG5cdCAqIEZvcm1hdCBhbiBlcnJvciBpbnRvIGEgc3RyaW5nLiAgSWYgZSBpcyBhbiBFcnJvciBhbmQgaGFzIGEgc3RhY2sgcHJvcGVydHksXG5cdCAqIGl0J3MgcmV0dXJuZWQuICBPdGhlcndpc2UsIGUgaXMgZm9ybWF0dGVkIHVzaW5nIGZvcm1hdE9iamVjdCwgd2l0aCBhXG5cdCAqIHdhcm5pbmcgYWRkZWQgYWJvdXQgZSBub3QgYmVpbmcgYSBwcm9wZXIgRXJyb3IuXG5cdCAqIEBwYXJhbSB7Kn0gZVxuXHQgKiBAcmV0dXJucyB7U3RyaW5nfSBmb3JtYXR0ZWQgc3RyaW5nLCBzdWl0YWJsZSBmb3Igb3V0cHV0IHRvIGRldmVsb3BlcnNcblx0ICovXG5cdGZ1bmN0aW9uIGZvcm1hdEVycm9yKGUpIHtcblx0XHR2YXIgcyA9IHR5cGVvZiBlID09PSAnb2JqZWN0JyAmJiBlICE9PSBudWxsICYmIGUuc3RhY2sgPyBlLnN0YWNrIDogZm9ybWF0T2JqZWN0KGUpO1xuXHRcdHJldHVybiBlIGluc3RhbmNlb2YgRXJyb3IgPyBzIDogcyArICcgKFdBUk5JTkc6IG5vbi1FcnJvciB1c2VkKSc7XG5cdH1cblxuXHQvKipcblx0ICogRm9ybWF0IGFuIG9iamVjdCwgZGV0ZWN0aW5nIFwicGxhaW5cIiBvYmplY3RzIGFuZCBydW5uaW5nIHRoZW0gdGhyb3VnaFxuXHQgKiBKU09OLnN0cmluZ2lmeSBpZiBwb3NzaWJsZS5cblx0ICogQHBhcmFtIHtPYmplY3R9IG9cblx0ICogQHJldHVybnMge3N0cmluZ31cblx0ICovXG5cdGZ1bmN0aW9uIGZvcm1hdE9iamVjdChvKSB7XG5cdFx0dmFyIHMgPSBTdHJpbmcobyk7XG5cdFx0aWYocyA9PT0gJ1tvYmplY3QgT2JqZWN0XScgJiYgdHlwZW9mIEpTT04gIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRzID0gdHJ5U3RyaW5naWZ5KG8sIHMpO1xuXHRcdH1cblx0XHRyZXR1cm4gcztcblx0fVxuXG5cdC8qKlxuXHQgKiBUcnkgdG8gcmV0dXJuIHRoZSByZXN1bHQgb2YgSlNPTi5zdHJpbmdpZnkoeCkuICBJZiB0aGF0IGZhaWxzLCByZXR1cm5cblx0ICogZGVmYXVsdFZhbHVlXG5cdCAqIEBwYXJhbSB7Kn0geFxuXHQgKiBAcGFyYW0geyp9IGRlZmF1bHRWYWx1ZVxuXHQgKiBAcmV0dXJucyB7U3RyaW5nfCp9IEpTT04uc3RyaW5naWZ5KHgpIG9yIGRlZmF1bHRWYWx1ZVxuXHQgKi9cblx0ZnVuY3Rpb24gdHJ5U3RyaW5naWZ5KHgsIGRlZmF1bHRWYWx1ZSkge1xuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkoeCk7XG5cdFx0fSBjYXRjaChlKSB7XG5cdFx0XHRyZXR1cm4gZGVmYXVsdFZhbHVlO1xuXHRcdH1cblx0fVxuXG59KTtcbn0odHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kID8gZGVmaW5lIDogZnVuY3Rpb24oZmFjdG9yeSkgeyBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKTsgfSkpO1xuIiwiKGZ1bmN0aW9uIChwcm9jZXNzKXtcbi8qKiBAbGljZW5zZSBNSVQgTGljZW5zZSAoYykgY29weXJpZ2h0IDIwMTAtMjAxNCBvcmlnaW5hbCBhdXRob3Igb3IgYXV0aG9ycyAqL1xuLyoqIEBhdXRob3IgQnJpYW4gQ2F2YWxpZXIgKi9cbi8qKiBAYXV0aG9yIEpvaG4gSGFubiAqL1xuXG4oZnVuY3Rpb24oZGVmaW5lKSB7ICd1c2Ugc3RyaWN0JztcbmRlZmluZShmdW5jdGlvbigpIHtcblxuXHRyZXR1cm4gZnVuY3Rpb24gbWFrZVByb21pc2UoZW52aXJvbm1lbnQpIHtcblxuXHRcdHZhciB0YXNrcyA9IGVudmlyb25tZW50LnNjaGVkdWxlcjtcblx0XHR2YXIgZW1pdFJlamVjdGlvbiA9IGluaXRFbWl0UmVqZWN0aW9uKCk7XG5cblx0XHR2YXIgb2JqZWN0Q3JlYXRlID0gT2JqZWN0LmNyZWF0ZSB8fFxuXHRcdFx0ZnVuY3Rpb24ocHJvdG8pIHtcblx0XHRcdFx0ZnVuY3Rpb24gQ2hpbGQoKSB7fVxuXHRcdFx0XHRDaGlsZC5wcm90b3R5cGUgPSBwcm90bztcblx0XHRcdFx0cmV0dXJuIG5ldyBDaGlsZCgpO1xuXHRcdFx0fTtcblxuXHRcdC8qKlxuXHRcdCAqIENyZWF0ZSBhIHByb21pc2Ugd2hvc2UgZmF0ZSBpcyBkZXRlcm1pbmVkIGJ5IHJlc29sdmVyXG5cdFx0ICogQGNvbnN0cnVjdG9yXG5cdFx0ICogQHJldHVybnMge1Byb21pc2V9IHByb21pc2Vcblx0XHQgKiBAbmFtZSBQcm9taXNlXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gUHJvbWlzZShyZXNvbHZlciwgaGFuZGxlcikge1xuXHRcdFx0dGhpcy5faGFuZGxlciA9IHJlc29sdmVyID09PSBIYW5kbGVyID8gaGFuZGxlciA6IGluaXQocmVzb2x2ZXIpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJ1biB0aGUgc3VwcGxpZWQgcmVzb2x2ZXJcblx0XHQgKiBAcGFyYW0gcmVzb2x2ZXJcblx0XHQgKiBAcmV0dXJucyB7UGVuZGluZ31cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpbml0KHJlc29sdmVyKSB7XG5cdFx0XHR2YXIgaGFuZGxlciA9IG5ldyBQZW5kaW5nKCk7XG5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdHJlc29sdmVyKHByb21pc2VSZXNvbHZlLCBwcm9taXNlUmVqZWN0LCBwcm9taXNlTm90aWZ5KTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0cHJvbWlzZVJlamVjdChlKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGhhbmRsZXI7XG5cblx0XHRcdC8qKlxuXHRcdFx0ICogVHJhbnNpdGlvbiBmcm9tIHByZS1yZXNvbHV0aW9uIHN0YXRlIHRvIHBvc3QtcmVzb2x1dGlvbiBzdGF0ZSwgbm90aWZ5aW5nXG5cdFx0XHQgKiBhbGwgbGlzdGVuZXJzIG9mIHRoZSB1bHRpbWF0ZSBmdWxmaWxsbWVudCBvciByZWplY3Rpb25cblx0XHRcdCAqIEBwYXJhbSB7Kn0geCByZXNvbHV0aW9uIHZhbHVlXG5cdFx0XHQgKi9cblx0XHRcdGZ1bmN0aW9uIHByb21pc2VSZXNvbHZlICh4KSB7XG5cdFx0XHRcdGhhbmRsZXIucmVzb2x2ZSh4KTtcblx0XHRcdH1cblx0XHRcdC8qKlxuXHRcdFx0ICogUmVqZWN0IHRoaXMgcHJvbWlzZSB3aXRoIHJlYXNvbiwgd2hpY2ggd2lsbCBiZSB1c2VkIHZlcmJhdGltXG5cdFx0XHQgKiBAcGFyYW0ge0Vycm9yfCp9IHJlYXNvbiByZWplY3Rpb24gcmVhc29uLCBzdHJvbmdseSBzdWdnZXN0ZWRcblx0XHRcdCAqICAgdG8gYmUgYW4gRXJyb3IgdHlwZVxuXHRcdFx0ICovXG5cdFx0XHRmdW5jdGlvbiBwcm9taXNlUmVqZWN0IChyZWFzb24pIHtcblx0XHRcdFx0aGFuZGxlci5yZWplY3QocmVhc29uKTtcblx0XHRcdH1cblxuXHRcdFx0LyoqXG5cdFx0XHQgKiBAZGVwcmVjYXRlZFxuXHRcdFx0ICogSXNzdWUgYSBwcm9ncmVzcyBldmVudCwgbm90aWZ5aW5nIGFsbCBwcm9ncmVzcyBsaXN0ZW5lcnNcblx0XHRcdCAqIEBwYXJhbSB7Kn0geCBwcm9ncmVzcyBldmVudCBwYXlsb2FkIHRvIHBhc3MgdG8gYWxsIGxpc3RlbmVyc1xuXHRcdFx0ICovXG5cdFx0XHRmdW5jdGlvbiBwcm9taXNlTm90aWZ5ICh4KSB7XG5cdFx0XHRcdGhhbmRsZXIubm90aWZ5KHgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIENyZWF0aW9uXG5cblx0XHRQcm9taXNlLnJlc29sdmUgPSByZXNvbHZlO1xuXHRcdFByb21pc2UucmVqZWN0ID0gcmVqZWN0O1xuXHRcdFByb21pc2UubmV2ZXIgPSBuZXZlcjtcblxuXHRcdFByb21pc2UuX2RlZmVyID0gZGVmZXI7XG5cdFx0UHJvbWlzZS5faGFuZGxlciA9IGdldEhhbmRsZXI7XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm5zIGEgdHJ1c3RlZCBwcm9taXNlLiBJZiB4IGlzIGFscmVhZHkgYSB0cnVzdGVkIHByb21pc2UsIGl0IGlzXG5cdFx0ICogcmV0dXJuZWQsIG90aGVyd2lzZSByZXR1cm5zIGEgbmV3IHRydXN0ZWQgUHJvbWlzZSB3aGljaCBmb2xsb3dzIHguXG5cdFx0ICogQHBhcmFtICB7Kn0geFxuXHRcdCAqIEByZXR1cm4ge1Byb21pc2V9IHByb21pc2Vcblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZXNvbHZlKHgpIHtcblx0XHRcdHJldHVybiBpc1Byb21pc2UoeCkgPyB4XG5cdFx0XHRcdDogbmV3IFByb21pc2UoSGFuZGxlciwgbmV3IEFzeW5jKGdldEhhbmRsZXIoeCkpKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gYSByZWplY3QgcHJvbWlzZSB3aXRoIHggYXMgaXRzIHJlYXNvbiAoeCBpcyB1c2VkIHZlcmJhdGltKVxuXHRcdCAqIEBwYXJhbSB7Kn0geFxuXHRcdCAqIEByZXR1cm5zIHtQcm9taXNlfSByZWplY3RlZCBwcm9taXNlXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVqZWN0KHgpIHtcblx0XHRcdHJldHVybiBuZXcgUHJvbWlzZShIYW5kbGVyLCBuZXcgQXN5bmMobmV3IFJlamVjdGVkKHgpKSk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIGEgcHJvbWlzZSB0aGF0IHJlbWFpbnMgcGVuZGluZyBmb3JldmVyXG5cdFx0ICogQHJldHVybnMge1Byb21pc2V9IGZvcmV2ZXItcGVuZGluZyBwcm9taXNlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG5ldmVyKCkge1xuXHRcdFx0cmV0dXJuIGZvcmV2ZXJQZW5kaW5nUHJvbWlzZTsgLy8gU2hvdWxkIGJlIGZyb3plblxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENyZWF0ZXMgYW4gaW50ZXJuYWwge3Byb21pc2UsIHJlc29sdmVyfSBwYWlyXG5cdFx0ICogQHByaXZhdGVcblx0XHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBkZWZlcigpIHtcblx0XHRcdHJldHVybiBuZXcgUHJvbWlzZShIYW5kbGVyLCBuZXcgUGVuZGluZygpKTtcblx0XHR9XG5cblx0XHQvLyBUcmFuc2Zvcm1hdGlvbiBhbmQgZmxvdyBjb250cm9sXG5cblx0XHQvKipcblx0XHQgKiBUcmFuc2Zvcm0gdGhpcyBwcm9taXNlJ3MgZnVsZmlsbG1lbnQgdmFsdWUsIHJldHVybmluZyBhIG5ldyBQcm9taXNlXG5cdFx0ICogZm9yIHRoZSB0cmFuc2Zvcm1lZCByZXN1bHQuICBJZiB0aGUgcHJvbWlzZSBjYW5ub3QgYmUgZnVsZmlsbGVkLCBvblJlamVjdGVkXG5cdFx0ICogaXMgY2FsbGVkIHdpdGggdGhlIHJlYXNvbi4gIG9uUHJvZ3Jlc3MgKm1heSogYmUgY2FsbGVkIHdpdGggdXBkYXRlcyB0b3dhcmRcblx0XHQgKiB0aGlzIHByb21pc2UncyBmdWxmaWxsbWVudC5cblx0XHQgKiBAcGFyYW0ge2Z1bmN0aW9uPX0gb25GdWxmaWxsZWQgZnVsZmlsbG1lbnQgaGFuZGxlclxuXHRcdCAqIEBwYXJhbSB7ZnVuY3Rpb249fSBvblJlamVjdGVkIHJlamVjdGlvbiBoYW5kbGVyXG5cdFx0ICogQHBhcmFtIHtmdW5jdGlvbj19IG9uUHJvZ3Jlc3MgQGRlcHJlY2F0ZWQgcHJvZ3Jlc3MgaGFuZGxlclxuXHRcdCAqIEByZXR1cm4ge1Byb21pc2V9IG5ldyBwcm9taXNlXG5cdFx0ICovXG5cdFx0UHJvbWlzZS5wcm90b3R5cGUudGhlbiA9IGZ1bmN0aW9uKG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzKSB7XG5cdFx0XHR2YXIgcGFyZW50ID0gdGhpcy5faGFuZGxlcjtcblx0XHRcdHZhciBzdGF0ZSA9IHBhcmVudC5qb2luKCkuc3RhdGUoKTtcblxuXHRcdFx0aWYgKCh0eXBlb2Ygb25GdWxmaWxsZWQgIT09ICdmdW5jdGlvbicgJiYgc3RhdGUgPiAwKSB8fFxuXHRcdFx0XHQodHlwZW9mIG9uUmVqZWN0ZWQgIT09ICdmdW5jdGlvbicgJiYgc3RhdGUgPCAwKSkge1xuXHRcdFx0XHQvLyBTaG9ydCBjaXJjdWl0OiB2YWx1ZSB3aWxsIG5vdCBjaGFuZ2UsIHNpbXBseSBzaGFyZSBoYW5kbGVyXG5cdFx0XHRcdHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcihIYW5kbGVyLCBwYXJlbnQpO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgcCA9IHRoaXMuX2JlZ2V0KCk7XG5cdFx0XHR2YXIgY2hpbGQgPSBwLl9oYW5kbGVyO1xuXG5cdFx0XHRwYXJlbnQuY2hhaW4oY2hpbGQsIHBhcmVudC5yZWNlaXZlciwgb25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MpO1xuXG5cdFx0XHRyZXR1cm4gcDtcblx0XHR9O1xuXG5cdFx0LyoqXG5cdFx0ICogSWYgdGhpcyBwcm9taXNlIGNhbm5vdCBiZSBmdWxmaWxsZWQgZHVlIHRvIGFuIGVycm9yLCBjYWxsIG9uUmVqZWN0ZWQgdG9cblx0XHQgKiBoYW5kbGUgdGhlIGVycm9yLiBTaG9ydGN1dCBmb3IgLnRoZW4odW5kZWZpbmVkLCBvblJlamVjdGVkKVxuXHRcdCAqIEBwYXJhbSB7ZnVuY3Rpb24/fSBvblJlamVjdGVkXG5cdFx0ICogQHJldHVybiB7UHJvbWlzZX1cblx0XHQgKi9cblx0XHRQcm9taXNlLnByb3RvdHlwZVsnY2F0Y2gnXSA9IGZ1bmN0aW9uKG9uUmVqZWN0ZWQpIHtcblx0XHRcdHJldHVybiB0aGlzLnRoZW4odm9pZCAwLCBvblJlamVjdGVkKTtcblx0XHR9O1xuXG5cdFx0LyoqXG5cdFx0ICogQ3JlYXRlcyBhIG5ldywgcGVuZGluZyBwcm9taXNlIG9mIHRoZSBzYW1lIHR5cGUgYXMgdGhpcyBwcm9taXNlXG5cdFx0ICogQHByaXZhdGVcblx0XHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0XHQgKi9cblx0XHRQcm9taXNlLnByb3RvdHlwZS5fYmVnZXQgPSBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiBiZWdldEZyb20odGhpcy5faGFuZGxlciwgdGhpcy5jb25zdHJ1Y3Rvcik7XG5cdFx0fTtcblxuXHRcdGZ1bmN0aW9uIGJlZ2V0RnJvbShwYXJlbnQsIFByb21pc2UpIHtcblx0XHRcdHZhciBjaGlsZCA9IG5ldyBQZW5kaW5nKHBhcmVudC5yZWNlaXZlciwgcGFyZW50LmpvaW4oKS5jb250ZXh0KTtcblx0XHRcdHJldHVybiBuZXcgUHJvbWlzZShIYW5kbGVyLCBjaGlsZCk7XG5cdFx0fVxuXG5cdFx0Ly8gQXJyYXkgY29tYmluYXRvcnNcblxuXHRcdFByb21pc2UuYWxsID0gYWxsO1xuXHRcdFByb21pc2UucmFjZSA9IHJhY2U7XG5cdFx0UHJvbWlzZS5fdHJhdmVyc2UgPSB0cmF2ZXJzZTtcblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBhIHByb21pc2UgdGhhdCB3aWxsIGZ1bGZpbGwgd2hlbiBhbGwgcHJvbWlzZXMgaW4gdGhlXG5cdFx0ICogaW5wdXQgYXJyYXkgaGF2ZSBmdWxmaWxsZWQsIG9yIHdpbGwgcmVqZWN0IHdoZW4gb25lIG9mIHRoZVxuXHRcdCAqIHByb21pc2VzIHJlamVjdHMuXG5cdFx0ICogQHBhcmFtIHthcnJheX0gcHJvbWlzZXMgYXJyYXkgb2YgcHJvbWlzZXNcblx0XHQgKiBAcmV0dXJucyB7UHJvbWlzZX0gcHJvbWlzZSBmb3IgYXJyYXkgb2YgZnVsZmlsbG1lbnQgdmFsdWVzXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYWxsKHByb21pc2VzKSB7XG5cdFx0XHRyZXR1cm4gdHJhdmVyc2VXaXRoKHNuZCwgbnVsbCwgcHJvbWlzZXMpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFycmF5PFByb21pc2U8WD4+IC0+IFByb21pc2U8QXJyYXk8ZihYKT4+XG5cdFx0ICogQHByaXZhdGVcblx0XHQgKiBAcGFyYW0ge2Z1bmN0aW9ufSBmIGZ1bmN0aW9uIHRvIGFwcGx5IHRvIGVhY2ggcHJvbWlzZSdzIHZhbHVlXG5cdFx0ICogQHBhcmFtIHtBcnJheX0gcHJvbWlzZXMgYXJyYXkgb2YgcHJvbWlzZXNcblx0XHQgKiBAcmV0dXJucyB7UHJvbWlzZX0gcHJvbWlzZSBmb3IgdHJhbnNmb3JtZWQgdmFsdWVzXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gdHJhdmVyc2UoZiwgcHJvbWlzZXMpIHtcblx0XHRcdHJldHVybiB0cmF2ZXJzZVdpdGgodHJ5Q2F0Y2gyLCBmLCBwcm9taXNlcyk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gdHJhdmVyc2VXaXRoKHRyeU1hcCwgZiwgcHJvbWlzZXMpIHtcblx0XHRcdHZhciBoYW5kbGVyID0gdHlwZW9mIGYgPT09ICdmdW5jdGlvbicgPyBtYXBBdCA6IHNldHRsZUF0O1xuXG5cdFx0XHR2YXIgcmVzb2x2ZXIgPSBuZXcgUGVuZGluZygpO1xuXHRcdFx0dmFyIHBlbmRpbmcgPSBwcm9taXNlcy5sZW5ndGggPj4+IDA7XG5cdFx0XHR2YXIgcmVzdWx0cyA9IG5ldyBBcnJheShwZW5kaW5nKTtcblxuXHRcdFx0Zm9yICh2YXIgaSA9IDAsIHg7IGkgPCBwcm9taXNlcy5sZW5ndGggJiYgIXJlc29sdmVyLnJlc29sdmVkOyArK2kpIHtcblx0XHRcdFx0eCA9IHByb21pc2VzW2ldO1xuXG5cdFx0XHRcdGlmICh4ID09PSB2b2lkIDAgJiYgIShpIGluIHByb21pc2VzKSkge1xuXHRcdFx0XHRcdC0tcGVuZGluZztcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRyYXZlcnNlQXQocHJvbWlzZXMsIGhhbmRsZXIsIGksIHgsIHJlc29sdmVyKTtcblx0XHRcdH1cblxuXHRcdFx0aWYocGVuZGluZyA9PT0gMCkge1xuXHRcdFx0XHRyZXNvbHZlci5iZWNvbWUobmV3IEZ1bGZpbGxlZChyZXN1bHRzKSk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBuZXcgUHJvbWlzZShIYW5kbGVyLCByZXNvbHZlcik7XG5cblx0XHRcdGZ1bmN0aW9uIG1hcEF0KGksIHgsIHJlc29sdmVyKSB7XG5cdFx0XHRcdGlmKCFyZXNvbHZlci5yZXNvbHZlZCkge1xuXHRcdFx0XHRcdHRyYXZlcnNlQXQocHJvbWlzZXMsIHNldHRsZUF0LCBpLCB0cnlNYXAoZiwgeCwgaSksIHJlc29sdmVyKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRmdW5jdGlvbiBzZXR0bGVBdChpLCB4LCByZXNvbHZlcikge1xuXHRcdFx0XHRyZXN1bHRzW2ldID0geDtcblx0XHRcdFx0aWYoLS1wZW5kaW5nID09PSAwKSB7XG5cdFx0XHRcdFx0cmVzb2x2ZXIuYmVjb21lKG5ldyBGdWxmaWxsZWQocmVzdWx0cykpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gdHJhdmVyc2VBdChwcm9taXNlcywgaGFuZGxlciwgaSwgeCwgcmVzb2x2ZXIpIHtcblx0XHRcdGlmIChtYXliZVRoZW5hYmxlKHgpKSB7XG5cdFx0XHRcdHZhciBoID0gZ2V0SGFuZGxlck1heWJlVGhlbmFibGUoeCk7XG5cdFx0XHRcdHZhciBzID0gaC5zdGF0ZSgpO1xuXG5cdFx0XHRcdGlmIChzID09PSAwKSB7XG5cdFx0XHRcdFx0aC5mb2xkKGhhbmRsZXIsIGksIHZvaWQgMCwgcmVzb2x2ZXIpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHMgPiAwKSB7XG5cdFx0XHRcdFx0aGFuZGxlcihpLCBoLnZhbHVlLCByZXNvbHZlcik7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmVzb2x2ZXIuYmVjb21lKGgpO1xuXHRcdFx0XHRcdHZpc2l0UmVtYWluaW5nKHByb21pc2VzLCBpKzEsIGgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRoYW5kbGVyKGksIHgsIHJlc29sdmVyKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRQcm9taXNlLl92aXNpdFJlbWFpbmluZyA9IHZpc2l0UmVtYWluaW5nO1xuXHRcdGZ1bmN0aW9uIHZpc2l0UmVtYWluaW5nKHByb21pc2VzLCBzdGFydCwgaGFuZGxlcikge1xuXHRcdFx0Zm9yKHZhciBpPXN0YXJ0OyBpPHByb21pc2VzLmxlbmd0aDsgKytpKSB7XG5cdFx0XHRcdG1hcmtBc0hhbmRsZWQoZ2V0SGFuZGxlcihwcm9taXNlc1tpXSksIGhhbmRsZXIpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIG1hcmtBc0hhbmRsZWQoaCwgaGFuZGxlcikge1xuXHRcdFx0aWYoaCA9PT0gaGFuZGxlcikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHZhciBzID0gaC5zdGF0ZSgpO1xuXHRcdFx0aWYocyA9PT0gMCkge1xuXHRcdFx0XHRoLnZpc2l0KGgsIHZvaWQgMCwgaC5fdW5yZXBvcnQpO1xuXHRcdFx0fSBlbHNlIGlmKHMgPCAwKSB7XG5cdFx0XHRcdGguX3VucmVwb3J0KCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRnVsZmlsbC1yZWplY3QgY29tcGV0aXRpdmUgcmFjZS4gUmV0dXJuIGEgcHJvbWlzZSB0aGF0IHdpbGwgc2V0dGxlXG5cdFx0ICogdG8gdGhlIHNhbWUgc3RhdGUgYXMgdGhlIGVhcmxpZXN0IGlucHV0IHByb21pc2UgdG8gc2V0dGxlLlxuXHRcdCAqXG5cdFx0ICogV0FSTklORzogVGhlIEVTNiBQcm9taXNlIHNwZWMgcmVxdWlyZXMgdGhhdCByYWNlKClpbmcgYW4gZW1wdHkgYXJyYXlcblx0XHQgKiBtdXN0IHJldHVybiBhIHByb21pc2UgdGhhdCBpcyBwZW5kaW5nIGZvcmV2ZXIuICBUaGlzIGltcGxlbWVudGF0aW9uXG5cdFx0ICogcmV0dXJucyBhIHNpbmdsZXRvbiBmb3JldmVyLXBlbmRpbmcgcHJvbWlzZSwgdGhlIHNhbWUgc2luZ2xldG9uIHRoYXQgaXNcblx0XHQgKiByZXR1cm5lZCBieSBQcm9taXNlLm5ldmVyKCksIHRodXMgY2FuIGJlIGNoZWNrZWQgd2l0aCA9PT1cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7YXJyYXl9IHByb21pc2VzIGFycmF5IG9mIHByb21pc2VzIHRvIHJhY2Vcblx0XHQgKiBAcmV0dXJucyB7UHJvbWlzZX0gaWYgaW5wdXQgaXMgbm9uLWVtcHR5LCBhIHByb21pc2UgdGhhdCB3aWxsIHNldHRsZVxuXHRcdCAqIHRvIHRoZSBzYW1lIG91dGNvbWUgYXMgdGhlIGVhcmxpZXN0IGlucHV0IHByb21pc2UgdG8gc2V0dGxlLiBpZiBlbXB0eVxuXHRcdCAqIGlzIGVtcHR5LCByZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHdpbGwgbmV2ZXIgc2V0dGxlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJhY2UocHJvbWlzZXMpIHtcblx0XHRcdGlmKHR5cGVvZiBwcm9taXNlcyAhPT0gJ29iamVjdCcgfHwgcHJvbWlzZXMgPT09IG51bGwpIHtcblx0XHRcdFx0cmV0dXJuIHJlamVjdChuZXcgVHlwZUVycm9yKCdub24taXRlcmFibGUgcGFzc2VkIHRvIHJhY2UoKScpKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gU2lnaCwgcmFjZShbXSkgaXMgdW50ZXN0YWJsZSB1bmxlc3Mgd2UgcmV0dXJuICpzb21ldGhpbmcqXG5cdFx0XHQvLyB0aGF0IGlzIHJlY29nbml6YWJsZSB3aXRob3V0IGNhbGxpbmcgLnRoZW4oKSBvbiBpdC5cblx0XHRcdHJldHVybiBwcm9taXNlcy5sZW5ndGggPT09IDAgPyBuZXZlcigpXG5cdFx0XHRcdCA6IHByb21pc2VzLmxlbmd0aCA9PT0gMSA/IHJlc29sdmUocHJvbWlzZXNbMF0pXG5cdFx0XHRcdCA6IHJ1blJhY2UocHJvbWlzZXMpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHJ1blJhY2UocHJvbWlzZXMpIHtcblx0XHRcdHZhciByZXNvbHZlciA9IG5ldyBQZW5kaW5nKCk7XG5cdFx0XHR2YXIgaSwgeCwgaDtcblx0XHRcdGZvcihpPTA7IGk8cHJvbWlzZXMubGVuZ3RoOyArK2kpIHtcblx0XHRcdFx0eCA9IHByb21pc2VzW2ldO1xuXHRcdFx0XHRpZiAoeCA9PT0gdm9pZCAwICYmICEoaSBpbiBwcm9taXNlcykpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGggPSBnZXRIYW5kbGVyKHgpO1xuXHRcdFx0XHRpZihoLnN0YXRlKCkgIT09IDApIHtcblx0XHRcdFx0XHRyZXNvbHZlci5iZWNvbWUoaCk7XG5cdFx0XHRcdFx0dmlzaXRSZW1haW5pbmcocHJvbWlzZXMsIGkrMSwgaCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aC52aXNpdChyZXNvbHZlciwgcmVzb2x2ZXIucmVzb2x2ZSwgcmVzb2x2ZXIucmVqZWN0KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlKEhhbmRsZXIsIHJlc29sdmVyKTtcblx0XHR9XG5cblx0XHQvLyBQcm9taXNlIGludGVybmFsc1xuXHRcdC8vIEJlbG93IHRoaXMsIGV2ZXJ5dGhpbmcgaXMgQHByaXZhdGVcblxuXHRcdC8qKlxuXHRcdCAqIEdldCBhbiBhcHByb3ByaWF0ZSBoYW5kbGVyIGZvciB4LCB3aXRob3V0IGNoZWNraW5nIGZvciBjeWNsZXNcblx0XHQgKiBAcGFyYW0geyp9IHhcblx0XHQgKiBAcmV0dXJucyB7b2JqZWN0fSBoYW5kbGVyXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0SGFuZGxlcih4KSB7XG5cdFx0XHRpZihpc1Byb21pc2UoeCkpIHtcblx0XHRcdFx0cmV0dXJuIHguX2hhbmRsZXIuam9pbigpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG1heWJlVGhlbmFibGUoeCkgPyBnZXRIYW5kbGVyVW50cnVzdGVkKHgpIDogbmV3IEZ1bGZpbGxlZCh4KTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBHZXQgYSBoYW5kbGVyIGZvciB0aGVuYWJsZSB4LlxuXHRcdCAqIE5PVEU6IFlvdSBtdXN0IG9ubHkgY2FsbCB0aGlzIGlmIG1heWJlVGhlbmFibGUoeCkgPT0gdHJ1ZVxuXHRcdCAqIEBwYXJhbSB7b2JqZWN0fGZ1bmN0aW9ufFByb21pc2V9IHhcblx0XHQgKiBAcmV0dXJucyB7b2JqZWN0fSBoYW5kbGVyXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0SGFuZGxlck1heWJlVGhlbmFibGUoeCkge1xuXHRcdFx0cmV0dXJuIGlzUHJvbWlzZSh4KSA/IHguX2hhbmRsZXIuam9pbigpIDogZ2V0SGFuZGxlclVudHJ1c3RlZCh4KTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBHZXQgYSBoYW5kbGVyIGZvciBwb3RlbnRpYWxseSB1bnRydXN0ZWQgdGhlbmFibGUgeFxuXHRcdCAqIEBwYXJhbSB7Kn0geFxuXHRcdCAqIEByZXR1cm5zIHtvYmplY3R9IGhhbmRsZXJcblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRIYW5kbGVyVW50cnVzdGVkKHgpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHZhciB1bnRydXN0ZWRUaGVuID0geC50aGVuO1xuXHRcdFx0XHRyZXR1cm4gdHlwZW9mIHVudHJ1c3RlZFRoZW4gPT09ICdmdW5jdGlvbidcblx0XHRcdFx0XHQ/IG5ldyBUaGVuYWJsZSh1bnRydXN0ZWRUaGVuLCB4KVxuXHRcdFx0XHRcdDogbmV3IEZ1bGZpbGxlZCh4KTtcblx0XHRcdH0gY2F0Y2goZSkge1xuXHRcdFx0XHRyZXR1cm4gbmV3IFJlamVjdGVkKGUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEhhbmRsZXIgZm9yIGEgcHJvbWlzZSB0aGF0IGlzIHBlbmRpbmcgZm9yZXZlclxuXHRcdCAqIEBjb25zdHJ1Y3RvclxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIEhhbmRsZXIoKSB7fVxuXG5cdFx0SGFuZGxlci5wcm90b3R5cGUud2hlblxuXHRcdFx0PSBIYW5kbGVyLnByb3RvdHlwZS5iZWNvbWVcblx0XHRcdD0gSGFuZGxlci5wcm90b3R5cGUubm90aWZ5IC8vIGRlcHJlY2F0ZWRcblx0XHRcdD0gSGFuZGxlci5wcm90b3R5cGUuZmFpbFxuXHRcdFx0PSBIYW5kbGVyLnByb3RvdHlwZS5fdW5yZXBvcnRcblx0XHRcdD0gSGFuZGxlci5wcm90b3R5cGUuX3JlcG9ydFxuXHRcdFx0PSBub29wO1xuXG5cdFx0SGFuZGxlci5wcm90b3R5cGUuX3N0YXRlID0gMDtcblxuXHRcdEhhbmRsZXIucHJvdG90eXBlLnN0YXRlID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fc3RhdGU7XG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdCAqIFJlY3Vyc2l2ZWx5IGNvbGxhcHNlIGhhbmRsZXIgY2hhaW4gdG8gZmluZCB0aGUgaGFuZGxlclxuXHRcdCAqIG5lYXJlc3QgdG8gdGhlIGZ1bGx5IHJlc29sdmVkIHZhbHVlLlxuXHRcdCAqIEByZXR1cm5zIHtvYmplY3R9IGhhbmRsZXIgbmVhcmVzdCB0aGUgZnVsbHkgcmVzb2x2ZWQgdmFsdWVcblx0XHQgKi9cblx0XHRIYW5kbGVyLnByb3RvdHlwZS5qb2luID0gZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgaCA9IHRoaXM7XG5cdFx0XHR3aGlsZShoLmhhbmRsZXIgIT09IHZvaWQgMCkge1xuXHRcdFx0XHRoID0gaC5oYW5kbGVyO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGg7XG5cdFx0fTtcblxuXHRcdEhhbmRsZXIucHJvdG90eXBlLmNoYWluID0gZnVuY3Rpb24odG8sIHJlY2VpdmVyLCBmdWxmaWxsZWQsIHJlamVjdGVkLCBwcm9ncmVzcykge1xuXHRcdFx0dGhpcy53aGVuKHtcblx0XHRcdFx0cmVzb2x2ZXI6IHRvLFxuXHRcdFx0XHRyZWNlaXZlcjogcmVjZWl2ZXIsXG5cdFx0XHRcdGZ1bGZpbGxlZDogZnVsZmlsbGVkLFxuXHRcdFx0XHRyZWplY3RlZDogcmVqZWN0ZWQsXG5cdFx0XHRcdHByb2dyZXNzOiBwcm9ncmVzc1xuXHRcdFx0fSk7XG5cdFx0fTtcblxuXHRcdEhhbmRsZXIucHJvdG90eXBlLnZpc2l0ID0gZnVuY3Rpb24ocmVjZWl2ZXIsIGZ1bGZpbGxlZCwgcmVqZWN0ZWQsIHByb2dyZXNzKSB7XG5cdFx0XHR0aGlzLmNoYWluKGZhaWxJZlJlamVjdGVkLCByZWNlaXZlciwgZnVsZmlsbGVkLCByZWplY3RlZCwgcHJvZ3Jlc3MpO1xuXHRcdH07XG5cblx0XHRIYW5kbGVyLnByb3RvdHlwZS5mb2xkID0gZnVuY3Rpb24oZiwgeiwgYywgdG8pIHtcblx0XHRcdHRoaXMud2hlbihuZXcgRm9sZChmLCB6LCBjLCB0bykpO1xuXHRcdH07XG5cblx0XHQvKipcblx0XHQgKiBIYW5kbGVyIHRoYXQgaW52b2tlcyBmYWlsKCkgb24gYW55IGhhbmRsZXIgaXQgYmVjb21lc1xuXHRcdCAqIEBjb25zdHJ1Y3RvclxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIEZhaWxJZlJlamVjdGVkKCkge31cblxuXHRcdGluaGVyaXQoSGFuZGxlciwgRmFpbElmUmVqZWN0ZWQpO1xuXG5cdFx0RmFpbElmUmVqZWN0ZWQucHJvdG90eXBlLmJlY29tZSA9IGZ1bmN0aW9uKGgpIHtcblx0XHRcdGguZmFpbCgpO1xuXHRcdH07XG5cblx0XHR2YXIgZmFpbElmUmVqZWN0ZWQgPSBuZXcgRmFpbElmUmVqZWN0ZWQoKTtcblxuXHRcdC8qKlxuXHRcdCAqIEhhbmRsZXIgdGhhdCBtYW5hZ2VzIGEgcXVldWUgb2YgY29uc3VtZXJzIHdhaXRpbmcgb24gYSBwZW5kaW5nIHByb21pc2Vcblx0XHQgKiBAY29uc3RydWN0b3Jcblx0XHQgKi9cblx0XHRmdW5jdGlvbiBQZW5kaW5nKHJlY2VpdmVyLCBpbmhlcml0ZWRDb250ZXh0KSB7XG5cdFx0XHRQcm9taXNlLmNyZWF0ZUNvbnRleHQodGhpcywgaW5oZXJpdGVkQ29udGV4dCk7XG5cblx0XHRcdHRoaXMuY29uc3VtZXJzID0gdm9pZCAwO1xuXHRcdFx0dGhpcy5yZWNlaXZlciA9IHJlY2VpdmVyO1xuXHRcdFx0dGhpcy5oYW5kbGVyID0gdm9pZCAwO1xuXHRcdFx0dGhpcy5yZXNvbHZlZCA9IGZhbHNlO1xuXHRcdH1cblxuXHRcdGluaGVyaXQoSGFuZGxlciwgUGVuZGluZyk7XG5cblx0XHRQZW5kaW5nLnByb3RvdHlwZS5fc3RhdGUgPSAwO1xuXG5cdFx0UGVuZGluZy5wcm90b3R5cGUucmVzb2x2ZSA9IGZ1bmN0aW9uKHgpIHtcblx0XHRcdHRoaXMuYmVjb21lKGdldEhhbmRsZXIoeCkpO1xuXHRcdH07XG5cblx0XHRQZW5kaW5nLnByb3RvdHlwZS5yZWplY3QgPSBmdW5jdGlvbih4KSB7XG5cdFx0XHRpZih0aGlzLnJlc29sdmVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5iZWNvbWUobmV3IFJlamVjdGVkKHgpKTtcblx0XHR9O1xuXG5cdFx0UGVuZGluZy5wcm90b3R5cGUuam9pbiA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYgKCF0aGlzLnJlc29sdmVkKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgaCA9IHRoaXM7XG5cblx0XHRcdHdoaWxlIChoLmhhbmRsZXIgIT09IHZvaWQgMCkge1xuXHRcdFx0XHRoID0gaC5oYW5kbGVyO1xuXHRcdFx0XHRpZiAoaCA9PT0gdGhpcykge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmhhbmRsZXIgPSBjeWNsZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBoO1xuXHRcdH07XG5cblx0XHRQZW5kaW5nLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBxID0gdGhpcy5jb25zdW1lcnM7XG5cdFx0XHR2YXIgaGFuZGxlciA9IHRoaXMuaGFuZGxlcjtcblx0XHRcdHRoaXMuaGFuZGxlciA9IHRoaXMuaGFuZGxlci5qb2luKCk7XG5cdFx0XHR0aGlzLmNvbnN1bWVycyA9IHZvaWQgMDtcblxuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBxLmxlbmd0aDsgKytpKSB7XG5cdFx0XHRcdGhhbmRsZXIud2hlbihxW2ldKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0UGVuZGluZy5wcm90b3R5cGUuYmVjb21lID0gZnVuY3Rpb24oaGFuZGxlcikge1xuXHRcdFx0aWYodGhpcy5yZXNvbHZlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMucmVzb2x2ZWQgPSB0cnVlO1xuXHRcdFx0dGhpcy5oYW5kbGVyID0gaGFuZGxlcjtcblx0XHRcdGlmKHRoaXMuY29uc3VtZXJzICE9PSB2b2lkIDApIHtcblx0XHRcdFx0dGFza3MuZW5xdWV1ZSh0aGlzKTtcblx0XHRcdH1cblxuXHRcdFx0aWYodGhpcy5jb250ZXh0ICE9PSB2b2lkIDApIHtcblx0XHRcdFx0aGFuZGxlci5fcmVwb3J0KHRoaXMuY29udGV4dCk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdFBlbmRpbmcucHJvdG90eXBlLndoZW4gPSBmdW5jdGlvbihjb250aW51YXRpb24pIHtcblx0XHRcdGlmKHRoaXMucmVzb2x2ZWQpIHtcblx0XHRcdFx0dGFza3MuZW5xdWV1ZShuZXcgQ29udGludWF0aW9uVGFzayhjb250aW51YXRpb24sIHRoaXMuaGFuZGxlcikpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYodGhpcy5jb25zdW1lcnMgPT09IHZvaWQgMCkge1xuXHRcdFx0XHRcdHRoaXMuY29uc3VtZXJzID0gW2NvbnRpbnVhdGlvbl07XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5jb25zdW1lcnMucHVzaChjb250aW51YXRpb24pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdCAqIEBkZXByZWNhdGVkXG5cdFx0ICovXG5cdFx0UGVuZGluZy5wcm90b3R5cGUubm90aWZ5ID0gZnVuY3Rpb24oeCkge1xuXHRcdFx0aWYoIXRoaXMucmVzb2x2ZWQpIHtcblx0XHRcdFx0dGFza3MuZW5xdWV1ZShuZXcgUHJvZ3Jlc3NUYXNrKHgsIHRoaXMpKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0UGVuZGluZy5wcm90b3R5cGUuZmFpbCA9IGZ1bmN0aW9uKGNvbnRleHQpIHtcblx0XHRcdHZhciBjID0gdHlwZW9mIGNvbnRleHQgPT09ICd1bmRlZmluZWQnID8gdGhpcy5jb250ZXh0IDogY29udGV4dDtcblx0XHRcdHRoaXMucmVzb2x2ZWQgJiYgdGhpcy5oYW5kbGVyLmpvaW4oKS5mYWlsKGMpO1xuXHRcdH07XG5cblx0XHRQZW5kaW5nLnByb3RvdHlwZS5fcmVwb3J0ID0gZnVuY3Rpb24oY29udGV4dCkge1xuXHRcdFx0dGhpcy5yZXNvbHZlZCAmJiB0aGlzLmhhbmRsZXIuam9pbigpLl9yZXBvcnQoY29udGV4dCk7XG5cdFx0fTtcblxuXHRcdFBlbmRpbmcucHJvdG90eXBlLl91bnJlcG9ydCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5yZXNvbHZlZCAmJiB0aGlzLmhhbmRsZXIuam9pbigpLl91bnJlcG9ydCgpO1xuXHRcdH07XG5cblx0XHQvKipcblx0XHQgKiBXcmFwIGFub3RoZXIgaGFuZGxlciBhbmQgZm9yY2UgaXQgaW50byBhIGZ1dHVyZSBzdGFja1xuXHRcdCAqIEBwYXJhbSB7b2JqZWN0fSBoYW5kbGVyXG5cdFx0ICogQGNvbnN0cnVjdG9yXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gQXN5bmMoaGFuZGxlcikge1xuXHRcdFx0dGhpcy5oYW5kbGVyID0gaGFuZGxlcjtcblx0XHR9XG5cblx0XHRpbmhlcml0KEhhbmRsZXIsIEFzeW5jKTtcblxuXHRcdEFzeW5jLnByb3RvdHlwZS53aGVuID0gZnVuY3Rpb24oY29udGludWF0aW9uKSB7XG5cdFx0XHR0YXNrcy5lbnF1ZXVlKG5ldyBDb250aW51YXRpb25UYXNrKGNvbnRpbnVhdGlvbiwgdGhpcykpO1xuXHRcdH07XG5cblx0XHRBc3luYy5wcm90b3R5cGUuX3JlcG9ydCA9IGZ1bmN0aW9uKGNvbnRleHQpIHtcblx0XHRcdHRoaXMuam9pbigpLl9yZXBvcnQoY29udGV4dCk7XG5cdFx0fTtcblxuXHRcdEFzeW5jLnByb3RvdHlwZS5fdW5yZXBvcnQgPSBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuam9pbigpLl91bnJlcG9ydCgpO1xuXHRcdH07XG5cblx0XHQvKipcblx0XHQgKiBIYW5kbGVyIHRoYXQgd3JhcHMgYW4gdW50cnVzdGVkIHRoZW5hYmxlIGFuZCBhc3NpbWlsYXRlcyBpdCBpbiBhIGZ1dHVyZSBzdGFja1xuXHRcdCAqIEBwYXJhbSB7ZnVuY3Rpb259IHRoZW5cblx0XHQgKiBAcGFyYW0ge3t0aGVuOiBmdW5jdGlvbn19IHRoZW5hYmxlXG5cdFx0ICogQGNvbnN0cnVjdG9yXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gVGhlbmFibGUodGhlbiwgdGhlbmFibGUpIHtcblx0XHRcdFBlbmRpbmcuY2FsbCh0aGlzKTtcblx0XHRcdHRhc2tzLmVucXVldWUobmV3IEFzc2ltaWxhdGVUYXNrKHRoZW4sIHRoZW5hYmxlLCB0aGlzKSk7XG5cdFx0fVxuXG5cdFx0aW5oZXJpdChQZW5kaW5nLCBUaGVuYWJsZSk7XG5cblx0XHQvKipcblx0XHQgKiBIYW5kbGVyIGZvciBhIGZ1bGZpbGxlZCBwcm9taXNlXG5cdFx0ICogQHBhcmFtIHsqfSB4IGZ1bGZpbGxtZW50IHZhbHVlXG5cdFx0ICogQGNvbnN0cnVjdG9yXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gRnVsZmlsbGVkKHgpIHtcblx0XHRcdFByb21pc2UuY3JlYXRlQ29udGV4dCh0aGlzKTtcblx0XHRcdHRoaXMudmFsdWUgPSB4O1xuXHRcdH1cblxuXHRcdGluaGVyaXQoSGFuZGxlciwgRnVsZmlsbGVkKTtcblxuXHRcdEZ1bGZpbGxlZC5wcm90b3R5cGUuX3N0YXRlID0gMTtcblxuXHRcdEZ1bGZpbGxlZC5wcm90b3R5cGUuZm9sZCA9IGZ1bmN0aW9uKGYsIHosIGMsIHRvKSB7XG5cdFx0XHRydW5Db250aW51YXRpb24zKGYsIHosIHRoaXMsIGMsIHRvKTtcblx0XHR9O1xuXG5cdFx0RnVsZmlsbGVkLnByb3RvdHlwZS53aGVuID0gZnVuY3Rpb24oY29udCkge1xuXHRcdFx0cnVuQ29udGludWF0aW9uMShjb250LmZ1bGZpbGxlZCwgdGhpcywgY29udC5yZWNlaXZlciwgY29udC5yZXNvbHZlcik7XG5cdFx0fTtcblxuXHRcdHZhciBlcnJvcklkID0gMDtcblxuXHRcdC8qKlxuXHRcdCAqIEhhbmRsZXIgZm9yIGEgcmVqZWN0ZWQgcHJvbWlzZVxuXHRcdCAqIEBwYXJhbSB7Kn0geCByZWplY3Rpb24gcmVhc29uXG5cdFx0ICogQGNvbnN0cnVjdG9yXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gUmVqZWN0ZWQoeCkge1xuXHRcdFx0UHJvbWlzZS5jcmVhdGVDb250ZXh0KHRoaXMpO1xuXG5cdFx0XHR0aGlzLmlkID0gKytlcnJvcklkO1xuXHRcdFx0dGhpcy52YWx1ZSA9IHg7XG5cdFx0XHR0aGlzLmhhbmRsZWQgPSBmYWxzZTtcblx0XHRcdHRoaXMucmVwb3J0ZWQgPSBmYWxzZTtcblxuXHRcdFx0dGhpcy5fcmVwb3J0KCk7XG5cdFx0fVxuXG5cdFx0aW5oZXJpdChIYW5kbGVyLCBSZWplY3RlZCk7XG5cblx0XHRSZWplY3RlZC5wcm90b3R5cGUuX3N0YXRlID0gLTE7XG5cblx0XHRSZWplY3RlZC5wcm90b3R5cGUuZm9sZCA9IGZ1bmN0aW9uKGYsIHosIGMsIHRvKSB7XG5cdFx0XHR0by5iZWNvbWUodGhpcyk7XG5cdFx0fTtcblxuXHRcdFJlamVjdGVkLnByb3RvdHlwZS53aGVuID0gZnVuY3Rpb24oY29udCkge1xuXHRcdFx0aWYodHlwZW9mIGNvbnQucmVqZWN0ZWQgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0dGhpcy5fdW5yZXBvcnQoKTtcblx0XHRcdH1cblx0XHRcdHJ1bkNvbnRpbnVhdGlvbjEoY29udC5yZWplY3RlZCwgdGhpcywgY29udC5yZWNlaXZlciwgY29udC5yZXNvbHZlcik7XG5cdFx0fTtcblxuXHRcdFJlamVjdGVkLnByb3RvdHlwZS5fcmVwb3J0ID0gZnVuY3Rpb24oY29udGV4dCkge1xuXHRcdFx0dGFza3MuYWZ0ZXJRdWV1ZShuZXcgUmVwb3J0VGFzayh0aGlzLCBjb250ZXh0KSk7XG5cdFx0fTtcblxuXHRcdFJlamVjdGVkLnByb3RvdHlwZS5fdW5yZXBvcnQgPSBmdW5jdGlvbigpIHtcblx0XHRcdGlmKHRoaXMuaGFuZGxlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmhhbmRsZWQgPSB0cnVlO1xuXHRcdFx0dGFza3MuYWZ0ZXJRdWV1ZShuZXcgVW5yZXBvcnRUYXNrKHRoaXMpKTtcblx0XHR9O1xuXG5cdFx0UmVqZWN0ZWQucHJvdG90eXBlLmZhaWwgPSBmdW5jdGlvbihjb250ZXh0KSB7XG5cdFx0XHR0aGlzLnJlcG9ydGVkID0gdHJ1ZTtcblx0XHRcdGVtaXRSZWplY3Rpb24oJ3VuaGFuZGxlZFJlamVjdGlvbicsIHRoaXMpO1xuXHRcdFx0UHJvbWlzZS5vbkZhdGFsUmVqZWN0aW9uKHRoaXMsIGNvbnRleHQgPT09IHZvaWQgMCA/IHRoaXMuY29udGV4dCA6IGNvbnRleHQpO1xuXHRcdH07XG5cblx0XHRmdW5jdGlvbiBSZXBvcnRUYXNrKHJlamVjdGlvbiwgY29udGV4dCkge1xuXHRcdFx0dGhpcy5yZWplY3Rpb24gPSByZWplY3Rpb247XG5cdFx0XHR0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuXHRcdH1cblxuXHRcdFJlcG9ydFRhc2sucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYoIXRoaXMucmVqZWN0aW9uLmhhbmRsZWQgJiYgIXRoaXMucmVqZWN0aW9uLnJlcG9ydGVkKSB7XG5cdFx0XHRcdHRoaXMucmVqZWN0aW9uLnJlcG9ydGVkID0gdHJ1ZTtcblx0XHRcdFx0ZW1pdFJlamVjdGlvbigndW5oYW5kbGVkUmVqZWN0aW9uJywgdGhpcy5yZWplY3Rpb24pIHx8XG5cdFx0XHRcdFx0UHJvbWlzZS5vblBvdGVudGlhbGx5VW5oYW5kbGVkUmVqZWN0aW9uKHRoaXMucmVqZWN0aW9uLCB0aGlzLmNvbnRleHQpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRmdW5jdGlvbiBVbnJlcG9ydFRhc2socmVqZWN0aW9uKSB7XG5cdFx0XHR0aGlzLnJlamVjdGlvbiA9IHJlamVjdGlvbjtcblx0XHR9XG5cblx0XHRVbnJlcG9ydFRhc2sucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYodGhpcy5yZWplY3Rpb24ucmVwb3J0ZWQpIHtcblx0XHRcdFx0ZW1pdFJlamVjdGlvbigncmVqZWN0aW9uSGFuZGxlZCcsIHRoaXMucmVqZWN0aW9uKSB8fFxuXHRcdFx0XHRcdFByb21pc2Uub25Qb3RlbnRpYWxseVVuaGFuZGxlZFJlamVjdGlvbkhhbmRsZWQodGhpcy5yZWplY3Rpb24pO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHQvLyBVbmhhbmRsZWQgcmVqZWN0aW9uIGhvb2tzXG5cdFx0Ly8gQnkgZGVmYXVsdCwgZXZlcnl0aGluZyBpcyBhIG5vb3BcblxuXHRcdFByb21pc2UuY3JlYXRlQ29udGV4dFxuXHRcdFx0PSBQcm9taXNlLmVudGVyQ29udGV4dFxuXHRcdFx0PSBQcm9taXNlLmV4aXRDb250ZXh0XG5cdFx0XHQ9IFByb21pc2Uub25Qb3RlbnRpYWxseVVuaGFuZGxlZFJlamVjdGlvblxuXHRcdFx0PSBQcm9taXNlLm9uUG90ZW50aWFsbHlVbmhhbmRsZWRSZWplY3Rpb25IYW5kbGVkXG5cdFx0XHQ9IFByb21pc2Uub25GYXRhbFJlamVjdGlvblxuXHRcdFx0PSBub29wO1xuXG5cdFx0Ly8gRXJyb3JzIGFuZCBzaW5nbGV0b25zXG5cblx0XHR2YXIgZm9yZXZlclBlbmRpbmdIYW5kbGVyID0gbmV3IEhhbmRsZXIoKTtcblx0XHR2YXIgZm9yZXZlclBlbmRpbmdQcm9taXNlID0gbmV3IFByb21pc2UoSGFuZGxlciwgZm9yZXZlclBlbmRpbmdIYW5kbGVyKTtcblxuXHRcdGZ1bmN0aW9uIGN5Y2xlKCkge1xuXHRcdFx0cmV0dXJuIG5ldyBSZWplY3RlZChuZXcgVHlwZUVycm9yKCdQcm9taXNlIGN5Y2xlJykpO1xuXHRcdH1cblxuXHRcdC8vIFRhc2sgcnVubmVyc1xuXG5cdFx0LyoqXG5cdFx0ICogUnVuIGEgc2luZ2xlIGNvbnN1bWVyXG5cdFx0ICogQGNvbnN0cnVjdG9yXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gQ29udGludWF0aW9uVGFzayhjb250aW51YXRpb24sIGhhbmRsZXIpIHtcblx0XHRcdHRoaXMuY29udGludWF0aW9uID0gY29udGludWF0aW9uO1xuXHRcdFx0dGhpcy5oYW5kbGVyID0gaGFuZGxlcjtcblx0XHR9XG5cblx0XHRDb250aW51YXRpb25UYXNrLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuaGFuZGxlci5qb2luKCkud2hlbih0aGlzLmNvbnRpbnVhdGlvbik7XG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdCAqIFJ1biBhIHF1ZXVlIG9mIHByb2dyZXNzIGhhbmRsZXJzXG5cdFx0ICogQGNvbnN0cnVjdG9yXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gUHJvZ3Jlc3NUYXNrKHZhbHVlLCBoYW5kbGVyKSB7XG5cdFx0XHR0aGlzLmhhbmRsZXIgPSBoYW5kbGVyO1xuXHRcdFx0dGhpcy52YWx1ZSA9IHZhbHVlO1xuXHRcdH1cblxuXHRcdFByb2dyZXNzVGFzay5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgcSA9IHRoaXMuaGFuZGxlci5jb25zdW1lcnM7XG5cdFx0XHRpZihxID09PSB2b2lkIDApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKHZhciBjLCBpID0gMDsgaSA8IHEubGVuZ3RoOyArK2kpIHtcblx0XHRcdFx0YyA9IHFbaV07XG5cdFx0XHRcdHJ1bk5vdGlmeShjLnByb2dyZXNzLCB0aGlzLnZhbHVlLCB0aGlzLmhhbmRsZXIsIGMucmVjZWl2ZXIsIGMucmVzb2x2ZXIpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHQvKipcblx0XHQgKiBBc3NpbWlsYXRlIGEgdGhlbmFibGUsIHNlbmRpbmcgaXQncyB2YWx1ZSB0byByZXNvbHZlclxuXHRcdCAqIEBwYXJhbSB7ZnVuY3Rpb259IHRoZW5cblx0XHQgKiBAcGFyYW0ge29iamVjdHxmdW5jdGlvbn0gdGhlbmFibGVcblx0XHQgKiBAcGFyYW0ge29iamVjdH0gcmVzb2x2ZXJcblx0XHQgKiBAY29uc3RydWN0b3Jcblx0XHQgKi9cblx0XHRmdW5jdGlvbiBBc3NpbWlsYXRlVGFzayh0aGVuLCB0aGVuYWJsZSwgcmVzb2x2ZXIpIHtcblx0XHRcdHRoaXMuX3RoZW4gPSB0aGVuO1xuXHRcdFx0dGhpcy50aGVuYWJsZSA9IHRoZW5hYmxlO1xuXHRcdFx0dGhpcy5yZXNvbHZlciA9IHJlc29sdmVyO1xuXHRcdH1cblxuXHRcdEFzc2ltaWxhdGVUYXNrLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBoID0gdGhpcy5yZXNvbHZlcjtcblx0XHRcdHRyeUFzc2ltaWxhdGUodGhpcy5fdGhlbiwgdGhpcy50aGVuYWJsZSwgX3Jlc29sdmUsIF9yZWplY3QsIF9ub3RpZnkpO1xuXG5cdFx0XHRmdW5jdGlvbiBfcmVzb2x2ZSh4KSB7IGgucmVzb2x2ZSh4KTsgfVxuXHRcdFx0ZnVuY3Rpb24gX3JlamVjdCh4KSAgeyBoLnJlamVjdCh4KTsgfVxuXHRcdFx0ZnVuY3Rpb24gX25vdGlmeSh4KSAgeyBoLm5vdGlmeSh4KTsgfVxuXHRcdH07XG5cblx0XHRmdW5jdGlvbiB0cnlBc3NpbWlsYXRlKHRoZW4sIHRoZW5hYmxlLCByZXNvbHZlLCByZWplY3QsIG5vdGlmeSkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dGhlbi5jYWxsKHRoZW5hYmxlLCByZXNvbHZlLCByZWplY3QsIG5vdGlmeSk7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdHJlamVjdChlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBGb2xkIGEgaGFuZGxlciB2YWx1ZSB3aXRoIHpcblx0XHQgKiBAY29uc3RydWN0b3Jcblx0XHQgKi9cblx0XHRmdW5jdGlvbiBGb2xkKGYsIHosIGMsIHRvKSB7XG5cdFx0XHR0aGlzLmYgPSBmOyB0aGlzLnogPSB6OyB0aGlzLmMgPSBjOyB0aGlzLnRvID0gdG87XG5cdFx0XHR0aGlzLnJlc29sdmVyID0gZmFpbElmUmVqZWN0ZWQ7XG5cdFx0XHR0aGlzLnJlY2VpdmVyID0gdGhpcztcblx0XHR9XG5cblx0XHRGb2xkLnByb3RvdHlwZS5mdWxmaWxsZWQgPSBmdW5jdGlvbih4KSB7XG5cdFx0XHR0aGlzLmYuY2FsbCh0aGlzLmMsIHRoaXMueiwgeCwgdGhpcy50byk7XG5cdFx0fTtcblxuXHRcdEZvbGQucHJvdG90eXBlLnJlamVjdGVkID0gZnVuY3Rpb24oeCkge1xuXHRcdFx0dGhpcy50by5yZWplY3QoeCk7XG5cdFx0fTtcblxuXHRcdEZvbGQucHJvdG90eXBlLnByb2dyZXNzID0gZnVuY3Rpb24oeCkge1xuXHRcdFx0dGhpcy50by5ub3RpZnkoeCk7XG5cdFx0fTtcblxuXHRcdC8vIE90aGVyIGhlbHBlcnNcblxuXHRcdC8qKlxuXHRcdCAqIEBwYXJhbSB7Kn0geFxuXHRcdCAqIEByZXR1cm5zIHtib29sZWFufSB0cnVlIGlmZiB4IGlzIGEgdHJ1c3RlZCBQcm9taXNlXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaXNQcm9taXNlKHgpIHtcblx0XHRcdHJldHVybiB4IGluc3RhbmNlb2YgUHJvbWlzZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBUZXN0IGp1c3QgZW5vdWdoIHRvIHJ1bGUgb3V0IHByaW1pdGl2ZXMsIGluIG9yZGVyIHRvIHRha2UgZmFzdGVyXG5cdFx0ICogcGF0aHMgaW4gc29tZSBjb2RlXG5cdFx0ICogQHBhcmFtIHsqfSB4XG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59IGZhbHNlIGlmZiB4IGlzIGd1YXJhbnRlZWQgKm5vdCogdG8gYmUgYSB0aGVuYWJsZVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG1heWJlVGhlbmFibGUoeCkge1xuXHRcdFx0cmV0dXJuICh0eXBlb2YgeCA9PT0gJ29iamVjdCcgfHwgdHlwZW9mIHggPT09ICdmdW5jdGlvbicpICYmIHggIT09IG51bGw7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gcnVuQ29udGludWF0aW9uMShmLCBoLCByZWNlaXZlciwgbmV4dCkge1xuXHRcdFx0aWYodHlwZW9mIGYgIT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0cmV0dXJuIG5leHQuYmVjb21lKGgpO1xuXHRcdFx0fVxuXG5cdFx0XHRQcm9taXNlLmVudGVyQ29udGV4dChoKTtcblx0XHRcdHRyeUNhdGNoUmVqZWN0KGYsIGgudmFsdWUsIHJlY2VpdmVyLCBuZXh0KTtcblx0XHRcdFByb21pc2UuZXhpdENvbnRleHQoKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBydW5Db250aW51YXRpb24zKGYsIHgsIGgsIHJlY2VpdmVyLCBuZXh0KSB7XG5cdFx0XHRpZih0eXBlb2YgZiAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHRyZXR1cm4gbmV4dC5iZWNvbWUoaCk7XG5cdFx0XHR9XG5cblx0XHRcdFByb21pc2UuZW50ZXJDb250ZXh0KGgpO1xuXHRcdFx0dHJ5Q2F0Y2hSZWplY3QzKGYsIHgsIGgudmFsdWUsIHJlY2VpdmVyLCBuZXh0KTtcblx0XHRcdFByb21pc2UuZXhpdENvbnRleHQoKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBAZGVwcmVjYXRlZFxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJ1bk5vdGlmeShmLCB4LCBoLCByZWNlaXZlciwgbmV4dCkge1xuXHRcdFx0aWYodHlwZW9mIGYgIT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0cmV0dXJuIG5leHQubm90aWZ5KHgpO1xuXHRcdFx0fVxuXG5cdFx0XHRQcm9taXNlLmVudGVyQ29udGV4dChoKTtcblx0XHRcdHRyeUNhdGNoUmV0dXJuKGYsIHgsIHJlY2VpdmVyLCBuZXh0KTtcblx0XHRcdFByb21pc2UuZXhpdENvbnRleHQoKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiB0cnlDYXRjaDIoZiwgYSwgYikge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0cmV0dXJuIGYoYSwgYik7XG5cdFx0XHR9IGNhdGNoKGUpIHtcblx0XHRcdFx0cmV0dXJuIHJlamVjdChlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gZi5jYWxsKHRoaXNBcmcsIHgpLCBvciBpZiBpdCB0aHJvd3MgcmV0dXJuIGEgcmVqZWN0ZWQgcHJvbWlzZSBmb3Jcblx0XHQgKiB0aGUgdGhyb3duIGV4Y2VwdGlvblxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHRyeUNhdGNoUmVqZWN0KGYsIHgsIHRoaXNBcmcsIG5leHQpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdG5leHQuYmVjb21lKGdldEhhbmRsZXIoZi5jYWxsKHRoaXNBcmcsIHgpKSk7XG5cdFx0XHR9IGNhdGNoKGUpIHtcblx0XHRcdFx0bmV4dC5iZWNvbWUobmV3IFJlamVjdGVkKGUpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTYW1lIGFzIGFib3ZlLCBidXQgaW5jbHVkZXMgdGhlIGV4dHJhIGFyZ3VtZW50IHBhcmFtZXRlci5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiB0cnlDYXRjaFJlamVjdDMoZiwgeCwgeSwgdGhpc0FyZywgbmV4dCkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Zi5jYWxsKHRoaXNBcmcsIHgsIHksIG5leHQpO1xuXHRcdFx0fSBjYXRjaChlKSB7XG5cdFx0XHRcdG5leHQuYmVjb21lKG5ldyBSZWplY3RlZChlKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQGRlcHJlY2F0ZWRcblx0XHQgKiBSZXR1cm4gZi5jYWxsKHRoaXNBcmcsIHgpLCBvciBpZiBpdCB0aHJvd3MsICpyZXR1cm4qIHRoZSBleGNlcHRpb25cblx0XHQgKi9cblx0XHRmdW5jdGlvbiB0cnlDYXRjaFJldHVybihmLCB4LCB0aGlzQXJnLCBuZXh0KSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRuZXh0Lm5vdGlmeShmLmNhbGwodGhpc0FyZywgeCkpO1xuXHRcdFx0fSBjYXRjaChlKSB7XG5cdFx0XHRcdG5leHQubm90aWZ5KGUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGluaGVyaXQoUGFyZW50LCBDaGlsZCkge1xuXHRcdFx0Q2hpbGQucHJvdG90eXBlID0gb2JqZWN0Q3JlYXRlKFBhcmVudC5wcm90b3R5cGUpO1xuXHRcdFx0Q2hpbGQucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gQ2hpbGQ7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gc25kKHgsIHkpIHtcblx0XHRcdHJldHVybiB5O1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5cdFx0ZnVuY3Rpb24gaW5pdEVtaXRSZWplY3Rpb24oKSB7XG5cdFx0XHQvKmdsb2JhbCBwcm9jZXNzLCBzZWxmLCBDdXN0b21FdmVudCovXG5cdFx0XHRpZih0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcgJiYgcHJvY2VzcyAhPT0gbnVsbFxuXHRcdFx0XHQmJiB0eXBlb2YgcHJvY2Vzcy5lbWl0ID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRcdC8vIFJldHVybmluZyBmYWxzeSBoZXJlIG1lYW5zIHRvIGNhbGwgdGhlIGRlZmF1bHRcblx0XHRcdFx0Ly8gb25Qb3RlbnRpYWxseVVuaGFuZGxlZFJlamVjdGlvbiBBUEkuICBUaGlzIGlzIHNhZmUgZXZlbiBpblxuXHRcdFx0XHQvLyBicm93c2VyaWZ5IHNpbmNlIHByb2Nlc3MuZW1pdCBhbHdheXMgcmV0dXJucyBmYWxzeSBpbiBicm93c2VyaWZ5OlxuXHRcdFx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vZGVmdW5jdHpvbWJpZS9ub2RlLXByb2Nlc3MvYmxvYi9tYXN0ZXIvYnJvd3Nlci5qcyNMNDAtTDQ2XG5cdFx0XHRcdHJldHVybiBmdW5jdGlvbih0eXBlLCByZWplY3Rpb24pIHtcblx0XHRcdFx0XHRyZXR1cm4gdHlwZSA9PT0gJ3VuaGFuZGxlZFJlamVjdGlvbidcblx0XHRcdFx0XHRcdD8gcHJvY2Vzcy5lbWl0KHR5cGUsIHJlamVjdGlvbi52YWx1ZSwgcmVqZWN0aW9uKVxuXHRcdFx0XHRcdFx0OiBwcm9jZXNzLmVtaXQodHlwZSwgcmVqZWN0aW9uKTtcblx0XHRcdFx0fTtcblx0XHRcdH0gZWxzZSBpZih0eXBlb2Ygc2VsZiAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIEN1c3RvbUV2ZW50ID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRcdHJldHVybiAoZnVuY3Rpb24obm9vcCwgc2VsZiwgQ3VzdG9tRXZlbnQpIHtcblx0XHRcdFx0XHR2YXIgaGFzQ3VzdG9tRXZlbnQgPSBmYWxzZTtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0dmFyIGV2ID0gbmV3IEN1c3RvbUV2ZW50KCd1bmhhbmRsZWRSZWplY3Rpb24nKTtcblx0XHRcdFx0XHRcdGhhc0N1c3RvbUV2ZW50ID0gZXYgaW5zdGFuY2VvZiBDdXN0b21FdmVudDtcblx0XHRcdFx0XHR9IGNhdGNoIChlKSB7fVxuXG5cdFx0XHRcdFx0cmV0dXJuICFoYXNDdXN0b21FdmVudCA/IG5vb3AgOiBmdW5jdGlvbih0eXBlLCByZWplY3Rpb24pIHtcblx0XHRcdFx0XHRcdHZhciBldiA9IG5ldyBDdXN0b21FdmVudCh0eXBlLCB7XG5cdFx0XHRcdFx0XHRcdGRldGFpbDoge1xuXHRcdFx0XHRcdFx0XHRcdHJlYXNvbjogcmVqZWN0aW9uLnZhbHVlLFxuXHRcdFx0XHRcdFx0XHRcdGtleTogcmVqZWN0aW9uXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdGJ1YmJsZXM6IGZhbHNlLFxuXHRcdFx0XHRcdFx0XHRjYW5jZWxhYmxlOiB0cnVlXG5cdFx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdFx0cmV0dXJuICFzZWxmLmRpc3BhdGNoRXZlbnQoZXYpO1xuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0obm9vcCwgc2VsZiwgQ3VzdG9tRXZlbnQpKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIG5vb3A7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFByb21pc2U7XG5cdH07XG59KTtcbn0odHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kID8gZGVmaW5lIDogZnVuY3Rpb24oZmFjdG9yeSkgeyBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKTsgfSkpO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZSgnX3Byb2Nlc3MnKSkiLCIvKiogQGxpY2Vuc2UgTUlUIExpY2Vuc2UgKGMpIGNvcHlyaWdodCAyMDEwLTIwMTQgb3JpZ2luYWwgYXV0aG9yIG9yIGF1dGhvcnMgKi9cbi8qKiBAYXV0aG9yIEJyaWFuIENhdmFsaWVyICovXG4vKiogQGF1dGhvciBKb2huIEhhbm4gKi9cblxuKGZ1bmN0aW9uKGRlZmluZSkgeyAndXNlIHN0cmljdCc7XG5kZWZpbmUoZnVuY3Rpb24oKSB7XG5cblx0cmV0dXJuIHtcblx0XHRwZW5kaW5nOiB0b1BlbmRpbmdTdGF0ZSxcblx0XHRmdWxmaWxsZWQ6IHRvRnVsZmlsbGVkU3RhdGUsXG5cdFx0cmVqZWN0ZWQ6IHRvUmVqZWN0ZWRTdGF0ZSxcblx0XHRpbnNwZWN0OiBpbnNwZWN0XG5cdH07XG5cblx0ZnVuY3Rpb24gdG9QZW5kaW5nU3RhdGUoKSB7XG5cdFx0cmV0dXJuIHsgc3RhdGU6ICdwZW5kaW5nJyB9O1xuXHR9XG5cblx0ZnVuY3Rpb24gdG9SZWplY3RlZFN0YXRlKGUpIHtcblx0XHRyZXR1cm4geyBzdGF0ZTogJ3JlamVjdGVkJywgcmVhc29uOiBlIH07XG5cdH1cblxuXHRmdW5jdGlvbiB0b0Z1bGZpbGxlZFN0YXRlKHgpIHtcblx0XHRyZXR1cm4geyBzdGF0ZTogJ2Z1bGZpbGxlZCcsIHZhbHVlOiB4IH07XG5cdH1cblxuXHRmdW5jdGlvbiBpbnNwZWN0KGhhbmRsZXIpIHtcblx0XHR2YXIgc3RhdGUgPSBoYW5kbGVyLnN0YXRlKCk7XG5cdFx0cmV0dXJuIHN0YXRlID09PSAwID8gdG9QZW5kaW5nU3RhdGUoKVxuXHRcdFx0IDogc3RhdGUgPiAwICAgPyB0b0Z1bGZpbGxlZFN0YXRlKGhhbmRsZXIudmFsdWUpXG5cdFx0XHQgICAgICAgICAgICAgICA6IHRvUmVqZWN0ZWRTdGF0ZShoYW5kbGVyLnZhbHVlKTtcblx0fVxuXG59KTtcbn0odHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kID8gZGVmaW5lIDogZnVuY3Rpb24oZmFjdG9yeSkgeyBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKTsgfSkpO1xuIiwiLyoqIEBsaWNlbnNlIE1JVCBMaWNlbnNlIChjKSBjb3B5cmlnaHQgMjAxMC0yMDE0IG9yaWdpbmFsIGF1dGhvciBvciBhdXRob3JzICovXG4vKiogQGF1dGhvciBCcmlhbiBDYXZhbGllciAqL1xuLyoqIEBhdXRob3IgSm9obiBIYW5uICovXG5cbihmdW5jdGlvbihkZWZpbmUpIHsgJ3VzZSBzdHJpY3QnO1xuZGVmaW5lKGZ1bmN0aW9uKHJlcXVpcmUpIHtcblxuXHR2YXIgUHJvbWlzZU1vbml0b3IgPSByZXF1aXJlKCcuL21vbml0b3IvUHJvbWlzZU1vbml0b3InKTtcblx0dmFyIENvbnNvbGVSZXBvcnRlciA9IHJlcXVpcmUoJy4vbW9uaXRvci9Db25zb2xlUmVwb3J0ZXInKTtcblxuXHR2YXIgcHJvbWlzZU1vbml0b3IgPSBuZXcgUHJvbWlzZU1vbml0b3IobmV3IENvbnNvbGVSZXBvcnRlcigpKTtcblxuXHRyZXR1cm4gZnVuY3Rpb24oUHJvbWlzZSkge1xuXHRcdHJldHVybiBwcm9taXNlTW9uaXRvci5tb25pdG9yKFByb21pc2UpO1xuXHR9O1xufSk7XG59KHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCA/IGRlZmluZSA6IGZ1bmN0aW9uKGZhY3RvcnkpIHsgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KHJlcXVpcmUpOyB9KSk7XG4iLCIvKiogQGxpY2Vuc2UgTUlUIExpY2Vuc2UgKGMpIGNvcHlyaWdodCAyMDEwLTIwMTQgb3JpZ2luYWwgYXV0aG9yIG9yIGF1dGhvcnMgKi9cbi8qKiBAYXV0aG9yIEJyaWFuIENhdmFsaWVyICovXG4vKiogQGF1dGhvciBKb2huIEhhbm4gKi9cblxuKGZ1bmN0aW9uKGRlZmluZSkgeyAndXNlIHN0cmljdCc7XG5kZWZpbmUoZnVuY3Rpb24ocmVxdWlyZSkge1xuXG5cdHZhciBlcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKTtcblx0dmFyIHVuaGFuZGxlZFJlamVjdGlvbnNNc2cgPSAnW3Byb21pc2VzXSBVbmhhbmRsZWQgcmVqZWN0aW9uczogJztcblx0dmFyIGFsbEhhbmRsZWRNc2cgPSAnW3Byb21pc2VzXSBBbGwgcHJldmlvdXNseSB1bmhhbmRsZWQgcmVqZWN0aW9ucyBoYXZlIG5vdyBiZWVuIGhhbmRsZWQnO1xuXG5cdGZ1bmN0aW9uIENvbnNvbGVSZXBvcnRlcigpIHtcblx0XHR0aGlzLl9wcmV2aW91c2x5UmVwb3J0ZWQgPSBmYWxzZTtcblx0fVxuXG5cdENvbnNvbGVSZXBvcnRlci5wcm90b3R5cGUgPSBpbml0RGVmYXVsdExvZ2dpbmcoKTtcblxuXHRDb25zb2xlUmVwb3J0ZXIucHJvdG90eXBlLmxvZyA9IGZ1bmN0aW9uKHRyYWNlcykge1xuXHRcdGlmKHRyYWNlcy5sZW5ndGggPT09IDApIHtcblx0XHRcdGlmKHRoaXMuX3ByZXZpb3VzbHlSZXBvcnRlZCkge1xuXHRcdFx0XHR0aGlzLl9wcmV2aW91c2x5UmVwb3J0ZWQgPSBmYWxzZTtcblx0XHRcdFx0dGhpcy5tc2coYWxsSGFuZGxlZE1zZyk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fcHJldmlvdXNseVJlcG9ydGVkID0gdHJ1ZTtcblx0XHR0aGlzLmdyb3VwU3RhcnQodW5oYW5kbGVkUmVqZWN0aW9uc01zZyArIHRyYWNlcy5sZW5ndGgpO1xuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLl9sb2codHJhY2VzKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy5ncm91cEVuZCgpO1xuXHRcdH1cblx0fTtcblxuXHRDb25zb2xlUmVwb3J0ZXIucHJvdG90eXBlLl9sb2cgPSBmdW5jdGlvbih0cmFjZXMpIHtcblx0XHRmb3IodmFyIGk9MDsgaTx0cmFjZXMubGVuZ3RoOyArK2kpIHtcblx0XHRcdHRoaXMud2FybihlcnJvci5mb3JtYXQodHJhY2VzW2ldKSk7XG5cdFx0fVxuXHR9O1xuXG5cdGZ1bmN0aW9uIGluaXREZWZhdWx0TG9nZ2luZygpIHtcblx0XHQvKmpzaGludCBtYXhjb21wbGV4aXR5OjcqL1xuXHRcdHZhciBsb2csIHdhcm4sIGdyb3VwU3RhcnQsIGdyb3VwRW5kO1xuXG5cdFx0aWYodHlwZW9mIGNvbnNvbGUgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRsb2cgPSB3YXJuID0gY29uc29sZU5vdEF2YWlsYWJsZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gQWxpYXMgY29uc29sZSB0byBwcmV2ZW50IHRoaW5ncyBsaWtlIHVnbGlmeSdzIGRyb3BfY29uc29sZSBvcHRpb24gZnJvbVxuXHRcdFx0Ly8gcmVtb3ZpbmcgY29uc29sZS5sb2cvZXJyb3IuIFVuaGFuZGxlZCByZWplY3Rpb25zIGZhbGwgaW50byB0aGUgc2FtZVxuXHRcdFx0Ly8gY2F0ZWdvcnkgYXMgdW5jYXVnaHQgZXhjZXB0aW9ucywgYW5kIGJ1aWxkIHRvb2xzIHNob3VsZG4ndCBzaWxlbmNlIHRoZW0uXG5cdFx0XHR2YXIgbG9jYWxDb25zb2xlID0gY29uc29sZTtcblx0XHRcdGlmKHR5cGVvZiBsb2NhbENvbnNvbGUuZXJyb3IgPT09ICdmdW5jdGlvbidcblx0XHRcdFx0JiYgdHlwZW9mIGxvY2FsQ29uc29sZS5kaXIgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0d2FybiA9IGZ1bmN0aW9uKHMpIHtcblx0XHRcdFx0XHRsb2NhbENvbnNvbGUuZXJyb3Iocyk7XG5cdFx0XHRcdH07XG5cblx0XHRcdFx0bG9nID0gZnVuY3Rpb24ocykge1xuXHRcdFx0XHRcdGxvY2FsQ29uc29sZS5sb2cocyk7XG5cdFx0XHRcdH07XG5cblx0XHRcdFx0aWYodHlwZW9mIGxvY2FsQ29uc29sZS5ncm91cENvbGxhcHNlZCA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHRcdGdyb3VwU3RhcnQgPSBmdW5jdGlvbihzKSB7XG5cdFx0XHRcdFx0XHRsb2NhbENvbnNvbGUuZ3JvdXBDb2xsYXBzZWQocyk7XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRncm91cEVuZCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0bG9jYWxDb25zb2xlLmdyb3VwRW5kKCk7XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gSUU4IGhhcyBjb25zb2xlLmxvZyBhbmQgSlNPTiwgc28gd2UgY2FuIG1ha2UgYVxuXHRcdFx0XHQvLyByZWFzb25hYmx5IHVzZWZ1bCB3YXJuKCkgZnJvbSB0aG9zZS5cblx0XHRcdFx0Ly8gQ3JlZGl0IHRvIHdlYnBybyAoaHR0cHM6Ly9naXRodWIuY29tL3dlYnBybykgZm9yIHRoaXMgaWRlYVxuXHRcdFx0XHQvLyB0eXBlb2YgbG9jYWxDb25zb2xlLmxvZyB3aWxsIHJldHVybiAnb2JqZWN0JyBpbiBJRTgsIHNvIGNhbid0IHRlc3QgaXQgd2l0aCA9PT0gJ2Z1bmN0aW9uJ1xuXHRcdFx0XHQvLyBTaW5jZSB0aGlzIGlzIG1vcmUgb2YgYSBjb3JuZXIgY2FzZSBmb3IgSUU4LCBJJ20gb2sgdG8gY2hlY2sgaXQgd2l0aCAhPT0gJ3VuZGVmaW5lZCcgdG8gcmVkdWNlIGNvbXBsZXhpdHlcblx0XHRcdFx0aWYgKHR5cGVvZiBsb2NhbENvbnNvbGUubG9nICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgSlNPTiAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdFx0XHRsb2cgPSB3YXJuID0gZnVuY3Rpb24oeCkge1xuXHRcdFx0XHRcdFx0aWYgKHR5cGVvZiB4ICE9PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0XHRcdHggPSBKU09OLnN0cmluZ2lmeSh4KTtcblx0XHRcdFx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRsb2NhbENvbnNvbGUubG9nKHgpO1xuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bG9nID0gd2FybiA9IGNvbnNvbGVOb3RBdmFpbGFibGU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0bXNnOiBsb2csXG5cdFx0XHR3YXJuOiB3YXJuLFxuXHRcdFx0Z3JvdXBTdGFydDogZ3JvdXBTdGFydCB8fCB3YXJuLFxuXHRcdFx0Z3JvdXBFbmQ6IGdyb3VwRW5kIHx8IGNvbnNvbGVOb3RBdmFpbGFibGVcblx0XHR9O1xuXHR9XG5cblx0ZnVuY3Rpb24gY29uc29sZU5vdEF2YWlsYWJsZSgpIHt9XG5cblx0cmV0dXJuIENvbnNvbGVSZXBvcnRlcjtcblxufSk7XG59KHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCA/IGRlZmluZSA6IGZ1bmN0aW9uKGZhY3RvcnkpIHsgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KHJlcXVpcmUpOyB9KSk7XG4iLCIvKiogQGxpY2Vuc2UgTUlUIExpY2Vuc2UgKGMpIGNvcHlyaWdodCAyMDEwLTIwMTQgb3JpZ2luYWwgYXV0aG9yIG9yIGF1dGhvcnMgKi9cbi8qKiBAYXV0aG9yIEJyaWFuIENhdmFsaWVyICovXG4vKiogQGF1dGhvciBKb2huIEhhbm4gKi9cblxuKGZ1bmN0aW9uKGRlZmluZSkgeyAndXNlIHN0cmljdCc7XG5kZWZpbmUoZnVuY3Rpb24ocmVxdWlyZSkge1xuXG5cdHZhciBkZWZhdWx0U3RhY2tKdW1wU2VwYXJhdG9yID0gJ2Zyb20gZXhlY3V0aW9uIGNvbnRleHQ6Jztcblx0dmFyIGRlZmF1bHRTdGFja0ZpbHRlciA9IC9bXFxzXFwoXFwvXFxcXF0obm9kZXxtb2R1bGV8dGltZXJzKVxcLmpzOnx3aGVuKFtcXC9cXFxcXXsxLDJ9KGxpYnxtb25pdG9yfGVzNi1zaGltKVtcXC9cXFxcXXsxLDJ9fFxcLmpzKXwobmV3XFxzUHJvbWlzZSlcXGJ8KFxcYihQcm9taXNlTW9uaXRvcnxDb25zb2xlUmVwb3J0ZXJ8U2NoZWR1bGVyfFJ1bkhhbmRsZXJUYXNrfFByb2dyZXNzVGFza3xQcm9taXNlfC4qSGFuZGxlcilcXC5bXFx3X11cXHdcXHcrXFxiKXxcXGIodHJ5Q2F0Y2hcXHcrfGdldEhhbmRsZXJcXHcqKVxcYi9pO1xuXG5cdHZhciBzZXRUaW1lciA9IHJlcXVpcmUoJy4uL2xpYi9lbnYnKS5zZXRUaW1lcjtcblx0dmFyIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpO1xuXG5cdHZhciBleGVjdXRpb25Db250ZXh0ID0gW107XG5cblx0ZnVuY3Rpb24gUHJvbWlzZU1vbml0b3IocmVwb3J0ZXIpIHtcblx0XHR0aGlzLmxvZ0RlbGF5ID0gMDtcblx0XHR0aGlzLnN0YWNrRmlsdGVyID0gZGVmYXVsdFN0YWNrRmlsdGVyO1xuXHRcdHRoaXMuc3RhY2tKdW1wU2VwYXJhdG9yID0gZGVmYXVsdFN0YWNrSnVtcFNlcGFyYXRvcjtcblx0XHR0aGlzLmZpbHRlckR1cGxpY2F0ZUZyYW1lcyA9IHRydWU7XG5cblx0XHR0aGlzLl9yZXBvcnRlciA9IHJlcG9ydGVyO1xuXHRcdGlmKHR5cGVvZiByZXBvcnRlci5jb25maWd1cmVQcm9taXNlTW9uaXRvciA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0cmVwb3J0ZXIuY29uZmlndXJlUHJvbWlzZU1vbml0b3IodGhpcyk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fdHJhY2VzID0gW107XG5cdFx0dGhpcy5fdHJhY2VUYXNrID0gMDtcblxuXHRcdHZhciBzZWxmID0gdGhpcztcblx0XHR0aGlzLl9kb0xvZ1RyYWNlcyA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0c2VsZi5fbG9nVHJhY2VzKCk7XG5cdFx0fTtcblx0fVxuXG5cdFByb21pc2VNb25pdG9yLnByb3RvdHlwZS5tb25pdG9yID0gZnVuY3Rpb24oUHJvbWlzZSkge1xuXHRcdHZhciBzZWxmID0gdGhpcztcblx0XHRQcm9taXNlLmNyZWF0ZUNvbnRleHQgPSBmdW5jdGlvbihwLCBjb250ZXh0KSB7XG5cdFx0XHRwLmNvbnRleHQgPSBzZWxmLmNyZWF0ZUNvbnRleHQocCwgY29udGV4dCk7XG5cdFx0fTtcblxuXHRcdFByb21pc2UuZW50ZXJDb250ZXh0ID0gZnVuY3Rpb24ocCkge1xuXHRcdFx0ZXhlY3V0aW9uQ29udGV4dC5wdXNoKHAuY29udGV4dCk7XG5cdFx0fTtcblxuXHRcdFByb21pc2UuZXhpdENvbnRleHQgPSBmdW5jdGlvbigpIHtcblx0XHRcdGV4ZWN1dGlvbkNvbnRleHQucG9wKCk7XG5cdFx0fTtcblxuXHRcdFByb21pc2Uub25Qb3RlbnRpYWxseVVuaGFuZGxlZFJlamVjdGlvbiA9IGZ1bmN0aW9uKHJlamVjdGlvbiwgZXh0cmFDb250ZXh0KSB7XG5cdFx0XHRyZXR1cm4gc2VsZi5hZGRUcmFjZShyZWplY3Rpb24sIGV4dHJhQ29udGV4dCk7XG5cdFx0fTtcblxuXHRcdFByb21pc2Uub25Qb3RlbnRpYWxseVVuaGFuZGxlZFJlamVjdGlvbkhhbmRsZWQgPSBmdW5jdGlvbihyZWplY3Rpb24pIHtcblx0XHRcdHJldHVybiBzZWxmLnJlbW92ZVRyYWNlKHJlamVjdGlvbik7XG5cdFx0fTtcblxuXHRcdFByb21pc2Uub25GYXRhbFJlamVjdGlvbiA9IGZ1bmN0aW9uKHJlamVjdGlvbiwgZXh0cmFDb250ZXh0KSB7XG5cdFx0XHRyZXR1cm4gc2VsZi5mYXRhbChyZWplY3Rpb24sIGV4dHJhQ29udGV4dCk7XG5cdFx0fTtcblxuXHRcdHJldHVybiB0aGlzO1xuXHR9O1xuXG5cdFByb21pc2VNb25pdG9yLnByb3RvdHlwZS5jcmVhdGVDb250ZXh0ID0gZnVuY3Rpb24oYXQsIHBhcmVudENvbnRleHQpIHtcblx0XHR2YXIgY29udGV4dCA9IHtcblx0XHRcdHBhcmVudDogcGFyZW50Q29udGV4dCB8fCBleGVjdXRpb25Db250ZXh0W2V4ZWN1dGlvbkNvbnRleHQubGVuZ3RoIC0gMV0sXG5cdFx0XHRzdGFjazogdm9pZCAwXG5cdFx0fTtcblx0XHRlcnJvci5jYXB0dXJlU3RhY2soY29udGV4dCwgYXQuY29uc3RydWN0b3IpO1xuXHRcdHJldHVybiBjb250ZXh0O1xuXHR9O1xuXG5cdFByb21pc2VNb25pdG9yLnByb3RvdHlwZS5hZGRUcmFjZSA9IGZ1bmN0aW9uKGhhbmRsZXIsIGV4dHJhQ29udGV4dCkge1xuXHRcdHZhciB0LCBpO1xuXG5cdFx0Zm9yKGkgPSB0aGlzLl90cmFjZXMubGVuZ3RoLTE7IGkgPj0gMDsgLS1pKSB7XG5cdFx0XHR0ID0gdGhpcy5fdHJhY2VzW2ldO1xuXHRcdFx0aWYodC5oYW5kbGVyID09PSBoYW5kbGVyKSB7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmKGkgPj0gMCkge1xuXHRcdFx0dC5leHRyYUNvbnRleHQgPSBleHRyYUNvbnRleHQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3RyYWNlcy5wdXNoKHtcblx0XHRcdFx0aGFuZGxlcjogaGFuZGxlcixcblx0XHRcdFx0ZXh0cmFDb250ZXh0OiBleHRyYUNvbnRleHRcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHRoaXMubG9nVHJhY2VzKCk7XG5cdH07XG5cblx0UHJvbWlzZU1vbml0b3IucHJvdG90eXBlLnJlbW92ZVRyYWNlID0gZnVuY3Rpb24oLypoYW5kbGVyKi8pIHtcblx0XHR0aGlzLmxvZ1RyYWNlcygpO1xuXHR9O1xuXG5cdFByb21pc2VNb25pdG9yLnByb3RvdHlwZS5mYXRhbCA9IGZ1bmN0aW9uKGhhbmRsZXIsIGV4dHJhQ29udGV4dCkge1xuXHRcdHZhciBlcnIgPSBuZXcgRXJyb3IoKTtcblx0XHRlcnIuc3RhY2sgPSB0aGlzLl9jcmVhdGVMb25nVHJhY2UoaGFuZGxlci52YWx1ZSwgaGFuZGxlci5jb250ZXh0LCBleHRyYUNvbnRleHQpLmpvaW4oJ1xcbicpO1xuXHRcdHNldFRpbWVyKGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhyb3cgZXJyO1xuXHRcdH0sIDApO1xuXHR9O1xuXG5cdFByb21pc2VNb25pdG9yLnByb3RvdHlwZS5sb2dUcmFjZXMgPSBmdW5jdGlvbigpIHtcblx0XHRpZighdGhpcy5fdHJhY2VUYXNrKSB7XG5cdFx0XHR0aGlzLl90cmFjZVRhc2sgPSBzZXRUaW1lcih0aGlzLl9kb0xvZ1RyYWNlcywgdGhpcy5sb2dEZWxheSk7XG5cdFx0fVxuXHR9O1xuXG5cdFByb21pc2VNb25pdG9yLnByb3RvdHlwZS5fbG9nVHJhY2VzID0gZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5fdHJhY2VUYXNrID0gdm9pZCAwO1xuXHRcdHRoaXMuX3RyYWNlcyA9IHRoaXMuX3RyYWNlcy5maWx0ZXIoZmlsdGVySGFuZGxlZCk7XG5cdFx0dGhpcy5fcmVwb3J0ZXIubG9nKHRoaXMuZm9ybWF0VHJhY2VzKHRoaXMuX3RyYWNlcykpO1xuXHR9O1xuXG5cblx0UHJvbWlzZU1vbml0b3IucHJvdG90eXBlLmZvcm1hdFRyYWNlcyA9IGZ1bmN0aW9uKHRyYWNlcykge1xuXHRcdHJldHVybiB0cmFjZXMubWFwKGZ1bmN0aW9uKHQpIHtcblx0XHRcdHJldHVybiB0aGlzLl9jcmVhdGVMb25nVHJhY2UodC5oYW5kbGVyLnZhbHVlLCB0LmhhbmRsZXIuY29udGV4dCwgdC5leHRyYUNvbnRleHQpO1xuXHRcdH0sIHRoaXMpO1xuXHR9O1xuXG5cdFByb21pc2VNb25pdG9yLnByb3RvdHlwZS5fY3JlYXRlTG9uZ1RyYWNlID0gZnVuY3Rpb24oZSwgY29udGV4dCwgZXh0cmFDb250ZXh0KSB7XG5cdFx0dmFyIHRyYWNlID0gZXJyb3IucGFyc2UoZSkgfHwgW1N0cmluZyhlKSArICcgKFdBUk5JTkc6IG5vbi1FcnJvciB1c2VkKSddO1xuXHRcdHRyYWNlID0gZmlsdGVyRnJhbWVzKHRoaXMuc3RhY2tGaWx0ZXIsIHRyYWNlLCAwKTtcblx0XHR0aGlzLl9hcHBlbmRDb250ZXh0KHRyYWNlLCBjb250ZXh0KTtcblx0XHR0aGlzLl9hcHBlbmRDb250ZXh0KHRyYWNlLCBleHRyYUNvbnRleHQpO1xuXHRcdHJldHVybiB0aGlzLmZpbHRlckR1cGxpY2F0ZUZyYW1lcyA/IHRoaXMuX3JlbW92ZUR1cGxpY2F0ZXModHJhY2UpIDogdHJhY2U7XG5cdH07XG5cblx0UHJvbWlzZU1vbml0b3IucHJvdG90eXBlLl9yZW1vdmVEdXBsaWNhdGVzID0gZnVuY3Rpb24odHJhY2UpIHtcblx0XHR2YXIgc2VlbiA9IHt9O1xuXHRcdHZhciBzZXAgPSB0aGlzLnN0YWNrSnVtcFNlcGFyYXRvcjtcblx0XHR2YXIgY291bnQgPSAwO1xuXHRcdHJldHVybiB0cmFjZS5yZWR1Y2VSaWdodChmdW5jdGlvbihkZWR1cGVkLCBsaW5lLCBpKSB7XG5cdFx0XHRpZihpID09PSAwKSB7XG5cdFx0XHRcdGRlZHVwZWQudW5zaGlmdChsaW5lKTtcblx0XHRcdH0gZWxzZSBpZihsaW5lID09PSBzZXApIHtcblx0XHRcdFx0aWYoY291bnQgPiAwKSB7XG5cdFx0XHRcdFx0ZGVkdXBlZC51bnNoaWZ0KGxpbmUpO1xuXHRcdFx0XHRcdGNvdW50ID0gMDtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmKCFzZWVuW2xpbmVdKSB7XG5cdFx0XHRcdHNlZW5bbGluZV0gPSB0cnVlO1xuXHRcdFx0XHRkZWR1cGVkLnVuc2hpZnQobGluZSk7XG5cdFx0XHRcdCsrY291bnQ7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZGVkdXBlZDtcblx0XHR9LCBbXSk7XG5cdH07XG5cblx0UHJvbWlzZU1vbml0b3IucHJvdG90eXBlLl9hcHBlbmRDb250ZXh0ID0gZnVuY3Rpb24odHJhY2UsIGNvbnRleHQpIHtcblx0XHR0cmFjZS5wdXNoLmFwcGx5KHRyYWNlLCB0aGlzLl9jcmVhdGVUcmFjZShjb250ZXh0KSk7XG5cdH07XG5cblx0UHJvbWlzZU1vbml0b3IucHJvdG90eXBlLl9jcmVhdGVUcmFjZSA9IGZ1bmN0aW9uKHRyYWNlQ2hhaW4pIHtcblx0XHR2YXIgdHJhY2UgPSBbXTtcblx0XHR2YXIgc3RhY2s7XG5cblx0XHR3aGlsZSh0cmFjZUNoYWluKSB7XG5cdFx0XHRzdGFjayA9IGVycm9yLnBhcnNlKHRyYWNlQ2hhaW4pO1xuXG5cdFx0XHRpZiAoc3RhY2spIHtcblx0XHRcdFx0c3RhY2sgPSBmaWx0ZXJGcmFtZXModGhpcy5zdGFja0ZpbHRlciwgc3RhY2spO1xuXHRcdFx0XHRhcHBlbmRTdGFjayh0cmFjZSwgc3RhY2ssIHRoaXMuc3RhY2tKdW1wU2VwYXJhdG9yKTtcblx0XHRcdH1cblxuXHRcdFx0dHJhY2VDaGFpbiA9IHRyYWNlQ2hhaW4ucGFyZW50O1xuXHRcdH1cblxuXHRcdHJldHVybiB0cmFjZTtcblx0fTtcblxuXHRmdW5jdGlvbiBhcHBlbmRTdGFjayh0cmFjZSwgc3RhY2ssIHNlcGFyYXRvcikge1xuXHRcdGlmIChzdGFjay5sZW5ndGggPiAxKSB7XG5cdFx0XHRzdGFja1swXSA9IHNlcGFyYXRvcjtcblx0XHRcdHRyYWNlLnB1c2guYXBwbHkodHJhY2UsIHN0YWNrKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBmaWx0ZXJGcmFtZXMoc3RhY2tGaWx0ZXIsIHN0YWNrKSB7XG5cdFx0cmV0dXJuIHN0YWNrLmZpbHRlcihmdW5jdGlvbihmcmFtZSkge1xuXHRcdFx0cmV0dXJuICFzdGFja0ZpbHRlci50ZXN0KGZyYW1lKTtcblx0XHR9KTtcblx0fVxuXG5cdGZ1bmN0aW9uIGZpbHRlckhhbmRsZWQodCkge1xuXHRcdHJldHVybiAhdC5oYW5kbGVyLmhhbmRsZWQ7XG5cdH1cblxuXHRyZXR1cm4gUHJvbWlzZU1vbml0b3I7XG59KTtcbn0odHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kID8gZGVmaW5lIDogZnVuY3Rpb24oZmFjdG9yeSkgeyBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkocmVxdWlyZSk7IH0pKTtcbiIsIi8qKiBAbGljZW5zZSBNSVQgTGljZW5zZSAoYykgY29weXJpZ2h0IDIwMTAtMjAxNCBvcmlnaW5hbCBhdXRob3Igb3IgYXV0aG9ycyAqL1xuLyoqIEBhdXRob3IgQnJpYW4gQ2F2YWxpZXIgKi9cbi8qKiBAYXV0aG9yIEpvaG4gSGFubiAqL1xuXG4oZnVuY3Rpb24oZGVmaW5lKSB7ICd1c2Ugc3RyaWN0JztcbmRlZmluZShmdW5jdGlvbihyZXF1aXJlKSB7XG5cblx0dmFyIG1vbml0b3IgPSByZXF1aXJlKCcuLi9tb25pdG9yJyk7XG5cdHZhciBQcm9taXNlID0gcmVxdWlyZSgnLi4vd2hlbicpLlByb21pc2U7XG5cblx0cmV0dXJuIG1vbml0b3IoUHJvbWlzZSk7XG5cbn0pO1xufSh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQgPyBkZWZpbmUgOiBmdW5jdGlvbihmYWN0b3J5KSB7IG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeShyZXF1aXJlKTsgfSkpO1xuIiwiLyoqIEBsaWNlbnNlIE1JVCBMaWNlbnNlIChjKSBjb3B5cmlnaHQgMjAxMC0yMDE0IG9yaWdpbmFsIGF1dGhvciBvciBhdXRob3JzICovXG4vKiogQGF1dGhvciBCcmlhbiBDYXZhbGllciAqL1xuLyoqIEBhdXRob3IgSm9obiBIYW5uICovXG5cbihmdW5jdGlvbihkZWZpbmUpIHsgJ3VzZSBzdHJpY3QnO1xuZGVmaW5lKGZ1bmN0aW9uKCkge1xuXG5cdHZhciBwYXJzZSwgY2FwdHVyZVN0YWNrLCBmb3JtYXQ7XG5cblx0aWYoRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UpIHtcblx0XHQvLyBVc2UgRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UgaWYgYXZhaWxhYmxlXG5cdFx0cGFyc2UgPSBmdW5jdGlvbihlKSB7XG5cdFx0XHRyZXR1cm4gZSAmJiBlLnN0YWNrICYmIGUuc3RhY2suc3BsaXQoJ1xcbicpO1xuXHRcdH07XG5cblx0XHRmb3JtYXQgPSBmb3JtYXRBc1N0cmluZztcblx0XHRjYXB0dXJlU3RhY2sgPSBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZTtcblxuXHR9IGVsc2Uge1xuXHRcdC8vIE90aGVyd2lzZSwgZG8gbWluaW1hbCBmZWF0dXJlIGRldGVjdGlvbiB0byBkZXRlcm1pbmVcblx0XHQvLyBob3cgdG8gY2FwdHVyZSBhbmQgZm9ybWF0IHJlYXNvbmFibGUgc3RhY2tzLlxuXHRcdHBhcnNlID0gZnVuY3Rpb24oZSkge1xuXHRcdFx0dmFyIHN0YWNrID0gZSAmJiBlLnN0YWNrICYmIGUuc3RhY2suc3BsaXQoJ1xcbicpO1xuXHRcdFx0aWYoc3RhY2sgJiYgZS5tZXNzYWdlKSB7XG5cdFx0XHRcdHN0YWNrLnVuc2hpZnQoZS5tZXNzYWdlKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBzdGFjaztcblx0XHR9O1xuXG5cdFx0KGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIGUgPSBuZXcgRXJyb3IoKTtcblx0XHRcdGlmKHR5cGVvZiBlLnN0YWNrICE9PSAnc3RyaW5nJykge1xuXHRcdFx0XHRmb3JtYXQgPSBmb3JtYXRBc1N0cmluZztcblx0XHRcdFx0Y2FwdHVyZVN0YWNrID0gY2FwdHVyZVNwaWRlck1vbmtleVN0YWNrO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Zm9ybWF0ID0gZm9ybWF0QXNFcnJvcldpdGhTdGFjaztcblx0XHRcdFx0Y2FwdHVyZVN0YWNrID0gdXNlU3RhY2tEaXJlY3RseTtcblx0XHRcdH1cblx0XHR9KCkpO1xuXHR9XG5cblx0ZnVuY3Rpb24gY2FwdHVyZVNwaWRlck1vbmtleVN0YWNrKGhvc3QpIHtcblx0XHR0cnkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCk7XG5cdFx0fSBjYXRjaChlcnIpIHtcblx0XHRcdGhvc3Quc3RhY2sgPSBlcnIuc3RhY2s7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gdXNlU3RhY2tEaXJlY3RseShob3N0KSB7XG5cdFx0aG9zdC5zdGFjayA9IG5ldyBFcnJvcigpLnN0YWNrO1xuXHR9XG5cblx0ZnVuY3Rpb24gZm9ybWF0QXNTdHJpbmcobG9uZ1RyYWNlKSB7XG5cdFx0cmV0dXJuIGpvaW4obG9uZ1RyYWNlKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGZvcm1hdEFzRXJyb3JXaXRoU3RhY2sobG9uZ1RyYWNlKSB7XG5cdFx0dmFyIGUgPSBuZXcgRXJyb3IoKTtcblx0XHRlLnN0YWNrID0gZm9ybWF0QXNTdHJpbmcobG9uZ1RyYWNlKTtcblx0XHRyZXR1cm4gZTtcblx0fVxuXG5cdC8vIEFib3V0IDUtMTB4IGZhc3RlciB0aGFuIFN0cmluZy5wcm90b3R5cGUuam9pbiBvX09cblx0ZnVuY3Rpb24gam9pbihhKSB7XG5cdFx0dmFyIHNlcCA9IGZhbHNlO1xuXHRcdHZhciBzID0gJyc7XG5cdFx0Zm9yKHZhciBpPTA7IGk8IGEubGVuZ3RoOyArK2kpIHtcblx0XHRcdGlmKHNlcCkge1xuXHRcdFx0XHRzICs9ICdcXG4nICsgYVtpXTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHMrPSBhW2ldO1xuXHRcdFx0XHRzZXAgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcztcblx0fVxuXG5cdHJldHVybiB7XG5cdFx0cGFyc2U6IHBhcnNlLFxuXHRcdGZvcm1hdDogZm9ybWF0LFxuXHRcdGNhcHR1cmVTdGFjazogY2FwdHVyZVN0YWNrXG5cdH07XG5cbn0pO1xufSh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQgPyBkZWZpbmUgOiBmdW5jdGlvbihmYWN0b3J5KSB7IG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeSgpOyB9KSk7XG4iLCIvKiogQGxpY2Vuc2UgTUlUIExpY2Vuc2UgKGMpIGNvcHlyaWdodCAyMDEwLTIwMTQgb3JpZ2luYWwgYXV0aG9yIG9yIGF1dGhvcnMgKi9cblxuLyoqXG4gKiBQcm9taXNlcy9BKyBhbmQgd2hlbigpIGltcGxlbWVudGF0aW9uXG4gKiB3aGVuIGlzIHBhcnQgb2YgdGhlIGN1am9KUyBmYW1pbHkgb2YgbGlicmFyaWVzIChodHRwOi8vY3Vqb2pzLmNvbS8pXG4gKiBAYXV0aG9yIEJyaWFuIENhdmFsaWVyXG4gKiBAYXV0aG9yIEpvaG4gSGFublxuICovXG4oZnVuY3Rpb24oZGVmaW5lKSB7ICd1c2Ugc3RyaWN0JztcbmRlZmluZShmdW5jdGlvbiAocmVxdWlyZSkge1xuXG5cdHZhciB0aW1lZCA9IHJlcXVpcmUoJy4vbGliL2RlY29yYXRvcnMvdGltZWQnKTtcblx0dmFyIGFycmF5ID0gcmVxdWlyZSgnLi9saWIvZGVjb3JhdG9ycy9hcnJheScpO1xuXHR2YXIgZmxvdyA9IHJlcXVpcmUoJy4vbGliL2RlY29yYXRvcnMvZmxvdycpO1xuXHR2YXIgZm9sZCA9IHJlcXVpcmUoJy4vbGliL2RlY29yYXRvcnMvZm9sZCcpO1xuXHR2YXIgaW5zcGVjdCA9IHJlcXVpcmUoJy4vbGliL2RlY29yYXRvcnMvaW5zcGVjdCcpO1xuXHR2YXIgZ2VuZXJhdGUgPSByZXF1aXJlKCcuL2xpYi9kZWNvcmF0b3JzL2l0ZXJhdGUnKTtcblx0dmFyIHByb2dyZXNzID0gcmVxdWlyZSgnLi9saWIvZGVjb3JhdG9ycy9wcm9ncmVzcycpO1xuXHR2YXIgd2l0aFRoaXMgPSByZXF1aXJlKCcuL2xpYi9kZWNvcmF0b3JzL3dpdGgnKTtcblx0dmFyIHVuaGFuZGxlZFJlamVjdGlvbiA9IHJlcXVpcmUoJy4vbGliL2RlY29yYXRvcnMvdW5oYW5kbGVkUmVqZWN0aW9uJyk7XG5cdHZhciBUaW1lb3V0RXJyb3IgPSByZXF1aXJlKCcuL2xpYi9UaW1lb3V0RXJyb3InKTtcblxuXHR2YXIgUHJvbWlzZSA9IFthcnJheSwgZmxvdywgZm9sZCwgZ2VuZXJhdGUsIHByb2dyZXNzLFxuXHRcdGluc3BlY3QsIHdpdGhUaGlzLCB0aW1lZCwgdW5oYW5kbGVkUmVqZWN0aW9uXVxuXHRcdC5yZWR1Y2UoZnVuY3Rpb24oUHJvbWlzZSwgZmVhdHVyZSkge1xuXHRcdFx0cmV0dXJuIGZlYXR1cmUoUHJvbWlzZSk7XG5cdFx0fSwgcmVxdWlyZSgnLi9saWIvUHJvbWlzZScpKTtcblxuXHR2YXIgYXBwbHkgPSByZXF1aXJlKCcuL2xpYi9hcHBseScpKFByb21pc2UpO1xuXG5cdC8vIFB1YmxpYyBBUElcblxuXHR3aGVuLnByb21pc2UgICAgID0gcHJvbWlzZTsgICAgICAgICAgICAgIC8vIENyZWF0ZSBhIHBlbmRpbmcgcHJvbWlzZVxuXHR3aGVuLnJlc29sdmUgICAgID0gUHJvbWlzZS5yZXNvbHZlOyAgICAgIC8vIENyZWF0ZSBhIHJlc29sdmVkIHByb21pc2Vcblx0d2hlbi5yZWplY3QgICAgICA9IFByb21pc2UucmVqZWN0OyAgICAgICAvLyBDcmVhdGUgYSByZWplY3RlZCBwcm9taXNlXG5cblx0d2hlbi5saWZ0ICAgICAgICA9IGxpZnQ7ICAgICAgICAgICAgICAgICAvLyBsaWZ0IGEgZnVuY3Rpb24gdG8gcmV0dXJuIHByb21pc2VzXG5cdHdoZW5bJ3RyeSddICAgICAgPSBhdHRlbXB0OyAgICAgICAgICAgICAgLy8gY2FsbCBhIGZ1bmN0aW9uIGFuZCByZXR1cm4gYSBwcm9taXNlXG5cdHdoZW4uYXR0ZW1wdCAgICAgPSBhdHRlbXB0OyAgICAgICAgICAgICAgLy8gYWxpYXMgZm9yIHdoZW4udHJ5XG5cblx0d2hlbi5pdGVyYXRlICAgICA9IFByb21pc2UuaXRlcmF0ZTsgICAgICAvLyBERVBSRUNBVEVEICh1c2UgY3Vqb2pzL21vc3Qgc3RyZWFtcykgR2VuZXJhdGUgYSBzdHJlYW0gb2YgcHJvbWlzZXNcblx0d2hlbi51bmZvbGQgICAgICA9IFByb21pc2UudW5mb2xkOyAgICAgICAvLyBERVBSRUNBVEVEICh1c2UgY3Vqb2pzL21vc3Qgc3RyZWFtcykgR2VuZXJhdGUgYSBzdHJlYW0gb2YgcHJvbWlzZXNcblxuXHR3aGVuLmpvaW4gICAgICAgID0gam9pbjsgICAgICAgICAgICAgICAgIC8vIEpvaW4gMiBvciBtb3JlIHByb21pc2VzXG5cblx0d2hlbi5hbGwgICAgICAgICA9IGFsbDsgICAgICAgICAgICAgICAgICAvLyBSZXNvbHZlIGEgbGlzdCBvZiBwcm9taXNlc1xuXHR3aGVuLnNldHRsZSAgICAgID0gc2V0dGxlOyAgICAgICAgICAgICAgIC8vIFNldHRsZSBhIGxpc3Qgb2YgcHJvbWlzZXNcblxuXHR3aGVuLmFueSAgICAgICAgID0gbGlmdChQcm9taXNlLmFueSk7ICAgIC8vIE9uZS13aW5uZXIgcmFjZVxuXHR3aGVuLnNvbWUgICAgICAgID0gbGlmdChQcm9taXNlLnNvbWUpOyAgIC8vIE11bHRpLXdpbm5lciByYWNlXG5cdHdoZW4ucmFjZSAgICAgICAgPSBsaWZ0KFByb21pc2UucmFjZSk7ICAgLy8gRmlyc3QtdG8tc2V0dGxlIHJhY2VcblxuXHR3aGVuLm1hcCAgICAgICAgID0gbWFwOyAgICAgICAgICAgICAgICAgIC8vIEFycmF5Lm1hcCgpIGZvciBwcm9taXNlc1xuXHR3aGVuLmZpbHRlciAgICAgID0gZmlsdGVyOyAgICAgICAgICAgICAgIC8vIEFycmF5LmZpbHRlcigpIGZvciBwcm9taXNlc1xuXHR3aGVuLnJlZHVjZSAgICAgID0gbGlmdChQcm9taXNlLnJlZHVjZSk7ICAgICAgIC8vIEFycmF5LnJlZHVjZSgpIGZvciBwcm9taXNlc1xuXHR3aGVuLnJlZHVjZVJpZ2h0ID0gbGlmdChQcm9taXNlLnJlZHVjZVJpZ2h0KTsgIC8vIEFycmF5LnJlZHVjZVJpZ2h0KCkgZm9yIHByb21pc2VzXG5cblx0d2hlbi5pc1Byb21pc2VMaWtlID0gaXNQcm9taXNlTGlrZTsgICAgICAvLyBJcyBzb21ldGhpbmcgcHJvbWlzZS1saWtlLCBha2EgdGhlbmFibGVcblxuXHR3aGVuLlByb21pc2UgICAgID0gUHJvbWlzZTsgICAgICAgICAgICAgIC8vIFByb21pc2UgY29uc3RydWN0b3Jcblx0d2hlbi5kZWZlciAgICAgICA9IGRlZmVyOyAgICAgICAgICAgICAgICAvLyBDcmVhdGUgYSB7cHJvbWlzZSwgcmVzb2x2ZSwgcmVqZWN0fSB0dXBsZVxuXG5cdC8vIEVycm9yIHR5cGVzXG5cblx0d2hlbi5UaW1lb3V0RXJyb3IgPSBUaW1lb3V0RXJyb3I7XG5cblx0LyoqXG5cdCAqIEdldCBhIHRydXN0ZWQgcHJvbWlzZSBmb3IgeCwgb3IgYnkgdHJhbnNmb3JtaW5nIHggd2l0aCBvbkZ1bGZpbGxlZFxuXHQgKlxuXHQgKiBAcGFyYW0geyp9IHhcblx0ICogQHBhcmFtIHtmdW5jdGlvbj99IG9uRnVsZmlsbGVkIGNhbGxiYWNrIHRvIGJlIGNhbGxlZCB3aGVuIHggaXNcblx0ICogICBzdWNjZXNzZnVsbHkgZnVsZmlsbGVkLiAgSWYgcHJvbWlzZU9yVmFsdWUgaXMgYW4gaW1tZWRpYXRlIHZhbHVlLCBjYWxsYmFja1xuXHQgKiAgIHdpbGwgYmUgaW52b2tlZCBpbW1lZGlhdGVseS5cblx0ICogQHBhcmFtIHtmdW5jdGlvbj99IG9uUmVqZWN0ZWQgY2FsbGJhY2sgdG8gYmUgY2FsbGVkIHdoZW4geCBpc1xuXHQgKiAgIHJlamVjdGVkLlxuXHQgKiBAcGFyYW0ge2Z1bmN0aW9uP30gb25Qcm9ncmVzcyBjYWxsYmFjayB0byBiZSBjYWxsZWQgd2hlbiBwcm9ncmVzcyB1cGRhdGVzXG5cdCAqICAgYXJlIGlzc3VlZCBmb3IgeC4gQGRlcHJlY2F0ZWRcblx0ICogQHJldHVybnMge1Byb21pc2V9IGEgbmV3IHByb21pc2UgdGhhdCB3aWxsIGZ1bGZpbGwgd2l0aCB0aGUgcmV0dXJuXG5cdCAqICAgdmFsdWUgb2YgY2FsbGJhY2sgb3IgZXJyYmFjayBvciB0aGUgY29tcGxldGlvbiB2YWx1ZSBvZiBwcm9taXNlT3JWYWx1ZSBpZlxuXHQgKiAgIGNhbGxiYWNrIGFuZC9vciBlcnJiYWNrIGlzIG5vdCBzdXBwbGllZC5cblx0ICovXG5cdGZ1bmN0aW9uIHdoZW4oeCwgb25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MpIHtcblx0XHR2YXIgcCA9IFByb21pc2UucmVzb2x2ZSh4KTtcblx0XHRpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDIpIHtcblx0XHRcdHJldHVybiBwO1xuXHRcdH1cblxuXHRcdHJldHVybiBwLnRoZW4ob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYSBuZXcgcHJvbWlzZSB3aG9zZSBmYXRlIGlzIGRldGVybWluZWQgYnkgcmVzb2x2ZXIuXG5cdCAqIEBwYXJhbSB7ZnVuY3Rpb259IHJlc29sdmVyIGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCwgbm90aWZ5KVxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX0gcHJvbWlzZSB3aG9zZSBmYXRlIGlzIGRldGVybWluZSBieSByZXNvbHZlclxuXHQgKi9cblx0ZnVuY3Rpb24gcHJvbWlzZShyZXNvbHZlcikge1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlcik7XG5cdH1cblxuXHQvKipcblx0ICogTGlmdCB0aGUgc3VwcGxpZWQgZnVuY3Rpb24sIGNyZWF0aW5nIGEgdmVyc2lvbiBvZiBmIHRoYXQgcmV0dXJuc1xuXHQgKiBwcm9taXNlcywgYW5kIGFjY2VwdHMgcHJvbWlzZXMgYXMgYXJndW1lbnRzLlxuXHQgKiBAcGFyYW0ge2Z1bmN0aW9ufSBmXG5cdCAqIEByZXR1cm5zIHtGdW5jdGlvbn0gdmVyc2lvbiBvZiBmIHRoYXQgcmV0dXJucyBwcm9taXNlc1xuXHQgKi9cblx0ZnVuY3Rpb24gbGlmdChmKSB7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0Zm9yKHZhciBpPTAsIGw9YXJndW1lbnRzLmxlbmd0aCwgYT1uZXcgQXJyYXkobCk7IGk8bDsgKytpKSB7XG5cdFx0XHRcdGFbaV0gPSBhcmd1bWVudHNbaV07XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gYXBwbHkoZiwgdGhpcywgYSk7XG5cdFx0fTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDYWxsIGYgaW4gYSBmdXR1cmUgdHVybiwgd2l0aCB0aGUgc3VwcGxpZWQgYXJncywgYW5kIHJldHVybiBhIHByb21pc2Vcblx0ICogZm9yIHRoZSByZXN1bHQuXG5cdCAqIEBwYXJhbSB7ZnVuY3Rpb259IGZcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRmdW5jdGlvbiBhdHRlbXB0KGYgLyosIGFyZ3MuLi4gKi8pIHtcblx0XHQvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuXHRcdGZvcih2YXIgaT0wLCBsPWFyZ3VtZW50cy5sZW5ndGgtMSwgYT1uZXcgQXJyYXkobCk7IGk8bDsgKytpKSB7XG5cdFx0XHRhW2ldID0gYXJndW1lbnRzW2krMV07XG5cdFx0fVxuXHRcdHJldHVybiBhcHBseShmLCB0aGlzLCBhKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEge3Byb21pc2UsIHJlc29sdmVyfSBwYWlyLCBlaXRoZXIgb3IgYm90aCBvZiB3aGljaFxuXHQgKiBtYXkgYmUgZ2l2ZW4gb3V0IHNhZmVseSB0byBjb25zdW1lcnMuXG5cdCAqIEByZXR1cm4ge3twcm9taXNlOiBQcm9taXNlLCByZXNvbHZlOiBmdW5jdGlvbiwgcmVqZWN0OiBmdW5jdGlvbiwgbm90aWZ5OiBmdW5jdGlvbn19XG5cdCAqL1xuXHRmdW5jdGlvbiBkZWZlcigpIHtcblx0XHRyZXR1cm4gbmV3IERlZmVycmVkKCk7XG5cdH1cblxuXHRmdW5jdGlvbiBEZWZlcnJlZCgpIHtcblx0XHR2YXIgcCA9IFByb21pc2UuX2RlZmVyKCk7XG5cblx0XHRmdW5jdGlvbiByZXNvbHZlKHgpIHsgcC5faGFuZGxlci5yZXNvbHZlKHgpOyB9XG5cdFx0ZnVuY3Rpb24gcmVqZWN0KHgpIHsgcC5faGFuZGxlci5yZWplY3QoeCk7IH1cblx0XHRmdW5jdGlvbiBub3RpZnkoeCkgeyBwLl9oYW5kbGVyLm5vdGlmeSh4KTsgfVxuXG5cdFx0dGhpcy5wcm9taXNlID0gcDtcblx0XHR0aGlzLnJlc29sdmUgPSByZXNvbHZlO1xuXHRcdHRoaXMucmVqZWN0ID0gcmVqZWN0O1xuXHRcdHRoaXMubm90aWZ5ID0gbm90aWZ5O1xuXHRcdHRoaXMucmVzb2x2ZXIgPSB7IHJlc29sdmU6IHJlc29sdmUsIHJlamVjdDogcmVqZWN0LCBub3RpZnk6IG5vdGlmeSB9O1xuXHR9XG5cblx0LyoqXG5cdCAqIERldGVybWluZXMgaWYgeCBpcyBwcm9taXNlLWxpa2UsIGkuZS4gYSB0aGVuYWJsZSBvYmplY3Rcblx0ICogTk9URTogV2lsbCByZXR1cm4gdHJ1ZSBmb3IgKmFueSB0aGVuYWJsZSBvYmplY3QqLCBhbmQgaXNuJ3QgdHJ1bHlcblx0ICogc2FmZSwgc2luY2UgaXQgbWF5IGF0dGVtcHQgdG8gYWNjZXNzIHRoZSBgdGhlbmAgcHJvcGVydHkgb2YgeCAoaS5lLlxuXHQgKiAgY2xldmVyL21hbGljaW91cyBnZXR0ZXJzIG1heSBkbyB3ZWlyZCB0aGluZ3MpXG5cdCAqIEBwYXJhbSB7Kn0geCBhbnl0aGluZ1xuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn0gdHJ1ZSBpZiB4IGlzIHByb21pc2UtbGlrZVxuXHQgKi9cblx0ZnVuY3Rpb24gaXNQcm9taXNlTGlrZSh4KSB7XG5cdFx0cmV0dXJuIHggJiYgdHlwZW9mIHgudGhlbiA9PT0gJ2Z1bmN0aW9uJztcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gYSBwcm9taXNlIHRoYXQgd2lsbCByZXNvbHZlIG9ubHkgb25jZSBhbGwgdGhlIHN1cHBsaWVkIGFyZ3VtZW50c1xuXHQgKiBoYXZlIHJlc29sdmVkLiBUaGUgcmVzb2x1dGlvbiB2YWx1ZSBvZiB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aWxsIGJlIGFuIGFycmF5XG5cdCAqIGNvbnRhaW5pbmcgdGhlIHJlc29sdXRpb24gdmFsdWVzIG9mIGVhY2ggb2YgdGhlIGFyZ3VtZW50cy5cblx0ICogQHBhcmFtIHsuLi4qfSBhcmd1bWVudHMgbWF5IGJlIGEgbWl4IG9mIHByb21pc2VzIGFuZCB2YWx1ZXNcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRmdW5jdGlvbiBqb2luKC8qIC4uLnByb21pc2VzICovKSB7XG5cdFx0cmV0dXJuIFByb21pc2UuYWxsKGFyZ3VtZW50cyk7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIGEgcHJvbWlzZSB0aGF0IHdpbGwgZnVsZmlsbCBvbmNlIGFsbCBpbnB1dCBwcm9taXNlcyBoYXZlXG5cdCAqIGZ1bGZpbGxlZCwgb3IgcmVqZWN0IHdoZW4gYW55IG9uZSBpbnB1dCBwcm9taXNlIHJlamVjdHMuXG5cdCAqIEBwYXJhbSB7YXJyYXl8UHJvbWlzZX0gcHJvbWlzZXMgYXJyYXkgKG9yIHByb21pc2UgZm9yIGFuIGFycmF5KSBvZiBwcm9taXNlc1xuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdGZ1bmN0aW9uIGFsbChwcm9taXNlcykge1xuXHRcdHJldHVybiB3aGVuKHByb21pc2VzLCBQcm9taXNlLmFsbCk7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIGEgcHJvbWlzZSB0aGF0IHdpbGwgYWx3YXlzIGZ1bGZpbGwgd2l0aCBhbiBhcnJheSBjb250YWluaW5nXG5cdCAqIHRoZSBvdXRjb21lIHN0YXRlcyBvZiBhbGwgaW5wdXQgcHJvbWlzZXMuICBUaGUgcmV0dXJuZWQgcHJvbWlzZVxuXHQgKiB3aWxsIG9ubHkgcmVqZWN0IGlmIGBwcm9taXNlc2AgaXRzZWxmIGlzIGEgcmVqZWN0ZWQgcHJvbWlzZS5cblx0ICogQHBhcmFtIHthcnJheXxQcm9taXNlfSBwcm9taXNlcyBhcnJheSAob3IgcHJvbWlzZSBmb3IgYW4gYXJyYXkpIG9mIHByb21pc2VzXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfSBwcm9taXNlIGZvciBhcnJheSBvZiBzZXR0bGVkIHN0YXRlIGRlc2NyaXB0b3JzXG5cdCAqL1xuXHRmdW5jdGlvbiBzZXR0bGUocHJvbWlzZXMpIHtcblx0XHRyZXR1cm4gd2hlbihwcm9taXNlcywgUHJvbWlzZS5zZXR0bGUpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFByb21pc2UtYXdhcmUgYXJyYXkgbWFwIGZ1bmN0aW9uLCBzaW1pbGFyIHRvIGBBcnJheS5wcm90b3R5cGUubWFwKClgLFxuXHQgKiBidXQgaW5wdXQgYXJyYXkgbWF5IGNvbnRhaW4gcHJvbWlzZXMgb3IgdmFsdWVzLlxuXHQgKiBAcGFyYW0ge0FycmF5fFByb21pc2V9IHByb21pc2VzIGFycmF5IG9mIGFueXRoaW5nLCBtYXkgY29udGFpbiBwcm9taXNlcyBhbmQgdmFsdWVzXG5cdCAqIEBwYXJhbSB7ZnVuY3Rpb24oeDoqLCBpbmRleDpOdW1iZXIpOip9IG1hcEZ1bmMgbWFwIGZ1bmN0aW9uIHdoaWNoIG1heVxuXHQgKiAgcmV0dXJuIGEgcHJvbWlzZSBvciB2YWx1ZVxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX0gcHJvbWlzZSB0aGF0IHdpbGwgZnVsZmlsbCB3aXRoIGFuIGFycmF5IG9mIG1hcHBlZCB2YWx1ZXNcblx0ICogIG9yIHJlamVjdCBpZiBhbnkgaW5wdXQgcHJvbWlzZSByZWplY3RzLlxuXHQgKi9cblx0ZnVuY3Rpb24gbWFwKHByb21pc2VzLCBtYXBGdW5jKSB7XG5cdFx0cmV0dXJuIHdoZW4ocHJvbWlzZXMsIGZ1bmN0aW9uKHByb21pc2VzKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5tYXAocHJvbWlzZXMsIG1hcEZ1bmMpO1xuXHRcdH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIEZpbHRlciB0aGUgcHJvdmlkZWQgYXJyYXkgb2YgcHJvbWlzZXMgdXNpbmcgdGhlIHByb3ZpZGVkIHByZWRpY2F0ZS4gIElucHV0IG1heVxuXHQgKiBjb250YWluIHByb21pc2VzIGFuZCB2YWx1ZXNcblx0ICogQHBhcmFtIHtBcnJheXxQcm9taXNlfSBwcm9taXNlcyBhcnJheSBvZiBwcm9taXNlcyBhbmQgdmFsdWVzXG5cdCAqIEBwYXJhbSB7ZnVuY3Rpb24oeDoqLCBpbmRleDpOdW1iZXIpOmJvb2xlYW59IHByZWRpY2F0ZSBmaWx0ZXJpbmcgcHJlZGljYXRlLlxuXHQgKiAgTXVzdCByZXR1cm4gdHJ1dGh5IChvciBwcm9taXNlIGZvciB0cnV0aHkpIGZvciBpdGVtcyB0byByZXRhaW4uXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfSBwcm9taXNlIHRoYXQgd2lsbCBmdWxmaWxsIHdpdGggYW4gYXJyYXkgY29udGFpbmluZyBhbGwgaXRlbXNcblx0ICogIGZvciB3aGljaCBwcmVkaWNhdGUgcmV0dXJuZWQgdHJ1dGh5LlxuXHQgKi9cblx0ZnVuY3Rpb24gZmlsdGVyKHByb21pc2VzLCBwcmVkaWNhdGUpIHtcblx0XHRyZXR1cm4gd2hlbihwcm9taXNlcywgZnVuY3Rpb24ocHJvbWlzZXMpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLmZpbHRlcihwcm9taXNlcywgcHJlZGljYXRlKTtcblx0XHR9KTtcblx0fVxuXG5cdHJldHVybiB3aGVuO1xufSk7XG59KSh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQgPyBkZWZpbmUgOiBmdW5jdGlvbiAoZmFjdG9yeSkgeyBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkocmVxdWlyZSk7IH0pO1xuIiwiKGZ1bmN0aW9uIChwcm9jZXNzKXtcbi8qKlxyXG4gKiBPcmdhbmlxIEFwcGxpY2F0aW9uIGFuZCBEZXZpY2UgU0RLLlxyXG4gKlxyXG4gKiBQcm92aWRlcyBpbnRlcmZhY2VzIGZvciBvYnRhaW5pbmcgcHJveGllcyBmb3IgcmVtb3RlIE9yZ2FuaXEgb2JqZWN0cywgYW5kXHJcbiAqIGltcGxlbWVudHMgYSBsb2NhbCBkZXZpY2UgY29udGFpbmVyIGZvciBob3N0aW5nIGRldmljZXMuXHJcbiAqXHJcbiAqL1xyXG52YXIgRGV2aWNlQ29udGFpbmVyID0gcmVxdWlyZSgnLi9kZXZpY2VDb250YWluZXInKTtcclxudmFyIENsaWVudENvbnRhaW5lciA9IHJlcXVpcmUoJy4vY2xpZW50Q29udGFpbmVyJyk7XHJcbnZhciBXZWJTb2NrZXQgPSByZXF1aXJlKCcuL3dlYnNvY2tldCcpO1xyXG52YXIgV2ViU29ja2V0VHJhbnNwb3J0ID0gcmVxdWlyZSgnLi93ZWJTb2NrZXRUcmFuc3BvcnQnKTtcclxuLy92YXIgd2hlbiA9IHJlcXVpcmUoJ3doZW4nKTtcclxudmFyIGZzID0gcmVxdWlyZSgnZnMnKTtcclxucmVxdWlyZSgnd2hlbi9tb25pdG9yL2NvbnNvbGUnKTtcclxudmFyIGRlYnVnID0gcmVxdWlyZSgnZGVidWcnKSgnc2RrJyk7XHJcblxyXG52YXIgUHJveHlfID0gcmVxdWlyZSgnLi9wcm94eVdyYXBwZXInKTtcclxudmFyIERldmljZSA9IHJlcXVpcmUoJy4vZGV2aWNlV3JhcHBlcicpO1xyXG52YXIgU2NoZW1hID0gcmVxdWlyZSgnLi9zY2hlbWEnKTtcclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IE9yZ2FuaXE7XHJcbm1vZHVsZS5leHBvcnRzLkRldmljZSA9IERldmljZTtcclxubW9kdWxlLmV4cG9ydHMuUHJveHkgPSBQcm94eV87XHJcbm1vZHVsZS5leHBvcnRzLlNjaGVtYSA9IFNjaGVtYTtcclxuXHJcblxyXG52YXIgREVGQVVMVF9BUElST09UID0gJ3dzOi8vYXBpLm9yZ2FuaXEuaW8nO1xyXG52YXIgREVGQVVMVF9BUElUT0tFTiA9ICcnO1xyXG52YXIgREVGQVVMVF9OQU1FU1BBQ0UgPSAnLic7XHJcbnZhciBERUZBVUxUX09QVElPTlNfUEFUSCA9ICcuL29yZ2FuaXEuanNvbic7XHJcblxyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSBPcmdhbmlxIERldmljZSBDb250YWluZXIuXHJcbiAqXHJcbiAqIFRoZSB2YWx1ZXMgdXNlZCBmb3IgQVBJIHJvb3QgYW5kIEFQSSB0b2tlbiBjYW4gYmUgc3BlY2lmaWVkIGluIGFueSBvZiB0aGVcclxuICogZm9sbG93aW5nIHBsYWNlczpcclxuICogICgxKSBPcmdhbmlxIGNvbnN0cnVjdG9yXHJcbiAqICAoMikgb3JnYW5pcS5qc29uIGluIHRoZSBjdXJyZW50IHdvcmtpbmcgZGlyZWN0b3J5XHJcbiAqICAoMykgT1JHQU5JUV9BUElST09ULCBPUkdBTklRX0FQSVRPS0VOLCBhbmQgT1JHQU5JUV9OQU1FU1BBQ0UgZW52aXJvbm1lbnRcclxuICogICAgdmFyaWFibGVzXHJcbiAqXHJcbiAqIElmIHZhbHVlcyBhcmUgbm90IGZvdW5kIGluIGFueSBvZiB0aGVzZSBwbGFjZXMsIGRlZmF1bHRzIGFyZSB1c2VkLlxyXG4gKlxyXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyBDb25maWd1cmF0aW9uIG9wdGlvbnMuXHJcbiAqIEBwYXJhbSB7U3RyaW5nPX0gb3B0aW9ucy5hcGlSb290IFRoZSBVUkkgb2YgdGhlIGdhdGV3YXkgc2VydmVyIGVuZHBvaW50IHRvIHdoaWNoIHdlXHJcbiAqICBzaG91bGQgY29ubmVjdC5cclxuICogQHBhcmFtIHtTdHJpbmc9fSBvcHRpb25zLmFwaVRva2VuIFRoZSBhdXRoZW50aWNhdGlvbiB0b2tlbiB0byB1c2Ugd2l0aCB0aGUgZ2F0ZXdheS5cclxuICogQHBhcmFtIHtTdHJpbmc9fSBvcHRpb25zLm5hbWVzcGFjZSBUaGUgbmFtZXNwYWNlIHRvIHVzZSBmb3IgZGV2aWNlaWRzXHJcbiAqICB3aGVuIG9uZSBpcyBub3Qgc3BlY2lmaWVkLiBEZWZhdWx0cyB0byB0aGUgZ2xvYmFsIG5hbWVzcGFjZSAoJy4nKS5cclxuICogQHBhcmFtIHtTdHJpbmc9fSBvcHRpb25zLm9wdGlvbnNQYXRoIERlZmF1bHRzIHRvICcuL29yZ2FuaXEuanNvbidcclxuICogQHBhcmFtIHtCb29sZWFuPX0gb3B0aW9ucy5hdXRvQ29ubmVjdCBEZWZhdWx0cyB0byB0cnVlLlxyXG4gKiBAcGFyYW0ge0Jvb2xlYW49fSBvcHRpb25zLnN0cmljdFNjaGVtYSBEZWZhdWx0cyB0byBmYWxzZS5cclxuICpcclxuICogQGNvbnN0cnVjdG9yXHJcbiAqL1xyXG5mdW5jdGlvbiBPcmdhbmlxKG9wdGlvbnMpIHtcclxuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgT3JnYW5pcSkpIHtcclxuICAgIHJldHVybiBuZXcgT3JnYW5pcShvcHRpb25zKTtcclxuICB9XHJcblxyXG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xyXG4gIHZhciBhcGlSb290ID0gb3B0aW9ucy5hcGlSb290O1xyXG4gIHZhciBhcGlUb2tlbiA9IG9wdGlvbnMuYXBpVG9rZW47XHJcbiAgdmFyIG5hbWVzcGFjZSA9IG9wdGlvbnMubmFtZXNwYWNlO1xyXG4gIHZhciBvcHRpb25zUGF0aCA9IG9wdGlvbnMub3B0aW9uc1BhdGggfHwgREVGQVVMVF9PUFRJT05TX1BBVEg7XHJcbiAgLy92YXIgYXV0b0Nvbm5lY3QgPSBvcHRpb25zLmF1dG9Db25uZWN0ICE9PSBmYWxzZTsgIC8vIHRydWUgaWYgbm90IGdpdmVuIGZhbHNlXHJcbiAgdmFyIHN0cmljdFNjaGVtYSA9IG9wdGlvbnMuc3RyaWN0U2NoZW1hIHx8IGZhbHNlOyAvLyBmYWxzZSBpZiBub3QgZ2l2ZW4gdHJ1ZVxyXG5cclxuXHJcbiAgLy8gSWYgd2Ugd2VyZW4ndCBnaXZlbiBhbGwgY29uZmlndXJhYmxlIHBhcmFtZXRlcnMsIGxvb2sgaW4gb3JnYW5pcS5qc29uLlxyXG4gIC8vIE5vdGUgdGhhdCB0aGUgc3BlY2lhbCBjaGVja3MgZm9yIGZzLmV4aXN0c1N5bmMgYXJlIG5lY2Vzc2FyeSBmb3IgdGhpcyBjb2RlXHJcbiAgLy8gdG8gd29yayBpbiBhIHdlYiBicm93c2VyIGVudmlyb25tZW50ICh3aGVyZSBpdCB3aWxsIG5vdCBiZSBkZWZpbmVkKS5cclxuXHJcbiAgaWYgKCFhcGlSb290IHx8ICFhcGlUb2tlbiB8fCAhIW5hbWVzcGFjZSkge1xyXG4gICAgaWYgKGZzICYmIGZzLmV4aXN0c1N5bmMgIT09IHVuZGVmaW5lZCAmJiBmcy5leGlzdHNTeW5jKG9wdGlvbnNQYXRoKSkge1xyXG4gICAgICB2YXIgcyA9IGZzLnJlYWRGaWxlU3luYyhvcHRpb25zUGF0aCwgJ3V0ZjgnKTtcclxuICAgICAgdmFyIGNvbmZpZyA9IEpTT04ucGFyc2Uocyk7XHJcbiAgICAgIGFwaVRva2VuID0gYXBpVG9rZW4gfHwgY29uZmlnWyd0b2tlbiddO1xyXG4gICAgICBhcGlSb290ID0gYXBpUm9vdCB8fCBjb25maWdbJ2FwaVJvb3QnXTtcclxuICAgICAgbmFtZXNwYWNlID0gbmFtZXNwYWNlIHx8IGNvbmZpZ1snbmFtZXNwYWNlJ107XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBhcGlSb290ID0gYXBpUm9vdCB8fCBwcm9jZXNzLmVudlsnT1JHQU5JUV9BUElST09UJ10gfHwgREVGQVVMVF9BUElST09UO1xyXG4gIGFwaVRva2VuID0gYXBpVG9rZW4gfHwgcHJvY2Vzcy5lbnZbJ09SR0FOSVFfQVBJVE9LRU4nXSB8fCBERUZBVUxUX0FQSVRPS0VOO1xyXG4gIG5hbWVzcGFjZSA9IG5hbWVzcGFjZSB8fCBwcm9jZXNzLmVudlsnT1JHQU5JUV9OQU1FU1BBQ0UnXSB8fCBERUZBVUxUX05BTUVTUEFDRTtcclxuXHJcbiAgLy8gQ3JlYXRlIGEgZGV2aWNlIGNvbnRhaW5lciBhbmQgY2xpZW50IG5vZGUsIGFuZCBjb25uZWN0IHRoZW0gdG8gdGhlIGdhdGV3YXlcclxuICAvLyB2aWEgdGhlIFdlYlNvY2tldFRyYW5zcG9ydC5cclxuICB2YXIgY29udGFpbmVyID0gbmV3IERldmljZUNvbnRhaW5lcih7ZGVmYXVsdERvbWFpbjogbmFtZXNwYWNlfSk7XHJcbiAgdmFyIGNsaWVudCA9IG5ldyBDbGllbnRDb250YWluZXIoe2RlZmF1bHREb21haW46IG5hbWVzcGFjZX0pO1xyXG4gIHZhciBnYXRld2F5ID0gbmV3IFdlYlNvY2tldFRyYW5zcG9ydChjb250YWluZXIsIGNsaWVudCk7XHJcbiAgY2xpZW50LmF0dGFjaEdhdGV3YXkoZ2F0ZXdheSwgbmFtZXNwYWNlKTtcclxuICBjb250YWluZXIuYXR0YWNoR2F0ZXdheShnYXRld2F5LCBuYW1lc3BhY2UpO1xyXG5cclxuICB2YXIgd3MgPSBuZXcgV2ViU29ja2V0KGFwaVJvb3QpO1xyXG4gIHdzLm9uKCdvcGVuJywgZ2F0ZXdheS5jb25uZWN0aW9uSGFuZGxlcik7XHJcbiAgd3Mub24oJ2Vycm9yJywgZnVuY3Rpb24gKGUpIHtcclxuICAgIGRlYnVnKCdGYWlsZWQgdG8gY29ubmVjdCBjb250YWluZXIgdG8gZ2F0ZXdheSBzZXJ2ZXI6ICcgKyBlKTtcclxuICB9KTtcclxuXHJcblxyXG4gIC8qKlxyXG4gICAqIE5vcm1hbGl6ZSBhIHVzZXItc3VwcGxpZWQgZGV2aWNlaWQuXHJcbiAgICpcclxuICAgKiBGb3IgY29udmVuaWVuY2UsIHRoZSBTREsgYWxsb3dzIHVzZXIgdG8gc3VwcGx5IGRldmljZWlkcyB3aXRob3V0IGJlaW5nXHJcbiAgICogZnVsbHkgcXVhbGlmaWVkLiBUaGUgT3JnYW5pcSBjb3JlIGFsd2F5cyByZXF1aXJlcyBmdWxseS1xdWFsaWZpZWQgaWRzLlxyXG4gICAqXHJcbiAgICogQHBhcmFtIGRldmljZWlkXHJcbiAgICogQHJldHVybiB7c3RyaW5nfSBBIG5vcm1hbGl6ZWQgZGV2aWNlaWQgb2YgdGhlIGZvcm0gPGRvbWFpbj46PGRldmljZWlkPlxyXG4gICAqL1xyXG4gIGZ1bmN0aW9uIG5vcm1hbGl6ZURldmljZUlkKGRldmljZWlkKSB7XHJcbiAgICB2YXIgcGFydHMgPSBkZXZpY2VpZC50b0xvd2VyQ2FzZSgpLnNwbGl0KCc6Jyk7XHJcbiAgICBpZiAocGFydHMubGVuZ3RoID09PSAxKSB7XHJcbiAgICAgIHBhcnRzWzFdID0gcGFydHNbMF07XHJcbiAgICAgIHBhcnRzWzBdID0gbmFtZXNwYWNlO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHBhcnRzLmpvaW4oJzonKTtcclxuICB9XHJcblxyXG5cclxuICAvKipcclxuICAgKiBSZWdpc3RlciBhIGxvY2FsIGRldmljZSBvYmplY3Qgd2l0aCB0aGUgc3lzdGVtLlxyXG4gICAqXHJcbiAgICogSWYgYHN0cmljdFNjaGVtYWAgaXMgZW5hYmxlZCBpbiBvcHRpb25zLCBhIHNjaGVtYSBvYmplY3QgbXVzdCBiZSBwcm92aWRlZFxyXG4gICAqIHRoYXQgc3BlY2lmaWVzIHRoZSBwcm9wZXJ0aWVzLCBtZXRob2RzLCBhbmQgZXZlbnRzIGV4cG9zZWQgYnkgdGhlIGRldmljZVxyXG4gICAqIGJlaW5nIHJlZ2lzdGVyZWQuIElmIGBzdHJpY3RTY2hlbWFgIGlzIG5vdCBlbmFibGVkLCB0aGVuIHRoZSBzY2hlbWEgb2JqZWN0XHJcbiAgICogaXMgb3B0aW9uYWwuIElmIG9taXR0ZWQgaW4gdGhpcyBjYXNlLCBhIHNjaGVtYSB3aWxsIGJlIGF1dG9tYXRpY2FsbHlcclxuICAgKiBjcmVhdGVkIGJ5IGluc3BlY3RpbmcgdGhlIGdpdmVuIGBpbXBsYCBvYmplY3QuXHJcbiAgICpcclxuICAgKiBAcGFyYW0ge1N0cmluZ30gZGV2aWNlaWRcclxuICAgKiBAcGFyYW0ge09iamVjdH0gaW1wbCBOYXRpdmUgaW1wbGVtZW50YXRpb24gb2JqZWN0XHJcbiAgICogQHBhcmFtIHtPYmplY3R9IFtzY2hlbWFdIG9wdGlvbmFsIHNjaGVtYSBmb3IgaW50ZXJmYWNlXHJcbiAgICogQHJldHVybnMge0RldmljZX1cclxuICAgKi9cclxuICB0aGlzLnJlZ2lzdGVyRGV2aWNlID0gZnVuY3Rpb24gKGRldmljZWlkLCBpbXBsLCBzY2hlbWEpIHtcclxuICAgIGlmIChzdHJpY3RTY2hlbWEgJiYgIXNjaGVtYSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NjaGVtYSBpcyByZXF1aXJlZCB3aGVuIGBzdHJpY3RTY2hlbWFgIGVuYWJsZWQnKTtcclxuICAgIH1cclxuICAgIGRldmljZWlkID0gbm9ybWFsaXplRGV2aWNlSWQoZGV2aWNlaWQpO1xyXG4gICAgdmFyIGRldmljZSA9IG5ldyBEZXZpY2UoaW1wbCwgc2NoZW1hLCB7c3RyaWN0U2NoZW1hOiBzdHJpY3RTY2hlbWF9KTtcclxuICAgIHJldHVybiBjb250YWluZXIucmVnaXN0ZXIoZGV2aWNlaWQsIGRldmljZSk7XHJcbiAgfTtcclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgcmVmZXJlbmNlIHRvIGEgcmVtb3RlIGRldmljZS5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBkZXZpY2VpZFxyXG4gICAqIEByZXR1cm4ge1Byb3h5V3JhcHBlcnxQcm9taXNlfVxyXG4gICAqL1xyXG4gIHRoaXMuZ2V0RGV2aWNlID0gZnVuY3Rpb24oZGV2aWNlaWQpIHtcclxuICAgIHZhciBwcm94eSA9IG51bGw7XHJcblxyXG4gICAgZGV2aWNlaWQgPSBub3JtYWxpemVEZXZpY2VJZChkZXZpY2VpZCk7XHJcbiAgICBkZWJ1ZygnZ2V0RGV2aWNlKGRldmljZWlkPScrZGV2aWNlaWQrJyknKTtcclxuXHJcbiAgICByZXR1cm4gY2xpZW50LmNvbm5lY3QoZGV2aWNlaWQpXHJcbiAgICAgIC50aGVuKGZ1bmN0aW9uKHByb3h5Xykge1xyXG4gICAgICAvLyBRdWVyeSB0aGUgZGV2aWNlIGZvciBpdHMgc2NoZW1hXHJcbiAgICAgIGRlYnVnKCdnZXREZXZpY2UgcmVjZWl2ZWQgbmF0aXZlIGRldmljZSBwcm94eS4nKTtcclxuICAgICAgcHJveHkgPSBwcm94eV87XHJcbiAgICAgIHJldHVybiBwcm94eS5kZXNjcmliZSgnLnNjaGVtYScpO1xyXG4gICAgfSkudGhlbihmdW5jdGlvbihzY2hlbWEpIHtcclxuICAgICAgLy8gQ3JlYXRlIHRoZSBwcm94eSB3cmFwcGVyIG9iamVjdCBmb3IgdGhlIGNhbGxlclxyXG4gICAgICBkZWJ1ZygnZ2V0RGV2aWNlIHJlY2VpdmVkIGRldmljZSBzY2hlbWEuJyk7XHJcbiAgICAgIHJldHVybiBuZXcgUHJveHlfKHNjaGVtYSwgcHJveHkpO1xyXG4gICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKCdnZXREZXZpY2UgZXJyb3I6ICcsIGVycik7XHJcbiAgICAgIHRocm93IGVycjtcclxuICAgIH0pO1xyXG4gIH07XHJcbn1cclxuXHJcblxyXG5cclxuLyoqXHJcbiAqIEZhY3RvcnkgZm9yIGEgc2luZ2xldG9uIE9yZ2FuaXEgb2JqZWN0LlxyXG4gKlxyXG4gKiBJdCBpcyBjb21tb24gZm9yIHRoZSBtb2R1bGUgY2xpZW50IHRvIHdhbnQgdG8gdXNlIGEgc2luZ2xlIGluc3RhbmNlIG9mXHJcbiAqIE9yZ2FuaXEgd2l0aCBkZWZhdWx0IGNvbm5lY3Rpb24gc2V0dGluZ3MgKG9yIHNldHRpbmdzIGNvbmZpZ3VyZWQgaW4gdGhlXHJcbiAqIGVudmlyb25tZW50IG9yIGNvbmZpZyBmaWxlKS4gVGhpcyBmYWN0b3J5LCB0b2dldGhlciB3aXRoIHRoZSBjbGFzcyBmdW5jdGlvbnNcclxuICogYmVsb3csIGFsbG93cyB0aGUgY29uc3RydWN0b3IgZnVuY3Rpb24gZXhwb3J0ZWQgYnkgdGhpcyBtb2R1bGUgdG8gYmUgdXNlZFxyXG4gKiBkaXJlY3RseSBpbiB0aGlzIGNhc2UsIG9idmlhdGluZyB0aGUgbmVlZCBmb3IgdGhlIGNhbGxlciB0byBtYW51YWxseSBjcmVhdGVcclxuICogYW4gaW5zdGFuY2UuXHJcbiAqXHJcbiAqIC8vIHZlcmJvc2UgKG5vcm1hbCkgZmxvdzpcclxuICogdmFyIG9yZ2FuaXEgPSByZXF1aXJlKCdvcmdhbmlxJyk7XHJcbiAqIHZhciBvcHRpb25zID0geyAuLi4gfVxyXG4gKiB2YXIgYXBwID0gb3JnYW5pcShvcHRpb25zKTsgIC8vIGNyZWF0ZSBpbnN0YW5jZSB3aXRoIG9wdGlvbmFsIG9wdGlvbnNcclxuICogYXBwLnJlZ2lzdGVyKC4uLik7ICAgICAgICAgICAvLyBjYWxsIHZpYSBpbnN0YW5jZVxyXG4gKlxyXG4gKiAvLyB1c2luZyBzaW5nbGV0b24gcGF0dGVyblxyXG4gKiB2YXIgb3JnYW5pcSA9IHJlcXVpcmUoJ29yZ2FuaXEnKTtcclxuICogb3JnYW5pcS5yZWdpc3RlcigpOyAgLy8gaW1wbGljaXRseSBjcmVhdGUgc2luZ2xldG9uIGFuZCBjYWxsIHRocm91Z2ggaXRcclxuICogLy8gLi4uXHJcbiAqIG9yZ2FuaXEuZ2V0RGV2aWNlKCk7IC8vIGNhbGxzIHRocm91Z2ggc2FtZSBzaW5nbGV0b24gb2JqZWN0XHJcbiAqXHJcbiAqL1xyXG52YXIgU2luZ2xldG9uID0gKGZ1bmN0aW9uICgpIHtcclxuICB2YXIgbztcclxuICByZXR1cm4geyBnZXQ6IGZ1bmN0aW9uKCkgeyBpZiAoIW8pIHsgbyA9IG5ldyBPcmdhbmlxKCk7IH0gcmV0dXJuIG87IH0gfTtcclxufSkoKTtcclxuXHJcbi8qKlxyXG4gKiBDYWxscyBgcmVnaXN0ZXJEZXZpY2VgIG9mIHNpbmdsZXRvbiBvYmplY3QuXHJcbiAqXHJcbiAqIEByZXR1cm4ge0xvY2FsRGV2aWNlUHJveHl8UHJvbWlzZXxXZWJTb2NrZXREZXZpY2VQcm94eXwqfENvbm5lY3Rpb259XHJcbiAqL1xyXG5PcmdhbmlxLnJlZ2lzdGVyRGV2aWNlID0gZnVuY3Rpb24oKSB7XHJcbiAgdmFyIHMgPSBTaW5nbGV0b24uZ2V0KCk7XHJcbiAgcmV0dXJuIHMucmVnaXN0ZXJEZXZpY2UuYXBwbHkocywgYXJndW1lbnRzKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDYWxscyBgZ2V0RGV2aWNlYCBvZiBzaW5nbGV0b24gb2JqZWN0LlxyXG4gKlxyXG4gKiBAcmV0dXJuIHtMb2NhbERldmljZVByb3h5fFByb21pc2V8V2ViU29ja2V0RGV2aWNlUHJveHl8KnxDb25uZWN0aW9ufVxyXG4gKi9cclxuT3JnYW5pcS5nZXREZXZpY2UgPSBmdW5jdGlvbigpIHtcclxuICB2YXIgcyA9IFNpbmdsZXRvbi5nZXQoKTtcclxuICByZXR1cm4gcy5nZXREZXZpY2UuYXBwbHkocywgYXJndW1lbnRzKTtcclxufTtcclxuXG59KS5jYWxsKHRoaXMscmVxdWlyZSgnX3Byb2Nlc3MnKSkiXX0=
