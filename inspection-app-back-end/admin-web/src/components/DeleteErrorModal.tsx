'use client';

interface DeleteErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  errorData: {
    message: string;
    relatedRecords?: {
      users?: { total: number; items: any[] };
      sites?: { total: number; items: any[] };
      contracts?: { total: number; items: any[] };
      devices?: { total: number; items: any[] };
    };
    devices?: { total: number; items: any[] };
    inspections?: { total: number; items: any[] };
  };
}

export default function DeleteErrorModal({ isOpen, onClose, errorData }: DeleteErrorModalProps) {
  if (!isOpen) return null;

  const renderRecords = (title: string, records: { total: number; items: any[] }, renderItem: (item: any) => string) => {
    if (!records || records.total === 0) return null;

    return (
      <div className="mb-4">
        <h4 className="font-semibold text-gray-900 mb-2">
          {title} <span className="text-red-600">(Нийт: {records.total})</span>
        </h4>
        <div className="bg-gray-50 rounded-md p-3 max-h-48 overflow-y-auto">
          <ul className="space-y-1 text-sm text-gray-700">
            {records.items.map((item, index) => (
              <li key={index} className="flex items-start">
                <span className="text-gray-400 mr-2">•</span>
                <span>{renderItem(item)}</span>
              </li>
            ))}
            {records.total > records.items.length && (
              <li className="text-gray-500 italic">
                ...болон {records.total - records.items.length} бусад
              </li>
            )}
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed z-50 inset-0 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        ></div>

        <div className="relative bg-white rounded-lg text-left overflow-hidden shadow-2xl transform transition-all max-w-2xl w-full mx-auto my-8 z-50">
          <div className="bg-white px-6 pt-6 pb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-red-600">
                ⚠️ Устгах боломжгүй
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>

            <div className="mb-4">
              <p className="text-gray-700 whitespace-pre-line">{errorData.message}</p>
            </div>

            {(errorData.relatedRecords || errorData.devices || errorData.inspections) && (
              <div className="border-t border-gray-200 pt-4 max-h-96 overflow-y-auto">
                {errorData.relatedRecords && (
                  <>
                    {errorData.relatedRecords.users && errorData.relatedRecords.users.total > 0 && renderRecords(
                      '📋 Хэрэглэгчид',
                      errorData.relatedRecords.users,
                      (item) => `${item.fullName} (${item.email})`
                    )}
                    {errorData.relatedRecords.sites && errorData.relatedRecords.sites.total > 0 && renderRecords(
                      '📍 Талбайнууд',
                      errorData.relatedRecords.sites,
                      (item) => item.name
                    )}
                    {errorData.relatedRecords.contracts && errorData.relatedRecords.contracts.total > 0 && renderRecords(
                      '📄 Гэрээнүүд',
                      errorData.relatedRecords.contracts,
                      (item) => `${item.contractNumber} - ${item.contractName}`
                    )}
                    {errorData.relatedRecords.devices && errorData.relatedRecords.devices.total > 0 && renderRecords(
                      '🔧 Төхөөрөмжүүд',
                      errorData.relatedRecords.devices,
                      (item) => `${item.serialNumber} (${item.assetTag})`
                    )}
                  </>
                )}

                {errorData.devices && errorData.devices.total > 0 && renderRecords(
                  '🔧 Төхөөрөмжүүд',
                  errorData.devices,
                  (item) => {
                    const parts = [item.serialNumber, item.assetTag];
                    if (item.model) parts.push(`- ${item.model}`);
                    if (item.site) parts.push(`(${item.site})`);
                    if (item.organization) parts.push(`- ${item.organization}`);
                    return parts.filter(Boolean).join(' ');
                  }
                )}

                {errorData.inspections && errorData.inspections.total > 0 && renderRecords(
                  '🔍 Үзлэгүүд',
                  errorData.inspections,
                  (item) => `${item.title} (${item.status}) - ${item.type || ''}`
                )}
              </div>
            )}
          </div>

          <div className="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Ойлголоо
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

