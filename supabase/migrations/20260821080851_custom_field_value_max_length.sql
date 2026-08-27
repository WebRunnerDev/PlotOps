-- Cap plain-text custom field values (ADR 0024). Matches CUSTOM_FIELD_VALUE_MAX_LENGTH in app.

alter table public.task_custom_field_values
  drop constraint if exists task_custom_field_values_value_length;

alter table public.task_custom_field_values
  add constraint task_custom_field_values_value_length
  check (char_length(value) <= 8192);
