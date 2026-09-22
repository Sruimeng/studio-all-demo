// 普通 FBX 几何解析；三角化保留源多边形边身份，UV 描线无需再次解析资源。
import { type BufferAttribute, BufferGeometry, Color, ColorManagement,
  type EulerOrder,
  Float32BufferAttribute,
  Int16BufferAttribute,
  Matrix3,
  type Matrix4,
  ShapeUtils,
  SRGBColorSpace,
  Uint16BufferAttribute,
  Vector2,
  Vector3,
  Vector4 } from 'three';
import { setModelGeometryPolygonEdges, setModelGeometryTopology } from '~/@engine/model';
import type { BaseInfo } from '../../type';
import {
  type Deformers,
  type FBXConnectionNode,
  type FBXEulerOrder,
  type FBXGeometryNode,
  type FBXLayerElementColor,
  type FBXLayerElementNormal,
  type FBXLayerElementUV,
  type FBXMaterialNode,
  type FBXModelNode,
  type FBXMorphTarget,
  type FBXSkeleton,
  global, type UserDataTransform,
} from '../constants';
import { computeModelContribution, generateTransform, getData, getEulerOrder } from './utils';
import { setGeometryNormalVariants } from '../../../geometry/normal-variants';
import { NURBSCurve } from '../curves/NURBS-curve';
import { normalizeScale } from '../util';

interface GeoBufferInfo {
  buffer: number[];
  dataSize: number;
  indices: number[];
  mappingType: string;
  referenceType: string;
}
interface GeoSmoothingInfo {
  edgeIndices: number[];
  mappingType: string;
  values: number[];
}
/** 仅基础几何构建源拓扑；任一坏面使整个缓冲失效，morph 不重复保存身份。 */
interface GeoTopologyBuffers {
  cornerVertexIds: number[];
  faceOffsets: number[];
  renderVertexCorners: number[];
}
interface GeoInfo {
  baseVertexPositions?: number[];
  color?: GeoBufferInfo;
  material?: GeoBufferInfo;
  normal?: GeoBufferInfo;
  skeleton?: FBXSkeleton;
  smoothing?: GeoSmoothingInfo;
  uv?: {
    buffer: number[];
    dataSize: number;
    indices: number[];
    mappingType: string;
    referenceType: string;
  }[];
  vertexIndices?: number[];
  vertexPositions?: number[];
  weightTable?: {
    [key: number]: Array<{ id: number; weight: number }>;
  };
}

export class GeometryParser {
  negativeMaterialIndices: boolean;
  modelInfo: BaseInfo = {

    isUVMapped: false,
    polygons: 0,
    quads: 0,
    triangles: 0,
    vertices: 0,
  };

  constructor() {
    this.negativeMaterialIndices = false;
  }

  // Parse nodes in FBXTree.Objects.Geometry
  parse(
    deformers: Deformers,
    modelWorldMatrices: Map<number, Matrix4>,
    preservedModelIds: Set<number>,
    parentModelMap: Map<number, number | null>,
  ) {
    const geometryMap = new Map();
    const geoInfoMap = new Map();
    const fbxTree = global.fbxTree;
    const connections = global.connections;

    if (!fbxTree || !connections) {
      throw new Error('FBXTree or connections is not defined');
    }
    const objects = fbxTree.Objects;

    if (!objects) {
      throw new Error('Objects is not defined in FBXTree');
    }

    if ('Geometry' in objects) {
      const geoNodes = objects.Geometry;

      for (const nodeID in geoNodes) {
        if (!geoNodes[nodeID]) continue;
        const relationships = connections.get(parseInt(nodeID)) || { children: [], parents: [] };
        const result = this.parseGeometry(
          relationships,
          geoNodes[nodeID],
          deformers,
          modelWorldMatrices,
          preservedModelIds,
          parentModelMap,
        );
        const { geometry, modelInfo } = result || {};
        geometryMap.set(parseInt(nodeID), geometry);
        geoInfoMap.set(parseInt(nodeID), modelInfo);
      }
    }

    // report warnings

    if (this.negativeMaterialIndices === true) {
      console.warn(
        'THREE.FBXLoader: The FBX file contains invalid (negative) material indices. The asset might not render as expected.',
      );
    }

    return { geoInfoMap, geometryMap };
  }

  // Parse single node in FBXTree.Objects.Geometry
  parseGeometry(
    relationships: FBXConnectionNode,
    geoNode: FBXGeometryNode,
    deformers: Deformers,
    modelWorldMatrices: Map<number, Matrix4>,
    preservedModelIds: Set<number>,
    parentModelMap: Map<number, number | null>,
  ) {
    switch (geoNode.attrType) {
      case 'Mesh':
        return this.parseMeshGeometry(
          relationships,
          geoNode,
          deformers,
          modelWorldMatrices,
          preservedModelIds,
          parentModelMap,
        );

      case 'NurbsCurve':
        return this.parseNurbsGeometry(geoNode);
    }
  }

  // Parse single node mesh geometry in FBXTree.Objects.Geometry
  parseMeshGeometry(
    relationships: FBXConnectionNode,
    geoNode: FBXGeometryNode,
    deformers: Deformers,
    modelWorldMatrices: Map<number, Matrix4>,
    preservedModelIds: Set<number>,
    parentModelMap: Map<number, number | null>,
  ) {
    const skeletons = deformers.skeletons;
    const morphTargets: FBXMorphTarget[] = [];
    const fbxTreeObjects = global.fbxTree.Objects;

    if (!fbxTreeObjects) {
      throw new Error('Objects is not defined in FBXTree');
    }

    const models = fbxTreeObjects.Model;

    if (!models) {
      throw new Error('Model is not defined in FBXTree.Objects');
    }

    const modelNodes = relationships.parents.map((parent) => {
      return models[parent.ID.toString()];
    });

    // don't create geometry if it is not associated with any models
    if (modelNodes.length === 0) {
      return;
    }

    const skeleton = relationships.children.reduce<FBXSkeleton | null>((skeleton, child) => {
      const childID = child.ID;

      if (childID !== undefined && skeletons[childID]) {
        skeleton = skeletons[childID];
      }

      return skeleton;
    }, null);

    relationships.children.forEach((child) => {
      if (deformers.morphTargets[child.ID] !== undefined) {
        morphTargets.push(deformers.morphTargets[child.ID] as FBXMorphTarget);
      }
    });

    // Assume one model and get the preRotation from that
    // if there is more than one model associated with the geometry this may cause problems
    const modelNode = modelNodes[0] as FBXModelNode;

    const transformData: UserDataTransform = {};

    if ('RotationOrder' in modelNode) {
      const value = modelNode.RotationOrder.value;

      if (typeof value === 'number') {
        transformData.eulerOrder = getEulerOrder(
          modelNode.RotationOrder.value as FBXEulerOrder,
        ) as EulerOrder;
      }
    }
    if ('InheritType' in modelNode) {
      transformData.inheritType = parseInt(modelNode.InheritType.value as string);
    }

    if ('GeometricTranslation' in modelNode) {
      transformData.translation = modelNode.GeometricTranslation.value as number[];
    }
    if ('GeometricRotation' in modelNode) {
      transformData.rotation = modelNode.GeometricRotation.value as number[];
    }
    if ('GeometricScaling' in modelNode) {
      const scale = modelNode.GeometricScaling.value as number[];
      transformData.scale = [
        normalizeScale(scale[0] as number),
        normalizeScale(scale[1] as number),
        normalizeScale(scale[2] as number),
      ];
    }

    const geometricTransform = generateTransform(transformData);

    const modelContribution = computeModelContribution(
      relationships,
      modelWorldMatrices,
      preservedModelIds,
      parentModelMap,
    );

    const transform = modelContribution.clone().multiply(geometricTransform);

    const result = this.genGeometry(geoNode, skeleton, morphTargets, transform);
    if (result?.geometry) {
      result.geometry.userData.fbxModelContribution = modelContribution;
    }

    return result;
  }

  // Generate a BufferGeometry from a node in FBXTree.Objects.Geometry
  genGeometry(
    geoNode: FBXGeometryNode,
    skeleton: FBXSkeleton | null,
    morphTargets: FBXMorphTarget[],
    preTransform: Matrix4,
  ) {
    const geometry = new BufferGeometry();

    if (geoNode.attrName) {
      geometry.name = geoNode.attrName;
    }
    const geoInfo = this.parseGeoNode(geoNode, skeleton);
    const buffers = this.genBuffers(geoInfo);
    this.modelInfo.vertices = buffers.positionCount;
    const modelInfo = { ...this.modelInfo };
    this.modelInfo = {

      isUVMapped: false,
      polygons: 0,
      quads: 0,
      triangles: 0,
      vertices: 0,
    };

    const positionAttribute = new Float32BufferAttribute(buffers.vertex, 3);

    positionAttribute.applyMatrix4(preTransform);

    geometry.setAttribute('position', positionAttribute);

    if (buffers.colors.length > 0) {
      geometry.setAttribute('color', new Float32BufferAttribute(buffers.colors, 3));
    }

    if (skeleton) {
      geometry.setAttribute('skinIndex', new Uint16BufferAttribute(buffers.weightsIndices, 4));

      geometry.setAttribute('skinWeight', new Float32BufferAttribute(buffers.vertexWeights, 4));

      // used later to bind the skeleton to the model
      (geometry as BufferGeometry & { FBX_Deformer?: FBXSkeleton }).FBX_Deformer = skeleton;
    }

    const normalMatrix = new Matrix3().getNormalMatrix(preTransform);

    if (buffers.normal.length > 0) {
      geometry.setAttribute('normal', this.toInt16Normal(buffers.normal, normalMatrix));
    }

    // 平直/平滑各占一份 Int16 VBO，总量等于旧版单份 Float32 法线。
    // 两份都注册为 attribute，确保 geometry.dispose() 能释放切换后闲置的 VBO。
    if (buffers.flatNormal.length > 0) {
      setGeometryNormalVariants(
        geometry,
        this.toInt16Normal(buffers.flatNormal, normalMatrix),
        geometry.getAttribute('normal'),
      );
    }

    buffers.uvs.forEach(function (_, i) {
      const name = i === 0 ? 'uv' : `uv${i}`;
      const uv = buffers.uvs[i] as unknown as number[];

      geometry.setAttribute(name, new Float32BufferAttribute(uv, 2));
    });

    if (geoInfo.material && geoInfo.material.mappingType !== 'AllSame') {
      // Convert the material indices of each vertex into rendering groups on the geometry.
      let prevMaterialIndex = buffers.materialIndex[0];
      let startIndex = 0;

      buffers.materialIndex.forEach(function (currentIndex, i) {
        if (currentIndex !== prevMaterialIndex) {
          geometry.addGroup(startIndex, i - startIndex, prevMaterialIndex);

          prevMaterialIndex = currentIndex;
          startIndex = i;
        }
      });

      // the loop above doesn't add the last group, do that here.
      if (geometry.groups.length > 0) {
        const lastGroup = geometry.groups[geometry.groups.length - 1] as {
          count: number;
          materialIndex: number;
          start: number;
        };
        const lastIndex = lastGroup.start + lastGroup.count;

        if (lastIndex !== buffers.materialIndex.length) {
          geometry.addGroup(lastIndex, buffers.materialIndex.length - lastIndex, prevMaterialIndex);
        }
      }

      // case where there are multiple materials but the whole geometry is only
      // using one of them
      if (geometry.groups.length === 0) {
        geometry.addGroup(0, buffers.materialIndex.length, buffers.materialIndex[0]);
      }
    }

    this.addMorphTargets(geometry, geoNode, morphTargets, preTransform);

    setModelGeometryPolygonEdges(geometry, new Uint8Array(buffers.polygonEdgeMasks));
    if (buffers.topology) {
      setModelGeometryTopology(geometry, {
        cornerVertexIds: new Uint32Array(buffers.topology.cornerVertexIds),
        faceOffsets: new Uint32Array(buffers.topology.faceOffsets),
        renderVertexCorners: new Uint32Array(buffers.topology.renderVertexCorners),
      });
    }

    return { geometry, modelInfo };
  }

  parseGeoNode(geoNode: FBXGeometryNode, skeleton: FBXSkeleton | null): GeoInfo {
    const geoInfo: GeoInfo = {};

    geoInfo.vertexPositions
      = geoNode.Vertices !== undefined ? (geoNode.Vertices.a as number[]) : [];
    geoInfo.vertexIndices
      = geoNode.PolygonVertexIndex !== undefined ? (geoNode.PolygonVertexIndex.a as number[]) : [];

    if (geoNode.LayerElementColor) {
      geoInfo.color = this.parseVertexColors(geoNode.LayerElementColor[0] as FBXLayerElementColor);
    }

    if (geoNode.LayerElementMaterial) {
      geoInfo.material = this.parseMaterialIndices(
        geoNode.LayerElementMaterial[0] as FBXMaterialNode,
      );
    }

    if (geoNode.LayerElementNormal) {
      geoInfo.normal = this.parseNormals(geoNode.LayerElementNormal[0] as FBXLayerElementNormal);
    }

    const smoothingNode = Object.values(geoNode.LayerElementSmoothing ?? {})
      .find(node => node.Smoothing !== undefined);

    // Blender/ufbx 只在 Smoothing 数组真实存在时消费该层；缺失属性等同于没有 smoothing layer。
    if (!geoInfo.normal && smoothingNode?.Smoothing) {
      if (smoothingNode.MappingInformationType === 'ByEdge' && !geoNode.Edges) {
        console.warn(
          'THREE.FBXLoader: ByEdge smoothing is missing edge data. Falling back to Point domain.',
        );
      }

      geoInfo.smoothing = {
        edgeIndices: (geoNode.Edges?.a as number[] | undefined) ?? [],
        mappingType: smoothingNode.MappingInformationType,
        values: (smoothingNode.Smoothing.a as number[] | undefined) ?? [],
      };
    }

    if (geoNode.LayerElementUV) {
      geoInfo.uv = [];

      let i = 0;

      while (geoNode.LayerElementUV[i]) {
        if ((geoNode.LayerElementUV[i] as FBXLayerElementUV).UV) {
          geoInfo.uv.push(this.parseUVs(geoNode.LayerElementUV[i] as FBXLayerElementUV));
        }

        i++;
      }
    }

    geoInfo.weightTable = {};

    if (skeleton !== null) {
      geoInfo.skeleton = skeleton;

      skeleton.rawBones.forEach(function (rawBone, i) {
        // loop over the bone's vertex indices and weights
        rawBone.indices.forEach(function (index, j) {
          if (geoInfo.weightTable && geoInfo.weightTable[index] === undefined) {
            geoInfo.weightTable[index] = [];
          }

          if (geoInfo.weightTable) {
            (geoInfo.weightTable[index] as { id: number; weight: number }[]).push({
              id: i,
              weight: rawBone.weights[j] as number,
            });
          }
        });
      });
    }

    return geoInfo;
  }

  genBuffers(geoInfo: GeoInfo) {
    const positionCount = (geoInfo.vertexPositions?.length ?? 0) / 3;
    // Morph buffer 不会输出法线；跳过其 smooth fan 预处理，避免每个 morph target 重复建拓扑。
    const smoothCornerNormals
      = geoInfo.normal || geoInfo.baseVertexPositions
        ? null
        : this.computeSmoothCornerNormals(geoInfo);
    const buffers = {
      colors: [],
      // 逐面法线：同一个四边面/多边形内所有顶点共用一条，供平直着色使用
      flatNormal: [],
      materialIndex: [],
      normal: [],
      // 与 vertex 输出的最终三角顺序一致，只保存在 CPU 元数据中。
      polygonEdgeMasks: [] as number[],
      positionCount,
      // morph 使用同一三角化，但源身份只由基础几何拥有。
      topology: geoInfo.baseVertexPositions
        ? undefined
        : {
            cornerVertexIds: [] as number[],
            faceOffsets: [0],
            renderVertexCorners: [] as number[],
          },
      uvs: [] as number[][],
      vertex: [],
      vertexWeights: [],
      weightsIndices: [],
    };

    let polygonIndex = 0;
    let faceLength = 0;
    let faceStartPolygonVertexIndex = 0;
    let displayedWeightsWarning = false;

    // genFace 同步消费并复制标量；面间复用临时容器，不让输出持有这些数组。
    let facePositionIndexes: number[] = [];
    const faceNormals: number[] = [];
    const faceColors: number[] = [];
    const faceUVs: number[][] = [];
    const faceWeights: number[] = [];
    const faceWeightIndices: number[] = [];
    const faceFlatNormal = new Vector3();

    geoInfo.vertexIndices?.forEach((vertexIndex: number, polygonVertexIndex: number) => {
      const encodedVertexIndex = vertexIndex;
      let materialIndex: number | undefined;
      let endOfFace = false;

      // Face index and vertex index arrays are combined in a single array
      // A cube with quad faces looks like this:
      // PolygonVertexIndex: *24 {
      //  a: 0, 1, 3, -3, 2, 3, 5, -5, 4, 5, 7, -7, 6, 7, 1, -1, 1, 7, 5, -4, 6, 0, 2, -5
      //  }
      // Negative numbers mark the end of a face - first face here is 0, 1, 3, -3
      // to find index of last vertex bit shift the index: ^ - 1
      if (vertexIndex < 0) {
        vertexIndex = vertexIndex ^ -1; // equivalent to ( x * -1 ) - 1
        endOfFace = true;
      }

      if (buffers.topology) {
        // 在转为 Uint32Array 前核对源 ID，避免小数、越界和位运算截断伪造身份。
        const decodedVertexIndex = encodedVertexIndex < 0 ? -encodedVertexIndex - 1 : encodedVertexIndex;
        if (!Number.isInteger(decodedVertexIndex) || decodedVertexIndex !== vertexIndex
          || vertexIndex < 0 || vertexIndex >= positionCount || vertexIndex > 0xffffffff
          || !Number.isInteger(positionCount)) {
          buffers.topology = undefined;
        } else {
          buffers.topology.cornerVertexIds.push(vertexIndex);
        }
      }

      facePositionIndexes.push(vertexIndex * 3, vertexIndex * 3 + 1, vertexIndex * 3 + 2);

      if (geoInfo.color) {
        const data = getData(polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.color) as [
          number,
          number,
          number,
        ];

        faceColors.push(data[0], data[1], data[2]);
      }

      if (geoInfo.skeleton && geoInfo.weightTable) {
        // 无骨骼输入不分配逐角权重容器；保留原有排序、截断和补零顺序。
        let weightIndices: number[] = [];
        let weights: number[] = [];
        if (geoInfo.weightTable[vertexIndex] !== undefined) {
          (geoInfo.weightTable[vertexIndex] as { id: number; weight: number }[]).forEach(
            function (wt) {
              weights.push(wt.weight);
              weightIndices.push(wt.id);
            },
          );
        }

        if (weights.length > 4) {
          if (!displayedWeightsWarning) {
            console.warn(
              'THREE.FBXLoader: Vertex has more than 4 skinning weights assigned to vertex. Deleting additional weights.',
            );
            displayedWeightsWarning = true;
          }

          const wIndex = [0, 0, 0, 0];
          const Weight = [0, 0, 0, 0];

          weights.forEach(function (weight, weightIndex) {
            let currentWeight = weight;
            let currentIndex = weightIndices[weightIndex];

            Weight.forEach(function (comparedWeight, comparedWeightIndex, comparedWeightArray) {
              if (currentWeight > comparedWeight) {
                comparedWeightArray[comparedWeightIndex] = currentWeight;
                currentWeight = comparedWeight;

                const tmp = wIndex[comparedWeightIndex];

                wIndex[comparedWeightIndex] = currentIndex as number;
                currentIndex = tmp;
              }
            });
          });

          weightIndices = wIndex;
          weights = Weight;
        }

        // if the weight array is shorter than 4 pad with 0s
        while (weights.length < 4) {
          weights.push(0);
          weightIndices.push(0);
        }

        for (let i = 0; i < 4; ++i) {
          faceWeights.push(weights[i] as number);
          faceWeightIndices.push(weightIndices[i] as number);
        }
      }

      if (geoInfo.normal) {
        const data = getData(polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.normal) as [
          number,
          number,
          number,
        ];

        faceNormals.push(data[0], data[1], data[2]);
      }

      if (geoInfo.material && geoInfo.material.mappingType !== 'AllSame') {
        materialIndex = getData(
          polygonVertexIndex,
          polygonIndex,
          vertexIndex,
          geoInfo.material,
        )[0] as number;

        if (materialIndex < 0) {
          this.negativeMaterialIndices = true;
          materialIndex = 0; // fallback
        }
      }

      if (geoInfo.uv) {
        geoInfo.uv.forEach((uv, i) => {
          const data = getData(polygonVertexIndex, polygonIndex, vertexIndex, uv) as [
            number,
            number,
          ];

          if (faceUVs[i] === undefined) {
            faceUVs[i] = [];
          }

          faceUVs[i].push(data[0]);
          faceUVs[i].push(data[1]);
        });
      }

      faceLength++;

      if (endOfFace) {
        buffers.topology?.faceOffsets.push(polygonVertexIndex + 1);
        this.genFace(
          buffers,
          geoInfo,
          facePositionIndexes,
          materialIndex ?? 0,
          faceNormals,
          faceColors,
          faceUVs,
          faceWeights,
          faceWeightIndices,
          faceLength,
          faceStartPolygonVertexIndex,
          smoothCornerNormals,
          faceFlatNormal,
        );

        polygonIndex++;
        faceLength = 0;
        faceStartPolygonVertexIndex = polygonVertexIndex + 1;

        // 清空有效长度，UV 各层也保留容器，下一面不能读到上一面的角点属性。
        facePositionIndexes = [];
        if (geoInfo.normal) faceNormals.length = 0;
        if (geoInfo.color) faceColors.length = 0;
        for (const uv of faceUVs) {
          if (uv) uv.length = 0;
        }
        if (geoInfo.skeleton && geoInfo.weightTable) {
          faceWeights.length = 0;
          faceWeightIndices.length = 0;
        }
      }
    });

    // 当前渲染器忽略未闭合尾面，但完整邻接不能忽略它后仍声称可靠。
    if (faceLength !== 0 || buffers.topology?.faceOffsets.length === 1) buffers.topology = undefined;

    return buffers;
  }

  /**
   * 按 Blender 的 normal domain 规则计算源多边形角法线，不改动后续三角化与顶点展开。
   * 无 sharp 标记时走 Point domain；存在 sharp 标记时才建 corner smooth fan，此时只有恰好被
   * 两个反向 half-edge 使用的流形边才可能连通。两条路径都使用“单位面法线 × 当前角夹角”加权。
   */
  computeSmoothCornerNormals(geoInfo: GeoInfo): Float32Array {
    const polygonVertexIndices = geoInfo.vertexIndices ?? [];
    const positions = geoInfo.vertexPositions ?? [];
    const positionCount = Math.floor(positions.length / 3);
    const result = new Float32Array(polygonVertexIndices.length * 3);
    let faceCount = 0;
    let cornerCount = 0;

    // 当前几何生成器只消费以负索引闭合的面，预处理保持相同边界，不让残缺尾面影响已有面。
    for (let corner = 0; corner < polygonVertexIndices.length; corner++) {
      if ((polygonVertexIndices[corner] as number) < 0) {
        faceCount++;
        cornerCount = corner + 1;
      }
    }

    if (faceCount === 0) {
      return result;
    }

    const cornerVertices = new Int32Array(cornerCount);
    const cornerFaces = new Int32Array(cornerCount);
    const cornerPrev = new Int32Array(cornerCount);
    const cornerNext = new Int32Array(cornerCount);
    const faceOffsets = new Int32Array(faceCount + 1);
    let face = 0;
    let faceStart = 0;

    for (let corner = 0; corner < cornerCount; corner++) {
      const encodedVertex = polygonVertexIndices[corner] as number;

      cornerVertices[corner] = encodedVertex < 0 ? encodedVertex ^ -1 : encodedVertex;
      cornerFaces[corner] = face;

      if (encodedVertex < 0) {
        const faceEnd = corner + 1;

        faceOffsets[face] = faceStart;
        faceOffsets[face + 1] = faceEnd;

        for (let faceCorner = faceStart; faceCorner < faceEnd; faceCorner++) {
          cornerPrev[faceCorner] = faceCorner === faceStart ? faceEnd - 1 : faceCorner - 1;
          cornerNext[faceCorner] = faceCorner + 1 === faceEnd ? faceStart : faceCorner + 1;
        }

        face++;
        faceStart = faceEnd;
      }
    }

    const faceNormals = new Float32Array(faceCount * 3);

    for (face = 0; face < faceCount; face++) {
      const start = faceOffsets[face] as number;
      const end = faceOffsets[face + 1] as number;
      const previousVertex = cornerVertices[end - 1] as number;
      const previousOffset = previousVertex * 3;
      let previousX = positions[previousOffset] ?? 0;
      let previousY = positions[previousOffset + 1] ?? 0;
      let previousZ = positions[previousOffset + 2] ?? 0;
      let normalX = 0;
      let normalY = 0;
      let normalZ = 0;

      // 与 Blender normals_calc_faces 相同，源 n-gon 在三角化前用 Newell 法求一条单位面法线。
      for (let corner = start; corner < end; corner++) {
        const currentVertex = cornerVertices[corner] as number;
        const currentOffset = currentVertex * 3;
        const currentX = positions[currentOffset] ?? 0;
        const currentY = positions[currentOffset + 1] ?? 0;
        const currentZ = positions[currentOffset + 2] ?? 0;

        normalX += (previousY - currentY) * (previousZ + currentZ);
        normalY += (previousZ - currentZ) * (previousX + currentX);
        normalZ += (previousX - currentX) * (previousY + currentY);
        previousX = currentX;
        previousY = currentY;
        previousZ = currentZ;
      }

      const lengthSquared = normalX * normalX + normalY * normalY + normalZ * normalZ;
      const normalOffset = face * 3;

      if (lengthSquared > 1e-35 && lengthSquared < Infinity) {
        const inverseLength = 1 / Math.sqrt(lengthSquared);

        faceNormals[normalOffset] = normalX * inverseLength;
        faceNormals[normalOffset + 1] = normalY * inverseLength;
        faceNormals[normalOffset + 2] = normalZ * inverseLength;
      } else {
        // Blender 的退化面法线固定回退到 +Z，避免把微小浮点残差放大为随机方向。
        faceNormals[normalOffset + 2] = 1;
      }
    }

    const sharpFaces = new Uint8Array(faceCount);
    const smoothing = geoInfo.smoothing;
    let hasSharpFace = false;

    if (smoothing?.mappingType === 'ByPolygon') {
      for (face = 0; face < faceCount; face++) {
        sharpFaces[face] = this.getSmoothingValue(smoothing.values, face) === 0 ? 1 : 0;
        hasSharpFace ||= sharpFaces[face] !== 0;
      }
    }

    // 每个源 corner 只归一化一次“当前点 → 下一点”的方向；上一条边方向可由 prev corner 取反复用。
    const outgoingDirections = new Float32Array(cornerCount * 3);

    for (let corner = 0; corner < cornerCount; corner++) {
      const nextCorner = cornerNext[corner] as number;
      const vertexOffset = (cornerVertices[corner] as number) * 3;
      const nextVertexOffset = (cornerVertices[nextCorner] as number) * 3;
      const directionX = (positions[nextVertexOffset] ?? 0) - (positions[vertexOffset] ?? 0);
      const directionY
        = (positions[nextVertexOffset + 1] ?? 0) - (positions[vertexOffset + 1] ?? 0);
      const directionZ
        = (positions[nextVertexOffset + 2] ?? 0) - (positions[vertexOffset + 2] ?? 0);
      const lengthSquared
        = directionX * directionX + directionY * directionY + directionZ * directionZ;

      if (lengthSquared > 1e-35 && lengthSquared < Infinity) {
        const inverseLength = 1 / Math.sqrt(lengthSquared);
        const directionOffset = corner * 3;

        outgoingDirections[directionOffset] = directionX * inverseLength;
        outgoingDirections[directionOffset + 1] = directionY * inverseLength;
        outgoingDirections[directionOffset + 2] = directionZ * inverseLength;
      }
    }

    let mayHaveSharpEdge = false;

    if (smoothing?.mappingType === 'ByEdge') {
      for (let edgeIndex = 0; edgeIndex < smoothing.edgeIndices.length; edgeIndex++) {
        if (this.getSmoothingValue(smoothing.values, edgeIndex) === 0) {
          mayHaveSharpEdge = true;
          break;
        }
      }
    }

    // Blender 在全网格没有任何 sharp 标记时使用 Point domain，不执行拓扑 fan 切分。
    if (!hasSharpFace && !mayHaveSharpEdge) {
      this.computePointDomainCornerNormals(
        result,
        positionCount,
        cornerVertices,
        cornerFaces,
        cornerPrev,
        outgoingDirections,
        faceNormals,
      );

      return result;
    }

    // 开放寻址哈希把无向 control-point 对映射为边组，避免字符串 key 和逐 corner 对象分配。
    let edgeTableSize = 1;

    while (edgeTableSize < cornerCount * 2) {
      edgeTableSize *= 2;
    }

    // 建边阶段的六组 Int32/Uint32 数据共用 backing buffer；各阶段结束后继续复用已失效分片。
    const edgeWorkspace = new ArrayBuffer(
      Int32Array.BYTES_PER_ELEMENT * (edgeTableSize + cornerCount * 6),
    );
    const edgeTable = new Int32Array(edgeWorkspace, 0, edgeTableSize);
    const edgeArraysByteOffset = edgeTableSize * Int32Array.BYTES_PER_ELEMENT;
    const edgeVertexA = new Int32Array(edgeWorkspace, edgeArraysByteOffset, cornerCount);
    const edgeVertexB = new Int32Array(
      edgeWorkspace,
      edgeArraysByteOffset + cornerCount * Int32Array.BYTES_PER_ELEMENT,
      cornerCount,
    );
    const edgeFirstCorner = new Int32Array(
      edgeWorkspace,
      edgeArraysByteOffset + cornerCount * Int32Array.BYTES_PER_ELEMENT * 2,
      cornerCount,
    );
    const edgeSecondCorner = new Int32Array(
      edgeWorkspace,
      edgeArraysByteOffset + cornerCount * Int32Array.BYTES_PER_ELEMENT * 3,
      cornerCount,
    );
    const edgeGroupByCorner = new Int32Array(
      edgeWorkspace,
      edgeArraysByteOffset + cornerCount * Int32Array.BYTES_PER_ELEMENT * 4,
      cornerCount,
    );
    const edgeUseCount = new Uint32Array(
      edgeWorkspace,
      edgeArraysByteOffset + cornerCount * Int32Array.BYTES_PER_ELEMENT * 5,
      cornerCount,
    );
    let edgeCount = 0;

    edgeTable.fill(-1);
    edgeGroupByCorner.fill(-1);

    for (let corner = 0; corner < cornerCount; corner++) {
      const nextCorner = cornerNext[corner] as number;
      const startVertex = cornerVertices[corner] as number;
      const endVertex = cornerVertices[nextCorner] as number;
      const vertexA = Math.min(startVertex, endVertex);
      const vertexB = Math.max(startVertex, endVertex);
      let slot
        = (Math.imul(vertexA, -1640531527) ^ Math.imul(vertexB, -2048144789))
          & (edgeTableSize - 1);
      let edge = edgeTable[slot] as number;

      while (
        edge !== -1
        && (edgeVertexA[edge] !== vertexA || edgeVertexB[edge] !== vertexB)
      ) {
        slot = (slot + 1) & (edgeTableSize - 1);
        edge = edgeTable[slot] as number;
      }

      if (edge === -1) {
        edge = edgeCount++;
        edgeTable[slot] = edge;
        edgeVertexA[edge] = vertexA;
        edgeVertexB[edge] = vertexB;
        edgeFirstCorner[edge] = corner;
      } else if (edgeUseCount[edge] === 1) {
        edgeSecondCorner[edge] = corner;
      }

      edgeUseCount[edge] = (edgeUseCount[edge] as number) + 1;
      edgeGroupByCorner[corner] = edge;
    }

    const sharpEdges = new Uint8Array(edgeCount);
    let hasSharpEdge = false;

    if (smoothing?.mappingType === 'ByEdge') {
      for (let edgeIndex = 0; edgeIndex < smoothing.edgeIndices.length; edgeIndex++) {
        const polygonCorner = smoothing.edgeIndices[edgeIndex] as number;

        if (!Number.isInteger(polygonCorner) || polygonCorner < 0 || polygonCorner >= cornerCount) {
          continue;
        }

        const edge = edgeGroupByCorner[polygonCorner] as number;
        const edgeA = edgeVertexA[edge] as number;
        const edgeB = edgeVertexB[edge] as number;

        if (
          edge >= 0
          && edgeA !== edgeB
          && edgeA >= 0
          && edgeB < positionCount
          && this.getSmoothingValue(smoothing.values, edgeIndex) === 0
        ) {
          sharpEdges[edge] = 1;
          hasSharpEdge = true;
        }
      }
    }

    // 锐边声明全部无效时，Blender 最终仍会落回 Point domain。
    if (!hasSharpFace && !hasSharpEdge) {
      this.computePointDomainCornerNormals(
        result,
        positionCount,
        cornerVertices,
        cornerFaces,
        cornerPrev,
        outgoingDirections,
        faceNormals,
      );

      return result;
    }

    // 上方 while 保证哈希表大小 >= 2C；哈希表已不再读取，故前 2C 分片可安全复用。
    const parent = new Int32Array(edgeWorkspace, 0, cornerCount);
    const fanSizes = new Uint32Array(
      edgeWorkspace,
      cornerCount * Uint32Array.BYTES_PER_ELEMENT,
      cornerCount,
    );
    const treeRanks = new Uint8Array(cornerCount);

    fanSizes.fill(0);

    for (let corner = 0; corner < cornerCount; corner++) {
      parent[corner] = corner;
    }

    for (let edge = 0; edge < edgeCount; edge++) {
      const edgeA = edgeVertexA[edge] as number;
      const edgeB = edgeVertexB[edge] as number;

      // 边界边、非流形边、显式锐边和零长度边都不能传播 smooth fan。
      if (
        edgeUseCount[edge] !== 2
        || sharpEdges[edge] !== 0
        || edgeA === edgeB
        || edgeA < 0
        || edgeB >= positionCount
      ) {
        continue;
      }

      const firstCorner = edgeFirstCorner[edge] as number;
      const secondCorner = edgeSecondCorner[edge] as number;
      const firstNext = cornerNext[firstCorner] as number;
      const secondNext = cornerNext[secondCorner] as number;
      const firstFace = cornerFaces[firstCorner] as number;
      const secondFace = cornerFaces[secondCorner] as number;

      // 两个 half-edge 必须方向相反；同面重复边和反绕相邻面都按 Blender 规则截断。
      if (
        firstFace === secondFace
        || sharpFaces[firstFace] !== 0
        || sharpFaces[secondFace] !== 0
        || cornerVertices[firstCorner] !== cornerVertices[secondNext]
        || cornerVertices[firstNext] !== cornerVertices[secondCorner]
      ) {
        continue;
      }

      this.unionSmoothCorners(parent, treeRanks, firstCorner, secondNext);
      this.unionSmoothCorners(parent, treeRanks, firstNext, secondCorner);
    }

    for (let corner = 0; corner < cornerCount; corner++) {
      const root = this.findSmoothCornerRoot(parent, corner);

      parent[corner] = root;
      fanSizes[root] = (fanSizes[root] as number) + 1;
    }

    // 合并结束后边端点和首个 corner 已失效，原地复用连续 3C 分片累加 fan 法线。
    const fanAccumulated = new Float32Array(
      edgeWorkspace,
      edgeArraysByteOffset,
      cornerCount * 3,
    );

    fanAccumulated.fill(0);

    for (let corner = 0; corner < cornerCount; corner++) {
      const root = parent[corner] as number;

      if (fanSizes[root] === 1) {
        continue;
      }

      const angle = this.getSmoothCornerAngle(
        outgoingDirections,
        cornerPrev[corner] as number,
        corner,
      );
      const normalOffset = (cornerFaces[corner] as number) * 3;
      const accumulatedOffset = root * 3;
      const contributionX = Math.fround((faceNormals[normalOffset] as number) * angle);
      const contributionY = Math.fround((faceNormals[normalOffset + 1] as number) * angle);
      const contributionZ = Math.fround((faceNormals[normalOffset + 2] as number) * angle);

      fanAccumulated[accumulatedOffset]
        = Math.fround((fanAccumulated[accumulatedOffset] as number) + contributionX);
      fanAccumulated[accumulatedOffset + 1]
        = Math.fround((fanAccumulated[accumulatedOffset + 1] as number) + contributionY);
      fanAccumulated[accumulatedOffset + 2]
        = Math.fround((fanAccumulated[accumulatedOffset + 2] as number) + contributionZ);
    }

    for (let corner = 0; corner < cornerCount; corner++) {
      const root = parent[corner] as number;
      const sourceOffset
        = fanSizes[root] === 1 ? (cornerFaces[corner] as number) * 3 : root * 3;
      const source = fanSizes[root] === 1 ? faceNormals : fanAccumulated;
      const normalX = source[sourceOffset] as number;
      const normalY = source[sourceOffset + 1] as number;
      const normalZ = source[sourceOffset + 2] as number;
      const lengthSquared = normalX * normalX + normalY * normalY + normalZ * normalZ;
      const targetOffset = corner * 3;

      // 单面 fan 直接复制面法线；多面 fan 才归一化累加值，以保持 Blender 的浮点行为。
      if (fanSizes[root] === 1) {
        result[targetOffset] = normalX;
        result[targetOffset + 1] = normalY;
        result[targetOffset + 2] = normalZ;
      } else if (lengthSquared > 1e-35 && lengthSquared < Infinity) {
        const inverseLength = 1 / Math.sqrt(lengthSquared);

        result[targetOffset] = normalX * inverseLength;
        result[targetOffset + 1] = normalY * inverseLength;
        result[targetOffset + 2] = normalZ * inverseLength;
      }
    }

    return result;
  }

  /** 在 Blender Point domain 下按 control point 汇总所有关联面的角度加权法线。 */
  computePointDomainCornerNormals(
    result: Float32Array,
    positionCount: number,
    cornerVertices: Int32Array,
    cornerFaces: Int32Array,
    cornerPrev: Int32Array,
    outgoingDirections: Float32Array,
    faceNormals: Float32Array,
  ): void {
    const accumulated = new Float32Array(positionCount * 3);

    for (let corner = 0; corner < cornerVertices.length; corner++) {
      const vertex = cornerVertices[corner] as number;

      if (vertex < 0 || vertex >= positionCount) {
        continue;
      }

      const angle = this.getSmoothCornerAngle(
        outgoingDirections,
        cornerPrev[corner] as number,
        corner,
      );
      const normalOffset = (cornerFaces[corner] as number) * 3;
      const accumulatedOffset = vertex * 3;
      const contributionX = Math.fround((faceNormals[normalOffset] as number) * angle);
      const contributionY = Math.fround((faceNormals[normalOffset + 1] as number) * angle);
      const contributionZ = Math.fround((faceNormals[normalOffset + 2] as number) * angle);

      accumulated[accumulatedOffset]
        = Math.fround((accumulated[accumulatedOffset] as number) + contributionX);
      accumulated[accumulatedOffset + 1]
        = Math.fround((accumulated[accumulatedOffset + 1] as number) + contributionY);
      accumulated[accumulatedOffset + 2]
        = Math.fround((accumulated[accumulatedOffset + 2] as number) + contributionZ);
    }

    for (let corner = 0; corner < cornerVertices.length; corner++) {
      const vertex = cornerVertices[corner] as number;

      if (vertex < 0 || vertex >= positionCount) {
        continue;
      }

      const sourceOffset = vertex * 3;
      const normalX = accumulated[sourceOffset] as number;
      const normalY = accumulated[sourceOffset + 1] as number;
      const normalZ = accumulated[sourceOffset + 2] as number;
      const lengthSquared = normalX * normalX + normalY * normalY + normalZ * normalZ;

      if (lengthSquared > 1e-35 && lengthSquared < Infinity) {
        const inverseLength = 1 / Math.sqrt(lengthSquared);
        const targetOffset = corner * 3;

        result[targetOffset] = normalX * inverseLength;
        result[targetOffset + 1] = normalY * inverseLength;
        result[targetOffset + 2] = normalZ * inverseLength;
      }
    }
  }

  /** 复用相邻 half-edge 方向，并按 Blender float 精度计算 corner angle。 */
  getSmoothCornerAngle(
    outgoingDirections: Float32Array,
    previousCorner: number,
    corner: number,
  ): number {
    const previousDirectionOffset = previousCorner * 3;
    const nextDirectionOffset = corner * 3;
    const dotX = Math.fround(
      (outgoingDirections[previousDirectionOffset] as number)
      * (outgoingDirections[nextDirectionOffset] as number),
    );
    const dotY = Math.fround(
      (outgoingDirections[previousDirectionOffset + 1] as number)
      * (outgoingDirections[nextDirectionOffset + 1] as number),
    );
    const dotZ = Math.fround(
      (outgoingDirections[previousDirectionOffset + 2] as number)
      * (outgoingDirections[nextDirectionOffset + 2] as number),
    );
    const dot = Math.fround(-Math.fround(Math.fround(dotX + dotY) + dotZ));

    // Blender 全程使用 float，提前收敛可避免 Float32 累加值减 double 贡献时留下假残差。
    return Math.fround(this.safeAcosApprox(dot));
  }

  /** 按 ufbx 的截断数组规则读取 smoothing：短数组重复末值，空数组补零，长数组忽略多余值。 */
  getSmoothingValue(values: number[], index: number): number {
    if (values.length === 0) {
      return 0;
    }

    return values[Math.min(index, values.length - 1)] ?? 0;
  }

  /** 查找并压缩 smooth fan 并查集的根节点。 */
  findSmoothCornerRoot(parent: Int32Array, corner: number): number {
    let root = corner;

    while (parent[root] !== root) {
      root = parent[root] as number;
    }

    while (parent[corner] !== corner) {
      const next = parent[corner] as number;

      parent[corner] = root;
      corner = next;
    }

    return root;
  }

  /** 合并同一 control point 上跨流形平滑边连通的两个 corner。 */
  unionSmoothCorners(
    parent: Int32Array,
    treeRanks: Uint8Array,
    first: number,
    second: number,
  ): void {
    const firstRoot = this.findSmoothCornerRoot(parent, first);
    const secondRoot = this.findSmoothCornerRoot(parent, second);

    if (firstRoot === secondRoot) {
      return;
    }

    const firstRank = treeRanks[firstRoot] as number;
    const secondRank = treeRanks[secondRoot] as number;

    if (firstRank < secondRank) {
      parent[firstRoot] = secondRoot;
    } else {
      parent[secondRoot] = firstRoot;

      if (firstRank === secondRank) {
        treeRanks[firstRoot] = firstRank + 1;
      }
    }
  }

  /** 移植 Blender safe_acos_approx，在钳制浮点残差的同时避免热循环调用 Math.acos。 */
  safeAcosApprox(value: number): number {
    const absolute = Math.abs(value);
    const clamped = absolute < 1 ? 1 - (1 - absolute) : 1;
    const angle
      = Math.sqrt(1 - clamped)
        * (1.5707963267
          + clamped * (-0.213300989 + clamped * (0.077980478 + clamped * -0.02164095)));

    return value < 0 ? Math.PI - angle : angle;
  }

  /**
   * 把单位法线的矩阵变换、归一化和 Int16 量化融合到同一趟，并清洗退化法线。
   * 两条来源都会送进退化值：FBX 自带的法线数据本身就可能含零向量（导出器对孤立顶点、
   * 零面积面写零是常见做法），smooth fan 抵消时也可能得到零向量。
   * 零向量进 shader 后 normalize(vec3(0)) 得 NaN，NaN 再经 varying 插值污染整个三角形
   * （即黑斑）。量化是所有法线的唯一收口，故在此统一兜底。
   */
  toInt16Normal(values: ArrayLike<number>, normalMatrix?: Matrix3): Int16BufferAttribute {
    const attribute = new Int16BufferAttribute(values.length, 3, true);
    const array = attribute.array;
    const elements = normalMatrix?.elements;
    const m0 = elements?.[0] ?? 1;
    const m1 = elements?.[1] ?? 0;
    const m2 = elements?.[2] ?? 0;
    const m3 = elements?.[3] ?? 0;
    const m4 = elements?.[4] ?? 1;
    const m5 = elements?.[5] ?? 0;
    const m6 = elements?.[6] ?? 0;
    const m7 = elements?.[7] ?? 0;
    const m8 = elements?.[8] ?? 1;

    for (let i = 0; i < array.length; i += 3) {
      // 对齐 Float32BufferAttribute 的输入精度，避免量化边界因 JS double 多出 ±1 LSB。
      const sourceX = Math.fround(Number(values[i]));
      const sourceY = Math.fround(Number(values[i + 1]));
      const sourceZ = Math.fround(Number(values[i + 2]));
      const x = m0 * sourceX + m3 * sourceY + m6 * sourceZ;
      const y = m1 * sourceX + m4 * sourceY + m7 * sourceZ;
      const z = m2 * sourceX + m5 * sourceY + m8 * sourceZ;
      const lengthSquared = x * x + y * y + z * z;

      // 两个纯数值比较即挡掉零 / NaN / Infinity：NaN 的任何比较都是 false，Infinity 由右侧挡住
      if (lengthSquared > 0 && lengthSquared < Infinity) {
        // applyNormalMatrix 会归一化；未传矩阵时维持旧契约，直接量化调用方给出的单位法线。
        const inverseLength = elements ? 1 / Math.sqrt(lengthSquared) : 1;
        const normalX = Math.fround(x * inverseLength);
        const normalY = Math.fround(y * inverseLength);
        const normalZ = Math.fround(z * inverseLength);

        // 变换可能让分量略微越界，先夹到 [-1, 1] 再量化，避免 Int16 回绕翻转法线方向
        array[i] = Math.round(Math.max(-1, Math.min(1, normalX)) * 32767);
        array[i + 1] = Math.round(Math.max(-1, Math.min(1, normalY)) * 32767);
        array[i + 2] = Math.round(Math.max(-1, Math.min(1, normalZ)) * 32767);
        continue;
      }

      // 退化法线兜一条 +Z：方向无意义但有限，坏处从「整片破面」止于该顶点着色不对
      array[i + 2] = 32767;
    }

    return attribute;
  }

  /**
   * Newell 法：返回多边形的面积向量，模长为面积的两倍，方向由顶点环绕顺序决定。
   * 刻意不归一化，供调用方先做朝向判定；需要单位法线时再自行 normalize()。
   * 对三角形等价于普通叉积。
   * See https://www.khronos.org/opengl/wiki/Calculating_a_Surface_Normal
   */
  getAreaVectorNewell(vertices: Vector3[], normal = new Vector3()): Vector3 {
    normal.set(0, 0, 0);

    for (let i = 0; i < vertices.length; i++) {
      const current = vertices[i] as Vector3;
      const next = vertices[(i + 1) % vertices.length] as Vector3;

      normal.x += (current.y - next.y) * (current.z + next.z);
      normal.y += (current.z - next.z) * (current.x + next.x);
      normal.z += (current.x - next.x) * (current.y + next.y);
    }

    return normal;
  }

  /** 构造多边形所在平面的正交基，供 earcut 三角化前把顶点投影到 2D。 */
  getNormalTangentAndBitangent(areaVector: Vector3) {
    // 复用本面的 Newell 结果；只归一化副本，原向量仍用于三角化后的朝向校正。
    const normalVector = areaVector.clone().normalize();
    // Avoid up being equal or almost equal to normalVector
    const up
      = Math.abs(normalVector.z) > 0.5 ? new Vector3(0.0, 1.0, 0.0) : new Vector3(0.0, 0.0, 1.0);
    const tangent = up.cross(normalVector).normalize();
    const bitangent = normalVector.clone().cross(tangent).normalize();

    return {
      bitangent: bitangent,
      normal: normalVector,
      tangent: tangent,
    };
  }

  flattenVertex(vertex: Vector3, normalTangent: Vector3, normalBitangent: Vector3): Vector2 {
    return new Vector2(vertex.dot(normalTangent), vertex.dot(normalBitangent));
  }

  /** 原多边形环与真实三角覆盖必须一致；只影响精确拓扑发布，不更改几何和描线掩码。 */
  isReliableTopologyFace(facePositionIndexes: number[], triangles: number[][], positions: number[], faceLength: number): boolean {
    if (faceLength < 3 || triangles.length !== faceLength - 2 || !Number.isSafeInteger(faceLength * faceLength)) return false;
    // 三角源面占多数，不为每个面额外分配源顶点集合与边表。
    const vertexIds = faceLength > 3 ? new Set<number>() : undefined;
    for (let corner = 0; corner < faceLength; corner++) {
      const offset = facePositionIndexes[corner * 3]!;
      vertexIds?.add(offset / 3);
      if (!Number.isFinite(positions[offset]) || !Number.isFinite(positions[offset + 1]) || !Number.isFinite(positions[offset + 2])) return false;
    }
    if (vertexIds && vertexIds.size !== faceLength) return false;
    const edgeCounts = faceLength > 3 ? new Map<number, number>() : undefined;
    for (const triangle of triangles) {
      if (triangle.length !== 3 || triangle.some(corner => !Number.isInteger(corner) || corner < 0 || corner >= faceLength)) return false;
      const a = facePositionIndexes[triangle[0]! * 3]!;
      const b = facePositionIndexes[triangle[1]! * 3]!;
      const c = facePositionIndexes[triangle[2]! * 3]!;
      const abX = positions[b]! - positions[a]!;
      const abY = positions[b + 1]! - positions[a + 1]!;
      const abZ = positions[b + 2]! - positions[a + 2]!;
      const acX = positions[c]! - positions[a]!;
      const acY = positions[c + 1]! - positions[a + 1]!;
      const acZ = positions[c + 2]! - positions[a + 2]!;
      const crossX = abY * acZ - abZ * acY;
      const crossY = abZ * acX - abX * acZ;
      const crossZ = abX * acY - abY * acX;
      if (!Number.isFinite(crossX + crossY + crossZ) || (crossX === 0 && crossY === 0 && crossZ === 0)) return false;
      if (!edgeCounts) continue;
      for (let edge = 0; edge < 3; edge++) {
        const first = triangle[edge]!;
        const second = triangle[(edge + 1) % 3]!;
        const key = Math.min(first, second) * faceLength + Math.max(first, second);
        edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
      }
    }
    if (!edgeCounts) return true;
    for (let corner = 0; corner < faceLength; corner++) {
      const next = (corner + 1) % faceLength;
      if (edgeCounts.get(Math.min(corner, next) * faceLength + Math.max(corner, next)) !== 1) return false;
    }
    for (const [key, count] of edgeCounts) {
      const distance = key % faceLength - Math.floor(key / faceLength);
      if (count !== (distance === 1 || distance === faceLength - 1 ? 1 : 2)) return false;
    }
    return true;
  }

  /** 生成单面的最终三角缓冲；源角点映射不可靠时整面回退三角描线。 */
  genFace(
    buffers: {
      colors: number[];
      flatNormal: number[];
      materialIndex: number[];
      normal: number[];
      polygonEdgeMasks: number[];
      topology: GeoTopologyBuffers | undefined;
      uvs: number[][];
      vertex: number[];
      vertexWeights: number[];
      weightsIndices: number[];
    },
    geoInfo: GeoInfo,
    facePositionIndexes: number[],
    materialIndex: number,
    faceNormals: number[],
    faceColors: number[],
    faceUVs: number[][],
    faceWeights: number[],
    faceWeightIndices: number[],
    faceLength: number,
    faceStartPolygonVertexIndex: number,
    smoothCornerNormals: Float32Array | null,
    faceFlatNormal: Vector3,
  ) {
    let triangles: number[][];
    // ShapeUtils 可能删闭合端点；不能只以输出 triangle 数推断角点映射可靠。
    let reliablePolygon = faceLength >= 3;

    // in morphing scenario vertexPositions represent morphPositions
    // while baseVertexPositions represent the original geometry's positions
    const positions = geoInfo.baseVertexPositions || geoInfo.vertexPositions || [];

    if (faceLength > 3) {
      if (faceLength === 4) {
        this.modelInfo.quads++;
      } else {
        this.modelInfo.polygons++;
      }
      // Triangulate n-gon using earcut
      const vertices = [];

      for (let i = 0; i < facePositionIndexes.length; i += 3) {
        vertices.push(
          new Vector3(
            positions[facePositionIndexes[i] as number],
            positions[facePositionIndexes[i + 1] as number],
            positions[facePositionIndexes[i + 2] as number],
          ),
        );
      }

      // 四边面和多边形共用一条 Newell 面积向量，三角化后不会在对角线处断裂
      this.getAreaVectorNewell(vertices, faceFlatNormal);
      const { bitangent, tangent } = this.getNormalTangentAndBitangent(faceFlatNormal);
      const triangulationInput = [];

      for (const vertex of vertices) {
        triangulationInput.push(this.flattenVertex(vertex, tangent, bitangent));
      }

      // When vertices is an array of [0,0,0] elements (which is the case for vertices not participating in morph)
      // the triangulationInput will be an array of [0,0] elements
      // resulting in an array of 0 triangles being returned from ShapeUtils.triangulateShape
      // leading to not pushing into buffers.vertex the redundant vertices (the vertices that are not morphed).
      // That's why, in order to support morphing scenario, "positions" is looking first for baseVertexPositions,
      // so that we don't end up with an array of 0 triangles for the faces not participating in morph.
      triangles = ShapeUtils.triangulateShape(triangulationInput, []);
      reliablePolygon = triangulationInput.length === faceLength && triangles.length === faceLength - 2;
      if (reliablePolygon) {
        // 全角点覆盖还不能证明三角化完整；退化三角与省略原始边必须使整面降级。
        const covered = new Uint8Array(faceLength);
        for (const triangle of triangles) {
          if (triangle.length !== 3) {
            reliablePolygon = false;
            break;
          }
          for (const corner of triangle) {
            if (!Number.isInteger(corner) || corner < 0 || corner >= faceLength) reliablePolygon = false;
            else covered[corner] = 1;
          }
          if (!reliablePolygon) break;
          const a = triangulationInput[triangle[0]!]!;
          const b = triangulationInput[triangle[1]!]!;
          const c = triangulationInput[triangle[2]!]!;
          const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
          if (!Number.isFinite(area) || area === 0) {
            reliablePolygon = false;
            break;
          }
        }
        if (covered.some(value => value === 0)) reliablePolygon = false;
      }
    } else {
      this.modelInfo.triangles++;
      const a = facePositionIndexes[0] as number;
      const b = facePositionIndexes[3] as number;
      const c = facePositionIndexes[6] as number;
      const abX = (positions[b] ?? 0) - (positions[a] ?? 0);
      const abY = (positions[b + 1] ?? 0) - (positions[a + 1] ?? 0);
      const abZ = (positions[b + 2] ?? 0) - (positions[a + 2] ?? 0);
      const acX = (positions[c] ?? 0) - (positions[a] ?? 0);
      const acY = (positions[c + 1] ?? 0) - (positions[a + 1] ?? 0);
      const acZ = (positions[c + 2] ?? 0) - (positions[a + 2] ?? 0);

      // 三角面直接计算叉积，避免在加载热循环中创建顶点对象；先不归一化以供朝向判定。
      faceFlatNormal.set(
        abY * acZ - abZ * acY,
        abZ * acX - abX * acZ,
        abX * acY - abY * acX,
      );
      // Regular triangle, skip earcut triangulation step
      triangles = [[0, 1, 2]];
    }

    if (buffers.topology && (!reliablePolygon || !this.isReliableTopologyFace(facePositionIndexes, triangles, positions, faceLength))) {
      buffers.topology = undefined;
    }

    // 几何法线朝向由顶点环绕顺序决定，与 FBX 原始法线相反时翻转。
    // 判据取该面所有角法线之和：FBX 法线多为 ByPolygonVertex，硬边 / UV 缝处单个角法线
    // 可能偏离面朝向 90° 以上，只看首角会误判并把正确的法线翻向模型内部。
    let orientationDot = 0;

    for (let i = 0; i + 2 < faceNormals.length; i += 3) {
      orientationDot
        += faceFlatNormal.x * (faceNormals[i] ?? 0)
          + faceFlatNormal.y * (faceNormals[i + 1] ?? 0)
          + faceFlatNormal.z * (faceNormals[i + 2] ?? 0);
    }

    // 无 LayerElementNormal 时 faceNormals 为空、点积恒为 0，这里永不翻转，朝向完全由环绕顺序决定。
    // 新导出管线不写法线，走的正是这条分支：上面那套判据在新资产上不生效，面朝向的正确性
    // 完全依赖导出端保证环绕顺序一致。Corner domain 会在反绕边切断 fan；没有任何 sharp 标记的
    // Point domain 则与 Blender 一样仍按 control point 汇总，反向面可能发生抵消并由统一兜底收口。
    if (orientationDot < 0) {
      faceFlatNormal.negate();
    }

    // 平直着色只需要单位面法线；平滑法线已经基于源 n-gon 在三角化前独立算好。
    faceFlatNormal.normalize();

    if (geoInfo.vertexPositions === undefined) {
      throw new Error('vertexPositions is not defined in geoInfo');
    }

    for (const triangle of triangles) {
      const [i0 = -1, i1 = -1, i2 = -1] = triangle;
      // 使用源面的局部角点序号判邻接，接缝和重合坐标不参与边身份判定。
      let edgeMask = 7;
      if (reliablePolygon && faceLength > 3) {
        edgeMask = 0;
        for (let edge = 0; edge < 3; edge++) {
          const distance = Math.abs(triangle[edge]! - triangle[(edge + 1) % 3]!);
          if (distance === 1 || distance === faceLength - 1) edgeMask |= 1 << edge;
        }
      }
      buffers.polygonEdgeMasks.push(edgeMask);
      buffers.topology?.renderVertexCorners.push(
        faceStartPolygonVertexIndex + i0,
        faceStartPolygonVertexIndex + i1,
        faceStartPolygonVertexIndex + i2,
      );

      buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i0 * 3] as number] as number);
      buffers.vertex.push(
        geoInfo.vertexPositions[facePositionIndexes[i0 * 3 + 1] as number] as number,
      );
      buffers.vertex.push(
        geoInfo.vertexPositions[facePositionIndexes[i0 * 3 + 2] as number] as number,
      );

      buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i1 * 3] as number] as number);
      buffers.vertex.push(
        geoInfo.vertexPositions[facePositionIndexes[i1 * 3 + 1] as number] as number,
      );
      buffers.vertex.push(
        geoInfo.vertexPositions[facePositionIndexes[i1 * 3 + 2] as number] as number,
      );

      buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i2 * 3] as number] as number);
      buffers.vertex.push(
        geoInfo.vertexPositions[facePositionIndexes[i2 * 3 + 1] as number] as number,
      );
      buffers.vertex.push(
        geoInfo.vertexPositions[facePositionIndexes[i2 * 3 + 2] as number] as number,
      );

      if (geoInfo.skeleton) {
        buffers.vertexWeights.push(faceWeights[i0 * 4] as number);
        buffers.vertexWeights.push(faceWeights[i0 * 4 + 1] as number);
        buffers.vertexWeights.push(faceWeights[i0 * 4 + 2] as number);
        buffers.vertexWeights.push(faceWeights[i0 * 4 + 3] as number);

        buffers.vertexWeights.push(faceWeights[i1 * 4] as number);
        buffers.vertexWeights.push(faceWeights[i1 * 4 + 1] as number);
        buffers.vertexWeights.push(faceWeights[i1 * 4 + 2] as number);
        buffers.vertexWeights.push(faceWeights[i1 * 4 + 3] as number);

        buffers.vertexWeights.push(faceWeights[i2 * 4] as number);
        buffers.vertexWeights.push(faceWeights[i2 * 4 + 1] as number);
        buffers.vertexWeights.push(faceWeights[i2 * 4 + 2] as number);
        buffers.vertexWeights.push(faceWeights[i2 * 4 + 3] as number);

        buffers.weightsIndices.push(faceWeightIndices[i0 * 4] as number);
        buffers.weightsIndices.push(faceWeightIndices[i0 * 4 + 1] as number);
        buffers.weightsIndices.push(faceWeightIndices[i0 * 4 + 2] as number);
        buffers.weightsIndices.push(faceWeightIndices[i0 * 4 + 3] as number);

        buffers.weightsIndices.push(faceWeightIndices[i1 * 4] as number);
        buffers.weightsIndices.push(faceWeightIndices[i1 * 4 + 1] as number);
        buffers.weightsIndices.push(faceWeightIndices[i1 * 4 + 2] as number);
        buffers.weightsIndices.push(faceWeightIndices[i1 * 4 + 3] as number);

        buffers.weightsIndices.push(faceWeightIndices[i2 * 4] as number);
        buffers.weightsIndices.push(faceWeightIndices[i2 * 4 + 1] as number);
        buffers.weightsIndices.push(faceWeightIndices[i2 * 4 + 2] as number);
        buffers.weightsIndices.push(faceWeightIndices[i2 * 4 + 3] as number);
      }

      if (geoInfo.color) {
        buffers.colors.push(faceColors[i0 * 3] as number);
        buffers.colors.push(faceColors[i0 * 3 + 1] as number);
        buffers.colors.push(faceColors[i0 * 3 + 2] as number);

        buffers.colors.push(faceColors[i1 * 3] as number);
        buffers.colors.push(faceColors[i1 * 3 + 1] as number);
        buffers.colors.push(faceColors[i1 * 3 + 2] as number);

        buffers.colors.push(faceColors[i2 * 3] as number);
        buffers.colors.push(faceColors[i2 * 3 + 1] as number);
        buffers.colors.push(faceColors[i2 * 3 + 2] as number);
      }

      if (geoInfo.material && geoInfo.material.mappingType !== 'AllSame') {
        buffers.materialIndex.push(materialIndex);
        buffers.materialIndex.push(materialIndex);
        buffers.materialIndex.push(materialIndex);
      }

      if (geoInfo.normal) {
        buffers.normal.push(faceNormals[i0 * 3] as number);
        buffers.normal.push(faceNormals[i0 * 3 + 1] as number);
        buffers.normal.push(faceNormals[i0 * 3 + 2] as number);

        buffers.normal.push(faceNormals[i1 * 3] as number);
        buffers.normal.push(faceNormals[i1 * 3 + 1] as number);
        buffers.normal.push(faceNormals[i1 * 3 + 2] as number);

        buffers.normal.push(faceNormals[i2 * 3] as number);
        buffers.normal.push(faceNormals[i2 * 3 + 1] as number);
        buffers.normal.push(faceNormals[i2 * 3 + 2] as number);
      } else if (smoothCornerNormals) {
        const sourceCorner0 = (faceStartPolygonVertexIndex + i0) * 3;
        const sourceCorner1 = (faceStartPolygonVertexIndex + i1) * 3;
        const sourceCorner2 = (faceStartPolygonVertexIndex + i2) * 3;

        buffers.normal.push(
          smoothCornerNormals[sourceCorner0] as number,
          smoothCornerNormals[sourceCorner0 + 1] as number,
          smoothCornerNormals[sourceCorner0 + 2] as number,
          smoothCornerNormals[sourceCorner1] as number,
          smoothCornerNormals[sourceCorner1 + 1] as number,
          smoothCornerNormals[sourceCorner1 + 2] as number,
          smoothCornerNormals[sourceCorner2] as number,
          smoothCornerNormals[sourceCorner2 + 1] as number,
          smoothCornerNormals[sourceCorner2 + 2] as number,
        );
      }

      // 同一个面切出的每个三角形都写入同一条面法线，四边面因此不会在对角线处出现着色断裂
      for (let n = 0; n < 3; n++) {
        buffers.flatNormal.push(faceFlatNormal.x, faceFlatNormal.y, faceFlatNormal.z);
      }

      if (geoInfo.uv) {
        for (let j = 0; j < geoInfo.uv.length; j++) {
          if (buffers.uvs[j] === undefined) {
            buffers.uvs[j] = [];
          }

          (buffers.uvs[j] as number[]).push((faceUVs[j] as number[])[i0 * 2] as number);
          (buffers.uvs[j] as number[]).push((faceUVs[j] as number[])[i0 * 2 + 1] as number);

          (buffers.uvs[j] as number[]).push((faceUVs[j] as number[])[i1 * 2] as number);
          (buffers.uvs[j] as number[]).push((faceUVs[j] as number[])[i1 * 2 + 1] as number);

          (buffers.uvs[j] as number[]).push((faceUVs[j] as number[])[i2 * 2] as number);
          (buffers.uvs[j] as number[]).push((faceUVs[j] as number[])[i2 * 2 + 1] as number);
        }
      }
    }
  }

  addMorphTargets(
    parentGeo: BufferGeometry,
    parentGeoNode: FBXGeometryNode,
    morphTargets: FBXMorphTarget[],
    preTransform: Matrix4,
  ) {
    if (morphTargets.length === 0) {
      return;
    }

    parentGeo.morphTargetsRelative = true;

    parentGeo.morphAttributes.position = [];
    // parentGeo.morphAttributes.normal = []; // not implemented

    const fbxTree = global.fbxTree;
    const fbxGeometry = fbxTree.Objects?.Geometry;

    if (!fbxGeometry) {
      throw new Error('Objects.Geometry is not defined in FBXTree');
    }

    morphTargets.forEach((morphTarget) => {
      const rawTargets = morphTarget.rawTargets;

      if (!rawTargets) {
        return;
      }
      rawTargets.forEach((rawTarget) => {
        const morphGeoNode = fbxGeometry[(rawTarget.geoID ?? 0).toString()];

        if (morphGeoNode !== undefined) {
          this.genMorphGeometry(
            parentGeo,
            parentGeoNode,
            morphGeoNode,
            preTransform,
            rawTarget.name ?? '',
          );
        }
      });
    });
  }

  // a morph geometry node is similar to a standard  node, and the node is also contained
  // in FBXTree.Objects.Geometry, however it can only have attributes for position, normal
  // and a special attribute Index defining which vertices of the original geometry are affected
  // Normal and position attributes only have data for the vertices that are affected by the morph
  genMorphGeometry(
    parentGeo: BufferGeometry,
    parentGeoNode: FBXGeometryNode,
    morphGeoNode: FBXGeometryNode,
    preTransform: Matrix4,
    name: string,
  ) {
    const basePositions = parentGeoNode.Vertices !== undefined ? parentGeoNode.Vertices.a : [];
    const baseIndices
      = parentGeoNode.PolygonVertexIndex !== undefined ? parentGeoNode.PolygonVertexIndex.a : [];

    const morphPositionsSparse = (
      morphGeoNode.Vertices !== undefined ? morphGeoNode.Vertices.a : []
    ) as number[];
    const morphIndices = (
      morphGeoNode.Indexes !== undefined ? morphGeoNode.Indexes.a : []
    ) as number[];

    const length = (parentGeo.attributes.position?.count as number) * 3;
    const morphPositions = new Float32Array(length);

    for (let i = 0; i < morphIndices.length; i++) {
      const morphIndex = (morphIndices[i] as number) * 3;

      morphPositions[morphIndex] = morphPositionsSparse[i * 3] as number;
      morphPositions[morphIndex + 1] = morphPositionsSparse[i * 3 + 1] as number;
      morphPositions[morphIndex + 2] = morphPositionsSparse[i * 3 + 2] as number;
    }

    // TODO: add morph normal support
    const morphGeoInfo: GeoInfo = {
      baseVertexPositions: basePositions as number[],
      vertexIndices: baseIndices as number[],
      vertexPositions: Array.from(morphPositions),
    };

    const morphBuffers = this.genBuffers(morphGeoInfo);

    const positionAttribute = new Float32BufferAttribute(morphBuffers.vertex, 3);

    positionAttribute.name = name || morphGeoNode.attrName;

    positionAttribute.applyMatrix4(preTransform);

    (parentGeo.morphAttributes.position as BufferAttribute[]).push(positionAttribute);
  }

  // Parse normal from FBXTree.Objects.Geometry.LayerElementNormal if it exists
  parseNormals(NormalNode: FBXLayerElementNormal) {
    const mappingType = NormalNode.MappingInformationType;
    const referenceType = NormalNode.ReferenceInformationType;
    const buffer = NormalNode.Normals?.a || [];
    let indexBuffer: number[] = [];

    if (referenceType === 'IndexToDirect') {
      if ('NormalIndex' in NormalNode) {
        indexBuffer = NormalNode.NormalIndex?.a || [];
      } else if ('NormalsIndex' in NormalNode) {
        indexBuffer = NormalNode.NormalsIndex?.a || [];
      }
    }

    return {
      buffer: buffer,
      dataSize: 3,
      indices: indexBuffer,
      mappingType: mappingType,
      referenceType: referenceType,
    };
  }

  // Parse UVs from FBXTree.Objects.Geometry.LayerElementUV if it exists
  parseUVs(UVNode: FBXLayerElementUV): GeoBufferInfo {
    const mappingType = UVNode.MappingInformationType;
    const referenceType = UVNode.ReferenceInformationType;
    const buffer = UVNode.UV.a;
    let indexBuffer: number[] = [];

    if (referenceType === 'IndexToDirect') {
      indexBuffer = UVNode.UVIndex.a as number[];
    }

    return {
      buffer: buffer as number[],
      dataSize: 2,
      indices: indexBuffer,
      mappingType: mappingType,
      referenceType: referenceType,
    };
  }

  // Parse Vertex Colors from FBXTree.Objects.Geometry.LayerElementColor if it exists
  parseVertexColors(ColorNode: FBXLayerElementColor): {
    buffer: number[];
    dataSize: number;
    indices: number[];
    mappingType: string;
    referenceType: string;
  } {
    const mappingType = ColorNode.MappingInformationType;
    const referenceType = ColorNode.ReferenceInformationType;
    const buffer = ColorNode.Colors.a;
    let indexBuffer: number[] = [];

    if (referenceType === 'IndexToDirect') {
      indexBuffer = ColorNode.ColorIndex.a;
    }

    for (let i = 0, c = new Color(); i < buffer.length; i += 4) {
      c.fromArray(buffer, i);
      ColorManagement.colorSpaceToWorking(c, SRGBColorSpace);
      c.toArray(buffer, i);
    }

    return {
      buffer: buffer,
      dataSize: 4,
      indices: indexBuffer,
      mappingType: mappingType,
      referenceType: referenceType,
    };
  }

  // Parse mapping and material data in FBXTree.Objects.Geometry.LayerElementMaterial if it exists
  parseMaterialIndices(MaterialNode: FBXMaterialNode) {
    const mappingType = MaterialNode.MappingInformationType;
    const referenceType = MaterialNode.ReferenceInformationType;

    if (mappingType === 'NoMappingInformation') {
      return {
        buffer: [0],
        dataSize: 1,
        indices: [0],
        mappingType: 'AllSame',
        referenceType: referenceType,
      };
    }

    const materialIndexBuffer = MaterialNode.Materials.a as number[];

    // Since materials are stored as indices, there's a bit of a mismatch between FBX and what
    // we expect.So we create an intermediate buffer that points to the index in the buffer,
    // for conforming with the other functions we've written for other data.
    const materialIndices: number[] = [];

    for (let i = 0; i < materialIndexBuffer.length; ++i) {
      materialIndices.push(i);
    }

    return {
      buffer: materialIndexBuffer,
      dataSize: 1,
      indices: materialIndices,
      mappingType: mappingType,
      referenceType: referenceType,
    };
  }

  // Generate a NurbGeometry from a node in FBXTree.Objects.Geometry
  parseNurbsGeometry(geoNode: FBXGeometryNode) {
    const order = parseInt(geoNode.Order || '0');

    if (isNaN(order)) {
      console.error(
        'THREE.FBXLoader: Invalid Order %s given for geometry ID: %s',
        geoNode.Order,
        geoNode.id,
      );

      return { geometry: new BufferGeometry() };
    }

    const degree = order - 1;
    const knots = geoNode.KnotVector?.a || [];
    const controlPoints: Vector4[] = [];
    const pointsValues = geoNode.Points?.a || [];

    for (let i = 0, l = pointsValues.length; i < l; i += 4) {
      controlPoints.push(new Vector4().fromArray(pointsValues, i));
    }

    let startKnot, endKnot;

    if (geoNode.Form === 'Closed') {
      controlPoints.push(controlPoints[0] as Vector4);
    } else if (geoNode.Form === 'Periodic') {
      startKnot = degree;
      endKnot = knots.length - 1 - startKnot;

      for (let i = 0; i < degree; ++i) {
        controlPoints.push(controlPoints[i] as Vector4);
      }
    }

    const curve = new NURBSCurve(degree, knots, controlPoints, startKnot, endKnot);
    const points = curve.getPoints(controlPoints.length * 12);

    return {
      geometry: new BufferGeometry().setFromPoints(points),
      modelInfo: { polygons: 0, quads: 0, triangles: 0, vertices: points.length },
    };
  }
}
