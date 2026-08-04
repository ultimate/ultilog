# Logbook scanner image fixtures

Image fixtures may be stored either as ordinary image files or as Base64 text
files ending in `.base64.txt`. The latter keeps generated image data compatible
with patch transports that do not accept binary files. The fixture test decodes
these files in memory before sending them to the scanner provider.

To restore an encoded image locally, remove the `.base64.txt` suffix from the
output name and decode it, for example:

```sh
base64 --decode scanned.png.base64.txt > scanned.png
```

Line wrapping in encoded files is insignificant; the test removes whitespace
before decoding. Keep the original image extension immediately before
`.base64.txt` so the fixture loader can determine the correct MIME type.
