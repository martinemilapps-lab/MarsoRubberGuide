import { Product } from "../types";
import { CATEGORY_DETAILS } from "../constants";
import { Language, CATEGORY_TRANSLATIONS, STATIC_PRODUCT_TRANSLATIONS, TRANSLATIONS, translateTerm } from "../locales";
import { Edit, Trash2, Shield, Eye, Wrench } from "lucide-react";
import { motion } from "motion/react";

interface ProductCardProps {
  key?: string | number;
  product: Product;
  lang: Language;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onSelect: (product: Product) => void;
  isAdmin?: boolean;
}

export default function ProductCard({
  product,
  lang,
  onEdit,
  onDelete,
  onSelect,
  isAdmin = false
}: ProductCardProps) {
  const catMeta = CATEGORY_DETAILS[product.category] || {
    color: "text-gray-600 border-gray-200",
    bg: "bg-gray-50",
    description: ""
  };

  const t = TRANSLATIONS[lang];
  const translatedCategory = CATEGORY_TRANSLATIONS[product.category]?.[lang] || product.category;

  // Localized product details if available, otherwise fallback to the inputted ones
  const localizedInfo = lang === "ar"
    ? {
        name: product.nameAr || (STATIC_PRODUCT_TRANSLATIONS[product.name] ? STATIC_PRODUCT_TRANSLATIONS[product.name].nameAr : product.name),
        additional: STATIC_PRODUCT_TRANSLATIONS[product.name] ? STATIC_PRODUCT_TRANSLATIONS[product.name].additionalAr : (product.specs.features || "")
      }
    : {
        name: product.name,
        additional: product.specs.features || ""
      };

  const isRtl = lang === "ar";

  return (
    <motion.div
      id={`product-card-${product.id}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4 }}
      className={`bg-white rounded-xl border border-gray-100 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col h-full text-right ${
        isRtl ? "font-sans text-right" : "font-sans text-left"
      }`}
    >
      {/* Product Image Area */}
      {product.photo ? (
        <div className="relative h-48 bg-gray-50 overflow-hidden group">
          <img
            src={product.photo}
            alt={localizedInfo.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            referrerPolicy="no-referrer"
            onError={(e) => {
              // fallback placeholder if image fails to load
              (e.target as HTMLImageElement).src =
                "https://images.unsplash.com/photo-1590069261209-f8e9b8642343?auto=format&fit=crop&q=80&w=400";
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
            <button
              id={`view-details-btn-${product.id}`}
              onClick={() => onSelect(product)}
              className="w-full py-2 px-3 bg-white/95 text-gray-900 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm hover:bg-white active:scale-95 transition-all cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-red-600" />
              {t.viewTechnicalSpecs}
            </button>
          </div>

          {/* Category Tag */}
          <span
            className={`absolute top-3 ${
              isRtl ? "right-3" : "left-3"
            } px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-full border ${catMeta.bg} ${catMeta.color} shadow-xs`}
          >
            {translatedCategory}
          </span>

          {/* Special ISO / Engineering Badge */}
          {product.category === "Reverse Engineering" && (
            <div className={`absolute top-3 ${isRtl ? "left-3" : "right-3"} bg-red-600 text-white p-1.5 rounded-full shadow-md animate-pulse`} title="Custom Reverse Engineering Available">
              <Wrench className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
      ) : null}

      {/* Product Info content */}
      <div className="p-5 flex-1 flex flex-col justify-between" dir={lang === "ar" ? "rtl" : "ltr"}>
        <div>
          {/* Render category and custom badge inline if there is no product photo */}
          {!product.photo && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span
                className={`px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full border ${catMeta.bg} ${catMeta.color} shadow-xs`}
              >
                {translatedCategory}
              </span>
              {product.category === "Reverse Engineering" && (
                <span className="flex items-center gap-1 bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-full text-[10px] font-bold" title="Custom Reverse Engineering Available">
                  <Wrench className="w-3 h-3 text-red-600 shrink-0 animate-pulse" />
                  <span>{isRtl ? "هندسة عكسية" : "Reverse Eng"}</span>
                </span>
              )}
            </div>
          )}

          <h3 className="font-sans font-bold text-gray-900 text-base line-clamp-1 hover:text-red-600 transition-colors cursor-pointer" onClick={() => onSelect(product)}>
            {localizedInfo.name}
          </h3>

          <div className={`mt-3 space-y-1.5 text-xs text-gray-600 pl-2.5 ${isRtl ? "border-r-2 border-red-500 pr-2.5 border-l-0 pl-0" : "border-l-2 border-red-500 pl-2.5"}`}>
            <p className="flex justify-between items-center gap-4">
              <span className="font-medium text-gray-400 font-mono tracking-tight text-[10px] shrink-0 uppercase">{isRtl ? "الكود" : "Code"}</span>
              <span className="font-bold text-gray-800 text-right truncate max-w-[160px]">{product.specs.code || "N/A"}</span>
            </p>
            <p className="flex justify-between items-center gap-4">
              <span className="font-medium text-gray-400 font-mono tracking-tight text-[10px] shrink-0 uppercase">{isRtl ? "المادة" : "Material"}</span>
              <span className="font-semibold text-gray-800 text-right truncate max-w-[160px]">{translateTerm(product.specs.material || "Standard", lang)}</span>
            </p>
            <p className="flex justify-between items-center gap-4">
              <span className="font-medium text-gray-400 font-mono tracking-tight text-[10px] shrink-0 uppercase">{isRtl ? "الاستخدام" : "Application"}</span>
              <span className="font-semibold text-gray-800 text-right truncate max-w-[160px]">{translateTerm(product.specs.application || "Optimized", lang)}</span>
            </p>
          </div>

          <p className="mt-4 text-xs text-gray-500 line-clamp-2 leading-relaxed italic">
            {localizedInfo.additional || (isRtl ? "يطابق أعلى معايير أيزو 14001 ومواصفات الأمان والجودة لمصانع مارسو." : "Meets highest durability profiles under ISO 14001, Quality, and Safety standards.")}
          </p>
        </div>

        <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between">
          <button
            id={`open-detail-link-${product.id}`}
            onClick={() => onSelect(product)}
            className="text-xs font-semibold text-gray-500 hover:text-red-600 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5 text-red-600/70" />
            {t.viewFullProfile}
          </button>

          {isAdmin && (
            <div className="flex gap-1.5" dir="ltr">
              <button
                id={`edit-product-btn-${product.id}`}
                onClick={() => onEdit(product)}
                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                title={t.editProduct}
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                id={`delete-product-btn-${product.id}`}
                onClick={() => onDelete(product.id)}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title={t.deleteProduct}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
