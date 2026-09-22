import { Engine, EventType } from "../core/type.js";
import "../core/index.js";

//#region src/utils/event.d.ts
declare const defineEvent: <T extends EventType>(name: string) => readonly [{
  <K extends keyof T & string>(type: K, handler: (event: T[K]) => void): void;
  <K extends keyof T & string>(engine: Engine, type: K, handler: (event: T[K]) => void): void;
}, {
  (): <K extends keyof T & string>(type: K, event: T[K]) => void;
  (engine: Engine): <K extends keyof T & string>(type: K, event: T[K]) => void;
}];
//#endregion
export { defineEvent };