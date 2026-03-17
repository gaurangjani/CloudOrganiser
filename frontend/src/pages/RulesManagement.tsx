import { useState } from 'react';

type RuleCondition = 'file_type' | 'content' | 'naming' | 'folder_routing' | 'ai_assisted';
type RuleAction = 'move' | 'rename' | 'tag' | 'archive' | 'notify';

interface Rule {
  id: number;
  name: string;
  description: string;
  condition: RuleCondition;
  action: RuleAction;
  enabled: boolean;
  matchCount: number;
}

const INITIAL_RULES: Rule[] = [
  { id: 1, name: 'Auto-archive old files', description: 'Archive files older than 12 months not accessed recently', condition: 'ai_assisted', action: 'archive', enabled: true, matchCount: 67 },
  { id: 2, name: 'Normalise invoice names', description: 'Rename invoice files to invoice_YYYY-MM-DD format', condition: 'naming', action: 'rename', enabled: true, matchCount: 23 },
  { id: 3, name: 'Route PDFs to Documents', description: 'Move all PDF files to the /Documents folder', condition: 'file_type', action: 'move', enabled: false, matchCount: 0 },
  { id: 4, name: 'Tag sensitive content', description: 'Tag files containing PII with "sensitive" label', condition: 'content', action: 'tag', enabled: true, matchCount: 8 },
  { id: 5, name: 'Notify on large uploads', description: 'Send notification when file size exceeds 500 MB', condition: 'file_type', action: 'notify', enabled: true, matchCount: 3 },
];

const CONDITION_LABELS: Record<RuleCondition, string> = {
  file_type: 'File Type',
  content: 'Content',
  naming: 'Naming',
  folder_routing: 'Folder',
  ai_assisted: 'AI Assisted',
};

const ACTION_STYLES: Record<RuleAction, string> = {
  move: 'bg-blue-100 text-blue-700',
  rename: 'bg-yellow-100 text-yellow-700',
  tag: 'bg-teal-100 text-teal-700',
  archive: 'bg-gray-200 text-gray-700',
  notify: 'bg-purple-100 text-purple-700',
};

export default function RulesManagement() {
  const [rules, setRules] = useState(INITIAL_RULES);

  const toggleRule = (id: number) => {
    setRules(prev =>
      prev.map(r => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const deleteRule = (id: number) => {
    setRules(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          {rules.filter(r => r.enabled).length} of {rules.length} rules active
        </p>
        <button className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
          + New Rule
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Rule</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Condition</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Action</th>
              <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Matches</th>
              <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rules.map(rule => (
              <tr key={rule.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <p className="text-sm font-medium text-gray-800">{rule.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{rule.description}</p>
                </td>
                <td className="px-4 py-4">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                    {CONDITION_LABELS[rule.condition]}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ACTION_STYLES[rule.action]}`}>
                    {rule.action}
                  </span>
                </td>
                <td className="px-4 py-4 text-right">
                  <span className="text-sm text-gray-600">{rule.matchCount}</span>
                </td>
                <td className="px-4 py-4 text-center">
                  <button
                    onClick={() => toggleRule(rule.id)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      rule.enabled ? 'bg-indigo-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                        rule.enabled ? 'translate-x-4.5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </td>
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-2">
                    <button className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                      Edit
                    </button>
                    <button
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                      onClick={() => deleteRule(rule.id)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rules.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            No rules configured. Click "+ New Rule" to get started.
          </div>
        )}
      </div>
    </div>
  );
}
