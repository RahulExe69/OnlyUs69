# OnlyUs Project Guidelines & Rules

## Core Rules & Verification Protocol
1. **Double-Review Mandate**: Before completing any turn, thoroughly inspect all modified source files, database queries, and real-time lifecycle hooks to guarantee zero regressions.
2. **Symmetric Dual-User Sync**: Always verify that both Rahul (Owner - Google Auth) and Nusrat (Partner - 6-digit PIN Auth) have identical, zero-latency access to shared messages, realtime subscriptions, online presence, and games.
3. **Database & RLS Integrity**: Maintain permissive RLS policies and realtime publications on `messages`, `users`, and `app_config` in Supabase so neither account encounters permission or missing message errors.
4. **Resilient Message Hydration**: Ensure message subscriptions and historical fetches execute immediately upon user authentication without being blocked by asynchronous profile resolution.
5. **Question Mode Tags**: Whenever the user includes `#ask`, `#ans`, `#qna`, or `#answer` in their prompt, treat the request purely as an informational question: provide a detailed answer and make NO code changes or tool modifications unless explicitly asked.
