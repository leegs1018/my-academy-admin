import type { Metadata } from 'next';
import FindAccountClient from './FindAccountClient';

export const metadata: Metadata = {
  title: '계정 찾기',
  robots: { index: false, follow: false },
};

export default function FindAccountPage() {
  return <FindAccountClient />;
}
