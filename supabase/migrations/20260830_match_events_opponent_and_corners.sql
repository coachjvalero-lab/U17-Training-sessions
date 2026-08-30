-- Migration to allow opponent_goal, corner, and opponent_corner event types in public.match_events

alter table if exists public.match_events
  drop constraint if exists match_events_event_type_check;

alter table if exists public.match_events
  add constraint match_events_event_type_check
  check (event_type in (
    'goal',
    'opponent_goal',
    'corner',
    'opponent_corner',
    'assist',
    'yellow_card',
    'red_card',
    'substitution_in',
    'substitution_out',
    'own_goal',
    'injury',
    'other'
  ));
