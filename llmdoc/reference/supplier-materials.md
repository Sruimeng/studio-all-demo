---
id: supplier-materials
type: reference
---
# 供应商材质

## 契约

`@feature/materials/types`：

- `SupplierProfile`：vendor、SKU、可选 catalogId / colorFamily、材料类型、表格 HEX / Pantone / D65 Lab、对应状态、问题列表、来源行号、USDA 路径、SHA256、原始参数与材质文本。无 SKU 时使用独立目录编号，不推断官方 SKU。
- `MaterialOverrides`：本地 HEX、透明度、金属度、粗糙度、IOR、颜色解释方式。供应商原值不改写。
- `MaterialRecord` v2：可选供应商档案、覆盖、appearance 关系与 optics 光学参数。旧本地记录兼容；稳定内部 ID 与展示 SKU 分开。
- `SurfaceValues`：Viewer 只接收颜色、外观参数与渲染规则，不依赖 SKU 类型。
- `RegionColorMatch`：basis=`catalog-hex-d65-deltae00`、稳定材质 ID、canonical HEX、生成时平均 ΔE00 与采样面积比例。旧区域快照可无此字段。

## 首批数据

`scripts/import-polymaker.py` 读取 Sheet1 与 ZIP，输出 `app/@feature/materials/data/polymaker-pla.json`。使用 Python 标准库，不改写源文件。只处理一个 OpenPBR 节点的常量输入；拒绝外部组合、资源与有效连接输入，忽略本批未启用的几何切线连接。

26 行颜色数据 + 16 份 USDA → 28 条档案：14 对应、12 仅颜色、2 未对应。`CA19010.001.usda` / `CA19012.usda` 未对应表格，禁止应用；名后缀保留并提示确认。材质不读取 USDA 中的样例球体。

源问题不修正：CA19006 Black 的 L=95.46；CA19027 Cold White 的 L=33.34；CA19024 Azure Blue 的中文名为绿色；CA19009 颜色 R=1.0947。自动匹配使用表格 HEX 推导的 sRGB/D65 Lab；测量 Lab 仍待复核。

## SUNLU PLA

`python3 scripts/import-sunlu.py /path/to/SUNLU-PLA产品颜色资料.xlsx` 使用标准库读取 Sheet1、合并单元格与色块，输出 `data/sunlu-pla.json`。第 2–34 行共 33 色：常规 20、华彩 5、粉彩 8。保留中英文名、原色系与 Pantone 文本；F 列 HEX 统一为 `#RRGGBB`，原文字与 G 列色块另存 `source.rawHex` / `swatchHex`。9 行存在差异，标记 `hex-swatch-mismatch`；预览与匹配采用 F 列。

表格无 SKU、测量 Lab 或 OpenPBR 参数。`sku=''`、`status=color-only`；`catalogId=PLA-<英文色名>`，内部 ID 为 `sunlu:<catalogId>`，展示 ID 为 `SUNLU-<catalogId>`。标记 `sku-not-provided` 和 `openpbr-missing`；外观采用既有演示默认值，不从“削光金”等色名推断金属度。

`supplierCatalogs` 汇总 Polymaker 与 SUNLU，`supplierCatalog` 保留首批目录入口；共 61 条档案。`MaterialPanel` 提供全部厂商 / Polymaker / SUNLU 筛选，搜索包含色系；`SupplierDetail` 区分 SKU 与 Demo 目录编号，展示来源表格、行号、原始 HEX 和色块。厂商筛选只影响库列表，自动匹配仍使用全部内置候选。

## 本地 USDA 导入

`importUSDAMaterials(File)`：UTF-8 USDA → 绑定 OpenPBR 常量节点 → `MaterialRecord`。单文件上限 20 MB、1–100 个 Material；忽略几何。导入档案 `origin=local-usda`、`status=imported`，保留文件名、SHA256、源参数与材质文本；不从文件名推断厂家、SKU 类型或色卡。默认假设 linear-srgb，可改为 srgb 或导入时预览 HEX。

`MaterialImport` 提供多文件入口与逐文件反馈；`useWorkspace.importMaterials` 解析、展示 ID 去重、写入 IndexedDB 后更新本地库。文件解析失败不影响其他文件；持久化失败不更新库和绑定。内部 ID 独立，同名展示 ID 添加 `-IMPORT-N`。导入和参数编辑不重算标签，不增加自动分色候选。

复用现有 OpenPBR 子集检查，拒绝外部资源、组合、未知输入、有效连接与未支持的 lobe；本批无各向异性时忽略 geometry_tangent 连接。编辑、恢复源参数、项目/ZIP 保留导入身份与原值。

## 分色匹配

新模型加载与“生成分色”使用 `palette` 的 `owned` 模式。59 个候选（Polymaker 26、SUNLU 33）取自内置供应商档案，须通过六位 HEX 与可应用检查；本地副本、预览调整及未对应 SKU 不参与选色。Worker 接收稳定内部 ID 与 canonical HEX，用标准 CIEDE2000（kL=1）优化面积加权近似，返回模型代表色、采样面积比例和平均色差。Feature 解析 ID 并绑定含本地覆盖的材质快照。

颜色数是使用目录颜色的上限，无分配面积的候选不生成槽位。ΔE00 是生成时量化采样色至色卡的面积加权平均，不是代表色单点色差或实物误差。标签使用模型代表色；手动更换或保存材质不重算标签，并清除旧匹配记录。已保存项目优先恢复快照中的绑定；重新分色会替换手动绑定。

## 预览

`supplier.ts` 将来源与覆盖转换成 `SurfaceValues`；本地 HEX 优先，其次显式颜色解释，默认表格 HEX。源颜色空间为 unknown；linear-srgb / srgb 均为试验假设。大于 1 的源颜色保留，转换为导出 HEX 时受 sRGB 范围限制。

`openpbr-subset-v1` 映射 base color、metalness、specular roughness、IOR、geometry opacity；粗糙度直接使用。Studio 规则继续使用 `0.5 + 0.5 * roughness`。原有 transparency 是 alpha，不是 transmission。新增通用模板通过独立 optics.transmission 预览，详见 [跨厂商材质验证](filament-validation.md)。当前批次 base/specular weight=1、specular color=白、其余关键 lobe 权重为零；有效透射、清漆、SSS、fuzz、薄膜、各向异性等会阻止应用。Three.js 近似不代表完整 OpenPBR 着色器。

`ModelViewport` 验证模式克隆源层级，共享几何与法线，替换整模材质；固定 Studio HDR、ACES、曝光 1、环境强度 1、旋转 0。默认关层纹。标准样件含平面、球面、薄壁；尺寸随打印高度缩放。左侧原模型不作为 Blender 真值。

## 保存与导出

IndexedDB 的 `materials` 保存本地材质，`supplier-overrides` 保存供应商调整。取消清草稿；恢复参数后仍需显式保存。

本地库默认空。初始化与 ZIP 恢复移除旧六个内置样例，仅匹配原内部 ID 与 PLA-001–006；用户创建与 USDA 导入记录保留，区域和项目中的材质快照不改写。

`useWorkspace.deleteMaterial(id)` 仅删除本地库记录，持久化成功后更新库与导出勾选。保存失败保持原状态；区域、验证材质和已存项目持有独立快照，删除不改变其外观或标签。供应商档案不可删除；MaterialPanel 的本地卡片提供垃圾桶和确认/取消。

项目 v2 保存 ViewerSettings、验证材质、可选 A 对比材质、区域快照；v1 缺省恢复为区域应用及 Studio 环境。ZIP 加入模型、本地库、供应商覆盖；恢复 v2 替换两类库。

目录颜色应用只改区域材质快照，不请求新标签。验证模式禁用 3MF 导出；区域应用导出材质展示 ID（官方 SKU 或 Demo 目录编号）/ type / vendor / SHA256。SUNLU 的空 SKU 与目录编号在 JSON、项目和 3MF 附加元数据中分别保留。未声明类型使用 Unknown。色槽采用有效预览色；原始色与本地覆盖在元数据中保留。3MF 附加元数据不赋予切片器 OpenPBR 支持，本批不导出材质贴图或工艺参数。

## 入口与证据

- `MaterialPanel` / `MaterialEditor` / `SupplierDetail`：选择、来源、参数、问题标记。
- `useWorkspace`：验证与区域模式、绑定、保存、备份、导出。
- `test/supplier-materials.spec.ts`：数据对应、颜色解释、粗糙度切换、覆盖恢复、不支持的 lobe。
- `test/workspace.spec.ts`：不重算标签、独立存储、v1/v2、保存失败、真实耗材标识。
- 实际浏览器与文件证据见 [验证记录](../guides/verification.md)。Blender、目标切片器、实物匹配仍待验证。
