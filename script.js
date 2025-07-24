// Sistema unificado de progresso
class ProgressManager {
  constructor() {
    this.loadingMessage = document.getElementById("loadingMessage");
    this.progressContainer = document.getElementById("progressContainer");
    this.progressText = document.getElementById("progressText");
    this.progressPercentage = document.getElementById("progressPercentage");
    this.progressBar = document.getElementById("progressBar");
    this.progressBarFill = document.getElementById("progressBarFill");
    this.progressDetails = document.getElementById("progressDetails");
    this.loadingText = document.getElementById("loadingText");
  }

  showLoading(message = "Carregando...") {
    this.loadingText.textContent = message;
    this.loadingMessage.style.display = "block";
    this.progressContainer.style.display = "none";
    document.getElementById("searchInput").disabled = true;
  }

  showProgress(text, percentage = 0, details = "") {
    this.loadingMessage.style.display = "none";
    this.progressContainer.style.display = "block";
    this.updateProgress(text, percentage, details);
  }

  updateProgress(text, percentage, details = "") {
    this.progressText.textContent = text;
    this.progressPercentage.textContent = `${Math.round(percentage)}%`;
    this.progressBarFill.style.width = `${percentage}%`;
    if (details) {
      this.progressDetails.textContent = details;
    }
  }

  hide() {
    this.loadingMessage.style.display = "none";
    this.progressContainer.style.display = "none";
    document.getElementById("searchInput").disabled = false;
  }
}

const progressManager = new ProgressManager();

async function processZip(zip, fileTree) {
  const folders = {};
  const filesByFolder = {};

  try {
    const fileNames = Object.keys(zip.files);
    const totalFiles = fileNames.length;
    
    if (totalFiles === 0) {
      throw new Error("O arquivo ZIP está vazio ou não contém arquivos válidos");
    }

    progressManager.showProgress("Analisando estrutura do arquivo", 0, `0 de ${totalFiles} arquivos processados`);

    const chunkSize = Math.max(10, Math.min(100, Math.floor(totalFiles / 20)));

    for (let i = 0; i < fileNames.length; i += chunkSize) {
      const chunk = fileNames.slice(i, i + chunkSize);
      const progress = Math.min(100, (i / fileNames.length) * 100);
      
      progressManager.updateProgress(
        "Processando arquivos do ZIP",
        progress,
        `${Math.min(i + chunkSize, totalFiles)} de ${totalFiles} arquivos processados`
      );

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
          resolve();
        }, 0);
      });
    }

    // Fase de criação da interface
    const folderEntries = Object.entries(filesByFolder);
    const totalFolders = folderEntries.length;
    let processedFolders = 0;

    progressManager.updateProgress(
      "Criando interface",
      90,
      "Organizando arquivos e pastas..."
    );

    for (const [folderPath, files] of folderEntries) {
      const parentElement =
        folderPath === "root" ? fileTree : folders[folderPath];
      if (!parentElement) continue;

      const fileGrid = document.createElement("div");
      fileGrid.classList.add("file-grid");
      fileGrid.setAttribute("data-folder-path", folderPath);

      // Contagem de PDFs na pasta
      const pdfFiles = files.filter(file => file.name.toLowerCase().endsWith(".pdf"));
      const pdfCount = pdfFiles.length;
      
      if (pdfCount > 0) {
        const selectAllControl = document.createElement("div");
        selectAllControl.classList.add("folder-controls");

        const selectAllWrapper = document.createElement("div");
        selectAllWrapper.classList.add("select-all-wrapper");

        const selectAllCheckbox = document.createElement("input");
        selectAllCheckbox.type = "checkbox";
        selectAllCheckbox.classList.add("select-all-checkbox", "folder-checkbox");
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

      processedFolders++;
      if (processedFolders % 5 === 0 || processedFolders === totalFolders) {
        progressManager.updateProgress(
          "Criando interface",
          90 + (processedFolders / totalFolders) * 10,
          `${processedFolders} de ${totalFolders} pastas processadas`
        );
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    progressManager.updateProgress("Finalizando", 100, "Processamento concluído!");
    await new Promise(resolve => setTimeout(resolve, 500));

    updateGlobalSelectAllControl();
  } catch (error) {
    console.error("Error processing ZIP:", error);
    Swal.fire({
      icon: "error",
      title: "Erro ao processar o ZIP",
      text: `${error.message}. O arquivo pode estar corrompido ou ser muito grande.`,
      confirmButtonColor: "#ff3500"
    });
  } finally {
    progressManager.hide();
  }
}

// Função para processar estrutura de pastas
async function processFolder(files, fileTree, folderName) {
  const folders = {};
  const filesByFolder = {};

  try {
    const totalFiles = files.length;
    
    if (totalFiles === 0) {
      throw new Error("A pasta está vazia ou não contém arquivos válidos");
    }

    progressManager.showProgress("Analisando estrutura da pasta", 0, `0 de ${totalFiles} arquivos processados`);

    const chunkSize = Math.max(10, Math.min(100, Math.floor(totalFiles / 20)));

    for (let i = 0; i < files.length; i += chunkSize) {
      const chunk = files.slice(i, i + chunkSize);
      const progress = Math.min(100, (i / files.length) * 100);
      
      progressManager.updateProgress(
        "Processando arquivos da pasta",
        progress,
        `${Math.min(i + chunkSize, totalFiles)} de ${totalFiles} arquivos processados`
      );

      await new Promise((resolve) => {
        setTimeout(async () => {
          for (const file of chunk) {
            // Obter o caminho relativo do arquivo
            const relativePath = file.webkitRelativePath;
            
            if (!relativePath) continue;

            const pathParts = relativePath
              .split("/")
              .filter((part) => part.trim() !== "");
            
            // Remove o nome da pasta raiz se existir
            if (pathParts.length > 0 && pathParts[0] === folderName) {
              pathParts.shift();
            }

            const parentPath = pathParts.slice(0, -1).join("/");
            const fileName = pathParts[pathParts.length - 1];

            if (!fileName) continue;

            // Adicionar arquivo à estrutura
            if (!filesByFolder[parentPath || "root"]) {
              filesByFolder[parentPath || "root"] = [];
            }
            filesByFolder[parentPath || "root"].push({
              name: fileName,
              file: file,
              fullPath: relativePath,
            });

            // Criar estrutura de pastas se necessário
            if (parentPath && !folders[parentPath]) {
              folders[parentPath] = createFolderStructure(
                parentPath,
                fileTree,
                folders
              );
            }
          }
          resolve();
        }, 0);
      });
    }

    // Fase de criação da interface
    const folderEntries = Object.entries(filesByFolder);
    const totalFolders = folderEntries.length;
    let processedFolders = 0;

    progressManager.updateProgress(
      "Criando interface",
      90,
      "Organizando arquivos e pastas..."
    );

    for (const [folderPath, files] of folderEntries) {
      const parentElement =
        folderPath === "root" ? fileTree : folders[folderPath];
      if (!parentElement) continue;

      const fileGrid = document.createElement("div");
      fileGrid.classList.add("file-grid");
      fileGrid.setAttribute("data-folder-path", folderPath);

      // Contagem de PDFs na pasta
      const pdfFiles = files.filter(file => file.name.toLowerCase().endsWith(".pdf"));
      const pdfCount = pdfFiles.length;
      
      if (pdfCount > 0) {
        const selectAllControl = document.createElement("div");
        selectAllControl.classList.add("folder-controls");

        const selectAllWrapper = document.createElement("div");
        selectAllWrapper.classList.add("select-all-wrapper");

        const selectAllCheckbox = document.createElement("input");
        selectAllCheckbox.type = "checkbox";
        selectAllCheckbox.classList.add("select-all-checkbox", "folder-checkbox");
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

      for (const fileItem of files) {
        if (fileItem.name.toLowerCase().endsWith(".pdf")) {
          createPdfFileFromFile(fileItem.file, fileItem.name, fileGrid);
        } else {
          createGenericFile(fileItem.name, fileGrid);
        }
      }

      processedFolders++;
      if (processedFolders % 5 === 0 || processedFolders === totalFolders) {
        progressManager.updateProgress(
          "Criando interface",
          90 + (processedFolders / totalFolders) * 10,
          `${processedFolders} de ${totalFolders} pastas processadas`
        );
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    progressManager.updateProgress("Finalizando", 100, "Processamento concluído!");
    await new Promise(resolve => setTimeout(resolve, 500));

    updateGlobalSelectAllControl();
  } catch (error) {
    console.error("Error processing folder:", error);
    Swal.fire({
      icon: "error",
      title: "Erro ao processar a pasta",
      text: `${error.message}. Ocorreu um erro durante o processamento.`,
      confirmButtonColor: "#ff3500"
    });
  } finally {
    progressManager.hide();
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
        // Criar um novo blob com o tipo MIME correto para PDFs
        const pdfBlobWithCorrectType = new Blob([pdfBlob], { type: 'application/pdf' });
        const pdfUrl = URL.createObjectURL(pdfBlobWithCorrectType);
        openPdfModal(pdfUrl, fileName);
      } catch (error) {
        console.error("Error loading PDF:", error);
        Swal.fire({
          icon: "error",
          title: "Erro ao abrir o PDF",
          text: "Não foi possível carregar o arquivo. Ele pode estar corrompido.",
          confirmButtonColor: "#ff3500"
        });
      }
    }
  });

  // Adicionar evento de change para a checkbox
  const checkbox = fileElement.querySelector(".pdf-checkbox");
  checkbox.addEventListener("change", function() {
    updateDownloadButtonState();
    updateGlobalSelectAllState();
    updateFolderCheckboxState(this);
  });

  fileElement.fileData = fileData;
  fileElement.fileName = fileName;
  parentElement.appendChild(fileElement);

  updateDownloadButtonState();
}

// Função para criar PDF files a partir de arquivos do sistema
function createPdfFileFromFile(file, fileName, parentElement) {
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
        const pdfUrl = URL.createObjectURL(file);
        openPdfModal(pdfUrl, fileName);
      } catch (error) {
        console.error("Error loading PDF:", error);
        Swal.fire({
          icon: "error",
          title: "Erro ao abrir o PDF",
          text: "Não foi possível carregar o arquivo. Ele pode estar corrompido.",
          confirmButtonColor: "#ff3500"
        });
      }
    }
  });

  // Adicionar evento de change para a checkbox
  const checkbox = fileElement.querySelector(".pdf-checkbox");
  checkbox.addEventListener("change", function() {
    updateDownloadButtonState();
    updateGlobalSelectAllState();
    updateFolderCheckboxState(this);
  });

  fileElement.fileFromSystem = file;
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

// Função atualizada para contabilizar PDFs selecionados
function updateDownloadButtonState() {
  const checkboxes = document.querySelectorAll(".pdf-checkbox:checked");
  const downloadButton = document.getElementById("downloadSelected");
  downloadButton.disabled = checkboxes.length === 0;
  downloadButton.textContent = `Baixar ${checkboxes.length} PDFs Selecionados`;
}

// Função para atualizar o estado da checkbox "Selecionar todos" de uma pasta
function updateFolderCheckboxState(checkbox) {
  const fileElement = checkbox.closest(".pdf-file");
  if (!fileElement) return;
  
  // Encontrar a grade de arquivos pai
  const fileGrid = fileElement.closest(".file-grid");
  if (!fileGrid) return;
  
  const folderPath = fileGrid.getAttribute("data-folder-path");
  if (!folderPath) return;
  
  // Encontrar a checkbox "Selecionar todos" para esta pasta
  const folderCheckbox = document.querySelector(`.select-all-checkbox[data-folder-path="${folderPath}"]`);
  if (!folderCheckbox) return;
  
  // Verificar todas as checkboxes visíveis na grade
  const visibleCheckboxes = Array.from(fileGrid.querySelectorAll(".pdf-checkbox")).filter(cb => {
    const el = cb.closest(".pdf-file");
    return el.style.display !== "none";
  });
  
  const allChecked = visibleCheckboxes.every(cb => cb.checked);
  const someChecked = visibleCheckboxes.some(cb => cb.checked);
  
  folderCheckbox.checked = allChecked;
  folderCheckbox.indeterminate = someChecked && !allChecked;
}

// Função para criar o controle global "Selecionar todos"
function createGlobalSelectAllControl() {
  // Remover controle global existente se houver
  const existingControl = document.getElementById("globalSelectAllControl");
  if (existingControl) {
    existingControl.remove();
  }
  
  const globalSelectAllControl = document.createElement("div");
  globalSelectAllControl.classList.add("folder-controls");
  globalSelectAllControl.id = "globalSelectAllControl";
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
  globalSelectAllLabel.id = "globalSelectAllLabel";
  globalSelectAllLabel.style.fontWeight = "bold";
  
  // Contar PDFs
  const totalPdfCount = document.querySelectorAll(".pdf-file").length;
  globalSelectAllLabel.textContent = `Selecionar todos os ${totalPdfCount} PDFs`;

  globalSelectAllWrapper.appendChild(globalSelectAllCheckbox);
  globalSelectAllWrapper.appendChild(globalSelectAllLabel);
  globalSelectAllControl.appendChild(globalSelectAllWrapper);

  // Verificar se há PDFs antes de adicionar o controle
  if (totalPdfCount > 0) {
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

      // Atualizar todas as checkboxes de pasta
      const visibleFolderSelectAllCheckboxes = Array.from(
        document.querySelectorAll(".folder-checkbox")
      );

      visibleFolderSelectAllCheckboxes.forEach((checkbox) => {
        checkbox.checked = this.checked;
        checkbox.indeterminate = false;
      });

      updateDownloadButtonState();
    });
    
    return true;
  }
  
  return false;
}

// Função para atualizar o estado do controle global "Selecionar todos"
function updateGlobalSelectAllState() {
  const globalCheckbox = document.getElementById("globalSelectAll");
  if (!globalCheckbox) return;
  
  const visiblePdfCheckboxes = Array.from(
    document.querySelectorAll(".pdf-checkbox")
  ).filter((checkbox) => {
    const fileElement = checkbox.closest(".pdf-file");
    return fileElement.style.display !== "none";
  });
  
  const allChecked = visiblePdfCheckboxes.length > 0 && 
    visiblePdfCheckboxes.every(cb => cb.checked);
  
  const someChecked = visiblePdfCheckboxes.some(cb => cb.checked);
  
  globalCheckbox.checked = allChecked;
  globalCheckbox.indeterminate = someChecked && !allChecked;
}

// Função para atualizar o controle global "Selecionar todos"
function updateGlobalSelectAllControl() {
  // Verificar se já existe um controle global
  if (!document.getElementById("globalSelectAllControl")) {
    createGlobalSelectAllControl();
  } else {
    // Atualizar a contagem de PDFs
    const totalPdfCount = document.querySelectorAll(".pdf-file").length;
    const globalSelectAllLabel = document.getElementById("globalSelectAllLabel");
    if (globalSelectAllLabel) {
      globalSelectAllLabel.textContent = `Selecionar todos os ${totalPdfCount} PDFs`;
    }
    
    updateGlobalSelectAllState();
  }
}

function updateSelectAllCheckboxes() {
  document
    .querySelectorAll(".folder-controls .select-all-checkbox")
    .forEach((selectAllCheckbox) => {
      if (selectAllCheckbox.id === "globalSelectAll") {
        updateGlobalSelectAllState();
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
        
        const allChecked = visiblePdfCheckboxes.length > 0 && 
          visiblePdfCheckboxes.length === checkedVisiblePdfCheckboxes.length;
        
        const someChecked = checkedVisiblePdfCheckboxes.length > 0;

        selectAllCheckbox.checked = allChecked;
        selectAllCheckbox.indeterminate = someChecked && !allChecked;

        const selectAllLabel =
          selectAllCheckbox.parentElement.querySelector(".select-all-label");
        if (selectAllLabel) {
          selectAllLabel.textContent = `Selecionar todos os PDFs (${visiblePdfCheckboxes.length})`;
        }
      }
    });
}

document.getElementById("zipInput").setAttribute("multiple", "true");

document.getElementById("zipInput").addEventListener("change", function (event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;
  
  // Array para armazenar os arquivos a serem processados
  const filesToProcess = [];
  let totalSize = 0;
  
  // Verificar tamanho total dos arquivos selecionados
  for (let i = 0; i < files.length; i++) {
    totalSize += files[i].size;
    filesToProcess.push(files[i]);
  }
  
  const totalSizeInGB = totalSize / (1024 * 1024 * 1024);
  
  if (totalSizeInGB > 10) {
    Swal.fire({
      icon: "warning",
      title: "Arquivos muito grandes",
      text: `Os arquivos ZIP somam mais de 10GB e podem causar instabilidade no navegador.`,
      showCancelButton: true,
      confirmButtonText: "Continuar mesmo assim",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ff3500",
      cancelButtonColor: "#6c757d"
    }).then((result) => {
      if (result.isConfirmed) {
        processMultipleZipFiles(filesToProcess);
      }
    });
  } else {
    processMultipleZipFiles(filesToProcess);
  }
});

function processMultipleZipFiles(files) {
  if (files.length === 0) return;
  
  progressManager.showLoading(`Preparando ${files.length} arquivo(s) ZIP para processamento...`);
  
  // Limpar o fileTree anterior se for a primeira execução
  if (!window.hasProcessedFiles) {
    document.getElementById("fileTree").innerHTML = "";
    window.hasProcessedFiles = true;
  }
  
  // Criar pastas principais para cada arquivo ZIP
  const fileTree = document.getElementById("fileTree");
  
  // Processar arquivos um por um
  processNextZipFile(files, 0, fileTree);
}

function processNextZipFile(files, index, fileTree) {
  if (index >= files.length) {
    progressManager.hide();
    // Atualizar o controle global após processar todos os ZIPs
    updateGlobalSelectAllControl();
    
    Swal.fire({
      icon: "success",
      title: "Processamento Concluído",
      text: `${files.length} arquivo(s) ZIP foram processados com sucesso.`,
      confirmButtonColor: "#ff3500",
      timer: 3000,
      timerProgressBar: true
    });
    return;
  }
  
  const file = files[index];
  const zipFolderName = file.name;
  
  // Atualizar progresso geral
  const overallProgress = ((index / files.length) * 100);
  progressManager.showProgress(
    `Processando arquivo ${index + 1} de ${files.length}`,
    overallProgress,
    `Carregando: ${zipFolderName}`
  );
  
  // Criar pasta principal para este arquivo ZIP
  const mainFolder = document.createElement("div");
  mainFolder.classList.add("folder");
  
  const toggleBtn = document.createElement("i");
  toggleBtn.classList.add("fas", "fa-chevron-right", "toggle-btn");
  toggleBtn.style.cursor = "pointer";
  
  const folderSpan = document.createElement("span");
  folderSpan.innerHTML = `<i class="fas fa-folder"></i> ${zipFolderName}`;
  
  mainFolder.appendChild(toggleBtn);
  mainFolder.appendChild(folderSpan);
  
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
  
  mainFolder.addEventListener("click", (e) => {
    if (!e.target.classList.contains("toggle-btn")) {
      const isOpen = subTree.style.display === "block";
      subTree.style.display = isOpen ? "none" : "block";
      toggleBtn.classList.toggle("fa-chevron-down", !isOpen);
      toggleBtn.classList.toggle("fa-chevron-right", isOpen);
    }
  });
  
  fileTree.appendChild(mainFolder);
  fileTree.appendChild(subTree);
  
  // Processar o arquivo ZIP
  JSZip.loadAsync(file)
    .then(async (zip) => {
      await processZip(zip, subTree);
      
      // Processar o próximo arquivo
      setTimeout(() => {
        processNextZipFile(files, index + 1, fileTree);
      }, 100);
    })
    .catch((error) => {
      console.error(`Error loading ZIP ${zipFolderName}:`, error);
      
      // Mostrar mensagem de erro para este arquivo específico
      const errorMessage = document.createElement("div");
      errorMessage.classList.add("generic-file");
      errorMessage.innerHTML = `<i class="fas fa-exclamation-triangle" style="color: #ff3500;"></i> Erro ao processar: ${error.message}`;
      subTree.appendChild(errorMessage);
      
      Swal.fire({
        icon: "error",
        title: `Erro no arquivo ${zipFolderName}`,
        text: `Não foi possível processar este arquivo: ${error.message}`,
        confirmButtonColor: "#ff3500",
        timer: 3000,
        timerProgressBar: true
      });
      
      // Continuar com o próximo arquivo
      setTimeout(() => {
        processNextZipFile(files, index + 1, fileTree);
      }, 100);
    });
}

document.querySelector('.dropzone p').textContent = "Selecione um ou mais arquivos .zip em seu computador, para leitura.";

// Atualizar downloadSelected para corrigir o tipo MIME dos PDFs ao baixar
document.getElementById("downloadSelected").addEventListener("click", async () => {
  const checkboxes = document.querySelectorAll(".pdf-checkbox:checked");
  if (checkboxes.length === 0) return;

  const totalFiles = checkboxes.length;

  // Mostrar SweetAlert com progresso personalizado
  Swal.fire({
    title: "Preparando Download",
    html: `
      <div class="swal-progress-container">
        <div class="swal-progress-info">
          <span>Preparando arquivos para download...</span>
          <span id="swalProgressCount">0 de ${totalFiles}</span>
        </div>
        <div class="swal-progress-bar">
          <div class="swal-progress-fill" id="swalProgressFill"></div>
        </div>
      </div>
    `,
    allowOutsideClick: false,
    showConfirmButton: false,
    customClass: {
      popup: 'swal-download-popup'
    }
  });

  try {
    const zip = new JSZip();
    let processedFiles = 0;

    for (const checkbox of checkboxes) {
      const fileElement = checkbox.closest(".pdf-file");
      const documentNumber = processedFiles + 1;
      const newFileName = `Documento_${documentNumber}.pdf`;

      try {
        let blob;
        
        // Verificar se é um arquivo do ZIP ou do sistema
        if (fileElement.fileData) {
          // Arquivo do ZIP
          const zipBlob = await fileElement.fileData.async("blob");
          blob = new Blob([zipBlob], { type: 'application/pdf' });
        } else if (fileElement.fileFromSystem) {
          // Arquivo do sistema
          blob = new Blob([fileElement.fileFromSystem], { type: 'application/pdf' });
        } else {
          console.warn(`File data not found for: ${fileElement.fileName}`);
          continue;
        }

        zip.file(newFileName, blob);

        processedFiles++;
        
        // Atualizar progresso
        const progressPercentage = (processedFiles / totalFiles) * 90; // 90% para preparação
        document.getElementById("swalProgressCount").textContent = `${processedFiles} de ${totalFiles}`;
        document.getElementById("swalProgressFill").style.width = `${progressPercentage}%`;
        
      } catch (error) {
        console.error(`Error processing file:`, error);
      }
    }

    // Atualizar para fase de geração
    document.querySelector(".swal-progress-info span").textContent = "Gerando arquivo ZIP...";
    document.getElementById("swalProgressFill").style.width = "95%";

    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: {
        level: 5,
      },
    });

    // Finalizar progresso
    document.getElementById("swalProgressFill").style.width = "100%";

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
      confirmButtonColor: "#ff3500",
      timer: 3000,
      timerProgressBar: true
    });
  } catch (error) {
    console.error("Error generating ZIP for download:", error);
    Swal.fire({
      icon: "error",
      title: "Erro ao gerar o ZIP",
      text: error.message,
      confirmButtonColor: "#ff3500"
    });
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
      title: "Nenhum resultado encontrado",
      text: "Não foi encontrado nenhum arquivo ou pasta correspondente à pesquisa.",
      confirmButtonColor: "#ff3500",
      timer: 2000,
      timerProgressBar: true,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
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

// Alternância entre modos ZIP e Pasta
document.getElementById("zipModeBtn").addEventListener("click", function() {
  // Ativar modo ZIP
  this.classList.add("active");
  document.getElementById("folderModeBtn").classList.remove("active");
  
  // Mostrar input ZIP e esconder input de pasta
  document.getElementById("zipDropzone").style.display = "block";
  document.getElementById("folderDropzone").style.display = "none";
});

document.getElementById("folderModeBtn").addEventListener("click", function() {
  // Ativar modo Pasta
  this.classList.add("active");
  document.getElementById("zipModeBtn").classList.remove("active");
  
  // Mostrar input de pasta e esconder input ZIP
  document.getElementById("zipDropzone").style.display = "none";
  document.getElementById("folderDropzone").style.display = "block";
});

// Event listener para seleção de pastas
document.getElementById("folderInput").addEventListener("change", function (event) {
  const files = Array.from(event.target.files);
  if (!files || files.length === 0) return;
  
  // Organizar arquivos por pasta raiz
  const folderStructure = {};
  
  files.forEach(file => {
    const pathParts = file.webkitRelativePath.split('/');
    const rootFolder = pathParts[0];
    
    if (!folderStructure[rootFolder]) {
      folderStructure[rootFolder] = [];
    }
    folderStructure[rootFolder].push(file);
  });
  
  // Verificar se há pastas para processar
  const folderNames = Object.keys(folderStructure);
  if (folderNames.length === 0) return;
  
  progressManager.showLoading(`Preparando ${folderNames.length} pasta(s) para processamento...`);
  
  // Limpar o fileTree anterior se for a primeira execução
  if (!window.hasProcessedFiles) {
    document.getElementById("fileTree").innerHTML = "";
    window.hasProcessedFiles = true;
  }
  
  // Criar pastas principais para cada pasta raiz
  const fileTree = document.getElementById("fileTree");
  
  // Processar pastas uma por uma
  processNextFolder(folderStructure, folderNames, 0, fileTree);
});

function processNextFolder(folderStructure, folderNames, index, fileTree) {
  if (index >= folderNames.length) {
    progressManager.hide();
    // Atualizar o controle global após processar todas as pastas
    updateGlobalSelectAllControl();
    
    Swal.fire({
      icon: "success",
      title: "Processamento Concluído",
      text: `${folderNames.length} pasta(s) foram processadas com sucesso.`,
      confirmButtonColor: "#ff3500",
      timer: 3000,
      timerProgressBar: true
    });
    return;
  }
  
  const folderName = folderNames[index];
  const files = folderStructure[folderName];
  
  // Atualizar progresso geral
  const overallProgress = ((index / folderNames.length) * 100);
  progressManager.showProgress(
    `Processando pasta ${index + 1} de ${folderNames.length}`,
    overallProgress,
    `Carregando: ${folderName} (${files.length} arquivos)`
  );
  
  // Criar pasta principal para esta pasta
  const mainFolder = document.createElement("div");
  mainFolder.classList.add("folder");
  
  const toggleBtn = document.createElement("i");
  toggleBtn.classList.add("fas", "fa-chevron-right", "toggle-btn");
  toggleBtn.style.cursor = "pointer";
  
  const folderSpan = document.createElement("span");
  folderSpan.innerHTML = `<i class="fas fa-folder"></i> ${folderName}`;
  
  mainFolder.appendChild(toggleBtn);
  mainFolder.appendChild(folderSpan);
  
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
  
  mainFolder.addEventListener("click", (e) => {
    if (!e.target.classList.contains("toggle-btn")) {
      const isOpen = subTree.style.display === "block";
      subTree.style.display = isOpen ? "none" : "block";
      toggleBtn.classList.toggle("fa-chevron-down", !isOpen);
      toggleBtn.classList.toggle("fa-chevron-right", isOpen);
    }
  });
  
  fileTree.appendChild(mainFolder);
  fileTree.appendChild(subTree);
  
  // Processar a pasta
  processFolder(files, subTree, folderName)
    .then(() => {
      // Processar a próxima pasta
      setTimeout(() => {
        processNextFolder(folderStructure, folderNames, index + 1, fileTree);
      }, 100);
    })
    .catch((error) => {
      console.error(`Error processing folder ${folderName}:`, error);
      
      // Mostrar mensagem de erro para esta pasta específica
      const errorMessage = document.createElement("div");
      errorMessage.classList.add("generic-file");
      errorMessage.innerHTML = `<i class="fas fa-exclamation-triangle" style="color: #ff3500;"></i> Erro ao processar: ${error.message}`;
      subTree.appendChild(errorMessage);
      
      Swal.fire({
        icon: "error",
        title: `Erro na pasta ${folderName}`,
        text: `Não foi possível processar esta pasta: ${error.message}`,
        confirmButtonColor: "#ff3500",
        timer: 3000,
        timerProgressBar: true
      });
      
      // Continuar com a próxima pasta
      setTimeout(() => {
        processNextFolder(folderStructure, folderNames, index + 1, fileTree);
      }, 100);
    });
}
