---
id: color-quantization-upstream
type: reference
---
# 上游与本地补丁

- 来源：<https://github.com/vast-enterprise/color-quantization>
- 固定 SHA：`80c58f2168d72800e8170f6998987262eeae780d`。
- `vendor/quantize.js` 来自 `web/js/quantize.js`；`vendor/commit.js` 来自 `web/js/commit.js`。
- 保留上游文件头、阶段说明与溯源注释。上游对 MakerWorld/Python 等价性的文件头描述属于上游声明，不是本包已验证的官方来源或性能保证。
- 该版本未提供许可证。本包不编造上游许可证；`private:true` 仅用于内部隔离试验，不授予公开再分发权。公开发布、再许可或商业分发前必须另行确认授权。不要发布此包。

## 完整本地补丁清单

1. 两份 vendor 文件增加仓库、SHA 和本文指针。
2. `quantize.js` 的 `analyze` 末尾增加可选 `maxDistanceMatrixBytes`，默认 `128 * 1024 * 1024`；传至 `premerge`。在 `Float64Array(n*n)` 分配之前检查矩阵字节数，超限抛带 `ERR_DISTANCE_MATRIX_BUDGET` 的错误。未修改允许输入的数值步骤、阈值、排序或操作顺序。公开包装层负责预算参数校验。
3. `quantize.js` 不包含原文件末尾的 CQA1 容器读写代码（原 459–507 行）。不提供不受验证的外部分析容器导入。
4. `commit.js` 不包含原文件末尾的 `compareCommitted` 辅助基准（原 1233–1273 行）。提交内核至 driver 返回处保持原有实现。
5. 新增的包级包装层独立完成输入、K、分析与输出校验、SHA-256 内容绑定、RGBA 预览以及 Worker 通信。未加入新的聚类、清理阈值、采样规则、重网格策略或自动降采样。
6. Worker 客户端默认路径使用原生 `new Worker(new URL('./worker-entry.js', import.meta.url), { type: 'module' })`，使 Vite 可静态识别入口与依赖图；保留独立的 `createWorker` 注入路径和非浏览器创建保护。未修改 Worker 内核或数值行为。

未复制 `glb.js`、UI、CDN 依赖或应用代码。包内核心模块是实际文件，不是临时 checkout 的链接；运行时不读取 checkout、根应用或网络。

## 复核

- 包目录执行 `npm test`：验证公开包装与 vendored 内核一致、确定性小 fixture、输入边界及真实 Worker 消息；构造测试另检查默认原生构造语法、Node 安全导入与注入路径。
- `CQ_UPSTREAM=/absolute/pinned/checkout npm test` 对同一输入逐字段比较独立上游 `analyze/commit` 与本包；该路径仅在测试中使用。调用者负责确认 checkout SHA。
- `npm run test:types` 检查公开类型消费；`npm pack --dry-run` 检查分发白名单。这些检查不覆盖 bundler 生产运行。
- Vite 消费端通过 `vite` 与 `vite build` 分别验收开发与生产路径；构建产物还需真实浏览器执行默认 Worker 生命周期。Node 适配器或静态 ESM 浏览器通过，均不能单独证明生产打包正确。
- 数值等价与源码保留不等于网格水密证明；打印健康检查独立验收。
