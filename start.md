# OfferFlow 启动指南

## 快速启动

```bash
cd offerFlow-llm-feature
npm install        # 仅首次需要
npm run dev        # 启动开发服务器
```

浏览器打开 http://localhost:3000

## 登录账号

| 用户名 | 密码 | 说明 |
|--------|------|------|
| `zhou` | `jiABNHDv9qD8mp3` | 主账号，37 条岗位数据 |
| `user` | `000000` | 演示账号，14 条演示数据 |

## AI 面试分析配置（可选）

登录后进入 **设置 → AI 模型配置**，填入你的 LLM API Key：

| 提供商 | Base URL | 默认模型 |
|--------|----------|----------|
| DeepSeek | `https://api.deepseek.com` | `deepseek-chat` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` |
| 硅基流动 | `https://api.siliconflow.cn/v1` | `Qwen/Qwen2.5-7B-Instruct` |

点击「测试连接」验证可用后保存。配置保存在浏览器本地存储，不会上传到服务器。

## 功能说明

- **看板** — 10 列 Kanban，拖拽变更岗位状态
- **岗位库** — 表格视图，按状态/城市/渠道筛选，支持批量删除和导出
- **简历舱** — 多版本简历管理，支持本地上传（IndexedDB 持久化）
- **日程** — 待办任务管理，支持关联岗位
- **面试复盘** — 8 维评分 + AI 智能分析（上传 .docx 录音整理，AI 自动评分）
- **数据洞察** — 投递漏斗图、面试评分趋势、薄弱项统计
- **设置** — LLM 配置、主题切换

## 数据存储

- **数据库**：`prisma/dev.db`（SQLite 本地文件）
- **API Key**：浏览器 localStorage，不经过服务器
- **简历文件**：浏览器 IndexedDB 存储
- 定期备份 `prisma/dev.db` 即可保留全部数据

## 分享给他人

将整个项目文件夹打包发送（排除 `node_modules` 和 `.next`），对方解压后执行：

```bash
npm install
npm run dev
```

直接用上面的账号密码登录即可，所有数据都在。
