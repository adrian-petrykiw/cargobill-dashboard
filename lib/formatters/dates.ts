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

// Function to format ISO dates according to user's locale
export const formatDateTime = (isoDateStr: string, userLocale = 'en-US'): string => {
  if (isoDateStr === '-') return '-';

  try {
    const date = new Date(isoDateStr);

    // Check if valid date
    if (isNaN(date.getTime())) return isoDateStr;

    // Format date according to user's locale with time
    return new Intl.DateTimeFormat(userLocale, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      timeZoneName: 'short',
    }).format(date);
  } catch (error) {
    // If parsing fails, return the original string
    return isoDateStr;
  }
};
