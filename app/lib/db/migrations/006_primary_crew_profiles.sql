insert into crew_members (id, name, nationality, role, address, certificate, is_primary, owner_id)
select users.id || ':me', users.name, '', 'Owner', '', '', 1, users.id
from users
where not exists (
  select 1 from crew_members
  where crew_members.owner_id = users.id and crew_members.is_primary = 1
);
