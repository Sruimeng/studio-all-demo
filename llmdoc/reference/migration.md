---
id: migration
type: reference
---
# 移植来源

Studio 基准：`/Users/sruim/Desktop/projects/agent/fe-tripo-studio`，提交 `4873ac3c6bc537c8ff47d9bc306c4d0eaab25919`。
原型：`/Users/sruim/Downloads/app`。两个来源工程保持原状。

| 来源 | 当前模块 | 适配 |
| --- | --- | --- |
| Studio GLTF/FBX loaders、几何与材质元数据 | `app/@engine/import` | 本地路径解析、Meshopt、资源回收、保留贴图与标量 PBR；移除无贴图强制 Matcap |
| Studio model controller/platform、resources、material bindings | `app/@engine/model` | 保留 Content/Presentation 生命周期，公开能力入口 |
| Studio Engine、粗糙度处理、HDR | `app/@engine/viewer`、`public/studio.hdr` | 本地宿主、耗材 MeshPhysicalMaterial、层纹、原模型与耗材同相机对比 |
| app 色彩算法、调色板、几何加速、UV 细分 | `public/print-worker` | 独立 Worker、项目/请求/编辑版本校验、统一网格和持久化快照 |
| app 区域涂色与 3MF | `public/print-worker/export3mf.js` | 区域色槽、材质 ID、毫米尺度、材质参数 JSON；同色材质不合并 |
| app 字体 | `public/fonts` | 本地静态字体 |

没有迁入 app 的 Viewer，也没有迁入 Studio 的账号、云资产、生成、支付及业务 API。

版本以 `pnpm-lock.yaml` 为准。Three 0.183.2、Engine 0.2.12；Nuxt 4、Vue 3、Pinia、UnoCSS 与 TypeScript。

新增业务由 `@feature/workspace` 编排；页面不读 Worker 内部状态。Controller 管内容切换，Presentation 管显示材质，Viewer 管 GPU / 输入，Worker 管标签。导入失败保留旧内容；候选内容及 Worker 在失败时释放。
