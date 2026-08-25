import React, { useState, useEffect, useRef } from "react";
import { Product } from "../types";
import { Language, CATEGORY_TRANSLATIONS } from "../locales";
import { unlockSessionAccess } from "../lib/accessCode";
import {
  ShieldCheck,
  PhoneCall,
  X,
  AlertCircle,
  FileText
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AccessCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessUnlock: () => void;
  onRequestContact: () => void;
  product?: Product | null;
  lang: Language;
}

export default function AccessCodeModal({
  isOpen,
  onClose,
  onSuccessUnlock,
  onRequestContact,
  product,
  lang
}: AccessCodeModalProps) {
  const isAr = lang === "ar";
  const [codeValue, setCodeValue] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCodeValue("");
      setErrorMsg(null);
      setIsSubmitting(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const localizedProductName = product
    ? isAr
      ? product.nameAr || product.name
      : product.name
    : null;

  const handleInputChange = (val: string) => {
    const clean = val.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().substring(0, 8);
    setCodeValue(clean);
    setErrorMsg(null);
  };

  const handleVerify = async (customCode?: string) => {
    const code = (customCode || codeValue).trim().toUpperCase();
    if (code.length !== 8) {
      setErrorMsg(
        isAr
          ? "يرجى إدخال كود الدخول المكون من 8 رموز."
          : "Please enter the complete 8-character access code."
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/access-code/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, productId: product?.id })
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        setErrorMsg(
          isAr
            ? "تم تجاوز عدد محاولات التحقق المسموح بها. يرجى الانتظار عدة دقائق قبل المحاولة مرة أخرى."
            : "Too many failed attempts. Please wait a few minutes before trying again."
        );
        return;
      }

      if (res.ok && data.valid) {
        unlockSessionAccess(data.passToken || "");
        onSuccessUnlock();
        onClose();
      } else {
        setErrorMsg(
          data.error ||
            (isAr
              ? "الكود غير صحيح أو انتهت صلاحيته (الكود صالح لمدة 5 دقائق واستخدام واحد فقط). يرجى التواصل مع فريق المبيعات للحصول على كود جديد."
              : "Invalid, expired, or previously used access code (codes expire after 5 minutes and are single-use). Please contact sales to get a new code.")
        );
      }
    } catch (err: any) {
      setErrorMsg(
        isAr
          ? "حدث خطأ في الاتصال بالخادم. يرجى المحاولة لاحقاً."
          : "Server connection failed. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
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
          {/* Header Banner - MARSO Light Brand Style */}
          <div className="relative bg-gradient-to-r from-red-50 via-white to-slate-50 border-b border-slate-200 text-slate-900 p-5">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            <h2 className="text-xl font-extrabold tracking-tight text-slate-900 mb-1">
              {isAr ? "إدخال كود تحميل المواصفات" : "Enter Datasheet Access Code"}
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              {isAr
                ? "عزيزي العميل، لحماية ورقة المواصفات الفنية والرسومات الهندسية الخاصة بشركة مارسو، يرجى تزويد كود الدخول المزود من مهندس المبيعات (8 رموز)."
                : "Dear customer, to protect official MARSO technical datasheets and engineering specs, please enter the 8-character access code provided by your sales specialist."}
            </p>

            {/* Inquired Product Badge */}
            {product && (
              <div className="mt-3 pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                <div className="truncate pr-2 rtl:pr-0 rtl:pl-2">
                  <span className="text-[9px] uppercase text-slate-400 block font-bold">
                    {isAr ? "الملف المطلوب:" : "Requested Datasheet:"}
                  </span>
                  <span className="font-bold text-slate-900 truncate block text-xs">
                    {localizedProductName}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 text-[10px] font-bold shrink-0">
                  <FileText className="w-3 h-3" />
                  <span>{isAr ? "ورقة المواصفات" : "PDF/Spec"}</span>
                </div>
              </div>
            )}
          </div>

          {/* Modal Body */}
          <div className="p-5 space-y-4 bg-slate-50/50">
            {/* 8-Character Code Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block text-center uppercase tracking-wider">
                {isAr ? "أدخل كود الدخول (8 رموز):" : "Enter 8-Character Access Code:"}
              </label>

              <div className="flex items-center justify-center dir-ltr" dir="ltr">
                <input
                  ref={inputRef}
                  type="text"
                  maxLength={8}
                  value={codeValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="e.g. 8K9P2Q4M"
                  className={`w-full py-3.5 px-4 text-center text-2xl font-mono font-extrabold tracking-widest uppercase rounded-xl border-2 transition-all shadow-xs outline-none ${
                    errorMsg
                      ? "border-red-400 bg-red-50 text-red-700"
                      : codeValue
                      ? "border-red-600 bg-white text-[#B91C1C] ring-2 ring-red-600/20"
                      : "border-slate-300 bg-white text-slate-800 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                  }`}
                />
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 leading-relaxed"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              {/* Verify & Download */}
              <button
                onClick={() => handleVerify()}
                disabled={isSubmitting || codeValue.length !== 8}
                className="cursor-pointer w-full py-3 bg-[#B91C1C] hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-sm active:scale-98 flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                {isAr ? "تأكيد الكود وتحميل ورقة المواصفات" : "Verify Code & Download Datasheet"}
              </button>

              {/* Request Code from Salesman */}
              <button
                onClick={() => {
                  onClose();
                  onRequestContact();
                }}
                className="cursor-pointer w-full py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition-all border border-slate-300 shadow-2xs flex items-center justify-center gap-2"
              >
                <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                {isAr
                  ? "تواصل مع المبيعات للحصول على كود الدخول"
                  : "Contact Sales to Get Access Code"}
              </button>
            </div>
          </div>

          {/* Footer Note */}
          <div className="p-3.5 bg-white border-t border-slate-200 text-center text-[11px] text-slate-500">
            {isAr
              ? "ينتهي كود الدخول تلقائياً بعد 5 دقائق واستخدام واحد فقط من إصداره من قِبل مهندس المبيعات."
              : "Access codes expire after 5 minutes and single-use after issuance by the sales team."}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
