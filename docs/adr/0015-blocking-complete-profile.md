# Blocking complete-profile after auth

OAuth (and incomplete email profiles) land in the app before First name / Last name exist. We redirect authenticated users into `/complete-profile` until both are set, rather than letting them use boards with Username-only labels. The friction is intentional so Display name is consistent everywhere; Username remains the separate handle.

## Guest Mode exception

The shared demo Guest (`demo@plotops.app`, Wave 0) skips this gate. Seeded First name / Last name are normally already complete; if they are missing after a bad reset or edge-case auth restore, Guest still reaches the Board so the portfolio demo stays frictionless. Real (non-guest) accounts keep the blocking redirect.
