import THREE from 'three';
import { debounce } from '../common/utils.js';

THREE.VRCursor = function(modeVR) {
    'use strict';

    var self = this;

    this.enabled = false;

    // current scene context in which the cursor is operating
    this.context = null;

    // Object 3d for cursor
    this.layout = null;

    // system mouse vector
    this.mouse = null;

    this.rotation = {
        x: 0,
        y: 0,
        xInc: 0,
        yInc: 0
    };

    // VR cursor position
    this.position = {
        x: 0,
        y: 0
    };

    this.modes = {
        centered: 1,
        mouseSync: 2,
        inFOV: 3,
        hides: 4,
        mono: 5
    };

    // VR Cursor events
    this.events = {
        clickEvent: {
            type: 'click'
        },
        mouseMoveEvent: {
            type: 'mousemove'
        },
        mouseOverEvent: {
            type: 'mouseover'
        },
        mouseOutEvent: {
            type: 'mouseout'
        },
        mouseDownEvent: {
            type: 'mousedown'
        }
    };

    // object which cursor currently intersects
    this.objectMouseOver = null;

    // requires three.js dom and camera to initialize cursor.
    this.init = function(camera, items) {
        self.camera = camera;
        self.items = items;
    };

    // cursor operating mode
    this.mode = modeVR || 'centered';

    this.setMode = function(mode) {
        console.log('setting cursor: ' + mode);

        self.mode = self.modes[mode];

        switch (self.mode) {
            case self.modes.centered:
                self.updatePosition = updatePositionCentered;
                break;
            case self.modes.mouseSync:
                self.updatePosition = updatePositionMouseSync;
                break;
            case self.modes.inFOV:
                self.updatePosition = updatePositionInFOV;
                break;
            case self.modes.hides:
                self.updatePosition = updatePositionHides;
                break;
            case self.modes.mono:
                self.updatePosition = function() {};
                break;
        }
    };

    this.setMode(this.mode);

    //  return promise when all the necessary three cursor components are ready.
    this.ready = new Promise(function(resolve) {
        self.layout = new THREE.Group();
        self.raycaster = new THREE.Raycaster();
        self.cursorPivot = new THREE.Object3D();
        //self.projector = new THREE.Projector();

        // cursor mesh
        self.cursorMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.005, 5, 5),
            new THREE.MeshBasicMaterial({
                color: Math.random() * 0xffffff,
                side: THREE.DoubleSide
            })
        );

        // set the depth of cursor
        self.cursorMesh.position.z = -2;

        self.cursorPivot.add(self.cursorMesh);

        self.layout.add(self.cursorPivot);

        resolve();
    });

    // VR Cursor events
    function onMouseMoved(e) {
        e.preventDefault();

        if (!self.enabled) {
            return false;
        }

        // get vectors for 2d mono mouse
        if (self.mode == self.modes.mono) {
            var mouse = new THREE.Vector3(
                (e.clientX / window.innerWidth) * 2 - 1, //x
                -(e.clientY / window.innerHeight) * 2 + 1, //y
                0.5);
            mouse.unproject(self.camera);
            mouse.sub(self.camera.position);
            mouse.normalize();
            self.mouse = mouse;
            //console.log('mouse', self.mouse);
        }

        // everything below assumes pointerlock
        if (self.mode === self.modes.hides) {
            if (!self.cursorMesh.visible) {
                self.showQuat = new THREE.Quaternion().copy(self.headQuat());
                self.rotation.x = 0;
                self.rotation.y = 0;
                self.show();
            }
            self.hide(3000);
        }

        var movementX = e.movementX ||
            e.mozMovementX ||
            e.webkitMovementX || 0;

        var movementY = e.movementY ||
            e.mozMovementY ||
            e.webkitMovementY || 0;

        // var elHalfWidth = self.elWidth / 2;
        // var elHalfHeight = self.elHeight / 2;
        // var minX = -elHalfWidth;
        // var maxX = elHalfWidth;
        // var minY = -elHalfHeight;
        // var maxY = elHalfHeight;
        var pixelsToDegreesFactor = 0.00025;

        // Rotation in degrees
        var x = (movementX * pixelsToDegreesFactor) % 360;
        var y = (movementY * pixelsToDegreesFactor) % 360;

        // To Radians
        self.rotation.x -= y * 2 * Math.PI;
        self.rotation.y -= x * 2 * Math.PI;
        //console.log('rotation', self.rotation);
    }

    function onMouseClicked(e) {
        //  debugger
        var target = e.target;

        if (!self.enabled) {
            return false;
        }
        if (target.tagName == 'BODY' ||
            target.tagName == 'CANVAS' &&
            self.objectMouseOver) {
            if (self.objectMouseOver.allAncestors(function() {
                    return self.visible
                })) {
                self.objectMouseOver.dispatchEvent(self.events.clickEvent);
            }
        }
    }

    // binds mouse events
    //self.bindEvents = function() {
        var body = document.body;
//        var onMouseMoved = self.onMouseMoved.bind(self);
//        var onMouseClicked = self.onMouseClicked.bind(self);

        body.addEventListener('mousemove', onMouseMoved, false);
        body.addEventListener('click', onMouseClicked, false);
    //};

    // bind "real" mouse events.
    //self.bindEvents();

    // enable cursor with context, otherwise pick last
    this.enable = function(items) {
        if (items) {
            self.items = items;
        }
        if (!self.enabled) {
console.log('cursor enable');
            self.enabled = true;
            self.layout.visible = true;
        }
    };

    this.disable = function() {
        if (self.enabled) {
console.log('cursor disable');
            self.enabled = false;
            self.layout.visible = false;
        }
    };

    this.clampAngleTo = function(angle, boundary) {
        if (angle < -boundary) {
            return -boundary;
        }
        if (angle > boundary) {
            return boundary;
        }
        return angle;
    };

    this.hide = function(delay, hidden) {
        clearTimeout(self.hideCursorTimeout);
        self.hideCursorTimeout = setTimeout(hideCursor, delay);

        function hideCursor() {
            self.cursorMesh.visible = false;
            if (hidden) {
                hidden();
            }
        }
    };

    this.show = function() {
        self.cursorMesh.visible = true;
    };

    this.headQuat = function() {
        var headQuat = self.camera.quaternion;
        // // If head quaternion is null we make the identity so
        // it doesn't affect the rotation composition
        if (headQuat.x === 0 &&
            headQuat.y === 0 &&
            headQuat.z === 0) {
            headQuat.w = 1;
        }
        return headQuat;
    };

    this.update = function(headQuat) {
        self.updatePosition();
        // It updates hits
        updateCursorIntersection();
    };

    function updatePositionMouseSync(headQuat) {
        var headQuat = self.headQuat();
        self.rotation.x = self.clampAngleTo(self.rotation.x, Math.PI / 6);
        self.rotation.y = self.clampAngleTo(self.rotation.y, Math.PI / 6);
        var rotation = new THREE.Euler(self.rotation.x, self.rotation.y, 0);
        var mouseQuat = new THREE.Quaternion().setFromEuler(rotation, true);
        var cursorPivot = self.cursorPivot;
        var pivotQuat = new THREE.Quaternion();
        pivotQuat
            .multiply(headQuat)
            .multiply(mouseQuat)
            .normalize();
        cursorPivot.setRotationFromQuaternion(pivotQuat);
    };

    function updatePositionCentered(headQuat) {
        var headQuat = self.headQuat();
        var cursorPivot = self.cursorPivot;
        //  var pivotQuat = new THREE.Quaternion();
        var pivotQuat = headQuat;
        //  pivotQuat.multiply(headQuat);
        cursorPivot.setRotationFromQuaternion(pivotQuat);
        cursorPivot.position.copy(self.camera.position)
    };

    function updatePositionInFOV(headQuat) {
        var headQuat = self.headQuat();
        var headQuatInv = new THREE.Quaternion().copy(headQuat).inverse();
        var cursorPivot = self.cursorPivot;
        var pivotQuat = new THREE.Quaternion();
        var mouseQuat = mouseQuat();
        if (self.cameraCursorAngle >= (Math.PI / 5)) {
            self.lockQuat = self.lockQuat || self.validCameraCursorQuat;
            // cameraCursorEuler =  new THREE.Euler().setFromQuaternion(self.lockQuat);
            // console.log("CAMERA CURSOR " + self.cameraCursorAngle);
            // console.log("ANGLE " + JSON.stringify(cameraCursorEuler.x));
            // console.log("MOUSE " + JSON.stringify(self.rotation.x));
            // self.rotation.x = cameraCursorEuler.x;
            // self.rotation.y = cameraCursorEuler.y;
            pivotQuat.multiply(headQuat).normalize().multiply(self.lockQuat);
        } else {
            self.lockQuat = undefined;
            pivotQuat.multiply(headQuat).multiply(mouseQuat).multiply(headQuatInv);
        }
        // if (self.quaternionsAngle(headQuat, pivotQuat) >= (Math.PI / 5)) {
        //   pivotQuat.multiply(self.mouseQuat.inverse());
        // }
        cursorPivot.quaternion.copy(pivotQuat);
        self.validCameraCursorQuat = cameraCursorQuat(cursorPivot.quaternion || new THREE.Quaternion());
        self.cameraCursorAngle = quaternionsAngle(headQuat, cursorPivot.quaternion);
    };

    function mouseQuat() {
        //self.rotation.x = self.clampAngleTo(self.rotation.x, Math.PI / 5);
        //self.rotation.y = self.clampAngleTo(self.rotation.y, Math.PI / 5);
        var rotation = new THREE.Euler(self.rotation.x, self.rotation.y, 0);
        return new THREE.Quaternion().setFromEuler(rotation, true);
    };

    function quaternionsAngle(q1, q2) {
        var v1 = new THREE.Vector3(0, 0, -1);
        var v2 = new THREE.Vector3(0, 0, -1);
        v1.applyQuaternion(q1);
        v2.applyQuaternion(q2);
        return Math.abs(v1.angleTo(v2));
    }

    function updatePositionHides(headQuat) {
        var rotation = new THREE.Euler(self.rotation.x, self.rotation.y, 0);
        var mouseQuat = new THREE.Quaternion().setFromEuler(rotation, true);
        var cursorPivot = self.cursorPivot;
        var headQuat = self.headQuat();
        var pivotQuat = new THREE.Quaternion();
        var showQuat = self.showQuat || new THREE.Quaternion();
        var cameraCursorAngle;
        pivotQuat.multiply(showQuat);
        pivotQuat.multiply(mouseQuat).normalize();
        cursorPivot.quaternion.copy(pivotQuat);
        cameraCursorAngle = quaternionsAngle(headQuat, cursorPivot.quaternion);
        // if the cursor lives the FOV it hides
        if (cameraCursorAngle >= Math.PI / 3) {
            self.hide(0);
        }
    };

    // Detect intersections with three.js scene objects (context) and dispatch mouseover and mouseout events.
    function updateCursorIntersection() {
        var camera = self.camera;
        var raycaster = self.raycaster;
        var cursorMesh = self.cursorMesh;
        var mouse = self.mouse;

        if (!camera) {
            // no camera available yet.
            return false;
        }

        if (mouse && self.mode === self.modes.mono) {
            raycaster.set(camera.position, mouse);
        } else {
            cursorMesh.updateMatrixWorld(true);
            var cursorPosition = cursorMesh.matrixWorld;
            var vector = new THREE.Vector3().setFromMatrixPosition(cursorPosition);

            // Draws RAY
            // var geometry = new THREE.Geometry();
            // geometry.vertices.push(camera.position);
            // geometry.vertices.push(vector.sub(camera.position).normalize().multiplyScalar(5000));
            //
            // self.context.remove(self.line);
            // self.line = new THREE.Line(geometry, new THREE.LineBasicMaterial({color: 0xFF0000}));
            // self.context.add(self.line);

            raycaster.set(camera.position, vector.sub(camera.position).normalize());
        }

        //var intersects = raycaster.intersectObjects(self.context.children);
        var intersects = raycaster.intersectObjects(self.items);
//console.log('intersects.length', intersects.length);

        // var objectMouseOver = self.objectMouseOver;
        // var events = self.events;
        //
        // if (intersects.length === 0 && objectMouseOver !== null) {
        //     self.objectMouseOver.dispatchEvent(events.mouseOutEvent);
        //     //console.log('intersected(mouseOut)', self.objectMouseOver);
        //     self.objectMouseOver = null;
        // }

        // var intersected;
        // var i;
        for (var i = 0; i < intersects.length; ++i) {
//            var intersected = intersects[i].object;
//console.log('intersected:', intersected);
//console.log('objectMouseOver:', objectMouseOver);
//console.log('self.objectMouseOver', self.objectMouseOver);
//            if (intersected !== objectMouseOver) {
//                if (objectMouseOver !== null) {
//                    objectMouseOver.dispatchEvent(events.mouseOutEvent);
//console.log('objectMouseOver:', objectMouseOver);
//                }
//                if (intersected !== null) {
//console.log('intersected:', intersected);
//                    if (intersected.allAncestors(function() {
//                            return self.visible;
//                        })) {
//                        intersected.dispatchEvent(events.mouseOverEvent);
                        intersects[i].type = 'mousemove';
                        intersects[i].object.dispatchEvent(intersects[i]);

                        //console.log('intersected(mouseOver)', intersected);
//                    }
//                }

//                self.objectMouseOver = intersected;
//            }
        }
    }

//  let raycaster = new THREE.Raycaster();

    this.setEvents = function(camera, items, type, wait) {
      var raycaster = self.raycaster;
      var cursorMesh = self.cursorMesh;

      let listener = function(event) {

        let mouse = {
          x: ((event.clientX - 1) / window.innerWidth ) * 2 - 1,
          y: -((event.clientY - 1) / window.innerHeight) * 2 + 1
        };

        let vector;

        if (mouse && self.mode === self.modes.mono) {
          vector = new THREE.Vector3();
          vector.set(mouse.x, mouse.y, 0.5);
          vector.unproject(camera);

          //  raycaster.set(camera.position, mouse);
        } else {
            cursorMesh.updateMatrixWorld(true);
            var cursorPosition = cursorMesh.matrixWorld;
            vector = new THREE.Vector3().setFromMatrixPosition(cursorPosition);
console.log('cursorPosition:', cursorPosition);

            // Draws RAY
            // var geometry = new THREE.Geometry();
            // geometry.vertices.push(camera.position);
            // geometry.vertices.push(vector.sub(camera.position).normalize().multiplyScalar(5000));
            //
            // self.context.remove(self.line);
            // self.line = new THREE.Line(geometry, new THREE.LineBasicMaterial({color: 0xFF0000}));
            // self.context.add(self.line);

        }
        raycaster.set(camera.position, vector.sub(camera.position).normalize());

        let target = raycaster.intersectObjects(items);

        if (target.length) {
console.log('target[0]:', target[0]);
          target[0].type = type;
          target[0].object.dispatchEvent(target[0]);
        }

      };

      if (!wait) {
        document.addEventListener(type, listener, false);
      } else {
        document.addEventListener(type, debounce(listener, wait), false);
      }
    }

    // function quaternionsQuat(q1, q2) {
    //     var v1 = new THREE.Vector3(0, 0, -1);
    //     var v2 = new THREE.Vector3(0, 0, -1);
    //     v1.applyQuaternion(q1);
    //     v2.applyQuaternion(q2);
    //     return new THREE.Quaternion().setFromUnitVectors(v1, v2);
    // };

    function cameraCursorQuat(mouseQuat) {
        var cameraQuat = self.headQuat();
        var cameraVector = new THREE.Vector3(0, 0, -1);
        var cursorPivotVector = new THREE.Vector3(0, 0, -1);
        cameraVector.applyQuaternion(cameraQuat).normalize();
        cursorPivotVector.applyQuaternion(mouseQuat).normalize();
        //var resultQuat = new THREE.Quaternion();
        //THREE.Quaternion.slerp(cameraQuat, mouseQuat, resultQuat);
        //return resultQuat;
        return new THREE.Quaternion().setFromUnitVectors(cameraVector, cursorPivotVector);
    };

    function cameraCursorAngle() {
        var cameraQuat = self.headQuat();
        var cameraVector = new THREE.Vector3(0, 0, -1);
        var cursorPivot = self.cursorPivot;
        var cursorPivotVector = new THREE.Vector3(0, 0, -1);
        cameraVector.applyQuaternion(cameraQuat);
        cursorPivotVector.applyQuaternion(cursorPivot.quaternion);
        return Math.abs(cursorPivotVector.angleTo(cameraVector));
    };

};
