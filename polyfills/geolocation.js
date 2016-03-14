"use strict";
(function (exports) {
    function Sensor() {
        if (this.constructor === Sensor) {
            throw new TypeError("Illegal constructor");
        }
        var eventTarget = document.createDocumentFragment();

        function addEventListener(type, listener, useCapture, wantsUntrusted) {
            return eventTarget.addEventListener(type, listener, useCapture, wantsUntrusted);
        }

        function dispatchEvent(event) {
            var methodName = "on" + event.type;
            if (typeof this[methodName] == "function") {
                this[methodName](event);
            }
            return eventTarget.dispatchEvent(event);
        }

        function removeEventListener(type, listener, useCapture) {
            return eventTarget.removeEventListener(type, listener, useCapture);
        }

        this.addEventListener = addEventListener;
        this.dispatchEvent = dispatchEvent;
        this.removeEventListener = removeEventListener;
    
    }
    
    function SensorReading() {
    }
    
    function SensorReadingEvent(type, options) {
        var event = new Event(type, options);
        event.reading = options.reading;
        event.constructor = SensorReadingEvent;
        return event;
    }
    
    var _geolocationSensor = (function() {
        var self = {};
        var SUPPORTED_REPORTING_MODES = ["auto"];
        var currentReportingMode = "auto";
        var associatedSensors = new Set();
        var state = "idle"; // one of idle, activating, active, deactivating,
        var currentReading = null;
        var cachedReading = null;
        var _promise = null;
        var _watchId = null;
        function _enableHighAccuracy() {
            var enableHighAccuracy = false;
            associatedSensors.forEach(function(sensor) {
                if (getSlot(sensor, "options").accuracy == "high") {
                    enableHighAccuracy = true;
                }
            });
            return enableHighAccuracy
        }
        
        var _options = null;
        
        function getOptions() {
            return {
                enableHighAccuracy: _enableHighAccuracy(), 
                maximumAge: 0, 
                timeout: Infinity
            };
        }
        
        function hasOptionsChanged(opt) {
            if (!_options) return true;
            if (_options.enableHighAccuracy !== opt.enableHighAccuracy) return true;
            if (_options.maximumAge !== opt.maximumAge) return true;
            if (_options.timeout !== opt.timeout) return true;
            return false;
        }
        
        function emitReadingToAll(reading) {
            // maybe we'd need active and non-active sensors queues?
            var sensors = Array.from(associatedSensors);
            sensors.forEach(function(sensor) {
                emitReading(sensor, reading)
            });
        }
        
        function register(sensor) {
            associatedSensors.add(sensor);
            var opt = getOptions();
            var optChanged = hasOptionsChanged(opt);
            _options = opt;
            var currentState = state;
            if (currentState == "idle") {
                state = "activating";
                activate(opt);
            } else if (currentState == "activating") {
                if (optChanged) activate(opt)
            } else if (currentState == "active") {
                if (optChanged) {
                    activate(opt);
                    // do we resolve the promise immediately here?
                    // do we set sensor.reading to the current reading?
                    // This is qualitative vs. quantitative.
                }
                emitReading(sensor, currentReading); // TODO maybe have an option to force new reading here.
            }
        }
        
        function deregister(sensor) {
            associatedSensors.delete(sensor);
            if (associatedSensors.size == 0) {
                state = "idle";
                navigator.geolocation.clearWatch(_watchId);
                _watchId = null;
            }
        }
        
        function ondata(position) {
            var coords = position.coords;
            var reading = currentReading = new GeolocationSensorReading({
                accuracy        : coords.accuracy,
                altitude        : coords.altitude,
                altitudeAccuracy: coords.altitudeAccuracy,
                heading         : coords.heading,
                latitude        : coords.latitude,
                longitude       : coords.longitude,
                speed           : coords.speed,
                timeStamp       : position.timestamp // watch out for the diff casing, here.
            });
            if (state == "activating") {
                state = "active";
            }
            emitReadingToAll(reading);
        }
        
        function onerror(err) {
            emitErrorToAll(err);
        }
        
        function emitErrorToAll(error) {
            var sensors = Array.from(associatedSensors);
            sensors.forEach(function(sensor) {
                var errEvent = new ErrorEvent("error", {
                    message:  err.message,
                    filename: err.filename,
                    lineno:   err.lineno,
                    colno:    err.colno,
                    error:    err
                });
                reject(sensor, err);
                sensor.dispatchEvent(errEvent);
            });
        }
        
        function activate(options) {
            if (_watchId) {
                navigator.geolocation.clearWatch(_watchId);
            }
            _watchId = navigator.geolocation.watchPosition(ondata, onerror, options);
        }
  
        self.register = register;
        self.deregister = deregister;
        return self;
    }());
    
    var GeolocationSensorReading = (function() {
        function GeolocationSensorReading(dict) {
            this.accuracy         = dict.accuracy;
            this.altitude         = dict.altitude;
            this.altitudeAccuracy = dict.altitudeAccuracy;
            this.heading          = dict.heading;
            this.latitude         = dict.latitude;
            this.longitude        = dict.longitude;
            this.speed            = dict.speed;
            this.timeStamp        = dict.timeStamp;
        }
        GeolocationSensorReading.prototype = Object.create(SensorReading.prototype, {
            // This probably needs to be changed to setters and getters, but can do for now.
            accuracy: {
                value: null,
                writable: true,
                configurable: true,
                enumerable: true
            },
            altitude: {
                value: null,
                writable: true,
                configurable: true,
                enumerable: true
            },
            altitudeAccuracy: {
                value: null,
                writable: true,
                configurable: true,
                enumerable: true
            },
            heading: {
                value: null,
                writable: true,
                configurable: true,
                enumerable: true
            },
            latitude: {
                value: null,
                writable: true,
                configurable: true,
                enumerable: true
            },
            longitude: {
                value: null,
                writable: true,
                configurable: true,
                enumerable: true
            },
            speed: {
                value: null,
                writable: true,
                configurable: true,
                enumerable: true
            }
        });
        GeolocationSensorReading.prototype.constructor = GeolocationSensorReading;
        return GeolocationSensorReading;
    })();

    var privateData = new WeakMap();
    function setSlot(self, name, value) {
        var priv = privateData.get(self) || {};
        priv[name] = value;
        privateData.set(self, priv);
        console.log("setSlot", name, value)
    
    }
    function getSlot(self, name) {
        var priv = privateData.get(self) || {};
        console.log("getSlot", name, priv[name])
        return priv[name];
    }
    
    function reject(self, error) {
        var rj = getSlot(self, "_startPromiseReject");
        setSlot(self, "state", "idle");
        setSlot(self, "_startPromise", null);
        setSlot(self, "_startPromiseResolve", null);
        setSlot(self, "_startPromiseReject", null);
        self.reading = null;
        rj(error);
    }
    
    function emitReading(sensor, reading) {
        sensor.reading = reading;
        if (sensor.state != "active") {
            var resolve = getSlot(sensor, "_startPromiseResolve");
            setSlot(sensor, "state", "active");
            setSlot(sensor, "_startPromiseResolve", null);
            setSlot(sensor, "_startPromiseReject", null);
            resolve();
        }
        var event = new SensorReadingEvent("reading", {
            reading: reading
        });
        sensor.dispatchEvent(event);
    }
    var GeolocationSensor = (function () {
        
        function GeolocationSensor(options) {
            setSlot(this, "options", options);
            setSlot(this, "state", "idle");
            Sensor.call(this);
        }
        GeolocationSensor.prototype = Object.create(Sensor.prototype);
        GeolocationSensor.prototype.constructor = GeolocationSensor;
    
        GeolocationSensor.prototype.start = function() {
            console.log(getSlot(this, "state"))
            if (getSlot(this, "state") == "idle") {
                var self = this;
                setSlot(self, "state", "activating");
                _geolocationSensor.register(sensor);
                setSlot(self, "_startPromise", new Promise(function(resolve, reject) {
                    setSlot(self, "_startPromiseResolve", resolve);
                    setSlot(self, "_startPromiseReject", reject);
                }));
            }
            return getSlot(this, "_startPromise");
        };
    
        GeolocationSensor.prototype.stop = function() {
            var state = getSlot(this, "state");
            if (state == "idle") {
                return;
            }
            setSlot(this, "state", "idle");
            _geolocationSensor.deregister(this);
            if (state == "activating") {
                reject(this, new Error("abort")); // TODO improve error message
            }
        };
    
        GeolocationSensor.prototype.reading = null;
        return GeolocationSensor;
    })();
    
    exports.Sensor                   = exports.Sensor                   || Sensor;
    exports.SensorReading            = exports.SensorReading            || SensorReading;
    exports.SensorReadingEvent       = exports.SensorReadingEvent       || SensorReadingEvent;
    exports.GeolocationSensorReading = exports.GeolocationSensorReading || GeolocationSensorReading;
    exports.GeolocationSensor        = exports.GeolocationSensor        || GeolocationSensor;

})(window);





//window.GeolocationSensor.requestData = function(options) {
//    return new Promise(function(resolve, reject) {
//        function onsuccess(position) {
//            resolve({
//                latitude: position.coords.latitude,
//                longitude: position.coords.longitude,
//                accuracy: position.coords.accuracy
//            });
//        }
//        
//        function onerror(err) {
//            if (err.code === err.TIMEOUT) {
//                resolve(null);
//            } else {
//                reject(err);
//            }
//        }
//        var timeout = Infinity;
//        if ("timeout" in options) timeout = options.timeout;
//        if (options.fromCache) timeout = 0; // instant timeout to only get data from the cache
//        
//        navigator.geolocation.getCurrentPosition(onsuccess, onerror, {
//            enableHighAccuracy: options.accuracy == "high", 
//            maximumAge: options.maximumAge == null ? Infinity : options.maximumAge,
//            timeout: timeout
//        });
//    });
//}
