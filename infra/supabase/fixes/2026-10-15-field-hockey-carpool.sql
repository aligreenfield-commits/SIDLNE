-- One-off fix requested by the family: their main "WILTON SPORTS carpool"
-- (6 drivers, 14 drives) is field hockey only; name it so, and make sure the
-- WYFH filter is set. Targets that one carpool by id, or changes nothing.
do $$
begin
  update public.carpools set name = 'Field hockey carpool', event_filter = coalesce(nullif(trim(event_filter), ''), 'WYFH')
  where id = '95bbbdfe-e885-448f-a30b-4a80afd9658e';
  if not found then raise exception 'Carpool not found; nothing changed'; end if;
end $$;

select id, name, event_filter from public.carpools where id = '95bbbdfe-e885-448f-a30b-4a80afd9658e';
