// Utility per Screen Wake Lock API (mantenere lo schermo attivo durante prove e concerti)

let wakeLockSentinel: any = null;

export async function requestWakeLock(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if ('wakeLock' in navigator) {
    try {
      wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      wakeLockSentinel.addEventListener('release', () => {
        wakeLockSentinel = null;
      });
      return true;
    } catch (err) {
      console.warn('Wake Lock request failed:', err);
      return false;
    }
  }
  return false;
}

export async function releaseWakeLock(): Promise<void> {
  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
    } catch {
      // Ignora errori di rilascio
    }
    wakeLockSentinel = null;
  }
}

export function setupWakeLockAutoRenew(): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleVisibilityChange = async () => {
    if (wakeLockSentinel !== null && document.visibilityState === 'visible') {
      await requestWakeLock();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
