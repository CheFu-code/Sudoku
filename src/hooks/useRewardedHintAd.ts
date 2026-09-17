import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

export const adUnitId = 'ca-app-pub-8952058057579255/7704178238';

const rewardedAd = RewardedAd.createForAdRequest(
  __DEV__ ? TestIds.REWARDED : adUnitId,
  { requestNonPersonalizedAdsOnly: true },
);

export function shouldRequireRewardedHint(hintsUsed: number) {
  return hintsUsed >= 1;
}

export function useRewardedHintAd() {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rewarded, setRewarded] = useState(false);
  const requestInFlight = useRef(false);
  const rewardEarned = useRef(false);
  const showResultResolver = useRef<((earned: boolean) => void) | null>(null);

  const resolveShowResult = useCallback((earned: boolean) => {
    showResultResolver.current?.(earned);
    showResultResolver.current = null;
  }, []);

  const load = useCallback(() => {
    if (requestInFlight.current || rewardedAd.loaded) return;
    requestInFlight.current = true;
    setLoading(true);
    setRewarded(false);

    rewardedAd.load();
  }, []);

  const show = useCallback(async () => {
    if (!rewardedAd.loaded) {
      load();
      return false;
    }

    rewardEarned.current = false;
    setRewarded(false);

    try {
      const result = new Promise<boolean>((resolve) => {
        showResultResolver.current = resolve;
      });
      await rewardedAd.show();
      return result;
    } catch {
      resolveShowResult(false);
      return false;
    }
  }, [load, resolveShowResult]);

  useEffect(() => {
    const unsubscribeLoaded = rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
      requestInFlight.current = false;
      setLoading(false);
      setReady(true);
    });
    const unsubscribeRewarded = rewardedAd.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      () => {
        rewardEarned.current = true;
        setRewarded(true);
      },
    );
    const unsubscribeError = rewardedAd.addAdEventListener(AdEventType.ERROR, () => {
      requestInFlight.current = false;
      setLoading(false);
      setReady(false);
      resolveShowResult(false);
    });
    const unsubscribeClosed = rewardedAd.addAdEventListener(AdEventType.CLOSED, () => {
      setReady(false);
      resolveShowResult(rewardEarned.current);
      load();
    });

    load();

    return () => {
      unsubscribeLoaded();
      unsubscribeRewarded();
      unsubscribeError();
      unsubscribeClosed();
      resolveShowResult(false);
    };
  }, [load, resolveShowResult]);

  return { ready, loading, rewarded, load, show };
}
