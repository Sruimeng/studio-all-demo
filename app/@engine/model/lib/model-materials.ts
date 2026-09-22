// 当前展示的材质登记与完整恢复；只管理绑定，不取得源材质或工具私有材质的释放权。

import { ACESFilmicToneMapping, AgXToneMapping, CineonToneMapping, CustomToneMapping, LinearToneMapping, type Material, type Mesh, NeutralToneMapping, NoToneMapping, ReinhardToneMapping } from 'three';
import type { ModelAppearance, ModelMaterialBinding } from '../types';
/** 源数组 identity 与全部槽位分别保留，后续数组原位修改也能完整恢复。 */
export interface ModelSourceMaterialBinding {
  readonly material: Material | Material[];
  readonly mesh: Mesh;
  readonly slots: readonly Material[] | null;
}
/**
 * 在任何 ECS 安装或显示替换前捕获完整源绑定，不取得资源释放权。
 * @param meshes 当前内容全部 Mesh，含之后可能 detach 的节点。
 * @returns 只属于当前 Content 的源绑定快照。
 */
export function captureModelMaterials(meshes: readonly Mesh[]): readonly ModelSourceMaterialBinding[] {
  return [...new Set(meshes)].map(mesh => ({
    material: mesh.material,
    mesh,
    slots: Array.isArray(mesh.material) ? [...mesh.material] : null,
  }));
}
/**
 * 恢复源绑定与原数组槽位，所有节点都尝试后才报告失败。
 * @param bindings Content 创建时捕获的记录，不能由当前显示材料重新推断。
 * @throws AggregateError 一个节点失败不跳过其余恢复。
 */
export function restoreModelMaterials(bindings: readonly ModelSourceMaterialBinding[]): void {
  const failures: unknown[] = [];
  for (const binding of bindings) {
    try {
      const material = binding.material;
      if (binding.slots && Array.isArray(material)
        && (material.length !== binding.slots.length || binding.slots.some((slot, index) => material[index] !== slot))) {
        material.splice(0, material.length, ...binding.slots);
      }
      binding.mesh.material = binding.material;
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(failures, 'Model source material restoration failed');
}
/** 一个展示独占的材质绑定表，生命周期由 Model controller 驱动。 */
export interface ModelMaterials {
  /** 将已登记绑定提交到 Mesh，原材质仅在首次写入前保存。 */
  apply(canWrite?: () => boolean): void;
  /** 原子替换待应用的绑定集合；输入数组会复制，prepare 时不改 Mesh。 */
  record(bindings: readonly ModelMaterialBinding[]): void;
  /** 尽力恢复所有原始绑定；重复恢复无副作用，错误在全部尝试后报告。 */
  restore(): void;
}
/** 校验并复制工具提供的材质值，避免准备完成前外部数组修改影响提交。 */
function copyMaterial(value: ModelMaterialBinding['material']): Material | Material[] {
  /** Three 的材质标记允许跨构建实例识别，不依赖 instanceof。 */
  const isMaterial = (material: unknown): material is Material => typeof material === 'object' && material !== null && (material as Material).isMaterial === true;
  if (Array.isArray(value)) {
    if (!value.length || !value.every(isMaterial))
      throw new TypeError('Model material array contains an invalid material');
    return [...value];
  }
  if (!isMaterial(value))
    throw new TypeError('Model material binding requires a Material');
  return value;
}
/**
 * 完整校验材料和 renderer 意图再复制，非法设置不会在换材后才发现。
 * @param appearance 提供者的全量意图；空 materials/settings 用于恢复。
 * @param meshes 允许操作的当前 Content Mesh。
 * @returns 不受调用方后续数组改动影响的固定意图。
 * @throws TypeError 非法材料、设置或跨 Content 绑定均在修改前拒绝。
 */
export function copyModelAppearance(appearance: ModelAppearance, meshes: readonly Mesh[]): ModelAppearance {
  if (!appearance || !Array.isArray(appearance.materials) || !appearance.renderSettings
    || typeof appearance.renderSettings !== 'object')
    throw new TypeError('Model appearance is invalid');
  const settings = appearance.renderSettings;
  const supported = [NoToneMapping, LinearToneMapping, ReinhardToneMapping, CineonToneMapping, ACESFilmicToneMapping, CustomToneMapping, AgXToneMapping, NeutralToneMapping];
  if (Object.keys(settings).some(key => key !== 'toneMapping')
    || (settings.toneMapping !== undefined && !supported.includes(settings.toneMapping))) {
    throw new TypeError('Model render settings are invalid');
  }
  const allowed = new Set(meshes);
  const seen = new Set<Mesh>();
  const materials = appearance.materials.map((binding) => {
    if (!allowed.has(binding.mesh))
      throw new TypeError('Model material binding targets another content');
    if (seen.has(binding.mesh))
      throw new TypeError('Model material binding contains a duplicate mesh');
    seen.add(binding.mesh);
    return { material: copyMaterial(binding.material), mesh: binding.mesh };
  });
  return { materials, renderSettings: settings.toneMapping === undefined ? {} : { toneMapping: settings.toneMapping } };
}
/**
 * 为当前 Content 建立一次展示的材质表。
 * @param meshes 可被本会话绑定的当前内容 Mesh；禁止绑定其他内容。
 * @returns 只登记、提交、恢复绑定的内部能力。
 * @throws record 输入无效或实际 Mesh 写入失败时报告错误。
 */
export function createModelMaterials(meshes: readonly Mesh[]): ModelMaterials {
  // 成员身份固定，不能借材质接口写到别的 Content。
  const allowed = new Set(meshes);
  // 下一次提交的完整绑定集合，保持工具登记顺序。
  let desired = new Map<Mesh, Material | Material[]>();
  // 原始数组本身也要恢复，不能只还原第一个槽位。
  const originals = new Map<Mesh, Material | Material[]>();
  /** 对全量恢复错误统一报告，不让首个 setter 失败跳过其他 Mesh。 */
  function restoreEntries(entries: readonly (readonly [
    Mesh,
        Material | Material[],
  ])[]): void {
    // 当前恢复批次的错误，不跨会话保存。
    const failures: unknown[] = [];
    for (const [mesh, material] of entries) {
      originals.delete(mesh);
      try {
        mesh.material = material;
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length)
      throw new AggregateError(failures, 'Model material restoration failed');
  }
  return {
    /** 先恢复被移除的绑定，再提交最新登记；中途失败仍留下可恢复的完整原值。 */
    apply(canWrite = () => true) {
      // 已不再属于本次完整绑定集合的 Mesh 应恢复源值。
      const removed = [...originals].filter(([mesh]) => !desired.has(mesh));
      restoreEntries(removed);
      for (const [mesh, material] of desired) {
        // 公开 setter 可能同步关闭会话，不能继续写后继 Mesh。
        if (!canWrite())
          return;
        if (!originals.has(mesh))
          originals.set(mesh, mesh.material);
        mesh.material = material;
      }
    },
    /** 验证全部输入后才替换待提交集合，非法输入不破坏已有登记。 */
    record(bindings) {
      // 独立候选表避免部分输入合法、部分非法时留下半份计划。
      const next = new Map<Mesh, Material | Material[]>();
      for (const binding of bindings) {
        if (!allowed.has(binding.mesh))
          throw new TypeError('Model material binding targets another content');
        if (next.has(binding.mesh))
          throw new TypeError('Model material binding contains a duplicate mesh');
        next.set(binding.mesh, copyMaterial(binding.material));
      }
      desired = next;
    },
    /** 先移交恢复记录，用户 setter 重入 restore 时不会重复执行。 */
    restore() {
      // 保存当前全部绑定，以原数组 identity 恢复。
      const entries = [...originals];
      originals.clear();
      desired.clear();
      restoreEntries(entries);
    },
  };
}
