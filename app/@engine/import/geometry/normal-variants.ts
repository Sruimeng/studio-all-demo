import type { BufferAttribute, BufferGeometry, InterleavedBufferAttribute } from 'three';

type NormalAttribute = BufferAttribute | InterleavedBufferAttribute;

const NORMAL_FLAT_ATTRIBUTE = 'normalFlat';
const NORMAL_SMOOTH_ATTRIBUTE = 'normalSmooth';

// 注册平直、平滑两份法线，确保 geometry.dispose() 能统一释放对应 VBO
export const setGeometryNormalVariants = (
  geometry: BufferGeometry,
  flat: NormalAttribute,
  smooth: NormalAttribute,
) => {
  geometry.setAttribute(NORMAL_FLAT_ATTRIBUTE, flat);
  geometry.setAttribute(NORMAL_SMOOTH_ATTRIBUTE, smooth);
};

// 切换 geometry 当前使用的法线；不存在双法线时由调用方执行材质降级
export const setGeometryFlatNormal = (geometry: BufferGeometry, flat: boolean): boolean => {
  const normal = geometry.getAttribute(flat ? NORMAL_FLAT_ATTRIBUTE : NORMAL_SMOOTH_ATTRIBUTE);
  if (!normal) {
    return false;
  }

  geometry.setAttribute('normal', normal);
  return true;
};
