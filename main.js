// Load our configuration file
require("dotenv").config()

// For resizing images
const sharp = require("sharp")

// For filesystem operations (opening files etc.)
const fs = require("fs")

// For extracting the filename from paths
const path = require("path")

const slugify = require("slugify")

// Gives us a simple webserver which we can use to skip images, reload images etc.
http = require("http")

// The list of files retrieved from the M-1. By default it only grabs images that start with "slideshow_"
let fileList = []
// The last image we showed so we don't accidentally show two in a row if randomizing
var lastImage = ""
// If true, will display a new image every M1_SLIDESHOW_DURATION seconds. We can turn this off to display long-running 
var slideshow = true

// Set up the preset for the slideshow
async function setupPreset() {
    preset = {
        "on": true,
        "bri": 128,
        "transition": 7,
        "n": "Slideshow",
        "psave": 1,
        "mainseg": 0,
        "seg": [ // All the segments in this preset
            { // Segment 1 - The main image
                "id": 0,
                "start": 0, // Where the segment starts on the X axis
                "stop": 64, // Where it stops on the X axis
                "startY": 0, // Where it starts on the Y axis
                "stopY": 64, // Where it ends on the Y axis
                "n": "temp", // The name of the segment.For scrolling text, this is the text to display.For images, it's the image to display
                "fx": 53, // The effect to use. 53 = image, 122 is scrolling text
                "col": [ // The colours to use. 0 = primary, 1 = secondary(background), 3 = tertiary.
                    "#ffaa00",
                    "#000000",
                    "#000000"
                ]
            },
            {
                "id": 1, // Segment 2 - The date / time
                "start": 0, // Where the segment starts on the X axis
                "stop": 32, // Where it stops on the X axis
                "startY": 0, // Where it starts on the Y axis
                "stopY": 8, // Where it ends on the Y axis
                "n": "#HHMM", // The name of the segment.For scrolling text, this is the text to display.For images, it's the image to display
                "fx": 122, // The effect to use. 53 = image, 122 is scrolling text
            },
            {
                "id": 2, // Segment 2 - The date / time
                "start": 32, // Where the segment starts on the X axis
                "stop": 64, // Where it stops on the X axis
                "startY": 0, // Where it starts on the Y axis
                "stopY": 8, // Where it ends on the Y axis
                "n": "Loading..", // The name of the segment.For scrolling text, this is the text to display.For images, it's the image to display
                "fx": 122, // The effect to use. 53 = image, 122 is scrolling text
            }
        ]
    }

    const response = await fetch(`http://${process.env.M1_HOSTNAME}/json/state`, {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify(preset)
    });

    return response.json()
}

// Updates a segment in the first preset. Used to cycle through images, update the text etc.
async function updateSegment(segmentID, value) {
    try {

        let segment = {
            "seg": [{
                "id": segmentID,
                "n": value
            }]
        }

        const response = await fetch(`http://${process.env.M1_HOSTNAME}/json/state`, {
            method: "POST",
            signal: AbortSignal.timeout(10000),
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(segment)
        });
    } catch (ex) {

    }

}

async function getHACameraEntity() {
    const response = await fetch(`http://${process.env.HASS_HOSTNAME}/api/camera_proxy/${process.env.HASS_CAMERA_ENTITY}`, {
        method: "GET",
        signal: AbortSignal.timeout(10000),
        headers: {
            "Authorization": `Bearer ${process.env.HASS_TOKEN}`
        }
    });

    // Make a buffer out of the image so we can feed it to sharp for resizing
    const buffer = Buffer.from(await response.arrayBuffer());

    // Resize the image
    await sharp(buffer).resize(64, 64, {
        kernel: sharp.kernel.nearest,
        fit: sharp.fit.contain
    }).toFile("camera.gif")

}

// This renders a template for displaying on our screen
async function getHATemplate() {
    text = ""
    try {
        template = {
            template: process.env.HASS_TEMPLATE
        }

        const response = await fetch(`http://${process.env.HASS_HOSTNAME}/api/template`, {
            method: "POST",
            signal: AbortSignal.timeout(10000),
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": `Bearer ${process.env.HASS_TOKEN}`
            },
            body: JSON.stringify(template)
        });

        text = await response.text()

    } catch (ext) {

    }

    return text ?? ""

}

// This gets all the files from the M-1.
// If given a prefix, will only return files that start with that filename
async function getM1Files(prefix = "s_") {
    const fileList = []

    try {
        const response = await fetch(`http://${process.env.M1_HOSTNAME}/edit?list=%2F`, {
            method: "GET",
            signal: AbortSignal.timeout(10000),
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
        });

        files = await response.json()
        files.forEach(function (item) {
            if (item["name"].indexOf(prefix) > 0) {
                fileList.push(item["name"].substr(1))
            }
        })
    } catch (ex) {

    }

    return fileList

}

async function showImage(image) {
    if (image == undefined) {
        fileList = await getM1Files()
    }
    if (image == null) {
        // If we want to randomize the images
        if (process.env.M1_RANDOMIZE == "true") {
            // Pick one element at random
            var image = fileList[Math.floor(Math.random() * fileList.length)];
        } else {
            // Rotate the array by one position
            fileList.push(fileList.shift())
            // Get the first image
            var image = fileList[0]
        }

        // Don't show the same image twice
        if (image == lastImage) {
            showImage()
        }
    }

    lastImage = image

    console.log(`Updating segment 0 with image ${image}`)
    await updateSegment(0, image)
}

async function uploadFile(localFilename, remoteFilename) {
    console.log(`Uploading ${localFilename} as ${remoteFilename}..`)
    const fileBuffer = fs.readFileSync(localFilename);
    const formData = new FormData()

    formData.append("data", new Blob([fileBuffer], { type: "image/gif" }), "/" + remoteFilename);

    const response = await fetch(`http://${process.env.M1_HOSTNAME}/edit`, {
        method: "POST",
        signal: AbortSignal.timeout(100000),
        body: formData
    });

    if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
    } else {
        console.log(`Uploaded ${remoteFilename} successfully`)
    }
}

// Takes all the images in ./gifs (or whatever folder you've set) and resizes + uploads them
async function resizeAndUploadAll(center = true) {
    try {
        // First, we get a list of all the GIFs in the folder
        files = fs.globSync(`${process.env.GIFS_FOLDER}/{slideshow_,notification_}*.{png,jpeg,jpg,gif}`)
        console.log(`Found ${files.length} files to resize..`)
        await files.forEach(async(file) => {
            let outFilename = slugify(path.parse(file).name, {
                replacement: "_",
                lower: true,
                remove: /[*+~.()'"!:@\-]/g
            }) + ".gif"

            if(outFilename.length >= 32) {
                console.error(`Filename too long: ${outFilename} (length ${outFilename.length}). Will not play on the M-1!`)
                return
            }

            console.log(`Resizing ${outFilename}..`)
            await sharp(file, {
                animated: true
            }).resize(64, 64, {
                kernel: sharp.kernel.nearest,
                fit: center == true ? sharp.fit.cover : sharp.fit.contain
            }).gif({
                reuse: true
            }).toFile(`${process.env.RESIZED_FOLDER}/${outFilename}`)

        })
    } catch(ex) {
        console.log(ex)
    }
}

// Starts a basic webserver. When we hit the endpoints, it runs some functions. A basic way to reload files etc.
async function startWebserver() {
    const server = http.createServer(async (req, res) => {
        message = "Success"
        url = new URL(`http://${process.env.HOST ?? 'localhost'}${req.url}`)
        switch (url.pathname) {
            case "/reload":// Reload the files from the M-1 and re-render the HASS template
                await reload()
                message = "Reloaded files"
                break
            case "/next": // Move to the next image
                await showImage()
                slideshow = true
                message = "Showed next image"
                break
            case "/show":
                image = url.searchParams.get('image') ?? ''
                await showImage(image)
                message = `Showed image ${image}`
                slideshow = false
                break;
            case "/camera":
                await showCamera()
                message = "Showed camera"
                break
            case "/resize":
                await resizeAndUploadAll()
                message = "Resized images"
                break
            case "/updatestats":
                await updateSegment(2, await getHATemplate())
                message = "Stats updated and pushed to segment 2"
                break
            default:
                res.writeHead(404, { "Content-Type": "text/json" });
                res.end(JSON.stringify({ message: `Endpoint not found` }));
                return
        }

        res.writeHead(200, { "Content-Type": "text/json" });
        res.end(JSON.stringify({ message: `${message}` }));
        return;
    });

    server.listen(process.env.PORT ?? 8126, "0.0.0.0", () => {
        console.log(`Server running on http://0.0.0.0:${process.env.PORT}`);
    });
}

// Downloads an image of our camera, resizes it, uploads it, and displays it on the camera
async function showCamera() {
    // Temporarily turn off the slideshow
    slideshow = false
    // First, we show a blank image so the M-1 unloads it, and we can overwrite it
    await showImage("")
    // Then we download and resize the image from Home Assistant
    await getHACameraEntity()
    await uploadFile("./camera.gif", "camera.gif")
    await showImage("camera.gif")

    // Show the camera for 1 minute, then resume the slideshow
    setTimeout(() => {
        slideshow = true
    }, 1 * 60 * 1000)
}

async function reload() {
    fileList = await getM1Files()
    showImage()
    updateSegment(2, await getHATemplate())
}

async function setup() {
    fileList = await getM1Files()
    await setupPreset()
    await updateSegment(2, await getHATemplate())

    // This updates the text every minute. It shows whatever template we're rendering (by default, the date)
    setInterval(async function () {
        console.log("Updating segment with template data")
        await updateSegment(2, await getHATemplate())
    }, 1 * 60 * 1000) // 1 minute

    // This downloads a list of GIFs from the M-1
    setInterval(async function () {
        fileList = getM1Files()
    }, 5 * 60 * 1000) // 5 minutes

    setInterval(async function () {
        if (slideshow == true) {
            await showImage()
        }
    }, process.env.M1_SLIDESHOW_DURATION * 1000 ?? 30 * 1000)

    showImage()

}

startWebserver()
setup()