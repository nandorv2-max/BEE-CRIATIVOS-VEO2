/* tslint:disable */
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Helper function to convert a file blob to a Base64 string
function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      // Return only the Base64 part of the data URL
      resolve(url.split(',')[1]);
    };
    reader.readAsDataURL(blob);
  });
}

// Helper function to trigger a file download in the browser
function downloadFile(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Makes a request to our own backend server to generate the video.
 * The backend will handle the secure API call to Google.
 */
async function generateContent(
  prompt: string,
  imageBytes: string,
  aspectRatio: string,
  numberOfVideos: number,
  durationSeconds: number,
  videoContainer: HTMLDivElement,
) {
  // Make a POST request to our new backend endpoint
  const response = await fetch('/generate-video', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      imageBytes,
      aspectRatio,
      numberOfVideos,
      durationSeconds,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate video.');
  }
  
  // The response from our server is the video file itself
  const blob = await response.blob();
  const objectURL = URL.createObjectURL(blob);
  
  videoContainer.innerHTML = ''; // Clear previous content

  // Create and display the video element
  const videoItemContainer = document.createElement('div');
  videoItemContainer.className = 'video-item';

  const videoEl = document.createElement('video');
  videoEl.src = objectURL;
  videoEl.autoplay = true;
  videoEl.loop = true;
  videoEl.controls = true;
  videoItemContainer.appendChild(videoEl);

  const downloadButton = document.createElement('button');
  downloadButton.textContent = `Download Vídeo`;
  downloadButton.addEventListener('click', () => {
    downloadFile(objectURL, `video.mp4`);
  });
  videoItemContainer.appendChild(downloadButton);

  videoContainer.appendChild(videoItemContainer);
}

// --- DOM Elements ---
const uploadInput = document.querySelector('#file-input') as HTMLInputElement;
const imagePreviewContainer = document.querySelector('#image-preview-container') as HTMLDivElement;
const imagePreview = document.querySelector('#image-preview') as HTMLImageElement;
const removeImageButton = document.querySelector('#remove-image-button') as HTMLButtonElement;
const fileInputLabel = document.querySelector('.file-input-label') as HTMLSpanElement;
const promptEl = document.querySelector('#prompt-input') as HTMLTextAreaElement;
const statusEl = document.querySelector('#status') as HTMLParagraphElement;
const videoContainer = document.querySelector('#video-container') as HTMLDivElement;
const placeholder = document.querySelector('.output-placeholder') as HTMLDivElement;
const aspectRatioSelect = document.querySelector('#aspect-ratio-select') as HTMLSelectElement;
const numberOfVideosInput = document.querySelector('#number-of-videos-input') as HTMLInputElement;
const durationInput = document.querySelector('#duration-input') as HTMLInputElement;
const generateButton = document.querySelector('#generate-button') as HTMLButtonElement;

// --- State ---
let base64data = '';
let messageInterval: ReturnType<typeof setInterval> | null = null;

// --- Event Listeners ---
uploadInput.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      imagePreview.src = event.target?.result as string;
      imagePreviewContainer.style.display = 'block';
    };
    reader.readAsDataURL(file);
    base64data = await blobToBase64(file);
    fileInputLabel.textContent = file.name;
  }
});

removeImageButton.addEventListener('click', () => {
  uploadInput.value = '';
  base64data = '';
  imagePreview.src = '';
  imagePreviewContainer.style.display = 'none';
  fileInputLabel.textContent = 'Nenhum arquivo escolhido';
});


generateButton.addEventListener('click', () => {
  generate();
});

// --- Main Function ---
async function generate() {
  if (placeholder) placeholder.style.display = 'none';
  videoContainer.innerHTML = '';
  statusEl.className = 'status-message';
  
  const loadingMessages = [
    'Enviando para o servidor...',
    'Gerando... isso pode levar alguns minutos.',
    'O modelo está trabalhando na sua criação.',
    'Buscando resultados, por favor, seja paciente.',
    'Finalizando a geração do vídeo...',
    'Quase lá...',
  ];
  let messageIndex = 0;
  statusEl.innerHTML = `<div class="spinner"></div> <span id="loading-text">${loadingMessages[messageIndex]}</span>`;

  messageInterval = setInterval(() => {
    messageIndex = (messageIndex + 1) % loadingMessages.length;
    const loadingTextEl = document.querySelector('#loading-text');
    if (loadingTextEl) {
      loadingTextEl.textContent = loadingMessages[messageIndex];
    }
  }, 4000);

  const prompt = promptEl.value;
  const aspectRatio = aspectRatioSelect.value;
  const numberOfVideos = parseInt(numberOfVideosInput.value, 10);
  const duration = parseInt(durationInput.value, 10);

  const inputs = [
    generateButton,
    uploadInput,
    promptEl,
    aspectRatioSelect,
    numberOfVideosInput,
    durationInput,
  ];
  inputs.forEach((el) => (el.disabled = true));

  try {
    await generateContent(
      prompt,
      base64data,
      aspectRatio,
      numberOfVideos,
      duration,
      videoContainer,
    );
    statusEl.innerHTML = `✅ Pronto. O vídeo foi gerado.`;
  } catch (e) {
    statusEl.innerHTML = `Erro: ${e.message}`;
    statusEl.classList.add('error');
    console.error('Error:', e);
  } finally {
    if (messageInterval) clearInterval(messageInterval);
    inputs.forEach((el) => (el.disabled = false));
  }
}
