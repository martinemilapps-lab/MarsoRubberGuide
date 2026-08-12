import React, { useState } from "react";
import { Lock, Mail, Eye, EyeOff, ShieldCheck, X, AlertTriangle, Loader2 } from "lucide-react";
import { CaptchaChallenge } from "./CaptchaChallenge";

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (token: string) => void;
  isRtl: boolean;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  isRtl,
}) => {
  const [email, setEmail] = useState("admin@marso-egy.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCaptchaVerified, setIsCaptchaVerified] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMessage(isRtl ? "يرجى إدخال كلمة المرور" : "Please enter password");
      return;
    }

    if (!isCaptchaVerified) {
      setErrorMessage(isRtl ? "يرجى إكمال التحقق البشري (CAPTCHA) أولاً" : "Please complete the CAPTCHA human verification first.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Server API Authentication
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim(), password: password.trim() }),
      });

      const serverData = await response.json().catch(() => ({}));

      if (response.ok && serverData.token) {
        setPassword("");
        onLoginSuccess(serverData.token);
        onClose();
      } else {
        setErrorMessage(
          serverData.error ||
            (isRtl
              ? "بيانات الاعتماد غير صحيحة. تعذر تسجيل دخول المشرف."
              : "Invalid credentials. Admin access denied.")
        );
      }
    } catch (err: any) {
      setErrorMessage(
        isRtl
          ? "حدث خطأ في الاتصال بالخادم. يرجى المحاولة لاحقاً."
          : "Connection failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-md bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden ${
          isRtl ? "text-right" : "text-left"
        }`}
        dir={isRtl ? "rtl" : "ltr"}
      >
        {/* Header decoration bar */}
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 w-full" />

        {/* Modal content */}
        <div className="p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">
                  {isRtl ? "تسجيل دخول المشرف" : "Admin Authentication"}
                </h3>
                <p className="text-xs text-slate-400">
                  {isRtl
                    ? "مصادقة آمنة لإدارة الكتالوج والمنتجات"
                    : "Secure authentication for catalog management"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-400 text-sm animate-in fade-in">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {isRtl ? "البريد الإلكتروني للمشرف" : "Admin Email"}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={
                    isRtl ? "admin@marso-egy.com" : "admin@marso-egy.com"
                  }
                  required
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {isRtl ? "كلمة المرور السرية" : "Admin Password"}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    isRtl ? "أدخل كلمة المرور..." : "Enter admin password..."
                  }
                  autoFocus
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-10 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <CaptchaChallenge onVerify={setIsCaptchaVerified} isRtl={isRtl} />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition"
              >
                {isRtl ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={isLoading || !password.trim() || !isCaptchaVerified}
                className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-lg shadow-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{isRtl ? "جاري المصادقة..." : "Authenticating..."}</span>
                  </>
                ) : (
                  <span>{isRtl ? "تسجيل الدخول" : "Sign In"}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
