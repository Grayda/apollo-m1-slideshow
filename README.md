# apollo-m1-slideshow

This script displays a slideshow on the Apollo M-1, as well as two panels of information -- the time, and the date / temperature from Home Assistant. It can also display a camera entity which lets you do things like show who's at the front door when someone rings the doorbell

## How it works

The node.js script gets a list of files from the M-1 and finds all images that start with `slideshow_` (e.g. `slideshow_dancing-cat.gif`). It then uses a loop to update the segments as necessary.

## Why not just use the playlists on the M-1?

Playlists are good, but require you to make `n` many presets, and aren't very flexible when it comes to dynamic data. This script makes one preset, and just updates the name of the segments as required. This then lets you do things like show notifications on screen (e.g. when the bins need to go out) and pause "playback" so you don't have to worry about your notification getting cycled out.

## How to use it

1. Rename `.env.example` to `.env` and fill out as necessary
2. Upload your GIFs to your M-1 using the file manager (in Config > File System). Make sure they start with `slideshow_` (e.g. `slideshow_pikachu.gif`) and are 64x64
3. Run the script with something like `nodemon` so if it crashes, it just restarts
4. Your M-1 will update and start looping through all the GIFs it finds

There's also a few endpoints you can hit in your browser to do stuff:

* `/reload` - Gets the files from the M-1, shows the first image, and updates Segment 2 (which by default has the date and the temperature outside)
* `/next` - Shows the next image
* `/camera` - Downloads the camera entity and shows it on the screen for 60 seconds
* `/updatestats` - Re-renders the Home Assistant template and updates segment 2 with the new information
* `/show?image=<image>` - Shows a specific image and pauses the slideshow until you call `/next`
* `/resize` - Takes all the images in the `./gifs` folder (or wherever you set the folder) and resizes them into the `./resized` folder, ready to be uploaded

## To do:

* Uploading files works most of the time. Need to fix that
* Not all GIFs play for some reason. It might be a size or palette thing. Need to work out why and fix that too