const ACCOUNTS = [
  {
    id: 1,
    provider: 'Google Drive',
    email: 'user@gmail.com',
    status: 'connected',
    files: 1240,
    storage: '8.4 GB / 15 GB',
    icon: '🟡',
  },
  {
    id: 2,
    provider: 'OneDrive',
    email: 'user@outlook.com',
    status: 'connected',
    files: 843,
    storage: '12.1 GB / 50 GB',
    icon: '🔵',
  },
  {
    id: 3,
    provider: 'Dropbox',
    email: 'user@dropbox.com',
    status: 'disconnected',
    files: 0,
    storage: '— / 2 GB',
    icon: '⚫',
  },
  {
    id: 4,
    provider: 'AWS S3',
    email: 'user@company.com',
    status: 'connected',
    files: 5620,
    storage: '34.7 GB / ∞',
    icon: '🟠',
  },
];

export default function CloudAccounts() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{ACCOUNTS.filter(a => a.status === 'connected').length} of {ACCOUNTS.length} accounts connected</p>
        <button className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
          + Connect Account
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ACCOUNTS.map(account => (
          <div key={account.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{account.icon}</span>
                <div>
                  <h3 className="font-semibold text-gray-800">{account.provider}</h3>
                  <p className="text-sm text-gray-500">{account.email}</p>
                </div>
              </div>
              <span
                className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  account.status === 'connected'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {account.status}
              </span>
            </div>

            <div className="flex justify-between text-sm text-gray-600 mb-4">
              <span>{account.files.toLocaleString()} files</span>
              <span>{account.storage}</span>
            </div>

            <div className="flex gap-2">
              {account.status === 'connected' ? (
                <>
                  <button className="flex-1 text-sm py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600">
                    Sync Now
                  </button>
                  <button className="flex-1 text-sm py-1.5 border border-red-200 rounded-lg hover:bg-red-50 transition-colors text-red-600">
                    Disconnect
                  </button>
                </>
              ) : (
                <button className="flex-1 text-sm py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                  Connect
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
