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

const panels = {
  imagens: document.getElementById("panel-imagens"),
};

const imageGallery = document.getElementById("imageGallery");
const emptyImages = document.getElementById("emptyImages");
const backBtn = document.getElementById("backBtn");
const viewImagesBtn = document.getElementById("viewImagesBtn");
const viewVideosBtn = document.getElementById("viewVideosBtn");
const folderPath = document.getElementById("folderPath");
const toolbar = document.querySelector(".toolbar");
const fileInput = document.getElementById("fileInput");
const logoutBtn = document.getElementById("logoutBtn");
const userEmail = document.getElementById("userEmail");


const imageModal = document.getElementById("imageModal");
const lightboxContent = document.getElementById("lightboxContent");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxVideo = document.getElementById("lightboxVideo");
const lightboxCaption = document.getElementById("lightboxCaption");
const closeImageModal = document.getElementById("closeImageModal");
const prevImageBtn = document.getElementById("prevImageBtn");
const nextImageBtn = document.getElementById("nextImageBtn");

const fabToggleBtn = document.getElementById("fabToggleBtn");
const fabMenu = document.getElementById("fabMenu");
const fabAddPhoto = document.getElementById("fabAddPhoto");
const fabAddVideo = document.getElementById("fabAddVideo");
const fabAddFolder = document.getElementById("fabAddFolder");
const fabEditName = document.getElementById("fabEditName");
const fabDeleteItem = document.getElementById("fabDeleteItem");

const state = {
  currentFolderId: null,
  selectedItemId: null,
  currentUserId: null,
  items: [],
  lightboxIndex: -1,
  viewMode: "imagens",
};

let db;

function openDatabase() {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const connection = event.target.result;
        if (!connection.objectStoreNames.contains(STORE_NAME)) {
          connection.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => {
        console.error("Erro ao abrir IndexedDB:", event.target.error);
        reject(event.target.error);
      };
      
      request.onblocked = () => {
        console.warn("Requisição IndexedDB bloqueada");
      };
    } catch (err) {
      console.error("Exceção ao tentar abrir IndexedDB:", err);
      reject(err);
    }
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

/* ============================================
 * TOAST & MODAL NOTIFICATION SYSTEM
 * ============================================ */

// Ensure toast container exists
function ensureToastContainer() {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  return container;
}

function showToast(message, type = "info", duration = 3000) {
  const container = ensureToastContainer();
  const toast = document.createElement("div");
  const typeClass = type === "success" ? "toast-success" : type === "error" ? "toast-error" : type === "warning" ? "toast-warning" : "toast-info";
  toast.className = `toast ${typeClass}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("removing");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function showConfirmModal(title, message, onConfirm, onCancel) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const dialog = document.createElement("div");
  dialog.className = "modal-dialog";

  dialog.innerHTML = `
    <div class="modal-header">
      <h2>${title}</h2>
    </div>
    <div class="modal-body">
      <p>${message}</p>
    </div>
    <div class="modal-footer">
      <button class="modal-btn modal-btn-secondary cancel-btn">Cancelar</button>
      <button class="modal-btn modal-btn-primary confirm-btn">Confirmar</button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  function cleanup() {
    overlay.classList.add("removing");
    setTimeout(() => overlay.remove(), 300);
  }

  dialog.querySelector(".confirm-btn").addEventListener("click", () => {
    cleanup();
    if (onConfirm) onConfirm();
  });

  dialog.querySelector(".cancel-btn").addEventListener("click", () => {
    cleanup();
    if (onCancel) onCancel();
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      cleanup();
      if (onCancel) onCancel();
    }
  });
}

function showInputModal(title, message, initialValue = "", onConfirm, onCancel) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const dialog = document.createElement("div");
  dialog.className = "modal-dialog";

  dialog.innerHTML = `
    <div class="modal-header">
      <h2>${title}</h2>
    </div>
    <div class="modal-body">
      <p>${message}</p>
      <input type="text" class="input-field" placeholder="Digite aqui..." value="${initialValue.replace(/"/g, '&quot;')}" />
    </div>
    <div class="modal-footer">
      <button class="modal-btn modal-btn-secondary cancel-btn">Cancelar</button>
      <button class="modal-btn modal-btn-primary confirm-btn">Confirmar</button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const inputField = dialog.querySelector(".input-field");
  inputField.focus();
  inputField.select();

  function cleanup() {
    overlay.classList.add("removing");
    setTimeout(() => overlay.remove(), 300);
  }

  dialog.querySelector(".confirm-btn").addEventListener("click", () => {
    const value = inputField.value.trim();
    cleanup();
    if (onConfirm) onConfirm(value);
  });

  dialog.querySelector(".cancel-btn").addEventListener("click", () => {
    cleanup();
    if (onCancel) onCancel();
  });

  inputField.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const value = inputField.value.trim();
      cleanup();
      if (onConfirm) onConfirm(value);
    }
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      cleanup();
      if (onCancel) onCancel();
    }
  });
}

function showItemSelectionModal(title, message, items, onSelect, onCancel) {
  if (!items.length) {
    showToast("Nenhum item disponível para editar", "warning");
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const dialog = document.createElement("div");
  dialog.className = "modal-dialog";

  let itemsHtml = items.map((item, index) => {
    const icon = item.type === "folder" ? "📁" : (item.category === "videos" ? "🎥" : "🖼️");
    return `
      <div class="item-option" data-index="${index}">
        <span class="item-option-icon">${icon}</span>
        <div class="item-option-text">
          <div class="item-option-name">${item.name}</div>
          <div class="item-option-type">${item.type === "folder" ? "Pasta" : (item.category === "videos" ? "Vídeo" : "Imagem")}</div>
        </div>
      </div>
    `;
  }).join("");

  dialog.innerHTML = `
    <div class="modal-header">
      <h2>${title}</h2>
    </div>
    <div class="modal-body">
      <p>${message}</p>
      <div class="item-list">
        ${itemsHtml}
      </div>
    </div>
    <div class="modal-footer">
      <button class="modal-btn modal-btn-secondary cancel-btn">Cancelar</button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  function cleanup() {
    overlay.classList.add("removing");
    setTimeout(() => overlay.remove(), 300);
  }

  const itemOptions = dialog.querySelectorAll(".item-option");
  itemOptions.forEach((option) => {
    option.addEventListener("click", () => {
      const index = parseInt(option.dataset.index);
      cleanup();
      if (onSelect) onSelect(items[index]);
    });
  });

  dialog.querySelector(".cancel-btn").addEventListener("click", () => {
    cleanup();
    if (onCancel) onCancel();
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      cleanup();
      if (onCancel) onCancel();
    }
  });
}

function getFileExtension(fileName) {
  const split = fileName.split(".");
  return (split[split.length - 1] || "").toLowerCase();
}

function isAllowedFile(file) {
  const mime = (file.type || "").toLowerCase();
  const ext = getFileExtension(file.name);
  const allMimes = [
    ...ACCEPTED_MIME.imagens,
    ...ACCEPTED_MIME.videos,
  ];
  const allExts = [
    ...ACCEPTED_EXT.imagens,
    ...ACCEPTED_EXT.videos,
  ];
  return allMimes.includes(mime) || allExts.includes(ext);
}

function getFileType(file) {
  const mime = (file.type || "").toLowerCase();
  const ext = getFileExtension(file.name);
  
  if (ACCEPTED_MIME.imagens.includes(mime) || ACCEPTED_EXT.imagens.includes(ext)) {
    return "image";
  }
  if (ACCEPTED_MIME.videos.includes(mime) || ACCEPTED_EXT.videos.includes(ext)) {
    return "video";
  }
  return null;
}

function updateInputAccept() {
  const imageExts = ACCEPTED_EXT.imagens.map(e => `.${e}`).join(",");
  const videoExts = ACCEPTED_EXT.videos.map(e => `.${e}`).join(",");
  fileInput.setAttribute("accept", `${imageExts},${videoExts}`);
}

function openLightboxById(itemId) {
  const allItems = [
    ...getCurrentFolders().filter(f => f.type !== "folder"),
    ...getCurrentImages(),
    ...getCurrentVideos(),
  ].filter(item => item.type === "image" || item.type === "video");
  
  const index = allItems.findIndex((item) => item.id === itemId);
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
  const allItems = [
    ...getCurrentFolders().filter(f => f.type !== "folder"),
    ...getCurrentImages(),
    ...getCurrentVideos(),
  ].filter(item => item.type === "image" || item.type === "video");
  
  if (state.lightboxIndex >= allItems.length - 1) {
    return;
  }
  state.lightboxIndex += 1;
  updateLightbox();
}

function closeImagePreview() {
  imageModal.hidden = true;
  state.lightboxIndex = -1;
  lightboxImage.src = "";
  lightboxImage.hidden = true;
  lightboxVideo.src = "";
  lightboxVideo.hidden = true;
  lightboxCaption.textContent = "";
}

function updateLightbox() {
  const allItems = [
    ...getCurrentFolders().filter(f => f.type !== "folder"),
    ...getCurrentImages(),
    ...getCurrentVideos(),
  ].filter(item => item.type === "image" || item.type === "video");
  
  if (allItems.length === 0 || state.lightboxIndex < 0 || state.lightboxIndex >= allItems.length) {
    closeImagePreview();
    return;
  }

  const current = allItems[state.lightboxIndex];
  
  if (current.type === "image") {
    lightboxImage.src = current.url;
    lightboxImage.alt = current.name;
    lightboxImage.hidden = false;
    lightboxVideo.hidden = true;
  } else if (current.type === "video") {
    lightboxVideo.src = current.url;
    lightboxVideo.hidden = false;
    lightboxImage.hidden = true;
  }
  
  lightboxCaption.textContent = `${current.name} (${state.lightboxIndex + 1}/${allItems.length})`;
  prevImageBtn.disabled = state.lightboxIndex === 0;
  nextImageBtn.disabled = state.lightboxIndex === allItems.length - 1;
}

function getItemById(id) {
  return state.items.find((item) => item.id === id) || null;
}

function updateViewToggle() {
  if (!viewImagesBtn || !viewVideosBtn) {
    return;
  }
  viewImagesBtn.classList.toggle("active", state.viewMode === "imagens");
  viewVideosBtn.classList.toggle("active", state.viewMode === "videos");
}

function setViewMode(mode) {
  if (state.viewMode === mode) {
    return;
  }
  state.viewMode = mode;
  updateViewToggle();
  renderAll();
}

function createGalleryDivider(label) {
  const divider = document.createElement("div");
  divider.className = "divider";
  const span = document.createElement("span");
  span.textContent = label;
  divider.append(span);
  return divider;
}

function selectItem(itemId) {
  const prev = document.querySelector('.card.selected');
  if (prev && prev.dataset.id !== itemId) {
    // Pausa vídeo que estava sendo reproduzido no cartão anterior
    const prevVideo = prev.querySelector('video');
    if (prevVideo && !prevVideo.paused) {
      try { prevVideo.pause(); prevVideo.currentTime = 0; } catch (e) { /* ignore */ }
    }
    prev.classList.remove('selected');
  }

  const card = document.querySelector(`.card[data-id="${itemId}"]`);
  if (card) {
    card.classList.add('selected');
    state.selectedItemId = itemId;
  } else {
    state.selectedItemId = null;
  }
}

function clearSelection() {
  const prev = document.querySelector('.card.selected');
  if (prev) {
    const prevVideo = prev.querySelector('video');
    if (prevVideo && !prevVideo.paused) {
      try { prevVideo.pause(); prevVideo.currentTime = 0; } catch (e) { /* ignore */ }
    }
    prev.classList.remove('selected');
  }
  state.selectedItemId = null;
}

function pauseUnselectedVideos() {
  const videos = document.querySelectorAll('.gallery-grid .card[data-type="video"] video');
  videos.forEach((video) => {
    const card = video.closest('.card');
    if (!card) return;
    if (!card.classList.contains('selected')) {
      try {
        if (!video.paused) video.pause();
        try { video.currentTime = 0; } catch (e) { /* ignore */ }
      } catch (e) { /* ignore */ }
    }
  });
}

function toggleFabMenu(event) {
  if (event) {
    event.stopPropagation();
  }
  const isOpen = !fabMenu.hidden;
  fabMenu.hidden = isOpen;
  fabToggleBtn.setAttribute("aria-expanded", String(!isOpen));
  fabToggleBtn.classList.toggle("open", !isOpen);
}

function closeFabMenu() {
  fabMenu.hidden = true;
  fabToggleBtn.setAttribute("aria-expanded", "false");
  fabToggleBtn.classList.remove("open");
}

async function addFiles(selectedFiles) {
  const files = Array.from(selectedFiles || []);
  if (files.length === 0) {
    return;
  }

  let addedCount = 0;
  let imageCount = 0;
  let videoCount = 0;
  const errors = [];

  for (const file of files) {
    if (!isAllowedFile(file)) {
      errors.push(`${file.name} - formato não suportado`);
      continue;
    }

    const fileType = getFileType(file);
    if (!fileType) {
      errors.push(`${file.name} - tipo desconhecido`);
      continue;
    }

    const record = {
      id: makeId(),
      name: file.name,
      size: file.size,
      mimeType: file.type,
      type: fileType,
      category: fileType === "image" ? "imagens" : "videos",
      parentId: state.currentFolderId,
      createdAt: Date.now(),
      blob: file,
      ownerId: state.currentUserId,
    };
    
    await dbPut(record);

    state.items.unshift({
      ...record,
      url: URL.createObjectURL(file),
    });

    addedCount++;
    if (fileType === "image") {
      imageCount++;
    } else {
      videoCount++;
    }
  }

  // Mostrar feedback
  if (addedCount > 0) {
    const parts = [];
    if (imageCount > 0) parts.push(`${imageCount} imagem${imageCount !== 1 ? "s" : ""}`);
    if (videoCount > 0) parts.push(`${videoCount} vídeo${videoCount !== 1 ? "s" : ""}`);
    showToast(`✓ ${parts.join(" e ")} adicionado${addedCount !== 1 ? "s" : ""}!`, "success");
  }

  if (errors.length > 0) {
    showToast(`⚠ ${errors.length} arquivo${errors.length !== 1 ? "s" : ""} com erro`, "warning");
  }

  renderAll();
}

async function editItemName(itemId) {
  const item = getItemById(itemId);
  if (!item) {
    return;
  }

  showInputModal(
    "Editar Nome",
    "Digite um novo nome:",
    item.name,
    async (newName) => {
      if (!newName || newName.trim() === item.name) {
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
        ownerId: item.ownerId || state.currentUserId,
      };

      if (item.coverId) {
        record.coverId = item.coverId;
      }
      if (item.blob) {
        record.blob = item.blob;
      }

      await dbPut(record);
      showToast(`Item renomeado para "${newName}"`, "success");
      renderAll();
    }
  );
}

function triggerEditName() {
  closeFabMenu();

  const availableItems = state.items.filter(item => 
    item.parentId === state.currentFolderId
  );

  if (!availableItems.length) {
    showToast("Nenhum item para editar", "warning");
    return;
  }

  if (state.selectedItemId) {
    // Se há item selecionado, editar direto
    editItemName(state.selectedItemId);
  } else {
    // Mostrar modal para selecionar qual item editar
    showItemSelectionModal(
      "Selecionar Item",
      "Qual item você deseja editar?",
      availableItems,
      (item) => {
        editItemName(item.id);
      }
    );
  }
}

async function triggerDeleteItem() {
  closeFabMenu();

  const availableItems = state.items.filter(item =>
    item.parentId === state.currentFolderId
  );

  if (!availableItems.length) {
    showToast("Nenhum item para excluir", "warning");
    return;
  }

  if (state.selectedItemId) {
    await removeItem(state.selectedItemId);
    return;
  }

  showItemSelectionModal(
    "Selecionar Item",
    "Qual item você deseja excluir?",
    availableItems,
    async (item) => {
      await removeItem(item.id);
    }
  );
}

function renderImageGallery() {
  imageGallery.innerHTML = "";

  const folders = getCurrentFolders();
  const images = getCurrentImages();
  const videos = getCurrentVideos();
  const items = [...folders];
  const isInsideFolder = state.currentFolderId !== null && getItemById(state.currentFolderId);
  const showImages = isInsideFolder ? state.viewMode === "imagens" : true;
  const showVideos = isInsideFolder ? state.viewMode === "videos" : true;

  if (showImages) {
    items.push(...images);
  }
  if (showVideos) {
    items.push(...videos);
  }

  if (isInsideFolder && showImages && showVideos && images.length > 0 && videos.length > 0) {
    items.length = folders.length;
    items.push(...images.sort((a, b) => b.createdAt - a.createdAt));
    items.push({ type: "divider", label: "Vídeos" });
    items.push(...videos.sort((a, b) => b.createdAt - a.createdAt));
  }

  items.forEach((item) => {
    if (item.type === "divider") {
      imageGallery.append(createGalleryDivider(item.label));
      return;
    }

    const card = document.createElement("article");
    card.className = "card";
    card.dataset.id = item.id;
    card.dataset.type = item.type;
    card.draggable = item.type === "image" || item.type === "video";

    if (item.id === state.selectedItemId) {
      card.classList.add("selected");
    }

    const mediaWrap = document.createElement("div");
    mediaWrap.className = "card-media-wrap";

    if (item.type === "folder") {
      card.classList.add("folder-card");

      const coverImage = getCoverImageForFolder(item);
      if (coverImage) {
        const img = document.createElement("img");
        img.src = coverImage.url;
        img.alt = `Capa da pasta ${item.name}`;
        mediaWrap.append(img);
      } else {
        const folderIcon = document.createElement("div");
        folderIcon.className = "folder-icon";
        folderIcon.textContent = "📁";
        mediaWrap.append(folderIcon);
      }
    } else if (item.type === "video") {
      const video = document.createElement("video");
      video.src = item.url;
      video.controls = true;
      video.preload = "metadata";
      video.className = "video-preview";
      mediaWrap.append(video);
    } else {
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = item.name;
      mediaWrap.append(img);
    }

    const body = document.createElement("div");
    body.className = "card-body";
    
    let subtitle = "";
    if (item.type === "folder") {
      const folderItems = state.items.filter(i => i.parentId === item.id && i.type !== "folder");
      const imageCount = folderItems.filter(i => i.type === "image").length;
      const videoCount = folderItems.filter(i => i.type === "video").length;
      const parts = [];
      if (imageCount > 0) parts.push(`${imageCount} imagem${imageCount !== 1 ? "s" : ""}`);
      if (videoCount > 0) parts.push(`${videoCount} vídeo${videoCount !== 1 ? "s" : ""}`);
      subtitle = parts.length > 0 ? parts.join(", ") : "Pasta vazia";
    } else {
      subtitle = formatSize(item.size);
    }
    
    body.innerHTML = `
      <p class="card-title" title="${item.name}">${makeCardTitle(item.name)}</p>
      <p class="card-sub">${subtitle}</p>
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

    actions.append(editBtn);

    if (item.type === "folder") {
      const coverBtn = document.createElement("button");
      coverBtn.className = "cover-btn";
      coverBtn.type = "button";
      coverBtn.textContent = "Capa";
      coverBtn.dataset.action = "cover";
      coverBtn.dataset.id = item.id;
      actions.append(coverBtn);
    }

    actions.append(deleteBtn);
    card.append(mediaWrap, body, actions);
    imageGallery.append(card);
  });

  const hasItems = items.length > 0;
  emptyImages.hidden = hasItems;

  if (!hasItems) {
    if (state.currentFolderId) {
      emptyImages.textContent = state.viewMode === "imagens" ? "Nenhuma imagem nesta pasta" : "Nenhum vídeo nesta pasta";
    } else {
      emptyImages.textContent = state.viewMode === "imagens" ? "Nenhuma imagem adicionada ainda" : "Nenhum vídeo adicionado ainda";
    }
  }
}


function renderAll() {
  renderImageGallery();
  updateFolderPath();
  updateBackButton();
  updateToolbarView();
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
    ownerId: item.ownerId || state.currentUserId,
  };
  if (item.blob) {
    record.blob = item.blob;
  }

  await dbPut(record);
  renderAll();
}

async function removeItem(itemId) {
  const item = getItemById(itemId);
  if (!item) {
    return;
  }

  showConfirmModal(
    "Confirmar Exclusão",
    `Tem certeza que deseja excluir "${item.name}"?`,
    async () => {
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

      showToast(`"${item.name}" foi excluído com sucesso!`, "error");
      renderAll();
    }
  );
}

async function loadFromDatabase() {
  const storedItems = await dbGetAll();
  storedItems.sort((a, b) => b.createdAt - a.createdAt);

  state.items = [];
  for (const record of storedItems) {
    if (!record.ownerId) {
      record.ownerId = state.currentUserId;
      await dbPut(record);
    }

    if (record.ownerId !== state.currentUserId) {
      continue;
    }

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
      coverId: record.coverId || null,
      ownerId: record.ownerId,
    };
    if (type === "image" || type === "video") {
      item.url = URL.createObjectURL(record.blob);
    }
    state.items.push(item);
  }
}

function bindEvents() {
  backBtn.addEventListener("click", goBack);
  fabToggleBtn.addEventListener("click", toggleFabMenu);
  viewImagesBtn.addEventListener("click", () => setViewMode("imagens"));
  viewVideosBtn.addEventListener("click", () => setViewMode("videos"));
  fabAddPhoto.addEventListener("click", () => {
    fileInput.setAttribute("accept", ".jpg,.jpeg,.png,.gif,.webp");
    fileInput.click();
  });

  fabAddVideo.addEventListener("click", () => {
    fileInput.setAttribute("accept", ".mp4,.webm,.ogg");
    fileInput.click();
  });

  fabAddFolder.addEventListener("click", createFolder);
  fabEditName.addEventListener("click", triggerEditName);
  fabDeleteItem.addEventListener("click", triggerDeleteItem);

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

      if (action === "cover") {
        await setFolderCover(itemId);
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
      if (itemType === "image" || itemType === "video") {
        openLightboxById(itemId);
        return;
      }
      selectItem(itemId);
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
    if (!card || card.dataset.type === "folder") {
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

    // Se o clique foi fora de qualquer card, limpa seleção (e pausa vídeo se houver)
    const clickedCard = event.target.closest && event.target.closest('.card');
    if (!clickedCard) {
      clearSelection();
    }
    // Pausa todos vídeos que não estão em cards selecionados
    pauseUnselectedVideos();
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
    const session = window.auth?.requireAuth();
    if (!session) {
      return;
    }
    state.currentUserId = session.userId;
    if (userEmail) {
      userEmail.textContent = session.email;
    }

    // Abrir DB e carregar os itens antes da primeira renderização
    db = await openDatabase();
    await loadFromDatabase();

    startClock();
    bindEvents();
    updateInputAccept();
    renderAll();
  } catch (error) {
    console.error("Falha ao inicializar galeria:", error);
    const errorMsg = error?.message || "Erro desconhecido";
    window.alert(`Não foi possível iniciar a galeria.\n\nDetalhes: ${errorMsg}\n\nTente atualizar a página ou usar outro navegador.`);
  }
}

init();
