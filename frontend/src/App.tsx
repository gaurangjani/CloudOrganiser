import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import CloudAccounts from './pages/CloudAccounts';
import ActivityFeed from './pages/ActivityFeed';
import AISuggestions from './pages/AISuggestions';
import RulesManagement from './pages/RulesManagement';
import PendingApprovals from './pages/PendingApprovals';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/accounts" replace />} />
          <Route path="accounts" element={<CloudAccounts />} />
          <Route path="activity" element={<ActivityFeed />} />
          <Route path="suggestions" element={<AISuggestions />} />
          <Route path="rules" element={<RulesManagement />} />
          <Route path="approvals" element={<PendingApprovals />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
