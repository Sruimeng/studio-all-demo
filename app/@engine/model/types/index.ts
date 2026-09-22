// SDK 无关 Model v3 合同：双身份、单内容与受控展示；平台和工具仅通过这些公开边界接线。

import type { Material, Mesh, Object3D, ToneMapping, Vector2, Vector3 } from 'three';
import type { Pass } from 'three/addons/postprocessing/Pass.js';
import type { ShallowRef } from 'vue';
/** Model Status 合同；由声明所属内容或会话管理生命周期。 */
export const ModelStatus = { Disposed: 'disposed', Empty: 'empty', Error: 'error', Loading: 'loading', Ready: 'ready' } as const;
/** Model Status 合同；由声明所属内容或会话管理生命周期。 */
export type ModelStatus = typeof ModelStatus[keyof typeof ModelStatus];
/** Model Access 合同；由声明所属内容或会话管理生命周期。 */
export const ModelAccess = { Editable: 'editable', ReadOnly: 'read-only' } as const;
/** Model Access 合同；由声明所属内容或会话管理生命周期。 */
export type ModelAccess = typeof ModelAccess[keyof typeof ModelAccess];
/** Model ResultKind 合同；由声明所属内容或会话管理生命周期。 */
export const ModelResultKind = { Applied: 'applied', Disposed: 'disposed', Failed: 'failed', Stored: 'stored', Superseded: 'superseded' } as const;
/** Model ResultKind 合同；由声明所属内容或会话管理生命周期。 */
export type ModelResultKind = typeof ModelResultKind[keyof typeof ModelResultKind];
/** Model ChangeKind 合同；由声明所属内容或会话管理生命周期。 */
export const ModelChangeKind = { Spatial: 'spatial', Structure: 'structure' } as const;
/** Model ChangeKind 合同；由声明所属内容或会话管理生命周期。 */
export type ModelChangeKind = typeof ModelChangeKind[keyof typeof ModelChangeKind];
/** Model FailureStage 合同；由声明所属内容或会话管理生命周期。 */
export const ModelFailureStage = { Cleanup: 'cleanup', Content: 'content', Input: 'input', Presentation: 'presentation', Source: 'source' } as const;
/** Model FailureStage 合同；由声明所属内容或会话管理生命周期。 */
export type ModelFailureStage = typeof ModelFailureStage[keyof typeof ModelFailureStage];
/** Model ObjectParent 合同；由声明所属内容或会话管理生命周期。 */
export const ModelObjectParent = { Content: 'content', Scene: 'scene' } as const;
/** Model ObjectParent 合同；由声明所属内容或会话管理生命周期。 */
export type ModelObjectParent = typeof ModelObjectParent[keyof typeof ModelObjectParent];
/** Model PointerKind 合同；由声明所属内容或会话管理生命周期。 */
export const ModelPointerKind = { Cancel: 'cancel', Click: 'click', Down: 'down', Leave: 'leave', Missed: 'missed', Move: 'move', Up: 'up' } as const;
/** Model PointerKind 合同；由声明所属内容或会话管理生命周期。 */
export type ModelPointerKind = typeof ModelPointerKind[keyof typeof ModelPointerKind];
/** Model ReleaseReason 合同；由声明所属内容或会话管理生命周期。 */
export const ModelReleaseReason = { ContextChanged: 'context-changed', EngineDisposed: 'engine-disposed', Failed: 'failed', Released: 'released', Replaced: 'replaced' } as const;
/** Model ReleaseReason 合同；由声明所属内容或会话管理生命周期。 */
export type ModelReleaseReason = typeof ModelReleaseReason[keyof typeof ModelReleaseReason];
// 同名值类型一律 typeof 对象[keyof typeof 对象]，状态结构继续判别联合。
declare const modelContentIdBrand: unique symbol;
declare const modelTokenBrand: unique symbol;
/** Model ContentId 合同；由声明所属内容或会话管理生命周期。 */
export interface ModelContentId {
  readonly [modelContentIdBrand]: true;
}
/** Model Token 合同；由声明所属内容或会话管理生命周期。 */
export interface ModelToken {
  readonly [modelTokenBrand]: true;
}
/** 固定资源及准备版本；签名 URL 和编辑数据版本不作内容身份。 */
export interface ModelSourceKey {
  readonly id: string;
  readonly revision: number;
}
/** 调用 bind 前归准备过程，调用后所有权交给 runtime。 */
export interface ModelPreparedContent<I> {
  readonly info: I;
  readonly root: Object3D;
}
/** 封装下载与准备，不从控制器读取业务状态。 */
export interface ModelSource<I> {
  readonly key: ModelSourceKey;
  /** 准备阶段返回独占结果；异步期间检查 signal，尚未移交的失败资源由准备方清理。 */
  prepare(signal: AbortSignal): Promise<ModelPreparedContent<I>>;
}
/** 有效所有权内借用的 Three 内容，禁止异步 reader。 */
export interface ModelContentView<I> {
  readonly info: I;
  readonly meshes: readonly Mesh[];
  readonly root: Object3D;
}
/** 当前内容的 CPU 事实；两个公开状态引用同一份描述。 */
export interface ModelContentSnapshot<I> {
  readonly context: symbol;
  readonly id: ModelContentId;
  readonly info: I;
  readonly sourceKey: ModelSourceKey;
}
/** Model Current 合同；由声明所属内容或会话管理生命周期。 */
export interface ModelCurrent<I> {
  readonly access: ModelAccess;
  readonly content: ModelContentSnapshot<I>; // 引用同一Content描述，不复制状态
  readonly token: ModelToken;
}
/** Model State 合同；由声明所属内容或会话管理生命周期。 */
export type ModelState<I> = {
  readonly status: typeof ModelStatus.Empty | typeof ModelStatus.Loading | typeof ModelStatus.Disposed;
} | {
  readonly current: ModelCurrent<I>;
  readonly status: typeof ModelStatus.Ready;
} | {
  readonly failure: ModelFailure;
  readonly status: typeof ModelStatus.Error;
};
/** Model Failure 合同；由声明所属内容或会话管理生命周期。 */
export interface ModelFailure {
  readonly error: Error;
  readonly stage: ModelFailureStage;
}
/** Model Result 合同；由声明所属内容或会话管理生命周期。 */
export type ModelResult = {
  readonly kind: typeof ModelResultKind.Applied;
  readonly token: ModelToken;
} | {
  readonly kind: typeof ModelResultKind.Stored | typeof ModelResultKind.Superseded | typeof ModelResultKind.Disposed;
} | {
  readonly failure: ModelFailure;
  readonly kind: typeof ModelResultKind.Failed;
};
/** Model Request 合同；由声明所属内容或会话管理生命周期。 */
export interface ModelRequest<P, I, V> {
  readonly context: symbol;
  readonly params: P;
  readonly presentation: ModelPresentation<P, I, V>;
  readonly source: ModelSource<I>;
}
/** Model Lease 合同；由声明所属内容或会话管理生命周期。 */
export interface ModelLease<P, I, V> {
  /** 原子更新本 lease 的 Source 与参数；旧 lease 返回 Superseded，同源复用内容。 */
  present(source: ModelSource<I>, params: P): Promise<ModelResult>;
  readonly ready: Promise<ModelResult>;
  /** 幂等释放本 owner；解除绑定后清资源，不等待 default 的下一次下载。 */
  release(): Promise<void>;
  /** 同步参数更新不换 ContentId/token；准备中更新最新意图，更新异常退出显示并保内容。 */
  update(params: P): Promise<ModelResult>;
  readonly view: Readonly<ShallowRef<V | null>>;
}
/** 每个运行时唯一控制面；默认描述只表示恢复目标。 */
export interface ModelApi<I> {
  /** 仅 Ready 返回当前展示 token；Loading、Error、终态返回 null。 */
  capture(): ModelToken | null;
  /** 捕获当前有效 ContentId；显示切换保留，内容逻辑退役后返回 null。 */
  captureContent(): ModelContentId | null;
  /** 仅当前 context 生效；同步逻辑撤权，Promise 等本次实际准备与安全点清理。 */
  clear(context: symbol): Promise<void>;
  /** 永久关闭；先同步撤权，再等真实任务和安全点清理，重入返回同一 Promise。 */
  close(): Promise<void>;
  readonly content: Readonly<ShallowRef<ModelContentSnapshot<I> | null>>;
  /** 检查当前 id 的 context/key 是否匹配最新基础描述；与提供者、访问模式无关。 */
  matchesDefaultContent(id: ModelContentId): boolean;
  /** 登记同步数据清理，解绑后、原生释放前每个 id 一次；返回幂等注销函数，异常逐项隔离。 */
  onContentRelease(handler: (content: ModelContentSnapshot<I>, reason: ModelReleaseReason) => undefined): () => void;
  /** 在已接纳 context 取得唯一主 lease；非法输入由 ready 报告且不撤旧会话。 */
  open<P, V>(request: ModelRequest<P, I, V>): ModelLease<P, I, V>;
  /** 以当前展示 token 同步借用；过期、async 或 thenable reader 均拒绝。 */
  read<T>(token: ModelToken, reader: ModelSyncReader<T, I>): T;
  /** 以当前 ContentId 同步借用；不授予编辑权限，终态和旧 id 抛 AbortError。 */
  readContent<T>(id: ModelContentId, reader: ModelSyncReader<T, I>): T;
  /** Spatial 刷新共同快照；Structure 保 id/lease 重建显示，新结果由 state 表达。 */
  refreshContent(id: ModelContentId, kind: ModelChangeKind): void;
  /** 宿主同步接纳 context 与恢复描述；同 context 工具活动时返回 Stored，失败由结果报告。 */
  setDefault<P, V>(request: ModelRequest<P, I, V>): Promise<ModelResult>;
  readonly state: Readonly<ShallowRef<ModelState<I>>>;
}
/** Model SyncReader 合同；由声明所属内容或会话管理生命周期。 */
export type ModelSyncReader<T, I> = (view: ModelContentView<I>) => T & (T extends PromiseLike<unknown> ? never : unknown);
/** Model MaterialBinding 合同；由声明所属内容或会话管理生命周期。 */
export interface ModelMaterialBinding {
  readonly material: Material | readonly Material[];
  readonly mesh: Mesh;
}
/** Model RenderSettings 合同；由声明所属内容或会话管理生命周期。 */
export interface ModelRenderSettings {
  readonly toneMapping?: ToneMapping;
}
/** 一次原子校验的完整外观意图，材料与设置一起替换。 */
export interface ModelAppearance {
  readonly materials: readonly ModelMaterialBinding[];
  readonly renderSettings: Readonly<ModelRenderSettings>;
}
/** 会话撤权与私有清理登记；取消信号不提前释放仍绑定的材质。 */
export interface ModelPresentationScope {
  /** 登记会话私有清理；返回执行并注销的幂等 off，scope 已结束则立即执行，thenable 拒绝。 */
  defer(cleanup: () => undefined): () => void; // 执行一次且移除登记，不留下历史资源闭包
  /** 只有当前 Ready 会话为 true，供 frame/pointer 每项执行前守卫。 */
  isActive(): boolean; // 已提交且当前可执行的会话
  /** 当前 Preparing/Committing/Active 的记录为 true；退休后永久 false。 */
  isCurrent(): boolean; // 当前有效准备或活跃会话
  readonly signal: AbortSignal;
}
/** Model PresentationContext 合同；由声明所属内容或会话管理生命周期。 */
export interface ModelPresentationContext<I> {
  readonly content: ModelContentView<I>;
  readonly contentId: ModelContentId;
  readonly platform: ModelPresentationPlatform;
  /** 准备中只登记完整意图；提交后全量校验再同步更新，旧 scope 返回 false，非法输入抛错。 */
  replaceAppearance(appearance: ModelAppearance): boolean;
  readonly scope: ModelPresentationScope;
}
/** Model PresentationSession 合同；由声明所属内容或会话管理生命周期。 */
export interface ModelPresentationSession<P, V> {
  /** 同步进入提交/启用所组合能力；失败必须由原 owner 的退役路径清理已接管部分。 */
  activate(): undefined;
  /** 同步逆序停止本会话行为；不释放借用的 Content 或 ToolData，未激活的迟到会话也须可退出。 */
  deactivate(reason: ModelReleaseReason): undefined;
  /** 同步参数更新不换 ContentId/token；准备中更新最新意图，更新异常退出显示并保内容。 */
  update(params: Readonly<P>): undefined;
  readonly view: V;
}
/** Model Presentation 合同；由声明所属内容或会话管理生命周期。 */
export interface ModelPresentation<P, I, V> {
  readonly access: ModelAccess;
  readonly name: string;
  /** 准备阶段返回独占结果；异步期间检查 signal，尚未移交的失败资源由准备方清理。 */
  prepare(context: ModelPresentationContext<I>, params: Readonly<P>): ModelPresentationSession<P, V> | Promise<ModelPresentationSession<P, V>>;
  /** 接纳命令前同步复制并校验参数；抛错时不破坏当前内容或展示。 */
  snapshotParams(params: P): Readonly<P>;
}
/** Model Frame 合同；由声明所属内容或会话管理生命周期。 */
export interface ModelFrame {
  readonly delta: number;
  readonly elapsed: number;
} // 秒
/** Model Pointer 合同；由声明所属内容或会话管理生命周期。 */
export interface ModelPointer {
  readonly altKey: boolean;
  readonly button: number;
  readonly buttons: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly ctrlKey: boolean;
  readonly hit: null | {
    readonly faceIndex: number | null;
    readonly normal: Vector3 | null;
    readonly object: Mesh;
    readonly point: Vector3;
    readonly uv: Vector2 | null;
  };
  readonly kind: ModelPointerKind;
  readonly metaKey: boolean;
  readonly pointerId: number;
  /** 同步阻止当前原始输入默认行为，不允许跨异步保留该回调。 */
  preventDefault(): void;
  readonly shiftKey: boolean;
}
/** Model OwnedResource 合同；由声明所属内容或会话管理生命周期。 */
export interface ModelOwnedResource {
  /** 同步释放自身拥有资源；不得释放借用物，调用方保证解绑后调用且 owner 幂等。 */
  dispose(): void;
}
/** Model ObjectBinding 合同；由声明所属内容或会话管理生命周期。 */
export interface ModelObjectBinding {
  /** 仅当前 Committing/Active 可挂载，失效或 preparing 返回 false。 */
  mount(): boolean;
  /** 幂等释放本 owner；解除绑定后清资源，不等待 default 的下一次下载。 */
  release(): void;
  /** 仅摘离对象，保留原 owner 的资源以供后续 release。 */
  unmount(): void;
}
/** 绑定会话权限的平台端口；仅 runtime 负责 SDK 差异。 */
export interface ModelPresentationPlatform {
  /** 平台接管 Pass 注册与释放；off 幂等注销后 dispose，模块不得另行重复释放。 */
  addPass(pass: Pass): () => void;
  /** 登记仅当前 Active 执行的帧回调，单位秒；返回幂等 off，帧内不拆资源。 */
  onFrame(handler: (frame: ModelFrame) => undefined): () => void;
  /** 登记当前Active输入；needsHit仅控制射线计算，不阻止原始终止事件分发。 */
  onPointer(kind: ModelPointerKind, handler: (event: ModelPointer) => boolean, options?: { needsHit?: boolean | (() => boolean) }): () => void;
  /** 调用即接管列出的 ownedResources；借用 geometry/texture 不列入，prepare 中不挂载。 */
  prepareObject(input: {
    object: Object3D;
    ownedResources: readonly ModelOwnedResource[];
    parent: ModelObjectParent;
  }): ModelObjectBinding;
  /**
   * Active 期借用当前 Canvas 光标；不暴露 DOM，失效声明无操作，正常取消不抛错。
   * @param cursor pointer 声明可交互；null 在任意阶段幂等归还，不覆盖外部改写的不同值。
   * @returns 无返回值；Leave、abort、窗口失焦及平台退出均归还当前借用，按键和点选不干预。
   */
  setCursor(cursor: 'pointer' | null): void;
  /** 借用相机控制权并返回幂等归还函数；旧 off 不解除新借用。 */
  suspendCamera(): () => void;
}
/** Model BehaviorContext 合同；由声明所属内容或会话管理生命周期。 */
export type ModelBehaviorContext<I> = Pick<ModelPresentationContext<I>, 'contentId' | 'content' | 'scope' | 'platform'>;
/** Model Behavior 合同；由声明所属内容或会话管理生命周期。 */
export interface ModelBehavior<P> {
  /** 同步进入提交/启用所组合能力；失败必须由原 owner 的退役路径清理已接管部分。 */
  activate(): undefined;
  /** 同步逆序停止本会话行为；不释放借用的 Content 或 ToolData，未激活的迟到会话也须可退出。 */
  deactivate(reason: ModelReleaseReason): undefined;
  /** 同步参数更新不换 ContentId/token；准备中更新最新意图，更新异常退出显示并保内容。 */
  update(params: Readonly<P>): undefined;
}
/** 内容句柄持有源材料及实体；展示归还绑定后才允许释放。 */
export interface ModelRuntimeContent<I> {
  /** 同步释放自身拥有资源；不得释放借用物，调用方保证解绑后调用且 owner 幂等。 */
  dispose(): undefined;
  /** 仅摘离唯一主根，不释放或建立备用模型。 */
  hide(): undefined;
  /** 同步恢复全部源材质槽位，含 detached Mesh；不得顺便释放源资源。 */
  normalizeMaterials(): undefined;
  /** 同步重算并返回权威 view；平台的 view 读取同时指向最新数据。 */
  refresh(kind: ModelChangeKind): ModelContentView<I>;
  /** 只挂载当前唯一根，不提前广播 Ready/load。 */
  show(): undefined;
  readonly view: ModelContentView<I>;
}
/** 平台会话先提交，再在退出时 detach 后 dispose。 */
export interface ModelRuntimePresentation {
  /** 同步进入提交/启用所组合能力；失败必须由原 owner 的退役路径清理已接管部分。 */
  activate(): undefined;
  /** 完整设置意图；省略项恢复当前平台 baseline，仅当前提交 owner 可写。 */
  applyRenderSettings(settings: Readonly<ModelRenderSettings>): undefined;
  /** 同步停回调、摘 helper/Pass 并归还 camera/设置；不先释放仍绑定材质。 */
  detach(): undefined; // 停回调/摘helper和Pass/归还camera及renderer基线，不先dispose仍绑定的材质
  /** 同步释放自身拥有资源；不得释放借用物，调用方保证解绑后调用且 owner 幂等。 */
  dispose(): undefined; // detach后释放端口拥有资源
  readonly platform: ModelPresentationPlatform;
}
/** 唯一平台所有权边界；bind 调用即接管，清理须经过整帧安全点。 */
export interface ModelRuntime<I> {
  /** 无活动帧时同步执行；帧内排至整个 native/composer 栈退出，不能等下一次 RAF 或丢弃动作。 */
  afterCurrentFrame(action: () => undefined): void;
  /** 调用即接管 prepared；失败/abort/部分创建由 runtime 清理，返回完整未发布句柄。 */
  bind(prepared: ModelPreparedContent<I>, key: ModelSourceKey, signal: AbortSignal): Promise<ModelRuntimeContent<I>>;
  /** 同步建立绑定 scope 的平台记录；准备期不物理挂载，构造异常须自行清局部资源。 */
  createPresentation(scope: ModelPresentationScope, content: ModelRuntimeContent<I>): ModelRuntimePresentation;
  /** 只释放从未调用 bind 的结果；不可访问 renderer 或重复清已移交结果。 */
  discard(prepared: ModelPreparedContent<I>): undefined;
}
