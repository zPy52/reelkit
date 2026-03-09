```ts
import { VidioMedia } from 'vidio';

VidioMedia.hardware.list(); // Array<{ name: string; id: string; type: 'cpu' | 'gpu' }>
// This lists all options such as
/* 
[
  { name: 'CPU', id: 'libx264', type: 'cpu' },
  { name: 'NVIDIA NVENC', id: 'h264_nvenc', type: 'gpu' },
   ...,
  { name: 'Intel QSV', id: 'h264_qsv', type: 'gpu' },
   ...,
  { name: 'AMD AMF', id: 'h264_amf', type: 'gpu' },
   ...
]
*/
```

That is, it shows a layman-readable name (`CPU`, `NVIDIA NVENC`...) and the actual id. These IDs were copied by me on a random webpage, in real life they might not be these. It should support all encodings that hardware makes available, like HEVC (H.265) or AV1 (more modern), and the like.

A discussion from github on this topic with ffmpeg: https://github.com/cdgriffith/FastFlix/discussions/645

Then, by default `export` it'll pick the first `gpu` it finds; otherwise the first `cpu`.

```ts
const batch = new VidioMedia({ input: 'i.mp4' }).scale(1.2);

let hwId = '';

// Optional filters: if type is specified, it'll pick only those of that type
const gpus = VidioMedia.hardware.list({ type: 'gpu' });

if (gpus.length > 0) {
  hwId = gpus.at(0).id;
} else {
  const cpus = VidioMedia.hardware.list({ type: 'cpu' });
  hwId = cpus.at(0).id;
}

// Here the user could have also specified an ID; this is just as an example
// In case they provided an id, we should always use:
VidioMedia.hardware.isAvailable(hwId) // returns null if it isn't, otherwise returns an object of type { name: string; id: string; type: 'cpu' | 'gpu' }

batch.export('o.mp4', { hardware: hwId });
```

**On exports:** Support both a constructor default and an export override. Resolution: `export options.hardware ?? constructor hardware ?? VidioMedia.hardware.default()`.

```ts
// Default for this batch; export can override.
const batch = new VidioMedia({ input: 'i.mp4', hardware: 'h264_nvenc' }).scale(1.2);
batch.export('o.mp4');                    // uses h264_nvenc
batch.export('preview.mp4', { hardware: 'libx264' }); // overrides to CPU
```

**Short QA notes**

| Question | Answer |
|----------|--------|
| Use HW for "loading" (probe)? | No. Probing is metadata-only; HW decode there is unnecessary. |
| Use HW elsewhere? | Only at export (encoding). Optional later: HW decode during export. |
| Constructor vs export? | Prefer export option + optional `hardware` in `VidioMediaProps` as default; override in `export()`. |
| Is constructor HW unnecessary? | Optional convenience. The critical part is `{ hardware }` at `export()`. |