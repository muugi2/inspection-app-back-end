'use client';

import Sidebar from '@/components/Sidebar';
import { authUtils, User } from '@/lib/auth';
import { useEffect, useState } from 'react';

export default function TemplateViewerPage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (authUtils.isAuthenticated()) {
      setUser(authUtils.getUser());
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar currentUser={user} />
      <div className="flex-1 ml-64 flex items-center justify-center p-6">
        <div className="bg-white border border-dashed border-gray-300 rounded-lg px-8 py-12 text-center max-w-lg">
          <h1 className="text-xl font-semibold text-gray-900 mb-3">Template viewer идэвхгүй байна</h1>
          <p className="text-sm text-gray-600">
            Энэ хэсэг түр хугацаанд хаалттай. Template-ийг харуулах нэмэлт хөгжүүлэлт одоогоор байхгүй байна.
          </p>
        </div>
      </div>
    </div>
  );
}












