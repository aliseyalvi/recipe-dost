---
name: Obsidian Table
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#e3bebb'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#aa8987'
  outline-variant: '#5b403f'
  surface-tint: '#ffb3b0'
  primary: '#ffb3b0'
  on-primary: '#68000f'
  primary-container: '#be1e2d'
  on-primary-container: '#ffd3d1'
  inverse-primary: '#b91a2a'
  secondary: '#c6c6c7'
  on-secondary: '#2f3131'
  secondary-container: '#454747'
  on-secondary-container: '#b4b5b5'
  tertiary: '#85d1ef'
  on-tertiary: '#003544'
  tertiary-container: '#006a85'
  on-tertiary-container: '#abe6ff'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdad8'
  primary-fixed-dim: '#ffb3b0'
  on-primary-fixed: '#410006'
  on-primary-fixed-variant: '#930019'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c7'
  on-secondary-fixed: '#1a1c1c'
  on-secondary-fixed-variant: '#454747'
  tertiary-fixed: '#baeaff'
  tertiary-fixed-dim: '#85d1ef'
  on-tertiary-fixed: '#001f29'
  on-tertiary-fixed-variant: '#004d62'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Bodoni Moda
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Bodoni Moda
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Bodoni Moda
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.1em
  metadata:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  page-padding: 16pt
  structural-gap: 20pt
  element-gap: 12pt
  section-margin: 40pt
---

## Brand & Style

This design system embodies the atmosphere of an exclusive, dimly lit Michelin-star kitchen. It is an ultra-premium culinary platform where the ingredients and photography take center stage. The style is **Editorial Minimalism mixed with Glassmorphism**, focusing on high-contrast typography, deep depth through translucent layering, and a "quiet luxury" aesthetic. 

The target audience consists of culinary professionals and high-end enthusiasts who value precision and visual storytelling. The UI should feel immersive, expensive, and authoritative, using dark-mode surfaces to allow vibrant food photography to pop with maximum intensity.

## Colors

The palette is rooted in a **Rich Obsidian** (#0A0A0A) background to provide a canvas of infinite depth. 
- **Primary:** A Deep Red (#BE1E2D) is reserved strictly for high-priority calls to action and critical interactive states. 
- **Overlays:** Translucency is a core structural element. Use white overlays at 6% for large structural sections and 12% for interactive surfaces (pills, buttons).
- **Typography:** Crisp White (#FFFFFF) is used for headings to ensure maximum legibility, while Muted Slate-Gray (#71717A) is used for secondary metadata to maintain visual hierarchy.

## Typography

The typographic system relies on a high-contrast pairing:
- **Serif (Bodoni Moda):** Used for headlines and titles. It brings a fashion-forward, editorial authority to the interface. Headlines should utilize generous line-heights to feel airy and unhurried.
- **Sans-Serif (Hanken Grotesk):** A clean, contemporary grotesque used for body text and metadata. It provides a technical, precise counterpoint to the romantic serif headlines.
- **Labels:** Use uppercase styling with wide tracking (10%) for category tags and small labels to reinforce the premium branding.

## Layout & Spacing

The layout philosophy follows a **Fixed-Fluid Hybrid** model. While the content max-width is constrained on desktop to preserve editorial readability, the inner elements utilize a strict 20pt structural gap for vertical rhythm.

- **Margins:** A consistent 16pt outer padding is maintained across all device sizes to ensure the content never feels cramped against the bezel.
- **Whitespace:** Use intentional, large "islands" of whitespace between major sections (40pt+) to separate the narrative of the culinary experience.
- **Alignment:** Content is generally center-aligned for display views (recipe covers) and left-aligned for instructional content.

## Elevation & Depth

This system avoids traditional box-shadows. Instead, depth is achieved through **Tonal Stacking** and **Glassmorphism**:
- **Layer 0:** Deep Obsidian background.
- **Layer 1:** 6% White Overlay for background sections (like a recipe method container).
- **Layer 2:** 12% White Overlay with a 16px Backdrop Blur for interactive elements like floating navigation bars or selection pills.
- **Borders:** Use a 1px solid border at 10% white opacity on translucent elements to define edges against the dark background without adding visual weight.

## Shapes

The design system uses a signature **20pt Border Radius** for all primary containers and interactive elements. This large radius creates a soft, organic feel that contrasts with the sharp, high-contrast typography. 

- **Primary Radius:** 20pt (used for recipe images, main glass panels).
- **Secondary Radius:** 12pt (used for smaller inputs and internal elements).
- **Pills:** Fully rounded (500px) for status indicators and category chips.

## Components

- **Buttons:** Primary buttons use the Deep Red (#BE1E2D) with white text, no border, and a 20pt radius. Secondary buttons use the 12% glass overlay with a subtle 1px border.
- **Pills/Chips:** These are the primary "glass" elements. Use 12% white translucent background with a backdrop blur. These should house metadata like "Prep Time" or "Difficulty."
- **Lists:** Ingredient lists should have no visible borders between items. Use vertical spacing (12pt) and high-contrast typography for the quantity, with muted slate-gray for the ingredient name.
- **Input Fields:** Minimalist design with a 1px bottom border only (White at 20% opacity). On focus, the border transitions to Deep Red.
- **Cards:** Do not use traditional cards with shadows. Instead, use "Frameless Layouts" where photography fills the width of the container, and text is placed directly on the Obsidian background or a light glass overlay at the bottom of the image.
- **Checkboxes:** Custom circular checkboxes using the Deep Red primary color for the "checked" state, maintaining the 20pt radius aesthetic in a scaled-down form.