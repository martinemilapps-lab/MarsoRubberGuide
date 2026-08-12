import React, { useState, useEffect, useRef } from "react";
import { Product } from "../types";
import { Language, CATEGORY_TRANSLATIONS } from "../locales";
import { verifyAccessCode } from "../lib/accessCode";
import {
  ShieldCheck,
  PhoneCall,
  Key,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
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
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null)
  ];

  useEffect(() => {
    if (isOpen) {
      setDigits(["", "", "", ""]);
      setErrorMsg(null);
      setIsSubmitting(false);
      setTimeout(() => {
        inputRefs[0].current?.focus();
      }, 150);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const localizedProductName = product
    ? isAr
      ? product.nameAr || product.name
      : product.name
    : null;

  const localizedCategory = product
    ? CATEGORY_TRANSLATIONS[product.category]?.[lang] || product.category
    : null;

  const handleDigitChange = (index: number, val: string) => {
    const clean = val.replace(/[^0-9]/g, "");
    if (!clean) {
      const newDigits = [...digits];
      newDigits[index] = "";
      setDigits(newDigits);
      setErrorMsg(null);
      return;
    }

    const lastChar = clean[clean.length - 1];
    const newDigits = [...digits];
    newDigits[index] = lastChar;
    setDigits(newDigits);
    setErrorMsg(null);

    // Auto-advance focus to next digit
    if (index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    // Auto-submit when all 4 digits are filled
    const fullCode = newDigits.join("");
    if (fullCode.length === 4 && !newDigits.includes("")) {
      handleVerify(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleVerify = (codeToVerify?: string) => {
    const code = codeToVerify || digits.join("");
    if (code.length !== 4) {
      setErrorMsg(
        isAr
          ? "يرجى إدخال كود الدخول المكون من 4 أرقام كاملة."
          : "Please enter the complete 4-digit access code."
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    setTimeout(() => {
      const isValid = verifyAccessCode(code);
      setIsSubmitting(false);

      if (isValid) {
        onSuccessUnlock();
        onClose();
      } else {
        setErrorMsg(
          isAr
            ? "الكود غير صحيح أو انتهت صلاحيته (الكود صالح لمدة 5 دقائق فقط). يرجى التواصل مع فريق المبيعات للحصول على كود جديد."
            : "Invalid or expired access code (codes expire after 5 minutes). Please contact sales to get a new code."
        );
      }
    }, 200);
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
                ? "عزيزي العميل، لحماية ورقة المواصفات الفنية والرسومات الهندسية الخاصة بشركة مارسو، يرجى تزويد كود الدخول المزود من مهندس المبيعات."
                : "Dear customer, to protect official MARSO technical datasheets and engineering specs, please enter the 4-digit code provided by your sales specialist."}
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
            {/* 4-Digit Code Input Row */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block text-center uppercase tracking-wider">
                {isAr ? "أدخل كود الدخول (4 أرقام):" : "Enter 4-Digit Access Code:"}
              </label>

              <div className="flex items-center justify-center gap-2.5 dir-ltr" dir="ltr">
                {digits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={inputRefs[idx]}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className={`w-12 h-14 text-center text-2xl font-mono font-extrabold rounded-xl border-2 transition-all shadow-xs outline-none ${
                      errorMsg
                        ? "border-red-400 bg-red-50 text-red-700"
                        : digit
                        ? "border-red-600 bg-white text-[#B91C1C] ring-2 ring-red-600/20"
                        : "border-slate-300 bg-white text-slate-800 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                    }`}
                  />
                ))}
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
                disabled={isSubmitting}
                className="cursor-pointer w-full py-3 bg-[#B91C1C] hover:bg-red-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-sm active:scale-98 flex items-center justify-center gap-2"
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
              ? "ينتهي كود الدخول تلقائياً بعد 5 دقائق من إصداره من قِبل مهندس المبيعات."
              : "Access codes automatically expire 5 minutes after issuance by the sales team."}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
