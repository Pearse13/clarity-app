// import React, { useRef } from 'react';
import { useRef } from 'react';
import { Wand2, Download } from 'lucide-react';

interface LogoProps {
  size?: number;
  color?: string;
  downloadable?: boolean;
}

export function Logo({ size = 32, color = "#2563eb", downloadable = false }: LogoProps) {
  const logoRef = useRef<HTMLDivElement>(null);

  const downloadLogo = async () => {
    if (!logoRef.current) return;
    
    try {
      // Create a canvas with the logo
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size
      canvas.width = 300;
      canvas.height = 100;

      // Draw background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Convert SVG to data URL
      const svgString = `
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 4V2m0 2v2m0-2h-4.5m0 0a3.5 3.5 0 1 0-3.5 3.5M3 10h18M3 10l2 8h14l2-8M3 10l2.5-4.5m13 4.5l-2.5-4.5" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      // Load SVG image
      const img = new Image();
      img.src = svgUrl;
      
      await new Promise((resolve) => {
        img.onload = () => {
          // Draw logo
          ctx.drawImage(img, 40, 25, size, size);
          
          // Draw text
          ctx.font = '40px -apple-system, BlinkMacSystemFont, SF Pro Display, system-ui, sans-serif';
          ctx.fillStyle = '#111827'; // text-gray-900
          ctx.fillText('Clarity', 80, 65);
          
          // Create download link
          const link = document.createElement('a');
          link.download = 'clarity-logo.jpg';
          link.href = canvas.toDataURL('image/jpeg', 0.9);
          link.click();
          
          // Cleanup
          URL.revokeObjectURL(svgUrl);
          resolve(true);
        };
      });
    } catch (error) {
      console.error('Error downloading logo:', error);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div ref={logoRef} className="inline-flex items-center gap-2 mb-2">
        <Wand2 size={size} color={color} strokeWidth={1.5} />
        <span className="text-[2.5rem] leading-none font-medium text-gray-900">Clarity</span>
      </div>
      {downloadable && (
        <button
          onClick={downloadLogo}
          className="flex items-center gap-2 px-4 py-2 text-[13px] text-blue-600 bg-blue-50/50 rounded-lg hover:bg-blue-50/80 transition-colors"
        >
          <Download size={16} />
          Download Logo
        </button>
      )}
    </div>
  );
}