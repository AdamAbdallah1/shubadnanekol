import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// إعدادات مشروع Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDIoVcSZQwj9M9X6kXSVGCiHkELDZvsB2Y",
  authDomain: "shubadnanotlob-7b128.firebaseapp.com",
  databaseURL: "https://shubadnanotlob-7b128-default-rtdb.firebaseio.com",
  projectId: "shubadnanotlob-7b128",
  storageBucket: "shubadnanotlob-7b128.firebasestorage.app",
  messagingSenderId: "137645087727",
  appId: "1:137645087727:web:00c0099090e773ab3cf41a",
  measurementId: "G-7E4XSDTN10"
};

// تهيئة Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

const MAX_GALLERY_IMAGES = 20;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

let currentCategoryFilter = "";
let allRestaurants = [];
let allCategories = [];

// ============================================================
// 1. التنقل بين الصفحات (NAVIGATION)
// ============================================================

function showPage(pageId) {
  document.querySelectorAll(".view-page").forEach(page => {
    page.classList.remove("active");
    page.style.display = "none";
  });

  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.add("active");
    targetPage.style.display = "block";
  }

  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.style.display = (pageId === "pageHome") ? "none" : "block";
  }

  window.scrollTo(0, 0);
}

function goBack() {
  showPage("pageHome");
}

function openCategories() {
  showPage("pageCategories");
}

// أدوات مساعدة للتسمية
function createSafeFileName(name) {
  return name.replace(/[^a-zA-Z0-9.-]/g, "_");
}

function createUniqueFileName(originalName) {
  return `${Date.now()}_${originalName}`;
}

// ============================================================
// 2. إدارة الأقسام (CATEGORY MANAGEMENT)
// ============================================================

function resetCategoryForm() {
  const editCatDocId = document.getElementById("editCatDocId");
  const adminCatAr = document.getElementById("adminCatAr");
  const adminCatEn = document.getElementById("adminCatEn");
  const adminCatImg = document.getElementById("adminCatImg");
  const adminCatFile = document.getElementById("adminCatFile");
  const catPreview = document.getElementById("catPreview");
  const categoryFormTitle = document.getElementById("categoryFormTitle");

  if (editCatDocId) editCatDocId.value = "";
  if (adminCatAr) adminCatAr.value = "";
  if (adminCatEn) adminCatEn.value = "";
  if (adminCatImg) adminCatImg.value = "";
  if (adminCatFile) adminCatFile.value = "";

  if (catPreview) {
    catPreview.src = "";
    catPreview.style.display = "none";
  }

  if (categoryFormTitle) categoryFormTitle.innerText = "إضافة / تعديل قسم";
}

async function uploadCategoryIcon(file, categoryId) {
  if (!file) return null;

  if (!file.type.startsWith("image/")) {
    throw new Error(`الملف "${file.name}" ليس صورة.`);
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error(`الملف "${file.name}" أكبر من 5MB.`);
  }

  const uniqueName = createUniqueFileName(createSafeFileName(file.name));
  const storagePath = `category-images/${categoryId}/${uniqueName}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file, { contentType: file.type });
  return await getDownloadURL(storageRef);
}

async function saveCategoryToFirebase() {
  const docId = document.getElementById("editCatDocId")?.value.trim();
  const nameAr = document.getElementById("adminCatAr")?.value.trim();
  const nameEn = document.getElementById("adminCatEn")?.value.trim();
  const manualImgUrl = document.getElementById("adminCatImg")?.value.trim();
  const catFile = document.getElementById("adminCatFile")?.files?.[0];

  if (!nameAr || !nameEn) {
    alert("يرجى إدخال اسم القسم بالعربي والإنجليزي");
    return;
  }

  try {
    let finalImgUrl = manualImgUrl || "";

    if (catFile) {
      const tempId = docId || "temp_" + Date.now();
      finalImgUrl = await uploadCategoryIcon(catFile, tempId);
    }

    const catData = {
      nameAr,
      nameEn,
      imgUrl: finalImgUrl || "https://via.placeholder.com/300"
    };

    if (docId) {
      await updateDoc(doc(db, "categories", docId), catData);
      alert("تم تحديث القسم بنجاح!");
    } else {
      await addDoc(collection(db, "categories"), catData);
      alert("تمت إضافة القسم بنجاح!");
    }

    resetCategoryForm();
  } catch (err) {
    console.error(err);
    alert("حدث خطأ أثناء حفظ القسم: " + err.message);
  }
}

function editCategory(id) {
  const cat = allCategories.find(c => c.id === id);
  if (!cat) return;

  document.getElementById("editCatDocId").value = cat.id;
  document.getElementById("adminCatAr").value = cat.nameAr || "";
  document.getElementById("adminCatEn").value = cat.nameEn || "";
  document.getElementById("adminCatImg").value = cat.imgUrl || "";
  document.getElementById("categoryFormTitle").innerText = "تعديل القسم: " + cat.nameAr;
}

async function deleteCategory(id) {
  if (confirm("هل أنت تأكد من رغبتك في حذف هذا القسم؟")) {
    try {
      await deleteDoc(doc(db, "categories", id));
      alert("تم حذف القسم بنجاح");
    } catch (err) {
      alert("حدث خطأ أثناء الحذف: " + err.message);
    }
  }
}

// ============================================================
// 3. إدارة المطاعم (RESTAURANT MANAGEMENT)
// ============================================================

function resetAdminForm() {
  const fields = ["editDocId", "adminName", "adminDesc", "adminRating", "adminBgUrl", "adminLogo", "adminGallery", "adminPhone", "adminMenu", "adminMap"];
  fields.forEach(f => {
    const el = document.getElementById(f);
    if (el) el.value = "";
  });

  document.getElementById("adminOpenTime").value = "10:00";
  document.getElementById("adminCloseTime").value = "23:00";

  ["bgPreview", "logoPreview"].forEach(p => {
    const img = document.getElementById(p);
    if (img) { img.src = ""; img.style.display = "none"; }
  });

  const galPrev = document.getElementById("galleryPreview");
  if (galPrev) galPrev.innerHTML = "";

  document.getElementById("formTitle").innerText = "إضافة مطعم جديد";
}

async function uploadSingleImage(file, folderPath) {
  if (!file) return null;
  const uniqueName = createUniqueFileName(createSafeFileName(file.name));
  const storagePath = `${folderPath}/${uniqueName}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file, { contentType: file.type });
  return await getDownloadURL(storageRef);
}

async function saveRestaurantToFirebase() {
  const docId = document.getElementById("editDocId")?.value.trim();
  const category = document.getElementById("adminCategory")?.value;
  const name = document.getElementById("adminName")?.value.trim();
  const desc = document.getElementById("adminDesc")?.value.trim();
  const rating = document.getElementById("adminRating")?.value.trim() || "4.8";
  const openTime = document.getElementById("adminOpenTime")?.value;
  const closeTime = document.getElementById("adminCloseTime")?.value;

  let bgUrl = document.getElementById("adminBgUrl")?.value.trim();
  let logoUrl = document.getElementById("adminLogo")?.value.trim();
  let galleryStr = document.getElementById("adminGallery")?.value.trim();
  let galleryUrls = galleryStr ? galleryStr.split(",").map(s => s.trim()).filter(Boolean) : [];

  const bgFile = document.getElementById("adminBgFile")?.files?.[0];
  const logoFile = document.getElementById("adminLogoFile")?.files?.[0];
  const galleryFiles = document.getElementById("adminGalleryFiles")?.files;

  if (!name || !category) {
    alert("يرجى تعبئة اسم المطعم واختيار القسم على الأقل");
    return;
  }

  try {
    const tempFolder = docId || "rest_" + Date.now();

    if (bgFile) {
      bgUrl = await uploadSingleImage(bgFile, `restaurants/${tempFolder}/bg`);
    }
    if (logoFile) {
      logoUrl = await uploadSingleImage(logoFile, `restaurants/${tempFolder}/logo`);
    }
    if (galleryFiles && galleryFiles.length > 0) {
      for (let i = 0; i < Math.min(galleryFiles.length, MAX_GALLERY_IMAGES); i++) {
        const url = await uploadSingleImage(galleryFiles[i], `restaurants/${tempFolder}/gallery`);
        if (url) galleryUrls.push(url);
      }
    }

    const restData = {
      category,
      name,
      desc,
      rating: parseFloat(rating) || 4.8,
      openTime,
      closeTime,
      bgUrl: bgUrl || "https://via.placeholder.com/600x300",
      logoUrl: logoUrl || "https://via.placeholder.com/150",
      gallery: galleryUrls,
      phone: document.getElementById("adminPhone")?.value.trim() || "",
      menu: document.getElementById("adminMenu")?.value.trim() || "",
      map: document.getElementById("adminMap")?.value.trim() || ""
    };

    if (docId) {
      await updateDoc(doc(db, "restaurants", docId), restData);
      alert("تم تعديل المطعم بنجاح!");
    } else {
      await addDoc(collection(db, "restaurants"), restData);
      alert("تمت إضافة المطعم بنجاح!");
    }

    resetAdminForm();
  } catch (err) {
    console.error(err);
    alert("حدث خطأ أثناء حفظ المطعم: " + err.message);
  }
}

function editRestaurant(id) {
  const r = allRestaurants.find(item => item.id === id);
  if (!r) return;

  document.getElementById("editDocId").value = r.id;
  document.getElementById("adminCategory").value = r.category || "";
  document.getElementById("adminName").value = r.name || "";
  document.getElementById("adminDesc").value = r.desc || "";
  document.getElementById("adminRating").value = r.rating || 4.8;
  document.getElementById("adminOpenTime").value = r.openTime || "10:00";
  document.getElementById("adminCloseTime").value = r.closeTime || "23:00";
  document.getElementById("adminBgUrl").value = r.bgUrl || "";
  document.getElementById("adminLogo").value = r.logoUrl || "";
  document.getElementById("adminGallery").value = r.gallery ? r.gallery.join(",") : "";
  document.getElementById("adminPhone").value = r.phone || "";
  document.getElementById("adminMenu").value = r.menu || "";
  document.getElementById("adminMap").value = r.map || "";

  document.getElementById("formTitle").innerText = "تعديل المطعم: " + r.name;
}

async function deleteRestaurant(id) {
  if (confirm("هل أنت متأكد من حذف هذا المطعم؟")) {
    try {
      await deleteDoc(doc(db, "restaurants", id));
      alert("تم حذف المطعم بنجاح");
    } catch (err) {
      alert("حدث خطأ أثناء الحذف: " + err.message);
    }
  }
}

// ============================================================
// 4. عرض البيانات والتفاعل المباشر (REALTIME LISTENERS & RENDER)
// ============================================================

function isRestaurantOpen(openTime, closeTime) {
  if (!openTime || !closeTime) return true;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [oH, oM] = openTime.split(':').map(Number);
  const [cH, cM] = closeTime.split(':').map(Number);

  const openMinutes = oH * 60 + oM;
  let closeMinutes = cH * 60 + cM;

  if (closeMinutes < openMinutes) {
    closeMinutes += 24 * 60;
  }

  let checkMinutes = currentMinutes;
  if (currentMinutes < openMinutes && closeMinutes > 24 * 60) {
    checkMinutes += 24 * 60;
  }

  return checkMinutes >= openMinutes && checkMinutes <= closeMinutes;
}

function renderRestaurants(restaurants) {
  const container = document.getElementById("restaurantsListContainer");
  if (!container) return;

  if (restaurants.length === 0) {
    container.innerHTML = `<p style="text-align:center; color: var(--text-muted); padding: 20px;">لا يوجد مطاعم مضافة حالياً في هذا القسم</p>`;
    return;
  }

  container.innerHTML = restaurants.map(r => {
    const isOpen = isRestaurantOpen(r.openTime, r.closeTime);
    const ratingVal = r.rating ? parseFloat(r.rating).toFixed(1) : "4.8";

    return `
      <div class="restaurant-card" onclick="window.openProfile('${r.id}')">
        <img class="restaurant-bg-img" src="${r.bgUrl}" alt="${r.name}" onerror="this.src='https://via.placeholder.com/600x300'">
        <img class="restaurant-logo-badge" src="${r.logoUrl}" alt="${r.name}" onerror="this.src='https://via.placeholder.com/150'">
        
        ${!isOpen ? `
          <div class="restaurant-closed-badge">
            <span class="closed-badge-title">مغلق حالياً 🛑</span>
            <span class="closed-badge-sub">يفتح عند الساعة ${r.openTime || ''}</span>
          </div>
        ` : ''}

        <div class="restaurant-info">
          <div>
            <h3>${r.name}</h3>
            <p>${r.desc || ''}</p>
          </div>
          <div class="restaurant-rating-badge">
            <svg viewBox="0 0 24 24">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>
            <span>${ratingVal}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderAdminLists() {
  // 1. قائمة الأقسام في الأدمن
  const catListContainer = document.getElementById("adminManageCategoriesContainer");
  if (catListContainer) {
    if (allCategories.length === 0) {
      catListContainer.innerHTML = `<p style="color:var(--text-muted); font-size:12px;">لا توجد أقسام بعد.</p>`;
    } else {
      catListContainer.innerHTML = allCategories.map(c => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:8px; margin-bottom:6px; font-size:13px;">
          <span>${c.nameAr} (${c.nameEn})</span>
          <div>
            <button onclick="window.editCategory('${c.id}')" style="background:#4facfe; border:none; color:#000; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;">تعديل</button>
            <button onclick="window.deleteCategory('${c.id}')" style="background:#ff5252; border:none; color:#fff; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;">حذف</button>
          </div>
        </div>
      `).join('');
    }
  }

  // 2. قائمة المطاعم في الأدمن
  const restListContainer = document.getElementById("adminManageListContainer");
  if (restListContainer) {
    if (allRestaurants.length === 0) {
      restListContainer.innerHTML = `<p style="color:var(--text-muted); font-size:12px;">لا توجد مطاعم بعد.</p>`;
    } else {
      restListContainer.innerHTML = allRestaurants.map(r => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:8px; margin-bottom:6px; font-size:13px;">
          <div>
            <strong style="color:var(--primary-color);">${r.name}</strong>
            <span style="font-size:11px; color:var(--text-muted); display:block;">القسم: ${r.category} | التقييم: ${r.rating || 4.8}★</span>
          </div>
          <div>
            <button onclick="window.editRestaurant('${r.id}')" style="background:#4facfe; border:none; color:#000; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;">تعديل</button>
            <button onclick="window.deleteRestaurant('${r.id}')" style="background:#ff5252; border:none; color:#fff; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;">حذف</button>
          </div>
        </div>
      `).join('');
    }
  }
}

function openProfile(id) {
  const r = allRestaurants.find(item => item.id === id);
  if (!r) return;

  document.getElementById("profileLogo").src = r.logoUrl;
  document.getElementById("profileName").innerText = r.name;
  document.getElementById("profileDesc").innerText = r.desc || "";

  const ratingVal = r.rating ? parseFloat(r.rating).toFixed(1) : "4.8";
  document.getElementById("profileRatingContainer").innerHTML = `
    <div class="restaurant-rating-badge" style="margin-top: 6px; font-size: 13px;">
      <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
      <span>${ratingVal} / 5.0</span>
    </div>
  `;

  const galContainer = document.getElementById("profileGalleryContainer");
  if (r.gallery && r.gallery.length > 0) {
    galContainer.innerHTML = r.gallery.map(img => `<img src="${img}" alt="Gallery Image">`).join('');
  } else {
    galContainer.innerHTML = `<p style="color:var(--text-muted); grid-column: 1/-1; text-align:center;">لا توجد صور في المعرض</p>`;
  }

  document.getElementById("profileMenuBtn").href = r.menu || "#";
  document.getElementById("profileContactBtn").href = r.phone ? `https://wa.me/${r.phone}` : "#";
  document.getElementById("profileLocationBtn").href = r.map || "#";

  showPage("pageRestProfile");
}

function listenToData() {
  // الاستماع للأقسام
  onSnapshot(collection(db, "categories"), (snapshot) => {
    allCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const select = document.getElementById("adminCategory");
    if (select) {
      select.innerHTML = allCategories.map(c => `<option value="${c.nameAr}">${c.nameAr} (${c.nameEn})</option>`).join('');
    }

    const catGrid = document.getElementById("categoriesGridContainer");
    if (catGrid) {
      catGrid.innerHTML = allCategories.map(c => `
        <div class="category-card" onclick="window.selectCategory('${c.nameAr}', '${c.imgUrl}')">
          <img src="${c.imgUrl}" alt="${c.nameAr}" onerror="this.src='https://via.placeholder.com/300'">
          <div class="category-title">${c.nameAr}</div>
        </div>
      `).join('');
    }

    renderAdminLists();
  });

  // الاستماع للمطاعم
  onSnapshot(collection(db, "restaurants"), (snapshot) => {
    allRestaurants = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (currentCategoryFilter) {
      const filtered = allRestaurants.filter(r => r.category === currentCategoryFilter);
      renderRestaurants(filtered);
    }
    renderAdminLists();
  });
}

function selectCategory(catName, imgUrl) {
  currentCategoryFilter = catName;
  document.getElementById("categoryHeroTitle").innerText = catName;
  document.getElementById("categoryHeroImg").src = imgUrl || 'https://via.placeholder.com/600x300';

  const filtered = allRestaurants.filter(r => r.category === catName);
  renderRestaurants(filtered);
  showPage("pageRestaurants");
}

function filterRestaurants() {
  const queryStr = document.getElementById("restaurantsSearchInput").value.toLowerCase();
  const filtered = allRestaurants.filter(r => {
    const matchesCat = currentCategoryFilter ? r.category === currentCategoryFilter : true;
    const matchesName = r.name.toLowerCase().includes(queryStr) || (r.desc && r.desc.toLowerCase().includes(queryStr));
    return matchesCat && matchesName;
  });
  renderRestaurants(filtered);
}

function filterCategories() {
  const queryStr = document.getElementById("categoriesSearchInput").value.toLowerCase();
  const filtered = allCategories.filter(c => c.nameAr.toLowerCase().includes(queryStr) || c.nameEn.toLowerCase().includes(queryStr));
  const catGrid = document.getElementById("categoriesGridContainer");
  if (catGrid) {
    catGrid.innerHTML = filtered.map(c => `
      <div class="category-card" onclick="window.selectCategory('${c.nameAr}', '${c.imgUrl}')">
        <img src="${c.imgUrl}" alt="${c.nameAr}" onerror="this.src='https://via.placeholder.com/300'">
        <div class="category-title">${c.nameAr}</div>
      </div>
    `).join('');
  }
}

// ============================================================
// 5. تسجيل الدخول والأدمن (ADMIN & AUTH)
// ============================================================

function checkAdminAccess() {
  showPage("pageLogin");
}

function performAdminLogin() {
  const user = document.getElementById("loginUsername").value;
  const pass = document.getElementById("loginPassword").value;

  if (user === "admin" && pass === "123456") {
    showPage("pageAdmin");
  } else {
    alert("اسم المستخدم أو كلمة المرور غير صحيحة");
  }
}

function logoutAdmin() {
  showPage("pageHome");
}

// ============================================================
// 6. ربط الدوال بالنطاق العام (GLOBAL BINDING)
// ============================================================

window.goBack = goBack;
window.openCategories = openCategories;
window.saveCategoryToFirebase = saveCategoryToFirebase;
window.resetCategoryForm = resetCategoryForm;
window.editCategory = editCategory;
window.deleteCategory = deleteCategory;

window.saveRestaurantToFirebase = saveRestaurantToFirebase;
window.resetAdminForm = resetAdminForm;
window.editRestaurant = editRestaurant;
window.deleteRestaurant = deleteRestaurant;

window.openProfile = openProfile;
window.selectCategory = selectCategory;
window.filterRestaurants = filterRestaurants;
window.filterCategories = filterCategories;
window.checkAdminAccess = checkAdminAccess;
window.performAdminLogin = performAdminLogin;
window.logoutAdmin = logoutAdmin;

// تشغيل التطبيق عند اكتمال تحميل الصفحة
document.addEventListener("DOMContentLoaded", () => {
  listenToData();
});
