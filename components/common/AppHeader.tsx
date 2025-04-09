// components/common/AppHeader.tsx
import { Fragment } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePrivy } from '@privy-io/react-auth';
import { Menu, Transition } from '@headlessui/react';
import { ROUTES } from '@/constants/routes';
import useAuth from '@/features/auth/hooks/useAuth';

// Import icons from react-icons
import { MdSettings, MdOutlineLogout, MdNotifications } from 'react-icons/md';
import { IoMdHelpCircle } from 'react-icons/io';

function classNames(...classes: (string | boolean)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function AppHeader() {
  const { user } = usePrivy();
  const { logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-white">
      <div className="flex flex-1 items-center justify-between px-4">
        <div className="flex items-center">
          <Link href={ROUTES.DASHBOARD} className="flex items-center gap-2">
            <Image
              src="/assets/cargobill_text_logo.svg"
              alt="CargoBill"
              width={32}
              height={32}
              className="h-8 w-auto"
            />
          </Link>
        </div>

        <div className="flex items-center gap-8">
          {/* Currency Selector */}
          <div className="flex items-center border rounded-md px-3 py-1 text-sm font-medium">
            <span>USD</span>
          </div>

          {/* Notifications */}
          <button className="relative rounded-sm p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-600 bg-pink">
            <MdNotifications className="h-5 w-5" />
          </button>

          {/* Profile dropdown */}
          <Menu as="div" className="relative">
            <Menu.Button className="flex items-center gap-2 rounded-sm bg-slate-900 p-1 mr-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <span className="sr-only">Open user menu</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium">
                {user?.email?.address?.[0]?.toUpperCase() || 'A'}
              </div>
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
              <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 focus:outline-none">
                <div className="px-4 py-2 text-sm">
                  <p className="font-medium text-gray-900">Admin</p>
                  <p className="text-gray-500 truncate">
                    {user?.email?.address || user?.google?.email}
                  </p>
                </div>
                <div className="border-t border-gray-100">
                  <Menu.Item>
                    {({ active }) => (
                      <Link
                        href={ROUTES.SETTINGS}
                        className={classNames(
                          active ? 'bg-gray-100' : '',
                          'flex items-center gap-2 px-4 py-2 text-sm text-gray-700',
                        )}
                      >
                        <MdSettings className="h-4 w-4" />
                        Settings
                      </Link>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <Link
                        href="#"
                        className={classNames(
                          active ? 'bg-gray-100' : '',
                          'flex items-center gap-2 px-4 py-2 text-sm text-gray-700',
                        )}
                      >
                        <IoMdHelpCircle className="h-4 w-4" />
                        Support
                      </Link>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={logout}
                        className={classNames(
                          active ? 'bg-gray-100' : '',
                          'flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-red-600',
                        )}
                      >
                        <MdOutlineLogout className="h-4 w-4" />
                        Log out
                      </button>
                    )}
                  </Menu.Item>
                </div>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>
      </div>
    </header>
  );
}
