import type { AnimationClip, Group, LoadingManager } from 'three';

/**
 * Loader 参数
 */
export interface LoaderOptions {
  /**
   * 加载管理器
   */
  manager?: LoadingManager;
}

export interface BaseInfo {
  /**
   * 是否有UV
   */
  isUVMapped: boolean;
  /**
   * 多边形面数量
   */
  polygons: number;
  /**
   * 四边形面数量
   */
  quads: number;
  /**
   * 三角形面数量
   */
  triangles: number;
  /**
   * 顶点数量
   */
  vertices: number;
}

export interface SceneInfo extends BaseInfo {
  /**
   * 拓扑类型
   */
  topology: 'Triangle' | 'Quad';
};

export interface ModelLoaderResult {
  animations: AnimationClip[];
  modelInfo: Record<string, BaseInfo>;
  scene: Group;
  sceneInfo: SceneInfo;
}
