select distinct on (p.id) p.platform, p.content_type, p.event_id, p.posted_at, p.external_id,
 (coalesce(p.caption,'') ~* '(https?://|youtu\.be|lnkd\.in|www\.)') has_link, length(coalesce(p.caption,'')) cap_len,
 left(coalesce(p.title, p.caption,''),70) label, m.captured_at, m.views, m.likes, m.comments, m.shares, m.impressions, m.clicks
from posts p left join post_metrics m on m.post_id=p.id
where p.status='published' and p.posted_at is not null and p.platform in ('facebook','linkedin','youtube','instagram','tiktok')
order by p.id, m.captured_at desc nulls last
