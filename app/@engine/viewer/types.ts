import type { Object3D } from 'three';
import type { PrintMeshInput } from '../multicolor';
import type { SurfaceValues } from './material';
export interface ViewerContent { id: string; root: Object3D; mesh: PrintMeshInput }
export interface PrintDisplay { positions: Float32Array; labels: Uint8Array; faceMap?: Uint32Array }
export interface ViewerHit { face: number; point: [number, number, number]; radius: number }
export interface ViewerSettings { mode: 'original' | 'print' | 'compare'; compareSplit: number; height: number; layers: boolean; grid: boolean; tool: 'orbit' | 'brush' | 'fill'; radius: number }
export type { SurfaceValues };
