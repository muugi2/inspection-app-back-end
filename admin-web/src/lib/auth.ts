import { apiService } from './api';

// User interface
export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  isActive: boolean;
  organization: {
    id: string;
    name: string;
    code: string;
  };
  role: string;
}

// Authentication utilities
export const authUtils = {
  // Get token from localStorage
  getToken: (): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('authToken');
    }
    return null;
  },

  // Get user data from localStorage
  getUser: (): User | null => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    }
    return null;
  },

  // Set authentication data
  setAuth: (token: string, user: User): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('authToken', token);
      localStorage.setItem('user', JSON.stringify(user));
    }
  },

  // Clear authentication data
  clearAuth: (): void => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
    }
  },

  // Check if user is authenticated
  isAuthenticated: (): boolean => {
    const token = authUtils.getToken();
    return token !== null && token.length > 0;
  },

  // Get authorization header
  getAuthHeader: (): { Authorization: string } | {} => {
    const token = authUtils.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  // Login with backend API
  login: async (email: string, password: string): Promise<{ success: boolean; error?: string; user?: User }> => {
    try {
      const response = await apiService.auth.login(email, password);
      
      if (response.data?.token && response.data?.user) {
        const { token, user } = response.data;
        authUtils.setAuth(token, user);
        return { success: true, user };
      }
      
      return { success: false, error: 'Invalid response from server' };
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Login failed';
      return { success: false, error: errorMessage };
    }
  },

  // Verify token with backend
  verifyToken: async (): Promise<{ valid: boolean; user?: User }> => {
    try {
      const response = await apiService.auth.verify();
      
      if (response.data?.user) {
        const user = response.data.user;
        // Update stored user data
        authUtils.setAuth(authUtils.getToken()!, user);
        return { valid: true, user };
      }
      
      return { valid: false };
    } catch (error) {
      // Token is invalid, clear auth data
      authUtils.clearAuth();
      return { valid: false };
    }
  },

  // Logout
  logout: (): void => {
    authUtils.clearAuth();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  },

  // Check if user has admin role
  isAdmin: (): boolean => {
    const user = authUtils.getUser();
    return user?.role?.toLowerCase() === 'admin';
  },

  // Check if user has inspector role
  isInspector: (): boolean => {
    const user = authUtils.getUser();
    return user?.role?.toLowerCase() === 'inspector';
  },

  // Get user's organization
  getUserOrganization: (): string | null => {
    const user = authUtils.getUser();
    return user?.organization?.name || null;
  },
};
