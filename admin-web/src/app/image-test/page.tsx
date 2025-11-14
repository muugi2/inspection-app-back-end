'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { authUtils, User } from '@/lib/auth';
import { apiService } from '@/lib/api';

interface GalleryImage {
  id: string | null;
  inspectionId: string;
  answerId: string | null;
  fieldId: string | null;
  section: string | null;
  order: number;
  imageUrl: string | null;
  storagePath: string | null;
  fileSize: number | null;
  mimeType: string | null;
  imageData: string | null;
  dataUri: string | null;
  uploadedBy: string | null;
  uploadedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

type SectionMap = Record<string, GalleryImage[]>;

export default function ImageTestPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [inspectionIdInput, setInspectionIdInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [images, setImages] = useState<GalleryImage[]>([]);

  useEffect(() => {
    if (!authUtils.isAuthenticated()) {
      router.push('/login');
      return;
    }
    const currentUser = authUtils.getUser();
    if (currentUser) {
      setUser(currentUser);
    }
  }, [router]);

  const sections: SectionMap = useMemo(() => {
    return images.reduce<SectionMap>((acc, image) => {
      const key = image.section || 'Бусад';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(image);
      return acc;
    }, {});
  }, [images]);

  const handleLoadImages = async () => {
    const trimmed = inspectionIdInput.trim();
    if (!trimmed) {
      setError('Үзлэгийн ID-г оруулна уу.');
      setImages([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      const response = await apiService.inspections.getImageGallery(trimmed, {
        includeData: true,
      });

      setInfoMessage(response?.message ?? null);

      const galleryImages: GalleryImage[] =
        response?.data?.images || response?.images || [];

      setImages(galleryImages);

      if (!galleryImages.length) {
        setError(
          response?.message || 'Харуулах зураг олдсонгүй.'
        );
      }
    } catch (err: any) {
      console.error('Failed to load inspection gallery:', err);
      setError(
        err?.response?.data?.message ||
          'Зургийг ачаалах явцад алдаа гарлаа. Үзлэгийн ID зөв эсэхийг шалгана уу.'
      );
      setImages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleLoadImages();
  };

  const renderImageItem = (image: GalleryImage) => {
    const src = image.dataUri || image.imageUrl || '';
    const hasPreview = Boolean(src);
    const sizeLabel =
      image.fileSize != null
        ? `${(image.fileSize / 1024).toFixed(1)} KB`
        : 'Мэдээлэлгүй';
    const storageLabel = image.storagePath || image.imageUrl || '—';
    return (
      <div
        key={`${image.section || 'section'}-${image.fieldId}-${image.order}`}
        className="border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-white flex flex-col"
      >
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase">
              {image.section || 'Бусад'}
            </p>
            <p className="text-sm font-semibold text-gray-800">
              {image.fieldId || 'Field'}
            </p>
          </div>
          <span className="text-xs text-gray-500 font-mono">
            № {image.order}
          </span>
        </div>

        <div className="flex-1 flex items-center justify-center bg-gray-100">
          {hasPreview ? (
            <img
              src={src}
              alt={`Inspection image ${image.order}`}
              className="max-h-72 object-contain"
            />
          ) : (
            <div className="text-gray-400 text-sm py-8">
              Зургийн урьдчилсан харагдах байдал олдсонгүй
            </div>
          )}
        </div>

        <div className="px-4 py-3 space-y-3 text-xs text-gray-600">
          <div className="flex justify-between">
            <span className="font-medium text-gray-700">Answer ID:</span>
            <span className="font-mono">{image.answerId || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-gray-700">Файл хэмжээ:</span>
            <span>{sizeLabel}</span>
          </div>
          <div className="break-all">
            <span className="font-medium text-gray-700 block">Файл зам:</span>
            <span className="font-mono text-[11px]">{storageLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-gray-700">Ирүүлсэн:</span>
            <span>{image.uploadedBy ? `User #${image.uploadedBy}` : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-gray-700">Огноо:</span>
            <span>
              {image.uploadedAt
                ? new Date(image.uploadedAt).toLocaleString()
                : '—'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar currentUser={user} />

      <div className="flex-1 ml-64">
        <header className="bg-white shadow-sm">
          <div className="px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Үзлэгийн зураг (Test)
              </h1>
              <p className="text-sm text-gray-500">
                FTP дээр хадгалагдсан зурагнуудыг админ интерфейс дээр шалгах
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-3 w-full md:w-auto"
            >
              <input
                type="text"
                value={inspectionIdInput}
                onChange={e => setInspectionIdInput(e.target.value)}
                placeholder="Үзлэгийн ID (жишээ: 102)"
                className="flex-1 md:flex-none w-full md:w-56 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Ачаалж байна...' : 'Зураг татах'}
              </button>
            </form>
          </div>
        </header>

        <main className="p-6 space-y-6">
        {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {!error && infoMessage && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
              {infoMessage}
            </div>
          )}

          {!error && !isLoading && !images.length && (
            <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500 text-sm">
              Үзлэгийн ID оруулаад “Зураг татах” товчыг дарна уу.
            </div>
          )}

          {images.length > 0 && (
            <section className="space-y-6">
              <div className="bg-white rounded-lg shadow px-5 py-4 flex flex-wrap gap-6 text-sm text-gray-600">
                <div>
                  <span className="font-semibold text-gray-900">
                    Үзлэгийн ID:
                  </span>{' '}
                  {images[0].inspectionId}
                </div>
                <div>
                  <span className="font-semibold text-gray-900">Нийт зураг:</span>{' '}
                  {images.length}
                </div>
                <div>
                  <span className="font-semibold text-gray-900">
                    Секцийн тоо:
                  </span>{' '}
                  {Object.keys(sections).length}
                </div>
              </div>

              {Object.entries(sections).map(([sectionName, sectionImages]) => (
                <div key={sectionName} className="space-y-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">
                      {sectionName}
                    </h2>
                    <p className="text-xs text-gray-500">
                      Нийт {sectionImages.length} зураг
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sectionImages.map(renderImageItem)}
                  </div>
                </div>
              ))}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

