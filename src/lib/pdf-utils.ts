import html2canvas from "html2canvas";

/**
 * html2canvas doesn't support oklch/lch/color functions natively.
 * This utility clones the target DOM node, computes all styles, 
 * and replaces unsupported colors with RGB equivalents using the browser's native canvas API.
 */
function sanitizeColorString(str: string): string {
  if (!str || (!str.includes('oklch') && !str.includes('lch') && !str.includes('color('))) return str;

  // Find all color function occurrences like oklch(...)
  // Handles nested parenthesis if any, but computed styles usually have flat oklch(r g b / a)
  return str.replace(/(?:oklch|lch|color)\([^)]+\)/g, (match) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return match;
    
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = match;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    
    // Convert back to standard rgba which html2canvas parses easily
    return `rgba(${d[0]}, ${d[1]}, ${d[2]}, ${d[3] / 255})`;
  });
}

export async function captureSanitizedPdfPage(originalElement: HTMLElement): Promise<string> {
  // 1. Clone the element
  const clone = originalElement.cloneNode(true) as HTMLElement;
  
  // 2. We must append the clone to the DOM to compute its styles properly
  // We place it off-screen
  const wrapper = document.createElement('div');
  wrapper.style.position = 'absolute';
  wrapper.style.top = '-9999px';
  wrapper.style.left = '-9999px';
  wrapper.style.width = `${originalElement.offsetWidth}px`;
  wrapper.style.pointerEvents = 'none';
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    // 3. Traverse and sanitize all computed styles
    const originalNodes = Array.from(originalElement.querySelectorAll('*'));
    originalNodes.unshift(originalElement); // Include root
    
    const cloneNodes = Array.from(clone.querySelectorAll('*'));
    cloneNodes.unshift(clone);

    const stylesToCopy = [
      'color', 'backgroundColor', 'borderColor', 
      'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
      'fill', 'stroke', 'backgroundImage', 'boxShadow'
    ];

    for (let i = 0; i < originalNodes.length; i++) {
      const orig = originalNodes[i] as HTMLElement | SVGElement;
      const cl = cloneNodes[i] as HTMLElement | SVGElement;
      
      const computed = window.getComputedStyle(orig);
      
      // Copy layout critical styles to ensure it looks identical
      // Wait, cloning normally copies classes, but external stylesheets might behave differently if out of context.
      // But we just append it to body, so global styles still apply.
      // We only need to force override the unsupported color styles.
      
      for (const prop of stylesToCopy) {
        const val = computed.getPropertyValue(prop.replace(/([A-Z])/g, "-$1").toLowerCase());
        if (val && (val.includes('oklch') || val.includes('lch') || val.includes('color('))) {
          const sanitized = sanitizeColorString(val);
          cl.style.setProperty(prop.replace(/([A-Z])/g, "-$1").toLowerCase(), sanitized, 'important');
        }
      }

      // Also sanitize SVG attributes if present
      ['fill', 'stroke'].forEach(attr => {
        const val = orig.getAttribute(attr);
        if (val && (val.includes('oklch') || val.includes('lch') || val.includes('color('))) {
          cl.setAttribute(attr, sanitizeColorString(val));
        }
      });
    }

    // 4. Render with html2canvas using the sanitized clone
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff", // Force white background as requested
    });

    return canvas.toDataURL("image/jpeg", 0.95);
  } finally {
    // 5. Cleanup
    document.body.removeChild(wrapper);
  }
}
