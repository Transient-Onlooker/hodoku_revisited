/*
 * Revisited Labs. GPL-3.0-or-later; see LICENSE.
 *
 * Lightweight, non-intrusive bottom banner ad component.
 * Features:
 * - Hidden automatically if user has lifetime ad-free entitlement (`isAdFree`).
 * - Displays a clean "Remove ads ($2.99)" 1-click button if Google Play Billing is supported (`canPurchase`).
 * - Safe area inset compliant for modern Android edge-to-edge screens.
 * - Zero full-screen popups, zero video interruptions, zero layout shifts.
 */
import React from 'react';
import { useMonetization } from './useMonetization';

export interface AdBannerProps {
  /** AdSense Slot ID (optional) */
  slotId?: string;
  /** Custom wrapper CSS class */
  className?: string;
}

export const AdBanner: React.FC<AdBannerProps> = ({ slotId, className = '' }) => {
  const { isAdFree, canPurchase, price, purchaseRemoveAds, isLoading } = useMonetization();

  // If user has unlocked lifetime ad-free, unmount completely
  if (isAdFree) {
    return null;
  }

  const handleRemoveAds = async (e: React.MouseEvent) => {
    e.preventDefault();
    await purchaseRemoveAds();
  };

  return (
    <aside
      className={`revisited-ad-banner ${className}`}
      role="region"
      aria-label="Advertisement"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 900,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0px))',
        background: 'var(--ad-bg, rgba(21, 23, 27, 0.95))',
        backdropFilter: 'blur(8px)',
        borderTop: '1px solid var(--ad-border, rgba(255, 255, 255, 0.1))',
        color: 'var(--ad-fg, #e2e8f0)',
        fontSize: '0.825rem',
        minHeight: '48px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            fontSize: '0.65rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '2px 5px',
            borderRadius: '3px',
            background: 'rgba(255, 255, 255, 0.15)',
            color: 'inherit',
          }}
        >
          Ad
        </span>
        <span style={{ opacity: 0.85 }}>Support Revisited Labs open-source development</span>
      </div>

      {canPurchase && (
        <button
          type="button"
          onClick={handleRemoveAds}
          disabled={isLoading}
          aria-label={`Remove ads for ${price} one-time`}
          style={{
            appearance: 'none',
            background: 'var(--accent, #3b82f6)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 10px',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: isLoading ? 'wait' : 'pointer',
            whiteSpace: 'nowrap',
            transition: 'opacity 0.15s ease',
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          {isLoading ? 'Processing...' : `Remove ads (${price})`}
        </button>
      )}
    </aside>
  );
};
