'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { authUtils, User } from '@/lib/auth';
import { apiService } from '@/lib/api';

interface InspectionAnswer {
  id: string;
  inspectionId: string;
  answers: any;
  answeredBy: string;
  answeredAt: string;
  createdAt: string;
  updatedAt: string;
  inspection?: {
    id: string;
    title: string;
    type: string;
    status: string;
    device?: {
      serialNumber: string;
      assetTag: string;
      model?: {
        manufacturer: string;
        model: string;
      };
      site?: {
        name: string;
        organization?: {
          name: string;
          code: string;
        };
      };
    };
    assignee?: {
      fullName: string;
      organization?: {
        name: string;
      };
    };
  };
  user?: {
    fullName: string;
    organization?: {
      name: string;
    };
  };
}

export default function InspectionAnswerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [user, setUser] = useState<User | null>(null);
  const [answer, setAnswer] = useState<InspectionAnswer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();
  
  // Unwrap the params Promise
  const resolvedParams = use(params);

  useEffect(() => {
    const initializePage = async () => {
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

      // Load inspection answer
      await loadInspectionAnswer();
    };

    initializePage();
  }, [router, resolvedParams.id]);

  const loadInspectionAnswer = async () => {
    try {
      setIsLoading(true);
      const response = await apiService.inspectionAnswers.getById(resolvedParams.id);
      setAnswer(response.data);
    } catch (err: any) {
      console.error('Failed to load inspection answer:', err);
      setError('Үзлэгийн хариултыг ачаалахад алдаа гарлаа');
    } finally {
      setIsLoading(false);
    }
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

  const renderAnswers = (answers: any) => {
    if (!answers) return <p className="text-gray-500">Хариулт байхгүй</p>;
    
    try {
      const parsed = typeof answers === 'string' ? JSON.parse(answers) : answers;
      
      const renderSection = (sectionName: string, sectionData: any, level: number = 0) => {
        const sectionTitles: { [key: string]: string } = {
          'jbox': 'Хайрцагны хэсэг',
          'sensor': 'Мэдрэгчийн хэсэг', 
          'exterior': 'Гадаад хэсэг',
          'indicator': 'Индикаторын хэсэг',
          'foundation': 'Суурийн хэсэг',
          'cleanliness': 'Цэвэрлэгээний хэсэг',
          'metadata': 'Мэдээлэл',
          'signatures': 'Гарын үсэг',
          'remarks': 'Тайлбар'
        };

        const getStatusColor = (status: string) => {
          switch (status?.toLowerCase()) {
            case 'зүгээр': return 'bg-green-100 text-green-800';
            case 'бүтэн': return 'bg-blue-100 text-blue-800';
            case 'цэвэр': return 'bg-green-100 text-green-800';
            case 'саадгүй': return 'bg-green-100 text-green-800';
            case 'муу': return 'bg-red-100 text-red-800';
            case 'бохир': return 'bg-red-100 text-red-800';
            case 'саадтай': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
          }
        };

        const renderField = (fieldName: string, fieldData: any, fieldLevel: number = 0) => {
          if (typeof fieldData === 'object' && fieldData !== null && !Array.isArray(fieldData)) {
            // Nested object - render recursively
            return (
              <div key={fieldName} className={`ml-${fieldLevel * 4} mb-3`}>
                <h4 className="text-md font-medium text-gray-800 mb-2 capitalize">
                  {fieldName.replace('_', ' ')}
                </h4>
                <div className="ml-4 space-y-2">
                  {Object.entries(fieldData).map(([subField, subValue]: [string, any]) => 
                    renderField(subField, subValue, fieldLevel + 1)
                  )}
                </div>
              </div>
            );
          } else if (fieldData && typeof fieldData === 'object' && fieldData.status) {
            // Field with status, comment, question structure
            return (
              <div key={fieldName} className={`ml-${fieldLevel * 4} mb-3 p-3 bg-gray-50 rounded-lg`}>
                <div className="flex items-start justify-between mb-2">
                  <h5 className="text-sm font-medium text-gray-700 capitalize">
                    {fieldData.question || fieldName.replace('_', ' ')}
                  </h5>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(fieldData.status)}`}>
                    {fieldData.status}
                  </span>
                </div>
                {fieldData.comment && (
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-medium">Тайлбар:</span> {fieldData.comment}
                  </p>
                )}
              </div>
            );
          } else if (fieldName === 'inspector' && typeof fieldData === 'string' && fieldData.startsWith('data:image')) {
            // Signature image
            return (
              <div key={fieldName} className={`ml-${fieldLevel * 4} mb-3`}>
                <h5 className="text-sm font-medium text-gray-700 mb-2">Гарын үсэг:</h5>
                <img 
                  src={fieldData} 
                  alt="Гарын үсэг" 
                  className="max-w-xs border border-gray-300 rounded"
                />
              </div>
            );
          } else {
            // Simple field
            return (
              <div key={fieldName} className={`ml-${fieldLevel * 4} mb-2 flex items-center space-x-3`}>
                <span className="text-sm text-gray-500 w-40 capitalize">
                  {fieldName.replace('_', ' ')}:
                </span>
                <span className="text-sm text-gray-900">
                  {fieldData || 'Хариулт байхгүй'}
                </span>
              </div>
            );
          }
        };

        return (
          <div key={sectionName} className="border border-gray-200 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {sectionTitles[sectionName] || sectionName.replace('_', ' ')}
            </h3>
            
            {typeof sectionData === 'object' && sectionData !== null ? (
              <div className="space-y-3">
                {Object.entries(sectionData).map(([field, value]: [string, any]) => 
                  renderField(field, value, 0)
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-500 w-32">Хариулт:</span>
                <span className="text-sm text-gray-900">{sectionData}</span>
              </div>
            )}
          </div>
        );
      };
      
      return (
        <div className="space-y-6">
          {Object.entries(parsed).map(([sectionName, sectionData]: [string, any]) => 
            renderSection(sectionName, sectionData, 0)
          )}
        </div>
      );
    } catch (error) {
      console.error('Error rendering answers:', error);
      return (
        <div className="space-y-4">
          <p className="text-red-500">Хариултыг тайлбарлахад алдаа гарлаа</p>
          <details className="bg-gray-100 p-4 rounded">
            <summary className="cursor-pointer font-medium">Raw JSON өгөгдөл</summary>
            <pre className="mt-2 text-xs overflow-auto">
              {JSON.stringify(answers, null, 2)}
            </pre>
          </details>
        </div>
      );
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

  if (!answer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500">Үзлэгийн хариулт олдсонгүй</p>
          <button
            onClick={() => router.push('/inspection-answers')}
            className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Буцах
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Үзлэгийн хариулт</h1>
              <p className="text-gray-600">Үзлэгийн дэлгэрэнгүй мэдээлэл</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.fullName}</p>
                <p className="text-sm text-gray-500">{user?.organization.name}</p>
              </div>
              <button
                onClick={() => router.push('/inspection-answers')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Буцах
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-red-800">{error}</div>
            <button 
              onClick={loadInspectionAnswer}
              className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
            >
              Дахин ачаалах
            </button>
          </div>
        )}

        {/* Inspection Info */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md mb-6">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Үзлэгийн мэдээлэл
            </h3>
            {!answer.inspection && (
              <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-800">
                      Үзлэгийн мэдээлэл бүрэн олдсонгүй. Зөвхөн хариултын мэдээлэл харуулагдаж байна.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Үзлэгийн нэр</dt>
                <dd className="mt-1 text-sm text-gray-900">{answer.inspection?.title || 'Үзлэгийн нэр олдсонгүй'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Төрөл</dt>
                <dd className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(answer.inspection?.type || '')}`}>
                    {answer.inspection?.type || 'Төрөл тодорхойгүй'}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Төлөв</dt>
                <dd className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(answer.inspection?.status || '')}`}>
                    {answer.inspection?.status || 'Төлөв тодорхойгүй'}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Төхөөрөмж</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {answer.inspection?.device?.serialNumber ? 
                    `${answer.inspection.device.serialNumber} (${answer.inspection.device.assetTag || 'Asset tag олдсонгүй'})` : 
                    'Төхөөрөмжийн мэдээлэл олдсонгүй'
                  }
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Хариуцсан хүн</dt>
                <dd className="mt-1 text-sm text-gray-900">{answer.inspection?.assignee?.fullName || 'Хариуцсан хүн олдсонгүй'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Хариулсан хүн</dt>
                <dd className="mt-1 text-sm text-gray-900">{answer.user?.fullName}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Хариулсан огноо</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(answer.answeredAt).toLocaleDateString('mn-MN')} {new Date(answer.answeredAt).toLocaleTimeString('mn-MN')}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Үүсгэсэн огноо</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(answer.createdAt).toLocaleDateString('mn-MN')} {new Date(answer.createdAt).toLocaleTimeString('mn-MN')}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Answers */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Үзлэгийн хариултууд
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Үзлэгийн бүх хэсгийн хариултууд
            </p>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
            {renderAnswers(answer.answers)}
          </div>
        </div>
      </main>
    </div>
  );
}


