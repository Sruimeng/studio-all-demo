---
id: readme
type: guide
---
# Tripo Material Studio

独立、免登录的材质与多色打印展示工作台。GLB / FBX → 耗材验证 / 自动分色 → 区域绑定 SKU → CSV / JSON / 3MF。内置 Polymaker Panchroma PLA 数据与 OpenPBR 参数子集预览，支持中英文。

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
2. 选择最多 1–12 个耗材，生成分色。模型采样色自动匹配到 Polymaker SKU；区域卡显示颜色名、材料类型、代表色 → 色卡 HEX 与近似 ΔE00。Surface 使用面标签，UV texture 使用纹理标签与三角细分。
3. 默认进入原模型与材质的对比视图。拖动中间分割线调整左右比例；点击区域，再应用右侧材质，更换材质不会重算区域。
4. 新建本地材质，或从 Polymaker 库搜索 SKU、颜色名、材料类型。色卡只展示颜色；表面效果在中央 3D 视图评估。调整参数时实时预览，保存写入本地，取消恢复。
5. 打印高度 10–320 mm，默认 80 mm；可开启 0.2 mm 层纹，切换原模型、材质或同步相机对比。首次进入默认中文，语言切换会保存在当前浏览器。
6. 保存项目后可刷新恢复。项目与备份面板可切换项目、导出 ZIP 备份和恢复备份。
7. 勾选部分材质或导出全部 CSV / JSON；顶部导出当前区域 3MF。四色自检文件用于检查区域叶编码。

`public/samples/atelier.glb` 为本仓库生成的演示资源，可用 `node scripts/create-samples.mjs` 重建。真实测试模型不随产物分发。

## Polymaker 验证

1. 点击「打开标准样件」，进入「材质验证」；也可导入实物样件对应的 GLB / FBX。
2. 选择 SKU，整模应用材质并保留源几何与法线。固定 Studio HDR、ACES、曝光 1、环境强度 1、旋转 0；层纹默认关闭。
3. 默认使用表格 HEX。供应商颜色空间未确认，编辑器提供线性 sRGB / sRGB 两种试验解释。源颜色原值保留；本地 HEX 调整优先。
4. 参数调整保存在独立供应商覆盖库，可恢复供应商参数。保存项目或 ZIP 备份保留预览模式、环境配置、选中 SKU 和区域快照。
5. 切换「区域应用」，生成分色自动匹配 SKU，也可手动替换后导出 3MF。更换 SKU 不重算标签；「材质验证」期间禁用 3MF 导出。

首批表格有 26 个 SKU，ZIP 有 16 份 USDA：14 个对应、12 个仅颜色、2 个未对应。自动分色在 26 个色卡候选中，用 HEX 推导的 sRGB/D65 Lab 和标准 CIEDE2000 选近似 SKU。本地预览调整不改变匹配依据；ΔE00 是生成时采样色至色卡的面积加权平均，不是实物误差。未对应 SKU 可查看来源，暂不能应用。异常 Lab、颜色名冲突、越界颜色及文件名后缀均显示待复核提示。

本批无外部贴图，透射、清漆等权重为零。网页使用 Three.js 的 OpenPBR 参数子集，尚未验证 Blender 对照与实物一致性。对比视图左侧仍是原模型。标准样件含平面、曲面、连接在平面顶部的薄壁；打印高度会统一缩放壁厚。本批不透明材质不能验证透射。

```sh
python3 scripts/import-polymaker.py '颜色数据.xlsx' 'PLA_Basic.zip'
node scripts/create-material-check.mjs
```

转换脚本只支持本批单个 OpenPBR 节点的常量输入；外部资源、组合和有效连接输入会报错。完整契约见 [供应商材质](llmdoc/reference/supplier-materials.md)。

## 数据与边界

- `MaterialRecord`：稳定内部 ID、唯一用户 ID、名称、sRGB HEX、透明度、金属度、粗糙度、参考图。RGB 从 HEX 无损推导，CSV 显式包含 RGB。
- `PrintProject` v2：原模型及配套文件、区域快照、材质绑定、打印尺寸、分色参数、完整预览配置与验证材质。兼容 v1 项目；旧材质保留 Studio 规则。模型文件仅写浏览器 IndexedDB。
- `RegionAssignment`：区域序号、模型代表色、材质快照；可选 `RegionColorMatch` 保留匹配依据、稳定材质 ID、色卡 HEX、平均 ΔE00 与采样面积比例。手动换材质清除匹配记录，旧项目恢复原绑定，重新分色替换当前绑定。相同颜色不同 ID 保持独立。
- JSON 含格式版本、来源、原始 USDA 材质文本、本地调整、区域映射及完整选区快照；ZIP 额外携带模型与供应商覆盖库。恢复 ZIP 会替换本地材质库，v2 同时替换供应商覆盖库。
- CSV 包含展示 HEX/RGB、SKU、材料类型、Pantone、D65 Lab、文件版本与问题标记；未对应 SKU 的颜色为空。Studio 粗糙度为 `0.5 + 0.5 * (roughness * roughnessMap.g)`；OpenPBR 子集直接使用输入粗糙度。透明度映射为 `opacity = 1 - transparency`，不等同于透射。
- 3MF 使用毫米、统一色槽与 SKU，附 `Metadata/materials.json` v2；材料类型和品牌来自供应商，本地未知材料类型为 `Unknown`。PBR 外观参数仅作附加元数据，不转换成切片器贴图或打印工艺。没有验证指定切片器或实际打印结果。
- 已装配 Meshopt。未装配 Draco / KTX2 解码器，相关资源会明确报错。
- FBX 缺少的金属度/粗糙度使用 0/1；已有 Phong 信息按移植规则换算。缺失、歧义或无法解码的贴图会显示提示。
- 顶点色与贴图同时调色时保留原显示，并按线性空间乘积做表面分色；该材质的低模路径使用表面投影，修色需使用 Surface 模式。UV 重叠岛共用纹理标签。
- 保存是显式操作。浏览器清除站点数据会清除本地项目，跨设备或外发使用 ZIP 备份。

架构与来源见 [llmdoc/index.md](llmdoc/index.md)，验证记录见 [llmdoc/guides/verification.md](llmdoc/guides/verification.md)。
