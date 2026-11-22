create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users on delete cascade, full_name text not null default '',
  avatar_url text, created_at timestamptz not null default now()
);
create function private.create_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,full_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'full_name',''),100));
  return new;
end $$;
revoke all on function private.create_profile() from public,anon,authenticated;
create trigger studysync_profile after insert on auth.users for each row execute function private.create_profile();
insert into public.profiles(id,full_name,created_at)
select id,left(coalesce(raw_user_meta_data->>'full_name',''),100),created_at from auth.users;
alter table public.profiles enable row level security;
revoke all on public.profiles from public,anon,authenticated;
grant select,update(full_name,avatar_url) on public.profiles to authenticated;
create policy own_profile on public.profiles to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));

create table public.subjects (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check(length(trim(name)) between 1 and 100), code text not null default '', description text not null default '',
  color text not null default 'indigo', icon text not null default 'book', deleting boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id)
);
create table public.materials (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), subject_id uuid not null,
  filename text not null check(length(filename) between 1 and 255),
  storage_path text generated always as (user_id::text || '/' || subject_id::text || '/' || id::text) stored unique,
  mime_type text not null, size_bytes bigint not null check(size_bytes > 0),
  status text not null default 'pending' check(status in ('pending','processing','completed','failed')),
  processing_error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,subject_id,user_id), foreign key(subject_id,user_id) references public.subjects(id,user_id) on delete cascade
);
create table public.notes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), subject_id uuid not null,
  title text not null check(length(trim(title)) between 1 and 160),
  content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}',
  plain_text text not null default '', revision integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,subject_id,user_id), foreign key(subject_id,user_id) references public.subjects(id,user_id) on delete cascade
);
create table public.reviewers (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), subject_id uuid not null,
  title text not null check(length(trim(title)) between 1 and 160), format text not null,
  content jsonb not null, coverage text not null default '', saved boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,subject_id,user_id), foreign key(subject_id,user_id) references public.subjects(id,user_id) on delete cascade
);
create table public.quizzes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), subject_id uuid not null,
  title text not null, difficulty text not null, question_types text[] not null, coverage text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,subject_id,user_id), foreign key(subject_id,user_id) references public.subjects(id,user_id) on delete cascade
);
create table public.material_chunks (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), subject_id uuid not null,
  material_id uuid not null, position integer not null, reference text not null, body text not null check(length(body)>0),
  created_at timestamptz not null default now(), unique(material_id,position),
  foreign key(material_id,subject_id,user_id) references public.materials(id,subject_id,user_id) on delete cascade
);
create table public.reviewer_sources (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, subject_id uuid not null,
  reviewer_id uuid not null, material_id uuid, note_id uuid, created_at timestamptz not null default now(),
  check(num_nonnulls(material_id,note_id)=1),
  foreign key (reviewer_id,subject_id,user_id) references public.reviewers(id,subject_id,user_id) on delete cascade,
  foreign key (material_id,subject_id,user_id) references public.materials(id,subject_id,user_id) on delete cascade,
  foreign key (note_id,subject_id,user_id) references public.notes(id,subject_id,user_id) on delete cascade
);
create table public.quiz_sources (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, subject_id uuid not null,
  quiz_id uuid not null, material_id uuid, note_id uuid, created_at timestamptz not null default now(),
  check(num_nonnulls(material_id,note_id)=1),
  foreign key (quiz_id,subject_id,user_id) references public.quizzes(id,subject_id,user_id) on delete cascade,
  foreign key (material_id,subject_id,user_id) references public.materials(id,subject_id,user_id) on delete cascade,
  foreign key (note_id,subject_id,user_id) references public.notes(id,subject_id,user_id) on delete cascade
);
create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, subject_id uuid not null, quiz_id uuid not null,
  position integer not null, question text not null, kind text not null check(kind in ('choice','boolean')),
  options jsonb not null check(jsonb_typeof(options)='array' and jsonb_array_length(options) in (2,4)), reference text not null,
  created_at timestamptz not null default now(), unique(quiz_id,position), unique(id,quiz_id,user_id),
  foreign key(quiz_id,subject_id,user_id) references public.quizzes(id,subject_id,user_id) on delete cascade
);
create table private.quiz_keys (
  question_id uuid primary key references public.quiz_questions on delete cascade, correct integer not null, explanation text not null
);
create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, subject_id uuid not null, quiz_id uuid not null,
  score integer not null, total integer not null, created_at timestamptz not null default now(), unique(id,quiz_id,user_id),
  foreign key(quiz_id,subject_id,user_id) references public.quizzes(id,subject_id,user_id) on delete cascade
);
create table public.quiz_attempt_answers (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, quiz_id uuid not null, attempt_id uuid not null,
  question_id uuid not null, chosen integer not null, correct integer not null, explanation text not null,
  created_at timestamptz not null default now(), unique(attempt_id,question_id),
  foreign key(attempt_id,quiz_id,user_id) references public.quiz_attempts(id,quiz_id,user_id) on delete cascade,
  foreign key(question_id,quiz_id,user_id) references public.quiz_questions(id,quiz_id,user_id) on delete cascade
);
create table private.generation_requests (
  user_id uuid references auth.users on delete cascade, request_id uuid not null, created_at timestamptz not null default now(),
  primary key (user_id,request_id)
);
create index generation_window on private.generation_requests(user_id,created_at);
alter table private.generation_requests enable row level security;
alter table private.quiz_keys enable row level security;
revoke all on private.generation_requests,private.quiz_keys from public,anon,authenticated;

alter table public.subjects enable row level security;
revoke all on public.subjects from public,anon,authenticated;
grant select on public.subjects to authenticated;
create policy owner_access on public.subjects to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create index subjects_owner on public.subjects(user_id);
alter table public.materials enable row level security;
revoke all on public.materials from public,anon,authenticated;
grant select on public.materials to authenticated;
create policy owner_access on public.materials to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create index materials_owner on public.materials(user_id);
alter table public.material_chunks enable row level security;
revoke all on public.material_chunks from public,anon,authenticated;
grant select on public.material_chunks to authenticated;
create policy owner_access on public.material_chunks to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create index material_chunks_owner on public.material_chunks(user_id);
alter table public.notes enable row level security;
revoke all on public.notes from public,anon,authenticated;
grant select on public.notes to authenticated;
create policy owner_access on public.notes to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create index notes_owner on public.notes(user_id);
alter table public.reviewers enable row level security;
revoke all on public.reviewers from public,anon,authenticated;
grant select on public.reviewers to authenticated;
create policy owner_access on public.reviewers to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create index reviewers_owner on public.reviewers(user_id);
alter table public.reviewer_sources enable row level security;
revoke all on public.reviewer_sources from public,anon,authenticated;
grant select on public.reviewer_sources to authenticated;
create policy owner_access on public.reviewer_sources to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create index reviewer_sources_owner on public.reviewer_sources(user_id);
alter table public.quizzes enable row level security;
revoke all on public.quizzes from public,anon,authenticated;
grant select on public.quizzes to authenticated;
create policy owner_access on public.quizzes to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create index quizzes_owner on public.quizzes(user_id);
alter table public.quiz_questions enable row level security;
revoke all on public.quiz_questions from public,anon,authenticated;
grant select on public.quiz_questions to authenticated;
create policy owner_access on public.quiz_questions to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create index quiz_questions_owner on public.quiz_questions(user_id);
alter table public.quiz_sources enable row level security;
revoke all on public.quiz_sources from public,anon,authenticated;
grant select on public.quiz_sources to authenticated;
create policy owner_access on public.quiz_sources to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create index quiz_sources_owner on public.quiz_sources(user_id);
alter table public.quiz_attempts enable row level security;
revoke all on public.quiz_attempts from public,anon,authenticated;
grant select on public.quiz_attempts to authenticated;
create policy owner_access on public.quiz_attempts to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create index quiz_attempts_owner on public.quiz_attempts(user_id);
alter table public.quiz_attempt_answers enable row level security;
revoke all on public.quiz_attempt_answers from public,anon,authenticated;
grant select on public.quiz_attempt_answers to authenticated;
create policy owner_access on public.quiz_attempt_answers to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create index quiz_attempt_answers_owner on public.quiz_attempt_answers(user_id);
grant insert,update,delete on public.subjects, public.notes,public.materials,public.material_chunks to authenticated;
grant update(title,saved),delete on public.reviewers to authenticated;
grant delete on public.quizzes to authenticated;
create function private.touch_updated() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=clock_timestamp(); return new; end $$;
create trigger last_update before update on public.subjects for each row execute function private.touch_updated();
create trigger last_update before update on public.materials for each row execute function private.touch_updated();
create trigger last_update before update on public.notes for each row execute function private.touch_updated();
create trigger last_update before update on public.reviewers for each row execute function private.touch_updated();
create trigger last_update before update on public.quizzes for each row execute function private.touch_updated();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('study-materials','study-materials',false,20971520,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation']);
create policy read_own_materials on storage.objects for select to authenticated
using(bucket_id='study-materials' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy upload_own_materials on storage.objects for insert to authenticated
with check(bucket_id='study-materials' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(
  select 1 from public.materials m join public.subjects s on s.id=m.subject_id
  where m.storage_path=storage.objects.name and m.user_id=(select auth.uid()) and m.status='pending' and not s.deleting
));
create policy delete_own_materials on storage.objects for delete to authenticated
using(bucket_id='study-materials' and (storage.foldername(name))[1]=(select auth.uid())::text);

create function private.guard_material_delete() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from storage.objects where bucket_id='study-materials' and name=old.storage_path)
  then raise exception 'Remove the stored file before its metadata'; end if;
  return old;
end $$;
revoke all on function private.guard_material_delete() from public,anon,authenticated;
create trigger remove_file_first before delete on public.materials for each row execute function private.guard_material_delete();

create function private.reserve_generation(p_request uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
  if uid is null then raise exception 'Sign in required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  delete from private.generation_requests where user_id=uid and created_at<now()-interval '1 day';
  if (select count(*) from private.generation_requests where user_id=uid and created_at>now()-interval '10 minutes')>=10 then return false; end if;
  insert into private.generation_requests(user_id,request_id) values(uid,p_request) on conflict do nothing;
  return found;
end $$;

create function private.save_generation(p_id uuid,p_subject uuid,p_kind text,p_data jsonb,p_materials uuid[],p_notes uuid[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); q jsonb; qid uuid; pos integer:=0; source uuid;
begin
  if uid is null or not exists(select 1 from public.subjects where id=p_subject and user_id=uid and not deleting) then raise exception 'Subject unavailable'; end if;
  if p_kind='quiz' then
    insert into public.quizzes(id,user_id,subject_id,title,difficulty,question_types,coverage)
    values(p_id,uid,p_subject,p_data->>'title',p_data->>'difficulty',array(select jsonb_array_elements_text(p_data->'types')),p_data->>'coverage');
    for q in select jsonb_array_elements(p_data->'questions') loop
      if (q->>'correct')::int not between 0 and jsonb_array_length(q->'options')-1 then raise exception 'Invalid answer'; end if;
      insert into public.quiz_questions(user_id,subject_id,quiz_id,position,question,kind,options,reference)
        values(uid,p_subject,p_id,pos,q->>'question',q->>'kind',q->'options',q->>'reference') returning id into qid;
      insert into private.quiz_keys values(qid,(q->>'correct')::int,q->>'explanation'); pos:=pos+1;
    end loop;
    if pos not in (5,10,20) then raise exception 'Invalid question count'; end if;
    insert into public.quiz_sources(user_id,subject_id,quiz_id,material_id) select uid,p_subject,p_id,unnest(p_materials);
    insert into public.quiz_sources(user_id,subject_id,quiz_id,note_id) select uid,p_subject,p_id,unnest(p_notes);
  elsif p_kind='reviewer' then
    insert into public.reviewers(id,user_id,subject_id,title,format,content,coverage) values
    (p_id,uid,p_subject,p_data->>'title',p_data->>'format',p_data->'sections',p_data->>'coverage');
    insert into public.reviewer_sources(user_id,subject_id,reviewer_id,material_id) select uid,p_subject,p_id,unnest(p_materials);
    insert into public.reviewer_sources(user_id,subject_id,reviewer_id,note_id) select uid,p_subject,p_id,unnest(p_notes);
  else raise exception 'Invalid study tool'; end if;
  return p_id;
end $$;
create function private.grade_quiz(p_quiz uuid,p_attempt uuid,p_answers jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); subject uuid; n int; points int;
begin
  select subject_id into subject from public.quizzes where id=p_quiz and user_id=uid for share;
  if subject is null then raise exception 'Quiz unavailable'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_attempt::text,1));
  if exists(select 1 from public.quiz_attempts where id=p_attempt and user_id=uid and quiz_id=p_quiz) then return p_attempt; end if;
  if jsonb_typeof(p_answers) is distinct from 'object' then raise exception 'Invalid submission'; end if;
  select count(*),count(*) filter(where (p_answers->>q.id::text)::int=k.correct) into n,points
  from public.quiz_questions q join private.quiz_keys k on k.question_id=q.id where q.quiz_id=p_quiz;
  if n=0 or (select count(*) from jsonb_object_keys(p_answers))<>n or exists(select 1 from public.quiz_questions q where q.quiz_id=p_quiz and
    (not (p_answers ? q.id::text) or jsonb_typeof(p_answers->q.id::text)<>'number' or (p_answers->>q.id::text)::int not between 0 and jsonb_array_length(q.options)-1)) then raise exception 'Answer every question'; end if;
  insert into public.quiz_attempts(id,user_id,subject_id,quiz_id,score,total) values(p_attempt,uid,subject,p_quiz,points,n);
  insert into public.quiz_attempt_answers(user_id,quiz_id,attempt_id,question_id,chosen,correct,explanation)
    select uid,p_quiz,p_attempt,q.id,(p_answers->>q.id::text)::int,k.correct,k.explanation
    from public.quiz_questions q join private.quiz_keys k on k.question_id=q.id where q.quiz_id=p_quiz;
  return p_attempt;
end $$;
create function public.reserve_generation(p_request uuid) returns boolean language sql security invoker set search_path='' as $$select private.reserve_generation(p_request)$$;
revoke all on function public.reserve_generation(p_request uuid),private.reserve_generation(p_request uuid) from public,anon;
grant execute on function public.reserve_generation(p_request uuid),private.reserve_generation(p_request uuid) to authenticated;
create function public.save_generation(p_id uuid,p_subject uuid,p_kind text,p_data jsonb,p_materials uuid[],p_notes uuid[]) returns uuid language sql security invoker set search_path='' as $$select private.save_generation(p_id,p_subject,p_kind,p_data,p_materials,p_notes)$$;
revoke all on function public.save_generation(p_id uuid,p_subject uuid,p_kind text,p_data jsonb,p_materials uuid[],p_notes uuid[]),private.save_generation(p_id uuid,p_subject uuid,p_kind text,p_data jsonb,p_materials uuid[],p_notes uuid[]) from public,anon;
grant execute on function public.save_generation(p_id uuid,p_subject uuid,p_kind text,p_data jsonb,p_materials uuid[],p_notes uuid[]),private.save_generation(p_id uuid,p_subject uuid,p_kind text,p_data jsonb,p_materials uuid[],p_notes uuid[]) to authenticated;
create function public.grade_quiz(p_quiz uuid,p_attempt uuid,p_answers jsonb) returns uuid language sql security invoker set search_path='' as $$select private.grade_quiz(p_quiz,p_attempt,p_answers)$$;
revoke all on function public.grade_quiz(p_quiz uuid,p_attempt uuid,p_answers jsonb),private.grade_quiz(p_quiz uuid,p_attempt uuid,p_answers jsonb) from public,anon;
grant execute on function public.grade_quiz(p_quiz uuid,p_attempt uuid,p_answers jsonb),private.grade_quiz(p_quiz uuid,p_attempt uuid,p_answers jsonb) to authenticated;
