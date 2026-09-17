jest.mock('react-native-google-mobile-ads', () => ({
  AdEventType: { CLOSED: 'closed', ERROR: 'error' },
  RewardedAd: { createForAdRequest: jest.fn(() => ({ loaded: false })) },
  RewardedAdEventType: { EARNED_REWARD: 'earned_reward', LOADED: 'loaded' },
  TestIds: { REWARDED: 'test-rewarded-ad' },
}));

describe('rewarded hint ad config', () => {
  it('uses the production hint ad unit id', () => {
    const { adUnitId } = require('./useRewardedHintAd');
    expect(adUnitId).toBe('ca-app-pub-8952058057579255/7704178238');
  });

  it('gives one free hint before requiring a rewarded ad', () => {
    const { shouldRequireRewardedHint } = require('./useRewardedHintAd');
    expect(shouldRequireRewardedHint(0)).toBe(false);
    expect(shouldRequireRewardedHint(1)).toBe(true);
  });
});
