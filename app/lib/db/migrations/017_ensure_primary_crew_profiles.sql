update crew_members
set is_primary = 1
where id in (
  select users.id || ':me'
  from users
  join crew_members on crew_members.id = users.id || ':me'
  where not exists (
    select 1
    from crew_members primary_crew
    where primary_crew.owner_id = users.id and primary_crew.is_primary = 1
  )
);

insert into crew_members (id, name, nationality, role, address, certificate, is_primary, owner_id)
select users.id || ':me', users.name, '', 'Owner', '', '', 1, users.id
from users
where not exists (
  select 1
  from crew_members
  where crew_members.owner_id = users.id and crew_members.is_primary = 1
)
and not exists (
  select 1
  from crew_members
  where crew_members.id = users.id || ':me'
);
