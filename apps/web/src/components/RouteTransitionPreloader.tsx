import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

const SHOW_DURATION_MS = 280;
const FADE_OUT_MS = 220;

export function RouteTransitionPreloader() {
  const location = useLocation();
  const prevPathnameRef = useRef<string>(location.pathname);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (location.pathname === prevPathnameRef.current) return;
    prevPathnameRef.current = location.pathname;

    setExiting(false);
    setVisible(true);

    const hideTimer = window.setTimeout(() => {
      setExiting(true);
    }, SHOW_DURATION_MS);

    const clearTimer = window.setTimeout(() => {
      setVisible(false);
      setExiting(false);
    }, SHOW_DURATION_MS + FADE_OUT_MS);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(clearTimer);
    };
  }, [location.pathname]);

  if (!visible) return null;

  return (
    <div
      className={`silva-route-preloader ${exiting ? "silva-route-preloader--exit" : ""}`}
      aria-hidden="true"
      role="presentation"
    >
      <div className="silva-route-preloader__backdrop" />
      <div className="silva-route-preloader__icon-wrap">
        <div className="silva-route-preloader__glow" aria-hidden />
        <div className="silva-route-preloader__orbit silva-route-preloader__orbit--inner">
          <span className="silva-route-preloader__electron" style={{ "--angle": "0deg" } as React.CSSProperties} />
          <span className="silva-route-preloader__electron" style={{ "--angle": "120deg" } as React.CSSProperties} />
          <span className="silva-route-preloader__electron" style={{ "--angle": "240deg" } as React.CSSProperties} />
        </div>
        <div className="silva-route-preloader__orbit silva-route-preloader__orbit--outer">
          <span className="silva-route-preloader__electron" style={{ "--angle": "0deg" } as React.CSSProperties} />
          <span className="silva-route-preloader__electron" style={{ "--angle": "180deg" } as React.CSSProperties} />
        </div>
        <img
          src="/EngineeredBigLigas.png"
          alt=""
          className="silva-route-preloader__logo"
        />
      </div>
    </div>
  );
}
