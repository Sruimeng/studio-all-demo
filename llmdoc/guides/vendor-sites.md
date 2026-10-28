---
id: vendor-sites
type: guide
---
# 厂商专属站点

`VITE_MATERIAL_VENDOR`：空值为综合站；`SUNLU` / `Polymaker` 为专属站。未知值中止构建。配置由 `@base/site` 持有，构建时确定，不接受 URL 参数切换。

专属站过滤内置供应商档案、系列和自动分色色卡；默认打开验证样件与本厂色卡。通用外观、本地材质和 USDA 导入继续可用。品牌标题与页头区分站点；原色卡及导出修改记录沿用既有契约。

每个站点使用独立域名和 IndexedDB 名称。保存仍限当前浏览器；不增加账号、服务端权限或共享存储。用户主动导入的材质和项目备份不作为权限隔离对象。

| 厂商 | Vercel 项目 | 生产网址 |
| --- | --- | --- |
| SUNLU | tripo-material-sunlu | https://tripo-material-sunlu.vercel.app |
| Polymaker | tripo-material-polymaker | https://tripo-material-polymaker.vercel.app |

发布：`node scripts/deploy-vendor.mjs SUNLU` 或 `node scripts/deploy-vendor.mjs Polymaker`。需已登录 Vercel 的项目所属团队。脚本按厂商构建，静态产物留在忽略目录 `artifacts/vendor-sites/<vendor>`；临时目录链接专属项目并上传预构建产物，不修改根目录的 Vercel 项目关联。

仅构建：增加 `--build-only`。本地预览使用对应产物目录；切换构建环境后需要重新构建。更新代码后分别运行两次发布命令；当前未配置自动发布。

验证：`pnpm test` 包含专属站初始化、目录、默认材质、配色候选、颜色覆盖保存与综合站兼容性。另运行类型检查、lint、各站生产构建；部署后检查 `READY`、生产域名 HTTP 200、标题、`material-vendor` meta 与浏览器厂商/色卡列表。
