import { Engine, Entity } from "./type.js";
import { Object3D } from "three";

//#region src/core/entity.d.ts
declare const createEntity: (engine: Engine, object: Object3D) => Entity;
//#endregion
export { createEntity };