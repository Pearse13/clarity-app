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
      name: 'Clarity Lectures',
      path: '/lecture',
      icon: BookOpen
    }
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Sidebar - fixed on mobile, relative on desktop */}
      <div
        className={`${isMobile ? 'fixed' : 'relative'} inset-y-0 left-0 transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${!isMobile && 'transform-none'} transition-transform duration-300 ease-in-out z-40
        w-64 bg-white border-r border-gray-200 flex flex-col`}
      >
        {/* Navigation items */}
        <nav className="flex-1 px-4 pt-4">
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
                    <Icon className="w-5 h-5" />
                    {item.name}
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
      </div>

      {/* Main content */}
      <main className={`flex-1 overflow-hidden ${isOpen && !isMobile ? 'ml-64' : ''}`}>
        {children}
      </main>

      {/* Mobile overlay */}
      {isOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={toggle}
        />
      )}
    </div>
  );
};

export default DashboardLayout; 