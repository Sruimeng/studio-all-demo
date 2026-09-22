import type { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { type BufferAttribute, type BufferGeometry, type Group, InstancedBufferAttribute,
  InstancedMesh,
  LinearSRGBColorSpace,
  Matrix4,
  type Mesh,
  Object3D,
  Quaternion,
  Vector3 } from 'three';
import type { GLTFParser } from '../GLTF-parser';
import {
  ATTRIBUTES,
  EXTENSIONS,
  type GLTFJsonData,
  type GLTFPrimitive,
  WEBGL_COMPONENT_TYPES,
  WEBGL_CONSTANTS,
} from '../constants';

/**
 * Mesh Quantization Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_mesh_quantization
 */
export class GLTFMeshQuantizationExtension {
  name: string;
  constructor() {
    this.name = EXTENSIONS.KHR_MESH_QUANTIZATION;
  }
}

/**
 * DRACO Mesh Compression Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_draco_mesh_compression
 */
export class GLTFDracoMeshCompressionExtension {
  name: string;
  json: GLTFJsonData;
  dracoLoader: DRACOLoader;
  constructor(json: GLTFJsonData, dracoLoader?: DRACOLoader) {
    if (!dracoLoader) {
      throw new Error('THREE.GLTFLoader: No DRACOLoader instance provided.');
    }

    this.name = EXTENSIONS.KHR_DRACO_MESH_COMPRESSION;
    this.json = json;
    this.dracoLoader = dracoLoader;
    this.dracoLoader.preload();
  }

  decodePrimitive(
    primitive: GLTFPrimitive,
    parser: GLTFParser,
  ): Promise<BufferGeometry> {
    const json = this.json;
    const dracoLoader = this.dracoLoader;
    const extensions = primitive.extensions || {};
    const extensionDef = extensions[this.name] as {
      attributes: Record<string, number>;
      bufferView: number;
    };
    const bufferViewIndex = extensionDef.bufferView;
    const gltfAttributeMap = extensionDef.attributes;
    const threeAttributeMap: Record<string, number> = {};
    const attributeNormalizedMap: Record<string, boolean> = {};
    const attributeTypeMap: Record<string, string> = {};

    for (const attributeName in gltfAttributeMap) {
      const threeAttributeName
        = ATTRIBUTES[attributeName] || attributeName.toLowerCase();

      threeAttributeMap[threeAttributeName] = gltfAttributeMap[
        attributeName
      ] as number;
    }

    for (const attributeName in primitive.attributes) {
      const threeAttributeName
        = ATTRIBUTES[attributeName] || attributeName.toLowerCase();

      if (gltfAttributeMap[attributeName] !== undefined) {
        const accessorDef = json.accessors?.[
          primitive.attributes[attributeName] as number
        ] as { componentType: number; normalized?: boolean };

        if (!accessorDef) {
          throw new Error(
            `THREE.GLTFLoader: Accessor ${primitive.attributes[attributeName]} not found.`,
          );
        }
        const componentType
          = WEBGL_COMPONENT_TYPES[
            accessorDef.componentType as keyof typeof WEBGL_COMPONENT_TYPES
          ];

        attributeTypeMap[threeAttributeName] = componentType.name;
        attributeNormalizedMap[threeAttributeName]
          = accessorDef.normalized === true;
      }
    }

    return parser
      .getDependency('bufferView', bufferViewIndex)
      .then((bufferView) => {
        return new Promise((resolve, reject) => {
          // decodeDracoFile 方法在 DRACOLoader 中未定义
           
          (dracoLoader as any).decodeDracoFile(
            bufferView,
            (geometry: BufferGeometry) => {
              for (const attributeName in geometry.attributes) {
                const attribute = geometry.attributes[
                  attributeName
                ] as BufferAttribute;
                const normalized = attributeNormalizedMap[attributeName];

                if (normalized !== undefined) {
                  attribute.normalized = normalized;
                }
              }

              resolve(geometry);
            },
            threeAttributeMap,
            attributeTypeMap,
            LinearSRGBColorSpace,
            reject,
          );
        });
      });
  }
}

/**
 * meshopt BufferView Compression Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/EXT_meshopt_compression
 */
export class GLTFMeshoptCompression {
  name: string;
  parser: GLTFParser;
  constructor(parser: GLTFParser) {
    this.name = EXTENSIONS.EXT_MESHOPT_COMPRESSION;
    this.parser = parser;
  }

  loadBufferView(index: number) {
    const json = this.parser.json;
    const bufferViews = json.bufferViews || [];
    const bufferView = bufferViews[index] as {
      buffer: number;
      byteLength?: number;
      byteOffset?: number;
      extensions?: { [key: string]: unknown; buffer?: number; byteLength?: number; byteOffset?: number; byteStride?: number; count?: number; filter?: number; mode?: number };
    };
    const extensions = bufferView.extensions || {};
    const extensionsRequiredDef = json.extensionsRequired || [];

    if (extensions && extensions[this.name]) {
      const extensionDef = extensions[this.name] as { buffer: number; byteLength?: number; byteOffset: number; byteStride: number; count: number; filter: string; mode: string };
      const buffer = this.parser.getDependency(
        'buffer',
        extensionDef.buffer as number,
      );
      const decoder = this.parser.options.meshoptDecoder;

      if (!decoder || !decoder.supported) {
        if (extensionsRequiredDef.includes(this.name)) {
          throw new Error(
            'THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files',
          );
        } else {
          // Assumes that the extension is optional and that fallback buffer data is present
          return null;
        }
      }

      return buffer.then((res) => {
        const byteOffset: number = (extensionDef.byteOffset as number) ?? 0;
        const byteLength: number = (extensionDef.byteLength as number) ?? 0;

        const count = extensionDef.count as number;
        const stride = extensionDef.byteStride as number;

        const source = new Uint8Array(
          res as ArrayBuffer,
          byteOffset,
          byteLength,
        );

        if (decoder.decodeGltfBufferAsync) {
          return decoder.decodeGltfBufferAsync(
            count,
            stride,
            source,
            extensionDef.mode,
            extensionDef.filter,
          )
            .then((res) => {
              return res.buffer;
            });
        } else {
          // Support for MeshoptDecoder 0.18 or earlier, without decodeGltfBufferAsync
          return decoder.ready.then(() => {
            const result = new ArrayBuffer(count * stride);

            decoder.decodeGltfBuffer(
              new Uint8Array(result),
              count,
              stride,
              source,
              extensionDef.mode,
              extensionDef.filter,
            );

            return result;
          });
        }
      });
    } else {
      return null;
    }
  }
}

/**
 * GPU Instancing Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/EXT_mesh_gpu_instancing
 */
export class GLTFMeshGpuInstancing {
  name: string;
  parser: GLTFParser;
  constructor(parser: GLTFParser) {
    this.name = EXTENSIONS.EXT_MESH_GPU_INSTANCING;
    this.parser = parser;
  }

  createNodeMesh(nodeIndex: number) {
    const json = this.parser.json;
    const nodesDef = json.nodes || [];
    const nodeDef = nodesDef[nodeIndex] as {
      extensions?: {
        [key: string]: string | { attributes: Record<string, number> };
      };
      mesh?: number;
    };
    const meshesDef = json.meshes || [];

    if (
      !nodeDef.extensions
      || !nodeDef.extensions[this.name]
      || nodeDef.mesh === undefined
    ) {
      return null;
    }

    const meshDef = meshesDef[nodeDef.mesh] as { primitives: GLTFPrimitive[] };

    // No Points or Lines + Instancing support yet
    for (const primitive of meshDef.primitives) {
      if (
        primitive.mode !== WEBGL_CONSTANTS.TRIANGLES
        && primitive.mode !== WEBGL_CONSTANTS.TRIANGLE_STRIP
        && primitive.mode !== WEBGL_CONSTANTS.TRIANGLE_FAN
        && primitive.mode !== undefined
      ) {
        return null;
      }
    }

    const extensionRaw = nodeDef.extensions[this.name];
    if (
      typeof extensionRaw !== 'object'
      || extensionRaw === null
      || !('attributes' in extensionRaw)
    ) {
      return null;
    }

    const extensionDef = nodeDef.extensions[this.name] as {
      attributes: Record<string, number>;
    };
    const attributesDef = extensionDef.attributes as Record<string, number>;

    // @TODO: Can we support InstancedMesh + SkinnedMesh?
    const pending = [];
    const attributes: Record<string, BufferAttribute> = {};

    for (const key in attributesDef) {
      pending.push(
        this.parser
          .getDependency('accessor', attributesDef[key] as number)
          .then((accessor) => {
            attributes[key] = accessor as BufferAttribute;

            return attributes[key];
          }),
      );
    }

    if (pending.length < 1) {
      return null;
    }

    pending.push(this.parser.createNodeMesh(nodeIndex));

    return Promise.all(pending).then((results) => {
      const nodeObject = results.pop() as Group | Object3D;

      const meshes = (nodeObject as Group).isGroup
        ? (nodeObject as Group).children
        : [nodeObject];
      const count = (results[0] as BufferAttribute).count; // All attribute counts should be same
      const instancedMeshes = [];

      for (const mesh of meshes) {
        // Temporal variables
        const m = new Matrix4();
        const p = new Vector3();
        const q = new Quaternion();
        const s = new Vector3(1, 1, 1);

        const instancedMesh = new InstancedMesh(
          (mesh as Mesh).geometry,
          (mesh as Mesh).material,
          count,
        );

        for (let i = 0; i < count; i++) {
          if (attributes.TRANSLATION) {
            p.fromBufferAttribute(attributes.TRANSLATION, i);
          }

          if (attributes.ROTATION) {
            q.fromBufferAttribute(attributes.ROTATION, i);
          }

          if (attributes.SCALE) {
            s.fromBufferAttribute(attributes.SCALE, i);
          }

          instancedMesh.setMatrixAt(i, m.compose(p, q, s));
        }

        // Add instance attributes to the geometry, excluding TRS.
        for (const attributeName in attributes) {
          if (attributeName === '_COLOR_0') {
            const attr = attributes[attributeName] as {
              array: Float32Array;
              itemSize: number;
              normalized: boolean;
            };

            instancedMesh.instanceColor = new InstancedBufferAttribute(
              attr.array,
              attr.itemSize,
              attr.normalized,
            );
          } else if (
            attributeName !== 'TRANSLATION'
            && attributeName !== 'ROTATION'
            && attributeName !== 'SCALE'
          ) {
            (mesh as Mesh).geometry.setAttribute(
              attributeName,
              attributes[attributeName] as InstancedBufferAttribute,
            );
          }
        }

        // Just in case
        Object3D.prototype.copy.call(instancedMesh, mesh);

        this.parser.assignFinalMaterial(instancedMesh);

        instancedMeshes.push(instancedMesh);
      }

      if ((nodeObject as Group).isGroup) {
        (nodeObject as Group).clear();
        (nodeObject as Group).add(...instancedMeshes);

        return nodeObject;
      }

      return instancedMeshes[0];
    });
  }
}
