import React, { useState, useEffect } from "react";
import { Product } from "../types";
import { Language, CATEGORY_TRANSLATIONS } from "../locales";
import {
  PhoneCall,
  MessageSquare,
  Download,
  Copy,
  Check,
  X,
  Mail,
  UserCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface SalesCardInfo {
  id: string;
  name: string;
  phone: string; // e.g. "+20 1090113113"
  rawPhone: string; // "201090113113"
  formattedPhone: string; // "+20 109 011 3113"
  categoriesEn: string[];
  categoriesAr: string[];
  groupTitleEn: string;
  groupTitleAr: string;
}

export const SALES_CONTACT_CARDS: SalesCardInfo[] = [
  {
    id: "group-1",
    name: "Marso Team",
    phone: "+20 1090113113",
    rawPhone: "201090113113",
    formattedPhone: "+20 109 011 3113",
    categoriesEn: [
      "Reversed Engineering",
      "Constructive Rubber Industries",
      "Reclaimed and Crumb Rubber",
      "Automotive Spare parts"
    ],
    categoriesAr: [
      "الهندسة العكسية",
      "الصناعات المطاطية الإنشائية",
      "المطاط المجدد والحبيبات",
      "قطع غيار السيارات المطاطية"
    ],
    groupTitleEn: "Reversed Engineering, Construction, Reclaimed Rubber & Automotive",
    groupTitleAr: "الهندسة العكسية، المطاط الإنشائي، المجدد وقطع غيار السيارات"
  },
  {
    id: "group-2",
    name: "Marso Team",
    phone: "+20 1200161781",
    rawPhone: "201200161781",
    formattedPhone: "+20 120 016 1781",
    categoriesEn: [
      "EPDM",
      "Industrial Rubber Flooring",
      "Industrial Rubber Supplies"
    ],
    categoriesAr: [
      "مطاط EPDM",
      "الأرضيات المطاطية الصناعية",
      "المستلزمات المطاطية الصناعية"
    ],
    groupTitleEn: "EPDM, Industrial Rubber Flooring & Industrial Supplies",
    groupTitleAr: "مطاط EPDM، الأرضيات والمستلزمات المطاطية الصناعية"
  },
  {
    id: "group-3",
    name: "Marso Team",
    phone: "+20 1206733368",
    rawPhone: "201206733368",
    formattedPhone: "+20 120 673 3368",
    categoriesEn: [
      "Parking Supplies",
      "Rubber Mat Flooring",
      "Rubber Tile Flooring",
      "Rubber Car Mats"
    ],
    categoriesAr: [
      "مستلزمات المواقف",
      "حصائر الأرضيات المطاطية",
      "بلاط الأرضيات المطاطية",
      "دواسات السيارات المطاطية"
    ],
    groupTitleEn: "Parking Supplies, Rubber Mat Flooring & Car Mats",
    groupTitleAr: "مستلزمات المواقف، حصائر الأرضيات ودواسات السيارات"
  }
];

export function getSalesCardForCategory(category?: string | null): SalesCardInfo {
  if (!category) return SALES_CONTACT_CARDS[0];

  const norm = category.toLowerCase().trim();

  // Group 1: Reversed Engineering, Constructive Rubber Industries, Reclaimed and Crumb Rubber, Automotive Spare parts
  if (
    norm.includes("reverse") ||
    norm.includes("reversed") ||
    norm.includes("عكسية") ||
    norm.includes("constructive") ||
    norm.includes("إنشائية") ||
    norm.includes("reclaimed") ||
    norm.includes("crumb") ||
    norm.includes("مجدد") ||
    norm.includes("حبيبات") ||
    norm.includes("automotive") ||
    norm.includes("سيارات")
  ) {
    return SALES_CONTACT_CARDS[0];
  }

  // Group 2: EPDM, Industrial Rubber Flooring, Industrial Rubber Supplies
  if (
    norm.includes("epdm") ||
    norm.includes("industrial rubber flooring") ||
    norm.includes("industrial rubber supplies") ||
    norm.includes("صناعية")
  ) {
    return SALES_CONTACT_CARDS[1];
  }

  // Group 3: Parking Supplies, Rubber Mat Flooring, Rubber Car Mats
  if (
    norm.includes("parking") ||
    norm.includes("مواقف") ||
    norm.includes("mat") ||
    norm.includes("حصائر") ||
    norm.includes("tile") ||
    norm.includes("بلاط") ||
    norm.includes("car mat") ||
    norm.includes("دواسات")
  ) {
    return SALES_CONTACT_CARDS[2];
  }

  return SALES_CONTACT_CARDS[0];
}

interface ContactCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
  lang: Language;
}

export default function ContactCardModal({
  isOpen,
  onClose,
  product,
  lang
}: ContactCardModalProps) {
  const isAr = lang === "ar";
  const [selectedCardId, setSelectedCardId] = useState<string>(SALES_CONTACT_CARDS[0].id);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [vcardSaved, setVcardSaved] = useState(false);

  // Sync selected card based on product category when opened
  useEffect(() => {
    if (isOpen) {
      const card = getSalesCardForCategory(product?.category);
      setSelectedCardId(card.id);
      setCopiedAll(false);
      setCopiedPhone(false);
      setVcardSaved(false);
    }
  }, [isOpen, product]);

  if (!isOpen) return null;

  const currentCard = SALES_CONTACT_CARDS.find(c => c.id === selectedCardId) || SALES_CONTACT_CARDS[0];

  const localizedProductName = product
    ? isAr
      ? product.nameAr || product.name
      : product.name
    : null;

  const localizedCategory = product
    ? CATEGORY_TRANSLATIONS[product.category]?.[lang] || product.category
    : null;

  // Build full card copy text
  const getFullCopyText = () => {
    if (isAr) {
      let text = `📋 بطاقة تواصل مبيعات مارسو للمطاط (MARSO Rubber Specialist)\n`;
      text += `--------------------------------------------------\n`;
      text += `👤 اسم المسؤول: ${currentCard.name}\n`;
      text += `📞 رقم مبيعات القسم: ${currentCard.phone}\n`;
      text += `📂 أقسام المنتجات التابعة: ${currentCard.categoriesAr.join(" - ")}\n`;
      if (localizedProductName) {
        text += `📦 المنتج المطلوب: ${localizedProductName}\n`;
      }
      if (localizedCategory) {
        text += `🏷️ التصنيف الفني: ${localizedCategory}\n`;
      }
      if (product?.specs?.code) {
        text += `🔢 كود المنتج: ${product.specs.code}\n`;
      }
      text += `📧 البريد الإلكتروني: Sylvia@marso-egy.com / Samuel@marso-egy.com\n`;
      text += `🌐 الموقع الإلكتروني: MARSO Rubber Product Specialist`;
      return text;
    } else {
      let text = `📋 MARSO Rubber Sales Contact Card\n`;
      text += `--------------------------------------------------\n`;
      text += `👤 Contact Name: ${currentCard.name}\n`;
      text += `📞 Direct Sales Phone: ${currentCard.phone}\n`;
      text += `📂 Category Scope: ${currentCard.categoriesEn.join(" • ")}\n`;
      if (localizedProductName) {
        text += `📦 Inquired Product: ${localizedProductName}\n`;
      }
      if (localizedCategory) {
        text += `🏷️ Classification: ${localizedCategory}\n`;
      }
      if (product?.specs?.code) {
        text += `🔢 Product Code: ${product.specs.code}\n`;
      }
      text += `📧 Email Contacts: Sylvia@marso-egy.com / Samuel@marso-egy.com\n`;
      text += `🌐 Website: MARSO Rubber Product Specialist`;
      return text;
    }
  };

  const handleCopyAll = async () => {
    const text = getFullCopyText();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    } catch (e) {
      console.error("Failed to copy card info", e);
    }
  };

  const handleCopyPhone = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(currentCard.phone);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = currentCard.phone;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2500);
    } catch (e) {
      console.error("Failed to copy phone number", e);
    }
  };

  const handleDirectCall = () => {
    const cleanPhone = currentCard.phone.replace(/[^+\d]/g, "");
    window.location.href = `tel:${cleanPhone}`;
  };

  const handleSaveToPhone = () => {
    const cleanPhone = currentCard.phone.replace(/[^+\d]/g, "");
    const productNote = localizedProductName 
      ? (isAr ? `المنتج المحدد في الطلب: ${localizedProductName}` : `Inquired Product: ${localizedProductName}`) 
      : "";
    
    const categoriesStr = isAr 
      ? currentCard.categoriesAr.join(" - ") 
      : currentCard.categoriesEn.join(" • ");

    const vcardLines = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:Team;MARSO;Sales;;",
      `FN:MARSO Sales Team (${currentCard.name})`,
      "ORG:MARSO Company (Origin of Rubber Industries)",
      `TITLE:Sales Specialist - ${currentCard.groupTitleEn}`,
      `TEL;TYPE=CELL,VOICE,PREF:${cleanPhone}`,
      "TEL;TYPE=WORK,VOICE:+201090113113",
      "EMAIL;TYPE=WORK:Sylvia@marso-egy.com",
      "EMAIL;TYPE=WORK:Samuel@marso-egy.com",
      "ADR;TYPE=WORK:;;Plot 3/34 Neweiba Street, Third Industrial Zone - A1;10th of Ramadan City;;;Egypt",
      "URL:https://marso-egy.com",
      `NOTE:MARSO Rubber Specialist direct contact. ${productNote}. Categories: ${categoriesStr}`,
      "END:VCARD"
    ];

    const vcardContent = vcardLines.join("\r\n");
    const filename = `MARSO_Sales_${currentCard.name.replace(/\s+/g, "_")}.vcf`;

    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

      if (isIOS) {
        // iOS Safari Data URI triggers native Address Book 'Add to Contacts' sheet directly
        const dataUri = `data:text/vcard;charset=utf-8,${encodeURIComponent(vcardContent)}`;
        const link = document.createElement("a");
        link.href = dataUri;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Standard Blob for Android and Mobile Web Address Book import
        const blob = new Blob([vcardContent], { type: "text/vcard;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 3000);
      }

      setVcardSaved(true);
      setTimeout(() => setVcardSaved(false), 3500);
    } catch (err) {
      console.error("Failed to trigger phone address book contact creation:", err);
    }
  };

  const buildWhatsappUrl = () => {
    const phone = currentCard.rawPhone;
    let msg = "";
    if (isAr) {
      msg = `مرحباً فريق مبيعات مارسو (${currentCard.name})، نود طلب عرض سعر ورسم فني للمنتجات المطاطية الخاصة بقسم (${isAr ? currentCard.groupTitleAr : currentCard.groupTitleEn})`;
      if (localizedProductName) {
        msg += `\nالمنتج المطلوب: ${localizedProductName}`;
        if (product?.specs?.code) msg += ` (كود: ${product.specs.code})`;
      }
    } else {
      msg = `Hello MARSO Sales Team (${currentCard.name}), I would like to request a formal price quote and specs for product category (${currentCard.groupTitleEn})`;
      if (localizedProductName) {
        msg += `\nProduct: ${localizedProductName}`;
        if (product?.specs?.code) msg += ` (Code: ${product.specs.code})`;
      }
    }
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
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
          className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 text-slate-800 my-auto"
        >
          {/* Header Banner - Light Theme with Brand Accents */}
          <div className="relative bg-gradient-to-r from-red-50 via-white to-slate-50 border-b border-slate-200 text-slate-900 p-4 sm:p-5">
            <button
              onClick={onClose}
              className="absolute top-3.5 right-3.5 rtl:right-auto rtl:left-3.5 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>


            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 mb-1">
              {isAr ? "بطاقة تواصل عرض السعر" : "Request Quote - Contact Card"}
            </h2>

            {/* Inquired product highlight if present */}
            {product && (
              <div className="mt-2 flex items-center justify-between text-xs">
                <div className="truncate pr-2 rtl:pr-0 rtl:pl-2">
                  <span className="text-[9px] uppercase text-slate-400 block font-bold">
                    {isAr ? "المنتج المحدد في الطلب:" : "Inquired Product:"}
                  </span>
                  <span className="font-bold text-slate-900 truncate block text-xs">
                    {localizedProductName}
                  </span>
                </div>
                {localizedCategory && (
                  <span className="shrink-0 px-2 py-0.5 rounded bg-red-50 text-red-700 text-[10px] font-bold border border-red-200">
                    {localizedCategory}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Main Content Area - Downsized Compact Layout */}
          <div className="p-3.5 sm:p-4 space-y-2.5 bg-slate-50/60">
            {/* Contact Card Visual Widget - Compact Light Theme */}
            <div className="rounded-xl bg-white p-3 text-slate-900 shadow-xs border border-red-200">
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center font-bold text-white shadow-2xs border border-red-400 text-xs shrink-0">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-extrabold text-slate-900 tracking-tight truncate">
                        {currentCard.name}
                      </h3>
                      <span className="bg-red-50 text-red-700 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full border border-red-200 shrink-0">
                        {isAr ? "فريق المبيعات" : "Sales Team"}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium truncate">
                      {isAr ? "مبيعات مارسو المباشرة" : "Category Direct Contact"}
                    </p>
                  </div>
                </div>

                {/* Compact Display Phone Number */}
                <a
                  href={`tel:${currentCard.phone.replace(/[^+\d]/g, "")}`}
                  className="bg-red-50/80 hover:bg-red-100/80 px-3 py-1.5 rounded-lg border border-red-200/80 text-center shrink-0 transition-all cursor-pointer group"
                  title={isAr ? "انقر للاتصال المباشر" : "Click to Call Directly"}
                >
                  <span className="text-[9px] text-slate-400 group-hover:text-red-600 uppercase font-bold block leading-tight">
                    {isAr ? "رقم المبيعات المباشر" : "Direct Sales Line"}
                  </span>
                  <div className="text-sm sm:text-base font-mono font-extrabold text-[#B91C1C] tracking-wide dir-ltr flex items-center justify-center gap-1">
                    <PhoneCall className="w-3 h-3 text-emerald-600 inline-block" />
                    <span>{currentCard.phone}</span>
                  </div>
                </a>
              </div>


            </div>

            {/* Platform UX Action Buttons Section - Compact */}
            <div className="space-y-2">
              {/* DESKTOP HIGHLIGHT: Copy All Card Info Button (Desktop Only) */}
              <div className="hidden md:block p-2.5 rounded-lg bg-white border border-emerald-200/80 shadow-2xs">
                {copiedAll && (
                  <div className="text-[10px] font-bold text-emerald-600 flex items-center justify-end gap-1 animate-pulse mb-1.5">
                    <Check className="w-3 h-3" />
                    {isAr ? "تم نسخ جميع البيانات!" : "Copied All Card Details!"}
                  </div>
                )}
                <button
                  onClick={handleCopyAll}
                  className="cursor-pointer w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-all shadow-xs active:scale-98 flex items-center justify-center gap-1.5"
                >
                  {copiedAll ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
                      {isAr ? "تم نسخ بيانات البطاقة للكمبيوتر!" : "All Card Info Copied to Clipboard!"}
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      {isAr ? "نسخ جميع بيانات البطاقة (Copy All Card Info)" : "Copy All Card Info"}
                    </>
                  )}
                </button>
              </div>

              {/* PHONE HIGHLIGHT: Save Card Directly to Phone Button (Phone Only) */}
              <div className="md:hidden p-2.5 rounded-lg bg-white border border-emerald-200/80 shadow-2xs">
                {vcardSaved && (
                  <div className="text-[10px] font-bold text-emerald-600 flex items-center justify-end gap-1 animate-pulse mb-1.5">
                    <Check className="w-3 h-3" />
                    {isAr ? "تم تجهيز ملف جهة الاتصال!" : "Contact File Ready!"}
                  </div>
                )}
                <button
                  onClick={handleSaveToPhone}
                  className="cursor-pointer w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-all shadow-xs active:scale-98 flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  {isAr ? "حفظ كجهة اتصال مباشرة في الهاتف (Save Card to Phone)" : "Save Card Directly to Phone"}
                </button>
              </div>

              {/* Secondary Instant Action Bar: Call, WhatsApp, Copy Phone */}
              <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                {/* Direct Call */}
                <a
                  href={`tel:${currentCard.phone.replace(/[^+\d]/g, "")}`}
                  className="cursor-pointer py-2 px-2.5 bg-white hover:bg-slate-100 text-slate-800 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 border border-slate-200 shadow-2xs active:scale-98"
                >
                  <PhoneCall className="w-3 h-3 text-emerald-600" />
                  {isAr ? "اتصال" : "Call Now"}
                </a>

                {/* WhatsApp */}
                <a
                  href={buildWhatsappUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cursor-pointer py-2 px-2.5 bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-800 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 border border-emerald-200 shadow-2xs"
                >
                  <MessageSquare className="w-3 h-3 text-emerald-600" />
                  {isAr ? "واتساب" : "WhatsApp"}
                </a>

                {/* Copy Number Only */}
                <button
                  onClick={handleCopyPhone}
                  className="cursor-pointer py-2 px-2.5 bg-white hover:bg-slate-100 text-slate-800 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 border border-slate-200 shadow-2xs"
                >
                  {copiedPhone ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      {isAr ? "تم النسخ" : "Copied"}
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-600" />
                      {isAr ? "نسخ الرقم" : "Copy Phone"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>Sylvia@marso-egy.com / Samuel@marso-egy.com</span>
            </div>
            <button
              onClick={onClose}
              className="cursor-pointer font-bold text-slate-700 hover:text-slate-900 transition-colors"
            >
              {isAr ? "إغلاق" : "Close"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
