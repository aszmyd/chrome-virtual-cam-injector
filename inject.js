(function () {
  // Check if we've already injected to avoid double injection
  if (window.__virtualCamInjected) return;
  window.__virtualCamInjected = true;

  let customCameras = [];

  // Request cameras from content script
  window.postMessage({ type: "GET_CAMERAS" }, "*");

  // Listen for messages from content script
  window.addEventListener("message", function (event) {
    // Only accept messages from the same frame
    if (event.source !== window) return;

    if (
      event.data.type === "CAMERAS_RESPONSE" ||
      event.data.type === "CAMERAS_UPDATED"
    ) {
      customCameras = event.data.cameras;
      injectFakeCameras();
    }
  });

  async function injectFakeCameras() {
    // Ensure mediaDevices is available
    if (!navigator.mediaDevices) {
      navigator.mediaDevices = {};
    }

    // Ensure getUserMedia is available
    if (!navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia = (constraints) =>
        Promise.reject(
          new Error("getUserMedia is not implemented in this browser")
        );
    }

    const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices
    );

    navigator.mediaDevices.getUserMedia = async function (constraints) {
      try {
        // If video is not requested or no custom cameras, use original behavior
        if (!constraints?.video || customCameras.length === 0) {
          return await originalGetUserMedia(constraints);
        }

        // Check if a specific device is requested
        const deviceId =
          constraints.video.deviceId?.exact || constraints.video.deviceId;

        // If a real device is requested, use original behavior
        if (deviceId && !deviceId.startsWith("fake-camera-")) {
          return await originalGetUserMedia(constraints);
        }

        // Create a canvas element for the fake video
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        // Use the first camera in the list or the specifically requested one
        let activeCamera = customCameras[0];
        if (deviceId) {
          const cameraIndex = parseInt(deviceId.replace("fake-camera-", ""));
          activeCamera = customCameras[cameraIndex] || activeCamera;
        }

        // Create an image element to draw from
        const img = new Image();
        img.src = activeCamera.image;

        // Wait for image to load to set canvas dimensions
        await new Promise((resolve) => {
          img.onload = () => {
            // Set canvas size to match image dimensions
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            resolve();
          };
        });

        // Create a fake video stream
        const stream = canvas.captureStream(30); // 30 FPS

        // Override getSettings() for the video track
        const originalGetSettings = stream.getVideoTracks()[0].getSettings;
        stream.getVideoTracks()[0].getSettings = function () {
          return {
            ...originalGetSettings.call(this),
            deviceId: deviceId || `fake-camera-0`,
            groupId: "fake-cameras-group",
            width: canvas.width,
            height: canvas.height,
          };
        };

        // Continuously draw the image to the canvas
        function drawImage() {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          requestAnimationFrame(drawImage);
        }

        drawImage();
        return stream;
      } catch (error) {
        console.error("Error in getUserMedia:", error);
        return await originalGetUserMedia(constraints);
      }
    };

    // Ensure enumerateDevices is available
    if (!navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices = () => Promise.resolve([]);
    }

    const originalEnumerateDevices =
      navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);

    navigator.mediaDevices.enumerateDevices = async function () {
      try {
        // Get real devices
        const realDevices = await originalEnumerateDevices();

        // Add our custom cameras
        const fakeDevices = customCameras.map((camera, index) => ({
          deviceId: `fake-camera-${index}`,
          groupId: "fake-cameras-group",
          kind: "videoinput",
          label: camera.name,
          toJSON: () => ({
            deviceId: `fake-camera-${index}`,
            groupId: "fake-cameras-group",
            kind: "videoinput",
            label: camera.name,
          }),
        }));

        // Return both real and fake devices
        return [...realDevices, ...fakeDevices];
      } catch (error) {
        console.error("Error in enumerateDevices:", error);
        return await originalEnumerateDevices();
      }
    };
  }
})();
