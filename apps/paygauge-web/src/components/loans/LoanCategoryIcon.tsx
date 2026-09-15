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
  { value: 'jewelry', label: 'Jewelry' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'home', label: 'Home' },
  { value: 'education', label: 'Education' },
  { value: 'medical', label: 'Medical' },
  { value: 'travel', label: 'Travel' },
  { value: 'tools', label: 'Tools' },
  { value: 'business', label: 'Business' },
  { value: 'personal', label: 'Personal' },
  { value: 'other', label: 'Payment' },
];

export function LoanCategoryIcon({ category }: { category?: LoanCategory | string | null }) {
  const Icon = categoryIcons[(category as LoanCategory) ?? 'personal'] ?? categoryIcons.personal;
  return <Icon aria-hidden="true" />;
}

export function categoryTone(category?: LoanCategory | string | null) {
  if (category === 'vehicle') return 'orange';
  if (category === 'furniture' || category === 'electronics' || category === 'home' || category === 'tools') return 'green';
  if (category === 'medical') return 'red';
  return '';
}

export function inferLoanCategory(name: string): LoanCategory {
  const normalized = name.toLowerCase();
  const rules: { category: LoanCategory; terms: string[] }[] = [
    { category: 'jewelry', terms: ['ring', 'jewel', 'diamond', 'engagement', 'wedding', 'watch', 'necklace', 'bracelet'] },
    { category: 'vehicle', terms: ['truck', 'car', 'auto', 'vehicle', 'motorcycle', 'bike', 'van', 'suv', 'jeep', 'boat', 'rv'] },
    { category: 'furniture', terms: ['furniture', 'couch', 'sofa', 'chair', 'table', 'bed', 'mattress', 'dresser', 'recliner'] },
    { category: 'electronics', terms: ['laptop', 'computer', 'phone', 'tablet', 'tv', 'television', 'camera', 'console', 'electronics', 'iphone', 'macbook', 'pc'] },
    { category: 'home', terms: ['house', 'home', 'mortgage', 'roof', 'hvac', 'appliance', 'washer', 'dryer', 'fridge', 'renovation', 'remodel'] },
    { category: 'education', terms: ['school', 'student', 'college', 'tuition', 'education', 'university', 'bootcamp', 'class'] },
    { category: 'medical', terms: ['medical', 'dental', 'doctor', 'hospital', 'health', 'surgery', 'orthodontic', 'braces', 'vision'] },
    { category: 'travel', terms: ['travel', 'vacation', 'trip', 'flight', 'hotel', 'cruise'] },
    { category: 'tools', terms: ['tool', 'tools', 'equipment', 'mower', 'tractor', 'trailer', 'workshop'] },
    { category: 'business', terms: ['business', 'office', 'company', 'startup', 'inventory'] },
    { category: 'personal', terms: ['personal', 'loan', 'installment', 'finance', 'financing'] },
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
