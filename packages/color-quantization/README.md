---
id: color-quantization-package
type: guide
---
# @tripo3d/color-quantization

内部、本地 ESM 包。零运行时依赖，无构建步骤。不替换 Demo 的默认算法。上游来源、固定版本和许可限制见 [UPSTREAM.md](UPSTREAM.md)。

## 契约

```ts
interface QuantizationInput {
  triWorld: Float32Array // 每面 9 个世界坐标分量，非索引三角形
  triUV: Float32Array    // 每面 6 个 UV 分量，面顺序相同
  texture: { width: number; height: number; data: Uint8Array } // sRGB RGB8，逐行
  flipY: boolean         // true: 采样时把 v 换成 1-v；不翻转输入字节
}
```

- 单张贴图，无材质因子、顶点色、UV 变换或多贴图导入。
- 宽高必须是正有限整数；RGB 字节数严格等于 `width * height * 3`。
- 几何与 UV 必须有限；每面必须有正且有限的 float32 表面积。拒绝零面积、float32 溢出或下溢的面。
- UV 仅支持 `[0,1]`；拒绝 repeat wrapping。不自动裁剪、缩图或重采样。
- 输入使用普通 ArrayBuffer，拒绝共享缓冲区。调用期间不得修改输入或分析结果。
- `Analysis` 包含叶标签、所有可选 K 层和 SHA-256 内容绑定。绑定覆盖几何、UV、RGB、宽高与 flipY；同尺寸不同模型不能误用。分析完整性摘要用于检测误改，不是签名或不可信缓存认证。
- `getLevel`、`renderPreview`、`commit` 的 K 必须是 `1..maxSelectableColorCount` 的整数。无截断、无静默钳制。
- `renderPreview` 返回 `{ width, height, data: Uint8Array RGBA, palette, colorCount }`。`leafIndexMap===255` 的未覆盖像素输出透明黑；其余像素按当前层映射输出不透明 RGB。无标签膨胀，无网格重建。
- `commit` 使用上游字段：`P:Float32Array` 顶点、`T:Int32Array` 三角形索引、`lab:Int32Array` 每面调色板索引、`palette`、`K` 和 `cutStats/fairStats/weldStats`。检查有限坐标、索引、标签与非退化输出；遇到无效结果报错，不偷偷修复。
- 不识别语义部件。不提供 SKU、3MF 或可打印水密网格证明。CDT 可回退；失败次数见 `cutStats.cdtFail`。仍需单独检查闭合、流形、自交和切片器兼容性。

## 直接调用

```js
import { analyze, getLevel, renderPreview, commit } from '@tripo3d/color-quantization';

const input = {
  triWorld: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
  triUV: new Float32Array([0, 0, 1, 0, 0, 1]),
  texture: { width: 1, height: 1, data: new Uint8Array([255, 0, 0]) },
  flipY: false,
};
const analysis = analyze(input, {
  maxDistanceMatrixBytes: 128 * 1024 * 1024,
  progress: (stage, fraction) => console.log(stage, fraction),
  log: message => console.log(message),
});
const k = analysis.suggestedColorCount;
const level = getLevel(analysis, k);
const preview = renderPreview(analysis, k);
const mesh = commit(input, analysis, { colorCount: k });
```

这四个 API 都同步执行，会阻塞调用线程。`analyze` 的预算只限制 premerge 的 `Float64Array(n*n)` 距离矩阵，默认 128 MiB；不是总堆内存保证。预算必须是正有限安全整数。超限抛 `ERR_DISTANCE_MATRIX_BUDGET`，不更换聚类方法。预算允许的输入保持上游数值阶段、常量与运算顺序。

## Browser module Worker

```js
import { createQuantizationWorker } from '@tripo3d/color-quantization/worker';

const worker = createQuantizationWorker({
  onProgress: (stage, fraction, requestId) => console.log(requestId, stage, fraction),
  onLog: (message, requestId) => console.log(requestId, message),
  onError: error => console.error(error),
});
try {
  const analysis = await worker.analyze(input, { maxDistanceMatrixBytes: 128 * 1024 * 1024 });
  const k = analysis.suggestedColorCount;
  const level = await worker.getLevel(k);
  const preview = await worker.preview(k);
  const mesh = await worker.commit(k);
} finally {
  worker.dispose();
}
```

- Vite 消费端直接使用上述导入与默认构造。默认路径保留 `new Worker(new URL('./worker-entry.js', import.meta.url), { type: 'module' })`，供 Vite 识别并打包 Worker 及其依赖；无需手动复制包内模块。
- 无 bundler 时，可把包作为静态 ESM 模块提供，通过相对 URL 导入 `worker.js`；需同时提供包内入口及其相对依赖。浏览器必须支持 module Worker，服务需使用正确的 JavaScript MIME 类型。
- 根模块与 Worker 客户端均可在 Node 中安全导入；只在创建客户端时检查原生 `Worker`。缺少原生构造器且未注入适配器时抛 `ERR_WORKER_UNAVAILABLE`。
- 客户端与入口通过请求 ID 关联结果、日志、进度和错误；Worker 保留输入及分析缓存。响应采用 structured clone，不转移或分离调用者缓冲区。
- 首次成功分析之前、分析进行中、失败分析之后拒绝 K 请求；并发第二次分析被拒绝。成功后允许并发 K 请求，Worker 顺序执行。
- 再次分析替换缓存；失败分析使旧缓存失效。外部修改返回的分析不会修改 Worker 缓存。
- `dispose()` 终止 Worker，并拒绝全部待办；它不是同步内核的协作式中断。致命 Worker 错误同样清空待办，之后不可复用。
- 测试或自定义运行时可注入 `createWorker(url, { type:'module' })`，此路径绕过原生 Worker 构造。返回对象需支持 `postMessage`、`addEventListener/removeEventListener`（message/error/messageerror）及 `terminate`。注入方负责自己的入口解析与打包；Vite 标准用法不需要注入。Node 适配器与真实入口测试见 `test/node-worker-adapter.mjs`；适配器不进入分发包。

## 检查

由仓库根目录的 Node/TypeScript 环境执行；无需修改根 workspace、清单或锁文件：

```sh
cd packages/color-quantization
npm test
npm run test:types
# 可选独立 oracle：调用者先确认 checkout 为 UPSTREAM.md 的固定 SHA。
CQ_UPSTREAM=/absolute/path/to/pinned/color-quantization npm test
npm pack --dry-run
```

默认测试含解析式单色 golden、vendored 内核包装等价、叶映射/预览、网格合法性、缓存不变性、内容绑定、验证、矩阵预算和真实 worker_threads 消息。构造回归测试覆盖原生 Worker 的静态语法、Node 安全导入、缺少构造器的错误、默认路径的真实消息往返及注入路径。独立上游 oracle 测试仅在提供 `CQ_UPSTREAM` 时启用；不随包分发，也不自动下载。

构造语法与 Node 适配测试不能代替 bundler 验收。Vite 消费端需分别检查 dev 与 production build，并在真实浏览器中通过默认客户端完成 `analyze/getLevel/preview/commit/dispose`；静态 ESM 服务通过不等于 Vite 生产打包通过。

类型消费测试只加载 DOM，不同时加载 WebWorker lib。分发 files 白名单只含源码、声明和两份文档，排除测试、fixture、临时 checkout、node_modules 与凭据。

受控合成对比由仓库根目录执行：

```sh
node scripts/compare-quantization.mjs > comparison.json
```

脚本读取实际 `public/print-worker/worker.js` 并以 VM 执行 `init + preview`。输出 JSON：初始化、首次图缓存准备、分析、缓存 K 预览、有效颜色数、统一表面采样 ΔE00 和小色保留。旧输出逐面恒色，新输出逐纹素；不是同粒度端到端/渲染基准，不比较预览与完整 commit，不据合成样本宣称优胜。
