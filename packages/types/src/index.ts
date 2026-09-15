export type LoanStatus = 'active' | 'completed' | 'paused';

export interface Loan {
  id: string;
  name: string;
  originalAmount: number;
  currentBalance: number;
  paymentAmount: number;
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
