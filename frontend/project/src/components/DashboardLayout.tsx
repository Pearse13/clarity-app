import React, { useEffect, useState } from 'react';
import { useSidebar } from '../contexts/SidebarContext';
import { X, FileText, BookOpen } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isOpen, toggle } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const navigationItems = [
    {
      name: 'Text Transformer',
      path: '/transform',
      icon: FileText
    },
    {
      name: 'Lectures',
      path: '/lecture',
      icon: BookOpen
    }
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside 
        className={`
          sidebar
          fixed md:static inset-y-0 left-0
          flex flex-col
          bg-white border-r border-gray-200
          transition-all duration-300 ease-in-out
          ${isOpen ? 'w-64 open' : 'w-20'}
          ${isMobile ? 'z-50' : 'z-0'}
        `}
      >
        {/* Toggle button - hidden on mobile as we have a separate mobile toggle */}
        <div className="px-4 py-3 border-b border-gray-200 md:block hidden">
          <button
            onClick={toggle}
            className="flex items-center gap-3 w-full text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors duration-200 rounded-lg p-2"
          >
            <svg
              className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
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
            <span 
              className={`
                whitespace-nowrap overflow-hidden transition-all duration-300
                ${isOpen ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'}
              `}
            >
              Collapse Sidebar
            </span>
          </button>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 overflow-hidden pt-4">
          <ul className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.path}>
                  <button
                    onClick={() => {
                      navigate(item.path);
                      if (isMobile) {
                        toggle();
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                      isActive(item.path)
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span 
                      className={`
                        whitespace-nowrap overflow-hidden transition-all duration-300
                        ${isOpen ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'}
                      `}
                    >
                      {item.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Close button - only on mobile */}
        {isMobile && (
          <button
            onClick={toggle}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 text-gray-500"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </aside>

      {/* Main content wrapper */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Main content */}
        <main className="flex-1 relative">
          {children}
        </main>
      </div>

      {/* Mobile overlay - using a proper class for the overlay */}
      {isOpen && isMobile && (
        <div 
          className="sidebar-overlay"
          onClick={toggle}
        />
      )}
    </div>
  );
};

export default DashboardLayout; 