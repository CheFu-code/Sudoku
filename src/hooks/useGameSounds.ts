// import { Audio } from 'expo-av';
// import { useCallback, useEffect, useRef } from 'react';

// export type GameSoundKey = 'tap' | 'error' | 'success';

// const SOUND_MAP = {
//   tap: require('../../assets/audio/tap.wav'),
//   error: require('../../assets/audio/error.wav'),
//   success: require('../../assets/audio/success.wav'),
// } as const;

// export function useGameSounds() {
//   const soundsRef = useRef<Record<GameSoundKey, Audio.Sound | null>>({
//     tap: null,
//     error: null,
//     success: null,
//   });
//   const initializedRef = useRef(false);

//   useEffect(() => {
//     let active = true;

//     (async () => {
//       try {
//         await Audio.setAudioModeAsync({
//           playsInSilentModeIOS: true,
//           shouldDuckAndroid: true,
//           interruptionModeIOS: 1,
//           interruptionModeAndroid: 1,
//           staysActiveInBackground: false,
//         });
//       } catch {
//         // Ignore audio mode issues in unsupported environments.
//       }
//       if (active) initializedRef.current = true;
//     })();

//     return () => {
//       active = false;
//     };
//   }, []);

//   const ensureSound = useCallback(async (key: GameSoundKey) => {
//     if (!initializedRef.current) {
//       try {
//         await Audio.setAudioModeAsync({
//           playsInSilentModeIOS: true,
//           shouldDuckAndroid: true,
//           interruptionModeIOS: 1,
//           interruptionModeAndroid: 1,
//           staysActiveInBackground: false,
//         });
//       } catch {
//         // noop
//       }
//       initializedRef.current = true;
//     }

//     let sound = soundsRef.current[key];
//     if (!sound) {
//       sound = new Audio.Sound();
//       await sound.loadAsync(SOUND_MAP[key]);
//       soundsRef.current[key] = sound;
//     }

//     return sound;
//   }, []);

//   const play = useCallback(
//     async (key: GameSoundKey) => {
//       try {
//         const sound = await ensureSound(key);
//         const status = await sound.getStatusAsync();
//         if (!status.isLoaded) return;
//         await sound.setPositionAsync(0);
//         await sound.playAsync();
//       } catch {
//         // Ignore unsupported runtime sound issues.
//       }
//     },
//     [ensureSound],
//   );

//   useEffect(() => {
//     return () => {
//       void Promise.all(
//         (Object.keys(soundsRef.current) as GameSoundKey[]).map(async (key) => {
//           const sound = soundsRef.current[key];
//           if (sound) {
//             await sound.unloadAsync().catch(() => {});
//           }
//         }),
//       );
//     };
//   }, []);

//   return { play };
// }
