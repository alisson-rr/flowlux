-- =============================================
-- FlowLux - Migration V26
-- Align pre-checkout schema with current form editor
-- =============================================

-- Legacy intro steps were replaced by welcome_screen in the builder.
UPDATE pre_checkout_form_steps
SET type = 'welcome_screen'
WHERE type = 'intro';

ALTER TABLE pre_checkout_form_steps
  DROP CONSTRAINT IF EXISTS pre_checkout_form_steps_type_check;

ALTER TABLE pre_checkout_form_steps
  ADD CONSTRAINT pre_checkout_form_steps_type_check
  CHECK (
    type IN (
      'welcome_screen',
      'statement',
      'short_text',
      'long_text',
      'email',
      'phone',
      'number',
      'date',
      'single_choice',
      'picture_choice',
      'multiple_choice',
      'dropdown',
      'yes_no',
      'rating',
      'opinion_scale',
      'nps',
      'legal',
      'end_screen'
    )
  );

-- Remove legacy theme keys that the current editor/runtime no longer use.
UPDATE pre_checkout_forms
SET theme = jsonb_strip_nulls(
  theme
    #- '{top_image_url}'
    #- '{layout,width}'
    #- '{background,image_overlay}'
    #- '{background,full_bleed}'
    #- '{branding,background_overlay}'
)
WHERE
  theme ? 'top_image_url'
  OR COALESCE(theme -> 'layout', '{}'::jsonb) ? 'width'
  OR COALESCE(theme -> 'background', '{}'::jsonb) ? 'image_overlay'
  OR COALESCE(theme -> 'background', '{}'::jsonb) ? 'full_bleed'
  OR COALESCE(theme -> 'branding', '{}'::jsonb) ? 'background_overlay';

-- Remove legacy step settings that are no longer used by the editor.
UPDATE pre_checkout_form_steps
SET settings = jsonb_strip_nulls(
  settings
    #- '{helper_text}'
    #- '{placeholder_items}'
)
WHERE
  settings ? 'helper_text'
  OR settings ? 'placeholder_items';
