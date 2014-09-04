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
* *exposeOn*: optional, only register the health-check route on servers with one of the specified labels.
* *metadata*: optional, information that will be merged with the health-check result object. Will *not* overwrite existing attributes of the result object.

## Registering a health-check

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
          mark();
        }, 50);
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
            "elapsed": 54951
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
