import React, { useState, useEffect } from "react";
import { RefreshCw, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";

interface CaptchaChallengeProps {
  onVerify: (isValid: boolean) => void;
  isRtl?: boolean;
}

export const CaptchaChallenge: React.FC<CaptchaChallengeProps> = ({ onVerify, isRtl = false }) => {
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [operator, setOperator] = useState<"+" | "-">("+");
  const [userAnswer, setUserAnswer] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState(false);

  const generateChallenge = () => {
    const op = Math.random() > 0.5 ? "+" : "-";
    let n1 = Math.floor(Math.random() * 12) + 2;
    let n2 = Math.floor(Math.random() * 10) + 1;

    if (op === "-" && n1 < n2) {
      const temp = n1;
      n1 = n2;
      n2 = temp;
    }

    setNum1(n1);
    setNum2(n2);
    setOperator(op);
    setUserAnswer("");
    setIsVerified(false);
    setError(false);
    onVerify(false);
  };

  useEffect(() => {
    generateChallenge();
  }, []);

  const handleCheck = () => {
    const expected = operator === "+" ? num1 + num2 : num1 - num2;
    if (parseInt(userAnswer.trim(), 10) === expected) {
      setIsVerified(true);
      setError(false);
      onVerify(true);
    } else {
      setIsVerified(false);
      setError(true);
      onVerify(false);
    }
  };

  return (
    <div className="p-3.5 bg-slate-800/80 border border-slate-700/60 rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <ShieldCheck className="w-4 h-4 text-teal-400" />
          <span>{isRtl ? "تأكيد الهوية البصرية (أنا إنسان)" : "Human Verification Check"}</span>
        </div>
        <button
          type="button"
          onClick={generateChallenge}
          className="p-1 text-slate-400 hover:text-slate-200 transition rounded-lg hover:bg-slate-700"
          title={isRtl ? "إعادة توليد السؤال" : "Refresh challenge"}
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        {/* Challenge Box with stylized visual background */}
        <div className="px-3 py-1.5 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-700 rounded-lg select-none font-mono text-base font-bold text-teal-300 tracking-wider shadow-inner">
          {num1} {operator} {num2} = ?
        </div>

        <input
          type="number"
          value={userAnswer}
          onChange={(e) => {
            setUserAnswer(e.target.value);
            setError(false);
            if (isVerified) {
              setIsVerified(false);
              onVerify(false);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCheck();
            }
          }}
          placeholder={isRtl ? "الإجابة" : "Answer"}
          disabled={isVerified}
          className="w-20 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-teal-500 text-center font-mono disabled:opacity-60"
        />

        {!isVerified ? (
          <button
            type="button"
            onClick={handleCheck}
            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium rounded-lg transition shrink-0"
          >
            {isRtl ? "تحقق" : "Verify"}
          </button>
        ) : (
          <div className="flex items-center gap-1 text-emerald-400 text-xs font-semibold shrink-0">
            <CheckCircle2 className="w-4 h-4" />
            <span>{isRtl ? "تم التحقق" : "Verified"}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{isRtl ? "إجابة غير صحيحة، يرجى المحاولة مرة أخرى" : "Incorrect answer, please try again"}</span>
        </div>
      )}
    </div>
  );
};
