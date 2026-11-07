const vertexSource = `
attribute vec2 position;
varying vec2 uv;
void main() {
  uv = vec2(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
  gl_Position = vec4(position, 0.0, 1.0);
}
`

// 元画像の炎の中心線に沿って先端ほど大きく曲げ、お札との境目はなめらかに固定する。
const fragmentSource = `
precision highp float;
uniform sampler2D artwork;
uniform float time;
varying vec2 uv;

float edge(vec2 a, vec2 b, vec2 p) {
  vec2 direction = b - a;
  vec2 point = p - a;
  return (direction.x * point.y - direction.y * point.x) / length(direction);
}

void main() {
  vec2 p = uv * 512.0;

  float mainCenter = mix(238.0, 285.0, smoothstep(32.0, 125.0, p.y));
  mainCenter = mix(mainCenter, 215.0, smoothstep(125.0, 280.0, p.y));
  float mainFlame = 1.0 - smoothstep(45.0, 100.0, abs(p.x - mainCenter));
  mainFlame *= 1.0 - smoothstep(50.0, 310.0, p.y);

  float sideCenter = mix(355.0, 335.0, smoothstep(145.0, 240.0, p.y));
  sideCenter = mix(sideCenter, 395.0, smoothstep(240.0, 340.0, p.y));
  float sideFlame = 1.0 - smoothstep(25.0, 65.0, abs(p.x - sideCenter));
  sideFlame *= smoothstep(110.0, 140.0, p.y) * (1.0 - smoothstep(145.0, 350.0, p.y));

  float lowerFlame = exp(-pow((p.x - 135.0) / 45.0, 2.0));
  lowerFlame += exp(-pow((p.x - 410.0) / 40.0, 2.0));
  lowerFlame *= smoothstep(240.0, 300.0, p.y) * (1.0 - smoothstep(420.0, 485.0, p.y));

  float note = min(edge(vec2(151.0, 364.0), vec2(350.0, 258.0), p),
                   edge(vec2(350.0, 258.0), vec2(401.0, 375.0), p));
  note = min(note, edge(vec2(401.0, 375.0), vec2(250.0, 470.0), p));
  note = min(note, edge(vec2(250.0, 470.0), vec2(151.0, 364.0), p));
  float flameOnly = 1.0 - smoothstep(-20.0, -4.0, note);

  float mainPhase = time * 6.2831853 / 1.8 + p.y * 0.018;
  float sidePhase = time * 6.2831853 / 1.5 + p.y * 0.023 + 0.8;
  float lowerPhase = time * 6.2831853 / 2.25 + p.y * 0.024 + 1.4;
  float dx = mainFlame * (22.0 * sin(mainPhase) + 6.0 * sin(mainPhase * 2.0 + 1.2));
  dx += sideFlame * (18.0 * sin(sidePhase) + 4.0 * sin(sidePhase * 2.0));
  dx += lowerFlame * 7.0 * sin(lowerPhase);
  float dy = mainFlame * 3.0 * cos(mainPhase) + sideFlame * 2.0 * cos(sidePhase);
  dy += lowerFlame * 3.0 * cos(lowerPhase);

  vec2 source = (p - vec2(dx, dy) * flameOnly) / 512.0;
  gl_FragColor = texture2D(artwork, source);
}
`

export function animateFlame(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: false,
    antialias: false,
    depth: false,
    stencil: false,
  })
  if (!context) return
  const gl = context

  const program = gl.createProgram()
  const buffer = gl.createBuffer()
  const texture = gl.createTexture()
  const shaders: WebGLShader[] = []
  const image = new Image()
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
  let frame = 0
  let disposed = false
  let loaded = false
  let started = 0

  function stop() {
    cancelAnimationFrame(frame)
    canvas.removeAttribute("data-ready")
  }

  function contextLost(event: Event) {
    event.preventDefault()
    loaded = false
    stop()
  }

  function cleanup() {
    disposed = true
    stop()
    reducedMotion.removeEventListener("change", updateMotion)
    canvas.removeEventListener("webglcontextlost", contextLost)
    image.onload = null
    gl.deleteTexture(texture)
    gl.deleteBuffer(buffer)
    gl.deleteProgram(program)
    shaders.forEach((shader) => gl.deleteShader(shader))
  }

  if (!program || !buffer || !texture) {
    cleanup()
    return
  }

  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertexSource],
    [gl.FRAGMENT_SHADER, fragmentSource],
  ] as const) {
    const shader = gl.createShader(type)
    if (!shader) {
      cleanup()
      return
    }
    shaders.push(shader)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      cleanup()
      return
    }
    gl.attachShader(program, shader)
  }
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    cleanup()
    return
  }

  const position = gl.getAttribLocation(program, "position")
  const clock = gl.getUniformLocation(program, "time")
  const artwork = gl.getUniformLocation(program, "artwork")
  if (position < 0 || clock === null || artwork === null) {
    cleanup()
    return
  }
  gl.useProgram(program)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.uniform1i(artwork, 0)

  function draw(now: number) {
    if (disposed || !loaded) return
    gl.uniform1f(clock, ((now - started) / 1000) % 9)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    canvas.dataset.ready ??= "true"
    frame = requestAnimationFrame(draw)
  }

  function updateMotion() {
    stop()
    if (loaded && !reducedMotion.matches) frame = requestAnimationFrame(draw)
  }

  image.onload = () => {
    if (disposed || gl.isContextLost()) return
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * window.devicePixelRatio))
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * window.devicePixelRatio))
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
    loaded = true
    started = performance.now()
    updateMotion()
  }
  reducedMotion.addEventListener("change", updateMotion)
  canvas.addEventListener("webglcontextlost", contextLost)
  image.src = "/icon-512.png"

  return cleanup
}
