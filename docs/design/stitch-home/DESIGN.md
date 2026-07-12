---
name: Recipe Dost
colors:
  surface: '#121317'
  surface-dim: '#121317'
  surface-bright: '#38393d'
  surface-container-lowest: '#0d0e12'
  surface-container-low: '#1a1b1f'
  surface-container: '#1e1f23'
  surface-container-high: '#292a2e'
  surface-container-highest: '#343539'
  on-surface: '#e3e2e7'
  on-surface-variant: '#e3bebb'
  inverse-surface: '#e3e2e7'
  inverse-on-surface: '#2f3034'
  outline: '#aa8987'
  outline-variant: '#5b403f'
  surface-tint: '#ffb3b0'
  primary: '#ffb3b0'
  on-primary: '#68000f'
  primary-container: '#be1e2d'
  on-primary-container: '#ffd3d1'
  inverse-primary: '#b91a2a'
  secondary: '#c8c6c2'
  on-secondary: '#30312e'
  secondary-container: '#494946'
  on-secondary-container: '#b9b8b4'
  tertiary: '#c8c6c5'
  on-tertiary: '#313030'
  tertiary-container: '#626161'
  on-tertiary-container: '#dfdddc'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdad8'
  primary-fixed-dim: '#ffb3b0'
  on-primary-fixed: '#410006'
  on-primary-fixed-variant: '#930019'
  secondary-fixed: '#e4e2dd'
  secondary-fixed-dim: '#c8c6c2'
  on-secondary-fixed: '#1b1c19'
  on-secondary-fixed-variant: '#474744'
  tertiary-fixed: '#e5e2e1'
  tertiary-fixed-dim: '#c8c6c5'
  on-tertiary-fixed: '#1c1b1b'
  on-tertiary-fixed-variant: '#474746'
  background: '#121317'
  on-background: '#e3e2e7'
  surface-variant: '#343539'
typography:
  display-lg:
    fontFamily: Bodoni Moda
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Bodoni Moda
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Bodoni Moda
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Work Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Work Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Work Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 20px
  lg: 32px
  xl: 48px
  gutter: 20px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style
The design system embodies the sophistication of a high-end culinary editorial. It is designed to evoke the feeling of a premium printed cookbook while maintaining the fluid utility of a modern digital interface. The target audience consists of culinary enthusiasts and professional chefs who value precision, aesthetics, and clarity. 

The visual style is a fusion of **Minimalism** and **Glassmorphism**. It utilizes expansive white space, razor-sharp editorial typography, and translucent layers to create a sense of depth and focus. The experience should feel curated, authoritative, and aspirational.

## Colors
The palette is centered around a signature "Culinary Red" (#BE1E2D), used exclusively for primary actions and brand emphasis to maintain its impact. 

- **Light Mode:** Uses a warm, sophisticated cream (`#F9F7F2`) as the base surface to reduce eye strain and mimic premium paper stock. Text is rendered in deep charcoal (`#1A1A1A`) for maximum legibility.
- **Dark Mode:** Employs "Obsidian" tones, utilizing a true black base (`#0A0A0A`) with elevated surfaces in deep grays. High-contrast white or cream accents ensure functional clarity.
- **Accents:** Feedback colors (Success, Warning, Error) should be slightly desaturated to remain harmonious with the editorial aesthetic.

## Typography
The typography strategy relies on the high-contrast elegance of **Bodoni Moda** for headings to establish an editorial voice. This is balanced by **Work Sans**, a highly legible sans-serif, for body copy and functional labels to ensure the interface remains grounded and professional.

Large display type should utilize tighter letter spacing to emphasize the "stately" nature of the serif. Labels and captions should use increased letter spacing and uppercase styling to provide a clear functional distinction from narrative content.

## Layout & Spacing
The layout follows a strict **Fluid Grid** system based on a 4px baseline. A 12-column grid is used for desktop, 8-column for tablet, and 4-column for mobile.

- **Rhythm:** Primary internal container spacing is set to `20px` (md), while smaller component groupings use `16px` (sm) to create a clear hierarchy of information.
- **Safe Areas:** Maintain a minimum outer margin of `16px` on mobile devices. 
- **Alignment:** Content should be primarily left-aligned to mirror editorial layouts, with high-impact imagery spanning the full width of the container or grid.

## Elevation & Depth
Depth is communicated through **Glassmorphism** and subtle tonal layering rather than heavy shadows.

- **Surface Layers:** Use semi-transparent backgrounds with a `20px` to `40px` backdrop blur for navigation bars and floating overlays. This allows the vibrant colors of food photography to peek through the interface.
- **Light Mode Elevation:** Use thin, low-contrast inner borders (1px) in a slightly darker cream to define card edges.
- **Dark Mode Elevation:** Use "Obsidian" tiers. Background is #0A0A0A. Tier 1 surfaces are #1A1A1A. Tier 2 surfaces are #2C2C2E.
- **Shadows:** When necessary for modals, use extremely diffused, low-opacity neutral shadows (0px 12px 24px rgba(0,0,0,0.1)) to maintain a light, airy feel.

## Shapes
The shape language is sophisticated and modern. 

- **Cards:** All primary content cards must use a consistent `20px` corner radius to create a soft, high-end feel.
- **Interactive Elements:** Buttons and input fields follow the `rounded-lg` (16px) or `rounded-xl` (24px) standard.
- **Selection Indicators:** Use pill-shaped (fully rounded) containers for tags and category chips to contrast against the structured grid of the cards.

## Components
- **Buttons:** Primary buttons are solid `#BE1E2D` with white text. Secondary buttons use a ghost style (border only) in light mode or a glass-morphic style in dark mode. 
- **Cards:** Feature a "Recipe Card" with a `20px` radius, utilizing an image header and a blurred footer for titles.
- **Input Fields:** Minimalist design with a bottom border only in static states, transitioning to a full-outline when focused.
- **Frosted Overlays:** Used for "Quick View" panels, applying a heavy backdrop blur to keep the background context while focusing on specific recipe details.
- **Lists:** Ingredient lists should utilize high-contrast checkboxes that, when checked, strike through the text and dim it to the neutral color.
- **Navigation:** A bottom-fixed or top-floating bar using a glass effect to ensure it remains distinct from the content scrolling beneath it.