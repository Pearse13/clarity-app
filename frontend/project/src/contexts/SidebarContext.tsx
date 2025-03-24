import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';

// Detect if device is touch-based
const isTouchDevice = () => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

interface SidebarContextType {
  isOpen: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Start with sidebar closed on touch devices
  const isTouch = isTouchDevice();
  const [isOpen, setIsOpen] = useState(!isTouch);
  const isTransitioning = useRef(false);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Improved debounce for sidebar open/close with touch optimization
  const setOpenWithDebounce = useCallback((open: boolean) => {
    if (isTransitioning.current) return;
    
    // Clear any pending close timeout
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    
    if (open) {
      // Open immediately 
      isTransitioning.current = true;
      setIsOpen(true);
      
      // Reset transition lock after animation completes
      setTimeout(() => {
        isTransitioning.current = false;
      }, 150);
    } else {
      // For touch devices, close immediately to feel more responsive
      if (isTouch) {
        isTransitioning.current = true;
        setIsOpen(false);
        setTimeout(() => {
          isTransitioning.current = false;
        }, 150);
      } else {
        // For desktop, use a short delay to prevent accidental closing
        isTransitioning.current = true;
        closeTimeoutRef.current = setTimeout(() => {
          setIsOpen(false);
          setTimeout(() => {
            isTransitioning.current = false;
          }, 150);
        }, 100);
      }
    }
  }, [isTouch]);
  
  // Use useCallback to memoize functions
  const toggle = useCallback(() => {
    setOpenWithDebounce(!isOpen);
  }, [setOpenWithDebounce, isOpen]);
  
  const setOpen = useCallback((open: boolean) => setOpenWithDebounce(open), [setOpenWithDebounce]);
  
  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);
  
  // Add event listener for window resize to manage sidebar state
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && isOpen) {
        setIsOpen(false);
      } else if (window.innerWidth >= 1024 && !isOpen) {
        setIsOpen(true);
      }
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