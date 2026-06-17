# Peach — Design Document

> Single source of truth for all visual, interaction, and component decisions.
> Synthesizes Emil Kowalski's design engineering principles, Impeccable styling standards,
> TasteSkill heuristics, and GSAP motion architecture into one coherent system.

---

## 1. Design Philosophy

Peach is a financial infrastructure product. Every pixel must communicate trust, precision, and quiet sophistication. The interface should feel like using a Bloomberg terminal redesigned by a luxury brand — information-dense but never overwhelming, animated but never theatrical.

**Three Laws:**

1. **Restraint over decoration.** If a visual element does not aid comprehension or reinforce hierarchy, remove it.
2. **Motion as meaning.** Animation exists to communicate state change, spatial relationships, or temporal progression — never as ornamentation.
3. **Contrast as architecture.** The extreme dark palette creates natural depth layers without requiring borders or shadows to separate content.

---

## 2. Color System — Dark Mode Only

There is no light mode. The palette is designed for maximum information density with zero eye strain during extended use.

```
┌─────────────────────────────────────────────────────────────┐
│  SURFACES (Layered depth via luminance steps)               │
├─────────────────────────────────────────────────────────────┤
│  surface-0   #060608    True background. Near-black.        │
│  surface-1   #0d0d10    Primary card/panel fill.            │
│  surface-2   #141418    Hover state / elevated card.        │
│  surface-3   #1a1a20    Active/pressed state.               │
│  surface-4   #222228    Input field backgrounds.            │
├─────────────────────────────────────────────────────────────┤
│  TEXT                                                        │
├─────────────────────────────────────────────────────────────┤
│  text-primary  #e8e4df  Off-white. Warmer than pure #fff.   │
│  text-muted    #8a8690  Secondary labels, captions.         │
│  text-dim      #5a5660  Tertiary. Timestamps, metadata.     │
├─────────────────────────────────────────────────────────────┤
│  ACCENT                                                      │
├─────────────────────────────────────────────────────────────┤
│  peach        #FF8B5E   Primary accent. Used sparingly.     │
│  peach-light  #FFB088   Hover state on accent elements.     │
│  peach-dim    #CC6F4B   Pressed state / subtle indicators.  │
├─────────────────────────────────────────────────────────────┤
│  SEMANTIC                                                    │
├─────────────────────────────────────────────────────────────┤
│  success      #4ade80   Confirmations, completed states.    │
│  warning      #fbbf24   Caution, pending states.            │
│  error        #f87171   Failures, destructive actions.      │
├─────────────────────────────────────────────────────────────┤
│  BORDERS                                                     │
├─────────────────────────────────────────────────────────────┤
│  border       rgba(255, 255, 255, 0.06)   Standard.         │
│  border-hover rgba(255, 255, 255, 0.12)   Interactive.      │
│  border-peach rgba(255, 139, 94, 0.20)    Accent highlight. │
└─────────────────────────────────────────────────────────────┘
```

### Hard Rules

- **No gradients.** Zero. Not on backgrounds, not on buttons, not on text. Flat fills only.
- **No colored shadows.** Box shadows are black/transparent only. Glow effects use the accent at extreme low opacity (0.02–0.08) via blurred pseudo-elements, never `box-shadow`.
- **Accent usage budget:** The peach accent may appear on a maximum of 2 elements per viewport at any time. Overuse kills its signal value.

---

## 3. Typography

| Role | Font | Weight | Size | Tracking |
|------|------|--------|------|----------|
| Display (H1) | Space Grotesk | 500 | clamp(2rem, 5vw, 5rem) | -0.02em |
| Heading (H2) | Space Grotesk | 500 | 1.5rem–2.5rem | -0.01em |
| Body | Inter | 400 | 14px–15px | 0 |
| Label | Inter | 500 | 11px–12px | 0.05em (uppercase) |
| Mono (data) | SF Mono / Fira Code | 400–500 | 12px–14px | 0 |

### Rules

- Never use font-weight below 400.
- All uppercase text must be tracked at `0.05em` minimum.
- Line-height for body text: `1.6`. For headings: `1.05–1.15`.
- Maximum content width for readability: `65ch` (prose), `1600px` (data).

---

## 4. Glassmorphism & Depth Model

The visual depth model uses three techniques stacked:

### Layer 1: Background Luminance

Each layer is 4–6 luminance steps brighter than its parent. This creates implicit depth without borders.

### Layer 2: Frosted Glass (Selective)

Applied only to overlays, sidebars, and floating panels. Never on inline cards.

```css
.glass-panel {
  background: rgba(13, 13, 16, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
```

### Layer 3: Ambient Light

Subtle, large-radius blurred elements simulate environmental lighting. Used exclusively in hero sections and page backgrounds — never inside data-dense views.

```css
.ambient-blob {
  position: fixed;
  width: 600px;
  height: 600px;
  border-radius: 50%;
  background: #FF8B5E;
  opacity: 0.04;
  filter: blur(150px);
  pointer-events: none;
}
```

### What NOT to do

- No `backdrop-filter` on scrollable content (performance).
- No stacking multiple glass layers (readability).
- No ambient blobs inside dashboard/data pages (distraction).

---

## 5. Spacing & Layout

### Base Unit

`4px` grid. All spacing values are multiples: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96`.

### Page Structure

```
┌─────────────────────────────────────────────────┐
│ Sidebar (w-64, sticky, glass)                   │
├─────────────────────────────────────────────────┤
│ Main Content                                    │
│   padding: 40px (p-10)                          │
│   max-width: 1200px (data), 1600px (dashboard)  │
│   margin: 0 auto                                │
└─────────────────────────────────────────────────┘
```

### Card Anatomy

```
┌──────────────────────────────────────┐
│  padding: 24px–32px (p-6 to p-8)    │
│  border-radius: 24px (rounded-3xl)   │
│  border: 1px solid white/5           │
│  background: surface-1/60            │
└──────────────────────────────────────┘
```

### Responsive Breakpoints

| Token | Width | Usage |
|-------|-------|-------|
| `sm` | 640px | Stack columns, reduce padding |
| `md` | 768px | 2-column grids |
| `lg` | 1024px | Full sidebar visible |
| `xl` | 1280px | 3–4 column data grids |

---

## 6. Component Guidelines

### Buttons

| Variant | Background | Text | Border | Use Case |
|---------|-----------|------|--------|----------|
| Primary | `#FD8566` | black | none | Single primary CTA per view |
| Secondary | `white/4` | white | `white/8` | Navigation, secondary actions |
| Ghost | transparent | `text-muted` | none | Tertiary, inline actions |
| Destructive | `red-500/10` | `red-400` | `red-500/20` | Cancel, delete |

**Rules:**
- Border-radius: `rounded-2xl` (16px) for standalone, `rounded-xl` (12px) for grouped.
- Minimum touch target: 44px height.
- Disabled state: `opacity-40`, `cursor-not-allowed`. No color change.
- Hover: Background shifts one luminance step. No scale transform on primary actions.

### Inputs

```
background: surface-0/50
border: 1px solid white/8
border-radius: 16px (rounded-2xl)
padding: 16px 20px
font: mono for addresses, sans for text

focus: border → peach/50, ring → peach/50 (1px)
hover: border → white/15
```

- Labels positioned above, never inside (no floating labels).
- Error states: border turns `error` color, message appears below in `text-sm text-error`.

### Cards / Panels

- Background: `surface-1/60` with `backdrop-blur-xl` (glass panels only).
- Standard cards: solid `surface-1` background, no blur.
- Border-radius: `24px` (`rounded-3xl`).
- Internal spacing: `p-6` minimum, `p-8` for feature cards.
- Hover: `surface-2` background, border `white/10`. Transition `300ms`.

### Tables / Data Rows

- No visible table element. Use stacked div rows.
- Row padding: `py-4 px-5`.
- Separator: `border-b border-white/5` (last child: no border).
- Hover: `bg-surface-2`. Transition `200ms`.
- Monospace for all numeric/address data.

### Toasts / Notifications

- Position: `fixed bottom-6 right-6`.
- Max width: `380px`.
- Background: Contextual (error → `#2A0808/80`, success → `#082A18/80`).
- Border: Contextual color at `20%` opacity.
- Backdrop blur: `blur(24px)`.
- Auto-dismiss: `4000ms`. No manual close required (but available).
- Entrance: slide-in from right, `300ms cubic-bezier(0.16, 1, 0.3, 1)`.

---

## 7. Motion System (GSAP)

### Principles (Emil Kowalski)

1. **Duration:** Fast enough to not block workflow, slow enough to be perceived. Range: `200ms–800ms`.
2. **Easing:** Default to `power2.out` for entries, `power2.in` for exits. Use `power4.out` only for hero/cinematic moments.
3. **Stagger:** `0.05s–0.12s` between sibling elements. Never stagger more than 8 items.
4. **Direction:** Elements enter from below (`y: 20`). Never from the sides unless semantically meaningful (e.g., slide-in panels).

### Framework: `useGSAP` Hook

All GSAP animations in React must use the `@gsap/react` `useGSAP` hook with `scope` for automatic cleanup.

```tsx
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

function Component() {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.from(".animate-item", {
      y: 20,
      opacity: 0,
      duration: 0.8,
      stagger: 0.08,
      ease: "power2.out",
    });
  }, { scope: container });

  return <div ref={container}>...</div>;
}
```

### ScrollTrigger Rules

- Register plugin globally once: `gsap.registerPlugin(ScrollTrigger)`.
- Default `start`: `"top 85%"`. Default `end`: `"bottom 50%"`.
- Use `toggleActions: "play reverse play reverse"` for re-entrant animations.
- Pin only on `lg+` screens via `gsap.matchMedia()`.
- Never pin scrollable data tables or forms.

### Forbidden Patterns

- No `transform: scale()` on hover for data-dense components.
- No infinite rotating/pulsing animations except status indicators (max `w-2 h-2` dots).
- No animation on initial page load that delays content visibility beyond `300ms`.
- No GSAP on elements that React frequently re-renders (use CSS transitions instead).

### Standard Presets

| Name | Duration | Ease | Y | Opacity | Use |
|------|----------|------|---|---------|-----|
| `enter` | 0.8s | power2.out | 20→0 | 0→1 | Default page section entrance |
| `enter-fast` | 0.4s | power2.out | 12→0 | 0→1 | Cards, rows in already-visible areas |
| `hero` | 1.2s | power4.out | 100%→0 | 0→1 | Landing page hero text |
| `exit` | 0.3s | power2.in | 0→-10 | 1→0 | Element removal |

---

## 8. Iconography

- Library: **Lucide React** (consistent with existing codebase).
- Default size: `16px–18px` (`size={16}` or `size={18}`).
- Stroke width: `1.5` for standard, `2` for emphasis.
- Color: Inherit from parent text color. Never apply direct color unless semantic (e.g., error icon in red).
- Avoid filled icons. Peach uses outlined/stroked exclusively.

---

## 9. Data Visualization (Recharts)

### Chart Container

```tsx
<div className="w-full h-[320px]">
  <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
      ...
    </AreaChart>
  </ResponsiveContainer>
</div>
```

### Color Rules

- Primary data line: `#ffffff` (white, `strokeWidth={2}`).
- Secondary/reference line: `#FD8566` (peach, `strokeDasharray="4 4"`).
- Fill gradients: Top at `3%` opacity, bottom at `0%`. No visible gradient fill.
- Grid lines: Hidden (`hide` on axes). Data speaks for itself.

### Tooltip

```tsx
contentStyle={{
  backgroundColor: 'rgba(10, 10, 12, 0.9)',
  borderColor: 'rgba(255,255,255,0.08)',
  borderRadius: '16px',
  padding: '12px',
}}
```

- Font: monospace.
- Label: hidden (rely on legend and context).

---

## 10. Anti-Patterns — Strictly Forbidden

| Pattern | Why |
|---------|-----|
| Background gradients (linear, radial, conic) | Violates flat surface principle. Creates visual noise. |
| Colored box-shadows | Feels cheap. Use positioned blur pseudo-elements if glow needed. |
| CSS `transform: scale` on card hover | Causes layout shift in dense grids. Use `background-color` change. |
| Emoji in UI chrome | Unprofessional for financial product. |
| Skeleton loaders | Use minimal spinners (1.5px border, animate-spin). |
| `position: absolute` text overlays on images | Accessibility nightmare. |
| More than 2 font families | We use Inter + Space Grotesk. Period. |
| `!important` in styles | Refactor specificity instead. |
| Inline styles for layout | Tailwind classes only. Inline for truly dynamic values (e.g., `width: ${percent}%`). |

---

## 11. Accessibility Baseline

- Minimum contrast ratio: `4.5:1` for body text, `3:1` for large text.
- All interactive elements: visible `focus-visible` ring (peach at 50% opacity).
- No information conveyed by color alone (pair with icon or text).
- `aria-label` on icon-only buttons.
- Reduced motion: Respect `prefers-reduced-motion` — disable GSAP animations, use instant transitions.

```tsx
// In GSAP setup
if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  gsap.globalTimeline.timeScale(100); // Effectively instant
}
```

---

## 12. File & Component Structure

```
src/
├── app/
│   ├── layout.tsx          # Root: fonts, providers, body
│   ├── page.tsx            # Landing (GSAP cinematic)
│   ├── login/page.tsx      # Wallet connect
│   ├── docs/page.tsx       # Documentation
│   └── dashboard/
│       ├── layout.tsx      # Sidebar + main wrapper
│       ├── page.tsx        # Overview metrics + stream queue
│       ├── create/         # Stream creation form
│       ├── streams/        # Active stream list
│       ├── insurance/      # Pyth hedge status
│       ├── treasury/       # Corporate asset view
│       └── history/        # Transaction ledger
├── components/
│   ├── SuiProvider.tsx     # Wallet/chain context (no UI)
│   ├── ToastProvider.tsx   # Notification context + renderer
│   ├── Header.tsx          # Landing page nav
│   ├── TickingStreamRow.tsx # Real-time stream card with claim/cancel
│   ├── ProtectionShieldGraph.tsx # DeepBook live chart
│   ├── MicroPremiumLedger.tsx    # On-chain event feed
│   └── [visual]*.tsx       # Landing page visuals
└── lib/
    └── constants.ts        # All on-chain addresses (single source)
```

### Naming Conventions

- Components: PascalCase (`TickingStreamRow.tsx`).
- Utilities/hooks: camelCase (`useStreamData.ts`).
- Constants: UPPER_SNAKE_CASE (`PEACH_PACKAGE_ID`).
- CSS classes: Tailwind utility-first. No custom class names except for keyframe animations defined in `globals.css`.

---

## 13. Installed Skill Agents

The following skill packages provide AI-assisted design enforcement:

| Package | Skills | Purpose |
|---------|--------|---------|
| `emilkowalski/skill` | `emil-design-eng` | UI polish, invisible details, animation philosophy |
| `Leonxlnx/taste-skill` | 13 skills (design-taste, brandkit, minimalist-ui, etc.) | Design heuristics, image-to-code, brand consistency |
| `greensock/gsap-skills` | 8 skills (core, react, scrolltrigger, timeline, etc.) | GSAP best practices, performance, plugin usage |

These skills are loaded by compatible agents and enforce the standards documented above during development.

---

## 14. Implementation Checklist for New Components

Before shipping any new UI component, verify:

- [ ] Uses only colors from the palette above (no hex literals outside this system)
- [ ] Zero gradients anywhere in the component
- [ ] Border-radius matches component type (cards: 24px, buttons: 16px, inputs: 16px, pills: 9999px)
- [ ] Text uses correct font mapping (display → Space Grotesk, body → Inter, data → mono)
- [ ] Animations use `useGSAP` with `scope` (not raw `useEffect` + GSAP)
- [ ] Hover states use background-color transition, not transform
- [ ] All interactive elements have `focus-visible` styles
- [ ] Peach accent used on at most 2 elements in the viewport
- [ ] No `any` types in TypeScript
- [ ] Addresses/hashes displayed in monospace with truncation (`0x1234...abcd`)

---

*Last updated: June 17, 2026*
