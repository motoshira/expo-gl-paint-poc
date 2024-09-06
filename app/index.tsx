import React, { useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { GLView, ExpoWebGLRenderingContext } from "expo-gl";
import Delaunator from "delaunator";

export default function App() {
  const points = useRef<number[][]>(genPoints());
  const pointsChanged = useRef(true);
  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    gl.clearColor(0, 1, 1, 1);

    // points
    const pointsVert = gl.createShader(gl.VERTEX_SHADER);
    if (!pointsVert) {
      return;
    }
    gl.shaderSource(
      pointsVert,
      `#version 300 es
    in vec2 position;

    void main(void) {
      gl_Position = vec4(position.x, position.y, 0.0, 1.0);
      gl_PointSize = 4.0;
    }
    `,
    );
    gl.compileShader(pointsVert);

    const pointsFrag = gl.createShader(gl.FRAGMENT_SHADER);
    if (!pointsFrag) {
      return;
    }
    gl.shaderSource(
      pointsFrag,
      `#version 300 es
    precision mediump float;
    out vec4 outColor;

    void main(void) {
      outColor = vec4(0.0, 0.0, 0.8, 1.0);
    }
  `,
    );
    gl.compileShader(pointsFrag);

    const pointsProgram = gl.createProgram();
    if (!pointsProgram) {
      return;
    }
    gl.attachShader(pointsProgram, pointsVert);
    gl.attachShader(pointsProgram, pointsFrag);
    gl.linkProgram(pointsProgram);

    // lines
    const linesVert = gl.createShader(gl.VERTEX_SHADER);
    if (!linesVert) {
      return;
    }
    gl.shaderSource(
      linesVert,
      `#version 300 es
    in vec2 position;

    void main(void) {
      gl_Position = vec4(position.x, position.y, 0.0, 1.0);
    }
    `,
    );
    gl.compileShader(linesVert);

    const linesFrag = gl.createShader(gl.FRAGMENT_SHADER);
    if (!linesFrag) {
      return;
    }
    gl.shaderSource(
      linesFrag,
      `#version 300 es
    precision mediump float;
    out vec4 outColor;

    void main(void) {
      outColor = vec4(0.0, 0.0, 0.0, 1.0);
    }
  `,
    );
    gl.compileShader(linesFrag);

    const linesProgram = gl.createProgram();
    if (!linesProgram) {
      return;
    }
    gl.attachShader(linesProgram, linesVert);
    gl.attachShader(linesProgram, linesFrag);
    gl.linkProgram(linesProgram);

    // setup vao
    const pointsVao = gl.createVertexArray();
    gl.bindVertexArray(pointsVao);
    const pointsVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pointsVbo);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(points.current.flatMap((ps) => ps)),
      gl.DYNAMIC_DRAW,
    );
    const pointsIndex = gl.getAttribLocation(pointsProgram, "position");
    gl.enableVertexAttribArray(pointsIndex);
    gl.vertexAttribPointer(pointsIndex, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const linesVao = gl.createVertexArray();
    gl.bindVertexArray(linesVao);
    const linesVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, linesVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lines), gl.DYNAMIC_DRAW);
    const linesIndex = gl.getAttribLocation(linesProgram, "position");
    gl.enableVertexAttribArray(linesIndex);
    gl.vertexAttribPointer(linesIndex, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // setup uniform location
    /* const resolutionLocaiton = gl.getUniformLocation(program, "u_resolution"); */

    function renderLoop() {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clear(gl.COLOR_BUFFER_BIT);
      /* gl.uniform2f(
       *   resolutionLocaiton,
       *   gl.drawingBufferWidth,
       *   gl.drawingBufferHeight,
       * ); */
      gl.useProgram(pointsProgram);
      if (pointsChanged.current) {
        gl.bindBuffer(gl.ARRAY_BUFFER, pointsVbo);
        gl.bufferSubData(
          gl.ARRAY_BUFFER,
          0,
          new Float32Array(points.current.flatMap((ps) => ps)),
        );
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        pointsChanged.current = false;
      }
      gl.bindVertexArray(pointsVao);
      gl.drawArrays(gl.POINTS, 0, points.current.length);
      gl.useProgram(linesProgram);
      gl.bindVertexArray(linesVao);
      gl.drawArrays(gl.LINES, 0, lines.length * 2);

      gl.flush();
      gl.endFrameEXP();
      requestAnimationFrame(renderLoop);
    }
    requestAnimationFrame(renderLoop);
    // gl.endFrameEXP();
  };
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 24,
      }}
    >
      <GLView
        style={{ width: 300, height: 300 }}
        onContextCreate={onContextCreate}
      />
      <Pressable
        style={{ padding: 20, backgroundColor: "blue", borderRadius: 4 }}
        onPress={() => {
          points.current = genPoints();
          pointsChanged.current = true;
        }}
      >
        <Text style={{ fontSize: 20, color: "white" }}>Regenerate</Text>
      </Pressable>
    </View>
  );
}

const catmullRomSpline = (
  p0: number[],
  p1: number[],
  p2: number[],
  p3: number[],
  t: number,
): number[] => {
  const q3 = p1;
  const q2 = [0.5 * p2[0] - 0.5 * p0[0], 0.5 * p2[1] - 0.5 * p0[1]];
  const q0 = [
    0.5 * p3[0] - 0.5 * p1[0] - 2.0 * p2[0] + q2[0] + 2.0 * q3[0],
    0.5 * p3[1] - 0.5 * p1[1] - 2.0 * p2[1] + q2[1] + 2.0 * q3[1],
  ];
  const q1 = [
    3.0 * p2[0] - 0.5 * p3[0] + 0.5 * p1[0] - 2.0 * q2[0] - 3.0 * q3[0],
    3.0 * p2[1] - 0.5 * p3[1] + 0.5 * p1[1] - 2.0 * q2[1] - 3.0 * q3[1],
  ];
  return [
    q0[0] * t ** 3 + q1[0] * t ** 2 + q2[0] * t + q3[0],
    q0[1] * t ** 3 + q1[1] * t ** 2 + q2[1] * t + q3[1],
  ];
};

// return indices trios
/* const delaunay = (points: number[][]): number[][] => {
 *   const indexByPoint = new Map<number[], number>();
 *   for (let i = 0; i < points.length; i++) {
 *     indexByPoint.set(points[i], i);
 *   }
 *   const stack = [];
 *   return [];
 * };
 *  */
const genPoints = () => {
  const points: number[][] = [];
  let p0: number[] = [Math.random() * 2 - 1, Math.random() * 2 - 1];
  let p1: number[] = p0;
  let p2: number[] = p0;
  let p3: number[] = p0;
  for (let i = 0; i < 15; i++) {
    // [x, y]
    p0 = p1;
    p1 = p2;
    p2 = p3;
    p3 = [Math.random() * 2 - 1, Math.random() * 2 - 1];
    if (p1[0] !== p2[0] && p1[1] !== p2[1]) {
      for (let t = 0; t < 33; t++) {
        const p = catmullRomSpline(p0, p1, p2, p3, t * 0.03);
        points.push(p);
      }
    }
  }
  return points;
};

// const ts = new Delaunator(ps);
// const tt = ts.triangles as Uint32Array;
const lines: number[] = [];
/* for (let i = 0; i < tt.length; i += 3) {
 *   const p0 = points[tt[i]];
 *   const p1 = points[tt[i + 1]];
 *   const p2 = points[tt[i + 2]];
 *   lines.push(...p0, ...p1);
 *   lines.push(...p1, ...p2);
 *   lines.push(...p2, ...p0);
 * } */
