/** API contracts shared by the NestJS and React workspaces. */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
export type Role = 'patron' | 'librarian' | 'admin';
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}
export interface AuthResponse {
  access_token: string;
  user: AuthUser;
}
export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
  details?: Array<{ field: string; message: string }>;
}
export interface BookStats {
  totalBooks: number;
  totalCopies: number;
  availableCopies: number;
  byGenre: Record<string, number>;
}
export interface LoanStats {
  activeLoans: number;
  overdueLoans: number;
  totalFines: number;
  returnRate: number;
  totalLoans: number;
}
