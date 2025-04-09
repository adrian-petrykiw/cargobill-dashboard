// components/providers/NotificationProvider.tsx

import { useState, useCallback, createContext, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';

export interface Notification {
  id: string;
  title: string;
  content: string;
  date: string;
  read: boolean;
}

interface NotificationsContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'date'>) => void;
  clearAllNotifications: () => void;
  markAsRead: (id: string) => void;
  hasUnreadNotifications: boolean;
}

export const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { ready, authenticated } = usePrivy();

  // Core notification functions
  const addNotification = useCallback(
    (notification: Omit<Notification, 'id' | 'read' | 'date'>) => {
      if (!authenticated) return; // Only allow notifications for authenticated users

      const newNotification: Notification = {
        id: Math.random().toString(36).substring(2, 9),
        title: notification.title,
        content: notification.content,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: false,
      };

      setNotifications((prev) => [newNotification, ...prev]);
    },
    [authenticated],
  );

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification,
      ),
    );
  }, []);

  // Reset notifications when auth state changes
  useEffect(() => {
    if (!authenticated) {
      setNotifications([]);
    }
  }, [authenticated]);

  const contextValue = {
    notifications,
    addNotification,
    clearAllNotifications,
    markAsRead,
    hasUnreadNotifications: notifications.some((n) => !n.read),
  };

  return (
    <NotificationsContext.Provider value={contextValue}>{children}</NotificationsContext.Provider>
  );
}
