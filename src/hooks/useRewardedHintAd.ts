import { useCallback, useEffect, useRef, useState } from 'react';
import { AdMobRewarded } from 'expo-ads-admob';

export const adUnitId = 'ca-app-pub-8952058057579255/7704178238';

export function useRewardedHintAd() {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rewarded, setRewarded] = useState(false);
  const requestInFlight = useRef(false);
  const listenerRef = useRef<((event: { type: string }) => void) | null>(null);

  const load = useCallback(async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setLoading(true);
    setRewarded(false);

    try {
      await AdMobRewarded.setAdUnitID(adUnitId);
      await AdMobRewarded.requestAdAsync();
      const isReady = await AdMobRewarded.getIsReadyAsync();
      setReady(isReady);
    } catch {
      setReady(false);
    } finally {
      setLoading(false);
      requestInFlight.current = false;
    }
  }, []);

  const show = useCallback(async () => {
    if (!ready) {
      await load();
    }

    try {
      const isReady = await AdMobRewarded.getIsReadyAsync();
      if (!isReady) return false;
      await AdMobRewarded.showAdAsync();
      return true;
    } catch {
      return false;
    }
  }, [load, ready]);

  useEffect(() => {
    const listener = (event: { type: string }) => {
      if (event.type === 'rewardedVideoUserDidEarnReward') {
        setRewarded(true);
      }
      if (event.type === 'rewardedVideoDidLoad') {
        setReady(true);
      }
      if (event.type === 'rewardedVideoDidFailToLoad' || event.type === 'rewardedVideoDidDismiss') {
        setReady(false);
      }
    };

    listenerRef.current = listener;
    AdMobRewarded.addEventListener('rewardedVideoUserDidEarnReward', listener);
    AdMobRewarded.addEventListener('rewardedVideoDidLoad', listener);
    AdMobRewarded.addEventListener('rewardedVideoDidFailToLoad', listener);
    AdMobRewarded.addEventListener('rewardedVideoDidDismiss', listener);

    void load();

    return () => {
      if (listenerRef.current) {
        AdMobRewarded.removeEventListener('rewardedVideoUserDidEarnReward', listenerRef.current);
        AdMobRewarded.removeEventListener('rewardedVideoDidLoad', listenerRef.current);
        AdMobRewarded.removeEventListener('rewardedVideoDidFailToLoad', listenerRef.current);
        AdMobRewarded.removeEventListener('rewardedVideoDidDismiss', listenerRef.current);
      }
    };
  }, [load]);

  return { ready, loading, rewarded, load, show };
}
