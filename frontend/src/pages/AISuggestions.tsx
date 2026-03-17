import { useState } from 'react';

const SUGGESTIONS = [
  {
    id: 1,
    title: 'Rename duplicate files',
    description: '14 files named "report.pdf" detected across accounts. Suggest adding dates or version numbers to distinguish them.',
    confidence: 92,
    category: 'naming',
    files: ['report.pdf ×14'],
    impact: 'high',
  },
  {
    id: 2,
    title: 'Move invoices to Finance folder',
    description: '23 invoice files are stored in root directories. Moving them to /Finance/Invoices/ will improve organisation.',
    confidence: 87,
    category: 'organisation',
    files: ['invoice_*.pdf ×23'],
    impact: 'medium',
  },
  {
    id: 3,
    title: 'Archive old project files',
    description: '67 files from 2021 projects have not been accessed in over 12 months. Consider archiving to cold storage.',
    confidence: 78,
    category: 'archival',
    files: ['/Projects/2021/* ×67'],
    impact: 'medium',
  },
  {
    id: 4,
    title: 'Tag marketing assets',
    description: '31 images in /Marketing/ lack metadata tags. Adding tags will improve searchability.',
    confidence: 71,
    category: 'tagging',
    files: ['/Marketing/*.png ×18', '/Marketing/*.jpg ×13'],
    impact: 'low',
  },
  {
    id: 5,
    title: 'Consolidate duplicate folders',
    description: '"Screenshots" and "Screen Shots" folders contain similar content. Suggest merging into a single folder.',
    confidence: 95,
    category: 'organisation',
    files: ['/Screenshots/ ×1', '/Screen Shots/ ×1'],
    impact: 'high',
  },
];

const IMPACT_STYLES: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

const CATEGORY_STYLES: Record<string, string> = {
  naming: 'bg-blue-100 text-blue-700',
  organisation: 'bg-purple-100 text-purple-700',
  archival: 'bg-gray-100 text-gray-700',
  tagging: 'bg-teal-100 text-teal-700',
};

export default function AISuggestions() {
  const [dismissed, setDismissed] = useState<number[]>([]);

  const visible = SUGGESTIONS.filter(s => !dismissed.includes(s.id));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          {visible.length} suggestion{visible.length !== 1 ? 's' : ''} from AI analysis
        </p>
        <button
          className="text-sm text-indigo-600 hover:underline"
          onClick={() => setDismissed([])}
        >
          Restore dismissed
        </button>
      </div>

      {visible.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">All suggestions have been dismissed.</p>
        </div>
      )}

      <div className="space-y-3">
        {visible.map(suggestion => (
          <div key={suggestion.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <h3 className="font-semibold text-gray-800">{suggestion.title}</h3>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_STYLES[suggestion.category]}`}>
                    {suggestion.category}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${IMPACT_STYLES[suggestion.impact]}`}>
                    {suggestion.impact} impact
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3">{suggestion.description}</p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${suggestion.confidence}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{suggestion.confidence}% confidence</span>
                  </div>
                  <div className="flex gap-1">
                    {suggestion.files.map(f => (
                      <code key={f} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        {f}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button className="text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                  Apply
                </button>
                <button
                  className="text-sm px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                  onClick={() => setDismissed(prev => [...prev, suggestion.id])}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
