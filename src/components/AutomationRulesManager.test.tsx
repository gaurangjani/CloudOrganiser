/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AutomationRulesManager } from './AutomationRulesManager';
import { Rule } from '../types/rules.types';

// ---- Fixtures ----

const mockRules: Rule[] = [
  {
    id: 'rule-1',
    name: 'Move PDFs',
    description: 'Move PDF files to the documents folder',
    type: 'file_type',
    priority: 1,
    enabled: true,
    conditionLogic: 'AND',
    conditions: [{ field: 'file.extension', operator: 'equals', value: '.pdf' }],
    actions: [{ type: 'move', params: { destination: '/Documents' } }],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'rule-2',
    name: 'Rename Reports',
    type: 'naming',
    priority: 2,
    enabled: false,
    conditionLogic: 'OR',
    conditions: [{ field: 'file.name', operator: 'contains', value: 'report' }],
    actions: [{ type: 'rename', params: { pattern: '{date}_{name}' } }],
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
  },
];

// ---- Helpers ----

function getNameInput(): HTMLInputElement {
  return screen.getByLabelText('Name *') as HTMLInputElement;
}

function openAddForm() {
  fireEvent.click(screen.getByTestId('add-rule-button'));
}

function submitForm() {
  fireEvent.click(screen.getByTestId('submit-rule-form'));
}

// ---- Tests ----

describe('AutomationRulesManager', () => {
  describe('initial rendering', () => {
    it('renders the title', () => {
      render(<AutomationRulesManager />);
      expect(screen.getByText('Automation Rules')).toBeTruthy();
    });

    it('shows Add Rule button', () => {
      render(<AutomationRulesManager />);
      expect(screen.getByTestId('add-rule-button')).toBeTruthy();
    });

    it('shows empty state when no rules are provided', () => {
      render(<AutomationRulesManager />);
      expect(screen.getByTestId('empty-state')).toBeTruthy();
    });

    it('does not show the rules table when empty', () => {
      render(<AutomationRulesManager />);
      expect(screen.queryByTestId('rules-table')).toBeNull();
    });

    it('renders rules table when initialRules is provided', () => {
      render(<AutomationRulesManager initialRules={mockRules} />);
      expect(screen.getByTestId('rules-table')).toBeTruthy();
    });

    it('renders all provided rules', () => {
      render(<AutomationRulesManager initialRules={mockRules} />);
      expect(screen.getByText('Move PDFs')).toBeTruthy();
      expect(screen.getByText('Rename Reports')).toBeTruthy();
    });

    it('displays rule descriptions', () => {
      render(<AutomationRulesManager initialRules={mockRules} />);
      expect(screen.getByText('Move PDF files to the documents folder')).toBeTruthy();
    });

    it('shows rule type badges', () => {
      render(<AutomationRulesManager initialRules={mockRules} />);
      expect(screen.getByText('File Type')).toBeTruthy();
      expect(screen.getByText('Naming')).toBeTruthy();
    });

    it('shows enabled/disabled status', () => {
      render(<AutomationRulesManager initialRules={mockRules} />);
      expect(screen.getByText('Enabled')).toBeTruthy();
      expect(screen.getByText('Disabled')).toBeTruthy();
    });
  });

  describe('form open/close', () => {
    it('opens the add form when Add Rule is clicked', () => {
      render(<AutomationRulesManager />);
      openAddForm();
      expect(screen.getByTestId('rule-form-overlay')).toBeTruthy();
    });

    it('shows "Add Rule" heading in add mode', () => {
      render(<AutomationRulesManager />);
      openAddForm();
      // There will be multiple elements with "Add Rule" text (button + modal heading)
      const headings = screen.getAllByText('Add Rule');
      expect(headings.length).toBeGreaterThanOrEqual(1);
    });

    it('closes the form when Cancel is clicked', () => {
      render(<AutomationRulesManager />);
      openAddForm();
      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByTestId('rule-form-overlay')).toBeNull();
    });

    it('closes the form when the close (✕) button is clicked', () => {
      render(<AutomationRulesManager />);
      openAddForm();
      fireEvent.click(screen.getByLabelText('Close form'));
      expect(screen.queryByTestId('rule-form-overlay')).toBeNull();
    });
  });

  describe('form validation', () => {
    it('shows an error when name is empty on submit', () => {
      render(<AutomationRulesManager />);
      openAddForm();
      submitForm();
      expect(screen.getByTestId('form-error')).toBeTruthy();
      expect(screen.getByText('Rule name is required.')).toBeTruthy();
    });

    it('does not close form when validation fails', () => {
      render(<AutomationRulesManager />);
      openAddForm();
      submitForm();
      expect(screen.getByTestId('rule-form-overlay')).toBeTruthy();
    });

    it('shows error for invalid JSON in action params', () => {
      render(<AutomationRulesManager />);
      openAddForm();
      fireEvent.change(getNameInput(), { target: { value: 'Test Rule' } });
      const paramsInput = screen.getByLabelText('Action 1 params') as HTMLInputElement;
      fireEvent.change(paramsInput, { target: { value: 'not valid json' } });
      submitForm();
      expect(screen.getByTestId('form-error')).toBeTruthy();
      expect(screen.getByText('Action params must be valid JSON.')).toBeTruthy();
    });

    it('clears form error when form is closed and reopened', () => {
      render(<AutomationRulesManager />);
      openAddForm();
      submitForm(); // trigger validation error
      fireEvent.click(screen.getByText('Cancel'));
      openAddForm();
      expect(screen.queryByTestId('form-error')).toBeNull();
    });
  });

  describe('adding rules', () => {
    it('adds a new rule and closes the form', () => {
      render(<AutomationRulesManager />);
      openAddForm();
      fireEvent.change(getNameInput(), { target: { value: 'Archive Images' } });
      submitForm();

      expect(screen.queryByTestId('rule-form-overlay')).toBeNull();
      expect(screen.getByText('Archive Images')).toBeTruthy();
    });

    it('calls onRulesChange when a rule is added', () => {
      const onRulesChange = jest.fn();
      render(<AutomationRulesManager onRulesChange={onRulesChange} />);
      openAddForm();
      fireEvent.change(getNameInput(), { target: { value: 'Tag Invoices' } });
      submitForm();

      expect(onRulesChange).toHaveBeenCalledTimes(1);
      const [updatedRules] = onRulesChange.mock.calls[0] as [Rule[]];
      expect(updatedRules).toHaveLength(1);
      expect(updatedRules[0].name).toBe('Tag Invoices');
    });

    it('assigns sequential priorities to added rules', () => {
      const onRulesChange = jest.fn();
      render(<AutomationRulesManager initialRules={mockRules} onRulesChange={onRulesChange} />);
      openAddForm();
      fireEvent.change(getNameInput(), { target: { value: 'Third Rule' } });
      submitForm();

      const [updatedRules] = onRulesChange.mock.calls[0] as [Rule[]];
      const priorities = updatedRules.map(r => r.priority).sort((a, b) => a - b);
      expect(priorities).toEqual([1, 2, 3]);
    });

    it('shows empty state after adding and then deleting the only rule', () => {
      render(<AutomationRulesManager />);
      openAddForm();
      fireEvent.change(getNameInput(), { target: { value: 'Temp Rule' } });
      submitForm();

      // Find the newly added rule and delete it
      const deleteBtn = screen.getByLabelText('Delete rule Temp Rule');
      fireEvent.click(deleteBtn);
      expect(screen.getByTestId('empty-state')).toBeTruthy();
    });
  });

  describe('editing rules', () => {
    it('opens the edit form with existing rule data', () => {
      render(<AutomationRulesManager initialRules={mockRules} />);
      fireEvent.click(screen.getByTestId('edit-rule-rule-1'));

      expect(screen.getByTestId('rule-form-overlay')).toBeTruthy();
      expect(getNameInput().value).toBe('Move PDFs');
    });

    it('shows "Edit Rule" heading in edit mode', () => {
      render(<AutomationRulesManager initialRules={mockRules} />);
      fireEvent.click(screen.getByTestId('edit-rule-rule-1'));
      expect(screen.getByText('Edit Rule')).toBeTruthy();
    });

    it('saves edits and closes the form', () => {
      const onRulesChange = jest.fn();
      render(<AutomationRulesManager initialRules={mockRules} onRulesChange={onRulesChange} />);
      fireEvent.click(screen.getByTestId('edit-rule-rule-1'));

      fireEvent.change(getNameInput(), { target: { value: 'Move PDFs - Updated' } });
      submitForm();

      expect(screen.queryByTestId('rule-form-overlay')).toBeNull();
      expect(screen.getByText('Move PDFs - Updated')).toBeTruthy();
      expect(screen.queryByText('Move PDFs')).toBeNull();
    });

    it('calls onRulesChange with updated rule on save', () => {
      const onRulesChange = jest.fn();
      render(<AutomationRulesManager initialRules={mockRules} onRulesChange={onRulesChange} />);
      fireEvent.click(screen.getByTestId('edit-rule-rule-1'));
      fireEvent.change(getNameInput(), { target: { value: 'Edited Rule' } });
      submitForm();

      const [updatedRules] = onRulesChange.mock.calls[0] as [Rule[]];
      const edited = updatedRules.find(r => r.id === 'rule-1');
      expect(edited?.name).toBe('Edited Rule');
    });

    it('prefills description in edit form', () => {
      render(<AutomationRulesManager initialRules={mockRules} />);
      fireEvent.click(screen.getByTestId('edit-rule-rule-1'));
      const descInput = screen.getByLabelText('Description') as HTMLTextAreaElement;
      expect(descInput.value).toBe('Move PDF files to the documents folder');
    });
  });

  describe('deleting rules', () => {
    it('removes a rule from the list', () => {
      render(<AutomationRulesManager initialRules={mockRules} />);
      fireEvent.click(screen.getByTestId('delete-rule-rule-1'));
      expect(screen.queryByText('Move PDFs')).toBeNull();
    });

    it('calls onRulesChange after deleting', () => {
      const onRulesChange = jest.fn();
      render(<AutomationRulesManager initialRules={mockRules} onRulesChange={onRulesChange} />);
      fireEvent.click(screen.getByTestId('delete-rule-rule-2'));

      expect(onRulesChange).toHaveBeenCalledTimes(1);
      const [updatedRules] = onRulesChange.mock.calls[0] as [Rule[]];
      expect(updatedRules).toHaveLength(1);
      expect(updatedRules[0].id).toBe('rule-1');
    });

    it('re-sequences priorities after deleting a rule', () => {
      const onRulesChange = jest.fn();
      render(<AutomationRulesManager initialRules={mockRules} onRulesChange={onRulesChange} />);
      fireEvent.click(screen.getByTestId('delete-rule-rule-1'));

      const [updatedRules] = onRulesChange.mock.calls[0] as [Rule[]];
      expect(updatedRules[0].priority).toBe(1);
    });
  });

  describe('reordering rules', () => {
    it('moves a rule up', () => {
      const onRulesChange = jest.fn();
      render(<AutomationRulesManager initialRules={mockRules} onRulesChange={onRulesChange} />);

      // Move rule-2 (index 1) up
      fireEvent.click(screen.getByLabelText('Move rule Rename Reports up'));

      const [updatedRules] = onRulesChange.mock.calls[0] as [Rule[]];
      expect(updatedRules[0].id).toBe('rule-2');
      expect(updatedRules[1].id).toBe('rule-1');
    });

    it('moves a rule down', () => {
      const onRulesChange = jest.fn();
      render(<AutomationRulesManager initialRules={mockRules} onRulesChange={onRulesChange} />);

      // Move rule-1 (index 0) down
      fireEvent.click(screen.getByLabelText('Move rule Move PDFs down'));

      const [updatedRules] = onRulesChange.mock.calls[0] as [Rule[]];
      expect(updatedRules[0].id).toBe('rule-2');
      expect(updatedRules[1].id).toBe('rule-1');
    });

    it('reassigns sequential priorities after reorder', () => {
      const onRulesChange = jest.fn();
      render(<AutomationRulesManager initialRules={mockRules} onRulesChange={onRulesChange} />);
      fireEvent.click(screen.getByLabelText('Move rule Move PDFs down'));

      const [updatedRules] = onRulesChange.mock.calls[0] as [Rule[]];
      expect(updatedRules[0].priority).toBe(1);
      expect(updatedRules[1].priority).toBe(2);
    });

    it('disables move-up on the first rule', () => {
      render(<AutomationRulesManager initialRules={mockRules} />);
      const moveUpBtn = screen.getByLabelText('Move rule Move PDFs up') as HTMLButtonElement;
      expect(moveUpBtn.disabled).toBe(true);
    });

    it('disables move-down on the last rule', () => {
      render(<AutomationRulesManager initialRules={mockRules} />);
      const moveDownBtn = screen.getByLabelText(
        'Move rule Rename Reports down'
      ) as HTMLButtonElement;
      expect(moveDownBtn.disabled).toBe(true);
    });
  });

  describe('toggling enabled status', () => {
    it('toggles a rule from enabled to disabled', () => {
      const onRulesChange = jest.fn();
      render(<AutomationRulesManager initialRules={mockRules} onRulesChange={onRulesChange} />);

      fireEvent.click(screen.getByLabelText('Toggle rule Move PDFs off'));

      const [updatedRules] = onRulesChange.mock.calls[0] as [Rule[]];
      expect(updatedRules.find(r => r.id === 'rule-1')?.enabled).toBe(false);
    });

    it('toggles a rule from disabled to enabled', () => {
      const onRulesChange = jest.fn();
      render(<AutomationRulesManager initialRules={mockRules} onRulesChange={onRulesChange} />);

      fireEvent.click(screen.getByLabelText('Toggle rule Rename Reports on'));

      const [updatedRules] = onRulesChange.mock.calls[0] as [Rule[]];
      expect(updatedRules.find(r => r.id === 'rule-2')?.enabled).toBe(true);
    });
  });

  describe('rule type support', () => {
    const ruleTypes = ['file_type', 'content', 'naming', 'folder_routing'] as const;

    it.each(ruleTypes)('supports rule type: %s', ruleType => {
      const onRulesChange = jest.fn();
      render(<AutomationRulesManager onRulesChange={onRulesChange} />);
      openAddForm();

      const typeSelect = screen.getByLabelText('Rule Type') as HTMLSelectElement;
      fireEvent.change(typeSelect, { target: { value: ruleType } });

      fireEvent.change(getNameInput(), { target: { value: `${ruleType} rule` } });
      submitForm();

      const [updatedRules] = onRulesChange.mock.calls[0] as [Rule[]];
      expect(updatedRules[0].type).toBe(ruleType);
    });

    it('resets condition field when rule type changes', () => {
      render(<AutomationRulesManager />);
      openAddForm();

      const typeSelect = screen.getByLabelText('Rule Type') as HTMLSelectElement;
      fireEvent.change(typeSelect, { target: { value: 'content' } });

      const conditionField = screen.getByLabelText('Condition 1 field') as HTMLInputElement;
      expect(conditionField.value).toBe('content.text');
    });

    it('defaults condition field to file.extension for file_type rules', () => {
      render(<AutomationRulesManager />);
      openAddForm();

      const conditionField = screen.getByLabelText('Condition 1 field') as HTMLInputElement;
      expect(conditionField.value).toBe('file.extension');
    });
  });

  describe('conditions editor', () => {
    it('shows the first condition row by default', () => {
      render(<AutomationRulesManager />);
      openAddForm();
      expect(screen.getByLabelText('Condition 1 field')).toBeTruthy();
    });

    it('adds a second condition row', () => {
      render(<AutomationRulesManager />);
      openAddForm();
      fireEvent.click(screen.getByText('+ Add Condition'));
      expect(screen.getByLabelText('Condition 2 field')).toBeTruthy();
    });

    it('removes a condition row', () => {
      render(<AutomationRulesManager />);
      openAddForm();
      fireEvent.click(screen.getByText('+ Add Condition'));
      expect(screen.getByLabelText('Condition 2 field')).toBeTruthy();

      fireEvent.click(screen.getByLabelText('Remove condition 1'));
      expect(screen.queryByLabelText('Condition 2 field')).toBeNull();
    });

    it('disables remove button when only one condition remains', () => {
      render(<AutomationRulesManager />);
      openAddForm();
      const removeBtn = screen.getByLabelText('Remove condition 1') as HTMLButtonElement;
      expect(removeBtn.disabled).toBe(true);
    });
  });

  describe('actions editor', () => {
    it('shows the first action row by default', () => {
      render(<AutomationRulesManager />);
      openAddForm();
      expect(screen.getByLabelText('Action 1 type')).toBeTruthy();
    });

    it('adds a second action row', () => {
      render(<AutomationRulesManager />);
      openAddForm();
      fireEvent.click(screen.getByText('+ Add Action'));
      expect(screen.getByLabelText('Action 2 type')).toBeTruthy();
    });

    it('removes an action row', () => {
      render(<AutomationRulesManager />);
      openAddForm();
      fireEvent.click(screen.getByText('+ Add Action'));
      fireEvent.click(screen.getByLabelText('Remove action 1'));
      expect(screen.queryByLabelText('Action 2 type')).toBeNull();
    });

    it('disables remove button when only one action remains', () => {
      render(<AutomationRulesManager />);
      openAddForm();
      const removeBtn = screen.getByLabelText('Remove action 1') as HTMLButtonElement;
      expect(removeBtn.disabled).toBe(true);
    });
  });
});
