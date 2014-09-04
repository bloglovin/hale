/* jshint node: true */
/* global -Promise */
'use strict';

var lib = {
  hoek: require('hoek'),
  promise: require('promise'),
  assert: require('assert'),
  lodash: require('lodash'),
};

var Promise = lib.promise;
var _ = lib.lodash;

function Hale(plugin, metadata) {
  this.plugin = plugin;
  this.metadata = metadata;
  this.checks = {};
}

Hale.prototype.addCheck = function (check) {
  lib.assert(typeof check === 'object',
    'The healthcheck must to be an object');
  lib.assert(typeof check.name === 'string',
    'Missing a "name" string property');
  lib.assert(typeof this.checks[check.name] === 'undefined',
    'A healthcheck with the name ' + JSON.stringify(check.name) + 'has already been registered');
  lib.assert(typeof check.description === 'string',
    'Missing a "description" string property');
  lib.assert(typeof check.handler === 'function',
    'Missing a "handler" function property');
  lib.assert(typeof check.timeout === 'number' || typeof check.timeout === 'undefined',
    'The "timeout" property must either be an number or undefined');

  lib.assert(Array.isArray(check.tags) || typeof check.tags === 'undefined',
    'The "tags" property must either be an array or undefined');
  if (check.tags) {
    check.tags.forEach(function checkTag(tag, index) {
      lib.assert(typeof tag === 'string',
        'The tag at index ' + index + ' is not a string');
    });
  }

  this.checks[check.name] = lib.hoek.cloneWithShallow(check,
    ['name', 'description', 'handler', 'timeout', 'tags']);
};

Hale.prototype.checkRequest = function (request, response) {
  var maxLevel = 0;

  var results = _.map(this.checks, function runTest(check) {
    var collector = new StatusCollector(check);

    var result = new Promise(function performCheck(resolve, reject) {
        var timeout = setTimeout(function abort() {
          reject(new Error('Healthcheck timed out'));
        }, check.timeout || 2000);

        collector.begin();

        check.handler(collector, function checkDone(err) {
          clearTimeout(timeout);
          // Errors are OK in this context, it just means that the health-check
          // has failed.
          resolve(err);
        });
      })
      .then(undefined, function handleException(err) {
        // Handle exceptions thrown by the handler, this means that the
        // health-check has failed.
        return err;
      })
      .then(function handleResult(failure) {
        if (failure) {
          collector.failure(failure.message, failure);
        }

        collector.end();

        // Adjust the overall status level
        maxLevel = Math.max(collector.level, maxLevel);

        return collector.toObject();
      });

    return result;
  });

  var metadata = this.metadata;
  Promise.all(results).done(function buildResponse(checks) {
    var data = _.defaults({
      time: Date.now(),
      status: StatusCollector.levelNames[maxLevel],
      checks: checks,
    }, metadata);

    response(data);
  });
};

function StatusCollector(check) {
  this.check = check;
  this.statuses = [];
  this.times = [];
  this.level = 0;
  this._context = {};

  var collector = this;
  // Create status collection functions.
  StatusCollector.levels.forEach(function addCollectionFunction(name, ordinal) {
    collector[name] = logStatus.bind(collector, collector, ordinal);
  });
}

// Status levels. The `levels` are used internally as they're nicer than the
// `levelNames` that we communicate externally.
StatusCollector.levels     = ['info', 'notice', 'warning', 'failure'];
StatusCollector.levelNames = ['OK',   'OK',     'WARN',    'FAIL'];

StatusCollector.prototype.begin = function() {
  this.started = process.hrtime();
};

StatusCollector.prototype.end = function() {
  this.elapsedTime = process.hrtime(this.started);
};

StatusCollector.prototype.mark = function(name) {
  var collector = this;
  var start = process.hrtime();
  var startOffset = process.hrtime(this.started);

  return function markDone() {
    collector.times.push({
      name: name,
      start: microseconds(startOffset),
      elapsed: microseconds(process.hrtime(start)),
    });
  };
};

StatusCollector.prototype.context = function(name, data) {
  this._context[name] = data;
};

StatusCollector.prototype.toObject = function() {
  var digest = {
    name: this.check.name,
    description: this.check.description,
    status: StatusCollector.levelNames[this.level],
    tags: this.check.tags,
    time: microseconds(this.elapsedTime),
    context: _.defaults({
      times: this.times.length ? this.times : undefined,
      log: this.statuses,
    }, this._context),
  };
  return digest;
};

function microseconds(hrtuple) {
  return Math.round(hrtuple[0] * 1e6 + hrtuple[1] / 1e3);
}

function logStatus(collector, ordinal, message, data) {
  if (data instanceof Error) {
    data = {
      name: data.name || 'error',
      stack: data.stack,
      message: data.message,
    };
  }

  // Set the overall collector level to the max of all levels.
  collector.level = Math.max(ordinal, collector.level);

  collector.statuses.push({
    status: StatusCollector.levels[ordinal],
    message: message,
    data: data
  });
}

module.exports = Hale;
