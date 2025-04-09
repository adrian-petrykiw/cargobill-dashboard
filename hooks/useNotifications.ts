// hooks/useNotifications.ts
import { NotificationsContext } from '@/components/providers/NotificationProvider';
import { useContext } from 'react';

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}
