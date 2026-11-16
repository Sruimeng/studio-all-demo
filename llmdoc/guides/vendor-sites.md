---
id: vendor-sites
type: guide
---
# 厂商专属站点

`VITE_MATERIAL_VENDOR`：空值为综合站；`SUNLU` / `Polymaker` / `eSUN` 为专属站。未知值中止构建。配置由 `@base/site` 持有，构建时确定，不接受 URL 参数切换。

专属站过滤内置供应商档案、系列和自动分色色卡；默认打开验证样件与本厂色卡。通用外观、本地材质和 USDA 导入继续可用。品牌标题与页头区分站点；原色卡及导出修改记录沿用既有契约。

每个站点使用独立域名和 IndexedDB 名称。专属站的材质库自动同步至私有 GitHub 仓库；综合站仍仅在当前浏览器保存。用户主动导入的材质和项目备份不作为权限隔离对象。

| 厂商 | Vercel 项目 | 生产网址 |
| --- | --- | --- |
| SUNLU | tripo-material-sunlu | https://tripo-material-sunlu.vercel.app |
| Polymaker | tripo-material-polymaker | https://tripo-material-polymaker.vercel.app |
| eSUN | tripo-material-esun | https://tripo-material-esun.vercel.app |

发布：`node scripts/deploy-vendor.mjs SUNLU` 、`node scripts/deploy-vendor.mjs Polymaker` 或 `node scripts/deploy-vendor.mjs eSUN`。需已登录 Vercel 的项目所属团队。脚本按厂商构建，静态产物与 Node.js 24 函数分别留在忽略目录 `artifacts/vendor-sites/<vendor>`、`artifacts/vendor-functions/<vendor>`；临时目录链接专属项目并上传预构建产物，不修改根目录的 Vercel 项目关联。

仅构建：增加 `--build-only`。本地预览使用对应产物目录；切换构建环境后需要重新构建。更新代码后分别运行对应厂商的发布命令；当前未配置自动发布。

验证：`pnpm test` 包含专属站初始化、目录、默认材质、配色候选、颜色覆盖保存与综合站兼容性。另运行类型检查、lint、各站生产构建；部署后检查 `READY`、生产域名 HTTP 200、标题、`material-vendor` meta 与浏览器厂商/色卡列表。

eSUN 尚未导入官方 SKU 色卡，默认展示 `esun-basic` 系列的中性通用预览，不计为官方 SKU。可在系列下添加颜色、颜色号、绑定外观并保存。空色卡的模型区域沿用源颜色或自由分色，不生成供应商近似匹配；之后导入官方色卡可补充匹配候选。

## GitHub 材质库

契约：`SharedLibrary = { version: 1, vendor, materials, supplierEdits }`。仓库 `Sruimeng/studio-material-data`，分支 `main`，文件 `materials/sunlu.json` / `materials/polymaker.json` / `materials/esun.json`。只同步创建、导入的材质及供应商覆盖；模型、项目、几何和 Viewer 设置保留现有存储方式。每厂最多 500 条、JSON 3 MB；超限保留本地数据并显示错误。

`api/materials.ts` 只读写构建固定的厂商文件。生产环境需要 `MATERIAL_GITHUB_TOKEN`、`MATERIAL_GITHUB_REPOSITORY`，可选 `MATERIAL_GITHUB_BRANCH`（默认 main）。令牌仅授权数据仓库的 Contents 读写，作为 Vercel sensitive 服务端变量保存；不得使用 `VITE_` 前缀，不进入源码、静态产物或客户端响应。

流程：打开站点 → GET 文件及 SHA → 与本地基线三方合并 → 原子写入 IndexedDB 两类材质 → 有差异时 PUT。已有材质的有效编辑延迟 650 ms 保存本地，绑定变更立即保存本地；同步延迟 1.5 s 合并写入。新建 SKU 仍需首次点击保存。顶部显示读取、待同步、保存、成功、失败或冲突。离开未完成保存的页面会提示；断网后本地保留，恢复网络或点击重试继续同步。

PUT 以 GitHub 文件 SHA 比较后更新，无变化不生成提交。并发修改不同材质自动合并；同一材质冲突由用户选择本机或远端版本，非冲突修改保留，处理前缓存本机备份。不做字段级协同和实时推送；其他设备打开或重新加载页面读取最新库。

供应商源色卡由服务端内置档案重建，模型预览颜色与外观参数单独保存，GitHub JSON 包含 `supplierModifications` 的源值与修改值。JSON / CSV 手动导出继续可用。

无账号与用户权限：持有站点网址的人可通过该站接口修改对应厂商库。厂商隔离靠固定服务端文件路径，不等同于用户身份验证。后续若需限制编辑人员，另接账号与授权。

自动化证据：`test/material-sync.spec.ts` 覆盖三方合并、离线重试、保存中继续编辑、冲突选择与备份；`test/material-api.spec.ts` 覆盖固定厂商、原色卡、修改记录、SHA 冲突、无变化不提交、跨站写入和体积限制。
