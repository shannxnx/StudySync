-- Synthetic users and records exist only inside this transaction.
begin;
select set_config('test.owner',gen_random_uuid()::text,true),set_config('test.peer',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('test.owner')::uuid),(current_setting('test.peer')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
do $$
declare s uuid; n uuid; q uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); ans jsonb; questions jsonb;
begin
  insert into public.subjects(name) values('Fixture course') returning id into s;
  insert into public.notes(subject_id,title) values(s,'Fixture note') returning id into n;
  perform set_config('test.subject',s::text,true);
  select jsonb_agg(jsonb_build_object('question','Question '||i,'kind','choice','options',jsonb_build_array('A','B','C','D'),'correct',0,'explanation','Fixture explanation','reference','Fixture source')) into questions from generate_series(1,5)i;
  perform public.save_generation(q,s,'quiz',jsonb_build_object('title','Fixture','difficulty','Easy','types',jsonb_build_array('choice'),'coverage','All','questions',questions),'{}',array[n]);
  if has_table_privilege(current_user,'private.quiz_keys','select') or has_table_privilege(current_user,'public.quiz_attempts','insert') then raise exception 'Unexpected client privilege'; end if;
  if exists(select 1 from public.quiz_attempt_answers where quiz_id=q) then raise exception 'Answers appeared before grading'; end if;
  select jsonb_object_agg(id::text,case when position=0 then 1 else 0 end) into ans from public.quiz_questions where quiz_id=q;
  perform public.grade_quiz(q,a,ans); perform public.grade_quiz(q,a,ans);
  if not exists(select 1 from public.quiz_attempts where id=a and score=4 and total=5) then raise exception 'Incorrect score'; end if;
  if (select count(*) from public.quiz_attempt_answers where attempt_id=a)<>5 then raise exception 'Incomplete results'; end if;
  if not public.reserve_generation(q) or public.reserve_generation(q) then raise exception 'Request deduplication failed'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.peer'),true);
do $$
begin
  if exists(select 1 from public.subjects where id=current_setting('test.subject')::uuid) then raise exception 'Subject ownership failure'; end if;
  if exists(select 1 from public.quiz_attempts where user_id=current_setting('test.owner')::uuid) then raise exception 'Attempt ownership failure'; end if;
  begin
    insert into public.notes(subject_id,title) values(current_setting('test.subject')::uuid,'Invalid parent');
    raise exception 'Subject ownership constraint missing';
  exception when foreign_key_violation then null;
  end;
end $$;
rollback;
