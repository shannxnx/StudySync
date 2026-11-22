-- Serialize private object creation with subject/material cleanup.
alter table public.materials add column deleting boolean not null default false;
create function private.material_accepts_upload(object_name text) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.materials m join public.subjects s on s.id=m.subject_id and s.user_id=m.user_id
    where m.storage_path=object_name and m.user_id=(select auth.uid())
      and m.status='pending' and not m.deleting and not s.deleting
    for share of m,s;
  return found;
end $$;
revoke all on function private.material_accepts_upload(text) from public,anon;
grant execute on function private.material_accepts_upload(text) to authenticated;
alter policy upload_own_materials on storage.objects with check (
  bucket_id='study-materials' and (storage.foldername(name))[1]=(select auth.uid())::text
  and private.material_accepts_upload(name)
);
create function private.keep_material_location() returns trigger language plpgsql set search_path='' as $$
begin
  if row(new.id,new.subject_id,new.user_id) is distinct from row(old.id,old.subject_id,old.user_id) then
    raise exception 'The owner and storage location of an uploaded material are fixed';
  end if;
  return new;
end $$;
create trigger keep_location before update of id,subject_id,user_id on public.materials
for each row execute function private.keep_material_location();

create index material_chunks_material_id_subject_id_user_id_idx on public.material_chunks (material_id, subject_id, user_id);
create index materials_subject_id_user_id_idx on public.materials (subject_id, user_id);
create index notes_subject_id_user_id_idx on public.notes (subject_id, user_id);
create index quiz_attempt_answers_attempt_id_quiz_id_user_id_idx on public.quiz_attempt_answers (attempt_id, quiz_id, user_id);
create index quiz_attempt_answers_question_id_quiz_id_user_id_idx on public.quiz_attempt_answers (question_id, quiz_id, user_id);
create index quiz_attempts_quiz_id_subject_id_user_id_idx on public.quiz_attempts (quiz_id, subject_id, user_id);
create index quiz_questions_quiz_id_subject_id_user_id_idx on public.quiz_questions (quiz_id, subject_id, user_id);
create index quiz_sources_material_id_subject_id_user_id_idx on public.quiz_sources (material_id, subject_id, user_id);
create index quiz_sources_note_id_subject_id_user_id_idx on public.quiz_sources (note_id, subject_id, user_id);
create index quiz_sources_quiz_id_subject_id_user_id_idx on public.quiz_sources (quiz_id, subject_id, user_id);
create index quizzes_subject_id_user_id_idx on public.quizzes (subject_id, user_id);
create index reviewer_sources_material_id_subject_id_user_id_idx on public.reviewer_sources (material_id, subject_id, user_id);
create index reviewer_sources_note_id_subject_id_user_id_idx on public.reviewer_sources (note_id, subject_id, user_id);
create index reviewer_sources_reviewer_id_subject_id_user_id_idx on public.reviewer_sources (reviewer_id, subject_id, user_id);
create index reviewers_subject_id_user_id_idx on public.reviewers (subject_id, user_id);
