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

export const BackIcon = ({ size = 24, strokeWidth = 2 }: P) => (
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

export const PlusIcon = ({ size = 20, strokeWidth = 2.2 }: P) => (
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
