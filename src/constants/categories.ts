// Auto-filing categories. Images come from the vision model, documents from the LLM.
export const IMAGE_CATEGORIES = [
  { id: 'photos', name: 'Photos' },
  { id: 'screenshots', name: 'Screenshots' },
  { id: 'document-scans', name: 'Document scans' },
  { id: 'receipts', name: 'Receipts' },
] as const;

export const DOCUMENT_CATEGORIES = [
  { id: 'contracts', name: 'Contracts' },
  { id: 'invoices', name: 'Invoices' },
  { id: 'notes', name: 'Notes' },
  { id: 'uncategorized', name: 'Uncategorized' },
] as const;

const ALL_CATEGORIES = [...IMAGE_CATEGORIES, ...DOCUMENT_CATEGORIES];

export function getCategoryName(id: string) {
  return ALL_CATEGORIES.find((category) => category.id === id)?.name ?? id;
}
