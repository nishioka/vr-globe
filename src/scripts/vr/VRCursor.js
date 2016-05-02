import THREE from 'three';

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

        // cursor mesh
        self.cursorMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.02, 5, 5),
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
    function onMouseMoved(event) {
        event.preventDefault();

        if (!self.enabled) {
            return false;
        }

        // get vectors for 2d mono mouse
        if (self.mode == self.modes.mono) {
            var mouse = new THREE.Vector3(
                (event.clientX / window.innerWidth) * 2 - 1, //x
                -(event.clientY / window.innerHeight) * 2 + 1, //y
                0.5);
            mouse.unproject(self.camera);
            mouse.sub(self.camera.position);
            mouse.normalize();
            self.mouse = mouse;
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

        var movementX = event.movementX ||
            event.mozMovementX ||
            event.webkitMovementX || 0;

        var movementY = event.movementY ||
            event.mozMovementY ||
            event.webkitMovementY || 0;

        var pixelsToDegreesFactor = 0.00025;

        // Rotation in degrees
        var x = (movementX * pixelsToDegreesFactor) % 360;
        var y = (movementY * pixelsToDegreesFactor) % 360;

        // To Radians
        self.rotation.x -= y * 2 * Math.PI;
        self.rotation.y -= x * 2 * Math.PI;
    }

    function onMouseClicked(event) {
        //  debugger
        var target = event.target;

        if (!self.enabled) {
            return false;
        }
        if (target.tagName == 'BODY' ||
            target.tagName == 'CANVAS' &&
            self.objectMouseOver) {
            self.objectMouseOver.type = 'click';
            self.objectMouseOver.object.dispatchEvent(self.objectMouseOver);
        }
    }

    // bind "real" mouse events.
    var body = document.body;

    body.addEventListener('mousemove', onMouseMoved, false);
    body.addEventListener('click', onMouseClicked, false);

    // enable cursor with context, otherwise pick last
    this.enable = function(items) {
        if (items) {
            self.items = items;
        }
        if (!self.enabled) {
            self.enabled = true;
            self.layout.visible = true;
        }
    };

    this.disable = function() {
        if (self.enabled) {
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

    this.mouseQuat = function() {
        //self.rotation.x = self.clampAngleTo(self.rotation.x, Math.PI / 5);
        //self.rotation.y = self.clampAngleTo(self.rotation.y, Math.PI / 5);
        var rotation = new THREE.Euler(self.rotation.x, self.rotation.y, 0);
        return new THREE.Quaternion().setFromEuler(rotation, true);
    }

    function updatePositionCentered(headQuat) {
        var headQuat = self.headQuat();
        var cursorPivot = self.cursorPivot;
        var pivotQuat = new THREE.Quaternion();
        pivotQuat.multiply(headQuat);
        cursorPivot.setRotationFromQuaternion(pivotQuat);
        cursorPivot.position.copy(self.camera.position)
    }

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
    }

    function updatePositionInFOV(headQuat) {
        var headQuat = self.headQuat();
        var headQuatInv = new THREE.Quaternion().copy(headQuat).inverse();
        var cursorPivot = self.cursorPivot;
        var pivotQuat = new THREE.Quaternion();
        var mouseQuat = self.mouseQuat();
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
        if (self.quaternionsAngle(headQuat, pivotQuat) >= (Math.PI / 5)) {
          pivotQuat.multiply(self.mouseQuat.inverse());
        }
        cursorPivot.quaternion.copy(pivotQuat);
        self.validCameraCursorQuat = cameraCursorQuat(cursorPivot.quaternion || new THREE.Quaternion());
        self.cameraCursorAngle = quaternionsAngle(headQuat, cursorPivot.quaternion);
    }

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
    }

    // Detect intersections with three.js scene objects (context) and dispatch mouseover and mouseout events.
    function updateCursorIntersection() {
        var camera = self.camera;
        var raycaster = self.raycaster;
        var cursorMesh = self.cursorMesh;

        if (!camera) {
            // no camera available yet.
            return false;
        }

        if (self.mouse && self.mode === self.modes.mono) {
            raycaster.set(camera.position, self.mouse);
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

        var intersects = raycaster.intersectObjects(self.items);

        var objectMouseOver = self.objectMouseOver;

        if (intersects.length === 0 && objectMouseOver !== null) {
          self.objectMouseOver.type = 'mousemove';
          self.objectMouseOver.object.dispatchEvent(self.objectMouseOver);

          self.objectMouseOver = null;
        }

        for (var i = 0; i < intersects.length; ++i) {
          intersects[i].type = 'mousemove';
          intersects[i].object.dispatchEvent(intersects[i]);

          self.objectMouseOver = intersects[i];
        }
    }

    this.update = function(headQuat) {
        self.updatePosition();
        // It updates hits
        updateCursorIntersection();
    };

    function cameraCursorQuat(mouseQuat) {
        var cameraQuat = self.headQuat();
        var cameraVector = new THREE.Vector3(0, 0, -1);
        var cursorPivotVector = new THREE.Vector3(0, 0, -1);
        cameraVector.applyQuaternion(cameraQuat).normalize();
        cursorPivotVector.applyQuaternion(mouseQuat).normalize();

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
