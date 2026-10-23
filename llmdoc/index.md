---
id: index
type: index
---
# 项目地图

- [架构边界](reference/architecture.md)
- [移植来源](reference/migration.md)
- [供应商材质](reference/supplier-materials.md)
- [跨厂商材质验证](reference/filament-validation.md)
- [验证记录](guides/verification.md)
- [文档规范](guides/doc-standard.md)

公共入口：`@engine/import`、`@engine/model`、`@engine/viewer`、`@engine/multicolor`、`@engine/print-mesh`、`@feature/materials`、`@feature/workspace`。

数据流：本地文件 → Studio loader → Content / Presentation → 统一网格 → 分色 Worker + SKU 色卡候选 → RegionAssignment + RegionColorMatch → 预览 / 项目快照 / 导出。匹配依据是供应商 HEX 推导的 sRGB/D65 Lab；材质变化只更新绑定，分色与涂色更新标签。

耗材验证：通用模板 / 厂商系列 / 自定义颜色 / XLSX / USDA ZIP → 离线转换 → SupplierProfile + 本地覆盖 → SurfaceValues → 整模预览。材质验证不改区域标签；打印导出需切回区域应用。

材质上传：多选 USDA → OpenPBR 常量参数 → 本地材质库 → 手动应用 / 参数编辑 / 项目与 ZIP 恢复。导入忽略几何，不加入自动 SKU 匹配候选。
