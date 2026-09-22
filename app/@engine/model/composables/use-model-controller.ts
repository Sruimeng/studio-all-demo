// SDK 无关的单内容控制器：双身份与单一发布，实际准备串行，物理退出经平台安全点。

import { getCurrentScope, onScopeDispose, shallowReadonly, shallowRef, type ShallowRef, toRef } from 'vue';
import { ModelAccess, type ModelApi, type ModelAppearance, ModelChangeKind, type ModelContentId, type ModelContentSnapshot, type ModelContentView, type ModelFailure, ModelFailureStage, type ModelLease, type ModelPreparedContent, type ModelPresentation, type ModelPresentationContext, type ModelPresentationScope, type ModelPresentationSession, ModelReleaseReason, type ModelRequest, type ModelResult, ModelResultKind, type ModelRuntime, type ModelRuntimeContent, type ModelRuntimePresentation, type ModelSource, type ModelSourceKey, type ModelState, ModelStatus, type ModelSyncReader, type ModelToken } from '../types';
import { copyModelAppearance, createModelMaterials, type ModelMaterials } from '../lib/model-materials';
/** 幂等命令结算，不让旧任务的迟到结果覆盖 Superseded。 */
interface Completion<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}
/** 已校验的请求；只在这个私有边界擦除提供者参数和 view 的泛型。 */
interface Intent<I> {
  context: symbol;
  definition: object;
  lease: LeaseRecord<I> | null;
  params: Readonly<unknown>;
  presentation: ModelPresentation<unknown, I, unknown>;
  result: Completion<ModelResult>;
  source: ModelSource<I>;
  sourceKey: ModelSourceKey;
}
/** 工具拥有的主展示权，不持有一棵备用模型。 */
interface LeaseRecord<I> {
  active: boolean;
  request: Intent<I>;
}
/** 平台内容与逻辑身份；失效后仍可暂存到安全点，只用于清理。 */
interface ContentRecord<I> {
  adopted: boolean;
  available: boolean;
  disposed: boolean;
  handle: ModelRuntimeContent<I>;
  reason: ModelReleaseReason;
  refresh?: ModelChangeKind;
  snapshot: ModelContentSnapshot<I>;
  view: ModelContentView<I>;
}
/** prepare 前即存在的记录，使 partial prepare 也有可关闭的资源 owner。 */
interface PresentationRecord<I> {
  appearance: ModelAppearance;
  cleanups: Set<() => void>;
  content: ContentRecord<I>;
  controller: AbortController;
  deactivated: boolean;
  intent: Intent<I>;
  materials: ModelMaterials;
  phase: 'preparing' | 'committing' | 'active' | 'retiring';
  reason: ModelReleaseReason;
  retired: boolean;
  runtime?: ModelRuntimePresentation;
  scopeClosed: boolean;
  session?: ModelPresentationSession<unknown, unknown>;
  token?: ModelToken;
}
/** 唯一实际等待；取消 signal 不等于这个 Promise 已结束。 */
interface Work {
  context: symbol;
  controller: AbortController;
  done: Completion<undefined>;
  key: ModelSourceKey;
  kind: 'content' | 'presentation';
}
/** content/state/lease.view 都从这一次提交派生，避免两个 ref 分步发布。 */
interface Publication<I> {
  content: ModelContentSnapshot<I> | null;
  lease: LeaseRecord<I> | null;
  state: ModelState<I>;
  view: unknown | null;
}
/** 创建单次结算，Promise identity 不随重入改变。 */
function completion<T>(): Completion<T> {
  let resolve!: (value: T) => void;
  let settled = false;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve(value) {
    if (!settled) {
      settled = true;
      resolve(value);
    }
  } };
}
/** 统一错误对象，保留非 Error 原始值。 */
function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error), { cause: error });
}
/** 拒绝 thenable；错误异步函数的迟到拒绝被观察，避免额外未处理拒绝。 */
function assertSync(value: unknown, label: string): void {
  if (value !== null && (typeof value === 'object' || typeof value === 'function')
    && typeof (value as PromiseLike<unknown>).then === 'function') {
    void Promise.resolve(value).catch(() => undefined);
    throw new TypeError(`${label} must be synchronous`);
  }
}
/** 资源定位 URL 不参与比较，只有固定准备身份参与复用。 */
function sameKey(left: ModelSourceKey, right: ModelSourceKey): boolean {
  return left.id === right.id && left.revision === right.revision;
}
/** 借用已经过期时明确拒绝，不返回上一个内容。 */
function aborted(): DOMException {
  return new DOMException('Model content or presentation is no longer current', 'AbortError');
}
/** 无缓存的只读投影，共享 publication 的同一次读取，不深代理 info/view/Three。 */
function projection<T>(getter: () => T): Readonly<ShallowRef<T>> {
  return shallowReadonly(toRef(getter));
}
/** 实例私有的调度和所有权状态；类不导出，也不作为 SDK System 使用。 */
class ModelController<I> {
  /** 唯一可观察写端，所有公开 ref 均为其只读投影。 */
  private readonly publication = shallowRef<Publication<I>>({ content: null, lease: null, state: { status: ModelStatus.Empty }, view: null });
  /** 平台只注入一次，不依赖具体工具。 */
  private readonly runtime: ModelRuntime<I>;
  /** 页面/账号/项目/operator 权限范围。 */
  private context?: symbol;
  /** 仅 CPU 描述的默认恢复目标。 */
  private defaults?: Intent<I>;
  /** 最后接受的完整目标，来源任务可跨不同命令复用。 */
  private desired?: Intent<I>;
  /** 当前唯一主工具 lease。 */
  private lease?: LeaseRecord<I>;
  /** 当前可借用的唯一内容。 */
  private content?: ContentRecord<I>;
  /** 当前准备、提交或活跃会话。 */
  private presentation?: PresentationRecord<I>;
  /** 已逻辑退出、等待安全点物理收尾的旧记录。 */
  private readonly retiredPresentations = new Set<PresentationRecord<I>>();
  /** 不再对外可借用的内容，等待展示解绑后释放。 */
  private readonly retiredContents = new Set<ContentRecord<I>>();
  /** 内容释放订阅只清各模块自己持有的数据。 */
  private readonly releaseHandlers = new Set<(content: ModelContentSnapshot<I>, reason: ModelReleaseReason) => undefined>();
  /** 一个实际 source/bind 或 presentation prepare，不以取消伪装结束。 */
  private work?: Work;
  /** 已排队的物理安全点，close/release 必须等待。 */
  private readonly exits = new Set<Promise<void>>();
  /** 清理错误留给发起退出的调用者；不覆盖后继目标状态。 */
  private readonly cleanupErrors: Error[] = [];
  /** 当前有效目标的错误，可保留唯一 Content 和数据。 */
  private failure?: ModelFailure;
  /** 终态先于任何响应式通知和外部回调生效。 */
  private closed = false;
  /** Source worker 的微任务合并与互斥。 */
  private scheduled = false;
  private draining = false;
  /** 正在执行外部同步回调时不内层抢先销毁其仍使用的对象。 */
  private callbackDepth = 0;
  /** 物理清理自身不可重入，只允许排队新的退休记录。 */
  private flushing = false;
  /** 至多一个待执行安全点。 */
  private exitPending = false;
  /** 输入 snapshotParams 同步重入时保护最后一个命令。 */
  private commandSequence = 0;
  /** 重复 close，包括 callback 内重入，始终同一个 Promise。 */
  private closePromise?: Promise<void>;
  /** 对外只提供稳定门面，没有私有句柄泄漏。 */
  readonly api: ModelApi<I>;
  /** 构造只建立依赖和只读状态，不启动下载或创建 GPU 资源。 */
  constructor(runtime: ModelRuntime<I>) {
    this.runtime = runtime;
    this.api = {
      capture: () => this.capture(),
      captureContent: () => this.captureContent(),
      clear: context => this.clear(context),
      close: () => this.close(),
      content: projection(() => this.publication.value.content),
      matchesDefaultContent: id => this.matchesDefaultContent(id),
      onContentRelease: handler => this.onContentRelease(handler),
      open: request => this.open(request),
      read: (token, reader) => this.read(token, reader),
      readContent: (id, reader) => this.readContent(id, reader),
      refreshContent: (id, kind) => this.refreshContent(id, kind),
      setDefault: request => this.setDefault(request),
      state: projection(() => this.publication.value.state),
    };
  }

  /** 在外部回调结束后才尝试物理退出；回调中的 close 可立即逻辑撤权。 */
  private critical<T>(callback: () => T): T {
    this.callbackDepth += 1;
    try {
      return callback();
    } finally {
      this.callbackDepth -= 1;
      this.scheduleExit();
    }
  }

  /** 同步生命周期不能偷偷延长资源借用到 await 之后。 */
  private call(callback: () => unknown, label: string): void {
    this.critical(() => assertSync(callback(), label));
  }

  /** 清理逐项隔离，不能把旧清理错误写成新目标的 Error。 */
  private cleanup(callback: () => unknown): void {
    try {
      this.call(callback, 'Model cleanup');
    } catch (error) {
      this.cleanupErrors.push(asError(error));
    }
  }

  /** 所有对外事实在一次 publication 更新中产生。 */
  private publishState(): void {
    const content = this.content?.available ? this.content.snapshot : null;
    const record = this.presentation;
    const ready = !this.closed && record?.token && !record.retired && record.phase === 'active' && content;
    const state: ModelState<I> = this.closed
      ? { status: ModelStatus.Disposed }
      : ready
        ? { current: Object.freeze({ access: record.intent.presentation.access, content, token: record.token! }), status: ModelStatus.Ready }
        : this.failure
          ? { failure: Object.freeze(this.failure), status: ModelStatus.Error }
          : { status: this.desired ? ModelStatus.Loading : ModelStatus.Empty };
    this.publication.value = Object.freeze({ content, lease: ready ? record.intent.lease : null, state: Object.freeze(state), view: ready ? record.session!.view : null });
  }

  /** 仅完成参数校验和冻结，不在失败前动旧内容。 */
  private makeIntent<P, V>(request: ModelRequest<P, I, V>, lease: LeaseRecord<I> | null): Intent<I> {
    if (typeof request?.context !== 'symbol')
      throw new TypeError('Model context must be a symbol');
    const key = request.source?.key;
    if (!key || typeof key.id !== 'string' || !key.id || !Number.isSafeInteger(key.revision) || key.revision < 0
      || typeof request.source.prepare !== 'function')
      throw new TypeError('Model source is invalid');
    const definition = request.presentation;
    if (!definition || typeof definition.prepare !== 'function' || typeof definition.snapshotParams !== 'function'
      || !Object.values(ModelAccess).includes(definition.access))
      throw new TypeError('Model presentation is invalid');
    const params = this.critical(() => definition.snapshotParams(request.params));
    assertSync(params, 'Model snapshotParams');
    const sourceKey = Object.freeze({ id: key.id, revision: key.revision });
    return {
      context: request.context, definition, lease, params,
      presentation: {
        access: definition.access, name: definition.name,
        prepare: definition.prepare.bind(definition), snapshotParams: definition.snapshotParams.bind(definition),
      } as unknown as ModelPresentation<unknown, I, unknown>,
      result: completion<ModelResult>(), source: { key: sourceKey, prepare: request.source.prepare.bind(request.source) }, sourceKey,
    };
  }

  /** 非法输入仅作为单次命令失败，不破坏当前 publication。 */
  private inputFailure(error: unknown): ModelResult {
    return { failure: { error: asError(error), stage: ModelFailureStage.Input }, kind: ModelResultKind.Failed };
  }

  /** 旧命令的 Promise 与权限分别终结。 */
  private supersede(kind: typeof ModelResultKind.Superseded | typeof ModelResultKind.Disposed): void {
    this.desired?.result.resolve({ kind });
  }

  /** 旧 lease 永不因同 key 的后继会话复活。 */
  private revokeLease(): void {
    if (this.lease)
      this.lease.active = false;
    this.lease = undefined;
  }

  /** 内容任务只比较内容身份，不误伤同源的新参数或提供者。 */
  private wants(work: Work): boolean {
    return !this.closed && !work.controller.signal.aborted && this.context === work.context
      && this.desired?.context === work.context && sameKey(this.desired.sourceKey, work.key);
  }

  /** 相同提供者和 lease 才能复用会话；name 不参与授权。 */
  private matchesPresentation(record: PresentationRecord<I>, intent: Intent<I> | undefined): boolean {
    return Boolean(intent && !record.retired && record.content.available
      && record.content.snapshot.context === intent.context && sameKey(record.content.snapshot.sourceKey, intent.sourceKey)
      && record.intent.definition === intent.definition && record.intent.lease === intent.lease);
  }

  /** 先失效会话，再广播 abort；资源直到外层安全点才清理。 */
  private revokePresentation(record: PresentationRecord<I>, reason: ModelReleaseReason): void {
    if (record.retired)
      return;
    record.retired = true;
    record.phase = 'retiring';
    record.reason = reason;
    record.token = undefined;
    if (this.presentation === record)
      this.presentation = undefined;
    this.retiredPresentations.add(record);
    this.cleanup(() => record.controller.abort());
  }

  /** 立即撤销 ContentId 借用，保留内部清理记录不等于缓存备用模型。 */
  private revokeContent(record: ContentRecord<I>, reason: ModelReleaseReason): void {
    if (record.disposed || this.retiredContents.has(record))
      return;
    record.available = false;
    record.reason = reason;
    if (this.content === record)
      this.content = undefined;
    this.retiredContents.add(record);
  }

  /** 同步逻辑收束只选择保留或退休；重入可能改变最后目标。 */
  private reconcile(reason: ModelReleaseReason): void {
    this.critical(() => {
      const record = this.presentation;
      if (record && (this.closed || !this.matchesPresentation(record, this.desired)))
        this.revokePresentation(record, reason);
      const work = this.work;
      if (work && !this.wants(work))
        this.cleanup(() => work.controller.abort());
      const content = this.content;
      const keep = content && !this.closed && content.snapshot.context === this.context
        && ((this.desired && sameKey(content.snapshot.sourceKey, this.desired.sourceKey)) || this.failure);
      if (content && !keep)
        this.revokeContent(content, reason);
      this.publishState();
    });
  }

  /** 只安排一个完整 native frame 之后的物理安全点；非帧平台可同步执行。 */
  private scheduleExit(): void {
    if (this.callbackDepth || this.flushing || this.exitPending)
      return;
    if (!this.retiredPresentations.size && !this.retiredContents.size && !this.content?.refresh)
      return;
    const done = completion<undefined>();
    this.exitPending = true;
    this.exits.add(done.promise);
    try {
      this.runtime.afterCurrentFrame(() => {
        try {
          this.flushExit();
        } catch (error) {
          this.cleanupErrors.push(asError(error));
        } finally {
          this.exitPending = false;
          this.exits.delete(done.promise);
          done.resolve(undefined);
          this.scheduleExit();
        }
        return undefined;
      });
    } catch (error) {
      this.exitPending = false;
      this.exits.delete(done.promise);
      this.cleanupErrors.push(asError(error));
      done.resolve(undefined);
    }
  }

  /** 停止会话登记，后续 defer 立即执行且不会积累历史闭包。 */
  private closeScope(record: PresentationRecord<I>): void {
    record.scopeClosed = true;
    for (const cleanup of [...record.cleanups].reverse())
      this.cleanup(cleanup);
    record.cleanups.clear();
  }

  /** 对已经取得的 Session 至多 deactivate 一次，未 activate 的迟到 Session 也能退役。 */
  private deactivate(record: PresentationRecord<I>): void {
    if (!record.session || record.deactivated)
      return;
    record.deactivated = true;
    this.cleanup(() => record.session!.deactivate(record.reason));
  }

  /** 关键次序：行为→平台解绑→完整源绑定→私有清理→端口资源。 */
  private disposePresentation(record: PresentationRecord<I>): void {
    this.retiredPresentations.delete(record);
    this.deactivate(record);
    if (record.runtime)
      this.cleanup(() => record.runtime!.detach());
    this.cleanup(() => record.materials.restore());
    if (!record.content.disposed)
      this.cleanup(() => record.content.handle.normalizeMaterials());
    this.closeScope(record);
    if (record.runtime)
      this.cleanup(() => record.runtime!.dispose());
  }

  /** 内容数据在显示不再借用之后、原生实体释放之前逐项归还。 */
  private disposeContent(record: ContentRecord<I>): void {
    this.retiredContents.delete(record);
    if (record.disposed)
      return;
    record.disposed = true;
    if (record.adopted) {
      for (const handler of [...this.releaseHandlers]) {
        if (this.releaseHandlers.has(handler))
          this.cleanup(() => handler(record.snapshot, record.reason));
      }
    }
    this.cleanup(() => record.handle.hide());
    this.cleanup(() => record.handle.normalizeMaterials());
    this.cleanup(() => record.handle.dispose());
  }

  /** 同步安全点内先退完所有显示记录，才退内容或执行结构刷新。 */
  private flushExit(): void {
    if (this.flushing)
      return;
    this.flushing = true;
    try {
      while (this.retiredPresentations.size || this.retiredContents.size) {
        for (const record of [...this.retiredPresentations])
          this.disposePresentation(record);
        if (this.retiredPresentations.size)
          continue;
        const content = this.retiredContents.values().next().value;
        if (content)
          this.disposeContent(content);
      }
      this.applyRefresh();
    } finally {
      this.flushing = false;
    }
  }

  /** 输入接受后立即逻辑撤权，真实准备同 tick 合并。 */
  private accept(intent: Intent<I>, reason: ModelReleaseReason = ModelReleaseReason.Replaced): void {
    this.supersede(ModelResultKind.Superseded);
    this.desired = intent;
    this.failure = undefined;
    this.reconcile(reason);
    const record = this.presentation;
    if (record?.token && this.matchesPresentation(record, intent)) {
      this.runtime.afterCurrentFrame(() => {
        if (this.canCommit(record) && this.desired === intent)
          this.updatePresentation(record, intent);
        return undefined;
      });
    } else
      this.schedule();
  }

  /** 新 worker 只从微任务进入，排队期间连续变更只执行最后目标。 */
  private schedule(): void {
    if (this.closed || this.scheduled || this.draining || !this.desired)
      return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      void this.drain();
    });
  }

  /** 有效展示失败保内容；旧目标的失败不能覆盖当前目标。 */
  private fail(intent: Intent<I>, error: unknown, stage: ModelFailureStage): void {
    if (this.closed || this.desired !== intent)
      return;
    this.failure = { error: asError(error), stage };
    this.desired = undefined;
    intent.result.resolve({ failure: this.failure, kind: ModelResultKind.Failed });
    this.reconcile(ModelReleaseReason.Failed);
  }

  /** 后继准备不能越过旧显示/内容的物理退役安全点。 */
  private async waitExits(): Promise<void> {
    while (this.exits.size)
      await Promise.all([...this.exits]);
  }

  /** Source→bind 的转移只发生一次，失败 bind 绝不再次 discard。 */
  private async prepareContent(intent: Intent<I>): Promise<void> {
    const work: Work = { context: intent.context, controller: new AbortController(), done: completion<undefined>(), key: intent.sourceKey, kind: 'content' };
    this.work = work;
    let unbound: ModelPreparedContent<I> | undefined;
    let stage: ModelFailureStage = ModelFailureStage.Source;
    try {
      unbound = await intent.source.prepare(work.controller.signal);
      if (!this.wants(work))
        return;
      if (!unbound?.root?.isObject3D)
        throw new TypeError('Model Source must prepare an Object3D root');
      const prepared = unbound;
      unbound = undefined;
      stage = ModelFailureStage.Content;
      const handle = await this.runtime.bind(prepared, work.key, work.controller.signal);
      const record: ContentRecord<I> = {
        adopted: false, available: false, disposed: false, handle, reason: ModelReleaseReason.Replaced,
        snapshot: Object.freeze({ context: work.context, id: Object.freeze({}) as ModelContentId, info: handle.view.info, sourceKey: work.key }), view: handle.view,
      };
      if (!this.wants(work)) {
        this.revokeContent(record, this.closed ? ModelReleaseReason.EngineDisposed : ModelReleaseReason.Replaced);
        this.scheduleExit();
        return;
      }
      record.adopted = true;
      record.available = true;
      this.content = record;
      this.critical(() => this.publishState());
    } catch (error) {
      const latest = this.desired;
      if (latest && this.wants(work))
        this.fail(latest, error, stage);
    } finally {
      if (unbound)
        this.cleanup(() => this.runtime.discard(unbound!));
      if (this.work === work)
        this.work = undefined;
      work.done.resolve(undefined);
    }
  }

  /** 每个 off 先移出登记再执行，用户重入不会执行两次。 */
  private defer(record: PresentationRecord<I>, callback: () => undefined): () => void {
    let pending: (() => undefined) | undefined = callback;
    /** 移除历史闭包后再进入用户清理。 */
    function off(): void {
      const cleanup = pending;
      pending = undefined;
      record.cleanups.delete(off);
      if (cleanup)
        assertSync(cleanup(), 'Model scope cleanup');
    }
    if (record.scopeClosed)
      off();
    else
      record.cleanups.add(off);
    return off;
  }

  /** 任何显示写入必须属于当前记录，不能仅凭未取消 signal。 */
  private canCommit(record: PresentationRecord<I>): boolean {
    return !this.closed && !record.retired && this.presentation === record && record.content === this.content
      && record.content.available && this.matchesPresentation(record, this.desired);
  }

  /** 已发布且内部 token 一致时才允许平台执行 frame/pointer。 */
  private isActive(record: PresentationRecord<I>): boolean {
    return this.canCommit(record) && record.phase === 'active' && this.capture() === record.token;
  }

  /** scope 在 prepare 前建立；runtime 根据同一个权限实现 Preparing/Committing。 */
  private makeScope(record: PresentationRecord<I>): ModelPresentationScope {
    return {
      defer: callback => this.defer(record, callback), isActive: () => this.isActive(record),
      isCurrent: () => this.canCommit(record), signal: record.controller.signal,
    };
  }

  /** 全量校验材料和设置之后才可能写入，共同意图不会部分通过校验。 */
  private replaceAppearance(record: PresentationRecord<I>, appearance: ModelAppearance): boolean {
    if (!this.canCommit(record))
      return false;
    const copied = copyModelAppearance(appearance, record.content.view.meshes);
    if (!this.canCommit(record))
      return false;
    record.appearance = copied;
    record.materials.record(copied.materials);
    if (record.phase !== 'preparing') {
      try {
        this.applyAppearance(record);
      } catch (error) {
        if (this.desired && this.canCommit(record))
          this.fail(this.desired, error, ModelFailureStage.Presentation);
        throw error;
      }
    }
    return this.canCommit(record);
  }

  /** 内部 view 始终读取 runtime 刷新后的当前版本，不让 Spatial update 借到旧 info。 */
  private makePresentationContext(record: PresentationRecord<I>, scope: ModelPresentationScope): ModelPresentationContext<I> {
    return {
      get content() {
        return record.content.view;
      }, contentId: record.content.snapshot.id,
      platform: record.runtime!.platform, replaceAppearance: appearance => this.replaceAppearance(record, appearance), scope,
    };
  }

  /** 每个实际赋值边界后验权，不能在同步 setter 关闭后继续设置 renderer。 */
  private applyAppearance(record: PresentationRecord<I>): void {
    if (!this.canCommit(record))
      return;
    this.call(() => record.materials.apply(() => this.canCommit(record)), 'Model material application');
    if (!this.canCommit(record))
      return;
    this.call(() => record.runtime!.applyRenderSettings(record.appearance.renderSettings), 'Model renderer settings');
  }

  /** 会话内部身份先建立，再一次性公开 content/state/view。 */
  private publishReady(record: PresentationRecord<I>, intent: Intent<I>): void {
    if (!this.canCommit(record) || this.desired !== intent)
      return;
    record.token ??= Object.freeze({}) as ModelToken;
    record.intent = intent;
    record.phase = 'active';
    this.critical(() => this.publishState());
    if (this.canCommit(record) && this.desired === intent)
      intent.result.resolve({ kind: ModelResultKind.Applied, token: record.token! });
  }

  /** 同步提交由 runtime 显式进入 Committing，直到最后发布才启用 frame/input。 */
  private commit(record: PresentationRecord<I>): void {
    record.phase = 'committing';
    this.call(() => record.runtime!.activate(), 'Model runtime presentation activate');
    if (!this.canCommit(record))
      return;
    this.applyAppearance(record);
    if (!this.canCommit(record))
      return;
    this.call(() => record.session!.activate(), 'Model presentation activate');
    if (!this.canCommit(record))
      return;
    const intent = this.desired!;
    this.call(() => record.session!.update(intent.params), 'Model presentation update');
    if (!this.canCommit(record))
      return;
    this.call(() => record.content.handle.show(), 'Model runtime show');
    if (this.canCommit(record))
      this.publishReady(record, this.desired!);
  }

  /** 展示 prepare 单独取消，内容仍可保留给下一会话或 Error 重试。 */
  private async preparePresentation(intent: Intent<I>, content: ContentRecord<I>): Promise<void> {
    const record: PresentationRecord<I> = {
      appearance: { materials: [], renderSettings: {} }, cleanups: new Set(), content,
      controller: new AbortController(), deactivated: false, intent,
      materials: createModelMaterials(content.view.meshes), phase: 'preparing', reason: ModelReleaseReason.Replaced,
      retired: false, scopeClosed: false,
    };
    this.presentation = record;
    const work: Work = { context: intent.context, controller: record.controller, done: completion<undefined>(), key: intent.sourceKey, kind: 'presentation' };
    this.work = work;
    try {
      this.call(() => content.handle.normalizeMaterials(), 'Model normalization');
      if (!this.canCommit(record))
        return;
      const scope = this.makeScope(record);
      this.critical(() => {
        record.runtime = this.runtime.createPresentation(scope, content.handle);
      });
      if (!this.canCommit(record))
        return;
      const session = await this.critical(() => intent.presentation.prepare(this.makePresentationContext(record, scope), intent.params));
      record.session = session;
      if (!this.canCommit(record)) {
        this.deactivate(record);
        this.closeScope(record);
        return;
      }
      this.commit(record);
    } catch (error) {
      if (this.desired && this.canCommit(record))
        this.fail(this.desired, error, ModelFailureStage.Presentation);
    } finally {
      await this.waitExits();
      if (this.work === work)
        this.work = undefined;
      work.done.resolve(undefined);
    }
  }

  /** 参数更新保 token，异常才退出当前显示并保留内容数据。 */
  private updatePresentation(record: PresentationRecord<I>, intent: Intent<I>): void {
    try {
      record.intent = intent;
      this.call(() => record.session!.update(intent.params), 'Model presentation update');
      if (this.canCommit(record) && this.desired === intent)
        this.publishReady(record, intent);
    } catch (error) {
      if (this.canCommit(record))
        this.fail(intent, error, ModelFailureStage.Presentation);
    }
  }

  /** 唯一实际准备 worker；同源新命令接已有内容任务结果。 */
  private async drain(): Promise<void> {
    if (this.draining || this.closed)
      return;
    this.draining = true;
    try {
      while (this.desired && !this.closed) {
        await this.waitExits();
        const intent = this.desired;
        if (!intent || this.closed)
          break;
        const content = this.content;
        if (!content?.available || content.snapshot.context !== intent.context || !sameKey(content.snapshot.sourceKey, intent.sourceKey)) {
          await this.prepareContent(intent);
          continue;
        }
        const record = this.presentation;
        if (record?.token && this.matchesPresentation(record, intent))
          this.updatePresentation(record, intent);
        else
          await this.preparePresentation(intent, content);
        // ready 的同步观察者可能对同一个 intent 发起 Structure；只有仍活跃的会话才算处理完。
        if (this.presentation?.token && this.matchesPresentation(this.presentation, this.desired)
          && this.presentation.intent === this.desired)
          break;
      }
    } finally {
      this.draining = false;
    }
  }

  /** default 是恢复目标，同 context lease 存在时不会夺权。 */
  private setDefault<P, V>(request: ModelRequest<P, I, V>): Promise<ModelResult> {
    if (this.closed)
      return Promise.resolve({ kind: ModelResultKind.Disposed });
    const sequence = ++this.commandSequence;
    let intent: Intent<I>;
    try {
      intent = this.makeIntent(request, null);
    } catch (error) {
      return Promise.resolve(this.inputFailure(error));
    }
    if (this.closed || sequence !== this.commandSequence)
      return Promise.resolve({ kind: this.closed ? ModelResultKind.Disposed : ModelResultKind.Superseded });
    const changed = this.context !== intent.context;
    this.defaults = intent;
    this.context = intent.context;
    if (changed)
      this.revokeLease();
    if (this.lease?.active) {
      intent.result.resolve({ kind: ModelResultKind.Stored });
      this.critical(() => this.publishState());
    } else
      this.accept(intent, changed ? ModelReleaseReason.ContextChanged : ModelReleaseReason.Replaced);
    return intent.result.promise;
  }

  /** 非法 open 返回只读失败句柄，不影响当前成功会话。 */
  private failedLease<P, V>(result: ModelResult): ModelLease<P, I, V> {
    return {
      present: async () => ({ kind: this.closed ? ModelResultKind.Disposed : ModelResultKind.Superseded }),
      ready: Promise.resolve(result), release: async () => { },
      update: async () => ({ kind: this.closed ? ModelResultKind.Disposed : ModelResultKind.Superseded }),
      view: projection<V | null>(() => null),
    };
  }

  /** 主 lease 必须属于宿主已接受的 context，不以 Source URL 偷换权限。 */
  private open<P, V>(request: ModelRequest<P, I, V>): ModelLease<P, I, V> {
    if (this.closed)
      return this.failedLease({ kind: ModelResultKind.Disposed });
    const sequence = ++this.commandSequence;
    let intent: Intent<I>;
    try {
      intent = this.makeIntent(request, null);
      if (intent.context !== this.context || !this.defaults)
        throw new TypeError('Model open requires the current default context');
    } catch (error) {
      return this.failedLease(this.inputFailure(error));
    }
    if (this.closed || sequence !== this.commandSequence)
      return this.failedLease({ kind: this.closed ? ModelResultKind.Disposed : ModelResultKind.Superseded });
    this.revokeLease();
    const lease: LeaseRecord<I> = { active: true, request: intent };
    intent.lease = lease;
    this.lease = lease;
    this.accept(intent);
    return {
      present: (source, params) => this.present(lease, source, params), ready: intent.result.promise,
      release: () => this.release(lease), update: params => this.present(lease, lease.request.source, params),
      view: projection(() => this.publication.value.lease === lease ? this.publication.value.view as V : null),
    };
  }

  /** 旧 lease 不能调用用户 snapshotParams，新的请求仍保持原提供者 identity。 */
  private present<P>(lease: LeaseRecord<I>, source: ModelSource<I>, params: P): Promise<ModelResult> {
    if (this.closed)
      return Promise.resolve({ kind: ModelResultKind.Disposed });
    if (!lease.active || this.lease !== lease)
      return Promise.resolve({ kind: ModelResultKind.Superseded });
    const sequence = ++this.commandSequence;
    let intent: Intent<I>;
    try {
      intent = this.makeIntent({ context: lease.request.context, params, presentation: lease.request.presentation, source }, lease);
      intent.definition = lease.request.definition;
    } catch (error) {
      return Promise.resolve(this.inputFailure(error));
    }
    if (this.closed || sequence !== this.commandSequence || !lease.active || this.lease !== lease)
      return Promise.resolve({ kind: this.closed ? ModelResultKind.Disposed : ModelResultKind.Superseded });
    lease.request = intent;
    this.accept(intent);
    return intent.result.promise;
  }

  /** 指定退出只等捕获的旧任务，不把恢复 default 的新任务算入。 */
  private async waitRetirement(pending: readonly Promise<void>[], errorStart: number): Promise<void> {
    await Promise.all(pending);
    const failures = this.cleanupErrors.slice(errorStart);
    if (failures.length)
      throw new AggregateError(failures, 'Model retirement failed');
  }

  /** 工具 release 不等待默认来源重新下载，但会等其旧 prepare 真正结束。 */
  private release(lease: LeaseRecord<I>): Promise<void> {
    if (!lease.active || this.lease !== lease)
      return Promise.resolve();
    ++this.commandSequence;
    const errorStart = this.cleanupErrors.length;
    const oldWork = this.work?.done.promise;
    this.supersede(ModelResultKind.Superseded);
    this.revokeLease();
    this.desired = this.defaults ? { ...this.defaults, lease: null, result: completion<ModelResult>() } : undefined;
    this.failure = undefined;
    this.reconcile(ModelReleaseReason.Released);
    const pending = [...this.exits];
    if (oldWork)
      pending.push(oldWork);
    this.schedule();
    return this.waitRetirement(pending, errorStart);
  }

  /** clear 只撤当前 context，旧调用者无法清新项目。 */
  private clear(context: symbol): Promise<void> {
    if (this.closed || this.context !== context)
      return Promise.resolve();
    ++this.commandSequence;
    const errorStart = this.cleanupErrors.length;
    const oldWork = this.work?.done.promise;
    this.supersede(ModelResultKind.Superseded);
    this.context = undefined;
    this.defaults = undefined;
    this.desired = undefined;
    this.failure = undefined;
    this.revokeLease();
    this.reconcile(ModelReleaseReason.ContextChanged);
    const pending = [...this.exits];
    if (oldWork)
      pending.push(oldWork);
    return this.waitRetirement(pending, errorStart);
  }

  /** 只有当前已提交展示具有可读 token。 */
  private capture(): ModelToken | null {
    return !this.closed && this.publication.value.state.status === ModelStatus.Ready && !this.presentation?.retired ? this.presentation?.token ?? null : null;
  }

  /** 内容的逻辑可用性与是否已经物理释放分开。 */
  private captureContent(): ModelContentId | null {
    return !this.closed && this.content?.available ? this.content.snapshot.id : null;
  }

  /** 基础来源匹配不依赖展示提供者，Segmentation 的 lease 也能匹配。 */
  private matchesDefaultContent(id: ModelContentId): boolean {
    // 跟踪唯一 publication，让 Stored 默认描述的变化也能使调用方重新检查。
    void this.publication.value;
    return this.captureContent() === id && !!this.defaults && this.content!.snapshot.context === this.defaults.context
      && sameKey(this.content!.snapshot.sourceKey, this.defaults.sourceKey);
  }

  /** async reader 在执行前拒绝，非 async 返回 thenable 也会报告合同失败。 */
  private borrow<T>(view: ModelContentView<I>, reader: ModelSyncReader<T, I>): T {
    if (typeof reader !== 'function' || Object.prototype.toString.call(reader) === '[object AsyncFunction]')
      throw new TypeError('Model reader must be synchronous');
    const result = reader(view);
    assertSync(result, 'Model reader');
    return result;
  }

  /** 展示借用前后验 token，不能跨同步重入继续使用旧内容。 */
  private read<T>(token: ModelToken, reader: ModelSyncReader<T, I>): T {
    if (this.capture() !== token || !this.content)
      throw aborted();
    const result = this.critical(() => this.borrow(this.content!.view, reader));
    if (this.capture() !== token)
      throw aborted();
    return result;
  }

  /** 内容数据可跨同内容的显示切换读取，但不能跨 ContentId 复用。 */
  private readContent<T>(id: ModelContentId, reader: ModelSyncReader<T, I>): T {
    if (this.captureContent() !== id)
      throw aborted();
    const result = this.critical(() => this.borrow(this.content!.view, reader));
    if (this.captureContent() !== id)
      throw aborted();
    return result;
  }

  /** 订阅实例内容退休，注销不执行数据清理。 */
  private onContentRelease(handler: (content: ModelContentSnapshot<I>, reason: ModelReleaseReason) => undefined): () => void {
    if (typeof handler !== 'function')
      throw new TypeError('Model release handler must be a function');
    if (this.closed)
      return () => { };
    this.releaseHandlers.add(handler);
    return () => {
      this.releaseHandlers.delete(handler);
    };
  }

  /** Structure 同 id/lease 退展示后重建；Spatial 在安全点刷新共同 snapshot。 */
  private refreshContent(id: ModelContentId, kind: ModelChangeKind): void {
    if (this.captureContent() !== id)
      throw aborted();
    if (!Object.values(ModelChangeKind).includes(kind))
      throw new TypeError('Model change kind is invalid');
    const content = this.content!;
    content.refresh = content.refresh === ModelChangeKind.Structure ? content.refresh : kind;
    this.critical(() => {
      if (content.refresh === ModelChangeKind.Structure && this.presentation)
        this.revokePresentation(this.presentation, ModelReleaseReason.Replaced);
      this.publishState();
    });
    this.schedule();
  }

  /** 原生刷新返回的 view 成为权威值，现有 context 使用 getter 读取它。 */
  private applyRefresh(): void {
    const content = this.content;
    const kind = content?.refresh;
    if (!content?.available || !kind || this.closed)
      return;
    content.refresh = undefined;
    try {
      this.critical(() => {
        content.view = content.handle.refresh(kind);
      });
      if (!content.available || this.content !== content)
        return;
      content.snapshot = Object.freeze({ ...content.snapshot, info: content.view.info });
      this.critical(() => this.publishState());
      const record = this.presentation;
      if (kind === ModelChangeKind.Spatial && record?.token && this.desired)
        this.updatePresentation(record, this.desired);
    } catch (error) {
      if (this.desired)
        this.fail(this.desired, error, ModelFailureStage.Content);
    }
  }

  /** 所有 close 共享一个 Promise；终态和借用撤销都先于任何 await。 */
  private close(): Promise<void> {
    if (this.closePromise)
      return this.closePromise;
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    this.closePromise = new Promise<void>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    const errorStart = this.cleanupErrors.length;
    this.closed = true;
    ++this.commandSequence;
    this.supersede(ModelResultKind.Disposed);
    this.context = undefined;
    this.defaults = undefined;
    this.desired = undefined;
    this.failure = undefined;
    this.revokeLease();
    this.reconcile(ModelReleaseReason.EngineDisposed);
    void this.finishClose(errorStart).then(resolve, reject);
    return this.closePromise;
  }

  /** 真实任务的迟到资源也清完之后才结束 close，安全点等待包含在 exits 中。 */
  private async finishClose(errorStart: number): Promise<void> {
    while (this.work || this.exits.size || this.callbackDepth || this.flushing) {
      const pending = [...this.exits];
      if (this.work)
        pending.push(this.work.done.promise);
      await Promise.all(pending);
    }
    this.releaseHandlers.clear();
    const failures = this.cleanupErrors.slice(errorStart);
    if (failures.length)
      throw new AggregateError(failures, 'Model close failed');
  }
}
/**
 * 在所属 effect scope 中创建唯一 Model 控制器，不申请 WebGL 或读取业务状态。
 * @param runtime 内容接纳、平台会话和整个 native frame 的安全点实现。
 * @returns 稳定控制面；失败通过命令结果或退出 Promise 报告。
 * @throws TypeError runtime 缺少必需方法时同步拒绝。
 */
export function useModelController<I>(runtime: ModelRuntime<I>): ModelApi<I> {
  if (!runtime || ['bind', 'discard', 'createPresentation', 'afterCurrentFrame'].some(key => typeof runtime[key as keyof ModelRuntime<I>] !== 'function')) {
    throw new TypeError('Model runtime requires bind, discard, createPresentation and afterCurrentFrame');
  }
  const controller = new ModelController(runtime);
  if (getCurrentScope())
    onScopeDispose(() => {
      void controller.api.close().catch(error => console.error('[model] scope close failed', error));
    });
  return controller.api;
}
