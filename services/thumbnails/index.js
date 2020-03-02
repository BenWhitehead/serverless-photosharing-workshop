// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
const express = require('express');
const bodyParser = require('body-parser');
const im = require('imagemagick');
const Promise = require("bluebird");
const path = require('path');
const {Storage} = require('@google-cloud/storage');
const storage = new Storage();

const app = express();
app.use(bodyParser.json());

app.get('/', async (req, res) => {
    console.log("It works");
    res.status(200).send("Works");
});

app.post('/', async (req, res) => {
    try {
        const pubSubMessage = req.body;
        console.log(`PubSub message: ${JSON.stringify(pubSubMessage)}`);

        const fileEvent = JSON.parse(Buffer.from(pubSubMessage.message.data, 'base64').toString().trim());
        console.log(`Base 64 decoded file event: ${JSON.stringify(fileEvent)}`);
        console.log(`Received thumbnail request for file ${fileEvent.name} from bucket ${fileEvent.bucket}`);

        const bucket = storage.bucket(fileEvent.bucket);
        const thumbBucket = storage.bucket('thumbnail-pictures');

        const localFile = path.resolve('/tmp', fileEvent.name);
        const parsedPath = path.parse(localFile);
        const thumbPath = path.resolve(parsedPath.dir, parsedPath.name) + '_thumb' + parsedPath.ext;

        await bucket.file(fileEvent.name).download({
            destination: localFile
        });
        console.log(`Downloaded picture into ${localFile}`);

        const resize = Promise.promisify(im.resize);
        await resize({
                srcPath: localFile,
                dstPath: thumbPath,
                width: 200,
                height: 200         
        });
        console.log(`Created local thumbnail in ${thumbPath}`);

        await thumbBucket.upload(thumbPath);
        console.log("Uploaded thumbnail to Cloud Storage");

        res.status(204).send(`${fileEvent.name} processed`);
    } catch (err) {
        console.log(`Error: creating the thumbnail: ${err}`);
        console.error(err);
        res.status(500).send(err);
    }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`Started thumbnail generator on port ${PORT}`);
});