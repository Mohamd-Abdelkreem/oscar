import { expect, it } from "vitest";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createTaskScenario,
  taskIdentity,
  withTaskDatabase,
} from "../tasks/testing/task-fixtures.js";
import { runLinuxProofProgram } from "./testing/linux-proof-runtime.js";

const generator = String.raw`
import sharp from 'sharp';import {crc32} from 'node:zlib';import {writeFile} from 'node:fs/promises';import {join} from 'node:path';
sharp.cache(false);sharp.concurrency(1);const folder=process.argv[1];
const records=[];
async function save(name,format,input,expected,hostile=false){const bytes=await input.toBuffer();const metadata=await sharp(bytes).metadata();const canonical=await sharp(bytes).autoOrient().png().toBuffer();if(bytes.length>5242880)throw new Error('Fixture input exceeds 5 MiB: '+name);if(hostile&&canonical.length<=33554432)throw new Error('Hostile fixture does not exceed output cap: '+name);if(!hostile&&canonical.length>33554432)throw new Error('Valid fixture output exceeds cap: '+name);await writeFile(join(folder,name),bytes);records.push({name,format,bytes:bytes.length,width:metadata.width,height:metadata.height,channels:metadata.channels,canonicalBytes:canonical.length,expected,hostile});}
await save('square.png','png',sharp({create:{width:4096,height:4096,channels:4,background:'#12345688'}}).png(),{width:4096,height:4096});
await save('wide.png','png',sharp({create:{width:8192,height:2048,channels:4,background:'#ABCDEF88'}}).png(),{width:8192,height:2048});
await save('oriented.jpeg','jpeg',sharp({create:{width:8192,height:2048,channels:3,background:'#112233'}}).jpeg().withMetadata({orientation:6}),{width:2048,height:8192});
await save('alpha.webp','webp',sharp({create:{width:4096,height:4096,channels:4,background:'#44556688'}}).webp(),{width:4096,height:4096});
const pixels=Buffer.alloc(4096*4096*3);let seed=0x5eeda11;for(let index=0;index<pixels.length;index++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;pixels[index]=seed&255;}
for(const format of ['jpeg','webp']) {
 let input=pixels,channels=3;
 if(format==='webp'){input=Buffer.alloc(4096*4096*4);for(let pixel=0;pixel<4096*4096;pixel++){input[pixel*4]=pixels[pixel*3];input[pixel*4+1]=pixels[pixel*3+1];input[pixel*4+2]=pixels[pixel*3+2];input[pixel*4+3]=pixel%256;}channels=4;}
 let found=false;
 for(const quality of (format==='webp'?[5]:[40,30])) {
  const bytes=await sharp(input,{raw:{width:4096,height:4096,channels}}).toFormat(format,{quality}).toBuffer();
  if(bytes.length>5242880)continue;
  const png=await sharp(bytes).png().toBuffer();
  if(png.length>33554432){await writeFile(join(folder,'hostile.'+format),bytes);const metadata=await sharp(bytes).metadata();records.push({name:'hostile.'+format,format,bytes:bytes.length,width:metadata.width,height:metadata.height,channels:metadata.channels,canonicalBytes:png.length,expected:null,hostile:true});found=true;break;}
 }
 if(!found)throw new Error('Cannot establish bounded hostile '+format+' fixture');
}
async function rejected(name,format,bytes,precondition,expectedCode='INVALID_IMAGE'){if(bytes.length<1||bytes.length>5242880)throw new Error('Rejected fixture input is unbounded');await writeFile(join(folder,name),bytes);records.push({name,format,bytes:bytes.length,hostile:true,expectedCode,precondition});}
for(const [name,width,height] of [['too-wide.png',8193,1],['too-many-pixels.png',4097,4096]]){const bytes=await sharp({create:{width,height,channels:4,background:'white'}}).png().toBuffer();const metadata=await sharp(bytes).metadata();if(!(metadata.width>8192||metadata.width*metadata.height>16777216))throw new Error('Invalid dimension fixture precondition');await rejected(name,'png',bytes,{width:metadata.width,height:metadata.height,pixels:metadata.width*metadata.height});}
const red=await sharp({create:{width:2,height:2,channels:4,background:'red'}}).png().toBuffer(),blue=await sharp({create:{width:2,height:2,channels:4,background:'blue'}}).png().toBuffer();
function chunk(kind,data){const result=Buffer.alloc(data.length+12);result.writeUInt32BE(data.length,0);result.write(kind,4);data.copy(result,8);result.writeUInt32BE(crc32(result.subarray(4,result.length-4)),result.length-4);return result;}
function imageData(bytes){const chunks=[];for(let offset=8;offset+12<=bytes.length;){const length=bytes.readUInt32BE(offset);if(bytes.toString('ascii',offset+4,offset+8)==='IDAT')chunks.push(bytes.subarray(offset+8,offset+8+length));offset+=length+12;}return Buffer.concat(chunks);}
function frame(sequence){const data=Buffer.alloc(26);data.writeUInt32BE(sequence,0);data.writeUInt32BE(2,4);data.writeUInt32BE(2,8);data.writeUInt16BE(100,20);data.writeUInt16BE(1000,22);return chunk('fcTL',data);}
const animation=Buffer.alloc(8);animation.writeUInt32BE(2,0);const second=Buffer.alloc(4);second.writeUInt32BE(2);const apng=Buffer.concat([red.subarray(0,33),chunk('acTL',animation),frame(0),chunk('IDAT',imageData(red)),frame(1),chunk('fdAT',Buffer.concat([second,imageData(blue)])),chunk('IEND',Buffer.alloc(0))]);await rejected('animated.png','png',apng,{declaredFrames:2,frameControls:2},'UNSUPPORTED_IMAGE');
const framePixels=Buffer.from([255,0,0,255,255,0,0,255,255,0,0,255,255,0,0,255,0,0,255,255,0,0,255,255,0,0,255,255,0,0,255,255]);const animatedWebp=await sharp(framePixels,{raw:{width:2,height:4,pageHeight:2,channels:4}}).webp({loop:0,delay:[100,100]}).toBuffer();const webpMetadata=await sharp(animatedWebp,{animated:true}).metadata();if(webpMetadata.pages!==2)throw new Error('Animated WebP fixture collapsed');await rejected('animated.webp','webp',animatedWebp,{pages:webpMetadata.pages},'UNSUPPORTED_IMAGE');
await rejected('malformed.png','png',red.subarray(0,red.length-1),{removedIendByte:true});
await writeFile(join(folder,'corpus.json'),JSON.stringify(records));
`;

it("measures the native corpus and ten two-slot rounds in an isolated API process", async () => {
  await withTaskDatabase(async (database, url) => {
    const scenario = await createTaskScenario(database);
    const output = await runLinuxProofProgram(
      String.raw`
import assert from 'node:assert/strict';
import {readFile,mkdtemp,readdir,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {Readable} from 'node:stream';import {randomUUID} from 'node:crypto';import {spawn} from 'node:child_process';
Object.assign(process.env,JSON.parse(await readFile('/fixture/environment.json','utf8')));
const fixture=JSON.parse(await readFile('/fixture/fixtures.json','utf8'));
const root=await mkdtemp(join(tmpdir(),'p05-resources-'));
const generator=fixture.generator;
const generated=spawn(process.execPath,['--input-type=module','-e',generator,root],{stdio:['ignore','ignore','pipe']});let generationErrors='';generated.stderr.setEncoding('utf8').on('data',chunk=>generationErrors+=chunk);assert.equal(await new Promise(resolve=>generated.once('close',resolve)),0,generationErrors);
const corpus=JSON.parse(await readFile(join(root,'corpus.json'),'utf8'));
const {createDatabaseClient}=await import('@template/database');const {createApp}=await import('./api/app.js');const {ProofsRuntime}=await import('./api/modules/proofs/proofs.runtime.js');const {default:pino}=await import('pino');
const database=createDatabaseClient(process.env.DATABASE_URL);const metrics=[];
const storageRoot=join(root,'private');await (await import('node:fs/promises')).mkdir(storageRoot,{mode:448});
const runtime=new ProofsRuntime(database,{storageRoot,processingSlots:2,uploadReservationBytes:41943040,stagingMaxBytes:268435456,inputDeadlineMs:30000},()=>new Date(fixture.now),()=>{},metric=>metrics.push(metric));
await runtime.start();const app=createApp({database,logger:pino({level:'silent'}),proofs:runtime,financialClock:()=>new Date(fixture.now)});const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
function multipart(bytes,format){return Buffer.concat([Buffer.from('--native\r\nContent-Disposition: form-data; name="commandId"\r\n\r\n'+randomUUID()+'\r\n--native\r\nContent-Disposition: form-data; name="file"; filename="fixture.'+format+'"\r\nContent-Type: image/'+format+'\r\n\r\n'),bytes,Buffer.from('\r\n--native--\r\n')]);}
async function upload(record,source){const bytes=await readFile(join(root,record.name));const promise=runtime.uploads.upload(fixture.employee,'PROOF',{source:source??Readable.from([multipart(bytes,record.format)]),headers:{'content-type':'multipart/form-data; boundary=native'},signal:new AbortController().signal});if(record.hostile){await assert.rejects(promise,{code:record.expectedCode??'INVALID_IMAGE'});return null;}const result=await promise;assert.equal(result.width,record.expected.width);assert.equal(result.height,record.expected.height);assert.ok(result.storedByteCount<=33554432);return result;}
try {
 const walletBefore=await database.wallet.findUniqueOrThrow({where:{ownerUserId:fixture.employee.userId}}),operationsBefore=await database.financialOperation.count();
 await upload(corpus[0]);global.gc();await new Promise(resolve=>setTimeout(resolve,100));const baseline=process.memoryUsage.rss();let peak=baseline;const sample=setInterval(()=>{peak=Math.max(peak,process.memoryUsage.rss());},10);
 try {
  for(const record of corpus)await upload(record);
  const rounds=[];
  for(let round=0;round<10;round++) {
   const pair=round%4===0?[corpus[0],corpus[1]]:round%4===1?[corpus[3],corpus[0]]:round%4===2?[corpus[4],corpus[5]]:[corpus[10],corpus[5]];
   const sources=[];const entered=[];
   for(let index=0;index<2;index++){let admit;entered.push(new Promise(resolve=>admit=resolve));sources.push(new Readable({read(){admit();}}));}
   const start=metrics.length;const jobs=pair.map((record,index)=>upload(record,sources[index]));await Promise.all(entered);
   const beforeThird=metrics.length;const third=await readFile(join(root,corpus[0].name));await assert.rejects(runtime.uploads.upload(fixture.employee,'PROOF',{source:Readable.from([multipart(third,'png')]),headers:{'content-type':'multipart/form-data; boundary=native'},signal:new AbortController().signal}),{code:'PROOF_PROCESSING_BUSY',statusCode:429});assert.equal(metrics.length,beforeThird);
   for(let index=0;index<2;index++){sources[index].push(multipart(await readFile(join(root,pair[index].name)),pair[index].format));sources[index].push(null);}
   await Promise.all(jobs);const observations=metrics.slice(start);assert.equal(observations.length,2);let sum=0;for(const observation of observations){const retained=observation.finalMaxRssBytes??observation.sampledRssBytes;assert.ok(retained>0);assert.ok(retained<=536870912,JSON.stringify(observation));if(!observation.partial)assert.ok(observation.finalMaxRssBytes>=observation.sampledRssBytes);sum+=retained;}assert.ok(sum<=1073741824);rounds.push({round:round+1,combinedBytes:sum,observations});
  }
  peak=Math.max(peak,process.memoryUsage.rss());assert.ok(peak-baseline<=134217728,'API RSS growth '+(peak-baseline));
  assert.deepEqual(await readdir(join(storageRoot,'staging')),[]);assert.equal(await database.taskSubmission.count(),0);
  assert.deepEqual(await database.wallet.findUniqueOrThrow({where:{ownerUserId:fixture.employee.userId}}),walletBefore);assert.equal(await database.financialOperation.count(),operationsBefore);
  for(const metric of metrics){assert.ok((metric.finalMaxRssBytes??metric.sampledRssBytes)<=536870912);if(metric.exitCode===0){assert.equal(metric.partial,false);assert.ok(metric.finalMaxRssBytes>0);}}
  console.log(JSON.stringify({resources:'passed',baseline,peak,growth:peak-baseline,corpus,rounds,metrics}));
 } finally {clearInterval(sample);}
} finally {await runtime.stop();await new Promise(resolve=>server.close(resolve));await database.$disconnect();await rm(root,{recursive:true,force:true});}
`,
      url,
      {
        employee: taskIdentity(scenario.employee),
        now: scenario.clock().toISOString(),
        generator,
      },
      480_000,
    );
    const result = JSON.parse(output) as {
      resources: string;
      growth: number;
      rounds: unknown[];
    };
    expect(result.resources).toBe("passed");
    expect(result.rounds).toHaveLength(10);
    expect(result.growth).toBeLessThanOrEqual(134_217_728);
    await writeFile(
      join(tmpdir(), "oscar-p05-resource-observations.json"),
      output,
    );
  });
}, 540_000);
