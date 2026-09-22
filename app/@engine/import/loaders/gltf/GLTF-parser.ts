import {
  AnimationClip,
  Bone,
  BufferAttribute,
  BufferGeometry,
  type Camera,
  ClampToEdgeWrapping,
  Color,
  type CompressedTexture,
  DoubleSide,
  FileLoader,
  Group,
  ImageBitmapLoader,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  InterpolateLinear,
  type InterpolationModes,
  type KeyframeTrack,
  Line,
  LinearFilter,
  LinearMipmapLinearFilter,
  LinearSRGBColorSpace,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  type Loader,
  LoaderUtils,
  type MagnificationTextureFilter,
  Material,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  type MeshMatcapMaterial,
  type MeshPhysicalMaterial,
  MeshStandardMaterial,
  type MeshStandardMaterialParameters,
  NearestFilter,
  NumberKeyframeTrack,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  PropertyBinding,
  QuaternionKeyframeTrack,
  RepeatWrapping,
  Skeleton,
  SkinnedMesh,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  TriangleFanDrawMode,
  TriangleStripDrawMode,
  type TypedArray,
  Vector2,
  VectorKeyframeTrack,
} from 'three';
import { setModelMeshEdgeDomain } from '~/@engine/model';
import type {
  GLTFBinaryExtension,
  GLTFDracoMeshCompressionExtension,
  GLTFLightsExtension,
  GLTFMaterialsClearcoatExtension,
  GLTFMaterialsUnlitExtension,
  GLTFMeshGpuInstancing,
  GLTFTextureTransformExtension,
} from './extensions';
import type { BaseInfo, ModelLoaderResult, SceneInfo } from '../type';
import {
  ALPHA_MODES,
  EXTENSIONS,
  type GLTF,
  type GLTFAnimation,
  type GLTFAnimationChannel,
  type GLTFAnimationSampler,
  type GLTFAnimationTarget,
  type GLTFCamera,
  type GLTFExtensionParseType,
  type GLTFJsonData,
  type GLTFLoaderOptions,
  type GLTFLoaderPlugin,
  type GLTFMaterial,
  type GLTFMesh,
  type GLTFNode,
  type GLTFPrimitive,
  type GLTFSampler,
  type GLTFScene,
  type GLTFSkin,
  type GLTFTextureInfo,
  INTERPOLATION,
  PATH_PROPERTIES,
  WEBGL_COMPONENT_TYPES,
  WEBGL_CONSTANTS,
  WEBGL_FILTERS,
  WEBGL_TYPE_SIZES,
  WEBGL_WRAPPINGS,
} from './constants';
import {
  _identityMatrix,
  addPrimitiveAttributes,
  addUnknownExtensionsToUserData,
  assignExtrasToUserData,
  createDefaultMaterial,
  createPrimitiveKey,
  getImageURIMimeType,
  getNormalizedComponentScale,
  toTrianglesDrawMode,
  updateMorphTargets,
} from './utils';
import {
  GLTFCubicSplineInterpolant,
  GLTFCubicSplineQuaternionInterpolant,
} from './GLTF-cubic-splineInterpolation';
import { GLTFRegistry } from './GLTF-registry';

/* GLTF PARSER */

interface cameraCache {
  refs: Record<number, number>;
  uses: Record<number, number>;
}

interface CubicSplineTrack extends KeyframeTrack {
  createInterpolant: {
    (result: TypedArray): GLTFCubicSplineInterpolant | GLTFCubicSplineQuaternionInterpolant;
    isInterpolantFactoryMethodGLTFCubicSpline: boolean;
  };
}

export class GLTFParser {
  json: GLTFJsonData;
  extensions: Record<string, GLTFExtensionParseType | boolean>;
  plugins: Record<string, GLTFExtensionParseType>;
  options: GLTFLoaderOptions;
  cache: GLTFRegistry;
  associations: Map<
    | Object3D
    | MeshMatcapMaterial
    | Group
    | Texture
    | MeshPhysicalMaterial
    | MeshStandardMaterial
    | MeshBasicMaterial,
    | { textures: number }
    | { materials: number }
    | { meshes: number; primitives: number }
    | { cameras: number }
    | { meshes: number }
    | undefined
    | { nodes: number }
  >;

  primitiveCache: Record<string, { primitive: GLTFPrimitive; promise: Promise<BufferGeometry> }>;
  nodeCache: Record<string, Promise<Object3D>>;
  meshCache: { refs: Record<number, number>; uses: Record<number, number> };
  cameraCache: cameraCache;
  lightCache: { refs: Record<number, number>; uses: Record<number, number> };
  sourceCache: Record<number, Promise<GLTF | Texture>>;
  textureCache: Record<string, Promise<Texture | CompressedTexture | null>>;
  nodeNamesUsed: Record<string, number | string>;
  textureLoader: TextureLoader | ImageBitmapLoader | Loader;
  fileLoader: FileLoader;
  modelInfoMap: Record<string, BaseInfo> = {};
  sceneInfo: SceneInfo;

  constructor(
    json: GLTFJsonData = {
      asset: {
        version: [],
      },
    },
    options: GLTFLoaderOptions,
  ) {
    this.json = json;
    this.extensions = {};
    this.plugins = {};
    this.options = options;

    // loader object cache
    this.cache = new GLTFRegistry();

    // associations between Three.js objects and glTF elements
    this.associations = new Map();

    // BufferGeometry caching
    this.primitiveCache = {};

    // Node cache
    this.nodeCache = {};

    // Object3D instance caches
    this.meshCache = { refs: {}, uses: {} };
    this.cameraCache = { refs: {}, uses: {} };
    this.lightCache = { refs: {}, uses: {} };

    this.sourceCache = {};
    this.textureCache = {};

    // Track node names, to ensure no duplicates
    this.nodeNamesUsed = {};

    // Use an ImageBitmapLoader if imageBitmaps are supported. Moves much of the
    // expensive work of uploading a texture to the GPU off the main thread.

    let isSafari = false;
    let safariVersion = -1;
    let isFirefox = false;
    let firefoxVersion: number = -1;

    if (typeof navigator !== 'undefined') {
      const userAgent = navigator.userAgent;

      isSafari = /^((?!chrome|android).)*safari/i.test(userAgent) === true;
      const safariMatch = userAgent.match(/Version\/(\d+)/) as [string, string];

      safariVersion = isSafari && safariMatch ? parseInt(safariMatch[1], 10) : -1;

      isFirefox = userAgent.includes('Firefox');
      firefoxVersion = isFirefox
        ? parseInt(userAgent.match(/Firefox\/([0-9]+)\./)?.[1] || '0', 10)
        : -1;
    }

    if (
      typeof createImageBitmap === 'undefined'
      || (isSafari && safariVersion < 17)
      || (isFirefox && firefoxVersion < 98)
    ) {
      this.textureLoader = new TextureLoader(this.options.manager);
    } else {
      this.textureLoader = new ImageBitmapLoader(this.options.manager);
    }

    this.textureLoader.setCrossOrigin(this.options.crossOrigin);
    this.textureLoader.setRequestHeader(this.options.requestHeader);

    this.fileLoader = new FileLoader(this.options.manager);
    this.fileLoader.setResponseType('arraybuffer');

    if (this.options.crossOrigin === 'use-credentials') {
      this.fileLoader.setWithCredentials(true);
    }

    // 初始化几何摘要；UV按任一Mesh包含的语义汇总。
    this.sceneInfo = {

      isUVMapped: false,
      polygons: 0,
      quads: 0,
      topology: 'Triangle',
      triangles: 0,
      vertices: 0,
    };
  }

  setExtensions(extensions: Record<string, GLTFExtensionParseType | boolean>) {
    this.extensions = extensions;
  }

  setPlugins(plugins: Record<string, GLTFExtensionParseType>) {
    this.plugins = plugins;
  }

  parse(onLoad: (result: ModelLoaderResult) => void, onError: (error: Error) => void) {
    const json = this.json;

    // Clear the loader cache
    this.cache.removeAll();
    this.nodeCache = {};

    // Mark the special nodes/meshes in json for efficient parse
    this._invokeAll<GLTFLightsExtension, Promise<void>>((ext) => {
      return ext._markDefs ? Promise.resolve(ext._markDefs()) : Promise.resolve();
    });

    Promise.all(
      this._invokeAll<GLTFLoaderPlugin, Promise<void>>((ext) => {
        return ext.beforeRoot?.() || Promise.resolve();
      }),
    )
      .then(() => {
        return Promise.all([
          this.getDependencies('scene'),
          this.getDependencies('animation'),
          this.getDependencies('camera'),
        ]);
      })
      .then((dependencies) => {
        const scenes = dependencies[0] as Group[];
        const scene = scenes[json.scene || 0] as Group;

        const result: ModelLoaderResult = {
          animations: dependencies[1] as AnimationClip[],
          modelInfo: this.modelInfoMap,
          scene,
          sceneInfo: this.sceneInfo,
        };

        // addUnknownExtensionsToUserData(extensions, result, json);

        // assignExtrasToUserData(result, json);

        return Promise.all(
          this._invokeAll<GLTFLoaderPlugin, Promise<void>>((ext) => {
            return ext.afterRoot ? ext.afterRoot(result) : Promise.resolve();
          }),
        ).then(() => {
          for (const scene of scenes) {
            scene.updateMatrixWorld();
          }

          onLoad(result);
        });
      })
      .catch(onError);
  }

  /**
   * Marks the special nodes/meshes in json for efficient parse.
   *
   * @private
   */
  _markDefs() {
    const nodeDefs = this.json?.nodes || [];
    const skinDefs = this.json?.skins || [];
    const meshDefs = this.json?.meshes || [];

    // Nothing in the node definition indicates whether it is a Bone or an
    // Object3D. Use the skins' joint references to mark bones.
    for (let skinIndex = 0, skinLength = skinDefs.length; skinIndex < skinLength; skinIndex++) {
      const joints = (skinDefs[skinIndex] as { joints: number[] }).joints;
      for (let i = 0, il = joints.length; i < il; i++) {
        const jointIndex = joints[i];
        (nodeDefs[jointIndex as number] as { isBone?: boolean }).isBone = true;
      }
    }

    // Iterate over all nodes, marking references to shared resources,
    // as well as skeleton joints.
    for (let nodeIndex = 0, nodeLength = nodeDefs.length; nodeIndex < nodeLength; nodeIndex++) {
      const nodeDef = nodeDefs[nodeIndex] as { camera?: number; mesh?: number; skin?: number };

      if (nodeDef.mesh !== undefined) {
        this._addNodeRef(this.meshCache, nodeDef.mesh);

        // Nothing in the mesh definition indicates whether it is
        // a SkinnedMesh or Mesh. Use the node's mesh reference
        // to mark SkinnedMesh if node has skin.
        if (nodeDef.skin !== undefined) {
          (meshDefs[nodeDef.mesh] as { isSkinnedMesh?: boolean }).isSkinnedMesh = true;
        }
      }

      if (nodeDef.camera !== undefined) {
        this._addNodeRef(this.cameraCache, nodeDef.camera);
      }
    }
  }

  /**
   * Counts references to shared node / Object3D resources. These resources
   * can be reused, or "instantiated", at multiple nodes in the scene
   * hierarchy. Mesh, Camera, and Light instances are instantiated and must
   * be marked. Non-scenegraph resources (like Materials, Geometries, and
   * Textures) can be reused directly and are not marked here.
   *
   * Example: CesiumMilkTruck sample model reuses "Wheel" meshes.
   *
   * @private
   * @param {Object} cache
   * @param {Object3D} index
   */
  _addNodeRef(
    cache: { refs: Record<number, number>; uses: Record<number, number> },
    index: number,
  ) {
    if (index === undefined) {
      return;
    }

    if (cache.refs[index] === undefined) {
      cache.refs[index] = cache.uses[index] = 0;
    }

    cache.refs[index]++;
  }

  /**
   * Returns a reference to a shared resource, cloning it if necessary.
   *
   * @private
   * @param {Object} cache
   * @param {number} index
   * @param {Object} object
   * @return {Object}
   */
  _getNodeRef(
    cache: { refs: Record<number, number>; uses: Record<number, number> },
    index: number,
    object: Object3D,
  ) {
    if ((cache.refs[index] as number) <= 1) {
      return object;
    }

    const ref = object.clone();

    // Propagates mappings to the cloned object, prevents mappings on the
    // original object from being lost.
    const updateMappings = (original: Object3D, clone: Object3D) => {
      const mappings = this.associations.get(original);

      if (mappings != null) {
        this.associations.set(clone, mappings);
      }

      for (const [i, child] of original.children.entries()) {
        updateMappings(child, clone.children[i] as Object3D);
      }
    };

    updateMappings(object, ref);

    ref.name += '_instance_' + (cache.uses[index] as number)++;

    return ref;
  }

  _invokeOne<T, R = Promise<void>>(callback: (extension: T) => R | null): R | null {
    const extensions = Object.values(this.plugins);

    extensions.push(this as unknown as GLTFExtensionParseType);

    for (let i = 0; i < extensions.length; i++) {
      const result = callback(extensions[i] as T);

      if (result) {
        return result;
      }
    }

    return null;
  }

  _invokeAll<T, R = Promise<void>>(func: (ext: T) => R | null): R[] {
    const extensions = Object.values(this.plugins) as T[];

    extensions.unshift(this as unknown as GLTFExtensionParseType as T);

    const pending = [];

    for (let i = 0; i < extensions.length; i++) {
      const result = func(extensions[i] as T);

      if (result) {
        pending.push(result);
      }
    }

    return pending;
  }

  /**
   * Requests the specified dependency asynchronously, with caching.
   * @param {string} type - One of: "scene", "node", "mesh", "accessor", "bufferView", "buffer", "material", "texture", "skin", "animation", "camera"
   * @param {number} index - The index of the dependency.
   * @returns {Promise<Object3D|Material|THREE.Texture|Bone|AnimationClip>}
   */
  getDependency(
    type: string,
    index: number,
  ): Promise<
    | Object3D
    | Material
    | Texture
    | Bone
    | AnimationClip
    | ArrayBuffer
    | BufferAttribute
    | InterleavedBufferAttribute
  > {
    const cacheKey = type + ':' + index;
    let dependency = this.cache.get(cacheKey);

    if (!dependency) {
      switch (type) {
        case 'scene':
          dependency = this.loadScene(index);

          break;
        case 'node':
          dependency = this._invokeOne<GLTFLoaderPlugin, unknown>((ext) => {
            return ext.loadNode && ext.loadNode(index);
          });

          break;
        case 'mesh':
          dependency = this._invokeOne<
            GLTFLoaderPlugin,
            Promise<Group | Mesh | SkinnedMesh | Line | Points>
          >((ext) => {
            return ext.loadMesh ? ext.loadMesh(index) : null;
          });

          break;
        case 'accessor':
          dependency = this.loadAccessor(index);

          break;
        case 'bufferView':
          dependency = this._invokeOne<GLTFLoaderPlugin, Promise<ArrayBuffer>>((ext) => {
            return ext.loadBufferView ? ext.loadBufferView(index) : null;
          });

          break;
        case 'buffer':
          dependency = this.loadBuffer(index);

          break;
        case 'material':
          dependency = this._invokeOne<GLTFLoaderPlugin, Promise<Material>>((ext) => {
            return ext.loadMaterial ? ext.loadMaterial(index) : null;
          });

          break;
        case 'texture':
          dependency = this._invokeOne<GLTFLoaderPlugin, Promise<Texture>>((ext) => {
            return ext.loadTexture ? ext.loadTexture(index) : null;
          });

          break;
        case 'skin':
          dependency = this.loadSkin(index);

          break;
        case 'animation':
          dependency = this._invokeOne<GLTFLoaderPlugin, Promise<AnimationClip>>((ext) => {
            return ext.loadAnimation ? ext.loadAnimation(index) : null;
          });

          break;
        case 'camera':
          dependency = this.loadCamera(index) as Promise<Camera>;

          break;
        default:
          dependency = this._invokeOne<
            GLTFParser,
            Promise<
              | Object3D
              | Material
              | Texture
              | Bone
              | AnimationClip
              | ArrayBuffer
              | BufferAttribute
              | InterleavedBufferAttribute
            >
          >((ext) => {
            return ext != this && ext.getDependency ? ext.getDependency(type, index) : null;
          });
          if (!dependency) {
            throw new Error('Unknown type: ' + type);
          }

          break;
      }

      this.cache.add(cacheKey, dependency);
    }

    return dependency as Promise<
      | Object3D
      | Material
      | Texture
      | Bone
      | AnimationClip
      | ArrayBuffer
      | BufferAttribute
      | InterleavedBufferAttribute
    >;
  }

  /**
   * Requests all dependencies of the specified type asynchronously, with caching.
   *
   * @private
   * @param {string} type
   * @return {Promise<Array<Object>>}
   */
  getDependencies(type: string) {
    let dependencies = this.cache.get(type);
    const json = this.json;
    if (!dependencies) {
      const gltfType = type + (type === 'mesh' ? 'es' : 's');
      const defs = (json as Record<string, unknown[]>)[gltfType] || [];

      dependencies = Promise.all(
        defs.map((_, index) => {
          return this.getDependency(type, index);
        }),
      );

      this.cache.add(type, dependencies);
    }

    return dependencies;
  }

  /**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#buffers-and-buffer-views
   *
   * @private
   * @param {number} bufferIndex
   * @return {Promise<ArrayBuffer>}
   */
  loadBuffer(bufferIndex: number): Promise<ArrayBuffer | null> {
    const gltfBuffer = this.json?.buffers || [];

    const bufferDef = gltfBuffer[bufferIndex] as {
      byteLength: number;
      type?: string;
      uri?: string;
    };
    const loader = this.fileLoader;

    if (bufferDef.type && bufferDef.type !== 'arraybuffer') {
      throw new Error('THREE.GLTFLoader: ' + bufferDef.type + ' buffer type is not supported.');
    }

    // If present, GLB container is required to be the first buffer.
    if (bufferDef.uri === undefined && bufferIndex === 0) {
      return Promise.resolve(
        (this.extensions[EXTENSIONS.KHR_BINARY_GLTF] as GLTFBinaryExtension).body,
      );
    }

    const options = this.options;

    return new Promise(
      (resolve: (value: ArrayBuffer) => void, reject: (reason?: Error) => void) => {
        loader.load(
          LoaderUtils.resolveURL(bufferDef.uri ?? '', options.path),
          (data: string | ArrayBuffer) => {
            if (data instanceof ArrayBuffer) resolve(data);
            else reject(new Error('GLTFLoader: Buffer data is not ArrayBuffer'));
          },
          undefined,
          () => {
            reject(new Error('THREE.GLTFLoader: Failed to load buffer "' + bufferDef.uri + '".'));
          },
        );
      },
    );
  }

  /**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#buffers-and-buffer-views
   *
   * @private
   * @param {number} bufferViewIndex
   * @return {Promise<ArrayBuffer>}
   */
  loadBufferView(bufferViewIndex: number): Promise<ArrayBuffer> {
    const gltfBufferViewDef = this.json?.bufferViews || [];
    const bufferViewDef = gltfBufferViewDef[bufferViewIndex] as {
      buffer: number;
      byteLength?: number;
      byteOffset?: number;
    };

    return this.getDependency('buffer', bufferViewDef.buffer).then((buffer) => {
      const byteLength = bufferViewDef.byteLength || 0;
      const byteOffset = bufferViewDef.byteOffset || 0;

      return (buffer as ArrayBuffer).slice(byteOffset, byteOffset + byteLength);
    });
  }

  /**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#accessors
   *
   * @private
   * @param {number} accessorIndex
   * @return {Promise<BufferAttribute|InterleavedBufferAttribute>}
   */
  loadAccessor(accessorIndex: number): Promise<BufferAttribute | InterleavedBufferAttribute> {
    const json = this.json;
    const GLTFAccessorDef = json.accessors || [];
    const GLTFBufferView = json.bufferViews || [];

    const accessorDef = GLTFAccessorDef[accessorIndex] as {
      bufferView?: number;
      byteOffset?: number;
      componentType: number;
      count: number;
      normalized?: boolean;
      sparse?: {
        count: number;
        indices: { bufferView: number; byteOffset?: number; componentType: number };
        values: { bufferView: number; byteOffset?: number };
      };
      type: string;
    };

    if (accessorDef.bufferView === undefined && accessorDef.sparse === undefined) {
      const itemSize = WEBGL_TYPE_SIZES[accessorDef.type as keyof typeof WEBGL_TYPE_SIZES];
      const TypedArray
        = WEBGL_COMPONENT_TYPES[accessorDef.componentType as keyof typeof WEBGL_COMPONENT_TYPES];
      const normalized = accessorDef.normalized === true;

      const array = new TypedArray(accessorDef.count * itemSize);

      return Promise.resolve(new BufferAttribute(array, itemSize, normalized));
    }

    const pendingBufferViews = [];

    if (accessorDef.bufferView !== undefined) {
      pendingBufferViews.push(this.getDependency('bufferView', accessorDef.bufferView));
    } else {
      pendingBufferViews.push(null);
    }

    if (accessorDef.sparse !== undefined) {
      pendingBufferViews.push(
        this.getDependency('bufferView', accessorDef.sparse.indices.bufferView),
      );
      pendingBufferViews.push(
        this.getDependency('bufferView', accessorDef.sparse.values.bufferView),
      );
    }

    return Promise.all(pendingBufferViews).then((bufferViews) => {
      const bufferView = bufferViews[0] as ArrayBuffer;

      const itemSize = WEBGL_TYPE_SIZES[accessorDef.type as keyof typeof WEBGL_TYPE_SIZES];
      const TypedArray
        = WEBGL_COMPONENT_TYPES[accessorDef.componentType as keyof typeof WEBGL_COMPONENT_TYPES];

      // For VEC3: itemSize is 3, elementBytes is 4, itemBytes is 12.
      const elementBytes = TypedArray.BYTES_PER_ELEMENT;
      const itemBytes = elementBytes * itemSize;
      const byteOffset = accessorDef.byteOffset || 0;
      const byteStride
        = accessorDef.bufferView !== undefined
          ? (GLTFBufferView[accessorDef.bufferView] as { byteStride?: number }).byteStride
          : undefined;
      const normalized = accessorDef.normalized === true;
      let array, bufferAttribute;

      // The buffer is not interleaved if the stride is the item size in bytes.
      if (byteStride && byteStride !== itemBytes) {
        // Each "slice" of the buffer, as defined by 'count' elements of 'byteStride' bytes, gets its own InterleavedBuffer
        // This makes sure that IBA.count reflects accessor.count properly
        const ibSlice = Math.floor(byteOffset / byteStride);
        const ibCacheKey
          = 'InterleavedBuffer:'
            + accessorDef.bufferView
            + ':'
            + accessorDef.componentType
            + ':'
            + ibSlice
            + ':'
            + accessorDef.count;
        let ib: InterleavedBuffer = this.cache.get(ibCacheKey);

        if (!ib) {
          array = new (TypedArray as {
            new (buffer: ArrayBuffer, byteOffset: number, length: number): TypedArray;
          })(bufferView, ibSlice * byteStride, (accessorDef.count * byteStride) / elementBytes);

          // Integer parameters to IB/IBA are in array elements, not bytes.
          ib = new InterleavedBuffer(array, byteStride / elementBytes);

          this.cache.add(ibCacheKey, ib);
        }

        bufferAttribute = new InterleavedBufferAttribute(
          ib,
          itemSize,
          (byteOffset % byteStride) / elementBytes,
          normalized,
        );
      } else {
        if (bufferView === null) {
          array = new TypedArray(accessorDef.count * itemSize);
        } else {
          array = new (TypedArray as {
            new (buffer: ArrayBuffer, byteOffset: number, length: number): TypedArray;
          })(bufferView, byteOffset, accessorDef.count * itemSize);
        }

        bufferAttribute = new BufferAttribute(array, itemSize, normalized);
      }

      // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#sparse-accessors
      if (accessorDef.sparse !== undefined) {
        const itemSizeIndices = WEBGL_TYPE_SIZES.SCALAR;
        const TypedArrayIndices
          = WEBGL_COMPONENT_TYPES[
            accessorDef.sparse.indices.componentType as keyof typeof WEBGL_COMPONENT_TYPES
          ];

        const byteOffsetIndices = accessorDef.sparse.indices.byteOffset || 0;
        const byteOffsetValues = accessorDef.sparse.values.byteOffset || 0;

        const sparseIndices = new (TypedArrayIndices as {
          new (buffer: ArrayBuffer, byteOffset: number, length: number): TypedArray;
        })(
          bufferViews[1] as ArrayBuffer,
          byteOffsetIndices,
          accessorDef.sparse.count * itemSizeIndices,
        );
        const sparseValues = new (TypedArray as {
          new (buffer: ArrayBuffer, byteOffset: number, length: number): TypedArray;
        })(bufferViews[2] as ArrayBuffer, byteOffsetValues, accessorDef.sparse.count * itemSize);

        if (bufferView !== null) {
          // Avoid modifying the original ArrayBuffer, if the bufferView wasn't initialized with zeroes.
          bufferAttribute = new BufferAttribute(
            bufferAttribute.array.slice(),
            bufferAttribute.itemSize,
            bufferAttribute.normalized,
          );
        }

        // Ignore normalized since we copy from sparse
        bufferAttribute.normalized = false;

        for (let i = 0, il = sparseIndices.length; i < il; i++) {
          const index = sparseIndices[i] as number;

          bufferAttribute.setX(index, sparseValues[i * itemSize] as number);
          if (itemSize >= 2) {
            bufferAttribute.setY(index, sparseValues[i * itemSize + 1] as number);
          }
          if (itemSize >= 3) {
            bufferAttribute.setZ(index, sparseValues[i * itemSize + 2] as number);
          }
          if (itemSize >= 4) {
            bufferAttribute.setW(index, sparseValues[i * itemSize + 3] as number);
          }
          if (itemSize >= 5) {
            throw new Error('THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.');
          }
        }

        bufferAttribute.normalized = normalized;
      }

      return bufferAttribute;
    });
  }

  /**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#textures
   *
   * @private
   * @param {number} textureIndex
   * @return {Promise<THREE.Texture|null>}
   */
  loadTexture(textureIndex: number): Promise<Texture | null> {
    const json = this.json;
    const gltfTextureDef = json.textures || [];
    const gltfImgDef = json.images || [];
    const options = this.options;
    const textureDef = gltfTextureDef[textureIndex] as GLTFTextureInfo & {
      sampler?: number;
      source?: number;
    };
    const sourceIndex = textureDef.source ?? 0;
    const sourceDef = gltfImgDef[sourceIndex] as { uri?: string };

    let loader = this.textureLoader;

    if (sourceDef.uri) {
      const handler = options.manager.getHandler(sourceDef.uri);

      if (handler !== null) {
        loader = handler;
      }
    }

    return this.loadTextureImage(textureIndex, sourceIndex, loader);
  }

  loadTextureImage(
    textureIndex: number,
    sourceIndex: number,
    loader: Loader,
  ): Promise<Texture | CompressedTexture | null> {
    const json = this.json;
    const gltfTextureDef = json.textures || [];
    const gltfImgDef = json.images || [];

    const textureDef = gltfTextureDef[textureIndex] as GLTFTextureInfo & {
      magFilter?: number;
      minFilter?: number;
      name?: string;
      sampler?: number;
      source?: number;
    };
    const sourceDef = gltfImgDef[sourceIndex] as {
      bufferView?: number;
      mimeType?: string;
      name?: string;
      uri?: string;
    };

    const cacheKey = (sourceDef.uri || sourceDef.bufferView) + ':' + textureDef.sampler;

    if (cacheKey in this.textureCache) {
      // See https://github.com/mrdoob/three.js/issues/21559.
      return this.textureCache[cacheKey] as Promise<Texture | CompressedTexture | null>;
    }

    const promise = this.loadImageSource(sourceIndex, loader)
      .then((texture) => {
        if (!texture || !(texture instanceof Texture)) {
          return null;
        }
        texture.flipY = false;

        texture.name = textureDef.name || sourceDef.name || '';

        if (
          texture.name === ''
          && typeof sourceDef.uri === 'string'
          && sourceDef.uri.startsWith('data:image/') === false
        ) {
          texture.name = sourceDef.uri;
        }
        const textureSampler = textureDef.sampler ?? 0;
        const samplers: GLTFSampler[] = json.samplers ?? [];
        const sampler = samplers[textureSampler] || {};

        // 8K 及以上纹理在无 sampler 时强制使用 LinearFilter + ClampToEdge，避免 mipmap 导致 UV 接缝裂纹
        const textureImage = texture.image as HTMLImageElement | ImageBitmap | undefined;
        const textureWidth = textureImage?.width ?? 0;
        const isLargeTexture = textureWidth >= 8192;
        const hasSampler = samplers.length > 0 && Object.keys(sampler).length > 0;
        const needsOverride = isLargeTexture && !hasSampler;

        const textureMagFilter = needsOverride ? 9729 : (sampler.magFilter ?? textureDef.magFilter ?? 9729); // THREE.LinearFilter
        const textureMinFilter = needsOverride ? 9729 : (sampler.minFilter ?? textureDef.minFilter ?? 9987); // 大纹理无 sampler 时用 LinearFilter 禁用 mipmap

        const magFilterValue
          = WEBGL_FILTERS[textureMagFilter as keyof typeof WEBGL_FILTERS] || LinearFilter;

        // 只有当值为NearestFilter或LinearFilter时才能用于magFilter
        texture.magFilter = (
          magFilterValue === NearestFilter || magFilterValue === LinearFilter
            ? magFilterValue
            : LinearFilter
        ) as MagnificationTextureFilter; // 默认值
        texture.minFilter
          = WEBGL_FILTERS[textureMinFilter as keyof typeof WEBGL_FILTERS] || LinearMipmapLinearFilter;
        texture.wrapS
          = needsOverride ? ClampToEdgeWrapping : (WEBGL_WRAPPINGS[sampler.wrapS as keyof typeof WEBGL_WRAPPINGS] || RepeatWrapping);
        texture.wrapT
          = needsOverride ? ClampToEdgeWrapping : (WEBGL_WRAPPINGS[sampler.wrapT as keyof typeof WEBGL_WRAPPINGS] || RepeatWrapping);
        texture.generateMipmaps
          = !(texture as CompressedTexture).isCompressedTexture
            && texture.minFilter !== NearestFilter
            && texture.minFilter !== LinearFilter;

        this.associations.set(texture, { textures: textureIndex });

        return texture;
      })
      .catch(function () {
        return null;
      });

    this.textureCache[cacheKey] = promise;

    return promise;
  }

  loadImageSource(
    sourceIndex: number,
    loader: Loader,
  ): Promise<Texture | GLTF | CompressedTexture | null> {
    const json = this.json;
    const options = this.options;
    const gltfImgDef = json.images || [];

    if (sourceIndex in this.sourceCache) {
      return (
        this.sourceCache[sourceIndex] as Promise<Texture | GLTF | CompressedTexture | null>
      ).then(texture => (texture as Texture).clone());
    }

    const sourceDef = gltfImgDef[sourceIndex] as {
      bufferView?: number;
      mimeType?: string;
      name?: string;
      uri?: string;
    };

    const URL = self.URL || self.webkitURL;

    let sourceURI: string | Promise<string> = sourceDef.uri || '';
    let isObjectURL = false;

    if (sourceDef.bufferView !== undefined) {
      // Load binary image data from bufferView, if provided.

      sourceURI = this.getDependency('bufferView', sourceDef.bufferView).then((bufferView) => {
        isObjectURL = true;
        const blob = new Blob([bufferView as ArrayBuffer], { type: sourceDef.mimeType });

        sourceURI = URL.createObjectURL(blob);

        return sourceURI;
      });
    } else if (sourceDef.uri === undefined) {
      throw new Error('THREE.GLTFLoader: Image ' + sourceIndex + ' is missing URI and bufferView');
    }

    const promise = Promise.resolve(sourceURI)
      .then((sourceURI) => {
        return new Promise((resolve, reject) => {
          let onLoad = resolve;

          if ((loader as ImageBitmapLoader).isImageBitmapLoader === true) {
            onLoad = (imageBitmap) => {
              const texture = new Texture(imageBitmap as ImageBitmap);

              texture.needsUpdate = true;

              resolve(texture);
            };
          }

          loader.load(LoaderUtils.resolveURL(sourceURI, options.path), onLoad, undefined, reject);
        });
      })
      .then((texture) => {
        const tempTexture = texture as GLTF;
        // Clean up resources and configure Texture.

        if (isObjectURL === true && typeof sourceURI === 'string') {
          URL.revokeObjectURL(sourceURI);
        }

        assignExtrasToUserData(tempTexture, sourceDef);

        tempTexture.userData.mimeType = sourceDef.mimeType || getImageURIMimeType(sourceDef.uri);

        return tempTexture;
      })
      .catch(function (error) {
        console.error('THREE.GLTFLoader: Couldn\'t load texture', sourceURI);
        throw error;
      });

    this.sourceCache[sourceIndex] = promise;

    return promise;
  }

  /**
   * Asynchronously assigns a texture to the given material parameters.
   *
   * @private
   * @param {Object} materialParams
   * @param {string} mapName
   * @param {Object} mapDef
   * @param {string} [colorSpace]
   * @return {Promise<Texture>}
   */
  assignTexture(
    materialParams: MeshStandardMaterialParameters,
    mapName: string,
    mapDef: GLTFTextureInfo,
    colorSpace?: string,
  ) {
    return this.getDependency('texture', mapDef.index).then((texture) => {
      if (!texture || !(texture instanceof Texture)) {
        return null;
      }

      if (mapDef.texCoord !== undefined && mapDef.texCoord > 0) {
        texture = texture.clone();
        texture.channel = mapDef.texCoord;
      }

      if (this.extensions[EXTENSIONS.KHR_TEXTURE_TRANSFORM]) {
        const transform
          = mapDef.extensions !== undefined
            ? mapDef.extensions[EXTENSIONS.KHR_TEXTURE_TRANSFORM]
            : undefined;

        if (transform) {
          const gltfReference = this.associations.get(texture);

          texture = (
            this.extensions[EXTENSIONS.KHR_TEXTURE_TRANSFORM] as GLTFTextureTransformExtension
          ).extendTexture(texture, transform);
          this.associations.set(texture, gltfReference);
        }
      }

      if (colorSpace !== undefined) {
        texture.colorSpace = colorSpace;
      }
      switch (mapName) {
        case 'map':
          materialParams.map = texture;

          break;
        case 'aoMap':
          materialParams.aoMap = texture;

          break;
        case 'emissiveMap':
          materialParams.emissiveMap = texture;

          break;
        case 'lightMap':
          materialParams.lightMap = texture;

          break;
        case 'bumpMap':
          materialParams.bumpMap = texture;

          break;
        case 'displacementMap':
          materialParams.displacementMap = texture;

          break;
        case 'normalMap':
          materialParams.normalMap = texture;

          break;
        case 'alphaMap':
          materialParams.alphaMap = texture;

          break;
        case 'metalnessMap':
          materialParams.metalnessMap = texture;

          break;
        case 'roughnessMap':
          materialParams.roughnessMap = texture;

          break;
        default:
          break;
      }

      // materialParams[ mapName ] = texture;

      return texture;
    });
  }

  /**
   * Assigns final material to a Mesh, Line, or Points instance. The instance
   * already has a material (generated from the glTF material options alone)
   * but reuse of the same glTF material may require multiple threejs materials
   * to accommodate different primitive types, defines, etc. New materials will
   * be created if necessary, and reused from a cache.
   *
   * @private
   * @param {Object3D} mesh Mesh, Line, or Points instance.
   */
  assignFinalMaterial(mesh: Mesh | Line | Points) {
    const geometry = mesh.geometry;
    let material = mesh.material as MeshStandardMaterial | PointsMaterial | LineBasicMaterial;

    const useDerivativeTangents = geometry.attributes.tangent === undefined;
    const useVertexColors = geometry.attributes.color !== undefined;
    const useFlatShading = geometry.attributes.normal === undefined;

    if ((mesh as Points).isPoints) {
      const cacheKey = 'PointsMaterial:' + material.uuid;

      let pointsMaterial = this.cache.get(cacheKey) as PointsMaterial;

      if (!pointsMaterial) {
        pointsMaterial = new PointsMaterial();
        Material.prototype.copy.call(pointsMaterial, material);
        pointsMaterial.color.copy(material.color);
        pointsMaterial.map = material.map;
        pointsMaterial.sizeAttenuation = false; // glTF spec says points should be 1px

        this.cache.add(cacheKey, pointsMaterial);
      }

      material = pointsMaterial;
    } else if ((mesh as Line).isLine) {
      const cacheKey = 'LineBasicMaterial:' + material.uuid;

      let lineMaterial = this.cache.get(cacheKey) as LineBasicMaterial;

      if (!lineMaterial) {
        lineMaterial = new LineBasicMaterial();
        Material.prototype.copy.call(lineMaterial, material);
        lineMaterial.color.copy(material.color);
        lineMaterial.map = material.map;

        this.cache.add(cacheKey, lineMaterial);
      }

      material = lineMaterial;
    }

    // Clone the material if it will be modified
    if (useDerivativeTangents || useVertexColors || useFlatShading) {
      let cacheKey = 'ClonedMaterial:' + material.uuid + ':';

      if (useDerivativeTangents) {
        cacheKey += 'derivative-tangents:';
      }
      if (useVertexColors) {
        cacheKey += 'vertex-colors:';
      }
      if (useFlatShading) {
        cacheKey += 'flat-shading:';
      }

      let cachedMaterial = this.cache.get(cacheKey) as MeshPhysicalMaterial;

      if (!cachedMaterial) {
        cachedMaterial = (material as MeshPhysicalMaterial).clone();

        if (useVertexColors) {
          cachedMaterial.vertexColors = true;
        }
        if (useFlatShading) {
          cachedMaterial.flatShading = true;
        }

        if (useDerivativeTangents) {
          // https://github.com/mrdoob/three.js/issues/11438#issuecomment-507003995
          if (cachedMaterial.normalScale) {
            cachedMaterial.normalScale.y *= -1;
          }
          if (cachedMaterial.clearcoatNormalScale) {
            cachedMaterial.clearcoatNormalScale.y *= -1;
          }
        }

        this.cache.add(cacheKey, cachedMaterial);
        const cached = this.associations.get(material as MeshPhysicalMaterial);

        if (cached) {
          this.associations.set(cachedMaterial, cached);
        }

        // this.associations.set(cachedMaterial, this.associations.get(material));
      }

      material = cachedMaterial;
    }

    mesh.material = material;
  }

  getMaterialType(/* materialIndex */) {
    return MeshStandardMaterial;
  }

  /**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#materials
   *
   * @private
   * @param {number} materialIndex
   * @return {Promise<Material>}
   */
  loadMaterial(materialIndex: number): Promise<Material> {
    const json = this.json;
    const extensions = this.extensions;
    const gltfMaterialDef = json.materials || [];
    const materialDef = gltfMaterialDef[materialIndex] as GLTFMaterial;

    let materialType;
    const materialParams: MeshStandardMaterialParameters = {};
    const materialExtensions = materialDef.extensions || {};

    const pending = [];

    if (materialExtensions[EXTENSIONS.KHR_MATERIALS_UNLIT]) {
      const kmuExtension = extensions[
        EXTENSIONS.KHR_MATERIALS_UNLIT
      ] as GLTFMaterialsUnlitExtension;

      materialType = kmuExtension.getMaterialType();
      pending.push(kmuExtension.extendParams(materialParams, materialDef, this));
    } else {
      // Specification:
      // https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#metallic-roughness-material

      const metallicRoughness = materialDef.pbrMetallicRoughness || {};

      materialParams.color = new Color();
      materialParams.opacity = 1.0;

      if (Array.isArray(metallicRoughness.baseColorFactor)) {
        const array = metallicRoughness.baseColorFactor;

        materialParams.color.setRGB(array[0], array[1], array[2], LinearSRGBColorSpace);
        materialParams.opacity = array[3];
      }

      if (metallicRoughness.baseColorTexture !== undefined) {
        pending.push(
          this.assignTexture(
            materialParams,
            'map',
            metallicRoughness.baseColorTexture,
            SRGBColorSpace,
          ),
        );
      }

      materialParams.metalness
        = metallicRoughness.metallicFactor !== undefined ? metallicRoughness.metallicFactor : 1.0;
      materialParams.roughness
        = metallicRoughness.roughnessFactor !== undefined ? metallicRoughness.roughnessFactor : 1.0;

      if (metallicRoughness.metallicRoughnessTexture !== undefined) {
        pending.push(
          this.assignTexture(
            materialParams,
            'metalnessMap',
            metallicRoughness.metallicRoughnessTexture,
          ),
        );
        pending.push(
          this.assignTexture(
            materialParams,
            'roughnessMap',
            metallicRoughness.metallicRoughnessTexture,
          ),
        );
      }

      materialType = this._invokeOne<GLTFMaterialsClearcoatExtension, typeof MeshPhysicalMaterial>(
        (ext) => {
          if (!ext) {
            throw new Error('THREE.GLTFLoader: GLTFMaterialsClearcoatExtension is not supported.');
          }

          return ext.getMaterialType && ext.getMaterialType(materialIndex);
        },
      );

      pending.push(
        ...this._invokeAll<GLTFMaterialsClearcoatExtension, Promise<unknown>>((ext) => {
          const result
            = ext.extendMaterialParams && ext.extendMaterialParams(materialIndex, materialParams);
          return result || null;
        }),
      );
    }

    if (materialDef.doubleSided === true) {
      materialParams.side = DoubleSide;
    }

    const alphaMode = materialDef.alphaMode || ALPHA_MODES.OPAQUE;

    if (alphaMode === ALPHA_MODES.BLEND) {
      materialParams.transparent = true;

      // See: https://github.com/mrdoob/three.js/issues/17706
      materialParams.depthWrite = false;
    } else {
      materialParams.transparent = false;

      if (alphaMode === ALPHA_MODES.MASK) {
        materialParams.alphaTest
          = materialDef.alphaCutoff !== undefined ? materialDef.alphaCutoff : 0.5;
      }
    }

    if (materialDef.normalTexture !== undefined && materialType !== MeshBasicMaterial) {
      pending.push(this.assignTexture(materialParams, 'normalMap', materialDef.normalTexture));

      materialParams.normalScale = new Vector2(1, 1);

      if (materialDef.normalTexture.scale !== undefined) {
        const scale = materialDef.normalTexture.scale;

        materialParams.normalScale.set(scale, scale);
      }
    }

    if (materialDef.occlusionTexture !== undefined && materialType !== MeshBasicMaterial) {
      pending.push(this.assignTexture(materialParams, 'aoMap', materialDef.occlusionTexture));

      if (materialDef.occlusionTexture.strength !== undefined) {
        materialParams.aoMapIntensity = materialDef.occlusionTexture.strength;
      }
    }

    if (materialDef.emissiveFactor !== undefined && materialType !== MeshBasicMaterial) {
      const emissiveFactor = materialDef.emissiveFactor;

      materialParams.emissive = new Color().setRGB(
        emissiveFactor[0],
        emissiveFactor[1],
        emissiveFactor[2],
        LinearSRGBColorSpace,
      );
    }

    if (materialDef.emissiveTexture !== undefined && materialType !== MeshBasicMaterial) {
      pending.push(
        this.assignTexture(
          materialParams,
          'emissiveMap',
          materialDef.emissiveTexture,
          SRGBColorSpace,
        ),
      );
    }

    return Promise.all(pending).then(() => {
      // Local imports retain authored scalar PBR and alpha values even without a color map.
      const material = new (materialType || MeshStandardMaterial)(materialParams);

      if (materialDef.name) {
        material.name = materialDef.name;
      }

      assignExtrasToUserData(material, materialDef);

      this.associations.set(material, { materials: materialIndex });

      if (materialDef.extensions) {
        addUnknownExtensionsToUserData(extensions, material, materialDef);
      }
      return material;
    });
  }

  /**
   * When Object3D instances are targeted by animation, they need unique names.
   *
   * @private
   * @param {string} originalName
   * @return {string}
   */
  createUniqueName(originalName: string): string {
    const sanitizedName = PropertyBinding.sanitizeNodeName(originalName || '');

    if (typeof this.nodeNamesUsed[sanitizedName] !== 'number') {
      this.nodeNamesUsed[sanitizedName] = 0;
      return sanitizedName;
    } else {
      return sanitizedName + '_' + ++(this.nodeNamesUsed[sanitizedName] as number);
    }
  }

  /**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#geometry
   *
   * Creates BufferGeometries from primitives.
   *
   * @private
   * @param {Array<GLTF.Primitive>} primitives
   * @return {Promise<Array<BufferGeometry>>}
   */
  loadGeometries(primitives: GLTFPrimitive[]): Promise<BufferGeometry[]> {
    const extensions = this.extensions;
    const cache = this.primitiveCache;

    const createDracoPrimitive = (primitive: GLTFPrimitive) => {
      return (
        extensions[EXTENSIONS.KHR_DRACO_MESH_COMPRESSION] as GLTFDracoMeshCompressionExtension
      )
        .decodePrimitive(primitive, this)
        .then((geometry) => {
          return addPrimitiveAttributes(geometry, primitive, this);
        });
    };

    const pending = [];

    for (let i = 0, il = primitives.length; i < il; i++) {
      const primitive = primitives[i] as GLTFPrimitive;
      const cacheKey = createPrimitiveKey(primitive);

      // See if we've already created this geometry
      const cached = cache[cacheKey];

      if (cached) {
        // Use the cached geometry if it exists
        pending.push(cached.promise);
      } else {
        let geometryPromise;

        if (primitive.extensions && primitive.extensions[EXTENSIONS.KHR_DRACO_MESH_COMPRESSION]) {
          // Use DRACO geometry if available
          geometryPromise = createDracoPrimitive(primitive);
        } else {
          // Otherwise create a new geometry
          geometryPromise = addPrimitiveAttributes(new BufferGeometry(), primitive, this);
        }

        // Cache this geometry
        cache[cacheKey] = { primitive: primitive, promise: geometryPromise };

        pending.push(geometryPromise);
      }
    }

    return Promise.all(pending);
  }

  /**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0/README.md#meshes
   *
   * @private
   * @param {number} meshIndex
   * @return {Promise<Group|Mesh|SkinnedMesh|Line|Points>}
   */
  loadMesh(
    meshIndex: number,
  ): Promise<undefined | Group | MeshStandardMaterial | Mesh | SkinnedMesh | Line | Points> {
    const json = this.json;
    const extensions = this.extensions;

    const meshDef = json.meshes ?? [];
    const primitives = (meshDef[meshIndex] as GLTFMesh).primitives;

    const pending: Promise<MeshStandardMaterial | BufferGeometry[]>[] = [];

    for (let i = 0, il = primitives.length; i < il; i++) {
      const material
        = (primitives[i] as GLTFPrimitive).material === undefined
          ? createDefaultMaterial(this.cache)
          : this.getDependency('material', (primitives[i] as GLTFPrimitive).material as number);

      pending.push(material as Promise<MeshStandardMaterial>);
    }

    pending.push(this.loadGeometries(primitives));

    return Promise.all(pending).then((results) => {
      const materials = results.slice(0, results.length - 1);
      const geometries = results[results.length - 1] as BufferGeometry[];
      const meshes: Mesh[] = [];

      for (let i = 0, il = geometries.length; i < il; i++) {
        const geometry = geometries[i] as BufferGeometry;
        const primitive = primitives[i] as GLTFPrimitive;

        // 1. create Mesh

        let mesh: Mesh | SkinnedMesh | Line | LineLoop | LineSegments | Points | null = null;
        const material = materials[i] as MeshStandardMaterial;
        if (!geometry.attributes.normal) {
          geometry.computeVertexNormals();
        }
        if (
          primitive.mode === WEBGL_CONSTANTS.TRIANGLES
          || primitive.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP
          || primitive.mode === WEBGL_CONSTANTS.TRIANGLE_FAN
          || primitive.mode === undefined
        ) {
          // .isSkinnedMesh isn't in glTF spec. See ._markDefs()
          mesh
            = (meshDef[meshIndex] as GLTFMesh).isSkinnedMesh === true
              ? new SkinnedMesh(geometry, material)
              : new Mesh(geometry, material);
          if ((mesh as SkinnedMesh).isSkinnedMesh === true) {
            // normalize skin weights to fix malformed assets (see #15319)
            (mesh as SkinnedMesh).normalizeSkinWeights();
          }

          if (primitive.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP) {
            mesh.geometry = toTrianglesDrawMode(mesh.geometry, TriangleStripDrawMode);
          } else if (primitive.mode === WEBGL_CONSTANTS.TRIANGLE_FAN) {
            mesh.geometry = toTrianglesDrawMode(mesh.geometry, TriangleFanDrawMode);
          }
        } else if (primitive.mode === WEBGL_CONSTANTS.LINES) {
          mesh = new LineSegments(geometry, material);
        } else if (primitive.mode === WEBGL_CONSTANTS.LINE_STRIP) {
          mesh = new Line(geometry, material);
        } else if (primitive.mode === WEBGL_CONSTANTS.LINE_LOOP) {
          mesh = new LineLoop(geometry, material);
        } else if (primitive.mode === WEBGL_CONSTANTS.POINTS) {
          mesh = new Points(geometry, material);
        } else {
          throw new Error('THREE.GLTFLoader: Primitive mode unsupported: ' + primitive.mode);
        }

        if (!mesh) {
          continue;
        }

        if (Object.keys(mesh.geometry.morphAttributes).length > 0) {
          updateMorphTargets(mesh as Mesh);
        }

        mesh.name = this.createUniqueName(
          (meshDef[meshIndex] as GLTFMesh).name || 'mesh_' + meshIndex,
        );
        assignExtrasToUserData(mesh as Mesh, meshDef[meshIndex] as GLTFMesh);

        if (primitive.extensions) {
          addUnknownExtensionsToUserData(extensions, mesh as Mesh, primitive);
        }

        this.assignFinalMaterial(mesh);

        meshes.push(mesh as Mesh);
      }

      for (let i = 0, il = meshes.length; i < il; i++) {
        this.associations.set(meshes[i] as Mesh, {
          meshes: meshIndex,
          primitives: i,
        });
      }

      if (meshes.length === 1) {
        if ((meshDef[meshIndex] as GLTFMesh).extensions) {
          addUnknownExtensionsToUserData(
            extensions,
            meshes[0] as Mesh,
            meshDef[meshIndex] as GLTFMesh,
          );
        }

        return meshes[0];
      }

      const group = new Group();

      if ((meshDef[meshIndex] as GLTFMesh).extensions) {
        addUnknownExtensionsToUserData(extensions, group, meshDef[meshIndex] as GLTFMesh);
      }

      this.associations.set(group, { meshes: meshIndex });

      for (let i = 0, il = meshes.length; i < il; i++) {
        group.add(meshes[i] as Mesh);
      }

      return group;
    });
  }

  /**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0#cameras
   *
   * @private
   * @param {number} cameraIndex
   * @return {Promise<THREE.Camera>}
   */
  loadCamera(cameraIndex: number) {
    let camera: Camera;
    const camerasDef = this.json.cameras || [];
    const cameraDef = camerasDef[cameraIndex] as GLTFCamera;
    let params;

    if (cameraDef.type === 'perspective') {
      params = cameraDef.perspective as {
        aspectRatio?: number;
        yfov: number;
        zfar?: number;
        znear?: number;
      };
    } else if (cameraDef.type === 'orthographic') {
      params = cameraDef.orthographic as {
        xmag: number;
        ymag: number;
        zfar: number;
        znear: number;
      };
    }

    if (!params) {
      console.warn('THREE.GLTFLoader: Missing camera parameters.');

      return;
    }

    if (cameraDef.type === 'perspective') {
      const perspectiveParams = params as {
        aspectRatio?: number;
        yfov: number;
        zfar?: number;
        znear?: number;
      };

      camera = new PerspectiveCamera(
        MathUtils.radToDeg(perspectiveParams.yfov),
        perspectiveParams.aspectRatio ?? 1,
        perspectiveParams.znear ?? 1,
        perspectiveParams.zfar ?? 2e6,
      );

      if (cameraDef.name) {
        camera.name = this.createUniqueName(cameraDef.name);
      }
      assignExtrasToUserData(camera, cameraDef);

      return Promise.resolve(camera);
    } else if (cameraDef.type === 'orthographic') {
      const orthographicParams = params as {
        xmag: number;
        ymag: number;
        zfar: number;
        znear: number;
      };

      camera = new OrthographicCamera(
        -orthographicParams.xmag,
        orthographicParams.xmag,
        orthographicParams.ymag,
        -orthographicParams.ymag,
        orthographicParams.znear,
        orthographicParams.zfar,
      );

      if (cameraDef.name) {
        camera.name = this.createUniqueName(cameraDef.name);
      }
      assignExtrasToUserData(camera, cameraDef);

      return Promise.resolve(camera);
    }
  }

  /**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#skins
   *
   * @private
   * @param {number} skinIndex
   * @return {Promise<Skeleton>}
   */
  loadSkin(skinIndex: number) {
    const skinsDef = this.json.skins || [];
    const skinDef = skinsDef[skinIndex] as GLTFSkin;

    const pending = [];

    for (let i = 0, il = skinDef.joints.length; i < il; i++) {
      pending.push(this._loadNodeShallow(skinDef.joints[i] as number));
    }

    if (skinDef.inverseBindMatrices !== undefined) {
      pending.push(this.getDependency('accessor', skinDef.inverseBindMatrices));
    } else {
      pending.push(null);
    }

    return Promise.all(pending).then((results) => {
      const inverseBindMatrices = results.pop() as BufferAttribute | null;
      const jointNodes = results as Object3D[];

      // Note that bones (joint nodes) may or may not be in the
      // scene graph at this time.

      const bones: Bone[] = [];
      const boneInverses: Matrix4[] = [];

      for (let i = 0, il = jointNodes.length; i < il; i++) {
        const jointNode = jointNodes[i];

        if (jointNode) {
          bones.push(jointNode as Bone);

          const mat = new Matrix4();

          if (inverseBindMatrices !== null && inverseBindMatrices !== undefined) {
            mat.fromArray(inverseBindMatrices?.array, i * 16);
          }

          boneInverses.push(mat);
        } else {
          console.warn('THREE.GLTFLoader: Joint "%s" could not be found.', skinDef.joints[i]);
        }
      }

      return new Skeleton(bones, boneInverses);
    });
  }

  /**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#animations
   *
   * @private
   * @param {number} animationIndex
   * @return {Promise<AnimationClip>}
   */
  loadAnimation(animationIndex: number) {
    const json = this.json;
    const animationsDef = json.animations ?? [];
    const animationDef = animationsDef[animationIndex] as GLTFAnimation;
    const animationName = animationDef.name ? animationDef.name : 'animation_' + animationIndex;

    const pendingNodes: Promise<Object3D>[] = [];
    const pendingInputAccessors: Promise<BufferAttribute>[] = [];
    const pendingOutputAccessors: Promise<BufferAttribute>[] = [];
    const pendingSamplers: GLTFAnimationSampler[] = [];
    const pendingTargets: GLTFAnimationTarget[] = [];

    for (let i = 0, il = animationDef.channels.length; i < il; i++) {
      const channel = animationDef.channels[i] as GLTFAnimationChannel;
      const sampler = animationDef.samplers[channel.sampler] as GLTFAnimationSampler;
      const target = channel.target;
      const name = target.node;
      const input
        = animationDef.parameters !== undefined
          ? animationDef.parameters[sampler.input]
          : sampler.input;
      const output
        = animationDef.parameters !== undefined
          ? animationDef.parameters[sampler.output]
          : sampler.output;

      if (target.node === undefined || name === undefined) {
        continue;
      }

      pendingNodes.push(this.getDependency('node', name) as Promise<Object3D>);
      pendingInputAccessors.push(this.getDependency('accessor', input) as Promise<BufferAttribute>);
      pendingOutputAccessors.push(
        this.getDependency('accessor', output) as Promise<BufferAttribute>,
      );
      pendingSamplers.push(sampler);
      pendingTargets.push(target);
    }

    return Promise.all([
      Promise.all(pendingNodes),
      Promise.all(pendingInputAccessors),
      Promise.all(pendingOutputAccessors),
      Promise.all(pendingSamplers),
      Promise.all(pendingTargets),
    ]).then((dependencies) => {
      const nodes = dependencies[0];
      const inputAccessors = dependencies[1];
      const outputAccessors = dependencies[2];
      const samplers = dependencies[3];
      const targets = dependencies[4];

      const tracks = [];

      for (let i = 0, il = nodes.length; i < il; i++) {
        const node = nodes[i];
        const inputAccessor = inputAccessors[i];
        const outputAccessor = outputAccessors[i];
        const sampler = samplers[i];
        const target = targets[i];

        if (node === undefined) {
          continue;
        }

        if (node.updateMatrix) {
          node.updateMatrix();
        }

        const createdTracks = this._createAnimationTracks(
          node,
          inputAccessor as BufferAttribute,
          outputAccessor as BufferAttribute,
          sampler as GLTFAnimationSampler,
          target as GLTFAnimationTarget,
        );

        if (createdTracks) {
          for (let k = 0; k < createdTracks.length; k++) {
            tracks.push(createdTracks[k]);
          }
        }
      }

      return new AnimationClip(animationName, undefined, tracks as KeyframeTrack[]);
    });
  }

  createNodeMesh(nodeIndex: number) {
    const json = this.json;
    const nodesDef = json.nodes || [];
    const nodeDef = nodesDef[nodeIndex] as GLTFNode;

    if (nodeDef.mesh === undefined) {
      return null;
    }

    return this.getDependency('mesh', nodeDef.mesh).then((mesh) => {
      const node = this._getNodeRef(this.meshCache, nodeDef.mesh ?? -1, mesh as Mesh);
      // 子 node 尚未挂入，此时只标记同一 mesh 实例的 primitive。
      const edgeDomain = Symbol('gltf-mesh-edges');
      node.traverse((object) => {
        if ((object as Mesh).isMesh) setModelMeshEdgeDomain(object as Mesh, edgeDomain);
      });

      // if weights are provided on the node, override weights on the mesh.
      if (nodeDef.weights !== undefined) {
        node.traverse((o) => {
          if (!(o as Mesh).isMesh) {
            return;
          }
          const weights = nodeDef.weights || [];
          const morphTargetInfluences = (o as SkinnedMesh).morphTargetInfluences;
          if (!morphTargetInfluences) return;
          for (let i = 0, il = weights.length; i < il; i++) {
            morphTargetInfluences[i] = weights[i] as number;
          }
        });
      }

      return node;
    });
  }

  /**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#nodes-and-hierarchy
   *
   * @private
   * @param {number} nodeIndex
   * @return {Promise<Object3D>}
   */
  loadNode(nodeIndex: number) {
    const json = this.json;
    const nodesDef = json.nodes || [];

    const nodeDef = nodesDef[nodeIndex] as GLTFNode;

    const nodePending = this._loadNodeShallow(nodeIndex);

    const childPending = [];
    const childrenDef = nodeDef.children || [];

    for (let i = 0, il = childrenDef.length; i < il; i++) {
      childPending.push(this.getDependency('node', childrenDef[i] as number));
    }

    const skeletonPending
      = nodeDef.skin === undefined ? Promise.resolve(null) : this.getDependency('skin', nodeDef.skin);

    return Promise.all([nodePending, Promise.all(childPending), skeletonPending]).then(
      (results) => {
        const node = results[0];
        const children = results[1];
        const skeleton = results[2] as Skeleton | null;

        if (skeleton !== null) {
          // This full traverse should be fine because
          // child glTF nodes have not been added to this node yet.
          node.traverse((mesh) => {
            // 只有 SkinnedMesh 才有 bind 方法
            if (!(mesh as SkinnedMesh).isSkinnedMesh) {
              return;
            }

            (mesh as SkinnedMesh).bind(skeleton, _identityMatrix);
          });
        }

        for (let i = 0, il = children.length; i < il; i++) {
          node.add(children[i] as Object3D);
        }

        return node;
      },
    );
  }

  // ._loadNodeShallow() parses a single node.
  // skin and child nodes are created and added in .loadNode() (no '_' prefix).
  _loadNodeShallow(nodeIndex: number): Promise<Object3D> {
    const json = this.json;
    const nodesDef = json.nodes || [];

    // This method is called from .loadNode() and .loadSkin().
    // Cache a node to avoid duplication.

    if (this.nodeCache[nodeIndex] !== undefined) {
      return this.nodeCache[nodeIndex];
    }

    const nodeDef = nodesDef[nodeIndex] as GLTFNode;

    // reserve node's name before its dependencies, so the root has the intended name.
    const nodeName = nodeDef.name ? this.createUniqueName(nodeDef.name) : '';
    const pending = [];

    const meshPromise = this._invokeOne<GLTFMeshGpuInstancing, Promise<Object3D | undefined>>(
      (ext) => {
        return ext.createNodeMesh ? ext.createNodeMesh(nodeIndex) : null;
      },
    );

    if (meshPromise) {
      pending.push(meshPromise);
    }

    if (nodeDef.camera !== undefined) {
      pending.push(
        this.getDependency('camera', nodeDef.camera).then((camera) => {
          return this._getNodeRef(this.cameraCache, nodeDef.camera as number, camera as Camera);
        }),
      );
    }

    this._invokeAll<GLTFLightsExtension, Promise<Object3D | null>>((ext) => {
      return ext.createNodeAttachment ? ext.createNodeAttachment(nodeIndex) : null;
    }).forEach((promise) => {
      pending.push(promise);
    });

    this.nodeCache[nodeIndex] = Promise.all(pending).then((objects) => {
      let node: Object3D | Bone | Group;

      // .isBone isn't in glTF spec. See ._markDefs
      if (nodeDef.isBone === true) {
        node = new Bone();
      } else if (objects.length > 1) {
        node = new Group();
      } else if (objects.length === 1) {
        node = objects[0] as Object3D;
      } else {
        node = new Object3D();
      }

      if (node !== objects[0]) {
        for (let i = 0, il = objects.length; i < il; i++) {
          node.add(objects[i] as Object3D);
        }
      }

      if (nodeDef.name) {
        node.userData.name = nodeDef.name;
        if (node instanceof Mesh) {
          this.modelInfoMap[nodeName] = {

            isUVMapped: Boolean(node.geometry?.attributes.uv),
            polygons: 0,
            quads: 0,
            triangles: node.geometry.index
              ? node.geometry.index.count / 3
              : node.geometry.getAttribute('position').count / 3,
            vertices: node.geometry.attributes.position?.count as number,
          };

          // 更新场景统计信息
          this.sceneInfo.triangles += this.modelInfoMap[nodeName].triangles;
          this.sceneInfo.vertices += this.modelInfoMap[nodeName].vertices;

          // 任一Mesh包含UV即记录，不从实际材质重复推导业务flag。
          if (this.modelInfoMap[nodeName].isUVMapped) {
            this.sceneInfo.isUVMapped = true;
          }
        }
        node.name = nodeName;
      }

      assignExtrasToUserData(node, nodeDef);

      if (nodeDef.extensions) {
        addUnknownExtensionsToUserData(this.extensions, node, nodeDef);
      }

      if (nodeDef.matrix !== undefined) {
        const matrix = new Matrix4();

        matrix.fromArray(nodeDef.matrix);
        node.applyMatrix4(matrix);
      } else {
        if (nodeDef.translation !== undefined) {
          node.position.fromArray(nodeDef.translation);
        }

        if (nodeDef.rotation !== undefined) {
          node.quaternion.fromArray(nodeDef.rotation);
        }

        if (nodeDef.scale !== undefined) {
          node.scale.fromArray(nodeDef.scale);
        }
      }

      if (!this.associations.has(node)) {
        this.associations.set(node, { nodes: nodeIndex });
      }

      // parser.associations.get(node).nodes = nodeIndex;

      return node;
    });

    return this.nodeCache[nodeIndex];
  }

  /**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#scenes
   *
   * @private
   * @param {number} sceneIndex
   * @return {Promise<Group>}
   */
  loadScene(sceneIndex: number) {
    const extensions = this.extensions;
    const scenesDef = this.json.scenes || [];
    const sceneDef = scenesDef[sceneIndex] as GLTFScene;

    // Loader returns Group, not Scene.
    // See: https://github.com/mrdoob/three.js/issues/18342#issuecomment-578981172
    const scene = new Group();

    if (sceneDef.name) {
      scene.name = this.createUniqueName(sceneDef.name);
    }

    assignExtrasToUserData(scene, sceneDef);

    if (sceneDef.extensions) {
      addUnknownExtensionsToUserData(extensions, scene, sceneDef);
    }

    const nodeIds = sceneDef.nodes || [];

    const pending = [];

    for (let i = 0, il = nodeIds.length; i < il; i++) {
      pending.push(this.getDependency('node', nodeIds[i] as number));
    }

    return Promise.all(pending).then((nodes) => {
      for (let i = 0, il = nodes.length; i < il; i++) {
        scene.add(nodes[i] as Object3D);
      }

      // Removes dangling associations, associations that reference a node that
      // didn't make it into the scene.
      const reduceAssociations = (node: Object3D) => {
        const reducedAssociations = new Map();

        for (const [key, value] of this.associations) {
          if (key instanceof Material || key instanceof Texture) {
            reducedAssociations.set(key, value);
          }
        }

        node.traverse((node) => {
          const mappings = this.associations.get(node);

          if (mappings != null) {
            reducedAssociations.set(node, mappings);
          }
        });

        return reducedAssociations;
      };

      this.associations = reduceAssociations(scene);

      return scene;
    });
  }

  _createAnimationTracks(
    node: Object3D,
    inputAccessor: BufferAttribute,
    outputAccessor: BufferAttribute,
    sampler: GLTFAnimationSampler,
    target: GLTFAnimationTarget,
  ) {
    const tracks: KeyframeTrack[] = [];

    const targetName = node.name ? node.name : node.uuid;
    const targetNames = [];

    if (PATH_PROPERTIES[target.path] === PATH_PROPERTIES.weights) {
      node.traverse((object) => {
        if ((object as SkinnedMesh).morphTargetInfluences) {
          targetNames.push(object.name ? object.name : object.uuid);
        }
      });
    } else {
      targetNames.push(targetName);
    }

    let TypedKeyframeTrack:
      | typeof NumberKeyframeTrack
      | typeof QuaternionKeyframeTrack
      | typeof VectorKeyframeTrack;

    switch (PATH_PROPERTIES[target.path]) {
      case PATH_PROPERTIES.weights:
        TypedKeyframeTrack = NumberKeyframeTrack;

        break;
      case PATH_PROPERTIES.rotation:
        TypedKeyframeTrack = QuaternionKeyframeTrack;

        break;
      case PATH_PROPERTIES.translation:
      case PATH_PROPERTIES.scale:
        TypedKeyframeTrack = VectorKeyframeTrack;

        break;
      default:
        switch (outputAccessor.itemSize) {
          case 1:
            TypedKeyframeTrack = NumberKeyframeTrack;

            break;
          case 2:
          case 3:
          default:
            TypedKeyframeTrack = VectorKeyframeTrack;

            break;
        }

        break;
    }

    const interpolation
      = sampler.interpolation !== undefined
        ? INTERPOLATION[sampler.interpolation]
        : InterpolateLinear;

    const outputArray = this._getArrayFromAccessor(outputAccessor);

    for (let j = 0, jl = targetNames.length; j < jl; j++) {
      const track = new TypedKeyframeTrack(
        targetNames[j] + '.' + PATH_PROPERTIES[target.path],
        inputAccessor.array,
        outputArray,
        interpolation as InterpolationModes,
      );

      // Override interpolation with custom factory method.
      if (sampler.interpolation === 'CUBICSPLINE') {
        this._createCubicSplineTrackInterpolant(track);
      }

      tracks.push(track);
    }

    return tracks;
  }

  _getArrayFromAccessor(accessor: BufferAttribute) {
    let outputArray = accessor.array;

    if (accessor.normalized) {
      const scale = getNormalizedComponentScale(
        outputArray.constructor as
        | typeof Int8Array
        | typeof Uint8Array
        | typeof Int16Array
        | typeof Uint16Array
        | typeof Uint32Array
        | typeof Float32Array,
      );
      const scaled = new Float32Array(outputArray.length);

      for (let j = 0, jl = outputArray.length; j < jl; j++) {
        scaled[j] = (outputArray[j] as number) * scale;
      }

      outputArray = scaled;
    }

    return outputArray;
  }

  _createCubicSplineTrackInterpolant(
    track: KeyframeTrack | VectorKeyframeTrack | QuaternionKeyframeTrack,
  ) {
    (track as CubicSplineTrack).createInterpolant = Object.assign(
      function InterpolantFactoryMethodGLTFCubicSpline(
        this: KeyframeTrack | VectorKeyframeTrack | QuaternionKeyframeTrack,
        result: TypedArray,
      ) {
        // A CUBICSPLINE keyframe in glTF has three output values for each input value,
        // representing inTangent, splineVertex, and outTangent. As a result, track.getValueSize()
        // must be divided by three to get the interpolant's sampleSize argument.

        const interpolantType
          = this instanceof QuaternionKeyframeTrack
            ? GLTFCubicSplineQuaternionInterpolant
            : GLTFCubicSplineInterpolant;

        return new interpolantType(this.times, this.values, this.getValueSize() / 3, result);
      },
    );

    // Mark as CUBICSPLINE. `track.getInterpolation()` doesn't support custom interpolants.
    (track as CubicSplineTrack).createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline = true;
  }
}
