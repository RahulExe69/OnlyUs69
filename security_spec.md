# Security Specification - OnlyUs Chat

## Data Invariants
1. **Global Access Control**: Only the authenticated owner (specified by hardcoded email or config) and the authorized partner (specified in config) can access the application.
2. **Identity Integrity**: User profiles must correctly reflect their authenticated email and assigned role.
3. **Message Integrity**: Messages must be authored by the person claiming to send them (based on role).
4. **Relational Sync**: Access to messages is derived from the global application configuration.

## Data Structures
- `/app_config/main`: Specifies the `owner_email`, `partner_allowed_emails`, and a `partner_id`.
- `/users/{userId}`: Stores `uid`, `email`, `role`, `displayName`, `photoURL`.
- `/messages/{messageId}`: Stores `sender_role`, `text`, `timestamp`, `reactions`, `replyTo`, `isEdited`, `deleted`.

## Access Control Patterns (ABAC)
- **Role: Owner**: Full read/write access to config and messages.
- **Role: Partner**: Read access to config, read/write access to messages, read/write access to their own profile.
- **Role: Unauthorized**: No access to anything except their own profile creation (if authorized).

## The "Dirty Dozen" Payloads (Anti-Patterns)
1. **Identity Spoofing**: Partner trying to create an 'owner' role user profile.
2. **State Shortcutting**: Non-owner trying to update the `partner_allowed_emails` in `app_config`.
3. **Ghost Writes**: Update a message while adding an unauthorized field (e.g., `verifiedByAI`).
4. **Relational Leak**: Authenticated user (not in config) trying to list messages.
5. **ID Poisoning**: Creating a message with a 2MB string as a document ID.
6. **Self-Promotion**: Non-owner trying to set `role: "owner"` on their profile during creation.
7. **Message Hijacking**: Partner trying to send a message with `sender_role: "owner"`.
8. **PII Leak**: Unauthorized user reading the User collection to find emails.
9. **Outcome Manipulation**: Partner trying to delete a message (if restricted to owner).
10. **Shadow Updates**: Owner trying to change the `sender_role` of a partner's message.
11. **Timestamp Spoofing**: Client sending a `timestamp` from the past/future instead of server time.
12. **Nickname Abuse**: User trying to set a 1MB string as their partner's nickname.
