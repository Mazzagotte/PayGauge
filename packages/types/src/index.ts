export type PaymentType = 'payoff' | 'ongoing';
export type PaidWith = 'bank-account' | 'credit-card' | 'other';
export type LoanStatus = 'active' | 'completed' | 'paused';

export interface Loan {
  id: string;
  name: string;
  originalAmount: number;
  currentBalance: number;
  paymentAmount: number;
  paymentType: PaymentType;
  paidWith: PaidWith;
  totalPayments?: number;
  paymentsMade: number;
  dueDay?: number;
  autopay: boolean;
  status: LoanStatus;
}

export interface Payment {
  id: string;
  loanId?: string;
  billId?: string;
  amount: number;
  paidAt: string;
  note?: string;
}
