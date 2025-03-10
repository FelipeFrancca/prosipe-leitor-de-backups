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
  const searchInput = document.getElementById("searchInput");
  searchInput.disabled = false;
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
  
    // Substituindo os ícones por uma imagem de miniatura de PDF
    fileElement.innerHTML = `
      <div class="pdf-card">
        <img src="./assets/img/pdf.png" alt="PDF" class="pdf-thumbnail">
        <span class="pdf-name">${fileName}</span>
      </div>
    `;
  
    fileElement.addEventListener("click", async () => {
      const pdfBlob = await fileData.async("blob");
      const pdfUrl = URL.createObjectURL(
        new Blob([pdfBlob], { type: "application/pdf" })
      );
      openPdfModal(pdfUrl);
    });
  
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
      const loadingMessage = document.getElementById("loadingMessage");
      const fileTree = document.getElementById("fileTree");

      loadingMessage.style.display = "block";
      fileTree.innerHTML = "";

      reader.onload = async function (e) {
        const zip = await JSZip.loadAsync(e.target.result);
        loadingMessage.innerHTML =
          '<i class="fas fa-spinner fa-spin"></i> Espere mais um pouco, os arquivos estão sendo carregados';

        setTimeout(async () => {
          await processZip(zip, fileTree);
          loadingMessage.style.display = "none";
        }, 1500);
      };
      reader.readAsArrayBuffer(file);
    }
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

document.getElementById("searchInput").addEventListener("input", function () {
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
