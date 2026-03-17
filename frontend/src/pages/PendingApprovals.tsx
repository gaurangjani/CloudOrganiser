import { useState } from 'react';

type ApprovalStatus = 'pending' | 'approved' | 'rejected';

interface Approval {
  id: number;
  action: string;
  file: string;
  provider: string;
  rule: string;
  confidence: number;
  requestedBy: string;
  requestedAt: string;
  status: ApprovalStatus;
}

const INITIAL_APPROVALS: Approval[] = [
  { id: 1, action: 'Archive', file: 'project_2021_final.zip', provider: 'Google Drive', rule: 'Auto-archive old files', confidence: 78, requestedBy: 'AI Agent', requestedAt: '10 minutes ago', status: 'pending' },
  { id: 2, action: 'Move', file: 'invoice_batch_oct.pdf', provider: 'OneDrive', rule: 'Route PDFs to Documents', confidence: 91, requestedBy: 'AI Agent', requestedAt: '25 minutes ago', status: 'pending' },
  { id: 3, action: 'Rename', file: 'untitled_document_3.docx', provider: 'Google Drive', rule: 'Normalise invoice names', confidence: 72, requestedBy: 'AI Agent', requestedAt: '1 hour ago', status: 'pending' },
  { id: 4, action: 'Tag', file: 'employee_data_export.csv', provider: 'AWS S3', rule: 'Tag sensitive content', confidence: 88, requestedBy: 'AI Agent', requestedAt: '2 hours ago', status: 'pending' },
  { id: 5, action: 'Archive', file: 'legacy_code_backup.tar.gz', provider: 'AWS S3', rule: 'Auto-archive old files', confidence: 83, requestedBy: 'AI Agent', requestedAt: '3 hours ago', status: 'approved' },
  { id: 6, action: 'Move', file: 'random_screenshot.png', provider: 'OneDrive', rule: 'Route PDFs to Documents', confidence: 54, requestedBy: 'AI Agent', requestedAt: '4 hours ago', status: 'rejected' },
];

const ACTION_STYLES: Record<string, string> = {
  Archive: 'bg-gray-100 text-gray-700',
  Move: 'bg-blue-100 text-blue-700',
  Rename: 'bg-yellow-100 text-yellow-700',
  Tag: 'bg-teal-100 text-teal-700',
};

const STATUS_STYLES: Record<ApprovalStatus, string> = {
  pending: 'bg-orange-100 text-orange-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function PendingApprovals() {
  const [approvals, setApprovals] = useState(INITIAL_APPROVALS);
  const [filter, setFilter] = useState<ApprovalStatus | 'all'>('pending');

  const updateStatus = (id: number, status: ApprovalStatus) => {
    setApprovals(prev => prev.map(a => (a.id === id ? { ...a, status } : a)));
  };

  const visible = filter === 'all' ? approvals : approvals.filter(a => a.status === filter);

  const counts = {
    pending: approvals.filter(a => a.status === 'pending').length,
    approved: approvals.filter(a => a.status === 'approved').length,
    rejected: approvals.filter(a => a.status === 'rejected').length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {(['pending', 'approved', 'rejected'] as const).map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`rounded-xl border p-4 text-left transition-colors ${
              filter === status
                ? 'border-indigo-300 bg-indigo-50'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <p className={`text-2xl font-bold ${STATUS_STYLES[status].split(' ')[1]}`}>{counts[status]}</p>
            <p className="text-sm text-gray-500 capitalize">{status}</p>
          </button>
        ))}
      </div>

      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors capitalize ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        {counts.pending > 0 && (
          <div className="flex gap-2">
            <button
              className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              onClick={() =>
                approvals.filter(a => a.status === 'pending').forEach(a => updateStatus(a.id, 'approved'))
              }
            >
              Approve All
            </button>
            <button
              className="text-sm px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              onClick={() =>
                approvals.filter(a => a.status === 'pending').forEach(a => updateStatus(a.id, 'rejected'))
              }
            >
              Reject All
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <ul className="divide-y divide-gray-100">
          {visible.length === 0 && (
            <li className="px-6 py-12 text-center text-sm text-gray-400">
              No {filter !== 'all' ? filter : ''} approvals to display.
            </li>
          )}
          {visible.map(approval => (
            <li key={approval.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ACTION_STYLES[approval.action] ?? 'bg-gray-100 text-gray-700'}`}>
                      {approval.action}
                    </span>
                    <span className="text-sm font-medium text-gray-800">{approval.file}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[approval.status]}`}>
                      {approval.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    {approval.provider} · Rule: <span className="font-medium">{approval.rule}</span>
                  </p>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>Confidence: {approval.confidence}%</span>
                    <span>·</span>
                    <span>{approval.requestedBy}</span>
                    <span>·</span>
                    <span>{approval.requestedAt}</span>
                  </div>
                </div>
                {approval.status === 'pending' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      onClick={() => updateStatus(approval.id, 'approved')}
                    >
                      Approve
                    </button>
                    <button
                      className="text-sm px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      onClick={() => updateStatus(approval.id, 'rejected')}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
