/* jshint node: true */
'use strict';

var lib = {
  os: require('os'),
  Hale: require('./lib/Hale'),
  lodash: require('lodash'),
  assert: require('assert'),
};

var _ = lib.lodash;

exports.register = function (plugin, options, next) {
  lib.assert(typeof options.path === 'string' || typeof options.path === 'undefined',
    'The "path" option must either be a string or undefined');
  lib.assert(typeof options.publicPath === 'string' || typeof options.publicPath === 'undefined',
    'The "publicPath" option must either be a string or undefined');
  lib.assert(typeof options.metadata === 'object' || typeof options.metadata === 'undefined',
    'The "metadata" option must either be an object or undefined');
  lib.assert(typeof options.routeConfig === 'object' || typeof options.routeConfig === 'undefined',
    'The "routeConfig" option must either be an object or undefined');

  lib.assert(Array.isArray(options.exposeOn) || typeof options.exposeOn === 'undefined',
    'The "exposeOn" option must either be an array or undefined');
  if (options.exposeOn) {
    options.exposeOn.forEach(function checkLabel(label, index) {
      lib.assert(typeof label === 'string',
        'The label at index ' + index + ' is not a string');
    });
  }

  lib.assert(Array.isArray(options.exposePublicOn) || typeof options.exposePublicOn === 'undefined',
    'The "exposePublicOn" option must either be an array or undefined');
  if (options.exposePublicOn) {
    options.exposePublicOn.forEach(function checkLabel(label, index) {
      lib.assert(typeof label === 'string',
        'The label at index ' + index + ' is not a string');
    });
  }

  var metadata = _.defaults(options.metadata || {}, {
    name: process.title,
    hostname: lib.os.hostname(),
  });
  var hale = new lib.Hale(plugin, metadata);

  plugin.expose('addCheck', hale.addCheck.bind(hale));

  var selection = options.exposeOn ? plugin.select(options.exposeOn) : plugin;
  plugin.bind(hale);
  selection.route({
    method: 'GET',
    path: options.path || '/healthcheck',
    handler: hale.checkRequest,
    config: options.routeConfig || {},
  });

  if (options.exposePublicOn) {
    plugin.select(options.exposePublicOn).route({
      method: 'GET',
      path: options.publicPath || options.path || '/healthcheck',
      handler: hale.publicCheckRequest,
      config: options.routeConfig || {},
    });
  }

  next();
};

exports.register.attributes = {
  pkg: require('./package.json')
};
