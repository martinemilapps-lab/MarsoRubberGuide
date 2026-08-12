import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Plus, Edit2, Trash2, Check, Layers, AlertCircle, RefreshCw } from "lucide-react";
import { Language, TRANSLATIONS, CATEGORY_TRANSLATIONS } from "../locales";
import { Product } from "../types";

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  products: Product[];
  lang: Language;
  onAddCategory: (name: string) => Promise<void>;
  onEditCategory: (oldName: string, newName: string) => Promise<void>;
  onDeleteCategory: (name: string) => Promise<void>;
  onClearUnusedCategories: () => Promise<void>;
}

export default function CategoryManagerModal({
  isOpen,
  onClose,
  categories,
  products,
  lang,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onClearUnusedCategories
}: CategoryManagerModalProps) {
  const t = TRANSLATIONS[lang];
  const isRtl = lang === "ar";

  const [newCatName, setNewCatName] = useState("");
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Calculate product count for each category
  const getCount = (catName: string) => {
    return products.filter((p) => p.category === catName).length;
  };

  const unusedCount = categories.filter((cat) => getCount(cat) === 0).length;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await onAddCategory(newCatName.trim());
      setNewCatName("");
    } catch (err: any) {
      setError(err.message || "Failed to add category");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (cat: string) => {
    setEditingCat(cat);
    setEditingValue(cat);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingCat(null);
    setEditingValue("");
  };

  const handleSaveEdit = async (oldName: string) => {
    if (!editingValue.trim() || editingValue.trim() === oldName) {
      cancelEdit();
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onEditCategory(oldName, editingValue.trim());
      setEditingCat(null);
    } catch (err: any) {
      setError(err.message || "Failed to edit category");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (cat: string) => {
    const count = getCount(cat);
    if (count > 0) {
      const confirmMsg = isRtl
        ? `تحذير: يحتوي هذا التصنيف على ${count} منتج(منتجات). هل أنت تأكد من حذفه؟`
        : `Warning: This category currently has ${count} product(s). Are you sure you want to remove it?`;
      if (!window.confirm(confirmMsg)) return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onDeleteCategory(cat);
    } catch (err: any) {
      setError(err.message || "Failed to delete category");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearUnused = async () => {
    if (unusedCount === 0) return;
    const confirmMsg = isRtl
      ? `هل تريد إزالة جميع التصنيفات الفارغة التي لا تحتوي على أي منتجات (${unusedCount} تصنيف)؟`
      : `Are you sure you want to clear all ${unusedCount} unused classifications with 0 products?`;
    if (!window.confirm(confirmMsg)) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await onClearUnusedCategories();
    } catch (err: any) {
      setError(err.message || "Failed to clear unused categories");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-[#00000080] z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[85vh]"
          dir={isRtl ? "rtl" : "ltr"}
        >
          {/* Modal Header */}
          <div className="px-6 py-4 bg-linear-to-r from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-600/30 border border-red-500/30 rounded-lg text-red-400">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base tracking-tight">{t.manageCategories}</h3>
                <p className="text-xs text-gray-300">
                  {isRtl
                    ? "إضافة وتعديل ومسح التصنيفات والفئات الفنية لمشرف النظام"
                    : "Add, edit, and clear classifications for the admin console"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Actions & Clear Unused Bar */}
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
              <span className="px-2.5 py-1 bg-white border border-gray-200 rounded-md shadow-2xs">
                {isRtl ? "إجمالي التصنيفات:" : "Total Categories:"} <strong className="text-red-600">{categories.length}</strong>
              </span>
              {unusedCount > 0 && (
                <span className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-md font-semibold">
                  {isRtl ? "تصنيفات فارغة:" : "Unused (0 Products):"} <strong>{unusedCount}</strong>
                </span>
              )}
            </div>

            <button
              onClick={handleClearUnused}
              disabled={unusedCount === 0 || isSubmitting}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs ${
                unusedCount > 0
                  ? "bg-red-600 text-white hover:bg-red-700 active:scale-98 cursor-pointer"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
              title={t.clearUnusedCategories}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t.clearUnusedCategories}
            </button>
          </div>

          {/* Add Category Form */}
          <div className="p-4 border-b border-gray-100 bg-white shrink-0">
            <form onSubmit={handleAdd} className="flex gap-2">
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder={t.categoryNamePlaceholder}
                className="flex-1 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
              />
              <button
                type="submit"
                disabled={!newCatName.trim() || isSubmitting}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Plus className="w-4 h-4" />
                {t.addCategory}
              </button>
            </form>
            {error && (
              <div className="mt-2 text-xs text-red-600 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {error}
              </div>
            )}
          </div>

          {/* Category List */}
          <div className="p-4 overflow-y-auto flex-1 divide-y divide-gray-100">
            {categories.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                {isRtl ? "لا توجد تصنيفات حالياً." : "No categories registered."}
              </div>
            ) : (
              categories.map((cat, idx) => {
                const count = getCount(cat);
                const isEditingThis = editingCat === cat;
                const translatedTitle = CATEGORY_TRANSLATIONS[cat]?.[lang] || cat;

                return (
                  <div
                    key={cat}
                    className={`py-3 px-3 flex items-center justify-between gap-3 rounded-xl transition-colors ${
                      count === 0 ? "bg-red-50/40 border border-red-100/50 my-1" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-xs font-mono font-bold text-gray-400 shrink-0 w-6">
                        {idx + 1}.
                      </span>

                      {isEditingThis ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="flex-1 px-3 py-1.5 bg-white border border-red-500 rounded-lg text-xs text-gray-800 focus:outline-none ring-2 ring-red-500/20"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEdit(cat);
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                          <button
                            onClick={() => handleSaveEdit(cat)}
                            disabled={isSubmitting}
                            className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between flex-1 min-w-0">
                          <span className="text-xs font-bold text-gray-800 truncate" title={cat}>
                            {cat}
                          </span>
                          <span
                            className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full shrink-0 ml-2 ${
                              count > 0
                                ? "bg-gray-100 text-gray-600"
                                : "bg-red-100 text-red-700 font-mono"
                            }`}
                          >
                            {count} {isRtl ? "منتج" : count === 1 ? "product" : "products"}
                          </span>
                        </div>
                      )}
                    </div>

                    {!isEditingThis && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => startEdit(cat)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          title={t.editCategory}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(cat)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title={t.deleteProduct}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end shrink-0">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              {t.cancel}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
