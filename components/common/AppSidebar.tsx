import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ROUTES } from '@/constants/routes';
import { Menu, Transition } from '@headlessui/react';
import { FaHome } from 'react-icons/fa';
import { BiTransfer } from 'react-icons/bi';
import { BsBank } from 'react-icons/bs';
import { AiOutlineCreditCard } from 'react-icons/ai';
import { MdViewSidebar } from 'react-icons/md';
import { BsCheck } from 'react-icons/bs';
import { useSidebarStore } from '@/stores/preferences/sidebarStore';

export default function AppSidebar() {
  const router = useRouter();
  const { mode, setMode } = useSidebarStore();
  // Add state to track if sidebar is actually being hovered
  const [isHovering, setIsHovering] = useState(false);

  // Prefetch all navigation routes for instant navigation
  useEffect(() => {
    navigationItems.forEach((item) => {
      router.prefetch(item.href);
    });
  }, []);

  const isActive = (path: string) => {
    return router.pathname === path || router.pathname.startsWith(`${path}/`);
  };

  const navigationItems = [
    { name: 'Home', href: ROUTES.DASHBOARD, icon: <FaHome size={18} /> },
    { name: 'Transactions', href: ROUTES.TRANSACTIONS.LIST, icon: <BiTransfer size={18} /> },
    { name: 'Banking', href: ROUTES.BANKING, icon: <BsBank size={18} /> },
    { name: 'Cards', href: ROUTES.CARDS, icon: <AiOutlineCreditCard size={18} /> },
  ];

  const isCollapsed =
    mode === 'collapsed' || (mode === 'hover' && !router.asPath.includes('sidebar-control'));
  const shouldExpandOnHover = mode === 'hover';

  // Determine if text should be visible
  const shouldShowText = () => {
    if (!isCollapsed) return true; // Always show when not collapsed
    if (mode === 'hover' && isHovering) return true; // Show on hover only in hover mode
    return false; // Never show in collapsed mode on hover
  };

  return (
    <aside
      className={`h-full bg-white border-r border-gray-200 transition-all duration-300 ease-in-out flex flex-col ${
        isCollapsed && shouldExpandOnHover && isHovering ? 'w-52' : isCollapsed ? 'w-16' : 'w-52'
      }`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      style={{ overflow: 'hidden' }}
    >
      <div className="py-4 flex-1">
        {navigationItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            prefetch={true}
            className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors mx-2 my-1 ${
              isActive(item.href)
                ? 'text-slate-900'
                : 'text-slate-400 hover:bg-accent hover:text-slate-900'
            }`}
          >
            <span
              className={`pl-[0.15rem] flex-shrink-0 ${isActive(item.href) ? 'text-blue-700' : 'text-gray-400'}`}
            >
              {item.icon}
            </span>
            <span
              className={`whitespace-nowrap transition-opacity duration-300 ${
                shouldShowText() ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {item.name}
            </span>
          </Link>
        ))}
      </div>

      {/* Sidebar control menu */}
      <div className="mt-auto relative">
        <Menu as="div" className="relative">
          <Menu.Button
            className="flex items-center gap-3 rounded-md p-2 text-sm font-medium transition-colors mx-2 my-1 text-gray-400 hover:bg-accent hover:text-gray-400"
            aria-label="Sidebar control"
          >
            <span className={`flex-shrink-0 ${isCollapsed && !isHovering ? 'mx-auto' : ''}`}>
              <MdViewSidebar size={18} />
            </span>
          </Menu.Button>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items
              className="w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-[9999]"
              style={{
                bottom: '2.5rem',
                left: '0.75rem',
                position: 'fixed',
              }}
            >
              <div className="p-1 border-b border-gray-100">
                <div className="px-3 py-1 text-xs font-medium text-gray-500">Sidebar Control</div>
              </div>
              <div className="p-1">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => setMode('expanded')}
                      className={`${
                        active ? 'bg-gray-100' : ''
                      } flex items-center justify-between w-full px-3 py-2 text-xs text-gray-700`}
                    >
                      Expanded
                      {mode === 'expanded' && <BsCheck className="h-4 w-4 text-blue-600" />}
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => setMode('collapsed')}
                      className={`${
                        active ? 'bg-gray-100' : ''
                      } flex items-center justify-between w-full px-3 py-2 text-xs text-gray-700`}
                    >
                      Collapsed
                      {mode === 'collapsed' && <BsCheck className="h-4 w-4 text-blue-600" />}
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => setMode('hover')}
                      className={`${
                        active ? 'bg-gray-100' : ''
                      } flex items-center justify-between w-full px-3 py-2 text-xs text-gray-700`}
                    >
                      Expand on hover
                      {mode === 'hover' && <BsCheck className="h-4 w-4 text-blue-600" />}
                    </button>
                  )}
                </Menu.Item>
              </div>
            </Menu.Items>
          </Transition>
        </Menu>
      </div>
    </aside>
  );
}
