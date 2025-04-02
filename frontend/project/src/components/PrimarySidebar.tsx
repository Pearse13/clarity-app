import React, { memo, useRef, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSidebar } from '../contexts/SidebarContext';
import { FileText, Brain, Settings } from 'lucide-react';

// Detect if device is touch-based
const isTouchDevice = () => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

// Memoize the component to prevent unnecessary re-renders
const PrimarySidebar: React.FC = memo(() => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isOpen, setOpen } = useSidebar();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isTouch = isTouchDevice();
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  const isActive = (path: string) => location.pathname === path;

  // Check if device is mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);

    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Add focus tracking to close sidebar when focus leaves
  useEffect(() => {
    const handleWindowBlur = () => {
      // Close sidebar when window loses focus
      setOpen(false);
    };

    const handleMouseLeave = (e: MouseEvent) => {
      // Additional check if mouse has completely left the window
      if (e.clientX <= 0 || e.clientX >= window.innerWidth || 
          e.clientY <= 0 || e.clientY >= window.innerHeight) {
        setOpen(false);
      }
    };

    // On iOS/touch devices, add touchend listener to detect taps outside sidebar
    const handleTouchOutside = (e: TouchEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    // Track global mouse movement to detect when user leaves the app area
    window.addEventListener('blur', handleWindowBlur);
    
    // Use appropriate events based on device type
    if (isTouch) {
      document.addEventListener('touchend', handleTouchOutside);
    } else {
      document.addEventListener('mouseleave', handleMouseLeave);
    }
    
    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      if (isTouch) {
        document.removeEventListener('touchend', handleTouchOutside);
      } else {
        document.removeEventListener('mouseleave', handleMouseLeave);
      }
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, [setOpen, isTouch]);

  const handleMouseEnter = () => {
    if (!isTouch) {
      // Clear any pending timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      setOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isTouch) {
      // Close almost immediately on mouse leave
      hoverTimeoutRef.current = setTimeout(() => {
        setOpen(false);
      }, 30); // Reduced from 100ms to 30ms for faster response
    }
  };

  const navigationItems = [
    {
      path: '/lecture',
      icon: <FileText />,
      label: 'Lecture'
    },
    {
      path: '/learn',
      icon: <Brain />,
      label: 'Learn'
    },
    {
      path: '/settings',
      icon: <Settings />,
      label: 'Settings'
    }
  ];

  // Add mobile-friendly styles to the sidebar
  const sidebarClasses = `
    h-full bg-white flex flex-col border-r border-gray-200
    ${isOpen ? 'w-64' : 'w-20'}
    transition-all duration-300 ease-in-out
    overflow-hidden
    ${isMobile ? 'shadow-lg' : ''}
  `;

  // Add touch-friendly padding to nav items
  const navItemClasses = `
    flex items-center gap-3
    text-gray-700 hover:text-blue-600 hover:bg-blue-50
    transition-colors duration-200
    ${isMobile ? 'py-4' : 'py-3'}
    ${isOpen ? 'px-6' : 'justify-center px-3'}
    ${isActive(location.pathname) ? 'bg-blue-50 text-blue-600' : ''}
  `;

  // Add larger touch targets for mobile
  const iconClasses = `
    ${isMobile ? 'w-6 h-6' : 'w-5 h-5'}
    ${isOpen ? 'mr-3' : 'mr-0'}
    transition-all duration-300
  `;

  return (
    <div 
      ref={sidebarRef}
      className={sidebarClasses}
      style={{ 
        willChange: 'width',
        transform: 'translateZ(0)', // Force GPU acceleration
        backfaceVisibility: 'hidden'
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={isTouch ? () => setOpen(true) : undefined}
    >
      <div className="flex-1 overflow-y-auto">
        <nav className="mt-4 space-y-1">
          {navigationItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={navItemClasses}
            >
              <div className={iconClasses}>
                {item.icon}
              </div>
              {isOpen && (
                <span className="whitespace-nowrap">{item.label}</span>
              )}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
});

export default PrimarySidebar; 