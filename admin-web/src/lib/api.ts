import axios from 'axios';

// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.NODE_ENV === 'production' 
    ? 'https://your-production-api.com' 
    : 'http://localhost:4555',
  TIMEOUT: 10000,
};

// Create axios instance with default config
export const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      if (typeof window !== 'undefined') {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// API endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    VERIFY: '/api/auth/verify',
  },
  ORGANIZATIONS: {
    LIST: '/api/organizations',
    CREATE: '/api/organizations',
    UPDATE: '/api/organizations/:id',
    DELETE: '/api/organizations/:id',
    DETAIL: '/api/organizations/:id',
  },
  SITES: {
    LIST: '/api/sites',
    CREATE: '/api/sites',
    UPDATE: '/api/sites/:id',
    DELETE: '/api/sites/:id',
    BY_ORG: '/api/sites/organization/:orgId',
  },
  CONTRACTS: {
    LIST: '/api/contracts',
    CREATE: '/api/contracts',
    UPDATE: '/api/contracts/:id',
    DELETE: '/api/contracts/:id',
    BY_ORG: '/api/contracts/organization/:orgId',
  },
  DEVICE_MODELS: {
    LIST: '/api/device-models',
    CREATE: '/api/device-models',
    UPDATE: '/api/device-models/:id',
    DELETE: '/api/device-models/:id',
  },
  DEVICES: {
    LIST: '/api/devices',
    CREATE: '/api/devices',
    UPDATE: '/api/devices/:id',
    DELETE: '/api/devices/:id',
    BY_ORG: '/api/devices/organization/:orgId',
    DETAIL: '/api/devices/:id',
  },
  INSPECTIONS: {
    LIST: '/api/inspections',
    CREATE: '/api/inspections',
    UPDATE: '/api/inspections/:id',
    DELETE: '/api/inspections/:id',
    ASSIGNED: '/api/inspections/assigned',
    BY_TYPE: '/api/inspections/assigned/type',
    BY_DEVICE: '/api/inspections/device/:deviceId',
    TEMPLATE: '/api/inspections/:id/template',
    SECTION_ANSWERS: '/api/inspections/section-answers',
    ASSIGN: '/api/inspections/:id/assign',
  },
  USERS: {
    LIST: '/api/users',
    CREATE: '/api/users',
    UPDATE: '/api/users/:id',
    DELETE: '/api/users/:id',
    BY_ORG: '/api/users/organization/:orgId',
  },
  TEMPLATES: {
    LIST: '/api/templates',
    BY_TYPE: '/api/templates/type/:type',
    DETAIL: '/api/templates/:id',
  },
};

// API service functions
export const apiService = {
  // Auth services
  auth: {
    login: async (email: string, password: string) => {
      const response = await apiClient.post(API_ENDPOINTS.AUTH.LOGIN, {
        email,
        password,
      });
      return response.data;
    },
    
    verify: async () => {
      const response = await apiClient.get(API_ENDPOINTS.AUTH.VERIFY);
      return response.data;
    },
  },
  
  // Organization services
  organizations: {
    getAll: async () => {
      const response = await apiClient.get(API_ENDPOINTS.ORGANIZATIONS.LIST);
      return response.data;
    },
    
    create: async (data: { name: string; code: string }) => {
      const response = await apiClient.post(API_ENDPOINTS.ORGANIZATIONS.CREATE, data);
      return response.data;
    },
    
    update: async (id: string, data: { name?: string; code?: string }) => {
      const url = API_ENDPOINTS.ORGANIZATIONS.UPDATE.replace(':id', id);
      const response = await apiClient.put(url, data);
      return response.data;
    },
    
    delete: async (id: string) => {
      const url = API_ENDPOINTS.ORGANIZATIONS.DELETE.replace(':id', id);
      const response = await apiClient.delete(url);
      return response.data;
    },
  },
  
  // Site services
  sites: {
    getAll: async () => {
      const response = await apiClient.get(API_ENDPOINTS.SITES.LIST);
      return response.data;
    },
    
    getByOrganization: async (orgId: string) => {
      const url = API_ENDPOINTS.SITES.BY_ORG.replace(':orgId', orgId);
      const response = await apiClient.get(url);
      return response.data;
    },
    
    create: async (data: { name: string; orgId: string }) => {
      const response = await apiClient.post(API_ENDPOINTS.SITES.CREATE, data);
      return response.data;
    },
    
    update: async (id: string, data: { name?: string; orgId?: string }) => {
      const url = API_ENDPOINTS.SITES.UPDATE.replace(':id', id);
      const response = await apiClient.put(url, data);
      return response.data;
    },
    
    delete: async (id: string) => {
      const url = API_ENDPOINTS.SITES.DELETE.replace(':id', id);
      const response = await apiClient.delete(url);
      return response.data;
    },
  },
  
  // Contract services
  contracts: {
    getAll: async () => {
      const response = await apiClient.get(API_ENDPOINTS.CONTRACTS.LIST);
      return response.data;
    },
    
    getByOrganization: async (orgId: string) => {
      const url = API_ENDPOINTS.CONTRACTS.BY_ORG.replace(':orgId', orgId);
      const response = await apiClient.get(url);
      return response.data;
    },
    
    create: async (data: {
      contractName: string;
      contractNumber: string;
      startDate: string;
      endDate: string;
      orgId: string;
      metadata?: any;
    }) => {
      const response = await apiClient.post(API_ENDPOINTS.CONTRACTS.CREATE, data);
      return response.data;
    },
    
    update: async (id: string, data: {
      contractName?: string;
      contractNumber?: string;
      startDate?: string;
      endDate?: string;
      orgId?: string;
      metadata?: any;
    }) => {
      const url = API_ENDPOINTS.CONTRACTS.UPDATE.replace(':id', id);
      const response = await apiClient.put(url, data);
      return response.data;
    },
    
    delete: async (id: string) => {
      const url = API_ENDPOINTS.CONTRACTS.DELETE.replace(':id', id);
      const response = await apiClient.delete(url);
      return response.data;
    },
  },
  
  // Device Model services
  deviceModels: {
    getAll: async () => {
      const response = await apiClient.get(API_ENDPOINTS.DEVICE_MODELS.LIST);
      return response.data;
    },
    
    create: async (data: {
      manufacturer: string;
      model: string;
      specs?: any;
    }) => {
      const response = await apiClient.post(API_ENDPOINTS.DEVICE_MODELS.CREATE, data);
      return response.data;
    },
    
    update: async (id: string, data: {
      manufacturer?: string;
      model?: string;
      specs?: any;
    }) => {
      const url = API_ENDPOINTS.DEVICE_MODELS.UPDATE.replace(':id', id);
      const response = await apiClient.put(url, data);
      return response.data;
    },
    
    delete: async (id: string) => {
      const url = API_ENDPOINTS.DEVICE_MODELS.DELETE.replace(':id', id);
      const response = await apiClient.delete(url);
      return response.data;
    },
  },
  
  // Device services
  devices: {
    getByOrganization: async (orgId: string) => {
      const url = API_ENDPOINTS.DEVICES.BY_ORG.replace(':orgId', orgId);
      const response = await apiClient.get(url);
      return response.data;
    },
    
    create: async (data: {
      orgId: string;
      siteId: string;
      contractId: string;
      modelId: string;
      serialNumber: string;
      assetTag: string;
      status?: string;
      installedAt?: string;
      metadata?: any;
    }) => {
      const response = await apiClient.post(API_ENDPOINTS.DEVICES.CREATE, data);
      return response.data;
    },
    
    update: async (id: string, data: {
      orgId?: string;
      siteId?: string;
      contractId?: string;
      modelId?: string;
      serialNumber?: string;
      assetTag?: string;
      status?: string;
      installedAt?: string;
      metadata?: any;
    }) => {
      const url = API_ENDPOINTS.DEVICES.UPDATE.replace(':id', id);
      const response = await apiClient.put(url, data);
      return response.data;
    },
    
    delete: async (id: string) => {
      const url = API_ENDPOINTS.DEVICES.DELETE.replace(':id', id);
      const response = await apiClient.delete(url);
      return response.data;
    },
  },
  
  // Inspection services
  inspections: {
    getAll: async () => {
      const response = await apiClient.get(API_ENDPOINTS.INSPECTIONS.LIST);
      return response.data;
    },
    
    create: async (data: {
      orgId?: string;
      deviceId: string;
      siteId?: string;
      contractId?: string;
      templateId?: string;
      type: string;
      title: string;
      scheduledAt?: string;
      notes?: string;
    }) => {
      const response = await apiClient.post(API_ENDPOINTS.INSPECTIONS.CREATE, data);
      return response.data;
    },
    
    update: async (id: string, data: {
      title?: string;
      scheduledAt?: string;
      notes?: string;
      status?: string;
    }) => {
      const url = API_ENDPOINTS.INSPECTIONS.UPDATE.replace(':id', id);
      const response = await apiClient.put(url, data);
      return response.data;
    },
    
    delete: async (id: string) => {
      const url = API_ENDPOINTS.INSPECTIONS.DELETE.replace(':id', id);
      const response = await apiClient.delete(url);
      return response.data;
    },
    
    getAssigned: async () => {
      const response = await apiClient.get(API_ENDPOINTS.INSPECTIONS.ASSIGNED);
      return response.data;
    },
    
    getAssignedByType: async (type: string) => {
      const response = await apiClient.get(`${API_ENDPOINTS.INSPECTIONS.BY_TYPE}/${type}`);
      return response.data;
    },
    
    getByDevice: async (deviceId: string) => {
      const url = API_ENDPOINTS.INSPECTIONS.BY_DEVICE.replace(':deviceId', deviceId);
      const response = await apiClient.get(url);
      return response.data;
    },
    
    assign: async (inspectionId: string, userId: string) => {
      const url = API_ENDPOINTS.INSPECTIONS.ASSIGN.replace(':id', inspectionId);
      const response = await apiClient.put(url, {
        userId,
      });
      return response.data;
    },
  },
  
  // User services
  users: {
    getAll: async () => {
      const response = await apiClient.get(API_ENDPOINTS.USERS.LIST);
      return response.data;
    },
    
    getByOrganization: async (orgId: string) => {
      const url = API_ENDPOINTS.USERS.BY_ORG.replace(':orgId', orgId);
      const response = await apiClient.get(url);
      return response.data;
    },
    
    create: async (userData: {
      email: string;
      password: string;
      fullName: string;
      phone?: string;
      roleIds: string[];
      orgId?: string;
    }) => {
      const response = await apiClient.post(API_ENDPOINTS.USERS.CREATE, userData);
      return response.data;
    },
    
    update: async (id: string, userData: {
      fullName?: string;
      phone?: string;
      isActive?: boolean;
      password?: string;
      roleIds?: string[];
    }) => {
      const url = API_ENDPOINTS.USERS.UPDATE.replace(':id', id);
      const response = await apiClient.put(url, userData);
      return response.data;
    },
    
    delete: async (id: string) => {
      const url = API_ENDPOINTS.USERS.DELETE.replace(':id', id);
      const response = await apiClient.delete(url);
      return response.data;
    },
  },
  
  // Template services
  templates: {
    getAll: async () => {
      const response = await apiClient.get(API_ENDPOINTS.TEMPLATES.LIST);
      return response.data;
    },
    
    getByType: async (type: string) => {
      const response = await apiClient.get(`${API_ENDPOINTS.TEMPLATES.BY_TYPE}/${type}`);
      return response.data;
    },
  },
  
  // Inspection Answers services
  inspectionAnswers: {
    getAll: async (params?: { page?: number; limit?: number; inspectionId?: string; answeredBy?: string }) => {
      const response = await apiClient.get('/api/inspection-answers', { params });
      return response.data;
    },
    
    getById: async (id: string) => {
      const response = await apiClient.get(`/api/inspection-answers/${id}`);
      return response.data;
    },
  },
  
  // Document services
  documents: {
    generateDocument: async (answerId: string, format: 'pdf' | 'docx' = 'pdf') => {
      const response = await apiClient.get(`/api/documents/generate/${answerId}`, {
        params: { format },
        responseType: 'blob'
      });
      return response.data;
    },
    
    uploadTemplate: async (file: File) => {
      const formData = new FormData();
      formData.append('template', file);
      
      const response = await apiClient.post('/api/documents/upload-template', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    },
    
    getAvailableTemplates: async () => {
      const response = await apiClient.get('/api/documents/available-templates');
      return response.data;
    },
    
    getTemplate: async (filename: string) => {
      const response = await apiClient.get(`/api/documents/template/${filename}`, {
        responseType: 'arraybuffer'
      });
      return response.data;
    },
  },
};
