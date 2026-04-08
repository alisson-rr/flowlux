-- =============================================
-- FlowLux - Migration V25
-- Expand pre-checkout step types for Typeform-like builder
-- =============================================

ALTER TABLE pre_checkout_form_steps
  DROP CONSTRAINT IF EXISTS pre_checkout_form_steps_type_check;

ALTER TABLE pre_checkout_form_steps
  ADD CONSTRAINT pre_checkout_form_steps_type_check
  CHECK (
    type IN (
      'intro',
      'welcome_screen',
      'statement',
      'short_text',
      'long_text',
      'email',
      'phone',
      'number',
      'date',
      'single_choice',
      'multiple_choice',
      'dropdown',
      'yes_no',
      'rating',
      'opinion_scale',
      'legal',
      'end_screen'
    )
  );

