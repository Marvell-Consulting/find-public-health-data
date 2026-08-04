-- Publisher topic editing (internal only): internal_api had SELECT alone.
-- Column-scoped, so the editable fields are the only ones the API role can write —
-- the surrogate key and the creation timestamp stay out of reach whatever a query says.
GRANT UPDATE (slug, title, description, updated_at) ON topic TO internal_api;
