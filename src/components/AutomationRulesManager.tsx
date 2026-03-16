import React, { useState, useCallback } from 'react';
import {
  Rule,
  RuleType,
  RuleCondition,
  RuleConditionOperator,
  RuleAction,
  RuleActionType,
  CreateRuleInput,
} from '../types/rules.types';

// ---- Draft types used in the form ----

interface ConditionDraft {
  field: string;
  operator: RuleConditionOperator;
  value: string;
}

interface ActionDraft {
  type: RuleActionType;
  /** JSON string representation of params */
  params: string;
}

interface RuleFormData {
  name: string;
  description: string;
  type: RuleType;
  priority: number;
  enabled: boolean;
  conditionLogic: 'AND' | 'OR';
  conditions: ConditionDraft[];
  actions: ActionDraft[];
}

// ---- Component props ----

export interface AutomationRulesManagerProps {
  /** Existing rules to pre-populate the list */
  initialRules?: Rule[];
  /** Called whenever the rule list changes (add/edit/delete/reorder) */
  onRulesChange?: (rules: Rule[]) => void;
}

// ---- Constants ----

const RULE_TYPE_LABELS: Record<RuleType, string> = {
  file_type: 'File Type',
  content: 'Content',
  naming: 'Naming',
  folder_routing: 'Folder Routing',
  ai_assisted: 'AI Assisted',
};

const CONDITION_OPERATORS: RuleConditionOperator[] = [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'matches_regex',
  'greater_than',
  'less_than',
  'in',
  'not_in',
];

const ACTION_TYPES: RuleActionType[] = [
  'move',
  'rename',
  'tag',
  'categorize',
  'archive',
  'notify',
  'ai_classify',
];

/** Manageable rule types (excludes ai_assisted from the selector) */
const MANAGEABLE_RULE_TYPES: RuleType[] = ['file_type', 'content', 'naming', 'folder_routing'];

/** Default field path for each rule type */
const DEFAULT_FIELD_BY_TYPE: Record<RuleType, string> = {
  file_type: 'file.extension',
  content: 'content.text',
  naming: 'file.name',
  folder_routing: 'folder.path',
  ai_assisted: 'ai.prompt',
};

// ---- Helper functions ----

let idCounter = 0;

function generateId(): string {
  idCounter += 1;
  return `rule-${Date.now()}-${idCounter}`;
}

function makeEmptyForm(priority: number): RuleFormData {
  return {
    name: '',
    description: '',
    type: 'file_type',
    priority,
    enabled: true,
    conditionLogic: 'AND',
    conditions: [{ field: DEFAULT_FIELD_BY_TYPE['file_type'], operator: 'equals', value: '' }],
    actions: [{ type: 'move', params: '{}' }],
  };
}

function ruleToForm(rule: Rule): RuleFormData {
  return {
    name: rule.name,
    description: rule.description ?? '',
    type: rule.type,
    priority: rule.priority,
    enabled: rule.enabled,
    conditionLogic: rule.conditionLogic,
    conditions: rule.conditions.map(c => ({
      field: c.field,
      operator: c.operator,
      value: typeof c.value === 'string' ? c.value : JSON.stringify(c.value),
    })),
    actions: rule.actions.map(a => ({
      type: a.type,
      params: JSON.stringify(a.params),
    })),
  };
}

function formToCreateInput(form: RuleFormData): CreateRuleInput {
  const conditions: RuleCondition[] = form.conditions.map(c => ({
    field: c.field,
    operator: c.operator,
    value: c.value,
  }));

  const actions: RuleAction[] = form.actions.map(a => {
    let params: Record<string, unknown> = {};
    try {
      params = JSON.parse(a.params) as Record<string, unknown>;
    } catch {
      params = {};
    }
    return { type: a.type, params };
  });

  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    type: form.type,
    priority: form.priority,
    enabled: form.enabled,
    conditionLogic: form.conditionLogic,
    conditions,
    actions,
  };
}

function hasInvalidActionParams(actions: ActionDraft[]): boolean {
  return actions.some(a => {
    try {
      JSON.parse(a.params);
      return false;
    } catch {
      return true;
    }
  });
}

// ---- Styles ----

const TYPE_COLORS: Record<RuleType, { bg: string; text: string }> = {
  file_type: { bg: '#dbeafe', text: '#1e40af' },
  content: { bg: '#fef3c7', text: '#92400e' },
  naming: { bg: '#d1fae5', text: '#065f46' },
  folder_routing: { bg: '#ede9fe', text: '#5b21b6' },
  ai_assisted: { bg: '#fce7f3', text: '#9d174d' },
};

const styles = {
  container: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    maxWidth: '960px',
    margin: '0 auto',
    padding: '24px',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  } as React.CSSProperties,
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: 0,
    color: '#111827',
  } as React.CSSProperties,
  primaryBtn: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 600,
    background: '#2563eb',
    color: '#fff',
  } as React.CSSProperties,
  dangerBtn: {
    padding: '4px 10px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: 600,
    background: '#dc2626',
    color: '#fff',
  } as React.CSSProperties,
  secondaryBtn: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 600,
    background: '#6b7280',
    color: '#fff',
  } as React.CSSProperties,
  outlineBtn: {
    padding: '4px 10px',
    borderRadius: '4px',
    border: '1px solid #d1d5db',
    cursor: 'pointer',
    fontSize: '0.75rem',
    background: '#f9fafb',
    color: '#374151',
  } as React.CSSProperties,
  arrowBtn: {
    display: 'block',
    padding: '1px 6px',
    borderRadius: '3px',
    border: '1px solid #d1d5db',
    cursor: 'pointer',
    fontSize: '0.7rem',
    background: '#f9fafb',
    color: '#374151',
    lineHeight: '1.4',
  } as React.CSSProperties,
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  th: {
    textAlign: 'left' as const,
    padding: '10px 14px',
    background: '#f3f4f6',
    borderBottom: '2px solid #e5e7eb',
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    color: '#4b5563',
    letterSpacing: '0.05em',
  },
  td: {
    padding: '10px 14px',
    borderBottom: '1px solid #f3f4f6',
    fontSize: '0.875rem',
    verticalAlign: 'middle' as const,
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '48px 0',
    color: '#6b7280',
    border: '2px dashed #e5e7eb',
    borderRadius: '8px',
  },
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '16px',
  },
  modal: {
    background: '#fff',
    borderRadius: '10px',
    padding: '28px',
    width: '640px',
    maxWidth: '100%',
    maxHeight: '90vh',
    overflowY: 'auto' as const,
    boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  } as React.CSSProperties,
  modalTitle: {
    fontSize: '1.125rem',
    fontWeight: 700,
    margin: 0,
    color: '#111827',
  } as React.CSSProperties,
  section: { marginBottom: '24px' } as React.CSSProperties,
  sectionTitle: {
    fontSize: '0.8rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    color: '#6b7280',
    letterSpacing: '0.06em',
    marginBottom: '10px',
    paddingBottom: '6px',
    borderBottom: '1px solid #e5e7eb',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '14px',
  } as React.CSSProperties,
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  fieldGroupFull: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    gridColumn: '1 / -1',
  } as React.CSSProperties,
  label: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#374151',
  } as React.CSSProperties,
  input: {
    padding: '7px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '5px',
    fontSize: '0.875rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  select: {
    padding: '7px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '5px',
    fontSize: '0.875rem',
    background: '#fff',
    cursor: 'pointer',
    width: '100%',
  },
  textarea: {
    padding: '7px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '5px',
    fontSize: '0.875rem',
    resize: 'vertical' as const,
    minHeight: '64px',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  conditionRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 28px',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '8px',
  } as React.CSSProperties,
  actionRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr 28px',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '8px',
  } as React.CSSProperties,
  addRowBtn: {
    width: '100%',
    padding: '6px',
    background: 'none',
    border: '1px dashed #9ca3af',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    color: '#6b7280',
    marginTop: '4px',
  } as React.CSSProperties,
  formFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '24px',
    paddingTop: '16px',
    borderTop: '1px solid #e5e7eb',
  } as React.CSSProperties,
  radioGroup: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
    paddingTop: '4px',
  } as React.CSSProperties,
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    cursor: 'pointer',
    fontSize: '0.875rem',
    color: '#374151',
  } as React.CSSProperties,
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    fontSize: '0.875rem',
    color: '#374151',
    paddingTop: '4px',
  } as React.CSSProperties,
  errorBanner: {
    padding: '10px 14px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '5px',
    color: '#dc2626',
    fontSize: '0.8rem',
    marginBottom: '16px',
  } as React.CSSProperties,
  closeBtn: {
    padding: '4px 8px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: '1.1rem',
    color: '#6b7280',
    borderRadius: '4px',
  } as React.CSSProperties,
  removeBtn: {
    padding: '4px 8px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: 700,
    background: '#fee2e2',
    color: '#dc2626',
  } as React.CSSProperties,
  actionsCell: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap' as const,
  },
};

function typeBadgeStyle(type: RuleType): React.CSSProperties {
  return {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: '12px',
    fontSize: '0.72rem',
    fontWeight: 700,
    background: TYPE_COLORS[type]?.bg ?? '#e5e7eb',
    color: TYPE_COLORS[type]?.text ?? '#1f2937',
    letterSpacing: '0.02em',
  };
}

function statusBadgeStyle(enabled: boolean): React.CSSProperties {
  return {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: '12px',
    fontSize: '0.72rem',
    fontWeight: 700,
    background: enabled ? '#d1fae5' : '#f3f4f6',
    color: enabled ? '#065f46' : '#6b7280',
    border: 'none',
    cursor: 'pointer',
  };
}

// ---- Sub-components ----

interface ConditionEditorProps {
  conditions: ConditionDraft[];
  ruleType: RuleType;
  onChange: (conditions: ConditionDraft[]) => void;
}

const ConditionEditor: React.FC<ConditionEditorProps> = ({ conditions, ruleType, onChange }) => {
  const addCondition = () => {
    onChange([
      ...conditions,
      { field: DEFAULT_FIELD_BY_TYPE[ruleType], operator: 'equals', value: '' },
    ]);
  };

  const removeCondition = (idx: number) => {
    onChange(conditions.filter((_, i) => i !== idx));
  };

  const updateCondition = (idx: number, patch: Partial<ConditionDraft>) => {
    onChange(conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  return (
    <div>
      {conditions.map((cond, idx) => (
        <div key={idx} style={styles.conditionRow}>
          <input
            style={styles.input}
            aria-label={`Condition ${idx + 1} field`}
            placeholder="field path"
            value={cond.field}
            onChange={e => updateCondition(idx, { field: e.target.value })}
          />
          <select
            style={styles.select}
            aria-label={`Condition ${idx + 1} operator`}
            value={cond.operator}
            onChange={e =>
              updateCondition(idx, { operator: e.target.value as RuleConditionOperator })
            }
          >
            {CONDITION_OPERATORS.map(op => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
          <input
            style={styles.input}
            aria-label={`Condition ${idx + 1} value`}
            placeholder="value"
            value={cond.value}
            onChange={e => updateCondition(idx, { value: e.target.value })}
          />
          <button
            type="button"
            style={styles.removeBtn}
            aria-label={`Remove condition ${idx + 1}`}
            onClick={() => removeCondition(idx)}
            disabled={conditions.length <= 1}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" style={styles.addRowBtn} onClick={addCondition}>
        + Add Condition
      </button>
    </div>
  );
};

interface ActionEditorProps {
  actions: ActionDraft[];
  onChange: (actions: ActionDraft[]) => void;
}

const ActionEditor: React.FC<ActionEditorProps> = ({ actions, onChange }) => {
  const addAction = () => {
    onChange([...actions, { type: 'move', params: '{}' }]);
  };

  const removeAction = (idx: number) => {
    onChange(actions.filter((_, i) => i !== idx));
  };

  const updateAction = (idx: number, patch: Partial<ActionDraft>) => {
    onChange(actions.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };

  return (
    <div>
      {actions.map((action, idx) => (
        <div key={idx} style={styles.actionRow}>
          <select
            style={styles.select}
            aria-label={`Action ${idx + 1} type`}
            value={action.type}
            onChange={e => updateAction(idx, { type: e.target.value as RuleActionType })}
          >
            {ACTION_TYPES.map(t => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            style={styles.input}
            aria-label={`Action ${idx + 1} params`}
            placeholder='{"key": "value"}'
            value={action.params}
            onChange={e => updateAction(idx, { params: e.target.value })}
          />
          <button
            type="button"
            style={styles.removeBtn}
            aria-label={`Remove action ${idx + 1}`}
            onClick={() => removeAction(idx)}
            disabled={actions.length <= 1}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" style={styles.addRowBtn} onClick={addAction}>
        + Add Action
      </button>
    </div>
  );
};

// ---- Main Component ----

/**
 * AutomationRulesManager lets users add, edit, delete, and reorder
 * automation rules that support file_type, content, naming, and
 * folder_routing rule types.
 */
const AutomationRulesManager: React.FC<AutomationRulesManagerProps> = ({
  initialRules = [],
  onRulesChange,
}) => {
  const [rules, setRules] = useState<Rule[]>(() =>
    [...initialRules].sort((a, b) => a.priority - b.priority)
  );
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<RuleFormData>(makeEmptyForm(1));
  const [formError, setFormError] = useState<string | null>(null);

  const commitRules = useCallback(
    (next: Rule[]) => {
      setRules(next);
      onRulesChange?.(next);
    },
    [onRulesChange]
  );

  // ---- Form helpers ----

  const openAddForm = () => {
    const nextPriority = rules.length > 0 ? Math.max(...rules.map(r => r.priority)) + 1 : 1;
    setFormData(makeEmptyForm(nextPriority));
    setEditingId(null);
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditForm = (rule: Rule) => {
    setFormData(ruleToForm(rule));
    setEditingId(rule.id);
    setFormError(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setFormError(null);
  };

  const updateField = <K extends keyof RuleFormData>(field: K, value: RuleFormData[K]) => {
    setFormData(prev => {
      if (field === 'type') {
        // Reset conditions to the default field for the new rule type
        return {
          ...prev,
          type: value as RuleType,
          conditions: [
            {
              field: DEFAULT_FIELD_BY_TYPE[value as RuleType],
              operator: 'equals' as RuleConditionOperator,
              value: '',
            },
          ],
        };
      }
      return { ...prev, [field]: value };
    });
  };

  // ---- CRUD + Reorder ----

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Rule name is required.');
      return;
    }
    if (hasInvalidActionParams(formData.actions)) {
      setFormError('Action params must be valid JSON.');
      return;
    }

    const input = formToCreateInput(formData);
    const now = new Date();

    let next: Rule[];
    if (editingId) {
      next = rules.map(r => (r.id === editingId ? { ...r, ...input, updatedAt: now } : r));
    } else {
      const newRule: Rule = { ...input, id: generateId(), createdAt: now, updatedAt: now };
      next = [...rules, newRule];
    }

    // Keep sorted by priority; re-index to ensure sequential priorities
    const sorted = [...next]
      .sort((a, b) => a.priority - b.priority)
      .map((r, i) => ({ ...r, priority: i + 1 }));

    commitRules(sorted);
    closeForm();
  };

  const handleDelete = (id: string) => {
    const next = rules
      .filter(r => r.id !== id)
      .map((r, i) => ({ ...r, priority: i + 1, updatedAt: new Date() }));
    commitRules(next);
  };

  const handleToggleEnabled = (id: string) => {
    const next = rules.map(r =>
      r.id === id ? { ...r, enabled: !r.enabled, updatedAt: new Date() } : r
    );
    commitRules(next);
  };

  const handleMoveUp = (id: string) => {
    const idx = rules.findIndex(r => r.id === id);
    if (idx <= 0) return;
    const next = [...rules];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    commitRules(next.map((r, i) => ({ ...r, priority: i + 1, updatedAt: new Date() })));
  };

  const handleMoveDown = (id: string) => {
    const idx = rules.findIndex(r => r.id === id);
    if (idx < 0 || idx >= rules.length - 1) return;
    const next = [...rules];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    commitRules(next.map((r, i) => ({ ...r, priority: i + 1, updatedAt: new Date() })));
  };

  // ---- Render ----

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Automation Rules</h2>
        <button
          style={styles.primaryBtn}
          onClick={openAddForm}
          data-testid="add-rule-button"
        >
          + Add Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <div style={styles.emptyState} data-testid="empty-state">
          <p style={{ margin: '0 0 8px', fontWeight: 600 }}>No automation rules configured.</p>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            Click &quot;+ Add Rule&quot; to create your first rule.
          </p>
        </div>
      ) : (
        <table style={styles.table} data-testid="rules-table">
          <thead>
            <tr>
              <th style={styles.th}>Priority</th>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Type</th>
              <th style={styles.th}>Conditions</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule, idx) => (
              <tr key={rule.id} data-testid={`rule-row-${rule.id}`}>
                {/* Priority + reorder */}
                <td style={styles.td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 700, minWidth: '22px', color: '#374151' }}>
                      {rule.priority}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <button
                        style={styles.arrowBtn}
                        onClick={() => handleMoveUp(rule.id)}
                        disabled={idx === 0}
                        aria-label={`Move rule ${rule.name} up`}
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        style={styles.arrowBtn}
                        onClick={() => handleMoveDown(rule.id)}
                        disabled={idx === rules.length - 1}
                        aria-label={`Move rule ${rule.name} down`}
                        title="Move down"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                </td>

                {/* Name + description */}
                <td style={styles.td}>
                  <div style={{ fontWeight: 600, color: '#111827' }}>{rule.name}</div>
                  {rule.description && (
                    <div style={{ color: '#6b7280', fontSize: '0.78rem', marginTop: '2px' }}>
                      {rule.description}
                    </div>
                  )}
                </td>

                {/* Type badge */}
                <td style={styles.td}>
                  <span style={typeBadgeStyle(rule.type)}>{RULE_TYPE_LABELS[rule.type]}</span>
                </td>

                {/* Conditions summary */}
                <td style={styles.td}>
                  <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                    {rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}{' '}
                    <span
                      style={{
                        fontWeight: 700,
                        color: '#374151',
                        background: '#f3f4f6',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                      }}
                    >
                      {rule.conditionLogic}
                    </span>
                  </span>
                </td>

                {/* Enabled toggle */}
                <td style={styles.td}>
                  <button
                    style={statusBadgeStyle(rule.enabled)}
                    onClick={() => handleToggleEnabled(rule.id)}
                    aria-label={`Toggle rule ${rule.name} ${rule.enabled ? 'off' : 'on'}`}
                    title={rule.enabled ? 'Click to disable' : 'Click to enable'}
                  >
                    {rule.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </td>

                {/* Edit / Delete */}
                <td style={styles.td}>
                  <div style={styles.actionsCell}>
                    <button
                      style={styles.outlineBtn}
                      onClick={() => openEditForm(rule)}
                      aria-label={`Edit rule ${rule.name}`}
                      data-testid={`edit-rule-${rule.id}`}
                    >
                      Edit
                    </button>
                    <button
                      style={styles.dangerBtn}
                      onClick={() => handleDelete(rule.id)}
                      aria-label={`Delete rule ${rule.name}`}
                      data-testid={`delete-rule-${rule.id}`}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ---- Form Modal ---- */}
      {isFormOpen && (
        <div style={styles.overlay} data-testid="rule-form-overlay">
          <div style={styles.modal} role="dialog" aria-label={editingId ? 'Edit rule' : 'Add rule'}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{editingId ? 'Edit Rule' : 'Add Rule'}</h3>
              <button style={styles.closeBtn} onClick={closeForm} aria-label="Close form">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {formError && (
                <div style={styles.errorBanner} data-testid="form-error">
                  {formError}
                </div>
              )}

              {/* Basic Information */}
              <div style={styles.section}>
                <div style={styles.sectionTitle}>Basic Information</div>
                <div style={styles.formGrid}>
                  <div style={styles.fieldGroupFull}>
                    <label style={styles.label} htmlFor="rule-name">
                      Name *
                    </label>
                    <input
                      id="rule-name"
                      style={styles.input}
                      type="text"
                      value={formData.name}
                      onChange={e => updateField('name', e.target.value)}
                      placeholder="e.g. Move PDF reports to Reports folder"
                    />
                  </div>

                  <div style={styles.fieldGroupFull}>
                    <label style={styles.label} htmlFor="rule-description">
                      Description
                    </label>
                    <textarea
                      id="rule-description"
                      style={styles.textarea}
                      value={formData.description}
                      onChange={e => updateField('description', e.target.value)}
                      placeholder="Describe what this rule does..."
                    />
                  </div>

                  <div style={styles.fieldGroup}>
                    <label style={styles.label} htmlFor="rule-type">
                      Rule Type
                    </label>
                    <select
                      id="rule-type"
                      style={styles.select}
                      value={formData.type}
                      onChange={e => updateField('type', e.target.value as RuleType)}
                    >
                      {MANAGEABLE_RULE_TYPES.map(t => (
                        <option key={t} value={t}>
                          {RULE_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={styles.fieldGroup}>
                    <label style={styles.label} htmlFor="rule-priority">
                      Priority
                    </label>
                    <input
                      id="rule-priority"
                      style={styles.input}
                      type="number"
                      min={1}
                      value={formData.priority}
                      onChange={e =>
                        updateField('priority', Math.max(1, parseInt(e.target.value, 10) || 1))
                      }
                    />
                  </div>

                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Condition Logic</label>
                    <div style={styles.radioGroup}>
                      {(['AND', 'OR'] as const).map(logic => (
                        <label key={logic} style={styles.radioLabel}>
                          <input
                            type="radio"
                            name="conditionLogic"
                            value={logic}
                            checked={formData.conditionLogic === logic}
                            onChange={() => updateField('conditionLogic', logic)}
                          />
                          {logic}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Status</label>
                    <label style={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={formData.enabled}
                        onChange={e => updateField('enabled', e.target.checked)}
                      />
                      Enabled
                    </label>
                  </div>
                </div>
              </div>

              {/* Conditions */}
              <div style={styles.section}>
                <div style={styles.sectionTitle}>Conditions</div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr 28px',
                    gap: '8px',
                    marginBottom: '6px',
                  }}
                >
                  <span style={styles.label}>Field</span>
                  <span style={styles.label}>Operator</span>
                  <span style={styles.label}>Value</span>
                  <span />
                </div>
                <ConditionEditor
                  conditions={formData.conditions}
                  ruleType={formData.type}
                  onChange={conditions => updateField('conditions', conditions)}
                />
              </div>

              {/* Actions */}
              <div style={styles.section}>
                <div style={styles.sectionTitle}>Actions</div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 2fr 28px',
                    gap: '8px',
                    marginBottom: '6px',
                  }}
                >
                  <span style={styles.label}>Action</span>
                  <span style={styles.label}>Params (JSON)</span>
                  <span />
                </div>
                <ActionEditor
                  actions={formData.actions}
                  onChange={actions => updateField('actions', actions)}
                />
              </div>

              <div style={styles.formFooter}>
                <button type="button" style={styles.secondaryBtn} onClick={closeForm}>
                  Cancel
                </button>
                <button
                  type="submit"
                  style={styles.primaryBtn}
                  data-testid="submit-rule-form"
                >
                  {editingId ? 'Save Changes' : 'Add Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export { AutomationRulesManager };
export default AutomationRulesManager;
