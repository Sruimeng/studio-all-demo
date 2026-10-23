---
id: filament-validation
type: reference
---
# 跨厂商材质验证

## 契约

`@feature/materials/filaments.ts` 持有三层关系：

- `MaterialTemplate`：Basic、Matte、Silk、Metallic、Translucent，跨厂商复用的演示外观。
- `MaterialSeries`：稳定 ID、厂商、基材、可选模板、官方资料与旧称。目录引用不代表每个系列都有颜色或全部外观。
- `MaterialRecord.appearance`：厂商、基材、可选 seriesId / templateId、颜色号、销售 SKU、颜色资料来源与 origin。origin 区分 catalog / template / user；内部 ID 和 materialId 不冒充官方 SKU。

`MaterialRecord.optics` 保存 transmission、等效光学厚度、衰减距离、sheen、clearcoat。颜色继承当前外观，可在本地单独调整；不改写模板、其他颜色或原始供应商资料。

`MaterialRecord.appearanceBinding` 首先绑定 Basic / Matte / Silk / Metallic / Translucent 五个通用外观材质，稳定来源 ID 为 `appearance:<finish>`。下拉选择与外观卡片使用同一绑定状态，材质编辑器和验证面板共用入口。库内独立材质作为附加候选，兼容已有 USDA 绑定。

绑定记录保存来源 id / materialId / name、可选 USDA 文件与哈希，以及 overridden 标记。附加候选为本地创建或 USDA 导入、无耗材关系且未绑定其他材质的记录；排除自身与链式绑定，不支持的 OpenPBR 保持禁用。

绑定继承渲染规则、粗糙度、金属度、透明度、IOR 与完整 optics，保留目标颜色、SKU、厂商系列和源资料。颜色不继承源材质 base_color。外观按快照保存；源材质修改后显式“重新继承”更新，删除来源不破坏已保存快照。高级参数编辑标记本地覆盖；切换通用外观直接替换绑定并重置光学参数。保持质感切色、新增颜色、项目 / ZIP / JSON / CSV 均保留绑定。

## 目录边界

首批覆盖 SUNLU、Polymaker、eSUN、Kexcelled、CAILAB。五种外观来自已核验的官方目录；通用基材入口不推断特定配方或全部外观支持。PolyTerra PLA 作为 Panchroma Matte 旧称保留。

SUNLU 33 色与 Polymaker 26 个有 HEX 的色卡分别归独立目录系列，templateId 留空。USDA 导入与未对应档案不自动归类。新增品牌系列无已核验 HEX 时显示空颜色列表，仍可试验模板并录入自定义色；不合成官方颜色或 SKU。

外观绑定保留厂商系列，仅改变本地预览效果，不推断厂商销售该外观或颜色。用户录入的颜色始终显示“自定义”。

目录入口：[SUNLU](https://store.sunlu.com/)、[Polymaker](https://wiki.polymaker.com/polymaker-products/polymaker-filaments/panchroma-tm)、[eSUN](https://esun3dstore.com/)、[Kexcelled](https://kexcelled3d.com/collections/aesthetic)、[CAILAB](https://www.cailab3d.com/)。系列记录包含对应页面；调研日期 2026-10-22。

## 渲染与对比

`filament-preview-v1` 直接使用输入粗糙度。Silk 采用非金属高光、柔光与清漆近似；Metallic 的演示金属度为 0.45，不从 Gold 或 Metal 名称推断含金属粉。Translucent 使用物理 transmission，默认 alpha 不透明；切换材质重置光学 lobe。

Viewer 仅接收 `SurfaceValues`，不依赖厂商或 SKU。透射时，两侧使用相同中性格背景；背景资源随 Viewer 销毁。着色器将等效厚度按世界毫米解释，不随导入层级缩放改变。等效厚度为固定参数近似，不按模型各位置计算壁厚或散射。

“固定为 A”克隆当前材质，B 随后续选择变化。两侧共享模型几何、相机与灯光；清除 A 恢复原模型对比。HDR、ACES、曝光与环境强度固定，A 不随 B 的参数编辑变化。

全部预设未经实物校准，不代表厂商测量参数、光谱或完整 OpenPBR。USDA 原有未支持 lobe 拒绝规则保持不变。

## 保存与导出

新颜色保存到现有 IndexedDB 本地库，成功后才更新预览与绑定。系列颜色按关系过滤；完整材质库保留 USDA 导入、删除、CSV / JSON 导出入口。本地新颜色不加入自动分色候选。

项目 v2、ZIP 和 JSON 保留 appearance、optics、validationMaterial 与独立 validationReference。旧记录均为可选字段，旧项目仍能读取。CSV 增加系列、模板、颜色号、销售 SKU、来源及光学参数。

区域 3MF 的厂商/基材从供应商档案或本地 appearance 解析，完整关系另存附加元数据。切片器不因此获得光学着色支持；验证模式仍禁用 3MF。

## 验证入口

`test/filament-materials.spec.ts` 覆盖关系、预设、光学重置、导出与非法参数；`test/workspace.spec.ts` 覆盖本地持久化、A/B 独立快照、项目/ZIP 与 3MF 元数据。浏览器步骤见 [验证记录](../guides/verification.md)。
