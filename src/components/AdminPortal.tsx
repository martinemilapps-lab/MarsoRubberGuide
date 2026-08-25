import React, { useState } from "react";
import { Product } from "../types";
import { Language, TRANSLATIONS, CATEGORY_TRANSLATIONS } from "../locales";
import {
  ShieldCheck,
  Package,
  FolderTree,
  Plus,
  Search,
  Edit,
  Trash2,
  LogOut,
  ArrowLeft,
  FileText,
  Database,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import ProductForm from "./ProductForm";
import CategoryManagerModal from "./CategoryManagerModal";

interface AdminPortalProps {
  lang: Language;
  onLanguageChange: (lang: Language) => void;
  products: Product[];
  categories: string[];
  adminToken: string | null;
  userRole: string;
  onLogout: () => void;
  onReturnToCatalog: () => void;
  onSaveProduct: (formData: Partial<Product>) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  onAddCategory: (name: string) => Promise<void>;
  onEditCategory: (oldName: string, newName: string) => Promise<void>;
  onDeleteCategory: (name: string) => Promise<void>;
  onClearUnusedCategories: () => Promise<void>;
  showToast: (text: string, type?: "success" | "error") => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  lang,
  onLanguageChange,
  products,
  categories,
  adminToken,
  userRole,
  onLogout,
  onReturnToCatalog,
  onSaveProduct,
  onDeleteProduct,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onClearUnusedCategories,
  showToast
}) => {
  const isRtl = lang === "ar";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter products by search query and category
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(query) ||
      (p.nameAr && p.nameAr.toLowerCase().includes(query)) ||
      p.category.toLowerCase().includes(query) ||
      (p.specs?.code && p.specs.code.toLowerCase().includes(query));
    return matchesCategory && matchesSearch;
  });

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteProduct(String(productToDelete.id));
      showToast(isRtl ? "تم حذف المنتج بنجاح" : "Product deleted successfully");
      setProductToDelete(null);
    } catch (err: any) {
      showToast(err.message || (isRtl ? "فشل حذف المنتج" : "Failed to delete product"), "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans" dir={isRtl ? "rtl" : "ltr"}>
      {/* Top Admin Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-white">
                {isRtl ? "لوحة تحكم المشرف الآمنة" : "Secure Admin Portal"}
              </h1>
              <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-md capitalize">
                {userRole}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {isRtl ? "إدارة كتالوج مارسو للمطاط" : "MARSO Rubber Catalog Management"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => onLanguageChange(lang === "en" ? "ar" : "en")}
            className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition"
          >
            {lang === "en" ? "العربية 🇪🇬" : "English 🇬🇧"}
          </button>

          <button
            onClick={onReturnToCatalog}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition"
          >
            <ArrowLeft className={`w-3.5 h-3.5 ${isRtl ? "rotate-180" : ""}`} />
            <span>{isRtl ? "عرض الموقع العام" : "Public Website"}</span>
          </button>

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{isRtl ? "تسجيل الخروج" : "Sign Out"}</span>
          </button>
        </div>
      </header>

      {/* Main Admin Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Metric Cards Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                {isRtl ? "إجمالي المنتجات" : "Total Products"}
              </p>
              <h3 className="text-2xl font-bold text-white mt-1">{products.length}</h3>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <Package className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                {isRtl ? "التصنيفات المعتمدة" : "Categories"}
              </p>
              <h3 className="text-2xl font-bold text-white mt-1">{categories.length}</h3>
            </div>
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
              <FolderTree className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                {isRtl ? "حالة المصادقة" : "Auth Session"}
              </p>
              <h3 className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" />
                <span>{isRtl ? "جلسة مشفرة نشطة" : "Active Encrypted"}</span>
              </h3>
            </div>
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
              <Database className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                {isRtl ? "نظام الذكاء الاصطناعي" : "AI Security"}
              </p>
              <h3 className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" />
                <span>{isRtl ? "محمي ومعدل النطاق" : "Hardened & Limited"}</span>
              </h3>
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Action Controls & Filtering Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">
                {isRtl ? "إدارة كتالوج المنتجات" : "Product Catalog Management"}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRtl ? "إضافة وتعديل وحذف المنتجات ورفع المواصفات الفنية" : "Add, edit, delete products and upload technical specifications"}
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={() => setIsCategoryModalOpen(true)}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 rounded-xl transition flex items-center justify-center gap-2"
              >
                <FolderTree className="w-4 h-4 text-slate-400" />
                <span>{isRtl ? "إدارة التصنيفات" : "Manage Categories"}</span>
              </button>

              <button
                onClick={handleOpenCreate}
                className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-900/20 transition flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>{isRtl ? "إضافة منتج جديد" : "Add New Product"}</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-2 border-t border-slate-800">
            <div className="relative flex-1 w-full">
              <Search className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? "right-3.5" : "left-3.5"} w-4 h-4 text-slate-400`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isRtl ? "بحث بالاسم، الكود، أو المواصفات..." : "Search product name, code, or specs..."}
                className={`w-full bg-slate-800/60 border border-slate-700 rounded-xl ${isRtl ? "pr-10 pl-4" : "pl-10 pr-4"} py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40`}
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full sm:w-64 bg-slate-800/60 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              <option value="All">{isRtl ? "جميع التصنيفات" : "All Categories"}</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_TRANSLATIONS[cat]?.[lang] || cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Product Data Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="bg-slate-800/60 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">{isRtl ? "المنتج" : "Product"}</th>
                  <th className="px-6 py-4">{isRtl ? "التصنيف" : "Category"}</th>
                  <th className="px-6 py-4">{isRtl ? "الكود" : "Code"}</th>
                  <th className="px-6 py-4">{isRtl ? "ملف المواصفات PDF" : "Datasheet PDF"}</th>
                  <th className="px-6 py-4 text-center">{isRtl ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <Package className="w-8 h-8 opacity-40" />
                        <p>{isRtl ? "لا توجد منتجات تطابق البحث" : "No products found matching query"}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={p.photo || "https://images.unsplash.com/photo-1590069261209-f8e9b8642343?auto=format&fit=crop&q=80&w=400"}
                            alt={p.name}
                            className="w-12 h-12 rounded-lg object-cover bg-slate-800 border border-slate-700"
                          />
                          <div>
                            <p className="font-semibold text-slate-100">{p.name}</p>
                            {p.nameAr && <p className="text-xs text-slate-400 dir-rtl">{p.nameAr}</p>}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-xs font-medium text-slate-300">
                        <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg">
                          {CATEGORY_TRANSLATIONS[p.category]?.[lang] || p.category}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-xs font-mono text-slate-400">
                        {p.specs?.code || "N/A"}
                      </td>

                      <td className="px-6 py-4 text-xs">
                        {p.datasheetFile ? (
                          <a
                            href={p.datasheetFile.startsWith("http") || p.datasheetFile.startsWith("data:") ? p.datasheetFile : `/api/products/${p.id}/datasheet`}
                            target="_blank"
                            rel="noreferrer"
                            download={p.datasheetName || "datasheet.pdf"}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-md font-medium transition cursor-pointer"
                            title={isRtl ? "تحميل / عرض ورقة المواصفات" : "Download / View Datasheet"}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span className="max-w-[150px] truncate">{p.datasheetName || "Datasheet.pdf"}</span>
                          </a>
                        ) : (
                          <span className="text-slate-500 italic">{isRtl ? "غير مرفق" : "None"}</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-2 text-slate-300 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition"
                            title={isRtl ? "تعديل المنتج" : "Edit product"}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setProductToDelete(p)}
                            className="p-2 text-slate-300 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
                            title={isRtl ? "حذف المنتج" : "Delete product"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-100">
                  {isRtl ? "تأكيد حذف المنتج" : "Delete Product?"}
                </h3>
                <p className="text-xs text-slate-400">
                  {isRtl ? "هذا الإجراء نهائي ولا يمكن التراجع عنه" : "This action cannot be undone."}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-300 bg-slate-800/60 p-3 rounded-xl border border-slate-700">
              {isRtl ? `هل أنت تأكد من رغبتك في حذف "${productToDelete.name}"؟` : `Are you sure you want to permanently delete "${productToDelete.name}"?`}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setProductToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition"
              >
                {isRtl ? "إلغاء" : "Cancel"}
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl shadow-lg shadow-red-900/30 transition disabled:opacity-50"
              >
                {isDeleting ? (isRtl ? "جاري الحذف..." : "Deleting...") : (isRtl ? "حذف نهائي" : "Delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Form Modal (Create / Edit) */}
      {isFormOpen && (
        <ProductForm
          product={editingProduct}
          lang={lang}
          onSave={async (formData) => {
            await onSaveProduct(formData);
            setIsFormOpen(false);
          }}
          onCancel={() => setIsFormOpen(false)}
          availableCategories={categories}
        />
      )}

      {/* Category Manager Modal */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categories}
        products={products}
        lang={lang}
        onAddCategory={onAddCategory}
        onEditCategory={onEditCategory}
        onDeleteCategory={onDeleteCategory}
        onClearUnusedCategories={onClearUnusedCategories}
      />
    </div>
  );
};
