UPDATE "area_type" AS target
SET
  "display_group" = source.display_group,
  "display_order" = source.display_order
FROM (
  VALUES
    ('County unchanged', 'Local authorities', 1),
    ('LA unchanged', 'Local authorities', 1),
    ('UA unchanged', 'Local authorities', 1),
    ('UA new 2020', 'Local authorities', 1),
    ('UA new 2021', 'Local authorities', 1),
    ('UA new 2023', 'Local authorities', 1),
    ('Regions (statistical)', 'Statistical regions', 2),
    ('NHS regions', 'NHS regions', 3),
    ('ICBs', 'Integrated care boards', 4),
    ('MSOA', 'Middle-layer super output areas', 5),
    ('GPs', 'GP practices', 6)
) AS source(name, display_group, display_order)
WHERE target.name = source.name;
