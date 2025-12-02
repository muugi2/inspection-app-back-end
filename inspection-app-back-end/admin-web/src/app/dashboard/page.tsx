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
  const [confirmAction, setConfirmAction] = useState<{
    type: 'complete' | 'delete';
    inspectionId: string;
    inspectionTitle: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
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

  const ACTIVE_STATUSES = ['draft', 'in_progress', 'submitted'];

  const loadInspections = async () => {
    try {
      setIsLoading(true);
      // Get all inspections and filter for active ones
      const response = await apiService.inspections.getAll();
      const allInspections: Inspection[] = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
      const active = allInspections.filter((inspection: Inspection) =>
        ACTIVE_STATUSES.includes(inspection.status?.toLowerCase?.() || '')
      );
      setInspections(active);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Үзлэгүүдийг ачаалахад алдаа гарлаа';
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

  const handleCompleteInspection = async (inspectionId: string) => {
    try {
      setIsProcessing(true);
      await apiService.inspections.update(inspectionId, {
        status: 'approved',
      });
      setConfirmAction(null);
      await loadInspections();
      setError('');
      alert('✅ Үзлэг амжилттай дууслаа!');
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Үзлэгийг дуусгахад алдаа гарлаа';
      setError(message);
      alert('❌ ' + message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteInspection = async (inspectionId: string) => {
    try {
      setIsProcessing(true);
      await apiService.inspections.delete(inspectionId);
      
      // Close confirmation dialog
      setConfirmAction(null);
      
      // Always refresh the list after deletion
      await loadInspections();
      
      setError('');
      alert('✅ Үзлэг амжилттай устгагдлаа! MySQL-аас хадгалалт устгагдсан.');
    } catch (err: any) {
      // Only log unexpected errors in development
      if (process.env.NODE_ENV === 'development' && err.response?.status >= 500) {
        console.error('Unexpected delete error:', err);
      }
      const message = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Үзлэгийг устгахад алдаа гарлаа';
      setError(message);
      alert('❌ ' + message);
    } finally {
      setIsProcessing(false);
    }
  };

  const openConfirmDialog = (type: 'complete' | 'delete', inspectionId: string, inspectionTitle: string) => {
    setConfirmAction({ type, inspectionId, inspectionTitle });
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
                      Идэвхтэй үзлэг
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
                  <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-bold">↗</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Илгээсэн (submitted)
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {
                        inspections.filter(
                          (i) => (i.status || '').toLowerCase() === 'submitted'
                        ).length
                      }
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
                      {
                        inspections.filter(
                          (i) => (i.status || '').toLowerCase() === 'in_progress'
                        ).length
                      }
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
                      {
                        inspections.filter(
                          (i) => (i.status || '').toLowerCase() === 'draft'
                        ).length
                      }
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
                  Идэвхтэй үзлэгүүд
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Одоо үргэлжилж буй (draft, submitted, in_progress) үзлэгүүд
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
              <p className="text-gray-500">Идэвхтэй үзлэг олдсонгүй</p>
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
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => openConfirmDialog('complete', inspection.id, inspection.title)}
                          disabled={isProcessing}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          ✓ Дуусгах
                        </button>
                        <button
                          onClick={() => openConfirmDialog('delete', inspection.id, inspection.title)}
                          disabled={isProcessing}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          🗑️ Устгах
                        </button>
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

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {confirmAction.type === 'complete' ? 'Үзлэг дуусгах' : 'Үзлэг устгах'}
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                {confirmAction.type === 'complete' 
                  ? `Та "${confirmAction.inspectionTitle}" үзлэгийг дуусгахдаа итгэлтэй байна уу?`
                  : `Та "${confirmAction.inspectionTitle}" үзлэгийг устгахдаа итгэлтэй байна уу? Энэ үйлдлийг буцаах боломжгүй.`
                }
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setConfirmAction(null)}
                  disabled={isProcessing}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
                >
                  Цуцлах
                </button>
                <button
                  onClick={() => {
                    if (confirmAction.type === 'complete') {
                      handleCompleteInspection(confirmAction.inspectionId);
                    } else {
                      handleDeleteInspection(confirmAction.inspectionId);
                    }
                  }}
                  disabled={isProcessing}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${
                    confirmAction.type === 'complete'
                      ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                      : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                  }`}
                >
                  {isProcessing ? 'Түр хүлээнэ үү...' : confirmAction.type === 'complete' ? 'Дуусгах' : 'Устгах'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
