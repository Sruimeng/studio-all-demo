// 旧渲染器的会话端口：固定原生订阅，按展示作用域管理输入、帧、Pass 和临时对象。
// TODO(待随迁): 属旧Engine运行时；升级3.0时替换原生帧/相机/Pass端口，保持Model合同。

import type { Object3D, ToneMapping, WebGLRenderer } from 'three';
import type { Pass } from 'three/addons/postprocessing/Pass.js';
import type { RenderFunction } from '@tripo3d/engine';
import { markRaw, readonly, type Ref, shallowRef } from 'vue';
import {
  type ModelFrame,
  ModelObjectParent,
  type ModelPointer,
  ModelPointerKind,
  type ModelPresentationScope,
  type ModelRenderSettings,
  type ModelRuntimePresentation,
} from '../types';
import { markModelResourcesRaw } from '../lib/model-raw-resources';

/** 只在 Canvas 初始化时注入一次的旧平台依赖。 */
export interface ModelNativePlatformOptions {
  /** 归还相机控制时重新读取宿主当前意图，不用借用前的旧快照覆盖。 */
  cameraEnabled: () => boolean;
  /** 当前 Canvas 控制器，允许生命周期中尚未建立。 */
  controls: Readonly<Ref<{ enabled: boolean; stop?: () => void } | null | undefined>>;
  /** SDK 固定帧注册入口；每个 Model 只安装固定数量的分发器。 */
  onRender: (handler: RenderFunction, order: number) => void;
  /** 当前物理 WebGLRenderer，不创建或替换 renderer。 */
  renderer: WebGLRenderer;
  /** 取得当前场景供场景级 helper 挂载。 */
  scene: () => Object3D;
}

/** 每个 Engine 一个分发器；所有会话共享帧安全点和相机借用计数。 */
export interface ModelNativePlatform {
  /** 当前 native/离屏栈后执行同步拆除；空闲时立即运行。 */
  afterCurrentFrame: (action: () => undefined) => void;
  /** 只读相机借用状态，供相机模块结合自己的 enable 决策。 */
  readonly cameraSuspended: Readonly<Ref<boolean>>;
  /** 准备一次展示的资源作用域，activate 前不修改场景。 */
  createPresentation: (scope: ModelPresentationScope, root: Object3D) => ModelRuntimePresentation;
  /** 按当前活跃 scope 分发输入；返回是否消费当前同步事件。 */
  dispatchPointer: (event: ModelPointer) => boolean;
  /** 停止接纳并在安全点释放仍活跃的会话资源，幂等。 */
  dispose: () => void;
  /** 重查询前检查当前活跃行为的需求，Click也考虑需要判空的Missed监听。 */
  needsPointerHit: (kind: ModelPointerKind) => boolean;
  /** 包住离屏渲染的完整同步恢复段，结束后执行已排队的安全拆除。 */
  runFrame: <T>(action: () => T) => T;
}

/** 当前 scope 独占的光标借用，不建立跨会话优先级栈或暴露给提供者。 */
interface ModelCursorLoan {
  /** 首次有效声明时的真实 Canvas，归还不改用后继 DOM。 */
  readonly element: HTMLCanvasElement;
  /** 只有发生实际 DOM 写入后才记录，不能把外部同值当成本会话写入。 */
  lastWritten: 'pointer' | null;
  /** 首次借用时的 inline 值，不读取计算样式。 */
  readonly original: string;
  /** 归属窗口负责空闲 hover 失焦清理，允许 Canvas 所属文档没有浏览上下文。 */
  readonly window: Window | null;
}

/** 三方同步回调的错误不阻断其余资源归还。 */
function completeAll(actions: Iterable<() => void>): void {
  const errors: unknown[] = [];
  for (const action of actions) {
    try {
      const result = action() as unknown;
      if (result && (typeof result === 'object' || typeof result === 'function') && 'then' in result) {
        throw new TypeError('Model platform cleanup must be synchronous');
      }
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) throw new AggregateError(errors, 'Model platform cleanup failed');
}

/**
 * 将无 off 的旧 SDK 注册收敛为固定的帧入口。
 * 安全点在整个 native/composer 同步栈之后，不能在本分发器末尾提前拆资源。
 */
export function useModelPlatform(options: ModelNativePlatformOptions): ModelNativePlatform {
  const sessions = new Set<{
    frame: (frame: ModelFrame) => void;
    needsHit: (kind: ModelPointerKind) => boolean;
    passes: () => readonly Pass[];
    pointer: (event: ModelPointer) => boolean;
    release: () => void;
  }>();
  const safeActions = new Set<() => undefined>();
  const cameraLoans = new Map<symbol, { enabled: boolean }>();
  const cameraSuspended = shallowRef(false);
  let inFrame = false;
  let renderDepth = 0;
  let disposed = false;

  /** 当前native/离屏同步栈结束后执行物理清理；空闲时立即执行。 */
  const afterCurrentFrame = (action: () => undefined): void => {
    if (inFrame || renderDepth > 0) safeActions.add(action);
    else action();
  };
  options.onRender(() => {
    if (disposed || inFrame) return;
    inFrame = true;
    queueMicrotask(() => {
      inFrame = false;
      const actions = [...safeActions];
      safeActions.clear();
      completeAll(actions);
    });
  }, -Infinity);
  options.onRender(({ composer, delta, elapsed }) => {
    if (disposed) return;
    for (const session of [...sessions]) {
      session.frame({ delta, elapsed });
      for (const pass of session.passes()) composer.addPass(pass);
    }
  }, 0);

  /** 归还本次 token，不解除另一会话持有的 controls。 */
  const releaseCamera = (id: symbol): void => {
    const controls = cameraLoans.get(id);
    if (!controls) return;
    cameraLoans.delete(id);
    cameraSuspended.value = cameraLoans.size > 0;
    if (![...cameraLoans.values()].includes(controls)) {
      controls.enabled = options.cameraEnabled();
    }
  };

  return {
    afterCurrentFrame,
    cameraSuspended: readonly(cameraSuspended),
    /** 为本次展示登记私有资源与输入；Preparing 阶段只保存意图，不挂载到场景。 */
    createPresentation(scope, root) {
      const frames = new Set<(frame: ModelFrame) => undefined>();
      const pointers = new Map<ModelPointerKind, Set<{ handler: (event: ModelPointer) => boolean; needsHit: boolean | (() => boolean) }>>();
      const passes = new Set<Pass>();
      const resources = new Set<() => void>();
      const mounts = new Set<() => void>();
      const unmounts = new Set<() => void>();
      const loans = new Map<symbol, () => void>();
      const baselineToneMapping = options.renderer.toneMapping;
      let committing = false;
      let detached = false;
      let released = false;
      let settings: Readonly<ModelRenderSettings> = {};
      // 只在实际 Active 借用时读取 DOM 和注册监听；未使用光标的会话保持无 DOM 依赖。
      let cursorLoan: ModelCursorLoan | null = null;

      /** 提交后的当前 scope 才能实际挂物体，Preparing 只记录意图。 */
      const canMount = (): boolean => !detached && committing && scope.isCurrent();
      /** 输入和帧必须等 Ready，不能仅凭还未过期的准备 scope 分发。 */
      const canDispatch = (): boolean => !detached && scope.isActive();
      /** 先放弃所有权与监听，再条件恢复；重复退出和旧 scope 迟到调用不能改写后继。 */
      const releaseCursor = (): void => {
        const loan = cursorLoan;
        if (!loan) return;
        cursorLoan = null;
        scope.signal.removeEventListener('abort', releaseCursor);
        loan.window?.removeEventListener('blur', releaseCursor);
        if (loan.lastWritten !== null && loan.element.style.cursor === loan.lastWritten && loan.original !== loan.lastWritten) {
          loan.element.style.cursor = loan.original;
        }
      };
      /** 省略设置恢复平台基线，不沿用上次提供者的色调。 */
      const applyToneMapping = (): void => {
        options.renderer.toneMapping = settings.toneMapping ?? baselineToneMapping;
      };
      const entry = {
        /** 固定原生帧入口只调用当前 Active scope，回调中撤权后停止后续行为。 */
        frame(frame: ModelFrame) {
          for (const handler of [...frames]) {
            if (!canDispatch()) break;
            handler(frame);
          }
        },
        /** 汇总当前监听的拾取需求；Click 的判空同时服务 Missed。 */
        needsHit(kind: ModelPointerKind) {
          if (!canDispatch()) return false;
          const handlers = [...(pointers.get(kind) ?? [])];
          if (kind === ModelPointerKind.Click) handlers.push(...(pointers.get(ModelPointerKind.Missed) ?? []));
          return handlers.some(({ needsHit }) => typeof needsHit === 'function' ? needsHit() : needsHit);
        },
        /** 返回活跃会话的 Pass 快照，composer 的临时列表不持有本集合。 */
        passes: () => canDispatch() ? [...passes] : [],
        /** 按登记顺序派发，同步消费即停止；每个监听前重新确认 scope 权限。 */
        pointer(event: ModelPointer) {
          // 光标只跟随命中；按下和点选不干预，离开时统一归还。
          if (canDispatch() && event.kind === ModelPointerKind.Leave) releaseCursor();
          for (const { handler } of [...(pointers.get(event.kind) ?? [])]) {
            if (!canDispatch()) break;
            if (handler(event)) return true;
          }
          return false;
        },
        /** 完成 runtime 装配后绑定真实释放委托，entry 发布前不会调用此占位。 */
        release: () => undefined,
      };

      /** 先停输入/摘对象/归还设置，保留资源给 Model 完成源材质恢复。 */
      const detach = (): undefined => {
        if (detached) return undefined;
        detached = true;
        sessions.delete(entry);
        frames.clear();
        pointers.clear();
        const actions = [releaseCursor, ...unmounts, ...loans.values()];
        unmounts.clear();
        loans.clear();
        mounts.clear();
        if (committing) actions.push(() => {
          options.renderer.toneMapping = baselineToneMapping;
        });
        completeAll(actions);
        return undefined;
      };

      const runtime: ModelRuntimePresentation = {
        /** 进入提交阶段后才挂载登记对象；真正的帧与输入仍等 scope Active。 */
        activate() {
          if (!scope.isCurrent() || detached || disposed) return undefined;
          committing = true;
          sessions.add(entry);
          for (const mount of [...mounts]) {
            if (!canMount()) break;
            mount();
          }
          applyToneMapping();
          return undefined;
        },
        /** 校验并保存完整设置，缺省 toneMapping 恢复本会话的平台基线。 */
        applyRenderSettings(next) {
          const toneMapping = next.toneMapping;
          if (toneMapping !== undefined && (!Number.isInteger(toneMapping) || toneMapping < 0 || toneMapping > 7)) {
            throw new TypeError('Invalid model tone mapping');
          }
          if (detached || !scope.isCurrent()) return undefined;
          settings = { toneMapping: toneMapping as ToneMapping | undefined };
          if (canMount()) applyToneMapping();
          return undefined;
        },
        detach,
        /** 源材质恢复后释放本会话所有私有资源；摘除与单项失败都不阻断其余清理。 */
        dispose() {
          if (released) return undefined;
          released = true;
          const owned = [...resources];
          resources.clear();
          completeAll([detach, ...owned]);
          return undefined;
        },
        platform: {
          /** 调用即移交 Pass 释放责任；撤权后的登记立即清理，不进入下一会话。 */
          addPass(pass) {
            markRaw(pass);
            let removed = false;
            /** 从资源与帧列表同时移除，再幂等释放这一个 Pass。 */
            const release = (): void => {
              if (removed) return;
              removed = true;
              resources.delete(release);
              passes.delete(pass);
              completeAll([() => pass.dispose()]);
            };
            if (detached || !scope.isCurrent()) release();
            else {
              passes.add(pass);
              resources.add(release);
            }
            return release;
          },
          /** 帧回调只存于当前会话，返回的注销函数不改变其他会话。 */
          onFrame(handler) {
            if (!detached && scope.isCurrent()) frames.add(handler);
            return () => {
              frames.delete(handler);
            };
          },
          /** 保存输入处理及动态拾取需求，注销仅移除本次登记对象。 */
          onPointer(kind, handler, options) {
            const handlers = pointers.get(kind) ?? new Set();
            const registration = {
              handler,
              needsHit: options?.needsHit ?? (kind === ModelPointerKind.Down || kind === ModelPointerKind.Move || kind === ModelPointerKind.Click || kind === ModelPointerKind.Missed),
            };
            if (!detached && scope.isCurrent()) {
              handlers.add(registration);
              pointers.set(kind, handlers);
            }
            return () => {
              handlers.delete(registration);
              if (!handlers.size) pointers.delete(kind);
            };
          },
          /** 接管 helper 与明确列出的私有资源；源 Mesh 资源不应列入 ownedResources。 */
          prepareObject({ object, ownedResources, parent }) {
            markModelResourcesRaw(object);
            for (const resource of ownedResources) markRaw(resource);
            let removed = false;
            let desired = false;
            /** 只摘除 helper，不提前释放它仍可能被当前渲染栈借用的资源。 */
            const unmount = (): void => {
              object.removeFromParent();
            };
            /** 同一展示的挂载意图在提交时兑现，旧 scope 不能挂到后继内容上。 */
            const commit = (): void => {
              if (desired && !removed && canMount()) {
                (parent === ModelObjectParent.Content ? root : options.scene()).add(object);
              }
            };
            /** 移除全部登记后按资源 identity 去重释放，允许重复调用。 */
            const release = (): void => {
              if (removed) return;
              removed = true;
              resources.delete(release);
              mounts.delete(commit);
              unmounts.delete(unmount);
              completeAll([unmount, ...new Set(ownedResources).values()].map(value =>
                typeof value === 'function' ? value : () => value.dispose()));
            };
            if (detached || !scope.isCurrent()) release();
            else {
              resources.add(release);
              mounts.add(commit);
              unmounts.add(unmount);
            }
            return {
              /** Preparing 只记录想要挂载；活跃提交时挂到声明的内容根或场景。 */
              mount() {
                if (removed || detached || !scope.isCurrent()) return false;
                desired = true;
                commit();
                return true;
              },
              release,
              /** 撤销挂载意图但保留资源，后续同一有效会话仍可重新 mount。 */
              unmount() {
                desired = false;
                unmount();
              },
            };
          },
          /** 每次读取实际 inline 值以允许失焦恢复和外部改写后的重新声明，同值不重复写。 */
          setCursor(cursor) {
            if (cursor === null) {
              releaseCursor();
              return;
            }
            if (disposed || scope.signal.aborted || !canDispatch()) return;
            if (!cursorLoan) {
              const element = options.renderer.domElement;
              cursorLoan = { element, lastWritten: null, original: element.style.cursor, window: element.ownerDocument.defaultView };
              scope.signal.addEventListener('abort', releaseCursor, { once: true });
              cursorLoan.window?.addEventListener('blur', releaseCursor);
            }
            if (cursorLoan.element.style.cursor !== cursor) {
              cursorLoan.lastWritten = cursor;
              cursorLoan.element.style.cursor = cursor;
            }
          },
          /** 为当前会话借用相机控制，返回幂等归还；不缓存旧业务 enable。 */
          suspendCamera() {
            const id = Symbol('model-camera');
            let removed = false;
            /** 提交时锁定当时的 controls 实例，并停止已经开始的相机惯性。 */
            const commit = (): void => {
              if (removed || cameraLoans.has(id) || !canMount()) return;
              const controls = options.controls.value;
              if (!controls) return;
              cameraLoans.set(id, controls);
              cameraSuspended.value = true;
              controls.enabled = false;
              controls.stop?.();
            };
            /** 只归还本次借用，最后一个借用结束时读取当前宿主相机意图。 */
            const release = (): void => {
              if (removed) return;
              removed = true;
              mounts.delete(commit);
              loans.delete(id);
              releaseCamera(id);
            };
            if (!detached && scope.isCurrent()) {
              mounts.add(commit);
              loans.set(id, release);
              commit();
            }
            return release;
          },
        },
      };
      // entry 只在 activate 后发布，先完成关闭委托再把运行时交给 Model。
      entry.release = () => runtime.dispose();
      return runtime;
    },
    /** 向当前活跃会话派发，已消费的输入不会继续交给后续监听。 */
    dispatchPointer(event) {
      for (const session of [...sessions]) {
        if (session.pointer(event)) return true;
      }
      return false;
    },
    /** 同步停止接单，物理资源退出延后到完整渲染栈的安全点。 */
    dispose() {
      if (disposed) return;
      disposed = true;
      afterCurrentFrame(() => {
        completeAll([...sessions].map(session => () => session.release()));
        return undefined;
      });
    },
    /** 输入桥查询前读取实时需求，已关闭的平台不再触发射线计算。 */
    needsPointerHit(kind) {
      return !disposed && [...sessions].some(session => session.needsHit(kind));
    },
    /** 把离屏渲染与状态恢复纳入同一借用栈，最外层结束后再拆除排队资源。 */
    runFrame(action) {
      renderDepth += 1;
      try {
        return action();
      } finally {
        renderDepth -= 1;
        if (!inFrame && renderDepth === 0) {
          const actions = [...safeActions];
          safeActions.clear();
          completeAll(actions);
        }
      }
    },
  };
}
