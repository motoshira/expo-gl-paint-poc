import React, { useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { GLView, ExpoWebGLRenderingContext } from "expo-gl";
import Delaunator from "delaunator";
import getNormals from "polyline-normals";

type Lines = {
  points: number[][];
  indices: number[][];
};

export default function App() {
  // const points = useRef<number[][]>(genPoints());
  const linesChanged = useRef(true);
  const lines = useRef<Lines>(genSegmentedLines());
  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    gl.clearColor(0, 1, 1, 1);

    // triangles
    const trianglesVert = gl.createShader(gl.VERTEX_SHADER);
    if (!trianglesVert) {
      return;
    }
    gl.shaderSource(
      trianglesVert,
      `#version 300 es
    in vec2 position;

    void main(void) {
      gl_Position = vec4(position.x, position.y, 0.0, 1.0);
    }
    `,
    );
    gl.compileShader(trianglesVert);

    const trianglesFrag = gl.createShader(gl.FRAGMENT_SHADER);
    if (!trianglesFrag) {
      return;
    }
    gl.shaderSource(
      trianglesFrag,
      `#version 300 es
    precision mediump float;
    out vec4 outColor;

    void main(void) {
      outColor = vec4(0.0, 0.0, 0.2, 1.0);
    }
  `,
    );
    gl.compileShader(trianglesFrag);

    const trianglesProgram = gl.createProgram();
    if (!trianglesProgram) {
      return;
    }
    gl.attachShader(trianglesProgram, trianglesVert);
    gl.attachShader(trianglesProgram, trianglesFrag);
    gl.linkProgram(trianglesProgram);

    const linesVao = gl.createVertexArray();
    gl.bindVertexArray(linesVao);
    const linesVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, linesVbo);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(lines.current.points.flatMap((ps) => ps)),
      gl.DYNAMIC_DRAW,
    );
    const linesIndex = gl.getAttribLocation(trianglesProgram, "position");
    gl.enableVertexAttribArray(linesIndex);
    gl.vertexAttribPointer(linesIndex, 2, gl.FLOAT, false, 0, 0);

    const linesIbo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, linesIbo);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(lines.current.indices.flatMap((indices) => indices)),
      gl.DYNAMIC_DRAW,
    );
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

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
      gl.useProgram(trianglesProgram);
      // TODO update lines
      if (linesChanged.current) {
        // gl.bindVertexArray(linesVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, linesVbo);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, linesIbo);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array(lines.current.points.flatMap((ps) => ps)),
          gl.DYNAMIC_DRAW,
        );
        gl.enableVertexAttribArray(linesIndex);
        gl.vertexAttribPointer(linesIndex, 2, gl.FLOAT, false, 0, 0);
        gl.bufferData(
          gl.ELEMENT_ARRAY_BUFFER,
          new Uint16Array(lines.current.indices.flatMap((indices) => indices)),
          gl.DYNAMIC_DRAW,
        );
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        // gl.bindVertexArray(null);
        linesChanged.current = false;
      }
      gl.bindVertexArray(linesVao);
      gl.drawElements(
        gl.TRIANGLES,
        lines.current.indices.length * 3,
        gl.UNSIGNED_SHORT,
        0,
      );
      gl.bindVertexArray(null);

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
          lines.current = genSegmentedLines();
          linesChanged.current = true;
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

const genSegmentedLines = (): {
  points: number[][];
  indices: number[][];
} => {
  const points: number[][] = [];
  const ls: number[][] = [];
  const rs: number[][] = [];
  let p0: number[] = [Math.random() * 2 - 1, Math.random() * 2 - 1];
  let p1: number[] = p0;
  let p2: number[] = p0;
  let p3: number[] = p0;
  for (let i = 0; i < 10; i++) {
    // [x, y]
    p0 = p1;
    p1 = p2;
    p2 = p3;
    p3 = [Math.random() * 2 - 1, Math.random() * 2 - 1];
    if (p1[0] !== p2[0] && p1[1] !== p2[1]) {
      for (let t = 0; t < 10; t++) {
        const p = catmullRomSpline(p0, p1, p2, p3, t * 0.1);
        points.push(p);
      }
    }
  }
  const normals: number[][] = getNormals(points, false).map(
    (ps: unknown[]) => ps[0] as number[],
  );
  for (let i = 0; i < normals.length; i++) {
    const p = points[i];
    const n = normals[i];
    ls.push([p[0] + n[0] * 0.005, p[1] + n[1] * 0.005]);
    rs.push([p[0] - n[0] * 0.005, p[1] - n[1] * 0.005]);
  }
  const indices: number[][] = [];
  const ss: number[][] = [];
  let index: number = 0;
  // l0, c0, r0, l1, c1, r1, ...
  for (let i = 0; i < points.length - 1; i++) {
    const l0 = ls[i];
    const l1 = ls[i + 1];
    const c0 = points[i];
    const c1 = points[i + 1];
    const r0 = rs[i];
    const r1 = rs[i + 1];
    if (i === 0) {
      ss.push(l0, c0, r0);
    }
    ss.push(l1, c1, r1);
    indices.push(
      [index, index + 1, index + 3],
      [index + 3, index + 1, index + 4],
      [index + 1, index + 2, index + 4],
      [index + 4, index + 2, index + 5],
    );
    index += 3;
  }
  return {
    points: ss,
    indices: indices,
  };
};
