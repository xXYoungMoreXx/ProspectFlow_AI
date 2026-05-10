# Framer Motion Patterns

When building templates, use these patterns for Framer Motion to ensure high performance and accessibility:

1. **Accessibility (Reduced Motion)**:
Always respect the user's OS-level motion preferences using `useReducedMotion`.
```tsx
import { motion, useReducedMotion } from 'framer-motion';

export const FadeIn = ({ children }) => {
  const shouldReduceMotion = useReducedMotion();
  
  return (
    <motion.div
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {children}
    </motion.div>
  );
};
```

2. **Scroll-Triggered Reveals**:
Use `whileInView` for easy scroll animations, but keep `viewport={{ once: true }}` to avoid excessive layout thrashing on scroll up/down.

3. **Layout Animations**:
Use `layout` prop carefully. Wrap complex list animations in `<AnimatePresence>` for exit animations.

4. **Performance**:
Animate only `transform` and `opacity` properties to ensure hardware acceleration. Avoid animating `width`, `height`, or `top`/`left`.
