---
id: architecture
type: reference
---
# 架构边界

`pages/layout → feature → engine → base`。同层单向依赖，跨模块只消费公开入口。

- `base`：本地存储、语言与下载机制。
- `engine`：Studio 模型 Content/Presentation、加载器、显示材质、分色和涂色。
- `feature`：材质档案、项目快照、导出编排。
- `layout/pages`：工作台装配与视觉。

Three 对象不用深响应式。源模型、显示材质与 Worker 数据分别持有；卸载必须释放 GPU、Worker、事件和 ObjectURL。旧项目异步结果不能写入新项目。

移植基准：fe-tripo-studio `4873ac3c6bc537c8ff47d9bc306c4d0eaab25919`。保留其 Engine 版本与模型控制器；不接 Studio 账号和业务 API。Studio 材质保留粗糙度重映射，`openpbr-subset-v1` 与 `filament-preview-v1` 直接使用输入粗糙度，通过同一 GPU 材质的 uniform 切换。

专属站增加 `api/materials.ts` → `feature/materials/server.ts` 公共入口 → GitHub 数据仓库。服务端与客户端复用材质校验和供应商源档案；密钥只在服务端环境读取。客户端同步状态与三方合并属于 `feature/materials`，IndexedDB 原子持久化属于 `base/storage`。厂商绑定在构建时确定，详见 [专属站点](../guides/vendor-sites.md)。

供应商来源、SKU 与本地覆盖由 `feature/materials` 持有；只把 `SurfaceValues` 传入 Viewer。材质验证共享源几何与法线，区域应用使用既有标签网格。详见 [供应商材质](supplier-materials.md) 与 [跨厂商材质验证](filament-validation.md)。

`feature/workspace` 将可应用的供应商色卡转换成 Worker 的 `{ id, hex }` 候选。Worker 用标准 CIEDE2000 选色，不依赖 SKU 类型；返回的稳定 ID 由 Feature 解析为含本地覆盖的材质快照。匹配依据与预览颜色分别保存，`RegionAssignments` 展示近似结果。手动替换只改绑定，重新分色重建标签与绑定。

`InitResult.sourceColors` 表示无 baseColor 贴图、每面顶点色一致的输入（按 sRGB8 归并，最多 16 色）。默认调用 `preserve`，跳过聚类、去噪与区域合并；每个原色独立匹配最近色卡，同 SKU 不合并区域。贴图、渐变和超限输入继续自动分色（1–12 色）。`PrintProject.regionSource` 可选，旧项目按 `automatic` 恢复；标签、涂色、区域绑定照常进入快照和 3MF。

`ViewerSettings.appearance` 在 `ideal` 源代表色与 `material` 耗材外观间切换，不修改标签或导出色槽。`PrintMeshInput.normals` 保留静态源网格的变换后法线，不发送给 Worker。Viewer 按位置数组复用几何与法线；标签改变只重排绘制索引，独立拾取几何保持原面顺序并复用 BVH；耗材变化只更新 GPU 材质。内置 `atelier-preserved.glb` 由 `scripts/create-samples.mjs` 生成，用于本地查看保留分色流程。


`PrintCommands.preview` 接收 `{ N: 1..16, detail: 1..6, scale, cands }`，原子更新 Worker 标签并返回 `slots + label + regionCount + cacheHit`。`regions.js` 首次按同源色、连通边与面法线点积 ≥0.98 建图；贴图先映射到面积加权 OKLab 基础色。之后颜色数复用合并树，代表色选实际源色，耗材仍按 ΔE00 匹配。细节按区域面数阈值合并小块，优先法线连续邻区；六级结果分别缓存。位置、法线、原始采样不随拖动重建。UV 模式仍需额外执行贴图标签与细分流程。

`RegionPreviewControls` 只发参数事件；`preview-queue.ts` 以 60 ms 防抖、一个在途任务和一个最新待办调度，旧响应不发布。预览状态只用于滑块旁的局部提示，不禁用整页控件；导入、保存等操作仍用独立 busy 状态。保存和导出等待队列完成；预览返回时读取最新区域选择与手动绑定，保留计算期间的选择和换材质。项目替换、卸载使旧结果失效。SKU 手动绑定按源代表色复用，换色数后重新出现的代表色恢复当前会话绑定；只把当前可见绑定写入项目快照。保留原分色可一键恢复，恢复后同步源颜色数与最高细节。

无供应商色卡的专属站以 `filamentPreview` 初始化验证材质；`palette` 使用 `free`，`preserve` / `preview` 接受空候选，返回源色与空 `filamentId`。Feature 将其转换为通用预览材质，不写入 `RegionColorMatch` 或伪造官方 SKU。
