import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * KSI Toss 스타일 버튼 변형 정의
 * - border-radius: 12px (rounded-xl)
 * - transition: 150ms ease
 * - font-weight: 600 (semibold)
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center whitespace-nowrap",
    "rounded-xl text-sm font-semibold",
    "transition-all duration-150 ease",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3182F6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1117]",
    "disabled:pointer-events-none disabled:opacity-40",
  ].join(" "),
  {
    variants: {
      variant: {
        // Primary — Toss Blue 채움
        default:
          "bg-[#3182F6] text-white hover:bg-[#4D95FF] active:bg-[#2570E0] shadow-sm",
        // Secondary — 어두운 배경 + 경계선
        secondary:
          "bg-[#1E2535] text-[#F0F4FF] border border-[#242D3D] hover:bg-[#242D3D] hover:border-[#3182F6]/40",
        // Outline — 테두리만, 배경 투명
        outline:
          "bg-transparent text-[#F0F4FF] border border-[#242D3D] hover:bg-[#1E2535] hover:border-[#3182F6]/40",
        // Ghost — 배경 없음
        ghost:
          "bg-transparent text-[#8B96A9] hover:bg-[#1E2535] hover:text-[#F0F4FF]",
        // Link — 밑줄 스타일
        link:
          "bg-transparent text-[#3182F6] underline-offset-4 hover:underline hover:text-[#4D95FF]",
        // Destructive — 위험/삭제 액션
        destructive:
          "bg-[#F04452]/15 text-[#F04452] border border-[#F04452]/25 hover:bg-[#F04452]/25",
      },
      size: {
        // default: 높이 40px
        default: "h-10 px-4 py-2",
        // sm: 높이 32px
        sm: "h-8 px-3 py-1.5 text-xs rounded-lg",
        // lg: 높이 48px
        lg: "h-12 px-6 py-3 text-base",
        // icon: 정사각형
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

/** KSI Toss 스타일 버튼 컴포넌트 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
