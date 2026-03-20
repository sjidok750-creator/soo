import type { CategoryConfig, CategoryKey } from '../types';

export function categorize(merchant: string, categories: CategoryConfig[]): CategoryKey | null {
  const lower = merchant.toLowerCase();
  for (const cat of categories) {
    if (cat.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      return cat.key;
    }
  }
  return null;
}
