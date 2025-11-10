// WindGL - 3D Wind Shell (Earth inside semi-transparent atmosphere)
class WindGL {
  constructor(gl) {
    this.gl = gl;
    this.numParticles = 35000;
    this.time = 0;
    this.rotation = 0;
    this.windData = null;
    this.init();
  }

  init() {
    const gl = this.gl;
    this.windTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.windTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    this.program = this.createProgram(vertexShader3D, fragmentShader3D);
    this.positionBuffer = gl.createBuffer();
    this.generateParticles();

    this.positionLocation = gl.getAttribLocation(this.program, "a_position");
    this.windTextureLocation = gl.getUniformLocation(this.program, "u_wind");
    this.timeLocation = gl.getUniformLocation(this.program, "u_time");
    this.rotationLocation = gl.getUniformLocation(this.program, "u_rotation");
  }

  createProgram(vsSource, fsSource) {
    const gl = this.gl;
    function compile(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        console.error(gl.getShaderInfoLog(s));
      return s;
    }
    const vs = compile(gl.VERTEX_SHADER, vsSource);
    const fs = compile(gl.FRAGMENT_SHADER, fsSource);
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    return p;
  }

  generateParticles() {
    const positions = new Float32Array(this.numParticles * 2);
    for (let i = 0; i < this.numParticles; i++) {
      positions[i * 2] = Math.random();
      positions[i * 2 + 1] = Math.random();
    }
    this.positions = positions;
  }

  setWind(data) {
    this.windData = data;
    const gl = this.gl;
    const w = data.width, h = data.height;
    const tex = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const r = Math.floor(((data.u[i] - data.uMin) / (data.uMax - data.uMin)) * 255);
      const g = Math.floor(((data.v[i] - data.vMin) / (data.vMax - data.vMin)) * 255);
      tex[i * 4] = r;
      tex[i * 4 + 1] = g;
      tex[i * 4 + 2] = 128;
      tex[i * 4 + 3] = 255;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.windTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, tex);
  }

  draw() {
    if (!this.windData) return;
    const gl = this.gl;
    this.time += 0.01;
    this.rotation += 0.002;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    gl.useProgram(this.program);
    gl.uniform1f(this.timeLocation, this.time);
    gl.uniform1f(this.rotationLocation, this.rotation);
    gl.uniform1i(this.windTextureLocation, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.windTexture);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.positionLocation);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.POINTS, 0, this.numParticles);
    gl.disable(gl.BLEND);
  }
}

// Vertex Shader
const vertexShader3D = `
attribute vec2 a_position;
uniform float u_time;
uniform float u_rotation;
uniform sampler2D u_wind;
varying float v_strength;
varying float v_depth;

const float PI = 3.141592653589793;
void main() {
  vec2 pos = a_position;
  vec4 w = texture2D(u_wind, pos);
  vec2 wind = (w.rg - 0.5) * 2.0;
  v_strength = length(wind);

  float lon = pos.x * 2.0 * PI - PI;
  float lat = pos.y * PI - PI/2.0;
  lon += u_rotation;

  // expanded air layer
  float R = 1.08;
  float x = R * cos(lat) * cos(lon);
  float y = R * sin(lat);
  float z = R * cos(lat) * sin(lon);

  x += wind.x * 0.02;
  y += wind.y * 0.02;

  v_depth = z;

  float perspective = 1.0 / (1.5 - z * 0.5);
  gl_Position = vec4(x * perspective, y * perspective, z, 1.0);
  gl_PointSize = 1.8 + v_strength * 5.0;
}
`;

// Fragment Shader
const fragmentShader3D = `
precision mediump float;
varying float v_strength;
varying float v_depth;

void main(){
  vec2 c = gl_PointCoord - vec2(0.5);
  float d = length(c);
  if(d > 0.5) discard;

  float depthShade = smoothstep(-1.0, 1.0, v_depth);
  vec3 color = mix(vec3(0.15,0.55,1.0), vec3(0.9,0.95,1.0), v_strength);
  color *= 0.5 + 0.5 * depthShade;

  float alpha = (1.0 - smoothstep(0.3,0.5,d)) * 0.9;
  gl_FragColor = vec4(color, alpha);
}`;
