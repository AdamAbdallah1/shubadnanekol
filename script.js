import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";


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


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

const MAX_GALLERY_IMAGES = 20;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

let currentCategoryFilter = sessionStorage.getItem("currentCategoryFilter") || "";
let allRestaurants = [];
let allCategories = [];

// ============================================================
// HELPER: SHUFFLE ARRAY (خلط عشوائي)
// ============================================================

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}


// ============================================================
// PAGE NAVIGATION & HISTORY (FIXED & SAFE)
// ============================================================

let pageHistory = [];

function showPage(pageId, isBack = false) {
  const currentPage = document.querySelector(".view-page.active");

  if (!isBack && currentPage && currentPage.id !== pageId) {
    pageHistory.push(currentPage.id);
  }

  document.querySelectorAll(".view-page").forEach(page => {
    page.classList.remove("active");
    page.style.display = "none";
  });

  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.add("active");
    targetPage.style.display = "block";
    sessionStorage.setItem("lastActivePage", pageId);
  }

  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.style.display = (pageId === "pageHome") ? "none" : "block";
  }

  window.scrollTo(0, 0);
}

function goBack() {
  if (pageHistory.length > 0) {
    const previousPage = pageHistory.pop();
    showPage(previousPage, true);
  } else {
    showPage("pageHome", true);
  }
}

function openCategories() {
  showPage("pageCategories");
}


// ============================================================
// CATEGORY FORM
// ============================================================

function resetCategoryForm() {
  const editCatDocId = document.getElementById("editCatDocId");
  const adminCatAr = document.getElementById("adminCatAr");
  const adminCatEn = document.getElementById("adminCatEn");
  const adminCatOrder = document.getElementById("adminCatOrder");
  const adminCatImg = document.getElementById("adminCatImg");
  const adminCatFile = document.getElementById("adminCatFile");
  const catPreview = document.getElementById("catPreview");
  const categoryFormTitle = document.getElementById("categoryFormTitle");

  if (editCatDocId) editCatDocId.value = "";
  if (adminCatAr) adminCatAr.value = "";
  if (adminCatEn) adminCatEn.value = "";
  if (adminCatOrder) adminCatOrder.value = "";
  if (adminCatImg) adminCatImg.value = "";
  if (adminCatFile) adminCatFile.value = "";
  if (catPreview) {
    catPreview.src = "";
    catPreview.style.display = "none";
  }
  if (categoryFormTitle) categoryFormTitle.innerText = "Add / Edit Category";
}

async function saveCategoryToFirebase() {
  const docId = document.getElementById("editCatDocId")?.value;
  const nameAr = document.getElementById("adminCatAr")?.value.trim();
  const nameEn = document.getElementById("adminCatEn")?.value.trim();
  const orderVal = document.getElementById("adminCatOrder")?.value.trim();
  const manualImg = document.getElementById("adminCatImg")?.value.trim();
  const catFile = document.getElementById("adminCatFile")?.files?.[0];

  if (!nameAr || !nameEn) {
    alert("يرجى إدخال اسم القسم بالعربي والإنجليزي");
    return;
  }

  try {
    let finalImg = manualImg || "";
    if (catFile) {
      const uploadedCatImg = await uploadRestaurantImage(catFile, "category_imgs", "cat");
      if (uploadedCatImg) finalImg = uploadedCatImg.url;
    }

    const categoryOrder = orderVal !== "" ? parseInt(orderVal, 10) : 999;

    if (docId) {
      await updateDoc(doc(db, "categories", docId), {
        nameAr,
        nameEn,
        order: categoryOrder,
        imgUrl: finalImg
      });
      alert("تم تعديل القسم بنجاح!");
    } else {
      await addDoc(collection(db, "categories"), {
        nameAr,
        nameEn,
        order: categoryOrder,
        imgUrl: finalImg,
        createdAt: new Date()
      });
      alert("تم إضافة القسم بنجاح!");
    }
    resetCategoryForm();
  } catch (error) {
    console.error("Error saving category:", error);
    alert("حدث خطأ أثناء حفظ القسم:\n\n" + error.message);
  }
}

function editCategory(id, nameAr, nameEn, order, imgUrl) {
  const editCatDocId = document.getElementById("editCatDocId");
  const adminCatAr = document.getElementById("adminCatAr");
  const adminCatEn = document.getElementById("adminCatEn");
  const adminCatOrder = document.getElementById("adminCatOrder");
  const adminCatImg = document.getElementById("adminCatImg");
  const catPreview = document.getElementById("catPreview");
  const categoryFormTitle = document.getElementById("categoryFormTitle");

  if (editCatDocId) editCatDocId.value = id;
  if (adminCatAr) adminCatAr.value = nameAr || "";
  if (adminCatEn) adminCatEn.value = nameEn || "";
  if (adminCatOrder) adminCatOrder.value = order !== undefined && order !== null ? order : "";
  if (adminCatImg) adminCatImg.value = imgUrl || "";
  if (catPreview) {
    catPreview.src = imgUrl || "";
    catPreview.style.display = imgUrl ? "block" : "none";
  }
  if (categoryFormTitle) categoryFormTitle.innerText = "Edit Category";
}

async function deleteCategoryFromFirebase(id) {
  if (confirm("هل أنت متأكد من حذف هذا القسم؟")) {
    try {
      await deleteDoc(doc(db, "categories", id));
      alert("تم حذف القسم بنجاح");
    } catch (error) {
      console.error("Error deleting category:", error);
      alert("حدث خطأ أثناء الحذف");
    }
  }
}


// ============================================================
// RESTAURANT FORM RESET
// ============================================================

function resetAdminForm() {
  const editDocId = document.getElementById("editDocId");
  const adminCategory = document.getElementById("adminCategory");
  const adminName = document.getElementById("adminName");
  const adminDesc = document.getElementById("adminDesc");
  const adminOpenTime = document.getElementById("adminOpenTime");
  const adminCloseTime = document.getElementById("adminCloseTime");
  const adminCover = document.getElementById("adminCover");
  const adminLogo = document.getElementById("adminLogo");
  const adminGallery = document.getElementById("adminGallery");
  const adminPhone = document.getElementById("adminPhone");
  const adminMenu = document.getElementById("adminMenu");
  const adminMap = document.getElementById("adminMap");
  const adminCoverFile = document.getElementById("adminCoverFile");
  const adminLogoFile = document.getElementById("adminLogoFile");
  const adminGalleryFiles = document.getElementById("adminGalleryFiles");
  const coverPreview = document.getElementById("coverPreview");
  const logoPreview = document.getElementById("logoPreview");
  const galleryPreview = document.getElementById("galleryPreview");
  const formTitle = document.getElementById("formTitle");

  if (editDocId) editDocId.value = "";
  if (adminCategory) adminCategory.value = "";
  if (adminName) adminName.value = "";
  if (adminDesc) adminDesc.value = "";
  if (adminOpenTime) adminOpenTime.value = "11:00";
  if (adminCloseTime) adminCloseTime.value = "02:00";
  if (adminCover) adminCover.value = "";
  if (adminLogo) adminLogo.value = "";
  if (adminGallery) adminGallery.value = "";
  if (adminPhone) adminPhone.value = "";
  if (adminMenu) adminMenu.value = "";
  if (adminMap) adminMap.value = "";
  if (adminCoverFile) adminCoverFile.value = "";
  if (adminLogoFile) adminLogoFile.value = "";
  if (adminGalleryFiles) adminGalleryFiles.value = "";

  if (coverPreview) { coverPreview.src = ""; coverPreview.style.display = "none"; }
  if (logoPreview) { logoPreview.src = ""; logoPreview.style.display = "none"; }
  if (galleryPreview) galleryPreview.innerHTML = "";
  if (formTitle) formTitle.innerText = "Add New Restaurant";
}


// ============================================================
// EDIT RESTAURANT FUNCTION (إضافة الدالة المفقودة لتفعيل زر التعديل)
// ============================================================

function editRestaurant(data) {
  const editDocId = document.getElementById("editDocId");
  const adminCategory = document.getElementById("adminCategory");
  const adminName = document.getElementById("adminName");
  const adminDesc = document.getElementById("adminDesc");
  const adminOpenTime = document.getElementById("adminOpenTime");
  const adminCloseTime = document.getElementById("adminCloseTime");
  const adminCover = document.getElementById("adminCover");
  const adminLogo = document.getElementById("adminLogo");
  const adminGallery = document.getElementById("adminGallery");
  const adminPhone = document.getElementById("adminPhone");
  const adminMenu = document.getElementById("adminMenu");
  const adminMap = document.getElementById("adminMap");
  const coverPreview = document.getElementById("coverPreview");
  const logoPreview = document.getElementById("logoPreview");
  const formTitle = document.getElementById("formTitle");

  if (editDocId) editDocId.value = data.id || "";
  if (adminCategory) adminCategory.value = data.category || "";
  if (adminName) adminName.value = data.name || "";
  if (adminDesc) adminDesc.value = data.desc || "";
  if (adminOpenTime) adminOpenTime.value = data.openTime || "11:00";
  if (adminCloseTime) adminCloseTime.value = data.closeTime || "02:00";
  if (adminCover) adminCover.value = data.cover || "";
  if (adminLogo) adminLogo.value = data.logo || "";
  if (adminGallery) adminGallery.value = Array.isArray(data.gallery) ? data.gallery.join(", ") : (data.gallery || "");
  if (adminPhone) adminPhone.value = data.phone || "";
  if (adminMenu) adminMenu.value = data.menu || "";
  if (adminMap) adminMap.value = data.map || "";

  if (coverPreview) {
    coverPreview.src = data.cover || "";
    coverPreview.style.display = data.cover ? "block" : "none";
  }
  if (logoPreview) {
    logoPreview.src = data.logo || "";
    logoPreview.style.display = data.logo ? "block" : "none";
  }
  if (formTitle) formTitle.innerText = "Edit Restaurant";
}


// ============================================================
// FIREBASE STORAGE & UPLOADS
// ============================================================

function createSafeFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
}

function createUniqueFileName(fileName) {
  const extension = fileName.includes(".") ? "." + fileName.split(".").pop() : "";
  const baseName = fileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 60);
  return Date.now() + "_" + Math.random().toString(36).substring(2, 10) + "_" + baseName + extension;
}

async function uploadRestaurantImage(file, restaurantId, folder) {
  if (!file) return null;
  if (!file.type.startsWith("image/")) throw new Error(`"${file.name}" is not an image.`);
  if (file.size > MAX_IMAGE_SIZE) throw new Error(`"${file.name}" أكبر من 5 MB.`);

  const uniqueName = createUniqueFileName(createSafeFileName(file.name));
  const storagePath = `restaurant-images/${restaurantId}/${folder}/${uniqueName}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file, { contentType: file.type });
  const downloadURL = await getDownloadURL(storageRef);

  return { url: downloadURL, path: storagePath };
}

async function uploadRestaurantCover(file, restaurantId) {
  if (!file) return null;
  return await uploadRestaurantImage(file, restaurantId, "cover");
}

async function uploadRestaurantLogo(file, restaurantId) {
  if (!file) return null;
  return await uploadRestaurantImage(file, restaurantId, "logo");
}

async function uploadRestaurantGallery(files, restaurantId) {
  if (!files || files.length === 0) return [];
  if (files.length > MAX_GALLERY_IMAGES) throw new Error("يمكنك رفع 20 صورة كحد أقصى للمعرض.");

  const results = [];
  for (const file of files) {
    const result = await uploadRestaurantImage(file, restaurantId, "gallery");
    if (result) results.push(result);
  }
  return results;
}


// ============================================================
// SAVE RESTAURANT
// ============================================================

async function saveRestaurantToFirebase() {
  const docId = document.getElementById("editDocId")?.value.trim();
  const category = document.getElementById("adminCategory")?.value;
  const name = document.getElementById("adminName")?.value.trim();
  const desc = document.getElementById("adminDesc")?.value.trim();
  const openTime = document.getElementById("adminOpenTime")?.value || "11:00";
  const closeTime = document.getElementById("adminCloseTime")?.value || "02:00";
  const manualCover = document.getElementById("adminCover")?.value.trim();
  const manualLogo = document.getElementById("adminLogo")?.value.trim();
  const manualGallery = document.getElementById("adminGallery")?.value.trim();
  const coverFile = document.getElementById("adminCoverFile")?.files?.[0];
  const logoFile = document.getElementById("adminLogoFile")?.files?.[0];
  const galleryFiles = document.getElementById("adminGalleryFiles")?.files;
  const phone = document.getElementById("adminPhone")?.value.trim();
  const menu = document.getElementById("adminMenu")?.value.trim();
  const map = document.getElementById("adminMap")?.value.trim();

  if (!name || !category) {
    alert("يرجى كتابة اسم المطعم واختيار القسم على الأقل");
    return;
  }

  let finalGallery = manualGallery ? manualGallery.split(",").map(item => item.trim()).filter(Boolean) : [];
  const selectedGalleryCount = galleryFiles ? galleryFiles.length : 0;
  if (finalGallery.length + selectedGalleryCount > MAX_GALLERY_IMAGES) {
    alert("يمكنك إضافة 20 صورة كحد أقصى للمطعم.");
    return;
  }

  const saveButton = document.querySelector('button[onclick="window.saveRestaurantToFirebase()"]');
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.innerText = "Uploading images...";
  }

  try {
    if (!docId) {
      const newRestaurantRef = doc(collection(db, "restaurants"));
      const restaurantId = newRestaurantRef.id;

      let finalCover = manualCover || "";
      let coverStoragePath = "";
      if (coverFile) {
        const uploadedCover = await uploadRestaurantCover(coverFile, restaurantId);
        if (uploadedCover) {
          finalCover = uploadedCover.url;
          coverStoragePath = uploadedCover.path;
        }
      }

      let finalLogo = manualLogo || "";
      let logoStoragePath = "";
      if (logoFile) {
        const uploadedLogo = await uploadRestaurantLogo(logoFile, restaurantId);
        if (uploadedLogo) {
          finalLogo = uploadedLogo.url;
          logoStoragePath = uploadedLogo.path;
        }
      }

      const galleryStoragePaths = [];
      if (galleryFiles && galleryFiles.length > 0) {
        const uploadedGallery = await uploadRestaurantGallery(galleryFiles, restaurantId);
        uploadedGallery.forEach(image => {
          if (image?.url) finalGallery.push(image.url);
          if (image?.path) galleryStoragePaths.push(image.path);
        });
      }

      await setDoc(newRestaurantRef, {
        category, name, desc, openTime, closeTime,
        cover: finalCover, logo: finalLogo, gallery: finalGallery,
        phone, menu, map, coverStoragePath, logoStoragePath, galleryStoragePaths,
        createdAt: new Date(), updatedAt: new Date()
      });

      alert("تم إضافة المطعم ورفع الصور بنجاح!");
      resetAdminForm();
      return;
    }

    let finalCover = manualCover || "";
    let finalCoverStoragePath = "";
    let finalLogo = manualLogo || "";
    let finalLogoStoragePath = "";

    const existingRestaurant = allRestaurants.find(r => r.id === docId);
    if (existingRestaurant) {
      finalCover = manualCover || existingRestaurant.cover || "";
      finalCoverStoragePath = existingRestaurant.coverStoragePath || "";
      finalLogo = manualLogo || existingRestaurant.logo || "";
      finalLogoStoragePath = existingRestaurant.logoStoragePath || "";
    }

    if (coverFile) {
      const uploadedCover = await uploadRestaurantCover(coverFile, docId);
      if (uploadedCover) {
        finalCover = uploadedCover.url;
        finalCoverStoragePath = uploadedCover.path;
      }
    }

    if (logoFile) {
      const uploadedLogo = await uploadRestaurantLogo(logoFile, docId);
      if (uploadedLogo) {
        finalLogo = uploadedLogo.url;
        finalLogoStoragePath = uploadedLogo.path;
      }
    }

    let existingGallery = manualGallery ? manualGallery.split(",").map(i => i.trim()).filter(Boolean) : [];
    let existingGalleryStoragePaths = existingRestaurant?.galleryStoragePaths || [];

    if (galleryFiles && galleryFiles.length > 0) {
      const uploadedGallery = await uploadRestaurantGallery(galleryFiles, docId);
      uploadedGallery.forEach(image => {
        if (image?.url) existingGallery.push(image.url);
        if (image?.path) existingGalleryStoragePaths.push(image.path);
      });
    }

    await updateDoc(doc(db, "restaurants", docId), {
      category, name, desc, openTime, closeTime,
      cover: finalCover, logo: finalLogo, gallery: existingGallery,
      phone, menu, map, coverStoragePath: finalCoverStoragePath,
      logoStoragePath: finalLogoStoragePath, galleryStoragePaths: existingGalleryStoragePaths,
      updatedAt: new Date()
    });

    alert("تم تحديث المطعم ورفع الصور بنجاح!");
    resetAdminForm();

  } catch (error) {
    console.error("Error saving restaurant:", error);
    alert("حدث خطأ أثناء الحفظ:\n\n" + error.message);
  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.innerText = "Save Restaurant";
    }
  }
}

async function deleteRestaurantFromFirebase(id) {
  if (confirm("هل أنت متأكد من حذف هذا المطعم؟")) {
    try {
      await deleteDoc(doc(db, "restaurants", id));
      alert("تم الحذف بنجاح");
    } catch (error) {
      console.error("Error deleting restaurant:", error);
      alert("حدث خطأ أثناء الحذف");
    }
  }
}


// ============================================================
// ADMIN ACCESS
// ============================================================

function checkAdminAccess() {
  const isAdmin = sessionStorage.getItem("isAdminLoggedIn");
  if (isAdmin === "true") {
    showPage("pageAdmin");
  } else {
    if (document.getElementById("loginUsername")) document.getElementById("loginUsername").value = "";
    if (document.getElementById("loginPassword")) document.getElementById("loginPassword").value = "";
    showPage("pageLogin");
  }
}

function performAdminLogin() {
  const user = document.getElementById("loginUsername")?.value;
  const pass = document.getElementById("loginPassword")?.value;
  if (user === "admin1" && pass === "70725") {
    sessionStorage.setItem("isAdminLoggedIn", "true");
    showPage("pageAdmin");
  } else {
    alert("اسم المستخدم أو كلمة المرور غير صحيحة");
  }
}

function logoutAdmin() {
  sessionStorage.removeItem("isAdminLoggedIn");
  showPage("pageHome");
}


// ============================================================
// FILTER CATEGORIES & RESTAURANTS
// ============================================================

function filterCategories() {
  const queryStr = document.getElementById("categoriesSearchInput")?.value.toLowerCase().trim() || "";
  const grid = document.getElementById("categoriesGridContainer");
  if (!grid) return;

  grid.innerHTML = "";
  const filtered = allCategories.filter(c => 
    (c.nameAr && c.nameAr.toLowerCase().includes(queryStr)) ||
    (c.nameEn && c.nameEn.toLowerCase().includes(queryStr))
  );

  if (filtered.length === 0) {
    grid.innerHTML = '<p style="text-align: center; color: #777; width: 100%;">لا توجد أقسام مطابقة للبحث.</p>';
    return;
  }

  filtered.forEach(data => {
    const card = document.createElement("div");
    card.className = "category-card";
    card.onclick = () => openRestaurantsByCategory(data.id, data.nameAr || data.nameEn, data.imgUrl);
    card.innerHTML = `
      <img src="${data.imgUrl || 'https://via.placeholder.com/150'}" alt="${data.nameAr || ''}">
      <div class="category-title">${data.nameAr || ''}</div>
    `;
    grid.appendChild(card);
  });
}

function filterRestaurants() {
  const queryStr = document.getElementById("restaurantsSearchInput")?.value.toLowerCase().trim() || "";
  renderRestaurantsList(queryStr, false);
}

function openRestaurantsByCategory(catId, catName, catImg) {
  currentCategoryFilter = catId;
  sessionStorage.setItem("currentCategoryFilter", catId);

  // حفظ بيانات الهيرو للقسم في الجلسة لتسترجع عند الـ Refresh
  sessionStorage.setItem("currentCategoryName", catName || "");
  sessionStorage.setItem("currentCategoryImg", catImg || "");

  const heroTitle = document.getElementById("categoryHeroTitle");
  const heroImg = document.getElementById("categoryHeroImg");

  if (heroTitle) heroTitle.innerText = catName || "";
  if (heroImg) heroImg.src = catImg || "https://via.placeholder.com/400x150";

  renderRestaurantsList("", true);
  showPage("pageRestaurants");
}


// ============================================================
// RESTAURANT OPEN/CLOSED TIME
// ============================================================

function isRestaurantClosed(openTime, closeTime) {
  if (!openTime || !closeTime) return false;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [openHour, openMin] = openTime.split(':').map(Number);
  const [closeHour, closeMin] = closeTime.split(':').map(Number);

  const openMinutes = openHour * 60 + openMin;
  const closeMinutes = closeHour * 60 + closeMin;

  if (openMinutes < closeMinutes) {
    return currentMinutes < openMinutes || currentMinutes >= closeMinutes;
  } else {
    return currentMinutes < openMinutes && currentMinutes >= closeMinutes;
  }
}

function format12HourTime(timeStr) {
  if (!timeStr) return "";
  const [hourStr, minStr] = timeStr.split(':');
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour ? hour : 12;
  return `${hour}:${minStr} ${ampm}`;
}


// ============================================================
// RENDER RESTAURANTS LIST
// ============================================================

function renderRestaurantsList(searchQuery = "", shouldShuffle = false) {
  const container = document.getElementById("restaurantsListContainer");
  if (!container) return;

  container.innerHTML = "";

  let filtered = allRestaurants.filter(r => r.category === currentCategoryFilter);

  if (searchQuery) {
    filtered = filtered.filter(r => r.name && r.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }

  if (filtered.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #777; width: 100%;">لا توجد مطاعم حالياً.</p>';
    return;
  }

  let openRestaurants = filtered.filter(r => !isRestaurantClosed(r.openTime, r.closeTime));
  let closedRestaurants = filtered.filter(r => isRestaurantClosed(r.openTime, r.closeTime));

  if (shouldShuffle && !searchQuery) {
    openRestaurants = shuffleArray(openRestaurants);
    closedRestaurants = shuffleArray(closedRestaurants);
  }

  const finalOrderedList = [...openRestaurants, ...closedRestaurants];

  finalOrderedList.forEach(r => {
    const card = document.createElement("div");
    const closed = isRestaurantClosed(r.openTime, r.closeTime);

    card.className = `restaurant-card ${closed ? 'is-closed' : 'is-open'}`;
    card.onclick = () => openRestaurantProfile(r);

    const formattedOpenTime = format12HourTime(r.openTime || "11:00");
    const coverUrl = r.cover || r.logo || "https://via.placeholder.com/400x200";
    const logoUrl = r.logo || "https://via.placeholder.com/100";

    card.innerHTML = `
      <img class="restaurant-bg-img" src="${coverUrl}" alt="${r.name || ""}">
      <img class="restaurant-logo-badge" src="${logoUrl}" alt="${r.name || ""}">
      ${closed ? `
        <div class="restaurant-closed-overlay">
          <div class="restaurant-closed-badge">
            <div class="closed-badge-title">🌙 Closed</div>
            <div class="closed-badge-sub">Opens today at ${formattedOpenTime}</div>
          </div>
        </div>
      ` : ''}
      <div class="restaurant-info">
        <h3>${r.name || ""}</h3>
        <p>${r.desc || ""}</p>
      </div>
    `;
    container.appendChild(card);
  });
}


// ============================================================
// RESTAURANT PROFILE
// ============================================================

function openRestaurantProfile(r) {
  const profileLogo = document.getElementById("profileLogo");
  const profileName = document.getElementById("profileName");
  const profileDesc = document.getElementById("profileDesc");
  const profileGallery = document.getElementById("profileGalleryContainer");
  const menuBtn = document.getElementById("profileMenuBtn");
  const contactBtn = document.getElementById("profileContactBtn");
  const locationBtn = document.getElementById("profileLocationBtn");

  if (profileLogo) profileLogo.src = r.logo || "https://via.placeholder.com/100";
  if (profileName) profileName.innerText = r.name || "";
  if (profileDesc) profileDesc.innerText = r.desc || "";
  if (menuBtn) menuBtn.href = r.menu || "#";
  if (contactBtn) contactBtn.href = r.phone ? `https://wa.me/${r.phone}` : "#";
  if (locationBtn) locationBtn.href = r.map || "#";

  if (profileGallery) {
    profileGallery.innerHTML = "";
    if (r.gallery && r.gallery.length > 0) {
      r.gallery.forEach(imgUrl => {
        if (imgUrl) {
          const img = document.createElement("img");
          img.src = imgUrl;
          profileGallery.appendChild(img);
        }
      });
    }
  }

  showPage("pageRestProfile");
}


// ============================================================
// LISTEN TO CATEGORIES & RESTAURANTS
// ============================================================

function listenToCategories() {
  try {
    const q = query(collection(db, "categories"));
    onSnapshot(q, snapshot => {
      allCategories = [];
      const adminCatContainer = document.getElementById("adminManageCategoriesContainer");
      const selectDropdown = document.getElementById("adminCategory");

      if (adminCatContainer) adminCatContainer.innerHTML = "";
      if (selectDropdown) selectDropdown.innerHTML = '<option value="">اختر القسم...</option>';

      snapshot.forEach(docSnap => {
        allCategories.push({ id: docSnap.id, ...docSnap.data() });
      });

      allCategories.sort((a, b) => {
        const orderA = a.order !== undefined && a.order !== null ? Number(a.order) : 999;
        const orderB = b.order !== undefined && b.order !== null ? Number(b.order) : 999;
        return orderA - orderB;
      });

      allCategories.forEach(data => {
        const id = data.id;

        if (selectDropdown) {
          const option = document.createElement("option");
          option.value = id;
          option.textContent = data.nameAr || data.nameEn;
          selectDropdown.appendChild(option);
        }

        if (adminCatContainer) {
          const item = document.createElement("div");
          item.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #eee;";
          item.innerHTML = `
            <span>
              ${data.order !== undefined && data.order !== null ? `<b>[${data.order}]</b> ` : ''}
              ${data.nameAr || ""} (${data.nameEn || ""})
            </span>
            <div>
              <button type="button" style="padding: 4px 8px; background: #008080; color: white; border: none; border-radius: 4px; cursor: pointer;" onclick="window.editCategory('${id}', '${String(data.nameAr || "").replace(/'/g, "\\'")}', '${String(data.nameEn || "").replace(/'/g, "\\'")}', ${data.order !== undefined && data.order !== null ? data.order : 'null'}, '${String(data.imgUrl || "").replace(/'/g, "\\'")}')">تعديل</button>
              <button type="button" style="padding: 4px 8px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer;" onclick="window.deleteCategoryFromFirebase('${id}')">حذف</button>
            </div>
          `;
          adminCatContainer.appendChild(item);
        }
      });

      filterCategories();

      // إعادة بناء بيانات صفحة المطاعم الحالية في حال الـ Refresh
      if (currentCategoryFilter) {
        const cat = allCategories.find(c => c.id === currentCategoryFilter);
        if (cat) {
          const heroTitle = document.getElementById("categoryHeroTitle");
          const heroImg = document.getElementById("categoryHeroImg");
          if (heroTitle) heroTitle.innerText = cat.nameAr || cat.nameEn || "";
          if (heroImg) heroImg.src = cat.imgUrl || "https://via.placeholder.com/400x150";
        }
      }
    });
  } catch (e) {
    console.error(e);
  }
}

function listenToRestaurants() {
  try {
    const q = query(collection(db, "restaurants"), orderBy("createdAt", "desc"));
    onSnapshot(q, snapshot => {
      allRestaurants = [];
      const adminRestContainer = document.getElementById("adminManageListContainer");
      if (adminRestContainer) adminRestContainer.innerHTML = "";

      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const id = docSnap.id;
        allRestaurants.push({ id, ...data });

        if (adminRestContainer) {
          const item = document.createElement("div");
          item.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #eee;";
          
          const restaurantObject = {
            id: id,
            category: data.category || "",
            name: data.name || "",
            desc: data.desc || "",
            openTime: data.openTime || "11:00",
            closeTime: data.closeTime || "02:00",
            cover: data.cover || "",
            logo: data.logo || "",
            gallery: data.gallery || [],
            phone: data.phone || "",
            menu: data.menu || "",
            map: data.map || "",
            coverStoragePath: data.coverStoragePath || "",
            logoStoragePath: data.logoStoragePath || "",
            galleryStoragePaths: data.galleryStoragePaths || []
          };

          const objectString = JSON.stringify(restaurantObject).replace(/"/g, "&quot;");

          item.innerHTML = `
            <span>${data.name || ""}</span>
            <div>
              <button type="button" style="padding: 4px 8px; background: #008080; color: white; border: none; border-radius: 4px; cursor: pointer;" onclick="window.editRestaurant(${objectString})">تعديل</button>
              <button type="button" style="padding: 4px 8px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer;" onclick="window.deleteRestaurantFromFirebase('${id}')">حذف</button>
            </div>
          `;
          adminRestContainer.appendChild(item);
        }
      });

      if (currentCategoryFilter) {
        renderRestaurantsList("", false);
      }
    });
  } catch (e) {
    console.error(e);
  }
}


// ============================================================
// IMAGE PREVIEWS SETUP
// ============================================================

function setupImagePreviews() {
  const catInput = document.getElementById("adminCatFile");
  const catPreview = document.getElementById("catPreview");

  if (catInput) {
    catInput.addEventListener("change", () => {
      const file = catInput.files?.[0];
      if (!file) { if (catPreview) catPreview.style.display = "none"; return; }
      if (!file.type.startsWith("image/")) { alert("يرجى اختيار صورة صحيحة."); catInput.value = ""; return; }
      const reader = new FileReader();
      reader.onload = e => { if (catPreview) { catPreview.src = e.target.result; catPreview.style.display = "block"; } };
      reader.readAsDataURL(file);
    });
  }

  const coverInput = document.getElementById("adminCoverFile");
  const coverPreview = document.getElementById("coverPreview");

  if (coverInput) {
    coverInput.addEventListener("change", () => {
      const file = coverInput.files?.[0];
      if (!file) { if (coverPreview) coverPreview.style.display = "none"; return; }
      if (!file.type.startsWith("image/")) { alert("يرجى اختيار صورة صحيحة."); coverInput.value = ""; return; }
      const reader = new FileReader();
      reader.onload = e => { if (coverPreview) { coverPreview.src = e.target.result; coverPreview.style.display = "block"; } };
      reader.readAsDataURL(file);
    });
  }

  const logoInput = document.getElementById("adminLogoFile");
  const logoPreview = document.getElementById("logoPreview");
  const galleryInput = document.getElementById("adminGalleryFiles");
  const galleryPreview = document.getElementById("galleryPreview");

  if (logoInput) {
    logoInput.addEventListener("change", () => {
      const file = logoInput.files?.[0];
      if (!file) { if (logoPreview) logoPreview.style.display = "none"; return; }
      if (!file.type.startsWith("image/")) { alert("يرجى اختيار صورة صحيحة."); logoInput.value = ""; return; }
      if (file.size > MAX_IMAGE_SIZE) { alert("حجم صورة الشعار يجب أن يكون أقل من 5 MB."); logoInput.value = ""; return; }
      const reader = new FileReader();
      reader.onload = event => { if (logoPreview) { logoPreview.src = event.target.result; logoPreview.style.display = "block"; } };
      reader.readAsDataURL(file);
    });
  }

  if (galleryInput) {
    galleryInput.addEventListener("change", () => {
      if (galleryPreview) galleryPreview.innerHTML = "";
      const files = Array.from(galleryInput.files || []);
      if (files.length > MAX_GALLERY_IMAGES) { alert("يمكنك اختيار 20 صورة كحد أقصى."); galleryInput.value = ""; return; }

      files.forEach(file => {
        if (!file.type.startsWith("image/")) return;
        if (file.size > MAX_IMAGE_SIZE) { alert(`"${file.name}" أكبر من 5 MB.`); return; }
        const reader = new FileReader();
        reader.onload = event => {
          const img = document.createElement("img");
          img.src = event.target.result;
          img.alt = "Gallery Preview";
          if (galleryPreview) galleryPreview.appendChild(img);
        };
        reader.readAsDataURL(file);
      });
    });
  }
}


// ============================================================
// INITIALIZATION (FIXED INITIAL PAGE LOAD)
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  listenToCategories();
  listenToRestaurants();
  setupImagePreviews();

  const savedPage = sessionStorage.getItem("lastActivePage");
  const isAdminLoggedIn = sessionStorage.getItem("isAdminLoggedIn") === "true";

  // استرجاع الصورة والاسم المخزنة سابقاً للقسم عند الـ Refresh
  const savedCatName = sessionStorage.getItem("currentCategoryName");
  const savedCatImg = sessionStorage.getItem("currentCategoryImg");
  const heroTitle = document.getElementById("categoryHeroTitle");
  const heroImg = document.getElementById("categoryHeroImg");

  if (heroTitle && savedCatName) heroTitle.innerText = savedCatName;
  if (heroImg && savedCatImg) heroImg.src = savedCatImg;

  if (savedPage === "pageAdmin") {
    if (isAdminLoggedIn) {
      showPage("pageAdmin", true);
    } else {
      showPage("pageHome", true);
    }
  } else if (savedPage === "pageRestaurants" && !currentCategoryFilter) {
    showPage("pageCategories", true);
  } else if (savedPage && document.getElementById(savedPage)) {
    showPage(savedPage, true);
  } else {
    showPage("pageHome", true);
  }

  setInterval(() => {
    if (currentCategoryFilter) {
      renderRestaurantsList("", false);
    }
  }, 60000);
});


// ============================================================
// GLOBAL EXPORTS
// ============================================================

window.showPage = showPage;
window.goBack = goBack;
window.openCategories = openCategories;
window.resetCategoryForm = resetCategoryForm;
window.saveCategoryToFirebase = saveCategoryToFirebase;
window.editCategory = editCategory;
window.deleteCategoryFromFirebase = deleteCategoryFromFirebase;
window.resetAdminForm = resetAdminForm;
window.saveRestaurantToFirebase = saveRestaurantToFirebase;
window.deleteRestaurantFromFirebase = deleteRestaurantFromFirebase;
window.checkAdminAccess = checkAdminAccess;
window.performAdminLogin = performAdminLogin;
window.logoutAdmin = logoutAdmin;
window.filterCategories = filterCategories;
window.filterRestaurants = filterRestaurants;
window.openRestaurantsByCategory = openRestaurantsByCategory;
window.openRestaurantProfile = openRestaurantProfile;
window.editRestaurant = editRestaurant;
