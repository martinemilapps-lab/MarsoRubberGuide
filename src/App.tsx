import React, { useState, useEffect, useRef } from "react";
// @ts-ignore
import marsoLogo from "./assets/images/the_logo.png";
import { Product, ProductClassification, ChatMessage } from "./types";
import { PRODUCT_CATEGORIES, CATEGORY_DETAILS, categoryToSlug, slugToCategory } from "./constants";
import ProductCard from "./components/ProductCard";
import ProductForm from "./components/ProductForm";
import { AdminLoginModal } from "./components/AdminLoginModal";
import { AdminPortal } from "./components/AdminPortal";
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
  Image as ImageIcon,
  Settings,
  Edit2,
  Maximize2,
  Key
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import productsDataJson from "../products.json";
import CategoryManagerModal from "./components/CategoryManagerModal";
import ContactCardModal from "./components/ContactCardModal";
import AccessCodeModal from "./components/AccessCodeModal";
import AdminCodeGeneratorModal from "./components/AdminCodeGeneratorModal";
import { AnimatedBackground } from "./components/AnimatedBackground";
import { isSessionUnlocked } from "./lib/accessCode";

const INITIAL_SEED_PRODUCTS = productsDataJson as unknown as Product[];

export default function App() {
  const [lang, setLang] = useState<Language>("en"); // English as default
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem("marso_products_cache");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return INITIAL_SEED_PRODUCTS;
  });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(() => {
    try {
      const saved = localStorage.getItem("marso_products_cache");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
      }
    } catch (e) {}
    return INITIAL_SEED_PRODUCTS.length > 0 ? INITIAL_SEED_PRODUCTS[0] : null;
  });
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ProductClassification | "All">(() => {
    return slugToCategory(window.location.pathname);
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"catalog" | "chat">("catalog");
  const [isMobileDetailsOpen, setIsMobileDetailsOpen] = useState(false);

  const [categoriesList, setCategoriesList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("marso_categories_cache");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return PRODUCT_CATEGORIES;
  });
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactModalProduct, setContactModalProduct] = useState<Product | null>(null);
  const [isAccessCodeModalOpen, setIsAccessCodeModalOpen] = useState(false);
  const [isAdminCodeGeneratorOpen, setIsAdminCodeGeneratorOpen] = useState(false);
  const [pendingDownloadProduct, setPendingDownloadProduct] = useState<Product | null>(null);

  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);

  const navigateTo = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
    }
    setCurrentPath(path);
  };

  const selectCategoryAndNavigate = (category: ProductClassification | "All") => {
    setSelectedCategory(category);
    setActiveTab("catalog");

    const slug = categoryToSlug(category);
    const search = window.location.search;
    const targetPath = slug ? `/${slug}` : "/";
    const targetUrl = targetPath + search;

    if (window.location.pathname + window.location.search !== targetUrl) {
      window.history.pushState({ category }, "", targetUrl);
      setCurrentPath(window.location.pathname);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
      const cat = slugToCategory(window.location.pathname);
      setSelectedCategory(cat);
      setActiveTab("catalog");
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // CRUD states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Admin Mode state and authenticated session token management
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(() => sessionStorage.getItem("marso_admin_token"));
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string>("admin");

  useEffect(() => {
    if (adminToken) {
      fetch("/api/admin/verify", {
        headers: { Authorization: `Bearer ${adminToken}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.authenticated) {
            setIsAdmin(true);
            if (data.role) setUserRole(data.role);
          } else {
            setIsAdmin(false);
            setAdminToken(null);
            sessionStorage.removeItem("marso_admin_token");
          }
        })
        .catch(() => {
          setIsAdmin(false);
          setAdminToken(null);
          sessionStorage.removeItem("marso_admin_token");
        });
    } else {
      setIsAdmin(false);
    }
  }, [adminToken]);

  const handleAdminLoginSuccess = (token: string) => {
    sessionStorage.setItem("marso_admin_token", token);
    setAdminToken(token);
    setIsAdmin(true);
    showToast(isRtl ? "تم تفعيل وضع المشرف الآمن" : "Admin secure session activated");
  };

  const handleLogoutAdmin = async () => {
    try {
      await fetch("/api/admin/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken || ""}` }
      });
    } catch (e) {}
    sessionStorage.removeItem("marso_admin_token");
    setAdminToken(null);
    setIsAdmin(false);
    showToast(isRtl ? "تم تسجيل الخروج من وضع المشرف" : "Logged out of admin mode");
    navigateTo("/");
  };

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
    fetchBootstrap();
    // Auto-polling interval: refetch bootstrap data quietly every 8 seconds
    const interval = setInterval(() => {
      fetchBootstrap(true);
    }, 8000);
    return () => clearInterval(interval);
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

  const handleAddCategory = async (name: string) => {
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken || ""}`
        },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        const updated = await res.json();
        setCategoriesList(updated);
        showToast(t.categoryAdded);
      } else {
        const err = await res.json();
        throw new Error(err.error || t.saveFail);
      }
    } catch (err: any) {
      showToast(err.message || t.saveFail, "error");
      throw err;
    }
  };

  const handleEditCategory = async (oldName: string, newName: string) => {
    try {
      const res = await fetch("/api/categories", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken || ""}`
        },
        body: JSON.stringify({ oldName, newName })
      });
      if (res.ok) {
        const data = await res.json();
        setCategoriesList(data.categories);
        await fetchProducts(true);
        if (selectedCategory === oldName) {
          setSelectedCategory(newName);
        }
        showToast(t.categoryUpdated);
      } else {
        const err = await res.json();
        throw new Error(err.error || t.saveFail);
      }
    } catch (err: any) {
      showToast(err.message || t.saveFail, "error");
      throw err;
    }
  };

  const handleDeleteCategory = async (name: string) => {
    try {
      const res = await fetch(`/api/categories?name=${encodeURIComponent(name)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${adminToken || ""}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setCategoriesList(data.categories);
        if (selectedCategory === name) {
          setSelectedCategory("All");
        }
        showToast(t.categoryDeleted);
      } else {
        const err = await res.json();
        throw new Error(err.error || t.saveFail);
      }
    } catch (err: any) {
      showToast(err.message || t.saveFail, "error");
      throw err;
    }
  };

  const handleClearUnusedCategories = async () => {
    try {
      const res = await fetch("/api/categories/clear-unused", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken || ""}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setCategoriesList(data.categories);
        showToast(t.categoriesCleared);
      } else {
        const err = await res.json();
        throw new Error(err.error || t.saveFail);
      }
    } catch (err: any) {
      showToast(err.message || t.saveFail, "error");
      throw err;
    }
  };



  const fetchBootstrap = async (quiet = true) => {
    if (!quiet && products.length === 0) setIsLoading(true);
    try {
      const res = await fetch("/api/bootstrap");
      if (res.ok && res.status !== 304) {
        const data = await res.json();

        // 1. Process and update products
        if (data.products && Array.isArray(data.products)) {
          const serverProducts: Product[] = data.products;
          setProducts(prevProducts => {
            const map = new Map<string, Product>();
            serverProducts.forEach(p => map.set(String(p.id), p));

            // Retain any pending optimistic products
            prevProducts.forEach(p => {
              if (!map.has(String(p.id))) {
                const alreadyOnServer = serverProducts.some(d => d.name === p.name && d.category === p.category);
                if (!alreadyOnServer) {
                  map.set(String(p.id), p);
                }
              }
            });

            const merged = Array.from(map.values());
            try {
              localStorage.setItem("marso_products_cache", JSON.stringify(merged));
            } catch (e) {}
            return merged;
          });

          if (serverProducts.length > 0) {
            setSelectedProduct(prevSelected => {
              if (!prevSelected) return serverProducts[0];
              const matching = serverProducts.find((p: Product) => String(p.id) === String(prevSelected.id));
              return matching || prevSelected;
            });
          }
        }

        // 2. Process and update categories
        if (data.categories && Array.isArray(data.categories) && data.categories.length > 0) {
          setCategoriesList(data.categories);
          try {
            localStorage.setItem("marso_categories_cache", JSON.stringify(data.categories));
          } catch (e) {}
        }
      }
    } catch (e) {
      if (!quiet && products.length === 0) showToast(t.networkError, "error");
    } finally {
      if (!quiet) setIsLoading(false);
    }
  };

  const fetchProducts = async (quiet = false) => {
    await fetchBootstrap(quiet);
  };

  const handleAutoSaveProductQuiet = (updated: Product) => {
    setProducts(prevProducts => prevProducts.map(p => String(p.id) === String(updated.id) ? updated : p));
    setSelectedProduct(prevSelected => {
      if (prevSelected && String(prevSelected.id) === String(updated.id)) {
        return updated;
      }
      return prevSelected;
    });
  };

  const handleSaveProduct = async (formData: Partial<Product>) => {
    try {
      // Auto-switch filter to "All" so the saved/created product is GUARANTEED to be visible in the catalog!
      setSelectedCategory("All");

      if (editingProduct) {
        // Optimistically update UI instantly (< 10ms)
        const optimisticUpdated: Product = {
          ...editingProduct,
          ...formData,
          name: formData.name || editingProduct.name,
          nameAr: formData.nameAr || editingProduct.nameAr,
          category: formData.category || editingProduct.category,
          photo: formData.photo || editingProduct.photo,
          extraPhotos: [],
          specs: {
            ...editingProduct.specs,
            ...(formData.specs || {})
          },
          datasheetFile: formData.datasheetFile !== undefined ? formData.datasheetFile : editingProduct.datasheetFile,
          datasheetName: formData.datasheetName !== undefined ? formData.datasheetName : editingProduct.datasheetName
        };

        setProducts(prevProducts => prevProducts.map(p => String(p.id) === String(editingProduct.id) ? optimisticUpdated : p));
        setSelectedProduct(optimisticUpdated);
        setIsFormOpen(false);
        setEditingProduct(null);
        showToast(t.updateSuccess);

        // Perform server PUT in background
        const res = await fetch(`/api/products/${editingProduct.id}`, {
          method: "PUT",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${adminToken || ""}`
          },
          body: JSON.stringify(formData)
        });

        if (res.ok) {
          const updated = await res.json();
          setProducts(prevProducts => prevProducts.map(p => String(p.id) === String(updated.id) ? updated : p));
          setSelectedProduct(updated);
        } else {
          showToast(isRtl ? "فشل تحديث بيانات ومواصفات المنتج على الخادم" : "Server failed to save product details", "error");
        }
      } else {
        // Create new product
        const tempId = String(Date.now());
        const optimisticCreated: Product = {
          id: tempId,
          name: formData.name || "Unnamed Product",
          nameAr: formData.nameAr || "",
          category: formData.category || "Reverse Engineering",
          photo: formData.photo || "https://images.unsplash.com/photo-1590069261209-f8e9b8642343?auto=format&fit=crop&q=80&w=400",
          extraPhotos: formData.extraPhotos || [],
          specs: {
            code: formData.specs?.code || "",
            sizeDims: formData.specs?.sizeDims || "",
            weight: formData.specs?.weight || "",
            features: formData.specs?.features || "",
            physicalSpecs: formData.specs?.physicalSpecs || "",
            material: formData.specs?.material || "",
            color: formData.specs?.color || "",
            application: formData.specs?.application || "",
            price: formData.specs?.price || "",
            priceCurrency: formData.specs?.priceCurrency || "EGP"
          },
          datasheetFile: formData.datasheetFile,
          datasheetName: formData.datasheetName
        };

        setProducts(prevProducts => [optimisticCreated, ...prevProducts.filter(p => String(p.id) !== tempId)]);
        setSelectedProduct(optimisticCreated);
        setIsFormOpen(false);
        showToast(`${t.addSuccess}: "${optimisticCreated.name}"`);

        const payloadWithId = {
          ...formData,
          id: tempId
        };

        const res = await fetch("/api/products", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${adminToken || ""}`
          },
          body: JSON.stringify(payloadWithId)
        });

        if (res.ok) {
          const created = await res.json();
          setProducts(prevProducts => [created, ...prevProducts.filter(p => String(p.id) !== tempId && String(p.id) !== String(created.id))]);
          setSelectedProduct(created);
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
    const targetId = productToDelete;

    // Optimistically update UI instantly (< 10ms)
    setProducts(prevProducts => {
      const updated = prevProducts.filter(p => String(p.id) !== String(targetId));
      setSelectedProduct(prevSelected => {
        if (prevSelected && String(prevSelected.id) === String(targetId)) {
          return updated.length > 0 ? updated[0] : null;
        }
        return prevSelected;
      });
      return updated;
    });

    setProductToDelete(null);
    showToast(t.deleteSuccess);

    // Perform server DELETE in background
    try {
      const res = await fetch(`/api/products/${targetId}`, { 
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${adminToken || ""}`
        }
      });
      if (!res.ok) {
        showToast(isRtl ? "خطأ أثناء إزالة المنتج من الكتالوج على الخادم" : "Error deleting item from catalog database", "error");
      }
    } catch (e) {
      showToast(isRtl ? "فشل الاتصال بالإنترنت لإتمام الحذف" : "Network failure trying to process delete request.", "error");
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
  const performDownloadSpec = (prod: Product) => {
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

  const handleDownloadSpec = (prod: Product) => {
    if (isSessionUnlocked()) {
      performDownloadSpec(prod);
      return;
    }
    setPendingDownloadProduct(prod);
    setIsAccessCodeModalOpen(true);
  };

  const handleRequestQuote = (prod: Product | null) => {
    setContactModalProduct(prod || selectedProduct);
    setIsContactModalOpen(true);
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

  if (currentPath.startsWith("/admin")) {
    if (!isAdmin) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
          <AnimatedBackground />
          <AdminLoginModal
            isOpen={true}
            onClose={() => navigateTo("/")}
            onLoginSuccess={handleAdminLoginSuccess}
            isRtl={isRtl}
          />
        </div>
      );
    }

    return (
      <AdminPortal
        lang={lang}
        onLanguageChange={setLang}
        products={products}
        categories={categoriesList}
        adminToken={adminToken}
        userRole={userRole}
        onLogout={handleLogoutAdmin}
        onReturnToCatalog={() => navigateTo("/")}
        onSaveProduct={handleSaveProduct}
        onDeleteProduct={async (id) => {
          setProductToDelete(id);
          await executeDeleteProduct();
        }}
        onAddCategory={handleAddCategory}
        onEditCategory={handleEditCategory}
        onDeleteCategory={handleDeleteCategory}
        onClearUnusedCategories={handleClearUnusedCategories}
        showToast={showToast}
      />
    );
  }

  return (
    <div className="relative h-screen h-[100dvh] w-full max-w-full bg-transparent text-gray-800 flex flex-col overflow-hidden font-sans" dir={t.dir}>
      <AnimatedBackground />
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
      <header className="h-[64px] bg-white/65 backdrop-blur-sm border-b border-gray-200/60 flex items-center justify-between px-3 sm:px-6 shrink-0 shadow-xs z-10" dir={t.dir}>
        
        {/* Left/Start Column: Logo & Specialist Tag */}
        <div className="flex items-center gap-1.5 sm:gap-3 flex-1 min-w-0">
          <div 
            id="marso-logo-container" 
            className="logo flex items-center justify-center select-none shrink-0 cursor-default"
          >
            <img 
              src={marsoLogo} 
              alt="MARSO" 
              className="h-11 sm:h-14 w-auto object-contain cursor-default" 
              referrerPolicy="no-referrer"
            />
          </div>
          {isAdmin && (
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] font-bold shadow-2xs shrink-0 select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                <span className="uppercase font-mono tracking-wide whitespace-nowrap">{isRtl ? "مشرف" : "ADMIN"}</span>
                <button
                  onClick={handleLogoutAdmin}
                  className="ml-1 sm:ml-1.5 px-1 bg-amber-100 hover:bg-red-50 hover:text-red-600 rounded-sm text-amber-700 transition-colors uppercase font-mono text-[9px] cursor-pointer"
                  title={isRtl ? "خروج" : "Logout"}
                >
                  ✕
                </button>
              </div>
              <button
                onClick={() => setIsAdminCodeGeneratorOpen(true)}
                className="cursor-pointer flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] font-bold shadow-xs transition-all active:scale-95 shrink-0 whitespace-nowrap"
                title={isRtl ? "توليد كود دخول للمبيعات" : "Sales OTP Code Generator"}
              >
                <Key className="w-3 h-3 shrink-0" />
                <span>{isRtl ? "كود المبيعات (OTP)" : "Sales Code (OTP)"}</span>
              </button>
            </div>
          )}
        </div>

        {/* Center Column: Main Navigation Tabs (Perfect Centering) - Hidden on Mobile */}
        <div className="hidden md:flex items-center justify-center gap-3 sm:gap-6 md:gap-8 text-[11px] sm:text-xs md:text-sm font-bold text-gray-500 whitespace-nowrap h-full flex-initial">
          <button
            onClick={() => selectCategoryAndNavigate("All")}
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
        <div className="flex items-center justify-end gap-2.5 sm:gap-4 flex-1 h-full min-w-0">
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

      {/* THREE-COLUMN WORKSPACE: Grid Layout (Fluid on Mobile/Tablet, Split on Widescreen Desktop) */}
      <div className="flex-1 min-h-0 w-full grid grid-cols-1 lg:grid-cols-[260px_1fr] xl:grid-cols-[260px_1fr_320px] items-stretch overflow-hidden">
        
        {/* COLUMN 1: LEFT CLASSIFICATIONS SIDEBAR */}
        <aside dir={scrollDir} className="bg-white/50 backdrop-blur-xs border-l border-r border-gray-200/60 p-5 overflow-y-auto hidden lg:flex shrink-0">
          <div dir={contentDir} className="w-full min-h-full flex flex-col justify-between">
            <div>
              <h2 className="text-[11px] uppercase tracking-widest text-gray-400 font-extrabold mb-4 flex items-center justify-between">
                <span>{t.categories}</span>
                <div className="flex items-center gap-1.5">
                  <span className="bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full font-sans text-[10px]">
                    {categoriesList.length}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => setIsCategoryModalOpen(true)}
                      className="p-1 rounded-md text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                      title={t.manageCategories}
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </h2>

              <div className="space-y-1">
                <button
                  id="category-filter-all"
                  onClick={() => selectCategoryAndNavigate("All")}
                  className={`w-full text-right px-3 py-2 text-[13px] rounded-md transition-all flex items-center justify-between cursor-pointer ${
                    selectedCategory === "All" && activeTab === "catalog"
                      ? "bg-red-50 text-[#B91C1C] font-semibold border-r-4 border-red-600 pr-2"
                      : "text-gray-600 hover:bg-gray-50 active:bg-gray-100"
                  }`}
                >
                  <span className="truncate">{t.allClassifications}</span>
                  <span className="text-[11px] text-gray-400 font-semibold">{getCategoryCount("All")}</span>
                </button>

                {categoriesList.map((cat, idx) => {
                  const count = getCategoryCount(cat);
                  const isActive = selectedCategory === cat && activeTab === "catalog";
                  const translatedCatMenu = CATEGORY_TRANSLATIONS[cat]?.[lang] || cat;
                  return (
                    <button
                      id={`category-filter-${idx}`}
                      key={cat}
                      onClick={() => selectCategoryAndNavigate(cat)}
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

                {isAdmin && (
                  <button
                    onClick={() => setIsCategoryModalOpen(true)}
                    className="mt-3 w-full py-2 px-3 bg-red-50 hover:bg-red-100 text-[#B91C1C] text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 border border-red-200/80 cursor-pointer shadow-2xs"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    {t.manageCategories}
                  </button>
                )}
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
              <a
                href="tel:+201090113113"
                className="flex items-center gap-1 hover:text-red-600 transition-colors cursor-pointer"
                title={isRtl ? "اتصال بالهاتف" : "Call Phone"}
              >
                <Phone className="w-3 h-3 text-red-500 shrink-0" />
                <span className="font-mono text-[11px]">01090113113</span>
              </a>
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
        <main className={`bg-slate-50/15 backdrop-blur-none ${activeTab === 'chat' ? 'p-3 sm:p-4 lg:p-5 h-full' : 'p-4 lg:p-6'} flex flex-col min-h-0 min-w-0 border-r border-l border-gray-200/60 overflow-hidden`}>
          
          {/* MOBILE TABS & HEADER FILTER (Shown on phone/tablets) */}
          <div className="flex md:hidden items-center justify-between bg-white/60 backdrop-blur-xs border border-gray-200/60 rounded-lg p-2.5 mb-4 shrink-0">
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
              <div className="lg:hidden shrink-0 mb-4 bg-white/60 backdrop-blur-xs border border-gray-200/60 rounded-xl p-3.5 shadow-2xs">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#B91C1C] block mb-2 px-1 text-center">
                  {t.filterClassifications}
                </span>
                <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none snap-x -mx-1 px-1">
                  <button
                    id="mobile-cat-filter-all"
                    onClick={() => selectCategoryAndNavigate("All")}
                    className={`snap-start shrink-0 px-3.5 py-2 text-xs font-bold rounded-full transition-all border ${
                      selectedCategory === "All"
                        ? "bg-[#B91C1C] text-white border-transparent shadow-sm"
                        : "bg-[#F3F4F6] text-gray-700 border-gray-100 hover:bg-gray-200"
                    }`}
                  >
                    {t.allClasses} ({getCategoryCount("All")})
                  </button>
                  {categoriesList.map((cat, idx) => {
                    const count = getCategoryCount(cat);
                    const isActive = selectedCategory === cat;
                    const translatedCatMobile = CATEGORY_TRANSLATIONS[cat]?.[lang] || cat;
                    return (
                      <button
                        id={`mobile-cat-filter-${idx}`}
                        key={cat}
                        onClick={() => selectCategoryAndNavigate(cat)}
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
                      className="cursor-pointer bg-[#B91C1C] hover:bg-red-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md hover:shadow-lg border border-red-700 active:scale-95 transition-all shrink-0 z-10"
                      title={isRtl ? "تسجيل منتج جديد" : "Register New Product"}
                    >
                      <Plus className="w-4 h-4 text-white stroke-[2.5]" />
                      <span className="whitespace-nowrap font-bold text-white">{isRtl ? "تسجيل منتج جديد" : "Register New Product"}</span>
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
                          availableCategories={categoriesList}
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
                          selectCategoryAndNavigate("All");
                          setSearchQuery("");
                        }}
                        className="mt-4 px-4 py-2 border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 rounded-lg font-bold cursor-pointer"
                      >
                        {t.clearFilters}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4.5 pb-8">
                      {filteredProducts.map((p) => (
                        <ProductCard
                          key={p.id}
                          product={p}
                          lang={lang}
                          isAdmin={isAdmin}
                          onSelect={(prod) => {
                            setSelectedProduct(prod);
                            setIsMobileDetailsOpen(true);
                          }}
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
            <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden">
              {/* Chat Sub-header */}
              <div className="shrink-0 flex items-center justify-between border-b border-gray-200/80 pb-3 mb-3 bg-white/40 backdrop-blur-xs p-3 rounded-xl border">
                <div>
                  <h1 className="text-sm sm:text-base font-extrabold text-gray-900 flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <Sparkles className="w-4 h-4 text-red-600" />
                    {isRtl ? "مستشار مارسو للذكاء الاصطناعي" : "MARSO SPECIALIST AI MODE"}
                  </h1>
                  <p className="text-slate-500 text-[11px] sm:text-xs mt-0.5">
                    {isRtl
                      ? "مدرب ومبرمج مباشرة بمعايير شركة مارسو لتطبيقات المطاط والهندسة العكسية بمصر."
                      : "Trained directly with Marso Company's chemical compound profiles and Egyptian rubber recycling metrics."}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-100/90 border border-slate-200/60 px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold text-gray-700 font-mono shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                  {t.modelLabel}
                </div>
              </div>

              {/* Chat Window Messages */}
              <div dir={scrollDir} className="flex-1 bg-white/90 backdrop-blur-xs border border-gray-200/90 rounded-xl p-3 sm:p-4 overflow-y-auto min-h-0 mb-3 shadow-2xs">
                <div dir={contentDir} className="w-full min-h-full flex flex-col gap-3.5">
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`bubble ${
                        msg.role === "user" ? "user" : "specialist"
                      } max-w-[90%] sm:max-w-[85%] px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs`}
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
                      <div className="whitespace-pre-wrap font-sans">
                        {msg.content.split("\n").map((line, i) => {
                          let contentToRender: React.ReactNode = line;
                          if (line.includes("**")) {
                            const parts = line.split("**");
                            contentToRender = parts.map((part, index) =>
                              index % 2 === 1 ? (
                                <strong key={index} className={msg.role === "user" ? "font-extrabold text-white underline decoration-red-300" : "font-extrabold text-red-700"}>
                                  {part}
                                </strong>
                              ) : part
                            );
                          }
                          return (
                            <p key={i} className="mb-1 last:mb-0">
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
                    <div className={`bubble specialist max-w-[80%] px-4 py-3 rounded-xl bg-slate-100 text-slate-600 flex items-center gap-2.5 border border-slate-200 ${isRtl ? "self-end" : "self-start"}`}>
                      <Loader2 className="w-4 h-4 text-red-600 animate-spin shrink-0" />
                      <span className="text-xs font-semibold animate-pulse tracking-wide font-mono">{t.analyzingLibrary}</span>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>
              </div>

              {/* Chat Quick Chips */}
              <div className="shrink-0 mb-3">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 block mb-1.5 px-0.5">
                  {t.frequentlyAsked}
                </span>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none snap-x -mx-1 px-1">
                  {CHIP_TRANSLATIONS.map((chip, idx) => (
                    <button
                      id={`chat-chip-${idx}`}
                      key={idx}
                      onClick={() => handleSendChatMessage(lang === "ar" ? chip.promptAr : chip.promptEn)}
                      className="snap-start cursor-pointer shrink-0 px-3 py-1.5 text-[11px] bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-200 active:bg-red-100 border border-gray-200 text-gray-700 rounded-full font-semibold transition-all shadow-2xs text-right"
                    >
                      {chip[lang]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pinned Chat Input Bar */}
              <div className="shrink-0 sticky bottom-0 z-20 w-full bg-white border border-gray-300 focus-within:border-red-600 focus-within:ring-2 focus-within:ring-red-100 rounded-xl p-1.5 sm:p-2 flex items-center gap-2 shadow-md transition-all">
                <input
                  id="chat-input-bar"
                  type="text"
                  placeholder={t.chatInputPlaceholder}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChatMessage();
                    }
                  }}
                  className={`w-full min-w-0 flex-1 bg-transparent border-0 px-2.5 py-1 text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none font-sans ${isRtl ? "text-right" : "text-left"}`}
                />
                <button
                  id="chat-send-btn"
                  onClick={() => handleSendChatMessage()}
                  disabled={isSendingChat || !chatInput.trim()}
                  className="cursor-pointer bg-[#B91C1C] hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3.5 py-2 rounded-lg active:scale-95 transition-all shadow-sm shrink-0 flex items-center justify-center gap-1.5 font-mono text-xs font-bold"
                  title={isRtl ? "إرسال الاستفسار" : "Send message"}
                >
                  <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline font-sans">{isRtl ? "إرسال" : "Send"}</span>
                </button>
              </div>
            </div>
          )}
        </main>

        {/* COLUMN 3: RIGHT SELECTIVE SPECS VIEWPORT (Permanent split view on widescreen desktop) */}
        <aside dir={scrollDir} className="bg-white/50 backdrop-blur-xs border-l border-r border-gray-200/60 p-5 overflow-y-auto hidden xl:flex xl:flex-col xl:w-[320px] shrink-0">
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
                        className="w-full h-full object-cover opacity-80 cursor-pointer hover:opacity-100 transition-opacity"
                        onClick={() => setActiveLightboxImage(selectedProduct.photo)}
                        title={isRtl ? "انقر لتكبير الصورة" : "Click to enlarge photo"}
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
                      {(selectedProduct.specs?.price || selectedProduct.price) && (
                        <div className="flex justify-between items-start gap-4 py-2 border-b border-red-100 bg-red-50/60 px-2 rounded-md my-1 text-xs">
                          <span className="text-red-700 font-extrabold shrink-0 text-start">{isRtl ? "السعر التقديري" : "Estimated Rate"}</span>
                          <span className="text-red-600 font-black text-end font-sans">
                            {selectedProduct.specs?.price || selectedProduct.price} <span className="text-[10px] font-mono text-red-500">{selectedProduct.specs?.priceCurrency || selectedProduct.priceCurrency || "EGP"}</span>
                          </span>
                        </div>
                      )}
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
                        <div 
                          key={i} 
                          onClick={() => setActiveLightboxImage(url)}
                          className="h-20 rounded-lg overflow-hidden border border-gray-100 shadow-3xs relative group bg-gray-50 cursor-pointer"
                          title={isRtl ? "انقر لتكبير الرسم الفني" : "Click to view full photo"}
                        >
                          <img 
                            src={url} 
                            alt={`Extra spec photo ${i + 1}`} 
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                            <span className="px-2 py-1 bg-white/95 text-gray-900 text-[9px] font-bold rounded shadow-xs flex items-center gap-1">
                              <Maximize2 className="w-3 h-3 text-red-600" />
                              {isRtl ? "تكبير" : "Zoom"}
                            </span>
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
                    <Key className="w-3.5 h-3.5" />
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
        {isMobileDetailsOpen && selectedProduct && activeSelectedProductLocalizedInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setIsMobileDetailsOpen(false)}
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
                  onClick={() => setIsMobileDetailsOpen(false)}
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
                        className="w-full h-full object-cover opacity-90 cursor-pointer hover:opacity-100 transition-opacity"
                        onClick={() => setActiveLightboxImage(selectedProduct.photo)}
                        title={isRtl ? "انقر لتكبير الصورة" : "Click to enlarge photo"}
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
                      {(selectedProduct.specs?.price || selectedProduct.price) && (
                        <div className="flex justify-between items-start gap-4 py-2 border-b border-red-100 bg-red-50/60 px-2 rounded-md my-1 text-xs">
                          <span className="text-red-700 font-extrabold shrink-0 text-start">{isRtl ? "السعر التقديري" : "Estimated Rate"}</span>
                          <span className="text-red-600 font-black text-end font-sans">
                            {selectedProduct.specs?.price || selectedProduct.price} <span className="text-[10px] font-mono text-red-500">{selectedProduct.specs?.priceCurrency || selectedProduct.priceCurrency || "EGP"}</span>
                          </span>
                        </div>
                      )}
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
                        <div 
                          key={i} 
                          onClick={() => setActiveLightboxImage(url)}
                          className="h-20 rounded-lg overflow-hidden border border-gray-100 shadow-3xs relative group bg-gray-50 cursor-pointer"
                          title={isRtl ? "انقر لتكبير الرسم الفني" : "Click to view full photo"}
                        >
                          <img 
                            src={url} 
                            alt={`Extra spec photo ${i + 1}`} 
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                            <span className="px-2 py-1 bg-white/95 text-gray-900 text-[9px] font-bold rounded shadow-xs flex items-center gap-1">
                              <Maximize2 className="w-3 h-3 text-red-600" />
                              {isRtl ? "تكبير" : "Zoom"}
                            </span>
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
                    <Key className="w-3.5 h-3.5" />
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

      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categoriesList}
        products={products}
        lang={lang}
        onAddCategory={handleAddCategory}
        onEditCategory={handleEditCategory}
        onDeleteCategory={handleDeleteCategory}
        onClearUnusedCategories={handleClearUnusedCategories}
      />

      {/* FULLSCREEN IMAGE LIGHTBOX POPUP MODAL */}
      <AnimatePresence>
        {activeLightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-4 sm:p-6 cursor-pointer select-none"
            onClick={() => setActiveLightboxImage(null)}
          >
            {/* Top Close Button & Instruction Bar */}
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-3 z-10">
              <span className="hidden sm:inline-block px-3 py-1 bg-white/10 text-white/80 rounded-full text-xs font-medium backdrop-blur-md border border-white/10">
                {isRtl ? "إضغط في أي مكان للخروج" : "Click anywhere outside to close"}
              </span>
              <button
                onClick={() => setActiveLightboxImage(null)}
                className="p-2.5 bg-white/15 hover:bg-white/30 text-white rounded-full transition-all cursor-pointer border border-white/20 shadow-lg"
                title={isRtl ? "إغلاق" : "Close"}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Lightbox Image Container */}
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.88, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative max-w-[95vw] max-h-[85vh] sm:max-h-[88vh] rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-neutral-950 flex items-center justify-center p-2"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={activeLightboxImage}
                alt="Full size specification document"
                className="max-w-full max-h-[80vh] sm:max-h-[85vh] object-contain rounded-xl"
                referrerPolicy="no-referrer"
              />
            </motion.div>

            <span className="sm:hidden mt-4 px-3 py-1 bg-white/10 text-white/80 rounded-full text-[11px] font-medium backdrop-blur-md border border-white/10">
              {isRtl ? "إضغط في أي مكان للخروج" : "Click anywhere outside to close"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>



      {/* Admin Authentication Modal */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onLoginSuccess={handleAdminLoginSuccess}
        isRtl={isRtl}
      />

      {/* Sales Contact Card Modal */}
      <ContactCardModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        product={contactModalProduct}
        lang={lang}
      />

      {/* Access Code Verification Modal */}
      <AccessCodeModal
        isOpen={isAccessCodeModalOpen}
        onClose={() => setIsAccessCodeModalOpen(false)}
        onSuccessUnlock={() => {
          const prod = pendingDownloadProduct || selectedProduct;
          if (prod) performDownloadSpec(prod);
        }}
        onRequestContact={() => {
          setContactModalProduct(pendingDownloadProduct || selectedProduct);
          setIsContactModalOpen(true);
        }}
        product={pendingDownloadProduct || selectedProduct}
        lang={lang}
      />

      {/* Admin Sales OTP Code Generator Modal */}
      <AdminCodeGeneratorModal
        isOpen={isAdminCodeGeneratorOpen}
        onClose={() => setIsAdminCodeGeneratorOpen(false)}
        isAr={isRtl}
      />
    </div>
  );
}
