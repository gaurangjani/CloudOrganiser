const ACTIVITIES = [
  { id: 1, action: 'uploaded', file: 'Q4_Report_Final.pdf', provider: 'Google Drive', user: 'alice@company.com', time: '2 minutes ago', type: 'upload' },
  { id: 2, action: 'renamed', file: 'budget_v2.xlsx → Budget_2024_Q1.xlsx', provider: 'OneDrive', user: 'bob@company.com', time: '14 minutes ago', type: 'rename' },
  { id: 3, action: 'moved', file: 'design_mockup.fig → /Projects/2024/', provider: 'Google Drive', user: 'carol@company.com', time: '1 hour ago', type: 'move' },
  { id: 4, action: 'deleted', file: 'temp_notes.txt', provider: 'OneDrive', user: 'alice@company.com', time: '2 hours ago', type: 'delete' },
  { id: 5, action: 'uploaded', file: 'profile_photo.png', provider: 'AWS S3', user: 'dave@company.com', time: '3 hours ago', type: 'upload' },
  { id: 6, action: 'renamed', file: 'report.docx → Annual_Report_2024.docx', provider: 'Google Drive', user: 'carol@company.com', time: '5 hours ago', type: 'rename' },
  { id: 7, action: 'moved', file: 'invoice_123.pdf → /Finance/Invoices/', provider: 'OneDrive', user: 'bob@company.com', time: '6 hours ago', type: 'move' },
  { id: 8, action: 'uploaded', file: 'presentation_draft.pptx', provider: 'Google Drive', user: 'alice@company.com', time: '8 hours ago', type: 'upload' },
];

const ACTION_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  upload: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  rename: { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  move: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  delete: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
};

export default function ActivityFeed() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">Showing recent file events across all connected accounts</p>
        <div className="flex gap-2">
          <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
            <option>All Providers</option>
            <option>Google Drive</option>
            <option>OneDrive</option>
            <option>AWS S3</option>
          </select>
          <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
            <option>All Actions</option>
            <option>Upload</option>
            <option>Rename</option>
            <option>Move</option>
            <option>Delete</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <ul className="divide-y divide-gray-100">
          {ACTIVITIES.map(activity => {
            const style = ACTION_STYLES[activity.type];
            return (
              <li key={activity.id} className="flex items-start gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="mt-1 flex-shrink-0">
                  <span className={`w-2.5 h-2.5 rounded-full ${style.dot} inline-block`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                      {activity.action}
                    </span>
                    <span className="text-sm font-medium text-gray-800 truncate">{activity.file}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {activity.user} · {activity.provider}
                  </p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap mt-1">{activity.time}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
