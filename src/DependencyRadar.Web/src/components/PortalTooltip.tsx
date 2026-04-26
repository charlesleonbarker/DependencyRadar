import { type ReactElement, cloneElement, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface PortalTooltipProps {
  text: string;
  children: ReactElement<{ onMouseEnter?: React.MouseEventHandler; onMouseLeave?: React.MouseEventHandler; onFocus?: React.FocusEventHandler; onBlur?: React.FocusEventHandler }>;
}

const GAP = 8;
const MARGIN = 8;

export function PortalTooltip({ text, children }: PortalTooltipProps) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const tooltipRef = useRef<HTMLDivElement>(null);

  const show = (currentTarget: Element) => {
    const rect = currentTarget.getBoundingClientRect();
    setAnchor(rect);
    setStyle({ left: rect.left + rect.width / 2, top: rect.top - GAP });
  };
  const hide = () => setAnchor(null);

  useLayoutEffect(() => {
    if (!anchor || !tooltipRef.current) return;
    const tip = tooltipRef.current.getBoundingClientRect();
    const vw = window.innerWidth;

    let left = anchor.left + anchor.width / 2;
    const halfW = tip.width / 2;
    if (left - halfW < MARGIN) left = halfW + MARGIN;
    if (left + halfW > vw - MARGIN) left = vw - halfW - MARGIN;

    const fitsAbove = anchor.top - GAP - tip.height >= MARGIN;
    const top = fitsAbove ? anchor.top - GAP : anchor.bottom + GAP;
    const transform = fitsAbove ? "translate(-50%, -100%)" : "translate(-50%, 0)";

    setStyle({ left, top, transform });
  }, [anchor]);

  return (
    <>
      {cloneElement(children, {
        onMouseEnter: (event) => {
          children.props.onMouseEnter?.(event);
          show(event.currentTarget);
        },
        onMouseLeave: (event) => {
          children.props.onMouseLeave?.(event);
          hide();
        },
        onFocus: (event) => {
          children.props.onFocus?.(event);
          show(event.currentTarget);
        },
        onBlur: (event) => {
          children.props.onBlur?.(event);
          hide();
        },
      })}
      {anchor ? createPortal(
        <div ref={tooltipRef} className="portal-tooltip" style={style}>
          {text}
        </div>,
        document.body,
      ) : null}
    </>
  );
}
