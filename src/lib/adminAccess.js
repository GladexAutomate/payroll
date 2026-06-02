export const ADMIN_EMPLOYEE_CODE = '12345';
export const ADMIN_EMPLOYEE_PASSWORD = 'admin12345';
export const ADMIN_ACCESS_STORAGE_KEY = 'paysync_admin_employee_access';

export const ADMIN_USER = {
  id: 'local-admin',
  full_name: 'Admin',
  email: 'admin@local',
  role: 'admin',
  internal_role: 'admin',
};

export function isAdminEmployeeLogin(employeeCode, password) {
  return employeeCode.trim() === ADMIN_EMPLOYEE_CODE && password === ADMIN_EMPLOYEE_PASSWORD;
}

export function hasAdminAccess() {
  return localStorage.getItem(ADMIN_ACCESS_STORAGE_KEY) === 'true';
}

export function grantAdminAccess() {
  localStorage.setItem(ADMIN_ACCESS_STORAGE_KEY, 'true');
}

export function clearAdminAccess() {
  localStorage.removeItem(ADMIN_ACCESS_STORAGE_KEY);
}
