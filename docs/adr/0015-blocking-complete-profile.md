# Blocking complete-profile after auth

OAuth (and incomplete email profiles) land in the app before First name / Last name exist. We redirect authenticated users into `/complete-profile` until both are set, rather than letting them use boards with Username-only labels. The friction is intentional so Display name is consistent everywhere; Username remains the separate handle.
