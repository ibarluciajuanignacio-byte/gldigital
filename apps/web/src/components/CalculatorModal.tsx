import { useState, useCallback } from "react";

type Props = { onClose: () => void };

export function CalculatorModal({ onClose }: Props) {
  const [display, setDisplay] = useState("");
  const [outcome, setOutcome] = useState("");

  const append = useCallback((displayVal: string, evalVal?: string) => {
    const forEval = evalVal ?? (displayVal === "×" ? "*" : displayVal === "÷" ? "/" : displayVal);
    setOutcome((prev) => prev + forEval);
    setDisplay((prev) => prev + displayVal);
  }, []);

  const handleEqual = useCallback(() => {
    if (!outcome.trim()) return;
    try {
      const result = String(eval(outcome));
      setOutcome(result);
      setDisplay(result);
    } catch {
      setDisplay("Error");
      setOutcome("");
    }
  }, [outcome]);

  const handleClear = useCallback(() => {
    setDisplay("");
    setOutcome("");
  }, []);

  const handleMin = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <div className="silva-cal-wrap" onClick={(e) => e.stopPropagation()}>
      <div className="silva-cal">
        <ul className="silva-cal-ctrls">
          <li className="silva-cal-ctrl silva-cal-ctrl--close">
            <button type="button" onClick={onClose} aria-label="Cerrar" />
          </li>
          <li className="silva-cal-ctrl silva-cal-ctrl--min">
            <button type="button" onClick={handleMin} aria-label="Minimizar" />
          </li>
          <li className="silva-cal-ctrl silva-cal-ctrl--max">
            <button type="button" aria-label="Maximizar" />
          </li>
        </ul>
        <span className="silva-cal-title">Calculator</span>
        <div className="silva-cal-screen">{display || "0"}</div>
        <ul className="silva-cal-buttons">
          <li>
            <button type="button" className="silva-cal-btn silva-cal-btn--clear" onClick={handleClear}>
              C
            </button>
          </li>
          <li>
            <button type="button" className="silva-cal-btn silva-cal-btn--val" onClick={() => append("-")}>
              ±
            </button>
          </li>
          <li>
            <button type="button" className="silva-cal-btn silva-cal-btn--val" onClick={() => append("÷", "/")}>
              ÷
            </button>
          </li>
          <li>
            <button type="button" className="silva-cal-btn silva-cal-btn--val" onClick={() => append("×", "*")}>
              ×
            </button>
          </li>
          <li>
            <button type="button" className="silva-cal-btn silva-cal-btn--val" onClick={() => append("7")}>
              7
            </button>
          </li>
          <li>
            <button type="button" className="silva-cal-btn silva-cal-btn--val" onClick={() => append("8")}>
              8
            </button>
          </li>
          <li>
            <button type="button" className="silva-cal-btn silva-cal-btn--val" onClick={() => append("9")}>
              9
            </button>
          </li>
          <li>
            <button type="button" className="silva-cal-btn silva-cal-btn--val" onClick={() => append("-")}>
              -
            </button>
          </li>
          <li>
            <button type="button" className="silva-cal-btn silva-cal-btn--val" onClick={() => append("4")}>
              4
            </button>
          </li>
          <li>
            <button type="button" className="silva-cal-btn silva-cal-btn--val" onClick={() => append("5")}>
              5
            </button>
          </li>
          <li>
            <button type="button" className="silva-cal-btn silva-cal-btn--val" onClick={() => append("6")}>
              6
            </button>
          </li>
          <li>
            <button type="button" className="silva-cal-btn silva-cal-btn--val" onClick={() => append("+")}>
              +
            </button>
          </li>
          <li>
            <button type="button" className="silva-cal-btn silva-cal-btn--val" onClick={() => append("1")}>
              1
            </button>
          </li>
          <li>
            <button type="button" className="silva-cal-btn silva-cal-btn--val" onClick={() => append("2")}>
              2
            </button>
          </li>
          <li>
            <button type="button" className="silva-cal-btn silva-cal-btn--val" onClick={() => append("3")}>
              3
            </button>
          </li>
          <li>
            <button type="button" className="silva-cal-btn silva-cal-btn--tall silva-cal-btn--equal" onClick={handleEqual}>
              =
            </button>
          </li>
          <li>
            <button type="button" className="silva-cal-btn silva-cal-btn--val silva-cal-btn--wide silva-cal-btn--shift" onClick={() => append("0")}>
              0
            </button>
          </li>
          <li>
            <button type="button" className="silva-cal-btn silva-cal-btn--val silva-cal-btn--shift" onClick={() => append(".")}>
              .
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
