create policy "Authenticated read teaching staff roles"
on public.user_roles
for select
to authenticated
using (role in ('teacher'::public.app_role, 'homeroom_teacher'::public.app_role, 'coordinator_teacher'::public.app_role, 'cse'::public.app_role));