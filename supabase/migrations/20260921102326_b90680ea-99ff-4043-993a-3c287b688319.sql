
create or replace function public.can_view_club_volunteer_member_profile(_viewer uuid, _profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from club_enrollments e
    join club_coordinators cc on cc.club_id = e.club_id
    where e.student_id = _profile_id and cc.user_id = _viewer
  ) or exists (
    select 1 from club_enrollments e
    join club_student_assistants a on a.club_id = e.club_id
    where e.student_id = _profile_id and a.student_id = _viewer
  ) or exists (
    select 1 from volunteer_enrollments v
    join volunteer_coordinators vc on vc.project_id = v.project_id
    where v.student_id = _profile_id and vc.user_id = _viewer
  ) or exists (
    select 1 from volunteer_enrollments v
    join volunteer_student_assistants va on va.project_id = v.project_id
    where v.student_id = _profile_id and va.student_id = _viewer
  )
$$;

drop policy if exists "Club and volunteer staff read member profiles" on public.profiles;
create policy "Club and volunteer staff read member profiles"
on public.profiles for select to authenticated
using (public.can_view_club_volunteer_member_profile(auth.uid(), id));
