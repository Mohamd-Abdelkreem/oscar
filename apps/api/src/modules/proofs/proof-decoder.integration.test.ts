import { spawn } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import sharp from "sharp";
import {
  decodeImage,
  type DecoderObservation,
} from "../../infrastructure/files/image-decoder.js";

it("resolves the development TypeScript child and reports acknowledged metrics", async () => {
  const root = await mkdtemp(join(tmpdir(), "oscar-p05-dev-child-"));
  const reservation = {
    storageKey: randomUUID(),
    inputPath: join(root, "input"),
    outputPath: join(root, "output.png"),
  };
  const observations: DecoderObservation[] = [];
  try {
    await writeFile(
      reservation.inputPath,
      await sharp({
        create: { width: 3, height: 2, channels: 4, background: "red" },
      })
        .png()
        .toBuffer(),
    );
    const result = await decodeImage({
      reservation,
      format: "png",
      signal: new AbortController().signal,
      observe: (observation) => observations.push(observation),
      storage: {
        // This decoder-only probe uses actual output bytes; Linux owns directory-durability acceptance.
        writeCanonical: async (_reservation, source, maximum, signal) => {
          await pipeline(
            source,
            createWriteStream(reservation.outputPath, { flags: "wx" }),
            { signal },
          );
          const bytes = await readFile(reservation.outputPath);
          expect(bytes.length).toBeLessThanOrEqual(maximum);
          return {
            byteCount: bytes.length,
            contentHash: createHash("sha256").update(bytes).digest("hex"),
          };
        },
      },
    });
    expect(result).toMatchObject({ width: 3, height: 2 });
    expect(
      (await sharp(await readFile(reservation.outputPath)).metadata()).format,
    ).toBe("png");
    expect(observations).toHaveLength(1);
    expect(observations[0]?.exitCode).toBe(0);
    expect(observations[0]?.partial).toBe(false);
    expect(observations[0]?.finalMaxRssBytes).toBeGreaterThan(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("streams actual multipart rasters through emitted supervised decoders on Linux", async () => {
  const apiDist = fileURLToPath(new URL("../../../dist", import.meta.url));
  const contractsDist = fileURLToPath(
    new URL("../../../../../packages/contracts/dist", import.meta.url),
  );
  const containerName = `oscar-p05-decoder-${randomUUID()}`;
  const bootstrap =
    'mkdir -p /work/api /work/node_modules/@template/contracts && npm install --prefix /work --ignore-scripts --no-audit --no-fund sharp@0.35.5 @fastify/busboy@3.2.2 zod@4.4.3 >/dev/null && cp -r /api/. /work/api/ && cp -r /contracts/. /work/node_modules/@template/contracts/ && printf \'{"type":"module","exports":"./index.js"}\' > /work/node_modules/@template/contracts/package.json && node --input-type=module';
  const program = `
import assert from 'node:assert/strict';
import {mkdtemp, readdir, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {randomUUID} from 'node:crypto';
import {crc32} from 'node:zlib';
import sharp from '/work/node_modules/sharp/dist/index.mjs';
import {PrivateImageStorage} from '/work/api/infrastructure/files/private-image-storage.js';
import {receiveMultipartImage} from '/work/api/infrastructure/files/multipart-image-upload.js';
import {decodeImage} from '/work/api/infrastructure/files/image-decoder.js';
const root=await mkdtemp(join(tmpdir(),'p05-decoder-'));
const storage=new PrivateImageStorage({storageRoot:root,processingSlots:2,uploadReservationBytes:41943040,stagingMaxBytes:268435456,inputDeadlineMs:30000});
const metrics=[];
function body(bytes,format,{name='file',filename='fixture.'+format,extra='',commandId=randomUUID()}={}) {
  return Buffer.concat([Buffer.from('--fixture\\r\\nContent-Disposition: form-data; name="commandId"\\r\\n\\r\\n'+commandId+'\\r\\n--fixture\\r\\nContent-Disposition: form-data; name="'+name+'"; filename="'+filename+'"\\r\\nContent-Type: image/'+format+'\\r\\n\\r\\n'),bytes,Buffer.from('\\r\\n'+extra+'--fixture--\\r\\n')]);
}
async function intake(bytes,format,changes={}) {
  const reservation=await storage.reserve();
  const multipart=body(bytes,format,changes);
  try {
    const result=await receiveMultipartImage({source:Readable.from([multipart.subarray(0,17),multipart.subarray(17)]),headers:{'content-type':'multipart/form-data; boundary=fixture'},storage,reservation,inputDeadlineMs:30000,signal:new AbortController().signal});
    return {reservation,result};
  } catch(error) {await storage.discard(reservation);throw error;}
}
try {
  await storage.initialize();
  for(const format of ['png','jpeg','webp']) {
    const input=await sharp({create:{width:7,height:3,channels:4,background:'#123456'}}).toFormat(format).toBuffer();
    const {reservation,result}=await intake(input,format);
    assert.equal(result.byteCount,input.length);
    const decoded=await decodeImage({reservation,format,storage,signal:new AbortController().signal,observe:metric=>metrics.push(metric)});
    assert.equal(decoded.width,7);assert.equal(decoded.height,3);
    const canonical=await readFile(reservation.outputPath);
    const metadata=await sharp(canonical).metadata();
    assert.equal(metadata.format,'png');assert.equal(metadata.exif,undefined);
    assert.equal(decoded.byteCount,canonical.length);
    await storage.publish(reservation,33554432);
    await storage.releaseAccepted(reservation);
  }
  const png=await sharp({create:{width:2,height:2,channels:3,background:'white'}}).png().toBuffer();
  for(const changes of [{name:'unknown'},{filename:'../fixture.png'},{filename:'fixture.jpg'},{commandId:'not-a-uuid'},{extra:'--fixture\\r\\nContent-Disposition: form-data; name="other"\\r\\n\\r\\nextra\\r\\n'}])
    await assert.rejects(intake(png,'png',changes),{code:'INVALID_IMAGE'});
  const exact=await intake(Buffer.alloc(5242880),'png');
  assert.equal(exact.result.byteCount,5242880);await storage.discard(exact.reservation);
  await assert.rejects(intake(Buffer.alloc(5242881),'png'),{code:'UPLOAD_TOO_LARGE'});
  for(const [invalid,code,statusCode] of [[Buffer.from('<svg/>'),'UNSUPPORTED_IMAGE',415],[Buffer.from('GIF89a'),'UNSUPPORTED_IMAGE',415],[png.subarray(0,png.length-1),'INVALID_IMAGE',400]]) {
    const {reservation}=await intake(invalid,'png');
    await assert.rejects(decodeImage({reservation,format:'png',storage,signal:new AbortController().signal}),{code,statusCode});
    await storage.discard(reservation);
  }
  const tooWide=await sharp({create:{width:8193,height:1,channels:4,background:'white'}}).png().toBuffer();
  const tooManyPixels=await sharp({create:{width:4097,height:4096,channels:4,background:'white'}}).png().toBuffer();
  for(const input of [tooWide,tooManyPixels]) {
    const {reservation}=await intake(input,'png');
    await assert.rejects(decodeImage({reservation,format:'png',storage,signal:new AbortController().signal}),{code:'INVALID_IMAGE'});
    await storage.discard(reservation);
  }
  // Animation is rejected from the actual container, including acTL regardless of decoder page reporting.
  const acTL=Buffer.alloc(20);acTL.writeUInt32BE(8,0);acTL.write('acTL',4);acTL.writeUInt32BE(2,8);acTL.writeUInt32BE(crc32(acTL.subarray(4,16)),16);
  const animatedPng=Buffer.concat([png.subarray(0,33),acTL,png.subarray(33)]);
  const framePixels=Buffer.from([255,0,0,255,255,0,0,255,255,0,0,255,255,0,0,255,0,0,255,255,0,0,255,255,0,0,255,255,0,0,255,255]);
  const animatedWebp=await sharp(framePixels,{raw:{width:2,height:4,pageHeight:2,channels:4}}).webp({loop:0,delay:[100,100]}).toBuffer();
  assert.equal((await sharp(animatedWebp,{animated:true}).metadata()).pages,2);
  for(const [input,format] of [[animatedPng,'png'],[animatedWebp,'webp']]) {
    const {reservation}=await intake(input,format);
    await assert.rejects(decodeImage({reservation,format,storage,signal:new AbortController().signal}),{code:'UNSUPPORTED_IMAGE',statusCode:415});
    await storage.discard(reservation);
  }
  const jpeg=await sharp(png).jpeg().toBuffer();
  const truncatedJpeg=await intake(jpeg.subarray(0,jpeg.length-1),'jpeg');
  await assert.rejects(decodeImage({reservation:truncatedJpeg.reservation,format:'jpeg',storage,signal:new AbortController().signal}),{code:'INVALID_IMAGE',statusCode:400});await storage.discard(truncatedJpeg.reservation);
  const spoofed=await intake(jpeg,'png');await assert.rejects(decodeImage({reservation:spoofed.reservation,format:'png',storage,signal:new AbortController().signal}),{code:'INVALID_IMAGE'});await storage.discard(spoofed.reservation);
  for(const changes of [{filename:'control\\u0000.png'},{extra:'--fixture\\r\\nContent-Disposition: form-data; name="commandId"\\r\\n\\r\\n'+randomUUID()+'\\r\\n'},{extra:'--fixture\\r\\nContent-Disposition: form-data; name="file"; filename="second.png"\\r\\nContent-Type: image/png\\r\\n\\r\\nextra\\r\\n'}]) await assert.rejects(intake(png,'png',changes),{code:'INVALID_IMAGE'});
  async function parserOnly(bytes,headers={'content-type':'multipart/form-data; boundary=fixture'}) {
    const reservation=await storage.reserve();try{return await receiveMultipartImage({source:Readable.from([bytes]),headers,storage,reservation,inputDeadlineMs:30000,signal:new AbortController().signal});}finally{await storage.discard(reservation);}
  }
  const aggregateBody=body(png,'png');
  await parserOnly(Buffer.concat([aggregateBody,Buffer.alloc(5259264-aggregateBody.length,32)]));
  await assert.rejects(parserOnly(Buffer.concat([aggregateBody,Buffer.alloc(5259265-aggregateBody.length,32)])),{code:'UPLOAD_TOO_LARGE'});
  await assert.rejects(parserOnly(aggregateBody.subarray(0,aggregateBody.length-10)),{code:'INVALID_IMAGE'});
  for(const headers of [{'content-type':'multipart/form-data; boundary='+ 'x'.repeat(71)},{'content-type':'multipart/form-data; boundary=fixture','content-encoding':'gzip'},{'content-type':'multipart/form-data; boundary=fixture','content-length':'-1'}]) await assert.rejects(parserOnly(aggregateBody,headers),{code:'INVALID_IMAGE'});
  const stalled=await storage.reserve();
  await assert.rejects(receiveMultipartImage({source:new Readable({read(){}}),headers:{'content-type':'multipart/form-data; boundary=fixture'},storage,reservation:stalled,inputDeadlineMs:30,signal:new AbortController().signal}),{code:'UPLOAD_INTERRUPTED'});
  await storage.discard(stalled);
  const excessiveBody=await storage.reserve();
  await assert.rejects(receiveMultipartImage({source:Readable.from([Buffer.alloc(5259265)]),headers:{'content-type':'multipart/form-data; boundary=fixture'},storage,reservation:excessiveBody,inputDeadlineMs:30000,signal:new AbortController().signal}),{code:'UPLOAD_TOO_LARGE'});
  await storage.discard(excessiveBody);
  assert.equal(metrics.length,3);
  for(const metric of metrics) {assert.equal(metric.exitCode,0);assert.equal(metric.partial,false);assert.ok(metric.finalMaxRssBytes>=metric.sampledRssBytes);assert.ok(metric.finalMaxRssBytes<536870912);}
  assert.deepEqual(await readdir(join(root,'staging')),[]);
  console.log(JSON.stringify({decoder:'passed',metrics}));
} finally {await rm(root,{recursive:true});}
`;
  const child = spawn(
    "docker",
    [
      "run",
      "--name",
      containerName,
      "-i",
      "--mount",
      `type=bind,source=${apiDist},target=/api,readonly`,
      "--mount",
      `type=bind,source=${contractsDist},target=/contracts,readonly`,
      "--entrypoint",
      "sh",
      "node:24.18.1-bookworm-slim",
      "-c",
      bootstrap,
    ],
    { windowsHide: true },
  );
  let output = "";
  let diagnostics = "";
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
    output += chunk;
  });
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
    diagnostics += chunk;
  });
  const completion = new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  child.stdin.end(program);
  const deadline = setTimeout(() => {
    child.kill();
  }, 150_000);
  try {
    const exit = await completion;
    if (exit !== 0)
      throw new Error(
        `Synthetic decoder acceptance failed (${String(exit)}): ${diagnostics}`,
      );
    expect(JSON.parse(output)).toMatchObject({ decoder: "passed" });
  } finally {
    clearTimeout(deadline);
    const cleanup = spawn("docker", ["rm", "--force", containerName], {
      windowsHide: true,
      stdio: "ignore",
      timeout: 10_000,
    });
    await new Promise<void>((resolve, reject) => {
      cleanup.once("error", reject);
      cleanup.once("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error("Decoder fixture container cleanup failed."));
      });
    });
  }
}, 180_000);
