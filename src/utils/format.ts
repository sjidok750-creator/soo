export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export function formatAmount(amount: number): string {
  return amount.toLocaleString();
}

export function formatMonth(month: string): string {
  const [year, mon] = month.split('-');
  const date = new Date(parseInt(year), parseInt(mon) - 1, 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}
