# Game Design Bible — 러닝 RPG (HitRace)

Condensed from the Claude Design spec `러닝 RPG.dc.html`. This is the canonical reference for the
game-core engine. Every formula below is implemented in `packages/game-core` and covered by tests.

## Pillar

> Shape from the **GPS trajectory**, stats from the **running metrics**. Splitting the two axes means a
> *pretty* sword and a *strong* sword are separate collection motives. Gacha never yields swords —
> swords come only from running. This keeps running from being replaced by spending.

## 1. Route → Sword conversion

### SHAPE (from GPS geometry)
- GPS trajectory → smoothed polyline → centerline of the blade silhouette.
- **Round-trip course** (returns near start, out-and-back) → double-edged straight sword (直劍).
- **Closed loop** → curved sword / chakram (曲刀).
- Curvature (bendiness) → blade curve amount. Self-intersections → decorations / runes.
- Total distance → overall length. **1 km ≈ 8% scale.**

### STAT (from running metrics) — the four stats
| Stat (KR) | EN | Source metric |
|---|---|---|
| 예리함 | Sharpness (attack) | Average pace (faster = higher) |
| 중량 | Weight (crit damage) | Cumulative elevation gain |
| 내구 | Durability | Cadence stability (steady cadence = tougher) |
| 마력 | Magic (special gauge) | Time spent in target heart-rate zone |

### RARITY — achievement-based, **not** RNG. Derived from the forge score (0–100+).
| Grade | Score | Color token |
|---|---|---|
| N | 0–39 | slate `#5E656F` |
| R | 40–69 | blue `#8FA6C4` |
| SR | 70–89 | purple `#B48CF0` |
| LEGEND | 90+ | gold `#D9A227` |

### Forge score composition (from screen 09)
- Base (distance·time): up to +52
- Pace bonus (≤ 5'30"/km): +14
- New-course exploration: +10
- Negative split (2nd half faster): +5
- (other course/achievement modifiers)

### Anti-abuse (enforced server-side, see ANTICHEAT.md)
- Minimum **1.0 km & 10 min**; pace ceiling **3'00"/km** (faster ⇒ implausible ⇒ fail).
- GPS jump-cut detection, vehicle/teleport heuristics ⇒ forge fails.
- Same course from the **3rd repeat**: score decay → encourages new routes.
- **Max 2 swords forged per day.**

## 2. Core loop
1. Run → forge sword (max 2/day).
2. Dismantle duplicate / low-grade swords → iron ore.
3. Ore gacha → rare materials & engravings (never swords).
4. Upgrade the sword → PvP rank battles.
5. Season rewards → next season's new-course challenges.

## 3. Economy — three currencies
| Currency (KR) | Role | Cap | Earn | Spend |
|---|---|---|---|---|
| 철광석 Iron Ore | base | 600 / day | dismantle (grade×4–40), 8 per km, daily quests 100–300 | upgrade (120×1.4ⁿ per +N), engrave re-roll 200 |
| 각인석 Engrave Stone | rare | 5 / week | gacha 6.5%, weekly challenge 1–2, rank rewards | open engrave slot (1), SR+ engrave (2) |
| 주조 티켓 Forge Ticket | gacha | no cash sale | 1 per 3km+ run, +3 for 3 runs/week, pass track | gacha 1/pull, 9/10-pull |

Principle: **every currency's primary source is running.** Spending only touches cosmetics & pass
acceleration. Anti-inflation: upgrade cost is exponential (×1.4), earning is linear.

## 4. Combat model (auto-battle, spectator)
```
CP        = Sharpness + Weight·0.7 + Durability·0.5 + Magic·0.8
turnDamage = Sharpness · (1 + critRate · Weight/1000)
                       · (1 − enemyDurability / (enemyDurability + 1200))
skill     = when magic gauge fills to 100 → auto-cast
HP        = 3000 fixed
firstMove = higher cadence goes first
```
- **5 rounds**, speed-up / skip allowed, ~22s average. It's spectator, so the *staging* is the reward, not just the outcome.
- **Matching band:** CP ±8% → after 30 s widen to ±15% → after 60 s fall back to a similar-CP **ghost** (async recorded battle). No waiting.
- **Tiers:** Iron·Bronze·Silver·Gold·Platinum·Legend × 4 steps. Win +18–24 RP, loss −12–18 RP. Season end = 2-tier soft reset.

## 5. Forge customization (screens 16–18)
- **Transforms (cosmetic only, stats unchanged):** rotate (15° snap, free-angle on hold), flip (H/V),
  mirror-symmetry (duplicates path → double-edge, *appearance only*), move (offset ±20%), scale (80–120%).
- Path must stay within 40% of the blade or forging is blocked.
- **Part assignment:** cut the route timeline into segments → assign to blade / guard / handle; leftover
  becomes engraved rune lines.
- **True double-edge (眞 양날):** only a real GPS round-trip earns the codex mark.
- **Re-forge economy:** free before commit; after commit needs a re-forge ticket (weekly challenge reward
  or 400 ore). Re-forge resets *appearance only* — stats/upgrades/engravings persist.
- **Fusion forge (합주조):** combine 2–3 routes' parts (blade=course A, guard=course B). Consumes 2 SR+
  swords, stats = weighted average **−10% penalty** (prevents spam). Inherit 1 engraving.

## 6. Retention & monetization
- **D0:** signup → 1 km tutorial run → **guaranteed R first sword.**
- **D1:** gift upgrade materials + first upgrade free → growth feel.
- **D3:** first PvP (guaranteed-win match) → rank entry.
- **D7:** 3 runs/week → SR material + 3 tickets (weekly habit loop).
- **Comeback:** 14 days idle → "your blade has rusted" push + 3-day whetstone boost.
- **Season pass** ₩5,900 / 8 wk — free & paid tracks, levels via km run. Paid = skins/titles/tickets, **no stats**.
- **Skins** ₩2,200–7,700 — blade FX, scabbards, forge animations. **Zero P2W** is the community-trust core.

## Screen inventory (18) — see docs/SCREENS.md for status
01 Home · 02 Running(live) · 03 Forge-result · 04 Collection · 05 Upgrade · 06 PvP · 07 Gacha ·
08 Onboarding · 09 Run-summary · 10 Sword-detail/engrave · 11 Matching · 12 Combat-result ·
13 Ranking · 14 Season-pass · 15 Profile · 16 Forge-workshop · 17 Part-assign · 18 Fusion-forge
