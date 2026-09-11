-- Seeds the first 5 days of scenes, anchored to the date this is run so
-- Day 1 is playable immediately. Safe to re-run (upserts on play_date).

insert into scenes (play_date, day_number, sentences, anomaly_index, reveal_text)
values
(
  current_date + 0,
  1,
  '[
    "You get home and put your keys in the bowl by the door, same as every night.",
    "The porch light flickers twice before steadying.",
    "Your roommate''s shoes are by the mat, still damp from the rain.",
    "On the counter, your coffee mug from this morning sits with steam faintly rising from a slick of yesterday''s coffee grounds, already dried at the bottom."
  ]'::jsonb,
  3,
  'Dried coffee doesn''t steam. Something in that mug is producing heat, and it isn''t coffee from this morning.'
),
(
  current_date + 1,
  2,
  '[
    "The elevator doors open on your floor like always.",
    "The hallway carpet has that same worn patch by 4B.",
    "Your neighbor''s dog barks twice, muffled through the wall.",
    "You count seven doors between the elevator and your apartment, just like you have every day for three years, except tonight there are eight."
  ]'::jsonb,
  3,
  'There have always been seven doors. Something added one, and it wants you to notice.'
),
(
  current_date + 2,
  3,
  '[
    "Your little sister calls to say goodnight, same time as always.",
    "She tells you about her day at school, mentions her friend Mia, laughs at something you said.",
    "You hang up, and it isn''t until you''re brushing your teeth that you remember: she''s been away at camp with no cell reception for the last five days."
  ]'::jsonb,
  2,
  'The call happened. You remember it clearly. It just shouldn''t have been possible.'
),
(
  current_date + 3,
  4,
  '[
    "The barista hands you your usual order without asking.",
    "She smiles, tells you to have a good one.",
    "You take a sip walking out the door, and it''s exactly right — oat milk, extra shot, no foam.",
    "You realize, halfway down the block, that you''ve never been to this coffee shop before."
  ]'::jsonb,
  3,
  'Someone — or something — already knew your order before you ever walked in.'
),
(
  current_date + 4,
  5,
  '[
    "You wave to your neighbor across the yard, same as every morning.",
    "He waves back, calls out something about the weather.",
    "You go inside, make coffee, sit by the window.",
    "Later you remember: he moved out three weeks ago, and the house has been empty since."
  ]'::jsonb,
  3,
  'You had a full conversation with someone who wasn''t there. He answered your wave. He knew about the weather.'
)
on conflict (day_number) do update set
  play_date = excluded.play_date,
  sentences = excluded.sentences,
  anomaly_index = excluded.anomaly_index,
  reveal_text = excluded.reveal_text;
