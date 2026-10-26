import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './ui';

interface TooltipState {
  text: string;
  targetRect: DOMRect;
  placement: 'top' | 'bottom';
  hotkey?: string;
  isCode?: boolean;
}

export function InteractiveTooltipProvider({ children }: { children?: React.ReactNode }) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const currentTargetRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<any>(null);
  const openTimerRef = useRef<any>(null);
  const isOverTooltipRef = useRef<boolean>(false);

  const clearTimers = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  };

  const scheduleClose = useCallback((delay = 320) => {
    clearTimers();
    closeTimerRef.current = setTimeout(() => {
      if (!isOverTooltipRef.current) {
        setTooltip(null);
        setCopied(false);
        currentTargetRef.current = null;
      }
    }, delay);
  }, []);

  const openForElement = useCallback((el: HTMLElement) => {
    // If element has native title, transfer to data-tooltip to suppress native browser tooltip
    const rawTitle = el.getAttribute('title');
    if (rawTitle && rawTitle.trim()) {
      el.setAttribute('data-tooltip', rawTitle.trim());
      el.removeAttribute('title');
    }

    const rawText = el.getAttribute('data-tooltip') || el.getAttribute('data-title');
    if (!rawText || !rawText.trim()) {
      scheduleClose(50);
      return;
    }

    clearTimers();
    currentTargetRef.current = el;

    // Detect hotkeys like (Ctrl+K), (Esc), [⌘K], (Arrow Left), etc.
    let cleanText = rawText.trim();
    let hotkey: string | undefined;
    const hotkeyMatch = cleanText.match(/\((Ctrl\+[A-Za-z0-9]|⌘[A-Za-z0-9]|Esc|Arrow\s+[A-Za-z]+)\)$/i) ||
                        cleanText.match(/\[([⌘CtrlShiftAlt\+A-Za-z0-9\s]+)\]$/i);
    if (hotkeyMatch) {
      hotkey = hotkeyMatch[1];
      cleanText = cleanText.replace(hotkeyMatch[0], '').trim();
    }

    const isCode = cleanText.startsWith('/') ||
                   cleanText.startsWith('#') ||
                   cleanText.includes('.mp4') ||
                   cleanText.includes('.png') ||
                   cleanText.includes('.ts') ||
                   cleanText.includes('.js') ||
                   cleanText.includes('.json') ||
                   /^[a-f0-9]{7,40}$/i.test(cleanText);

    openTimerRef.current = setTimeout(() => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      const placement = rect.top < 90 ? 'bottom' : 'top';
      setTooltip({
        text: cleanText,
        targetRect: rect,
        placement,
        hotkey,
        isCode
      });
      setCopied(false);
    }, 70); // Very responsive 70ms zero-latency feel
  }, [scheduleClose]);

  useEffect(() => {
    const handleMouseOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.('[data-tooltip], [title], [data-title]') as HTMLElement | null;
      if (target) {
        openForElement(target);
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.('[data-tooltip], [title], [data-title]') as HTMLElement | null;
      if (target && target === currentTargetRef.current) {
        scheduleClose(320);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearTimers();
        setTooltip(null);
        setCopied(false);
        currentTargetRef.current = null;
      }
    };

    const handleScroll = (e: Event) => {
      // Don't close if scrolling inside the tooltip itself
      if (tooltipRef.current && tooltipRef.current.contains(e.target as Node)) {
        return;
      }
      if (tooltip && currentTargetRef.current) {
        const rect = currentTargetRef.current.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) {
          clearTimers();
          setTooltip(null);
          currentTargetRef.current = null;
        } else {
          setTooltip(prev => prev ? { ...prev, targetRect: rect } : null);
        }
      }
    };

    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);

    return () => {
      clearTimers();
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('mouseout', handleMouseOut, true);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [openForElement, scheduleClose, tooltip]);

  const handleCopyText = async (textToCopy: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    let success = false;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
        success = true;
      }
    } catch {
      // Fallback below
    }

    if (!success) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch (err) {
        console.warn('Fallback copy failed:', err);
      }
    }

    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const renderTooltip = () => {
    if (!tooltip) return null;

    const { text, targetRect, placement, hotkey, isCode } = tooltip;
    const centerX = targetRect.left + targetRect.width / 2;

    // Default styles for placement
    const isTop = placement === 'top';
    const top = isTop ? targetRect.top - 8 : targetRect.bottom + 8;

    return createPortal(
      <aside
        ref={tooltipRef}
        role="tooltip"
        aria-live="polite"
        className={`qc-interactive-tooltip qc-placement-${placement} ${copied ? 'qc-copied-state' : ''}`}
        style={{
          position: 'fixed',
          top: `${top}px`,
          left: `${centerX}px`,
          transform: isTop ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
          zIndex: 999999,
        }}
        onMouseEnter={() => {
          isOverTooltipRef.current = true;
          clearTimers();
        }}
        onMouseLeave={() => {
          isOverTooltipRef.current = false;
          scheduleClose(220);
        }}
      >
        {/* Invisible mouse bridge preventing hover gap loss */}
        <div className={`qc-tooltip-bridge qc-bridge-${placement}`} />

        <div className="qc-tooltip-inner-card">
          <div className="qc-tooltip-header">
            <div className="qc-tooltip-header-left">
              <span className="qc-tooltip-kicker-dot" />
              <span className="qc-tooltip-kicker-label">HOVER TEXT</span>
              {hotkey && <kbd className="qc-tooltip-kbd">{hotkey}</kbd>}
            </div>

            <button
              type="button"
              className={`qc-tooltip-pick-btn ${copied ? 'copied' : ''}`}
              onClick={(e) => handleCopyText(text, e)}
              title="Salin teks ini ke clipboard (Pick Text)"
            >
              <Icon name={copied ? 'check' : 'copy'} size={12} />
              <span>{copied ? 'Tersalin!' : 'Pick / Salin'}</span>
            </button>
          </div>

          <div
            className={`qc-tooltip-body ${isCode ? 'is-code' : ''}`}
            onClick={() => handleCopyText(text)}
            title="Klik untuk memilih & menyalin seluruh teks"
          >
            <div className="qc-tooltip-text-selectable">
              {text}
            </div>
            <div className="qc-tooltip-pick-hint">
              <span>{copied ? '✓ Teks berhasil disalin ke clipboard' : 'Klik teks atau blok untuk copy'}</span>
            </div>
          </div>
        </div>

        {/* Pointer Arrow */}
        <div className={`qc-tooltip-arrow qc-arrow-${placement}`} />
      </aside>,
      document.body
    );
  };

  return (
    <>
      {children}
      {renderTooltip()}
    </>
  );
}
