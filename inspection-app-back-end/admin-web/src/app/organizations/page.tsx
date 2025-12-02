'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authUtils } from '@/lib/auth';
import { apiService } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import TopNavbar from '@/components/TopNavbar';
import DeleteErrorModal from '@/components/DeleteErrorModal';

interface Organization {
  id: string;
  name: string;
  code: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    code: '', 
    contactName: '',
    contactPhone: '', 
    contactEmail: '' 
  });
  const [isSaving, setIsSaving] = useState(false);
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
    loadOrganizations();
  }, [router]);

  const loadOrganizations = async () => {
    try {
      setIsLoading(true);
      const response = await apiService.organizations.getAll();
      setOrganizations(response.data || []);
      setError('');
    } catch (err: any) {
      console.error('Failed to load organizations:', err);
      setError('Байгууллагууд ачаалахад алдаа гарлаа');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingOrg(null);
    setFormData({ name: '', code: '', contactName: '', contactPhone: '', contactEmail: '' });
    setShowModal(true);
  };

  const handleEdit = (org: Organization) => {
    setEditingOrg(org);
    setFormData({ 
      name: org.name, 
      code: org.code,
      contactName: org.contactName || '',
      contactPhone: org.contactPhone || '',
      contactEmail: org.contactEmail || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Та "${name}" байгууллагыг устгахдаа итгэлтэй байна уу?\n\nАнхааруулга: Хэрэв энэ байгууллагатай холбоотой хэрэглэгч, талбай, гэрээ, төхөөрөмж байвал устгаж чадахгүй!`)) {
      return;
    }

    try {
      await apiService.organizations.delete(id);
      
      // Always refresh the list after deletion
      await loadOrganizations();
      
      alert('✓ Байгууллагыг амжилттай устгалаа! MySQL-аас хадгалалт устгагдсан.');
    } catch (err: any) {
      // Check if error has detailed information
      if (err.response?.status === 400 && err.response?.data?.relatedRecords) {
        const relatedRecords = err.response.data.relatedRecords;
        
        setErrorData({
          message: err.response.data.message || 'Энэ байгууллагатай холбоотой бичлэгүүд байна',
          relatedRecords: {
            users: relatedRecords.users || null,
            sites: relatedRecords.sites || null,
            contracts: relatedRecords.contracts || null,
            devices: relatedRecords.devices || null,
          },
        });
        setShowErrorModal(true);
      } else if (err.response?.status === 400 && err.response?.data?.message) {
        // If there's a message but no relatedRecords, still show it in modal
        const errorMessage = err.response.data.message;
        setErrorData({
          message: errorMessage,
          relatedRecords: null,
        });
        setShowErrorModal(true);
      } else {
        // Only log unexpected errors
        if (process.env.NODE_ENV === 'development') {
          console.error('Unexpected delete error:', err);
        }
        const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || 'Устгахад алдаа гарлаа';
        alert('❌ ' + errorMessage);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.code) {
      alert('Нэр болон код шаардлагатай');
      return;
    }

    try {
      setIsSaving(true);
      if (editingOrg) {
        await apiService.organizations.update(editingOrg.id, formData);
        alert('✓ Байгууллагыг амжилттай шинэчлэлээ!');
      } else {
        await apiService.organizations.create(formData);
        alert('✓ Байгууллагыг амжилттай үүсгэлээ!');
      }
      setShowModal(false);
      await loadOrganizations();
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || 'Хадгалахад алдаа гарлаа';
      alert('❌ ' + errorMessage);
    } finally {
      setIsSaving(false);
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
      <Sidebar currentUser={currentUser} />

      <div className="flex-1 ml-64 flex flex-col">
        {/* Top Navbar for Report Pages */}
        <TopNavbar />
        
        <header className="bg-white shadow-sm">
          <div className="px-6 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Байгууллага удирдах</h1>
              <p className="text-sm text-gray-500">Байгууллагуудын жагсаалт</p>
            </div>
            <button
              onClick={handleCreate}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
            >
              <span>+</span> Нэмэх
            </button>
          </div>
        </header>

        <main className="p-6 flex-1">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="text-red-800">{error}</div>
              <button 
                onClick={loadOrganizations}
                className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
              >
                Дахин оролдох
              </button>
            </div>
          )}

          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Байгууллага
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Код
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Хариуцсан хүн
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Утасны дугаар
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Имэйл
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
                {organizations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      Байгууллага олдсонгүй
                    </td>
                  </tr>
                ) : (
                  organizations.map((org) => (
                    <tr key={org.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/organization-details/${org.id}`)}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{org.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          {org.code}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {org.contactName || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {org.contactPhone || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {org.contactEmail || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(org.createdAt).toLocaleDateString('mn-MN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(org);
                          }}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          Засах
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(org.id, org.name);
                          }}
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
                {editingOrg ? 'Байгууллага засах' : 'Шинэ байгууллага нэмэх'}
              </h3>
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Байгууллагын нэр *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Жишээ: Эрдэнэт үйлдвэр"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Код *
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Жишээ: EU"
                    required
                    maxLength={10}
                  />
                  <p className="mt-1 text-xs text-gray-500">Уникаль код оруулна уу (том үсэг)</p>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Хариуцсан хүний нэр
                  </label>
                  <input
                    type="text"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Жишээ: Батбаяр"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Хариуцсан хүний утасны дугаар
                  </label>
                  <input
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Жишээ: 99112233"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Хариуцсан хүний имэйл
                  </label>
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Жишээ: contact@example.com"
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

