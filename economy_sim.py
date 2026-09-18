#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
《老街新生》经济数值仿真脚本
配套: 数值设计文档.md (第 1-6 章公式) / 产品需求文档PRD.md (P0)

功能:
  1. 按公式计算前 N 级的 客流量/客单价/秒产出/升级成本/回本时间
  2. 健康度诊断: 回本时间是否单调缓升、有无断点、成本增速约束 r_c>r_s
  3. 挂机进程仿真: 从 0 金币纯挂机, 估算升到各等级的累计耗时
  4. 每日租金压力比校验
  5. 离线收益示例计算
所有参数集中在 PARAMS, 改参数即可即时看到经济变化。
"""

# ============ 可调参数区 (对应 数值设计文档 §0.3 / §7) ============
PARAMS = {
    # 店铺 (示例: 首店"配钥匙铺")
    "T_base": 100.0,   # 1级基础客流量(人/小时)
    "a_t":    0.12,    # 客流量每级线性增长率
    "S_base": 10.0,    # 1级基础客单价
    "r_s":    1.08,    # 客单价每级增长率(指数)
    "C_base": 50.0,    # 首次升级基础成本
    "r_c":    1.10,    # 成本增长率 (必须 > r_s)
    # 全局
    "G":      1.5,     # 全局增益系数 (P0: 1 + promo_buff, 示例 promo=0.5)
    # 离线
    "eta_off":   0.5,      # 离线效率
    "t_off_max": 8*3600,   # 离线封顶(秒)
    "k_ad":      2.0,      # 广告翻倍
    # 每日结算
    "rent_base": 200.0,    # 首日租金
    "r_rent":    1.15,     # 租金每日增长率
    # 仿真范围
    "MAX_LEVEL": 50,
    "SIM_DAYS":  10,
    # 健康度阈值 (§8.1)
    "PB_MIN": 30,          # 回本时间下限(秒) — 过低=升级太廉价
    "PB_MAX": 30*60,       # 回本时间上限(秒) — 过高=卡关
    "RENT_RATIO_MIN": 0.10,
    "RENT_RATIO_MAX": 0.30,
}


def traffic(L, p):
    return p["T_base"] * (1 + p["a_t"] * (L - 1))


def spend(L, p):
    return p["S_base"] * (p["r_s"] ** (L - 1))


def rate_per_sec(L, p):
    """单店秒产出 R_i = T(L)*S(L)/3600 (未含全局增益)"""
    return traffic(L, p) * spend(L, p) / 3600.0


def upgrade_cost(L, p):
    """从 L 升到 L+1 的成本 C(L)"""
    return p["C_base"] * (p["r_c"] ** (L - 1))


def payback_seconds(L, p):
    """回本时间 PB(L) = C(L) / (ΔR(L) * G)"""
    dR = (rate_per_sec(L + 1, p) - rate_per_sec(L, p)) * p["G"]
    if dR <= 0:
        return float("inf")
    return upgrade_cost(L, p) / dR


def rent(day, p):
    return p["rent_base"] * (p["r_rent"] ** (day - 1))


def fmt_time(sec):
    if sec == float("inf"):
        return "∞"
    if sec < 60:
        return f"{sec:.0f}s"
    if sec < 3600:
        return f"{sec/60:.1f}m"
    if sec < 86400:
        return f"{sec/3600:.1f}h"
    return f"{sec/86400:.1f}d"


def fmt_num(n):
    if n == float("inf"):
        return "∞"
    for unit, div in [("B", 1e9), ("M", 1e6), ("K", 1e3)]:
        if abs(n) >= div:
            return f"{n/div:.2f}{unit}"
    return f"{n:.1f}"


def print_level_table(p):
    print("=" * 82)
    print("【前 N 级 成长曲线】(单店, G=%.2f)" % p["G"])
    print("=" * 82)
    print(f"{'Lv':>3} {'客流量/h':>10} {'客单价':>12} {'秒产出×G':>12} "
          f"{'升级成本':>12} {'回本时间':>10}")
    print("-" * 82)
    rows = []
    for L in range(1, p["MAX_LEVEL"] + 1):
        r = rate_per_sec(L, p) * p["G"]
        c = upgrade_cost(L, p)
        pb = payback_seconds(L, p)
        rows.append((L, pb))
        if L <= 15 or L % 5 == 0:
            print(f"{L:>3} {traffic(L,p):>10.0f} {fmt_num(spend(L,p)):>12} "
                  f"{fmt_num(r):>12} {fmt_num(c):>12} {fmt_time(pb):>10}")
    return rows


def diagnose(rows, p):
    print("\n" + "=" * 82)
    print("【健康度诊断】")
    print("=" * 82)
    issues = []

    # 1. 成本增速约束
    if p["r_c"] > p["r_s"]:
        print(f"✓ 成本增速约束: r_c({p['r_c']}) > r_s({p['r_s']}) — 满足, 收益不会爆炸")
    else:
        print(f"✗ 成本增速约束: r_c({p['r_c']}) <= r_s({p['r_s']}) — 违反! 收益将失控爆炸")
        issues.append("r_c 必须 > r_s")

    # 2. 回本时间是否在目标带内
    pbs = [pb for _, pb in rows if pb != float("inf")]
    out_low = [L for L, pb in rows if pb < p["PB_MIN"]]
    out_high = [L for L, pb in rows if pb > p["PB_MAX"]]
    print(f"\n回本时间区间: {fmt_time(min(pbs))} ~ {fmt_time(max(pbs))}  "
          f"(目标带 {fmt_time(p['PB_MIN'])}~{fmt_time(p['PB_MAX'])})")
    if out_low:
        print(f"  ⚠ 过低(升级太廉价)的等级: {out_low[:8]}{'...' if len(out_low)>8 else ''}")
        issues.append(f"{len(out_low)}个等级回本过快")
    if out_high:
        print(f"  ⚠ 过高(易卡关)的等级: {out_high[:8]}{'...' if len(out_high)>8 else ''}")
        issues.append(f"{len(out_high)}个等级回本过慢")
    if not out_low and not out_high:
        print("  ✓ 全部等级回本时间在目标带内")

    # 3. 平滑性 (真正的断点 = 相邻步进跳变 > 阈值, 微小漂移不算)
    #    放置游戏中回本时间近似恒定/缓慢变化都属健康, 只需无剧烈跳变。
    STEP_TH = 0.10  # 相邻等级回本时间变化 >10% 视为剧烈
    breaks = []
    for i in range(1, len(rows)):
        prev, cur = rows[i-1][1], rows[i][1]
        if prev > 0 and cur != float("inf"):
            ch = (cur - prev) / prev
            if abs(ch) > STEP_TH:
                breaks.append((rows[i-1][0], ch))
    span = max(pbs) / min(pbs) if min(pbs) > 0 else float("inf")
    trend = "缓降" if rows[-1][1] < rows[0][1] else ("缓升" if rows[-1][1] > rows[0][1] else "持平")
    print(f"\n回本曲线整体: {trend}, 极差 {span:.2f}x (max/min)")
    if not breaks:
        print(f"  ✓ 无剧烈跳变(相邻步进均 <{STEP_TH*100:.0f}%) — 曲线平滑, 无数值断点")
        if span > 2.0:
            print(f"  ⚠ 但极差 {span:.2f}x 偏大, 前后期体验差异明显, 可考虑收窄")
            issues.append("回本曲线极差偏大")
    else:
        print(f"  ⚠ {len(breaks)} 处剧烈跳变(>{STEP_TH*100:.0f}%): "
              f"{[(L, f'{c*100:+.0f}%') for L,c in breaks[:5]]}")
        issues.append("存在数值断点")

    # 4. 进程速度提示 (放置游戏长线性)
    print("  (进程速度是否合理见下方【纯挂机进程仿真】)")

    print("\n" + "-" * 82)
    if not issues:
        print("结论: ✓ 经济曲线健康, 当前示例参数可作为建模起点")
    else:
        print(f"结论: ⚠ 发现 {len(issues)} 类问题: {'; '.join(issues)}")
        print("      建议调整方向: 见文末【调参提示】")
    return issues


def simulate_idle(p, target_levels=(5, 10, 20, 30, 40, 50)):
    """纯挂机(不看广告)从 1 级升到各目标等级的累计时间估算。
    简化模型: 单店, 攒够成本即升级, 计算到达每个里程碑的挂机秒数。"""
    print("\n" + "=" * 82)
    print("【纯挂机进程仿真】(单店, 无广告, 攒够即升)")
    print("=" * 82)
    coins = 0.0
    t = 0.0
    L = 1
    milestones = {}
    while L < p["MAX_LEVEL"]:
        cost = upgrade_cost(L, p)
        r = rate_per_sec(L, p) * p["G"]
        need = max(0.0, cost - coins)
        wait = need / r if r > 0 else float("inf")
        t += wait
        coins += r * wait  # 攒到成本
        coins -= cost      # 升级消费
        L += 1
        if L in target_levels:
            milestones[L] = t
    print(f"{'目标等级':>8} {'累计挂机时长':>14}")
    print("-" * 30)
    for lv in target_levels:
        if lv in milestones:
            print(f"{lv:>8} {fmt_time(milestones[lv]):>14}")
    print("\n说明: 时长过短→前期太快缺乏长线; 过长→卡关劝退。"
          "结合广告(k_ad)与离线收益, 实际体感会更快。")


def daily_pressure(p):
    print("\n" + "=" * 82)
    print("【每日租金压力比校验】")
    print("=" * 82)
    print(f"{'Day':>4} {'租金':>12} {'租金/日估产':>12} {'压力比':>8} {'判定':>6}")
    print("-" * 50)
    # 粗略假设: 每日估产 = 当前总产出 * 一个游戏日时长(示例 300s 真实时间挂机)
    # 这里用一个参考日产出基线随天数增长来演示压力比结构
    for day in range(1, p["SIM_DAYS"] + 1):
        rt = rent(day, p)
        # 参考日产出: 假设玩家每天推进使产出按 r_rent 附近速度增长(演示用)
        daily_income = p["S_base"] * traffic(1, p) * (1.18 ** (day - 1))
        ratio = rt / daily_income if daily_income > 0 else float("inf")
        ok = "✓" if p["RENT_RATIO_MIN"] <= ratio <= p["RENT_RATIO_MAX"] else "⚠"
        print(f"{day:>4} {fmt_num(rt):>12} {fmt_num(daily_income):>12} "
              f"{ratio*100:>6.1f}% {ok:>6}")
    print(f"\n目标压力带: {p['RENT_RATIO_MIN']*100:.0f}%~{p['RENT_RATIO_MAX']*100:.0f}%  "
          "(注: 日产出为演示基线, 实际需接入真实产出模型)")


def offline_demo(p):
    print("\n" + "=" * 82)
    print("【离线收益示例】(假设当前总秒产出 R_total = 1000 币/s)")
    print("=" * 82)
    R = 1000.0
    for hrs in [1, 4, 8, 12, 24]:
        dt = hrs * 3600
        eff_dt = min(dt, p["t_off_max"])
        gain = R * eff_dt * p["eta_off"]
        capped = " (封顶)" if dt > p["t_off_max"] else ""
        print(f"  离线 {hrs:>2}h → {fmt_num(gain):>10} 币"
              f"  广告翻倍后 {fmt_num(gain*p['k_ad']):>10} 币{capped}")


def tips():
    print("\n" + "=" * 82)
    print("【调参提示】")
    print("=" * 82)
    print("• 回本普遍过快 → 提高 r_c 或 C_base")
    print("• 回本普遍过慢/卡关 → 降低 r_c, 或提高 r_s / a_t / G")
    print("• 收益爆炸(r_c<=r_s) → 必须让 r_c > r_s")
    print("• 前期太快没长线 → 提高 r_c 与 r_s 差值的一致性, 拉平回本曲线")
    print("• 租金压力过大 → 降低 r_rent 或 rent_base")
    print("• 改 PARAMS 顶部参数后重跑本脚本即可即时看到变化")


if __name__ == "__main__":
    p = PARAMS
    rows = print_level_table(p)
    diagnose(rows, p)
    simulate_idle(p)
    daily_pressure(p)
    offline_demo(p)
    tips()

