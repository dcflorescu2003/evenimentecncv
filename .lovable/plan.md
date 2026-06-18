## Fix event-files storage policies

Add missing SELECT and DELETE policies on `storage.objects` for the `event-files` bucket so managers/coordinators can read, and students + event managers can delete appropriately.

### Migration

Add policies (idempotent DROP IF EXISTS + CREATE):

1. **SELECT — Managers read all event files**
   `bucket_id='event-files' AND has_role(auth.uid(),'manager')`

2. **SELECT — Coordinators read files for assigned events**
   `bucket_id='event-files' AND is_coordinator_for_event(((storage.foldername(name))[1])::uuid, auth.uid())`

3. **DELETE — Students delete own form submissions**
   `bucket_id='event-files' AND has_role(auth.uid(),'student') AND (storage.foldername(name))[2]='form-submissions' AND (storage.foldername(name))[3]=auth.uid()::text`

4. **DELETE — Coordinators delete files for assigned events**
   `bucket_id='event-files' AND is_coordinator_for_event(((storage.foldername(name))[1])::uuid, auth.uid())`

(Admins and event creators already have full access; managers stay read-only per existing role model.)

### After migration
- Mark finding `event_files_storage_no_read_for_coordinators_managers` as fixed.
- Update `@security-memory` noting managers have read-only storage access and students/coordinators can delete form submissions in their scope.
