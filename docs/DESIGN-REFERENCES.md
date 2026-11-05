# Design research log

The universal rulebook asks for at least three real references to be opened and evaluated before a new UI is built.
This is what was actually done on 2026-11-03, including where it fell short. Nothing here claims more than was seen.

## References opened

| Reference | Result | Used for |
|---|---|---|
| `https://godly.website/` | Redirected (301) to `recent.design`, which was then fetched. The fetch returned a text-only feed (category filters, poster thumbnails, titles such as "Liquid bubble buttons" and "Interactive terrain sculpting"). No typography, colour or motion could be read from it, and nothing in it was identifiable as a space or instrument aesthetic. | Nothing concrete. Recorded as inspected-but-thin. |
| `https://www.fontshare.com/` | Returned only the title and tagline ("Quality Fonts. Free."). No typefaces or licence text. | Nothing. Fonts were chosen elsewhere (below). |
| `https://www.realtimecolors.com/` | Returned a usable description: palette roles (text, background, primary, secondary, accent), three-colour guidance, and per-colour AA/AAA contrast indicators. | The palette is organised by role, and its contrast is **computed**, not eyeballed: `tests/palette.test.ts` asserts WCAG ratios for every text/background pair in both the standard and the high-contrast palette. |

Not opened: 21st.dev, Watermelon UI, Motion, React Spring, Lenis, Paper Shaders, 60fps and the other names in the
rulebook's directory. None was needed. In particular Lenis (smooth scrolling) and scroll-driven motion libraries do not
suit a full-screen physics game, so no animation library is used at all: motion is CSS plus Phaser tweens, and it honours
`prefers-reduced-motion` and an in-app setting.

## What drove the visual direction

Because the three fetches yielded little, the direction comes mainly from the brief ("observatory / cosmic
instrumentation: dark midnight backgrounds, restrained luminous accents, crisp orbit lines, legible geometric type") and
from the game's own needs:

- **Palette.** Midnight base (`#070b1a` to `#16224d`), with each accent carrying one meaning: amber is the ship and the
  primary action, teal is safe orbit and the portal, coral is lethal, gold is shards and stars, violet is gravity
  inversion and wormholes, ice-blue is repulsion pulses.
- **Never colour alone.** Every hazard also differs in *shape*: asteroids are jagged, satellites are a body with panels,
  lasers are a dashed outline that turns solid when they fire, gates are barred posts, wormholes are spirals, pulses are
  contracting rings with outward arrows, a locked portal shows a padlock. The How to Play screen draws each one.
- **Type.** Instrument Serif (italic) for the wordmark and titles, Instrument Sans for interface text, IBM Plex Mono for
  readouts. All three are SIL OFL 1.1 and bundled locally through Fontsource, so the APK needs no network. Chosen for a
  journal-of-observations feel rather than a neon-arcade one.
- **Two directions compared.** (a) *Observatory*: serif italic title, thin orbit lines, mono readouts, restrained colour.
  (b) *Neon arcade*: glowing outlines, display sans, saturated gradients. (a) was chosen because the playfield needs a
  calm, high-contrast ground so that hazards stand out, and because it can be made accessible without fighting the style.

## Gaps

- No Figma file was supplied, so no design-sync step applies.
- Wireframes and the reference matrix are this document plus `docs/ADR-0001-stack-and-design.md`; no separate design
  files exist.
- Real-device visual checks (a Samsung Galaxy screen, outdoor brightness, notches) have not been done. Screenshots in
  `docs/screenshots` come from desktop Edge at several viewport sizes and from an Android 15 emulator.
