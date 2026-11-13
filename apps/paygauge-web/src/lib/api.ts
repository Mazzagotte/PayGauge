export type LoanStatus = 'active' | 'completed' | 'archived';
export type LoanRecurrence = 'monthly' | 'biweekly' | 'weekly' | 'quarterly' | 'annual';

export type PaymentType = 'payoff' | 'ongoing';
export type PaidWith = 'bank-account' | 'credit-card' | 'other';
export type LoanCategory =
  | 'loan'
  | 'bill'
  | 'subscription'
  | 'financing'
  | 'insurance'
  | 'membership'
  | 'rent-mortgage'
  | 'jewelry'
  | 'vehicle'
  | 'furniture'
  | 'electronics'
  | 'home'
  | 'education'
  | 'medical'
  | 'travel'
  | 'tools'
  | 'business'
  | 'personal'
  | 'other';

export type Loan = {
  id: string;
  name: string;
  category: LoanCategory;
  payment_type: PaymentType;
  paid_with: PaidWith;
  description: string | null;
  original_amount: string;
  current_balance: string;
  payment_amount: string;
  total_number_of_payments: number | null;
  payments_made: number;
  payments_remaining: number;
  interest_rate: string | null;
  start_date: string | null;
  due_day: number | null;
  recurrence: LoanRecurrence;
  next_due_date: string | null;
  estimated_payoff_date: string | null;
  autopay: boolean;
  status: LoanStatus;
  progress_percentage: number;
  created_at: string;
  updated_at: string;
};

export function isPayoffTargetCategory(category: LoanCategory): boolean {
  return category === 'loan' || category === 'financing';
}

export type Payment = {
  id: string;
  loan_id: string;
  amount: string;
  payment_date: string;
  payment_number: number;
  notes: string | null;
  source: string;
  created_at: string;
  milestone?: string | null;
  notification_title?: string | null;
  notification_body?: string | null;
  undo?: { before: Loan; after: Loan };
};

export type DashboardLoanSummary = Pick<
  Loan,
  'id' | 'name' | 'category' | 'payment_type' | 'paid_with' | 'current_balance' | 'payment_amount' | 'interest_rate' | 'payments_remaining' | 'progress_percentage' | 'next_due_date' | 'due_day' | 'recurrence' | 'estimated_payoff_date' | 'autopay' | 'status'
>;

export type DashboardSummary = {
  total_remaining_balance: string;
  total_monthly_payments: string;
  current_month_due: string;
  current_month_paid: string;
  loan_balance: string;
  total_original_debt: string;
  expense_due: string;
  expense_paid: string;
  total_payments_remaining: number;
  loans_completed: number;
  next_payment: DashboardLoanSummary | null;
  upcoming_payments: DashboardLoanSummary[];
  active_loans: DashboardLoanSummary[];
};

export type NotificationPreferences = {
  id: string;
  payment_reminders: boolean;
  autopay_reminders: boolean;
  payment_confirmations: boolean;
  milestone_alerts: boolean;
  days_before_due: number;
  autopay_confirmation_delay_hours: number;
  quiet_hours_start: string;
  quiet_hours_end: string;
  timezone: string;
  updated_at: string | null;
};

export type NotificationItem = {
  id: string;
  loan_id: string;
  loan_name: string;
  category: string;
  type: string;
  title: string;
  body: string;
  scheduled_for: string;
  amount: string;
  payments_remaining_after: number;
  action_required: boolean;
};

export type BackupPayload = {
  app: 'PayGauge';
  exported_at: string;
  loans: Loan[];
  payments: Payment[];
  notification_preferences?: NotificationPreferences;
  monthly_take_home_income?: string | null;
};

export type BackupImportResult = {
  imported_loans: number;
  imported_payments: number;
  skipped_payments: number;
};

type AppState = {
  loans: Loan[];
  payments: Payment[];
  notificationPreferences: NotificationPreferences;
  monthlyTakeHomeIncome: string | null;
};

const STORAGE_KEY = 'paygauge.localState';
const SQLITE_DATABASE = 'paygauge';
const SQLITE_STATE_KEY = 'state';

const defaultNotificationPreferences: NotificationPreferences = {
  id: 'default',
  payment_reminders: true,
  autopay_reminders: true,
  payment_confirmations: true,
  milestone_alerts: true,
  days_before_due: 2,
  autopay_confirmation_delay_hours: 6,
  quiet_hours_start: '22:00:00',
  quiet_hours_end: '07:00:00',
  timezone: 'local',
  updated_at: null,
};

const emptyState: AppState = {
  loans: [],
  payments: [],
  notificationPreferences: defaultNotificationPreferences,
  monthlyTakeHomeIncome: null,
};

let sqliteConnection: import('@capacitor-community/sqlite').SQLiteConnection | null = null;
let sqliteDb: import('@capacitor-community/sqlite').SQLiteDBConnection | null = null;
let sqliteInitialization: Promise<import('@capacitor-community/sqlite').SQLiteDBConnection | null> | null = null;
let sqliteAvailable: boolean | null = null;

async function readState(): Promise<AppState> {
  const sqliteState = await readSQLiteState();
  if (sqliteState) {
    const normalized = normalizeState(sqliteState);
    if (hasScheduleChanges(sqliteState, normalized)) await writeState(normalized);
    return normalized;
  }

  if (typeof window === 'undefined') return emptyState;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return emptyState;
  const rawState = JSON.parse(stored) as AppState;
  const normalized = normalizeState(rawState);
  if (hasScheduleChanges(rawState, normalized)) await writeState(normalized);
  return normalized;
}

async function writeState(state: AppState): Promise<void> {
  const normalized = normalizeState(state);
  if (!(await writeSQLiteState(normalized)) && typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') window.dispatchEvent(new Event('paygauge:state-changed'));
  // Keep the Android home-screen widget current (native builds only).
  if (typeof window !== 'undefined' && (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) {
    void import('./widget').then(({ syncWidget }) => syncWidget(normalized.loans)).catch(() => undefined);
  }
}

async function readSQLiteState(): Promise<AppState | null> {
  const db = await getSQLiteDb();
  if (!db) return null;
  const result = await db.query('SELECT value FROM app_state WHERE key = ?', [SQLITE_STATE_KEY]);
  const row = result.values?.[0];
  return row?.value ? JSON.parse(row.value) as AppState : null;
}

async function writeSQLiteState(state: AppState): Promise<boolean> {
  const db = await getSQLiteDb();
  if (!db) return false;
  await db.run('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', [SQLITE_STATE_KEY, JSON.stringify(state)]);
  return true;
}

async function getSQLiteDb() {
  if (sqliteAvailable === false) return null;
  if (sqliteInitialization) return sqliteInitialization;
  if (sqliteDb) return sqliteDb;
  if (typeof window === 'undefined') return null;

  sqliteInitialization = initializeSQLiteDb();
  return sqliteInitialization;
}

async function initializeSQLiteDb() {
  try {
    const [{ Capacitor }, sqliteModule] = await Promise.all([import('@capacitor/core'), import('@capacitor-community/sqlite')]);
    if (!Capacitor.isNativePlatform()) {
      sqliteAvailable = false;
      return null;
    }

    const { CapacitorSQLite, SQLiteConnection } = sqliteModule;
    sqliteConnection = new SQLiteConnection(CapacitorSQLite);
    sqliteDb = await sqliteConnection.createConnection(SQLITE_DATABASE, false, 'no-encryption', 1, false);
    await sqliteDb.open();
    await sqliteDb.execute('CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)');
    sqliteAvailable = true;
    return sqliteDb;
  } catch (error) {
    console.error('PayGauge SQLite initialization failed', error);
    throw error;
  }
}

function normalizeState(state: Partial<AppState>): AppState {
  const payments = (state.payments ?? []).map(payment => payment.undo ? {
    ...payment,
    undo: {
      before: { ...payment.undo.before },
      after: { ...payment.undo.after },
    },
  } : payment).sort(comparePaymentsDesc);
  const loans = (state.loans ?? []).map(applyLoanMetrics);
  return {
    loans: reconcileMonthlyScheduleFromPayments(loans, payments).sort(compareLoans),
    payments,
    notificationPreferences: {
      ...defaultNotificationPreferences,
      ...(state.notificationPreferences ?? {}),
    },
    monthlyTakeHomeIncome: state.monthlyTakeHomeIncome ?? null,
  };
}

function hasScheduleChanges(rawState: Partial<AppState>, normalized: AppState) {
  return normalized.loans.some(loan => rawState.loans?.find(item => item.id === loan.id)?.next_due_date !== loan.next_due_date) ||
    normalized.payments.some(payment => {
      const original = rawState.payments?.find(item => item.id === payment.id)?.undo;
      return payment.undo && original && (
        payment.undo.before.next_due_date !== original.before.next_due_date ||
        payment.undo.before.estimated_payoff_date !== original.before.estimated_payoff_date ||
        payment.undo.after.next_due_date !== original.after.next_due_date ||
        payment.undo.after.estimated_payoff_date !== original.after.estimated_payoff_date
      );
    });
}

function reconcileMonthlyScheduleFromPayments(loans: Loan[], payments: Payment[]) {
  const today = currentLocalDate();
  const monthStart = `${today.slice(0, 7)}-01`;
  const [year, month] = today.split('-').map(Number);
  const currentMonthDue = (dueDay: number) => {
    const date = clampDate(year, month - 1, dueDay);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const nextMonthDue = (dueDay: number) => {
    const date = clampDate(year, month, dueDay);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  return loans.map(loan => {
    if (loan.status !== 'active' || loan.recurrence !== 'monthly' || !loan.due_day ||
      !payments.some(payment => payment.loan_id === loan.id && Number(payment.amount) > 0 &&
        payment.payment_date >= monthStart && payment.payment_date <= today)) return loan;

    const followingDueDate = nextMonthDue(loan.due_day);
    const repairedLoan = !loan.next_due_date || loan.next_due_date < followingDueDate
      ? applyLoanMetrics({ ...loan, next_due_date: followingDueDate })
      : loan;
    const latestPayment = payments
      .filter(payment => payment.loan_id === loan.id && payment.payment_date >= monthStart && payment.payment_date <= today)
      .sort((a, b) => b.payment_date.localeCompare(a.payment_date) || b.payment_number - a.payment_number)[0];
    if (latestPayment?.undo && latestPayment.payment_number === loan.payments_made &&
      matchesExceptSchedule(latestPayment.undo.after, loan)) {
      if (!latestPayment.undo.before.next_due_date || latestPayment.undo.before.next_due_date < currentMonthDue(loan.due_day)) {
        latestPayment.undo.before = applyLoanMetrics({ ...latestPayment.undo.before, next_due_date: currentMonthDue(loan.due_day) });
      }
      latestPayment.undo.after = repairedLoan;
    }
    return repairedLoan;
  });
}

function matchesExceptSchedule(a: Loan, b: Loan) {
  const comparableEntries = (loan: Loan) => Object.entries(loan)
    .filter(([key]) => key !== 'next_due_date' && key !== 'estimated_payoff_date')
    .sort(([aKey], [bKey]) => aKey.localeCompare(bKey));
  return JSON.stringify(comparableEntries(a)) === JSON.stringify(comparableEntries(b));
}

export async function apiFetch<T>(): Promise<T> {
  throw new Error('Tally is local-first. HTTP API calls are disabled in the bundled app.');
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const state = await readState();
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const activeLoans = state.loans.filter((loan) => loan.status === 'active').sort(compareLoans);
  const activeLoanIds = new Set(activeLoans.map((loan) => loan.id));
  const payoffLoans = activeLoans.filter((loan) => loan.payment_type === 'payoff');
  const expenseLoans = activeLoans.filter((loan) => loan.payment_type === 'ongoing');
  const completedLoans = state.loans.filter((loan) => loan.status === 'completed');
  const upcomingPayments = activeLoans.filter((loan) => loan.next_due_date);

  return {
    total_remaining_balance: money(activeLoans.reduce((total, loan) => total + Number(loan.current_balance), 0)),
    total_monthly_payments: money(activeLoans.reduce((total, loan) => total + Number(loan.payment_amount), 0)),
    current_month_due: money(activeLoans.reduce((total, loan) => total + scheduledAmountForMonth(loan, monthStart, monthEnd), 0)),
    current_month_paid: money(state.payments.filter((payment) => {
      const paymentDate = new Date(`${payment.payment_date}T00:00:00`);
      return activeLoanIds.has(payment.loan_id) && paymentDate >= monthStart && paymentDate <= monthEnd;
    }).reduce((total, payment) => total + Number(payment.amount), 0)),
    loan_balance: money(payoffLoans.reduce((total, loan) => total + Number(loan.current_balance), 0)),
    total_original_debt: money(payoffLoans.reduce((total, loan) => total + Math.max(Number(loan.original_amount), Number(loan.current_balance)), 0)),
    expense_due: money(expenseLoans.reduce((total, loan) => total + scheduledAmountForMonth(loan, monthStart, monthEnd), 0)),
    expense_paid: money(state.payments.filter((payment) => {
      const paymentDate = new Date(`${payment.payment_date}T00:00:00`);
      return expenseLoans.some((loan) => loan.id === payment.loan_id) && paymentDate >= monthStart && paymentDate <= monthEnd;
    }).reduce((total, payment) => total + Number(payment.amount), 0)),
    total_payments_remaining: activeLoans.filter((loan) => loan.payment_type === 'payoff').reduce((total, loan) => total + loan.payments_remaining, 0),
    loans_completed: completedLoans.length,
    next_payment: upcomingPayments[0] ? toDashboardLoan(upcomingPayments[0]) : null,
    upcoming_payments: upcomingPayments.slice(0, 5).map(toDashboardLoan),
    active_loans: activeLoans.map(toDashboardLoan),
  };
}

export async function getLoans(): Promise<Loan[]> {
  return (await readState()).loans;
}

export async function getLoan(id: string): Promise<Loan> {
  const loan = (await readState()).loans.find((item) => item.id === id);
  if (!loan) throw new Error('Loan not found');
  return loan;
}

export async function getLoanPayments(id: string): Promise<Payment[]> {
  return (await readState()).payments.filter((payment) => payment.loan_id === id).sort(comparePaymentsDesc);
}

export async function getPayments(): Promise<Payment[]> {
  return (await readState()).payments;
}

export type IncomeBreakdown = {
  monthlyIncome: string | null;
  month: string;
  groups: { key: 'debt' | 'bills' | 'housing'; label: string; scheduled: string; paid: string }[];
};

export async function getIncomeBreakdown(): Promise<IncomeBreakdown> {
  const state = await readState();
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const definitions = [
    { key: 'debt', label: 'Debt payments' },
    { key: 'bills', label: 'Other recurring bills' },
    { key: 'housing', label: 'Rent / mortgage' },
  ] as const;
  const groupKey = (loan: Loan) => loan.payment_type === 'payoff' ? 'debt' : loan.category === 'rent-mortgage' ? 'housing' : 'bills';
  return {
    monthlyIncome: state.monthlyTakeHomeIncome,
    month: new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(monthStart),
    groups: definitions.map(group => ({
      ...group,
      scheduled: money(state.loans.filter(loan => loan.status === 'active' && groupKey(loan) === group.key)
        .reduce((total, loan) => total + scheduledAmountForMonth(loan, monthStart, monthEnd), 0)),
      paid: money(state.payments.filter(payment => {
        const account = state.loans.find(loan => loan.id === payment.loan_id);
        const date = new Date(`${payment.payment_date}T00:00:00`);
        return account && groupKey(account) === group.key && date >= monthStart && date <= monthEnd && date <= today;
      }).reduce((total, payment) => total + Number(payment.amount), 0)),
    })),
  };
}

export async function updateMonthlyIncome(value: string): Promise<void> {
  if (!/^\d+(\.\d{1,2})?$/.test(value) || !Number.isFinite(Number(value)) || Number(value) <= 0) {
    throw new Error('Enter a monthly take-home amount greater than zero, with up to two decimal places.');
  }
  const state = await readState();
  state.monthlyTakeHomeIncome = money(value);
  await writeState(state);
}

export async function createLoan(payload: Record<string, unknown>): Promise<Loan> {
  const state = await readState();
  const now = new Date().toISOString();
  const loan = applyLoanMetrics({
    id: crypto.randomUUID(),
    name: String(payload.name ?? ''),
    category: (payload.category as LoanCategory | undefined) ?? 'personal',
    payment_type: (payload.payment_type as PaymentType | undefined) ?? 'payoff',
    paid_with: (payload.paid_with as PaidWith | undefined) ?? 'other',
    description: payload.description ? String(payload.description) : null,
    original_amount: money(payload.original_amount),
    current_balance: money(payload.current_balance),
    payment_amount: money(payload.payment_amount),
    total_number_of_payments: numberOrNull(payload.total_number_of_payments),
    payments_made: Number(payload.payments_made ?? 0),
    payments_remaining: 0,
    interest_rate: payload.interest_rate == null ? null : String(payload.interest_rate),
    start_date: stringOrNull(payload.start_date),
    due_day: numberOrNull(payload.due_day),
    recurrence: (payload.recurrence as LoanRecurrence | undefined) ?? 'monthly',
    next_due_date: stringOrNull(payload.next_due_date),
    estimated_payoff_date: stringOrNull(payload.estimated_payoff_date),
    autopay: Boolean(payload.autopay),
    status: (payload.status as LoanStatus | undefined) ?? 'active',
    progress_percentage: 0,
    created_at: now,
    updated_at: now,
  });
  state.loans.push(loan);
  await writeState(state);
  return loan;
}

export async function updateLoan(id: string, payload: Record<string, unknown>): Promise<Loan> {
  const state = await readState();
  const index = state.loans.findIndex((loan) => loan.id === id);
  if (index === -1) throw new Error('Loan not found');

  const current = state.loans[index];
  const next: Loan = {
    ...current,
    ...payload,
    original_amount: payload.original_amount == null ? current.original_amount : money(payload.original_amount),
    current_balance: payload.current_balance == null ? current.current_balance : money(payload.current_balance),
    payment_amount: payload.payment_amount == null ? current.payment_amount : money(payload.payment_amount),
    total_number_of_payments: payload.total_number_of_payments === undefined ? current.total_number_of_payments : numberOrNull(payload.total_number_of_payments),
    payments_made: payload.payments_made === undefined ? current.payments_made : Number(payload.payments_made),
    interest_rate: payload.interest_rate === undefined ? current.interest_rate : stringOrNull(payload.interest_rate),
    start_date: payload.start_date === undefined ? current.start_date : stringOrNull(payload.start_date),
    due_day: payload.due_day === undefined ? current.due_day : numberOrNull(payload.due_day),
    recurrence: (payload.recurrence as LoanRecurrence | undefined) ?? current.recurrence,
    next_due_date: payload.next_due_date === undefined ? current.next_due_date : stringOrNull(payload.next_due_date),
    estimated_payoff_date: payload.estimated_payoff_date === undefined ? current.estimated_payoff_date : stringOrNull(payload.estimated_payoff_date),
    autopay: payload.autopay === undefined ? current.autopay : Boolean(payload.autopay),
    status: (payload.status as LoanStatus | undefined) ?? current.status,
    updated_at: new Date().toISOString(),
  };

  if ((payload.start_date !== undefined || payload.due_day !== undefined) && payload.next_due_date === undefined) {
    next.next_due_date = initialNextDueDate(next.start_date, next.due_day);
  }

  state.loans[index] = applyLoanMetrics(next);
  await writeState(state);
  return state.loans[index];
}

export async function advanceLoanSchedule(id: string, months = 1): Promise<Loan> {
  const state = await readState();
  const index = state.loans.findIndex((loan) => loan.id === id);
  if (index === -1) throw new Error('Loan not found');

  const loan = state.loans[index];
  if (!loan.next_due_date || !loan.due_day) throw new Error('This loan has no recurring schedule to advance');

  const updated = applyLoanMetrics({
    ...loan,
    next_due_date: advanceDateByRecurrence(loan.next_due_date, loan.recurrence ?? 'monthly', loan.due_day, months),
    updated_at: new Date().toISOString(),
  });

  state.loans[index] = updated;
  await writeState(state);
  return state.loans[index];
}

export async function deleteLoan(id: string): Promise<void> {
  const state = await readState();
  const exists = state.loans.some((loan) => loan.id === id);
  if (!exists) throw new Error('Loan not found');

  state.loans = state.loans.filter((loan) => loan.id !== id);
  state.payments = state.payments.filter((payment) => payment.loan_id !== id);
  await writeState(state);
}

export function currentLocalDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export async function recordLoanPayment(id: string, payload: Record<string, unknown>): Promise<Payment> {
  const state = await readState();
  const index = state.loans.findIndex((loan) => loan.id === id);
  if (index === -1) throw new Error('Loan not found');
  const loan = state.loans[index];
  if (loan.status === 'archived') throw new Error('Cannot record payments for an archived loan');

  const amount = money(payload.amount ?? loan.payment_amount);
  const payment: Payment = {
    id: crypto.randomUUID(),
    loan_id: loan.id,
    amount,
    payment_date: String(payload.payment_date ?? currentLocalDate()),
    payment_number: loan.payments_made + 1,
    notes: payload.notes ? String(payload.notes) : null,
    source: String(payload.source ?? 'manual'),
    created_at: new Date().toISOString(),
  };

  const updatedLoan = applyLoanMetrics({
    ...loan,
    current_balance: money(Math.max(Number(loan.current_balance) - Number(amount), 0)),
    payments_made: loan.payments_made + 1,
    next_due_date: advanceDateByRecurrence(loan.next_due_date, loan.recurrence ?? 'monthly', loan.due_day, 1),
    updated_at: new Date().toISOString(),
  });

  payment.undo = { before: loan, after: updatedLoan };
  const milestone = loan.payment_type === 'payoff' ? milestoneLabel(updatedLoan.payments_remaining, updatedLoan.progress_percentage) : null;
  if (milestone) {
    payment.milestone = milestone;
    payment.notification_title = `${milestone}: ${loan.name}`;
    payment.notification_body = `Tally shows ${updatedLoan.payments_remaining} payments left after this payment.`;
  }

  state.loans[index] = updatedLoan;
  state.payments.push(payment);
  await writeState(state);
  return payment;
}

export function paymentUndoUnavailableReason(payment: Payment, loan: Loan | undefined, payments: Payment[]): string | null {
  if (!payment.undo) return 'Older or imported history has no saved before-payment values, so Undo is unavailable.';
  if (!loan) return 'The payment account is unavailable.';
  if (payments.some(item => item.loan_id === payment.loan_id && item.payment_number > payment.payment_number)) {
    return 'Only the latest recorded payment on this account can be undone.';
  }
  if (accountSignature(loan) !== accountSignature(payment.undo.after)) {
    return 'This account changed after the payment. Undo is unavailable to protect those changes.';
  }
  return null;
}

function accountSignature(loan: Loan) {
  return JSON.stringify(Object.entries(loan).sort(([a], [b]) => a.localeCompare(b)));
}

export async function deletePayment(id: string): Promise<void> {
  const state = await readState();
  const payment = state.payments.find((item) => item.id === id);
  if (!payment) throw new Error('Payment not found');
  const loanIndex = state.loans.findIndex((loan) => loan.id === payment.loan_id);
  const reason = paymentUndoUnavailableReason(payment, state.loans[loanIndex], state.payments);
  if (reason) throw new Error(reason);
  if (!payment.undo) throw new Error('Saved payment values are unavailable.');
  state.loans[loanIndex] = applyLoanMetrics(payment.undo.before);
  state.payments = state.payments.filter((item) => item.id !== id);
  await writeState(state);
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  return (await readState()).notificationPreferences;
}

export async function updateNotificationPreferences(payload: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
  const state = await readState();
  state.notificationPreferences = { ...state.notificationPreferences, ...payload, updated_at: new Date().toISOString() };
  await writeState(state);
  return state.notificationPreferences;
}

export async function getNotificationQueue(): Promise<{ items: NotificationItem[] }> {
  const state = await readState();
  return { items: buildNotificationItems(state.loans, state.notificationPreferences) };
}

export async function getNotificationPreviews(): Promise<{ items: NotificationItem[] }> {
  const items = (await getNotificationQueue()).items;
  const wanted = ['payment_due', 'autopay_confirmation', 'milestone'];
  const previews = wanted.map((type) => items.find((item) => item.type === type)).filter(Boolean) as NotificationItem[];
  return { items: Array.from(new Map(previews.map((item) => [item.id, item])).values()) };
}

export async function createTestNotification(type = 'payment_due'): Promise<{ item: NotificationItem | null }> {
  const items = (await getNotificationQueue()).items;
  return { item: items.find((item) => item.type === type) ?? items[0] ?? null };
}

export function getSnoozedNotificationIds() {
  if (typeof window === 'undefined') return new Set<string>();
  const stored = window.localStorage.getItem('paygauge.snoozedNotifications');
  const snoozes = stored ? JSON.parse(stored) as Record<string, string> : {};
  const now = new Date();
  return new Set(Object.entries(snoozes).filter(([, until]) => new Date(until) > now).map(([id]) => id));
}

export function snoozeNotification(id: string, minutes = 60) {
  const stored = window.localStorage.getItem('paygauge.snoozedNotifications');
  const snoozes = stored ? JSON.parse(stored) as Record<string, string> : {};
  snoozes[id] = new Date(Date.now() + minutes * 60_000).toISOString();
  window.localStorage.setItem('paygauge.snoozedNotifications', JSON.stringify(snoozes));
}

export async function exportBackupJson(): Promise<BackupPayload> {
  const state = await readState();
  return {
    app: 'PayGauge',
    exported_at: new Date().toISOString(),
    loans: state.loans,
    payments: state.payments,
    notification_preferences: state.notificationPreferences,
    monthly_take_home_income: state.monthlyTakeHomeIncome,
  };
}

export async function importBackupJson(payload: BackupPayload, reset = true): Promise<BackupImportResult> {
  if (payload.app !== 'PayGauge') throw new Error('Backup file is not a Tally backup');
  if (payload.monthly_take_home_income != null && (!/^\d+(\.\d{1,2})?$/.test(payload.monthly_take_home_income) || !Number.isFinite(Number(payload.monthly_take_home_income)) || Number(payload.monthly_take_home_income) <= 0)) {
    throw new Error('Backup monthly take-home income must be a positive amount.');
  }
  const state = reset ? { ...emptyState, loans: [], payments: [] } : await readState();
  const loanIds = new Set(payload.loans.map((loan) => loan.id));
  const payments = payload.payments.filter((payment) => loanIds.has(payment.loan_id));
  const skippedPayments = payload.payments.length - payments.length;
  state.loans = payload.loans.map(applyLoanMetrics);
  state.payments = payments.sort(comparePaymentsDesc);
  state.notificationPreferences = payload.notification_preferences ?? state.notificationPreferences;
  state.monthlyTakeHomeIncome = payload.monthly_take_home_income ?? (reset ? null : state.monthlyTakeHomeIncome);
  await writeState(state);
  return { imported_loans: state.loans.length, imported_payments: state.payments.length, skipped_payments: skippedPayments };
}

export function formatNumber(value: string | number | unknown, fractionDigits = 0) {
  return Number(value ?? 0).toLocaleString(undefined, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  });
}

export function formatMoney(value: string | number | unknown, fractionDigits = 0) {
  return Number(value).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: fractionDigits,
  });
}

export function formatDate(value: string | null) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
}

export function daysUntil(value: string | null) {
  if (!value) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(`${value}T00:00:00`);
  return Math.ceil((dueDate.getTime() - today.getTime()) / 86_400_000);
}

export function relativeDueText(value: string | null) {
  const days = daysUntil(value);
  if (days === null) return 'No due date set';
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

export function addMonthsToDate(value: string, dueDay: number, months: number) {
  const date = new Date(`${value}T00:00:00`);
  const targetMonth = date.getMonth() + months;
  return clampDate(date.getFullYear(), targetMonth, dueDay).toISOString().slice(0, 10);
}

export function projectPaymentSchedule(loan: Pick<Loan, 'id' | 'name' | 'category' | 'payment_amount' | 'next_due_date' | 'due_day' | 'payments_remaining'>, months = 6) {
  if (!loan.next_due_date || !loan.due_day) return [];
  const count = Math.min(loan.payments_remaining, months);
  return Array.from({ length: count }, (_, index) => ({
    id: `${loan.id}-${index}`,
    loanId: loan.id,
    name: loan.name,
    category: loan.category,
    amount: loan.payment_amount,
    dueDate: addMonthsToDate(loan.next_due_date!, loan.due_day!, index),
  }));
}

export function milestoneLabel(paymentsRemaining: number, progressPercentage: number) {
  if (paymentsRemaining === 0) return 'Paid off';
  if (paymentsRemaining === 1) return 'Final payment next';
  if (paymentsRemaining === 5) return `${formatNumber(5)} payments left`;
  if (paymentsRemaining === 10) return `${formatNumber(10)} payments left`;
  if (progressPercentage >= 50 && progressPercentage < 55) return 'Halfway paid';
  return null;
}

export function payoffInsight(loan: Pick<Loan, 'payments_remaining' | 'estimated_payoff_date' | 'progress_percentage' | 'current_balance' | 'payment_amount'>) {
  if (loan.payments_remaining === 0) return 'This loan is paid off.';
  const finalPayment = Number(loan.current_balance) <= Number(loan.payment_amount);
  if (finalPayment) return 'The next payment should finish this loan.';
  return `${formatNumber(loan.payments_remaining)} payments left at the current pace, ending around ${formatDate(loan.estimated_payoff_date)}.`;
}

export function recurrenceLabel(recurrence: LoanRecurrence) {
  return recurrence.charAt(0).toUpperCase() + recurrence.slice(1);
}

export function extraPaymentProjection(loan: Pick<Loan, 'current_balance' | 'payment_amount' | 'payments_remaining' | 'next_due_date' | 'due_day'>, extraPayment: number) {
  const balance = Number(loan.current_balance);
  const normalPayment = Number(loan.payment_amount);
  const paymentWithExtra = normalPayment + Math.max(extraPayment, 0);
  const newPaymentsRemaining = paymentWithExtra > 0 ? Math.ceil(balance / paymentWithExtra) : loan.payments_remaining;
  const paymentsSaved = Math.max(loan.payments_remaining - newPaymentsRemaining, 0);
  const payoffDate = loan.next_due_date && loan.due_day && newPaymentsRemaining > 0
    ? addMonthsToDate(loan.next_due_date, loan.due_day, newPaymentsRemaining - 1)
    : loan.next_due_date;

  return { newPaymentsRemaining, paymentsSaved, payoffDate };
}

/** Date of the payment `count` steps after `start`, following the account's recurrence. */
export function dateAfterPayments(start: string, recurrence: LoanRecurrence, dueDay: number | null, count: number) {
  return count <= 0 ? start : advanceDateByRecurrence(start, recurrence, dueDay, count) ?? start;
}

export type PayoffPoint = { month: number; balance: number };

/** Month-by-month balance until payoff, honoring interest. Capped at 600 months. */
export function payoffSeries(balance: number, payment: number, annualRate = 0, extra = 0) {
  const rate = Math.max(annualRate, 0) / 100 / 12;
  const perPayment = Math.max(payment + Math.max(extra, 0), 0);
  const points: PayoffPoint[] = [{ month: 0, balance: Math.max(balance, 0) }];
  let remaining = Math.max(balance, 0);
  let interest = 0;
  if (perPayment <= remaining * rate || perPayment <= 0) return { points, months: Infinity, interest: Infinity };
  while (remaining > 0.005 && points.length <= 600) {
    const accrued = remaining * rate;
    interest += accrued;
    remaining = Math.max(remaining + accrued - perPayment, 0);
    points.push({ month: points.length, balance: remaining });
  }
  return { points, months: points.length - 1, interest };
}

export function lastPaymentText(payments: Payment[]) {
  if (!payments.length) return 'No payments recorded yet';
  return `Last payment: ${formatDate(payments[0].payment_date)}`;
}

export function previewNextDueDate(startDate: string, dueDay: string) {
  const parsedDueDay = Number(dueDay);
  if (!startDate || !parsedDueDay) return null;
  const start = new Date(`${startDate}T00:00:00`);
  const candidate = clampDate(start.getFullYear(), start.getMonth(), parsedDueDay);
  if (candidate <= start) return clampDate(start.getFullYear(), start.getMonth() + 1, parsedDueDay);
  return candidate;
}

export function estimatePaymentsRemaining(currentBalance: string, paymentAmount: string, interestRate = "0") {
  const balance = Number(currentBalance);
  const payment = Number(paymentAmount);
  const monthlyRate = Number(interestRate) / 100 / 12;
  if (!balance || !payment) return 0;
  if (monthlyRate > 0) {
    if (payment <= balance * monthlyRate) return 1200;
    let remaining = balance;
    let payments = 0;
    while (remaining > 0 && payments < 1200) {
      remaining += remaining * monthlyRate - payment;
      payments += 1;
    }
    return payments;
  }
  return Math.max(Math.ceil(balance / payment), 0);
}

export function estimateTotalPayments(currentBalance: string, paymentAmount: string, paymentsMade = 0, interestRate = "0") {
  return Math.max(Number(paymentsMade) + estimatePaymentsRemaining(currentBalance, paymentAmount, interestRate), 0);
}

export function zeroInterestMismatch(originalAmount: string, paymentAmount: string, totalPayments: string) {
  const original = Number(originalAmount);
  const payment = Number(paymentAmount);
  const total = Number(totalPayments);
  if (!original || !payment || !total) return 0;
  return payment * total - original;
}

function buildNotificationItems(loans: Loan[], preferences: NotificationPreferences): NotificationItem[] {
  const today = currentLocalDate();
  const items: NotificationItem[] = [];
  loans.filter((loan) => loan.status === 'active' && loan.next_due_date).forEach((loan) => {
    const paymentsAfter = Math.max(loan.payments_remaining - 1, 0);
    const amount = loan.payment_type === 'ongoing' ? loan.payment_amount : money(Math.min(Number(loan.current_balance), Number(loan.payment_amount)));
    const remainingMessage = loan.payment_type === 'ongoing' ? 'Recurring bill; no debt payoff count.' : `${paymentsAfter} payments will remain after this payment.`;
    const reminderDate = addDays(loan.next_due_date!, -preferences.days_before_due);

    if (preferences.payment_reminders && reminderDate >= today) {
      items.push(notificationItem(loan, 'payment_reminder', `${loan.name} payment coming up`, `${formatMoney(amount, 2)} due on ${formatDate(loan.next_due_date)}. ${remainingMessage}`, reminderDate, amount, paymentsAfter));
    }
    if (preferences.payment_reminders && loan.next_due_date! >= today) {
      items.push(notificationItem(loan, 'payment_due', loan.next_due_date === today ? `${loan.name} payment today` : `${loan.name} payment due`, `${formatMoney(amount, 2)} due. ${remainingMessage}`, loan.next_due_date!, amount, paymentsAfter));
    }
    if (loan.autopay && preferences.autopay_reminders && loan.next_due_date! >= today) {
      items.push(notificationItem(loan, 'autopay_scheduled', `${loan.name} autopay scheduled`, `${formatMoney(amount, 2)} is scheduled for autopay. Confirm after it processes before Tally records it.`, loan.next_due_date!, amount, paymentsAfter));
    }
    if (loan.autopay && preferences.payment_confirmations && loan.next_due_date!.slice(0, 7) === today.slice(0, 7) && loan.next_due_date! <= today) {
      items.push(notificationItem(loan, 'autopay_confirmation', `Confirm ${loan.name} payment`, `Did the ${formatMoney(amount, 2)} autopay process? Only mark it paid after confirming.`, today, amount, paymentsAfter, true));
    }
    const milestone = loan.payment_type === 'payoff' ? milestoneLabel(loan.payments_remaining, loan.progress_percentage) : null;
    if (milestone && preferences.milestone_alerts) {
      items.push(notificationItem(loan, 'milestone', `${milestone}: ${loan.name}`, `Tally shows ${loan.payments_remaining} payments left on this loan.`, today, loan.payment_amount, loan.payments_remaining));
    }
  });
  return items.sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for) || Number(b.action_required) - Number(a.action_required));
}

function notificationItem(loan: Loan, type: string, title: string, body: string, scheduledFor: string, amount: string, paymentsAfter: number, actionRequired = false): NotificationItem {
  return {
    id: `${loan.id}:${type}:${scheduledFor}`,
    loan_id: loan.id,
    loan_name: loan.name,
    category: loan.category,
    type,
    title,
    body,
    scheduled_for: scheduledFor,
    amount,
    payments_remaining_after: paymentsAfter,
    action_required: actionRequired,
  };
}

function applyLoanMetrics(loan: Loan): Loan {
  const paymentType = loan.payment_type ?? 'payoff';
  const paidWith = loan.paid_with ?? 'other';
  const currentBalance = Math.max(Number(loan.current_balance), 0);
  const paymentsMade = Math.max(loan.payments_made, 0);
  const paymentsRemaining = paymentType === 'ongoing' ? 0 : estimatePaymentsRemaining(String(currentBalance), loan.payment_amount, loan.interest_rate ?? "0");
  const totalPayments = paymentType === 'ongoing' ? null : estimateTotalPayments(String(currentBalance), loan.payment_amount, paymentsMade, loan.interest_rate ?? "0");
  const status = paymentType === 'ongoing' ? loan.status : loan.status !== 'archived' && (currentBalance <= 0 || paymentsRemaining === 0) ? 'completed' : loan.status === 'completed' && currentBalance > 0 && paymentsRemaining > 0 ? 'active' : loan.status;
  const nextDueDate = loan.next_due_date ?? initialNextDueDate(loan.start_date, loan.due_day);
  return {
    ...loan,
    payment_type: paymentType,
    paid_with: paidWith,
    current_balance: money(currentBalance),
    total_number_of_payments: totalPayments,
    payments_made: paymentsMade,
    payments_remaining: paymentsRemaining,
    progress_percentage: progressPercentage(totalPayments, paymentsMade, loan.original_amount, String(currentBalance)),
    next_due_date: nextDueDate,
    estimated_payoff_date: paymentType === 'ongoing' ? null : estimatePayoffDate(nextDueDate, loan.due_day, paymentsRemaining),
    status,
  };
}

function toDashboardLoan(loan: Loan): DashboardLoanSummary {
  return {
    id: loan.id,
    name: loan.name,
    category: loan.category,
    payment_type: loan.payment_type,
    paid_with: loan.paid_with,
    current_balance: loan.current_balance,
    payment_amount: loan.payment_amount,
    interest_rate: loan.interest_rate,
    payments_remaining: loan.payments_remaining,
    progress_percentage: loan.progress_percentage,
    next_due_date: loan.next_due_date,
    due_day: loan.due_day,
    recurrence: loan.recurrence,
    estimated_payoff_date: loan.estimated_payoff_date,
    autopay: loan.autopay,
    status: loan.status,
  };
}

function progressPercentage(totalPayments: number | null, paymentsMade: number, originalAmount: string, currentBalance: string) {
  const original = Number(originalAmount);
  if (!original) return 0;
  return Math.round(Math.min(((original - Number(currentBalance)) / original) * 100, 100) * 100) / 100;
}

function initialNextDueDate(startDate: string | null, dueDay: number | null) {
  if (!startDate || !dueDay) return null;
  const start = new Date(`${startDate}T00:00:00`);
  const candidate = clampDate(start.getFullYear(), start.getMonth(), dueDay);
  return (candidate <= start ? clampDate(start.getFullYear(), start.getMonth() + 1, dueDay) : candidate).toISOString().slice(0, 10);
}

function estimatePayoffDate(nextDueDate: string | null, dueDay: number | null, paymentsRemaining: number) {
  if (paymentsRemaining <= 0) return nextDueDate;
  if (!nextDueDate || !dueDay) return null;
  return addMonthsToDate(nextDueDate, dueDay, paymentsRemaining - 1);
}

function clampDate(year: number, monthIndex: number, dueDay: number) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.max(1, Math.min(dueDay, lastDay)));
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function advanceDateByRecurrence(value: string | null, recurrence: LoanRecurrence, dueDay: number | null, steps = 1) {
  if (!value) return value;
  if (recurrence === 'weekly') return addDays(value, steps * 7);
  if (recurrence === 'biweekly') return addDays(value, steps * 14);
  if (dueDay) return addMonthsToDate(value, dueDay, steps * (recurrence === 'quarterly' ? 3 : recurrence === 'annual' ? 12 : 1));
  return addDays(value, steps * 30);
}

function scheduledAmountForMonth(loan: Loan, monthStart: Date, monthEnd: Date) {
  if (!loan.next_due_date) return 0;
  const scheduleStart = loan.start_date ? new Date(`${loan.start_date}T00:00:00`) : null;
  const recurrenceDays = loan.recurrence === 'weekly' ? 7 : loan.recurrence === 'biweekly' ? 14 : 0;
  const recurrenceMonths = loan.recurrence === 'quarterly' ? 3 : loan.recurrence === 'annual' ? 12 : 1;
  let occurrence = new Date(`${loan.next_due_date}T00:00:00`);
  let guard = 0;
  while (occurrence > monthEnd && guard < 100) {
    occurrence = recurrenceDays
      ? new Date(occurrence.getTime() - recurrenceDays * 86400000)
      : new Date(occurrence.getFullYear(), occurrence.getMonth() - recurrenceMonths, Math.min(loan.due_day ?? occurrence.getDate(), new Date(occurrence.getFullYear(), occurrence.getMonth() - recurrenceMonths + 1, 0).getDate()));
    guard += 1;
  }

  let total = 0;
  while (occurrence <= monthEnd && guard < 100) {
    if (occurrence >= monthStart && (!scheduleStart || occurrence >= scheduleStart)) total += Math.min(Number(loan.current_balance) || Number(loan.payment_amount), Number(loan.payment_amount));
    occurrence = recurrenceDays
      ? new Date(occurrence.getTime() + recurrenceDays * 86400000)
      : new Date(occurrence.getFullYear(), occurrence.getMonth() + recurrenceMonths, Math.min(loan.due_day ?? occurrence.getDate(), new Date(occurrence.getFullYear(), occurrence.getMonth() + recurrenceMonths + 1, 0).getDate()));
    guard += 1;
  }
  return total;
}

function money(value: unknown) {
  return Number(value ?? 0).toFixed(2);
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  return Number(value);
}

function stringOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function compareLoans(a: Loan, b: Loan) {
  if (!a.next_due_date && !b.next_due_date) return a.created_at.localeCompare(b.created_at);
  if (!a.next_due_date) return 1;
  if (!b.next_due_date) return -1;
  return a.next_due_date.localeCompare(b.next_due_date) || a.created_at.localeCompare(b.created_at);
}

function comparePaymentsDesc(a: Payment, b: Payment) {
  return b.payment_date.localeCompare(a.payment_date) || b.created_at.localeCompare(a.created_at);
}

function comparePaymentsAsc(a: Payment, b: Payment) {
  return a.payment_date.localeCompare(b.payment_date) || a.created_at.localeCompare(b.created_at);
}
