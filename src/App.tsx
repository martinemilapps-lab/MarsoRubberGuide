import React, { useState, useEffect, useRef } from "react";
// @ts-ignore
import marsoLogo from "./assets/images/the_logo.png";
import { Product, ProductClassification, ChatMessage } from "./types";
import { PRODUCT_CATEGORIES, CATEGORY_DETAILS } from "./constants";
import ProductCard from "./components/ProductCard";
import ProductForm from "./components/ProductForm";
import {
  Language,
  TRANSLATIONS,
  CATEGORY_TRANSLATIONS,
  CHIP_TRANSLATIONS,
  STATIC_PRODUCT_TRANSLATIONS,
  translateTerm
} from "./locales";
import {
  Search,
  Plus,
  Send,
  Download,
  Mail,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Layers,
  Sparkles,
  Phone,
  Clock,
  Shield,
  HelpCircle,
  TrendingUp,
  Award,
  Globe,
  Lock,
  Unlock,
  X,
  Trash2,
  Image as ImageIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [lang, setLang] = useState<Language>("en"); // English as default
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ProductClassification | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"catalog" | "chat">("catalog");

  // CRUD states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Admin Mode detection and authorization key storing
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    const stored = localStorage.getItem("marso_admin_mode");
    if (stored === "true") return true;

    const params = new URLSearchParams(window.location.search);
    const hasAdmin = params.get("admin") === "true";
    const hasAccess = params.get("access")?.toLowerCase() === "marso_admin" || params.get("access")?.toLowerCase() === "admin";
    const hasKey = params.get("key")?.toLowerCase() === "marso_admin_2026" || params.get("key")?.toLowerCase() === "marso";

    const authorized = hasAdmin || hasAccess || hasKey;
    if (authorized) {
      localStorage.setItem("marso_admin_mode", "true");
      return true;
    }
    return false;
  });

  const ADMIN_TOKEN = "marso_admin_token_2026";

  // Chat states initialized with welcome message on language change
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);


  // Notifications
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  const t = TRANSLATIONS[lang];
  const isRtl = lang === "ar";
  const scrollDir = isRtl ? "ltr" : "rtl";
  const contentDir = isRtl ? "rtl" : "ltr";

  useEffect(() => {
    fetchProducts();
  }, []);

  // Sync initial welcome message depending on language
  useEffect(() => {
    setChatMessages([
      {
        id: "init",
        role: "model",
        content: TRANSLATIONS[lang].welcomeMessage,
        timestamp: new Date()
      }
    ]);
  }, [lang]);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isSendingChat]);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  useEffect(() => {
    if (isAdmin) {
      showToast(isRtl ? "تم تفعيل وضع التحكم للمشرف" : "Admin control panel activated");
    }
  }, [isAdmin]);



  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/products");
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
        if (data.length > 0 && !selectedProduct) {
          setSelectedProduct(data[0]);
        }
      } else {
        showToast(t.loadFail, "error");
      }
    } catch (e) {
      showToast(t.networkError, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoSaveProductQuiet = (updated: Product) => {
    setProducts(prevProducts => prevProducts.map(p => p.id === updated.id ? updated : p));
    setSelectedProduct(prevSelected => {
      if (prevSelected && prevSelected.id === updated.id) {
        return updated;
      }
      return prevSelected;
    });
  };

  const handleSaveProduct = async (formData: Partial<Product>) => {
    try {
      if (editingProduct) {
        // Update
        const res = await fetch(`/api/products/${editingProduct.id}`, {
          method: "PUT",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${ADMIN_TOKEN}`
          },
          body: JSON.stringify(formData)
        });
        if (res.ok) {
          const updated = await res.json();
          setProducts(products.map(p => p.id === updated.id ? updated : p));
          setSelectedProduct(updated);
          showToast(t.updateSuccess);
          setIsFormOpen(false);
          setEditingProduct(null);
        } else {
          showToast(isRtl ? "فشل تحديث بيانات ومواصفات المنتج" : "Failed to update product details", "error");
        }
      } else {
        // Create
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${ADMIN_TOKEN}`
          },
          body: JSON.stringify(formData)
        });
        if (res.ok) {
          const created = await res.json();
          setProducts([created, ...products]);
          setSelectedProduct(created);
          showToast(`${t.addSuccess}: "${created.name}"`);
          setIsFormOpen(false);
        } else {
          showToast(t.saveFail, "error");
        }
      }
    } catch (e) {
      showToast(isRtl ? "حدث خطأ أثناء معالجة الطلب." : "Error processing request.", "error");
    }
  };

  const handleDeleteProduct = (id: string) => {
    setProductToDelete(id);
  };

  const executeDeleteProduct = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/products/${productToDelete}`, { 
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${ADMIN_TOKEN}`
        }
      });
      if (res.ok) {
        await res.json();
        setProducts(prevProducts => {
          const updated = prevProducts.filter(p => String(p.id) !== String(productToDelete));
          setSelectedProduct(prevSelected => {
            if (prevSelected && String(prevSelected.id) === String(productToDelete)) {
              return updated.length > 0 ? updated[0] : null;
            }
            return prevSelected;
          });
          return updated;
        });
        showToast(t.deleteSuccess);
        setProductToDelete(null);
      } else {
        showToast(isRtl ? "خطأ أثناء إزالة المنتج من الكتالوج" : "Error deleting item from catalog database", "error");
      }
    } catch (e) {
      showToast(isRtl ? "فشل الاتصال بالإنترنت لإتمام الحذف" : "Network failure trying to process delete request.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSendChatMessage = async (customText?: string) => {
    const textToSend = customText || chatInput;
    if (!textToSend.trim()) return;



    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: "user",
      content: textToSend,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMsg]);
    if (!customText) setChatInput("");
    setIsSendingChat(true);

    try {
      const history = chatMessages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend, history })
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [
          ...prev,
          {
            id: String(Date.now() + 1),
            role: "model",
            content: data.reply,
            timestamp: new Date()
          }
        ]);
      } else {
        setChatMessages(prev => [
          ...prev,
          {
            id: String(Date.now() + 1),
            role: "model",
            content: t.systemInterrupted,
            timestamp: new Date()
          }
        ]);
      }
    } catch (e) {
      setChatMessages(prev => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: "model",
          content: isRtl
            ? "❌ **خطأ في الاتصال بالشبكة**: لا يمكن إرسال الرسالة حالياً. تحقق من اتصالك بالإنترنت وعاود المحاولة."
            : "❌ **Network Error**: Unable to dispatch message. Check your connection or contact MARSO technical team directly.",
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsSendingChat(false);
    }
  };

  // Automated localized mechanical drawings specs downloading
  const handleDownloadSpec = (prod: Product) => {
    if (prod.datasheetFile) {
      const link = document.createElement("a");
      link.href = `/api/products/${prod.id}/datasheet`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const isAr = lang === "ar";
    const localized = isAr
      ? {
          name: prod.nameAr || (STATIC_PRODUCT_TRANSLATIONS[prod.name] ? STATIC_PRODUCT_TRANSLATIONS[prod.name].nameAr : prod.name),
          specs: `Code: ${prod.specs.code || "N/A"} | Material: ${prod.specs.material || "N/A"}`,
          additional: prod.specs.features || ""
        }
      : {
          name: prod.name,
          specs: `Code: ${prod.specs.code || "N/A"} | Material: ${prod.specs.material || "N/A"}`,
          additional: prod.specs.features || ""
        };

    const textContent = isAr ? `=====================================================
بيانات المواصفات الفنية لشركة مارسو للمطاط وعزل الأرضيات
موقع المصنع: المنطقة الصناعية الثالثة، العاشر من رمضان، مصر
=====================================================

اسم المنتج الفني: ${localized.name}
التصنيف الفني: ${CATEGORY_TRANSLATIONS[prod.category]?.ar || prod.category}
حالة مطابقة شهادات الجودة: معتمد كلياً وفقاً للمواصفة القياسية أيزو 9001، 14001، 45001

------------------ الخصائص الفنية والإنتاجية ----------
الكود:                  ${prod.specs.code || "N/A"}
المقاس - الابعاد:       ${prod.specs.sizeDims || "N/A"}
الوزن:                  ${prod.specs.weight || "N/A"}
المميزات:               ${prod.specs.features || "N/A"}
الخواص الفيزيائية:      ${prod.specs.physicalSpecs || "N/A"}
المادة:                 ${prod.specs.material || "N/A"}
اللون:                  ${prod.specs.color || "N/A"}
الاستخدام:              ${prod.specs.application || "N/A"}

------------------ بيانات التواصل الفني والهندسي --------
لطلب الرسومات الكيميائية، أو ملفات منحنيات الفلكنة أو الأسعار:
هاتف: 01090113113 / 01001445060 / 01200161781
بريد إلكتروني: Sylvia@marso-egy.com / Samuel@marso-egy.com
الموقع: قطعة 3/34 شارع نويبع، المنطقة الصناعية الثالثة، مصر

* يرجى التحقق من الملائمة التامة للتطبيقات الحيوية مع مهندسينا.
=====================================================` : `=====================================================
MARSO COMPANY - HIGH-QUALITY RUBBER INDUSTRIES
Technical Data Sheet & Engineering Specification
Target Origin: 10th of Ramadan City, Egypt
=====================================================

Product Name: ${prod.name}
Category: ${prod.category}
ISO Standard Compliance Status: ISO 9001, ISO 14001, ISO 45001

------------------ TECHNICAL PROFILE ----------------
Code:                 ${prod.specs.code || "N/A"}
Size-Dims.:           ${prod.specs.sizeDims || "N/A"}
Weight:               ${prod.specs.weight || "N/A"}
Features:             ${prod.specs.features || "N/A"}
Physical Specs.:      ${prod.specs.physicalSpecs || "N/A"}
Material:             ${prod.specs.material || "N/A"}
Color:                ${prod.specs.color || "N/A"}
Application:          ${prod.specs.application || "N/A"}

------------------ CONTACT SPECIFICATION ------------
For official chemical drawings, vulcanization curve sheets, or quotes:
Phone: 01090113113 / 01001445060 / 01200161781
Emails: Sylvia@marso-egy.com / Samuel@marso-egy.com
Location: Plot 3/34 Neweiba Street, Third Industrial Zone, Egypt

* Verify exact technical specs for mission-critical applications.
=====================================================`;

    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = isAr ? `مواصفات_مارسو_${localized.name.replace(/\s+/g, "_")}.txt` : `MARSO_Spec_${prod.name.replace(/\s+/g, "_")}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(isAr ? `تم تحميل ملف المواصفات لـ ${localized.name}` : `Technical spec sheet downloaded for ${prod.name}`);
  };

  const handleRequestQuote = (prod: Product) => {
    const isAr = lang === "ar";
    const localizedName = isAr ? (prod.nameAr || (STATIC_PRODUCT_TRANSLATIONS[prod.name] ? STATIC_PRODUCT_TRANSLATIONS[prod.name].nameAr : prod.name)) : prod.name;
    const localizedCat = CATEGORY_TRANSLATIONS[prod.category]?.[lang] || prod.category;

    const subject = encodeURIComponent(isAr ? `هام: طلب عرض سعر - ${localizedName}` : `URGENT: Request for Quote - ${prod.name}`);
    const body = encodeURIComponent(isAr ? `السادة شركة مارسو للمطاط وعزل الأرضيات المحترمين،

نود من سيادتكم طلب رسم فني وعرض أسعار رسمي ومواعيد تسليم للمنتج التالي:
- اسم المنتج: ${localizedName}
- تصنيف المنتج: ${localizedCat}
- كود المنتج: ${prod.specs.code || "N/A"}
- مادة الصنع: ${prod.specs.material || "N/A"}

برجاء تزويدنا بالتفاصيل من قبل مهندسي المبيعات والدعم الفني لديكم. شاكرين حسن مجهوداتكم.

وتقبلوا فائق الاحترام والتقدير،
[الاسم / الشركة]` : `Dear MARSO RUBBER Team,

We are interested in requesting a technical drawing and official price quotation for the following product:
- Product Name: ${prod.name}
- Classification: ${prod.category}
- Product Code: ${prod.specs.code || "N/A"}
- Material: ${prod.specs.material || "N/A"}

Please direct this inquiry to your sales and engineering specialists. We look forward to your competitive pricing and delivery logistics.

Best regards,
[Name / Company]`);
    window.open(`mailto:Sylvia@marso-egy.com?cc=Samuel@marso-egy.com&subject=${subject}&body=${body}`);
  };

  // Searching & Filtering products in Arabic/English
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
    const catAr = CATEGORY_TRANSLATIONS[p.category]?.ar || "";
    const catEn = CATEGORY_TRANSLATIONS[p.category]?.en || "";
    
    // Check local translation fields as well
    const staticTrans = STATIC_PRODUCT_TRANSLATIONS[p.name];
    const nameAr = p.nameAr || (staticTrans ? staticTrans.nameAr : "");
    const nameEn = p.name;
    
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      nameEn.toLowerCase().includes(query) ||
      nameAr.toLowerCase().includes(query) ||
      catAr.toLowerCase().includes(query) ||
      catEn.toLowerCase().includes(query) ||
      Object.values(p.specs || {}).some(val => val && String(val).toLowerCase().includes(query)) ||
      (staticTrans && staticTrans.additionalAr.toLowerCase().includes(query));

    return matchesCategory && matchesSearch;
  });

  const getCategoryCount = (category: ProductClassification | "All") => {
    if (category === "All") return products.length;
    return products.filter(p => p.category === category).length;
  };

  // Localized displayed titles
  const displayedTitle = selectedCategory === "All"
    ? t.ourProducts
    : (CATEGORY_TRANSLATIONS[selectedCategory]?.[lang] || selectedCategory);

  const activeSelectedProductLocalizedInfo = selectedProduct ? (
    lang === "ar"
      ? {
          name: selectedProduct.nameAr || (STATIC_PRODUCT_TRANSLATIONS[selectedProduct.name] ? STATIC_PRODUCT_TRANSLATIONS[selectedProduct.name].nameAr : selectedProduct.name),
          additional: STATIC_PRODUCT_TRANSLATIONS[selectedProduct.name] ? STATIC_PRODUCT_TRANSLATIONS[selectedProduct.name].additionalAr : (selectedProduct.specs.additional || "")
        }
      : {
          name: selectedProduct.name,
          additional: selectedProduct.specs.additional || ""
        }
  ) : null;

  return (
    <div className="h-screen h-[100dvh] w-full max-w-full bg-[#F3F4F6] text-gray-800 flex flex-col overflow-hidden font-sans" dir={t.dir}>
      {/* Toast Notifier */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-5 ${isRtl ? "right-5" : "left-5"} z-50 flex items-center gap-2.5 px-4.5 py-3 rounded-lg shadow-xl border bg-white border-red-100 text-sm font-semibold`}
          >
            <CheckCircle2 className="w-5 h-5 text-red-600 shrink-0" />
            <span className="text-gray-900">{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER: Geometric Balance Minimal Styling */}
      <header className="h-[64px] bg-white border-b-2 border-gray-200 flex items-center justify-between px-3 sm:px-6 shrink-0 shadow-sm z-10" dir={t.dir}>
        
        {/* Left/Start Column: Logo & Specialist Tag */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 w-auto md:w-[240px] lg:w-[320px]">
          <div id="marso-logo-container" className="logo flex items-center justify-center select-none shrink-0">
            <img 
              src={marsoLogo} 
              alt="MARSO" 
              className="h-11 sm:h-14 w-auto object-contain" 
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="hidden md:flex items-center gap-2 bg-red-50 border border-red-100 px-2.5 py-1 rounded-md shrink-0 select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
            <span className="text-[10px] font-black text-red-700 tracking-wide uppercase font-mono whitespace-nowrap">{t.specialistCenter}</span>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] font-bold shadow-2xs shrink-0 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
              <span className="uppercase font-mono tracking-wide whitespace-nowrap">{isRtl ? "مسؤول" : "ADMIN"}</span>
              <button
                onClick={() => {
                  localStorage.removeItem("marso_admin_mode");
                  setIsAdmin(false);
                  showToast(isRtl ? "تم تسجيل الخروج من وضع المسؤول" : "Exited admin control mode");
                }}
                className="ml-1 sm:ml-1.5 px-1 bg-amber-100 hover:bg-red-50 hover:text-red-600 rounded-sm text-amber-700 transition-colors uppercase font-mono text-[9px] cursor-pointer"
                title={isRtl ? "خروج" : "Exit"}
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Center Column: Main Navigation Tabs (Perfect Centering) - Hidden on Mobile */}
        <div className="hidden md:flex flex-grow items-center justify-center gap-3 sm:gap-6 md:gap-8 text-[11px] sm:text-xs md:text-sm font-bold text-gray-500 whitespace-nowrap h-full">
          <button
            onClick={() => {
              setActiveTab("catalog");
              setSelectedCategory("All");
            }}
            className={`cursor-pointer h-full flex items-center justify-center tracking-normal sm:tracking-wider hover:text-red-600 transition-colors uppercase whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === "catalog" && selectedCategory === "All" ? "text-red-600 border-red-600 font-extrabold" : "border-transparent text-gray-500"
            }`}
          >
            <span className="leading-none">{t.specCatalog}</span>
          </button>
          
          <button
            onClick={() => setActiveTab("chat")}
            className={`cursor-pointer h-full flex items-center justify-center tracking-normal sm:tracking-wider hover:text-red-600 transition-colors uppercase whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === "chat" ? "text-red-600 border-red-600 font-extrabold" : "border-transparent text-gray-500"
            }`}
          >
            <span className="leading-none">{t.aiConsultant}</span>
          </button>
        </div>

        {/* Right/End Column: Language Switcher and ISO specifications */}
        <div className="flex items-center justify-end gap-2.5 sm:gap-4 shrink-0 w-auto md:w-[240px] lg:w-[320px] h-full">
          <div className="hidden lg:flex items-center h-full text-gray-400 border-l border-r border-gray-200 px-4 shrink-0 select-none">
            <span className="text-[11px] font-medium font-mono text-gray-400 whitespace-nowrap">{t.isoStandards}</span>
          </div>

          <div className="flex items-center h-full shrink-0">
            <button
              id="lang-switcher-btn"
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              className="cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 bg-black hover:bg-neutral-900 text-white font-extrabold text-[9px] sm:text-[11px] md:text-xs tracking-wide uppercase px-2 py-1.5 sm:px-3.5 sm:py-2 rounded-full shadow-sm transition-all active:scale-95 shrink-0 whitespace-nowrap"
            >
              <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="whitespace-nowrap leading-none">{lang === "ar" ? "English" : "العربية"}</span>
            </button>
          </div>
        </div>

      </header>

      {/* TWO-COLUMN WORKSPACE: Grid Layout */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[250px_1fr] lg:grid-cols-[260px_1fr] items-stretch">
        
        {/* COLUMN 1: LEFT CLASSIFICATIONS SIDEBAR */}
        <aside dir={scrollDir} className="bg-white border-l border-r border-gray-300 p-5 overflow-y-auto hidden md:flex shrink-0">
          <div dir={contentDir} className="w-full min-h-full flex flex-col justify-between">
            <div>
              <h2 className="text-[11px] uppercase tracking-widest text-gray-400 font-extrabold mb-4 flex items-center justify-between">
              <span>{t.categories}</span>
              <span className="bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full font-sans text-[10px]">
                {products.length}
              </span>
            </h2>

            <div className="space-y-1">
              <button
                id="category-filter-all"
                onClick={() => {
                  setSelectedCategory("All");
                  setActiveTab("catalog");
                }}
                className={`w-full text-right px-3 py-2 text-[13px] rounded-md transition-all flex items-center justify-between cursor-pointer ${
                  selectedCategory === "All" && activeTab === "catalog"
                    ? "bg-red-50 text-[#B91C1C] font-semibold border-r-4 border-red-600 pr-2"
                    : "text-gray-600 hover:bg-gray-50 active:bg-gray-100"
                }`}
              >
                <span className="truncate">{t.allClassifications}</span>
                <span className="text-[11px] text-gray-400 font-semibold">{getCategoryCount("All")}</span>
              </button>

              {PRODUCT_CATEGORIES.map((cat, idx) => {
                const count = getCategoryCount(cat);
                const isActive = selectedCategory === cat && activeTab === "catalog";
                const translatedCatMenu = CATEGORY_TRANSLATIONS[cat]?.[lang] || cat;
                return (
                  <button
                    id={`category-filter-${idx}`}
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setActiveTab("catalog");
                    }}
                    className={`w-full text-right px-3 py-2 text-[13px] rounded-md transition-all flex items-center justify-between cursor-pointer ${
                      isActive
                        ? "bg-red-50 text-[#B91C1C] font-semibold border-r-4 border-red-600 pr-2"
                        : "text-gray-600 hover:bg-gray-50 active:bg-red-50/50"
                    }`}
                  >
                    <span className="truncate" title={translatedCatMenu}>
                      {idx + 1}. {translatedCatMenu}
                    </span>
                    <span className={`text-[11px] font-semibold ${isActive ? "text-red-600" : "text-gray-400"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 border-t border-gray-100 pt-6">
              <button
                id="ask-specialist-sidebar"
                onClick={() => setActiveTab("chat")}
                className={`w-full py-2.5 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                  activeTab === "chat"
                    ? "bg-red-600 text-white border-transparent shadow-md"
                    : "bg-white text-gray-700 hover:bg-gray-50 border-gray-200"
                }`}
              >
                <Sparkles className={`w-4 h-4 ${activeTab === "chat" ? "text-white" : "text-red-500"}`} />
                {t.askSpecialist}
              </button>
            </div>
          </div>

          {/* Corporate Footer Reach Details */}
          <div className="border-t border-gray-100 pt-5 mt-6 text-xs text-gray-400">
            <p className="font-bold text-gray-700 font-sans uppercase tracking-tight text-[11px] mb-1">{t.corporateDetails}</p>
            <p className="leading-relaxed leading-5">
              {isRtl ? (
                <>
                  جمهورية مصر العربية ،مدينة العاشر من رمضان<br />
                  المنطقة الصناعية الثالثة - A1<br />
                  قطعة رقم 3/34 شارع نويبع
                </>
              ) : (
                <>
                  Plot 3/34 Neweiba Street,<br />
                  Third Industrial Zone - A1,<br />
                  10th of Ramadan City, Egypt
                </>
              )}
            </p>
            <div className="mt-3 flex flex-col gap-1.5" dir="ltr">
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3 text-red-500 shrink-0" />
                <span className="font-mono text-[11px]">01090113113</span>
              </span>
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3 text-red-500 shrink-0" />
                <span className="text-[11px] truncate" title="Sylvia@marso-egy.com">Sylvia@marso-egy.com</span>
              </span>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400 font-medium">
              <span>{t.originOfRubber}</span>
              <span className="text-red-600 font-bold">MARS™</span>
            </div>
          </div>
          </div>
        </aside>

        {/* COLUMN 2: MIDDLE CONSOLE (Dual view: Catalog or Chat) */}
        <main className="bg-[#FAFBFD] p-4 lg:p-6 flex flex-col min-h-0 min-w-0 border-r border-l border-gray-200">
          
          {/* MOBILE TABS & HEADER FILTER (Shown on phone/tablets) */}
          <div className="flex md:hidden items-center justify-between bg-white border border-gray-200 rounded-lg p-2.5 mb-4 shrink-0">
            <div className="flex gap-1.5 w-full">
              <button
                onClick={() => setActiveTab("catalog")}
                className={`flex-1 py-2 text-center text-xs font-bold rounded-md ${
                  activeTab === "catalog" ? "bg-red-600 text-white" : "bg-gray-50 text-gray-600"
                }`}
              >
                {t.specCatalog} ({products.length})
              </button>
              <button
                onClick={() => setActiveTab("chat")}
                className={`flex-1 py-1.5 text-center text-xs font-bold rounded-md flex items-center justify-center gap-1 ${
                  activeTab === "chat" ? "bg-red-600 text-white" : "bg-gray-50 text-gray-600"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {t.aiConsultant}
              </button>
            </div>
          </div>

          {/* INNER VIEW 1: CATALOG DATABASE */}
          {activeTab === "catalog" ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* MOBILE CLASSIFICATIONS HORIZONTAL SWIPER */}
              <div className="md:hidden shrink-0 mb-4 bg-white border border-gray-100 rounded-xl p-3.5 shadow-2xs">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#B91C1C] block mb-2 px-1 text-right lg:text-left">
                  {t.filterClassifications}
                </span>
                <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none snap-x -mx-1 px-1">
                  <button
                    id="mobile-cat-filter-all"
                    onClick={() => setSelectedCategory("All")}
                    className={`snap-start shrink-0 px-3.5 py-2 text-xs font-bold rounded-full transition-all border ${
                      selectedCategory === "All"
                        ? "bg-[#B91C1C] text-white border-transparent shadow-sm"
                        : "bg-[#F3F4F6] text-gray-700 border-gray-100 hover:bg-gray-200"
                    }`}
                  >
                    {t.allClasses} ({getCategoryCount("All")})
                  </button>
                  {PRODUCT_CATEGORIES.map((cat, idx) => {
                    const count = getCategoryCount(cat);
                    const isActive = selectedCategory === cat;
                    const translatedCatMobile = CATEGORY_TRANSLATIONS[cat]?.[lang] || cat;
                    return (
                      <button
                        id={`mobile-cat-filter-${idx}`}
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`snap-start shrink-0 px-3.5 py-2 text-[11px] sm:text-xs font-semibold rounded-full transition-all border ${
                          isActive
                            ? "bg-[#B91C1C] text-white border-transparent shadow-sm font-bold scale-98"
                            : "bg-[#F3F4F6] text-gray-700 border-gray-200 hover:bg-gray-200"
                        }`}
                      >
                        {idx + 1}. {translatedCatMobile} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 shrink-0">
                <div>
                  <h1 className="text-xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                    {displayedTitle}
                  </h1>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-64 max-w-sm">
                    <input
                      id="search-input"
                      type="text"
                      placeholder={t.searchPlaceholder}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full bg-white text-xs border border-gray-200 ${isRtl ? "pr-8.5 pl-3 text-right" : "pl-8.5 pr-3 text-left"} py-2 rounded-lg focus:outline-hidden focus:border-red-500 transition-all shadow-2xs font-sans`}
                    />
                    <Search className={`w-4 h-4 text-gray-400 absolute ${isRtl ? "right-2.5" : "left-2.5"} top-2.5`} />
                  </div>

                  {isAdmin && (
                    <button
                      id="add-product-btn"
                      onClick={() => {
                        setEditingProduct(null);
                        setIsFormOpen(true);
                      }}
                      className="cursor-pointer bg-red-600 hover:bg-opacity-95 text-white py-2 px-3 lg:px-4 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-97 transition-all shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{t.registerSpec}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* CRUD Form overlay */}
              <AnimatePresence>
                {isFormOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-40"
                  >
                    <motion.div
                      dir={scrollDir}
                      initial={{ scale: 0.95, y: 15 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.95, y: 15 }}
                      className="bg-white w-full max-w-2xl rounded-xl p-4 sm:p-6 shadow-2xl overflow-y-auto max-h-[96vh] sm:max-h-[90vh] border border-gray-100"
                    >
                      <div dir={contentDir} className="w-full">
                        <ProductForm
                          product={editingProduct}
                          lang={lang}
                          onSave={handleSaveProduct}
                          onCancel={() => {
                            setIsFormOpen(false);
                            setEditingProduct(null);
                          }}
                          onAutoSaveQuiet={handleAutoSaveProductQuiet}
                        />
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Product Deletion Confirmation Overlay */}
              <AnimatePresence>
                {productToDelete && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
                  >
                    <motion.div
                      dir={scrollDir}
                      initial={{ scale: 0.95, y: 15 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.95, y: 15 }}
                      className="bg-white w-full max-w-md rounded-xl p-6 shadow-2xl border border-gray-100 relative overflow-hidden text-right"
                    >
                      <div className="absolute top-0 right-0 left-0 h-1.5 bg-red-600" />
                      
                      <div className="flex flex-col items-center text-center mt-2">
                        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
                          <Trash2 className="w-6 h-6 text-red-600" />
                        </div>
                        
                        <h3 className="text-base font-extrabold text-gray-900 mb-2">
                          {isRtl ? "تأكيد حذف المواصفة الفنية" : "Confirm Technical Specification Deletion"}
                        </h3>
                        
                        <p className="text-xs text-gray-600 leading-relaxed mb-6">
                          {t.confirmDelete}
                        </p>
                        
                        <div className="flex gap-3 w-full" dir={isRtl ? "rtl" : "ltr"}>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={executeDeleteProduct}
                            className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg text-xs font-bold shadow-md active:scale-97 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            {isDeleting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                            <span>{isRtl ? "نعم، احذف نهائياً" : "Yes, Delete permanently"}</span>
                          </button>
                          
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => setProductToDelete(null)}
                            className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold active:scale-97 transition-all cursor-pointer"
                          >
                            <span>{t.cancel}</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Catalog Product Grid */}
              <div dir={scrollDir} className="flex-1 overflow-y-auto min-h-0 pr-1">
                <div dir={contentDir} className="w-full min-h-full flex flex-col">
                  {isLoading ? (
                    <div className="h-64 flex flex-col items-center justify-center text-gray-500">
                      <Loader2 className="w-8 h-8 text-red-600 animate-spin mb-2" />
                      <span className="text-xs font-medium uppercase tracking-wider font-mono">{t.connectingDb}</span>
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="h-64 border border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 bg-white p-6 text-center">
                      <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
                      <p className="text-sm font-bold text-gray-800">{t.noMatchFound}</p>
                      <p className="text-xs text-gray-500 mt-1 max-w-sm">
                        {t.noMatchFoundDesc}
                      </p>
                      <button
                        onClick={() => {
                          setSelectedCategory("All");
                          setSearchQuery("");
                        }}
                        className="mt-4 px-4 py-2 border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 rounded-lg font-bold cursor-pointer"
                      >
                        {t.clearFilters}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4.5 pb-8">
                      {filteredProducts.map((p) => (
                        <ProductCard
                          key={p.id}
                          product={p}
                          lang={lang}
                          isAdmin={isAdmin}
                          onSelect={(prod) => setSelectedProduct(prod)}
                          onEdit={(prod) => {
                            setEditingProduct(prod);
                            setIsFormOpen(true);
                          }}
                          onDelete={handleDeleteProduct}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            // INNER VIEW 2: AI SPECIALIST CONSULTANT CONSOLE (Chat window)
            <div className="flex-1 flex flex-col min-h-0">
              {/* Chat Sub-header */}
              <div className="shrink-0 flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
                <div>
                  <h1 className="text-base font-extrabold text-gray-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-red-600" />
                    {isRtl ? "مستشار مارسو للذكاء الاصطناعي" : "MARSO SPECIALIST AI MODE"}
                  </h1>
                  <p className="text-slate-500 text-xs">
                    {isRtl
                      ? "مدرب ومبرمج مباشرة بمعايير شركة مارسو لتطبيقات المطاط والهندسة العكسية بمصر."
                      : "Trained directly with Marso Company's chemical compound profiles and Egyptian rubber recycling metrics."}
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-[#F1F5F9] px-2.5 py-1 rounded-md text-[10px] font-bold text-gray-600 font-mono">
                  {t.modelLabel}
                </div>
              </div>

              {/* Chat Window */}
              <div dir={scrollDir} className="flex-1 bg-white border border-gray-200 rounded-xl p-4 overflow-y-auto min-h-0 mb-4 shadow-2xs">
                <div dir={contentDir} className="w-full min-h-full flex flex-col gap-4">
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`bubble ${
                        msg.role === "user" ? "user" : "specialist"
                      } max-w-[85%] px-4 py-3 rounded-xl text-sm leading-relaxed`}
                      style={
                        msg.role === "user"
                          ? {
                              backgroundColor: "#B91C1C",
                              color: "#FFFFFF",
                              alignSelf: isRtl ? "flex-start" : "flex-end",
                              borderBottomRightRadius: "2px"
                            }
                          : {
                              backgroundColor: "#F3F4F6",
                              color: "#1F2937",
                              alignSelf: isRtl ? "flex-end" : "flex-start",
                              borderBottomLeftRadius: "2px"
                            }
                      }
                    >
                      {/* Render formatting safely */}
                      <div className="whitespace-pre-wrap text-xs sm:text-sm font-sans">
                        {msg.content.split("\n").map((line, i) => {
                          let contentToRender: React.ReactNode = line;
                          if (line.includes("**")) {
                            const parts = line.split("**");
                            contentToRender = parts.map((part, index) =>
                              index % 2 === 1 ? <strong key={index} className="font-extrabold text-red-700">{part}</strong> : part
                            );
                          }
                          return (
                            <p key={i} className="mb-1">
                              {contentToRender}
                            </p>
                          );
                        })}
                      </div>
                      <span 
                        className={`block text-[9px] mt-1.5 font-mono text-right ${
                          msg.role === "user" ? "text-red-200" : "text-gray-400"
                        }`}
                      >
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}

                  {isSendingChat && (
                    <div className={`bubble specialist max-w-[80%] px-4 py-3 rounded-xl bg-gray-100 text-gray-500 flex items-center gap-2 ${isRtl ? "self-end" : "self-start"}`}>
                      <Loader2 className="w-3.5 h-3.5 text-red-600 animate-spin" />
                      <span className="text-xs font-semibold animate-pulse tracking-wide font-mono">{t.analyzingLibrary}</span>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>
              </div>

              {/* Chat Quick Chips */}
              <div className="shrink-0 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1.5">
                  {t.frequentlyAsked}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {CHIP_TRANSLATIONS.map((chip, idx) => (
                    <button
                      id={`chat-chip-${idx}`}
                      key={idx}
                      onClick={() => handleSendChatMessage(lang === "ar" ? chip.promptAr : chip.promptEn)}
                      className="cursor-pointer px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-gray-700 rounded-full font-medium transition-all text-right"
                    >
                      {chip[lang]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Input Bar */}
              <div className="shrink-0 flex items-center gap-2">
                <input
                  id="chat-input-bar"
                  type="text"
                  placeholder={t.chatInputPlaceholder}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendChatMessage();
                  }}
                  className={`flex-1 bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-hidden focus:border-red-500 shadow-2xs font-sans ${isRtl ? "text-right" : "text-left"}`}
                />
                <button
                  id="chat-send-btn"
                  onClick={() => handleSendChatMessage()}
                  disabled={isSendingChat || !chatInput.trim()}
                  className="cursor-pointer bg-[#B91C1C] hover:bg-red-700 disabled:opacity-40 text-white p-2.5 rounded-lg active:scale-95 transition-all shadow-md shrink-0 flex items-center justify-center font-mono"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </main>

        {/* COLUMN 3: RIGHT SELECTIVE SPECS VIEWPORT */}
        <aside dir={scrollDir} className="bg-white border-l border-r border-gray-300 p-5 overflow-y-auto hidden shrink-0">
          <div dir={contentDir} className="w-full min-h-full flex flex-col justify-between">
            <div>
            <div className="text-[11px] uppercase tracking-widest text-gray-400 font-extrabold mb-5 flex items-center justify-between">
              <span>{t.selectedProductProfile}</span>
              <Award className="w-4 h-4 text-red-600" />
            </div>

            {selectedProduct && activeSelectedProductLocalizedInfo ? (
              <div className="space-y-5">
                {/* Product spec block */}
                <div className="product-card border border-gray-200 rounded-lg overflow-hidden bg-[#FAFBFD]">
                  {selectedProduct.photo ? (
                    <div className="h-32 bg-gray-900 relative">
                      <img
                        src={selectedProduct.photo}
                        alt={activeSelectedProductLocalizedInfo.name}
                        className="w-full h-full object-cover opacity-80"
                        referrerPolicy="no-referrer"
                      />
                      <div className={`absolute top-2.5 ${isRtl ? "right-2.5" : "left-2.5"}`}>
                        <span className="px-2 py-0.5 text-[9px] font-bold bg-white/90 text-gray-800 rounded border border-gray-200 shadow-2xs">
                          {CATEGORY_TRANSLATIONS[selectedProduct.category]?.[lang] || selectedProduct.category}
                        </span>
                      </div>
                    </div>
                  ) : null}
                  
                  <div className="p-4 bg-white">
                    {!selectedProduct.photo && (
                      <div className="mb-2">
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-700 rounded border border-gray-200 shadow-2xs">
                          {CATEGORY_TRANSLATIONS[selectedProduct.category]?.[lang] || selectedProduct.category}
                        </span>
                      </div>
                    )}
                    <h3 className="font-extrabold text-sm text-gray-900 line-clamp-2 leading-snug">
                      {activeSelectedProductLocalizedInfo.name}
                    </h3>
                    <div className={`mt-1.5 flex items-center gap-1.5 ${isRtl ? "flex-row-reverse" : ""}`}>
                      <div className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100">
                        {t.isoCompliant}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">ID: {selectedProduct.id}</div>
                    </div>

                    {/* Specifications List */}
                    <div className="mt-4 space-y-1">
                      <div className="flex justify-between items-start gap-4 py-1.5 border-b border-gray-100 text-xs">
                        <span className="text-gray-400 font-medium shrink-0 text-start">{isRtl ? "الكود" : "Code"}</span>
                        <span className="text-neutral-800 font-bold text-end break-words whitespace-normal leading-normal">{selectedProduct.specs.code || "N/A"}</span>
                      </div>
                      <div className="flex justify-between items-start gap-4 py-1.5 border-b border-gray-100 text-xs">
                        <span className="text-gray-400 font-medium shrink-0 text-start">{isRtl ? "المقاس - الابعاد" : "Size-Dims."}</span>
                        <span className="text-neutral-800 font-semibold text-end break-words whitespace-normal leading-normal">{translateTerm(selectedProduct.specs.sizeDims || "N/A", lang)}</span>
                      </div>
                      <div className="flex justify-between items-start gap-4 py-1.5 border-b border-gray-100 text-xs">
                        <span className="text-gray-400 font-medium shrink-0 text-start">{isRtl ? "الوزن" : "Weight"}</span>
                        <span className="text-neutral-800 font-semibold text-end break-words whitespace-normal leading-normal">{translateTerm(selectedProduct.specs.weight || "N/A", lang)}</span>
                      </div>
                      <div className="flex justify-between items-start gap-4 py-1.5 border-b border-gray-100 text-xs">
                        <span className="text-gray-400 font-medium shrink-0 text-start">{isRtl ? "المميزات" : "Features"}</span>
                        <span className="text-neutral-800 font-semibold text-end break-words whitespace-normal leading-normal" title={activeSelectedProductLocalizedInfo.additional}>{activeSelectedProductLocalizedInfo.additional || "N/A"}</span>
                      </div>
                      <div className="flex justify-between items-start gap-4 py-1.5 border-b border-gray-100 text-xs">
                        <span className="text-gray-400 font-medium shrink-0 text-start">{isRtl ? "الخواص الفيزيائية" : "Physical Specs."}</span>
                        <span className="text-neutral-800 font-semibold text-end break-words whitespace-normal leading-normal" title={lang === "ar" && STATIC_PRODUCT_TRANSLATIONS[selectedProduct.name]?.specsAr ? STATIC_PRODUCT_TRANSLATIONS[selectedProduct.name].specsAr : selectedProduct.specs.physicalSpecs}>{lang === "ar" && STATIC_PRODUCT_TRANSLATIONS[selectedProduct.name]?.specsAr ? STATIC_PRODUCT_TRANSLATIONS[selectedProduct.name].specsAr : translateTerm(selectedProduct.specs.physicalSpecs || "N/A", lang)}</span>
                      </div>
                      <div className="flex justify-between items-start gap-4 py-1.5 border-b border-gray-100 text-xs">
                        <span className="text-gray-400 font-medium shrink-0 text-start">{isRtl ? "المادة" : "Material"}</span>
                        <span className="text-neutral-800 font-semibold text-end break-words whitespace-normal leading-normal">{translateTerm(selectedProduct.specs.material || "N/A", lang)}</span>
                      </div>
                      <div className="flex justify-between items-start gap-4 py-1.5 border-b border-gray-100 text-xs">
                        <span className="text-gray-400 font-medium shrink-0 text-start">{isRtl ? "اللون" : "Color"}</span>
                        <span className="text-neutral-800 font-semibold text-end break-words whitespace-normal leading-normal">{translateTerm(selectedProduct.specs.color || "N/A", lang)}</span>
                      </div>
                      <div className="flex justify-between items-start gap-4 py-1.5 border-b border-gray-100 text-xs">
                        <span className="text-gray-400 font-medium shrink-0 text-start">{isRtl ? "الاستخدام" : "Application"}</span>
                        <span className="text-neutral-800 font-semibold text-end break-words whitespace-normal leading-normal" title={selectedProduct.specs.application}>{translateTerm(selectedProduct.specs.application || "N/A", lang)}</span>
                      </div>
                      {selectedProduct.datasheetName && (
                        <div className="flex justify-between items-start gap-4 py-1.5 border-t border-gray-100 text-xs">
                          <span className="text-gray-400 font-medium shrink-0 text-start">{isRtl ? "وثيقة البيانات الفنية" : "Technical Datasheet"}</span>
                          <span className="text-red-600 font-bold flex items-center gap-1 text-end justify-end">
                            <FileText className="w-3.5 h-3.5 shrink-0" />
                            <span className="break-all whitespace-normal" title={selectedProduct.datasheetName}>{isRtl ? "متوفرة (PDF)" : "Available (PDF)"}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Supplementary Photo Gallery if any exist */}
                {selectedProduct.extraPhotos && selectedProduct.extraPhotos.length > 0 && (
                  <div className="space-y-2.5">
                    <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-red-600" />
                      {isRtl ? "معرض الصور الإضافية والمخططات" : "Supplementary Blueprints & Photos Gallery"}
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedProduct.extraPhotos.map((url, i) => (
                        <div key={i} className="h-20 rounded-lg overflow-hidden border border-gray-100 shadow-3xs relative group bg-gray-50">
                          <img 
                            src={url} 
                            alt={`Extra spec photo ${i + 1}`} 
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102" 
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                            <button 
                              onClick={() => window.open(url, "_blank")}
                              className="px-1.5 py-0.5 bg-white text-gray-800 text-[8px] font-bold rounded shadow-xs cursor-pointer"
                            >
                              {isRtl ? "تكبير" : "Zoom"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional Spec Detail */}
                <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-100">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1 mb-1.5">
                    <Shield className="w-3.5 h-3.5 text-[#B91C1C]" />
                    {t.engineeredFeatures}
                  </span>
                  <p className="text-[11px] text-slate-600 leading-relaxed italic">
                    {activeSelectedProductLocalizedInfo.additional || (isRtl ? "اجتاز منحنيات اختبار الفلكنة الكيميائية ومكافحة الانضغاط تحت أقصى درجات الضغط الصناعي." : "Passed certified vulcanization curves ensuring absolute durability under industrial stress.")}
                  </p>
                </div>

                {/* Technical Action buttons */}
                <div className="space-y-2 pt-3">
                  <button
                    id="spec-req-quote-btn"
                    onClick={() => handleRequestQuote(selectedProduct)}
                    className="cursor-pointer w-full py-2.5 bg-[#B91C1C] hover:bg-red-700 text-white border-0 rounded text-xs font-bold transition-all shadow-md active:scale-97 flex items-center justify-center gap-1.5 font-sans"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {t.requestQuote}
                  </button>
                  <button
                    id="spec-download-btn"
                    onClick={() => handleDownloadSpec(selectedProduct)}
                    className="cursor-pointer w-full py-2.5 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 rounded text-xs font-bold transition-all active:scale-97 flex items-center justify-center gap-1.5 font-sans"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {t.downloadDataSheet}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-gray-400 border border-dashed border-gray-100 rounded-lg px-4 bg-gray-50/50">
                <HelpCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs font-semibold">{t.noProductSelected}</p>
                <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                  {t.noProductSelectedDesc}
                </p>
              </div>
            )}
          </div>

          {/* Environmental Statement */}
          <div className="mt-6 p-3.5 border-l-4 border-r-4 border-emerald-500 bg-emerald-50/70 rounded-lg">
            <span className="text-[10px] font-bold text-emerald-800 block uppercase tracking-wider mb-0.5">
              {t.ecoFriendlyHeader}
            </span>
            <p className="text-[10.5px] text-emerald-700 leading-relaxed">
              {t.ecoFriendlyDesc}
            </p>
          </div>
          </div>
        </aside>

      </div>

      {/* PRODUCT SPECIFICATION MODAL (Renders as a bottom sheet on mobile, and a beautiful centered popup on desktop/tablet) */}
      <AnimatePresence>
        {selectedProduct && activeSelectedProductLocalizedInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setSelectedProduct(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[85vh] sm:max-h-[90vh] shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0" dir={isRtl ? "rtl" : "ltr"}>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {t.selectedProductProfile}
                </span>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="p-1 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div dir={scrollDir} className="overflow-y-auto flex-1">
                <div dir={contentDir} className="p-5 space-y-5 w-full min-h-full flex flex-col justify-between">
                {/* Product Photo Block */}
                <div className="product-card border border-gray-200 rounded-lg overflow-hidden bg-[#FAFBFD]">
                  {selectedProduct.photo ? (
                    <div className="h-40 bg-gray-950 relative">
                      <img
                        src={selectedProduct.photo}
                        alt={activeSelectedProductLocalizedInfo.name}
                        className="w-full h-full object-cover opacity-90"
                        referrerPolicy="no-referrer"
                      />
                      <div className={`absolute top-2.5 ${isRtl ? "right-2.5" : "left-2.5"}`}>
                        <span className="px-2 py-0.5 text-[9px] font-bold bg-white/95 text-gray-800 rounded border border-gray-200 shadow-2xs">
                          {CATEGORY_TRANSLATIONS[selectedProduct.category]?.[lang] || selectedProduct.category}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  <div className="p-4 bg-white">
                    {!selectedProduct.photo && (
                      <div className="mb-2">
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-700 rounded border border-gray-200 shadow-2xs">
                          {CATEGORY_TRANSLATIONS[selectedProduct.category]?.[lang] || selectedProduct.category}
                        </span>
                      </div>
                    )}
                    <h3 className="font-extrabold text-sm sm:text-base text-gray-900 leading-snug">
                      {activeSelectedProductLocalizedInfo.name}
                    </h3>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <div className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100">
                        {t.isoCompliant}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">ID: {selectedProduct.id}</div>
                    </div>

                    {/* Specifications List */}
                    <div className="mt-4 space-y-1">
                      <div className="flex justify-between items-start gap-4 py-1.5 border-b border-gray-100 text-xs">
                        <span className="text-gray-400 font-medium shrink-0 text-start">{isRtl ? "الكود" : "Code"}</span>
                        <span className="text-neutral-800 font-bold text-end break-words whitespace-normal leading-normal">{selectedProduct.specs.code || "N/A"}</span>
                      </div>
                      <div className="flex justify-between items-start gap-4 py-1.5 border-b border-gray-100 text-xs">
                        <span className="text-gray-400 font-medium shrink-0 text-start">{isRtl ? "المقاس - الابعاد" : "Size-Dims."}</span>
                        <span className="text-neutral-800 font-semibold text-end break-words whitespace-normal leading-normal">{translateTerm(selectedProduct.specs.sizeDims || "N/A", lang)}</span>
                      </div>
                      <div className="flex justify-between items-start gap-4 py-1.5 border-b border-gray-100 text-xs">
                        <span className="text-gray-400 font-medium shrink-0 text-start">{isRtl ? "الوزن" : "Weight"}</span>
                        <span className="text-neutral-800 font-semibold text-end break-words whitespace-normal leading-normal">{translateTerm(selectedProduct.specs.weight || "N/A", lang)}</span>
                      </div>
                      <div className="flex justify-between items-start gap-4 py-1.5 border-b border-gray-100 text-xs">
                        <span className="text-gray-400 font-medium shrink-0 text-start">{isRtl ? "المميزات" : "Features"}</span>
                        <span className="text-neutral-800 font-semibold text-end break-words whitespace-normal leading-normal" title={activeSelectedProductLocalizedInfo.additional}>{activeSelectedProductLocalizedInfo.additional || "N/A"}</span>
                      </div>
                      <div className="flex justify-between items-start gap-4 py-1.5 border-b border-gray-100 text-xs">
                        <span className="text-gray-400 font-medium shrink-0 text-start">{isRtl ? "الخواص الفيزيائية" : "Physical Specs."}</span>
                        <span className="text-neutral-800 font-semibold text-end break-words whitespace-normal leading-normal" title={lang === "ar" && STATIC_PRODUCT_TRANSLATIONS[selectedProduct.name]?.specsAr ? STATIC_PRODUCT_TRANSLATIONS[selectedProduct.name].specsAr : selectedProduct.specs.physicalSpecs}>{lang === "ar" && STATIC_PRODUCT_TRANSLATIONS[selectedProduct.name]?.specsAr ? STATIC_PRODUCT_TRANSLATIONS[selectedProduct.name].specsAr : translateTerm(selectedProduct.specs.physicalSpecs || "N/A", lang)}</span>
                      </div>
                      <div className="flex justify-between items-start gap-4 py-1.5 border-b border-gray-100 text-xs">
                        <span className="text-gray-400 font-medium shrink-0 text-start">{isRtl ? "المادة" : "Material"}</span>
                        <span className="text-neutral-800 font-semibold text-end break-words whitespace-normal leading-normal">{translateTerm(selectedProduct.specs.material || "N/A", lang)}</span>
                      </div>
                      <div className="flex justify-between items-start gap-4 py-1.5 border-b border-gray-100 text-xs">
                        <span className="text-gray-400 font-medium shrink-0 text-start">{isRtl ? "اللون" : "Color"}</span>
                        <span className="text-neutral-800 font-semibold text-end break-words whitespace-normal leading-normal">{translateTerm(selectedProduct.specs.color || "N/A", lang)}</span>
                      </div>
                      <div className="flex justify-between items-start gap-4 py-1.5 border-b border-gray-100 text-xs">
                        <span className="text-gray-400 font-medium shrink-0 text-start">{isRtl ? "الاستخدام" : "Application"}</span>
                        <span className="text-neutral-800 font-semibold text-end break-words whitespace-normal leading-normal" title={selectedProduct.specs.application}>{translateTerm(selectedProduct.specs.application || "N/A", lang)}</span>
                      </div>
                      {selectedProduct.datasheetName && (
                        <div className="flex justify-between items-start gap-4 py-1.5 border-t border-gray-100 text-xs">
                          <span className="text-gray-400 font-medium shrink-0 text-start">{isRtl ? "وثيقة البيانات الفنية" : "Technical Datasheet"}</span>
                          <span className="text-red-600 font-bold flex items-center gap-1 text-end justify-end">
                            <FileText className="w-3.5 h-3.5 shrink-0" />
                            <span className="break-all whitespace-normal" title={selectedProduct.datasheetName}>{isRtl ? "متوفرة (PDF)" : "Available (PDF)"}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Supplementary Gallery inside Mobile modal */}
                {selectedProduct.extraPhotos && selectedProduct.extraPhotos.length > 0 && (
                  <div className="space-y-2.5">
                    <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-red-600" />
                      {isRtl ? "معرض الصور والمخططات الفنية الإضافية" : "Supplementary Specs & Photos Gallery"}
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedProduct.extraPhotos.map((url, i) => (
                        <div key={i} className="h-20 rounded-lg overflow-hidden border border-gray-100 shadow-3xs relative group bg-gray-50">
                          <img 
                            src={url} 
                            alt={`Extra spec photo ${i + 1}`} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                            <button 
                              onClick={() => window.open(url, "_blank")}
                              className="px-1.5 py-0.5 bg-white text-gray-800 text-[8px] font-bold rounded shadow-xs"
                            >
                              {isRtl ? "تكبير" : "Zoom"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional Spec Detail */}
                <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-100">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1 mb-1.5">
                    <Shield className="w-3.5 h-3.5 text-[#B91C1C]" />
                    {t.engineeredFeatures}
                  </span>
                  <p className="text-[11px] text-slate-600 leading-relaxed italic">
                    {activeSelectedProductLocalizedInfo.additional || (isRtl ? "اجتاز منحنيات اختبار الفلكنة الكيميائية ومكافحة الانضغاط تحت أقصى درجات الضغط الصناعي." : "Passed certified vulcanization curves ensuring absolute durability under industrial stress.")}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="space-y-2 pt-1">
                  <button
                    id="mobile-spec-req-quote-btn"
                    onClick={() => handleRequestQuote(selectedProduct)}
                    className="cursor-pointer w-full py-2.5 bg-[#B91C1C] hover:bg-red-700 text-white border-0 rounded text-xs font-bold transition-all shadow-md active:scale-97 flex items-center justify-center gap-1.5 font-sans"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {t.requestQuote}
                  </button>
                  <button
                    id="mobile-spec-download-btn"
                    onClick={() => handleDownloadSpec(selectedProduct)}
                    className="cursor-pointer w-full py-2.5 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 rounded text-xs font-bold transition-all active:scale-97 flex items-center justify-center gap-1.5 font-sans"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {t.downloadDataSheet}
                  </button>
                </div>

                {/* Environmental Commitment Card */}
                <div className="p-3 border-l-4 border-r-4 border-emerald-500 bg-emerald-50/70 rounded-lg">
                  <span className="text-[10px] font-bold text-emerald-800 block uppercase tracking-wider mb-0.5">
                    {t.ecoFriendlyHeader}
                  </span>
                  <p className="text-[10px] text-emerald-700 leading-relaxed">
                    {t.ecoFriendlyDesc}
                  </p>
                </div>
              </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
