---
name: Flowish
description: A calm personal planning workspace built from solid glass panes.
colors:
  primary: "#bf442e"
  primary-hover: "#a13423"
  canvas: "#dedfd8"
  pane: "#f3f1e9"
  card: "#f6f3eb"
  ink: "#282b27"
  ink-secondary: "#555c53"
  ink-muted: "#696f66"
  line: "#d4d1c5"
  focus-wash: "#f3d8cd"
  backlog: "#3e6474"
  ritual: "#4c6743"
  event: "#a3561d"
  dark-canvas: "#191b19"
  dark-pane: "#252825"
  dark-card: "#292c28"
  dark-ink: "#eeefea"
  dark-primary: "#ed987e"
  glass-rim: "#ffffff"
  brand-rim: "#fffaf2"
  black: "#000000"
typography:
  display:
    fontFamily: "Manrope, Noto Sans SC Variable, Noto Sans SC, PingFang SC, sans-serif"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Manrope, Noto Sans SC Variable, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: "0.94rem"
    fontWeight: 650
    lineHeight: 1.3
  body:
    fontFamily: "Noto Sans SC Variable, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Noto Sans SC Variable, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: "0.68rem"
    fontWeight: 500
    lineHeight: 1.4
  brand:
    fontFamily: "Manrope, Noto Sans SC Variable, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 700
    lineHeight: 1.2
  quote:
    fontFamily: "Noto Sans SC Variable, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 400
    lineHeight: 1.5
  metric:
    fontFamily: "Manrope, Noto Sans SC Variable, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: "2.4rem"
    fontWeight: 600
    lineHeight: 1.1
  compact-metric:
    fontFamily: "Manrope, Noto Sans SC Variable, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.1
  milestone-value:
    fontFamily: "Manrope, Noto Sans SC Variable, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 600
    lineHeight: 1.2
  meta:
    fontFamily: "Noto Sans SC Variable, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 500
    lineHeight: 1.4
  calendar:
    fontFamily: "Manrope, Noto Sans SC Variable, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 650
    lineHeight: 1.4
  micro:
    fontFamily: "Noto Sans SC Variable, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: "0.6rem"
    fontWeight: 500
    lineHeight: 1.3
  badge:
    fontFamily: "Noto Sans SC Variable, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: "0.55rem"
    fontWeight: 600
    lineHeight: 1.3
  small-label:
    fontFamily: "Noto Sans SC Variable, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: "0.65rem"
    fontWeight: 500
    lineHeight: 1.4
  compact-label:
    fontFamily: "Noto Sans SC Variable, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: "0.66rem"
    fontWeight: 500
    lineHeight: 1.4
  compact-text:
    fontFamily: "Noto Sans SC Variable, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: "0.7rem"
    fontWeight: 500
    lineHeight: 1.5
  phone-label:
    fontFamily: "Noto Sans SC Variable, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.5
  phone-body:
    fontFamily: "Noto Sans SC Variable, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: "0.84rem"
    fontWeight: 400
    lineHeight: 1.65
  phone-title:
    fontFamily: "Manrope, Noto Sans SC Variable, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 650
    lineHeight: 1.4
  phone-brand:
    fontFamily: "Manrope, Noto Sans SC Variable, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 700
    lineHeight: 1.2
  compact-brand:
    fontFamily: "Manrope, Noto Sans SC Variable, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.2
  large-value:
    fontFamily: "Manrope, Noto Sans SC Variable, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 600
    lineHeight: 1.2
rounded:
  badge: "2px"
  tag: "3px"
  hairline: "4px"
  micro: "7px"
  sm: "8px"
  mini: "9px"
  compact: "10px"
  md: "12px"
  lg: "16px"
  xl: "20px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "18px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#fffaf4"
    rounded: "{rounded.sm}"
    padding: "0 9px"
    height: "36px"
  input:
    backgroundColor: "#fffefd"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "9px 10px"
    height: "40px"
  panel:
    backgroundColor: "{colors.pane}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "20px"
---

# Design System: Flowish

## Overview

Flowish uses a restrained Solid Glass material model. A pane reads almost solid
from across the room; its edge reveals the glass through a bright upper rim, a
fine outline and a shadow gathered below. The product remains a working
instrument, so the glass supports hierarchy without obscuring dates, task
labels or state.

The system uses warm, lightly tinted surfaces in light mode and smoky neutral
panes in dark mode. Vermilion marks primary actions and today; muted blue,
green and ochre distinguish backdrop, rituals and dates.

## Colors

The canvas sits behind slightly lighter panes, with text kept neutral. Accent
color is semantic and sparse.

### Primary

- Vermilion (`#bf442e`): primary actions, today and focus signals.
- Soft Vermilion (`#f6ded4`): today selection and completion feedback.

### Secondary

- Slate Blue (`#456472`): backlog and neutral selections.
- Moss (`#526a49`): rituals and completed checks.
- Ochre (`#a45a24`): event and countdown actions.

### Neutral

- Warm Canvas (`#dedfd8`): page background, visibly darker than every pane.
- Pane (`#f3f1e9`): primary work surfaces.
- Card (`#f6f3eb`): overview and emphasized panes.
- Ink (`#282b27`): primary text.
- Muted Ink (`#696f66`): secondary labels at a readable contrast.

## Typography

Display and interface text use Manrope for Latin glyphs and Noto Sans SC for
Chinese. Display tracking is tight; body text remains near normal tracking.

### Hierarchy

- Display (600, 2.4rem, 1.1): overview percentages and timer numerals.
- Title (650, 0.94rem, 1.3): panel headings.
- Body (400, 0.82rem, 1.65): tasks, notes and agenda rows.
- Label (500, 0.68rem, 1.4): counts, metadata and compact controls.

## Layout

Desktop uses three vertical rails: today, time and capture inside the viewport.
The page itself does not scroll at standard desktop sizes; long task, agenda,
milestone and ritual lists scroll inside their panels. Below 1080px or 720px of
height, the workspace stacks into a scrolling single column. Panels use 10px
gaps and 14px internal padding on desktop, reducing to 8px gaps and 12px
padding on narrow screens.

## Elevation & Depth

Depth comes from material thickness. Panels receive a bright inset rim, a faint
inner line, a hairline outline and a soft shadow below. Each working area has
one restrained color wash and a matching top light edge. Overview rows keep
the strongest vermilion tint; calendar details use blue-grey, important dates
use ochre and rituals use moss. Popovers and dialogs form the thickest layer,
using stronger edge definition and backdrop blur. Blur is not applied to
ordinary in-flow panels.

## Shapes

Panels use 16px corners, overview surfaces 16px, controls 8px and compact state
surfaces 7px. Calendar cells use quiet 7px rounded state fills rather than
individual outlined cards.

## Components

### Buttons

Primary buttons are solid vermilion panes with a bright top rim and subtle
bottom shade. Secondary and icon buttons use clear glass with a visible hover
state. Press feedback is immediate and scales to 0.96.

### Inputs

Fields use nearly clear glass, a fine edge and a bright upper highlight. Focus
uses the same vermilion ring used by keyboard navigation.

### Panels

Panels never stack a second container card inside themselves. Lists use space
and hairline dividers. Important dates and rituals read as rows rather than
nested cards.

### Dialogs

Dialogs use the thickest pane, a 16px radius and a short materialize animation
from a nearly settled position. Backdrop opacity carries the modal boundary.

## Do's and Don'ts

- Keep blur on overlapping chrome, menus and dialogs.
- Use edges and shadows to express pane thickness.
- Preserve readable Chinese text at phone width and at increased text size.
- Use vermilion for actions and current state, not general decoration.
- Avoid gradients across glass faces, decorative blobs and nested cards.
- Respect reduced motion, reduced transparency and increased contrast.
