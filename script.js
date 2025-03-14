async function processZip(zip, fileTree) {
  fileTree.innerHTML = "";

  const folders = {};

  for (const fileName of Object.keys(zip.files)) {
    const fileData = zip.files[fileName];

    const pathParts = fileName.split("/");
    const isFolder = fileName.endsWith("/");
    const parentPath = pathParts.slice(0, -1).join("/");
    const fileOrFolderName = pathParts[pathParts.length - 1];

    let parentElement = fileTree;

    if (parentPath) {
      if (!folders[parentPath]) {
        folders[parentPath] = createFolder(parentPath, fileTree);
      }
      parentElement = folders[parentPath];
    }

    if (isFolder) {
      folders[fileName] = createFolder(fileOrFolderName, parentElement);
    } else if (fileOrFolderName.endsWith(".zip")) {
      await processInnerZip(fileData, fileOrFolderName, parentElement);
    } else if (fileOrFolderName.endsWith(".pdf")) {
      createPdfFile(fileData, fileOrFolderName, parentElement);
    } else {
      createGenericFile(fileOrFolderName, parentElement);
    }
  }

  document.getElementById("searchInput").disabled = false;
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
  } catch (error) {
    console.error("Erro ao extrair ZIP:", error);
    zipElement.innerHTML = `<i class="fas fa-file-archive"></i> ${fileName} (Erro ao extrair)`;
  }
}

function createPdfFile(fileData, fileName, parentElement) {
  const fileElement = document.createElement("div");
  fileElement.classList.add("file");

  fileElement.innerHTML = `
    <div class="pdf-card">
      <input type="checkbox" class="pdf-checkbox">
      <img src="./assets/img/pdf.png" alt="PDF" class="pdf-thumbnail">
      <span class="pdf-name">${fileName}</span>
    </div>
  `;

  fileElement.addEventListener("click", async (event) => {
    if (event.target.tagName !== "INPUT") {
      const pdfBlob = await fileData.async("blob");
      const pdfUrl = URL.createObjectURL(pdfBlob);
      openPdfModal(pdfUrl);
      URL.revokeObjectURL(pdfUrl);
    }
  });
  fileElement.fileData = fileData;
  parentElement.appendChild(fileElement);
}

function createGenericFile(fileName, parentElement) {
  const fileElement = document.createElement("div");
  fileElement.classList.add("file");
  fileElement.innerHTML = `<i class="fas fa-file"></i> ${fileName}`;

  parentElement.appendChild(fileElement);
}

async function processZipContent(fileData, subTree) {
  if (fileData.dir) {
    await processZip(fileData, subTree);
  } else if (fileData && fileData.name) {
    const element = document.createElement("div");
    element.classList.add("file");
    element.innerHTML = `<i class="fas fa-file"></i> ${fileData.name}`;
    subTree.appendChild(element);
  } else {
    console.error("Erro: fileData não contém informações válidas.");
  }
}

document
  .getElementById("zipInput")
  .addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (file) {
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

      reader.onload = async function (e) {
        try {
          const zip = await JSZip.loadAsync(e.target.result);
          await processZip(zip, fileTree);
          Swal.close();
        } catch (error) {
          Swal.fire({
            icon: "error",
            title: "Erro ao processar o ZIP",
            text: error.message,
          });
        }
      };

      reader.readAsArrayBuffer(file);
    }
  });

document
  .getElementById("downloadSelected")
  .addEventListener("click", async () => {
    const checkboxes = document.querySelectorAll(".pdf-checkbox:checked");
    if (checkboxes.length === 0) return;

    const zip = new JSZip();
    let docCounter = 1;

    for (const checkbox of checkboxes) {
      const fileElement = checkbox.closest(".file");
      const fileName = `documento_${docCounter}.pdf`;
      const fileData = fileElement.fileData;
      const blob = await fileData.async("blob");

      zip.file(fileName, blob);
      docCounter++;
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Leitor PROSIPE - PDFs Selecionados.zip";
    a.click();
    URL.revokeObjectURL(url);
  });

document.getElementById("fileTree").addEventListener("change", function () {
  const checkboxes = document.querySelectorAll(".pdf-checkbox:checked");
  const downloadButton = document.getElementById("downloadSelected");
  downloadButton.disabled = checkboxes.length === 0;
});

function openPdfModal(pdfUrl) {
  const pdfViewer = document.getElementById("pdfViewer");
  pdfViewer.src = pdfUrl;
  pdfViewer.type = "application/pdf";
  document.getElementById("pdfModal").style.display = "block";
}

function closeModal() {
  document.getElementById("pdfModal").style.display = "none";
  document.getElementById("pdfViewer").src = "";
}

window.onclick = function (event) {
  const modal = document.getElementById("pdfModal");
  if (event.target === modal) {
    closeModal();
  }
};

document.getElementById("searchInput").addEventListener("click", function () {
  if (this.disabled) {
    Swal.fire({
      icon: "warning",
      title: "Aguarde!",
      text: "Os arquivos ainda estão sendo carregados.",
      confirmButtonText: "Ok",
    });
    return; // Impede que o código abaixo execute enquanto está desativado
  }

  const searchTerm = removeAccents(this.value.toLowerCase());
  const filesAndFolders = document.querySelectorAll(".file, .folder");

  filesAndFolders.forEach((element) => {
    const text = removeAccents(element.innerText.toLowerCase());
    const matches = text.includes(searchTerm);
    element.style.display = matches ? "block" : "none";
  });

  document.querySelectorAll(".sub-tree").forEach((subTree) => {
    const hasVisibleChildren = [...subTree.children].some(
      (child) => child.style.display === "block"
    );
    subTree.style.display = hasVisibleChildren ? "block" : "none";
  });
});

function removeAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

document.getElementById("inputPesquisa").addEventListener("click", function () {
  const searchInput = document.getElementById("searchInput");

  if (searchInput.disabled) {
    Swal.fire({
      icon: "warning",
      title: "Campo de busca desabilitado!",
      text: "Primeiro carregue um arquivo para poder utilizar o campo de busca!",
      confirmButtonText: "Ok",
    });
  }
});
