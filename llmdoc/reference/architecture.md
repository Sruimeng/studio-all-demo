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

移植基准：fe-tripo-studio `4873ac3c6bc537c8ff47d9bc306c4d0eaab25919`。保留其 Engine 版本、粗糙度重映射与模型控制器；不接账号和云端 API。
