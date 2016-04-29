VRClient = function(container) {
    var self = this;

    // call back for render mode changes.
    this.onRenderModeChange = null;

    // this promise resolves when VR devices are detected.
    this.getVR = new Promise(function (resolve, reject) {
      if (navigator.getVRDevices) {
        navigator.getVRDevices().then(function (devices) {
          for (var i = 0; i < devices.length; ++i) {
            if (devices[i] instanceof HMDVRDevice && !self.hmdDevice) {
              self.hmdDevice = devices[i];
            }
            if (devices[i] instanceof PositionSensorVRDevice &&
                devices[i].hardwareUnitId == self.hmdDevice.hardwareUnitId &&
                !self.positionDevice) {
              self.positionDevice = devices[i];
              break;
            }
          }
          if (self.hmdDevice && self.positionDevice) {
            console.log('VR devices detected');
            resolve({
              hmd: self.hmdDevice,
              position: self.positionDevice
            });
            return;
          }
          reject('no VR devices found!');
        }).catch(reject);
      } else {
        console.warn('no VR implementation found!');
//        reject('no VR implementation found!');
      }
    });

    this.wait = new Promise(function (resolve) {
      self.startDemo = resolve;
    });

    window.addEventListener('message', function (e) {
console.log('message received ', e);
      var msg = e.data;
      if (!msg.type) {
        return;
      }
console.log('message received ', msg.type, msg.data);

      switch (msg.type) {
        case 'start':
          self.startDemo();
          break;
        case 'renderMode':
          self.setRenderMode(msg.data);
          break;
        case 'onZeroSensor':
          self.zeroSensor();
          break;
        case 'loaderReady':
          if (typeof self.onReady == 'function') {
            self.onReady();
          }
          break;
        case 'onBlur':
          if (typeof self.onBlur == 'function') {
            self.onBlur();
          }
          break;
        case 'onFocus':
          if (typeof self.onFocus == 'function') {
            self.onFocus();
          }
          break;
      }
    }, false);

  function sendMessage(type, data) {
    if (window.parent !== window) {
      window.parent.postMessage({
        type: type,
        data: data
      }, '*');
    }
  }

  this.load = function (url) {
    sendMessage('load', url);
  };

  // Takes value 0..1 to represent demo load progress. Optional.
  this.progress = function (val) {
    sendMessage('progress', val);
  };

  // Notifies VRManager that demo is ready. Required.
  this.ready = function () {
    sendMessage('ready');
    return this.wait;
  };

  // if this demo has an completed and we can shit it down.
  this.ended = function() {
    sendMessage('ended');
  };


  this.zeroSensor = function () {
    var self = this;
    self.getVR.then(function () {
      if (typeof self.onZeroSensor == 'function') {
        self.onZeroSensor();
      }
    });
  };

  this.setRenderMode = function(mode) {
    var self = this;

    if (typeof self.onRenderModeChange == 'function') {
      self.onRenderModeChange(mode);
    }
  };

  this.renderModes = {
    mono: 1,
    stereo: 2,
    vr: 3
  };

};
