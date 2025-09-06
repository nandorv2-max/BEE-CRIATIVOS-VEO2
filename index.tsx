/* tslint:disable */
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {GenerateVideosParameters, GoogleGenAI} from '@google/genai';

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
) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error('API_KEY environment variable not set');
  }
  const ai = new GoogleGenAI({apiKey});

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
      mimeType: 'image/png',
    };
  }

  let operation = await ai.models.generateVideos(config);

  while (!operation.done) {
    console.log('Waiting for completion');
    await delay(10000); // Further increased delay to reduce polling and conserve API quota
    operation = await ai.operations.getVideosOperation({operation});
  }

  const videos = operation.response?.generatedVideos;
  if (videos === undefined || videos.length === 0) {
    throw new Error('No videos generated');
  }

  videoContainer.innerHTML = ''; // Clear previous videos

  videos.forEach(async (v, i) => {
    const url = decodeURIComponent(v.video.uri);
    const res = await fetch(`${url}&key=${apiKey}`);
    const blob = await res.blob();
    const objectURL = URL.createObjectURL(blob);

    // Create a container for the video and its button
    const videoItemContainer = document.createElement('div');
    videoItemContainer.className = 'video-item';

    // Create and append video element
    const videoEl = document.createElement('video');
    videoEl.src = objectURL;
    videoEl.autoplay = true;
    videoEl.loop = true;
    videoEl.controls = true;
    videoItemContainer.appendChild(videoEl);

    // Create and append download button
    const downloadButton = document.createElement('button');
    downloadButton.textContent = `Download Video ${i + 1}`;
    downloadButton.addEventListener('click', () => {
      downloadFile(objectURL, `video${i + 1}.mp4`);
    });
    videoItemContainer.appendChild(downloadButton);

    videoContainer.appendChild(videoItemContainer);
  });
}

const upload = document.querySelector('#file-input') as HTMLInputElement;
let base64data = '';

upload.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files[0];
  if (file) {
    base64data = await blobToBase64(file);
  }
});

const promptEl = document.querySelector('#prompt-input') as HTMLTextAreaElement;
const statusEl = document.querySelector('#status') as HTMLParagraphElement;
const videoContainer = document.querySelector(
  '#video-container',
) as HTMLDivElement;
const aspectRatioSelect = document.querySelector(
  '#aspect-ratio-select',
) as HTMLSelectElement;
const numberOfVideosInput = document.querySelector(
  '#number-of-videos-input',
) as HTMLInputElement;
const durationInput = document.querySelector(
  '#duration-input',
) as HTMLInputElement;

const generateButton = document.querySelector(
  '#generate-button',
) as HTMLButtonElement;
generateButton.addEventListener('click', (e) => {
  generate();
});

async function generate() {
  statusEl.innerHTML =
    '<div class="spinner"></div> Generating... Please wait, this may take a few minutes.';
  statusEl.classList.remove('error');
  videoContainer.innerHTML = ''; // Clear previous results

  const prompt = promptEl.value;
  const aspectRatio = aspectRatioSelect.value;
  const numberOfVideos = parseInt(numberOfVideosInput.value, 10);
  const duration = parseInt(durationInput.value, 10);

  const inputs = [
    generateButton,
    upload,
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
    );
    statusEl.innerText = `Done. ${numberOfVideos} video(s) generated. You can now play and download them.`;
  } catch (e) {
    let errorMessage = e.message;
    try {
      const err = JSON.parse(e.message);
      if (err.error) {
        if (err.error.status === 'RESOURCE_EXHAUSTED') {
          errorMessage = `Quota exceeded. Please check your plan and billing details. For more info, visit https://ai.google.dev/gemini-api/docs/rate-limits`;
        } else {
          errorMessage = err.error.message;
        }
      }
    } catch (parseError) {
      // Not a JSON string, use the original message
    }
    statusEl.innerText = `Error: ${errorMessage}`;
    statusEl.classList.add('error');
    console.error('Error:', e);
  }

  inputs.forEach((el) => (el.disabled = false));
}
