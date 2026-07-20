# Invites are email-addressed, copy-link delivered

Project Invites target an email and Role, but MVP delivery is an in-app copyable token URL — not Supabase Auth email. Built-in Supabase SMTP is limited to ~2 messages/hour, which is unusable for invites; custom SMTP can be added later without changing the Invite model.
