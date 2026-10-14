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

移植基准：fe-tripo-studio `4873ac3c6bc537c8ff47d9bc306c4d0eaab25919`。保留其 Engine 版本与模型控制器；不接账号和云端 API。Studio 材质保留粗糙度重映射，`openpbr-subset-v1` 直接使用输入粗糙度，通过同一 GPU 材质的 uniform 切换。

供应商来源、SKU 与本地覆盖由 `feature/materials` 持有；只把 `SurfaceValues` 传入 Viewer。材质验证共享源几何与法线，区域应用使用既有标签网格。详见 [供应商材质](supplier-materials.md)。

`feature/workspace` 将可应用的供应商色卡转换成 Worker 的 `{ id, hex }` 候选。Worker 用标准 CIEDE2000 选色，不依赖 SKU 类型；返回的稳定 ID 由 Feature 解析为含本地覆盖的材质快照。匹配依据与预览颜色分别保存，`RegionAssignments` 展示近似结果。手动替换只改绑定，重新分色重建标签与绑定。
