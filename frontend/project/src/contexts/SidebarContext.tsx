import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';

// Detect if device is touch-based with improved iPad support
const isTouchDevice = () => {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    /iPad|iPhone|iPod/.test(navigator.userAgent)
  );
};

interface SidebarContextType {
  isOpen: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Start with sidebar closed on all devices
  const isTouch = isTouchDevice();
  const [isOpen, setIsOpen] = useState(false);
  const isTransitioning = useRef(false);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use useCallback to memoize functions
  const toggle = useCallback(() => {
    // Force immediate state change for toggle
    isTransitioning.current = true;
    setIsOpen(prev => !prev);
    setTimeout(() => {
      isTransitioning.current = false;
    }, 50);
  }, []); // Remove dependencies since we're using prev state
  
  const setOpen = useCallback((open: boolean) => {
    if (isTransitioning.current) return;
    
    // Clear any pending timeouts
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    
    // For touch devices or explicit toggle, change state immediately
    if (isTouch || typeof open === 'boolean') {
      isTransitioning.current = true;
      setIsOpen(open);
      setTimeout(() => {
        isTransitioning.current = false;
      }, 50);
    } else {
      // For desktop hover, use a short debounce
      isTransitioning.current = true;
      closeTimeoutRef.current = setTimeout(() => {
        setIsOpen(open);
        setTimeout(() => {
          isTransitioning.current = false;
        }, 50);
      }, 25);
    }
  }, [isTouch]);
  
  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []);
  
  // Add event listener for window resize to manage sidebar state
  useEffect(() => {
    const handleResize = () => {
      // Clear any pending resize timeout
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      
      // Debounce resize handling
      resizeTimeoutRef.current = setTimeout(() => {
        // Only close on mobile, don't auto-open
        if (window.innerWidth < 768 && isOpen) {
          setIsOpen(false);
        }
      }, 50); // Reduced from 100ms to 50ms for faster response
    };
    
    // Add event listener for visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setIsOpen(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isOpen]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    isOpen,
    toggle,
    setOpen
  }), [isOpen, toggle, setOpen]);

  return (
    <SidebarContext.Provider value={contextValue}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}; 