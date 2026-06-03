const DB_NAME = "galeria_db";
const DB_VERSION = 1;
const STORE_NAME = "midias";

const ACCEPTED_MIME = {
  imagens: ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"],
  videos: ["video/mp4", "video/webm", "video/ogg"],
};

const ACCEPTED_EXT = {
  imagens: ["jpg", "jpeg", "png", "gif", "webp"],
  videos: ["mp4", "webm", "ogg"],
};

const tabs = document.querySelectorAll(".tab-btn");
const panels = {
  imagens: document.getElementById("panel-imagens"),
  videos: document.getElementById("panel-videos"),
};

const imageGallery = document.getElementById("imageGallery");
const videoGallery = document.getElementById("videoGallery");
const emptyImages = document.getElementById("emptyImages");
const emptyVideos = document.getElementById("emptyVideos");
const backBtn = document.getElementById("backBtn");
const folderPath = document.getElementById("folderPath");
const fileInput = document.getElementById("fileInput");

const imageModal = document.getElementById("imageModal");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxCaption = document.getElementById("lightboxCaption");
const closeImageModal = document.getElementById("closeImageModal");
const prevImageBtn = document.getElementById("prevImageBtn");
const nextImageBtn = document.getElementById("nextImageBtn");

const fabToggleBtn = document.getElementById("fabToggleBtn");
const fabMenu = document.getElementById("fabMenu");
const fabAddPhoto = document.getElementById("fabAddPhoto");
const fabAddFolder = document.getElementById("fabAddFolder");
const fabEditName = document.getElementById("fabEditName");

const state = {
  activeTab: "imagens",
  currentFolderId: null,
  selectedItemId: null,
  items: [],
  lightboxIndex: -1,
};

let db;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const connection = event.target.result;
      if (!connection.objectStoreNames.contains(STORE_NAME)) {
        connection.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbPut(record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function dbDelete(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function dbGetAll() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function makeId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function makeCardTitle(fileName) {
  return fileName.length > 42 ? `${fileName.slice(0, 39)}...` : fileName;
}

function getFileExtension(fileName) {
  const split = fileName.split(".");
  return (split[split.length - 1] || "").toLowerCase();
}

function isAllowedFile(file, tabName) {
  const mime = (file.type || "").toLowerCase();
  const ext = getFileExtension(file.name);
  return ACCEPTED_MIME[tabName].includes(mime) || ACCEPTED_EXT[tabName].includes(ext);
}

function updateInputAccept() {
  const accepted = state.activeTab === "imagens"
    ? ".jpg,.jpeg,.png,.gif,.webp"
    : ".mp4,.webm,.ogg";
  fileInput.setAttribute("accept", accepted);
}

function setTab(tabName) {
  state.activeTab = tabName;

  tabs.forEach((tab) => {
    const isActive = tab.dataset.tab === tabName;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  Object.entries(panels).forEach(([name, panel]) => {
    const isActive = name === tabName;
    panel.classList.toggle("active", isActive);
    panel.hidden = !isActive;
  });

  updateInputAccept();
}

function openLightboxById(imageId) {
  const images = getCurrentImages();
  const index = images.findIndex((item) => item.id === imageId);
  if (index === -1) {
    return;
  }

  state.lightboxIndex = index;
  imageModal.hidden = false;
  updateLightbox();
}

function goToPrevImage() {
  if (state.lightboxIndex <= 0) {
    return;
  }
  state.lightboxIndex -= 1;
  updateLightbox();
}

function goToNextImage() {
  const images = getCurrentImages();
  if (state.lightboxIndex >= images.length - 1) {
    return;
  }
  state.lightboxIndex += 1;
  updateLightbox();
}

function closeImagePreview() {
  imageModal.hidden = true;
  state.lightboxIndex = -1;
  lightboxImage.src = "";
  lightboxCaption.textContent = "";
}

function updateLightbox() {
  const images = getCurrentImages();
  if (images.length === 0 || state.lightboxIndex < 0 || state.lightboxIndex >= images.length) {
    closeImagePreview();
    return;
  }

  const current = images[state.lightboxIndex];
  lightboxImage.src = current.url;
  lightboxImage.alt = current.name;
  lightboxCaption.textContent = `${current.name} (${state.lightboxIndex + 1}/${images.length})`;
  prevImageBtn.disabled = state.lightboxIndex === 0;
  nextImageBtn.disabled = state.lightboxIndex === images.length - 1;
}

function getItemById(id) {
  return state.items.find((item) => item.id === id) || null;
}

function getFolderPath() {
  const path = [];
  let folder = getItemById(state.currentFolderId);
  while (folder) {
    path.unshift(folder.name);
    folder = getItemById(folder.parentId);
  }
  return path.length ? `Raiz / ${path.join(" / ")}` : "Raiz";
}

function updateFolderPath() {
  folderPath.textContent = getFolderPath();
}

function updateBackButton() {
  backBtn.hidden = !state.currentFolderId;
}

function getDescendantIds(parentId) {
  const children = state.items.filter((item) => item.parentId === parentId);
  return children.reduce((acc, child) => acc.concat(child.id, getDescendantIds(child.id)), []);
}

function getItemsByType(type) {
  return state.items.filter((item) => item.type === type && item.parentId === state.currentFolderId);
}

function getCurrentFolders() {
  return getItemsByType("folder");
}

function getCurrentImages() {
  return getItemsByType("image");
}

function getCurrentVideos() {
  return getItemsByType("video");
}

function selectItem(itemId) {
  state.selectedItemId = itemId;
  renderAll();
}

function clearSelection() {
  state.selectedItemId = null;
  renderAll();
}

function toggleFabMenu(event) {
  if (event) {
    event.stopPropagation();
  }
  const isOpen = !fabMenu.hidden;
  fabMenu.hidden = isOpen;
  fabToggleBtn.setAttribute("aria-expanded", String(!isOpen));
}

function closeFabMenu() {
  fabMenu.hidden = true;
  fabToggleBtn.setAttribute("aria-expanded", "false");
}

async function addFiles(selectedFiles) {
  const files = Array.from(selectedFiles || []);
  if (files.length === 0) {
    return;
  }

  const allowedLabel = state.activeTab === "imagens"
    ? "JPG, JPEG, PNG, GIF, WEBP"
    : "MP4, WEBM, OGG";

  for (const file of files) {
    if (!isAllowedFile(file, state.activeTab)) {
      window.alert(`Arquivo invalido para a aba ${state.activeTab}. Use: ${allowedLabel}.`);
      continue;
    }

    const record = {
      id: makeId(),
      name: file.name,
      size: file.size,
      mimeType: file.type,
      type: state.activeTab === "imagens" ? "image" : "video",
      category: state.activeTab,
      parentId: state.currentFolderId,
      createdAt: Date.now(),
      blob: file,
    };

    await dbPut(record);

    state.items.unshift({
      ...record,
      url: URL.createObjectURL(file),
    });
  }

  renderAll();
}

async function createFolder() {
  const folderName = window.prompt("Nome da nova pasta:");
  if (!folderName || !folderName.trim()) {
    return;
  }

  const record = {
    id: makeId(),
    name: folderName.trim(),
    size: 0,
    mimeType: "",
    type: "folder",
    category: "pastas",
    parentId: state.currentFolderId,
    createdAt: Date.now(),
  };

  await dbPut(record);
  state.items.unshift(record);
  renderAll();
}

async function editItemName(itemId) {
  const item = getItemById(itemId);
  if (!item) {
    return;
  }

  const newName = window.prompt("Digite um novo nome:", item.name);
  if (!newName || !newName.trim() || newName.trim() === item.name) {
    return;
  }

  item.name = newName.trim();
  const record = {
    id: item.id,
    name: item.name,
    size: item.size,
    mimeType: item.mimeType || "",
    type: item.type,
    category: item.category,
    parentId: item.parentId,
    createdAt: item.createdAt,
  };

  if (item.blob) {
    record.blob = item.blob;
  }

  await dbPut(record);
  renderAll();
}

function triggerEditName() {
  if (!state.selectedItemId) {
    window.alert("Selecione uma imagem, vídeo ou pasta para editar.");
    return;
  }

  editItemName(state.selectedItemId);
  closeFabMenu();
}

function openFolder(folderId) {
  state.currentFolderId = folderId;
  state.selectedItemId = null;
  updateFolderPath();
  updateBackButton();
  renderAll();
  closeFabMenu();
}

function goBack() {
  if (!state.currentFolderId) {
    return;
  }

  const current = getItemById(state.currentFolderId);
  state.currentFolderId = current?.parentId || null;
  state.selectedItemId = null;
  updateFolderPath();
  updateBackButton();
  renderAll();
}

function renderImageGallery() {
  imageGallery.innerHTML = "";

  const folders = getCurrentFolders();
  const images = getCurrentImages();
  const items = [...folders, ...images];

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.id = item.id;
    card.dataset.type = item.type;
    card.draggable = item.type === "image";

    if (item.id === state.selectedItemId) {
      card.classList.add("selected");
    }

    const mediaWrap = document.createElement("div");
    mediaWrap.className = "card-media-wrap";

    if (item.type === "folder") {
      card.classList.add("folder-card");

      const folderIcon = document.createElement("div");
      folderIcon.className = "folder-icon";
      folderIcon.textContent = "📁";
      mediaWrap.append(folderIcon);
    } else {
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = item.name;
      mediaWrap.append(img);
    }

    const body = document.createElement("div");
    body.className = "card-body";
    body.innerHTML = `
      <p class="card-title" title="${item.name}">${makeCardTitle(item.name)}</p>
      <p class="card-sub">${item.type === "folder" ? "Pasta" : formatSize(item.size)}</p>
    `;

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "edit-btn";
    editBtn.type = "button";
    editBtn.textContent = "Editar";
    editBtn.dataset.action = "edit";
    editBtn.dataset.id = item.id;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.type = "button";
    deleteBtn.textContent = "Excluir";
    deleteBtn.dataset.action = "delete";
    deleteBtn.dataset.id = item.id;

    actions.append(editBtn, deleteBtn);
    card.append(mediaWrap, body, actions);
    imageGallery.append(card);
  });

  emptyImages.hidden = items.length > 0;
}

function renderVideoGallery() {
  videoGallery.innerHTML = "";

  const videos = getCurrentVideos();

  videos.forEach((item) => {
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.id = item.id;

    if (item.id === state.selectedItemId) {
      card.classList.add("selected");
    }

    const mediaWrap = document.createElement("div");
    mediaWrap.className = "card-media-wrap";

    const video = document.createElement("video");
    video.src = item.url;
    video.controls = true;
    video.preload = "metadata";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.type = "button";
    deleteBtn.textContent = "Excluir";
    deleteBtn.dataset.action = "delete";
    deleteBtn.dataset.id = item.id;

    mediaWrap.append(video, deleteBtn);

    const body = document.createElement("div");
    body.className = "card-body";
    body.innerHTML = `
      <p class="card-title" title="${item.name}">${makeCardTitle(item.name)}</p>
      <p class="card-sub">${formatSize(item.size)}</p>
    `;

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "edit-btn";
    editBtn.type = "button";
    editBtn.textContent = "Editar";
    editBtn.dataset.action = "edit";
    editBtn.dataset.id = item.id;

    actions.append(editBtn);
    card.append(mediaWrap, body, actions);
    videoGallery.append(card);
  });

  emptyVideos.hidden = videos.length > 0;
}

function renderAll() {
  renderImageGallery();
  renderVideoGallery();
  updateFolderPath();
  updateBackButton();
  if (!imageModal.hidden) {
    updateLightbox();
  }
}

async function moveImageToFolder(imageId, folderId) {
  const item = getItemById(imageId);
  const folder = getItemById(folderId);
  if (!item || !folder || folder.type !== "folder") {
    return;
  }

  item.parentId = folderId;
  const record = {
    id: item.id,
    name: item.name,
    size: item.size,
    mimeType: item.mimeType || "",
    type: item.type,
    category: item.category,
    parentId: item.parentId,
    createdAt: item.createdAt,
  };
  if (item.blob) {
    record.blob = item.blob;
  }

  await dbPut(record);
  renderAll();
}

function toggleVideoPlayback(itemId) {
  const card = videoGallery.querySelector(`.card[data-id="${itemId}"]`);
  if (!card) {
    return;
  }
  const video = card.querySelector("video");
  if (!video) {
    return;
  }
  if (video.paused) {
    video.play();
  } else {
    video.pause();
  }
}

async function removeItem(itemId) {
  const item = getItemById(itemId);
  if (!item) {
    return;
  }

  const confirmed = window.confirm(`Deseja excluir "${item.name}"?`);
  if (!confirmed) {
    return;
  }

  const childrenIds = getDescendantIds(itemId);
  const idsToRemove = [itemId, ...childrenIds];

  for (const id of idsToRemove) {
    const removed = getItemById(id);
    if (removed?.url) {
      URL.revokeObjectURL(removed.url);
    }
    await dbDelete(id);
  }

  state.items = state.items.filter((item) => !idsToRemove.includes(item.id));
  if (idsToRemove.includes(state.selectedItemId)) {
    state.selectedItemId = null;
  }

  if (state.currentFolderId && !getItemById(state.currentFolderId)) {
    state.currentFolderId = null;
  }

  renderAll();
}

async function loadFromDatabase() {
  const storedItems = await dbGetAll();
  storedItems.sort((a, b) => b.createdAt - a.createdAt);

  state.items = storedItems.map((record) => {
    const type = record.type || (record.category === "videos" ? "video" : "image");
    const item = {
      id: record.id,
      name: record.name,
      size: record.size,
      mimeType: record.mimeType || "",
      type,
      category: record.category || (type === "video" ? "videos" : "imagens"),
      parentId: record.parentId || null,
      createdAt: record.createdAt,
      blob: record.blob,
    };
    if (type === "image" || type === "video") {
      item.url = URL.createObjectURL(record.blob);
    }
    return item;
  });
}

function bindEvents() {
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => setTab(tab.dataset.tab));
  });

  backBtn.addEventListener("click", goBack);
  fabToggleBtn.addEventListener("click", toggleFabMenu);
  fabAddPhoto.addEventListener("click", () => {
    setTab("imagens");
    fileInput.setAttribute("accept", ".jpg,.jpeg,.png,.gif,.webp");
    fileInput.click();
  });

  fabAddFolder.addEventListener("click", createFolder);
  fabEditName.addEventListener("click", triggerEditName);

  fileInput.addEventListener("change", async (event) => {
    await addFiles(event.target.files);
    fileInput.value = "";
    closeFabMenu();
  });

  imageGallery.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) {
      event.stopPropagation();
      const action = button.dataset.action;
      const itemId = button.dataset.id;
      if (!itemId) {
        return;
      }

      if (action === "edit") {
        await editItemName(itemId);
        return;
      }
      if (action === "delete") {
        await removeItem(itemId);
        return;
      }
      return;
    }

    const card = event.target.closest(".card");
    if (card) {
      const itemId = card.dataset.id;
      const itemType = card.dataset.type;
      if (itemType === "folder") {
        openFolder(itemId);
        return;
      }
      if (itemType === "image") {
        openLightboxById(itemId);
        return;
      }
      selectItem(itemId);
    }
  });

  videoGallery.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      const card = event.target.closest(".card");
      if (card) {
        toggleVideoPlayback(card.dataset.id);
      }
      return;
    }

    const action = button.dataset.action;
    const itemId = button.dataset.id;
    if (!itemId) {
      return;
    }

    if (action === "edit") {
      await editItemName(itemId);
      return;
    }
    if (action === "delete") {
      await removeItem(itemId);
    }
  });

  closeImageModal.addEventListener("click", closeImagePreview);
  prevImageBtn.addEventListener("click", goToPrevImage);
  nextImageBtn.addEventListener("click", goToNextImage);

  imageModal.addEventListener("click", (event) => {
    if (event.target === imageModal) {
      closeImagePreview();
    }
  });

  imageGallery.addEventListener("dragstart", (event) => {
    const card = event.target.closest(".card");
    if (!card || card.dataset.type !== "image") {
      return;
    }
    event.dataTransfer.setData("text/plain", card.dataset.id);
    event.dataTransfer.effectAllowed = "move";
  });

  imageGallery.addEventListener("dragover", (event) => {
    const folderCard = event.target.closest(".folder-card");
    if (!folderCard) {
      return;
    }
    event.preventDefault();
    folderCard.classList.add("drop-target");
  });

  imageGallery.addEventListener("dragleave", (event) => {
    const folderCard = event.target.closest(".folder-card");
    if (folderCard) {
      folderCard.classList.remove("drop-target");
    }
  });

  imageGallery.addEventListener("drop", async (event) => {
    const folderCard = event.target.closest(".folder-card");
    if (!folderCard) {
      return;
    }
    event.preventDefault();
    folderCard.classList.remove("drop-target");
    const imageId = event.dataTransfer.getData("text/plain");
    const folderId = folderCard.dataset.id;
    if (!imageId || !folderId) {
      return;
    }
    await moveImageToFolder(imageId, folderId);
  });

  window.addEventListener("click", (event) => {
    if (!fabMenu.contains(event.target) && event.target !== fabToggleBtn) {
      closeFabMenu();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!imageModal.hidden) {
        closeImagePreview();
      }
      closeFabMenu();
    }

    if (imageModal.hidden) {
      return;
    }

    if (event.key === "ArrowLeft") {
      goToPrevImage();
    }

    if (event.key === "ArrowRight") {
      goToNextImage();
    }
  });
}

window.addEventListener("beforeunload", () => {
  state.items.forEach((item) => {
    if (item.url) {
      URL.revokeObjectURL(item.url);
    }
  });
});

function startClock() {
  const clockEl = document.getElementById("clock");
  if (!clockEl) {
    return;
  }
  const tick = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    clockEl.textContent = `${hh}:${mm}:${ss}`;
  };
  tick();
  setInterval(tick, 1000);
}

async function init() {
  try {
    startClock();
    db = await openDatabase();
    await loadFromDatabase();
    bindEvents();
    updateInputAccept();
    renderAll();
  } catch (error) {
    console.error("Falha ao inicializar galeria:", error);
    window.alert("Nao foi possivel iniciar a galeria persistente neste navegador.");
  }
}

init();
