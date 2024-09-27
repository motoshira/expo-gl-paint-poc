import { Path } from "./path";

/*
 *  描画するクラス
 *
 */
export class PathDrawer {
  // TODO
  private path: Path;
  constructor(path: Path) {
    this.path = path;
  }
  touchStart() {
    console.log("touchStart");
  }
  touchMove() {
    console.log("touchMove");
  }
  touchEnd() {
    console.log("touchEnd");
  }
}
