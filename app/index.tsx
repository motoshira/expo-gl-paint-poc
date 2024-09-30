import React, { useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { GLView, ExpoWebGLRenderingContext } from "expo-gl";
import getNormals from "polyline-normals";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";

class WebGLUtils {
  static createFrameBufferWithTexture(gl: ExpoWebGLRenderingContext) {
    const frameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    const texture = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { frameBuffer, texture };
  }
  static renderTexturesInOrder(
    gl: ExpoWebGLRenderingContext,
    textures: WebGLTexture[],
    draw: () => void,
  ) {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    for (let i = 0; i < textures.length; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, textures[i]);
      draw();
    }
  }
}

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
  private frameBuffer: WebGLRenderbuffer | null;
  private texture: WebGLTexture;
  private lineProgram: WebGLProgram;
  private lineVao: WebGLVertexArrayObject;
  private lineVbo: WebGLBuffer;
  private linesVao: WebGLVertexArrayObject;
  private radius: number = 0.02;
  private points: number[] = [];
  private prevPoint: number[] | undefined = undefined;
  private linesProgram: WebGLProgram;
  static _createProgram(
    gl: ExpoWebGLRenderingContext,
    vertSource: string,
    fragSource: string,
  ) {
    const vert = gl.createShader(gl.VERTEX_SHADER);
    if (!vert) {
      throw new Error("Failed to create vertex shader");
    }
    gl.shaderSource(vert, vertSource);
    gl.compileShader(vert);
    console.log(gl.getShaderInfoLog(vert));

    const frag = gl.createShader(gl.FRAGMENT_SHADER);
    if (!frag) {
      throw new Error("Failed to create fragment shader");
    }
    gl.shaderSource(frag, fragSource);
    gl.compileShader(frag);
    console.log(gl.getShaderInfoLog(frag));

    const program = gl.createProgram();
    if (!program) {
      throw new Error("Failed to create program");
    }
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    console.log(gl.getProgramInfoLog(program));
    return program;
  }
  constructor(gl: ExpoWebGLRenderingContext) {
    this.gl = gl;
    const lineVert = `#version 300 es
    in vec2 position;

    void main(void) {
      gl_Position = vec4(position.x, position.y, 0.0, 1.0);
    }
    `;
    const lineFrag = `#version 300 es
    precision mediump float;
    out vec4 outColor;

    void main(void) {
      outColor = vec4(0.0, 0.0, 0.0, 1.0);
    }
    `;
    const lineProgram = LinesDrawer._createProgram(gl, lineVert, lineFrag);
    this.lineProgram = lineProgram;

    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer()!;
    this.lineVbo = vbo;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      LinesDrawer.LINES_BUFFER_LENGTH * 10,
      gl.DYNAMIC_DRAW,
    );
    const positionIndex = gl.getAttribLocation(lineProgram, "position");
    gl.enableVertexAttribArray(positionIndex);
    gl.vertexAttribPointer(positionIndex, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this.lineVbo = vbo;
    this.lineVao = vao;

    const renderBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, renderBuffer);
    gl.renderbufferStorage(
      gl.RENDERBUFFER,
      gl.DEPTH_COMPONENT16,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
    );

    const texture = gl.createTexture()!;
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
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
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );
    this.frameBuffer = frameBuffer;
    this.texture = texture;
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);

    // lines
    const linesVert = `#version 300 es
    in vec2 position;
    out vec2 vPosition;

    void main(void) {
      gl_Position = vec4(position.x, position.y, 0.0, 1.0);
      vPosition = (gl_Position.xy + vec2(1.0)) / 2.0;
    }
    `;
    const linesFrag = `#version 300 es
    precision mediump float;
    uniform sampler2D texture0;
    in vec2 vPosition;
    out vec4 outColor;

    void main(void) {
      vec4 c = texture(texture0, vPosition);
      outColor = vec4(c.rgb, 1.0);
    }
    `;
    const linesProgram = LinesDrawer._createProgram(gl, linesVert, linesFrag);
    this.linesProgram = linesProgram;
    const linesVao = gl.createVertexArray()!;
    gl.bindVertexArray(linesVao);
    const linesVbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, linesVbo);
    // ビルボード
    const positions = [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    const positionAttrLoc = gl.getAttribLocation(linesProgram, "position");
    gl.enableVertexAttribArray(positionAttrLoc);
    gl.vertexAttribPointer(positionAttrLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this.linesVao = linesVao;
    // TODO configure uniform location
  }
  reset(sx: number, sy: number) {
    const { gl, frameBuffer } = this;
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    // clear framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // clear
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.points = [];
    this.prevPoint = [sx / width, sy / height].map((p) => p * 2.0 - 1.0);
  }
  lineTo(x: number, y: number) {
    // TODO
    const { gl, lineVbo: vbo, prevPoint, radius: radius } = this;
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const np = [x / width, y / height].map((p) => p * 2.0 - 1.0);
    if (!prevPoint) {
      throw new Error("prevPoint not set");
    }
    // set points (circle and rectangle)
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
    // render to framebuffer
    gl.useProgram(this.lineProgram);
    gl.bindVertexArray(this.lineVao);
    gl.clearColor(1, 1, 1, 1);
    gl.drawArrays(gl.TRIANGLES, 0, LinesDrawer.LINES_BUFFER_LENGTH);
    gl.bindVertexArray(null);
    this.points = points;
    this.prevPoint = np;
  }
  commit() {
    const { gl, linesProgram, linesVao } = this;
    gl.useProgram(linesProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.bindVertexArray(linesVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6 * 2);
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
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    linesDrawer.current = new LinesDrawer(gl);
    linesDrawer.current?.reset(150, 150);
    linesDrawer.current?.lineTo(300, 300);
    linesDrawer.current?.commit();
    gl.flush();
    gl.endFrameEXP();

    setTimeout(() => {
      linesDrawer.current?.lineTo(150, 200);
      linesDrawer.current?.commit();
      gl.flush();
      gl.endFrameEXP();
    }, 1000);

    setTimeout(() => {
      linesDrawer.current?.lineTo(200, 350);
      linesDrawer.current?.commit();
      gl.flush();
      gl.endFrameEXP();
    }, 2000);

    /*
     * function renderLoop() {
     *   gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
     *   requestAnimationFrame(renderLoop);
     * }
     * requestAnimationFrame(renderLoop); */
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
              // lines.current = genSegmentedLines();
              // linesChanged.current = true;
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
