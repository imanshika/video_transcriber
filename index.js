require('dotenv').config();
const express  = require("express");
const cors = require("cors");
const speech = require("@google-cloud/speech");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ffmpegPath = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");

const app = express();

app.use(cors());
app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.set('view engine', 'ejs')

const PORT = process.env.PORT || 2000;

const client = new speech.SpeechClient({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
})

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + '-' + file.originalname);
    }
  });
  
  // Create the multer instance
  const upload = multer({ storage: storage });

ffmpeg.setFfmpegPath(ffmpegPath);

app.get("/", (req, res) => {
    res.render("index");
})


app.post("/transcribe", upload.single("file"), async (req, res) => {
    if(!req.file){
        return res.status(400).send("No file uploaded");
    }
    const videoFilePath = req.file.path;
    const audioFilePath = `${videoFilePath}.wav`;
    ffmpeg(videoFilePath)
    .toFormat("wav")
    .audioFrequency(16000)
    .audioChannels(1)
    .on("end", async () => {
        const audioBytes = fs.readFileSync(audioFilePath).toString("base64");
        const request = {
            audio: {
                content: audioBytes
            },
            config: {
                encoding: "LINEAR16",
                sampleRateHertz: 16000,
                languageCode: "en-US"
            }
        }

        try{
            const [response] = await client.recognize(request);
            const transcription = response.results.map(result => result.alternatives[0].transcript).join(" ");

            fs.unlinkSync(videoFilePath);
            fs.unlinkSync(audioFilePath);

            res.send({
                text: transcription
            });

        }catch (error){
            console.log(`Error ocurred while fetching text from google API \n ${error}`);
            fs.unlinkSync(videoFilePath);
            fs.unlinkSync(audioFilePath);
            res.status(500).send(`Error while transcribing video: ${error.message}`);
        }
    })
    .on("error", (error) => {
        console.log(`Error while extract audio\n ${error}`);
        res.status(500).send("Error while processing video");
    })
    .save(audioFilePath);
})

app.listen(PORT, () => {
    console.log(`Server is running on PORT: ${PORT}`);
})