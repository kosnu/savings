const vertexSource = `
attribute vec2 position;
varying vec2 uv;
void main() {
  uv = vec2(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
  gl_Position = vec4(position, 0.0, 1.0);
}
`

// 元の炎に沿う揺らぎを保ち、お札の下端から厚い炎を伸ばして先端を不規則にたなびかせる。
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

float noise(float p) {
  float cell = floor(p);
  float phase = fract(p);
  phase = phase * phase * (3.0 - 2.0 * phase);
  float a = fract(sin(cell * 127.1 + 311.7) * 43758.5453);
  float b = fract(sin((cell + 1.0) * 127.1 + 311.7) * 43758.5453);
  return mix(a, b, phase) * 2.0 - 1.0;
}

float gust(float p) {
  return noise(p) * 0.65 + noise(p * 2.03 + 15.7) * 0.25 + noise(p * 4.11 + 7.3) * 0.1;
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

  float wind = noise(time * 0.47 + 17.3) * 0.5;
  float mainGust = wind + gust(time * 1.3 + p.y * 0.014 + 10.0) * 0.7;
  float sideGust = wind + gust(time * 1.65 + p.y * 0.017 + 30.0) * 0.65;
  float lowerGust = wind + gust(time * 2.0 + p.y * 0.02 + 50.0) * 0.55;
  float dx = mainFlame * 30.0 * mainGust + sideFlame * 23.0 * sideGust;
  dx += lowerFlame * 10.0 * lowerGust;
  float dy = mainFlame * (-23.0 * noise(time * 1.55 + 4.7) + 3.0 * mainGust);
  dy += sideFlame * (-18.0 * noise(time * 1.9 + 28.2) + 2.0 * sideGust);
  dy += lowerFlame * 5.0 * lowerGust;

  vec2 source = (p - vec2(dx, dy) * flameOnly) / 512.0;
  vec4 color = texture2D(artwork, source);

  float fire = 0.0;
  float hot = 0.0;
  for (int i = 0; i < 3; i++) {
    float seed = float(i) * 19.7;
    float clock = time * (0.55 + 0.08 * noise(seed + 2.0)) + float(i) * 0.37;
    float cycle = floor(clock);
    float age = fract(clock);
    float energy = noise(cycle + seed + 4.2);
    float life = smoothstep(0.0, 0.08, age) * (1.0 - smoothstep(0.78, 1.0, age));
    float root = 200.0 + float(i) * 70.0;
    float base = 470.0 - abs(root - 250.0) * 0.5;
    // 幅のある根元を残して伸び上がり、燃え尽きる最後に尾が上へ抜ける。
    float growth = smoothstep(0.0, 0.7, age);
    float height = 24.0 + (210.0 + 40.0 * energy + 18.0 * gust(time * 2.3 + seed)) * growth;
    float tail = smoothstep(0.7, 1.0, age) * 0.55;
    float rise = (base - p.y) / height;
    float progress = clamp(rise, 0.0, 1.0);
    float flow = (base - p.y) / 85.0 - time * 1.6;
    float surge = noise(flow * 1.3 + seed + 3.1);
    float bend = wind * 38.0 + noise(time * 0.8 + seed) * 30.0;
    float curl = noise(time * 1.35 + seed + 7.8) * 22.0;
    float center = root + bend * pow(progress, 1.4) + curl * sin(progress * 3.1415927);
    center += gust(flow + seed) * (2.0 + 12.0 * progress);
    center += gust(time * 2.8 + seed + cycle * 0.37) * 50.0 * pow(progress, 2.8);
    // 胴体を急に絞らず、先端付近だけを細くして面として燃やす。
    float radius = (64.0 + energy * 10.0) * mix(1.0, 0.4, smoothstep(0.3, 0.8, progress));
    radius *= 1.0 - smoothstep(0.75, 1.0, progress);
    radius *= (1.0 + surge * 0.15) * mix(1.0, 0.75, smoothstep(0.75, 1.0, age));
    radius = max(radius, 1.5);
    float tongue = 1.0 - smoothstep(radius * 0.4, radius, abs(p.x - center));
    tongue *= smoothstep(tail - 0.04, tail + 0.04, rise);
    tongue *= (1.0 - smoothstep(0.94, 1.02, rise)) * life;
    fire = max(fire, tongue * 0.9);
    float core = tongue * tongue * (0.55 + 0.45 * smoothstep(-0.6, 0.7, surge));
    hot = max(hot, core * (1.0 - progress * 0.6));
  }
  vec3 fireColor = mix(vec3(52.0, 31.0, 103.0), vec3(155.0, 134.0, 234.0), clamp(hot * 1.4, 0.2, 1.0));
  fireColor = mix(fireColor, vec3(242.0, 240.0, 255.0), smoothstep(0.55, 1.0, hot)) / 255.0;
  color.rgb = mix(color.rgb, fireColor, fire);
  gl_FragColor = color;
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
    gl.uniform1f(clock, (now - started) / 1000)
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
