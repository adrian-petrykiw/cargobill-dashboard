export const ROUTES = {
  AUTH: {
    SIGNIN: '/auth',
    SIGNUP: '/auth',
    BASE: '/auth',
  },
  DASHBOARD: '/dashboard',
  TRANSACTIONS: {
    LIST: '/transactions',
    DETAILS: (id: string) => `/transactions/${id}`,
    NEW: '/transactions/new',
  },
  BANKING: '/banking',
  CARDS: '/cards',
  ORGANIZATIONS: {
    LIST: '/organizations',
    DETAILS: (id: string) => `/organizations/${id}`,
    NEW: '/organizations/new',
  },
  SETTINGS: '/settings',
};
