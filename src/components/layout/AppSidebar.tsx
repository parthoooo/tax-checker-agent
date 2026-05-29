import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Users, Flag, ListChecks, Settings, User, LogOut,
  FolderOpen, Menu, X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const adminNav: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/flags', label: 'AI Flags', icon: Flag },
  { to: '/activity', label: 'Activity Log', icon: ListChecks },
  { to: '/admin', label: 'Admin', icon: Settings, adminOnly: true },
  { to: '/profile', label: 'Profile', icon: User },
];

const clientNav: NavItem[] = [
  { to: '/portal', label: 'My Documents', icon: FolderOpen },
  { to: '/profile', label: 'Profile', icon: User },
];

const AppSidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;

  const items = user.role === 'admin'
    ? adminNav.filter(i => !i.adminOnly || user.role === 'admin')
    : clientNav;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const SidebarBody = (
    <div className="flex flex-col h-full bg-[#0f1f3d] text-white w-64">
      <div className="px-6 py-6 border-b border-white/10">
        <h2 className="text-lg font-bold tracking-tight">Broder-Mansoor</h2>
        <p className="text-xs text-blue-200/70 mt-0.5">& Associates</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors border-l-4',
                  isActive
                    ? 'bg-white/10 border-blue-400 text-white'
                    : 'border-transparent text-blue-100/80 hover:bg-white/5 hover:text-white'
                )
              }
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium border-l-4 border-transparent text-blue-100/80 hover:bg-white/5 hover:text-white mt-2"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </nav>

      <div className="px-6 py-4 border-t border-white/10 text-[11px] text-blue-200/60 text-center">
        Powered by SJ Innovation AI
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 p-2 rounded-md bg-[#0f1f3d] text-white shadow-lg"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Desktop */}
      <aside className="hidden md:block sticky top-0 h-screen shrink-0">
        {SidebarBody}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full">
            {SidebarBody}
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 p-1 text-white/70 hover:text-white"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AppSidebar;
