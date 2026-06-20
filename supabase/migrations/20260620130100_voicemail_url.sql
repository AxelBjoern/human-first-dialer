-- Store a link to the TTS voicemail-narration clip generated from outcome notes
-- when a call is missed/declined. The audio lives in the voice-cues bucket; we
-- keep only the path/URL on the call log.
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS voicemail_url text;
