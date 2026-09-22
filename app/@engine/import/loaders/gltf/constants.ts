import type { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { DRACOLoader, KTX2Loader } from 'three/addons';
import {
  type AnimationClip,
  type BufferAttribute,
  type Camera,
  ClampToEdgeWrapping,
  type CompressedTexture,
  type Group,
  type InterleavedBufferAttribute,
  InterpolateDiscrete,
  InterpolateLinear,
  LinearFilter,
  LinearMipmapLinearFilter,
  LinearMipmapNearestFilter,
  type LoadingManager,
  type Material,
  type Mesh,
  MirroredRepeatWrapping,
  NearestFilter,
  NearestMipmapLinearFilter,
  NearestMipmapNearestFilter,
  type Object3D,
  RepeatWrapping,
  type SkinnedMesh,
  type Texture,
  type TextureFilter,
  type Wrapping,
} from 'three';
import type {
  GLTFBinaryExtension,
  GLTFDracoMeshCompressionExtension,
  GLTFLightsExtension,
  GLTFMaterialsAnisotropyExtension,
  GLTFMaterialsBumpExtension,
  GLTFMaterialsClearcoatExtension,
  GLTFMaterialsDispersionExtension,
  GLTFMaterialsIorExtension,
  GLTFMaterialsIridescenceExtension,
  GLTFMaterialsSheenExtension,
  GLTFMaterialsSpecularExtension,
  GLTFMaterialsTransmissionExtension,
  GLTFMaterialsUnlitExtension,
  GLTFMaterialsVolumeExtension,
  GLTFMeshoptCompression,
  GLTFMeshQuantizationExtension,
  GLTFTextureAVIFExtension,
  GLTFTextureBasisUExtension,
  GLTFTextureTransformExtension,
  GLTFTextureWebPExtension,
} from './extensions';
import type { ModelLoaderResult } from '../type';
import type { GLTFParser } from './GLTF-parser';

// 创建导出类型定义
export interface ExtensionsType {
  EXT_MATERIALS_BUMP: string;
  EXT_MESH_GPU_INSTANCING: string;
  EXT_MESHOPT_COMPRESSION: string;
  EXT_TEXTURE_AVIF: string;
  EXT_TEXTURE_WEBP: string;
  KHR_BINARY_GLTF: string;
  KHR_DRACO_MESH_COMPRESSION: string;
  KHR_LIGHTS_PUNCTUAL: string;
  KHR_MATERIALS_ANISOTROPY: string;
  KHR_MATERIALS_CLEARCOAT: string;
  KHR_MATERIALS_DISPERSION: string;
  KHR_MATERIALS_EMISSIVE_STRENGTH: string;
  KHR_MATERIALS_IOR: string;
  KHR_MATERIALS_IRIDESCENCE: string;
  KHR_MATERIALS_SHEEN: string;
  KHR_MATERIALS_SPECULAR: string;
  KHR_MATERIALS_TRANSMISSION: string;
  KHR_MATERIALS_UNLIT: string;
  KHR_MATERIALS_VOLUME: string;
  KHR_MESH_QUANTIZATION: string;
  KHR_TEXTURE_BASISU: string;
  KHR_TEXTURE_TRANSFORM: string;
}

export const EXTENSIONS: ExtensionsType = {
  EXT_MATERIALS_BUMP: 'EXT_materials_bump',
  EXT_MESH_GPU_INSTANCING: 'EXT_mesh_gpu_instancing',
  EXT_MESHOPT_COMPRESSION: 'EXT_meshopt_compression',
  EXT_TEXTURE_AVIF: 'EXT_texture_avif',
  EXT_TEXTURE_WEBP: 'EXT_texture_webp',
  KHR_BINARY_GLTF: 'KHR_binary_glTF',
  KHR_DRACO_MESH_COMPRESSION: 'KHR_draco_mesh_compression',
  KHR_LIGHTS_PUNCTUAL: 'KHR_lights_punctual',
  KHR_MATERIALS_ANISOTROPY: 'KHR_materials_anisotropy',
  KHR_MATERIALS_CLEARCOAT: 'KHR_materials_clearcoat',
  KHR_MATERIALS_DISPERSION: 'KHR_materials_dispersion',
  KHR_MATERIALS_EMISSIVE_STRENGTH: 'KHR_materials_emissive_strength',
  KHR_MATERIALS_IOR: 'KHR_materials_ior',
  KHR_MATERIALS_IRIDESCENCE: 'KHR_materials_iridescence',
  KHR_MATERIALS_SHEEN: 'KHR_materials_sheen',
  KHR_MATERIALS_SPECULAR: 'KHR_materials_specular',
  KHR_MATERIALS_TRANSMISSION: 'KHR_materials_transmission',
  KHR_MATERIALS_UNLIT: 'KHR_materials_unlit',
  KHR_MATERIALS_VOLUME: 'KHR_materials_volume',
  KHR_MESH_QUANTIZATION: 'KHR_mesh_quantization',
  KHR_TEXTURE_BASISU: 'KHR_texture_basisu',
  KHR_TEXTURE_TRANSFORM: 'KHR_texture_transform',
};

export interface WebGLConstantsType {
  FLOAT: number;
  FLOAT_MAT3: number;
  FLOAT_MAT4: number;
  FLOAT_VEC2: number;
  FLOAT_VEC3: number;
  FLOAT_VEC4: number;
  LINE_LOOP: number;
  LINE_STRIP: number;
  LINEAR: number;
  LINES: number;
  POINTS: number;
  REPEAT: number;
  SAMPLER_2D: number;
  TRIANGLE_FAN: number;
  TRIANGLE_STRIP: number;
  TRIANGLES: number;
  UNSIGNED_BYTE: number;
  UNSIGNED_SHORT: number;
}

export const WEBGL_CONSTANTS: WebGLConstantsType = {
  FLOAT: 5126,
  // FLOAT_MAT2: 35674,
  FLOAT_MAT3: 35675,
  FLOAT_MAT4: 35676,
  FLOAT_VEC2: 35664,
  FLOAT_VEC3: 35665,
  FLOAT_VEC4: 35666,
  LINE_LOOP: 2,
  LINE_STRIP: 3,
  LINEAR: 9729,
  LINES: 1,
  POINTS: 0,
  REPEAT: 10497,
  SAMPLER_2D: 35678,
  TRIANGLE_FAN: 6,
  TRIANGLE_STRIP: 5,
  TRIANGLES: 4,
  UNSIGNED_BYTE: 5121,
  UNSIGNED_SHORT: 5123,
};

export interface WebGLComponentTypesType {
  5120: Int8ArrayConstructor;
  5121: Uint8ArrayConstructor;
  5122: Int16ArrayConstructor;
  5123: Uint16ArrayConstructor;
  5125: Uint32ArrayConstructor;
  5126: Float32ArrayConstructor;
}

export const WEBGL_COMPONENT_TYPES: WebGLComponentTypesType = {
  5120: Int8Array,
  5121: Uint8Array,
  5122: Int16Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array,
};

export interface WebGLFiltersType {
  9728: TextureFilter;
  9729: TextureFilter;
  9984: TextureFilter;
  9985: TextureFilter;
  9986: TextureFilter;
  9987: TextureFilter;
}

export const WEBGL_FILTERS: WebGLFiltersType = {
  9728: NearestFilter,
  9729: LinearFilter,
  9984: NearestMipmapNearestFilter,
  9985: LinearMipmapNearestFilter,
  9986: NearestMipmapLinearFilter,
  9987: LinearMipmapLinearFilter,
};

export interface WebGLWrappingsType {
  10497: Wrapping;
  33071: Wrapping;
  33648: Wrapping;
}

export const WEBGL_WRAPPINGS: WebGLWrappingsType = {
  10497: RepeatWrapping,
  33071: ClampToEdgeWrapping,
  33648: MirroredRepeatWrapping,
};

export interface WebGLTypeSizesType {
  MAT2: number;
  MAT3: number;
  MAT4: number;
  SCALAR: number;
  VEC2: number;
  VEC3: number;
  VEC4: number;
}

export const WEBGL_TYPE_SIZES: WebGLTypeSizesType = {
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
};

export interface AttributesType {
  [key: string]: string; // 允许用任意字符串索引
  COLOR_0: string;
  JOINTS_0: string;
  NORMAL: string;
  POSITION: string;
  TANGENT: string;
  TEXCOORD_0: string;
  TEXCOORD_1: string;
  TEXCOORD_2: string;
  TEXCOORD_3: string;
  WEIGHTS_0: string;
}

export const ATTRIBUTES: AttributesType = {
  COLOR_0: 'color',
  JOINTS_0: 'skinIndex',
  NORMAL: 'normal',
  POSITION: 'position',
  TANGENT: 'tangent',
  TEXCOORD_0: 'uv',
  TEXCOORD_1: 'uv1',
  TEXCOORD_2: 'uv2',
  TEXCOORD_3: 'uv3',
  WEIGHTS_0: 'skinWeight',
};

export interface PathPropertiesType {
  rotation: string;
  scale: string;
  translation: string;
  weights: string;
}

export const PATH_PROPERTIES: PathPropertiesType = {
  rotation: 'quaternion',
  scale: 'scale',
  translation: 'position',
  weights: 'morphTargetInfluences',
};

export interface InterpolationType {
  CUBICSPLINE: undefined;
  LINEAR: number;
  STEP: number;
}

export const INTERPOLATION: InterpolationType = {
  CUBICSPLINE: undefined, // We use a custom interpolant (GLTFCubicSplineInterpolation) for CUBICSPLINE tracks. Each
  // keyframe track will be initialized with a default interpolation type, then modified.
  LINEAR: InterpolateLinear,
  STEP: InterpolateDiscrete,
};

export interface AlphaModesType {
  BLEND: string;
  MASK: string;
  OPAQUE: string;
}

export const ALPHA_MODES: AlphaModesType = {
  BLEND: 'BLEND',
  MASK: 'MASK',
  OPAQUE: 'OPAQUE',
};

export const BINARY_EXTENSION_HEADER_MAGIC = 'glTF';
export const BINARY_EXTENSION_HEADER_LENGTH = 12;

export interface BinaryExtensionChunkTypesType {
  BIN: number;
  JSON: number;
}

export const BINARY_EXTENSION_CHUNK_TYPES: BinaryExtensionChunkTypesType = {
  BIN: 0x004e4942,
  JSON: 0x4e4f534a,
};

export interface WebGLInterpolateType {
  LINEAR: number;
  STEP: number;
}

export const WEBGL_INTERPOLATE: WebGLInterpolateType = {
  LINEAR: InterpolateLinear,
  STEP: InterpolateDiscrete,
};

// 导出公共类型定义
export type GLTFComponentType
  = | 5120 // Int8Array
    | 5121 // Uint8Array
    | 5122 // Int16Array
    | 5123 // Uint16Array
    | 5125 // Uint32Array
    | 5126; // Float32Array

export type GLTFAccessorType = 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4' | 'MAT2' | 'MAT3' | 'MAT4';

export type TypedArray
  = | Int8Array
    | Uint8Array
    | Int16Array
    | Uint16Array
    | Uint32Array
    | Float32Array;

export interface GLTFAccessor {
  bufferView?: number;
  byteOffset?: number;
  componentType: GLTFComponentType;
  count: number;
  max?: number[];
  min?: number[];
  normalized?: boolean;
  sparse?: {
    count: number;
    indices: {
      bufferView: number;
      byteOffset?: number;
      componentType: GLTFComponentType;
    };
    values: {
      bufferView: number;
      byteOffset?: number;
    };
  };
  type: GLTFAccessorType;
}

export interface GLTFBufferView {
  buffer: number;
  byteLength: number;
  byteOffset?: number;
  byteStride?: number;
  extensions: Record<string, GLTFExtensionObject>;
  target?: number;
}
export interface GLTFLight {
  color: [number, number, number];
  intensity: number;
  name?: string;
  range?: number;
  spot?: {
    innerConeAngle: number;
    outerConeAngle: number;
  };
  type: 'point' | 'spot' | 'directional' | 'ambient' | 'area';
}

export interface GLTFMaterial {
  alphaCutoff?: number;
  alphaMode?: string;
  doubleSided?: boolean;
  emissiveFactor?: [number, number, number];
  emissiveTexture?: GLTFTextureInfo;
  extensions?: Record<string, GLTFExtensionObject>;
  extras?: GLTFExtras;
  name?: string;
  normalTexture?: GLTFTextureInfo & {
    scale?: number;
  };
  occlusionTexture?: GLTFTextureInfo & {
    strength?: number;
  };
  pbrMetallicRoughness?: {
    baseColorFactor?: [number, number, number, number];
    baseColorTexture?: GLTFTextureInfo;
    metallicFactor?: number;
    metallicRoughnessTexture?: GLTFTextureInfo;
    roughnessFactor?: number;
  };
}

export interface GLTFTextureInfo {
  extensions?: Record<string, GLTFExtensionObject>;
  extras?: GLTFExtras;
  index: number;
  scale?: number;
  texCoord?: number;
}

export interface GLTFNode {
  camera?: number;
  children?: number[];
  extensions?: Record<string, GLTFExtensionObject>;
  extras?: GLTFExtras;
  isBone?: boolean;
  matrix?: number[];
  mesh?: number;
  name?: string;
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
  skin?: number;
  translation?: [number, number, number];
  weights?: number[];
}

export interface GLTFPrimitive {
  attributes: {
    [key: string]: number;
  };
  extensions?: Record<string, GLTFExtensionObject>;
  extras?: GLTFExtras;
  indices?: number;
  material?: number;
  mode?: number;
  targets?: GLTFMorphTarget[];
}

// GLTF相关接口定义
export interface GLTFLoaderResult {
  animations: AnimationClip[];
  asset: {
    copyright?: string;
    extensions?: Record<string, GLTFExtensionObject>;
    extras?: GLTFExtras;
    generator?: string;
    minVersion?: string;
    version: string;
  };
  cameras: Camera[];
  parser: GLTFParserInterface;
  scene: Group;
  scenes: Group[];
  userData: GLTFExtras;
}

// 定义GLTF扩展对象接口
export interface GLTFExtensionObject {
  [key: string]:
    | GLTFExtras
    | Record<
      string,
      | string
      | number
      | GLTFLight[]
      | GLTFTextureInfo
      | GLTFNode
      | GLTFAnimationChannel
      | GLTFAnimationSampler
      | GLTFAnimation
    >;
}

// 定义GLTF额外数据类型
export type GLTFExtras = string | number | boolean | object | null | object[];

// 定义GLTF解析器接口
export interface GLTFParserInterface {
  associations: Map<
    Object3D | Material | Texture,
    {
      index: number;
      primitives?: number[];
      type: string;
    }
  >;
  getDependencies(
    type: string,
  ): Promise<
    Array<
      | Object3D
      | Material
      | Texture
      | AnimationClip
      | Camera
      | BufferAttribute
      | InterleavedBufferAttribute
    >
  >;
  getDependency(
    type: string,
    index: number,
  ): Promise<
    | Object3D
    | Material
    | Texture
    | AnimationClip
    | Camera
    | BufferAttribute
    | InterleavedBufferAttribute
  >;
  json: GLTFJsonData;
  loadAnimation(index: number): Promise<AnimationClip>;
  loadBufferView(index: number): Promise<ArrayBuffer>;
  loadMaterial(index: number): Promise<Material>;
  loadMesh(index: number): Promise<Mesh | Group>;
  loadNode(index: number): Promise<Object3D>;
  loadScene(index: number): Promise<Group>;
  loadSkin(index: number): Promise<{
    inverseBindMatrices?: BufferAttribute | InterleavedBufferAttribute;
    joints: number[];
  }>;
  loadTexture(index: number): Promise<Texture | CompressedTexture>;
}

export type GLTFExtensionParseType
  = | GLTFBinaryExtension
    | GLTFMaterialsIorExtension
    | GLTFMaterialsTransmissionExtension
    | GLTFMaterialsDispersionExtension
    | GLTFMaterialsUnlitExtension
    | GLTFMaterialsVolumeExtension
    | GLTFMaterialsSpecularExtension
    | GLTFMaterialsIridescenceExtension
    | GLTFMaterialsAnisotropyExtension
    | GLTFMaterialsBumpExtension
    | GLTFMaterialsSheenExtension
    | GLTFLightsExtension
    | GLTFMeshoptCompression
    | GLTFTextureBasisUExtension
    | GLTFTextureWebPExtension
    | GLTFTextureAVIFExtension
    | GLTFDracoMeshCompressionExtension
    | GLTFTextureTransformExtension
    | GLTFMeshQuantizationExtension
    | GLTFMaterialsClearcoatExtension;

export interface GLTFAsset {
  copyright?: string;
  extensions?: Record<string, GLTFExtensionObject>;
  extras?: GLTFExtras;
  generator?: string;
  minVersion?: string;
  version: number[];
}

export interface GLTFLoaderPlugin {
  afterRoot?: (result: ModelLoaderResult) => Promise<void> | null;
  beforeRoot?: () => Promise<void> | null;
  createNodeAttachment?: (nodeIndex: number) => Promise<Object3D> | null;
  createNodeMesh?: (nodeIndex: number) => Promise<Group | Mesh | SkinnedMesh> | null;
  extendMaterialParams?: (
    materialIndex: number,
    materialParams: { [key: string]: unknown },
  ) => Promise<unknown> | null;
  getMaterialType?: (materialIndex: number) => typeof Material | null;
  loadAnimation?: (index: number) => Promise<AnimationClip>;
  loadBufferView?: (bufferViewIndex: number) => Promise<ArrayBuffer> | null;
  loadMaterial?: (materialIndex: number) => Promise<Material> | null;
  loadMesh?: (meshIndex: number) => Promise<Group | Mesh | SkinnedMesh> | null;
  loadNode?: (nodeIndex: number) => Promise<Object3D> | null;
  loadTexture?: (textureIndex: number) => Promise<Texture> | null;
  readonly name: string;
}
// 定义GLTF JSON数据结构
export interface GLTFJsonData {
  [key: string]: unknown;
  accessors?: GLTFAccessor[];
  animations?: GLTFAnimation[];
  asset: GLTFAsset;
  buffers?: GLTFBuffer[];
  bufferViews?: GLTFBufferView[];
  cameras?: GLTFCamera[];
  extensions?: Record<string, GLTFExtensionObject>;
  extensionsRequired?: string[];
  extensionsUsed?: string[];
  extras?: GLTFExtras;
  images?: GLTFImage[];
  materials?: GLTFMaterial[];
  meshes?: GLTFMesh[];
  nodes?: GLTFNode[];
  samplers?: GLTFSampler[];
  scene?: number;
  scenes?: GLTFScene[];
  skins?: GLTFSkin[];
  textures?: GLTFTexture[];
}

// 定义GLTF场景
export interface GLTFScene {
  extensions?: Record<string, GLTFExtensionObject>;
  extras?: GLTFExtras;
  name?: string;
  nodes?: number[];
}

// GLTF相机定义
export interface GLTFCamera {
  extensions?: Record<string, GLTFExtensionObject>;
  extras?: GLTFExtras;
  name?: string;
  orthographic?: {
    extensions?: Record<string, GLTFExtensionObject>;
    extras?: GLTFExtras;
    xmag: number;
    ymag: number;
    zfar: number;
    znear: number;
  };
  perspective?: {
    aspectRatio?: number;
    extensions?: Record<string, GLTFExtensionObject>;
    extras?: GLTFExtras;
    yfov: number;
    zfar?: number;
    znear: number;
  };
  type: 'perspective' | 'orthographic';
}

// GLTF动画定义
export interface GLTFAnimation {
  channels: GLTFAnimationChannel[];
  extensions?: Record<string, GLTFExtensionObject>;
  extras?: GLTFExtras;
  name?: string;
  parameters: undefined;
  samplers: GLTFAnimationSampler[];
}

export interface GLTFAnimationTarget {
  extensions?: Record<string, GLTFExtensionObject>;
  extras?: GLTFExtras;
  node?: number;
  path: 'translation' | 'rotation' | 'scale' | 'weights';
}

// GLTF动画通道
export interface GLTFAnimationChannel {
  extensions?: Record<string, GLTFExtensionObject>;
  extras?: GLTFExtras;
  sampler: number;
  target: GLTFAnimationTarget;
}

// GLTF动画采样器
export interface GLTFAnimationSampler {
  extensions?: Record<string, GLTFExtensionObject>;
  extras?: GLTFExtras;
  input: number;
  interpolation?: 'LINEAR' | 'STEP' | 'CUBICSPLINE';
  output: number;
}

// GLTF蒙皮
export interface GLTFSkin {
  extensions?: Record<string, GLTFExtensionObject>;
  extras?: GLTFExtras;
  inverseBindMatrices?: number;
  joints: number[];
  name?: string;
  skeleton?: number;
}

// GLTF纹理
export interface GLTFTexture {
  extensions?: Record<string, GLTFExtensionObject>;
  extras?: GLTFExtras;
  magFilter?: number;
  minFilter?: number;
  name?: string;
  sampler?: number;
  source?: number;
  wrapS?: number;
  wrapT?: number;
}

// GLTF采样器
export interface GLTFSampler {
  extensions?: Record<string, GLTFExtensionObject>;
  extras?: GLTFExtras;
  magFilter?: number;
  minFilter?: number;
  name?: string;
  wrapS?: number;
  wrapT?: number;
}

// GLTF图像
export interface GLTFImage {
  bufferView?: number;
  extensions?: Record<string, GLTFExtensionObject>;
  extras?: GLTFExtras;
  mimeType?: string;
  name?: string;
  uri?: string;
}

// GLTF网格
export interface GLTFMesh {
  extensions?: Record<string, GLTFExtensionObject>;
  extras?: GLTFExtras;
  isSkinnedMesh?: boolean;
  name?: string;
  primitives: GLTFPrimitive[];
  weights?: number[];
}

// GLTF缓冲区
export interface GLTFBuffer {
  byteLength: number;
  extensions?: Record<string, GLTFExtensionObject>;
  extras?: GLTFExtras;
  name?: string;
  type: string;
  uri?: string;
}

export interface GLTF {
  animations: AnimationClip[];
  asset: GLTFAsset;
  cameras: Camera[];
  parser: GLTFParser;
  scene: Group;
  scenes: Group[];
  userData: Record<string, unknown>;
}

export interface GLTFMorphTarget {
  COLOR_0: number;
  extras?: { targetNames: string };
  name: string;
  NORMAL: number;
  POSITION: number;
  primitives: GLTFPrimitive[];
  TEXCOORD_0: number;
  TEXCOORD_1: number;
  weights: number[];
}

// 加载器配置选项
export interface GLTFLoaderOptions {
  /** 跨域设置 */
  crossOrigin: string;
  dracoLoader?: DRACOLoader;
  ktx2Loader?: KTX2Loader;

  /** 加载管理器 */
  manager: LoadingManager;

  meshoptDecoder?: typeof MeshoptDecoder;

  /** 资源路径 */
  path: string;

  /** 请求头设置 */
  requestHeader: Record<string, string>;
  resourcePath?: string;
  withCredentials?: boolean;
}
