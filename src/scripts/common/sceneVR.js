'use strict';

import d3 from 'd3';
import THREE from 'three';

import './OrbitControls.js';
import '../vr/VREffect.js';
import '../vr/VRControls.js';
import '../vr/VRCursor.js';
import '../vr/VRClient.js';

import {
    isIOS,
    isMobile
} from './utils.js';

export var container = d3.select('body').append('div')
    .attr('class', 'vrContainer');

var vrMode = false;
var mobileMode = isMobile();
console.log('mobileMode:', mobileMode);

var dummyDolly = new THREE.Object3D();
var controls = new THREE.VRControls(dummyDolly);

/**
 * UI for entering VR mode.
 */
var ENTER_VR_CLASS = 'enter-vr';
var ENTER_VR_NO_HEADSET = 'data-enter-vr-no-headset';
var ENTER_VR_NO_WEBVR = 'data-enter-vr-no-webvr';
var ENTER_VR_BTN_CLASS = 'enter-vr-button';
var ENTER_VR_MODAL_CLASS = 'enter-vr-modal';
var HIDDEN_CLASS = 'hidden';
var ORIENTATION_MODAL_CLASS = 'orientation-modal';

/**
 * Creates Enter VR flow (button and compatibility modal).
 *
 * Creates a button that when clicked will enter into stereo-rendering mode for VR.
 *
 * For compatibility:
 *   - Mobile always has compatibility via polyfill.
 *   - If desktop browser does not have WebVR excluding polyfill, disable button, show modal.
 *   - If desktop browser has WebVR excluding polyfill but not headset connected,
 *     don't disable button, but show modal.
 *   - If desktop browser has WebVR excluding polyfill and has headset connected, then
 *     then no modal.
 *
 * Structure: <div><modal/><button></div>
 *
 * @returns {Element} Wrapper <div>.
 */
function createEnterVR(enterVRHandler, mobileMode) {
    var compatModal;
    var compatModalLink;
    var compatModalText;
    // window.hasNonPolyfillWebVRSupport is set in src/index.js.
    var hasWebVR = mobileMode || window.hasNonPolyfillWebVRSupport;
    var orientation;
    var vrButton;
    var wrapper;

    // Create elements.
    wrapper = document.createElement('div');
    wrapper.classList.add(ENTER_VR_CLASS);
    compatModal = document.createElement('div');
    compatModal.className = ENTER_VR_MODAL_CLASS;
    compatModalText = document.createElement('p');
    compatModalLink = document.createElement('a');
    compatModalLink.setAttribute('href', 'http://mozvr.com/#start');
    compatModalLink.setAttribute('target', '_blank');
    compatModalLink.innerHTML = 'Learn more.';
    vrButton = document.createElement('button');
    vrButton.className = ENTER_VR_BTN_CLASS;

    // Insert elements.
    wrapper.appendChild(vrButton);
    if (compatModal) {
        compatModal.appendChild(compatModalText);
        compatModal.appendChild(compatModalLink);
        wrapper.appendChild(compatModal);
    }

    if (!checkHeadsetConnected() && !mobileMode) {
        compatModalText.innerHTML = 'Your browser supports WebVR. To enter VR, connect a headset, or use a mobile phone.';
        wrapper.setAttribute(ENTER_VR_NO_HEADSET, '');
    }

    VRClient.getVR.then(function() {
        // vr detected
        hasWebVR = true;
        // Handle enter VR flows.
        vrButton.addEventListener('click', enterVRHandler);
    }, function() {
        // displays when VR is not detected
        hasWebVR = false;
        compatModalText.innerHTML = 'Your browser does not support WebVR. To enter VR, use a VR-compatible browser or a mobile phone.';
        wrapper.setAttribute(ENTER_VR_NO_WEBVR, '');
    });

    return wrapper;

    /**
     * Check for headset connection by looking at orientation {0 0 0}.
     */
    function checkHeadsetConnected() {
        controls.update();
        orientation = dummyDolly.quaternion;
        if (orientation._x !== 0 || orientation._y !== 0 || orientation._z !== 0) {
            return true;
        }
    }
}

/**
 * Create a modal that tells mobile users to orient the phone to landscape.
 * Add a close button that if clicked, exits VR and closes the modal.
 */
function createOrientationModal(exitVRHandler) {
    var modal = document.createElement('div');
    modal.className = ORIENTATION_MODAL_CLASS;
    modal.classList.add(HIDDEN_CLASS);

    var exit = document.createElement('button');
    exit.innerHTML = 'Exit VR';

    // Hide modal and exit VR on close.
    exit.addEventListener('click', function() {
        exitVRHandler();
        modal.classList.add(HIDDEN_CLASS);
    });

    modal.appendChild(exit);

    return modal;
}

export var camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 5000);
camera.position.z = 1000;

export var scene = new THREE.Scene();

export var light = new THREE.HemisphereLight('#ffffff', '#666666', 1.5);
light.position.set(0, 1000, 0);
scene.add(light);

const monoRenderer = new THREE.WebGLRenderer({
    antialias: true
});
const stereoRenderer = new THREE.VREffect(monoRenderer);

export var renderer = monoRenderer;
renderer.setClearColor(0x222222);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.domElement.style.position = 'absolute';

export var canvas = renderer.domElement;
container.node().appendChild(canvas);

const monoControl = new THREE.OrbitControls(camera);

const stereoControl = new THREE.VRControls(camera);
stereoControl.rotateSpeed = 0.5;
stereoControl.minDistance = 500;
stereoControl.maxDistance = 6000;

export var control = monoControl;

export var cursor = new THREE.VRCursor('mono');
cursor.init(canvas, camera, scene);

cursor.ready.then(function () {
    scene.add(cursor.layout);
    cursor.cursor.position.setZ(-0.35);
    cursor.cursor.material.color.setHex(0x81d41d);
    cursor.enable();
    console.log('cursor:', cursor);
});

console.log('scene:', scene);
/**
 * Manually handles fullscreen for non-VR mobile where the renderer' VR
 * display is not polyfilled.
 *
 * Desktop just works so use the renderer.setFullScreen in that case.
 */
function setFullscreen(canvas) {
    if (!document.fullscreenElement && // alternative standard method
        !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) { // current working methods
        if (canvas.requestFullscreen) {
            canvas.requestFullscreen();
        } else if (canvas.msRequestFullscreen) {
            canvas.msRequestFullscreen();
        } else if (canvas.mozRequestFullScreen) {
            canvas.mozRequestFullScreen();
        } else if (canvas.webkitRequestFullscreen) {
            canvas.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}

function getCanvasSize(canvas) {
    var size;

    if (mobileMode) {
        size = {
            height: window.innerHeight,
            width: window.innerWidth
        };
    }
    size = {
        height: canvas.offsetHeight,
        width: canvas.offsetWidth
    };
    return size;
}

function resize() {
    var size;

    // Possible camera or canvas not injected yet.
    if (!camera || !canvas) {
        return;
    }

    // Update canvas.
    if (!mobileMode) {
        canvas.style.width = '100%';
        canvas.style.height = '100%';
    }

    // Update camera.
    size = getCanvasSize(canvas, mobileMode);

    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();

    // Notify renderer of size change.
    renderer.setSize(size.width, size.height, true);
}

/**
 * Sets renderer to mono (one eye).
 */
function setMonoRenderer() {
    renderer = monoRenderer;
    cursor.setMode('mono');
    vrMode = false;
    resize();
}

/**
 * Sets renderer to stereo (two eyes).
 */
function setStereoRenderer() {
    renderer = stereoRenderer;
    cursor.setMode('centered'); // head tracking cursor
    vrMode = true;
    resize();
}

/**
 * Generally must be triggered on user action for requesting fullscreen.
 */
var enterVR = function() {
    setStereoRenderer();
    if (mobileMode) {
        setFullscreen(canvas);
    } else {
        stereoRenderer.setFullScreen(true);
    }
};

var exitVR = function() {
    if (document.mozFullScreenElement === null) {
        setMonoRenderer();
    }
};

// Add UI if enabled and not already present.
var enterVREl = createEnterVR(enterVR, mobileMode);
container.node().appendChild(enterVREl);

var orientationModalEl = createOrientationModal(exitVR);
container.node().appendChild(orientationModalEl);

// 画面ダブルクリックでfull-screen VR mode
window.addEventListener('dblclick', enterVR, false);

// full-screen VR modeからの復帰時の処理
window.addEventListener('mozfullscreenchange', exitVR, false);

window.addEventListener('resize', resize, false);

// Orientational modal toggling on iOS.
window.addEventListener('orientationchange', function() {
    if (!isIOS) {
        return;
    }
    if (!orientationModalEl) {
        return;
    }

    if (!utils.isLandscape() && scene.is('vr-mode')) {
        // Show if in VR-mode on portrait.
        orientationModalEl.classList.remove(HIDDEN_CLASS);
    } else {
        orientationModalEl.classList.add(HIDDEN_CLASS);
    }
});

VRClient.onFocus = function() {
    cursor.enable();
};

VRClient.onBlur = function() {
    cursor.disable();
};

VRClient.onReady = function() {
    insideLoader = true;
    removeEnterVR();
};

export function removeEnterVR() {
    [enterVREl, orientationModalEl].forEach(function(uiElement) {
        if (uiElement) {
            uiElement.parentNode.removeChild(uiElement);
        }
    });
}

export function hideEnterVR() {
    this.enterVREl.classList.add(HIDDEN_CLASS);
}

export function showEnterVR() {
    this.enterVREl.classList.remove(HIDDEN_CLASS);
}

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    // render and control update
    if (vrMode) {
        // Update VR headset position and apply to camera.
        stereoControl.update();
        // Render the scene through the VREffect.
        stereoRenderer.render(scene, camera);

        cursor && cursor.update();
//console.log('camera ', 'position:', camera.position, 'rotation:', camera.rotation);
    } else {
        var delta = clock.getDelta();
        monoControl.update(delta);
        monoRenderer.render(scene, camera);
    }
}
animate();
