import type { Metadata } from 'next';
import '../admin.css';
import { ConsoleShell } from './console-shell';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Ekklesia admin' },
  robots: { index: false, follow: false },
};

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <ConsoleShell>{children}</ConsoleShell>;
}
