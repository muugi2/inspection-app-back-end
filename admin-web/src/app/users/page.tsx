'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authUtils, User } from '@/lib/auth';
import { apiService } from '@/lib/api';
import Sidebar from '@/components/Sidebar';

interface UserData {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  organization: {
    id: string;
    name: string;
    code: string;
  };
  role: string;
}

interface Role {
  id: string;
  name: string;
}

interface Organization {
  id: string;
  name: string;
  code: string;
}

export default function UsersPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [roles] = useState<Role[]>([
    { id: '1', name: 'admin' },
    { id: '2', name: 'inspector' }
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    roleId: '2', // Default to inspector
    orgId: '',
  });

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

      await loadUsers();
      await loadOrganizations();
    };

    initialize();
  }, [router]);

  const loadOrganizations = async () => {
    try {
      const response = await apiService.organizations.getAll();
      setOrganizations(response.data || []);
    } catch (err: any) {
      console.error('Failed to load organizations:', err);
    }
  };

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const response = await apiService.users.getAll();
      setUsers(response.data || []);
      setError('');
    } catch (err: any) {
      console.error('Failed to load users:', err);
      setError('Хэрэглэгчдийг ачаалахад алдаа гарлаа');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    // Validation
    if (!formData.orgId) {
      setError('Байгууллага сонгох шаардлагатай');
      alert('Байгууллага сонгоно уу!');
      setIsSubmitting(false);
      return;
    }

    console.log('🚀 Creating user:', {
      email: formData.email,
      fullName: formData.fullName,
      phone: formData.phone,
      roleId: formData.roleId,
      orgId: formData.orgId,
    });

    try {
      const response = await apiService.users.create({
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        phone: formData.phone || undefined,
        roleIds: [formData.roleId],
        orgId: formData.orgId,
      });

      console.log('✅ User created:', response);

      // Reset form and close modal
      setFormData({
        email: '',
        password: '',
        fullName: '',
        phone: '',
        roleId: '2',
        orgId: '',
      });
      setShowAddModal(false);

      // Reload users
      await loadUsers();
      
      alert('Хэрэглэгч амжилттай үүслээ! MySQL-д шалгана уу.');
    } catch (err: any) {
      console.error('❌ Failed to create user:', err);
      console.error('Error details:', err.response?.data);
      
      let errorMessage = 'Хэрэглэгч үүсгэхэд алдаа гарлаа';
      
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = `Алдаа: ${err.message}`;
      }
      
      setError(errorMessage);
      alert(`Алдаа: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    authUtils.logout();
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin': return 'bg-purple-100 text-purple-800';
      case 'inspector': return 'bg-blue-100 text-blue-800';
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
      <Sidebar currentUser={currentUser} />

      {/* Main Content */}
      <div className="flex-1 ml-64">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="px-6 py-4">
            <h1 className="text-xl font-bold text-gray-900">Хэрэглэгч удирдах</h1>
            <p className="text-sm text-gray-500">Хэрэглэгчид нэмэх, засах, устгах</p>
          </div>
        </header>

        {/* Content */}
        <main className="p-6">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-red-800">{error}</div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg p-5">
            <div className="text-sm font-medium text-gray-500">Нийт хэрэглэгч</div>
            <div className="text-2xl font-bold text-gray-900">{users.length}</div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg p-5">
            <div className="text-sm font-medium text-gray-500">Идэвхтэй</div>
            <div className="text-2xl font-bold text-green-600">
              {users.filter(u => u.isActive).length}
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg p-5">
            <div className="text-sm font-medium text-gray-500">Админ</div>
            <div className="text-2xl font-bold text-purple-600">
              {users.filter(u => u.role.toLowerCase() === 'admin').length}
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Хэрэглэгчдийн жагсаалт</h3>
              <p className="text-sm text-gray-500">Байгууллагын бүх хэрэглэгчид</p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                + Хэрэглэгч нэмэх
              </button>
              <button
                onClick={loadUsers}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Шинэчлэх
              </button>
            </div>
          </div>
          
          {users.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Хэрэглэгч олдсонгүй</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Нэр</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">И-мэйл</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Утас</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Хандах эрх</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Байгууллага</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Төлөв</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Үүсгэсэн</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user.fullName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.phone || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.organization.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {user.isActive ? 'Идэвхтэй' : 'Идэвхгүй'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString('mn-MN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => !isSubmitting && setShowAddModal(false)}
            ></div>

            {/* Modal panel */}
            <div className="relative bg-white rounded-lg text-left overflow-visible shadow-2xl transform transition-all max-w-lg w-full mx-auto my-8 z-50">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-6 pt-6 pb-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-900">
                      Шинэ хэрэглэгч нэмэх
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <span className="text-2xl">×</span>
                    </button>
                  </div>
                  
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Байгууллага <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="orgId"
                        required
                        value={formData.orgId}
                        onChange={handleInputChange}
                        className="block w-full border-2 border-gray-300 rounded-lg shadow-sm py-2.5 px-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                      >
                        <option value="">Байгууллага сонгох</option>
                        {organizations.map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name} ({org.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Нэр <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="fullName"
                        required
                        value={formData.fullName}
                        onChange={handleInputChange}
                        className="block w-full border-2 border-gray-300 rounded-lg shadow-sm py-2.5 px-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Бат Болд"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        И-мэйл <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleInputChange}
                        className="block w-full border-2 border-gray-300 rounded-lg shadow-sm py-2.5 px-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="batbold@example.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Нууц үг <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        name="password"
                        required
                        minLength={6}
                        value={formData.password}
                        onChange={handleInputChange}
                        className="block w-full border-2 border-gray-300 rounded-lg shadow-sm py-2.5 px-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Хамгийн багадаа 6 тэмдэгт"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Утасны дугаар
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="block w-full border-2 border-gray-300 rounded-lg shadow-sm py-2.5 px-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="+976 99001122"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Хандах эрх <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="roleId"
                        required
                        value={formData.roleId}
                        onChange={handleInputChange}
                        className="block w-full border-2 border-gray-300 rounded-lg shadow-sm py-2.5 px-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                      >
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setShowAddModal(false)}
                    className="px-6 py-2.5 border-2 border-gray-300 rounded-lg text-base font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Болих
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Үүсгэж байна...' : 'Үүсгэх'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

