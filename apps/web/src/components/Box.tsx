import type { ReactNode, CSSProperties } from "react";

const BOX_CLASS = "silva-card";

type Props = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
} & React.HTMLAttributes<HTMLDivElement>;

export function Box({ children, className = "", style, ...rest }: Props) {
  return (
    <div className={`${BOX_CLASS} ${className}`.trim()} style={style} {...rest}>
      {children}
    </div>
  );
}
