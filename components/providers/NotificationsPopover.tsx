// components/providers/NotificationsPopover.tsx
import { Fragment } from 'react';
import { Popover, Transition } from '@headlessui/react';
import { MdNotifications } from 'react-icons/md';

interface Notification {
  id: string;
  title: string;
  content: string;
  date: string;
  read: boolean;
}

interface NotificationsPopoverProps {
  notifications?: Notification[];
  onClearAll?: () => void;
  onReadNotification?: (id: string) => void;
}

export default function NotificationsPopover({
  notifications = [],
  onClearAll = () => {},
  onReadNotification = () => {},
}: NotificationsPopoverProps) {
  return (
    <Popover className="relative">
      {({ open }) => (
        <>
          <Popover.Button
            className={`
              relative rounded-sm p-1 text-slate-900 hover:text-slate-900
              ${open ? 'bg-slate-100' : ''}
            `}
          >
            <MdNotifications className="h-5 w-5" />
            {notifications.length > 0 && (
              <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-600"></span>
            )}
          </Popover.Button>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-1"
          >
            <Popover.Panel className="absolute right-0 z-10 mt-2 w-80 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none">
              <div className="border-b border-gray-100">
                <div className="flex items-center justify-between p-4">
                  <h3 className="text-sm font-medium text-gray-900">Notifications</h3>
                  <button
                    onClick={onClearAll}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Clear all
                  </button>
                </div>
              </div>

              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                    <MdNotifications className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="mt-2 text-sm text-gray-500">No notifications</p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`
                        border-b border-gray-100 p-4 hover:bg-gray-50 cursor-pointer
                        ${!notification.read ? 'bg-blue-50' : ''}
                      `}
                      onClick={() => onReadNotification(notification.id)}
                    >
                      <div className="flex justify-between">
                        <h4 className="text-sm font-medium text-gray-900">{notification.title}</h4>
                        <span className="text-xs text-gray-500">{notification.date}</span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{notification.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </Popover.Panel>
          </Transition>
        </>
      )}
    </Popover>
  );
}
