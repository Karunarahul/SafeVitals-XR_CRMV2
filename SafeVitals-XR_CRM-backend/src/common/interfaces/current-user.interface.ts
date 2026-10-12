export interface CurrentUserPayload {
  userId: string;
  email: string;
  role: string;
  employeeDocId?: string;
  employeeId?: string;
  isSuperAdmin?: boolean;
  permissions?: string[];
  roleId?: string;
}

