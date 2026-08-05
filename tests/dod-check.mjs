import('@aer/runtime-lib').then(m => {
  console.log('=== External Import Check (DoD) ===');
  const r = m.checkHealth();
  console.log('checkHealth result:', r);
  console.log('\n=== Public API Surface ===');
  const keys = Object.keys(m).filter(k => /[Hh]ealth/.test(k));
  console.log('Health-related exports:', keys);
});
