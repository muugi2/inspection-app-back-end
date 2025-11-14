'use client';

import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import { authUtils } from '@/lib/auth';

export default function DocxPreviewLandingPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const user = authUtils.isAuthenticated() ? authUtils.getUser() : null;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar currentUser={user} />
      <div className="flex-1 ml-64 flex items-center justify-center p-6">
        <div className="bg-white border border-gray-200 rounded-lg px-8 py-12 text-center max-w-xl shadow">
          <h1 className="text-2xl font-semibold text-gray-900 mb-3">
            A4 тайлангийн preview
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            Үзлэгийн хариултын ID (inspection_answer) оруулж A4 форматтай preview болон DOCX тайлан татах
            боломжтой.
          </p>
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              placeholder="Үзлэгийн хариултын ID"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            <button
              onClick={() => {
                const value = inputRef.current?.value?.trim();
                if (value) {
                  router.push(`/docx-preview/${value}`);
                }
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Нээх
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
