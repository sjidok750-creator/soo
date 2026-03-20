import { useState } from 'react';
import type { Expense, CategoryConfig, MonthlySummary, CategoryKey } from '../types';

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    try {
      const stored = localStorage.getItem('card-expenses');
      return stored ? (JSON.parse(stored) as Expense[]) : [];
    } catch {
      return [];
    }
  });

  const save = (list: Expense[]) => {
    setExpenses(list);
    localStorage.setItem('card-expenses', JSON.stringify(list));
  };

  const addExpense = (expense: Expense) => save([expense, ...expenses]);

  const updateExpense = (id: string, updates: Partial<Expense>) =>
    save(expenses.map((e) => (e.id === id ? { ...e, ...updates } : e)));

  const deleteExpense = (id: string) => save(expenses.filter((e) => e.id !== id));

  const getMonthlySummary = (month: string, categories: CategoryConfig[]): MonthlySummary => {
    const list = expenses.filter((e) => e.date.startsWith(month));
    const total = list.reduce((s, e) => s + e.amount, 0);
    const byCategory: Record<CategoryKey, number> = {};
    for (const cat of categories) {
      byCategory[cat.key] = list
        .filter((e) => e.category === cat.key)
        .reduce((s, e) => s + e.amount, 0);
    }
    return { total, byCategory, count: list.length };
  };

  const getBarChartData = (month: string, categories: CategoryConfig[]) => {
    const [year, mon] = month.split('-').map(Number);
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      let m = mon - i;
      let y = year;
      while (m <= 0) { m += 12; y--; }
      months.push(`${y}-${String(m).padStart(2, '0')}`);
    }
    return months.map((m) => {
      const list = expenses.filter((e) => e.date.startsWith(m));
      const total = list.reduce((s, e) => s + e.amount, 0);
      const catData: Record<CategoryKey, number> = {};
      for (const cat of categories) {
        catData[cat.key] = list
          .filter((e) => e.category === cat.key)
          .reduce((s, e) => s + e.amount, 0);
      }
      return { month: m, total, ...catData };
    });
  };

  const importExpenses = (newExpenses: Expense[]) => save(newExpenses);
  const clearExpenses = () => save([]);

  return {
    expenses,
    addExpense,
    updateExpense,
    deleteExpense,
    getMonthlySummary,
    getBarChartData,
    importExpenses,
    clearExpenses,
  };
}
