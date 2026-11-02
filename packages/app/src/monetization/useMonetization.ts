/*
 * Revisited Labs. GPL-3.0-or-later; see LICENSE.
 *
 * React Hook for seamless integration with the Revisited Labs Monetization Engine.
 */
import { useEffect, useState } from 'react';
import { monetization, type MonetizationState } from './monetization';

export function useMonetization() {
  const [state, setState] = useState<MonetizationState>(() => monetization.getState());

  useEffect(() => {
    const unsubscribe = monetization.subscribe((nextState) => {
      setState(nextState);
    });

    // Kick off background store check
    monetization.init().catch((err) => {
      console.warn('[useMonetization] Background sync error:', err);
    });

    return unsubscribe;
  }, []);

  return {
    ...state,
    purchaseRemoveAds: () => monetization.purchaseRemoveAds(),
    restorePurchases: () => monetization.restorePurchases(),
  };
}
