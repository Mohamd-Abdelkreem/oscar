import type { Request, Response } from "express";
import { pipeline } from "node:stream/promises";
import { z } from "zod";
import type { ImageAssetPurpose } from "@template/database";
import { ResponseHelper } from "../../core/responses/api-response.js";
import { authenticatedSubscriptionIdentity } from "../subscriptions/subscriptions.controller.js";
import type { ProofUploadService } from "./proof-upload.service.js";
import type { ProofReadService } from "./proof-read.service.js";

export const imageParamsSchema = z.strictObject({ assetId: z.uuid() });
export const uploadParamsSchema = z.strictObject({ commandId: z.uuid() });

export class ProofsController {
  constructor(
    private readonly uploads: ProofUploadService,
    private readonly reads: ProofReadService,
    private readonly purpose: ImageAssetPurpose,
  ) {}

  upload = async (request: Request, response: Response) => {
    const controller = new AbortController();
    const interrupt = () => {
      controller.abort();
    };
    request.once("aborted", interrupt);
    response.once("close", interrupt);
    try {
      const asset = await this.uploads.upload(
        authenticatedSubscriptionIdentity(request),
        this.purpose,
        {
          source: request,
          headers: request.headers,
          signal: controller.signal,
        },
      );
      const metadata = await this.reads.metadata(
        authenticatedSubscriptionIdentity(request),
        this.purpose,
        asset.id,
      );
      return ResponseHelper.created(
        response,
        metadata,
        "Image accepted.",
        request.path,
        request.requestId,
      );
    } finally {
      request.off("aborted", interrupt);
      response.off("close", interrupt);
    }
  };

  observe = async (request: Request, response: Response) => {
    const { commandId } = uploadParamsSchema.parse(request.validated?.params);
    const asset = await this.uploads.observe(
      authenticatedSubscriptionIdentity(request),
      this.purpose,
      commandId,
    );
    return ResponseHelper.ok(
      response,
      await this.reads.observation(asset, commandId, this.purpose),
      "Upload observed.",
      request.path,
      request.requestId,
    );
  };

  cancel = async (request: Request, response: Response) => {
    const { commandId } = uploadParamsSchema.parse(request.validated?.params);
    const asset = await this.uploads.cancel(
      authenticatedSubscriptionIdentity(request),
      this.purpose,
      commandId,
      request.validated?.body,
    );
    return ResponseHelper.ok(
      response,
      await this.reads.observation(asset, commandId, this.purpose),
      "Upload resolved.",
      request.path,
      request.requestId,
    );
  };

  metadata = async (request: Request, response: Response) => {
    const { assetId } = imageParamsSchema.parse(request.validated?.params);
    return ResponseHelper.ok(
      response,
      await this.reads.metadata(
        authenticatedSubscriptionIdentity(request),
        this.purpose,
        assetId,
      ),
      "Image loaded.",
      request.path,
      request.requestId,
    );
  };

  content = async (request: Request, response: Response) => {
    const { assetId } = imageParamsSchema.parse(request.validated?.params);
    const { file, byteCount } = await this.reads.content(
      authenticatedSubscriptionIdentity(request),
      this.purpose,
      assetId,
    );
    const stream = this.reads.trackStream();
    try {
      response.set({
        "Content-Type": "image/png",
        "Content-Length": String(byteCount),
        "Content-Disposition": 'inline; filename="image.png"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      });
      await pipeline(file.createReadStream({ autoClose: false }), response, {
        signal: stream.signal,
      });
    } finally {
      await file.close();
      stream.release();
    }
  };
}
