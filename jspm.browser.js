SystemJS.config({
  baseURL: "/",
  paths: {
    "github:*": "jspm_packages/github/*",
    "npm:*": "jspm_packages/npm/*",
    "app/": "src/"
  },
  bundles: {
    "bundle/main.bundle.js": [
      "src/app.js",
      "src/scripts/main.js",
      "npm:topojson@1.6.24/build/topojson.js",
      "npm:topojson@1.6.24.json",
      "github:jspm/nodelibs-process@0.2.0-alpha/process.js",
      "github:jspm/nodelibs-process@0.2.0-alpha.json",
      "npm:d3@3.5.16/d3.js",
      "npm:d3@3.5.16.json",
      "npm:three@0.75.0/three.js",
      "npm:three@0.75.0.json",
      "src/scripts/common/utils.js",
      "src/scripts/common/mapTexture.js",
      "src/scripts/common/geoHelpers.js",
      "src/scripts/common/sceneVR.js",
      "src/scripts/vr/VRClient.js",
      "src/scripts/vr/VRCursor.js",
      "src/scripts/vr/VRControls.js",
      "src/scripts/vr/VREffect.js",
      "src/scripts/common/OrbitControls.js",
      "src/styles/vr.scss!github:mobilexag/plugin-sass@0.2.1/index.js",
      "github:mobilexag/plugin-sass@0.2.1.json",
      "src/styles/main.scss!github:mobilexag/plugin-sass@0.2.1/index.js"
    ]
  }
});
