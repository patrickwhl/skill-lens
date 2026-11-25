# Skill Lens

Skill Lens 是一个在本机运行的技能管理面板。它扫描 Codex、Claude Code、WorkBuddy 以及项目技能目录，按名称显示每份 `SKILL.md` 的来源和路径。可以搜索、筛选、收藏以及重新扫描。

## 使用

需要 Node.js 20 或更新版本。无需安装依赖。

```sh
git clone https://github.com/patrickwhl/skill-lens.git
cd skill-lens
npm start -- --project /path/to/your/project
```

浏览器打开 <http://127.0.0.1:4317>。用 Ctrl+C 退出。仅查看虚构演示数据时运行 `npm start -- --demo`。

默认范围包括项目的 `.agents/skills`，以及用户目录下的 `.agents/skills`、`.codex/skills`、`.claude/skills` 和 `.workbuddy/skills`。项目默认为启动时的工作目录。需要扫描本地知识库或其他技能目录时，使用 `--root /path/to/skills`，可以多次指定。使用 `--port 4318` 可更改端口。

## 状态含义

| 状态 | 判定方式 |
| --- | --- |
| 单一入口 | 扫描范围内只看到一个入口 |
| 同一文件 | 同名入口解析到同一个物理文件 |
| 说明相同 | 同名入口解析到不同文件，但 `SKILL.md` 字节相同 |
| 不同版本 | 同名入口的 `SKILL.md` 字节不同 |

扫描结果是目录盘点。各工具的启用状态、加载顺序和脚本依赖以各工具为准。判断依据是 `SKILL.md`，技能包的参考资料和脚本可能另有差异。扫描会跳过常见资源目录和已识别技能包内部的嵌套内容。

工具只监听本机地址，浏览器也从本机读取清单。技能文件保持原状。收藏保存在当前浏览器，按技能名称索引。仓库中的演示数据为虚构内容。

运行 `npm test` 验证扫描、链接、目录分类以及本机服务的访问规则。

## License

MIT
