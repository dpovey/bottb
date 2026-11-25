select p.id, p.platform, p.content_type, p.status, p.group_key, p.event_id, p.posted_at, p.scheduled_for, p.posted_at_estimated, p.posted_via, p.source, left(coalesce(p.title, p.caption,''),60) label,
 m.captured_at, m.views, m.likes, m.comments, m.shares, m.impressions, m.clicks, m.source msource
from posts p left join post_metrics m on m.post_id=p.id
where p.status='published' and p.posted_at is not null
order by p.posted_at, m.captured_at
