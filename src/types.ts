export type CategoryKey = string;

export interface CategoryConfig {
  key: CategoryKey;
  name: string;
  color: string;
  keywords: string[];
}

export type TabKey = 'input' | 'dashboard' | 'settings';

export interface Expense {
  id: string;
  merchant: string;
  amount: number;
  date: string;
  category: CategoryKey;
  manualCategory: boolean;
  memo?: string;
}

export interface MonthlySummary {
  total: number;
  byCategory: Record<CategoryKey, number>;
  count: number;
}
