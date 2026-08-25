import React, { useState, useEffect } from "react";
import { CODE_EXPIRY_MS, GeneratedCode } from "../lib/accessCode";
import {
  Key,
  Copy,
  Check,
  RefreshCw,
  Clock,
  MessageSquare,
  ShieldCheck,
  X,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AdminCodeGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAr: boolean;
}

export default function AdminCodeGeneratorModal({
  isOpen,
  onClose,
  isAr
}: AdminCodeGeneratorModalProps) {
  const [currentCodeObj, setCurrentCodeObj] = useState<GeneratedCode | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(300);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Generate new code on open
  useEffect(() => {
    if (isOpen) {
      handleGenerate();
    }
  }, [isOpen]);

  // Countdown timer effect
  useEffect(() => {
    if (!isOpen || !currentCodeObj) return;

    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((currentCodeObj.expiresAt - Date.now()) / 1000));
      setRemainingSeconds(diff);
      if (diff <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, currentCodeObj]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const token = sessionStorage.getItem("marso_admin_token") || "";
      const res = await fetch("/api/access-code/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data: GeneratedCode = await res.json();
        setCurrentCodeObj(data);
        const diff = Math.max(0, Math.floor((data.expiresAt - Date.now()) / 1000));
        setRemainingSeconds(diff);
        setCopiedCode(false);
        setCopiedMsg(false);
      } else {
        console.error("Failed to generate server access code.");
      }
    } catch (e) {
      console.error("Error generating server access code:", e);
    } finally {
      setIsGenerating(false);
    }
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getClientMessageText = () => {
    const code = currentCodeObj ? currentCodeObj.code : "";
    if (isAr) {
      return `مرحباً بك من شركة مارسو للمطاط وعزل الأرضيات 🏭\nكود الدخول المخصص لك لتحميل ملف المواصفات الفنية والرسومات هو: *${code}*\n(الكود صالح لمدة 5 دقائق من الآن واستخدام واحد فقط)`;
    } else {
      return `Hello from MARSO Rubber Product Specialist 🏭\nYour 8-character access code to download official technical datasheets is: *${code}*\n(Valid for 5 minutes from now and single-use)`;
    }
  };

  const handleCopyCodeOnly = async () => {
    if (!currentCodeObj) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(currentCodeObj.code);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = currentCodeObj.code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch (e) {
      console.error("Failed to copy code", e);
    }
  };

  const handleCopyMessage = async () => {
    const msg = getClientMessageText();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(msg);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = msg;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2500);
    } catch (e) {
      console.error("Failed to copy message", e);
    }
  };

  const isExpired = remainingSeconds <= 0;
  const progressPercent = Math.min(100, (remainingSeconds / 300) * 100);

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        dir={isAr ? "rtl" : "ltr"}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 text-slate-800 my-auto"
        >
          {/* Header Banner */}
          <div className="relative bg-gradient-to-r from-red-50 via-white to-slate-50 border-b border-slate-200 text-slate-900 p-5">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-[#B91C1C] text-white shadow-2xs">
                <Key className="w-3 h-3" />
                {isAr ? "لوحة مبيعات المشرف" : "Admin OTP Generator"}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                {isAr ? "كود دخول مؤقت (5 دقائق)" : "5-Min Live OTP"}
              </span>
            </div>

            <h2 className="text-xl font-extrabold tracking-tight text-slate-900 mb-1">
              {isAr ? "مولد أكواد الدخول للمبيعات" : "Sales Access Code Generator"}
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              {isAr
                ? "قم بتوليد كود دخول مكون من 8 رموز ومشاركته مع العميل لمنحه صلاحية تحميل المواصفات لمدة 5 دقائق."
                : "Generate an 8-character access code to share with clients for 5-minute datasheet download access."}
            </p>
          </div>

          {/* Main Content */}
          <div className="p-5 space-y-4 bg-slate-50/60">
            {/* Generated Code Display Box */}
            <div className="bg-white rounded-2xl p-5 border-2 border-red-200 shadow-sm text-center space-y-3 relative overflow-hidden">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                {isAr ? "كود الدخول الصادر للعميل" : "Active 8-Character Access Code"}
              </span>

              {/* Big Code Display */}
              <div className="py-2">
                <div
                  className={`text-4xl sm:text-5xl font-mono font-extrabold tracking-widest dir-ltr ${
                    isExpired ? "text-slate-400 line-through" : "text-[#B91C1C]"
                  }`}
                >
                  {currentCodeObj ? currentCodeObj.code : "--------"}
                </div>
              </div>

              {/* Countdown Timer Progress Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs font-semibold px-1">
                  <span className="flex items-center gap-1 text-slate-600">
                    <Clock className="w-3.5 h-3.5 text-red-600" />
                    {isAr ? "الصلاحية المتبقية:" : "Time Remaining:"}
                  </span>
                  <span
                    className={`font-mono font-bold ${
                      remainingSeconds < 60 ? "text-red-600 animate-pulse" : "text-slate-800"
                    }`}
                  >
                    {formatTimer(remainingSeconds)}
                  </span>
                </div>

                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      remainingSeconds < 60 ? "bg-red-600" : "bg-emerald-500"
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5">
              {/* Generate New Code */}
              <button
                onClick={handleGenerate}
                className="cursor-pointer w-full py-3 bg-[#B91C1C] hover:bg-red-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-sm active:scale-98 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                {isAr ? "توليد كود دخول جديد (Generate New Code)" : "Generate New Access Code"}
              </button>

              {/* Dual Copy Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleCopyCodeOnly}
                  className="cursor-pointer py-2.5 px-3 bg-white hover:bg-slate-100 text-slate-800 font-bold rounded-xl text-xs transition-all border border-slate-200 shadow-2xs flex items-center justify-center gap-1.5"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      {isAr ? "تم النسخ" : "Copied"}
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-600" />
                      {isAr ? "نسخ الكود فقط" : "Copy Code"}
                    </>
                  )}
                </button>

                <button
                  onClick={handleCopyMessage}
                  className="cursor-pointer py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl text-xs transition-all border border-emerald-200 shadow-2xs flex items-center justify-center gap-1.5"
                >
                  {copiedMsg ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      {isAr ? "تم نسخ الرسالة" : "Copied Msg"}
                    </>
                  ) : (
                    <>
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      {isAr ? "نسخ رسالة العميل" : "Copy Client Msg"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="p-3.5 bg-white border-t border-slate-200 text-center text-[11px] text-slate-500">
            {isAr
              ? "ينتهي كود الدخول تلقائياً بعد 5 دقائق من إنشائه. يمكنك توليد كود جديد في أي وقت."
              : "Access codes automatically expire in 5 minutes. You can generate a new code anytime."}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
