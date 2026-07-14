import React, { useState, useEffect, useRef } from "react";
import { Product, ProductClassification } from "../types";
import { PRODUCT_CATEGORIES } from "../constants";
import { Language, TRANSLATIONS, CATEGORY_TRANSLATIONS } from "../locales";
import { X, Save, AlertCircle, Image as ImageIcon, Upload, Trash2, Link, Check, Plus, FileText, Sparkles, Loader2 } from "lucide-react";

interface ProductFormProps {
  product?: Product | null; // if modifying
  lang: Language;
  onSave: (product: Partial<Product>) => void;
  onCancel: () => void;
  onAutoSaveQuiet?: (product: Product) => void;
}

const PRESET_IMAGES = [
  { label: "Reclaimed Black Granule", labelAr: "المطاط المستصلح المعالج", url: "https://images.unsplash.com/photo-1578844251758-2f71da64c96f?auto=format&fit=crop&q=80&w=400" },
  { label: "Gym Flooring Red/Black Grid", labelAr: "بلاط أرضيات الصالات الرياضية", url: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400" },
  { label: "Stable / Cow Comfort Mat", labelAr: "حصائر وحواجز اسطبلات مواشي", url: "https://images.unsplash.com/photo-1598974357801-cbca100e65d3?auto=format&fit=crop&q=80&w=400" },
  { label: "Industrial Machine & Steel", labelAr: "القواعد الهندسية المستدامة للمحركات", url: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&q=80&w=400" },
  { label: "Auto Engine Valve & Gasket", labelAr: "قطع غيار السيارات والجوانات والمانعات", url: "https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&q=80&w=400" },
  { label: "Deep-Groove Rubber Material", labelAr: "دواسات الأنقش المحززة للسيارات", url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=400" },
  { label: "Heavy Base Constructive Pad", labelAr: "ركائز الكباري وفواصل التمدد للمباني", url: "https://images.unsplash.com/photo-1545628214-118400483aa4?auto=format&fit=crop&q=80&w=400" },
  { label: "Engineering Blueprint Concept", labelAr: "طلب قطعة خاصة بالهندسة العكسية", url: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=400" }
];

export default function ProductForm({
  product,
  lang,
  onSave,
  onCancel,
  onAutoSaveQuiet
}: ProductFormProps) {
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [category, setCategory] = useState<ProductClassification>("Reverse Engineering");
  const [photo, setPhoto] = useState("");
  const [extraPhotos, setExtraPhotos] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [sizeDims, setSizeDims] = useState("");
  const [weight, setWeight] = useState("");
  const [features, setFeatures] = useState("");
  const [physicalSpecs, setPhysicalSpecs] = useState("");
  const [material, setMaterial] = useState("");
  const [color, setColor] = useState("");
  const [application, setApplication] = useState("");
  const [error, setError] = useState("");

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const isInitialMount = useRef(true);
  const prevProductRef = useRef<Product | null | undefined>(product);

  // Datasheet upload states
  const [datasheetFile, setDatasheetFile] = useState("");
  const [datasheetName, setDatasheetName] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [isPdfDragging, setIsPdfDragging] = useState(false);

  const t = TRANSLATIONS[lang];
  const isRtl = lang === "ar";

  // Custom states for photo edit controls
  const [photoError, setPhotoError] = useState("");
  const [activeTab, setActiveTab] = useState<"preset" | "url">("preset");
  const [isDragging, setIsDragging] = useState(false);
  const [brokenUrls, setBrokenUrls] = useState<string[]>([]);

  const visiblePresets = PRESET_IMAGES.filter(img => !brokenUrls.includes(img.url));

  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setPhotoError(isRtl ? "الملف المحدد ليس صورة صالحة" : "Selected file is not a valid image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError(isRtl ? "حجم الصورة كبير جداً (الأقصى 5 ميجابايت)" : "Image file is too large (max 5MB)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setPhoto(event.target.result as string);
        setPhotoError("");
      }
    };
    reader.onerror = () => {
      setPhotoError(isRtl ? "فشل قراءة ملف الصورة" : "Failed to read image file");
    };
    reader.readAsDataURL(file);
  };

  const handleDatasheetUpload = async (file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setExtractError(isRtl ? "تنبيه: يجب أن يكون الملف بصيغة PDF فقط" : "Warning: Only PDF files are supported.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setExtractError(isRtl ? "حجم الملف كبير جداً (الأقصى 15 ميجابايت)" : "File size is too large (max 15MB)");
      return;
    }

    setIsExtracting(true);
    setExtractError("");

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        if (!event.target?.result) throw new Error("Could not read file data");
        const base64 = event.target.result as string;

        // Post to backend
        const res = await fetch("/api/datasheets/upload-and-extract", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer marso_admin_token_2026"
          },
          body: JSON.stringify({
            pdfBase64: base64,
            filename: file.name
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to extract specifications");
        }

        const data = await res.json();
        
        // Auto-fill form fields!
        if (data.specs) {
          if (data.specs.name) setName(data.specs.name);
          if (data.specs.category) setCategory(data.specs.category as ProductClassification);
          if (data.specs.code) setCode(data.specs.code);
          if (data.specs.sizeDims) setSizeDims(data.specs.sizeDims);
          if (data.specs.weight) setWeight(data.specs.weight);
          if (data.specs.features) setFeatures(data.specs.features);
          if (data.specs.physicalSpecs) setPhysicalSpecs(data.specs.physicalSpecs);
          if (data.specs.material) setMaterial(data.specs.material);
          if (data.specs.color) setColor(data.specs.color);
          if (data.specs.application) setApplication(data.specs.application);
        }

        setDatasheetFile(data.datasheetFile);
        setDatasheetName(data.datasheetName);
        
      } catch (err: any) {
        console.error(err);
        setExtractError(isRtl 
          ? "فشل استخراج البيانات بواسطة الذكاء الاصطناعي. تأكد من جودة ملف الـ PDF." 
          : err.message || "Failed to extract specifications via AI."
        );
      } finally {
        setIsExtracting(false);
      }
    };

    reader.onerror = () => {
      setExtractError(isRtl ? "فشل قراءة ملف الـ PDF" : "Failed to read PDF file.");
      setIsExtracting(false);
    };

    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (product) {
      setName(product.name);
      setNameAr(product.nameAr || "");
      setCategory(product.category);
      setPhoto(product.photo);
      setExtraPhotos(product.extraPhotos || []);
      setCode(product.specs?.code || "");
      setSizeDims(product.specs?.sizeDims || "");
      setWeight(product.specs?.weight || "");
      setFeatures(product.specs?.features || "");
      setPhysicalSpecs(product.specs?.physicalSpecs || "");
      setMaterial(product.specs?.material || "");
      setColor(product.specs?.color || "");
      setApplication(product.specs?.application || "");
      setDatasheetFile(product.datasheetFile || "");
      setDatasheetName(product.datasheetName || "");
    } else {
      // Check if there is a draft in localStorage for new products
      const savedDraft = localStorage.getItem("marso_new_product_draft");
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          setName(draft.name || "");
          setNameAr(draft.nameAr || "");
          setCategory(draft.category || "Reclaimed and Crumb Rubber");
          setPhoto(draft.photo || PRESET_IMAGES[0].url);
          setExtraPhotos(draft.extraPhotos || []);
          setCode(draft.specs?.code || "");
          setSizeDims(draft.specs?.sizeDims || "");
          setWeight(draft.specs?.weight || "");
          setFeatures(draft.specs?.features || "");
          setPhysicalSpecs(draft.specs?.physicalSpecs || "");
          setMaterial(draft.specs?.material || "");
          setColor(draft.specs?.color || "");
          setApplication(draft.specs?.application || "");
          setDatasheetFile(draft.datasheetFile || "");
          setDatasheetName(draft.datasheetName || "");
        } catch (e) {
          console.error("Error parsing draft:", e);
        }
      } else {
        // Default initializers for new
        setName("");
        setNameAr("");
        setCategory("Reclaimed and Crumb Rubber");
        setPhoto(PRESET_IMAGES[0].url);
        setExtraPhotos([]);
        setCode("");
        setSizeDims("");
        setWeight("");
        setFeatures("");
        setPhysicalSpecs("");
        setMaterial("");
        setColor("");
        setApplication("");
        setDatasheetFile("");
        setDatasheetName("");
      }
    }

    // Reset initial mount flag on product change to avoid immediate trigger
    isInitialMount.current = true;
    prevProductRef.current = product;
    setSaveStatus("idle");
  }, [product, isRtl]);

  // Handle Debounced Auto-saving
  useEffect(() => {
    // If it is the initial load of product data, skip the auto-save trigger
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!name.trim()) return;

    const updatedData: Partial<Product> = {
      name,
      nameAr,
      category,
      photo,
      extraPhotos,
      specs: {
        code,
        sizeDims,
        weight,
        features,
        physicalSpecs,
        material,
        color,
        application
      },
      datasheetFile: datasheetFile || undefined,
      datasheetName: datasheetName || undefined
    };

    if (product?.id) {
      setSaveStatus("saving");
      const delayDebounceFn = setTimeout(async () => {
        try {
          const res = await fetch(`/api/products/${product.id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer marso_admin_token_2026"
            },
            body: JSON.stringify(updatedData)
          });
          if (res.ok) {
            const updated = await res.json();
            setSaveStatus("saved");
            if (typeof onAutoSaveQuiet === "function") {
              onAutoSaveQuiet(updated);
            }
          } else {
            setSaveStatus("error");
          }
        } catch (err) {
          console.error("Auto-save error:", err);
          setSaveStatus("error");
        }
      }, 1000);

      return () => clearTimeout(delayDebounceFn);
    } else {
      // New product - save draft to localStorage
      setSaveStatus("saving");
      const delayDebounceFn = setTimeout(() => {
        try {
          localStorage.setItem("marso_new_product_draft", JSON.stringify(updatedData));
          setSaveStatus("saved");
        } catch (err) {
          console.error("Draft save error:", err);
          setSaveStatus("error");
        }
      }, 1000);

      return () => clearTimeout(delayDebounceFn);
    }
  }, [
    name,
    nameAr,
    category,
    photo,
    extraPhotos,
    code,
    sizeDims,
    weight,
    features,
    physicalSpecs,
    material,
    color,
    application,
    datasheetFile,
    datasheetName,
    product?.id
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(isRtl ? "اسم المنتج باللغة الإنجليزية مطلوب" : "Product name in English is required");
      return;
    }
    if (!nameAr.trim()) {
      setError(isRtl ? "اسم المنتج باللغة العربية مطلوب" : "Product name in Arabic is required");
      return;
    }

    // Clear draft storage
    localStorage.removeItem("marso_new_product_draft");

    onSave({
      name,
      nameAr,
      category,
      photo,
      extraPhotos,
      specs: {
        code,
        sizeDims,
        weight,
        features,
        physicalSpecs,
        material,
        color,
        application
      },
      datasheetFile: datasheetFile || undefined,
      datasheetName: datasheetName || undefined
    });
  };

  return (
    <form id="product-crud-form" onSubmit={handleSubmit} className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
            {product ? (isRtl ? `${t.editEntryTitle}: ${name}` : `${t.editEntryTitle}: ${product.name}`) : t.registerNewEntryTitle}
          </h2>
          
          {saveStatus !== "idle" && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-extrabold transition-all duration-300">
              {saveStatus === "saving" && (
                <span className="flex items-center gap-1 text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full animate-pulse font-sans">
                  <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                  <span>{isRtl ? "جاري الحفظ تلقائياً..." : "Auto-saving..."}</span>
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-sans animate-fade-in">
                  <Check className="w-3 h-3 stroke-[3]" />
                  <span>{isRtl ? "تم الحفظ تلقائياً" : "Auto-saved!"}</span>
                </span>
              )}
              {saveStatus === "error" && (
                <span className="flex items-center gap-1 text-red-600 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full font-sans">
                  <AlertCircle className="w-3 h-3" />
                  <span>{isRtl ? "فشل الحفظ التلقائي!" : "Auto-save failed!"}</span>
                </span>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2.5 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-4">
        {/* PDF Datasheet Upload & Extraction Section */}
        <div className="border border-red-100 rounded-xl p-4 bg-red-50/20 space-y-3">
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <label className="block text-xs font-black uppercase tracking-wider text-red-700 flex items-center gap-1.5 justify-start">
              <Sparkles className="w-4 h-4 text-red-600 animate-pulse" />
              <span>{isRtl ? "وثيقة المواصفات الفنية وجدول البيانات (PDF)" : "Technical Datasheet & Specification Sheet (PDF)"}</span>
            </label>
            <span className="text-[8px] sm:text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200/50 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono tracking-wider uppercase select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{isRtl ? "محسن DevOps" : "DevOps Parallel Optimized"}</span>
            </span>
          </div>

          {datasheetName ? (
            <div className="flex items-center justify-between p-3 bg-white border border-red-100 rounded-lg shadow-3xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-red-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-800 truncate" dir="ltr">{datasheetName}</p>
                  <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>{isRtl ? "مستخرج ومعبأ بالذكاء الاصطناعي بنجاح" : "Successfully extracted via AI"}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDatasheetFile("");
                  setDatasheetName("");
                }}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                title={isRtl ? "إزالة" : "Remove"}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsPdfDragging(true);
              }}
              onDragLeave={() => setIsPdfDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsPdfDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleDatasheetUpload(file);
              }}
              className={`border-2 border-dashed rounded-lg p-5 flex flex-col items-center justify-center transition-all ${
                isPdfDragging
                  ? "border-red-500 bg-red-50/50"
                  : isExtracting
                    ? "border-red-300 bg-red-50/10"
                    : "border-gray-200 hover:border-red-300 bg-white"
              }`}
            >
              {isExtracting ? (
                <div className="text-center space-y-2.5 py-2">
                  <Loader2 className="w-7 h-7 text-red-600 animate-spin mx-auto" />
                  <p className="text-xs font-extrabold text-red-700 animate-pulse">
                    {isRtl ? "جاري تحليل المواصفات وتعبئة الحقول بواسطة الذكاء الاصطناعي..." : "AI is analyzing and organizing specifications from datasheet..."}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {isRtl ? "يرجى الانتظار، قد يستغرق ذلك بضع ثوانٍ" : "Please wait, this may take a few seconds"}
                  </p>
                </div>
              ) : (
                <div className="text-center flex flex-col items-center select-none">
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mb-2">
                    <Upload className="w-4 h-4 text-red-600" />
                  </div>
                  <p className="text-xs font-bold text-gray-700">
                    {isRtl ? "اسحب وأفلت ملف الـ PDF هنا للتعرف الذكي والتعبئة التلقائية" : "Drag & drop PDF Datasheet here to auto-fill specs"}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1 mb-3">
                    {isRtl ? "صيغة PDF فقط، بحد أقصى 15 ميجابايت" : "PDF format only, up to 15MB"}
                  </p>
                  <label className="cursor-pointer px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs active:scale-95 transition-all">
                    <span>{isRtl ? "تصفح ورفع ملف" : "Browse & Upload PDF"}</span>
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleDatasheetUpload(file);
                      }}
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {extractError && (
            <div className="text-[11px] text-red-700 flex items-center gap-1.5 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
              <span className="font-semibold">{extractError}</span>
            </div>
          )}
        </div>

        {/* Bilingual Product Name Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 text-right lg:text-left">
              {isRtl ? "اسم المنتج باللغة الإنجليزية" : "Product Name (English)"}
            </label>
            <input
              id="input-name-en"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Extra-Tough EPDM Mechanical Gasket"
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all font-sans text-left"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 text-right lg:text-left">
              {isRtl ? "اسم المنتج باللغة العربية" : "Product Name (Arabic)"}
            </label>
            <input
              id="input-name-ar"
              type="text"
              required
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              placeholder="مثال: جوانات EPDM مبركنة ومسلحة"
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all font-sans text-right"
              dir="rtl"
            />
          </div>
        </div>

        {/* Classification Selection */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 text-right lg:text-left">
            {t.selectCategoryLabel}
          </label>
          <select
            id="input-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ProductClassification)}
            className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-hidden focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all"
          >
            {PRODUCT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_TRANSLATIONS[cat]?.[lang] || cat}
              </option>
            ))}
          </select>
        </div>

        {/* Specs sub-fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 text-right lg:text-left">
              {isRtl ? "الكود" : "Code"}
            </label>
            <input
              id="input-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={isRtl ? "مثال: MC-001RM" : "e.g. MC-001RM"}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 text-right lg:text-left">
              {isRtl ? "المقاس - الابعاد" : "Size-Dims."}
            </label>
            <input
              id="input-sizeDims"
              type="text"
              value={sizeDims}
              onChange={(e) => setSizeDims(e.target.value)}
              placeholder={isRtl ? "مثال: 100x200 سم، سمك 10 مم" : "e.g. 100x200 cm, Thickness: 10mm"}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 text-right lg:text-left">
              {isRtl ? "الوزن" : "Weight"}
            </label>
            <input
              id="input-weight"
              type="text"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder={isRtl ? "مثال: 15.5 - 17 كجم" : "e.g. 15.5 - 17 kg"}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 text-right lg:text-left">
              {isRtl ? "المميزات" : "Features"}
            </label>
            <input
              id="input-features"
              type="text"
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              placeholder={isRtl ? "مثال: سطح مانع للانزلاق، مقاومة عالية للتهالك" : "e.g. Non-slip surface, highly elastic"}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 text-right lg:text-left">
              {isRtl ? "الخواص الفيزيائية" : "Physical Specs."}
            </label>
            <input
              id="input-physicalSpecs"
              type="text"
              value={physicalSpecs}
              onChange={(e) => setPhysicalSpecs(e.target.value)}
              placeholder={isRtl ? "مثال: صلابة 53 شور أ، قوة الشد 5 ميجا باسكال" : "e.g. Hardness: 53 Shore A, Tensile: 5 MPa"}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 text-right lg:text-left">
              {isRtl ? "المادة" : "Material"}
            </label>
            <input
              id="input-material"
              type="text"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder={isRtl ? "مثال: مطاط SBR معالج" : "e.g. Reclaimed SBR Rubber Compound"}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 text-right lg:text-left">
              {isRtl ? "اللون" : "Color"}
            </label>
            <input
              id="input-color"
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder={isRtl ? "مثال: أسود" : "e.g. Black"}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 text-right lg:text-left">
              {isRtl ? "الاستخدام" : "Application"}
            </label>
            <input
              id="input-application"
              type="text"
              value={application}
              onChange={(e) => setApplication(e.target.value)}
              placeholder={isRtl ? "مثال: مزارع اسطبلات مواشي" : "e.g. Stable floors, livestock stalls"}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all font-sans"
            />
          </div>
        </div>

        {/* Core photo selection with Advanced Photo Controller */}
        <div className="border border-gray-200 rounded-xl p-4.5 bg-[#FAFBFD] space-y-4 shadow-2xs">
          <label className="block text-xs font-black uppercase tracking-wider text-gray-700 text-right lg:text-left">
            {isRtl ? "متحكم وإعدادات صور المنتجات" : "Product Photo Settings & Controller"} *
          </label>

          {/* Interactive Drag & Drop / Preview Panel */}
          <div 
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) {
                handleFileUpload(file);
              }
            }}
            className={`relative group h-44 rounded-lg overflow-hidden border-2 border-dashed flex flex-col items-center justify-center transition-all ${
              isDragging 
                ? "border-red-500 bg-red-50/40" 
                : photo 
                  ? "border-gray-200 bg-slate-900" 
                  : "border-gray-300 hover:border-red-400 bg-white"
            }`}
          >
            {photo ? (
              <>
                {/* Image element with lazy loading attribute and custom styling */}
                <img 
                  src={photo} 
                  alt="Product illustration" 
                  className="w-full h-full object-cover opacity-90 group-hover:scale-102 transition-transform duration-300"
                  onError={() => {
                    setPhotoError(isRtl ? "تنبيه: تعذر تحميل رابط الصورة هذا" : "Warning: Could not load this image URL");
                  }}
                  referrerPolicy="no-referrer"
                />
                
                {/* Action overlays on hover */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <label className="cursor-pointer px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-900 rounded-lg text-xs font-bold shadow-md flex items-center gap-1.5 active:scale-95 transition-all">
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                    <span>{isRtl ? "استبدال بصورة" : "Replace Photo"}</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setPhoto("");
                      setPhotoError("");
                    }}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-md flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isRtl ? "إزالة الصورة" : "Remove"}</span>
                  </button>
                </div>

                {/* Technical Meta Tag badge */}
                <div className="absolute bottom-2.5 right-2.5 bg-slate-950/80 backdrop-blur-xs px-2 py-0.5 rounded text-[9px] font-bold text-gray-300 font-mono tracking-wider">
                  {photo.startsWith("data:") 
                    ? (isRtl ? "صورة محملة (BASE64)" : "UPLOADED (BASE64)") 
                    : (isRtl ? "رابط خارجي (URL)" : "EXTERNAL (URL)")}
                </div>
              </>
            ) : (
              <div className="text-center p-5 flex flex-col items-center select-none">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3 border border-red-100">
                  <Upload className="w-5 h-5 text-red-600 animate-pulse" />
                </div>
                <p className="text-xs font-extrabold text-gray-700">
                  {isRtl ? "اسحب وأفلت صورة ميكانيكية هنا" : "Drag & drop product image here"}
                </p>
                <p className="text-[10px] text-gray-400 mt-1 mb-3.5 max-w-[200px]">
                  {isRtl ? "JPG, PNG أو WEBP بحد أقصى 5 ميجابايت" : "JPG, PNG, or WEBP up to 5MB"}
                </p>
                <label className="cursor-pointer px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-sm active:scale-95 transition-all">
                  <span>{isRtl ? "تصفح الملفات" : "Upload File"}</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Validation Errors for Photo Upload */}
          {photoError && (
            <div className="text-[11px] text-red-700 flex items-center gap-1.5 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
              <span className="font-semibold">{photoError}</span>
            </div>
          )}

          {/* Tabs for Presets and URL replacement alternatives */}
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black text-gray-500 uppercase tracking-wide">
                {isRtl ? "بدائل الاستبدال والتعديل:" : "Replace alternatives / selection:"}
              </span>
              
              {/* Modern segment-style tabs switcher */}
              <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg text-[10px] font-extrabold">
                <button
                  type="button"
                  onClick={() => setActiveTab("preset")}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    activeTab === "preset" ? "bg-white text-gray-900 shadow-2xs" : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {isRtl ? "كتالوج القوالب" : "Presets"}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("url")}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    activeTab === "url" ? "bg-white text-gray-900 shadow-2xs" : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {isRtl ? "رابط مباشر" : "Direct URL"}
                </button>
              </div>
            </div>

            {activeTab === "preset" ? (
              <div className="grid grid-cols-4 gap-1.5">
                {visiblePresets.map((img, i) => (
                  <button
                    id={`image-preset-btn-${i}`}
                    key={i}
                    type="button"
                    onClick={() => {
                      setPhoto(img.url);
                      setPhotoError("");
                    }}
                    className={`relative h-11 rounded-md overflow-hidden border-2 transition-all cursor-pointer ${
                      photo === img.url ? "border-red-600 scale-95 shadow-sm" : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                    title={isRtl ? img.labelAr : img.label}
                  >
                    <img 
                      src={img.url} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer" 
                      onError={() => {
                        setBrokenUrls(prev => [...prev, img.url]);
                      }}
                    />
                    {photo === img.url && (
                      <div className="absolute inset-0 bg-red-600/20 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white drop-shadow-md stroke-[3]" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
                    <Link className="w-3.5 h-3.5" />
                  </div>
                  <input
                    id="input-photo-url"
                    type="text"
                    value={photo.startsWith("data:") ? "" : photo}
                    onChange={(e) => {
                      setPhoto(e.target.value);
                      setPhotoError("");
                    }}
                    placeholder="https://images.unsplash.com/photo-..."
                    className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs font-mono focus:outline-hidden focus:border-red-500 transition-all bg-white"
                    dir="ltr"
                  />
                </div>
                {photo && !photo.startsWith("data:") && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhoto("");
                      setPhotoError("");
                    }}
                    className="p-1.5 border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                    title={isRtl ? "مسح الرابط" : "Clear URL"}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Advanced Extra Photos Controller */}
        <div className="border border-gray-200 rounded-xl p-4.5 bg-[#FAFBFD] space-y-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 text-right lg:text-left">
              {isRtl ? "صور إضافية للمنتج (تظهر في الملف التقني)" : "Supplementary Product Photos (Shown in Spec File)"}
            </label>
            <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-mono">
              {extraPhotos.length} {isRtl ? "صور" : "photos"}
            </span>
          </div>

          <p className="text-[11px] text-gray-500 leading-relaxed">
            {isRtl 
              ? "أضف صورًا تقنية أو هندسية إضافية توضح تفاصيل الأبعاد والمواصفات وسيتم عرضها للمستخدمين في المعرض." 
              : "Add technical or blueprint photos detailing dimensions or material structures. They will appear in the public specs view."}
          </p>

          {/* Grid of extra photos */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
            {extraPhotos.map((url, index) => (
              <div key={index} className="relative group h-28 rounded-lg overflow-hidden border border-gray-200 bg-slate-900 shadow-3xs">
                <img 
                  src={url} 
                  alt={`Extra ${index + 1}`} 
                  className="w-full h-full object-cover opacity-90 group-hover:scale-102 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
                
                {/* Actions overlay on hover */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                  {/* Replace via upload */}
                  <label className="cursor-pointer p-1.5 bg-white hover:bg-gray-100 text-slate-800 rounded-md shadow-sm active:scale-90 transition-all" title={isRtl ? "استبدال برفع ملف" : "Replace via upload"}>
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (!file.type.startsWith("image/")) return;
                          const r = new FileReader();
                          r.onload = (ev) => {
                            if (ev.target?.result) {
                              const newList = [...extraPhotos];
                              newList[index] = ev.target.result as string;
                              setExtraPhotos(newList);
                            }
                          };
                          r.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>

                  {/* Replace via URL prompt */}
                  <button
                    type="button"
                    onClick={() => {
                      const newUrl = prompt(isRtl ? "أدخل رابط الصورة الجديد:" : "Enter new image URL:", url);
                      if (newUrl && newUrl.trim()) {
                        const newList = [...extraPhotos];
                        newList[index] = newUrl.trim();
                        setExtraPhotos(newList);
                      }
                    }}
                    className="p-1.5 bg-white hover:bg-gray-100 text-slate-800 rounded-md shadow-sm active:scale-90 transition-all cursor-pointer"
                    title={isRtl ? "استبدال برابط" : "Replace via URL"}
                  >
                    <Link className="w-3.5 h-3.5 text-emerald-600" />
                  </button>

                  {/* Remove photo */}
                  <button
                    type="button"
                    onClick={() => {
                      setExtraPhotos(prev => prev.filter((_, i) => i !== index));
                    }}
                    className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md shadow-sm active:scale-90 transition-all cursor-pointer"
                    title={isRtl ? "إزالة" : "Remove"}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Index tag */}
                <div className="absolute top-1.5 left-1.5 bg-slate-950/80 backdrop-blur-xs px-1.5 py-0.5 rounded text-[9px] font-bold text-gray-300 font-mono">
                  #{index + 1}
                </div>
              </div>
            ))}

            {/* Custom Interactive card to Add a new Photo */}
            <div className="h-28 rounded-lg border-2 border-dashed border-gray-300 hover:border-red-400 bg-white hover:bg-slate-50/50 flex flex-col items-center justify-center p-2 transition-all relative group">
              <span className="text-[10px] font-black text-gray-700 flex items-center gap-1 mb-1.5 uppercase">
                <Plus className="w-3 h-3 text-red-600" />
                {isRtl ? "أضف صورة إضافية" : "Add Extra Photo"}
              </span>

              <div className="flex gap-1.5 w-full justify-center">
                <label className="cursor-pointer bg-red-600 hover:bg-red-700 text-white text-[9px] font-bold px-2 py-1 rounded-md shadow-2xs active:scale-95 transition-all text-center flex items-center gap-1">
                  <Upload className="w-3 h-3" />
                  <span>{isRtl ? "رفع" : "Upload"}</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (!file.type.startsWith("image/")) return;
                        const r = new FileReader();
                        r.onload = (ev) => {
                          if (ev.target?.result) {
                            setExtraPhotos(prev => [...prev, ev.target.result as string]);
                          }
                        };
                        r.readAsDataURL(file);
                      }
                    }}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => {
                    const url = prompt(isRtl ? "أدخل رابط الصورة الإضافية الجديدة:" : "Enter supplementary image URL:");
                    if (url && url.trim()) {
                      setExtraPhotos(prev => [...prev, url.trim()]);
                    }
                  }}
                  className="bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 text-[9px] font-bold px-2 py-1 rounded-md shadow-3xs active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                >
                  <Link className="w-3 h-3 text-gray-400" />
                  <span>{isRtl ? "رابط" : "URL"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Photo Gallery end */}
      </div>

      <div className={`flex gap-3 pt-5 border-t border-gray-100 ${isRtl ? "justify-start" : "justify-end"}`}>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-50 active:scale-97 transition-all cursor-pointer"
        >
          {t.cancel}
        </button>
        <button
          type="submit"
          className="px-5 py-2 bg-red-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-red-100 hover:bg-red-700 active:scale-97 transition-all cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          {t.saveSpec}
        </button>
      </div>
    </form>
  );
}
