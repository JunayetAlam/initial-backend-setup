export const userRole = ['USER', 'ADMIN', 'SUPERADMIN'] as const;
export const userStatus = ['ACTIVE', 'INACTIVE', 'BLOCKED'] as const;

// Roles a SUPERADMIN may assign through the API. SUPERADMIN itself is only seeded.
export const assignableUserRoles = ['USER', 'ADMIN'] as const;

// Staff roles with dashboard / back-office access
export const isAdminRole = (role?: string | null): boolean =>
  role === 'SUPERADMIN' || role === 'ADMIN';
