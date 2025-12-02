'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { authUtils } from '@/lib/auth';
import { apiService } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import TopNavbar from '@/components/TopNavbar';

interface Site {
  id: string;
  name: string;
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
  siteId?: string;
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
  siteId?: string;
}

export default function SiteDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.id as string;

  const [site, setSite] = useState<Site | null>(null);
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
  }, [siteId, router]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [sitesRes, inspectionsRes] = await Promise.all([
        apiService.sites.getAll(),
        apiService.inspections.getAll(),
      ]);

      const foundSite = (sitesRes.data || []).find((s: Site) => s.id === siteId);
      setSite(foundSite || null);

      if (!foundSite) {
        setIsLoading(false);
        return;
      }

      // Load devices for this organization
      const devicesRes = await apiService.devices.getByOrganization(foundSite.orgId);
      
      // Filter devices by site
      const allDevices = devicesRes?.data || [];
      const siteDevices = allDevices.filter((d: Device) => d?.siteId === siteId);
      setDevices(siteDevices);

      // Filter inspections by site
      const allInspections = inspectionsRes?.data || [];
      const siteInspections = allInspections.filter((insp: Inspection) => insp?.siteId === siteId);
      setInspections(siteInspections);

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

  if (!site) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar currentUser={authUtils.getUser()} />
        <div className="flex-1 ml-64 flex flex-col">
          <TopNavbar />
          <main className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-800">Талбай олдсонгүй</p>
              <button
                onClick={() => router.push('/sites')}
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
                  onClick={() => router.push('/sites')}
                  className="text-sm text-gray-500 hover:text-gray-700 mb-2"
                >
                  ← Талбайнууд руу буцах
                </button>
                <h1 className="text-xl font-bold text-gray-900">{site.name}</h1>
                {site.organization && (
                  <p className="text-sm text-gray-500">
                    Байгууллага: {site.organization.name} ({site.organization.code})
                  </p>
                )}
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

