import React from 'react';

export interface IconProps {
  size?: number | string;
  className?: string;
  color?: string;
  style?: React.CSSProperties;
}

export function IconAnkerLogo({ size = 20, className, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" strokeOpacity="0.25" fill={color} fillOpacity="0.1" />
      <path d="M12 4V20M8 8L12 4L16 8M6 15C6 18.3137 8.68629 21 12 21C15.3137 21 18 18.3137 18 15" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconShieldCheck({ size = 18, className, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M12 22S4 18 4 12V5L12 2L20 5V12C20 18 12 22 12 22Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 12L11 14L15 10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconLock({ size = 18, className, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <rect x="3" y="11" width="18" height="11" rx="2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 11V7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7V11" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconFsmProcess({ size = 18, className, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <rect x="3" y="3" width="6" height="6" rx="1.5" stroke={color} strokeWidth="2" />
      <rect x="15" y="3" width="6" height="6" rx="1.5" stroke={color} strokeWidth="2" />
      <rect x="9" y="15" width="6" height="6" rx="1.5" stroke={color} strokeWidth="2" />
      <path d="M9 6H15M6 9V12C6 13.1046 6.89543 14 8 14H10M18 9V12C18 13.1046 17.1046 14 16 14H14" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconSourceQuote({ size = 18, className, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2V8H20M16 13H8M16 17H8M10 9H8" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconConfidenceGauge({ size = 18, className, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke={color} strokeWidth="2" />
      <path d="M19.07 4.93C20.94 6.8 22 9.3 22 12C22 17.52 17.52 22 12 22C6.48 22 2 17.52 2 12C2 9.3 3.06 6.8 4.93 4.93" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M12 9V5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconPermissionGuard({ size = 18, className, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
      <path d="M12 8V12M12 16H12.01M4.93 4.93L19.07 19.07" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconCameraVision({ size = 18, className, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M23 19C23 19.5304 22.7893 20.0391 22.4142 20.4142C22.0391 20.7893 21.5304 21 21 21H3C2.46957 21 1.96086 20.7893 1.58579 20.4142C1.21071 20.0391 1 19.5304 1 19V8C1 7.46957 1.21071 6.96086 1.58579 6.58579C1.96086 6.21071 2.46957 6 3 6H7L9 3H15L17 6H21C21.5304 6 22.0391 6.21071 22.4142 6.58579C22.7893 6.96086 23 7.46957 23 8V19Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="4" stroke={color} strokeWidth="2" />
    </svg>
  );
}

export function IconSparkles({ size = 18, className, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M12 2L14.4 7.6L20 10L14.4 12.4L12 18L9.6 12.4L4 10L9.6 7.6L12 2Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 16L19.8 17.8L22 18.5L19.8 19.2L19 21L18.2 19.2L16 18.5L18.2 17.8L19 16Z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconSkipAhead({ size = 18, className, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <polygon points="5 4 15 12 5 20 5 4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill={color} fillOpacity="0.2" />
      <line x1="19" y1="5" x2="19" y2="19" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconGitBranch({ size = 18, className, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <line x1="6" y1="3" x2="6" y2="15" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="18" cy="6" r="3" stroke={color} strokeWidth="2" />
      <circle cx="6" cy="18" r="3" stroke={color} strokeWidth="2" />
      <path d="M18 9C18 12.3137 15.3137 15 12 15H6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconChartTrend({ size = 18, className, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="17 6 23 6 23 12" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconTicket({ size = 18, className, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M2 9C3.65685 9 5 7.65685 5 6V4C5 3.44772 5.44772 3 6 3H18C18.5523 3 19 3.44772 19 4V6C19 7.65685 20.3431 9 22 9V15C20.3431 15 19 16.3431 19 18V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V18C5 16.3431 3.65685 15 2 15V9Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="9" y1="8" x2="15" y2="8" stroke={color} strokeWidth="2" strokeLinecap="round" strokeDasharray="2 2" />
      <line x1="9" y1="12" x2="15" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" strokeDasharray="2 2" />
      <line x1="9" y1="16" x2="15" y2="16" stroke={color} strokeWidth="2" strokeLinecap="round" strokeDasharray="2 2" />
    </svg>
  );
}

export function IconAlertTriangle({ size = 18, className, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M10.29 3.86L1.82 18C1.64537 18.3024 1.55296 18.6453 1.55199 18.9945C1.55101 19.3437 1.64151 19.6871 1.81442 19.9905C1.98733 20.2939 2.23672 20.5467 2.53771 20.7239C2.83869 20.9012 3.18082 20.9962 3.53 21H20.47C20.8192 20.9962 21.1613 20.9012 21.4623 20.7239C21.7633 20.5467 22.0127 20.2939 22.1856 19.9905C22.3585 19.6871 22.449 19.3437 22.448 18.9945C22.447 18.6453 22.3546 18.3024 22.18 18L13.71 3.86C13.5317 3.56611 13.2807 3.32312 12.9812 3.15449C12.6817 2.98587 12.3438 2.89727 12 2.89727C11.6562 2.89727 11.3183 2.98587 11.0188 3.15449C10.7193 3.32312 10.4683 3.56611 10.29 3.86Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="9" x2="12" y2="13" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="17" x2="12.01" y2="17" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconSend({ size = 18, className, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <line x1="22" y1="2" x2="11" y2="13" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill={color} fillOpacity="0.2" />
    </svg>
  );
}

export function IconTrash({ size = 18, className, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <polyline points="3 6 5 6 21 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCheckCircle({ size = 18, className, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="22 4 12 14.01 9 11.01" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconExternalLink({ size = 16, className, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M18 13V19C18 19.5304 17.7893 20.0391 17.4142 20.4142C17.0391 20.7893 16.5304 21 16 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V8C3 7.46957 3.21071 6.96086 3.58579 6.58579C3.96086 6.21071 4.46957 6 5 6H11" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="15 3 21 3 21 9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="10" y1="14" x2="21" y2="3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconUser({ size = 18, className, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="7" r="4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconRobot({ size = 18, className, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <rect x="3" y="11" width="18" height="10" rx="2" stroke={color} strokeWidth="2" />
      <circle cx="8.5" cy="16" r="1.5" fill={color} />
      <circle cx="15.5" cy="16" r="1.5" fill={color} />
      <path d="M12 2V7M9 2H15M2 15H3M21 15H22" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconChevronDown({ size = 16, className, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <polyline points="6 9 12 15 18 9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconGrid({ size = 18, className, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <rect x="3" y="3" width="7" height="7" stroke={color} strokeWidth="2" />
      <rect x="14" y="3" width="7" height="7" stroke={color} strokeWidth="2" />
      <rect x="14" y="14" width="7" height="7" stroke={color} strokeWidth="2" />
      <rect x="3" y="14" width="7" height="7" stroke={color} strokeWidth="2" />
    </svg>
  );
}
