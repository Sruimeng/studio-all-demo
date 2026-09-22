import { Reactive, Ref } from "vue";
import { Object3D } from "three";

//#region src/core/type.d.ts
type EventType = {
  [key: string]: any;
};
type EventMap<E = EventType> = { [K in keyof E]?: Set<((event: E[K]) => any)> };
interface EventEmitter<T extends EventType = EventType> {
  clear: () => void;
  emit: <K extends keyof T>(type: K, event: T[K]) => void;
  map: EventMap<T>;
  off: <K extends keyof T>(type: K, handler: (event: T[K]) => any) => void;
  on: <K extends keyof T>(type: K, handler: (event: T[K]) => any) => void;
}
interface Action {
  redo: () => void | Promise<void>;
  undo: () => void | Promise<void>;
}
type SystemHookCallback = () => any;
interface SystemHook {
  onDisable: (callback: SystemHookCallback) => any;
  onDispose: (callback: SystemHookCallback) => any;
  onEnable: (callback: SystemHookCallback) => any;
  onInit: (callback: SystemHookCallback) => any;
}
interface SystemEvent {
  disable: Set<SystemHookCallback>;
  dispose: Set<SystemHookCallback>;
  enable: Set<SystemHookCallback>;
  init: Set<SystemHookCallback>;
}
interface SystemState {
  enable: Ref<boolean>;
}
interface SystemHookState {
  __event: SystemEvent;
  __hook: SystemHook;
}
type System = object & SystemState & SystemHookState;
interface Engine {
  addAction: (action: Action) => void;
  addSystem: <T extends object>(name: string, setup: (params: SystemHook & SystemState) => T) => void;
  dispose: () => void;
  emitter: EventEmitter;
  entityManager: Set<Entity>;
  getSystem: <T extends object>(name: string) => Reactive<T & SystemState> | undefined;
  redo: () => Promise<void>;
  redoList: Action[];
  removeAction: () => void;
  system: Record<string, Reactive<System>>;
  undo: () => Promise<void>;
  undoList: Action[];
}
type ComponentHookCallback = () => any;
interface ComponentHook {
  onDispose: (callback: ComponentHookCallback) => any;
}
interface ComponentEvent {
  dispose: Set<ComponentHookCallback>;
}
interface ComponentHookState {
  __event: ComponentEvent;
  __hook: ComponentHook;
}
type Component = object & ComponentHookState;
interface Entity {
  add: (entity: Entity) => void;
  addComponent: <T extends object>(name: string, setup: (params: ComponentHook) => T) => void;
  children: Entity[];
  component: Record<string, Reactive<Component>>;
  dispose: () => void;
  getComponent: <T extends object>(name: string) => Reactive<T> | undefined;
  parent: Entity | null;
  query: (name: string) => Entity | null;
  ref: Object3D;
  remove: (entity: Entity) => void;
  removeFromParent: () => void;
  traverse: (callback: (entity: Entity) => void) => void;
}
//#endregion
export { Action, Component, ComponentEvent, ComponentHook, ComponentHookCallback, Engine, Entity, EventEmitter, EventMap, EventType, System, SystemEvent, SystemHook, SystemHookCallback, SystemState };