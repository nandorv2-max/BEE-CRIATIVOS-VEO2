/* tslint:disable */
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { GenerateVideosParameters, GoogleGenAI } from '@google/genai';

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function blobToBase64(blob: Blob) {
  return new Promise<string>(async (resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      resolve(url.split(',')[1]);
    };
    reader.readAsDataURL(blob);
  });
}

function downloadFile(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function generateContent(
  prompt: string,
  imageBytes: string,
  aspectRatio: string,
  numberOfVideos: number,
  durationSeconds: number,
  apiKey: string,
  videoContainer: HTMLDivElement,
) {
  const ai = new GoogleGenAI({ apiKey });

  const config: GenerateVideosParameters = {
    model: 'veo-2.0-generate-001',
    prompt,
    config: {
      numberOfVideos: numberOfVideos,
      durationSeconds: durationSeconds,
    },
  };

  if (aspectRatio) {
    config.config.aspectRatio = aspectRatio;
  }

  if (imageBytes) {
    config.image = {
      imageBytes,
      mimeType: 'image/png', // Assuming PNG, might need to be dynamic
    };
  }

  let operation = await ai.models.generateVideos(config);

  while (!operation.done) {
    console.log('Waiting for completion');
    await delay(10000); // Polling delay
    operation = await ai.operations.getVideosOperation({ operation });
  }

  const videos = operation.response?.generatedVideos;
  if (videos === undefined || videos.length === 0) {
    throw new Error('No videos generated');
  }

  videoContainer.innerHTML = ''; // Clear previous videos

  videos.forEach(async (v, i) => {
    const url = v.video.uri; // FIX: Removed unnecessary decodeURIComponent
    const res = await fetch(`${url}&key=${apiKey}`);
    const blob = await res.blob();
    const objectURL = URL.createObjectURL(blob);

    const videoItemContainer = document.createElement('div');
    videoItemContainer.className = 'video-item';

    const videoEl = document.createElement('video');
    videoEl.src = objectURL;
    videoEl.autoplay = true;
    videoEl.loop = true;
    videoEl.controls = true;
    videoItemContainer.appendChild(videoEl);

    const downloadButton = document.createElement('button');
    downloadButton.textContent = `Download Vídeo ${i + 1}`;
    downloadButton.addEventListener('click', () => {
      downloadFile(objectURL, `video${i + 1}.mp4`);
    });
    videoItemContainer.appendChild(downloadButton);

    videoContainer.appendChild(videoItemContainer);
  });
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
// FIX: Correctly type `messageInterval` to fix "Type 'Timeout' is not assignable to type 'number'".
// `ReturnType<typeof setInterval>` accommodates both browser (`number`) and Node.js (`Timeout`) return types.
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
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    statusEl.innerText = 'Erro: A variável de ambiente API_KEY não foi definida';
    statusEl.classList.add('error');
    return;
  }
  
  if (placeholder) placeholder.style.display = 'none';
  videoContainer.innerHTML = '';
  statusEl.className = 'status-message';
  
  const loadingMessages = [
    'Gerando... isso pode levar alguns minutos.',
    'Aquecendo o modelo de geração de vídeo...',
    'Buscando resultados, por favor, seja paciente.',
    'O modelo está trabalhando na sua criação.',
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
      apiKey,
      videoContainer,
    );
    statusEl.innerHTML = `✅ Pronto. ${numberOfVideos} vídeo(s) gerado(s).`;
  } catch (e) {
    let errorMessage = e.message;
    try {
      const err = JSON.parse(e.message);
      if (err.error) {
        if (err.error.status === 'RESOURCE_EXHAUSTED') {
          errorMessage = `Cota excedida. Verifique seu plano e detalhes de faturamento.`;
        } else {
          errorMessage = err.error.message;
        }
      }
    } catch (parseError) {
      // Not a JSON string, use the original message
    }
    statusEl.innerHTML = `Erro: ${errorMessage}`;
    statusEl.classList.add('error');
    console.error('Error:', e);
  } finally {
    if (messageInterval) clearInterval(messageInterval);
    inputs.forEach((el) => (el.disabled = false));
  }
}