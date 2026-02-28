import { useState, useCallback } from "react";

const MAX_HISTORY = 10;
type HistoryItem = { expr: string; result: string };

type Props = { onClose: () => void };

export function CalculatorModal({ onClose }: Props) {
  const [display, setDisplay] = useState("");
  const [outcome, setOutcome] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const append = useCallback((displayVal: string, evalVal?: string) => {
    const forEval = evalVal ?? (displayVal === "×" ? "*" : displayVal === "÷" ? "/" : displayVal);
    setOutcome((prev) => prev + forEval);
    setDisplay((prev) => prev + displayVal);
  }, []);

  const handleEqual = useCallback(() => {
    if (!outcome.trim()) return;
    const exprForHistory = display || outcome;
    try {
      const result = String(eval(outcome));
      setOutcome(result);
      setDisplay(result);
      setHistory((prev) => [{ expr: exprForHistory, result }, ...prev].slice(0, MAX_HISTORY));
    setHistoryIndex(0);
    } catch {
      setDisplay("Error");
      setOutcome("");
    }
  }, [outcome, display]);

  const handleClear = useCallback(() => {
    setDisplay("");
    setOutcome("");
  }, []);

  const handleMin = useCallback(() => {
    onClose();
  }, [onClose]);

  const applyHistoryItem = useCallback((item: HistoryItem) => {
    setDisplay(item.result);
    setOutcome(item.result);
  }, []);

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
        {/* 4 columnas: fila 1 C % ± ÷ | 2 7 8 9 × | 3 4 5 6 − | 4 1 2 3 + | 5 0(ancho) . = */}
        <ul className="silva-cal-buttons">
          <li><button type="button" className="silva-cal-btn silva-cal-btn--clear" onClick={handleClear}>C</button></li>
          <li><button type="button" className="silva-cal-btn silva-cal-btn--val" onClick={() => append("%", "*0.01")} title="Porcentaje">%</button></li>
          <li><button type="button" className="silva-cal-btn silva-cal-btn--val" onClick={() => append("-")}>±</button></li>
          <li><button type="button" className="silva-cal-btn silva-cal-btn--val silva-cal-btn--op" onClick={() => append("÷", "/")}>÷</button></li>
          <li><button type="button" className="silva-cal-btn silva-cal-btn--val" onClick={() => append("7")}>7</button></li>
          <li><button type="button" className="silva-cal-btn silva-cal-btn--val" onClick={() => append("8")}>8</button></li>
          <li><button type="button" className="silva-cal-btn silva-cal-btn--val" onClick={() => append("9")}>9</button></li>
          <li><button type="button" className="silva-cal-btn silva-cal-btn--val silva-cal-btn--op" onClick={() => append("×", "*")}>×</button></li>
          <li><button type="button" className="silva-cal-btn silva-cal-btn--val" onClick={() => append("4")}>4</button></li>
          <li><button type="button" className="silva-cal-btn silva-cal-btn--val" onClick={() => append("5")}>5</button></li>
          <li><button type="button" className="silva-cal-btn silva-cal-btn--val" onClick={() => append("6")}>6</button></li>
          <li><button type="button" className="silva-cal-btn silva-cal-btn--val silva-cal-btn--op" onClick={() => append("-")}>−</button></li>
          <li><button type="button" className="silva-cal-btn silva-cal-btn--val" onClick={() => append("1")}>1</button></li>
          <li><button type="button" className="silva-cal-btn silva-cal-btn--val" onClick={() => append("2")}>2</button></li>
          <li><button type="button" className="silva-cal-btn silva-cal-btn--val" onClick={() => append("3")}>3</button></li>
          <li><button type="button" className="silva-cal-btn silva-cal-btn--val silva-cal-btn--op" onClick={() => append("+")}>+</button></li>
          <li className="silva-cal-buttons__wide"><button type="button" className="silva-cal-btn silva-cal-btn--val" onClick={() => append("0")}>0</button></li>
          <li><button type="button" className="silva-cal-btn silva-cal-btn--val" onClick={() => append(".")}>.</button></li>
          <li><button type="button" className="silva-cal-btn silva-cal-btn--equal silva-cal-btn--op" onClick={handleEqual}>=</button></li>
        </ul>
        {history.length > 0 && (
          <div className="silva-cal-history">
            <div className="silva-cal-history__header">
              <span className="silva-cal-history__title">Últimas 10</span>
              <div className="silva-cal-history__nav">
                <button
                  type="button"
                  className="silva-cal-history__arrow"
                  onClick={() => setHistoryIndex((i) => (i < history.length - 1 ? i + 1 : i))}
                  disabled={historyIndex >= history.length - 1}
                  aria-label="Anterior"
                >
                  ▲
                </button>
                <span className="silva-cal-history__counter">{historyIndex + 1} / {history.length}</span>
                <button
                  type="button"
                  className="silva-cal-history__arrow"
                  onClick={() => setHistoryIndex((i) => (i > 0 ? i - 1 : 0))}
                  disabled={historyIndex <= 0}
                  aria-label="Siguiente"
                >
                  ▼
                </button>
              </div>
            </div>
            <button
              type="button"
              className="silva-cal-history__slide"
              onClick={() => applyHistoryItem(history[historyIndex])}
              title="Usar este resultado"
            >
              <span className="silva-cal-history__expr">{history[historyIndex].expr}</span>
              <span className="silva-cal-history__result">= {history[historyIndex].result}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
