-- Publisher topic editing (internal only): internal_api had SELECT alone.
-- Table-level UPDATE — the surrogate key and the creation timestamp are kept the database's
-- to set in the repository code, which names the columns it writes rather than at the grant.
GRANT UPDATE ON topic TO internal_api;
