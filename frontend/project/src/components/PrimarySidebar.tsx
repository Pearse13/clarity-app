import React, { memo, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSidebar } from '../contexts/SidebarContext';

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
  
  const isActive = (path: string) => location.pathname === path;

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

  const navItems = [
    {
      name: "Clarity Lectures",
      path: '/lecture',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      )
    },
    {
      name: "Clarity Text Transformer",
      path: '/transform',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      )
    }
  ];

  return (
    <div 
      ref={sidebarRef}
      className={`fixed md:relative h-screen bg-white border-r border-gray-200
                 transition-all will-change-transform backface-visibility-hidden transform-gpu
                 duration-150 ease-out z-10 overflow-hidden ${isOpen ? 'w-72' : 'w-16'}`}
      style={{ 
        willChange: 'width',
        transform: 'translateZ(0)', // Force GPU acceleration
        backfaceVisibility: 'hidden'
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={isTouch ? () => setOpen(true) : undefined}
    >
      <div className="p-4 h-full overflow-y-auto">
        <div className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center rounded-lg 
                         ${isOpen 
                           ? 'px-4 gap-3 justify-start' 
                           : 'px-0 justify-center'} 
                         py-3 text-sm font-medium transition-all
                         ${isActive(item.path)
                           ? 'bg-blue-50 text-blue-600'
                           : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <div className={`flex-shrink-0 transform-gpu transition-transform duration-150 ${!isOpen ? 'scale-110' : ''}`}>
                {item.icon}
              </div>
              <span 
                className={`whitespace-nowrap transform-gpu transition-opacity duration-150
                           ${isOpen 
                             ? 'opacity-100 max-w-full' 
                             : 'opacity-0 max-w-0 overflow-hidden'}`}
              >
                {item.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

export default PrimarySidebar; 