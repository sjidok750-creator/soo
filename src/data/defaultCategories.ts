import type { CategoryConfig } from '../types';

export const defaultCategories: CategoryConfig[] = [
  { key: 'meals', name: 'Meals & Dining', color: '#E8694A', keywords: ['restaurant', 'cafe', 'coffee', 'lunch', 'dinner', 'food', 'bakery', 'bistro'] },
  { key: 'transport', name: 'Transportation', color: '#0D9488', keywords: ['taxi', 'uber', 'bus', 'train', 'flight', 'parking', 'gas', 'fuel', 'toll'] },
  { key: 'accommodation', name: 'Accommodation', color: '#6366F1', keywords: ['hotel', 'inn', 'motel', 'lodge', 'airbnb', 'resort'] },
  { key: 'office', name: 'Office Supplies', color: '#F59E0B', keywords: ['stationery', 'supplies', 'equipment', 'print', 'office', 'paper'] },
  { key: 'entertainment', name: 'Entertainment', color: '#EC4899', keywords: ['entertainment', 'event', 'ticket', 'theater', 'movie', 'golf'] },
  { key: 'other', name: 'Other', color: '#94A3B8', keywords: [] },
];
