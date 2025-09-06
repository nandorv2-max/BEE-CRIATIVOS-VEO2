const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use(express.static('.')); // Serve the frontend files (index.html, etc.)

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  console.error('API_KEY environment variable not set.');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.post('/generate-video', async (req, res) => {
  try {
    const { prompt, imageBytes, aspectRatio, numberOfVideos, durationSeconds } = req.body;

    const config = {
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
      console.log('Polling for video generation...');
      await delay(10000); // Wait 10 seconds before polling again
      operation = await ai.operations.getVideosOperation({ operation });
    }

    const videos = operation.response?.generatedVideos;
    if (!videos || videos.length === 0) {
      return res.status(500).json({ error: 'No videos were generated.' });
    }

    // For simplicity, we'll return the first video.
    // A more complex app could return all video URLs.
    const videoUrl = videos[0].video.uri;

    // The server now fetches the video using its secure API key
    const videoResponse = await fetch(`${videoUrl}&key=${API_KEY}`);

    if (!videoResponse.ok) {
        throw new Error(`Failed to fetch video: ${videoResponse.statusText}`);
    }

    // Stream the video back to the client
    res.setHeader('Content-Type', 'video/mp4');
    videoResponse.body.pipe(res);

  } catch (error) {
    console.error('Error during video generation:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
