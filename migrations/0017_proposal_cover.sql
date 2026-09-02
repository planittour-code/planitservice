alter table proposals add column if not exists cover_photo_src text;

update companies
set logo_src = '/houses/northside-logo.svg'
where id = 'co_demo' and logo_src is null;

update proposals
set cover_photo_src = '/houses/maple-front.jpg'
where id = 'prop_maple_p1' and cover_photo_src is null;
