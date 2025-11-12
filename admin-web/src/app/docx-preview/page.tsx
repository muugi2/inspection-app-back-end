"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from 'next/navigation';

import Sidebar from '@/components/Sidebar';
import { apiService } from '@/lib/api';
import { authUtils, User } from '@/lib/auth';

import './docx-preview.css';

interface InspectionAnswerSummary {
  id: string;
  inspectionId: string;
  answeredAt?: string;
  inspection?: {
    title?: string;
  };
}

interface SectionImage {
  id: string | null;
  order: number | null;
  mimeType: string | null;
  base64: string | null;
  dataUri: string | null;
  fieldLabel: string;
  sectionLabel: string;
}

type SectionImagesMap = Record<string, Record<string, SectionImage[]>>;

interface DocxDataResponse {
  message: string;
  data: {
    answer: {
      id: string;
      inspectionId: string;
      answeredAt?: string;
      createdAt?: string;
      updatedAt?: string;
    };
    metadata: Record<string, any>;
    remarks?: string;
    signature?: any;
    sections: Array<{
      key: string;
      label: string;
      fields: Array<{
        fieldId: string;
        fieldLabel: string;
        status: string;
        comment: string;
      question?: string;
      }>;
    }>;
    images: SectionImagesMap;
    contractor: {
      company?: string;
      contract_no?: string;
      contact?: string;
    };
    rawAnswers: Record<string, any>;
  };
}

interface SignaturePayload {
  data: string;
  mimeType: string;
  width?: number;
  height?: number;
}

const DEFAULT_IMAGE_WIDTH = 200;
const DEFAULT_IMAGE_HEIGHT = 80;

interface SectionDisplayField {
  fieldId: string;
  fieldLabel: string;
  status: string;
  comment: string;
  images: Array<{ data: string; mimeType: string; dataUri?: string | null }>;
}

interface SectionDisplayGroup {
  sectionKey: string;
  sectionLabel: string;
  fields: SectionDisplayField[];
}

function formatKeyToLabel(key: string) {
  if (!key) return '';

  return key
    .replace(/[_\-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function extractBase64FromDataUri(dataUri?: string | null) {
  if (!dataUri || typeof dataUri !== 'string') return '';
  const parts = dataUri.split(',');
  return parts.length === 2 ? parts[1] : '';
}

function extractMimeFromDataUri(dataUri?: string | null) {
  if (!dataUri || typeof dataUri !== 'string') return null;
  const match = dataUri.match(/data:(.*?);base64/);
  return match ? match[1] : null;
}

function sanitizeBase64(value?: string | null) {
  if (!value) return '';
  return value.replace(/[\r\n\s]+/g, '').trim();
}

function isHttpUrl(value?: string | null) {
  if (!value) return false;
  return /^https?:\/\//i.test(value);
}

function buildDisplayImages(imageList: SectionImage[] = []) {
  return imageList
    .map((img) => {
      const sourceMime = img.mimeType || extractMimeFromDataUri(img.dataUri) || 'image/png';
      const base64FromSource = sanitizeBase64(img.base64);
      const base64FromUri = sanitizeBase64(extractBase64FromDataUri(img.dataUri));
      const base64Data = base64FromSource || base64FromUri;

      const dataUri = isHttpUrl(img.dataUri)
        ? img.dataUri
        : base64Data
          ? `data:${sourceMime};base64,${base64Data}`
          : img.dataUri && img.dataUri.startsWith('data:')
            ? img.dataUri
            : null;

      if (!base64Data && !dataUri) {
        return null;
      }

      return {
        data: base64Data,
        mimeType: sourceMime,
        dataUri,
        order: img.order ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .filter((img): img is { data: string; mimeType: string; dataUri: string; order: number } => !!img)
    .sort((a, b) => a.order - b.order)
    .map(({ data, mimeType, dataUri }) => ({ data, mimeType, dataUri }));
}

function extractSignature(data: any): SignaturePayload | null {
  if (!data) return null;

  const possibleValue =
    data?.signature_field?.signatureImage ||
    data?.signature?.signatureImage ||
    data?.signatureImage ||
    null;

  if (!possibleValue || typeof possibleValue !== 'string') {
    return null;
  }

  if (!possibleValue.startsWith('data:')) {
    return {
      data: possibleValue,
      mimeType: 'image/png',
      width: DEFAULT_IMAGE_WIDTH,
      height: DEFAULT_IMAGE_HEIGHT,
    };
  }

  const [meta, base64] = possibleValue.split(',');
  const mimeMatch = meta.match(/data:(.*);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

  return {
    data: base64,
    mimeType,
    width: DEFAULT_IMAGE_WIDTH,
    height: DEFAULT_IMAGE_HEIGHT,
  };
}

function ensureFieldObject(sectionKey: string, fieldKey: string, value: any) {
  if (value && typeof value === 'object') {
    return {
      status: value.status ?? '',
      comment: value.comment ?? '',
      question: value.question ?? formatKeyToLabel(fieldKey),
    };
  }
  return {
    status: '',
    comment: '',
    question: formatKeyToLabel(fieldKey),
  };
}

function normalizeAnswers(rawAnswers: Record<string, any> = {}) {
  const normalized = { ...rawAnswers };

  if (normalized.indicator) {
    const indicator = { ...normalized.indicator };
    if (!indicator.seal_and_bolt && indicator.seal_bolt) {
      indicator.seal_and_bolt = indicator.seal_bolt;
    }
    if (!indicator.serial_converter_plug && indicator.serial_converter) {
      indicator.serial_converter_plug = indicator.serial_converter;
    }
    normalized.indicator = indicator;
  }

  if (!normalized.metadata && rawAnswers.data?.metadata) {
    normalized.metadata = rawAnswers.data.metadata;
  }

  return normalized;
}

function buildDocxTemplateData(response: DocxDataResponse['data']) {
  const normalizedAnswers = normalizeAnswers(response.rawAnswers);
  const metadata = {
    ...(normalizedAnswers.metadata || {}),
    ...response.metadata,
  };

  const signaturePayload =
    extractSignature(response.signature) || extractSignature(normalizedAnswers.signature) || null;

  const sectionKeys = Object.keys(normalizedAnswers || {}).filter((key) => {
    const normalizedKey = key.toLowerCase();
    return !['metadata', 'signature', 'signatures', 'remarks'].includes(normalizedKey);
  });

  const sections = sectionKeys
    .map((sectionKey) => {
      const sectionAnswers = normalizedAnswers[sectionKey] || {};
      const imageGroup = (response.images || {})[sectionKey] || {};

      const fieldEntries = Object.entries(sectionAnswers).filter(
        ([, value]) => value && typeof value === 'object'
      );

      const fields = fieldEntries.map(([fieldId, fieldValue]) => {
        const fieldData = ensureFieldObject(sectionKey, fieldId, fieldValue);
        const images = buildDisplayImages(imageGroup[fieldId] || []);

        return {
          fieldId,
          fieldLabel: fieldData.question || formatKeyToLabel(fieldId),
          status: fieldData.status || '',
          comment: fieldData.comment || '',
          images,
        };
      });

      const presentFieldIds = new Set(fields.map((field) => field.fieldId));

      Object.entries(imageGroup).forEach(([fieldId, imageList]) => {
        if (presentFieldIds.has(fieldId)) return;
        const images = buildDisplayImages(imageList || []);

        if (images.length > 0) {
          fields.push({
            fieldId,
            fieldLabel: formatKeyToLabel(fieldId),
            status: '',
            comment: '',
            images,
          });
        }
      });

      if (fields.length === 0) {
        return null;
      }

      const matchingSection = (response.sections || []).find((section) => section.key === sectionKey);

      return {
        sectionKey,
        sectionLabel: matchingSection?.label || formatKeyToLabel(sectionKey),
        fields,
      };
    })
    .filter(Boolean) as SectionDisplayGroup[];

  const templateData = {
    d: {
      contractor: {
        company: response.contractor?.company || '',
        contract_no: response.contractor?.contract_no || '',
        contact: response.contractor?.contact || '',
      },
      metadata,
      sections,
      remarks: response.remarks || normalizedAnswers.remarks || '',
      signatures: {
        inspector: signaturePayload,
      },
    },
  };

  return {
    templateData,
    sections,
    signaturePayload,
  };
}

export default function DocxPreviewPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [answers, setAnswers] = useState<InspectionAnswerSummary[]>([]);
  const [selectedAnswerId, setSelectedAnswerId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string>('');
  const [renderError, setRenderError] = useState<string>('');
  const [sectionsData, setSectionsData] = useState<SectionDisplayGroup[]>([]);
  const [downloadUrl, setDownloadUrl] = useState<string>('');
  const [docxLayoutData, setDocxLayoutData] = useState<DocxDataResponse['data'] | null>(null);
  const [signatureForLayout, setSignatureForLayout] = useState<SignaturePayload | null>(null);
  const downloadUrlRef = useRef<string>('');

  const formatRowValue = (value?: string | null) => {
    if (value === undefined || value === null) return '—';
    const trimmed = String(value).trim();
    return trimmed.length > 0 ? trimmed : '—';
  };

  const metadataForLayout = docxLayoutData?.metadata || {};
  const contractorRows =
    docxLayoutData?.contractor
      ? [
          { label: 'Гэрээт компанийн нэр', value: formatRowValue(docxLayoutData.contractor?.company) },
          { label: 'Гэрээний дугаар', value: formatRowValue(docxLayoutData.contractor?.contract_no) },
          { label: 'Холбоо барих', value: formatRowValue(docxLayoutData.contractor?.contact) },
        ].filter((row) => row.value !== '—')
      : [];

  const generalRows = docxLayoutData
    ? [
        { label: 'Огноо', value: formatRowValue(metadataForLayout.date) },
        { label: 'Шалгагч', value: formatRowValue(metadataForLayout.inspector) },
        { label: 'Байршил', value: formatRowValue(metadataForLayout.location) },
        {
          label: 'Авто жингийн дугаар',
          value: formatRowValue(metadataForLayout.scale_id_serial_no || metadataForLayout.serialNumber),
        },
        { label: 'Модель', value: formatRowValue(metadataForLayout.model) },
      ].filter((row) => row.value !== '—')
    : [];

  useEffect(() => {
    if (!authUtils.isAuthenticated()) {
      router.push('/login');
      return;
    }

    const currentUser = authUtils.getUser();
    if (currentUser) {
      setUser(currentUser);
    }

    const initialize = async () => {
      try {
        setIsLoading(true);
        const response = await apiService.inspectionAnswers.getAll({ page: 1, limit: 100 });
        const data = response.data || response || [];
        setAnswers(data);

        if (data.length > 0) {
          setSelectedAnswerId(String(data[0].id));
        }
      } catch (err: any) {
        console.error('Failed to load inspection answers:', err);
        setError('Үзлэгийн хариултуудыг ачаалахад алдаа гарлаа');
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [router]);

  useEffect(() => {
    const loadDocxData = async () => {
      if (!selectedAnswerId) return;

      try {
        setIsRendering(true);
        setRenderError('');

        const [docxDataResponse, docxBlob] = await Promise.all([
          apiService.inspectionAnswers.getDocxData(selectedAnswerId),
          apiService.documents.generateDocument(selectedAnswerId),
        ]);

        const docxData: DocxDataResponse = docxDataResponse;
        const { templateData, sections: structuredSections, signaturePayload } = buildDocxTemplateData(docxData.data);

        const objectUrl = URL.createObjectURL(docxBlob);
        if (downloadUrlRef.current) {
          URL.revokeObjectURL(downloadUrlRef.current);
        }
        downloadUrlRef.current = objectUrl;
        setDownloadUrl(objectUrl);

        setDocxLayoutData(docxData.data);
        setSectionsData(structuredSections);
        setSignatureForLayout(signaturePayload);
      } catch (err: any) {
        console.error('Failed to load docx preview:', err);
        setRenderError('DOCX файлыг ачаалахад алдаа гарлаа. Дахин оролдоно уу.');
      } finally {
        setIsRendering(false);
      }
    };

    loadDocxData();

    return () => {
      if (downloadUrlRef.current) {
        URL.revokeObjectURL(downloadUrlRef.current);
        downloadUrlRef.current = '';
      }
    };
  }, [selectedAnswerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAnswerChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedAnswerId(event.target.value);
  };

  const getAnswerLabel = (answer: InspectionAnswerSummary) => {
    const inspectionLabel = answer.inspection?.title ? ` - ${answer.inspection.title}` : '';
    return `ID: ${answer.id}${inspectionLabel}`;
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-600 text-sm">Ачаалж байна...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar currentUser={user} />
      <main className="ml-64 flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">DOCX Preview</h1>
              <p className="text-sm text-gray-500 mt-1">
                Node.js docx сан ашиглан A4 хэлбэртэй урьдчилсан харагдац.
              </p>
            </div>
            {downloadUrl && (
              <a
                href={downloadUrl}
                download={`inspection-${selectedAnswerId}.docx`}
                className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                DOCX татах
              </a>
            )}
          </div>

          <div className="mt-6 bg-white rounded-lg shadow p-4">
            <label htmlFor="answer-select" className="block text-sm font-medium text-gray-700">
              Үзлэгийн хариулт сонгох
            </label>
            <select
              id="answer-select"
              value={selectedAnswerId}
              onChange={handleAnswerChange}
              className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
            >
              {answers.map((answer) => (
                <option key={answer.id} value={answer.id}>
                  {getAnswerLabel(answer)}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-8">
            {renderError && <p className="text-sm text-red-600 mb-4">{renderError}</p>}
            {isRendering && (
              <div className="flex h-32 items-center justify-center text-sm text-gray-500">
                DOCX боловсруулж байна...
              </div>
            )}
            {!isRendering && docxLayoutData && (
              <div className="docx-a4-container">
                <div className="docx-a4">
                  <div className="docx-hero">
                    <div className="docx-hero-logo">AS</div>
                    <p className="docx-hero-title">АВТО ЖИН ХЭМЖҮҮРИЙН ҮЗЛЭГИЙН ХУУДАС</p>
                  </div>

                  <div className="docx-info-grid">
                    {contractorRows.length > 0 && (
                      <section className="docx-card">
                        <h3 className="docx-section-title">Гэрээний мэдээлэл</h3>
                        <table className="docx-info-table">
                          <tbody>
                            {contractorRows.map((row) => (
                              <tr key={row.label}>
                                <th>{row.label}</th>
                                <td>{row.value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </section>
                    )}

                    {generalRows.length > 0 && (
                      <section className="docx-card">
                        <h3 className="docx-section-title">Ерөнхий мэдээлэл</h3>
                        <table className="docx-info-table">
                          <tbody>
                            {generalRows.map((row) => (
                              <tr key={row.label}>
                                <th>{row.label}</th>
                                <td>{row.value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </section>
                    )}
                  </div>

                  {sectionsData.map((section) => (
                    <section key={section.sectionKey} className="docx-card">
                      <h3 className="docx-section-title">{section.sectionLabel}</h3>
                      <table className="docx-section-table">
                        <thead>
                          <tr>
                            <th className="w-12">№</th>
                            <th>Үзлэгийн эд анги</th>
                            <th className="w-32">Төлөв</th>
                            <th>Тайлбар</th>
                          </tr>
                        </thead>
                        <tbody>
                          {section.fields.map((field, index) => (
                            <tr
                              key={field.fieldId}
                              className={index % 2 === 0 ? 'docx-row-odd' : 'docx-row-even'}
                            >
                              <td>{index + 1}</td>
                              <td>{field.fieldLabel}</td>
                              <td>{formatRowValue(field.status)}</td>
                              <td>{formatRowValue(field.comment)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {section.fields.map((field) =>
                        field.images.length > 0 ? (
                          <div key={`${field.fieldId}-images`} className="docx-section-image-group">
                            <p className="docx-image-group-title">{field.fieldLabel}</p>
                            <div className="docx-section-images">
                              {field.images.map((image, index) => (
                                <div key={`${field.fieldId}-${index}`} className="docx-section-image-card">
                                  <img
                                    src={image.dataUri || `data:${image.mimeType};base64,${image.data}`}
                                    alt={field.fieldLabel}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null
                      )}
                    </section>
                  ))}

                  {docxLayoutData.remarks && (
                    <section className="docx-card">
                      <h3 className="docx-section-title">Тэмдэглэл</h3>
                      <p className="docx-remarks">{docxLayoutData.remarks}</p>
                    </section>
                  )}

                  {signatureForLayout?.data && (
                    <section className="docx-card docx-card--signature">
                      <h3 className="docx-section-title">Инспекторын гарын үсэг</h3>
                      <div className="docx-signature">
                        <img
                          src={`data:${signatureForLayout.mimeType};base64,${signatureForLayout.data}`}
                          alt="Signature"
                        />
                        <span>Инспектор</span>
                      </div>
                    </section>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

