# Peach Design System & Philosophy

This document centralizes the design rules for Peach, blending **Tasteskill**, **Impeccable**, and **Emil Kowalski's Design Engineering** principles. This is the single source of truth for all frontend additions.

## 1. The Core Aesthetic (Vowen.ai Inspired)
Peach aims for a premium, extremely high-contrast, "Dark Mode Only" aesthetic. It should feel like a high-end AI or financial infrastructure product (e.g. Stripe, Linear, Vowen.ai).

- **"Soothing" Interaction**: Animations should not snap violently. They should glide in using `power3.out` or `power4.out` with durations between `0.8s` and `1.2s`.
- **Absolute Contrast**: We use true or near-true blacks for backgrounds and stark whites for primary text, avoiding muddy grays for backgrounds to maximize depth.
- **Micro-interactions**: Everything interactive must respond. Hovering over a card should slightly intensify its border or background glow, taking `300ms` for a smooth transition.

## 2. Color Palette & Dark Mode Protocol

> [!IMPORTANT]
> **Anti-Slop Rule**: Do not use "AI purple" mesh gradients. Use our defined `Peach` accent selectively to draw the eye, not to paint entire backgrounds.

```css
--color-surface-0: #060608;    /* True background, near black */
--color-surface-1: #0d0d10;    /* Card background 1 */
--color-surface-2: #141418;    /* Card background hover / active */
--color-peach: #FF8B5E;        /* Primary accent: Warm, glowing coral/peach */
--color-text-primary: #e8e4df; /* Off-white for high readability but softer than #FFF */
--color-text-muted: #8a8690;   /* Secondary text */
```

## 3. Glassmorphism & Depth
Rather than flat cards, use glassmorphic panels for containers to simulate physical depth.

- **Background**: `bg-surface-1/60` (or `rgba(13, 13, 16, 0.6)`)
- **Blur**: `backdrop-blur-xl` or `backdrop-filter: blur(20px)`
- **Border**: A delicate inner border. Never use solid thick borders. `border border-white/5` (`rgba(255, 255, 255, 0.05)`).
- **Glow**: Subtle shadows with the peach color `shadow-[0_0_30px_rgba(255,139,94,0.05)]`

## 4. Typography (Inter + Space Grotesk)
- **Headers (`font-display`)**: Space Grotesk. Tracked tightly (`tracking-tight`), high contrast, very large on heroes (`text-7xl` or `text-8xl`), strictly limited to 2 lines max on desktop.
- **Body (`font-sans`)**: Inter. Highly readable, generous line height (`leading-relaxed`), muted colors (`text-text-muted`).

## 5. Layout & Grids
- **No Em-Dashes**: Avoid lazy prose formatting. Use structure instead.
- **Asymmetric Feature Grids**: Do not use "three equal cards". Mix widths (e.g., `col-span-8` and `col-span-4`) to create editorial flow.
- **Vast Spacing**: Give elements room to breathe. Use `mt-32` or `gap-12` between major sections.

## 6. Tone & Terminology (De-Web3ing)
Peach is a Web2 Enterprise SaaS. Although it uses blockchain beneath the hood, the user interface must entirely abstract it away.
- **NO**: "Minting", "Gas Sponsored", "Wallets", "Smart Contracts", "On-chain".
- **YES**: "Tickets Issued", "Compute/Infra Cost", "Accounts", "Infrastructure Engine", "Immutable Log".

## 7. Motion & GSAP
- When elements enter the screen, they should stagger in (`stagger: 0.1`) and move upwards (`y: 40`).
- Scale effects should be incredibly subtle (e.g., scaling from `0.98` to `1` rather than `0.5`).
- The Animated Logo should draw itself slowly, emphasizing the elegant curves of the 'P'.
