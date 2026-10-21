## Preserve topic memberships alongside subtopic placements

Date: 2026-10-21

A topic membership remains one row per version and topic. Subtopic placements are
separate child rows, constrained to both that membership and a subtopic of the
same topic. Each version has at most one primary topic and one primary subtopic.
Topic-level placements remain valid for topics without subtopics.

### Rationale

The V2 workbook places some indicators in multiple subtopics of the same topic.
Separate child rows preserve those placements while existing topic queries still
return each membership once. Draft copies and topic saves retain the children of
retained memberships. Replaced vocabularies are marked inactive so historical
references survive without offering obsolete choices in the public service.
