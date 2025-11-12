'use client';

import { useRouter, usePathname } from 'next/navigation';
import { authUtils } from '@/lib/auth';

interface SidebarProps {
  currentUser?: {
    fullName: string;
    organization: {
      name: string;
    };
    role: string;
  } | null;
}

export default function Sidebar({ currentUser }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    authUtils.logout();
  };

  // Main menu items (simplified - no submenu)
  const menuItems = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: '📊',
    },
    {
      name: 'Үзлэг томилох',
      path: '/assign-inspection',
      icon: '✓',
    },
    {
      name: 'Хэрэглэгч удирдах',
      path: '/users',
      icon: '👥',
    },
    {
      name: 'Үзлэгийн хариулт',
      path: '/inspection-answers',
      icon: '📝',
    },
    {
      name: 'DOCX Preview',
      path: '/docx-preview',
      icon: '📄',
    },
    {
      name: 'Тайлан',
      path: '/organizations', // Default to first report page
      icon: '📊',
    },
  ];

  const isActive = (path: string) => {
    // For "Тайлан", check if any report page is active
    if (path === '/organizations') {
      const reportPaths = ['/organizations', '/sites', '/contracts', '/device-models', '/devices', '/inspections'];
      return reportPaths.some(reportPath => pathname === reportPath);
    }
    return pathname === path;
  };

  return (
    <div className="w-64 bg-white h-screen fixed left-0 top-0 border-r border-gray-200 flex flex-col">
      {/* Logo/Header */}
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-indigo-600">Inspection System</h1>
        <p className="text-xs text-gray-500 mt-1">Admin Panel</p>
      </div>

      {/* User Info */}
      {currentUser && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <p className="text-sm font-semibold text-gray-900">{currentUser.fullName}</p>
          <p className="text-xs text-gray-500">{currentUser.organization.name}</p>
          <span className="inline-block mt-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
            {currentUser.role}
          </span>
        </div>
      )}

      {/* Menu Items */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <div className="space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.path)
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.name}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <span className="text-lg">🚪</span>
          <span>Гарах</span>
        </button>
      </div>
    </div>
  );
}
