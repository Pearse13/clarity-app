import React from 'react';
import PrimarySidebar from './PrimarySidebar';
import { useSidebar } from '../contexts/SidebarContext';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { isOpen, toggle } = useSidebar();

  const handleMainClick = () => {
    // Only close if sidebar is open and we're on mobile
    if (isOpen && window.innerWidth < 768) {
      toggle();
    }
  };

  return (
    <div className="flex min-h-screen h-screen max-h-screen">
      <PrimarySidebar />
      <div 
        className="flex-1 overflow-hidden w-full"
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
                className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isOpen ? '' : 'rotate-180'}`}
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