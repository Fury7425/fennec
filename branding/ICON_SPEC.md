# Fennec Icon Specification

## Mascot concept

A stylized geometric fox — minimal, modern, and warm. The design should feel calm and trustworthy, not playful or cartoonish. Think: a fox silhouette reduced to its essential shapes.

**Key traits:**
- Triangular ears, prominent and upright
- Warm amber/rust color palette
- Clean geometric construction
- Works at all sizes from 16px to 1024px

---

## Color palette

| Name | Hex | Usage |
|------|-----|-------|
| Fox Orange | `#E8672A` | Primary body color |
| Rust Dark | `#2D1B0E` | Outlines, dark areas |
| Warm Sand | `#F4A261` | Highlight, inner ear |
| White | `#FFFFFF` | Eye whites, chest patch |

---

## Required sizes

| Size | Format | Platform |
|------|--------|----------|
| 16×16 | PNG | Browser favicon, taskbar |
| 32×32 | PNG | Windows taskbar |
| 48×48 | PNG | Linux app grid |
| 64×64 | PNG | macOS Dock (non-retina) |
| 128×128 | PNG | macOS Dock (retina) |
| 256×256 | PNG | Windows Explorer |
| 512×512 | PNG | macOS Retina Dock |
| 1024×1024 | PNG | App Store, marketing |

---

## Platform formats

| File | Platform | Contents |
|------|----------|----------|
| `fennec.icns` | macOS | 16, 32, 64, 128, 256, 512, 1024 (1x + 2x) |
| `fennec.ico` | Windows | 16, 32, 48, 256 |
| `fennec-16.png` through `fennec-512.png` | Linux | Individual sizes |
| `fennec-nightly.icns` | macOS | Same sizes, with amber tint overlay |
| `fennec-nightly.ico` | Windows | Same sizes, with amber tint |

---

## Do / Don't

**Do:**
- Use flat design with minimal gradients
- Keep the icon legible at 16×16
- Use the full color palette at larger sizes

**Don't:**
- Add drop shadows or emboss effects
- Use more than 4 colors in the main icon
- Include text in the icon
- Use photorealistic fur textures
