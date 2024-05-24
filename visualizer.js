let canvas, gl, audioContext, analyser, audioData;

function setupWebGL() {
    canvas = document.getElementById('canvas');
    gl = canvas.getContext('webgl');
    if (!gl) {
        console.error('Unable to initialize WebGL. Your browser may not support it.');
        return;
    }
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    audioData = new Uint8Array(analyser.frequencyBinCount);
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight / 2;
}

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Error compiling shader:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexShaderSource, fragmentShaderSource) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Error linking program:', gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}

function init() {
    setupWebGL();

    const vertexShaderSource = `
        attribute vec2 a_position;
        varying vec2 v_uv;
        void main() {
            v_uv = a_position * 0.5 + 0.5;
            gl_Position = vec4(a_position, 0.0, 1.0);
        }
    `;

    const fragmentShaderSource = `
        precision highp float;
        varying vec2 v_uv;
        uniform float u_time;
        uniform vec2 u_resolution;
        uniform float u_audioData[128];

        vec3 hsv2rgb(vec3 c) {
            vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
            vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
            return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        void main() {
            vec2 st = v_uv * u_resolution / min(u_resolution.x, u_resolution.y);
            float audio = u_audioData[int(st.x * 127.0)];

            float hue = mod(u_time * 0.1 + st.x * 5.0, 1.0);
            float sat = 0.5 + 0.5 * sin(u_time + st.y * 10.0 + audio);
            float val = 0.5 + 0.5 * cos(u_time + st.x * 10.0 + audio);

            vec3 color = hsv2rgb(vec3(hue, sat, val));

            gl_FragColor = vec4(color, 1.0);
        }
    `;

    const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    if (!program) {
        console.error('Failed to create WebGL program.');
        return;
    }

    gl.useProgram(program);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const timeLocation = gl.getUniformLocation(program, 'u_time');
    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
    const audioDataLocation = gl.getUniformLocation(program, 'u_audioData');

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1
    ]), gl.STATIC_DRAW);

    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    function render(time) {
        analyser.getByteFrequencyData(audioData);

        gl.uniform1f(timeLocation, time * 0.001);
        gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
        gl.uniform1fv(audioDataLocation, audioData);

        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
}

document.getElementById('play-button').addEventListener('click', function() {
    const audioElement = document.getElementById('audio');
    const audioSource = audioContext.createMediaElementSource(audioElement);
    audioSource.connect(analyser);
    analyser.connect(audioContext.destination);
    audioElement.play();
    init();
});