/* pastas.js
 * Lógica específica para gerenciamento de pastas e navegação dentro das pastas
 */

function getFolderPath() {
  const path = [];
  let folder = getItemById(state.currentFolderId);
  while (folder) {
    path.unshift(folder.name);
    folder = getItemById(folder.parentId);
  }
  return path.length ? path.join(" / ") : "";
}

function updateFolderPath() {
  folderPath.textContent = getFolderPath();
}

function updateBackButton() {
  const hasActiveFolder = state.currentFolderId !== null && getItemById(state.currentFolderId);
  backBtn.hidden = !hasActiveFolder;
  backBtn.style.display = hasActiveFolder ? "inline-flex" : "none";
}

function updateToolbarView() {
  const isRoot = !state.currentFolderId;
  if (!toolbar) {
    return;
  }
  toolbar.classList.toggle("root-view", isRoot);
  toolbar.classList.toggle("folder-view", !isRoot);
  const viewToggle = document.querySelector(".view-toggle");
  if (viewToggle) {
    viewToggle.hidden = false;
    viewToggle.style.display = isRoot ? "none" : "flex";
  }
}

function getCoverImageForFolder(folder) {
  if (!folder?.coverId) {
    return null;
  }
  return getItemById(folder.coverId);
}

async function setFolderCover(folderId) {
  const folder = getItemById(folderId);
  if (!folder) {
    return;
  }
  const availableImages = state.items.filter((item) => item.parentId === folderId && item.type === "image");
  if (!availableImages.length) {
    showToast("Não há imagens nesta pasta para usar como capa", "warning");
    return;
  }

  showItemSelectionModal(
    "Definir capa da pasta",
    `Escolha a imagem que será usada como capa de "${folder.name}"`,
    availableImages,
    async (item) => {
      folder.coverId = item.id;
      const record = {
        id: folder.id,
        name: folder.name,
        size: folder.size,
        mimeType: folder.mimeType || "",
        type: folder.type,
        category: folder.category,
        parentId: folder.parentId,
        createdAt: folder.createdAt,
        coverId: folder.coverId,
        ownerId: folder.ownerId || state.currentUserId,
      };
      if (folder.blob) {
        record.blob = folder.blob;
      }
      await dbPut(record);
      showToast(`Capa definida para "${folder.name}"`, "success");
      renderAll();
    }
  );
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

async function createFolder() {
  showInputModal(
    "Criar Nova Pasta",
    "Digite o nome da pasta:",
    "",
    async (folderName) => {
      if (!folderName) {
        showToast("Nome da pasta não pode estar vazio", "warning");
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
        ownerId: state.currentUserId,
      };

      await dbPut(record);
      state.items.unshift(record);
      showToast(`Pasta "${folderName}" criada com sucesso!`, "success");
      renderAll();
    }
  );
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
