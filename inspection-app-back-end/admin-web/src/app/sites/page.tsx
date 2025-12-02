'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authUtils } from '@/lib/auth';
import { apiService } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import TopNavbar from '@/components/TopNavbar';
import DeleteErrorModal from '@/components/DeleteErrorModal';

interface Site {
  id: string;
  name: string;
  orgId: string;
  organization?: {
    id: string;
    name: string;
    code: string;
  };
  createdAt: string;
}

interface Organization {
  id: string;
  name: string;
  code: string;
}

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [formData, setFormData] = useState({ name: '', orgId: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [filterOrgId, setFilterOrgId] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorData, setErrorData] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    // Only get user on client side to avoid hydration mismatch
    setCurrentUser(authUtils.getUser());
    
    if (!authUtils.isAuthenticated()) {
      router.push('/login');
      return;
    }
    loadData();
  }, [router]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [sitesRes, orgsRes] = await Promise.all([
        apiService.sites.getAll(),
        apiService.organizations.getAll(),
      ]);
      setSites(sitesRes.data || []);
      setOrganizations(orgsRes.data || []);
      setError('');
    } catch (err: any) {
      console.error('Failed to load data:', err);
      setError('Өгөгдөл ачаалахад алдаа гарлаа');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingSite(null);
    setFormData({ name: '', orgId: filterOrgId || '' });
    setShowModal(true);
  };

  const handleEdit = (site: Site) => {
    setEditingSite(site);
    setFormData({ name: site.name, orgId: site.orgId });
    setShowModal(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Та "${name}" талбайг устгахдаа итгэлтэй байна уу?\n\nАнхааруулга: Хэрэв энэ талбайд төхөөрөмж байвал устгаж чадахгүй!`)) {
      return;
    }

    try {
      await apiService.sites.delete(id);
      
      // Always refresh the list after deletion
      await loadData();
      
      alert('✓ Талбайг амжилттай устгалаа! MySQL-аас хадгалалт устгагдсан.');
    } catch (err: any) {
      
      // Check if error has detailed information
      if (err.response?.data?.devices) {
        setErrorData({
          message: err.response.data.message,
          devices: err.response.data.devices,
        });
        setShowErrorModal(true);
      } else {
        const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || 'Устгахад алдаа гарлаа';
        alert('❌ ' + errorMessage);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.orgId) {
      alert('Нэр болон байгууллага шаардлагатай');
      return;
    }

    try {
      setIsSaving(true);
      if (editingSite) {
        await apiService.sites.update(editingSite.id, formData);
        alert('✓ Талбайг амжилттай шинэчлэлээ!');
      } else {
        await apiService.sites.create(formData);
        alert('✓ Талбайг амжилттай үүсгэлээ!');
      }
      setShowModal(false);
      await loadData();
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || 'Хадгалахад алдаа гарлаа';
      alert('❌ ' + errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredSites = filterOrgId
    ? sites.filter(site => site.orgId === filterOrgId)
    : sites;

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
      <Sidebar currentUser={currentUser} />

      <div className="flex-1 ml-64 flex flex-col">
        <TopNavbar />
        <header className="bg-white shadow-sm">
          <div className="px-6 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Талбай удирдах</h1>
              <p className="text-sm text-gray-500">Байгууллагын талбайнуудын жагсаалт</p>
            </div>
            <button
              onClick={handleCreate}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
            >
              <span>+</span> Нэмэх
            </button>
          </div>
        </header>

        <main className="p-6">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="text-red-800">{error}</div>
              <button 
                onClick={loadData}
                className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
              >
                Дахин оролдох
              </button>
            </div>
          )}

          {/* Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Байгууллагаар шүүх:
            </label>
            <select
              value={filterOrgId}
              onChange={(e) => setFilterOrgId(e.target.value)}
              className="w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Бүгд</option>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.code})
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Талбайн нэр
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Байгууллага
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Үүсгэсэн огноо
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Үйлдэл
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSites.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      Талбай олдсонгүй
                    </td>
                  </tr>
                ) : (
                  filteredSites.map((site) => (
                    <tr key={site.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/site-details/${site.id}`)}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{site.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {site.organization?.name || '-'}
                        </div>
                        {site.organization && (
                          <div className="text-xs text-gray-500">{site.organization.code}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(site.createdAt).toLocaleDateString('mn-MN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(site)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          Засах
                        </button>
                        <button
                          onClick={() => handleDelete(site.id, site.name)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Устгах
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                {editingSite ? 'Талбай засах' : 'Шинэ талбай нэмэх'}
              </h3>
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Байгууллага *
                  </label>
                  <select
                    value={formData.orgId}
                    onChange={(e) => setFormData({ ...formData, orgId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  >
                    <option value="">Сонгоно уу</option>
                    {organizations.map(org => (
                      <option key={org.id} value={org.id}>
                        {org.name} ({org.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Талбайн нэр *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Жишээ: Баян-Өндөр уурхай"
                    required
                  />
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    disabled={isSaving}
                  >
                    Цуцлах
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                    disabled={isSaving}
                  >
                    {isSaving ? 'Хадгалж байна...' : 'Хадгалах'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Error Modal */}
      {showErrorModal && errorData && (
        <DeleteErrorModal
          isOpen={showErrorModal}
          onClose={() => {
            setShowErrorModal(false);
            setErrorData(null);
          }}
          errorData={errorData}
        />
      )}
    </div>
  );
}

