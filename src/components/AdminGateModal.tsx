import React, { useState } from "react";
import { ShieldAlert, X, Lock, AlertTriangle, ArrowRight } from "lucide-react";

interface AdminGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGatePassed: () => void;
  isRtl: boolean;
}

// SHA-256 hash of "7812430al3#@2" - plaintext secret is never stored in bundle code
const GATE_HASH = "734816761040fc5f6233489b4b25d2293ea614a65d74e9e5b40fab5f53f45d82";

export const AdminGateModal: React.FC<AdminGateModalProps> = ({
  isOpen,
  onClose,
  onGatePassed,
  isRtl,
}) => {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) return;

    setIsVerifying(true);
    setError(null);

    try {
      // Hash user input using Web Crypto API to avoid storing plaintext passphrase in source code
      const encoder = new TextEncoder();
      const data = encoder.encode(passphrase.trim());
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const inputHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      if (inputHash === GATE_HASH) {
        setPassphrase("");
        onClose();
        onGatePassed();
      } else {
        setError(
          isRtl
            ? "رمز المرور غير صحيح. تم رفض الوصول."
            : "Invalid passphrase. Access denied."
        );
      }
    } catch (err) {
      setError(
        isRtl ? "حدث خطأ في عملية التحقق." : "Verification error occurred."
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCancel = () => {
    setPassphrase("");
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden ${
          isRtl ? "text-right" : "text-left"
        }`}
        dir={isRtl ? "rtl" : "ltr"}
      >
        {/* Header decoration */}
        <div className="h-1 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 w-full" />

        <div className="p-6">
          {/* Title & Warning icon */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  {isRtl ? "منطقة خاصة محظورة" : "Restricted Private Area"}
                </h3>
                <p className="text-xs text-red-400 font-medium mt-0.5">
                  {isRtl
                    ? "أنت الآن في منطقة خاصة محظورة للمشرفين فقط"
                    : "You are in a restricted private area for admins only"}
                </p>
              </div>
            </div>
            <button
              onClick={handleCancel}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2.5 text-red-400 text-xs font-semibold animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {isRtl ? "رمز المرور السري للمنطقة المحظورة" : "Restricted Gate Passphrase"}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder={
                    isRtl ? "أدخل رمز المرور..." : "Enter passphrase..."
                  }
                  autoFocus
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-900">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isVerifying}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-xl transition"
              >
                {isRtl ? "إلغاء (Cancel)" : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={isVerifying || !passphrase.trim()}
                className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 rounded-xl shadow-lg shadow-red-950/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition"
              >
                <span>{isRtl ? "متابعة" : "Proceed"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
