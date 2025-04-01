import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

export const formatDate = (date: Date | string | number, formatString = 'MMM dd, yyyy'): string => {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

  return format(dateObj, formatString);
};

export const getRelativeTime = (date: Date | string | number): string => {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

  if (isToday(dateObj)) {
    return 'Today at ' + format(dateObj, 'h:mm a');
  }

  if (isYesterday(dateObj)) {
    return 'Yesterday at ' + format(dateObj, 'h:mm a');
  }

  return formatDistanceToNow(dateObj, { addSuffix: true });
};
