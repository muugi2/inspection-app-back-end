'use client';

import { useState, useEffect } from 'react';
import { apiService } from '@/lib/api';
import { authUtils } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import TopNavbar from '@/components/TopNavbar';

interface Organization {
  id: string;
  name: string;
  code: string;
}

interface Site {
  id: string;
  name: string;
}

interface Contract {
  id: string;
  contractName: string;
  contractNumber: string;
}

interface DeviceModel {
  id: string;
  manufacturer: string;
  model: string;
}

interface Device {
  id: string;
  serialNumber: string;
  assetTag: string;
  orgId: string;
  siteId?: string;
  contractId?: string;
  modelId?: string;
}

interface Template {
  id: string;
  name: string;
  type: string;
}

interface User {
  id: string;
  fullName: string;
  email: string;
  organization?: {
    name: string;
    code: string;
  };
  role?: string;
}

interface Inspection {
  id: string;
  orgId: string;
  deviceId: string;
  siteId?: string;
  contractId?: string;
  templateId?: string;
  type: string;
  title: string;
  scheduledAt?: string;
  status: string;
  assignedTo?: string;
  notes?: string;
  device?: {
    id: string;
    serialNumber: string;
    assetTag: string;
    model?: {
      manufacturer: string;
      model: string;
    };
  };
  site?: {
    id: string;
    name: string;
  };
  template?: {
    id: string;
    name: string;
  };
  assignedUser?: {
    id: string;
    fullName: string;
  };
  createdAt?: string;
}

export default function InspectionsPage() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Form states
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedDevice, setSelectedDevice] = useState('');
  const [selectedType, setSelectedType] = useState('INSPECTION');
  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');

  // Assignment modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningInspection, setAssigningInspection] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState('');

  useEffect(() => {
    fetchInspections();
    fetchOrganizations();
    fetchTemplates();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedOrg) {
      fetchDevicesByOrg(selectedOrg);
      fetchSitesByOrg(selectedOrg);
      fetchContractsByOrg(selectedOrg);
    } else {
      setDevices([]);
      setSites([]);
      setContracts([]);
    }
  }, [selectedOrg]);

  const fetchInspections = async () => {
    try {
      setLoading(true);
      const response = await apiService.inspections.getAll();
      setInspections(response.data || []);
    } catch (error: any) {
      console.error('Failed to fetch inspections:', error);
      alert(error.response?.data?.message || 'Failed to fetch inspections');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const response = await apiService.organizations.getAll();
      setOrganizations(response.data || []);
    } catch (error: any) {
      console.error('Failed to fetch organizations:', error);
    }
  };

  const fetchDevicesByOrg = async (orgId: string) => {
    try {
      const response = await apiService.devices.getByOrganization(orgId);
      setDevices(response.data || []);
    } catch (error: any) {
      console.error('Failed to fetch devices:', error);
    }
  };

  const fetchSitesByOrg = async (orgId: string) => {
    try {
      const response = await apiService.sites.getByOrganization(orgId);
      setSites(response.data || []);
    } catch (error: any) {
      console.error('Failed to fetch sites:', error);
    }
  };

  const fetchContractsByOrg = async (orgId: string) => {
    try {
      const response = await apiService.contracts.getByOrganization(orgId);
      setContracts(response.data || []);
    } catch (error: any) {
      console.error('Failed to fetch contracts:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await apiService.templates.getAll();
      setTemplates(response.data || []);
    } catch (error: any) {
      console.error('Failed to fetch templates:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await apiService.users.getAll();
      setUsers(response.data || []);
    } catch (error: any) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleOpenModal = (inspection?: Inspection) => {
    if (inspection) {
      setEditingId(inspection.id);
      setTitle(inspection.title);
      setSelectedType(inspection.type);
      setScheduledAt(inspection.scheduledAt ? inspection.scheduledAt.split('T')[0] : '');
      setNotes(inspection.notes || '');
      setSelectedTemplate(inspection.templateId || '');
      setSelectedOrg(inspection.orgId);
      setSelectedDevice(inspection.deviceId);
    } else {
      setEditingId(null);
      resetForm();
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  const resetForm = () => {
    setSelectedOrg('');
    setSelectedDevice('');
    setSelectedType('INSPECTION');
    setTitle('');
    setScheduledAt('');
    setNotes('');
    setSelectedTemplate('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDevice || !title) {
      alert('Device and title are required');
      return;
    }

    try {
      setLoading(true);

      const data = {
        orgId: selectedOrg,
        deviceId: selectedDevice,
        type: selectedType,
        title,
        scheduledAt: scheduledAt || undefined,
        notes: notes || undefined,
        templateId: selectedTemplate || undefined,
      };

      if (editingId) {
        await apiService.inspections.update(editingId, {
          title: data.title,
          scheduledAt: data.scheduledAt,
          notes: data.notes,
        });
        alert('✅ Үзлэг амжилттай шинэчлэгдлээ');
      } else {
        await apiService.inspections.create(data);
        alert('✅ Үзлэг амжилттай үүслээ');
      }

      handleCloseModal();
      fetchInspections();
    } catch (error: any) {
      console.error('Failed to save inspection:', error);
      alert(error.response?.data?.message || 'Failed to save inspection');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this inspection?')) {
      return;
    }

    try {
      setLoading(true);
      await apiService.inspections.delete(id);
      alert('✅ Үзлэг амжилттай устгагдлаа');
      fetchInspections();
    } catch (error: any) {
      console.error('Failed to delete inspection:', error);
      const errorMessage = error.response?.data?.message || 'Failed to delete inspection';
      alert('❌ ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAssignModal = (inspectionId: string) => {
    setAssigningInspection(inspectionId);
    setSelectedUser('');
    setShowAssignModal(true);
  };

  const handleCloseAssignModal = () => {
    setShowAssignModal(false);
    setAssigningInspection(null);
    setSelectedUser('');
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUser || !assigningInspection) {
      alert('Please select a user');
      return;
    }

    try {
      setLoading(true);
      await apiService.inspections.assign(assigningInspection, selectedUser);
      alert('✅ Үзлэг амжилттай томилогдлоо');
      handleCloseAssignModal();
      fetchInspections();
    } catch (error: any) {
      console.error('Failed to assign inspection:', error);
      alert(error.response?.data?.message || 'Failed to assign inspection');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Ноорог' },
      SCHEDULED: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Төлөвлөсөн' },
      IN_PROGRESS: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Явагдаж байгаа' },
      COMPLETED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Дууссан' },
      APPROVED: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Батлагдсан' },
    };

    const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getTypeLabel = (type: string) => {
    const typeLabels: Record<string, string> = {
      INSPECTION: 'Үзлэг',
      INSTALLATION: 'Суурилуулалт',
      MAINTENANCE: 'Засвар',
      VERIFICATION: 'Баталгаажуулалт',
    };
    return typeLabels[type] || type;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar currentUser={authUtils.getUser()} />
      
      <div className="flex-1 ml-64 flex flex-col">
        <TopNavbar />
        
        <header className="bg-white shadow-sm">
          <div className="px-6 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Үзлэг</h1>
              <p className="text-sm text-gray-500">Үзлэгүүдийг удирдах</p>
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              + Шинэ үзлэг үүсгэх
            </button>
          </div>
        </header>

        <main className="p-6 flex-1">

      {loading && <p className="text-center py-4">Loading...</p>}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Төхөөрөмж</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Гарчиг</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Төрөл</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Талбай</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Төлөв</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Хуваарь</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Томилогдсон</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Үйлдэл</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {inspections.map((inspection) => (
              <tr key={inspection.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">
                    {inspection.device?.serialNumber || '-'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {inspection.device?.assetTag || '-'}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">{inspection.title}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{getTypeLabel(inspection.type)}</td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {inspection.site?.name || '-'}
                </td>
                <td className="px-6 py-4">{getStatusBadge(inspection.status)}</td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {inspection.scheduledAt
                    ? new Date(inspection.scheduledAt).toLocaleDateString('mn-MN')
                    : '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {inspection.assignedUser?.fullName || '-'}
                </td>
                <td className="px-6 py-4 text-sm font-medium space-x-2">
                  <button
                    onClick={() => handleOpenModal(inspection)}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    Засах
                  </button>
                  <button
                    onClick={() => handleOpenAssignModal(inspection.id)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    Томилох
                  </button>
                  <button
                    onClick={() => handleDelete(inspection.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Устгах
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {inspections.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">Үзлэг олдсонгүй</p>
            <p className="text-sm mt-2">Шинэ үзлэг үүсгэнэ үү</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">
              {editingId ? 'Үзлэг засах' : 'Шинэ үзлэг үүсгэх'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Organization */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Байгууллага *
                </label>
                <select
                  value={selectedOrg}
                  onChange={(e) => setSelectedOrg(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                  required
                  disabled={!!editingId}
                >
                  <option value="">Сонгох</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Device */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Төхөөрөмж *
                </label>
                <select
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                  required
                  disabled={!selectedOrg || !!editingId}
                >
                  <option value="">Сонгох</option>
                  {devices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.serialNumber} - {device.assetTag}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Төрөл *
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                  required
                >
                  <option value="INSPECTION">Үзлэг, шалгалт (Inspection)</option>
                  <option value="INSTALLATION">Суурилуулалт (Installation)</option>
                  <option value="MAINTENANCE">Засвар үйлчилгээ (Maintenance)</option>
                  <option value="VERIFICATION">Баталгаажуулалт (Verification)</option>
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Гарчиг *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                  placeholder="Өдөр тутмын үзлэг"
                  required
                />
              </div>

              {/* Template */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template
                </label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                  disabled={!!editingId}
                >
                  <option value="">Сонгох</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Scheduled At */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Хуваарь
                </label>
                <input
                  type="date"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Тэмдэглэл
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                  rows={3}
                  placeholder="Нэмэлт тэмдэглэл..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50"
                >
                  {loading ? 'Saving...' : editingId ? 'Шинэчлэх' : 'Үүсгэх'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={loading}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Болих
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6">Үзлэг томилох</h2>
            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Хэрэглэгч сонгох *
                </label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                  required
                >
                  <option value="">Сонгох</option>
                  {users
                    .filter((user) => user.role?.toLowerCase() === 'inspector')
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.fullName} - {user.organization?.name || 'N/A'} ({user.role})
                      </option>
                    ))}
                </select>
                {users.filter((user) => user.role?.toLowerCase() === 'inspector').length === 0 && (
                  <p className="text-sm text-red-600 mt-2">
                    Inspector хэрэглэгч олдсонгүй. Эхлээд inspector үүсгэнэ үү.
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50"
                >
                  {loading ? 'Томилж байна...' : 'Томилох'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseAssignModal}
                  disabled={loading}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Болих
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </main>
      </div>
    </div>
  );
}

