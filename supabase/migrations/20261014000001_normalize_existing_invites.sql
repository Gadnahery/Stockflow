update public.invites set expires_at = created_at + interval '7 days' where expires_at is distinct from created_at + interval '7 days';
