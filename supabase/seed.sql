-- Demo data: 2 organizers, 1 sponsor, 10 published UAE events with packages.
-- Demo logins (password for all: Demo1234!):
--   organizer1@demo.marketingone.ae, organizer2@demo.marketingone.ae, sponsor@demo.marketingone.ae
-- Safe to run once on a fresh project (SQL editor or `supabase db reset`).

do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('11111111-1111-1111-1111-111111111111'::uuid, 'organizer1@demo.marketingone.ae', 'organizer', 'Gulf Events Co.'),
      ('22222222-2222-2222-2222-222222222222'::uuid, 'organizer2@demo.marketingone.ae', 'organizer', 'Emirates Community Hub'),
      ('33333333-3333-3333-3333-333333333333'::uuid, 'sponsor@demo.marketingone.ae', 'sponsor', 'Al Noor Hospital Group')
    ) as t(id, email, role, company)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      crypt('Demo1234!', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('role', u.role, 'company_name', u.company),
      now(), now(), '', '', '', ''
    ) on conflict (id) do nothing;

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text,
            jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
            'email', now(), now(), now())
    on conflict do nothing;
  end loop;
end $$;

update public.profiles set verified = true, onboarded = true, emirate = 'Dubai', company_type = 'event_company'
 where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
update public.profiles set onboarded = true, emirate = 'Abu Dhabi', company_type = 'hospital'
 where id = '33333333-3333-3333-3333-333333333333';

insert into public.events (id, organizer_id, title_en, title_ar, description_en, description_ar, category, emirate, venue,
                           start_date, end_date, expected_attendance, audience_description, cover_image_url, status)
values
  ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Dubai Health & Wellness Summit', 'قمة دبي للصحة والعافية',
   'Two-day summit for healthcare leaders, doctors and wellness brands with keynote talks and an exhibition hall.',
   'قمة لمدة يومين لقادة الرعاية الصحية والأطباء وعلامات العافية مع محاضرات رئيسية وقاعة معارض.',
   'conference', 'Dubai', 'Dubai World Trade Centre', current_date + 40, current_date + 41, 3500,
   'Doctors, hospital executives, pharma and insurance professionals',
   'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200', 'published'),
  ('e0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'Abu Dhabi Corniche Marathon', 'ماراثون كورنيش أبوظبي',
   'Community marathon with 5km, 10km and 21km races along the Corniche. Family zone and finish-line festival.',
   'ماراثون مجتمعي بسباقات ٥ و١٠ و٢١ كم على الكورنيش مع منطقة عائلية ومهرجان عند خط النهاية.',
   'sports', 'Abu Dhabi', 'Abu Dhabi Corniche', current_date + 60, current_date + 60, 12000,
   'Runners, families, fitness enthusiasts aged 18-55',
   'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?w=1200', 'published'),
  ('e0000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222',
   'Sharjah University Career Fair', 'معرض الوظائف في جامعة الشارقة',
   'Annual career fair connecting 5,000+ graduating students with employers across the UAE.',
   'معرض وظائف سنوي يربط أكثر من ٥٠٠٠ طالب متخرج بأصحاب العمل في الإمارات.',
   'education', 'Sharjah', 'University City Hall', current_date + 25, current_date + 26, 5000,
   'Final-year university students and fresh graduates',
   'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=1200', 'published'),
  ('e0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
   'Dubai Tech Founders Forum', 'منتدى مؤسسي التقنية في دبي',
   'Startup pitch competition and investor networking evening for 600 founders and VCs.',
   'مسابقة عروض للشركات الناشئة وأمسية تواصل مع المستثمرين لـ٦٠٠ مؤسس ومستثمر.',
   'corporate', 'Dubai', 'Museum of the Future', current_date + 35, current_date + 35, 600,
   'Startup founders, investors, tech executives',
   'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200', 'published'),
  ('e0000000-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222',
   'Ras Al Khaimah Winter Food Festival', 'مهرجان رأس الخيمة الشتوي للطعام',
   'Ten-day outdoor food festival with 80 vendors, live cooking shows and family entertainment.',
   'مهرجان طعام خارجي لمدة عشرة أيام مع ٨٠ بائعًا وعروض طبخ مباشرة وترفيه عائلي.',
   'festival', 'Ras Al Khaimah', 'Al Marjan Island', current_date + 50, current_date + 59, 45000,
   'Families, tourists, food lovers',
   'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200', 'published'),
  ('e0000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111',
   'National Day Concert Night', 'حفل ليلة اليوم الوطني',
   'Open-air concert celebrating UAE National Day with Emirati and Arab artists.',
   'حفل في الهواء الطلق احتفالًا باليوم الوطني الإماراتي بمشاركة فنانين إماراتيين وعرب.',
   'concert', 'Dubai', 'Coca-Cola Arena', current_date + 20, current_date + 20, 15000,
   'Young adults and families, mostly UAE nationals and Arab expats',
   'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200', 'published'),
  ('e0000000-0000-0000-0000-000000000007', '22222222-2222-2222-2222-222222222222',
   'Ajman Ramadan Community Iftar', 'إفطار رمضان المجتمعي في عجمان',
   'Nightly community iftar for 1,500 people across the holy month, run with local volunteers.',
   'إفطار مجتمعي يومي لـ١٥٠٠ شخص طوال الشهر الفضيل بالتعاون مع متطوعين محليين.',
   'community', 'Ajman', 'Ajman Corniche Tent', current_date + 110, current_date + 139, 40000,
   'Workers, families and residents of Ajman',
   'https://images.unsplash.com/photo-1532635241-17e820acc59f?w=1200', 'published'),
  ('e0000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111',
   'Real Estate Investment Show Abu Dhabi', 'معرض الاستثمار العقاري أبوظبي',
   'Exhibition of off-plan and ready properties with developer booths and investment seminars.',
   'معرض للعقارات على الخارطة والجاهزة مع أجنحة للمطورين وندوات استثمارية.',
   'exhibition', 'Abu Dhabi', 'ADNEC Centre', current_date + 75, current_date + 77, 9000,
   'Property investors, high-income residents, brokers',
   'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200', 'published'),
  ('e0000000-0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222',
   'Fujairah Beach Clean-up & Family Day', 'يوم تنظيف شاطئ الفجيرة والعائلة',
   'Environmental volunteer day with schools and families, followed by beach games and talks.',
   'يوم تطوعي بيئي مع المدارس والعائلات تليه ألعاب شاطئية ومحاضرات.',
   'community', 'Fujairah', 'Fujairah Corniche Beach', current_date + 30, current_date + 30, 1200,
   'School students, families, environmental volunteers',
   'https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?w=1200', 'published'),
  ('e0000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111',
   'UAE Esports Championship Finals', 'نهائيات بطولة الإمارات للرياضات الإلكترونية',
   'Live esports finals with 2,000 in-venue fans and 250,000+ online stream viewers.',
   'نهائيات رياضات إلكترونية مباشرة بحضور ٢٠٠٠ مشجع وأكثر من ٢٥٠ ألف مشاهد عبر البث.',
   'sports', 'Dubai', 'Dubai Studio City', current_date + 90, current_date + 91, 2000,
   'Gamers aged 16-30, streaming audience across the GCC',
   'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200', 'published')
on conflict (id) do nothing;

-- Three packages per event: Title, Gold (fixed), and an open-offer or in-kind package.
insert into public.sponsorship_packages (event_id, tier_name, price_type, price_aed, in_kind_description, slots_total, benefits, deliverables_proof, sort_order)
select e.id, 'Title Sponsor', 'fixed'::public.price_type, round(least(e.expected_attendance * 25 + 40000, 300000) / 1000.0) * 1000, null, 1,
       array['Name in event title', 'Logo on all stage backdrops', 'Main booth 6x6m', '5 social media posts', '5-minute speaking slot'],
       'Photos of stage and booth, social post links, attendance report', 1
  from public.events e where e.id::text like 'e0000000%'
union all
select e.id, 'Gold Sponsor', 'fixed', round(least(e.expected_attendance * 8 + 12000, 90000) / 1000.0) * 1000, null, 3,
       array['Logo on entrance and backdrop', 'Booth 3x3m', '2 social media posts'],
       'Photos of logo placement and booth', 2
  from public.events e where e.id::text like 'e0000000%'
union all
select e.id,
       case when e.category in ('community', 'sports') then 'Medical / In-kind Partner' else 'Community Partner' end,
       case when e.category in ('community', 'sports') then 'in_kind'::public.price_type else 'open_offer'::public.price_type end,
       case when e.category in ('community', 'sports') then null else 5000 end,
       case when e.category in ('community', 'sports') then 'Provide medical team, water, products or services in exchange for branding' end,
       5,
       array['Logo on partner wall', 'Mention in closing ceremony'],
       'Photo of partner wall', 3
  from public.events e where e.id::text like 'e0000000%';
