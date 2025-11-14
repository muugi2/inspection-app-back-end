'use client';

import fileDownload from 'js-file-download';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { authUtils, User } from '@/lib/auth';
import { apiService } from '@/lib/api';

interface FieldValue {
  status: string;
  comment: string;
  question: string;
}

interface PreviewResponse {
  data: {
    inspection: {
      id: string;
      title: string;
      status: string;
      type: string;
    };
    answer: {
      id: string;
      answeredAt: string | null;
    } | null;
    d: {
      contractor: {
        company: string;
        contract_no: string;
        contact: string;
      };
      metadata: {
        date: string;
        inspector: string;
        location: string;
        scale_id_serial_no: string;
        model: string;
      };
      exterior: Record<string, FieldValue>;
      indicator: Record<string, FieldValue>;
      jbox: Record<string, FieldValue>;
      sensor: Record<string, FieldValue>;
      foundation: Record<string, FieldValue>;
      cleanliness: Record<string, FieldValue>;
      remarks: string;
      signatures: {
        inspector?:
          | {
              data: string;
              mimeType: string;
            }
          | null;
      };
    };
  };
}

interface RowDefinition {
  label: string;
  path: string;
}

const exteriorRows: RowDefinition[] = [
  { label: 'Мэдрэгчийн суурь', path: 'exterior.sensor_base' },
  { label: 'Дам нуруу', path: 'exterior.beam' },
  { label: 'Тавцангийн лист', path: 'exterior.platform_plate' },
  { label: 'Дам нуруу холбосон лист', path: 'exterior.beam_joint_plate' },
  { label: 'Хязгаарлагчийн боолт', path: 'exterior.stop_bolt' },
  { label: 'Тавцан хоорондын боолт', path: 'exterior.interplatform_bolts' },
];

const indicatorRows: RowDefinition[] = [
  { label: 'Лед дэлгэц', path: 'indicator.led_display' },
  { label: 'Тэжээлийн залгуур', path: 'indicator.power_plug' },
  { label: 'Лац болон лацны боолт', path: 'indicator.seal_and_bolt' },
  { label: 'Товчлуур', path: 'indicator.buttons' },
  {
    label: 'Холбогч хайрцаг болон сигналын утас',
    path: 'indicator.junction_wiring',
  },
  {
    label: 'Сериал хөрвүүлэгч залгуур',
    path: 'indicator.serial_converter_plug',
  },
];

const jboxRows: RowDefinition[] = [
  {
    label: 'Хайрцагны бүрэн бүтэн байдал',
    path: 'jbox.box_integrity',
  },
  {
    label: 'Сигналын утас цуглуулагч хавтан',
    path: 'jbox.collector_board',
  },
  { label: 'Сигналын утас чангалагч', path: 'jbox.wire_tightener' },
  { label: 'Эсэргүүцлийн элемент', path: 'jbox.resistor_element' },
  {
    label: 'Холбогч хайрцагны хамгаалалтын хайрцаг',
    path: 'jbox.protective_box',
  },
];

const sensorRows: RowDefinition[] = [
  { label: 'Сигналын утас', path: 'sensor.signal_wire' },
  { label: 'Шаариг', path: 'sensor.ball' },
  { label: 'Мэдрэгчийн суурь', path: 'sensor.base' },
  { label: 'Шааригны аяган суурь /нимгэн/', path: 'sensor.ball_cup_thin' },
  { label: 'Ялтсан хавтан', path: 'sensor.plate' },
];

const foundationRows: RowDefinition[] = [
  { label: 'Хөндлөн суурь', path: 'foundation.cross_base' },
  { label: 'Суурийн анкер лист', path: 'foundation.anchor_plate' },
  { label: 'Пандусын угольник', path: 'foundation.ramp_angle' },
  { label: 'Пандусын өшиглүүр', path: 'foundation.ramp_stopper' },
  { label: 'Пандус', path: 'foundation.ramp' },
  { label: 'Нил суурь', path: 'foundation.slab_base' },
];

const cleanlinessRows: RowDefinition[] = [
  { label: 'Тавцангийн доод тал', path: 'cleanliness.under_platform' },
  { label: 'Тавцангийн дээд тал', path: 'cleanliness.top_platform' },
  {
    label: 'Тавцан болон Пандус хоорондын завсар',
    path: 'cleanliness.gap_platform_ramp',
  },
  { label: 'Автожингийн 2 талын талбай', path: 'cleanliness.both_sides_area' },
];

function classNameForStatus(status: string) {
  if (!status) return 'bg-gray-100 text-gray-700';
  const normalized = status.toLowerCase();
  if (normalized.includes('солих') || normalized.includes('шаардлагатай')) {
    return 'bg-red-100 text-red-700';
  }
  if (
    normalized.includes('зүгээр') ||
    normalized.includes('бүтэн') ||
    normalized.includes('цэвэр')
  ) {
    return 'bg-green-100 text-green-700';
  }
  return 'bg-yellow-100 text-yellow-700';
}

function getField(data: PreviewResponse['data']['d'], path: string): FieldValue {
  const segments = path.split('.');
  let current: any = data;
  for (const segment of segments) {
    if (current && segment in current) {
      current = current[segment];
    } else {
      return { status: '', comment: '', question: '' };
    }
  }

  return {
    status: current.status || '',
    comment: current.comment || '',
    question: current.question || '',
  };
}

function toSignatureSrc(
  signature:
    | {
        data: string;
        mimeType: string;
      }
    | null
    | undefined
) {
  if (!signature?.data || !signature.mimeType) {
    return null;
  }
  return `data:${signature.mimeType};base64,${signature.data}`;
}

function TableSection({
  title,
  rows,
  data,
}: {
  title: string;
  rows: RowDefinition[];
  data: PreviewResponse['data']['d'];
}) {
  return (
    <section className="px-8 py-6">
      <h3 className="font-semibold text-lg uppercase tracking-wide mb-4">
        {title}
      </h3>
      <table className="w-full text-sm border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="w-12 border border-gray-300 px-2 py-2 text-center">
              №
            </th>
            <th className="w-64 border border-gray-300 px-3 py-2 text-left">
              Үзлэгийн эд анги
            </th>
            <th className="w-36 border border-gray-300 px-3 py-2 text-left">
              Төлөв
            </th>
            <th className="border border-gray-300 px-3 py-2 text-left">
              Тайлбар
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const field = getField(data, row.path);
            return (
              <tr key={row.path} className="align-top">
                <td className="border border-gray-300 px-2 py-2 text-center font-medium">
                  {index + 1}
                </td>
                <td className="border border-gray-300 px-3 py-2">
                  {row.label}
                </td>
                <td className="border border-gray-300 px-3 py-2">
                  <span
                    className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${classNameForStatus(
                      field.status
                    )}`}
                  >
                    {field.status || '—'}
                  </span>
                </td>
                <td className="border border-gray-300 px-3 py-2 whitespace-pre-line">
                  {field.comment || '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export default function InspectionDocxPreviewPage() {
  const params = useParams<{ inspectionId: string }>();
  const router = useRouter();
  const answerId = params?.inspectionId;

  const [user, setUser] = useState<User | null>(null);
  const [preview, setPreview] = useState<PreviewResponse['data'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authUtils.isAuthenticated()) {
      setUser(authUtils.getUser());
    } else {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    const fetchPreview = async () => {
      if (!answerId) return;
      try {
        setIsLoading(true);
        setError(null);
        const response: PreviewResponse = await apiService.reports.getAnswerPreview(
          answerId
        );
        setPreview(response.data);
      } catch (err: any) {
        console.error('Failed to load report preview:', err);
        setError(
          err?.response?.data?.message ||
            'Тайлангийн мэдээлэл ачаалахад алдаа гарлаа.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreview();
  }, [answerId]);

  const signatureSrc = useMemo(
    () => toSignatureSrc(preview?.d.signatures?.inspector || null),
    [preview]
  );

  const handleDownloadDocx = async () => {
    if (!answerId) return;
    try {
      const blob = await apiService.reports.downloadAnswerDocx(answerId);
      fileDownload(blob, `inspection-answer-${answerId}.docx`);
    } catch (err) {
      console.error('Failed to download docx:', err);
      setError(
        'DOCX тайлан татах явцад алдаа гарлаа. Дахин оролдоно уу.'
      );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-20 w-20 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Тайланг ачаалж байна...</p>
        </div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar currentUser={user} />
        <div className="flex-1 ml-64 flex items-center justify-center p-6">
          <div className="bg-white border border-dashed border-gray-300 rounded-lg px-8 py-12 text-center max-w-lg">
            <h1 className="text-xl font-semibold text-gray-900 mb-3">
              Тайлангийн мэдээлэл олдсонгүй
            </h1>
            <p className="text-sm text-gray-600">
              Үзлэгийн ID зөв эсэхийг шалгаад дахин оролдоно уу.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-200 flex">
      <Sidebar currentUser={user} />
      <div className="flex-1 ml-64 p-6 flex flex-col items-center gap-6">
        {error && (
          <div className="w-full max-w-4xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        <div className="w-full max-w-4xl flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Үзлэгийн тайлангийн A4 preview
            </h1>
          <p className="text-sm text-gray-600">
            Үзлэгийн хариултын ID: {preview.answer?.id || answerId} • Үзлэг ID: {preview.inspection.id} •{' '}
            {preview.inspection.title || 'Гарчиггүй'}
            </p>
          </div>
          <button
            onClick={handleDownloadDocx}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            <span>DOCX татах</span>
          </button>
        </div>

        <div className="bg-white shadow-xl border border-gray-300 w-[794px] min-h-[1123px] print:w-full">
          <header className="px-8 py-6 border-b border-gray-300 text-center">
            <p className="uppercase text-sm text-gray-500 tracking-[0.4em]">
              Exterior
            </p>
            <h2 className="text-2xl font-bold text-gray-900 mt-2">
              АВТО ЖИН ХЭМЖҮҮРИЙН ҮЗЛЭГИЙН ХУУДАС
            </h2>
          </header>

          <section className="px-8 py-6 grid grid-cols-2 gap-6 border-b border-gray-200">
            <div>
              <h3 className="font-semibold text-lg uppercase tracking-wide mb-3">
                Гэрээний мэдээлэл
              </h3>
              <table className="w-full text-sm border border-gray-300">
                <tbody>
                  <tr>
                    <td className="bg-gray-100 border border-gray-300 px-3 py-2 font-medium">
                      Гэрээт компанийн нэр
                    </td>
                    <td className="border border-gray-300 px-3 py-2">
                      {preview.d.contractor.company || '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="bg-gray-100 border border-gray-300 px-3 py-2 font-medium">
                      Гэрээний дугаар
                    </td>
                    <td className="border border-gray-300 px-3 py-2">
                      {preview.d.contractor.contract_no || '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="bg-gray-100 border border-gray-300 px-3 py-2 font-medium">
                      Холбоо барих
                    </td>
                    <td className="border border-gray-300 px-3 py-2">
                      {preview.d.contractor.contact || '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="font-semibold text-lg uppercase tracking-wide mb-3">
                Ерөнхий мэдээлэл
              </h3>
              <table className="w-full text-sm border border-gray-300">
                <tbody>
                  <tr>
                    <td className="bg-gray-100 border border-gray-300 px-3 py-2 font-medium">
                      Огноо
                    </td>
                    <td className="border border-gray-300 px-3 py-2">
                      {preview.d.metadata.date || '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="bg-gray-100 border border-gray-300 px-3 py-2 font-medium">
                      Шалгагч
                    </td>
                    <td className="border border-gray-300 px-3 py-2">
                      {preview.d.metadata.inspector || '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="bg-gray-100 border border-gray-300 px-3 py-2 font-medium">
                      Байршил
                    </td>
                    <td className="border border-gray-300 px-3 py-2">
                      {preview.d.metadata.location || '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="bg-gray-100 border border-gray-300 px-3 py-2 font-medium">
                      Автожингийн дугаар
                    </td>
                    <td className="border border-gray-300 px-3 py-2">
                      {preview.d.metadata.scale_id_serial_no || '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="bg-gray-100 border border-gray-300 px-3 py-2 font-medium">
                      Модель
                    </td>
                    <td className="border border-gray-300 px-3 py-2">
                      {preview.d.metadata.model || '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <TableSection title="Автожингийн тавцан" rows={exteriorRows} data={preview.d} />
          <TableSection title="Тооцоолуур" rows={indicatorRows} data={preview.d} />
          <TableSection title="Автожингийн холбогч хайрцаг" rows={jboxRows} data={preview.d} />
          <TableSection title="Мэдрэгч элемент" rows={sensorRows} data={preview.d} />
          <TableSection title="Суурь" rows={foundationRows} data={preview.d} />
          <TableSection title="Автожингийн бохирдол" rows={cleanlinessRows} data={preview.d} />

          <section className="px-8 py-6 border-t border-gray-200">
            <h3 className="font-semibold text-lg uppercase tracking-wide mb-3">
              Санал, тэмдэглэл
            </h3>
            <div className="border border-gray-300 px-4 py-3 min-h-[120px] text-sm whitespace-pre-line">
              {preview.d.remarks || '—'}
            </div>
          </section>

          <section className="px-8 py-6 border-t border-gray-200">
            <h3 className="font-semibold text-lg uppercase tracking-wide mb-4">
              Гарын үсэг
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="border border-gray-300 px-4 py-4 min-h-[140px] flex flex-col justify-between">
                <p className="text-sm font-medium text-gray-700 mb-4">
                  Үзлэг хийсэн хүний гарын үсэг
                </p>
                {signatureSrc ? (
                  <img
                    src={signatureSrc}
                    alt="Inspector Signature"
                    className="h-20 object-contain"
                  />
                ) : (
                  <div className="h-20 flex items-center justify-center text-xs text-gray-400">
                    Гарын үсэг ирээгүй
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-4">
                  Нэр: {preview.d.metadata.inspector || '—'}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

