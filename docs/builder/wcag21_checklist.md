# WCAG 2.1 Checklist

Ensure all generated sites adhere to these accessibility guidelines:

1. **Color Contrast**: Text must have a contrast ratio of at least 4.5:1 against its background.
2. **Keyboard Navigation**: All interactive elements (links, buttons, inputs) must be focusable and triggerable via Keyboard (`Tab` and `Enter`/`Space`).
3. **Focus States**: Never use `outline: none` without providing a custom visible `:focus-visible` state.
4. **Alt Text**: All `<img>` tags or `next/image` components must have descriptive `alt` attributes. Decorative images should have `alt=""`.
5. **Semantic HTML**: Use `<header>`, `<nav>`, `<main>`, `<article>`, `<section>`, and `<footer>`. Headings (`<h1>` to `<h6>`) must not skip levels.
6. **ARIA Labels**: Use `aria-label` or `aria-labelledby` for buttons without text (e.g., icon buttons).
7. **Forms**: All `<input>` fields must have associated `<label>` elements.
8. **Reduced Motion**: Respect `prefers-reduced-motion` media query in CSS or via Framer Motion's `useReducedMotion`.
