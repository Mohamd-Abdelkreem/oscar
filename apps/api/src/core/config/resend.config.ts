import {
  Resend,
  type CreateEmailOptions,
  type CreateEmailRequestOptions,
  type CreateEmailResponse,
} from "resend";

import { emailConfig } from "./email.config.js";

export interface ResendEmailClient {
  send(
    payload: CreateEmailOptions,
    options?: CreateEmailRequestOptions,
  ): Promise<CreateEmailResponse>;
}

let client: ResendEmailClient | undefined;

export const getResendEmailClient = (): ResendEmailClient => {
  if (client !== undefined) return client;

  const resend = new Resend(emailConfig.resendApiKey);
  client = {
    send: (payload, options) => resend.emails.send(payload, options),
  };
  return client;
};
