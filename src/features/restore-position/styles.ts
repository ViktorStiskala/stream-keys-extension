// Restore Position dialog styles

import { Styles } from '@/ui/styles/variables';

// Public API
export const DialogStyles = {
  container: `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: ${Styles.vars.overlay.bg};
    color: ${Styles.vars.text.primary};
    padding: ${Styles.vars.spacing.xxl} 32px;
    border-radius: ${Styles.vars.borderRadius.xxl};
    font-family: ${Styles.vars.font.family};
    z-index: ${Styles.vars.zIndex.max};
    min-width: 300px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  `,

  header: `
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: ${Styles.vars.spacing.lg};
  `,

  title: `
    font-size: ${Styles.vars.font.sizeXLarge};
    font-weight: 600;
  `,

  closeButton: `
    background: transparent;
    border: none;
    color: ${Styles.vars.text.secondary};
    font-size: 26px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
    margin-top: -5px;
    transition: color 0.2s;
  `,

  currentTimeContainer: `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${Styles.vars.spacing.md} ${Styles.vars.spacing.lg};
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid ${Styles.vars.overlay.borderLight};
    border-radius: ${Styles.vars.borderRadius.lg};
    margin-bottom: ${Styles.vars.spacing.sm};
  `,

  currentTimeLabel: `
    font-size: ${Styles.vars.font.sizeMedium};
    color: ${Styles.vars.text.secondary};
  `,

  currentTimeValue: `
    font-size: ${Styles.vars.font.sizeLarge};
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  `,

  list: `
    display: flex;
    flex-direction: column;
    gap: ${Styles.vars.spacing.sm};
  `,

  positionItem: `
    position: relative;
    display: flex;
    align-items: center;
    gap: ${Styles.vars.spacing.md};
    padding: ${Styles.vars.spacing.md} ${Styles.vars.spacing.lg} ${Styles.vars.spacing.lg} ${Styles.vars.spacing.lg};
    background: ${Styles.vars.overlay.bgActive};
    border: 1px solid ${Styles.vars.overlay.border};
    border-radius: ${Styles.vars.borderRadius.lg};
    color: ${Styles.vars.text.primary};
    font-size: ${Styles.vars.font.sizeLarge};
    cursor: pointer;
    transition: background 0.2s;
    text-align: left;
    overflow: hidden;
  `,

  positionItemUserSaved: `
    position: relative;
    display: flex;
    align-items: center;
    gap: ${Styles.vars.spacing.md};
    padding: ${Styles.vars.spacing.md} ${Styles.vars.spacing.lg} ${Styles.vars.spacing.lg} ${Styles.vars.spacing.lg};
    background: ${Styles.vars.accent.green};
    border: 1px solid ${Styles.vars.accent.greenBorder};
    border-radius: ${Styles.vars.borderRadius.lg};
    color: ${Styles.vars.text.primary};
    font-size: ${Styles.vars.font.sizeLarge};
    cursor: pointer;
    transition: background 0.2s;
    text-align: left;
    overflow: hidden;
  `,

  keyHint: `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: ${Styles.vars.overlay.border};
    border-radius: ${Styles.vars.borderRadius.sm};
    font-size: ${Styles.vars.font.sizeMedium};
    font-weight: 600;
    flex-shrink: 0;
  `,

  timeLabel: `
    flex: 1;
    font-variant-numeric: tabular-nums;
  `,

  relativeTime: `
    font-size: ${Styles.vars.font.sizeSmall};
    color: ${Styles.vars.text.muted};
    flex-shrink: 0;
  `,

  progressBar: `
    position: absolute;
    bottom: ${Styles.vars.spacing.xs};
    left: ${Styles.vars.spacing.lg};
    right: ${Styles.vars.spacing.lg};
    height: 3px;
    background: ${Styles.vars.progress.bg};
    border-radius: 2px;
    overflow: hidden;
  `,

  progressFill: `
    height: 100%;
    background: ${Styles.vars.progress.fill};
    border-radius: 2px;
  `,

  separator: `
    height: 1px;
    background: linear-gradient(
      to right,
      rgba(255,255,255,0) 0,
      rgba(255,255,255,0.15) 24px,
      rgba(255,255,255,0.15) calc(100% - 24px),
      rgba(255,255,255,0) 100%
    );
    margin: ${Styles.vars.spacing.xs} -20px;
  `,

  hint: `
    font-size: ${Styles.vars.font.sizeSmall};
    color: ${Styles.vars.text.muted};
    margin-top: ${Styles.vars.spacing.lg};
    text-align: center;
  `,
} as const;
