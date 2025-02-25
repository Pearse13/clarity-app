import React from 'react';
import PrimarySidebar from './PrimarySidebar';
import { useSidebar } from '../contexts/SidebarContext';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { isOpen, toggle } = useSidebar();

  const handleMainClick = (e: React.MouseEvent) => {
    // Only close if sidebar is open and we're on mobile
    if (isOpen && window.innerWidth < 768) {
      toggle();
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <PrimarySidebar />
      <main 
        className="flex-1 overflow-auto bg-gray-50"
        onClick={handleMainClick}
      >
        <div className="container mx-auto px-6 pt-8">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent main's onClick from firing
                toggle();
              }}
              className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
              aria-label="Toggle sidebar"
            >
              <svg
                className={`w-6 h-6 text-gray-600 transition-transform duration-300 ${isOpen ? '' : 'rotate-180'}`}
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
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout; 