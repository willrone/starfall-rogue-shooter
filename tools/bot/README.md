# Starfall Bot — 自动化数值测试系统

## 目录结构

```
tools/bot/
├── README.md              ← 本文件
├── requirements.txt       ← pip install -r requirements.txt
├── bot.py                 ← 主入口: 启动预览, 循环模拟 N 局
├── engine.py              ← 键盘/窗口控制封装 (pyautogui / pynput)
├── strategy.py            ← 升级/商店/撤离决策逻辑
├── recorder.py            ← 读取 HUD + __botData → CSV
└── analyze.py             ← CSV → 报表 + 图表
```

## 工作流程

```
python3 bot.py --runs 50 --out data/
```

1. 启动 Cocos Creator 预览 (Open in Browser → Chrome)
2. 每局: 进入战斗 → WASD 随机走 → 升级按 1 → 商店买首项 → 死亡/撤离 → 循环
3. 每帧读取 `window.__botData` 数组 → 写入 CSV
4. 50 局后 → 输出: `data/runs.csv` + `data/summary.txt`

## 游戏键盘快捷键 (已合入主代码)

| 按键 | 功能 |
|------|------|
| `W/A/S/D` | 移动 |
| `Q/E` | 切换武器 |
| `1/2/3` | 升级/商店/机库选项选择 |
| `S` | 打开/关闭商店 |
| `R` | 撤离战斗 |
| `B` | 从机库开始战斗 |
| `H` | 返回机库/从暂停回机库 |
| `F1` | 开关调试 HUD |
| `ESC` | 暂停/恢复/返回 |
| `T` | 跳过死亡复活（放弃） |

## 输出数据格式

每局一条 CSV:

```csv
run,weapon,time,level,boss_kills,kill_count,wave,alloy,hp_avg,dps,extract
1,storm-rifle,243.5,12,1,256,8,184,14200,false
```

## 自定义策略

编辑 `strategy.py` 的 `chooseOption(state)` 函数:

```python
def chooseUpgrade(choices, state) -> int:
    # choices 是当前三个升级选项
    # 返回 index 0/1/2
    # 默认: 选攻击力最高的
    return 0 if choices[0].effects[0].amount >= choices[1].effects[0].amount else 1
```

## 前置条件

1. Cocos Creator 3.8.8 安装
2. `pip install pyautogui pillow` 或 `brew install --cask adoptopenjdk` (macOS 权限)
3. Chrome 已安装
4. 游戏项目在 `/Users/ronghui/Documents/game_dev_cocos`

## macOS 权限

首次运行 pyautogui 需要给终端/IDE 辅助功能权限:
系统设置 → 隐私与安全性 → 辅助功能 → 勾选 Terminal
