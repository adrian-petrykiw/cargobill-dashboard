import { Fragment } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePrivy } from '@privy-io/react-auth';
import { Menu, Transition } from '@headlessui/react';
import { ROUTES } from '@/constants/routes';
import { useCurrency } from '@/hooks/useCurrency';
import { currencyOptions } from '@/constants/currencyData';
import NotificationsPopover from '../providers/NotificationsPopover';
import { useNotifications } from '@/hooks/useNotifications';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Import icons from react-icons
import { MdSettings, MdOutlineLogout } from 'react-icons/md';
import { IoMdHelpCircle } from 'react-icons/io';
import useAuth from '@/hooks/useAuth';

function classNames(...classes: (string | boolean)[]) {
  return classes.filter(Boolean).join(' ');
}

// This is an enhanced version of AppHeader that actually uses the notification system
// You can use this for demonstration or replace your actual AppHeader with this
export default function EnhancedAppHeader() {
  const { user } = usePrivy();
  const { logout } = useAuth();
  const { currency, setCurrency } = useCurrency();
  const { notifications, clearAllNotifications, markAsRead } = useNotifications();

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
              className="h-[1.75rem] w-auto"
            />
          </Link>
        </div>

        <div className="flex items-center gap-6 mr-2">
          {/* Currency Selector */}
          <div className="flex items-center">
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-auto bg-white h-auto border-0 focus:ring-0 focus:ring-offset-0 shadow-none gap-1 p-1">
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent align="center">
                {currencyOptions.map((option) => (
                  <SelectItem key={option} value={option} className="hover:cursor-pointer">
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notifications Popover */}
          <NotificationsPopover
            notifications={notifications}
            onClearAll={clearAllNotifications}
            onReadNotification={markAsRead}
          />

          {/* Profile dropdown */}
          <Menu as="div" className="relative">
            <Menu.Button className="flex items-center gap-2 rounded-sm bg-slate-900 p-1 ml-3 text-white focus:outline-none">
              <span className="sr-only">Open user menu</span>
              <div className="flex h-[1.75rem] w-[1.75rem] items-center justify-center rounded-full text-sm font-medium">
                {user?.email?.address?.[0]?.toUpperCase() ||
                  user?.google?.email?.[0]?.toUpperCase() ||
                  'NA'}
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
              <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none">
                <div className="px-4 py-2 text-sm">
                  <p className="font-medium text-gray-900">Admin</p>
                  <p className="text-gray-500 truncate text-xs">
                    {user?.email?.address || user?.google?.email}
                  </p>
                </div>
                <div className="border-t border-gray-100 gap-2 p-2">
                  <Menu.Item>
                    {({ active }) => (
                      <Link
                        href={ROUTES.SETTINGS}
                        className={classNames(
                          active ? 'bg-gray-100' : '',
                          'flex items-center gap-2 px-4 py-2 text-sm text-gray-700 rounded-sm',
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
                          'flex items-center gap-2 px-4 py-2 text-sm text-gray-700 rounded-sm',
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
                          'flex items-center gap-2 w-full text-left px-4 py-2 mb-0 text-sm text-red-600 rounded-sm',
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
