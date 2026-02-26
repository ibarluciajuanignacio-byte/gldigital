import type { ReactNode, CSSProperties } from "react";

const BOX_CLASS = "silva-card";

type Props = { children: ReactNode; className?: string; style?: CSSProperties };

export function Box({ children, className = "", style }: Props) {
  return (
    <div className={`${BOX_CLASS} ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}
