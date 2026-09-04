'use client';
import dynamic from 'next/dynamic';

// AnatomyViewer를 Client-Side Only(SSR 비활성화)로 로드합니다.
const AnatomyViewer = dynamic(
  () => import('@/components/anatomy/viewer/AnatomyViewer'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-600 border-t-blue-500" />
          <p className="text-sm text-gray-400">3D 해부학 모델 불러오는 중...</p>
        </div>
      </div>
    ),
  }
);

export default function Home() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      <AnatomyViewer />
    </main>
  );
}