# Bound image storage without paid overflow

The user requires free infrastructure. Object storage with free allowances can
still bill for overages, so the first implementation stores image attachments
in the existing PostgreSQL database with fixed capacity checks. This trades
storage efficiency for a rollout that does not enable another billable service.

Images have a 128 MiB aggregate limit, and writes also check a conservative
400 MiB database threshold. A transaction lock serializes quota checks and
capture writes. At capacity, the application reports failure instead of
activating overflow storage. Operators must still confirm the provider account
uses a free plan. These limits cannot change an account's billing terms.

Text and image access ends at the seven-day deadline. Physical cleanup occurs
on the next successful cleanup or capture transaction. The image read interface
allows a later migration to object storage if its cost controls meet the user's
constraint.
