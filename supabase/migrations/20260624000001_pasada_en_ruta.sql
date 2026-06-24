-- Add route_order to pdrs (driving order within a barrio).

alter table pdrs add column route_order integer;
