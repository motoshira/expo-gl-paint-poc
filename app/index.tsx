import React, { useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { GLView, ExpoWebGLRenderingContext } from "expo-gl";
import Delaunator from "delaunator";
import getNormals from "polyline-normals";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";

class Vec2 {
  static rotate(v: number[], theta: number) {
    return [
      v[0] * Math.cos(theta) - v[1] * Math.sin(theta),
      v[0] * Math.sin(theta) + v[1] * Math.cos(theta),
    ];
  }
  static rotate90(v: number[]) {
    return [-v[1], v[0]];
  }
  static normalize(v: number[]) {
    const l = Math.sqrt(v[0] ** 2 + v[1] ** 2);
    return [v[0] / l, v[1] / l];
  }
  static addVec2(v1: number[], v2: number[]) {
    return [v1[0] + v2[0], v1[1] + v2[1]];
  }
  static subVec2(v1: number[], v2: number[]) {
    return [v1[0] - v2[0], v1[1] - v2[1]];
  }
  static multiplyByNumber(v: number[], r: number) {
    return v.map((x) => x * r);
  }
  static divByNumber(v: number[], r: number) {
    return v.map((x) => x / r);
  }
}

class LinesDrawer {
  // 正十六角形・長方形
  static LINES_BUFFER_LENGTH = 16 * 2 * 2 * 3 + 2 * 2 * 3;
  private gl: ExpoWebGLRenderingContext;
  private target: WebGLRenderbuffer | null;
  private frameBuffer: WebGLRenderbuffer | null;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private vbo: WebGLBuffer;
  private radius: number = 0.02;
  private points: number[] = [];
  private prevPoint: number[] | undefined = undefined;
  constructor(
    gl: ExpoWebGLRenderingContext,
    target: WebGLRenderbuffer | null = null,
  ) {
    this.gl = gl;
    this.target = target;
    const vert = gl.createShader(gl.VERTEX_SHADER);
    if (!vert) {
      throw new Error("Failed to create vertex shader");
    }

    gl.shaderSource(
      vert,
      `#version 300 es
    in vec2 position;

    void main(void) {
      gl_Position = vec4(position.x, position.y, 0.0, 1.0);
    }
    `,
    );
    gl.compileShader(vert);

    const frag = gl.createShader(gl.FRAGMENT_SHADER);
    if (!frag) {
      throw new Error("Failed to create fragment shader");
    }
    gl.shaderSource(
      frag,
      `#version 300 es
    precision mediump float;
    out vec4 outColor;

    void main(void) {
      outColor = vec4(0.0, 0.0, 0.0, 1.0);
    }
  `,
    );
    gl.compileShader(frag);

    const program = gl.createProgram();
    if (!program) {
      throw new Error("Failed to create program");
    }
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    this.program = program;

    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer()!;
    this.vbo = vbo;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      LinesDrawer.LINES_BUFFER_LENGTH * 10,
      gl.DYNAMIC_DRAW,
    );
    const positionIndex = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionIndex);
    gl.vertexAttribPointer(positionIndex, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this.vbo = vbo;
    this.vao = vao;

    const renderBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, renderBuffer);
    gl.renderbufferStorage(
      gl.RENDERBUFFER,
      gl.DEPTH_COMPONENT16,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
    );

    const tex = gl.createTexture();
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );

    const frameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    gl.framebufferRenderbuffer(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.RENDERBUFFER,
      renderBuffer,
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  }
  reset(sx: number, sy: number) {
    const { gl } = this;
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    this.points = [];
    this.prevPoint = [sx / width, sy / height].map((p) => p * 2.0 - 1.0);
  }
  lineTo(x: number, y: number) {
    // TODO
    const { gl, vbo, prevPoint, radius } = this;
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const np = [x / width, y / height].map((p) => p * 2.0 - 1.0);
    if (!prevPoint) {
      throw new Error("prevPoint not set");
    }
    // TODO set points (circle and rectangle)
    const points: number[] = [];
    for (let i = 0; i < 16; i++) {
      const p0 = Vec2.addVec2(
        prevPoint,
        Vec2.rotate([radius, 0], 2 * Math.PI * (i / 16)),
      );
      const p1 = Vec2.addVec2(
        prevPoint,
        Vec2.rotate([radius, 0], 2 * Math.PI * ((i + 1) / 16)),
      );
      points.push(...[...p0, ...prevPoint, ...p1]);
    }
    for (let i = 0; i < 16; i++) {
      const p0 = Vec2.addVec2(
        np,
        Vec2.rotate([radius, 0], 2 * Math.PI * (i / 16)),
      );
      const p1 = Vec2.addVec2(
        np,
        Vec2.rotate([radius, 0], 2 * Math.PI * ((i + 1) / 16)),
      );
      points.push(...[...p0, ...np, ...p1]);
    }

    const v = Vec2.subVec2(np, prevPoint);
    const vv = Vec2.multiplyByNumber(
      Vec2.normalize(Vec2.rotate(v, Math.PI / 2)),
      radius,
    );
    const p0 = Vec2.addVec2(prevPoint, vv);
    const p1 = Vec2.addVec2(prevPoint, Vec2.multiplyByNumber(vv, -1));
    const p2 = Vec2.addVec2(np, Vec2.multiplyByNumber(vv, -1));
    const p3 = Vec2.addVec2(np, vv);
    points.push(...[...p0, ...p1, ...p2, ...p2, ...p3, ...p0]);
    console.log(
      "expected",
      LinesDrawer.LINES_BUFFER_LENGTH,
      "actual",
      points.length,
    );
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(points));
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    console.log(prevPoint, np, points);
    this.points = points;
    this.prevPoint = np;
  }
  render() {
    const { gl, program, vao, points } = this;
    if (points.length === 0) {
      return;
    }
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, LinesDrawer.LINES_BUFFER_LENGTH);
    gl.bindVertexArray(null);
  }
}

export default function App() {
  // const points = useRef<number[][]>(genPoints());
  const linesDrawer = useRef<LinesDrawer>();
  const pan = Gesture.Pan()
    .onStart((g) => {
      /* "worklets";
       * const newPaths = [...paths];
       * newPaths[paths.length] = {
       *   segments: [],
       *   color: "#06d6a0",
       * };
       * newPaths[paths.length].segments.push(`M ${g.x} ${g.y}`);
       * setPaths(newPaths); */
    })
    .onUpdate((g) => {
      /* const index = paths.length - 1;
       * const newPaths = [...paths];
       * if (newPaths?.[index]?.segments) {
       *   newPaths[index].segments.push(`L ${g.x} ${g.y}`);
       *   setPaths(newPaths);
       * } */
    })
    .minDistance(1);
  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    linesDrawer.current = new LinesDrawer(gl);
    linesDrawer.current?.reset(150, 150);
    linesDrawer.current?.lineTo(300, 300);
    // FIXME 重なって表示されない オフスクリーンレンダリングが必要かも？
    setTimeout(() => {
      linesDrawer.current?.lineTo(150, 200);
    }, 1000);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    function renderLoop() {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      /* gl.uniform2f(
       *   resolutionLocaiton,
       *   gl.drawingBufferWidth,
       *   gl.drawingBufferHeight,
       * ); */

      linesDrawer.current?.render();

      gl.flush();
      gl.endFrameEXP();
      requestAnimationFrame(renderLoop);
    }
    requestAnimationFrame(renderLoop);
  };
  return (
    <GestureHandlerRootView>
      <GestureDetector gesture={pan}>
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
      </GestureDetector>
    </GestureHandlerRootView>
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
