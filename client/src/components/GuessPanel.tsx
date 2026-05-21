import { NUMBER_PAIRS } from "../constants/pairs";
import { NumberCardImage } from "./NumberCardImage";
import modelImg from "../images/model.png";
import "./GuessPanel.css";

interface GuessPanelProps {
  selections: (number | null)[];
  onSelect: (pairIndex: number, value: number) => void;
  disabled?: boolean;
}

export function GuessPanel({
  selections,
  onSelect,
  disabled,
}: GuessPanelProps) {
  return (
    <div className="guess">
      <div className="guess__model-side">
        <img src={modelImg} alt="" className="guess__model" />
      </div>

      <ul className="guess__pairs">
        {NUMBER_PAIRS.map(([a, b], i) => {
          const sel = selections[i];
          return (
            <li key={`${a}-${b}`} className="guess__row">
              <button
                type="button"
                className={sel === a ? "pick pick--on" : "pick"}
                onClick={() => onSelect(i, a)}
                disabled={disabled}
                aria-pressed={sel === a}
                aria-label={`Cặp ${i + 1}, ${a}`}
              >
                <NumberCardImage value={a} />
              </button>
              <button
                type="button"
                className={sel === b ? "pick pick--on" : "pick"}
                onClick={() => onSelect(i, b)}
                disabled={disabled}
                aria-pressed={sel === b}
                aria-label={`Cặp ${i + 1}, ${b}`}
              >
                <NumberCardImage value={b} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
