import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

const PAGE_TITLES: Record<string, string> = {
  '/accounts': 'Connected Cloud Accounts',
  '/activity': 'File Activity Feed',
  '/suggestions': 'AI Suggestions',
  '/rules': 'Rules Management',
  '/approvals': 'Pending Approvals',
};

export default function Layout() {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] ?? 'Dashboard';

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200 px-8 py-4">
          <h1 className="text-xl font-semibold text-gray-800">{title}</h1>
        </header>
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
