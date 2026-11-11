# Providers — UI audit & proposed IA

Artifacts from the live dashboard audit (Playwright walk of every main page at
1280px and 375px + source review) and the recommended restructure.

| File | What it is |
| --- | --- |
| `providers-flow.png` | Audit findings (today vs recommended), target flow, what already landed |
| `providers-flow.html` | Editable source of the flow/analysis sheet |
| `providers-mockup.png` | Mockup of the recommended Providers page (regrouped sidebar, status tabs, collapsed type sections) |
| `providers-mockup.html` | Editable source of the mockup |

## The core problem

The same grouping was expressed three times on one page — tab row (status),
15 auth-type chips (type) and ~18 stacked sections (type again) — and the
numbers disagreed: the chip said `OAuth 2/18` while the section right below
said `3/22`.

## The recommendation

One axis per level:

- **Sidebar** = task (Overview / Routing / Access / Tools / Admin)
- **Page tabs** = status (All / Connected / Needs setup / Recent)
- **Sections** = type, collapsed with a count (auto-expand what matches)
- **Media chips** stay in the toolbar — a genuine second axis, not a duplicate

Plus: provider detail becomes `Models | Connections | Guide`, and the named
routes (`/v1`, `/bestfree`) live inside Combos.
