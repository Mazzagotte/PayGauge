# Android Notification Behavior

PayGauge does not verify transactions with a financial institution.

For an autopay item:

1. Optional reminder before the payment date.
2. On due date: "Engagement Ring — $200 scheduled for autopay today."
3. Later confirmation: "Did the $200 payment process?" Home only keeps this prompt for due dates in the current calendar month; older months are not repeatedly presented for confirmation.
4. Actions: Mark Paid, Snooze, Open.
5. Once confirmed, record the payment and recalculate payments left / next due date.

If an active monthly account has a payment recorded this month but its saved due date is older, PayGauge advances that stale date to the next month's due day. This repairs the schedule without adding or changing payment history.

Milestone reminders can include halfway complete, 10 left, 5 left, 1 left, and paid off.
