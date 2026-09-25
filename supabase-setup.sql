-- ============================================================================
--  COSMIC PORTFOLIO  //  SUPABASE SETUP
--  วิธีใช้: เปิด Supabase Dashboard > SQL Editor > New query
--           วางไฟล์นี้ทั้งหมด แล้วกด Run (รันซ้ำได้ ไม่พัง)
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) ตาราง PROJECTS (ผลงาน)
-- ----------------------------------------------------------------------------
create table if not exists public.projects (
  id          text primary key,
  title       text not null,
  category    text not null default 'General',
  summary     text not null default '',
  tags        text[] not null default '{}',
  demo_url    text not null default '#',
  github_url  text not null default '#',
  image_url   text not null default '',
  sort_order  bigint not null default (extract(epoch from now()) * 1000)::bigint,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2) ตาราง CERTIFICATES (เกียรติบัตร)
-- ----------------------------------------------------------------------------
create table if not exists public.certificates (
  id          text primary key,
  title       text not null,
  category    text not null default '',
  issuer      text not null default '',
  year        text not null default '',
  description text not null default '',
  image_url   text not null default '',
  sort_order  bigint not null default (extract(epoch from now()) * 1000)::bigint,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3) ตาราง ACTIVITIES (กิจกรรม)
-- ----------------------------------------------------------------------------
create table if not exists public.activities (
  id          text primary key,
  title       text not null,
  role        text not null default 'MEMBER',
  location    text not null default '',
  icon        text not null default 'fa-users-gear',
  description text not null default '',
  tags        text[] not null default '{}',
  images      text[] not null default '{}',
  sort_order  bigint not null default (extract(epoch from now()) * 1000)::bigint,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- เรียงใหม่สุดขึ้นก่อน
create index if not exists projects_sort_idx     on public.projects     (sort_order desc);
create index if not exists certificates_sort_idx on public.certificates (sort_order desc);
create index if not exists activities_sort_idx   on public.activities   (sort_order desc);


-- ----------------------------------------------------------------------------
-- 4) อัปเดตเวลาแก้ไขอัตโนมัติ
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_touch     on public.projects;
drop trigger if exists certificates_touch on public.certificates;
drop trigger if exists activities_touch   on public.activities;

create trigger projects_touch     before update on public.projects     for each row execute function public.touch_updated_at();
create trigger certificates_touch before update on public.certificates for each row execute function public.touch_updated_at();
create trigger activities_touch   before update on public.activities   for each row execute function public.touch_updated_at();


-- ----------------------------------------------------------------------------
-- 5) ROW LEVEL SECURITY
--    หัวใจของความปลอดภัย: เว็บ static เปิดเผย anon key ให้ทุกคนเห็นอยู่แล้ว
--    RLS คือสิ่งที่กันไม่ให้คนอื่นเขียนทับข้อมูลเรา
--      - ใครก็ได้      -> อ่าน (select) ได้
--      - ล็อกอินแล้ว   -> เพิ่ม/แก้/ลบ ได้
-- ----------------------------------------------------------------------------
alter table public.projects     enable row level security;
alter table public.certificates enable row level security;
alter table public.activities   enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['projects', 'certificates', 'activities']
  loop
    execute format('drop policy if exists "public_read_%1$s"   on public.%1$I', t);
    execute format('drop policy if exists "auth_insert_%1$s"   on public.%1$I', t);
    execute format('drop policy if exists "auth_update_%1$s"   on public.%1$I', t);
    execute format('drop policy if exists "auth_delete_%1$s"   on public.%1$I', t);

    execute format('create policy "public_read_%1$s" on public.%1$I for select using (true)', t);
    execute format('create policy "auth_insert_%1$s" on public.%1$I for insert to authenticated with check (true)', t);
    execute format('create policy "auth_update_%1$s" on public.%1$I for update to authenticated using (true) with check (true)', t);
    execute format('create policy "auth_delete_%1$s" on public.%1$I for delete to authenticated using (true)', t);
  end loop;
end
$$;


-- ----------------------------------------------------------------------------
-- 6) STORAGE สำหรับรูปผลงาน / เกียรติบัตร / กิจกรรม
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('portfolio-media', 'portfolio-media', true)
on conflict (id) do update set public = true;

drop policy if exists "media_public_read"   on storage.objects;
drop policy if exists "media_auth_insert"   on storage.objects;
drop policy if exists "media_auth_update"   on storage.objects;
drop policy if exists "media_auth_delete"   on storage.objects;

create policy "media_public_read" on storage.objects
  for select using (bucket_id = 'portfolio-media');

create policy "media_auth_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'portfolio-media');

create policy "media_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'portfolio-media') with check (bucket_id = 'portfolio-media');

create policy "media_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'portfolio-media');


-- ----------------------------------------------------------------------------
-- 7) REALTIME (หน้าเว็บอัปเดตทันทีที่แอดมินบันทึก โดยไม่ต้องรีเฟรช)
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['projects', 'certificates', 'activities']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;


-- ============================================================================
--  เสร็จแล้ว — ตารางยังว่างเปล่า (ไม่มีข้อมูลจำลอง ตามที่ต้องการ)
--  ใส่ข้อมูลจริงได้ 2 ทาง:
--    1. เปิด admin.html > ล็อกอิน > กดปุ่ม "นำเข้าข้อมูลเดิม" (ดึงจาก
--       IndexedDB ในเครื่องขึ้น cloud ทีเดียวจบ)
--    2. เพิ่มทีละรายการผ่านหน้าแอดมินตามปกติ
-- ============================================================================


-- ============================================================================
-- 8) (ทางเลือก) ล็อกสิทธิ์เขียนให้เฉพาะอีเมลของเรา — ปลอดภัยขึ้นอีกชั้น
-- ----------------------------------------------------------------------------
-- ค่าเริ่มต้นด้านบนคือ "ใครก็ตามที่ล็อกอินแล้ว" เขียนได้
-- ถ้าเผลอเปิดให้คนทั่วไปสมัครสมาชิกได้ คนอื่นจะเขียนข้อมูลเราได้ด้วย
--
-- ทางป้องกันหลัก: ปิดการสมัครสมาชิกใน Dashboard
--   Authentication > Sign In / Providers > Email > ปิด "Allow new users to sign up"
--
-- ถ้าอยากล็อกแน่นกว่านั้น ให้แก้อีเมลข้างล่างเป็นของตัวเอง
-- แล้วลบเครื่องหมาย /* */ ออก จากนั้น Run ใหม่อีกครั้ง
--
/*
do $$
declare
  t text;
  admin_email text := 'เปลี่ยนเป็นอีเมลแอดมินของคุณ@example.com';
begin
  foreach t in array array['projects', 'certificates', 'activities']
  loop
    execute format('drop policy if exists "auth_insert_%1$s" on public.%1$I', t);
    execute format('drop policy if exists "auth_update_%1$s" on public.%1$I', t);
    execute format('drop policy if exists "auth_delete_%1$s" on public.%1$I', t);

    execute format($f$create policy "auth_insert_%1$s" on public.%1$I for insert to authenticated
                     with check ((auth.jwt() ->> 'email') = %2$L)$f$, t, admin_email);
    execute format($f$create policy "auth_update_%1$s" on public.%1$I for update to authenticated
                     using ((auth.jwt() ->> 'email') = %2$L)
                     with check ((auth.jwt() ->> 'email') = %2$L)$f$, t, admin_email);
    execute format($f$create policy "auth_delete_%1$s" on public.%1$I for delete to authenticated
                     using ((auth.jwt() ->> 'email') = %2$L)$f$, t, admin_email);
  end loop;
end
$$;
*/
