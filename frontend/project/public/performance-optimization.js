if (document.head) {
  // Create a style element
  const style = document.createElement("style");
  style.textContent = `
    /* Add these styles to reduce layout thrashing during sidebar transitions */
    body {
      overscroll-behavior: none;
    }
    * {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .transform-gpu {
      transform: translateZ(0);
    }
    .backface-visibility-hidden {
      backface-visibility: hidden;
    }
  `;
  document.head.appendChild(style);
} 