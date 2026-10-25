# DESIGN.md

Two rooms, one collection. The exhibition (home) is a dark listening room where the
records are lit; entering a record through its spindle hole opens onto a bright,
airy page lit in that record's colour. Layout, type and motion are shared; only the
paint changes between the rooms.

Direction chosen from the project itself (no external reference library was
connected): the record colours, the existing type stack and the portal transition.

## Colour

### Exhibition (dark room) · `src/style.css :root`
| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#0b0a09` | Room, canvas fallback |
| `--paper` | `#ece5d8` | Text on dark |
| `--muted` | `rgba(236,229,216,.56)` | Secondary text on dark |
| `--line` | `rgba(236,229,216,.14)` | Hairlines on dark |
| `--accent` | record colour | Active record: light, glow, UI marks |

### Blog pages (light room) · `src/post-light.css .post`
| Token | Value | Role |
| --- | --- | --- |
| `--pa` | record or mini-record colour | Source accent, fills and decoration only |
| `--pa-wash` | `--pa` 6% into `#fbfcfd` | Page ground, tinted per record |
| `--paper` | `#14161b` | Ink: headings and body |
| `--muted` | `#59606b` | Captions, secondary text (5.8:1 on the ground) |
| `--faint` | ink 34% | Decorative strokes only, never text |
| `--line` | ink 11% | Hairlines, card borders |
| `--surface` | `#ffffff` | Raised plates: role cards, footer cards, map cards |
| `--pa-ink` | `--pa` 64% into ink | Accent used as text (all record colours at least 4.5:1) |
| `--pa-display` | `--pa` 80% into ink | Accent used as display type (years, counters; at least 3:1) |
| `--shadow-soft` | 1px hairline plus a long accent-tinted shadow | The only elevation on light pages |

Record colours: Üniversite `#B3384A`, Kulüp `#C9574F`, Stajlar `#8F2E46`,
Kariyer `#3F66C2`, Dünya Turu `#2E9370`, Keşif `#2F8C99`, Hobiler `#C4A04C`.
Hobby chapters: Fitness `#E8603C`, Yapay Zeka `#7F70FF`, Futbol `#35A867`, Müzik `#E5405E`.

Rule: never set raw `--pa` on text; use `--pa-ink` or `--pa-display`.

## Typography
| Family | Role |
| --- | --- |
| Fraunces (opsz 48 to 144, weight 300 to 400) | Titles, headings, quotes, card names |
| Newsreader | Body text, 18.5 to 20.5px, 1.68 to 1.72 line height, 700px measure |
| Big Shoulders Display 700 to 800 | Years, counters, label numerals |
| IBM Plex Mono 500 | Small metadata labels (kept to navigation and card meta) |

## Spacing and shape
- Gutter `--gut`: clamp(16px, 3.2vw, 44px). Section rhythm: clamp(40px, 8vh, 90px).
- Shapes: sharp cards and plates (radius 0); records, pins and buttons are circles; the music player is 12px (it hosts Spotify's own rounded embed).

## Motion
- Easing `--ease`: cubic-bezier(.2,.75,.1,1).
- Record change: radial noise wave in the new colour from the record's centre.
- Entering a record: approach, camera through the spindle hole, noise portal opens onto the light page; the record's colour pool grows behind the header.
- Blog: masked title words, year wipe, reveal-on-scroll, figure parallax, counters, map flights, hobby chapter colour shifts.
- Everything has a reduced-motion fallback.

## Components (light room)
- **Role card**: white plate with the logo (or monogram), organisation in `--pa-ink` mono, role in Fraunces, notes with a short accent rule.
- **Stat**: `--pa-display` numeral, mono label, italic detail; separated by hairlines, no card.
- **Footer card**: white surface, soft shadow, neighbour record's colour on hover.
- **Travel map**: daylight cartography (sea `#eaf1f3`, land `#dde4e6`), visited countries filled with their flags, ink planes.
