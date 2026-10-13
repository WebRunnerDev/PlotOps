---
version: alpha
name: PlotOps
description: Dark project tracker with sharp corners, a cyan accent, and mono type for git data.
x-zsd:
  profile: "0.1"
  kind: project
  source:
    method: generated
    captured: 2026-10-13
    paths:
      - src/app/styles/index.css
      - src/app/model/theme.ts
      - src/shared/shadcn/ui/button.tsx
      - src/shared/shadcn/ui/input.tsx
      - src/shared/shadcn/ui/card.tsx
      - src/shared/shadcn/ui/badge.tsx
      - src/shared/shadcn/ui/alert.tsx
      - src/shared/shadcn/ui/dialog.tsx
      - src/shared/shadcn/ui/dropdown-menu.tsx
      - src/shared/shadcn/ui/select.tsx
      - src/widgets/main-layout/ui/main-layout.tsx
      - src/widgets/top-bar/ui/top-bar.tsx
      - components.json
      - docs/adr/0007-figma-make-skin-redesign.md
  review:
    status: draft
  intent:
    audience: People who track project work and git status.
    primary-task: Move tasks on a board and read git, CI, and task detail.
    character: Dark surfaces, sharp corners, cyan accent, and mono git data.
    density: compact
    theme: dark
    references:
      - docs/adr/0007-figma-make-skin-redesign.md
  preferences:
    must-use:
      - Dark theme as the default.
      - Radius token none on controls, cards, and dialogs.
      - Space Grotesk for headings, IBM Plex Sans for body text, and JetBrains Mono for code and meta.
      - A status color with an icon or a text label.
    must-avoid:
      - A font outside the three recorded families.
      - A solid error fill with light text.
      - Gradients on app pages. The auth atmosphere is the exception.
    preserve:
      - Font families Space Grotesk, IBM Plex Sans, and JetBrains Mono.
      - Feature structure when the skin changes. See docs/adr/0007-figma-make-skin-redesign.md.
  implementation:
    token-source: src/app/styles/index.css
    component-sources:
      - src/shared/shadcn/ui
    style-sources:
      - src/app/styles/index.css
    font-assets:
      - "@fontsource/space-grotesk"
      - "@fontsource/ibm-plex-sans"
      - "@fontsource/jetbrains-mono"
    image-assets: []
    icon-assets:
      - lucide-react
  unresolved:
    - Running interface styles are not measured. Values come from source files captured on 2026-10-13.
    - Light primary #0284C7 with text #F8FAFC is 3.91:1. The light mode does not replace primary or on-primary.
    - Light muted #E2E8F0 with text #64748B is 3.86:1. The light mode does not replace surface-muted or on-surface-muted.
    - Light success text #238636 on the light page surface is 4.23:1.
    - Light warning text #9A6700 on the light page surface is 4.44:1.
    - Light error text #DA3633 on the light page surface is 4.21:1. The same text on a white card is 4.61:1.
    - Light border and sidebar border use color-mix. No hex is recorded. Do not reuse dark outline on a light page.
    - Light sidebar surface is #F8FAFC. It is not a separate token.
    - Dark menu highlight uses accent #2BB8E8 with text #F0F2F5 at 2.05:1. No on-accent token is recorded.
    - Dark error fill #F85149 with text #F0F2F5 is 2.99:1. No on-error token is recorded.
    - Dark success fill text is #08090E. Components use success as text, not as a solid fill.
    - Display type uses clamp. No headline-display token is recorded.
    - Primary hover is primary at 80 percent. No separate hex is recorded.
    - Control focus is a 3px ring at 50 percent of primary. The brand link uses a 2px ring and a 2px offset.
    - Light focus ring is #0EA5E9. The light mode does not replace the focus color.
    - Button, input, and card primitives do not define loading, empty, or success states.
    - The minimum viewport width is not set in source.
    - Epic and priority colors use Tailwind palette classes, not these tokens.
    - Chart scale colors use oklch, not hex.
    - Grid line color is #141820 in dark and #CBD5E1 in light. Input border in dark matches outline. Light input border is #E2E8F0.
    - Auth page insets differ from the app spacing scale.
    - Toast inline padding is 14px. The toast records md for the block padding.
    - Icon stroke width is the Lucide default. The project does not set it.
  layout:
    content-max: 1152px
  breakpoints:
    sm: 640px
    md: 768px
  border:
    width-default: 1px
    width-status: 3px
    color-default: "{colors.outline}"
  elevation:
    toast: 3px 3px 0 0
  motion:
    duration-fast: 100ms
    duration-section: 300ms
    duration-page: 420ms
    duration-reveal: 800ms
    duration-scan: 2400ms
    duration-breathe: 2000ms
    press-offset: 1px
    easing-standard: cubic-bezier(0.16, 1, 0.3, 1)
    easing-quart: cubic-bezier(0.25, 1, 0.5, 1)
  accessibility:
    target-min: "{spacing.control-height}"
    focus-width: 3px
    focus-offset: 0px
    focus-color: "{colors.primary}"
  modes:
    light:
      colors:
        surface: "#F1F5F9"
        on-surface: "#0A0F1D"
        surface-raised: "#FFFFFF"
        on-surface-raised: "#0A0F1D"
        surface-secondary: "#E2E8F0"
        on-surface-secondary: "#0A0F1D"
        error: "#DA3633"
        success: "#238636"
        warning: "#9A6700"
        on-warning: "#F8FAFC"
colors:
  primary: "#3ECFFF"
  on-primary: "#08090E"
  surface: "#08090E"
  on-surface: "#F0F2F5"
  surface-raised: "#12151C"
  on-surface-raised: "#F0F2F5"
  surface-muted: "#161A22"
  on-surface-muted: "#8B929E"
  surface-secondary: "#181C24"
  on-surface-secondary: "#F0F2F5"
  outline: "#1E2535"
  error: "#F85149"
  success: "#3FB950"
  warning: "#D29922"
  on-warning: "#08090E"
typography:
  headline-lg:
    fontFamily: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif'
    fontSize: 33px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline-md:
    fontFamily: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif'
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline-sm:
    fontFamily: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif'
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  headline-xs:
    fontFamily: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif'
    fontSize: 19px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0px
  body-md:
    fontFamily: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif'
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0px
  body-sm:
    fontFamily: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif'
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.428571
    letterSpacing: 0px
  label-md:
    fontFamily: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif'
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0px
  label-sm:
    fontFamily: '"JetBrains Mono", ui-monospace, monospace'
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 0.04em
  label-xs:
    fontFamily: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif'
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.333333
    letterSpacing: 0px
  code-md:
    fontFamily: '"JetBrains Mono", ui-monospace, monospace'
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  section: 32px
  grid: 20px
  control-pad: 10px
  control-height: 32px
  top-bar: 48px
  icon: 16px
  icon-sm: 12px
rounded:
  none: 0px
  full: 9999px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.none}"
    padding: "{spacing.control-pad}"
    height: "{spacing.control-height}"
  button-secondary:
    backgroundColor: "{colors.surface-secondary}"
    textColor: "{colors.on-surface-secondary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.none}"
    padding: "{spacing.control-pad}"
    height: "{spacing.control-height}"
  button-muted:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.on-surface-muted}"
    typography: "{typography.label-md}"
    rounded: "{rounded.none}"
    padding: "{spacing.control-pad}"
    height: "{spacing.control-height}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.none}"
    padding: "{spacing.control-pad}"
    height: "{spacing.control-height}"
  card:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.on-surface-raised}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.none}"
    padding: "{spacing.lg}"
  badge:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-xs}"
    rounded: "{rounded.none}"
    padding: "{spacing.sm}"
  alert:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.on-surface-raised}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.none}"
    padding: "{spacing.control-pad}"
  alert-error:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.error}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.none}"
    padding: "{spacing.control-pad}"
  status-success:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.success}"
    typography: "{typography.label-md}"
    rounded: "{rounded.none}"
    padding: "{spacing.sm}"
  status-warning:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.warning}"
    typography: "{typography.label-md}"
    rounded: "{rounded.none}"
    padding: "{spacing.sm}"
---

# PlotOps

## Overview

PlotOps is a dark project tracker. People move tasks and read git status.
This file records source tokens from 2026-10-13. It does not record a running page.

The default theme is dark. Light mode replaces only keys in `x-zsd.modes.light`.
Corners use `none`. Read `x-zsd.unresolved` before you copy a dark color into light.

### Implementation

Read `x-zsd.implementation` before a UI change.
Reuse the listed components. Keep feature behavior when you change the skin.

## Colors

- `primary` and `on-primary`: Use for the main action. Use dark text on that fill.
- `surface` and `on-surface`: Use for the page and for input text.
- `surface-raised` and `on-surface-raised`: Use for cards, dialogs, and toasts.
- `surface-muted` and `on-surface-muted`: Use for a quiet action and for placeholder text.
- `surface-secondary` and `on-surface-secondary`: Use for a secondary action.
- `outline`: Use for control borders and dividers in the dark theme.
- `error`: Use for error text and for an invalid control border.
- `success`: Use for success status text on the page.
- `warning` and `on-warning`: Use `warning` for status text. Use `on-warning` on a solid warning fill.

The light mode lists its own keys. It does not replace `primary`, `outline`, or `surface-muted`.
Do not reuse those dark colors on a light page.

## Typography

- `headline-lg`: Use for the page title at `md` and above.
- `headline-md`: Use for the page title below `md`.
- `headline-sm`: Use for a section title.
- `headline-xs`: Use for a card title or a dialog title.
- `body-md`: Use for body text and for input text below `md`.
- `body-sm`: Use for alert text and for input text at `md`.
- `label-md`: Use for control labels and action text.
- `label-sm`: Use for uppercase meta labels.
- `label-xs`: Use for badge text.
- `code-md`: Use for code, branches, and git data.

Keep one page title in the main content. Keep text selectable.

## Layout

Center default pages within `x-zsd.layout.content-max`.
Kanban and project routes use the full width.
Use `lg` for page padding. Use `section` for the page block. Use `xl` between groups.

Use `sm` between related items. Use `xs` between a label and helper text.
Below `sm`, the top bar wraps to two rows. At `sm`, its height is `top-bar`.
At `md`, the page title uses `headline-lg`.

Support narrow widths without page-level horizontal scrolling.
Keep wide data in a labeled scroll region.

## Elevation & Depth

Separate regions with surface contrast, spacing, and borders.
Apply `x-zsd.border.width-default` and `outline` to control borders.
Cards and dialogs use a hairline ring.
Toasts use `x-zsd.elevation.toast` and `x-zsd.border.width-status` on the leading edge.
The toast shadow is a hard offset. It mixes foreground at a low percent.

## Shapes

- `none`: Use for controls, cards, dialogs, alerts, and toasts.
- `full`: Use for the board scrollbar thumb only.

## Components

### Button

Use `button-primary` for the main action in a group.
Use `button-secondary` for an alternate action.
Use `button-muted` for a quiet action.
Name the action in the label.

- On hover, show `primary` at 80 percent for the main action.
- On focus, use the focus rules in Accessibility.
- On press, shift the control by `x-zsd.motion.press-offset`.
- A disabled control uses half opacity and ignores pointer events.
- An invalid control uses an `error` border.
- This file leaves loading and success states open on this control.

### Input

Use `input` with a visible label above the control.
Placeholder text uses `on-surface-muted`.

- On hover, keep the same fill and label.
- On focus, use the focus rules in Accessibility.
- An invalid value uses an `error` border and an `error` message.
- A disabled field uses half opacity.
- Keep the entered value after an error.

### Card

Use `card` for one related group.
Dialogs use the same fill and text as `card`.
Use `headline-xs` for the group title.

- An empty group must state what belongs there and offer the next action.
- Task-card selection is not part of this primitive.

### Badge

Use `badge` for a short status or category label.
Use `label-xs` for the badge text.

- On focus, use the focus rules in Accessibility.
- An outline badge uses an `outline` border and `on-surface` text.

### Alert

Use `alert` for a neutral notice.
Use `alert-error` when the task needs attention. State the failure and a recovery action.
Toasts use the card fill, `x-zsd.elevation.toast`, and a status border.
Announce the notice to assistive technology.

- Block padding on an alert uses `sm`.
- A success or error toast keeps `on-surface-raised` text and colors the leading edge.

### Status

Use `status-success` and `status-warning` for status text on `surface`.
Add an icon or a text label with the color.
This file leaves a solid success fill open.

## Do's and Don'ts

- Do use the tokens in this file for repeated color, type, spacing, and radius.
- Do keep dark as the default theme.
- Do use `code-md` for git names and code.
- Do pair a status color with an icon or a text label.
- Do read `x-zsd.unresolved` before you apply the light mode.
- Do not add a font outside the three recorded families.
- Do not set a control radius other than `none`.
- Do not use a solid error fill with light text.
- Do not hide the focus ring.

## Motion

Use `x-zsd.motion.easing-standard` for page and section moves.
Use `x-zsd.motion.duration-page` for a route change.
Use `x-zsd.motion.duration-section` for a section change.
Use `x-zsd.motion.duration-fast` for a dialog.
Use `x-zsd.motion.duration-reveal` for a load reveal.

A live CI scan uses `x-zsd.motion.duration-scan`. A failed scan does not run.
Hover on the brand link uses `x-zsd.motion.easing-quart`.
With reduced motion, show the end state and do not run these animations.

## Iconography

Use Lucide icons from `x-zsd.implementation.icon-assets`.
Use `icon` inside controls. Use `icon-sm` inside badges.
Give an icon-only control an accessible name.
Use a decorative icon only to clarify group or status.

## Imagery

The product has no photo style.
The auth page can use the auth atmosphere. App pages stay on `surface`.
The blueprint grid uses `grid` for its cell size.
This file leaves the grid line color open. See `x-zsd.unresolved`.

## Accessibility

Support keyboard use. Follow reading order for the tab order.
Use `x-zsd.accessibility.focus-width`, `x-zsd.accessibility.focus-offset`, and `x-zsd.accessibility.focus-color` on controls.
Keep the focus ring visible when a dialog or sticky bar covers the page.

Expose input errors in text and in the control association.
The measured target size is `control-height`. This file does not set a larger minimum.
Check contrast on the surface the user sees. Several light pairs fail. See `x-zsd.unresolved`.
