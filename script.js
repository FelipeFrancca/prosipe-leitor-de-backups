async function processZip(zip, fileTree) {
  fileTree.innerHTML = "";
  const loadingIndicator = document.getElementById("loadingMessage");
  loadingIndicator.style.display = "block";

  const folders = {};
  const filesByFolder = {};

  try {
    const fileNames = Object.keys(zip.files);
    const chunkSize = 100;
    const progressBar = document.getElementById("progressBar");
    const progressBarFill = document.getElementById("progressBarFill");

    progressBar.style.display = "block";

    for (let i = 0; i < fileNames.length; i += chunkSize) {
      const chunk = fileNames.slice(i, i + chunkSize);
      const progress = Math.min(100, Math.round((i / fileNames.length) * 100));
      progressBarFill.style.width = `${progress}%`;

      await new Promise((resolve) => {
        setTimeout(async () => {
          for (const fileName of chunk) {
            const fileData = zip.files[fileName];

            if (
              fileName.startsWith("__MACOSX") ||
              fileName.includes(".DS_Store")
            ) {
              continue;
            }

            const pathParts = fileName
              .split("/")
              .filter((part) => part.trim() !== "");
            const isFolder = fileName.endsWith("/") || fileData.dir;
            const parentPath = pathParts.slice(0, -1).join("/");
            const fileOrFolderName = pathParts[pathParts.length - 1];

            if (isFolder && !fileOrFolderName) continue;

            if (!isFolder && fileOrFolderName) {
              if (!filesByFolder[parentPath || "root"]) {
                filesByFolder[parentPath || "root"] = [];
              }
              filesByFolder[parentPath || "root"].push({
                name: fileOrFolderName,
                data: fileData,
                fullPath: fileName,
              });
            }

            if (parentPath && !folders[parentPath]) {
              folders[parentPath] = createFolderStructure(
                parentPath,
                fileTree,
                folders
              );
            }

            if (isFolder && fileOrFolderName) {
              const folderPath = parentPath
                ? `${parentPath}/${fileOrFolderName}`
                : fileOrFolderName;
              if (!folders[folderPath]) {
                const parentElement = parentPath
                  ? folders[parentPath]
                  : fileTree;
                folders[folderPath] = createFolder(
                  fileOrFolderName,
                  parentElement
                );
              }
            }
          }

          loadingIndicator.textContent = `Processando ${i + chunk.length} de ${
            fileNames.length
          } arquivos...`;

          resolve();
        }, 0);
      });
    }

    let totalPdfCount = 0;
    const folderPdfCounts = {};

    for (const [folderPath, files] of Object.entries(filesByFolder)) {
      let pdfCount = 0;
      for (const file of files) {
        if (file.name.toLowerCase().endsWith(".pdf")) {
          pdfCount++;
          totalPdfCount++;
        }
      }
      folderPdfCounts[folderPath] = pdfCount;
    }

    for (const [folderPath, files] of Object.entries(filesByFolder)) {
      const parentElement =
        folderPath === "root" ? fileTree : folders[folderPath];
      if (!parentElement) continue;

      const fileGrid = document.createElement("div");
      fileGrid.classList.add("file-grid");
      fileGrid.setAttribute("data-folder-path", folderPath);

      const pdfCount = folderPdfCounts[folderPath] || 0;
      if (pdfCount > 0) {
        const selectAllControl = document.createElement("div");
        selectAllControl.classList.add("folder-controls");

        const selectAllWrapper = document.createElement("div");
        selectAllWrapper.classList.add("select-all-wrapper");

        const selectAllCheckbox = document.createElement("input");
        selectAllCheckbox.type = "checkbox";
        selectAllCheckbox.classList.add("select-all-checkbox");
        selectAllCheckbox.setAttribute("data-folder-path", folderPath);

        const selectAllLabel = document.createElement("label");
        selectAllLabel.textContent = `Selecionar todos os PDFs (${pdfCount})`;
        selectAllLabel.classList.add("select-all-label");

        selectAllWrapper.appendChild(selectAllCheckbox);
        selectAllWrapper.appendChild(selectAllLabel);
        selectAllControl.appendChild(selectAllWrapper);

        parentElement.appendChild(selectAllControl);

        selectAllCheckbox.addEventListener("change", function () {
          const visibleCheckboxes = Array.from(
            fileGrid.querySelectorAll(".pdf-checkbox")
          ).filter((checkbox) => {
            const fileElement = checkbox.closest(".pdf-file");
            return fileElement.style.display !== "none";
          });

          visibleCheckboxes.forEach((checkbox) => {
            checkbox.checked = this.checked;
          });

          updateDownloadButtonState();
        });
      }

      parentElement.appendChild(fileGrid);

      for (const file of files) {
        if (file.name.endsWith(".zip")) {
          await processInnerZip(file.data, file.name, parentElement);
        } else if (file.name.toLowerCase().endsWith(".pdf")) {
          createPdfFile(file.data, file.name, fileGrid);
        } else {
          createGenericFile(file.name, fileGrid);
        }
      }
    }

    progressBar.style.display = "none";

    if (totalPdfCount > 0) {
      const globalSelectAllControl = document.createElement("div");
      globalSelectAllControl.classList.add("folder-controls");
      globalSelectAllControl.style.marginLeft = "0";
      globalSelectAllControl.style.padding = "10px";
      globalSelectAllControl.style.backgroundColor = "#f0f2f5";
      globalSelectAllControl.style.borderRadius = "6px";
      globalSelectAllControl.style.marginBottom = "15px";

      const globalSelectAllWrapper = document.createElement("div");
      globalSelectAllWrapper.classList.add("select-all-wrapper");
      globalSelectAllWrapper.style.backgroundColor = "transparent";

      const globalSelectAllCheckbox = document.createElement("input");
      globalSelectAllCheckbox.type = "checkbox";
      globalSelectAllCheckbox.id = "globalSelectAll";
      globalSelectAllCheckbox.classList.add("select-all-checkbox");

      const globalSelectAllLabel = document.createElement("label");
      globalSelectAllLabel.textContent = `Selecionar todos os ${totalPdfCount} PDFs`;
      globalSelectAllLabel.id = "globalSelectAllLabel";
      globalSelectAllLabel.style.fontWeight = "bold";

      globalSelectAllWrapper.appendChild(globalSelectAllCheckbox);
      globalSelectAllWrapper.appendChild(globalSelectAllLabel);
      globalSelectAllControl.appendChild(globalSelectAllWrapper);

      const treeView = document.querySelector(".tree-view");
      treeView.insertBefore(globalSelectAllControl, treeView.firstChild);

      globalSelectAllCheckbox.addEventListener("change", function () {
        const visiblePdfCheckboxes = Array.from(
          document.querySelectorAll(".pdf-checkbox")
        ).filter((checkbox) => {
          const fileElement = checkbox.closest(".pdf-file");
          return fileElement.style.display !== "none";
        });

        visiblePdfCheckboxes.forEach((checkbox) => {
          checkbox.checked = this.checked;
        });

        const visibleFolderSelectAllCheckboxes = Array.from(
          document.querySelectorAll(".folder-controls .select-all-checkbox")
        ).filter((checkbox) => {
          const folderPath = checkbox.getAttribute("data-folder-path");
          if (!folderPath) return false;

          const fileGrid = document.querySelector(
            `.file-grid[data-folder-path="${folderPath}"]`
          );
          if (!fileGrid) return false;

          const visiblePdfs = Array.from(
            fileGrid.querySelectorAll(".pdf-file")
          ).filter((pdf) => pdf.style.display !== "none");

          return visiblePdfs.length > 0;
        });

        visibleFolderSelectAllCheckboxes.forEach((checkbox) => {
          checkbox.checked = this.checked;
        });

        updateDownloadButtonState();
      });
    }
  } catch (error) {
    console.error("Error processing ZIP:", error);
    Swal.fire({
      icon: "error",
      title: "Erro ao processar o ZIP",
      text: `${error.message}. O arquivo pode estar corrompido ou ser muito grande.`,
    });
  } finally {
    loadingIndicator.style.display = "none";
    document.getElementById("searchInput").disabled = false;
    document.getElementById("progressBar").style.display = "none";
  }
}

function createFolderStructure(path, rootElement, existingFolders) {
  const parts = path.split("/");
  let currentPath = "";
  let parentElement = rootElement;

  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;

    if (!existingFolders[currentPath]) {
      existingFolders[currentPath] = createFolder(part, parentElement);
    }

    parentElement = existingFolders[currentPath];
  }

  return parentElement;
}

function createFolder(folderName, parentElement) {
  const folderElement = document.createElement("div");
  folderElement.classList.add("folder");

  const toggleBtn = document.createElement("i");
  toggleBtn.classList.add("fas", "fa-chevron-right", "toggle-btn");
  toggleBtn.style.cursor = "pointer";

  const folderSpan = document.createElement("span");
  folderSpan.innerHTML = `<i class="fas fa-folder"></i> ${folderName}`;

  folderElement.appendChild(toggleBtn);
  folderElement.appendChild(folderSpan);

  const subTree = document.createElement("div");
  subTree.classList.add("sub-tree");
  subTree.style.display = "none";

  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = subTree.style.display === "block";
    subTree.style.display = isOpen ? "none" : "block";
    toggleBtn.classList.toggle("fa-chevron-down", !isOpen);
    toggleBtn.classList.toggle("fa-chevron-right", isOpen);
  });

  folderElement.addEventListener("click", (e) => {
    if (!e.target.classList.contains("toggle-btn")) {
      const isOpen = subTree.style.display === "block";
      subTree.style.display = isOpen ? "none" : "block";
      toggleBtn.classList.toggle("fa-chevron-down", !isOpen);
      toggleBtn.classList.toggle("fa-chevron-right", isOpen);
    }
  });

  parentElement.appendChild(folderElement);
  parentElement.appendChild(subTree);

  return subTree;
}

async function processInnerZip(fileData, fileName, parentElement) {
  const zipElement = document.createElement("div");
  zipElement.classList.add("file");
  zipElement.innerHTML = `<i class="fas fa-file-archive"></i> ${fileName} (Extraindo...)`;

  parentElement.appendChild(zipElement);

  try {
    const zipContent = await fileData.async("arraybuffer");
    const newZip = await JSZip.loadAsync(zipContent);

    if (!newZip.files || Object.keys(newZip.files).length === 0) {
      zipElement.innerHTML = `<i class="fas fa-file-archive"></i> ${fileName} (ZIP vazio ou inválido)`;
      return;
    }

    const subTree = createFolder(fileName, parentElement);
    await processZip(newZip, subTree);
    zipElement.innerHTML = `<i class="fas fa-file-archive"></i> ${fileName} (Extraído)`;

    zipElement.remove();
  } catch (error) {
    console.error("Erro ao extrair ZIP:", error);
    zipElement.innerHTML = `<i class="fas fa-file-archive"></i> ${fileName} (Erro ao extrair)`;
  }
}

function createPdfFile(fileData, fileName, parentElement) {
  const fileElement = document.createElement("div");
  fileElement.classList.add("pdf-file");

  fileElement.innerHTML = `
    <div class="pdf-card">
      <input type="checkbox" class="pdf-checkbox">
      <img src="./assets/img/pdf.png" alt="PDF" class="pdf-thumbnail">
      <span class="pdf-name">${fileName}</span>
    </div>
  `;

  fileElement.addEventListener("click", async (event) => {
    if (event.target.tagName !== "INPUT") {
      try {
        const pdfBlob = await fileData.async("blob");
        const pdfUrl = URL.createObjectURL(pdfBlob);
        openPdfModal(pdfUrl, fileName);
      } catch (error) {
        console.error("Error loading PDF:", error);
        Swal.fire({
          icon: "error",
          title: "Erro ao abrir o PDF",
          text: "Não foi possível carregar o arquivo. Ele pode estar corrompido.",
        });
      }
    }
  });

  fileElement.fileData = fileData;
  fileElement.fileName = fileName;
  parentElement.appendChild(fileElement);

  updateDownloadButtonState();
}

function createGenericFile(fileName, parentElement) {
  const fileElement = document.createElement("div");
  fileElement.classList.add("generic-file");

  let iconClass = "fa-file";
  const extension = fileName.split(".").pop().toLowerCase();

  if (extension === "doc" || extension === "docx") {
    iconClass = "fa-file-word";
  } else if (extension === "xls" || extension === "xlsx") {
    iconClass = "fa-file-excel";
  } else if (extension === "ppt" || extension === "pptx") {
    iconClass = "fa-file-powerpoint";
  } else if (
    extension === "jpg" ||
    extension === "jpeg" ||
    extension === "png" ||
    extension === "gif"
  ) {
    iconClass = "fa-file-image";
  } else if (extension === "txt") {
    iconClass = "fa-file-lines";
  }

  fileElement.innerHTML = `<i class="fas ${iconClass}"></i> ${fileName}`;
  parentElement.appendChild(fileElement);
}

function openPdfModal(pdfUrl, fileName) {
  const pdfViewer = document.getElementById("pdfViewer");
  const modalTitle =
    document.getElementById("modalTitle") || document.createElement("h2");

  if (!document.getElementById("modalTitle")) {
    modalTitle.id = "modalTitle";
    document
      .querySelector(".modal-content")
      .insertBefore(
        modalTitle,
        document.querySelector(".modal-content").firstChild
      );
  }

  modalTitle.textContent = fileName;
  pdfViewer.src = pdfUrl;
  pdfViewer.type = "application/pdf";
  document.getElementById("pdfModal").style.display = "flex";
}

function closeModal() {
  document.getElementById("pdfModal").style.display = "none";
  const pdfViewer = document.getElementById("pdfViewer");
  if (pdfViewer.src) {
    URL.revokeObjectURL(pdfViewer.src);
    pdfViewer.src = "";
  }
}

function updateDownloadButtonState() {
  const checkboxes = document.querySelectorAll(".pdf-checkbox:checked");
  const downloadButton = document.getElementById("downloadSelected");
  downloadButton.disabled = checkboxes.length === 0;
  downloadButton.textContent = `Baixar ${checkboxes.length} PDFs Selecionados`;
}

function updateSelectAllCheckboxes() {
  document
    .querySelectorAll(".folder-controls .select-all-checkbox")
    .forEach((selectAllCheckbox) => {
      if (selectAllCheckbox.id === "globalSelectAll") {
        const visiblePdfCheckboxes = Array.from(
          document.querySelectorAll(".pdf-checkbox")
        ).filter((checkbox) => {
          const fileElement = checkbox.closest(".pdf-file");
          return fileElement.style.display !== "none";
        });

        const checkedVisiblePdfCheckboxes = visiblePdfCheckboxes.filter(
          (checkbox) => checkbox.checked
        );

        selectAllCheckbox.checked =
          visiblePdfCheckboxes.length > 0 &&
          visiblePdfCheckboxes.length === checkedVisiblePdfCheckboxes.length;

        const globalSelectAllLabel = document.getElementById(
          "globalSelectAllLabel"
        );
        if (globalSelectAllLabel) {
          globalSelectAllLabel.textContent = `Selecionar todos os ${visiblePdfCheckboxes.length} PDFs`;
        }
      } else {
        const folderPath = selectAllCheckbox.getAttribute("data-folder-path");
        if (!folderPath) return;

        const fileGrid = document.querySelector(
          `.file-grid[data-folder-path="${folderPath}"]`
        );
        if (!fileGrid) return;

        const visiblePdfCheckboxes = Array.from(
          fileGrid.querySelectorAll(".pdf-checkbox")
        ).filter((checkbox) => {
          const fileElement = checkbox.closest(".pdf-file");
          return fileElement.style.display !== "none";
        });

        const checkedVisiblePdfCheckboxes = visiblePdfCheckboxes.filter(
          (checkbox) => checkbox.checked
        );

        selectAllCheckbox.checked =
          visiblePdfCheckboxes.length > 0 &&
          visiblePdfCheckboxes.length === checkedVisiblePdfCheckboxes.length;

        const selectAllLabel =
          selectAllCheckbox.parentElement.querySelector(".select-all-label");
        if (selectAllLabel) {
          selectAllLabel.textContent = `Selecionar todos os PDFs (${visiblePdfCheckboxes.length})`;
        }
      }
    });
}

document
  .getElementById("zipInput")
  .addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileSizeInGB = file.size / (1024 * 1024 * 1024);

    if (fileSizeInGB > 10) {
      Swal.fire({
        icon: "warning",
        title: "Arquivo muito grande",
        text: "O arquivo ZIP tem mais de 10GB e pode causar instabilidade no navegador.",
        showCancelButton: true,
        confirmButtonText: "Continuar mesmo assim",
        cancelButtonText: "Cancelar",
      }).then((result) => {
        if (result.isConfirmed) {
          processZipFile(file);
        }
      });
    } else {
      processZipFile(file);
    }
  });

function processZipFile(file) {
  const reader = new FileReader();
  const fileTree = document.getElementById("fileTree");

  Swal.fire({
    title: "Carregando ZIP...",
    html: "Por favor, aguarde enquanto os arquivos estão sendo processados.",
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });

  JSZip.loadAsync(file)
    .then(async (zip) => {
      await processZip(zip, fileTree);
      Swal.close();
    })
    .catch((error) => {
      console.error("Error loading ZIP:", error);
      Swal.fire({
        icon: "error",
        title: "Erro ao processar o ZIP",
        text: error.message,
      });
    });
}

document
  .getElementById("downloadSelected")
  .addEventListener("click", async () => {
    const checkboxes = document.querySelectorAll(".pdf-checkbox:checked");
    if (checkboxes.length === 0) return;

    const totalFiles = checkboxes.length;

    Swal.fire({
      title: "Preparando Download...",
      html: `Preparando ${totalFiles} arquivos para download...`,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      const zip = new JSZip();
      let processedFiles = 0;

      for (const checkbox of checkboxes) {
        const fileElement = checkbox.closest(".pdf-file");
        const fileData = fileElement.fileData;

        const documentNumber = processedFiles + 1;
        const newFileName = `Documento_${documentNumber}.pdf`;

        try {
          const blob = await fileData.async("blob");
          zip.file(newFileName, blob);

          processedFiles++;
          Swal.update({
            html: `Preparando ${processedFiles} de ${totalFiles} arquivos...`,
          });
        } catch (error) {
          console.error(`Error processing file:`, error);
        }
      }

      Swal.update({
        html: "Gerando arquivo ZIP...",
      });

      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: {
          level: 5,
        },
      });

      const currentDate = new Date();
      const dateString = `${currentDate.getFullYear()}-${(
        currentDate.getMonth() + 1
      )
        .toString()
        .padStart(2, "0")}-${currentDate
        .getDate()
        .toString()
        .padStart(2, "0")}`;

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PROSIPE_PDFs_${dateString}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      Swal.fire({
        icon: "success",
        title: "Download Concluído",
        text: `${totalFiles} arquivos foram baixados com sucesso.`,
      });
    } catch (error) {
      console.error("Error generating ZIP for download:", error);
      Swal.fire({
        icon: "error",
        title: "Erro ao gerar o ZIP",
        text: error.message,
      });
    }
  });

document.addEventListener("change", function (e) {
  if (e.target && e.target.classList.contains("pdf-checkbox")) {
    updateDownloadButtonState();
    updateSelectAllCheckboxes();
  }
});

document.getElementById("searchInput").addEventListener("input", function () {
  const searchTerm = removeAccents(this.value.toLowerCase().trim());

  if (searchTerm === "") {
    document
      .querySelectorAll(".file, .folder, .pdf-file, .generic-file")
      .forEach((element) => {
        element.style.display = "";
      });
    document.querySelectorAll(".sub-tree").forEach((subTree) => {
      subTree.style.display = "none";
    });

    updateSelectAllCheckboxes();
    return;
  }

  const allElements = document.querySelectorAll(
    ".pdf-file, .generic-file, .folder"
  );
  let hasMatches = false;

  allElements.forEach((element) => {
    element.style.display = "none";
  });

  document.querySelectorAll(".sub-tree").forEach((subTree) => {
    subTree.style.display = "none";
  });

  allElements.forEach((element) => {
    const text = removeAccents(element.innerText.toLowerCase());

    if (text.includes(searchTerm)) {
      element.style.display = "";
      hasMatches = true;

      let parent = element.parentElement;
      while (parent) {
        if (parent.classList.contains("sub-tree")) {
          parent.style.display = "block";

          const folderElement = parent.previousElementSibling;
          if (folderElement && folderElement.classList.contains("folder")) {
            const toggleBtn = folderElement.querySelector(".toggle-btn");
            if (toggleBtn) {
              toggleBtn.classList.remove("fa-chevron-right");
              toggleBtn.classList.add("fa-chevron-down");
            }
            folderElement.style.display = "";
          }
        }
        parent = parent.parentElement;
      }
    }
  });

  updateSelectAllCheckboxes();

  if (!hasMatches) {
    Swal.fire({
      icon: "info",
      title: "Nenhum resultado",
      text: "Não foi encontrado nenhum arquivo ou pasta correspondente à pesquisa.",
      timer: 2000,
      timerProgressBar: true,
      showConfirmButton: false,
    });
  }
});

function removeAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

window.onclick = function (event) {
  const modal = document.getElementById("pdfModal");
  if (event.target === modal) {
    closeModal();
  }
};

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    const modal = document.getElementById("pdfModal");
    if (modal.style.display === "flex" || modal.style.display === "block") {
      closeModal();
    }
  }
});

document.getElementById("downloadSelected").disabled = true;
document.getElementById("searchInput").disabled = true;
