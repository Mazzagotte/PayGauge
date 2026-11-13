# Screen Map

## Shared page layout
- All pages use the shared PageHeader: left-aligned 24px title, consistent top inset, subtitle typography and 18px content spacing
- Primary pages put actions on the right; detail, history and form pages place Back/Close and Edit/Save in a consistent toolbar below the title
- Home and Payments no longer insert a logo above their titles; Home keeps the greeting as its subtitle
- Five-item bottom navigation remains consistent across pages, with the current tab indicated

## Home / Dashboard
- Layout: compact monthly summary, Next due with payment actions, small side-by-side account totals, then Coming up
- Monthly commitment: scheduled bills + debt payments for the current month, with paid and remaining amounts (including cents); excludes installments before an account's start date
- Debt payoff: total debt remaining and combined payment count across active debts, not months until debt-free
- Recurring bills: due this month, paid, and remaining for ongoing bills (including cents)
- Next due: all active payments sharing the earliest due date, with a combined total and individual payment confirmation
- Autopay shows as scheduled until explicitly confirmed as processed; confirmations retain the autopay-confirmed source
- Coming up: the next three due-date groups, separate from the next-due group
- Individual payments appear only in the due-date schedule, not repeated in Debts and Bills lists; use Payments for the full account breakdown

Payments is the shared navigation label for both debt payoff plans and recurring bills.

Dashboard regression tests: `npm --workspace apps/paygauge-web run test:dashboard` (Node.js 24).

## Loans
- All / Debts / Bills type filters with counts
- Search and collapsible status/category filters (including archived accounts)
- Sort by next due (default), largest balance, or name
- Compact accounts with exact payment amounts, one next-due date, and autopay badge
- Debts additionally show exact remaining balance, estimated payments left, and clamped balance progress
- Add Payment action and account-detail links for editing, recording, and history

## Loan Detail
- Remaining balance
- Payments left
- Progress bar
- Payment amount
- Original amount
- Interest rate
- Start date
- Estimated payoff
- Next payment
- Mark payment as made
- Payment history

## Payment history corrections
- Older/imported records without before-payment values are protected from Undo, with a visible explanation
- New payments store before/after account snapshots in local data and backups
- Undo requires confirmation, is limited to the latest recorded payment on each account, and refuses if the account changed afterward
- Undo restores exact saved values rather than adding amounts to a bill balance or rewinding every recurrence by one month
- Recurring bills use their full scheduled amount in reminders and never receive debt-payoff milestones

## Bills
- Upcoming recurring bills
- Autopay state
- Due/paid status

## Calendar
- Real month lengths and weekday alignment; previous/next month and Today controls
- Selectable dates with today outline and payment markers; Show month resets selection
- Exact total and date-grouped agenda for the displayed month's upcoming payments only
- Includes ongoing monthly/weekly/biweekly/quarterly/annual bills and finite debt forecasts
- Forecast begins at each account's next due date; paid history remains in account details
- Autopay is labeled scheduled, not paid; projections are not guaranteed processing dates

## More
- Income breakdown link for the current month's graph and editable take-home baseline
- Backup & restore first, with last export date and an explicit replacement warning
- Validated JSON imports preview account/history counts before confirmation; Cancel and Escape leave data unchanged
- Browser export reports a download request, not proof that the file was saved; native save/share errors are surfaced
- Device notification permission status, permission/settings actions, and a permission-gated test reminder
- Android automatic reminders for next tracked due dates: 9 AM local time, configured pre-due days and confirmation delay, quiet-hours deferral; browser reminders remain in-app
- Schedules refresh on startup/resume, permission changes, account/payment edits, imports and preference changes; only PayGauge automatic reminders are replaced
- Past due dates are skipped; record/confirm payments to advance the next date. No transactions are recorded by notification delivery or tapping.
- Scheduling status and failures are visible; Android battery management can delay delivery
- Collapsible timing form with explicit Save: 0-30 days before due, 1-24 hours after autopay, and quiet hours
- Local storage explanation and reminder to keep a backup before clearing data or switching devices

## Income breakdown
- Dedicated Income tab in the five-item bottom navigation: Home, Payments, Calendar, Income, More
- Graph and monthly breakdown first; monthly take-home income editor at the bottom
- Current-month graph: debt payments, other recurring bills, rent/mortgage, and income after tracked commitments
- Editable monthly take-home income stored locally and included in JSON backups; older backups clear the baseline on restore
- Scheduled commitments use the same monthly recurrence totals as Home; recorded paid includes dated transactions through today, even for now-completed/archived accounts
- Exact amounts and percentages of income; over-income commitments are explicit rather than hidden by chart clamping
- Payment recording defaults use the device's local calendar date, not UTC, so evening payments count as paid today
- Not a full budget: untracked spending is excluded and the remainder is not disposable-income advice
