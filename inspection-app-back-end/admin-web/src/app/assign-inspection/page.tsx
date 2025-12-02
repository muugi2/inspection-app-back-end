'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authUtils, User } from '@/lib/auth';
import { apiService } from '@/lib/api';
import Sidebar from '@/components/Sidebar';

interface Organization {
  id: string;
  name: string;
  code: string;
}

interface Device {
  id: string;
  serialNumber: string;
  assetTag: string;
  status: string;
  model: {
    manufacturer: string;
    model: string;
  } | null;
  site: {
    name: string;
  } | null;
}

interface Inspection {
  id: string;
  title: string;
  type: string;
  status: string;
  scheduledAt: string | null;
  assignee: {
    id: string;
    fullName: string;
  } | null;
}

interface UserOption {
  id: string;
  fullName: string;
  email: string;
  role: string;
  organization?: {
    id: string;
    name: string;
    code: string;
  };
  orgId?: string;
}

export default function AssignInspectionPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [selectedInspectionId, setSelectedInspectionId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [filterUserOrgId, setFilterUserOrgId] = useState(''); // Filter users by organization (optional)
  
  const [isLoading, setIsLoading] = useState(true);
  const [isAssigning, setIsAssigning] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const router = useRouter();

  useEffect(() => {
    const initialize = async () => {
      if (!authUtils.isAuthenticated()) {
        router.push('/login');
        return;
      }

      const user = authUtils.getUser();
      if (user) {
        setCurrentUser(user);
      }

      try {
        const verification = await authUtils.verifyToken();
        if (!verification.valid) {
          router.push('/login');
          return;
        }
        
        if (verification.user) {
          setCurrentUser(verification.user);
        }
      } catch (error) {
        console.error('Token verification failed:', error);
        router.push('/login');
        return;
      }

      await loadOrganizations();
      await loadAllUsers(); // Load all users from all organizations
      setIsLoading(false);
    };

    initialize();
  }, [router]);

  const loadOrganizations = async () => {
    try {
      const response = await apiService.organizations.getAll();
      setOrganizations(response?.data || []);
    } catch (err: any) {
      console.error('Failed to load organizations:', err);
      setError('Байгууллагуудыг ачаалахад алдаа гарлаа');
    }
  };

  const loadDevices = async (orgId: string) => {
    try {
      setDevices([]);
      setInspections([]);
      setSelectedDeviceId('');
      setSelectedInspectionId('');
      
      const response = await apiService.devices.getByOrganization(orgId);
      setDevices(response?.data || []);
    } catch (err: any) {
      console.error('Failed to load devices:', err);
      setError('Төхөөрөмжүүдийг ачаалахад алдаа гарлаа');
    }
  };

  const loadInspections = async (deviceId: string) => {
    try {
      setInspections([]);
      setSelectedInspectionId('');
      
      const response = await apiService.inspections.getByDevice(deviceId);
      setInspections(response?.data || []);
    } catch (err: any) {
      console.error('Failed to load inspections:', err);
      setError('Үзлэгүүдийг ачаалахад алдаа гарлаа');
    }
  };

  const loadAllUsers = async () => {
    try {
      const response = await apiService.users.getAll();
      // Filter only inspector users
      const inspectorUsers = (response?.data || []).filter(
        (user: any) => user?.role?.toLowerCase() === 'inspector' && user?.isActive !== false
      );
      setUsers(inspectorUsers);
    } catch (err: any) {
      setError('Хэрэглэгчдийг ачаалахад алдаа гарлаа');
    }
  };

  const handleOrgChange = async (orgId: string) => {
    setSelectedOrgId(orgId);
    if (orgId) {
      await loadDevices(orgId);
    } else {
      setDevices([]);
      setInspections([]);
    }
  };

  const handleDeviceChange = async (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    if (deviceId) {
      await loadInspections(deviceId);
    } else {
      setInspections([]);
    }
  };

  const handleAssign = async () => {
    if (!selectedInspectionId || !selectedUserId) {
      setError('Үзлэг болон хэрэглэгч сонгоно уу!');
      return;
    }

    setIsAssigning(true);
    setError('');
    setSuccess('');

    try {
      await apiService.inspections.assign(selectedInspectionId, selectedUserId);
      setSuccess('Үзлэгийг амжилттай томиллоо!');
      
      // Refresh inspections list
      if (selectedDeviceId) {
        await loadInspections(selectedDeviceId);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 
                          err.response?.data?.error ||
                          'Үзлэг томилоход алдаа гарлаа';
      setError(errorMessage);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleLogout = () => {
    authUtils.logout();
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { bg: string; text: string; label: string }> = {
      draft: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Ноорог' },
      in_progress: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Явагдаж байгаа' },
      submitted: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Илгээсэн' },
      approved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Батлагдсан' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Татгалзсан' },
    };
    const style = statusMap[status?.toLowerCase()] || statusMap.draft;
    return `${style.bg} ${style.text} px-3 py-1 rounded-full text-xs font-medium`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-3 text-gray-600">Ачаалж байна...</p>
        </div>
      </div>
    );
  }

  const selectedOrg = organizations.find(o => o?.id === selectedOrgId) || null;
  const selectedDevice = devices.find(d => d?.id === selectedDeviceId) || null;
  const selectedInspection = inspections.find(i => i?.id === selectedInspectionId) || null;
  const selectedUser = users.find(u => u?.id === selectedUserId) || null;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <Sidebar currentUser={currentUser} />

      {/* Main Content */}
      <div className="flex-1 ml-64">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="px-6 py-4">
            <h1 className="text-xl font-bold text-gray-900">Үзлэг томилох</h1>
            <p className="text-xs text-gray-500 mt-1">Байгууллага → Төхөөрөмж → Үзлэг → Хэрэглэгч</p>
          </div>
        </header>

        {/* Content */}
        <main className="p-6">
        {/* Error & Success Messages */}
        {error && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-500 rounded p-3">
            <p className="text-sm text-red-800">⚠ {error}</p>
          </div>
        )}
        
        {success && (
          <div className="mb-4 bg-green-50 border-l-4 border-green-500 rounded p-3">
            <p className="text-sm text-green-800">✓ {success}</p>
          </div>
        )}

        {/* Progress Steps */}
        <div className="mb-4 bg-white rounded-lg shadow p-3">
          <div className="flex items-center gap-2">
            {[
              { num: 1, label: 'Байгууллага', active: !!selectedOrgId },
              { num: 2, label: 'Төхөөрөмж', active: !!selectedDeviceId },
              { num: 3, label: 'Үзлэг', active: !!selectedInspectionId },
              { num: 4, label: 'Хэрэглэгч', active: !!selectedUserId },
            ].map((step, index, arr) => (
              <div key={step.num} className="flex items-center flex-1">
                <div className="flex items-center gap-1.5 flex-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                    step.active 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step.active ? '✓' : step.num}
                  </div>
                  <p className={`text-xs font-medium ${step.active ? 'text-indigo-600' : 'text-gray-500'}`}>
                    {step.label}
                  </p>
                </div>
                {index < arr.length - 1 && (
                  <div className={`w-6 h-0.5 ${arr[index + 1].active ? 'bg-indigo-600' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column - Selection */}
          <div className="lg:col-span-2 space-y-3">
            {/* Step 1: Organization */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-bold">1</span>
                </div>
                <h3 className="text-base font-bold text-gray-900">Байгууллага сонгох</h3>
              </div>
              <select
                value={selectedOrgId}
                onChange={(e) => handleOrgChange(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm"
              >
                <option value="">-- Сонгох --</option>
                {organizations.map((org) => (
                  <option key={org?.id} value={org?.id}>
                    {org?.name || 'N/A'} ({org?.code || 'N/A'})
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Device */}
            <div className={`bg-white rounded-lg shadow p-4 ${!selectedOrgId && 'opacity-50'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  selectedOrgId ? 'bg-indigo-600' : 'bg-gray-300'
                }`}>
                  <span className="text-white text-sm font-bold">2</span>
                </div>
                <h3 className="text-base font-bold text-gray-900">Төхөөрөмж сонгох</h3>
              </div>
              <select
                value={selectedDeviceId}
                onChange={(e) => handleDeviceChange(e.target.value)}
                disabled={!selectedOrgId}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm disabled:bg-gray-100"
              >
                <option value="">-- Сонгох --</option>
                {devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.serialNumber} - {device.assetTag}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 3: Inspection */}
            <div className={`bg-white rounded-lg shadow p-4 ${!selectedDeviceId && 'opacity-50'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  selectedDeviceId ? 'bg-indigo-600' : 'bg-gray-300'
                }`}>
                  <span className="text-white text-sm font-bold">3</span>
                </div>
                <h3 className="text-base font-bold text-gray-900">Үзлэг сонгох</h3>
              </div>
              <select
                value={selectedInspectionId}
                onChange={(e) => setSelectedInspectionId(e.target.value)}
                disabled={!selectedDeviceId}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm disabled:bg-gray-100"
              >
                <option value="">-- Сонгох --</option>
                {inspections.map((inspection) => (
                  <option key={inspection.id} value={inspection.id}>
                    {inspection.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 4: User */}
            <div className={`bg-white rounded-lg shadow p-4 ${!selectedInspectionId && 'opacity-50'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  selectedInspectionId ? 'bg-indigo-600' : 'bg-gray-300'
                }`}>
                  <span className="text-white text-sm font-bold">4</span>
                </div>
                <h3 className="text-base font-bold text-gray-900">Хэрэглэгч сонгох</h3>
              </div>
              
              {/* Optional: Filter by organization */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Байгууллагаар шүүх (сонголттой):
                </label>
                <select
                  value={filterUserOrgId}
                  onChange={(e) => setFilterUserOrgId(e.target.value)}
                  disabled={!selectedInspectionId}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm disabled:bg-gray-100"
                >
                  <option value="">Бүх байгууллага</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.code})
                    </option>
                  ))}
                </select>
              </div>
              
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                disabled={!selectedInspectionId}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm disabled:bg-gray-100"
              >
                <option value="">-- Сонгох --</option>
                {users
                  .filter((user) => {
                    if (!user) return false;
                    // Filter by organization if selected
                    if (filterUserOrgId) {
                      return user?.organization?.id === filterUserOrgId || user?.orgId === filterUserOrgId;
                    }
                    return true;
                  })
                  .map((user) => (
                    <option key={user?.id} value={user?.id}>
                      {user?.fullName || 'N/A'} - {user?.organization?.name || 'N/A'} ({user?.role || 'N/A'})
                    </option>
                  ))}
              </select>
              {users.filter((user) => {
                if (!user) return false;
                if (filterUserOrgId) {
                  return (user?.organization?.id === filterUserOrgId || user?.orgId === filterUserOrgId);
                }
                return true;
              }).length === 0 && (
                <p className="text-sm text-red-600 mt-2">
                  Inspector хэрэглэгч олдсонгүй.
                </p>
              )}
            </div>

            {/* Assign Button */}
            <button
              onClick={handleAssign}
              disabled={!selectedInspectionId || !selectedUserId || isAssigning}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAssigning ? 'Томилж байна...' : 'Томилох'}
            </button>
          </div>

          {/* Right Column - Preview */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-base font-bold text-gray-900 mb-4 pb-2 border-b">Сонгосон мэдээлэл</h3>
            
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-500 text-xs mb-1">Байгууллага:</p>
                <p className="font-semibold text-gray-900">
                  {selectedOrg ? selectedOrg.name : '—'}
                </p>
              </div>

              <div>
                <p className="text-gray-500 text-xs mb-1">Төхөөрөмж:</p>
                <p className="font-semibold text-gray-900">
                  {selectedDevice ? `${selectedDevice.serialNumber} - ${selectedDevice.assetTag}` : '—'}
                </p>
              </div>

              <div>
                <p className="text-gray-500 text-xs mb-1">Үзлэг:</p>
                <p className="font-semibold text-gray-900">
                  {selectedInspection ? (
                    <>
                      {selectedInspection.title}
                      {selectedInspection.assignee && (
                        <span className="block text-xs text-orange-600 mt-1">
                          Одоо: {selectedInspection.assignee.fullName}
                        </span>
                      )}
                    </>
                  ) : '—'}
                </p>
              </div>

              <div>
                <p className="text-gray-500 text-xs mb-1">Хэрэглэгч:</p>
                <p className="font-semibold text-gray-900">
                  {selectedUser ? (
                    <>
                      {selectedUser.fullName}
                      {selectedUser.organization && (
                        <span className="block text-xs text-gray-500 mt-1">
                          {selectedUser.organization.name} ({selectedUser.organization.code})
                        </span>
                      )}
                    </>
                  ) : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>
        </main>
      </div>
    </div>
  );
}

