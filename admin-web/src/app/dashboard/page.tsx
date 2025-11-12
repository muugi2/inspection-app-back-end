'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authUtils, User } from '@/lib/auth';
import { apiService } from '@/lib/api';
import Sidebar from '@/components/Sidebar';

interface Inspection {
  id: string;
  title: string;
  type: string;
  status: string;
  progress: number;
  scheduledAt: string;
  completedAt: string;
  device: {
    serialNumber: string;
    assetTag: string;
  };
  assignee: {
    fullName: string;
  };
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const initializeDashboard = async () => {
      // Check if user is authenticated
      if (!authUtils.isAuthenticated()) {
        router.push('/login');
        return;
      }

      // Get user data
      const currentUser = authUtils.getUser();
      if (currentUser) {
        setUser(currentUser);
      }

      // Verify token with backend
      try {
        const verification = await authUtils.verifyToken();
        if (!verification.valid) {
          router.push('/login');
          return;
        }
        
        if (verification.user) {
          setUser(verification.user);
        }
      } catch (error) {
        console.error('Token verification failed:', error);
        router.push('/login');
        return;
      }

      // Load inspections
      await loadInspections();
    };

    initializeDashboard();
  }, [router]);

  const loadInspections = async () => {
    try {
      setIsLoading(true);
      const assignedInspections = await apiService.inspections.getAssigned();
      setInspections(Array.isArray(assignedInspections) ? assignedInspections : []);
    } catch (err: any) {
      console.error('Failed to load inspections:', err);
      const message = err?.response?.data?.message || err.message || 'Үзлэгүүдийг ачаалахад алдаа гарлаа';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    authUtils.logout();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'inspection': return 'bg-blue-100 text-blue-800';
      case 'maintenance': return 'bg-orange-100 text-orange-800';
      case 'installation': return 'bg-purple-100 text-purple-800';
      case 'verification': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Ачаалж байна...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <Sidebar currentUser={user} />

      {/* Main Content */}
      <div className="flex-1 ml-64">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="px-6 py-4">
            <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-sm text-gray-500">Inspection Management System</p>
          </div>
        </header>

        {/* Content */}
        <main className="p-6">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-red-800">{error}</div>
            <button 
              onClick={loadInspections}
              className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
            >
              Дахин ачаалах
            </button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-bold">I</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Нийт үзлэг
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {inspections.length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-bold">✓</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Дууссан
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {inspections.filter(i => i.status === 'approved').length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-bold">⏳</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Хийгдэж байгаа
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {inspections.filter(i => i.status === 'in_progress').length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-gray-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-bold">📝</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Ноорог
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {inspections.filter(i => i.status === 'draft').length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Inspections Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Үзлэг, шалгалтууд
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Бүх үзлэг, шалгалтын жагсаалт
                </p>
              </div>
              <button
                onClick={loadInspections}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                🔄 Шинэчлэх
              </button>
            </div>
          </div>
          
          {inspections.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Үзлэг, шалгалт олдсонгүй</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {inspections.map((inspection) => (
                <li key={inspection.id}>
                  <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3">
                          <h4 className="text-sm font-medium text-gray-900 truncate">
                            {inspection.title}
                          </h4>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(inspection.type)}`}>
                            {inspection.type}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(inspection.status)}`}>
                            {inspection.status}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center text-sm text-gray-500 space-x-4">
                          <div>
                            <span className="font-medium">Төхөөрөмж:</span> {inspection.device?.serialNumber} ({inspection.device?.assetTag})
                          </div>
                          <div>
                            <span className="font-medium">Хариуцсан:</span> {inspection.assignee?.fullName}
                          </div>
                          {inspection.progress && (
                            <div>
                              <span className="font-medium">Явц:</span> {inspection.progress}%
                            </div>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-gray-500">
                          {inspection.scheduledAt && (
                            <span>Төлөвлөсөн: {new Date(inspection.scheduledAt).toLocaleDateString('mn-MN')}</span>
                          )}
                          {inspection.completedAt && (
                            <span className="ml-4">Дууссан: {new Date(inspection.completedAt).toLocaleDateString('mn-MN')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        </main>
      </div>
    </div>
  );
}
