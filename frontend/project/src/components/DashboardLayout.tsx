import React, { useEffect, useRef } from 'react';
import PrimarySidebar from './PrimarySidebar';
import { useSidebar } from '../contexts/SidebarContext';

// Detect if device is touch-based
const isTouchDevice = () => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { isOpen, toggle, setOpen } = useSidebar();
  const mainContentRef = useRef<HTMLDivElement>(null);
  const isTouch = isTouchDevice();

  // Close sidebar when clicking/tapping outside of it or when window focus changes
  useEffect(() => {
    if (!isTouch) {
      // Desktop-specific handlers
      const handleWindowFocus = () => {
        // Check if the mouse is not over the sidebar when focus returns
        const event = window.event as MouseEvent | undefined;
        const x = event?.clientX || 0;
        if (x > 250) { // Well outside the sidebar width
          setOpen(false);
        }
      };
      
      // When mouse moves outside the app window, close sidebar
      const handleMouseMove = (e: MouseEvent) => {
        // If mouse is moving outside the window area, close sidebar
        if (e.clientX <= 2 || e.clientX >= window.innerWidth - 2) {
          setOpen(false);
        }
      };
      
      window.addEventListener('focus', handleWindowFocus);
      document.addEventListener('mousemove', handleMouseMove);
      
      return () => {
        window.removeEventListener('focus', handleWindowFocus);
        document.removeEventListener('mousemove', handleMouseMove);
      };
    } else {
      // Touch device specific handlers 
      const handleTouchStart = (e: TouchEvent) => {
        // If the touch is not in the sidebar, close it
        if (mainContentRef.current && mainContentRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };

      // Handle orientation changes on mobile devices
      const handleOrientationChange = () => {
        // Close sidebar when device orientation changes
        setOpen(false);
      };
      
      document.addEventListener('touchstart', handleTouchStart);
      window.addEventListener('orientationchange', handleOrientationChange);
      
      return () => {
        document.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('orientationchange', handleOrientationChange);
      };
    }
  }, [setOpen, isTouch]);

  const handleMainClick = () => {
    // Close on any main content click/tap for touch devices
    if (isTouch) {
      setOpen(false);
    }
    // Only close if sidebar is open and we're on mobile for desktop
    else if (isOpen && window.innerWidth < 768) {
      toggle();
    }
  };

  return (
    <div className="flex min-h-screen h-screen max-h-screen overflow-x-hidden">
      <PrimarySidebar />
      <div 
        ref={mainContentRef}
        className="flex-1 overflow-hidden w-full border-l border-gray-200 transform-gpu will-change-transform"
        onClick={handleMainClick}
      >
        <div className="h-full flex flex-col">
          <div className="flex items-center gap-4 pl-6 pr-4 py-3 border-b">
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent main's onClick from firing
                toggle();
              }}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Toggle sidebar"
            >
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform duration-300 transform-gpu ${isOpen ? '' : 'rotate-180'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout; 