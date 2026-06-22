# 「我的画像」(My Persona) — 方向稿

状态:**方向**(已定调,未到 build spec)。多 Agent 全网调研 + Snowan 真实代码核验 + 对抗式挑刺,2026-06-22。
一句话:**把现在分裂的两份"关于你"合并成一份带 6 节的 canonical L3 画像;对话访谈起草 → 用户批准 → 设置可改;可跳过的首次引导;靠现有"整理记忆"流持续进化。一个 store、两个视图、写入只走"用户批准"。**

## 0. 起点:分裂**已经在代码里**(这是收口,不是从零造)
`agent/build.py` 此刻就把**两份独立的"关于你"**拼进每轮 system prompt:
- `prefs.profile`(称呼/所在地/备注,存 `~/.snowan/config.json`)→ "关于用户" 块
- `memory.profile_text()`(L3 `PROFILE.md`「Snowan 记得你」)→ "用户长期画像" 块

两个 blob、两个文件、两个编辑器(`SettingsProfile.tsx` vs `SettingsMemory.tsx`)。**统一 = 把这两块塌成一块**,工作量比想象小。

## 1. 它是什么
= Snowan 已锁的 **4 层记忆里的 L3 画像层**:一份用户可读可编辑的 `~/.snowan/memory/PROFILE.md`,6 个命名分节,每轮注入对话,让助手"真懂你"。
canonical 选 `PROFILE.md`(已有写时备份、批准式写入路径、"L3 绝不自动写"红线、前端散文视图),**不选** `prefs.profile`(秘密文件里三个裸字段)。
**保住 4 层**:只合并 `prefs.profile` ↔ L3,**不塌 L2(原子事实"记得的事",会衰减、按相关性检索)↔ L3(画像,稳定、常驻、不衰减)**。

## 2. 结构:6 节(Markdown `##` 约定,不是 schema 迁移)
`成长背景&时代 / 家庭 / 工作 / 长期规划 / 短期规划 / 个人习惯`
内容铁律——**存"可执行的提炼",不存标签/形容词**:
- 成长&时代:存它解析出的语气/参照系/正式度,**不存"90后"**;且必须用户确认,**绝不由年龄 AI 推断**(否则=刻板印象)。
- 家庭:只存**能约束建议**的(如"两个学龄前娃→排程要现实"),不存花名册/生日。最敏感、最小化。
- 工作:角色 + 在做什么 + 常用术语。
- 长期/短期规划:**最高杠杆**(让助手能排优先级、说不);短期带"上次确认"时间,过久触发"还准吗?"。
- 习惯:存**可测约束**("回复默认 N 句内、代码优先"),不存"我喜欢简洁";交互语气也在这。
**没有硬必填节**;访谈只覆盖 2-3 个高信号节(工作+长/短规划),其余显式标空"还没聊到,点这补充"。

## 3. 合并什么 / 留什么
**合并**:`prefs.profile`(称呼/所在地/备注)迁进 `PROFILE.md` 分节;`build.py` 两个注入块 → **一块**(删 prefs.profile 块,留 `PROFILE.md` 块);`SettingsProfile` 表单 → 折进分节画像编辑器(在 `SettingsMemory` 里)。
**保留**:L2 事实与 L3 画像分开;L1 daily logs 不动;`memory_consolidate` 的 propose/apply **批准门 = AI 编辑 L3 的唯一写路径**。
净结果:**一个 canonical store、L2/L1 不变、一个注入块、一个编辑入口**。(`prefs.profile.name` 可留一个给非 LLM 场景要个快速称呼,别再往里长画像。)

## 4. 注入(选择性,不污染上下文)
- 聊天:保 `build.py` 的 `profile_text()` 块,迁移后删 prefs.profile 块。注意 instructions **字节稳定**(吃 prompt cache)——画像本就稳定,合适;深度细节别塞常驻块。
- **「今天」规划:现在 `daily_summarize`/`daily_assembly` 根本没带画像** → 把画像(至少规划两节)注进去。早计划/明日重点的质量正是长/短规划该落地的地方。**这是个真缺口+赢点。**
- 隐私:常驻画像每轮上云 → 分节结构是未来"某节不发云端"的前提(家庭>工作敏感);v1 不做,但结构先留。现有 `memory_enabled` 暂停开关可作隐私兜底。

## 5. 对话访谈(复用现成 pattern,别造新循环)
复用 `memory_consolidate.propose()/apply()` 的一次性套路(draft→approve、结构化输出、不静默写、模型失败兜底)。
新模块 `persona_interview.py`(与 `memory_consolidate.py` 平行):5-7 个轻问题、一次一个、引用上一轮、模糊只追问一次;收齐后**一次 Agent 调用** `output_type=Persona`(6 节,空的标缺口);草稿作为可改文本返回;**接受 = `memory.set_profile()`**(已备份的 canonical L3 写)。路由加进 `server/memory.py`(已有 `/profile`)。无模型时直接进空的可编辑分节,不报错。同时设置里可编辑。

## 6. 可跳过引导 + 进化
- **首次引导**(net-new 但小):`config.py` 的 `PREF_DEFAULTS` 加 `onboarded: False`;`onboarded==False` 时显示**可关的引导卡**(主壳或「今天」面板),**永不阻塞**;跳过/完成都置 True;中途退出存 partial。**别拿"PROFILE.md 是否为空"当触发**(手动编过记忆的人不该被打扰)。
- **进化**:`memory_consolidate` 已是引擎——给 `Promotion` 加 `section` 字段,`apply` 写进对应节(而非追加扁平 bullet),被取代的行 **update-not-append**;`_SYSTEM` 提示加"promotion 定向到 6 节之一"。surfacing 仍走现有点按的"整理一下记忆"卡。用户写的行被 AI promotion 覆盖时,**标为冲突**让用户定,不静默合并。

## 7. 红线(全是 Snowan 现有约束)
绝不静默写 L3(每次变更都出可见草稿/diff,用户接受/改/拒)· 无 cron(访谈点按触发、进化搭点按的整理流)· 选择性注入不撑爆 · 隐私(分节为未来本地化留口)。

## 8. ⚠️ 协作风险(最重要,决定要不要现在动)
这功能**深度改记忆子系统**,而那正是高频在动的地方:
- `SettingsMemory.tsx` —— **最易撞**(最近 ~8 个记忆提交里 6 个动了它)。
- `memory.py` / `memory_consolidate.py` —— Phase 3 刚落,核心要扩(分节、section-aware promotion),维护者可能还在调。
- `build.py` `_instructions()` —— 删 prefs.profile 块是合并的承重改动,且每轮共享 + 字节稳定约束。
**结论:不建议我此刻自主并行去改这些文件**(会和你/你那个并行会话的记忆工作撞车)。低风险、可先行的部分:`config.py` 加 `onboarded`、`server/system.py`、`server/knowledge.py` 注入画像进「今天」、新 `persona_interview.py`(新文件)。

## 分期
- **P1**:6 节 canonical `PROFILE.md`(约定 + 一次性把 prefs.profile 迁入)· 合并 `build.py` 注入为一块 · 设置里的分节画像编辑器 · 注入画像进「今天」规划 · `onboarded` 标志 + 可跳过引导卡。
- **P2**:对话访谈起草(`persona_interview.py`,draft→approve)。
- **P3**:section-aware 进化(`memory_consolidate` 的 Promotion 带 section + update-not-append)。
- **不做**:后台自动进化定时器、把 L2 事实塞进画像、年龄→标签的 AI 推断、向量化不可读画像、per-section 云端开关(v1 只留结构)。
