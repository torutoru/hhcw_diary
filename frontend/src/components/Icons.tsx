// 디자인 시안의 인라인 스트로크 아이콘
interface P {
  size?: number;
  strokeWidth?: number;
}

const base = (size: number, strokeWidth: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export const HomeIcon = ({ size = 18, strokeWidth = 2 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20h14V9.5" />
  </svg>
);

export const HomeHeartIcon = ({ size = 36, strokeWidth = 1.8 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20h14V9.5" />
    <path d="M12 17s-3-1.8-3-3.6A1.6 1.6 0 0 1 12 12.6a1.6 1.6 0 0 1 3 .8c0 1.8-3 3.6-3 3.6z" />
  </svg>
);

/** ⋯ 더보기 */
export const MoreIcon = ({ size = 20, strokeWidth = 2.6 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <path d="M5 12h.01M12 12h.01M19 12h.01" />
  </svg>
);

export const TrashIcon = ({ size = 20, strokeWidth = 2 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <path d="M4 7h16M10 11v6M14 11v6" />
    <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
);

export const SearchIcon =({ size = 22, strokeWidth = 2.2 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </svg>
);

export const BellIcon =({ size = 20, strokeWidth = 2 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </svg>
);

export const DownloadIcon =({ size = 20, strokeWidth = 2 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <path d="M12 4v11M7 10l5 5 5-5" />
    <path d="M5 20h14" />
  </svg>
);

/** iOS 공유 버튼 모양 */
export const ShareIcon = ({ size = 20, strokeWidth = 2 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
  </svg>
);

export const ChevronLeftIcon =({ size = 26, strokeWidth = 2.2 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const ChevronRightIcon = ({ size = 26, strokeWidth = 2.2 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <path d="M9 5l7 7-7 7" />
  </svg>
);

export const BackIcon =({ size = 24, strokeWidth = 2 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const UserIcon = ({ size = 24, strokeWidth = 1.8 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </svg>
);

export const UsersIcon = ({ size = 20, strokeWidth = 1.8 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5" />
    <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.2 2.2 3.5 5" />
  </svg>
);

export const LogoutIcon = ({ size = 20, strokeWidth = 1.8 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
    <path d="M10 8l-4 4 4 4M6 12h10" />
  </svg>
);

export const LockIcon = ({ size = 36, strokeWidth = 1.8 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export const PlusIcon =({ size = 20, strokeWidth = 2.2 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const PencilIcon = ({ size = 18, strokeWidth = 2 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <path d="M4 20h4L19 9l-4-4L4 16v4z" />
    <path d="M13.5 6.5l4 4" />
  </svg>
);

export const PhotoIcon = ({ size = 15, strokeWidth = 1.8 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <rect x="3" y="5" width="18" height="15" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M21 16l-5-5-8 9" />
  </svg>
);

export const CloseIcon = ({ size = 20, strokeWidth = 2.2 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const SendIcon = ({ size = 20, strokeWidth = 2 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <path d="M5 12h13M13 6l6 6-6 6" />
  </svg>
);

export const MailIcon = ({ size = 40, strokeWidth = 1.8 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);

export const CheckIcon = ({ size = 42, strokeWidth = 2.2 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export const AlertIcon = ({ size = 40, strokeWidth = 2 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v6M12 16.5v.5" />
  </svg>
);
