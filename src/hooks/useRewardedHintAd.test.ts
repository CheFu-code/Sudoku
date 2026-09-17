describe('rewarded hint ad config', () => {
  it('uses the production hint ad unit id', () => {
    const { adUnitId } = require('./useRewardedHintAd');
    expect(adUnitId).toBe('ca-app-pub-8952058057579255/7704178238');
  });
});
