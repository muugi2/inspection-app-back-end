'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { authUtils } from '@/lib/auth';
import { apiService } from '@/lib/api';
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
  orgId: string;
}

interface Contract {
  id: string;
  contractName: string;
  contractNumber: string;
  startDate: string;
  endDate: string;
  orgId: string;
}

interface Device {
  id: string;
  serialNumber: string;
  assetTag: string;
  status: string;
  siteId?: string;
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
  deviceId?: string;
  siteId?: string;
  contractId?: string;
}

export default function OrganizationDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.id as string;

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'sites' | 'contracts' | 'devices' | 'inspections'>('sites');

  useEffect(() => {
    if (!authUtils.isAuthenticated()) {
      router.push('/login');
      return;
    }
    loadData();
  }, [orgId, router]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [orgsRes, sitesRes, contractsRes, devicesRes, inspectionsRes] = await Promise.all([
        apiService.organizations.getAll(),
        apiService.sites.getByOrganization(orgId),
        apiService.contracts.getByOrganization(orgId),
        apiService.devices.getByOrganization(orgId),
        apiService.inspections.getAll(),
      ]);

      const org = (orgsRes?.data || []).find((o: Organization) => o?.id === orgId) || null;
      setOrganization(org);
      setSites(sitesRes.data || []);
      setContracts(contractsRes.data || []);
      setDevices(devicesRes.data || []);
      
      // Filter inspections by organization
      const allInspections = inspectionsRes.data || [];
      const siteIds = (sitesRes.data || []).map((s: Site) => s.id);
      const contractIds = (contractsRes.data || []).map((c: Contract) => c.id);
      const deviceIds = (devicesRes.data || []).map((d: Device) => d.id);
      
      const orgInspections = allInspections.filter((insp: Inspection) => {
        return siteIds.includes(insp.siteId || '') || 
               contractIds.includes(insp.contractId || '') || 
               deviceIds.includes(insp.deviceId || '');
      });
      setInspections(orgInspections);

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

  if (!organization) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar currentUser={authUtils.getUser()} />
        <div className="flex-1 ml-64 flex flex-col">
          <TopNavbar />
          <main className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-800">Байгууллага олдсонгүй</p>
              <button
                onClick={() => router.push('/organizations')}
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
                  onClick={() => router.push('/organizations')}
                  className="text-sm text-gray-500 hover:text-gray-700 mb-2"
                >
                  ← Байгууллагууд руу буцах
                </button>
                <h1 className="text-xl font-bold text-gray-900">{organization.name}</h1>
                <p className="text-sm text-gray-500">Код: {organization.code}</p>
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
                onClick={() => setActiveTab('sites')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'sites'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Талбай ({sites.length})
              </button>
              <button
                onClick={() => setActiveTab('contracts')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'contracts'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Гэрээ ({contracts.length})
              </button>
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
            {activeTab === 'sites' && (
              <div>
                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Талбайнууд</h3>
                </div>
                {sites.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">Талбай олдсонгүй</p>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Талбайн нэр</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Үйлдэл</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sites.map((site) => (
                        <tr key={site.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{site.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => router.push(`/site-details/${site.id}`)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              Дэлгэрэнгүй →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === 'contracts' && (
              <div>
                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Гэрээнүүд</h3>
                </div>
                {contracts.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">Гэрээ олдсонгүй</p>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Гэрээний нэр</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дугаар</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Хугацаа</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Үйлдэл</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {contracts.map((contract) => (
                        <tr key={contract.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{contract.contractName}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {contract.contractNumber}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(contract.startDate).toLocaleDateString('mn-MN')} - {new Date(contract.endDate).toLocaleDateString('mn-MN')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => router.push(`/contract-details/${contract.id}`)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              Дэлгэрэнгүй →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

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

