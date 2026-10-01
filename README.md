# Sekai Dota Helper

给熟悉 Dota 2、但总在同一类决策上犯错的玩家使用的桌面训练提示层。它不读取或修改游戏内存，也不替玩家执行操作；只显示赛前准备的笔记、出装路径和时间节点。

安全边界见 [SECURITY.md](SECURITY.md)：不接触 Dota/Steam 进程、不读实时游戏数据、不截屏识别、不注入、不模拟输入。发布前运行 `npm run security:vac-boundary`。

## 当前版本

- Windows 优先的透明、无边框、始终置顶窗口
- 英雄可配置多套位置/打法策略
- 127 名英雄的头像选择器，按力量/敏捷/智力/全才分组，支持中文、英文和俗称搜索
- 英雄策略包含一句话概括、纯物品出装路径和可选时间点
- 独立的英雄策略与位置策略编辑器，本地保存多套策略并合并两边时间轴
- 1–5 号位专属时间轴
- 支持从 `0:00` 开始或输入当前游戏时间手动校准
- 临近莲花、经验符、强化符等节点时高亮和系统通知
- F8 全局快捷键切换鼠标穿透，避免挡住游戏操作
- 设置保存在本机 `localStorage`

首版内置水晶室女、祈求者、斧王、敌法师作为数据结构和交互样例。继续补英雄时只需在 `src/data.ts` 中增加策略数据。

## 本地运行

需要 Node.js 20+、Rust stable，以及 Tauri 的 Windows 前置依赖。

```bash
npm install
npm run desktop:dev
```

只看网页界面：

```bash
npm run dev
```

构建 Windows 安装包：

```bash
npm run desktop:build
```

建议把 Dota 2 设为“无边框窗口”，独占全屏通常会盖住普通桌面叠加层。

## 同步完整图标资源

界面默认直接使用 Steam CDN，仓库不提交 Valve 图片。Windows PowerShell 可一次下载当前完整英雄和装备图标，并缓存 OpenDota 常量：

```powershell
npm run assets:sync
```

文件会写入 `public/assets/dota/`（已加入 `.gitignore`）。脚本以 OpenDota 常量获取当前名称和路径，实际图片来自 Steam CDN。发布前应再次核对 Valve 对素材和商标的使用要求，并在应用内加入明确的非官方声明。

英雄和物品的本地中文目录可重新同步：

```bash
npm run data:sync
```

该命令合并 Valve 简体中文 datafeed 与 OpenDota 常量，生成 `src/catalog/heroes.json` 和 `src/catalog/items.json`。中文玩家俗称由项目单独维护，避免上游刷新时丢失。

## 数据方向

后续建议把 `src/data.ts` 拆成：

- `heroes.json`：英雄基础信息
- `strategies/{hero}.json`：英雄的多套攻略
- `timelines/{role}.json`：位置公共时间轴
- 用户目录中的覆盖文件：保存个人笔记，避免升级覆盖

时间轴目前按用户提出的节点做了首版示例。Dota 版本更新可能改变刷新规则，因此正式发布前需按当前补丁复核，并给每套数据标记适用版本。
