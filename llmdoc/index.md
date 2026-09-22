---
id: index
type: index
---
# 项目地图

- [架构边界](reference/architecture.md)
- [移植来源](reference/migration.md)
- [验证记录](guides/verification.md)
- [文档规范](guides/doc-standard.md)

公共入口：`@engine/import`、`@engine/model`、`@engine/viewer`、`@engine/multicolor`、`@engine/print-mesh`、`@feature/materials`、`@feature/workspace`。

数据流：本地文件 → Studio loader → Content / Presentation → 统一网格 → 分色 Worker → RegionAssignment → 预览 / 项目快照 / 导出。材质变化只更新绑定；分色与涂色更新标签。
