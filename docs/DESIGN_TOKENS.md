# Design tokens — lifted verbatim from `러닝 RPG.dc.html`

The web app must reproduce these exactly. They become CSS variables + a Tailwind theme in
`apps/web/src/styles/tokens.css`. Restraint is the brief: a disciplined dark UI with a thin game layer.

## Color

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#08090B` | page background |
| `--bg-screen` | `#0B0C0E` | device screen background |
| `--bg-deep` | `#0E1014` | inset panels / map areas |
| `--surface` | `#12141A` | cards (spec sheets) |
| `--surface-2` | `#14161B` | in-app cards |
| `--surface-3` | `#1B1E25` | raised chips inside cards |
| `--surface-4` | `#282C34` | slider tracks, dividers |
| `--border` | `rgba(255,255,255,.07)` | default hairline (also .06 / .08) |
| `--text` | `#F2F3F5` | primary text |
| `--text-2` | `#C6CBD3` | secondary |
| `--text-3` | `#9AA1AC` | tertiary / body |
| `--muted` | `#5E656F` | labels, mono captions |
| `--gold` | `#D9A227` | primary accent / LEGEND |
| `--gold-2` | `#E8C56A` | gold text on dark |
| `--gold-3` | `#F0C15C` | hover |
| `--gold-hi` | `#FFE9B0` | highlight tip |
| `--blue` | `#8FA6C4` | secondary accent / R rarity / guard |
| `--purple` | `#B48CF0` | SR rarity / magic / handle / mirror |
| `--red` | `#E85A3C` | danger / penalty |
| `--slate` | `#5E656F` | N rarity |

### Rarity → color
`N` slate `#5E656F` · `R` blue `#8FA6C4` · `SR` purple `#B48CF0` · `LEGEND` gold `#D9A227`

### Sword-part → color
blade = gold, guard = blue, handle = purple.

## Type
- Korean/UI: **Pretendard** (`Pretendard Variable`, fallback system-ui).
- Numbers, labels, tags: **IBM Plex Mono** (weights 400/500/600), letter-spacing `.14–.16em`, uppercase.
- Scale seen in spec: hero 40/26px, h2 20px, body 16/14.5/13px, caption 12/11/10.5px.
- `letter-spacing:-0.02em` on large headings; `text-wrap:pretty` on paragraphs.

## Shape & spacing
- Radii: cards 12–18px, pills/badges 999px, device frame 18px.
- Card padding 12–26px. Screen gutter ~20px, section gap 12–14px.
- Device frame target: **428 × 908** (Android), dark.
- Buttons: primary = gold fill `#D9A227` / text `#0B0C0E` / weight 700, height 54–56px; secondary =
  1px border `rgba(255,255,255,.12)`, text `#C6CBD3`.

## Motion
- `@keyframes pulse { 0%,100%{opacity:.35} 50%{opacity:1} }` (live/recording indicators).
- Forge reveal, combat staging, gacha reveal get bespoke sequences (Milestone 4).

## Iconography
- Line SVG, 1.8 stroke, round caps/joins, 20–24px. Currency/stat glyphs custom-drawn (no icon font).
