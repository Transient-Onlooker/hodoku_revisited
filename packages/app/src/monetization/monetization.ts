/*
 * Revisited Labs. GPL-3.0-or-later; see LICENSE.
 *
 * Monetization & Entitlements Engine for Revisited Labs applications.
 * Architecture:
 * - Free base application with non-intrusive bottom banner ads.
 * - Single one-time lifetime in-app purchase ($2.99 USD) to permanently remove all ads.
 * - Zero subscriptions, zero recurring monthly charges (MRC).
 * - Supported billing providers:
 *   1. Google Play Digital Goods API (Android Trusted Web Activity / Chrome PWA).
 *   2. Local persistent cache (localStorage with graceful offline support).
 */

export const REMOVE_ADS_SKU = 'remove_ads';
export const DEFAULT_PRICE = '$2.99';
export const STORAGE_KEY = 'revisited_ad_free_v1';
export const GOOGLE_PLAY_BILLING_METHOD = 'https://play.google.com/billing';

export interface DigitalGoodsItemDetails {
  itemId: string;
  title?: string;
  description?: string;
  price?: {
    currency: string;
    value: string;
  };
}

export interface DigitalGoodsPurchaseDetails {
  itemId: string;
  purchaseToken: string;
  acknowledged?: boolean;
}

export interface DigitalGoodsService {
  getDetails(itemIds: string[]): Promise<DigitalGoodsItemDetails[]>;
  listPurchases(): Promise<DigitalGoodsPurchaseDetails[]>;
  consume?(purchaseToken: string): Promise<void>;
}

export interface MonetizationState {
  /** True if the user has unlocked lifetime ad-free status */
  isAdFree: boolean;
  /** True if the current platform supports in-app purchasing (e.g. Google Play via TWA) */
  canPurchase: boolean;
  /** Localized price string formatted by Google Play, or "$2.99" fallback */
  price: string;
  /** Localized product title */
  title: string;
  /** True while querying the store or processing a transaction */
  isLoading: boolean;
  /** Last error message if a purchase or sync operation failed */
  lastError: string | null;
}

type Listener = (state: MonetizationState) => void;

export class MonetizationManager {
  private state: MonetizationState = {
    isAdFree: false,
    canPurchase: false,
    price: DEFAULT_PRICE,
    title: 'Remove Ads (Lifetime)',
    isLoading: false,
    lastError: null,
  };

  private listeners = new Set<Listener>();
  private service: DigitalGoodsService | null = null;
  public initPromise: Promise<void> | null = null;

  constructor() {
    this.readCachedState();
  }

  /** Reset internal state for unit testing */
  public _resetForTesting(): void {
    this.state = {
      isAdFree: false,
      canPurchase: false,
      price: DEFAULT_PRICE,
      title: 'Remove Ads (Lifetime)',
      isLoading: false,
      lastError: null,
    };
    this.service = null;
    this.initPromise = null;
    this.listeners.clear();
    this.readCachedState();
  }

  /** Read existing entitlement from local persistent storage. */
  private readCachedState(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const cached = window.localStorage.getItem(STORAGE_KEY);
        if (cached === '1' || cached === 'true') {
          this.state.isAdFree = true;
        }
      }
    } catch {
      // Storage unavailable or private browsing mode
    }
  }

  /** Persist the ad-free entitlement to local storage. */
  private persistState(adFree: boolean): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (adFree) {
          window.localStorage.setItem(STORAGE_KEY, '1');
        } else {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      // Ignore quota / private mode storage failures
    }
  }

  private notify(): void {
    const snapshot = { ...this.state };
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[Monetization] Listener error:', err);
      }
    }
  }

  /** Subscribe to monetization state changes. Returns an unsubscribe callback. */
  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Get current snapshot of the monetization state. */
  public getState(): MonetizationState {
    return { ...this.state };
  }

  /**
   * Initialize billing services and sync store entitlements.
   * Safe to call multiple times; shares a single initialization promise.
   */
  public async init(): Promise<MonetizationState> {
    if (this.initPromise) {
      await this.initPromise;
      return this.getState();
    }

    this.initPromise = (async () => {
      this.state.isLoading = true;
      this.readCachedState();
      this.notify();

      try {
        // Detect Digital Goods API (Google Play Billing in TWA / Android Chrome)
        const win = typeof window !== 'undefined' ? (window as any) : null;
        if (win && typeof win.getDigitalGoodsService === 'function') {
          try {
            const service: DigitalGoodsService = await win.getDigitalGoodsService(
              GOOGLE_PLAY_BILLING_METHOD,
            );
            if (service) {
              this.service = service;
              this.state.canPurchase = true;

              // 1. Sync existing purchases
              if (typeof service.listPurchases === 'function') {
                const purchases = await service.listPurchases();
                const hasPurchased = purchases.some(
                  (p) => p.itemId === REMOVE_ADS_SKU,
                );
                if (hasPurchased) {
                  this.state.isAdFree = true;
                  this.persistState(true);
                }
              }

              // 2. Fetch localized pricing metadata
              if (typeof service.getDetails === 'function') {
                const details = await service.getDetails([REMOVE_ADS_SKU]);
                const item = details.find((d) => d.itemId === REMOVE_ADS_SKU);
                if (item) {
                  if (item.title) this.state.title = item.title;
                  if (item.price?.currency && item.price?.value) {
                    try {
                      this.state.price = new Intl.NumberFormat(undefined, {
                        style: 'currency',
                        currency: item.price.currency,
                      }).format(Number(item.price.value));
                    } catch {
                      this.state.price = `${item.price.currency} ${item.price.value}`;
                    }
                  }
                }
              }
            }
          } catch (svcErr: any) {
            // Digital goods service connection failed or unavailable
            this.state.canPurchase = false;
            this.state.lastError = svcErr?.message || 'Digital Goods service unavailable';
          }
        } else {
          // Standard web browser or desktop runtime
          this.state.canPurchase = false;
        }
      } catch (err: any) {
        this.state.lastError = err?.message || 'Monetization init error';
      } finally {
        this.state.isLoading = false;
        this.notify();
      }
    })();

    await this.initPromise;
    return this.getState();
  }

  /**
   * Launch native 1-tap checkout for the one-time $2.99 lifetime ad removal.
   */
  public async purchaseRemoveAds(): Promise<{ success: boolean; error?: string }> {
    if (this.state.isAdFree) {
      return { success: true };
    }

    if (!this.state.canPurchase) {
      const err = 'In-app purchases are not supported in this environment.';
      this.state.lastError = err;
      this.notify();
      return { success: false, error: err };
    }

    this.state.isLoading = true;
    this.state.lastError = null;
    this.notify();

    try {
      const win = typeof window !== 'undefined' ? (window as any) : null;
      if (!win || typeof win.PaymentRequest !== 'function') {
        throw new Error('PaymentRequest API is not available.');
      }

      const paymentMethodData = [
        {
          supportedMethods: GOOGLE_PLAY_BILLING_METHOD,
          data: {
            sku: REMOVE_ADS_SKU,
          },
        },
      ];

      const paymentDetails = {
        total: {
          label: this.state.title,
          amount: {
            currency: 'USD',
            value: '2.99',
          },
        },
      };

      const request = new win.PaymentRequest(paymentMethodData, paymentDetails);
      const response = await request.show();

      // Purchase succeeded: complete payment transaction
      if (typeof response.complete === 'function') {
        await response.complete('success');
      }

      // Unlock ad-free status immediately
      this.state.isAdFree = true;
      this.persistState(true);
      this.state.isLoading = false;
      this.notify();

      return { success: true };
    } catch (err: any) {
      const message =
        err?.name === 'AbortError'
          ? 'Purchase cancelled.'
          : err?.message || 'Purchase failed.';
      this.state.lastError = message;
      this.state.isLoading = false;
      this.notify();
      return { success: false, error: message };
    }
  }

  /**
   * Re-check store purchase history and restore previous entitlements.
   */
  public async restorePurchases(): Promise<boolean> {
    if (!this.service || typeof this.service.listPurchases !== 'function') {
      return this.state.isAdFree;
    }

    this.state.isLoading = true;
    this.notify();

    try {
      const purchases = await this.service.listPurchases();
      const hasPurchased = purchases.some((p) => p.itemId === REMOVE_ADS_SKU);
      if (hasPurchased) {
        this.state.isAdFree = true;
        this.persistState(true);
      }
      return hasPurchased;
    } catch (err: any) {
      this.state.lastError = err?.message || 'Failed to restore purchases.';
      return this.state.isAdFree;
    } finally {
      this.state.isLoading = false;
      this.notify();
    }
  }
}

export const monetization = new MonetizationManager();
