// Curated on-device TTS voices. Names follow the Piper candidates; finalize after the TTS spike.
export const VOICES = [
  { id: 'amy', name: 'Amy', description: 'Female · US English' },
  { id: 'ryan', name: 'Ryan', description: 'Male · US English' },
  { id: 'alba', name: 'Alba', description: 'Female · UK English' },
  { id: 'alan', name: 'Alan', description: 'Male · UK English' },
] as const;

export type VoiceId = (typeof VOICES)[number]['id'];

export function getVoice(id: VoiceId) {
  return VOICES.find((voice) => voice.id === id) ?? VOICES[0];
}
