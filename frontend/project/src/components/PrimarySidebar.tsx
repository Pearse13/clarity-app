import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSidebar } from '../contexts/SidebarContext';

const PrimarySidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isOpen } = useSidebar();
  
  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    {
      name: 'Transform',
      path: '/transform',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      )
    },
    {
      name: 'Lecture',
      path: '/lecture',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      )
    }
  ];

  return (
    <div 
      className={`fixed md:relative h-full bg-white/80 backdrop-blur-card shadow-sm border-r border-gray-200 
                 transition-all duration-300 ease-in-out z-10
                 ${isOpen ? 'w-64' : 'w-0 md:w-16 overflow-hidden'}`}
    >
      <div className="p-4">
        <div className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center rounded-lg transition-colors
                         ${isOpen 
                           ? 'px-4 gap-3 justify-start' 
                           : 'px-0 justify-center'} 
                         py-3 text-sm font-medium
                         ${isActive(item.path)
                           ? 'bg-blue-50 text-blue-700'
                           : 'text-gray-700 hover:bg-gray-50'}`}
            >
              <div className={`flex-shrink-0 ${!isOpen ? 'w-5' : ''}`}>
                {item.icon}
              </div>
              <span 
                className={`transform transition-all duration-300 ease-in-out
                           ${isOpen 
                             ? 'opacity-100 translate-x-0 ml-3' 
                             : 'opacity-0 -translate-x-4 w-0'}`}
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden'
                }}
              >
                {item.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PrimarySidebar; 