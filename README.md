---
id: readme
type: guide
---
# Tripo Material Studio

独立、免登录的材质与多色打印展示工作台。GLB / FBX → 自动分色 → 区域换材质 → 耗材预览 → CSV / JSON / 3MF。工作台壳层、Viewer 背景、方向控件和材质面板对齐 Tripo Studio，支持中英文。

## 运行

Node.js 22+，pnpm 10：

```sh
pnpm install --frozen-lockfile
pnpm dev
```

打开 http://127.0.0.1:3100 。

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
python3 -m http.server 3101 --bind 127.0.0.1 --directory .output/public
```

静态产物在 `.output/public`，部署在站点根路径。无需后端。WebGL、Worker、IndexedDB 和 OffscreenCanvas 需要现代浏览器；生产环境使用 HTTPS。

## 演示

1. 默认打开原创宇航员样例；也可选择一个 GLB / FBX，FBX 配套贴图在同一次选择中加入。
2. 选择 1–12 色，生成分色。Surface 使用面标签，UV texture 使用纹理标签与三角细分。
3. 默认进入原模型与材质的对比视图。拖动中间分割线调整左右比例；点击区域，再应用右侧材质，更换材质不会重算区域。
4. 新建材质，填写唯一材质 ID、名称与颜色，调透明度、金属度、粗糙度。模型实时预览；保存写入材质库，取消恢复。右侧小球仅作色卡装饰。
5. 打印高度 10–320 mm，默认 80 mm；可开启 0.2 mm 层纹，切换原模型、材质或同步相机对比。首次进入默认中文，语言切换会保存在当前浏览器。
6. 保存项目后可刷新恢复。项目与备份面板可切换项目、导出 ZIP 备份和恢复备份。
7. 勾选部分材质或导出全部 CSV / JSON；顶部导出当前区域 3MF。四色自检文件用于检查区域叶编码。

`public/samples/atelier.glb` 为本仓库生成的演示资源，可用 `node scripts/create-samples.mjs` 重建。真实测试模型不随产物分发。

## 数据与边界

- `MaterialRecord`：稳定内部 ID、唯一用户 ID、名称、sRGB HEX、透明度、金属度、粗糙度、参考图。RGB 从 HEX 无损推导，CSV 显式包含 RGB。
- `PrintProject`：原模型及配套文件、区域快照、材质绑定、打印尺寸、分色参数。模型文件仅写浏览器 IndexedDB。
- `RegionAssignment`：区域序号、原始分色颜色、材质快照。相同颜色不同 ID 保持独立。
- JSON 含格式版本、材质数据、区域映射及完整选区快照；ZIP 额外携带模型。恢复 ZIP 会用备份材质库替换当前库。
- CSV / JSON 记录输入值。渲染粗糙度为 `0.5 + 0.5 * (roughness * roughnessMap.g)`；无贴图时采样值为 1。透明度映射为 `opacity = 1 - transparency`。源模型物理透光参数保留，不提供透光编辑。
- 3MF 使用毫米、统一色槽与材质 ID，附 `Metadata/materials.json`；透明度和金属度只用于预览。没有验证指定切片器或实际打印结果。
- 已装配 Meshopt。未装配 Draco / KTX2 解码器，相关资源会明确报错。
- FBX 缺少的金属度/粗糙度使用 0/1；已有 Phong 信息按移植规则换算。缺失、歧义或无法解码的贴图会显示提示。
- 顶点色与贴图同时调色时保留原显示，并按线性空间乘积做表面分色；该材质的低模路径使用表面投影，修色需使用 Surface 模式。UV 重叠岛共用纹理标签。
- 保存是显式操作。浏览器清除站点数据会清除本地项目，跨设备或外发使用 ZIP 备份。

架构与来源见 [llmdoc/index.md](llmdoc/index.md)，验证记录见 [llmdoc/guides/verification.md](llmdoc/guides/verification.md)。
