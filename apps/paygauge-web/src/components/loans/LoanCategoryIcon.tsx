import {
  Armchair,
  BriefcaseBusiness,
  Car,
  CreditCard,
  Gem,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  Landmark,
  Plane,
  Wrench,
} from 'lucide-react';

import type { LoanCategory } from '../../lib/api';

const categoryIcons = {
  loan: Landmark,
  bill: CreditCard,
  subscription: CreditCard,
  financing: Landmark,
  insurance: HeartPulse,
  membership: BriefcaseBusiness,
  'rent-mortgage': Home,
  jewelry: Gem,
  vehicle: Car,
  furniture: Armchair,
  electronics: Laptop,
  home: Home,
  education: GraduationCap,
  medical: HeartPulse,
  travel: Plane,
  tools: Wrench,
  business: BriefcaseBusiness,
  personal: Landmark,
  other: CreditCard,
};

export const loanCategories: { value: LoanCategory; label: string }[] = [
  { value: 'loan', label: 'Loan' },
  { value: 'bill', label: 'Bill' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'financing', label: 'Financing' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'membership', label: 'Membership' },
  { value: 'rent-mortgage', label: 'Rent / Mortgage' },
  { value: 'other', label: 'Other' },
];

export function LoanCategoryIcon({ category }: { category?: LoanCategory | string | null }) {
  const Icon = categoryIcons[(category as LoanCategory) ?? 'personal'] ?? categoryIcons.personal;
  return <Icon aria-hidden="true" />;
}

export function categoryTone(category?: LoanCategory | string | null) {
  if (category === 'financing' || category === 'rent-mortgage') return 'orange';
  if (category === 'subscription' || category === 'membership' || category === 'bill') return 'green';
  if (category === 'insurance') return 'red';
  return '';
}

export function inferLoanCategory(name: string): LoanCategory {
  const normalized = name.toLowerCase();
  const rules: { category: LoanCategory; terms: string[] }[] = [
    { category: 'financing', terms: ['ring', 'jewel', 'diamond', 'engagement', 'wedding', 'truck', 'car', 'auto', 'vehicle', 'furniture', 'couch', 'sofa', 'laptop', 'computer', 'phone', 'installment', 'finance', 'financing'] },
    { category: 'rent-mortgage', terms: ['house', 'home', 'mortgage', 'rent', 'roof', 'hvac', 'appliance', 'washer', 'dryer', 'fridge', 'renovation', 'remodel'] },
    { category: 'insurance', terms: ['insurance', 'medical', 'dental', 'health', 'vision'] },
    { category: 'membership', terms: ['membership', 'gym', 'club'] },
    { category: 'subscription', terms: ['netflix', 'internet', 'spotify', 'subscription', 'streaming', 'phone'] },
    { category: 'bill', terms: ['bill', 'utility', 'electric', 'water', 'power', 'cable'] },
    { category: 'loan', terms: ['loan', 'student', 'school', 'college', 'tuition', 'business'] },
  ];

  const match = rules
    .map((rule) => ({
      category: rule.category,
      score: rule.terms.reduce((total, term) => total + (normalized.includes(term) ? term.length : 0), 0),
    }))
    .sort((a, b) => b.score - a.score)[0];

  if (match?.score) return match.category;

  return 'personal';
}

export function categoryConfidence(name: string, category: LoanCategory) {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return 'Waiting for a loan name';
  if (category === 'personal') return 'Best general fit';
  return 'Strong match';
}
