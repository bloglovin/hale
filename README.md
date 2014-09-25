# Hale - structured health-checks

Hale collects health-check information from the different parts of your apps.

## Registering the hale plugin

```js
pack.register({
  plugin: require('hale'),
  options: {
    path: '/healthcheck',
    routeConfig: {},
    exposeOn: ['admin'],
    metadata: {
      name: 'my service name',
      version: '1.0.2',
    },
  },
});
```

### Options

* *path*: optional, the path to use for the health-check route, defaults to '/healthcheck'.
* *routeConfig*: optional, object that will be used as config for the health-check route.
* *exposeOn*: optional, only register the health-check route on servers with the specified labels, registers on all servers in the pack by default.
* *exposePublicOn*: optional, register a simple health-check route on the servers with the specified labels, no public healthcheck is registered by default.
* *publicPath*: optional, the path to use for the public health-check route, defaults to '/healthcheck'.
* *metadata*: optional, information that will be merged with the health-check result object. Will *not* overwrite existing attributes of the result object.

## Registering a health-check

The hale plugin exposes an `addCheck` function that is used to register health-checks. A health-check is an object with the following options:

* *name*: the name of the healthcheck.
* *description*: a description of the healthcheck.
* *tags*: optional, tags to set for the healthcheck.
* *timeout*: optional, timeout in milliseconds for the healtcheck, defaults to 2000.
* *handler*: function(collector, done) the function that performs the check.

### The collector object

The collector object exposes functions for logging events, timing operations, and capturing context data.

* `collector.info(message, [data])`: Log an info event.
* `collector.notice(message, [data])`: Log a notice event.
* `collector.warning(message, [data])`: Log a warning event.
* `collector.failure(message, [data])`: Log a failure event.
* `collector.mark(name)`: Start a timer that can be used to mark checkpoints. Returns a `function([label])` that can be used to add a mark with a label.
* `collector.context(name, data)`: Add context data to the check.

```js
plugin.dependency('hale', function registerHealthcheck(plugin, next) {
  plugin.plugins.hale.addCheck({
      name: 'randomiser',
      description: 'Random behaviour',
      tags: ['amore', 'erratic'],
      handler: function erraticGuy(collector, done) {
        var rationale = Math.random();

        collector.info('Random musings');

        if (rationale < 0.25) {
          collector.info('All is good', {mood: 'great'});
        }
        else if (rationale < 0.50) {
          collector.notice('Sooo, what is this?', {mood: 'ambivalent'});
        }
        else if (rationale < 0.75) {
          collector.warning('I don\'t want to!', {mood: 'angry'});
        }
        else {
          collector.failure('Gaaaah!', {mood: 'berserk'});
        }
        done();
      },
    });

    plugin.plugins.hale.addCheck({
      name: 'timeouter',
      description: 'Fail with timeout',
      tags: ['amore', 'failure'],
      timeout: 100,
      handler: function (collector) {
        var mark = collector.mark('almost');
        setTimeout(function partial() {
          mark('halfway');
        }, 50);

        setTimeout(function partial() {
          mark('Sooo close!');
        }, 75);
      },
    });

    plugin.plugins.hale.addCheck({
      name: 'exceptional',
      description: 'Fail with a bang',
      tags: ['amore', 'failure'],
      handler: function () {
        throw new Error('I\'m with stupid!');
      },
    });

  next();
});
```

## Result

The status of each individual check will be the that of the "worst" logged event. Log item statuses map to overall health status like this:

* _info_: OK
* _notice_: OK
* _warning_: WARN
* _failure_: FAIL

Likewise the status of the overall health-check will be that of the worst individual check.

The top level `time` attributes is a Unix timestamp representing the time the helthcheck was performed. `checks[*].time` is the elapsed time for the individual health-check in microseconds. In `checks[*].context.times[*]` the `start` attribute is the elapsed time since the check started and `.marks[*].elapsed` is the number of microseconds since the mark timer started.

```json
{
  "time": 1409751843556,
  "status": "FAIL",
  "checks": [
    {
      "name": "http",
      "description": "Response metrics",
      "status": "OK",
      "tags": [
        "amore"
      ],
      "time": 159,
      "context": {
        "log": []
      }
    },
    {
      "name": "randomiser",
      "description": "Random behaviour",
      "status": "WARN",
      "tags": [
        "amore",
        "erratic"
      ],
      "time": 137,
      "context": {
        "log": [
          {
            "status": "info",
            "message": "Random musings"
          },
          {
            "status": "warning",
            "message": "I don't want to!",
            "data": {
              "mood": "angry"
            }
          }
        ]
      }
    },
    {
      "name": "timeouter",
      "description": "Fail with timeout",
      "status": "FAIL",
      "tags": [
        "amore",
        "failure"
      ],
      "time": 104662,
      "context": {
        "times": [
          {
            "name": "almost",
            "start": 4,
            "marks": [
              {
                "label": "halfway",
                "elapsed": 50178
              },
              {
                "label": "Sooo close!",
                "elapsed": 78729
              }
            ]
          }
        ],
        "log": [
          {
            "status": "failure",
            "message": "Healthcheck timed out",
            "data": {
              "name": "Error",
              "stack": "Error: Healthcheck timed out\n    at abort [as _onTimeout] (./hale/lib/Hale.js:57:18)\n    at Timer.listOnTimeout [as ontimeout] (timers.js:112:15)",
              "message": "Healthcheck timed out"
            }
          }
        ]
      }
    },
    {
      "name": "exceptional",
      "description": "Fail with a bang",
      "status": "FAIL",
      "tags": [
        "amore",
        "failure"
      ],
      "time": 226,
      "context": {
        "log": [
          {
            "status": "failure",
            "message": "I'm with stupid!",
            "data": {
              "name": "Error",
              "stack": "Error: I'm with stupid!\n    at Object.plugin.plugins.hale.addCheck.handler (./healthcheck.js:86:15)\n...",
              "message": "I'm with stupid!"
            }
          }
        ]
      }
    }
  ],
  "name": "core",
  "version": "1.0.0",
  "hostname": "max-normal.local"
}
```
