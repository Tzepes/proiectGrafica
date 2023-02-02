"use strict";

var vertexShaderGLSL = [
  'uniform mat4 u_worldViewProjection;',
   'uniform vec3 u_lightWorldPos;', // delete
   'uniform mat4 u_world;',
   'uniform mat4 u_viewInverse;',
   'uniform mat4 u_worldInverseTranspose;',
   '',
   'attribute vec4 a_position;',
   'attribute vec3 a_normal;',
   'attribute vec2 a_texcoord;',
   '',
   'varying vec4 v_position;',
   'varying vec2 v_texCoord;',
   'varying vec3 v_normal;',
   'varying vec3 v_surfaceToLight;',
   'varying vec3 v_surfaceToView;',
   '',
   'void main() {',
     'v_texCoord = a_texcoord;',
     'v_position = (u_worldViewProjection * a_position);',
     'v_normal = (u_worldInverseTranspose * vec4(a_normal, 0)).xyz;',
     'v_surfaceToLight = u_lightWorldPos - (u_world * a_position).xyz;',
     'v_surfaceToView = (u_viewInverse[3] - (u_world * a_position)).xyz;',
     'gl_Position = v_position;',
   '}'
].join('\n');

var fragmentShaderGLSL = [
  'precision mediump float;',
  '',
  'varying vec4 v_position;',
  'varying vec2 v_texCoord;',
  'varying vec3 v_normal;',
  'varying vec3 v_surfaceToLight;',
  'varying vec3 v_surfaceToView;',
  '',
  'uniform vec4 u_lightColor;', // delete
  'uniform vec4 u_colorMult;',
  'uniform sampler2D u_diffuse;',
  'uniform vec4 u_specular;',
  'uniform float u_shininess;',
  'uniform float u_specularFactor;',
  '',
  'vec4 lit(float l ,float h, float m) {',
    'return vec4(1.0,',
      'abs(l),',
      '(l > 0.0) ? pow(max(0.0, h), m) : 0.0,',
      '1.0);',
  '}',
  '',
  'void main() {',
  '  vec4 diffuseColor = texture2D(u_diffuse, v_texCoord);',
  '  vec3 a_normal = normalize(v_normal);',
  '  vec3 surfaceToLight = normalize(v_surfaceToLight);',
  '  vec3 surfaceToView = normalize(v_surfaceToView);',
  '  vec3 halfVector = normalize(surfaceToLight + surfaceToView);',
  '  vec4 litR = lit(dot(a_normal, surfaceToLight),',
  '                    dot(a_normal, halfVector), u_shininess);',
  '  vec4 outColor = vec4((',
  '  u_lightColor * (diffuseColor * litR.y * u_colorMult +',
  '                u_specular * litR.z * u_specularFactor)).rgb,',
  '      diffuseColor.a);',
  '  gl_FragColor = outColor;',
  '}'
].join('\n')

function main() {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  var canvas = document.querySelector("#canvas");
  canvas.height = window.innerHeight;
  canvas.width = window.innerWidth;
  var gl = canvas.getContext("webgl");
  if (!gl) {
    return;
  }

  function compileShader(gl, shaderSource, shaderType) {
    // Create the shader object
    var shader = gl.createShader(shaderType);
   
    // Set the shader source code.
    gl.shaderSource(shader, shaderSource);
   
    // Compile the shader
    gl.compileShader(shader);
   
    // Check if it compiled
    var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!success) {
      // Something went wrong during compilation; get the error
      throw "could not compile shader:" + gl.getShaderInfoLog(shader);
    }
   
    return shader;
  }

  var vertexShaderSource = vertexShaderGLSL;
  var fragmentShaderSource = fragmentShaderGLSL;

  var vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
  var fragmentShader = compileShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);

  function createProgram(gl, vertexShader, fragmentShader) {
        // create a program.
        var program = gl.createProgram();
       
        // attach the shaders.
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
       
        // link the program.
        gl.linkProgram(program);
       
        // Check if it linked.
        var success = gl.getProgramParameter(program, gl.LINK_STATUS);
        if (!success) {
            // something went wrong with the link
            throw ("program failed to link:" + gl.getProgramInfoLog (program));
        }
       
        return program;
      };

  gl.enable(gl.DEPTH_TEST);

  // forming a star
  var arrays = {
     position: { numComponents: 3, data: [0, 3, 0, //triangle 1
                                          0, 0, 2, 
                                          0, 0, -2, 
                                          0, -1, 0, // triangle 2
                                          0, 2, -2, 
                                          0, 2, 2], },

     texcoord: { numComponents: 2, data: [0.5, 0, 1, 1, 0, 1],               },
     normal:   { numComponents: 3, data: [0, 0, 1, 0, 0, 1, 0, 0, 1],        },
  };
  var bufferInfo = webglUtils.createBufferInfoFromArrays(gl, arrays);
  // 0, 3, 0, //triangle 1
  // 2, 0, 0, 
  // -2, 0, 0, 
  // 0, -1, 0, // triangle 2
  // -2, 2, 0, 
  // 2, 2, 0
  // setup GLSL program
  var program = createProgram(gl, vertexShader, fragmentShader);
  var uniformSetters = webglUtils.createUniformSetters(gl, program);
  var attribSetters  = webglUtils.createAttributeSetters(gl, program);

  function degToRad(d) {
    return d * Math.PI / 180;
  }

  var fieldOfViewRadians = degToRad(60);

  var uniformsThatAreTheSameForAllObjects = {
    u_viewInverse:           m4.identity(),
  };

  var uniformsThatAreComputedForEachObject = {
    u_worldViewProjection:   m4.identity(),
    u_world:                 m4.identity(),
    u_worldInverseTranspose: m4.identity(),
  };

  var rand = function(min, max) {
    if (max === undefined) {
      max = min;
      min = 0;
    }
    return min + Math.random() * (max - min);
  };

  var objects = [];
  var numObjects = 1000;
  var baseColor = rand(240);
  for (var ii = 0; ii < numObjects; ++ii) {
    objects.push({
      radius: rand(100),
      xRotation: rand(Math.PI),
      yRotation: rand(0),
      materialUniforms: {
        u_specular:              [1, 1, 1, 1],
        u_shininess:             rand(500),        
      },
    });
    console.log(objects[ii].xRotation);
  }

  function checkStarSector(range){
    if(range > 0 & range < 10){
      return range / 1000000;
    } else if (range > 10 & range < 25) {
      return range / 100000;
    } else if (range > 25 & range < 40) {
      return range / 80000;
    } else if (range > 40 & range < 70) {
      return range / 70000;
    } else if (range > 70 & range < 100) {
      return range / 65000;
    } else return range / 60000;
  }

  drawScene();

  // Draw the scene.
  function drawScene(time) {
    time = time * 0.0001 + 5;

    webglUtils.resizeCanvasToDisplaySize(gl.canvas);

    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Clear the canvas AND the depth buffer.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Compute the projection matrix
    var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    var projectionMatrix =
        m4.perspective(fieldOfViewRadians, aspect, 1, 2000);

    // Compute the camera's matrix using look at.
    var cameraPosition = [200, 0, 0];
    var target = [0, 0, 0];
    var up = [0, 1, 0];
    var cameraMatrix = m4.lookAt(cameraPosition, target, up, uniformsThatAreTheSameForAllObjects.u_viewInverse);

    // Make a view matrix from the camera matrix.
    var viewMatrix = m4.inverse(cameraMatrix);

    var viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);

    gl.useProgram(program);

    // Setup all the needed attributes.
    webglUtils.setBuffersAndAttributes(gl, attribSetters, bufferInfo);

    // Set the uniforms that are the same for all objects.
    webglUtils.setUniforms(uniformSetters, uniformsThatAreTheSameForAllObjects);

    // Draw objects
    objects.forEach(function(object) {
      object.xRotation = object.xRotation + checkStarSector(object.radius) * 10;
      //console.log(object.xRotation);
      // Compute a position for this object based on the time.
      var worldMatrix = m4.xRotation(object.xRotation * time);
      worldMatrix = m4.yRotate(worldMatrix, object.yRotation * time);
      worldMatrix = m4.translate(worldMatrix, 0, 0, object.radius);
      uniformsThatAreComputedForEachObject.u_world = worldMatrix;

      // Multiply the matrices.
      m4.multiply(viewProjectionMatrix, worldMatrix, uniformsThatAreComputedForEachObject.u_worldViewProjection);
      m4.transpose(m4.inverse(worldMatrix), uniformsThatAreComputedForEachObject.u_worldInverseTranspose);

      // Set the uniforms we just computed
      webglUtils.setUniforms(uniformSetters, uniformsThatAreComputedForEachObject);

      // Set the uniforms that are specific to the this object.
      webglUtils.setUniforms(uniformSetters, object.materialUniforms);

      // Draw the geometry.
      gl.drawArrays(gl.TRIANGLES, 0, bufferInfo.numElements);
    });

    requestAnimationFrame(drawScene);
  }
}

main();
