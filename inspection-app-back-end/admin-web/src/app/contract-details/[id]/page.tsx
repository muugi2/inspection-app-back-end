'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { authUtils } from '@/lib/auth';
import { apiService } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import TopNavbar from '@/components/TopNavbar';

interface Contract {
  id: string;
  contractName: string;
  contractNumber: string;
  startDate: string;
  endDate: string;
  orgId: string;
  organization?: {
    id: string;
    name: string;
    code: string;
  };
}

interface Device {
  id: string;
  serialNumber: string;
  assetTag: string;
  status: string;
  contractId?: string;
  model?: {
    manufacturer: string;
    model: string;
  };
}

interface Inspection {
  id: string;
  title: string;
  type: string;
  status: string;
  scheduledAt: string;
  contractId?: string;
}

export default function ContractDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const contractId = params.id as string;

  const [contract, setContract] = useState<Contract | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'devices' | 'inspections'>('devices');

  useEffect(() => {
    if (!authUtils.isAuthenticated()) {
      router.push('/login');
      return;
    }
    loadData();
  }, [contractId, router]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [contractsRes, inspectionsRes] = await Promise.all([
        apiService.contracts.getAll(),
        apiService.inspections.getAll(),
      ]);

      const foundContract = (contractsRes?.data || []).find((c: Contract) => c?.id === contractId) || null;
      setContract(foundContract);

      if (!foundContract) {
        setIsLoading(false);
        return;
      }

      // Load devices for this organization
      const devicesRes = await apiService.devices.getByOrganization(foundContract.orgId);
      
      // Filter devices by contract
      const allDevices = devicesRes.data || [];
      const contractDevices = allDevices.filter((d: Device) => d.contractId === contractId);
      setDevices(contractDevices);

      // Filter inspections by contract
      const allInspections = inspectionsRes.data || [];
      const contractInspections = allInspections.filter((insp: Inspection) => insp.contractId === contractId);
      setInspections(contractInspections);

      setError('');
    } catch (err: any) {
      console.error('Failed to load data:', err);
      setError('Өгөгдөл ачаалахад алдаа гарлаа');
    } finally {
      setIsLoading(false);
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

  if (!contract) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar currentUser={authUtils.getUser()} />
        <div className="flex-1 ml-64 flex flex-col">
          <TopNavbar />
          <main className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-800">Гэрээ олдсонгүй</p>
              <button
                onClick={() => router.push('/contracts')}
                className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
              >
                Буцах
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar currentUser={authUtils.getUser()} />

      <div className="flex-1 ml-64 flex flex-col">
        <TopNavbar />
        <header className="bg-white shadow-sm">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <button
                  onClick={() => router.push('/contracts')}
                  className="text-sm text-gray-500 hover:text-gray-700 mb-2"
                >
                  ← Гэрээнүүд руу буцах
                </button>
                <h1 className="text-xl font-bold text-gray-900">{contract.contractName}</h1>
                <p className="text-sm text-gray-500">
                  Дугаар: {contract.contractNumber} | 
                  {contract.organization && ` Байгууллага: ${contract.organization.name} (${contract.organization.code})`}
                </p>
                <p className="text-sm text-gray-500">
                  Хугацаа: {new Date(contract.startDate).toLocaleDateString('mn-MN')} - {new Date(contract.endDate).toLocaleDateString('mn-MN')}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6 flex-1">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="text-red-800">{error}</div>
            </div>
          )}

          {/* Tabs */}
          <div className="mb-6 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('devices')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'devices'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Төхөөрөмж ({devices.length})
              </button>
              <button
                onClick={() => setActiveTab('inspections')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'inspections'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Үзлэг ({inspections.length})
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            {activeTab === 'devices' && (
              <div>
                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Төхөөрөмжүүд</h3>
                </div>
                {devices.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">Төхөөрөмж олдсонгүй</p>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Серийн дугаар</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asset Tag</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Загвар</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Төлөв</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {devices.map((device) => (
                        <tr key={device.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{device.serialNumber}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{device.assetTag}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {device.model ? `${device.model.manufacturer} ${device.model.model}` : '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {device.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === 'inspections' && (
              <div>
                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Үзлэгүүд</h3>
                </div>
                {inspections.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">Үзлэг олдсонгүй</p>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Гарчиг</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Төрөл</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Төлөв</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Төлөвлөсөн огноо</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {inspections.map((inspection) => (
                        <tr key={inspection.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{inspection.title}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {inspection.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {inspection.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {inspection.scheduledAt ? new Date(inspection.scheduledAt).toLocaleDateString('mn-MN') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

