// Store cameras in Chrome storage
let cameras = [];

// Load cameras when popup opens
document.addEventListener("DOMContentLoaded", async () => {
  // Load existing cameras first
  try {
    const result = await chrome.storage.local.get(["cameras"]);
    cameras = result.cameras || [];
    renderCamerasTable();
  } catch (error) {
    console.error("Error loading cameras:", error);
    showError("Error loading cameras: " + error.message);
  }

  // Add form submission handler with debugging
  const form = document.getElementById("addCameraForm");
  if (!form) {
    console.error("Form element not found!");
    return;
  }

  form.addEventListener("submit", (e) => {
    console.log("Form submitted");
    handleAddCamera(e);
  });
});

// Add error display function
function showError(message) {
  const errorDiv = document.getElementById("error-message") || createErrorDiv();
  errorDiv.textContent = message;
  errorDiv.style.display = "block";
  setTimeout(() => {
    errorDiv.style.display = "none";
  }, 5000);
}

function createErrorDiv() {
  const errorDiv = document.createElement("div");
  errorDiv.id = "error-message";
  errorDiv.style.cssText =
    "color: red; padding: 10px; margin: 10px 0; display: none;";
  document.querySelector("form").insertAdjacentElement("beforebegin", errorDiv);
  return errorDiv;
}

function renderCamerasTable() {
  const tbody = document.getElementById("camerasTableBody");
  tbody.innerHTML = "";

  cameras.forEach((camera, index) => {
    const tr = document.createElement("tr");
    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteCamera(index));

    tr.innerHTML = `
            <td>${camera.name}</td>
            <td><img src="${camera.image}" class="camera-image" alt="${camera.name}"></td>
            <td class="actions"></td>
        `;
    tr.querySelector(".actions").appendChild(deleteButton);
    tbody.appendChild(tr);
  });
}

async function handleAddCamera(e) {
  e.preventDefault();
  console.log("handleAddCamera called");

  const nameInput = document.getElementById("cameraName");
  const imageInput = document.getElementById("cameraImage");

  if (!nameInput || !imageInput) {
    showError("Required input elements not found!");
    return;
  }

  if (!nameInput.value.trim()) {
    showError("Please enter a camera name");
    return;
  }

  if (imageInput.files.length === 0) {
    showError("Please select an image");
    return;
  }

  const file = imageInput.files[0];
  // Check file size (limit to 10MB)
  if (file.size > 1024 * 1024 * 10) {
    showError("Image size must be less than 10MB");
    return;
  }

  const reader = new FileReader();

  reader.onload = async function (e) {
    const camera = {
      name: nameInput.value.trim(),
      image: e.target.result,
    };

    cameras.push(camera);
    try {
      await chrome.storage.local.set({ cameras });
      renderCamerasTable();
      nameInput.value = "";
      imageInput.value = "";
    } catch (error) {
      console.error("Error saving camera:", error);
      showError("Error saving camera: " + error.message);
    }
  };

  reader.onerror = function () {
    showError("Error reading image file");
  };

  reader.readAsDataURL(file);
}

// Change from window.deleteCamera to regular function
async function deleteCamera(index) {
  if (confirm("Are you sure you want to delete this camera?")) {
    cameras.splice(index, 1);
    try {
      await chrome.storage.local.set({ cameras });
      renderCamerasTable();
    } catch (error) {
      console.error("Error deleting camera:", error);
      showError("Error deleting camera: " + error.message);
    }
  }
}
