export type Language = "ar" | "en";

export interface TranslationSchema {
  dir: "rtl" | "ltr";
  companyName: string;
  companySubName: string;
  specialistCenter: string;
  specCatalog: string;
  aiConsultant: string;
  isoStandards: string;
  categories: string;
  allClassifications: string;
  askSpecialist: string;
  corporateDetails: string;
  originOfRubber: string;
  completeTechnicalSpecs: string;
  ourProducts: string;
  managingAndConsulting: string;
  searchPlaceholder: string;
  registerSpec: string;
  viewTechnicalSpecs: string;
  hardness: string;
  temperature: string;
  tensileStrength: string;
  additional: string;
  viewFullProfile: string;
  editProduct: string;
  deleteProduct: string;
  selectedProductProfile: string;
  chemicalCompatibility: string;
  passedStandard: string;
  engineeredFeatures: string;
  requestQuote: string;
  downloadDataSheet: string;
  noProductSelected: string;
  noProductSelectedDesc: string;
  ecoFriendlyHeader: string;
  ecoFriendlyDesc: string;
  filterClassifications: string;
  connectingDb: string;
  noMatchFound: string;
  noMatchFoundDesc: string;
  clearFilters: string;
  frequentlyAsked: string;
  chatInputPlaceholder: string;
  modelLabel: string;
  analyzingLibrary: string;
  welcomeMessage: string;
  confirmDelete: string;
  addSuccess: string;
  updateSuccess: string;
  deleteSuccess: string;
  loadFail: string;
  networkError: string;
  saveFail: string;
  systemInterrupted: string;
  cancel: string;
  saveSpec: string;
  productNameLabel: string;
  productNameRequired: string;
  selectCategoryLabel: string;
  illustrationPhotoLabel: string;
  presetBackgroundLabel: string;
  additionalNotesLabel: string;
  allClasses: string;
  inStock: string;
  isoCompliant: string;
  customProductTitle: string;
  customProductSpecs: string;
  editEntryTitle: string;
  registerNewEntryTitle: string;
  manageCategories: string;
  addCategory: string;
  editCategory: string;
  clearUnusedCategories: string;
  categoryNamePlaceholder: string;
  categoryAdded: string;
  categoryUpdated: string;
  categoryDeleted: string;
  categoriesCleared: string;
  confirmDeleteCategory: string;
  priceLabel: string;
  currencyLabel: string;
  pricePlaceholder: string;
}

export const TRANSLATIONS: Record<Language, TranslationSchema> = {
  ar: {
    dir: "rtl",
    companyName: "MARSO",
    companySubName: "شركة مارسو (أصل صناعات وأرضيات المطاط)",
    specialistCenter: "MARSO DIGITAL CATALOG",
    specCatalog: "دليل المنتجات",
    aiConsultant: "المستشار الذكي AI",
    isoStandards: "شهادات الأيزو 9001 | 14001 | 45001",
    categories: "التصنيفات الفنية",
    allClassifications: "جميع التصنيفات",
    askSpecialist: "استشارة الخبير الذكي",
    corporateDetails: "بيانات الشركة",
    originOfRubber: "أصل صناعة المطاط",
    completeTechnicalSpecs: "المواصفات الفنية الكاملة",
    ourProducts: "منتجاتنا",
    managingAndConsulting: "إدارة واستعراض مواصفات المطاط الصديق للبيئة والمعاد تدويره من شركة مارسو.",
    searchPlaceholder: "البحث",
    registerSpec: "تسجيل منتج جديد",
    viewTechnicalSpecs: "عرض المواصفات التقنية",
    hardness: "درجة الصلابة (Shore A)",
    temperature: "مقاومة الحرارة",
    tensileStrength: "قوة الشد (Tensile)",
    additional: "تفاصيل وتطبيقات إضافية",
    viewFullProfile: "عرض الملف التقني الكامل",
    editProduct: "تعديل المواصفة",
    deleteProduct: "حذف المواصفة",
    selectedProductProfile: "ملف المنتج المحدد",
    chemicalCompatibility: "الملائمة الكيميائية",
    passedStandard: "مطابق للمواصفات الفنية المعتمدة",
    engineeredFeatures: "الميزات الهندسية والتطبيقية",
    requestQuote: "طلب عرض سعر وكود تحميل المواصفات",
    downloadDataSheet: "تحميل ورقة المواصفات الفنية",
    noProductSelected: "لم يتم اختيار منتج",
    noProductSelectedDesc: "اختر منتجًا من كتالوج قاعدة البيانات لعرض خصائصه الميكانيكية، وطلب الرسومات الفنية، وتصدير شهادات المطابقة.",
    ecoFriendlyHeader: "الالتزام البيئي الصارم",
    ecoFriendlyDesc: "نساهم في تنظيف البيئة المصرية بإعادة تدوير آلاف الأطنان من إطارات السيارات الخردة سنوياً وتحويلها لأرضيات مطاطية هندسية فائقة الجودة.",
    filterClassifications: "تصفية حسب التصنيف الهندسي:",
    connectingDb: "جاري الاتصال بقاعدة بيانات المواصفات...",
    noMatchFound: "لم يتم العثور على نتائج تطابق هذا البحث",
    noMatchFoundDesc: "يرجى تغيير تصنيف الفلتر، أو مسح نص البحث، أو إضافة وتسجيل هذه المواصفة الجديدة مباشرة في النظام!",
    clearFilters: "إعادة تعيين الفلاتر",
    frequentlyAsked: "الأسئلة الفنية والهندسية الشائعة:",
    chatInputPlaceholder: "اسأل خبير مارسو عن مواصفات EPDM، العزل الكهربائي، مواصفات الأيزو 14001 أو الهندسة العكسية...",
    modelLabel: "الذكاء الاصطناعي: جيميناي 3.5 فلاش",
    analyzingLibrary: "جاري تحليل المكتبة الكيميائية لمارسو...",
    welcomeMessage: "مرحباً بكم في منصة الاستشارات الفنية لشركة مارسو للمطاط (MARSO). أنا مستشارك الفني الذكي. اسألني عن درجات صلابة المطاط (Shore A)، المقاومة الكيميائية والحرارية، أو تركيبات المواد المخصصة. كيف يمكننا مساعدتك في تحقيق متطلباتك الهندسية اليوم؟",
    confirmDelete: "هل أنت متأكد تماماً من رغبتك في حذف مواصفة هذا المنتج الفني نهائياً من قاعدة البيانات؟",
    addSuccess: "تم تسجيل مواصفة المنتج بنجاح بنظام مارسو الكتالوجي",
    updateSuccess: "تم تحديث البيانات والمواصفات الفنية للمنتج بنجاح",
    deleteSuccess: "تم إزالة المواصفة الفنية للمنتج من قاعدة البيانات نهائياً",
    loadFail: "فشل تحميل منتجات الكتالوج من الخادم",
    networkError: "خطأ في الشبكة أثناء الاتصال بخوادم مارسو.",
    saveFail: "فشل حفظ مواصفة المنتج في قاعدة البيانات",
    systemInterrupted: "⚠️ انقطع الاتصال بنظام الذكاء الاصطناعي الفني لمارسو. يرجى التأكد من ملء مفتاح GEMINI_API_KEY في إعدادات لوحة التحكم، أو المحاولة مرة أخرى لاحقاً.",
    cancel: "إلغاء",
    saveSpec: "حفظ مواصفة المنتج",
    productNameLabel: "اسم المنتج الفني *",
    productNameRequired: "اسم المنتج مطلوب ومهم جداً.",
    selectCategoryLabel: "التصنيف الهندسي للمنتج *",
    illustrationPhotoLabel: "رابط صورة توضيحية للمواصفة *",
    presetBackgroundLabel: "أو اختر صورة احترافية جاهزة للمنتج:",
    additionalNotesLabel: "المواصفات الخاصة وملاحظات التطبيق الإضافية",
    allClasses: "جميع المنتجات",
    inStock: "متوفر بالمخزون الفني",
    isoCompliant: "معتمد الأيزو لمارسو",
    customProductTitle: "منتج مخصص بالهندسة العكسية",
    customProductSpecs: "مواصفات مصممة هندسياً بناءً على طلب العميل والرسومات الفنية",
    editEntryTitle: "تعديل تفاصيل المنتج",
    registerNewEntryTitle: "تسجيل منتج مطاطي جديد في الكتالوج",
    manageCategories: "إدارة التصنيفات",
    addCategory: "إضافة تصنيف جديد",
    editCategory: "تعديل اسم التصنيف",
    clearUnusedCategories: "مسح التصنيفات الفارغة (0 منتج)",
    categoryNamePlaceholder: "أدخل اسم التصنيف الفني...",
    categoryAdded: "تمت إضافة التصنيف بنجاح",
    categoryUpdated: "تم تحديث التصنيف بنجاح",
    categoryDeleted: "تم حذف التصنيف",
    categoriesCleared: "تم مسح جميع التصنيفات الفارغة بنجاح",
    confirmDeleteCategory: "هل أنت تأكد من رغبتك في حذف هذا التصنيف؟",
    priceLabel: "السعر والتقدير المالي (اختياري)",
    currencyLabel: "العملة",
    pricePlaceholder: "مثال: 250 / متر مربع أو حسب الرسم الهندسي..."
  },
  en: {
    dir: "ltr",
    companyName: "MARSO",
    companySubName: "Marso Company (Origin of Rubber Industries and Floors)",
    specialistCenter: "MARSO DIGITAL CATALOG",
    specCatalog: "PRODUCT CATALOG",
    aiConsultant: "AI CONSULTANT",
    isoStandards: "ISO 9001 | 14001 | 45001 STANDARDS",
    categories: "Categories",
    allClassifications: "All Classifications",
    askSpecialist: "Consult AI Specialist",
    corporateDetails: "Corporate Details",
    originOfRubber: "Origin of Rubber",
    completeTechnicalSpecs: "Our Products",
    ourProducts: "Our Products",
    managingAndConsulting: "Managing and consulting Marso Company's core eco-friendly tire-recycled rubber innovations.",
    searchPlaceholder: "البحث",
    registerSpec: "Register New Product",
    viewTechnicalSpecs: "View Technical Specs",
    hardness: "Hardness (Shore A)",
    temperature: "Temp Resistance",
    tensileStrength: "Tensile Strength",
    additional: "Additional Details & Applications",
    viewFullProfile: "View Full Profile",
    editProduct: "Edit Product",
    deleteProduct: "Delete Product",
    selectedProductProfile: "Selected Product Profile",
    chemicalCompatibility: "Compatibility",
    passedStandard: "Meets certified engineering safety guidelines",
    engineeredFeatures: "Engineered Features",
    requestQuote: "REQUEST QUOTE & GET DATA ACCESS",
    downloadDataSheet: "DOWNLOAD SPEC DATA SHEET",
    noProductSelected: "No product selected",
    noProductSelectedDesc: "Select a product from the database catalog to view mechanical specs, request official drawings, and export compliance profiles.",
    ecoFriendlyHeader: "Eco-Friendly Mandate",
    ecoFriendlyDesc: "We clean Egyptian environments by recycling thousands of scrap tires annually into elite, certifiable elastomeric safety flooring.",
    filterClassifications: "Filter Classifications Category:",
    connectingDb: "Connecting to spec storage...",
    noMatchFound: "No match found in current catalog category",
    noMatchFoundDesc: "Try resetting your category filter, clearing your search input, or register this specification directly!",
    clearFilters: "Clear Filters",
    frequentlyAsked: "Frequently Asked technical questions:",
    chatInputPlaceholder: "Ask specified questions about EPDM, elastomeric sheets, cow mats, or ISO 14001 specifications...",
    modelLabel: "MODEL: GEMINI 3.5 FLASH",
    analyzingLibrary: "Analyzing compound library...",
    welcomeMessage: "Welcome to the MARSO RUBBER Technical Intelligence Console. I am your specialized product consultant. Ask me anything about rubber hardness (Shore A), chemical compatibility, temperature resistance, or custom compound formulations. How can we optimize your engineering requirements today?",
    confirmDelete: "Are you absolutely sure you want to delete this technical product specification?",
    addSuccess: "Registered new specification successfully",
    updateSuccess: "Successfully updated configuration",
    deleteSuccess: "Product entry has been removed from catalog.",
    loadFail: "Failed to load catalog products",
    networkError: "Network error connecting to products database.",
    saveFail: "Failed to save product database entry",
    systemInterrupted: "⚠️ System Communication Interrupted: We encountered an error contacting the MARSO Special Intelligence unit. Please ensure your GEMINI_API_KEY is configured in the AI Studio panel or try again shortly.",
    cancel: "Cancel",
    saveSpec: "Save Product Specification",
    productNameLabel: "Product Name *",
    productNameRequired: "Product Name is highly required.",
    selectCategoryLabel: "Product Classification category *",
    illustrationPhotoLabel: "Product Illustration Photo URL *",
    presetBackgroundLabel: "OR QUICK SELECT PREMIUM PRESET BACKGROUND IMAGE:",
    additionalNotesLabel: "Special Specifications & Additional Application Notes",
    allClasses: "All Classes",
    inStock: "IN STOCK",
    isoCompliant: "ISO COMPLIANT",
    customProductTitle: "Custom Reverse Engineered Rubber Component",
    customProductSpecs: "Molded or compound configured exactly matching user request.",
    editEntryTitle: "Edit Product Detail",
    registerNewEntryTitle: "Register New Rubber Product Entry",
    manageCategories: "Manage Classifications",
    addCategory: "Add Classification",
    editCategory: "Edit Classification",
    clearUnusedCategories: "Clear Unused Classifications (0 Products)",
    categoryNamePlaceholder: "Enter classification name...",
    categoryAdded: "Classification added successfully",
    categoryUpdated: "Classification updated successfully",
    categoryDeleted: "Classification deleted",
    categoriesCleared: "All unused classifications cleared successfully",
    confirmDeleteCategory: "Are you sure you want to delete this classification?",
    priceLabel: "Unit Price / Financial Rate (Optional)",
    currencyLabel: "Currency",
    pricePlaceholder: "e.g. 250 / sq.m or per drawing sample..."
  }
};

// Map original database classifications to Arabic translation titles
export const CATEGORY_TRANSLATIONS: Record<string, Record<Language, string>> = {
  "Reclaimed and Crumb Rubber": {
    en: "Reclaimed and Crumb Rubber",
    ar: "المطاط المجدد والحبيبات"
  },
  "Rubber Tile Flooring": {
    en: "Rubber Tile Flooring",
    ar: "بلاط الأرضيات المطاطية"
  },
  "Rubber Mat Flooring": {
    en: "Rubber Mat Flooring",
    ar: "حصائر الأرضيات المطاطية"
  },
  "Industrial Rubber Flooring": {
    en: "Industrial Rubber Flooring",
    ar: "الأرضيات المطاطية الصناعية"
  },
  "Rubber Automotive Spare Parts": {
    en: "Rubber Automotive Spare Parts",
    ar: "قطع غيار السيارات المطاطية"
  },
  "Rubber Car Mats": {
    en: "Rubber Car Mats",
    ar: "دواسات السيارات المطاطية"
  },
  "Constructive Rubber Industries": {
    en: "Constructive Rubber Industries",
    ar: "الصناعات المطاطية الإنشائية"
  },
  "Reverse Engineering": {
    en: "Reverse Engineering",
    ar: "الهندسة العكسية"
  }
};

export const CHIP_TRANSLATIONS: Array<{ en: string; ar: string; promptEn: string; promptAr: string }> = [
  {
    en: "High-Temperature Gaskets",
    ar: "جوانات درجات الحرارة العالية",
    promptEn: "What compound do you recommend for gasket seals operating continuously at 200 degrees Celsius?",
    promptAr: "ما هو مركب المطاط الأساسي الذي تنصح به لتصنيع قطع الجوانات التي تعمل بشكل مستمر في درجة حرارة 200 مئوية؟"
  },
  {
    en: "SBR vs. Neoprene",
    ar: "الفرق بين SBR والنيوبرين",
    promptEn: "Explain the main performance differences between SBR and Neoprene pads for building facade support joints.",
    promptAr: "اشرح الفروق الجوهرية في الأداء وعوامل التحمل بين مواد SBR ومواد نيوبرين في وسائد فواصل المباني."
  },
  {
    en: "Reverse Engineering",
    ar: "الهندسة العكسية للمطاط",
    promptEn: "How does MARSO reverse engineer rubber parts from an existing worn physical sample?",
    promptAr: "كيف تقوم شركة مارسو للمطاط بإعادة تصنيع قطع الغيار المطاطية للمصانع والسيارات بطريقة الهندسة العكسية اعتماداً على عينة مستهلكة؟"
  },
  {
    en: "Electrical Safety Flooring",
    ar: "أرضيات العزل الكهربائي",
    promptEn: "What electrical-insulating flooring products do you recommend for a 30kV power station?",
    promptAr: "ما هي مواصفات أرضيات العزل الكهربائي اللازمة لتركيبها في غرف المفاتيح الكهربائية التي تصل جهدها إلى 30 كيلو فولت؟"
  }
];

export const STATIC_PRODUCT_TRANSLATIONS: Record<string, { nameAr: string; specsAr: string; additionalAr: string }> = {
  "Reclem Premium Grade / Generato": {
    nameAr: "مطاط مستصلح نخب أول / جينيراتو",
    specsAr: "الصلابة: 55-65 شور أ | الحرارة: -30 وحتى +90 مئوية",
    additionalAr: "مشتق صديق للبيئة من إطارات السيارات المعاد تدويرها. ممتاز لخلطه لإنتاج بلاطات فاخرة أو دواسات سيارات متينة."
  },
  "MARSO Sound-Absorbing Gym Tiles": {
    nameAr: "بلاط مارسو الرياضي الماص للصوت والاهتزاز",
    specsAr: "الصلابة: 60-65 شور أ | الحرارة: -20 وحتى +80 مئوية",
    additionalAr: "يتكون من حبيبات الترتان المرنة، تصميم ممتص للصدمات ومانع للانزلاق ومقاوم لانتشار الحريق ومثالي للصالات الرياضية الكبرى."
  },
  "Heavy Duty Equestrian Stable Mats": {
    nameAr: "حصائر الاسطبلات ومزارع الأبقار فائقة التحمل",
    specsAr: "الصلابة: 70-75 شور أ | الحرارة: -25 وحتى +100 مئوية",
    additionalAr: "مزيج مطاط SBR ومطاط طبيعي مصمم بنقوش بارزة تمنع انزلاق الخيول والماشية ومقاومة لنمو البكتيريا وسهلة التنظيف."
  },
  "MARSO High-Voltage Insulating Sheet": {
    nameAr: "لوح مارسو المطاطي العازل للكهرباء والجهد العالي",
    specsAr: "الصلابة: 60 شور أ | الحرارة: -40 وحتى +110 مئوية",
    additionalAr: "تم اختباره واعتماده حتى 30 كيلوفولت للأمان التام. حماية إلزامية لغرف المولدات والمحطات والمحولات الكهربائية لتأمين الأرواح المارة."
  },
  "Anti-Vibration Machine Damper Mounts": {
    nameAr: "قواعد تثبيت مانعة للاهتزاز لمولدات المصانع والسيارات",
    specsAr: "الصلابة: 50-70 شور أ | الحرارة: -40 وحتى +120 مئوية",
    additionalAr: "مدعمة بحديد صلب داخلي مجلفن. مصنوعة من مركب النتريل (NBR) لمقاومة الزيوت والشحوم الهيدروليكية والمذيبات البترولية."
  },
  "All-Weather Deep-Groove Floor Liner": {
    nameAr: "دواسات سيارات مارسو العميقة المقاومة للعوامل الجوية",
    specsAr: "الصلابة: 60 شور أ | الحرارة: -35 وحتى +85 مئوية",
    additionalAr: "دواسات مجهزة ببروز مانعة للانزلاق في أرضيات السيارات لضمان الثبات والمقاومة الكلية للمياه والأطيان الشتوية لسيارات الركوب."
  },
  "Structural Bridge Rubber Bearing Pads": {
    nameAr: "ركائز الكباري المطاطية الإنشائية المسلحة بالصلب",
    specsAr: "الصلابة: 60 شور أ | الحرارة: -30 وحتى +70 مئوية",
    additionalAr: "مصممة ومطابقة للمواصفة القياسية الأوروبية EN 1337-3. تستحمل الأحمال العالية لحركة الكباري وفواصل تمدد الواجهات الزجاجية."
  },
  "Custom Reverse Engineered Rubber Component": {
    nameAr: "قطعة غيار مطاطية مخصصة بالهندسة العكسية لمعامل مارسو",
    specsAr: "حسب رغبة وسحب المهندس | درجات حرارة متغيرة وصياغة لمركب السيليكون أو الفيتون",
    additionalAr: "تتميز مارسو بقدرة هندسية استثنائية على فك ونسخ وعمل قالب لأي قطعة مطاطية مستهلكة أو عازل خاص بناءً على عينة فيزيائية مرسلة."
  }
};

export const COMMON_TERMS_TRANSLATIONS: Record<string, Record<Language, string>> = {
  // Materials
  "Recycled SBR": { en: "Recycled SBR", ar: "مطاط SBR المعاد تدويره" },
  "SBR Granules & Polyurethane Binder": { en: "SBR Granules & Polyurethane Binder", ar: "حبيبات SBR ورابط البولي يوريثان" },
  "Heavy-duty SBR": { en: "Heavy-duty SBR", ar: "مطاط SBR فائق التحمل" },
  "Natural Rubber Compound": { en: "Natural Rubber Compound", ar: "مركب المطاط الطبيعي" },
  "NBR (Nitrile)": { en: "NBR (Nitrile)", ar: "مطاط النتريل (NBR)" },
  "TPE / Synthetic Rubber": { en: "TPE / Synthetic Rubber", ar: "مطاط TPE / مطاط صناعي" },
  "Neoprene (Chloroprene)": { en: "Neoprene (Chloroprene)", ar: "نيوبرين (كلوروبرين)" },
  "NBR, EPDM, Silicone, Viton, Neoprene": { en: "NBR, EPDM, Silicone, Viton, Neoprene", ar: "NBR ، EPDM ، سيليكون ، فيتون ، نيوبرين" },
  "Standard": { en: "Standard", ar: "قياسي" },
  "Natural & Synthetic Rubber Blend": { en: "Natural & Synthetic Rubber Blend", ar: "مزيج المطاط الطبيعي والصناعي" },
  "SBR Rubber": { en: "SBR Rubber", ar: "مطاط SBR" },

  // Colors
  "Black": { en: "Black", ar: "أسود" },
  "Black with Red Flecks": { en: "Black with Red Flecks", ar: "أسود مع حبيبات حمراء" },
  "Grey": { en: "Grey", ar: "رمادي" },
  "Dark Grey": { en: "Dark Grey", ar: "رمادي غامق" },
  "Black / Dark Grey": { en: "Black / Dark Grey", ar: "أسود / رمادي غامق" },
  "Custom": { en: "Custom", ar: "مخصص" },
  "Custom (Black, Red, Translucent)": { en: "Custom (Black, Red, Translucent)", ar: "مخصص (أسود، أحمر، شفاف)" },

  // Applications
  "Tartan tracks, rubber tiles, infill for artificial turf": { en: "Tartan tracks, rubber tiles, infill for artificial turf", ar: "تراك الترتان، البلاط المطاطي، حشو العشب الصناعي" },
  "Commercial gyms, weightlifting areas, crossfit boxes": { en: "Commercial gyms, weightlifting areas, crossfit boxes", ar: "صالات الجيم التجارية، مناطق رفع الأثقال، صالات الكروس فت" },
  "Horse stables, dairy cow stalls, veterinary clinics": { en: "Horse stables, dairy cow stalls, veterinary clinics", ar: "اسطبلات الخيول، حظائر الأبقار الحلوب، العيادات البيطرية" },
  "Electrical switchboard rooms, substation floors": { en: "Electrical switchboard rooms, substation floors", ar: "غرف اللوحات الكهربائية، أرضيات المحطات الفرعية" },
  "Engine mounts, generator bases, heavy machinery dampers": { en: "Engine mounts, generator bases, heavy machinery dampers", ar: "قواعد المحركات، قواعد المولدات، مخمدات الآلات الثقيلة" },
  "Automotive interior protective flooring": { en: "Automotive interior protective flooring", ar: "الأرضيات الواقية للمقصورة الداخلية للسيارات" },
  "Bridge support structures, highway overpasses": { en: "Bridge support structures, highway overpasses", ar: "ركائز دعم الجسور، الجسور العلوية للطرق السريعة" },
  "Obsolete machine parts, custom marine port fenders": { en: "Obsolete machine parts, custom marine port fenders", ar: "قطع الآلات القديمة، مصدات الموانئ البحرية المخصصة" },
  "Covers stable areas, barns, cow stalls, and animal pathways": { en: "Covers stable areas, barns, cow stalls, and animal pathways", ar: "تغطية مناطق الاسطبلات، الحظائر، ممرات الحيوانات" },
  "Shot blasting rooms, parking bumpers, heavy workshops wall protective lining": { en: "Shot blasting rooms, parking bumpers, heavy workshops wall protective lining", ar: "غرف السفع بالخردق، حواجز مواقف السيارات، تبطين ورش العمل الثقيلة" },
  "Optimized": { en: "Optimized", ar: "محسن" },

  // General / Fallbacks
  "N/A": { en: "N/A", ar: "غير متوفر" },
  "N/A / Custom": { en: "N/A / Custom", ar: "غير متوفر / مخصص" }
};

export function translateTerm(term: string, lang: Language): string {
  if (!term) return "";
  const cleanedTerm = term.trim();
  if (COMMON_TERMS_TRANSLATIONS[cleanedTerm]) {
    return COMMON_TERMS_TRANSLATIONS[cleanedTerm][lang];
  }
  return cleanedTerm;
}
