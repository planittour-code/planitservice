-- Profile photos are stored on user_profiles.photo_src. Writing a data-URL
-- into Better Auth "user".image put the whole image in the session cookie
-- cache and Netlify/nginx returned HTTP 400 (header too large).
update "user"
set image = null
where image like 'data:%';
