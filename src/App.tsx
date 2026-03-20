import { useState } from 'react';
import type { CategoryConfig, CategoryKey, TabKey } from './types';
import { defaultCategories } from './data/defaultCategories';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useExpenses } from './hooks/useExpenses';
import { getCurrentMonth } from './utils/format';
import Layout from './components/Layout';
import ExpenseForm from './components/ExpenseForm';
import ExpenseList from './components/ExpenseList';
import Dashboard from './components/Dashboard';
import CategoryManager from './components/CategoryManager';
import ApiKeySettings from './components/ApiKeySettings';
import FileManagerCompact from './components/FileManagerCompact';
import { UpdatePrompt } from './components/UpdatePrompt';
import { IOSInstallGuide } from './components/IOSInstallGuide';

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('input');
  const [month, setMonth] = useState(getCurrentMonth());
  const [categories, setCategories, resetCategories] = useLocalStorage<CategoryConfig[]>(
    'categories',
    defaultCategories
  );
  const [apiKey, setApiKey] = useLocalStorage<string>('geminiApiKey', '');

  const {
    expenses,
    addExpense,
    updateExpense,
    deleteExpense,
    getMonthlySummary,
    getBarChartData,
    importExpenses,
    clearExpenses,
  } = useExpenses();

  const summary = getMonthlySummary(month, categories);
  const barChartData = getBarChartData(month, categories);

  const handleImportData = (newExpenses: typeof expenses, newCategories: typeof categories) => {
    importExpenses(newExpenses);
    setCategories(newCategories);
  };

  const handleClearData = () => {
    clearExpenses();
    resetCategories();
  };

  return (
    <>
      <Layout activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'input' && (
          <>
            <ExpenseForm categories={categories} onAdd={addExpense} apiKey={apiKey} />
            <ExpenseList
              expenses={expenses}
              month={month}
              onMonthChange={setMonth}
              categories={categories}
              onUpdate={updateExpense}
              onDelete={deleteExpense}
            />
            <FileManagerCompact
              expenses={expenses}
              categories={categories}
              onImport={handleImportData}
              onClear={handleClearData}
            />
          </>
        )}

        {activeTab === 'dashboard' && (
          <Dashboard
            month={month}
            onMonthChange={setMonth}
            summary={summary}
            barChartData={barChartData as Array<{ month: string; total: number } & Record<CategoryKey, number>>}
            categories={categories}
          />
        )}

        {activeTab === 'settings' && (
          <>
            <ApiKeySettings apiKey={apiKey} onSave={setApiKey} />
            <CategoryManager
              categories={categories}
              onUpdate={setCategories}
              onReset={resetCategories}
            />
          </>
        )}
      </Layout>

      {/* PWA Components */}
      <UpdatePrompt />
      <IOSInstallGuide />
    </>
  );
}

export default App;
